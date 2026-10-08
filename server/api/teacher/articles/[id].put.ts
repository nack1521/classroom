import { requireAuthUser } from '../../../utils/supabase'
import { validateTeacherDraftInput } from '../../../../app/utils/teacherDraft'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  const { client, user } = await requireAuthUser(event)

  // 1. Re-verify caller role from database (must have 'teacher' role)
  const { data: roleRecords, error: roleError } = await client
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)

  if (roleError) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to verify user authorization',
    })
  }

  const roles = (roleRecords || []).map((r: any) => r.role)
  const isTeacher = roles.includes('teacher')

  if (!isTeacher) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: teacher role required',
    })
  }

  const articleId = getRouterParam(event, 'id')
  if (!articleId || !UUID_REGEX.test(articleId)) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Article not found',
    })
  }

  // 2. Parse body and enforce immutability of author_id, offering_id, status, and published_at
  const body = await readBody(event)
  if (
    body?.author_id !== undefined ||
    body?.offering_id !== undefined ||
    body?.status !== undefined ||
    body?.published_at !== undefined
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'author_id, offering_id, status, and published_at cannot be modified directly via this endpoint',
    })
  }

  // Concurrency check: expected_version is required for atomic CAS (monotonic integer >= 1)
  const rawVersion = body?.expected_version !== undefined ? body.expected_version : body?.version
  if (
    rawVersion === undefined ||
    rawVersion === null ||
    typeof rawVersion !== 'number' ||
    !Number.isSafeInteger(rawVersion) ||
    rawVersion < 1 ||
    rawVersion > 2147483647
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'expected_version is required and must be a positive 32-bit integer (1 to 2147483647)',
    })
  }
  const expectedVersion = rawVersion

  // 3. Validate title and body
  const validation = validateTeacherDraftInput(body, { requireOfferingId: false })
  if (!validation.valid || !validation.sanitized) {
    const errorMsg = Object.values(validation.errors || {})[0] || 'ข้อมูลไม่ถูกต้อง'
    throw createError({
      statusCode: 400,
      statusMessage: errorMsg,
    })
  }

  // 4. Fetch existing article (enforcing ownership and assignment via RLS)
  const { data: existing, error: fetchErr } = await client
    .from('articles')
    .select('id, offering_id, author_id, status, version, updated_at, published_at')
    .eq('id', articleId)
    .single()

  if (fetchErr || !existing || existing.author_id !== user.id) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Article not found',
    })
  }

  // 5. Verify active offering assignment (revocation check)
  const { data: isAssigned, error: rpcError } = await client.rpc('is_active_offering_teacher', {
    p_offering_id: existing.offering_id,
    p_user_id: user.id,
  })

  if (rpcError || !isAssigned) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Article not found',
    })
  }

  // 6. Perform atomic conditional update (enforces CAS predicate directly in the DB write)
  const { data: updatedArticle, error: updateError } = await client
    .from('articles')
    .update({
      title: validation.sanitized.title,
      body: validation.sanitized.body,
    })
    .eq('id', articleId)
    .eq('version', expectedVersion)
    .select('id, offering_id, title, body, status, created_at, updated_at, author_id, published_at, version')
    .maybeSingle()

  if (updateError) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update article',
    })
  }

  if (!updatedArticle) {
    // 0 rows matched atomic predicate: distinguish concurrent overwrite (409) from deleted/unauthorized (404)
    const { data: recheck } = await client
      .from('articles')
      .select('id, offering_id, author_id, version')
      .eq('id', articleId)
      .maybeSingle()

    if (recheck && recheck.author_id === user.id) {
      const { data: stillAssigned } = await client.rpc('is_active_offering_teacher', {
        p_offering_id: recheck.offering_id,
        p_user_id: user.id,
      })

      if (stillAssigned) {
        throw createError({
          statusCode: 409,
          statusMessage: 'เอกสารมีการแก้ไขจากที่อื่น กรุณาโหลดข้อมูลใหม่ก่อนบันทึก (Conflict)',
        })
      }
    }

    throw createError({
      statusCode: 404,
      statusMessage: 'Article not found',
    })
  }

  return {
    success: true,
    article: updatedArticle,
  }
})
