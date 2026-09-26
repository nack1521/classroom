import http from 'http'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { stringToBase64URL } from '@supabase/ssr'
import {
  parseAuthCallbackUrl,
  resolveVerifiedUser,
  executeSignOut,
  checkRouteAccess,
} from '../app/utils/auth'
import { getSupabaseClient } from '../app/utils/supabaseClient'
import { authGuard, authMiddlewareHandler } from '../app/middleware/auth'
import { useAuth } from '../app/composables/useAuth'

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

describe('REVIEW-001 / REVIEW-003: Request-Scoped Server SSR Cookie & Production Middleware Integration', () => {
  let stubServer: http.Server
  let stubPort: number
  let stubBaseUrl: string

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

      if (req.url?.includes('/auth/v1/user')) {
        const authHeader = req.headers.authorization
        if (authHeader === 'Bearer valid-student-token') {
          res.writeHead(200, corsHeaders)
          res.end(JSON.stringify({ id: 'student-101', email: 'student101@rpr.ac.th' }))
        } else if (authHeader === 'Bearer valid-teacher-token') {
          res.writeHead(200, corsHeaders)
          res.end(JSON.stringify({ id: 'teacher-202', email: 'teacher202@rpr.ac.th' }))
        } else {
          res.writeHead(401, corsHeaders)
          res.end(JSON.stringify({ message: 'Invalid JWT token' }))
        }
      } else {
        res.writeHead(404, corsHeaders)
        res.end(JSON.stringify({ message: 'Not found' }))
      }
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

  function createSupabaseCookieValue(accessToken: string, email: string, id: string) {
    const session = {
      access_token: accessToken,
      refresh_token: 'refresh-' + id,
      token_type: 'bearer',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id, email },
    }
    return 'base64-' + stringToBase64URL(JSON.stringify(session))
  }

  function createH3RequestEvent(cookies: Record<string, string>) {
    const cookieHeader = Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ')
    return {
      node: {
        req: {
          headers: {
            cookie: cookieHeader,
          },
        },
      },
      context: {},
    } as any
  }

  it('allows access to /protected when request has valid cookie session verified by server client through production useAuth composable and middleware', async () => {
    const cookieVal = createSupabaseCookieValue('valid-student-token', 'student101@rpr.ac.th', 'student-101')
    const event = createH3RequestEvent({
      'sb-127-auth-token': cookieVal,
    })

    const store: Record<string, { value: any }> = {}
    ;(globalThis as any).useState = (key: string, init: () => any) => {
      if (!store[key]) {
        store[key] = { value: init() }
      }
      return store[key]
    }

    const auth = useAuth(event)
    const mockNavigateTo = vi.fn()
    const to = { path: '/protected' } as any
    const from = { path: '/' } as any

    const guardResult = await authMiddlewareHandler(to, from, auth, mockNavigateTo)

    expect(mockNavigateTo).not.toHaveBeenCalled()
    expect(guardResult).toBeUndefined() // Allowed access (middleware returns void)
    expect(auth.user.value?.signedIn).toBe(true)
    expect(auth.user.value?.id).toBe('student-101')
    expect(auth.user.value?.email).toBe('student101@rpr.ac.th')
  })

  it('redirects to /?auth_required=true when request has absent session cookie through production useAuth composable and middleware', async () => {
    const event = createH3RequestEvent({}) // No cookies

    const store: Record<string, { value: any }> = {}
    ;(globalThis as any).useState = (key: string, init: () => any) => {
      if (!store[key]) {
        store[key] = { value: init() }
      }
      return store[key]
    }

    const auth = useAuth(event)
    const mockNavigateTo = vi.fn().mockImplementation((path) => path)
    const to = { path: '/protected' } as any
    const from = { path: '/' } as any

    const guardResult = await authMiddlewareHandler(to, from, auth, mockNavigateTo)

    expect(mockNavigateTo).toHaveBeenCalledWith('/?auth_required=true')
    expect(guardResult).toBe('/?auth_required=true')
    expect(auth.user.value).toBeNull()
  })

  it('redirects to /?auth_required=true and denies access when request has forged or invalid cookie through production useAuth composable and middleware', async () => {
    const forgedCookieVal = createSupabaseCookieValue('forged-attacker-token', 'attacker@evil.com', 'attacker')
    const event = createH3RequestEvent({
      'sb-127-auth-token': forgedCookieVal,
    })

    const store: Record<string, { value: any }> = {}
    ;(globalThis as any).useState = (key: string, init: () => any) => {
      if (!store[key]) {
        store[key] = { value: init() }
      }
      return store[key]
    }

    const auth = useAuth(event)
    const mockNavigateTo = vi.fn().mockImplementation((path) => path)
    const to = { path: '/protected' } as any
    const from = { path: '/' } as any

    const guardResult = await authMiddlewareHandler(to, from, auth, mockNavigateTo)

    expect(mockNavigateTo).toHaveBeenCalledWith('/?auth_required=true')
    expect(guardResult).toBe('/?auth_required=true')
    expect(auth.user.value).toBeNull()
  })

  it('proves separate concurrent requests do not share request-scoped clients or identity through production composables', async () => {
    const cookieUserA = createSupabaseCookieValue('valid-student-token', 'student101@rpr.ac.th', 'student-101')
    const cookieUserB = createSupabaseCookieValue('valid-teacher-token', 'teacher202@rpr.ac.th', 'teacher-202')

    const eventUserA = createH3RequestEvent({ 'sb-127-auth-token': cookieUserA })
    const eventUserB = createH3RequestEvent({ 'sb-127-auth-token': cookieUserB })

    const storeA: Record<string, { value: any }> = {}
    const storeB: Record<string, { value: any }> = {}

    let currentStore = storeA
    ;(globalThis as any).useState = (key: string, init: () => any) => {
      if (!currentStore[key]) {
        currentStore[key] = { value: init() }
      }
      return currentStore[key]
    }

    currentStore = storeA
    const authA = useAuth(eventUserA)
    currentStore = storeB
    const authB = useAuth(eventUserB)

    const to = { path: '/protected' } as any
    const from = { path: '/' } as any
    const mockNavA = vi.fn()
    const mockNavB = vi.fn()

    // Concurrently execute middleware
    await Promise.all([
      authMiddlewareHandler(to, from, authA, mockNavA),
      authMiddlewareHandler(to, from, authB, mockNavB),
    ])

    // Separate instances on event context
    expect(eventUserA.context._supabaseClient).toBeDefined()
    expect(eventUserB.context._supabaseClient).toBeDefined()
    expect(eventUserA.context._supabaseClient).not.toBe(eventUserB.context._supabaseClient)

    expect(mockNavA).not.toHaveBeenCalled()
    expect(mockNavB).not.toHaveBeenCalled()

    expect(authA.user.value?.id).toBe('student-101')
    expect(authA.user.value?.email).toBe('student101@rpr.ac.th')

    expect(authB.user.value?.id).toBe('teacher-202')
    expect(authB.user.value?.email).toBe('teacher202@rpr.ac.th')
  })
})

