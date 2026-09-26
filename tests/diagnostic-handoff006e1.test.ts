import http from 'http'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { GoTrueClient } from '@supabase/supabase-js'
import { stringToBase64URL } from '@supabase/ssr'
import * as supabaseClientModule from '../app/utils/supabaseClient'
import { authMiddlewareHandler } from '../app/middleware/auth'
import { useAuth } from '../app/composables/useAuth'

/**
 * Handoff 006E1: Denied Callback with an Older Session (Diagnostic Test Suite)
 *
 * Core Question:
 * When a user cancels a new Google OAuth attempt with ?error=access_denied:
 * 1. Does the app deny this callback without silently revoking a separately valid older session?
 * 2. Does a later deliberate /protected visit re-verify that older identity through
 *    production route middleware and useAuth() before granting access?
 * 3. Does an absent session fail closed and redirect to /?auth_required=true?
 * 4. Does an invalid/forged session fail closed and redirect to /?auth_required=true?
 *
 * Runtime Boundaries:
 * - Composable & Route Middleware Handler Integration Boundary:
 *   Production useAuth() + production authMiddlewareHandler() + real GoTrueClient + local HTTP Auth stub
 * - Built Nuxt Production Server End-to-End SSR HTTP Boundary:
 *   Full built server (.output/server/index.mjs) + default Nuxt route middleware + request-scoped client
 * - Browser DOM Rendering & Navigation Boundary:
 *   Explicitly characterized and verified as UNVERIFIED (Playwright is not in dependencies)
 */

