import { requireAuthUser } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const { client, user } = await requireAuthUser(event)

  const { data, error } = await client
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
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to retrieve application',
    })
  }

  // Normalize joined class object if returned as array or object
  let classInfo = null
  if (data?.classes) {
    classInfo = Array.isArray(data.classes) ? data.classes[0] : data.classes
  }

  return {
    application: data
      ? {
          id: data.id,
          user_id: data.user_id,
          title: data.title,
          first_name: data.first_name,
          last_name: data.last_name,
          student_id: data.student_id,
          class_id: data.class_id,
          roll_number: data.roll_number,
          status: data.status,
          created_at: data.created_at,
          updated_at: data.updated_at,
          class: classInfo,
        }
      : null,
  }
})
