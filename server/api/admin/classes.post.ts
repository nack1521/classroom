import { requireAuthUser } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const { client, user } = await requireAuthUser(event)

  // 1. Verify caller has admin role
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
      statusMessage: 'Forbidden: only administrators may create classes',
    })
  }

  // 2. Parse and validate input payload
  const body = await readBody(event)
  const rawName = typeof body?.name === 'string' ? body.name.trim() : ''
  const rawYear = typeof body?.academic_year === 'string' ? body.academic_year.trim() : ''

  if (!rawName) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ชื่อห้องเรียนไม่สามารถเว้นว่างได้ (Class name cannot be blank)',
    })
  }

  if (rawName.length > 100) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ชื่อห้องเรียนต้องไม่เกิน 100 ตัวอักษร (Class name cannot exceed 100 characters)',
    })
  }

  if (!/^[0-9]{4}$/.test(rawYear)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ปีการศึกษาต้องเป็นตัวเลข 4 หลัก (Academic year must be exactly 4 digits)',
    })
  }

  // 3. Execute checked RPC
  const { data, error: rpcError } = await client.rpc('admin_create_class', {
    p_name: rawName,
    p_academic_year: rawYear,
  })

  if (rpcError) {
    throw createError({
      statusCode: 400,
      statusMessage: rpcError.message || 'Failed to create class',
    })
  }

  return {
    success: true,
    class: data?.class,
  }
})
