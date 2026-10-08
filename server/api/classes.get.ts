import { getServerSupabase } from '../utils/supabase'

export default defineEventHandler(async (event) => {
  const client = getServerSupabase(event)
  if (!client) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Supabase configuration is unavailable',
    })
  }

  const { data, error } = await client
    .from('classes')
    .select('id, name, academic_year, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch active classes',
    })
  }

  return { classes: data || [] }
})
