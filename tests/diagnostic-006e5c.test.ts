import http from 'http'
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { GoTrueClient } from '@supabase/supabase-js'
import * as supabaseClientModule from '../app/utils/supabaseClient'
import { authMiddlewareHandler } from '../app/middleware/auth'
import { useAuth } from '../app/composables/useAuth'
import { inspectLocalSessionState } from '../app/utils/auth'

/**
 * Handoff 006E5C / 006F: Failure-Boundary and Cleanup-Exception Diagnostic
 *
 * Core Question:
 * After a callback's SDK exchange/setup has established or possibly changed local state,
 * can a failed verification plus a failed/unknown local cleanup leave a later /protected
 * visit admitting an ambiguous identity?
 *
 * Stress-Suite Accounting (Handoff 006F):
 * All five deliberately fault-injected RED tests are preserved intact and runnable with:
 *   GATE0_STRESS=1 npx vitest run tests/diagnostic-006e5c.test.ts
 * In default test profiles (npm run test), these five cases are skipped so the suite reflects
 * supported integrations, while the four controls always run and pass.
 *
 * DO NOT EDIT PRODUCTION CODE.
 */

const itStress = process.env.GATE0_STRESS ? it : it.skip

describe('Handoff 006E5C / 006F: Failure-Boundary and Cleanup-Exception Diagnostic', () => {
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
        req.on('data', (chunk) => { body += chunk })
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
          // Subsequent calls: return user-B so mismatch occurs.
          tokenUserCalls++
          if (tokenUserCalls === 1) {
            res.writeHead(200, corsHeaders)
            res.end(JSON.stringify({ id: 'user-A', email: 'userA@rpr.ac.th' }))
          } else {
            res.writeHead(200, corsHeaders)
            res.end(JSON.stringify({ id: 'user-B', email: 'userB@rpr.ac.th' }))
          }
        } else if (authHeader === 'Bearer token-matching-user-a') {
          res.writeHead(200, corsHeaders)
          res.end(JSON.stringify({ id: 'user-A', email: 'userA@rpr.ac.th' }))
        } else if (authHeader === 'Bearer valid-older-token') {
          res.writeHead(200, corsHeaders)
          res.end(JSON.stringify({ id: 'user-older-101', email: 'older101@rpr.ac.th' }))
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
  // SECTION 1: POLICY STRESS CASES (RUNNABLE VIA GATE0_STRESS=1)
  // =========================================================================

  itStress('Case A1 (PKCE — Policy Stress): local signOut throws before cleanup; storage remains present and route middleware fails open on unchanged code', async () => {
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

    // Explicitly compare storage before
    const stateBefore = await inspectLocalSessionState(client)
    expect(stateBefore).toBe('confirmed_absent')
    expect(Object.keys(storageMap).length).toBe(0)

    // Inject failure: signOut throws before completing local removal
    const signOutSpy = vi.spyOn(client, 'signOut').mockRejectedValue(
      new Error('Synthetic SDK storage lock / cleanup exception')
    )
    const supabaseWrapper = { auth: client }
    const getClientSpy = vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(supabaseWrapper as any)

    try {
      const store: Record<string, { value: any }> = {}
      ;(globalThis as any).useState = (key: string, init: () => any) => {
        if (!store[key]) store[key] = { value: init() }
        return store[key]
      }
      const mockRedirectFn = vi.fn((path: string) => path)
      ;(globalThis as any).navigateTo = mockRedirectFn

      const auth = useAuth()

      // Run mismatched callback: code exchange establishes session, then getUser resolves User B
      await auth.handleCallback('http://localhost:3000/auth/callback?code=mismatch-code-1')

      // Callback fails closed on mismatch
      expect(auth.authError.value).toBe('Authentication failed: OAuth session identity could not be verified.')
      expect(auth.user.value).toBeNull()

      // Explicitly compare storage after:
      // Because signOut threw, local removal did NOT happen.
      const stateAfter = await inspectLocalSessionState(client)
      expect(stateAfter).toBe('confirmed_present')
      expect(Object.keys(storageMap).length).toBeGreaterThan(0)

      // Later deliberate /protected navigation:
      const to = { path: '/protected' } as any
      const from = { path: '/' } as any
      const guardResult = await authMiddlewareHandler(to, from, auth, mockRedirectFn)

      // Gate 0 Policy Contract:
      // Under fail-closed policy, ambiguous session MUST be rejected and redirected.
      // On unchanged code, this assertion FAILS RED (received undefined, admitted user-B):
      expect(guardResult).toBe('/?auth_required=true')
      expect(auth.user.value?.signedIn).toBeFalsy()
    } finally {
      signOutSpy.mockRestore()
      getClientSpy.mockRestore()
    }
  })

  itStress('Case A2 (Token/Hash — Policy Stress): local signOut throws before cleanup; storage remains present and route middleware fails open on unchanged code', async () => {
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

    const stateBefore = await inspectLocalSessionState(client)
    expect(stateBefore).toBe('confirmed_absent')

    const signOutSpy = vi.spyOn(client, 'signOut').mockRejectedValue(
      new Error('Synthetic SDK storage lock / cleanup exception')
    )
    const supabaseWrapper = { auth: client }
    const getClientSpy = vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(supabaseWrapper as any)

    try {
      const store: Record<string, { value: any }> = {}
      ;(globalThis as any).useState = (key: string, init: () => any) => {
        if (!store[key]) store[key] = { value: init() }
        return store[key]
      }
      const mockRedirectFn = vi.fn((path: string) => path)
      ;(globalThis as any).navigateTo = mockRedirectFn

      const auth = useAuth()

      // Run token callback
      await auth.handleCallback(`http://localhost:3000/auth/callback#access_token=${syntheticJwtUserA}&refresh_token=refresh-a&token_type=bearer`)

      expect(auth.authError.value).toBe('Authentication failed: OAuth session identity could not be verified.')
      expect(auth.user.value).toBeNull()

      const stateAfter = await inspectLocalSessionState(client)
      expect(stateAfter).toBe('confirmed_present')

      // Deliberate /protected visit
      const to = { path: '/protected' } as any
      const from = { path: '/' } as any
      const guardResult = await authMiddlewareHandler(to, from, auth, mockRedirectFn)

      // Expected RED Policy Contract:
      expect(guardResult).toBe('/?auth_required=true')
      expect(auth.user.value?.signedIn).toBeFalsy()
    } finally {
      signOutSpy.mockRestore()
      getClientSpy.mockRestore()
    }
  })

  itStress('Case B1 (Method Absent — Policy Stress): signOut method unavailable on client; storage remains present and route middleware fails open on unchanged code', async () => {
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

    const stateBefore = await inspectLocalSessionState(client)
    expect(stateBefore).toBe('confirmed_absent')

    // Create client wrapper where signOut is absent/undefined
    const clientWithoutSignOut = {
      auth: {
        exchangeCodeForSession: (code: string) => client.exchangeCodeForSession(code),
        setSession: (tokens: any) => client.setSession(tokens),
        getUser: () => client.getUser(),
        getSession: () => client.getSession(),
        signOut: undefined, // Method absent
      },
    }

    const getClientSpy = vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(clientWithoutSignOut as any)

    try {
      const store: Record<string, { value: any }> = {}
      ;(globalThis as any).useState = (key: string, init: () => any) => {
        if (!store[key]) store[key] = { value: init() }
        return store[key]
      }
      const mockRedirectFn = vi.fn((path: string) => path)
      ;(globalThis as any).navigateTo = mockRedirectFn

      const auth = useAuth()

      await auth.handleCallback('http://localhost:3000/auth/callback?code=mismatch-code-1')

      // Callback fails closed
      expect(auth.authError.value).toBe('Authentication failed: OAuth session identity could not be verified.')
      expect(auth.user.value).toBeNull()

      // Storage remains present because client had no signOut method
      const stateAfter = await inspectLocalSessionState(client)
      expect(stateAfter).toBe('confirmed_present')

      // Deliberate /protected visit
      const to = { path: '/protected' } as any
      const from = { path: '/' } as any
      const guardResult = await authMiddlewareHandler(to, from, auth, mockRedirectFn)

      // Expected RED Policy Contract:
      expect(guardResult).toBe('/?auth_required=true')
      expect(auth.user.value?.signedIn).toBeFalsy()
    } finally {
      getClientSpy.mockRestore()
    }
  })

  itStress('Case C1 (PKCE — Policy Stress): incomplete SDK exchange response after simulated storage change leaves session unquarantined and route fails open on unchanged code', async () => {
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

    const stateBefore = await inspectLocalSessionState(client)
    expect(stateBefore).toBe('confirmed_absent')

    // Simulate an SDK exchange that writes to storage, but returns an incomplete/null session response
    const exchangeSpy = vi.spyOn(client, 'exchangeCodeForSession').mockImplementation(async (_code: string) => {
      // Simulate underlying storage write:
      mockStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'token-mismatch-user-a',
        refresh_token: 'refresh-mismatch-user-a',
        token_type: 'bearer',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: 'user-A', email: 'userA@rpr.ac.th' },
      }))
      // Returns incomplete response:
      return { data: { session: null, user: null }, error: null } as any
    })

    const supabaseWrapper = { auth: client }
    const getClientSpy = vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(supabaseWrapper as any)

    try {
      const store: Record<string, { value: any }> = {}
      ;(globalThis as any).useState = (key: string, init: () => any) => {
        if (!store[key]) store[key] = { value: init() }
        return store[key]
      }
      const mockRedirectFn = vi.fn((path: string) => path)
      ;(globalThis as any).navigateTo = mockRedirectFn

      const auth = useAuth()

      await auth.handleCallback('http://localhost:3000/auth/callback?code=incomplete-code')

      // Callback fails closed on incomplete session
      expect(auth.authError.value).toBe('OAuth code exchange did not return a valid authenticated session.')
      expect(auth.user.value).toBeNull()

      // Storage remains present because lines 492-498 return without quarantine:
      const stateAfter = await inspectLocalSessionState(client)
      expect(stateAfter).toBe('confirmed_present')

      // Deliberate /protected visit
      const to = { path: '/protected' } as any
      const from = { path: '/' } as any
      const guardResult = await authMiddlewareHandler(to, from, auth, mockRedirectFn)

      // Expected RED Policy Contract:
      expect(guardResult).toBe('/?auth_required=true')
      expect(auth.user.value?.signedIn).toBeFalsy()
    } finally {
      exchangeSpy.mockRestore()
      getClientSpy.mockRestore()
    }
  })

  itStress('Case C2 (Token/Hash — Policy Stress): incomplete SDK setSession response after simulated storage change leaves session unquarantined and route fails open on unchanged code', async () => {
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

    const stateBefore = await inspectLocalSessionState(client)
    expect(stateBefore).toBe('confirmed_absent')

    const setSessionSpy = vi.spyOn(client, 'setSession').mockImplementation(async (_tokens: any) => {
      // Simulate storage mutation
      mockStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'token-mismatch-user-a',
        refresh_token: 'refresh-mismatch-user-a',
        token_type: 'bearer',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: 'user-A', email: 'userA@rpr.ac.th' },
      }))
      return { data: { session: null, user: null }, error: null } as any
    })

    const supabaseWrapper = { auth: client }
    const getClientSpy = vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(supabaseWrapper as any)

    try {
      const store: Record<string, { value: any }> = {}
      ;(globalThis as any).useState = (key: string, init: () => any) => {
        if (!store[key]) store[key] = { value: init() }
        return store[key]
      }
      const mockRedirectFn = vi.fn((path: string) => path)
      ;(globalThis as any).navigateTo = mockRedirectFn

      const auth = useAuth()

      await auth.handleCallback(`http://localhost:3000/auth/callback#access_token=${syntheticJwtUserA}&refresh_token=refresh-a&token_type=bearer`)

      expect(auth.authError.value).toBe('OAuth token setup did not return a valid authenticated session.')
      expect(auth.user.value).toBeNull()

      const stateAfter = await inspectLocalSessionState(client)
      expect(stateAfter).toBe('confirmed_present')

      // Deliberate /protected visit
      const to = { path: '/protected' } as any
      const from = { path: '/' } as any
      const guardResult = await authMiddlewareHandler(to, from, auth, mockRedirectFn)

      // Expected RED Policy Contract:
      expect(guardResult).toBe('/?auth_required=true')
      expect(auth.user.value?.signedIn).toBeFalsy()
    } finally {
      setSessionSpy.mockRestore()
      getClientSpy.mockRestore()
    }
  })

  // =========================================================================
  // SECTION 2: PASSING CONTROLS (ALWAYS RUN)
  // =========================================================================

  it('Control 1 (Handled Remote 500 on Local Sign-Out): real-SDK signOut({ scope: "local" }) removes session from storage even when remote returns 500, and route redirects', async () => {
    const storageMap: Record<string, string> = {}
    const mockStorage = {
      getItem: (k: string) => storageMap[k] || null,
      setItem: (k: string, v: string) => { storageMap[k] = v },
      removeItem: (k: string) => { delete storageMap[k] },
    }

    const client = new GoTrueClient({
      url: `${stubBaseUrl}/remote-500`,
      storage: mockStorage,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    })

    // Seed session in storage directly
    mockStorage.setItem('supabase.auth.token', JSON.stringify({
      access_token: 'token-mismatch-user-a',
      refresh_token: 'refresh-mismatch-user-a',
      token_type: 'bearer',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: 'user-A', email: 'userA@rpr.ac.th' },
    }))

    const stateBefore = await inspectLocalSessionState(client)
    expect(stateBefore).toBe('confirmed_present')

    // Call real SDK signOut({ scope: 'local' }) against endpoint that responds 500
    const res = await client.signOut({ scope: 'local' })
    expect(res.error).toBeDefined()

    // Real SDK GoTrueClient._signOut cleans up storage despite remote 500:
    const stateAfter = await inspectLocalSessionState(client)
    expect(stateAfter).toBe('confirmed_absent')

    const supabaseWrapper = { auth: client }
    const getClientSpy = vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(supabaseWrapper as any)

    try {
      const store: Record<string, { value: any }> = {}
      ;(globalThis as any).useState = (key: string, init: () => any) => {
        if (!store[key]) store[key] = { value: init() }
        return store[key]
      }
      const mockRedirectFn = vi.fn((path: string) => path)
      ;(globalThis as any).navigateTo = mockRedirectFn

      const auth = useAuth()
      auth.user.value = null

      const to = { path: '/protected' } as any
      const from = { path: '/' } as any
      const guardResult = await authMiddlewareHandler(to, from, auth, mockRedirectFn)
      expect(guardResult).toBe('/?auth_required=true')
    } finally {
      getClientSpy.mockRestore()
    }
  })

  it('Control 2 (Policy Distinction — Older Session + access_denied): pre-establishment denial does not wipe older valid session, and route re-verifies and admits older session', async () => {
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

    // Seed older session into storage
    mockStorage.setItem('supabase.auth.token', JSON.stringify({
      access_token: 'valid-older-token',
      refresh_token: 'refresh-older-101',
      token_type: 'bearer',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: 'user-older-101', email: 'older101@rpr.ac.th' },
    }))

    const supabaseWrapper = { auth: client }
    const getClientSpy = vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(supabaseWrapper as any)

    try {
      const store: Record<string, { value: any }> = {}
      ;(globalThis as any).useState = (key: string, init: () => any) => {
        if (!store[key]) store[key] = { value: init() }
        return store[key]
      }
      const mockRedirectFn = vi.fn()
      ;(globalThis as any).navigateTo = mockRedirectFn

      const auth = useAuth()

      // Initial verification verifies older user
      await auth.checkVerifiedUser()
      expect(auth.user.value?.id).toBe('user-older-101')

      const stateBefore = await inspectLocalSessionState(client)
      expect(stateBefore).toBe('confirmed_present')

      // Callback with access_denied
      await auth.handleCallback('http://localhost:3000/auth/callback?error=access_denied&error_description=User+cancelled')

      expect(auth.authError.value).toBe('OAuth sign-in was denied (access_denied). Please verify permissions and try again.')

      // Older session preserved in storage
      const stateAfter = await inspectLocalSessionState(client)
      expect(stateAfter).toBe('confirmed_present')

      // Deliberate /protected navigation re-verifies and admits older session
      const to = { path: '/protected' } as any
      const from = { path: '/' } as any
      const guardResult = await authMiddlewareHandler(to, from, auth, mockRedirectFn)
      expect(guardResult).toBeUndefined()
      expect(auth.user.value?.id).toBe('user-older-101')
      expect(auth.user.value?.email).toBe('older101@rpr.ac.th')
    } finally {
      getClientSpy.mockRestore()
    }
  })

  it('Control 3 (Incomplete Response with NO New Persistence): incomplete response with no storage change preserves older valid session', async () => {
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

    // Seed older session
    mockStorage.setItem('supabase.auth.token', JSON.stringify({
      access_token: 'valid-older-token',
      refresh_token: 'refresh-older-101',
      token_type: 'bearer',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: 'user-older-101', email: 'older101@rpr.ac.th' },
    }))

    const supabaseWrapper = { auth: client }
    const getClientSpy = vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(supabaseWrapper as any)

    try {
      const store: Record<string, { value: any }> = {}
      ;(globalThis as any).useState = (key: string, init: () => any) => {
        if (!store[key]) store[key] = { value: init() }
        return store[key]
      }
      const mockRedirectFn = vi.fn()
      ;(globalThis as any).navigateTo = mockRedirectFn

      const auth = useAuth()
      await auth.checkVerifiedUser()
      expect(auth.user.value?.id).toBe('user-older-101')

      const stateBefore = await inspectLocalSessionState(client)
      expect(stateBefore).toBe('confirmed_present')

      // Mock exchange that fails before changing storage (returns null data, no storage write)
      const exchangeSpy = vi.spyOn(client, 'exchangeCodeForSession').mockResolvedValue({
        data: { session: null, user: null },
        error: null,
      } as any)

      try {
        await auth.handleCallback('http://localhost:3000/auth/callback?code=incomplete-no-change')

        // Callback fails safely
        expect(auth.authError.value).toBe('OAuth code exchange did not return a valid authenticated session.')

        // Older session remains untouched in storage
        const stateAfter = await inspectLocalSessionState(client)
        expect(stateAfter).toBe('confirmed_present')

        // Deliberate /protected navigation preserves and admits older valid login
        const to = { path: '/protected' } as any
        const from = { path: '/' } as any
        const guardResult = await authMiddlewareHandler(to, from, auth, mockRedirectFn)
        expect(guardResult).toBeUndefined()
        expect(auth.user.value?.id).toBe('user-older-101')
        expect(auth.user.value?.email).toBe('older101@rpr.ac.th')
      } finally {
        exchangeSpy.mockRestore()
      }
    } finally {
      getClientSpy.mockRestore()
    }
  })

  it('Control 4 (Local Session State Inspection Classification): strictly classifies present, absent, and unknown', async () => {
    // 4a. Present
    const clientPresent = {
      getSession: async () => ({ data: { session: { access_token: 'tok' } }, error: null }),
    }
    expect(await inspectLocalSessionState(clientPresent as any)).toBe('confirmed_present')

    // 4b. Absent
    const clientAbsent = {
      getSession: async () => ({ data: { session: null }, error: null }),
    }
    expect(await inspectLocalSessionState(clientAbsent as any)).toBe('confirmed_absent')

    // 4c. Unknown on error
    const clientError = {
      getSession: async () => ({ data: null, error: new Error('Storage read error') }),
    }
    expect(await inspectLocalSessionState(clientError as any)).toBe('unknown')

    // 4d. Unknown on thrown exception
    const clientThrow = {
      getSession: async () => { throw new Error('Deadlock or storage exception') },
    }
    expect(await inspectLocalSessionState(clientThrow as any)).toBe('unknown')

    // 4e. Unknown on missing getSession
    expect(await inspectLocalSessionState({} as any)).toBe('unknown')
  })
})
