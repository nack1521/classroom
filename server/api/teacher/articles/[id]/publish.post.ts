import { requireAuthUser } from '../../../../utils/supabase'

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

  // 2. Parse and validate expected_version from body (required monotonic integer >= 1)
  const body = await readBody(event).catch(() => ({}))
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

  // 3. Fetch existing article (enforcing ownership and assignment via RLS)
  const { data: existing, error: fetchErr } = await client
    .from('articles')
    .select('id, offering_id, title, body, status, created_at, updated_at, author_id, published_at, version')
    .eq('id', articleId)
    .single()

  if (fetchErr || !existing || existing.author_id !== user.id) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Article not found',
    })
  }

  // 4. Verify active offering assignment (revocation check)
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

  // 5. Idempotency: Repeat publish on an already-published article
  // Only idempotent when row is already published and expected_version matches
  if (existing.status === 'published') {
    if (existing.version !== expectedVersion) {
      throw createError({
        statusCode: 409,
        statusMessage: 'บทความมีการแก้ไขจากที่อื่น กรุณาโหลดข้อมูลใหม่ก่อนเผยแพร่ (Conflict)',
      })
    }
    return {
      success: true,
      article: existing,
      already_published: true,
    }
  }

  // 6. Verify that draft is non-empty before publishing
  if (!existing.title?.trim() || !existing.body?.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Cannot publish an empty or invalid draft',
    })
  }

  // 7. Transition draft to published atomically in the same UPDATE statement
  // Luna Finding 3: Do NOT supply published_at or updated_at; DB trigger strictly sets them
  const { data: updatedArticle, error: updateError } = await client
    .from('articles')
    .update({
      status: 'published',
    })
    .eq('id', articleId)
    .eq('status', 'draft')
    .eq('version', expectedVersion)
    .select('id, offering_id, title, body, status, created_at, updated_at, author_id, published_at, version')
    .maybeSingle()

  if (updateError) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to publish article',
    })
  }

  if (!updatedArticle) {
    // 0 rows matched atomic predicate: distinguish concurrent overwrite (409) from deleted/unauthorized (404)
    const { data: recheck } = await client
      .from('articles')
      .select('id, offering_id, title, body, status, created_at, updated_at, author_id, published_at, version')
      .eq('id', articleId)
      .maybeSingle()

    if (recheck && recheck.author_id === user.id) {
      const { data: stillAssigned } = await client.rpc('is_active_offering_teacher', {
        p_offering_id: recheck.offering_id,
        p_user_id: user.id,
      })

      if (stillAssigned) {
        // Do not transform a stale first-publish race into a false claim about newly edited content
        throw createError({
          statusCode: 409,
          statusMessage: 'บทความมีการแก้ไขจากที่อื่น กรุณาโหลดข้อมูลใหม่ก่อนเผยแพร่ (Conflict)',
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
