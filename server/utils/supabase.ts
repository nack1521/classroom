import type { H3Event } from 'h3'
import { getSupabaseClient } from '../../app/utils/supabaseClient'

export function getServerSupabase(event: H3Event) {
  const config = useRuntimeConfig()
  return getSupabaseClient(config.public.supabaseUrl, config.public.supabaseKey, event)
}

export async function requireAuthUser(event: H3Event) {
  const client = getServerSupabase(event)
  if (!client) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Supabase configuration is unavailable',
    })
  }

  const { data, error } = await client.auth.getUser()
  if (error || !data?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Authentication required',
    })
  }

  return { client, user: data.user }
}
