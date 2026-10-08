import { requireAuthUser } from '../../utils/supabase'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  const { client, user } = await requireAuthUser(event)

  // 1. Dual-role check: Caller must possess BOTH 'admin' AND 'teacher' roles
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
  const isAdmin = roles.includes('admin')
  const isTeacher = roles.includes('teacher')

  if (!isAdmin || !isTeacher) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: both admin and teacher roles required to create an offering with teacher self-assignment',
    })
  }

  // 2. Parse and validate input payload (strictly ignoring any posted teacher_id or assigned_by)
  const body = await readBody(event)
  const subjectId = typeof body?.subject_id === 'string' ? body.subject_id.trim() : ''
  const classId = typeof body?.class_id === 'string' ? body.class_id.trim() : ''
  const rawTerm = body?.term

  if (!subjectId || !UUID_REGEX.test(subjectId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'กรุณาเลือกรายวิชาที่ถูกต้อง (Valid subject_id is required)',
    })
  }

  if (!classId || !UUID_REGEX.test(classId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'กรุณาเลือกห้องเรียนที่ถูกต้อง (Valid class_id is required)',
    })
  }

  let termNum: number
  if (typeof rawTerm === 'number' && Number.isInteger(rawTerm) && (rawTerm === 1 || rawTerm === 2)) {
    termNum = rawTerm
  } else if (typeof rawTerm === 'string' && (rawTerm === '1' || rawTerm === '2')) {
    termNum = rawTerm === '1' ? 1 : 2
  } else {
    throw createError({
      statusCode: 400,
      statusMessage: 'ภาคเรียนต้องเป็น 1 หรือ 2 เท่านั้น (Term must be exactly 1 or 2)',
    })
  }

  // 3. Execute checked RPC (teacher_id and assigned_by are derived from caller inside RPC)
  const { data, error: rpcError } = await client.rpc('owner_create_course_offering', {
    p_subject_id: subjectId,
    p_class_id: classId,
    p_term: termNum,
  })

  if (rpcError) {
    if (rpcError.message?.includes('already exists') || rpcError.message?.includes('unique_violation')) {
      throw createError({
        statusCode: 409,
        statusMessage: 'กลุ่มการเรียนนี้มีอยู่ในระบบแล้ว (Course offering already exists for this subject, class, term, and academic year)',
      })
    }
    throw createError({
      statusCode: 400,
      statusMessage: rpcError.message || 'Failed to create course offering',
    })
  }

  return {
    success: true,
    offering_id: data?.offering_id,
  }
})
