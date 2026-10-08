import { requireAuthUser } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const { client, user } = await requireAuthUser(event)

  // 1. Re-verify caller role from database
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

  if (!isAdmin && !isTeacher) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: only assigned teachers or administrators may access this queue',
    })
  }

  const query = getQuery(event)
  const requestedClassId = typeof query.class_id === 'string' && query.class_id.trim() ? query.class_id.trim() : null

  // 2. Fetch assigned classes
  let assignedClasses: { id: string; name: string; academic_year: string }[] = []

  if (isAdmin) {
    // Admin can see all active classes
    const { data: classData, error: classError } = await client
      .from('classes')
      .select('id, name, academic_year')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (classError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to retrieve classes',
      })
    }
    assignedClasses = classData || []
  } else {
    // Teacher: query teacher_class_assignments joining active classes
    const { data: assignmentData, error: assignmentError } = await client
      .from('teacher_class_assignments')
      .select(`
        class_id,
        classes:class_id (
          id,
          name,
          academic_year,
          is_active
        )
      `)
      .eq('teacher_id', user.id)

    if (assignmentError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to retrieve teacher class assignments',
      })
    }

    assignedClasses = (assignmentData || [])
      .map((item: any) => (Array.isArray(item.classes) ? item.classes[0] : item.classes))
      .filter((c: any) => c && c.is_active === true)
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        academic_year: c.academic_year,
      }))
  }

  // If teacher has no assigned active classes, return empty queue
  if (!isAdmin && assignedClasses.length === 0) {
    return {
      applications: [],
      assigned_classes: [],
    }
  }

  const allowedClassIds = assignedClasses.map((c) => c.id)

  // 3. Build application query
  let appQuery = client
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
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (requestedClassId) {
    if (!isAdmin && !allowedClassIds.includes(requestedClassId)) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden: teacher is not assigned to the requested class',
      })
    }
    appQuery = appQuery.eq('class_id', requestedClassId)
  } else if (!isAdmin) {
    appQuery = appQuery.in('class_id', allowedClassIds)
  }

  const { data: applications, error: appError } = await appQuery

  if (appError) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to retrieve pending applications',
    })
  }

  const normalizedApps = (applications || []).map((app: any) => {
    let classInfo = null
    if (app.classes) {
      classInfo = Array.isArray(app.classes) ? app.classes[0] : app.classes
    }
    return {
      id: app.id,
      user_id: app.user_id,
      title: app.title,
      first_name: app.first_name,
      last_name: app.last_name,
      student_id: app.student_id,
      class_id: app.class_id,
      roll_number: app.roll_number,
      status: app.status,
      created_at: app.created_at,
      updated_at: app.updated_at,
      class: classInfo,
    }
  })

  return {
    applications: normalizedApps,
    assigned_classes: assignedClasses,
  }
})
