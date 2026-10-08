import { requireAuthUser } from '../../utils/supabase'
import { validateStudentApplicationInput } from '../../../app/utils/studentApplication'

export default defineEventHandler(async (event) => {
  const { client, user } = await requireAuthUser(event)

  const body = await readBody(event)
  const validation = validateStudentApplicationInput(body)

  if (!validation.valid || !validation.sanitized) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid application input',
      data: { errors: validation.errors },
    })
  }

  const { title, first_name, last_name, student_id, class_id, roll_number } = validation.sanitized

  // 1. Verify class exists and is active
  const { data: classData, error: classError } = await client
    .from('classes')
    .select('id, name, academic_year, is_active')
    .eq('id', class_id)
    .eq('is_active', true)
    .maybeSingle()

  if (classError || !classData) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Selected class does not exist or is inactive',
    })
  }

  // 2. Check if user already has an application
  const { data: existingApp } = await client
    .from('student_applications')
    .select('id, status')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingApp) {
    throw createError({
      statusCode: 409,
      statusMessage: 'You already have an existing application',
    })
  }

  // 3. Insert application into database
  // Note: user_id is strictly derived from verified auth context, not client body
  const { data: inserted, error: insertError } = await client
    .from('student_applications')
    .insert({
      user_id: user.id,
      title,
      first_name,
      last_name,
      student_id,
      class_id,
      roll_number,
      status: 'pending',
    })
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
      updated_at
    `)
    .single()

  if (insertError || !inserted) {
    // Check if error was unique constraint violation
    if (insertError?.code === '23505' || insertError?.message?.includes('unique constraint')) {
      throw createError({
        statusCode: 409,
        statusMessage: 'You already have an existing application',
      })
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to submit application: ' + (insertError?.message || 'unknown database error'),
    })
  }

  return {
    success: true,
    application: {
      ...inserted,
      class: {
        id: classData.id,
        name: classData.name,
        academic_year: classData.academic_year,
      },
    },
  }
})
