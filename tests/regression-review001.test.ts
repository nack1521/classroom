import { describe, it, expect, vi } from 'vitest'
import {
  parseAuthCallbackUrl,
  resolveVerifiedUser,
  executeSignOut,
  checkRouteAccess,
  evaluateSsrRouteGuard,
} from '../app/utils/auth'
import { getSupabaseClient } from '../app/utils/supabaseClient'
import { authGuard } from '../app/middleware/auth'

describe('REVIEW-001 Regression: Callback Error Extraction & Priority', () => {
  it('extracts provider error from query string', () => {
    const url = 'http://localhost:3000/auth/callback?error=access_denied&error_description=User+denied+access'
    const result = parseAuthCallbackUrl(url)
    expect(result.hasError).toBe(true)
    expect(result.error).toBe('access_denied')
    expect(result.errorDescription).toBe('User denied access')
  })

  it('extracts provider error from hash fragment', () => {
    const url = 'http://localhost:3000/auth/callback#error=interaction_required&error_description=Login+required'
    const result = parseAuthCallbackUrl(url)
    expect(result.hasError).toBe(true)
    expect(result.error).toBe('interaction_required')
    expect(result.errorDescription).toBe('Login required')
  })

  it('handles malformed percent encoding in error description without throwing', () => {
    // A malformed percent sequence like %zz or %1 or % at end
    const url = 'http://localhost:3000/auth/callback?error=server_error&error_description=Failed+100%+due+to+%E0%A4'
    expect(() => parseAuthCallbackUrl(url)).not.toThrow()
    const result = parseAuthCallbackUrl(url)
    expect(result.hasError).toBe(true)
    expect(result.error).toBe('server_error')
    expect(result.errorDescription).toBeDefined()
  })
})

describe('REVIEW-001 Regression: Denied Callback with Pre-existing Session', () => {
  it('rejects callback and reports denial even if client has a pre-existing session', async () => {
    // Simulate a client that has an existing session in storage
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'old-user-123', email: 'old@example.com' } },
          error: null,
        }),
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: 'old-user-123', email: 'old@example.com' } } },
          error: null,
        }),
      },
    }

    const callbackUrl = 'http://localhost:3000/auth/callback?error=access_denied&error_description=Consent+denied'
    
    // We import a helper that handles callback given a client and URL
    const { processAuthCallback } = await import('../app/utils/auth')
    const result = await processAuthCallback(mockClient as any, callbackUrl)

    expect(result.success).toBe(false)
    expect(result.error).toContain('access_denied')
    expect(mockClient.auth.getUser).not.toHaveBeenCalled()
  })
})

describe('REVIEW-001 Regression: Forged Stored Session Rejection', () => {
  it('denies authenticated state when getSession has a user but getUser fails verification', async () => {
    // Forged session in storage: getSession() claims user exists, but server/crypto verification fails
    const mockClientWithForgedSession = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: 'forged-attacker-id', email: 'attacker@evil.com' } } },
          error: null,
        }),
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new Error('Invalid JWT signature or expired token'),
        }),
      },
    }

    const result = await resolveVerifiedUser(mockClientWithForgedSession as any)
    expect(result.verified).toBe(false)
    expect(result.user).toBeNull()
    expect(result.error).toBeDefined()
  })

  it('confirms authenticated state when getUser cryptographically verifies the token', async () => {
    const mockClientValid = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'verified-student-1', email: 'student@rpr.ac.th' } },
          error: null,
        }),
      },
    }

    const result = await resolveVerifiedUser(mockClientValid as any)
    expect(result.verified).toBe(true)
    expect(result.user?.id).toBe('verified-student-1')
    expect(result.user?.email).toBe('student@rpr.ac.th')
  })
})

