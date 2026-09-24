import { describe, it, expect, vi } from 'vitest'
import {
  parseAuthCallbackUrl,
  processAuthCallback,
  createSafeAuthStateHandler,
} from '../app/utils/auth'
import { getSupabaseClient } from '../app/utils/supabaseClient'

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

  it('handles race conditions: subsequent SIGNED_OUT cancels pending asynchronous verification', async () => {
    let resolveSlowGetUser: (value: any) => void = () => {}
    const slowGetUserPromise = new Promise((resolve) => {
      resolveSlowGetUser = resolve
    })

    const mockClient = {
      auth: {
        getUser: vi.fn().mockImplementation(() => slowGetUserPromise),
      },
    }

    const onUserVerified = vi.fn()
    const onError = vi.fn()

    const handler = createSafeAuthStateHandler(
      onUserVerified,
      onError,
      () => mockClient.auth.getUser().then((res: any) => (res.data?.user ? { id: res.data.user.id, email: res.data.user.email, signedIn: true, message: 'Signed in' } : null))
    )

    // 1. SIGNED_IN event triggers slow verification
    handler('SIGNED_IN', { user: { id: 'usr-1' } })

    // 2. Immediately after, SIGNED_OUT event fires before slow verification resolves
    handler('SIGNED_OUT', null)

    // SIGNED_OUT should immediately set user to null
    expect(onUserVerified).toHaveBeenCalledWith(null)

    // 3. Now slow getUser completes for the earlier SIGNED_IN
    resolveSlowGetUser({
      data: { user: { id: 'usr-1', email: 'test@rpr.ac.th' } },
      error: null,
    })

    await new Promise((resolve) => setTimeout(resolve, 20))

    // Verified that user is NOT restored to usr-1 after sign-out!
    expect(onUserVerified).toHaveBeenLastCalledWith(null)
  })
})

describe('REVIEW-002: Direct Visit to /auth/callback Without OAuth Code/Tokens', () => {
  it('rejects direct visits to /auth/callback even when client has an active session', async () => {
    const mockClientWithExistingSession = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'old-session-user', email: 'old@example.com' } },
          error: null,
        }),
      },
    }

    // Direct URL visit without code, error, or access_token
    const directVisitUrl = 'http://localhost:3000/auth/callback'

    const result = await processAuthCallback(mockClientWithExistingSession as any, directVisitUrl)
    expect(result.success).toBe(false)
    expect(result.error).toContain('No authorization code or OAuth response found')
    expect(result.user).toBeNull()
  })

  it('accepts valid callback containing authorization code', async () => {
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'new-oauth-user', email: 'new@rpr.ac.th' } },
          error: null,
        }),
      },
    }

    const validCodeUrl = 'http://localhost:3000/auth/callback?code=mock-pkce-code-123'
    const result = await processAuthCallback(mockClient as any, validCodeUrl)

    expect(result.success).toBe(true)
    expect(result.user?.id).toBe('new-oauth-user')
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
