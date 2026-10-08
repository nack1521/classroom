import { requireAuthUser } from '../../../utils/supabase'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  const { client, user } = await requireAuthUser(event)

  // Verify caller is admin
  const { data: roleRecords, error: roleError } = await client
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)

  if (roleError) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to verify admin authorization',
    })
  }

  const isAdmin = (roleRecords || []).some((r: any) => r.role === 'admin')
  if (!isAdmin) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: only administrators may manage teacher assignments',
    })
  }

  const body = await readBody(event)
  const teacherId = typeof body?.teacher_id === 'string' ? body.teacher_id.trim() : null
  const classId = typeof body?.class_id === 'string' ? body.class_id.trim() : null
  const action = body?.action === 'revoke' ? 'revoke' : 'assign'

  if (!teacherId || !UUID_REGEX.test(teacherId) || !classId || !UUID_REGEX.test(classId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid or missing teacher_id or class_id (must be valid UUIDs)',
    })
  }

  if (action === 'assign' && teacherId === user.id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Self-assignment is not allowed: administrators cannot assign classes to themselves',
    })
  }

  const rpcName = action === 'revoke' ? 'admin_revoke_teacher_from_class' : 'admin_assign_teacher_to_class'
  const { data, error } = await client.rpc(rpcName, {
    target_teacher_id: teacherId,
    target_class_id: classId,
  })

  if (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error.message || `Failed to ${action} teacher to class`,
    })
  }

  return {
    success: true,
    result: data,
  }
})
