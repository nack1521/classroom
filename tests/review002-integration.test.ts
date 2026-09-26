import { describe, it, expect, vi } from 'vitest'
import {
  parseAuthCallbackUrl,
  processAuthCallback,
  createSafeAuthStateHandler,
  executeSignOut,
} from '../app/utils/auth'
import { getSupabaseClient } from '../app/utils/supabaseClient'
import * as supabaseClientModule from '../app/utils/supabaseClient'
import { useAuth } from '../app/composables/useAuth'

describe('REVIEW-002: Auth State Change Non-Blocking & Deadlock Prevention', () => {
  it('returns immediately from onAuthStateChange subscriber without blocking or awaiting Supabase calls', async () => {
    let subscriberCallback: ((event: string, session: any) => void) | null = null

    // Mock client that tracks whether onAuthStateChange is awaiting
    const mockClient = {
      auth: {
        onAuthStateChange: vi.fn().mockImplementation((cb) => {
          subscriberCallback = cb
          return { data: { subscription: { unsubscribe: vi.fn() } } }
        }),
        getUser: vi.fn().mockImplementation(() => {
          // In the real auth-js deadlock, getUser blocks if called while subscriber is running
          return Promise.resolve({
            data: { user: { id: 'usr-1', email: 'test@rpr.ac.th' } },
            error: null,
          })
        }),
      },
    }

    const onUserVerified = vi.fn()
    const onError = vi.fn()

    const handler = createSafeAuthStateHandler(
      onUserVerified,
      onError,
      () => mockClient.auth.getUser().then((res: any) => (res.data?.user ? { id: res.data.user.id, email: res.data.user.email, signedIn: true, message: 'Signed in' } : null))
    )

    // Simulate auth-js calling subscriber: MUST be synchronous and return undefined (not a Promise)
    const result = handler('SIGNED_IN', { user: { id: 'usr-1' } })
    expect(result).toBeUndefined() // Proves it does not return an awaited Promise

    // Wait for the scheduled microtask / timer to settle
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(mockClient.auth.getUser).toHaveBeenCalledTimes(1)
    expect(onUserVerified).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'usr-1', email: 'test@rpr.ac.th', signedIn: true })
    )
  })

  it('handles race conditions: slow SIGNED_IN verification followed by SIGNED_OUT leaves user state null', async () => {
    let resolveSlowGetUser: (value: any) => void = () => {}
    const slowGetUserPromise = new Promise((resolve) => {
      resolveSlowGetUser = resolve
    })

    const mockClient = {
      auth: {
        getUser: vi.fn().mockImplementation(() => slowGetUserPromise),
      },
    }

    // Model the production composable state wiring
    let userState: any = null
    let stateGeneration = 0

    // Pure verification helper that does NOT write userState
    async function fetchVerifiedUser() {
      const res: any = await mockClient.auth.getUser()
      if (res.data?.user) {
        return { id: res.data.user.id, email: res.data.user.email, signedIn: true, message: 'Signed in' }
      }
      return null
    }

    const handler = createSafeAuthStateHandler(
      (verifiedUser) => {
        // Generation guard matching useAuth
        ++stateGeneration
        userState = verifiedUser
      },
      () => {},
      () => fetchVerifiedUser()
    )

    // 1. SIGNED_IN event triggers slow verification
    handler('SIGNED_IN', { user: { id: 'usr-1' } })

    // 2. Immediately after, SIGNED_OUT event fires before slow verification resolves
    handler('SIGNED_OUT', null)

    // SIGNED_OUT should immediately set user to null
    expect(userState).toBeNull()

    // 3. Now slow getUser completes for the earlier SIGNED_IN
    resolveSlowGetUser({
      data: { user: { id: 'usr-1', email: 'test@rpr.ac.th' } },
      error: null,
    })

    await new Promise((resolve) => setTimeout(resolve, 30))

    // CRITICAL: userState MUST remain null, not restored to usr-1!
    expect(userState).toBeNull()
  })
})

