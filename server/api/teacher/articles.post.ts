import { requireAuthUser } from '../../utils/supabase'
import { validateTeacherDraftInput } from '../../../app/utils/teacherDraft'

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

  // 2. Parse and validate input payload
  const body = await readBody(event)
  const validation = validateTeacherDraftInput(body, { requireOfferingId: true })

  if (!validation.valid || !validation.sanitized) {
    const errorMsg = Object.values(validation.errors || {})[0] || 'ข้อมูลไม่ถูกต้อง'
    throw createError({
      statusCode: 400,
      statusMessage: errorMsg,
    })
  }

  // 3. Verify active offering assignment for caller
  const { data: isAssigned, error: rpcError } = await client.rpc('is_active_offering_teacher', {
    p_offering_id: validation.sanitized.offering_id,
    p_user_id: user.id,
  })

  if (rpcError || !isAssigned) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: caller is not assigned to this active course offering',
    })
  }

  // 4. Insert draft article
  const { data: newArticle, error: insertError } = await client
    .from('articles')
    .insert({
      offering_id: validation.sanitized.offering_id,
      author_id: user.id,
      title: validation.sanitized.title,
      body: validation.sanitized.body,
      status: 'draft',
    })
    .select('id, offering_id, title, body, status, created_at, updated_at, author_id, published_at, version')
    .single()

  if (insertError || !newArticle) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create draft article',
    })
  }

  return {
    success: true,
    article: newArticle,
  }
})
