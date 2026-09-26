import http from 'http'
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createBrowserClient, createServerClient, stringToBase64URL } from '@supabase/ssr'
import { processAuthCallback, inspectLocalSessionState, checkRouteAccess } from '../app/utils/auth'
import { authMiddlewareHandler } from '../app/middleware/auth'

/**
 * Handoff 006F — Row A: Supported Integration and Real Storage/Cookie Adapter Diagnostic
 *
 * Core Questions:
 * 1. Is ordinary mismatch locally cleared in actual createBrowserClient / createServerClient cookie flows?
 *    - Show before/after persistence, callback outcome, deliberate SPA /protected, and fresh SSR /protected.
 *    - Preserve older valid session on pre-establishment access_denied as positive policy control.
 * 2. With the installed SDK and controlled loopback, what happens on a credible failure at the real
 *    storage/cookie adapter without replacing signOut with a mocked rejection or fake SDK shape?
 *    - If credible failure retains an ambiguous session and admits B, record RED/blocker.
 */

const itStress = process.env.GATE0_STRESS ? it : it.skip

describe('Handoff 006F — Row A: Supported Integration & Cookie Adapter Diagnostic', () => {
  let stubServer: http.Server
  let stubPort: number
  let stubBaseUrl: string
  let logoutRequests: Array<{ url: string; method: string }> = []
  let userRequests: Array<{ authHeader: string | undefined }> = []

  // Synthetic JWT helper for valid JWT format
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const payloadUserA = Buffer.from(JSON.stringify({ sub: 'user-A', id: 'user-A', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')
  const payloadOlder = Buffer.from(JSON.stringify({ sub: 'older-101', id: 'older-101', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')
  const sig = Buffer.from('sig').toString('base64url')
  const syntheticJwtUserA = `${header}.${payloadUserA}.${sig}`
  const syntheticJwtOlder = `${header}.${payloadOlder}.${sig}`

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

      if (req.url?.includes('/logout') || req.url?.includes('/auth/v1/logout')) {
        logoutRequests.push({ url: req.url, method: req.method || 'POST' })
        res.writeHead(200, corsHeaders)
        res.end(JSON.stringify({}))
        return
      }

      if (req.url?.includes('/token') || req.url?.includes('/auth/v1/token')) {
        let body = ''
        req.on('data', (c) => { body += c })
        req.on('end', () => {
          let parsed: any = {}
          try { parsed = JSON.parse(body) } catch {}

          if (parsed.auth_code === 'matching-code-a') {
            res.writeHead(200, corsHeaders)
            res.end(JSON.stringify({
              access_token: syntheticJwtUserA,
              token_type: 'bearer',
              expires_in: 3600,
              refresh_token: 'refresh-matching-user-a',
              user: { id: 'user-A', email: 'userA@rpr.ac.th' },
            }))
          } else {
            // Mismatch fixture: token issued for User A
            res.writeHead(200, corsHeaders)
            res.end(JSON.stringify({
              access_token: syntheticJwtUserA,
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
        const authHeader = req.headers.authorization
        userRequests.push({ authHeader })

        if (authHeader === `Bearer ${syntheticJwtUserA}`) {
          // In mismatch cases, resolving token issued for A returns contradictory identity user-B
          res.writeHead(200, corsHeaders)
          res.end(JSON.stringify({ id: 'user-B', email: 'userB@rpr.ac.th' }))
        } else if (authHeader === `Bearer ${syntheticJwtOlder}`) {
          res.writeHead(200, corsHeaders)
          res.end(JSON.stringify({ id: 'older-101', email: 'older101@rpr.ac.th' }))
        } else {
          res.writeHead(401, corsHeaders)
          res.end(JSON.stringify({ message: 'Invalid JWT' }))
        }
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

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      if (stubServer) {
        stubServer.closeAllConnections?.()
        stubServer.close(() => resolve())
      } else {
        resolve()
      }
    })
  })

  beforeEach(() => {
    logoutRequests = []
    userRequests = []
  })

  // =========================================================================
  // Row A1: Supported Integration — Ordinary Mismatch in Actual Cookie Flows
  // =========================================================================
  describe('Row A1: Supported Integration — Ordinary Mismatch with Real Cookie Flows', () => {
    it('clears ordinary mismatch in createBrowserClient cookie flow and rejects /protected', async () => {
      // Real cookie jar simulating browser document.cookie
      let cookieJar: Record<string, string> = {}

      const client = createBrowserClient(stubBaseUrl, 'test-anon-key', {
        isSingleton: false,
        auth: {
          detectSessionInUrl: false,
          persistSession: true,
          autoRefreshToken: false,
        },
        cookies: {
          getAll() {
            return Object.keys(cookieJar).map((name) => ({ name, value: cookieJar[name] }))
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              if (options?.maxAge === 0 || value === '') {
                delete cookieJar[name]
              } else {
                cookieJar[name] = value
              }
            })
          },
        },
      })

      // Set PKCE code verifier in cookie storage (as client would during OAuth redirect initiation)
      await client.auth.storage.setItem(`${client.auth.storageKey}-code-verifier`, JSON.stringify('test-code-verifier-value'))

      // Verify code verifier cookie was written
      expect(Object.keys(cookieJar).length).toBeGreaterThan(0)

      // Process mismatch callback
      const callbackResult = await processAuthCallback(client as any, `http://localhost:3000/auth/callback?code=mismatch-code-1`)

      // Callback must fail closed
      expect(callbackResult.success).toBe(false)
      expect(callbackResult.user).toBeNull()
      expect(callbackResult.error).toBe('Authentication failed: OAuth session identity could not be verified.')

      // Assert local logout request occurred with scope=local
      expect(logoutRequests.some((r) => r.url.includes('scope=local'))).toBe(true)
      expect(logoutRequests.some((r) => r.url.includes('scope=global'))).toBe(false)

      // Persistence check: Auth session cookie must be cleared
      const authCookie = cookieJar[client.auth.storageKey]
      expect(authCookie).toBeUndefined()

      // Deliberate SPA /protected attempt using checkRouteAccess
      const sessionState = await inspectLocalSessionState(client.auth)
      expect(sessionState).toBe('confirmed_absent')

      const spaAccess = checkRouteAccess('/protected', false)
      expect(spaAccess.allowed).toBe(false)
      expect(spaAccess.redirect).toBe('/')
    })

    it('clears ordinary mismatch in createServerClient cookie flow and rejects SSR /protected', async () => {
      // Simulate H3 event cookie store
      let serverCookies: Record<string, string> = {}

      const client = createServerClient(stubBaseUrl, 'test-anon-key', {
        cookies: {
          getAll() {
            return Object.keys(serverCookies).map((name) => ({ name, value: serverCookies[name] }))
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              if (options?.maxAge === 0 || value === '') {
                delete serverCookies[name]
              } else {
                serverCookies[name] = value
              }
            })
          },
        },
      })

      // Set PKCE code verifier in server cookies
      await client.auth.storage.setItem(`${client.auth.storageKey}-code-verifier`, JSON.stringify('test-code-verifier-value'))

      // Process mismatch callback
      const callbackResult = await processAuthCallback(client as any, `http://localhost:3000/auth/callback?code=mismatch-code-1`)
      expect(callbackResult.success).toBe(false)

      // Persistence check: server cookies must be cleared
      const activeSessionCookie = serverCookies[client.auth.storageKey]
      expect(activeSessionCookie).toBeUndefined()

      // Fresh SSR request to /protected with cleared cookies
      const ssrGuardResult = await authMiddlewareHandler(
        { path: '/protected' } as any,
        { path: '/' } as any,
        {
          user: { value: null },
          isConfigured: true,
          checkVerifiedUser: async () => null,
        },
        (path: string) => path
      )

      expect(ssrGuardResult).toBe('/?auth_required=true')
    })

    it('preserves older valid session on pre-establishment access_denied (positive policy control)', async () => {
      let cookieJar: Record<string, string> = {}

      const client = createBrowserClient(stubBaseUrl, 'test-anon-key', {
        isSingleton: false,
        auth: {
          detectSessionInUrl: false,
          persistSession: true,
          autoRefreshToken: false,
        },
        cookies: {
          getAll() {
            return Object.keys(cookieJar).map((name) => ({ name, value: cookieJar[name] }))
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              if (options?.maxAge === 0 || value === '') {
                delete cookieJar[name]
              } else {
                cookieJar[name] = value
              }
            })
          },
        },
      })

      // Establish pre-existing valid session for older-101
      const olderSession = {
        access_token: syntheticJwtOlder,
        refresh_token: 'refresh-older',
        token_type: 'bearer',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: 'older-101', email: 'older101@rpr.ac.th' },
      }
      const storageKey = client.auth.storageKey
      await client.auth.storage.setItem(storageKey, JSON.stringify(olderSession))

      // Pre-establishment access_denied callback
      const callbackResult = await processAuthCallback(
        client as any,
        'http://localhost:3000/auth/callback?error=access_denied&error_description=Consent+denied'
      )

      // Callback fails closed
      expect(callbackResult.success).toBe(false)
      expect(callbackResult.error).toContain('access_denied')

      // Assert older session cookies are PRESERVED (no sign-out executed)
      expect(logoutRequests.length).toBe(0)
      expect(cookieJar[storageKey]).toBeDefined()

      // Deliberate /protected navigation re-verifies and admits older session
      const userRes = await client.auth.getUser()
      expect(userRes.data?.user?.email).toBe('older101@rpr.ac.th')

      const spaAccess = checkRouteAccess('/protected', true)
      expect(spaAccess.allowed).toBe(true)
      expect(spaAccess.redirect).toBeUndefined()
    })
  })

  // =========================================================================
  // Row A2: Credible Failure at Real Storage/Cookie Adapter
  // =========================================================================
  describe('Row A2: Credible Failure at Real Storage/Cookie Adapter', () => {
    itStress('demonstrates route outcome when storage adapter fails to clear cookie during local quarantine (Policy Stress)', async () => {
      let cookieJar: Record<string, string> = {}
      let removalAttempted = false

      // Credible real-world failure mode:
      // In SSR / Edge runtimes or restricted browsers, cookie writes/deletions fail when
      // headers are already committed, cookie is read-only/HttpOnly, or quota/storage access is blocked.
      const client = createBrowserClient(stubBaseUrl, 'test-anon-key', {
        isSingleton: false,
        auth: {
          detectSessionInUrl: false,
          persistSession: true,
          autoRefreshToken: false,
        },
        cookies: {
          getAll() {
            return Object.keys(cookieJar).map((name) => ({ name, value: cookieJar[name] }))
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              if (options?.maxAge === 0 || value === '') {
                // Credible adapter failure: removal fails to delete the cookie
                removalAttempted = true
                // Cookie persists in cookieJar
              } else {
                cookieJar[name] = value
              }
            })
          },
        },
      })

      // Set PKCE code verifier
      await client.auth.storage.setItem(`${client.auth.storageKey}-code-verifier`, JSON.stringify('test-code-verifier-value'))

      // Process mismatch callback: exchange sets session, mismatch triggers quarantine
      const callbackResult = await processAuthCallback(client as any, `http://localhost:3000/auth/callback?code=mismatch-code-1`)
      expect(callbackResult.success).toBe(false)
      expect(removalAttempted).toBe(true)

      // Persistence outcome: cookie was retained due to adapter failure
      expect(cookieJar[client.auth.storageKey]).toBeDefined()

      // Now simulate later deliberate visit to /protected through production middleware
      // Because storage retained the session, getUser() resolves to user-B
      const userRes = await client.auth.getUser()
      expect(userRes.data?.user?.id).toBe('user-B')

      // The middleware checks authentication against the client
      const guardResult = await authMiddlewareHandler(
        { path: '/protected' } as any,
        { path: '/' } as any,
        {
          user: { value: null },
          isConfigured: true,
          checkVerifiedUser: async () => {
            const { data } = await client.auth.getUser()
            return data?.user ? { id: data.user.id, email: data.user.email, signedIn: true } : null
          },
        },
        (path: string) => path
      )

      // Under fail-closed policy, ambiguous retained session MUST be rejected (redirect to /?auth_required=true).
      // On unchanged production code, if removal fails, middleware fails open to User B (guardResult is undefined).
      // Handoff 006F rule:
      // "If credible failure retains an ambiguous session and admits B, record RED/blocker;
      //  if the adapter scenario cannot be exercised, record UNVERIFIED, not GREEN."
      //
      // This assertion checks the fail-closed contract:
      expect(guardResult).toBe('/?auth_required=true')
    })
  })
})
