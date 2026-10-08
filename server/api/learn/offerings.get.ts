import { requireAuthUser } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const { client, user } = await requireAuthUser(event)

  const permittedOfferings: any[] = []
  const seenOfferingIds = new Set<string>()

  // 1. Query active student class memberships
  const { data: memberships, error: memError } = await client
    .from('class_memberships')
    .select('class_id, academic_year')
    .eq('user_id', user.id)
    .eq('status', 'active')

  if (memError) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to retrieve class memberships',
    })
  }

  if (Array.isArray(memberships) && memberships.length > 0) {
    for (const mem of memberships) {
      const { data: offerings, error: offError } = await client
        .from('course_offerings')
        .select(`
          id,
          class_id,
          term,
          academic_year,
          is_active,
          classes:class_id (
            id,
            name,
            academic_year,
            is_active
          ),
          subjects:subject_id (
            id,
            code,
            name,
            is_active
          )
        `)
        .eq('class_id', mem.class_id)
        .eq('academic_year', mem.academic_year)
        .eq('is_active', true)

      if (offError) {
        throw createError({
          statusCode: 500,
          statusMessage: 'Failed to retrieve course offerings',
        })
      }

      if (Array.isArray(offerings)) {
        for (const co of offerings) {
          const cls = Array.isArray(co.classes) ? co.classes[0] : co.classes
          const subject = Array.isArray(co.subjects) ? co.subjects[0] : co.subjects

          if (
            co.is_active &&
            cls &&
            cls.is_active &&
            cls.academic_year === co.academic_year &&
            subject &&
            subject.is_active &&
            !seenOfferingIds.has(co.id)
          ) {
            seenOfferingIds.add(co.id)
            permittedOfferings.push({
              id: co.id,
              subject_id: subject.id,
              subject_code: subject.code,
              subject_name: subject.name,
              class_id: cls.id,
              class_name: cls.name,
              term: co.term,
              academic_year: co.academic_year,
            })
          }
        }
      }
    }
  }

  // 2. Query active teacher offering assignments
  const { data: roleRecords, error: roleError } = await client
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)

  if (roleError) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to retrieve user roles',
    })
  }

  const roles = (roleRecords || []).map((r: any) => r.role)
  if (roles.includes('teacher')) {
    const { data: assignments, error: assignError } = await client
      .from('teacher_offering_assignments')
      .select(`
        offering_id,
        course_offerings:offering_id (
          id,
          class_id,
          term,
          academic_year,
          is_active,
          classes:class_id (
            id,
            name,
            academic_year,
            is_active
          ),
          subjects:subject_id (
            id,
            code,
            name,
            is_active
          )
        )
      `)
      .eq('teacher_id', user.id)

    if (assignError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to retrieve teacher offering assignments',
      })
    }

    if (Array.isArray(assignments)) {
      for (const item of assignments) {
        const co = Array.isArray(item.course_offerings) ? item.course_offerings[0] : item.course_offerings
        if (!co) continue
        const cls = Array.isArray(co.classes) ? co.classes[0] : co.classes
        const subject = Array.isArray(co.subjects) ? co.subjects[0] : co.subjects

        if (
          co.is_active &&
          cls &&
          cls.is_active &&
          cls.academic_year === co.academic_year &&
          subject &&
          subject.is_active &&
          !seenOfferingIds.has(co.id)
        ) {
          seenOfferingIds.add(co.id)
          permittedOfferings.push({
            id: co.id,
            subject_id: subject.id,
            subject_code: subject.code,
            subject_name: subject.name,
            class_id: cls.id,
            class_name: cls.name,
            term: co.term,
            academic_year: co.academic_year,
          })
        }
      }
    }
  }

  return { offerings: permittedOfferings }
})
