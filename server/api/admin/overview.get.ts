import { requireAuthUser } from '../../utils/supabase'

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
      statusMessage: 'Forbidden: only administrators may access the admin overview',
    })
  }

  // 1. Fetch all classes
  const { data: classesData, error: classError } = await client
    .from('classes')
    .select('id, name, academic_year, is_active')
    .order('name', { ascending: true })

  if (classError) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to retrieve classes',
    })
  }

  // 2. Fetch all student applications
  const { data: appData, error: appError } = await client
    .from('student_applications')
    .select(`
      id,
      user_id,
      title,
      first_name,
      last_name,
      student_id,
      class_id,
      roll_number,
      status,
      created_at,
      updated_at,
      classes:class_id (
        id,
        name,
        academic_year
      )
    `)
    .order('created_at', { ascending: false })

  if (appError) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to retrieve applications',
    })
  }

  // 3. Fetch active class memberships
  const { data: memberData, error: memberError } = await client
    .from('class_memberships')
    .select('id, user_id, class_id, student_id, roll_number, academic_year, status, approved_at')
    .eq('status', 'active')

  if (memberError) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to retrieve active memberships',
    })
  }

  // Map active memberships by user_id
  const membershipMap: Record<string, any> = {}
  for (const m of memberData || []) {
    membershipMap[m.user_id] = m
  }

  const applications = (appData || []).map((a: any) => {
    const classInfo = a.classes ? (Array.isArray(a.classes) ? a.classes[0] : a.classes) : null
    const activeMembership = membershipMap[a.user_id] || null
    return {
      id: a.id,
      user_id: a.user_id,
      title: a.title,
      first_name: a.first_name,
      last_name: a.last_name,
      student_id: a.student_id,
      class_id: a.class_id,
      roll_number: a.roll_number,
      status: a.status,
      created_at: a.created_at,
      updated_at: a.updated_at,
      class: classInfo,
      active_membership: activeMembership,
    }
  })

  // 4. Fetch teacher class assignments
  const { data: assignmentsData, error: assignmentError } = await client
    .from('teacher_class_assignments')
    .select(`
      teacher_id,
      class_id,
      assigned_at,
      classes:class_id (
        id,
        name,
        academic_year,
        is_active
      )
    `)
    .order('assigned_at', { ascending: false })

  if (assignmentError) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to retrieve teacher assignments',
    })
  }

  const assignments = (assignmentsData || []).map((a: any) => ({
    teacher_id: a.teacher_id,
    class_id: a.class_id,
    assigned_at: a.assigned_at,
    class: a.classes ? (Array.isArray(a.classes) ? a.classes[0] : a.classes) : null,
  }))

  // 5. Fetch subjects
  const { data: subjectsData, error: subjectError } = await client
    .from('subjects')
    .select('id, code, name, is_active')
    .order('code', { ascending: true })

  if (subjectError) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to retrieve subjects',
    })
  }

  return {
    classes: classesData || [],
    applications,
    assignments,
    subjects: subjectsData || [],
  }
})
