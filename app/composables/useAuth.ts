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

export function useAuth() {
  const config = useRuntimeConfig()
  const supabaseUrl = (config.public.supabaseUrl as string) || ''
  const supabaseKey = (config.public.supabaseKey as string) || ''
  const siteUrl = (config.public.siteUrl as string) || 'http://localhost:3000'

  const configured = checkConfigured(supabaseUrl, supabaseKey)

  const user = useState<SafeUserDisplay | null>('auth-user', () => null)
  const isLoading = useState<boolean>('auth-loading', () => false)
  const authError = useState<string | null>('auth-error', () => null)
  const signOutError = useState<string | null>('auth-signout-error', () => null)

  function getClient() {
    return getSupabaseClient(supabaseUrl, supabaseKey)
  }

  /**
   * Verifies identity using client.auth.getUser() instead of trusting local getSession().
   */
  async function checkVerifiedUser(): Promise<SafeUserDisplay | null> {
    if (!configured) {
      user.value = null
      return null
    }

    const client = getClient()
    if (!client) {
      user.value = null
      return null
    }

    const res = await resolveVerifiedUser(client)
    if (res.verified && res.user) {
      user.value = res.user
      return res.user
    }

    user.value = null
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
            authError.value = err?.message || 'Error updating user verification'
          },
          () => checkVerifiedUser()
        )

        client.auth.onAuthStateChange((event, session) => {
          authHandler(event, session)
        })
      }
    } catch (err: any) {
      authError.value = err?.message || 'Error initializing authentication'
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
        authError.value = error.message
      }
    } catch (err: any) {
      authError.value = err?.message || 'Failed to initiate Google OAuth sign-in.'
    }
  }

  /**
   * Signs out user.
   * If sign-out fails, visibly reports error and does NOT silently navigate home.
   */
  async function signOut() {
    authError.value = null
    signOutError.value = null

    const client = getClient()
    if (!client) {
      user.value = null
      await navigateTo('/')
      return
    }

    const res = await executeSignOut(client, () => {
      user.value = null
    })

    if (!res.success) {
      signOutError.value = `${res.error?.message || 'Sign out request failed'}. ${res.warning || ''}`
      return
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
      user.value = null
      isLoading.value = false
      return result
    }

    user.value = result.user
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
    signInWithGoogle,
    signOut,
    handleCallback,
  }
}
