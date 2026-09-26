import http from 'http'
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { GoTrueClient } from '@supabase/supabase-js'
import * as supabaseClientModule from '../app/utils/supabaseClient'
import { authMiddlewareHandler } from '../app/middleware/auth'
import { useAuth } from '../app/composables/useAuth'
import { inspectLocalSessionState } from '../app/utils/auth'

/**
 * Handoff 006E5B: Ambiguous Callback Identity and Local Quarantine Diagnostic
 *
 * Core Contract:
 * When a new OAuth response has already established an SDK session but its established/verified
 * identity is contradictory, missing, or unverifiable, the callback must fail and the ambiguous
 * locally persisted session must be locally contained/quarantined so it is not admitted on a
 * later deliberate protected SPA navigation or SSR hard reload.
 *
 * Ordinary access_denied before any new session is established must NOT revoke an
 * independently valid older session. Never use default/global sign-out.
 */

describe('Handoff 006E5B: Ambiguous Callback Identity and Local Quarantine Diagnostic', () => {
  let stubServer: http.Server
  let stubPort: number
  let stubBaseUrl: string
  let tokenUserCalls = 0
  let receivedRequests: Array<{ method: string; url: string; authHeader: string | undefined }> = []

  // Synthetic JWT helper for token session setup
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const payloadUserA = Buffer.from(JSON.stringify({ sub: 'user-A', id: 'user-A', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')
  const sig = Buffer.from('sig').toString('base64url')
  const syntheticJwtUserA = `${header}.${payloadUserA}.${sig}`

  beforeAll(async () => {
    stubServer = http.createServer((req, res) => {
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Content-Type': 'application/json',
      }

      if (req.method === 'OPTIONS') {
        res.writeHead(200, corsHeaders)
        res.end()
        return
      }

      const authHeader = req.headers.authorization
      receivedRequests.push({
        method: req.method || 'GET',
        url: req.url || '',
        authHeader,
      })

      if (req.url?.includes('/token')) {
        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', () => {
          let parsed: any = {}
          try {
            parsed = JSON.parse(body)
          } catch {}

          if (parsed.auth_code === 'matching-code-a') {
            res.writeHead(200, corsHeaders)
            res.end(JSON.stringify({
              access_token: 'token-matching-user-a',
              token_type: 'bearer',
              expires_in: 3600,
              refresh_token: 'refresh-matching-user-a',
              user: { id: 'user-A', email: 'userA@rpr.ac.th' },
            }))
          } else {
            // Default mismatch fixture: establishes User A
            res.writeHead(200, corsHeaders)
            res.end(JSON.stringify({
              access_token: 'token-mismatch-user-a',
              token_type: 'bearer',
              expires_in: 3600,
              refresh_token: 'refresh-mismatch-user-a',
              user: { id: 'user-A', email: 'userA@rpr.ac.th' },
            }))
          }
        })
        return
      }

      if (req.url?.includes('/user') || req.url?.includes('/auth/v1/user')) {
        if (authHeader === 'Bearer token-mismatch-user-a') {
          // Contradictory provider identity: token issued for A resolves to User B
          res.writeHead(200, corsHeaders)
          res.end(JSON.stringify({ id: 'user-B', email: 'userB@rpr.ac.th' }))
        } else if (authHeader === `Bearer ${syntheticJwtUserA}`) {
          // Shifting identity for token/hash setup path:
          // Call 1 (inside setSession): returns user-A so setSession establishes User A.
          // Subsequent calls (resolveVerifiedUser & middleware): return user-B so mismatch occurs.
          tokenUserCalls++
          if (tokenUserCalls === 1) {
            res.writeHead(200, corsHeaders)
            res.end(JSON.stringify({ id: 'user-A', email: 'userA@rpr.ac.th' }))
          } else {
            res.writeHead(200, corsHeaders)
            res.end(JSON.stringify({ id: 'user-B', email: 'userB@rpr.ac.th' }))
          }
        } else if (authHeader === 'Bearer token-matching-user-a') {
          // Matching identity: token issued for A resolves to User A
          res.writeHead(200, corsHeaders)
          res.end(JSON.stringify({ id: 'user-A', email: 'userA@rpr.ac.th' }))
        } else if (authHeader === 'Bearer valid-older-token') {
          // Pre-existing valid older session
          res.writeHead(200, corsHeaders)
          res.end(JSON.stringify({ id: 'user-older-101', email: 'older101@rpr.ac.th' }))
        } else if (authHeader === 'Bearer revoked-token') {
          res.writeHead(401, corsHeaders)
          res.end(JSON.stringify({ message: 'Invalid JWT token' }))
        } else {
          res.writeHead(401, corsHeaders)
          res.end(JSON.stringify({ message: 'Unauthorized' }))
        }
        return
      }

      if (req.url?.includes('/logout') || req.url?.includes('/auth/v1/logout')) {
        if (req.url.includes('remote-500')) {
          res.writeHead(500, corsHeaders)
          res.end(JSON.stringify({ message: 'Synthetic remote server error' }))
          return
        }
        res.writeHead(200, corsHeaders)
        res.end('{}')
        return
      }

      res.writeHead(404, corsHeaders)
      res.end(JSON.stringify({ message: 'Not found' }))
    })

    await new Promise<void>((resolve) => {
      stubServer.listen(0, '127.0.0.1', () => {
        const addr = stubServer.address() as any
        stubPort = addr.port
        stubBaseUrl = `http://127.0.0.1:${stubPort}`
        resolve()
      })
    })

    ;(globalThis as any).useRuntimeConfig = () => ({
      public: {
        supabaseUrl: stubBaseUrl,
        supabaseKey: 'test-key',
        siteUrl: 'http://localhost:3000',
      },
    })
  })

  afterAll(() => {
    stubServer?.close()
  })

  beforeEach(() => {
    receivedRequests = []
    tokenUserCalls = 0
  })

  // =========================================================================
  // ROW 1: MISMATCH TARGET (Fail-Closed Policy Contracts)
  // =========================================================================

  it('Row 1 - Contract 1A (PKCE Storage Quarantine Contract): PKCE code exchange with mismatched identity fails callback and quarantines session from SDK storage', async () => {
    const storageMap: Record<string, string> = {}
    const mockStorage = {
      getItem: (k: string) => storageMap[k] || null,
      setItem: (k: string, v: string) => { storageMap[k] = v },
      removeItem: (k: string) => { delete storageMap[k] },
    }

    const client = new GoTrueClient({
      url: stubBaseUrl,
      storage: mockStorage,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    })

    const supabaseWrapper = { auth: client }
    const spy = vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(supabaseWrapper as any)

    try {
      const store: Record<string, { value: any }> = {}
      ;(globalThis as any).useState = (key: string, init: () => any) => {
        if (!store[key]) store[key] = { value: init() }
        return store[key]
      }
      ;(globalThis as any).navigateTo = vi.fn()

      const auth = useAuth()

      // Execute PKCE callback where exchange returns user-A, but getUser returns user-B
      const callbackUrl = 'http://localhost:3000/auth/callback?code=mismatch-code-1'
      const result = await auth.handleCallback(callbackUrl)

      // 1. Immediate callback outcome: fails closed with safe error message
      expect(result.success).toBe(false)
      expect(result.user).toBeNull()
      expect(result.error).toBe('Authentication failed: OAuth session identity could not be verified.')
      expect(auth.authError.value).toBe('Authentication failed: OAuth session identity could not be verified.')
      expect(auth.user.value).toBeNull()

      // 2. Policy Contract: SDK session must be locally contained/quarantined (confirmed_absent)
      // On unchanged code, this FAILS RED because inspectLocalSessionState returns 'confirmed_present'
      const storageState = await inspectLocalSessionState(client)
      expect(storageState).toBe('confirmed_absent')
      expect(storageMap['supabase.auth.token']).toBeUndefined()
    } finally {
      spy.mockRestore()
    }
  })

  it('Row 1 - Contract 1B (PKCE Route Protection Contract): deliberate /protected navigation must reject ambiguous identity and redirect to /?auth_required=true', async () => {
    const storageMap: Record<string, string> = {}
    const mockStorage = {
      getItem: (k: string) => storageMap[k] || null,
      setItem: (k: string, v: string) => { storageMap[k] = v },
      removeItem: (k: string) => { delete storageMap[k] },
    }

    const client = new GoTrueClient({
      url: stubBaseUrl,
      storage: mockStorage,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    })

    const supabaseWrapper = { auth: client }
    const spy = vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(supabaseWrapper as any)

    try {
      const store: Record<string, { value: any }> = {}
      ;(globalThis as any).useState = (key: string, init: () => any) => {
        if (!store[key]) store[key] = { value: init() }
        return store[key]
      }
      const mockRedirectFn = vi.fn((path: string) => path)
      ;(globalThis as any).navigateTo = mockRedirectFn

      const auth = useAuth()

      // 1. Run mismatched callback
      const callbackResult = await auth.handleCallback('http://localhost:3000/auth/callback?code=mismatch-code-1')
      expect(callbackResult.success).toBe(false)
      expect(auth.user.value).toBeNull()

      // 2. Later deliberate /protected navigation through production route middleware
      const to = { path: '/protected' } as any
      const from = { path: '/' } as any

      const guardResult = await authMiddlewareHandler(to, from, auth, mockRedirectFn)

      // POLICY CONTRACT ASSERTION (Docs/GATE0-REMAINING-PLAN.md Row A):
      // "New exchange/setup user A disagrees with verified/persisted B: callback fails and a later
      // deliberate /protected attempt (SPA and hard reload if applicable) must not silently restore
      // either ambiguous identity, even if SDK storage was changed."
      //
      // On unchanged code, this FAILS RED: guardResult is undefined (admitted) and auth.user.value is user-B.
      expect(guardResult).toBe('/?auth_required=true')
      expect(mockRedirectFn).toHaveBeenCalledWith('/?auth_required=true')
      expect(auth.user.value).toBeNull()
    } finally {
      spy.mockRestore()
    }
  })

  it('Row 1 - Contract 1C (Local Scope Non-Global Sign-Out Contract): containment must use local scope and NEVER scope=global', async () => {
    const storageMap: Record<string, string> = {}
    const mockStorage = {
      getItem: (k: string) => storageMap[k] || null,
      setItem: (k: string, v: string) => { storageMap[k] = v },
      removeItem: (k: string) => { delete storageMap[k] },
    }

    const client = new GoTrueClient({
      url: stubBaseUrl,
      storage: mockStorage,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    })

    const supabaseWrapper = { auth: client }
    const spy = vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(supabaseWrapper as any)

    try {
      const store: Record<string, { value: any }> = {}
      ;(globalThis as any).useState = (key: string, init: () => any) => {
        if (!store[key]) store[key] = { value: init() }
        return store[key]
      }
      ;(globalThis as any).navigateTo = vi.fn()

      const auth = useAuth()

      // Run mismatched callback
      await auth.handleCallback('http://localhost:3000/auth/callback?code=mismatch-code-1')

      // Assert that logout request was sent by the client explicitly with scope=local and NEVER scope=global
      const logoutRequests = receivedRequests.filter(r => r.url.includes('/logout'))
      expect(logoutRequests.length).toBeGreaterThan(0)
      for (const req of logoutRequests) {
        expect(req.url).toContain('scope=local')
        expect(req.url).not.toContain('scope=global')
      }
    } finally {
      spy.mockRestore()
    }
  })

  it('Row 1 - Contract 1D (Token/Hash Setup Mismatch Contract): token setup mismatch fails closed, quarantines storage, and rejects /protected', async () => {
    const storageMap: Record<string, string> = {}
    const mockStorage = {
      getItem: (k: string) => storageMap[k] || null,
      setItem: (k: string, v: string) => { storageMap[k] = v },
      removeItem: (k: string) => { delete storageMap[k] },
    }

    const client = new GoTrueClient({
      url: stubBaseUrl,
      storage: mockStorage,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    })

    const supabaseWrapper = { auth: client }
    const spy = vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(supabaseWrapper as any)

    try {
      const store: Record<string, { value: any }> = {}
      ;(globalThis as any).useState = (key: string, init: () => any) => {
        if (!store[key]) store[key] = { value: init() }
        return store[key]
      }
      const mockRedirectFn = vi.fn((path: string) => path)
      ;(globalThis as any).navigateTo = mockRedirectFn

      const auth = useAuth()

      // Synthetic token setup where setSession establishes User A, but subsequent verification returns User B
      const hashCallbackUrl = `http://localhost:3000/auth/callback#access_token=${syntheticJwtUserA}&refresh_token=refresh-user-a&token_type=bearer&expires_in=3600`
      const result = await auth.handleCallback(hashCallbackUrl)

      // 1. Immediate callback fails closed with safe message
      expect(result.success).toBe(false)
      expect(result.user).toBeNull()
      expect(result.error).toBe('Authentication failed: OAuth session identity could not be verified.')
      expect(auth.user.value).toBeNull()

      // 2. Storage must be quarantined (confirmed_absent)
      // On unchanged code, this FAILS RED because storage retains the session
      const storageState = await inspectLocalSessionState(client)
      expect(storageState).toBe('confirmed_absent')

      // 3. Deliberate /protected navigation must be rejected
      const to = { path: '/protected' } as any
      const from = { path: '/' } as any
      const guardResult = await authMiddlewareHandler(to, from, auth, mockRedirectFn)

      expect(guardResult).toBe('/?auth_required=true')
      expect(auth.user.value).toBeNull()
    } finally {
      spy.mockRestore()
    }
  })

  // =========================================================================
  // ROW 2: POSITIVE CONTROL (Matching Identity A)
  // =========================================================================

  it('Row 2 - Positive Control: matching User A on exchange and verification succeeds and allows deliberate /protected navigation', async () => {
    const storageMap: Record<string, string> = {}
    const mockStorage = {
      getItem: (k: string) => storageMap[k] || null,
      setItem: (k: string, v: string) => { storageMap[k] = v },
      removeItem: (k: string) => { delete storageMap[k] },
    }

    const client = new GoTrueClient({
      url: stubBaseUrl,
      storage: mockStorage,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    })

    const supabaseWrapper = { auth: client }
    const spy = vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(supabaseWrapper as any)

    try {
      const store: Record<string, { value: any }> = {}
      ;(globalThis as any).useState = (key: string, init: () => any) => {
        if (!store[key]) store[key] = { value: init() }
        return store[key]
      }
      const mockRedirectFn = vi.fn()
      ;(globalThis as any).navigateTo = mockRedirectFn

      const auth = useAuth()

      // 1. Matching callback execution
      const callbackUrl = 'http://localhost:3000/auth/callback?code=matching-code-a'
      const result = await auth.handleCallback(callbackUrl)

      expect(result.success).toBe(true)
      expect(result.user?.id).toBe('user-A')
      expect(result.user?.email).toBe('userA@rpr.ac.th')
      expect(auth.user.value?.id).toBe('user-A')

      // 2. Storage holds confirmed session
      expect(await inspectLocalSessionState(client)).toBe('confirmed_present')

      // 3. Later deliberate /protected navigation verifies and allows access
      const to = { path: '/protected' } as any
      const from = { path: '/' } as any

      const guardResult = await authMiddlewareHandler(to, from, auth, mockRedirectFn)

      expect(guardResult).toBeUndefined() // Allowed access
      expect(mockRedirectFn).not.toHaveBeenCalled()
      expect(auth.user.value?.signedIn).toBe(true)
      expect(auth.user.value?.id).toBe('user-A')
    } finally {
      spy.mockRestore()
    }
  })

  // =========================================================================
  // ROW 3: POLICY DISTINCTION CONTROL (Older Session B + access_denied)
  // =========================================================================

  it('Row 3 - Policy Distinction Control: access_denied does not wipe older valid session B, and later deliberate /protected navigation re-verifies and admits session B', async () => {
    const storageMap: Record<string, string> = {}
    const mockStorage = {
      getItem: (k: string) => storageMap[k] || null,
      setItem: (k: string, v: string) => { storageMap[k] = v },
      removeItem: (k: string) => { delete storageMap[k] },
    }

    const client = new GoTrueClient({
      url: stubBaseUrl,
      storage: mockStorage,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    })

    // Seed synthetic valid older session B into storage
    const olderSession = {
      access_token: 'valid-older-token',
      refresh_token: 'refresh-older-101',
      token_type: 'bearer',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: 'user-older-101', email: 'older101@rpr.ac.th' },
    }
    mockStorage.setItem('supabase.auth.token', JSON.stringify(olderSession))

    const supabaseWrapper = { auth: client }
    const spy = vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(supabaseWrapper as any)

    try {
      const store: Record<string, { value: any }> = {}
      ;(globalThis as any).useState = (key: string, init: () => any) => {
        if (!store[key]) store[key] = { value: init() }
        return store[key]
      }
      const mockRedirectFn = vi.fn()
      ;(globalThis as any).navigateTo = mockRedirectFn

      const auth = useAuth()

      // 1. Initial verification verifies older user
      await auth.checkVerifiedUser()
      expect(auth.user.value?.id).toBe('user-older-101')

      // 2. User receives access_denied callback on new OAuth attempt
      const deniedUrl = 'http://localhost:3000/auth/callback?error=access_denied&error_description=User+cancelled'
      const result = await auth.handleCallback(deniedUrl)

      expect(result.success).toBe(false)
      expect(result.error).toContain('access_denied')
      expect(auth.user.value).toBeNull() // UI reset to prevent false success banner

      // Policy distinction: older session B is NOT signed out or wiped
      expect(await inspectLocalSessionState(client)).toBe('confirmed_present')
      expect(storageMap['supabase.auth.token']).toBeDefined()

      // Logout endpoint was NOT called
      const logoutRequests = receivedRequests.filter(r => r.url.includes('/logout'))
      expect(logoutRequests.length).toBe(0)

      // 3. Later deliberate /protected navigation re-verifies session B and allows access
      const to = { path: '/protected' } as any
      const from = { path: '/' } as any

      const guardResult = await authMiddlewareHandler(to, from, auth, mockRedirectFn)

      expect(guardResult).toBeUndefined() // Allowed access
      expect(mockRedirectFn).not.toHaveBeenCalled()
      expect(auth.user.value?.signedIn).toBe(true)
      expect(auth.user.value?.id).toBe('user-older-101')
    } finally {
      spy.mockRestore()
    }
  })

  // =========================================================================
  // NEGATIVE CONTROLS
  // =========================================================================

  it('Negative Control 1: Absent session redirects deliberate /protected navigation to /?auth_required=true', async () => {
    const storageMap: Record<string, string> = {}
    const mockStorage = {
      getItem: (k: string) => storageMap[k] || null,
      setItem: (k: string, v: string) => { storageMap[k] = v },
      removeItem: (k: string) => { delete storageMap[k] },
    }

    const client = new GoTrueClient({
      url: stubBaseUrl,
      storage: mockStorage,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    })

    const supabaseWrapper = { auth: client }
    const spy = vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(supabaseWrapper as any)

    try {
      const store: Record<string, { value: any }> = {}
      ;(globalThis as any).useState = (key: string, init: () => any) => {
        if (!store[key]) store[key] = { value: init() }
        return store[key]
      }
      const mockRedirectFn = vi.fn((path: string) => path)
      ;(globalThis as any).navigateTo = mockRedirectFn

      const auth = useAuth()

      const to = { path: '/protected' } as any
      const from = { path: '/' } as any

      const guardResult = await authMiddlewareHandler(to, from, auth, mockRedirectFn)

      expect(guardResult).toBe('/?auth_required=true')
      expect(mockRedirectFn).toHaveBeenCalledWith('/?auth_required=true')
      expect(auth.user.value).toBeNull()
    } finally {
      spy.mockRestore()
    }
  })

  it('Negative Control 2: Revoked session redirects deliberate /protected navigation to /?auth_required=true', async () => {
    const storageMap: Record<string, string> = {}
    const mockStorage = {
      getItem: (k: string) => storageMap[k] || null,
      setItem: (k: string, v: string) => { storageMap[k] = v },
      removeItem: (k: string) => { delete storageMap[k] },
    }

    const client = new GoTrueClient({
      url: stubBaseUrl,
      storage: mockStorage,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    })

    // Seed revoked token that stub rejects with 401
    const revokedSession = {
      access_token: 'revoked-token',
      refresh_token: 'refresh-revoked',
      token_type: 'bearer',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: 'user-revoked', email: 'revoked@rpr.ac.th' },
    }
    mockStorage.setItem('supabase.auth.token', JSON.stringify(revokedSession))

    const supabaseWrapper = { auth: client }
    const spy = vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(supabaseWrapper as any)

    try {
      const store: Record<string, { value: any }> = {}
      ;(globalThis as any).useState = (key: string, init: () => any) => {
        if (!store[key]) store[key] = { value: init() }
        return store[key]
      }
      const mockRedirectFn = vi.fn((path: string) => path)
      ;(globalThis as any).navigateTo = mockRedirectFn

      const auth = useAuth()

      const to = { path: '/protected' } as any
      const from = { path: '/' } as any

      const guardResult = await authMiddlewareHandler(to, from, auth, mockRedirectFn)

      expect(guardResult).toBe('/?auth_required=true')
      expect(mockRedirectFn).toHaveBeenCalledWith('/?auth_required=true')
      expect(auth.user.value).toBeNull()
    } finally {
      spy.mockRestore()
    }
  })

  // =========================================================================
  // SDK ISOLATED LOCAL SIGN-OUT CHARACTERIZATION
  // =========================================================================

  it('SDK Characterization: signOut({ scope: "local" }) removes session from local storage even when remote server returns 500', async () => {
    const storageMap: Record<string, string> = {}
    const mockStorage = {
      getItem: (k: string) => storageMap[k] || null,
      setItem: (k: string, v: string) => { storageMap[k] = v },
      removeItem: (k: string) => { delete storageMap[k] },
    }

    const client = new GoTrueClient({
      url: `${stubBaseUrl}/remote-500`, // triggers 500 on /logout
      storage: mockStorage,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    })

    // Seed session
    const session = {
      access_token: 'token-to-quarantine',
      refresh_token: 'refresh-quarantine',
      token_type: 'bearer',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: 'user-quarantine', email: 'quarantine@rpr.ac.th' },
    }
    mockStorage.setItem('supabase.auth.token', JSON.stringify(session))
    expect(await inspectLocalSessionState(client)).toBe('confirmed_present')

    // Call signOut({ scope: 'local' })
    const { error } = await client.signOut({ scope: 'local' })

    // Remote call failed with 500
    expect(error).not.toBeNull()

    // But local storage was still cleared by the SDK because scope !== 'others'
    expect(await inspectLocalSessionState(client)).toBe('confirmed_absent')
    expect(storageMap['supabase.auth.token']).toBeUndefined()
  })
})
