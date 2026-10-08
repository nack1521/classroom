import { requireAuthUser } from '../../../utils/supabase'

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

  // 2. Fetch article (RLS strictly enforces author_id = auth.uid() AND active offering assignment)
  const { data, error } = await client
    .from('articles')
    .select('id, offering_id, title, body, status, created_at, updated_at, author_id, published_at, version')
    .eq('id', articleId)
    .single()

  if (error || !data) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Article not found',
    })
  }

  return { article: data }
})