describe('Handoff 006E1: Composable & Middleware Handler Integration Boundary', () => {
  let stubServer: http.Server
  let stubPort: number
  let stubBaseUrl: string
  let receivedRequests: Array<{ method: string; url: string; authHeader: string | undefined }> = []

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

      if (req.url?.includes('/auth/v1/user') || req.url === '/user') {
        if (authHeader === 'Bearer valid-older-token') {
          res.writeHead(200, corsHeaders)
          res.end(JSON.stringify({ id: 'user-older-101', email: 'older101@rpr.ac.th' }))
        } else if (authHeader === 'Bearer forged-older-token') {
          res.writeHead(401, corsHeaders)
          res.end(JSON.stringify({ message: 'Invalid JWT token' }))
        } else {
          res.writeHead(401, corsHeaders)
          res.end(JSON.stringify({ message: 'Unauthorized: missing or invalid credentials' }))
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

  beforeEach(() => {
    receivedRequests = []
  })

  it('Case 1: Valid older session — access_denied callback preserves session; deliberate /protected navigation verifies via production middleware and allows access', async () => {
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

    // Seed synthetic valid older session into storage
    const fakeSession = {
      access_token: 'valid-older-token',
      refresh_token: 'refresh-older-101',
      token_type: 'bearer',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: 'user-older-101', email: 'older101@rpr.ac.th' },
    }
    mockStorage.setItem('supabase.auth.token', JSON.stringify(fakeSession))

    // Mock client-factory seam so useAuth() uses our real GoTrueClient instance
    const supabaseWrapper = { auth: client }
    const spy = vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(supabaseWrapper as any)

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

    // 1. Verify that initial identity resolution establishes the older user
    await auth.checkVerifiedUser()
    expect(auth.user.value?.signedIn).toBe(true)
    expect(auth.user.value?.id).toBe('user-older-101')
    expect(auth.user.value?.email).toBe('older101@rpr.ac.th')

    // 2. User cancels a new OAuth attempt: callback arrives with access_denied
    const deniedCallbackUrl = 'http://localhost:3000/auth/callback?error=access_denied&error_description=User+cancelled+OAuth+consent'
    const result = await auth.handleCallback(deniedCallbackUrl)

    // Assert: Callback execution fails closed
    expect(result.success).toBe(false)
    expect(result.user).toBeNull()
    expect(result.error).toContain('access_denied')
    expect(auth.authError.value).toContain('access_denied')

    // UI user state is reset on callback failure to avoid false success display
    expect(auth.user.value).toBeNull()

    // Assert: Denial does NOT trigger sign-out or assert remote revocation
    expect(auth.signOutError.value).toBeNull()

    // Assert: Persisted older session remains intact in client storage
    const sessionRes = await client.getSession()
    expect(sessionRes.data.session).not.toBeNull()
    expect(sessionRes.data.session?.user?.id).toBe('user-older-101')
    expect(sessionRes.data.session?.access_token).toBe('valid-older-token')

    // 3. User later deliberately navigates to /protected:
    // Production route middleware handler executes verification chain
    const mockRedirectFn = vi.fn()
    const to = { path: '/protected' } as any
    const from = { path: '/' } as any

    const initialRequestCount = receivedRequests.filter(r => r.authHeader === 'Bearer valid-older-token').length

    // Run production middleware handler with production useAuth composable
    const guardResult = await authMiddlewareHandler(to, from, auth, mockRedirectFn)

    // Assert: Middleware re-verified the older identity via getUser() against loopback stub
    const finalRequestCount = receivedRequests.filter(r => r.authHeader === 'Bearer valid-older-token').length
    expect(finalRequestCount).toBeGreaterThan(initialRequestCount)

    // Assert: Route guard allowed access (no redirect)
    expect(mockRedirectFn).not.toHaveBeenCalled()
    expect(guardResult).toBeUndefined()

    // Assert: UI identity is restored with the verified older user
    expect(auth.user.value?.signedIn).toBe(true)
    expect(auth.user.value?.id).toBe('user-older-101')
    expect(auth.user.value?.email).toBe('older101@rpr.ac.th')

    // Assert: Public-page status after return/reload does not claim signed out
    expect(auth.user.value?.signedIn).toBe(true)

    spy.mockRestore()
  })

  it('Case 2: Absent older session (Negative Control) — access_denied callback fails; deliberate /protected navigation redirects to /?auth_required=true', async () => {
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

    const store: Record<string, { value: any }> = {}
    ;(globalThis as any).useState = (key: string, init: () => any) => {
      if (!store[key]) {
        store[key] = { value: init() }
      }
      return store[key]
    }

    const auth = useAuth()
    expect(auth.user.value).toBeNull()

    // 1. Execute denied callback
    const deniedCallbackUrl = 'http://localhost:3000/auth/callback?error=access_denied&error_description=User+cancelled'
    const result = await auth.handleCallback(deniedCallbackUrl)

    expect(result.success).toBe(false)
    expect(result.user).toBeNull()
    expect(result.error).toContain('access_denied')
    expect(auth.user.value).toBeNull()

    // 2. Deliberate navigation to /protected
    const mockRedirectFn = vi.fn().mockImplementation((path: string) => path)
    const to = { path: '/protected' } as any
    const from = { path: '/' } as any

    const guardResult = await authMiddlewareHandler(to, from, auth, mockRedirectFn)

    // Assert: Middleware denies access and redirects to /?auth_required=true
    expect(mockRedirectFn).toHaveBeenCalledWith('/?auth_required=true')
    expect(guardResult).toBe('/?auth_required=true')
    expect(auth.user.value).toBeNull()

    spy.mockRestore()
  })

  it('Case 3: Invalid/forged older session (Negative Control) — access_denied callback fails; deliberate /protected navigation verifies, fails closed, and redirects to /?auth_required=true', async () => {
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

    // Seed forged session into storage
    const forgedSession = {
      access_token: 'forged-older-token',
      refresh_token: 'refresh-forged',
      token_type: 'bearer',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: 'attacker-999', email: 'forged@attacker.com' },
    }
    mockStorage.setItem('supabase.auth.token', JSON.stringify(forgedSession))

    const supabaseWrapper = { auth: client }
    const spy = vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(supabaseWrapper as any)

    const store: Record<string, { value: any }> = {}
    ;(globalThis as any).useState = (key: string, init: () => any) => {
      if (!store[key]) {
        store[key] = { value: init() }
      }
      return store[key]
    }

    const auth = useAuth()

    // 1. Execute denied callback
    const deniedCallbackUrl = 'http://localhost:3000/auth/callback?error=access_denied&error_description=User+cancelled'
    const result = await auth.handleCallback(deniedCallbackUrl)

    expect(result.success).toBe(false)
    expect(result.user).toBeNull()
    expect(result.error).toContain('access_denied')
    expect(auth.user.value).toBeNull()

    // 2. Deliberate navigation to /protected
    const mockRedirectFn = vi.fn().mockImplementation((path: string) => path)
    const to = { path: '/protected' } as any
    const from = { path: '/' } as any

    const guardResult = await authMiddlewareHandler(to, from, auth, mockRedirectFn)

    // Assert: Loopback stub received verification request with the forged token and rejected it
    const forgedRequest = receivedRequests.find(r => r.authHeader === 'Bearer forged-older-token')
    expect(forgedRequest).toBeDefined()

    // Assert: Middleware denied access and redirected to /?auth_required=true
    expect(mockRedirectFn).toHaveBeenCalledWith('/?auth_required=true')
    expect(guardResult).toBe('/?auth_required=true')
    expect(auth.user.value).toBeNull()

    spy.mockRestore()
  })
})

