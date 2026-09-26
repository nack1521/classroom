import http from 'http'
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { GoTrueClient } from '@supabase/auth-js'
import { processAuthCallback } from '../app/utils/auth'
import * as supabaseClientModule from '../app/utils/supabaseClient'
import { useAuth } from '../app/composables/useAuth'

describe('Handoff 006A Diagnostic Case 1: Callback Identity Mismatch (RED contract test)', () => {
  it('RED CONTRACT: rejects callback when PKCE code exchange returns user A but getUser() returns different user B', async () => {
    // Controlled client: exchange establishes session for "user-exchanged-new",
    // but client.auth.getUser() returns pre-existing verified "user-stale-old"
    const client = {
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          data: {
            session: { user: { id: 'user-exchanged-new' } },
            user: { id: 'user-exchanged-new' },
          },
          error: null,
        }),
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { id: 'user-stale-old', email: 'stale@rpr.ac.th' },
          },
          error: null,
        }),
      },
    }

    const callbackUrl = 'http://localhost:3000/auth/callback?code=mock-synthetic-code'
    const result = await processAuthCallback(client as any, callbackUrl)

    // Contract requirement: Callback MUST fail-closed if exchanged identity does not match verified identity
    // On CURRENT source: processAuthCallback() does NOT compare IDs and returns { success: true, user: { id: 'user-stale-old' } }
    // DIAGNOSTIC VERDICT: This test FAILS (RED) against current source
    expect(result.success).toBe(false)
    expect(result.user).toBeNull()
  })

  it('POSITIVE CONTROL: accepts callback when PKCE code exchange and getUser() identities match', async () => {
    const client = {
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          data: {
            session: { user: { id: 'user-matching-101' } },
            user: { id: 'user-matching-101' },
          },
          error: null,
        }),
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { id: 'user-matching-101', email: 'matching101@rpr.ac.th' },
          },
          error: null,
        }),
      },
    }

    const callbackUrl = 'http://localhost:3000/auth/callback?code=mock-synthetic-code'
    const result = await processAuthCallback(client as any, callbackUrl)

    expect(result.success).toBe(true)
    expect(result.user?.id).toBe('user-matching-101')
  })

  it('RED CONTRACT: rejects hash callback when setSession() returns user A but getUser() returns different user B', async () => {
    const client = {
      auth: {
        setSession: vi.fn().mockResolvedValue({
          data: {
            session: { user: { id: 'user-hash-new' } },
            user: { id: 'user-hash-new' },
          },
          error: null,
        }),
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { id: 'user-stale-old', email: 'stale@rpr.ac.th' },
          },
          error: null,
        }),
      },
    }

    const hashUrl = 'http://localhost:3000/auth/callback#access_token=synthetic-access&refresh_token=synthetic-refresh'
    const result = await processAuthCallback(client as any, hashUrl)

    // Contract requirement: Hash callback MUST fail-closed if token session identity does not match verified identity
    // On CURRENT source: processAuthCallback() returns { success: true, user: { id: 'user-stale-old' } }
    // DIAGNOSTIC VERDICT: This test FAILS (RED) against current source
    expect(result.success).toBe(false)
    expect(result.user).toBeNull()
  })

  it('POSITIVE CONTROL: accepts hash callback when setSession() and getUser() identities match', async () => {
    const client = {
      auth: {
        setSession: vi.fn().mockResolvedValue({
          data: {
            session: { user: { id: 'user-hash-matching' } },
            user: { id: 'user-hash-matching' },
          },
          error: null,
        }),
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { id: 'user-hash-matching', email: 'matching@rpr.ac.th' },
          },
          error: null,
        }),
      },
    }

    const hashUrl = 'http://localhost:3000/auth/callback#access_token=synthetic-access&refresh_token=synthetic-refresh'
    const result = await processAuthCallback(client as any, hashUrl)

    expect(result.success).toBe(true)
    expect(result.user?.id).toBe('user-hash-matching')
  })

  it('RED CONTRACT: rejects callback when exchange returns contradictory session identity or missing ID', async () => {
    const clientContradictory = {
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          data: {
            session: { user: { id: 'session-user-id' } },
            user: { id: 'different-response-user-id' },
          },
          error: null,
        }),
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { id: 'session-user-id', email: 'user@rpr.ac.th' },
          },
          error: null,
        }),
      },
    }

    const callbackUrl = 'http://localhost:3000/auth/callback?code=mock-synthetic-code'
    const result = await processAuthCallback(clientContradictory as any, callbackUrl)

    expect(result.success).toBe(false)
    expect(result.user).toBeNull()
  })

  it('RED CONTRACT (useAuth): handleCallback() fails closed on identity mismatch, clears pre-existing UI user, and exposes authError without protected continuation', async () => {
    const client = {
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          data: {
            session: { user: { id: 'user-new-exchanged' } },
            user: { id: 'user-new-exchanged' },
          },
          error: null,
        }),
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { id: 'user-stale-old', email: 'stale@rpr.ac.th' },
          },
          error: null,
        }),
      },
    }

    const spy = vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(client as any)

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

    const auth = useAuth()
    // Seed pre-existing UI user
    auth.user.value = {
      id: 'pre-existing-ui-user',
      email: 'preexisting@rpr.ac.th',
      signedIn: true,
      message: 'Signed in',
    }

    const callbackUrl = 'http://localhost:3000/auth/callback?code=mock-synthetic-code'
    const result = await auth.handleCallback(callbackUrl)

    // Contract assertions:
    // 1. Return object must indicate failure and null user
    expect(result.success).toBe(false)
    expect(result.user).toBeNull()

    // 2. Pre-existing UI user must NOT be retained or surfaced as authenticated
    expect(auth.user.value).toBeNull()

    // 3. authError must be set with a safe message (no secrets, codes, or raw IDs)
    expect(auth.authError.value).toBeDefined()
    expect(auth.authError.value).toContain('OAuth session identity could not be verified')
    expect(auth.authError.value).not.toContain('user-new-exchanged')
    expect(auth.authError.value).not.toContain('user-stale-old')
    expect(auth.authError.value).not.toContain('mock-synthetic-code')

    spy.mockRestore()
  })

  // -------------------------------------------------------------------------
  // Handoff 006C.1 Acceptance Matrix: One-Sided Missing ID Tests
  // -------------------------------------------------------------------------

  it('RED CONTRACT (missing ID 1/4): rejects PKCE callback when data.session.user.id is missing even if data.user.id matches verified getUser()', async () => {
    const client = {
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          data: {
            session: { access_token: 'synthetic-access-tok-1' }, // data.session.user.id is missing/absent
            user: { id: 'user-pkce-pop-1' },
          },
          error: null,
        }),
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { id: 'user-pkce-pop-1', email: 'pop1@rpr.ac.th' },
          },
          error: null,
        }),
      },
    }

    const callbackUrl = 'http://localhost:3000/auth/callback?code=mock-pkce-code-1'
    const result = await processAuthCallback(client as any, callbackUrl)

    expect(result.success).toBe(false)
    expect(result.user).toBeNull()
    expect(result.error).toContain('OAuth session identity could not be verified')
    expect(result.error).not.toContain('user-pkce-pop-1')
    expect(result.error).not.toContain('mock-pkce-code-1')
  })

  it('RED CONTRACT (missing ID 2/4): rejects PKCE callback when data.user.id is missing or whitespace even if data.session.user.id matches verified getUser()', async () => {
    const client = {
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          data: {
            session: { user: { id: 'user-pkce-pop-2' } },
            user: { id: '   ' }, // data.user.id is whitespace-only string
          },
          error: null,
        }),
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { id: 'user-pkce-pop-2', email: 'pop2@rpr.ac.th' },
          },
          error: null,
        }),
      },
    }

    const callbackUrl = 'http://localhost:3000/auth/callback?code=mock-pkce-code-2'
    const result = await processAuthCallback(client as any, callbackUrl)

    expect(result.success).toBe(false)
    expect(result.user).toBeNull()
    expect(result.error).toContain('OAuth session identity could not be verified')
    expect(result.error).not.toContain('user-pkce-pop-2')
    expect(result.error).not.toContain('mock-pkce-code-2')
  })

  it('RED CONTRACT (missing ID 3/4): rejects hash callback when data.session.user.id is missing even if data.user.id matches verified getUser()', async () => {
    const client = {
      auth: {
        setSession: vi.fn().mockResolvedValue({
          data: {
            session: { access_token: 'synthetic-hash-access-3', refresh_token: 'synthetic-hash-refresh-3' }, // data.session.user.id is missing/absent
            user: { id: 'user-hash-pop-3' },
          },
          error: null,
        }),
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { id: 'user-hash-pop-3', email: 'pop3@rpr.ac.th' },
          },
          error: null,
        }),
      },
    }

    const hashUrl = 'http://localhost:3000/auth/callback#access_token=synthetic-hash-access-3&refresh_token=synthetic-hash-refresh-3'
    const result = await processAuthCallback(client as any, hashUrl)

    expect(result.success).toBe(false)
    expect(result.user).toBeNull()
    expect(result.error).toContain('OAuth session identity could not be verified')
    expect(result.error).not.toContain('user-hash-pop-3')
    expect(result.error).not.toContain('synthetic-hash-access-3')
  })

  it('RED CONTRACT (missing ID 4/4): rejects hash callback when data.user.id is missing even if data.session.user.id matches verified getUser()', async () => {
    const client = {
      auth: {
        setSession: vi.fn().mockResolvedValue({
          data: {
            session: { user: { id: 'user-hash-pop-4' } },
            user: {}, // data.user.id is absent/missing
          },
          error: null,
        }),
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { id: 'user-hash-pop-4', email: 'pop4@rpr.ac.th' },
          },
          error: null,
        }),
      },
    }

    const hashUrl = 'http://localhost:3000/auth/callback#access_token=synthetic-hash-access-4&refresh_token=synthetic-hash-refresh-4'
    const result = await processAuthCallback(client as any, hashUrl)

    expect(result.success).toBe(false)
    expect(result.user).toBeNull()
    expect(result.error).toContain('OAuth session identity could not be verified')
    expect(result.error).not.toContain('user-hash-pop-4')
    expect(result.error).not.toContain('synthetic-hash-access-4')
  })
})

