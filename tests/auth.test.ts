import { describe, it, expect, vi } from 'vitest'
import {
  isConfigured,
  getSafeUserDisplay,
  buildOAuthRedirectUrl,
  checkRouteAccess,
  executeSignOut,
  parseAuthCallbackHash,
} from '../app/utils/auth'

describe('Supabase Auth Configuration & Safety', () => {
  it('detects missing or empty Supabase credentials as unconfigured', () => {
    expect(isConfigured('', '')).toBe(false)
    expect(isConfigured('https://example.supabase.co', '')).toBe(false)
    expect(isConfigured('', 'some-key')).toBe(false)
    expect(isConfigured(undefined, undefined)).toBe(false)
  })

  it('detects valid credentials as configured', () => {
    expect(isConfigured('https://xyz.supabase.co', 'anon-key-123')).toBe(true)
  })

  it('provides safe user display without leaking access tokens or secrets', () => {
    const unauthenticated = getSafeUserDisplay(null)
    expect(unauthenticated).toEqual({
      signedIn: false,
      email: null,
      id: null,
      message: 'Not signed in',
    })

    const rawUserWithSensitiveData = {
      id: 'usr_12345',
      email: 'test@rpr.ac.th',
      access_token: 'secret-token-should-not-leak',
      refresh_token: 'secret-refresh-token',
      role: 'authenticated',
    }

    const safeDisplay = getSafeUserDisplay(rawUserWithSensitiveData)
    expect(safeDisplay).toEqual({
      signedIn: true,
      email: 'test@rpr.ac.th',
      id: 'usr_12345',
      message: 'Signed in',
    })
    expect((safeDisplay as any).access_token).toBeUndefined()
    expect((safeDisplay as any).refresh_token).toBeUndefined()
  })

  it('builds canonical OAuth callback URL based on site URL', () => {
    expect(buildOAuthRedirectUrl('http://localhost:3000')).toBe('http://localhost:3000/auth/callback')
    expect(buildOAuthRedirectUrl('http://localhost:3000/')).toBe('http://localhost:3000/auth/callback')
    expect(buildOAuthRedirectUrl('https://classroom.example.com')).toBe('https://classroom.example.com/auth/callback')
  })
})

describe('Route Access Guard (Protected vs Public)', () => {
  it('allows access to public route / when unauthenticated', () => {
    const result = checkRouteAccess('/', false)
    expect(result).toEqual({ allowed: true })
  })

  it('allows access to public route / when authenticated', () => {
    const result = checkRouteAccess('/', true)
    expect(result).toEqual({ allowed: true })
  })

  it('denies access to protected route /protected when unauthenticated and redirects to /', () => {
    const result = checkRouteAccess('/protected', false)
    expect(result).toEqual({
      allowed: false,
      redirect: '/',
      reason: 'Authentication required',
    })
  })

  it('allows access to protected route /protected when authenticated', () => {
    const result = checkRouteAccess('/protected', true)
    expect(result).toEqual({ allowed: true })
  })

  it('allows access to callback route /auth/callback regardless of auth state', () => {
    expect(checkRouteAccess('/auth/callback', false)).toEqual({ allowed: true })
    expect(checkRouteAccess('/auth/callback', true)).toEqual({ allowed: true })
  })
})

describe('Sign-out & Session Cleanup', () => {
  it('executes sign-out by calling client signOut and clearing local session', async () => {
    const mockSignOut = vi.fn().mockResolvedValue({ error: null })
    const mockClearLocal = vi.fn()

    const mockClient = {
      auth: {
        signOut: mockSignOut,
      },
    }

    const result = await executeSignOut(mockClient, mockClearLocal)
    expect(mockSignOut).toHaveBeenCalledTimes(1)
    expect(mockClearLocal).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ success: true, error: null })
  })

  it('handles sign-out errors visibly without silently clearing local session', async () => {
    const mockSignOut = vi.fn().mockResolvedValue({ error: new Error('Network error during sign out') })
    const mockClearLocal = vi.fn()

    const mockClient = {
      auth: {
        signOut: mockSignOut,
      },
    }

    const result = await executeSignOut(mockClient, mockClearLocal)
    expect(mockSignOut).toHaveBeenCalledTimes(1)
    expect(mockClearLocal).not.toHaveBeenCalled()
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    expect(result.warning).toBeDefined()
  })
})

describe('OAuth Callback Hash Parsing', () => {
  it('extracts error details from OAuth redirect hash if provider returned an error', () => {
    const hash = '#error=access_denied&error_description=User%20denied%20consent'
    const parsed = parseAuthCallbackHash(hash)
    expect(parsed.hasError).toBe(true)
    expect(parsed.error).toBe('access_denied')
    expect(parsed.errorDescription).toBe('User denied consent')
  })

  it('returns clean status when no error in callback hash', () => {
    const hash = '#access_token=dummy&expires_in=3600&token_type=bearer'
    const parsed = parseAuthCallbackHash(hash)
    expect(parsed.hasError).toBe(false)
    expect(parsed.error).toBeNull()
  })

  it('handles empty hash gracefully', () => {
    const parsed = parseAuthCallbackHash('')
    expect(parsed.hasError).toBe(false)
    expect(parsed.error).toBeNull()
  })
})