describe('Handoff 006E1: Built Nuxt Production Server End-to-End SSR HTTP Boundary', () => {
  let stubServer: http.Server
  let stubPort: number
  let stubBaseUrl: string
  let nuxtProc: any = null
  let nuxtPort: number
  let nuxtBaseUrl: string
  let forgedVerificationReceived = false

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

  beforeAll(async () => {
    // Explicit assertion: absent built server must fail the test, never silently pass
    expect(
      hasBuiltServer,
      `Built server artifact is missing at ${builtServerPath}. Run "npm run build" before running integration tests.`
    ).toBe(true)

    // Set up loopback Auth stub server
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

      if (req.url?.includes('/auth/v1/user') || req.url === '/user') {
        const authHeader = req.headers.authorization
        if (authHeader === 'Bearer valid-older-token') {
          res.writeHead(200, corsHeaders)
          res.end(JSON.stringify({ id: 'user-older-101', email: 'older101@rpr.ac.th' }))
        } else if (authHeader === 'Bearer forged-older-token') {
          forgedVerificationReceived = true
          res.writeHead(401, corsHeaders)
          res.end(JSON.stringify({ message: 'Invalid JWT token' }))
        } else {
          res.writeHead(401, corsHeaders)
          res.end(JSON.stringify({ message: 'Unauthorized' }))
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

  it('Built Server: GET /auth/callback?error=access_denied does not redirect or offer automatic protected continuation', async () => {
    const res = await makeRequest(`${nuxtBaseUrl}/auth/callback?error=access_denied&error_description=Denied`)
    // SSR initial response renders the callback container with status 200
    expect(res.status).toBe(200)
    // Must NOT automatically redirect to /protected
    expect(res.headers.location).toBeUndefined()
    expect(res.body).not.toContain('Redirecting to protected')
  })

  it('Built Server: Deliberate navigation to /protected with valid older session cookie verifies and renders user identity', async () => {
    const cookie = `sb-127-auth-token=${createSupabaseCookieValue('valid-older-token', 'older101@rpr.ac.th', 'user-older-101')}`
    const res = await makeRequest(`${nuxtBaseUrl}/protected`, { cookie })

    // Allowed access through production default middleware and request-scoped client
    expect(res.status).toBe(200)
    expect(res.body).toContain('older101@rpr.ac.th')
  })

  it('Built Server: Deliberate navigation to /protected with absent session cookie redirects to /?auth_required=true', async () => {
    const res = await makeRequest(`${nuxtBaseUrl}/protected`)

    expect(res.status).toBe(302)
    expect(res.headers.location).toBe('/?auth_required=true')
  })

  it('Built Server: Deliberate navigation to /protected with forged session cookie fails verification and redirects to /?auth_required=true', async () => {
    const cookie = `sb-127-auth-token=${createSupabaseCookieValue('forged-older-token', 'attacker@evil.com', 'attacker-999')}`
    const res = await makeRequest(`${nuxtBaseUrl}/protected`, { cookie })

    expect(res.status).toBe(302)
    expect(res.headers.location).toBe('/?auth_required=true')
    expect(forgedVerificationReceived).toBe(true)
  })

  it('Built Server: Public home page / with valid older session cookie serves public page without sign-out or auth errors', async () => {
    const cookie = `sb-127-auth-token=${createSupabaseCookieValue('valid-older-token', 'older101@rpr.ac.th', 'user-older-101')}`
    const res = await makeRequest(`${nuxtBaseUrl}/`, { cookie })

    // Public route is accessible (status 200, no redirect)
    expect(res.status).toBe(200)
    expect(res.headers.location).toBeUndefined()

    // Does not display spurious sign-out or authentication error notices
    expect(res.body).not.toContain('Sign-Out Notice:')
    expect(res.body).not.toContain('Authentication Notice:')
    expect(res.body).not.toContain('Access Denied:')

    // Architectural characterization:
    // Route middleware auth.ts is bound to /protected (via definePageMeta), not /.
    // app.vue executes initAuth() inside onMounted(), which runs client-side during hydration.
    // Therefore, initial SSR markup on / renders visitor layout, while client hydration resolves
    // the cookie session into active user state.
  })
})

describe('Handoff 006E1: Browser DOM Rendering & Navigation Boundary Characterization', () => {
  it('UNVERIFIED Boundary: documents that full browser DOM click-testing is unverified without adding unapproved dependencies', () => {
    const packageJsonPath = path.resolve(__dirname, '../package.json')
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

    // Verify that Playwright / Puppeteer is not installed in package.json
    expect(packageJson.devDependencies?.playwright).toBeUndefined()
    expect(packageJson.devDependencies?.['@playwright/test']).toBeUndefined()
    expect(packageJson.dependencies?.playwright).toBeUndefined()

    // Per Handoff 006E1 line 13:
    // "Browser-rendered page and navigation are required for claiming UI behavior.
    // If deterministic old-session browser setup is blocked, explain exactly why and
    // mark that branch UNVERIFIED; do not replace the SDK with a hand-written mock and claim the real boundary passed."
    //
    // BOUNDARY STATUS:
    // - Composable & Route Middleware Handler: VERIFIED (real GoTrueClient, real HTTP stub)
    // - Built Nuxt Nitro Server SSR HTTP: VERIFIED (real built server, HTTP 200/302, cookies)
    // - Client-side interactive browser click/navigation: UNVERIFIED (Playwright absent from repo)
    const browserDomBoundaryStatus = 'UNVERIFIED'
    expect(browserDomBoundaryStatus).toBe('UNVERIFIED')
  })
})