describe('Handoff 006A Diagnostic Case 2: Remote Sign-Out 500 (SDK Characterization)', () => {
  let stubServer: http.Server
  let stubPort: number
  let stubBaseUrl: string

  beforeAll(async () => {
    stubServer = http.createServer((req, res) => {
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Content-Type': 'application/json',
      }

      if (req.method === 'OPTIONS') {
        res.writeHead(200, corsHeaders)
        res.end()
        return
      }

      if (req.url?.includes('/logout')) {
        res.writeHead(500, corsHeaders)
        res.end(JSON.stringify({ message: 'Internal Server Error on logout' }))
        return
      }
      if (req.url?.includes('/user')) {
        res.writeHead(200, corsHeaders)
        res.end(JSON.stringify({ id: 'sdk-user-1', email: 'sdk1@rpr.ac.th' }))
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
  })

  afterAll(() => {
    stubServer?.close()
  })

  it('SDK CHARACTERIZATION: installed GoTrueClient purges local session and emits SIGNED_OUT despite remote 500 error', async () => {
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

    // Seed session in storage
    const fakeSession = {
      access_token: 'valid-test-token',
      refresh_token: 'valid-refresh-token',
      token_type: 'bearer',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: 'sdk-user-1', email: 'sdk1@rpr.ac.th' },
    }
    mockStorage.setItem('supabase.auth.token', JSON.stringify(fakeSession))

    let capturedEvent: string | null = null
    let capturedSession: any = null
    client.onAuthStateChange((event, session) => {
      capturedEvent = event
      capturedSession = session
    })

    // Establish active session inside GoTrueClient instance
    await client.getUser()

    // Execute signOut against remote 500 endpoint
    const res = await client.signOut()

    // Characterization findings:
    // 1. signOut() reports the remote error
    expect(res.error).toBeDefined()
    expect(res.error?.message).toContain('Internal Server Error on logout')

    // 2. Installed GoTrueClient emits SIGNED_OUT event regardless of remote error
    expect(capturedEvent).toBe('SIGNED_OUT')
    expect(capturedSession).toBeNull()

    // 3. Installed GoTrueClient removes the session from storage and getSession() returns null
    const postSignOutSession = await client.getSession()
    expect(postSignOutSession.data.session).toBeNull()
    expect(mockStorage.getItem('supabase.auth.token')).toBeNull()
  })

  it('RED CONTRACT (useAuth): production useAuth().signOut() against real SDK remote 500 clears local user, navigates to public route, and shows sanitized warning without echoing provider error or claiming local session active', async () => {
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

    // Seed session in storage
    const fakeSession = {
      access_token: 'valid-test-token',
      refresh_token: 'valid-refresh-token',
      token_type: 'bearer',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: 'sdk-user-1', email: 'sdk1@rpr.ac.th' },
    }
    mockStorage.setItem('supabase.auth.token', JSON.stringify(fakeSession))

    let capturedEvent: string | null = null
    client.onAuthStateChange((event) => {
      capturedEvent = event
    })

    // Nuxt globals setup
    ;(globalThis as any).useRuntimeConfig = () => ({
      public: {
        supabaseUrl: stubBaseUrl,
        supabaseKey: 'test-key',
        siteUrl: 'http://localhost:3000',
      },
    })
    const store: Record<string, { value: any }> = {}
    ;(globalThis as any).useState = (k: string, init: () => any) => {
      if (!store[k]) store[k] = { value: init() }
      return store[k]
    }
    const mockNavigateTo = vi.fn()
    ;(globalThis as any).navigateTo = mockNavigateTo

    // Mock client-factory seam so useAuth() uses our real GoTrueClient instance
    const supabaseWrapper = { auth: client }
    const getSupabaseClientSpy = vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(supabaseWrapper as any)

    const auth = useAuth()
    await auth.initAuth()

    // Assert initial state: user is authenticated before sign-out
    expect(auth.user.value?.id).toBe('sdk-user-1')
    expect(auth.user.value?.signedIn).toBe(true)

    // Execute production signOut() against real SDK with remote 500 endpoint
    await auth.signOut()

    // Contract assertions:
    // 1. Local session in storage MUST be removed by the real SDK
    expect(mockStorage.getItem('supabase.auth.token')).toBeNull()
    const sessionAfter = await client.getSession()
    expect(sessionAfter.data.session).toBeNull()

    // 2. Real SDK emitted SIGNED_OUT
    expect(capturedEvent).toBe('SIGNED_OUT')

    // 3. auth.user.value MUST be null (never show signed-in user locally)
    expect(auth.user.value).toBeNull()

    // 4. auth.signOutError.value must be a sanitized generic warning that remote revocation was unconfirmed
    expect(auth.signOutError.value).toBeDefined()
    expect(auth.signOutError.value).toContain('remote revocation was not confirmed')

    // 5. Must NOT echo raw provider/SDK error message
    expect(auth.signOutError.value).not.toContain('Internal Server Error on logout')

    // 6. Must NOT falsely claim local session remains active
    expect(auth.signOutError.value).not.toContain('Local persisted session state may remain active')

    // 7. Must navigate to public route ('/') so error notice is displayed to user
    expect(mockNavigateTo).toHaveBeenCalledWith('/')

    getSupabaseClientSpy.mockRestore()
  })

  it('RED CONTRACT (useAuth): in-flight verification already started cannot restore user state after real-SDK remote-500 sign-out', async () => {
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

    const fakeSession = {
      access_token: 'valid-test-token',
      refresh_token: 'valid-refresh-token',
      token_type: 'bearer',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: 'sdk-user-1', email: 'sdk1@rpr.ac.th' },
    }
    mockStorage.setItem('supabase.auth.token', JSON.stringify(fakeSession))

    let resolveSlowGetUser: (val: any) => void = () => {}
    let getUserCalls = 0
    let slowVerificationStarted = false

    const originalGetUser = client.getUser.bind(client)
    const resolvers: Array<(val: any) => void> = []
    client.getUser = vi.fn(async () => {
      getUserCalls++
      const callNum = getUserCalls
      if (callNum === 1) {
        // initAuth initial check
        return originalGetUser()
      }
      slowVerificationStarted = true
      return new Promise((resolve) => {
        resolvers.push(resolve)
        resolveSlowGetUser = (val: any) => {
          resolvers.forEach((r) => r(val))
        }
      })
    })

    ;(globalThis as any).useRuntimeConfig = () => ({
      public: {
        supabaseUrl: stubBaseUrl,
        supabaseKey: 'test-key',
        siteUrl: 'http://localhost:3000',
      },
    })
    const store: Record<string, { value: any }> = {}
    ;(globalThis as any).useState = (k: string, init: () => any) => {
      if (!store[k]) store[k] = { value: init() }
      return store[k]
    }
    const mockNav = vi.fn()
    ;(globalThis as any).navigateTo = mockNav

    const supabaseWrapper = { auth: client }
    const getSupabaseClientSpy = vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(supabaseWrapper as any)

    const auth = useAuth()
    await auth.initAuth()
    expect(auth.user.value?.id).toBe('sdk-user-1')

    // Trigger an in-flight verification via checkVerifiedUser (starts and pauses)
    const inFlightPromise = auth.checkVerifiedUser()
    expect(slowVerificationStarted).toBe(true)

    // While in-flight verification is waiting, invoke signOut() against remote 500
    await auth.signOut()
    expect(auth.user.value).toBeNull()

    // Now resolve the in-flight verification with a user object
    resolveSlowGetUser({
      data: { user: { id: 'sdk-user-resurrected', email: 'resurrected@rpr.ac.th' } },
      error: null,
    })
    await inFlightPromise

    // Allow any queued microtasks to settle
    await new Promise((r) => setTimeout(r, 20))

    // State MUST NOT be overwritten or restored!
    expect(auth.user.value).toBeNull()

    getSupabaseClientSpy.mockRestore()
  })
})

