export interface SafeUserDisplay {
  signedIn: boolean
  email: string | null
  id: string | null
  message: string
}

export interface RouteAccessResult {
  allowed: boolean
  redirect?: string
  reason?: string
}

export interface CallbackHashResult {
  hasError: boolean
  error: string | null
  errorDescription: string | null
}

export interface SignOutResult {
  success: boolean
  error: any
  warning?: string
}

export interface VerifiedUserResult {
  verified: boolean
  user: SafeUserDisplay | null
  error: any
}

/**
 * Checks whether Supabase URL and anon key are properly configured in environment.
 */
export function isConfigured(supabaseUrl?: string, supabaseKey?: string): boolean {
  return Boolean(supabaseUrl && supabaseUrl.trim() !== '' && supabaseKey && supabaseKey.trim() !== '')
}

/**
 * Extracts and returns a safe display model for an authenticated user.
 * Explicitly excludes access tokens, refresh tokens, and credentials.
 */
export function getSafeUserDisplay(user: any): SafeUserDisplay {
  if (!user || !user.id) {
    return {
      signedIn: false,
      email: null,
      id: null,
      message: 'Not signed in',
    }
  }

  return {
    signedIn: true,
    email: user.email ?? null,
    id: String(user.id),
    message: 'Signed in',
  }
}

/**
 * Generates the local OAuth callback redirect URL based on base site URL.
 * Note: this is the URL allowed in Supabase Auth URL Configuration, NOT Google Cloud's callback.
 */
export function buildOAuthRedirectUrl(siteUrl: string): string {
  const base = siteUrl.replace(/\/+$/, '')
  return `${base}/auth/callback`
}

/**
 * Evaluates whether a route can be accessed given the user authentication state.
 * Protected routes require verified authentication; public and callback routes are open.
 */
export function checkRouteAccess(path: string, isAuthenticated: boolean): RouteAccessResult {
  const normalized = path === '/' ? '/' : path.replace(/\/+$/, '')

  if (normalized === '/protected' || normalized.startsWith('/protected/')) {
    if (!isAuthenticated) {
      return {
        allowed: false,
        redirect: '/',
        reason: 'Authentication required',
      }
    }
  }

  return { allowed: true }
}

/**
 * Signs out the user from Supabase.
 * If Supabase reports an error, we do NOT clear local session silently; we report failure visibly.
 */
export async function executeSignOut(
  client: { auth: { signOut: () => Promise<{ error: any }> } },
  clearLocalSession: () => void
): Promise<SignOutResult> {
  try {
    const { error } = await client.auth.signOut()
    if (error) {
      return {
        success: false,
        error,
        warning: 'Remote sign-out failed. Local persisted session state may remain active on the provider.',
      }
    }
    clearLocalSession()
    return { success: true, error: null }
  } catch (err) {
    return {
      success: false,
      error: err,
      warning: 'Remote sign-out threw an exception. Persisted session status is unknown.',
    }
  }
}

/**
 * Safely decodes a URI component without throwing on malformed percent sequences.
 */
function safeDecode(val: string | null): string | null {
  if (!val) return null
  try {
    return decodeURIComponent(val.replace(/\+/g, ' '))
  } catch {
    return val.replace(/\+/g, ' ')
  }
}

/**
 * Parses both query string and hash fragment from a callback URL/string.
 * Prioritizes error reporting regardless of whether errors arrive in query or hash.
 */
export function parseAuthCallbackUrl(urlOrString: string): CallbackHashResult {
  if (!urlOrString || urlOrString.trim() === '') {
    return { hasError: false, error: null, errorDescription: null }
  }

  let searchParams: URLSearchParams | null = null
  let hashParams: URLSearchParams | null = null

  try {
    // Check if full URL or path
    const parsed = new URL(urlOrString, 'http://localhost:3000')
    searchParams = parsed.searchParams
    if (parsed.hash) {
      const cleanHash = parsed.hash.startsWith('#') ? parsed.hash.substring(1) : parsed.hash
      hashParams = new URLSearchParams(cleanHash)
    }
  } catch {
    // If raw query or hash fragment was passed
    if (urlOrString.startsWith('?')) {
      searchParams = new URLSearchParams(urlOrString.substring(1))
    } else if (urlOrString.startsWith('#')) {
      hashParams = new URLSearchParams(urlOrString.substring(1))
    } else {
      searchParams = new URLSearchParams(urlOrString)
    }
  }

  // Check query parameters first
  if (searchParams) {
    const error = searchParams.get('error')
    if (error) {
      return {
        hasError: true,
        error,
        errorDescription: safeDecode(searchParams.get('error_description')),
      }
    }
  }

  // Check hash fragment parameters
  if (hashParams) {
    const error = hashParams.get('error')
    if (error) {
      return {
        hasError: true,
        error,
        errorDescription: safeDecode(hashParams.get('error_description')),
      }
    }
  }

  return { hasError: false, error: null, errorDescription: null }
}

/**
 * Backward compatibility helper for hash fragment parsing.
 */
export function parseAuthCallbackHash(hash: string): CallbackHashResult {
  return parseAuthCallbackUrl(hash.startsWith('#') ? hash : `#${hash}`)
}

