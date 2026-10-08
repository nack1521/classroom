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
      statusMessage: 'Forbidden: only administrators may correct applications',
    })
  }

  const body = await readBody(event)
  const applicationId = typeof body?.application_id === 'string' ? body.application_id.trim() : null

  if (!applicationId || !UUID_REGEX.test(applicationId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid or missing application_id (must be a valid UUID)',
    })
  }

  const { data, error } = await client.rpc('admin_correct_student_application', {
    target_application_id: applicationId,
    p_title: body?.title || null,
    p_first_name: body?.first_name || null,
    p_last_name: body?.last_name || null,
    p_student_id: body?.student_id || null,
    p_class_id: body?.class_id || null,
    p_roll_number: body?.roll_number !== undefined && body?.roll_number !== null ? Number(body.roll_number) : null,
  })

  if (error) {
    const msg = error.message || ''
    if (/unauthorized/i.test(msg)) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden: only administrators may correct applications',
      })
    }
    if (/not found/i.test(msg)) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Application not found',
      })
    }
    if (/conflict/i.test(msg) || /duplicate key/i.test(msg)) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Conflict: student ID is already reserved or roll number is occupied in class and academic year',
      })
    }
    if (/invalid/i.test(msg) || /inactive/i.test(msg) || /cannot change class/i.test(msg)) {
      throw createError({
        statusCode: 400,
        statusMessage: msg,
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to correct application',
    })
  }

  return {
    success: true,
    result: data,
  }
})