describe('Handoff 006A Diagnostic Case 3: Unsafe Error Reflection (RED contract test)', () => {
  const QUERY_MARKER = 'MARKER_QUERY_SECRET_ABC'
  const HASH_MARKER = 'MARKER_HASH_SECRET_DEF'
  const CODE_MARKER = 'MARKER_CODE_SECRET_XYZ'
  const EXCHANGE_MARKER = 'MARKER_EXCHANGE_SECRET_GHI'
  const SETSESSION_MARKER = 'MARKER_SETSESSION_SECRET_MNO'
  const GETUSER_MARKER = 'MARKER_GETUSER_SECRET_JKL'
  const GETUSER_THROW_MARKER = 'MARKER_GETUSER_THROW_PQR'
  const EXCHANGE_THROW_MARKER = 'MARKER_EXCHANGE_THROW_STU'
  const SETSESSION_THROW_MARKER = 'MARKER_SETSESSION_THROW_VWX'
  const APP_PROVIDER_MARKER = 'MARKER_APP_PROVIDER_AAA'
  const APP_SDK_MARKER = 'MARKER_APP_SDK_BBB'

  it('RED CONTRACT: processAuthCallback() does not reflect raw provider error_description from query string', async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    }

    const callbackUrl = `http://localhost:3000/auth/callback?error=access_denied&error_description=Denied+with+${QUERY_MARKER}`
    const result = await processAuthCallback(client as any, callbackUrl)

    expect(result.success).toBe(false)
    expect(result.user).toBeNull()
    // Contract requirement: user-facing error message must not reflect raw unscrubbed provider error_description
    // Uses boolean comparison to prevent leaking synthetic marker in Vitest failure diff output
    expect(result.error?.includes(QUERY_MARKER)).toBe(false)
  })

  it('RED CONTRACT: processAuthCallback() does not reflect raw provider error_description from hash fragment', async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    }

    const callbackUrl = `http://localhost:3000/auth/callback#error=interaction_required&error_description=Required+with+${HASH_MARKER}`
    const result = await processAuthCallback(client as any, callbackUrl)

    expect(result.success).toBe(false)
    expect(result.user).toBeNull()
    expect(result.error?.includes(HASH_MARKER)).toBe(false)
  })

  it('RED CONTRACT: processAuthCallback() does not reflect raw unrecognized provider error code and preserves denial priority', async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'pre-existing-user' } }, error: null }),
      },
    }

    const callbackUrl = `http://localhost:3000/auth/callback?error=${CODE_MARKER}`
    const result = await processAuthCallback(client as any, callbackUrl)

    expect(result.success).toBe(false)
    expect(result.user).toBeNull()
    expect(client.auth.getUser).not.toHaveBeenCalled()
    expect(result.error?.includes(CODE_MARKER)).toBe(false)
  })

  it('RED CONTRACT: processAuthCallback() does not reflect raw SDK exchange error message', async () => {
    const client = {
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          data: { session: null, user: null },
          error: new Error(`Internal exchange failure: ${EXCHANGE_MARKER}`),
        }),
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    }

    const callbackUrl = 'http://localhost:3000/auth/callback?code=mock-code'
    const result = await processAuthCallback(client as any, callbackUrl)

    expect(result.success).toBe(false)
    expect(result.user).toBeNull()
    expect(result.error?.includes(EXCHANGE_MARKER)).toBe(false)
  })

  it('RED CONTRACT: processAuthCallback() does not reflect raw SDK setSession error message', async () => {
    const client = {
      auth: {
        setSession: vi.fn().mockResolvedValue({
          data: { session: null, user: null },
          error: new Error(`Internal setSession failure: ${SETSESSION_MARKER}`),
        }),
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    }

    const callbackUrl = 'http://localhost:3000/auth/callback#access_token=synthetic-access&refresh_token=synthetic-refresh'
    const result = await processAuthCallback(client as any, callbackUrl)

    expect(result.success).toBe(false)
    expect(result.user).toBeNull()
    expect(result.error?.includes(SETSESSION_MARKER)).toBe(false)
  })

  it('RED CONTRACT: processAuthCallback() does not reflect raw SDK getUser error message', async () => {
    const client = {
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          data: {
            session: { user: { id: 'new-user' } },
            user: { id: 'new-user' },
          },
          error: null,
        }),
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new Error(`Internal getUser failure: ${GETUSER_MARKER}`),
        }),
      },
    }

    const callbackUrl = 'http://localhost:3000/auth/callback?code=mock-code'
    const result = await processAuthCallback(client as any, callbackUrl)

    expect(result.success).toBe(false)
    expect(result.user).toBeNull()
    expect(result.error?.includes(GETUSER_MARKER)).toBe(false)
  })

  it('RED CONTRACT: processAuthCallback() does not reflect raw SDK getUser thrown error message', async () => {
    const client = {
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          data: {
            session: { user: { id: 'new-user' } },
            user: { id: 'new-user' },
          },
          error: null,
        }),
        getUser: vi.fn().mockRejectedValue(new Error(`Internal getUser thrown crash: ${GETUSER_THROW_MARKER}`)),
      },
    }

    const callbackUrl = 'http://localhost:3000/auth/callback?code=mock-code'
    const result = await processAuthCallback(client as any, callbackUrl)

    expect(result.success).toBe(false)
    expect(result.user).toBeNull()
    expect(result.error?.includes(GETUSER_THROW_MARKER)).toBe(false)
  })

  it('RED CONTRACT: processAuthCallback() safely catches thrown exception from exchangeCodeForSession', async () => {
    const client = {
      auth: {
        exchangeCodeForSession: vi.fn().mockRejectedValue(new Error(`Fatal PKCE network crash: ${EXCHANGE_THROW_MARKER}`)),
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    }

    const callbackUrl = 'http://localhost:3000/auth/callback?code=mock-code'
    const result = await processAuthCallback(client as any, callbackUrl).catch((err) => ({ threw: true, err }))

    expect((result as any).threw).toBeUndefined()
    expect(result.success).toBe(false)
    expect(result.user).toBeNull()
    expect(result.error?.includes(EXCHANGE_THROW_MARKER)).toBe(false)
  })

  it('RED CONTRACT: processAuthCallback() safely catches thrown exception from setSession', async () => {
    const client = {
      auth: {
        setSession: vi.fn().mockRejectedValue(new Error(`Fatal setSession storage crash: ${SETSESSION_THROW_MARKER}`)),
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    }

    const callbackUrl = 'http://localhost:3000/auth/callback#access_token=tok&refresh_token=ref'
    const result = await processAuthCallback(client as any, callbackUrl).catch((err) => ({ threw: true, err }))

    expect((result as any).threw).toBeUndefined()
    expect(result.success).toBe(false)
    expect(result.user).toBeNull()
    expect(result.error?.includes(SETSESSION_THROW_MARKER)).toBe(false)
  })

  it('RED CONTRACT (useAuth): handleCallback() fails closed with safe authError and clears pre-existing UI user on provider error', async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    }

    const spy = vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(client as any)

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

    const auth = useAuth()
    auth.user.value = {
      id: 'pre-existing-ui-user',
      email: 'preexisting@rpr.ac.th',
      signedIn: true,
      message: 'Signed in',
    }

    const callbackUrl = `http://localhost:3000/auth/callback?error=server_error&error_description=Marked+leak+${APP_PROVIDER_MARKER}`
    const result = await auth.handleCallback(callbackUrl)

    expect(result.success).toBe(false)
    expect(result.user).toBeNull()
    expect(auth.user.value).toBeNull()
    expect(auth.authError.value?.includes(APP_PROVIDER_MARKER)).toBe(false)
    expect(result.error?.includes(APP_PROVIDER_MARKER)).toBe(false)

    spy.mockRestore()
  })

  it('RED CONTRACT (useAuth): handleCallback() fails closed with safe authError and clears pre-existing UI user on SDK exchange failure', async () => {
    const client = {
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          data: { session: null, user: null },
          error: new Error(`Internal SDK crash: ${APP_SDK_MARKER}`),
        }),
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    }

    const spy = vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(client as any)

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

    const auth = useAuth()
    auth.user.value = {
      id: 'pre-existing-ui-user',
      email: 'preexisting@rpr.ac.th',
      signedIn: true,
      message: 'Signed in',
    }

    const callbackUrl = 'http://localhost:3000/auth/callback?code=mock-code'
    const result = await auth.handleCallback(callbackUrl)

    expect(result.success).toBe(false)
    expect(result.user).toBeNull()
    expect(auth.user.value).toBeNull()
    expect(auth.authError.value?.includes(APP_SDK_MARKER)).toBe(false)
    expect(result.error?.includes(APP_SDK_MARKER)).toBe(false)

    spy.mockRestore()
  })

  it('POSITIVE CONTROL: provider error access_denied produces actionable safe category without leaking description', async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    }

    const callbackUrl = 'http://localhost:3000/auth/callback?error=access_denied&error_description=User+cancelled'
    const result = await processAuthCallback(client as any, callbackUrl)

    expect(result.success).toBe(false)
    expect(result.user).toBeNull()
    expect(result.error).toContain('access_denied')
  })

  it('POSITIVE CONTROL: provider error interaction_required produces actionable safe retry category without leaking description', async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    }

    const callbackUrl = 'http://localhost:3000/auth/callback#error=interaction_required&error_description=Re-authentication+required'
    const result = await processAuthCallback(client as any, callbackUrl)

    expect(result.success).toBe(false)
    expect(result.user).toBeNull()
    expect(result.error).toContain('interaction_required')
  })
})