/**
 * Resolves verified user using client.auth.getUser() instead of trusting local getSession().
 * Prevents forged/stale sessions in local storage from spoofing authenticated state.
 */
export async function resolveVerifiedUser(
  client: { auth: { getUser: () => Promise<any> } }
): Promise<VerifiedUserResult> {
  try {
    const { data, error } = await client.auth.getUser()
    if (error || !data?.user) {
      return {
        verified: false,
        user: null,
        error: error || new Error('No verified user found'),
      }
    }
    return {
      verified: true,
      user: getSafeUserDisplay(data.user),
      error: null,
    }
  } catch (err) {
    return {
      verified: false,
      user: null,
      error: err,
    }
  }
}

/**
 * Creates a safe, non-blocking auth state change handler.
 * Guarantees that:
 * 1. The handler returns immediately (synchronously, void) without awaiting Supabase calls,
 *    preventing the auth-js lock deadlock.
 * 2. Asynchronous verification is scheduled after the callback returns.
 * 3. Race conditions are handled via a sequence counter: a subsequent SIGNED_OUT cancels
 *    any pending asynchronous SIGNED_IN verification.
 */
export function createSafeAuthStateHandler(
  onUserVerified: (user: SafeUserDisplay | null) => void,
  onError: (err: any) => void,
  verifyFn: () => Promise<SafeUserDisplay | null>
) {
  let sequence = 0

  return function handleAuthStateChange(event: string, session: any): void {
    const currentSeq = ++sequence

    if (event === 'SIGNED_OUT' || !session?.user) {
      onUserVerified(null)
      return
    }

    // Schedule verification asynchronously without awaiting in callback
    setTimeout(async () => {
      // If a later event occurred (e.g. SIGNED_OUT), abort
      if (currentSeq !== sequence) {
        return
      }

      try {
        const verified = await verifyFn()
        if (currentSeq === sequence) {
          onUserVerified(verified)
        }
      } catch (err) {
        if (currentSeq === sequence) {
          onError(err)
          onUserVerified(null)
        }
      }
    }, 0)
  }
}

/**
 * Processes OAuth callback:
 * 1. Checks provider error in query and hash first. If denied, rejects immediately
 *    without checking existing session.
 * 2. Checks that the callback URL contains OAuth response parameters (PKCE code or access_token).
 *    A direct visit with an old session is rejected and NOT claimed as a new OAuth login.
 * 3. If valid response params are present, verifies user with getUser().
 */
export async function processAuthCallback(
  client: { auth: { getUser: () => Promise<any> } },
  callbackUrlOrParams: string
): Promise<{ success: boolean; error: string | null; user: SafeUserDisplay | null }> {
  const parsed = parseAuthCallbackUrl(callbackUrlOrParams)
  if (parsed.hasError) {
    const errorMsg = `OAuth Provider Error: ${parsed.error}${parsed.errorDescription ? ` - ${parsed.errorDescription}` : ''}`
    return {
      success: false,
      error: errorMsg,
      user: null,
    }
  }

  // Check whether the URL contains an OAuth response payload (code or access_token)
  let hasOAuthResponse = false
  try {
    const url = new URL(callbackUrlOrParams, 'http://localhost:3000')
    if (url.searchParams.has('code')) {
      hasOAuthResponse = true
    }
    if (url.hash && (url.hash.includes('access_token=') || url.hash.includes('token_type='))) {
      hasOAuthResponse = true
    }
  } catch {
    if (callbackUrlOrParams.includes('code=') || callbackUrlOrParams.includes('access_token=')) {
      hasOAuthResponse = true
    }
  }

  if (!hasOAuthResponse) {
    return {
      success: false,
      error: 'No authorization code or OAuth response found in callback URL.',
      user: null,
    }
  }

  const verifiedResult = await resolveVerifiedUser(client)
  if (!verifiedResult.verified || !verifiedResult.user) {
    return {
      success: false,
      error: verifiedResult.error?.message || 'No verified user session returned by authentication provider.',
      user: null,
    }
  }

  return {
    success: true,
    error: null,
    user: verifiedResult.user,
  }
}

/**
 * Evaluates SSR request route guard against a request-scoped client and cookies.
 * Verifies user with getUser() and runs the route guard.
 */
export async function evaluateSsrRouteGuard(
  client: { auth: { getUser: () => Promise<any> } } | null,
  path: string,
  redirectFn: (to: string) => any
): Promise<{ allowed: boolean; redirect: string | null; user: SafeUserDisplay | null }> {
  let isVerified = false
  let verifiedUser: SafeUserDisplay | null = null

  if (client) {
    const check = await resolveVerifiedUser(client)
    if (check.verified && check.user) {
      isVerified = true
      verifiedUser = check.user
    }
  }

  const check = checkRouteAccess(path, isVerified)
  if (!check.allowed && check.redirect) {
    const target = `${check.redirect}?auth_required=true`
    redirectFn(target)
    return { allowed: false, redirect: target, user: null }
  }

  return { allowed: true, redirect: null, user: verifiedUser }
}

