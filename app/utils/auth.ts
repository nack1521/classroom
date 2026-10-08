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

export type LocalSessionState = 'confirmed_present' | 'confirmed_absent' | 'unknown'

export interface SignOutResult {
  success: boolean
  error: any
  warning?: string
  localSessionCleared?: boolean
  localSessionState?: LocalSessionState
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

  if (
    normalized === '/protected' ||
    normalized.startsWith('/protected/') ||
    normalized === '/apply' ||
    normalized.startsWith('/apply/') ||
    normalized === '/review' ||
    normalized.startsWith('/review/') ||
    normalized === '/admin' ||
    normalized.startsWith('/admin/') ||
    normalized === '/teacher' ||
    normalized.startsWith('/teacher/') ||
    normalized === '/learn' ||
    normalized.startsWith('/learn/')
  ) {
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
 * Rigorously classifies the local session state into confirmed_present, confirmed_absent, or unknown.
 * A thrown error, returned error, or missing/invalid data is classified as unknown.
 */
export async function inspectLocalSessionState(
  auth?: { getSession?: () => Promise<{ data: { session: any } | null; error?: any }> }
): Promise<LocalSessionState> {
  if (typeof auth?.getSession !== 'function') {
    return 'unknown'
  }
  try {
    const sessionRes = await auth.getSession()
    if (!sessionRes || sessionRes.error) {
      return 'unknown'
    }
    if (sessionRes.data && sessionRes.data.session) {
      return 'confirmed_present'
    }
    if (sessionRes.data && sessionRes.data.session === null) {
      return 'confirmed_absent'
    }
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

/**
 * Signs out the user from Supabase.
 * Strictly distinguishes confirmed local deletion from confirmed presence and unknown/unreadable state.
 */
export async function executeSignOut(
  client: {
    auth: {
      signOut: () => Promise<{ error: any }>
      getSession?: () => Promise<{ data: { session: any } | null; error?: any }>
    }
  },
  clearLocalSession: () => void
): Promise<SignOutResult> {
  try {
    const { error } = await client.auth.signOut()

    const sessionState = await inspectLocalSessionState(client.auth)

    if (error) {
      if (sessionState === 'confirmed_absent') {
        clearLocalSession()
        return {
          success: false,
          error,
          warning: 'Sign out completed locally, but remote revocation was not confirmed by the authentication provider.',
          localSessionCleared: true,
          localSessionState: 'confirmed_absent',
        }
      }

      if (sessionState === 'confirmed_present') {
        return {
          success: false,
          error,
          warning: 'Remote sign-out failed. Local persisted session state may remain active on the provider.',
          localSessionCleared: false,
          localSessionState: 'confirmed_present',
        }
      }

      // sessionState === 'unknown'
      return {
        success: false,
        error,
        warning: 'Sign-out status is unconfirmed: remote revocation failed and local persisted session state could not be verified.',
        localSessionCleared: false,
        localSessionState: 'unknown',
      }
    }

    clearLocalSession()
    return { success: true, error: null }
  } catch (err) {
    const sessionState = await inspectLocalSessionState(client?.auth)

    if (sessionState === 'confirmed_absent') {
      clearLocalSession()
      return {
        success: false,
        error: err,
        warning: 'Sign out completed locally, but remote revocation was not confirmed by the authentication provider.',
        localSessionCleared: true,
        localSessionState: 'confirmed_absent',
      }
    }

    if (sessionState === 'confirmed_present') {
      return {
        success: false,
        error: err,
        warning: 'Remote sign-out threw an exception. Persisted session status is unknown.',
        localSessionCleared: false,
        localSessionState: 'confirmed_present',
      }
    }

    // sessionState === 'unknown'
    return {
      success: false,
      error: err,
      warning: 'Sign-out status is unconfirmed: remote sign-out threw an exception and local persisted session state could not be verified.',
      localSessionCleared: false,
      localSessionState: 'unknown',
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
  verifyFn: () => Promise<SafeUserDisplay | null>,
  getGeneration?: () => number
) {
  let sequence = 0

  return function handleAuthStateChange(event: string, session: any): void {
    const startSeq = ++sequence
    const startGen = getGeneration ? getGeneration() : startSeq

    if (event === 'SIGNED_OUT' || !session?.user) {
      onUserVerified(null)
      return
    }

    // Schedule verification asynchronously without awaiting in callback
    setTimeout(async () => {
      const isStale = () => {
        if (getGeneration && getGeneration() !== startGen) {
          return true
        }
        return sequence !== startSeq
      }

      if (isStale()) {
        return
      }

      try {
        const verified = await verifyFn()
        if (!isStale()) {
          onUserVerified(verified)
        }
      } catch (err) {
        if (!isStale()) {
          onError(err)
          onUserVerified(null)
        }
      }
    }, 0)
  }
}

export interface AuthCallbackClient {
  auth: {
    exchangeCodeForSession?: (code: string) => Promise<{ data: any; error: any }>
    setSession?: (tokens: { access_token: string; refresh_token: string }) => Promise<{ data: any; error: any }>
    getUser: () => Promise<any>
    getSession?: () => Promise<any>
    signOut?: (options?: { scope?: 'global' | 'local' | 'others' }) => Promise<{ error: any }>
  }
}

/**
 * Quarantines an ambiguous locally-persisted SDK session created during callback processing
 * that subsequently failed identity verification.
 * Uses explicit local scope only ({ scope: 'local' }) to avoid globally signing out other devices.
 */
async function quarantineLocalSession(client: AuthCallbackClient | null | undefined): Promise<void> {
  if (typeof client?.auth?.signOut === 'function') {
    try {
      await client.auth.signOut({ scope: 'local' })
    } catch {
      // Local removal is attempted by the SDK even if remote logout fails
    }
  }
}

/**
 * Processes OAuth callback:
 * 1. Checks provider error in query and hash first. If denied, rejects immediately.
 * 2. Validates OAuth response parameters: requires a non-empty PKCE code or access_token.
 *    A direct visit, empty code, or marker token without access_token is rejected.
 * 3. Performs PKCE code exchange via client.auth.exchangeCodeForSession,
 *    or establishes session via client.auth.setSession.
 * 4. Checks that the exchange/setup returned an actual session and user. If null or error,
 *    rejects immediately and NEVER falls back to any prior user.
 * 5. Only if the exchange/session setup succeeds, verifies identity with getUser().
 *    An old verified session cannot mask an invalid or failing OAuth callback.
 */
export async function processAuthCallback(
  client: AuthCallbackClient,
  callbackUrlOrParams: string
): Promise<{ success: boolean; error: string | null; user: SafeUserDisplay | null }> {
  const parsed = parseAuthCallbackUrl(callbackUrlOrParams)
  if (parsed.hasError) {
    let errorMsg: string
    if (parsed.error === 'access_denied') {
      errorMsg = 'OAuth sign-in was denied (access_denied). Please verify permissions and try again.'
    } else if (parsed.error === 'interaction_required') {
      errorMsg = 'OAuth sign-in requires user interaction (interaction_required). Please sign in again.'
    } else {
      errorMsg = 'Authentication failed: The authentication provider reported an error.'
    }
    return {
      success: false,
      error: errorMsg,
      user: null,
    }
  }

  let code: string | null = null
  let accessToken: string | null = null
  let refreshToken: string | null = null

  try {
    const url = new URL(callbackUrlOrParams, 'http://localhost:3000')
    const queryCode = url.searchParams.get('code')
    if (queryCode && queryCode.trim().length > 0) {
      code = queryCode.trim()
    }

    if (url.hash && url.hash.length > 1) {
      const hashParams = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash)
      const hashAccessToken = hashParams.get('access_token')
      const hashRefreshToken = hashParams.get('refresh_token')
      if (hashAccessToken && hashAccessToken.trim().length > 0) {
        accessToken = hashAccessToken.trim()
        refreshToken = hashRefreshToken ? hashRefreshToken.trim() : ''
      }
    }
  } catch {
    const codeMatch = callbackUrlOrParams.match(/[?&]code=([^&#]+)/)
    if (codeMatch && codeMatch[1]?.trim().length > 0) {
      code = decodeURIComponent(codeMatch[1].trim())
    }
  }

  if (!code && !accessToken) {
    return {
      success: false,
      error: 'No authorization code or OAuth response found in callback URL.',
      user: null,
    }
  }

  let establishedUserId: string | null = null

  if (code) {
    if (typeof client.auth?.exchangeCodeForSession !== 'function') {
      return {
        success: false,
        error: 'Client does not support PKCE code exchange.',
        user: null,
      }
    }

    let exchangeRes: { data: any; error: any }
    try {
      exchangeRes = await client.auth.exchangeCodeForSession(code)
    } catch {
      return {
        success: false,
        error: 'Failed to exchange authorization code: Authentication provider rejected the authorization code.',
        user: null,
      }
    }

    if (exchangeRes.error) {
      return {
        success: false,
        error: 'Failed to exchange authorization code: Authentication provider rejected the authorization code.',
        user: null,
      }
    }

    if (!exchangeRes.data?.session || !exchangeRes.data?.user) {
      return {
        success: false,
        error: 'OAuth code exchange did not return a valid authenticated session.',
        user: null,
      }
    }

    const sessionUserId = exchangeRes.data.session?.user?.id ? String(exchangeRes.data.session.user.id).trim() : null
    const exchangeUserId = exchangeRes.data.user?.id ? String(exchangeRes.data.user.id).trim() : null

    if (!sessionUserId || !exchangeUserId || sessionUserId !== exchangeUserId) {
      await quarantineLocalSession(client)
      return {
        success: false,
        error: 'Authentication failed: OAuth session identity could not be verified.',
        user: null,
      }
    }
    establishedUserId = sessionUserId
  } else if (accessToken) {
    if (typeof client.auth?.setSession !== 'function') {
      return {
        success: false,
        error: 'Client does not support token session setup.',
        user: null,
      }
    }

    let sessionRes: { data: any; error: any }
    try {
      sessionRes = await client.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken || '',
      })
    } catch {
      return {
        success: false,
        error: 'Failed to establish session: OAuth token could not be verified by the authentication provider.',
        user: null,
      }
    }

    if (sessionRes.error) {
      return {
        success: false,
        error: 'Failed to establish session: OAuth token could not be verified by the authentication provider.',
        user: null,
      }
    }

    if (!sessionRes.data?.session || !sessionRes.data?.user) {
      return {
        success: false,
        error: 'OAuth token setup did not return a valid authenticated session.',
        user: null,
      }
    }

    const sessionUserId = sessionRes.data.session?.user?.id ? String(sessionRes.data.session.user.id).trim() : null
    const responseUserId = sessionRes.data.user?.id ? String(sessionRes.data.user.id).trim() : null

    if (!sessionUserId || !responseUserId || sessionUserId !== responseUserId) {
      await quarantineLocalSession(client)
      return {
        success: false,
        error: 'Authentication failed: OAuth session identity could not be verified.',
        user: null,
      }
    }
    establishedUserId = sessionUserId
  }

  const verifiedResult = await resolveVerifiedUser(client)
  if (!verifiedResult.verified || !verifiedResult.user) {
    await quarantineLocalSession(client)
    return {
      success: false,
      error: 'Authentication failed: Verified user session could not be retrieved from the authentication provider.',
      user: null,
    }
  }

  const verifiedUserId = verifiedResult.user.id ? String(verifiedResult.user.id).trim() : null
  if (!establishedUserId || !verifiedUserId || establishedUserId !== verifiedUserId) {
    await quarantineLocalSession(client)
    return {
      success: false,
      error: 'Authentication failed: OAuth session identity could not be verified.',
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

export type AppRole = 'admin' | 'teacher'

export interface SafeUserRoles {
  isAdmin: boolean
  isTeacher: boolean
  roles: AppRole[]
}

/**
 * Pure helper to fetch the authenticated user's assigned roles from user_roles table.
 * Bound to the user's provider-verified UUID.
 * Fails closed on any error, missing client, or missing userId.
 */
export async function fetchUserRoles(
  client: any,
  userId?: string | null
): Promise<SafeUserRoles> {
  const emptyRoles: SafeUserRoles = {
    isAdmin: false,
    isTeacher: false,
    roles: [],
  }

  if (!client || !userId || typeof client.from !== 'function') {
    return emptyRoles
  }

  try {
    const { data, error } = await client
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)

    if (error || !Array.isArray(data)) {
      return emptyRoles
    }

    const roles = data
      .map((r: any) => r?.role)
      .filter((r: any): r is AppRole => r === 'admin' || r === 'teacher')

    return {
      isAdmin: roles.includes('admin'),
      isTeacher: roles.includes('teacher'),
      roles,
    }
  } catch {
    return emptyRoles
  }
}