describe('REVIEW-002 / REVIEW-003: Truthful OAuth Callback & PKCE Exchange', () => {
  it('rejects direct visits to /auth/callback even when client has an active session', async () => {
    const mockClientWithExistingSession = {
      auth: {
        exchangeCodeForSession: vi.fn(),
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'old-session-user', email: 'old@example.com' } },
          error: null,
        }),
      },
    }

    const directVisitUrl = 'http://localhost:3000/auth/callback'
    const result = await processAuthCallback(mockClientWithExistingSession as any, directVisitUrl)
    expect(result.success).toBe(false)
    expect(result.error).toContain('No authorization code or OAuth response found')
    expect(result.user).toBeNull()
    expect(mockClientWithExistingSession.auth.exchangeCodeForSession).not.toHaveBeenCalled()
  })

  it('rejects callback with empty code parameter (?code=)', async () => {
    const mockClient = {
      auth: {
        exchangeCodeForSession: vi.fn(),
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'old-user', email: 'old@example.com' } },
          error: null,
        }),
      },
    }

    const emptyCodeUrl = 'http://localhost:3000/auth/callback?code='
    const result = await processAuthCallback(mockClient as any, emptyCodeUrl)
    expect(result.success).toBe(false)
    expect(result.error).toContain('No authorization code or OAuth response found')
    expect(result.user).toBeNull()
  })

  it('rejects callback with token marker alone (#token_type=bearer) without access_token', async () => {
    const mockClient = {
      auth: {
        exchangeCodeForSession: vi.fn(),
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'old-user', email: 'old@example.com' } },
          error: null,
        }),
      },
    }

    const markerUrl = 'http://localhost:3000/auth/callback#token_type=bearer'
    const result = await processAuthCallback(mockClient as any, markerUrl)
    expect(result.success).toBe(false)
    expect(result.error).toContain('No authorization code or OAuth response found')
    expect(result.user).toBeNull()
  })

  it('rejects bogus authorization code even when client has a pre-existing session (no false success)', async () => {
    const mockClientWithOldSession = {
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          data: { session: null, user: null },
          error: new Error('Invalid PKCE authorization code grant'),
        }),
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'old-user', email: 'old@example.com' } },
          error: null,
        }),
      },
    }

    const bogusCodeUrl = 'http://localhost:3000/auth/callback?code=bogus-invalid-code'
    const result = await processAuthCallback(mockClientWithOldSession as any, bogusCodeUrl)

    expect(mockClientWithOldSession.auth.exchangeCodeForSession).toHaveBeenCalledWith('bogus-invalid-code')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Failed to exchange authorization code')
    expect(result.user).toBeNull()
  })

  it('accepts valid callback, exchanges PKCE code for session, and verifies new user', async () => {
    const mockClient = {
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: 'new-token', user: { id: 'new-oauth-user' } }, user: { id: 'new-oauth-user' } },
          error: null,
        }),
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'new-oauth-user', email: 'new@rpr.ac.th' } },
          error: null,
        }),
      },
    }

    const validCodeUrl = 'http://localhost:3000/auth/callback?code=mock-valid-pkce-code-456'
    const result = await processAuthCallback(mockClient as any, validCodeUrl)

    expect(mockClient.auth.exchangeCodeForSession).toHaveBeenCalledWith('mock-valid-pkce-code-456')
    expect(result.success).toBe(true)
    expect(result.user?.id).toBe('new-oauth-user')
    expect(result.user?.email).toBe('new@rpr.ac.th')
  })

  it('rejects reused code on another client and never returns the other client\'s old session', async () => {
    // Client A exchanges code successfully
    const clientA = {
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: 'token-a', user: { id: 'user-a' } }, user: { id: 'user-a' } },
          error: null,
        }),
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-a', email: 'user-a@rpr.ac.th' } },
          error: null,
        }),
      },
    }

    const callbackUrl = 'http://localhost:3000/auth/callback?code=shared-code-123'
    const resultA = await processAuthCallback(clientA as any, callbackUrl)
    expect(resultA.success).toBe(true)
    expect(resultA.user?.id).toBe('user-a')

    // Client B attempts to use the same code, but client B has an old pre-existing session in storage.
    // Provider rejects the reused code.
    const clientB = {
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          data: { session: null, user: null },
          error: new Error('Invalid or expired authorization code'),
        }),
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'old-b-user', email: 'old-b@rpr.ac.th' } },
          error: null,
        }),
      },
    }

    const resultB = await processAuthCallback(clientB as any, callbackUrl)
    expect(resultB.success).toBe(false)
    expect(resultB.user).toBeNull()
    expect(resultB.error).toContain('Failed to exchange authorization code')
    expect(resultB.error?.includes('Invalid or expired authorization code')).toBe(false)
    // Crucial: Client B's old user is NEVER returned!
    expect(resultB.user).toBeNull()
  })

  it('rejects callback when exchange returns null session/user even if client has a pre-existing user', async () => {
    const mockClient = {
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          data: { session: null, user: null },
          error: null,
        }),
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'pre-existing-user', email: 'pre@rpr.ac.th' } },
          error: null,
        }),
      },
    }

    const url = 'http://localhost:3000/auth/callback?code=some-code'
    const result = await processAuthCallback(mockClient as any, url)
    expect(result.success).toBe(false)
    expect(result.user).toBeNull()
    expect(result.error).toContain('did not return a valid authenticated session')
    // getUser must NOT be called to adopt the old user
    expect(mockClient.auth.getUser).not.toHaveBeenCalled()
  })

  it('rejects hash callback when setSession fails or is absent and does not return pre-existing user', async () => {
    // Case 1: setSession is absent
    const mockClientWithoutSetSession = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'pre-existing-user', email: 'pre@rpr.ac.th' } },
          error: null,
        }),
      },
    }

    const hashUrl = 'http://localhost:3000/auth/callback#access_token=token123&refresh_token=ref123'
    const res1 = await processAuthCallback(mockClientWithoutSetSession as any, hashUrl)
    expect(res1.success).toBe(false)
    expect(res1.user).toBeNull()
    expect(res1.error).toContain('does not support token session setup')
    expect(mockClientWithoutSetSession.auth.getUser).not.toHaveBeenCalled()

    // Case 2: setSession returns an error
    const mockClientFailedSetSession = {
      auth: {
        setSession: vi.fn().mockResolvedValue({
          data: { session: null },
          error: new Error('Invalid token signature'),
        }),
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'pre-existing-user', email: 'pre@rpr.ac.th' } },
          error: null,
        }),
      },
    }

    const res2 = await processAuthCallback(mockClientFailedSetSession as any, hashUrl)
    expect(res2.success).toBe(false)
    expect(res2.user).toBeNull()
    expect(res2.error).toContain('Failed to establish session')
    expect(res2.error?.includes('Invalid token signature')).toBe(false)
    expect(mockClientFailedSetSession.auth.getUser).not.toHaveBeenCalled()
  })
})

