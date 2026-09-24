import { describe, it, expect, vi } from 'vitest'
import { authGuard } from '../app/middleware/auth'

describe('Auth Middleware Guard', () => {
  it('redirects unauthenticated users trying to access /protected to /', () => {
    const to = { path: '/protected' } as any
    const from = { path: '/' } as any
    const mockNavigateTo = vi.fn().mockImplementation((path) => path)

    const result = authGuard(to, from, false, mockNavigateTo)
    expect(mockNavigateTo).toHaveBeenCalledWith('/?auth_required=true')
    expect(result).toBe('/?auth_required=true')
  })

  it('allows authenticated users to access /protected without redirection', () => {
    const to = { path: '/protected' } as any
    const from = { path: '/' } as any
    const mockNavigateTo = vi.fn()

    const result = authGuard(to, from, true, mockNavigateTo)
    expect(mockNavigateTo).not.toHaveBeenCalled()
    expect(result).toBeUndefined()
  })

  it('allows unauthenticated users to access public route /', () => {
    const to = { path: '/' } as any
    const from = { path: '/other' } as any
    const mockNavigateTo = vi.fn()

    const result = authGuard(to, from, false, mockNavigateTo)
    expect(mockNavigateTo).not.toHaveBeenCalled()
    expect(result).toBeUndefined()
  })
})
