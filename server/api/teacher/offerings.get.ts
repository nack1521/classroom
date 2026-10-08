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

  // 2. Fetch assigned offerings
  const { data: assignments, error: assignError } = await client
    .from('teacher_offering_assignments')
    .select(`
      offering_id,
      course_offerings:offering_id (
        id,
        term,
        academic_year,
        is_active,
        subjects:subject_id (
          id,
          code,
          name,
          is_active
        ),
        classes:class_id (
          id,
          name,
          academic_year,
          is_active
        )
      )
    `)
    .eq('teacher_id', user.id)

  if (assignError) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to retrieve assigned offerings',
    })
  }

  const offerings = (assignments || [])
    .map((item: any) => {
      const co = Array.isArray(item.course_offerings) ? item.course_offerings[0] : item.course_offerings
      if (!co || !co.is_active) return null

      const subject = Array.isArray(co.subjects) ? co.subjects[0] : co.subjects
      if (!subject || !subject.is_active) return null

      const cls = Array.isArray(co.classes) ? co.classes[0] : co.classes
      if (!cls || !cls.is_active) return null

      return {
        id: co.id,
        subject_id: subject.id,
        subject_code: subject.code,
        subject_name: subject.name,
        class_id: cls.id,
        class_name: cls.name,
        term: co.term,
        academic_year: co.academic_year,
      }
    })
    .filter((o: any): o is NonNullable<typeof o> => o !== null)

  return { offerings }
})