describe('REVIEW-002: Request-Scoped Server SSR Cookie Client & Isolation', () => {
  it('creates distinct request-scoped clients for different H3 request events with isolated cookies', () => {
    // Simulate Request 1 (User A)
    const event1 = {
      node: {
        req: {
          headers: {
            cookie: 'sb-access-token=token-user-a',
          },
        },
      },
      context: {},
    } as any

    // Simulate Request 2 (User B)
    const event2 = {
      node: {
        req: {
          headers: {
            cookie: 'sb-access-token=token-user-b',
          },
        },
      },
      context: {},
    } as any

    // Mock useRequestEvent to simulate server SSR
    (globalThis as any).useRequestEvent = vi.fn()

    ;(globalThis as any).useRequestEvent.mockReturnValue(event1)
    const client1 = getSupabaseClient('https://test.supabase.co', 'anon-key-1')

    ;(globalThis as any).useRequestEvent.mockReturnValue(event2)
    const client2 = getSupabaseClient('https://test.supabase.co', 'anon-key-1')

    expect(client1).toBeDefined()
    expect(client2).toBeDefined()
    // CRITICAL: Proves Request 1 and Request 2 do NOT share a module-global client instance!
    expect(client1).not.toBe(client2)
    expect(event1.context._supabaseClient).toBe(client1)
    expect(event2.context._supabaseClient).toBe(client2)
  })
})

