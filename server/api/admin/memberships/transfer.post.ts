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
      statusMessage: 'Forbidden: only administrators may transfer student memberships',
    })
  }

  const body = await readBody(event)
  const membershipId = typeof body?.membership_id === 'string' ? body.membership_id.trim() : null
  const destinationClassId = typeof body?.destination_class_id === 'string' ? body.destination_class_id.trim() : null
  const newRollNumber = body?.new_roll_number !== undefined && body?.new_roll_number !== null ? Number(body.new_roll_number) : null

  if (!membershipId || !UUID_REGEX.test(membershipId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid or missing membership_id (must be a valid UUID)',
    })
  }

  if (!destinationClassId || !UUID_REGEX.test(destinationClassId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid or missing destination_class_id (must be a valid UUID)',
    })
  }

  const { data, error } = await client.rpc('admin_transfer_student_membership', {
    target_membership_id: membershipId,
    destination_class_id: destinationClassId,
    new_roll_number: newRollNumber,
  })

  if (error) {
    const msg = error.message || ''
    if (/unauthorized/i.test(msg)) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden: only administrators may transfer student memberships',
      })
    }
    if (/not found/i.test(msg)) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Active class membership not found',
      })
    }
    if (/conflict/i.test(msg) || /duplicate key/i.test(msg)) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Conflict: roll number is already occupied in destination class and academic year',
      })
    }
    if (/inactive/i.test(msg) || /invalid/i.test(msg)) {
      throw createError({
        statusCode: 400,
        statusMessage: msg,
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to transfer student membership',
    })
  }

  return {
    success: true,
    result: data,
  }
})
