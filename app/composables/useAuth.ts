import {
  isConfigured as checkConfigured,
  buildOAuthRedirectUrl,
  executeSignOut,
  processAuthCallback,
  resolveVerifiedUser,
  createSafeAuthStateHandler,
  type SafeUserDisplay,
} from '../utils/auth'
import { getSupabaseClient } from '../utils/supabaseClient'

export function useAuth(explicitEvent?: any) {
  const config = useRuntimeConfig()
  const supabaseUrl = (config.public.supabaseUrl as string) || ''
  const supabaseKey = (config.public.supabaseKey as string) || ''
  const siteUrl = (config.public.siteUrl as string) || 'http://localhost:3000'

  const configured = checkConfigured(supabaseUrl, supabaseKey)

  const user = useState<SafeUserDisplay | null>('auth-user', () => null)
  const isLoading = useState<boolean>('auth-loading', () => false)
  const authError = useState<string | null>('auth-error', () => null)
  const signOutError = useState<string | null>('auth-signout-error', () => null)
  const stateGeneration = useState<number>('auth-state-generation', () => 0)

  function getClient() {
    return getSupabaseClient(supabaseUrl, supabaseKey, explicitEvent)
  }

  /**
   * Pure resolution of verified identity using client.auth.getUser().
   * Pure: DOES NOT mutate user.value or shared state.
   */
  async function fetchVerifiedUser(): Promise<SafeUserDisplay | null> {
    if (!configured) {
      return null
    }

    const client = getClient()
    if (!client) {
      return null
    }

    const res = await resolveVerifiedUser(client)
    if (res.verified && res.user) {
      return res.user
    }

    return null
  }

  /**
   * Verifies identity using client.auth.getUser() and updates user.value
   * guarded by a generation counter to prevent race conditions.
   */
  async function checkVerifiedUser(): Promise<SafeUserDisplay | null> {
    const gen = ++stateGeneration.value

    if (!configured) {
      user.value = null
      return null
    }

    const verified = await fetchVerifiedUser()
    if (gen === stateGeneration.value) {
      user.value = verified
      return verified
    }

    return null
  }

  /**
   * Initializes auth state on client mount and listens for session changes safely without deadlocks.
   */
  async function initAuth() {
    if (!configured) {
      user.value = null
      isLoading.value = false
      return
    }

    const client = getClient()
    if (!client) {
      user.value = null
      isLoading.value = false
      return
    }

    isLoading.value = true
    try {
      await checkVerifiedUser()

      if (import.meta.client) {
        const authHandler = createSafeAuthStateHandler(
          (verifiedUser) => {
            user.value = verifiedUser
          },
          (err) => {
            authError.value = 'Failed to update authentication state. Please refresh the page.'
          },
          () => fetchVerifiedUser(), // PURE: Never mutates user.value inside verifyFn
          () => stateGeneration.value
        )

        client.auth.onAuthStateChange((event, session) => {
          authHandler(event, session)
        })
      }
    } catch (err: any) {
      authError.value = 'Failed to initialize authentication. Please refresh the page and try again.'
      user.value = null
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Initiates Google OAuth sign-in.
   */
  async function signInWithGoogle() {
    authError.value = null
    signOutError.value = null

    if (!configured) {
      authError.value =
        'Google OAuth blocked pending Supabase configuration. Please configure SUPABASE_URL and SUPABASE_KEY in local .env.'
      return
    }

    const client = getClient()
    if (!client) {
      authError.value = 'Supabase client could not be initialized.'
      return
    }

    try {
      const redirectTo = buildOAuthRedirectUrl(siteUrl)
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      })

      if (error) {
        authError.value = 'Failed to initiate Google sign-in. Please try again.'
      }
    } catch (err: any) {
      authError.value = 'Failed to initiate Google sign-in. Please try again.'
    }
  }

  /**
   * Signs out user.
   * If sign-out encounters an error:
   * - If local session was removed by the SDK (standard remote error path), clears user.value,
   *   reports safe generic warning that remote revocation was not confirmed, and navigates home.
   * - If local session genuinely remains active, reports warning without clearing user.
   */
  async function signOut() {
    authError.value = null
    signOutError.value = null

    // Immediately bump generation to invalidate any in-flight verification
    const gen = ++stateGeneration.value

    const client = getClient()
    if (!client) {
      user.value = null
      await navigateTo('/')
      return
    }

    const res = await executeSignOut(client, () => {
      if (gen === stateGeneration.value) {
        user.value = null
      }
    })

    if (!res.success) {
      // Safe, generic warning without echoing raw provider/SDK error message
      signOutError.value =
        res.warning || 'Sign-out status is unconfirmed: remote revocation was not confirmed.'

      if (res.localSessionCleared === true) {
        // Confirmed local deletion: null user state and navigate home
        if (gen === stateGeneration.value) {
          user.value = null
        }
        await navigateTo('/')
      } else if (res.localSessionState === 'unknown') {
        // Unconfirmed status: do not assert a signed-out identity, but navigate home
        // so the uncertainty warning is visible on the public route rather than leaving
        // a stale "Authentication Verified" protected banner.
        await navigateTo('/')
      }
      return
    }

    if (gen === stateGeneration.value) {
      user.value = null
    }

    await navigateTo('/')
  }

  /**
   * Handles OAuth callback from query string or hash.
   * Denies on error even if an old session is present in cookies/storage.
   */
  async function handleCallback(fullUrlOrParams?: string) {
    isLoading.value = true
    authError.value = null
    const gen = ++stateGeneration.value

    let targetUrl = fullUrlOrParams
    if (!targetUrl && import.meta.client) {
      targetUrl = window.location.href
    }

    if (!configured) {
      authError.value = 'Callback failed: Supabase credentials are missing.'
      isLoading.value = false
      return { success: false, error: authError.value, user: null }
    }

    const client = getClient()
    if (!client) {
      authError.value = 'Supabase client is not available.'
      isLoading.value = false
      return { success: false, error: authError.value, user: null }
    }

    const result = await processAuthCallback(client, targetUrl || '')
    if (!result.success) {
      authError.value = result.error
      if (gen === stateGeneration.value) {
        user.value = null
      }
      isLoading.value = false
      return result
    }

    if (gen === stateGeneration.value) {
      user.value = result.user
    }
    isLoading.value = false
    return result
  }

  return {
    user,
    isLoading,
    isConfigured: configured,
    authError,
    signOutError,
    supabaseUrl,
    siteUrl,
    initAuth,
    checkVerifiedUser,
    fetchVerifiedUser,
    signInWithGoogle,
    signOut,
    handleCallback,
  }
}