describe('Production useAuth Composable Race Condition & Generation Guard', () => {
  it('guarantees that slow in-flight verification already started cannot overwrite user state after sign-out', async () => {
    let onAuthChangeCb: any = null
    let getUserInvocationCount = 0
    let slowGetUserStarted = false
    let resolveSlowGetUser: (value: any) => void = () => {}
    const slowGetUserPromise = new Promise((resolve) => {
      resolveSlowGetUser = resolve
    })

    const mockClient = {
      auth: {
        onAuthStateChange: vi.fn((cb) => {
          onAuthChangeCb = cb
          return { data: { subscription: { unsubscribe: vi.fn() } } }
        }),
        getUser: vi.fn(() => {
          getUserInvocationCount++
          if (getUserInvocationCount === 1) {
            // Initial check on initAuth()
            return Promise.resolve({ data: { user: null }, error: null })
          }
          // Slow verification triggered by auth state change
          slowGetUserStarted = true
          return slowGetUserPromise
        }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
    }

    const spy = vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(mockClient as any)

    ;(globalThis as any).useRuntimeConfig = () => ({
      public: {
        supabaseUrl: 'https://test.supabase.co',
        supabaseKey: 'test-key',
        siteUrl: 'http://localhost:3000',
      },
    })

    const store: Record<string, { value: any }> = {}
    ;(globalThis as any).useState = (key: string, init: () => any) => {
      if (!store[key]) {
        store[key] = { value: init() }
      }
      return store[key]
    }
    ;(globalThis as any).navigateTo = vi.fn()

    const auth = useAuth()
    await auth.initAuth()

    // Verify subscriber was registered
    expect(mockClient.auth.onAuthStateChange).toHaveBeenCalled()
    expect(onAuthChangeCb).toBeDefined()

    // Trigger onAuthStateChange with SIGNED_IN
    onAuthChangeCb('SIGNED_IN', { user: { id: 'slow-user' } })

    // Wait until the slow verification has ACTUALLY started (getUser() has been invoked)
    await vi.waitFor(() => {
      expect(slowGetUserStarted).toBe(true)
    })
    expect(getUserInvocationCount).toBe(2)

    // Now sign out while verification is in-flight (no SIGNED_OUT notification arrives)
    await auth.signOut()
    expect(auth.user.value).toBeNull()

    // Now let the slow verification complete
    resolveSlowGetUser({
      data: { user: { id: 'slow-user', email: 'slow@rpr.ac.th' } },
      error: null,
    })

    await new Promise((resolve) => setTimeout(resolve, 50))

    // State MUST NOT be overwritten or restored to slow-user!
    expect(auth.user.value).toBeNull()

    spy.mockRestore()
  })

  it('retains user.value and reports signOutError visibly when remote sign-out fails and local session persists', async () => {
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'persisted-student-99', email: 'persisted@rpr.ac.th' } },
          error: null,
        }),
        signOut: vi.fn().mockResolvedValue({
          error: new Error('Network failure during sign out'),
        }),
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: 'persisted-student-99' } } },
          error: null,
        }),
      },
    }

    const spy = vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(mockClient as any)

    ;(globalThis as any).useRuntimeConfig = () => ({
      public: {
        supabaseUrl: 'https://test.supabase.co',
        supabaseKey: 'test-key',
        siteUrl: 'http://localhost:3000',
      },
    })

    const store: Record<string, { value: any }> = {}
    ;(globalThis as any).useState = (key: string, init: () => any) => {
      if (!store[key]) {
        store[key] = { value: init() }
      }
      return store[key]
    }
    const mockNavigate = vi.fn()
    ;(globalThis as any).navigateTo = mockNavigate

    const auth = useAuth()
    await auth.checkVerifiedUser()
    expect(auth.user.value?.id).toBe('persisted-student-99')

    // Perform sign out which fails while local session persists
    await auth.signOut()

    // Assert user state is NOT cleared when remote sign out fails and local session persists
    expect(auth.user.value?.id).toBe('persisted-student-99')
    expect(auth.signOutError.value).toContain('Local persisted session state may remain active')
    expect(auth.signOutError.value).not.toContain('Network failure during sign out')
    expect(mockNavigate).not.toHaveBeenCalled()

    spy.mockRestore()
  })

  it('clears user.value, navigates home, and shows unconfirmed warning when remote sign-out fails and local session was purged', async () => {
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'persisted-student-99', email: 'persisted@rpr.ac.th' } },
          error: null,
        }),
        signOut: vi.fn().mockResolvedValue({
          error: new Error('Network failure during sign out'),
        }),
        getSession: vi.fn().mockResolvedValue({
          data: { session: null },
          error: null,
        }),
      },
    }

    const spy = vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(mockClient as any)

    ;(globalThis as any).useRuntimeConfig = () => ({
      public: {
        supabaseUrl: 'https://test.supabase.co',
        supabaseKey: 'test-key',
        siteUrl: 'http://localhost:3000',
      },
    })

    const store: Record<string, { value: any }> = {}
    ;(globalThis as any).useState = (key: string, init: () => any) => {
      if (!store[key]) {
        store[key] = { value: init() }
      }
      return store[key]
    }
    const mockNavigate = vi.fn()
    ;(globalThis as any).navigateTo = mockNavigate

    const auth = useAuth()
    await auth.checkVerifiedUser()
    expect(auth.user.value?.id).toBe('persisted-student-99')

    // Perform sign out which fails but local session was purged
    await auth.signOut()

    // Assert user state IS cleared when local session is no longer present
    expect(auth.user.value).toBeNull()
    expect(auth.signOutError.value).toContain('remote revocation was not confirmed')
    expect(auth.signOutError.value).not.toContain('Network failure during sign out')
    expect(mockNavigate).toHaveBeenCalledWith('/')

    spy.mockRestore()
  })
})

