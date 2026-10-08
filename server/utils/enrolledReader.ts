export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface EnrolledReaderAccessResult {
  allowed: boolean
  reason?: string
  offering?: any
  isStudent?: boolean
  isTeacher?: boolean
}

/**
 * Server-side entitlement check for course offering reading access.
 * Authorizes:
 * 1. An enrolled student with an active class_memberships record matching offering's class_id and academic_year.
 * 2. An assigned teacher with an active teacher_offering_assignments record for this offering.
 * Requires: offering, class, and subject to all be active, and class academic_year to match offering academic_year.
 */
export async function checkEnrolledReaderAccess(
  client: any,
  userId: string,
  offeringId: string
): Promise<EnrolledReaderAccessResult> {
  if (!offeringId || !UUID_REGEX.test(offeringId)) {
    return { allowed: false, reason: 'Invalid offering ID' }
  }

  // 1. Fetch course offering with class and subject
  const { data: coData, error: coError } = await client
    .from('course_offerings')
    .select(`
      id,
      class_id,
      academic_year,
      term,
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
    .eq('id', offeringId)
    .single()

  if (coError || !coData) {
    return { allowed: false, reason: 'Offering not found' }
  }

  const cls = Array.isArray(coData.classes) ? coData.classes[0] : coData.classes
  const subject = Array.isArray(coData.subjects) ? coData.subjects[0] : coData.subjects

  if (!coData.is_active || !cls || !cls.is_active || !subject || !subject.is_active) {
    return { allowed: false, reason: 'Offering or associated class/subject is inactive' }
  }

  if (cls.academic_year !== coData.academic_year) {
    return { allowed: false, reason: 'Offering academic year does not match class' }
  }

  // 2. Check if caller is an enrolled student with an active membership
  const { data: memberships, error: memError } = await client
    .from('class_memberships')
    .select('id, class_id, academic_year, status')
    .eq('user_id', userId)
    .eq('class_id', coData.class_id)
    .eq('academic_year', coData.academic_year)
    .eq('status', 'active')

  if (!memError && Array.isArray(memberships) && memberships.length > 0) {
    return {
      allowed: true,
      isStudent: true,
      offering: coData,
    }
  }

  // 3. Check if caller is an assigned teacher for this offering
  const { data: roleRecords } = await client
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)

  const roles = (roleRecords || []).map((r: any) => r.role)
  if (roles.includes('teacher')) {
    const { data: assignments } = await client
      .from('teacher_offering_assignments')
      .select('id')
      .eq('teacher_id', userId)
      .eq('offering_id', offeringId)

    if (Array.isArray(assignments) && assignments.length > 0) {
      return {
        allowed: true,
        isTeacher: true,
        offering: coData,
      }
    }
  }

  return { allowed: false, reason: 'No active enrollment or teacher assignment for this offering' }
}
