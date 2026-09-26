import { describe, it, expect, vi } from 'vitest'
import { authMiddlewareHandler } from '../app/middleware/auth'

describe('authMiddlewareHandler Protected Navigation Policy (006E3)', () => {
  it('re-verifies protected SPA navigation even if auth.user.value?.signedIn is cached true, and fails closed when token is revoked', async () => {
    const to = { path: '/protected' } as any
    const from = { path: '/' } as any
    const mockRedirect = vi.fn().mockImplementation((path) => path)

    // Stale cached client state: signedIn was true, but verification now returns null (revoked)
    const checkVerifiedUserMock = vi.fn().mockResolvedValue(null)
    const auth = {
      user: { value: { signedIn: true } },
      isConfigured: true,
      checkVerifiedUser: checkVerifiedUserMock,
    }

    const result = await authMiddlewareHandler(to, from, auth, mockRedirect)

    expect(checkVerifiedUserMock).toHaveBeenCalledTimes(1)
    expect(mockRedirect).toHaveBeenCalledWith('/?auth_required=true')
    expect(result).toBe('/?auth_required=true')
  })

  it('re-verifies protected SPA navigation and allows access when token continues to verify', async () => {
    const to = { path: '/protected' } as any
    const from = { path: '/' } as any
    const mockRedirect = vi.fn()

    const checkVerifiedUserMock = vi.fn().mockResolvedValue({
      signedIn: true,
      email: 'older101@rpr.ac.th',
      id: 'user-older-101',
      message: 'Signed in',
    })
    const auth = {
      user: { value: { signedIn: true } },
      isConfigured: true,
      checkVerifiedUser: checkVerifiedUserMock,
    }

    const result = await authMiddlewareHandler(to, from, auth, mockRedirect)

    expect(checkVerifiedUserMock).toHaveBeenCalledTimes(1)
    expect(mockRedirect).not.toHaveBeenCalled()
    expect(result).toBeUndefined()
  })

  it('fails closed and redirects when unconfigured on protected route', async () => {
    const to = { path: '/protected' } as any
    const from = { path: '/' } as any
    const mockRedirect = vi.fn().mockImplementation((path) => path)

    const checkVerifiedUserMock = vi.fn().mockResolvedValue(null)
    const auth = {
      user: { value: { signedIn: true } },
      isConfigured: false,
      checkVerifiedUser: checkVerifiedUserMock,
    }

    const result = await authMiddlewareHandler(to, from, auth, mockRedirect)

    expect(checkVerifiedUserMock).not.toHaveBeenCalled()
    expect(mockRedirect).toHaveBeenCalledWith('/?auth_required=true')
    expect(result).toBe('/?auth_required=true')
  })

  it('fails closed when checkVerifiedUser throws on protected route', async () => {
    const to = { path: '/protected' } as any
    const from = { path: '/' } as any
    const mockRedirect = vi.fn().mockImplementation((path) => path)

    const checkVerifiedUserMock = vi.fn().mockRejectedValue(new Error('Network error'))
    const auth = {
      user: { value: { signedIn: true } },
      isConfigured: true,
      checkVerifiedUser: checkVerifiedUserMock,
    }

    const result = await authMiddlewareHandler(to, from, auth, mockRedirect)

    expect(checkVerifiedUserMock).toHaveBeenCalledTimes(1)
    expect(mockRedirect).toHaveBeenCalledWith('/?auth_required=true')
    expect(result).toBe('/?auth_required=true')
  })

  it('does not re-verify public routes when user is already cached as signed in', async () => {
    const to = { path: '/' } as any
    const from = { path: '/other' } as any
    const mockRedirect = vi.fn()

    const checkVerifiedUserMock = vi.fn()
    const auth = {
      user: { value: { signedIn: true } },
      isConfigured: true,
      checkVerifiedUser: checkVerifiedUserMock,
    }

    const result = await authMiddlewareHandler(to, from, auth, mockRedirect)

    expect(checkVerifiedUserMock).not.toHaveBeenCalled()
    expect(mockRedirect).not.toHaveBeenCalled()
    expect(result).toBeUndefined()
  })
})
