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
      statusMessage: 'Forbidden: only administrators may create subjects',
    })
  }

  // 2. Parse and validate input payload
  const body = await readBody(event)
  const rawCode = typeof body?.code === 'string' ? body.code.trim() : ''
  const rawName = typeof body?.name === 'string' ? body.name.trim() : ''

  if (!rawCode) {
    throw createError({
      statusCode: 400,
      statusMessage: 'รหัสวิชาไม่สามารถเว้นว่างได้ (Subject code cannot be blank)',
    })
  }

  if (rawCode.length > 20) {
    throw createError({
      statusCode: 400,
      statusMessage: 'รหัสวิชาต้องไม่เกิน 20 ตัวอักษร (Subject code cannot exceed 20 characters)',
    })
  }

  if (!rawName) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ชื่อวิชาไม่สามารถเว้นว่างได้ (Subject name cannot be blank)',
    })
  }

  if (rawName.length > 100) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ชื่อวิชาต้องไม่เกิน 100 ตัวอักษร (Subject name cannot exceed 100 characters)',
    })
  }

  // 3. Execute checked RPC
  const { data, error: rpcError } = await client.rpc('admin_create_subject', {
    p_code: rawCode,
    p_name: rawName,
  })

  if (rpcError) {
    if (rpcError.message?.includes('already exists') || rpcError.message?.includes('unique_violation')) {
      throw createError({
        statusCode: 409,
        statusMessage: `รหัสวิชานี้มีอยู่ในระบบแล้ว (Subject code already exists: ${rawCode})`,
      })
    }
    throw createError({
      statusCode: 400,
      statusMessage: rpcError.message || 'Failed to create subject',
    })
  }

  return {
    success: true,
    subject: data?.subject,
  }
})
