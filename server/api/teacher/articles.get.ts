import { requireAuthUser } from '../../utils/supabase'

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

  const query = getQuery(event)
  const offeringId = typeof query.offering_id === 'string' && query.offering_id.trim() ? query.offering_id.trim() : null

  // 2. Query own drafts via client (enforced by RLS author_id = auth.uid() and active assignment)
  let dbQuery = client
    .from('articles')
    .select('id, offering_id, title, body, status, created_at, updated_at, published_at, version')
    .eq('author_id', user.id)
    .order('updated_at', { ascending: false })

  if (offeringId) {
    dbQuery = dbQuery.eq('offering_id', offeringId)
  }

  const { data, error } = await dbQuery

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to retrieve articles',
    })
  }

  return { articles: data || [] }
})