describe('Built Nuxt Production Server End-to-End SSR HTTP Verification', () => {
  let stubServer: http.Server
  let stubPort: number
  let stubBaseUrl: string
  let nuxtProc: any = null
  let nuxtPort: number
  let nuxtBaseUrl: string
  let activeStubRequests = 0
  let maxConcurrentStubRequests = 0
  const builtServerPath = process.env.TEST_BUILT_SERVER_PATH || path.resolve(__dirname, '../.output/server/index.mjs')
  const hasBuiltServer = fs.existsSync(builtServerPath)

  function makeRequest(url: string, headers: Record<string, string> = {}) {
    return new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }>((resolve, reject) => {
      const parsed = new URL(url)
      const req = http.request(
        {
          hostname: parsed.hostname,
          port: parsed.port,
          path: parsed.pathname + parsed.search,
          method: 'GET',
          headers,
        },
        (res) => {
          let body = ''
          res.on('data', (chunk) => {
            body += chunk
          })
          res.on('end', () => {
            resolve({ status: res.statusCode || 0, headers: res.headers, body })
          })
        }
      )
      req.on('error', reject)
      req.end()
    })
  }

  beforeAll(async () => {
    // Explicit assertion: absent built server must fail the test, never silently pass
    expect(
      hasBuiltServer,
      `Built server artifact is missing at ${builtServerPath}. Run "npm run build" before running integration tests.`
    ).toBe(true)

    // Set up dedicated HTTP Auth stub with concurrency tracking
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

      if (req.url?.includes('/auth/v1/user')) {
        activeStubRequests++
        if (activeStubRequests > maxConcurrentStubRequests) {
          maxConcurrentStubRequests = activeStubRequests
        }

        // Small controlled delay ensures concurrent requests overlap in flight
        setTimeout(() => {
          activeStubRequests--
          const authHeader = req.headers.authorization
          if (authHeader === 'Bearer valid-student-token') {
            res.writeHead(200, corsHeaders)
            res.end(JSON.stringify({ id: 'student-101', email: 'student101@rpr.ac.th' }))
          } else if (authHeader === 'Bearer valid-teacher-token') {
            res.writeHead(200, corsHeaders)
            res.end(JSON.stringify({ id: 'teacher-202', email: 'teacher202@rpr.ac.th' }))
          } else {
            res.writeHead(401, corsHeaders)
            res.end(JSON.stringify({ message: 'Invalid JWT token' }))
          }
        }, 50)
      } else {
        res.writeHead(404, corsHeaders)
        res.end(JSON.stringify({ message: 'Not found' }))
      }
    })

    await new Promise<void>((resolve) => {
      stubServer.listen(0, '127.0.0.1', () => {
        const addr = stubServer.address() as any
        stubPort = addr.port
        stubBaseUrl = `http://127.0.0.1:${stubPort}`
        resolve()
      })
    })

    const getFreePort = () =>
      new Promise<number>((resolve) => {
        const s = http.createServer()
        s.listen(0, '127.0.0.1', () => {
          const p = (s.address() as any).port
          s.close(() => resolve(p))
        })
      })

    nuxtPort = await getFreePort()
    nuxtBaseUrl = `http://127.0.0.1:${nuxtPort}`

    const { spawn } = await import('node:child_process')
    nuxtProc = spawn('node', [builtServerPath], {
      env: {
        ...process.env,
        PORT: String(nuxtPort),
        NITRO_PORT: String(nuxtPort),
        HOST: '127.0.0.1',
        NITRO_HOST: '127.0.0.1',
        SUPABASE_URL: stubBaseUrl,
        SUPABASE_KEY: 'test-key',
        NUXT_PUBLIC_SUPABASE_URL: stubBaseUrl,
        NUXT_PUBLIC_SUPABASE_KEY: 'test-key',
        NODE_ENV: 'production',
      },
      stdio: 'pipe',
    })

    const start = Date.now()
    while (Date.now() - start < 5000) {
      try {
        const res = await makeRequest(`${nuxtBaseUrl}/`)
        if (res.status === 200) break
      } catch {
        await new Promise((r) => setTimeout(r, 50))
      }
    }
  })

  afterAll(() => {
    if (nuxtProc) {
      nuxtProc.kill('SIGTERM')
    }
    stubServer?.close()
  })

  function createSupabaseCookieValue(accessToken: string, email: string, id: string) {
    const session = {
      access_token: accessToken,
      refresh_token: 'refresh-' + id,
      token_type: 'bearer',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id, email },
    }
    return 'base64-' + stringToBase64URL(JSON.stringify(session))
  }

  it('redirects unauthenticated request on /protected to /?auth_required=true on real built server', async () => {
    const res = await makeRequest(`${nuxtBaseUrl}/protected`)
    expect(res.status).toBe(302)
    expect(res.headers.location).toBe('/?auth_required=true')
  })

  it('allows access to /protected and renders user identity when valid cookie is provided on real built server', async () => {
    const cookie = `sb-127-auth-token=${createSupabaseCookieValue('valid-student-token', 'student101@rpr.ac.th', 'student-101')}`
    const res = await makeRequest(`${nuxtBaseUrl}/protected`, { cookie })
    expect(res.status).toBe(200)
    expect(res.body).toContain('student101@rpr.ac.th')
  })

  it('redirects forged cookie request on /protected to /?auth_required=true on real built server', async () => {
    const cookie = `sb-127-auth-token=${createSupabaseCookieValue('forged-token', 'evil@hacker.com', 'hacker')}`
    const res = await makeRequest(`${nuxtBaseUrl}/protected`, { cookie })
    expect(res.status).toBe(302)
    expect(res.headers.location).toBe('/?auth_required=true')
  })

  it('proves concurrent overlapping requests on built server maintain isolated identities', async () => {
    const cookieA = `sb-127-auth-token=${createSupabaseCookieValue('valid-student-token', 'student101@rpr.ac.th', 'student-101')}`
    const cookieB = `sb-127-auth-token=${createSupabaseCookieValue('valid-teacher-token', 'teacher202@rpr.ac.th', 'teacher-202')}`

    const [resA, resB] = await Promise.all([
      makeRequest(`${nuxtBaseUrl}/protected`, { cookie: cookieA }),
      makeRequest(`${nuxtBaseUrl}/protected`, { cookie: cookieB }),
    ])

    expect(resA.status).toBe(200)
    expect(resB.status).toBe(200)

    expect(resA.body).toContain('student101@rpr.ac.th')
    expect(resA.body).not.toContain('teacher202@rpr.ac.th')

    expect(resB.body).toContain('teacher202@rpr.ac.th')
    expect(resB.body).not.toContain('student101@rpr.ac.th')

    // Concurrency overlap instrumentation: proves that both requests reached the Auth endpoint simultaneously
    expect(maxConcurrentStubRequests).toBeGreaterThanOrEqual(2)
  })
})