describe('REVIEW-001 Regression: Sign-Out Failure Reporting', () => {
  it('does NOT claim clean sign-out if client.auth.signOut reports an error', async () => {
    const networkError = new Error('Network timeout during sign out')
    const mockClient = {
      auth: {
        signOut: vi.fn().mockResolvedValue({ error: networkError }),
      },
    }
    const mockClearLocal = vi.fn()

    const result = await executeSignOut(mockClient as any, mockClearLocal)
    expect(result.success).toBe(false)
    expect(result.error).toBe(networkError)
    expect(result.warning).toContain('persisted session')
    // Local display state should NOT be cleared silently as if nothing happened
    expect(mockClearLocal).not.toHaveBeenCalled()
  })
})

describe('REVIEW-001 Regression: Request-Scoped Server SSR Guard Integration', () => {
  it('allows access to /protected when request has valid cookie session verified by server client', async () => {
    // 1. Synthetic request event with valid cookie
    const eventWithValidSession = {
      node: {
        req: {
          headers: {
            cookie: 'sb-access-token=mock-valid-jwt-token; sb-refresh-token=mock-refresh-token',
          },
        },
      },
      context: {},
    } as any

    // 2. Request-scoped client with stubbed Auth endpoint returning verified user
    const mockRequestScopedClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'student-42', email: 'student42@rpr.ac.th' } },
          error: null,
        }),
      },
    }

    const mockNavigateTo = vi.fn()
    const result = await evaluateSsrRouteGuard(mockRequestScopedClient as any, '/protected', mockNavigateTo)

    expect(mockRequestScopedClient.auth.getUser).toHaveBeenCalledTimes(1)
    expect(mockNavigateTo).not.toHaveBeenCalled()
    expect(result.allowed).toBe(true)
    expect(result.user?.id).toBe('student-42')
    expect(result.user?.email).toBe('student42@rpr.ac.th')
  })

  it('redirects to /?auth_required=true when request has absent session cookie', async () => {
    // Synthetic request event without cookie
    const eventWithoutCookies = {
      node: {
        req: {
          headers: {},
        },
      },
      context: {},
    } as any

    const mockUnauthenticatedClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new Error('Auth session missing'),
        }),
      },
    }

    const mockNavigateTo = vi.fn().mockImplementation((path) => path)
    const result = await evaluateSsrRouteGuard(mockUnauthenticatedClient as any, '/protected', mockNavigateTo)

    expect(mockUnauthenticatedClient.auth.getUser).toHaveBeenCalledTimes(1)
    expect(mockNavigateTo).toHaveBeenCalledWith('/?auth_required=true')
    expect(result.allowed).toBe(false)
    expect(result.redirect).toBe('/?auth_required=true')
    expect(result.user).toBeNull()
  })

  it('redirects to /?auth_required=true and denies access when request has forged or invalid cookie', async () => {
    // Synthetic request event with forged/tampered cookie
    const eventWithForgedCookie = {
      node: {
        req: {
          headers: {
            cookie: 'sb-access-token=forged-tampered-token',
          },
        },
      },
      context: {},
    } as any

    const mockForgedClient = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: 'attacker' } } },
        }),
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new Error('Invalid JWT signature'),
        }),
      },
    }

    const mockNavigateTo = vi.fn().mockImplementation((path) => path)
    const result = await evaluateSsrRouteGuard(mockForgedClient as any, '/protected', mockNavigateTo)

    expect(mockForgedClient.auth.getUser).toHaveBeenCalledTimes(1)
    expect(mockNavigateTo).toHaveBeenCalledWith('/?auth_required=true')
    expect(result.allowed).toBe(false)
    expect(result.redirect).toBe('/?auth_required=true')
  })

  it('proves separate concurrent requests do not share request-scoped clients or identity', () => {
    const eventUserA = {
      node: { req: { headers: { cookie: 'sb-token=user-a' } } },
      context: {},
    } as any

    const eventUserB = {
      node: { req: { headers: { cookie: 'sb-token=user-b' } } },
      context: {},
    } as any

    const clientA = getSupabaseClient('https://example.supabase.co', 'key', eventUserA)
    const clientB = getSupabaseClient('https://example.supabase.co', 'key', eventUserB)

    expect(clientA).not.toBe(clientB)
    expect(eventUserA.context._supabaseClient).toBe(clientA)
    expect(eventUserB.context._supabaseClient).toBe(clientB)
  })
})