describe('REVIEW-006B.1: Tri-State Local Session Classification on Sign-Out Error', () => {
  it('RED CONTRACT (executeSignOut): when getSession() throws, treats local state as unknown, does NOT clear local session, and returns unconfirmed warning', async () => {
    const mockClient = {
      auth: {
        signOut: vi.fn().mockResolvedValue({ error: new Error('Remote 500 error') }),
        getSession: vi.fn().mockRejectedValue(new Error('Storage access failed')),
      },
    }
    const mockClearLocal = vi.fn()

    const result = await executeSignOut(mockClient, mockClearLocal)

    expect(mockClearLocal).not.toHaveBeenCalled()
    expect(result.localSessionCleared).toBe(false)
    expect(result.localSessionState).toBe('unknown')
    expect(result.warning).not.toContain('completed locally')
    expect(result.warning).toContain('unconfirmed')
  })

  it('RED CONTRACT (executeSignOut): when getSession() returns an error, treats local state as unknown, does NOT clear local session, and returns unconfirmed warning', async () => {
    const mockClient = {
      auth: {
        signOut: vi.fn().mockResolvedValue({ error: new Error('Remote 500 error') }),
        getSession: vi.fn().mockResolvedValue({
          data: { session: null },
          error: new Error('Corrupted session storage payload'),
        }),
      },
    }
    const mockClearLocal = vi.fn()

    const result = await executeSignOut(mockClient, mockClearLocal)

    expect(mockClearLocal).not.toHaveBeenCalled()
    expect(result.localSessionCleared).toBe(false)
    expect(result.localSessionState).toBe('unknown')
    expect(result.warning).not.toContain('completed locally')
    expect(result.warning).toContain('unconfirmed')
  })

  it('RED CONTRACT (executeSignOut): when getSession is missing from client, treats local state as unknown, does NOT clear local session, and returns unconfirmed warning', async () => {
    const mockClient = {
      auth: {
        signOut: vi.fn().mockResolvedValue({ error: new Error('Remote 500 error') }),
      },
    }
    const mockClearLocal = vi.fn()

    const result = await executeSignOut(mockClient as any, mockClearLocal)

    expect(mockClearLocal).not.toHaveBeenCalled()
    expect(result.localSessionCleared).toBe(false)
    expect(result.localSessionState).toBe('unknown')
    expect(result.warning).not.toContain('completed locally')
    expect(result.warning).toContain('unconfirmed')
  })

  it('POSITIVE CONTROL (executeSignOut): when getSession() returns clean null session, confirms deletion, clears local session, and returns completed-locally warning', async () => {
    const mockClient = {
      auth: {
        signOut: vi.fn().mockResolvedValue({ error: new Error('Remote 500 error') }),
        getSession: vi.fn().mockResolvedValue({
          data: { session: null },
          error: null,
        }),
      },
    }
    const mockClearLocal = vi.fn()

    const result = await executeSignOut(mockClient, mockClearLocal)

    expect(mockClearLocal).toHaveBeenCalledTimes(1)
    expect(result.localSessionCleared).toBe(true)
    expect(result.localSessionState).toBe('confirmed_absent')
    expect(result.warning).toContain('completed locally')
    expect(result.warning).toContain('remote revocation was not confirmed')
  })

  it('POSITIVE CONTROL (executeSignOut): when getSession() returns valid session, confirms presence, does NOT clear local session, and warns session remains active', async () => {
    const mockClient = {
      auth: {
        signOut: vi.fn().mockResolvedValue({ error: new Error('Remote 500 error') }),
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: 'u1' } } },
          error: null,
        }),
      },
    }
    const mockClearLocal = vi.fn()

    const result = await executeSignOut(mockClient, mockClearLocal)

    expect(mockClearLocal).not.toHaveBeenCalled()
    expect(result.localSessionCleared).toBe(false)
    expect(result.localSessionState).toBe('confirmed_present')
    expect(result.warning).toContain('Local persisted session state may remain active')
  })

  it('RED CONTRACT (useAuth): when local session reading is unknown, does not masquerade as confirmed local deletion, does not echo SDK error text, does not assert signed-out identity, and navigates home with unconfirmed warning', async () => {
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-unknown-1', email: 'unknown1@rpr.ac.th' } },
          error: null,
        }),
        signOut: vi.fn().mockResolvedValue({
          error: new Error('Remote 500 failure'),
        }),
        getSession: vi.fn().mockRejectedValue(new Error('Corrupted storage read failure')),
      },
    }

    const spy = vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(mockClient as any)

    ;(globalThis as any).useRuntimeConfig = () => ({
      public: {
        supabaseUrl: 'https://test.supabase.co',
        supabaseKey: 'test-key',
        siteUrl: 'http://localhost:3000',
      },
    })

    const store: Record<string, { value: any }> = {}
    ;(globalThis as any).useState = (key: string, init: () => any) => {
      if (!store[key]) {
        store[key] = { value: init() }
      }
      return store[key]
    }
    const mockNavigate = vi.fn()
    ;(globalThis as any).navigateTo = mockNavigate

    const auth = useAuth()
    await auth.checkVerifiedUser()
    expect(auth.user.value?.id).toBe('user-unknown-1')

    // Perform sign out which encounters remote failure and unreadable session
    await auth.signOut()

    // Contract assertions:
    // 1. Must NOT claim sign-out completed locally
    expect(auth.signOutError.value).not.toContain('completed locally')
    // 2. Must NOT echo raw SDK or provider error text
    expect(auth.signOutError.value).not.toContain('Corrupted storage read failure')
    expect(auth.signOutError.value).not.toContain('Remote 500 failure')
    // 3. Must warn that revocation and local status are unconfirmed
    expect(auth.signOutError.value).toContain('unconfirmed')
    // 4. Must NOT assert signed-out identity when deletion was not confirmed
    expect(auth.user.value?.id).toBe('user-unknown-1')
    // 5. Navigates to public route where warning is visibly displayed
    expect(mockNavigate).toHaveBeenCalledWith('/')

    spy.mockRestore()
  })
})
