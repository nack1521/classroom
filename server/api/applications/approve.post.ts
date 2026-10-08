import { requireAuthUser } from '../../utils/supabase'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  const { client } = await requireAuthUser(event)

  const body = await readBody(event)
  const applicationId = typeof body?.application_id === 'string' ? body.application_id.trim() : null

  if (!applicationId || !UUID_REGEX.test(applicationId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid or missing application_id (must be a valid UUID)',
    })
  }

  const { data, error } = await client.rpc('approve_student_application', {
    target_application_id: applicationId,
  })

  if (error) {
    const msg = error.message || ''
    if (/unauthorized/i.test(msg)) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Unauthorized: caller is not an authorized teacher for this class or admin',
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
        statusMessage: 'Conflict: student ID is already reserved or roll number is occupied in this class and academic year',
      })
    }
    if (/inactive/i.test(msg)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cannot approve application for an inactive class',
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to approve application',
    })
  }

  return {
    success: true,
    idempotent: Boolean(data?.idempotent),
    membership_id: data?.membership_id || null,
  }
})
