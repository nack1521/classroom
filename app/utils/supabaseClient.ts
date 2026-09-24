import { createBrowserClient, createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { parseCookies, setCookie } from 'h3'

let browserClientInstance: SupabaseClient | null = null

/**
 * Returns a Supabase client configured for the current runtime context.
 * In SSR on the server: creates or retrieves a request-scoped client bound to the H3 event cookies.
 * In the browser: creates a browser client bound to document.cookie.
 * Server client is strictly request-scoped and NEVER a module-global singleton across users.
 */
export function getSupabaseClient(
  supabaseUrl: string,
  supabaseKey: string,
  explicitEvent?: any
): SupabaseClient | null {
  if (!supabaseUrl || !supabaseKey) {
    return null
  }

  // Check for active server request event (Nuxt SSR or explicit test injection)
  let event: any = explicitEvent
  if (!event && typeof useRequestEvent === 'function') {
    try {
      event = useRequestEvent()
    } catch {
      // Outside active Nuxt request context
    }
  }

  // Server request-scoped client bound to event cookies
  if (event) {
    if (!event.context) {
      event.context = {}
    }
    if (!event.context._supabaseClient) {
      event.context._supabaseClient = createServerClient(supabaseUrl, supabaseKey, {
        cookies: {
          getAll() {
            const cookies = parseCookies(event)
            return Object.keys(cookies).map((name) => ({
              name,
              value: cookies[name] || '',
            }))
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              setCookie(event, name, value, options)
            })
          },
        },
      })
    }
    return event.context._supabaseClient
  }

  // Server context without event (e.g. static prerender/build fallback)
  if (import.meta.server) {
    return createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return []
        },
        setAll() {},
      },
    })
  }

  // Browser context (document.cookie)
  if (!browserClientInstance) {
    browserClientInstance = createBrowserClient(supabaseUrl, supabaseKey)
  }
  return browserClientInstance
}
