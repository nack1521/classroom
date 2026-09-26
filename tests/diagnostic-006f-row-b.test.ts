import http from 'http'
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { GoTrueClient } from '@supabase/supabase-js'
import * as supabaseClientModule from '../app/utils/supabaseClient'
import { useAuth } from '../app/composables/useAuth'

/**
 * Handoff 006F1 — Row B: Natural SDK SIGNED_IN Event Race Diagnostic
 *
 * Core Requirements:
 * 1. Cause SIGNED_IN naturally via installed SDK (real setSession against loopback).
 *    NEVER invoke _notifyAllSubscribers or fabricate event/session.
 * 2. Distinguish SDK's pre-event /user request (#1) from production listener's
 *    subsequent deferred /user verification request (#2) with counters/gates.
 * 3. Observe natural SIGNED_IN notification and prove the second request has started
 *    before initiating sign-out.
 * 4. Avoid deadlock: initiate sign-out, prove invalidation began, release held
 *    deferred response, then await completion.
 * 5. Negative race: late response must never restore auth.user.value; prove sign-out
 *    was invoked and deferred response released.
 * 6. Positive control: same natural event without sign-out populates verified user.
 * 7. Use deterministic bounded waits and fail loudly on timeout.
 * 8. Zero SDK calls from within auth event callbacks.
 */

describe('Handoff 006F1 — Row B: Natural SDK SIGNED_IN Event Race Diagnostic', () => {
  let stubServer: http.Server
  let stubPort: number
  let stubBaseUrl: string

  // Request tracing and gates
  interface RequestLogItem {
    id: number
    type: 'pre_event_sdk_user' | 'deferred_listener_user' | 'subsequent_user' | 'logout'
    method: string
    url: string
  }

  let userRequestCount = 0
  let requestTrace: RequestLogItem[] = []
  let holdDeferredVerification = false
  let deferredRequestReceived = false
  let releaseDeferredResponse: (() => void) | null = null
  let deferredResponseSent = false

  // Synthetic JWT helpers (valid 3-part base64url token)
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const payloadUserA = Buffer.from(JSON.stringify({ sub: 'user-A', id: 'user-A', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')
  const sig = Buffer.from('sig').toString('base64url')
  const syntheticJwtUserA = `${header}.${payloadUserA}.${sig}`

  async function waitForCondition(
    predicate: () => boolean,
    description: string,
    timeoutMs = 4000,
    pollIntervalMs = 10
  ): Promise<void> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      if (predicate()) return
      await new Promise((r) => setTimeout(r, pollIntervalMs))
    }
    throw new Error(`Timeout after ${timeoutMs}ms waiting for: ${description}`)
  }

  beforeAll(async () => {
    stubServer = http.createServer(async (req, res) => {
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
        requestTrace.push({
          id: ++userRequestCount,
          type: 'logout',
          method: req.method || 'POST',
          url: req.url || '',
        })
        res.writeHead(200, corsHeaders)
        res.end(JSON.stringify({}))
        return
      }

      if (req.url?.includes('/user') || req.url?.includes('/auth/v1/user')) {
        userRequestCount++
        const count = userRequestCount
        const authHeader = req.headers.authorization

        if (count === 1) {
          // Request #1: SDK's pre-event _getUser() call inside setSession()
          requestTrace.push({
            id: count,
            type: 'pre_event_sdk_user',
            method: req.method || 'GET',
            url: req.url || '',
          })
          if (authHeader === `Bearer ${syntheticJwtUserA}`) {
            res.writeHead(200, corsHeaders)
            res.end(JSON.stringify({ id: 'user-A', email: 'userA@rpr.ac.th' }))
          } else {
            res.writeHead(401, corsHeaders)
            res.end(JSON.stringify({ message: 'Invalid JWT' }))
          }
          return
        }

        if (count === 2) {
          // Request #2: Production listener's deferred getUser() verification call
          requestTrace.push({
            id: count,
            type: 'deferred_listener_user',
            method: req.method || 'GET',
            url: req.url || '',
          })

          deferredRequestReceived = true
          if (holdDeferredVerification) {
            await new Promise<void>((resolve) => {
              releaseDeferredResponse = resolve
            })
          }

          if (authHeader === `Bearer ${syntheticJwtUserA}`) {
            res.writeHead(200, corsHeaders)
            res.end(JSON.stringify({ id: 'user-A', email: 'userA@rpr.ac.th' }))
          } else {
            res.writeHead(401, corsHeaders)
            res.end(JSON.stringify({ message: 'Invalid JWT' }))
          }
          deferredResponseSent = true
          return
        }

        // Any subsequent request
        requestTrace.push({
          id: count,
          type: 'subsequent_user',
          method: req.method || 'GET',
          url: req.url || '',
        })
        res.writeHead(200, corsHeaders)
        res.end(JSON.stringify({ id: 'user-A', email: 'userA@rpr.ac.th' }))
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
    userRequestCount = 0
    requestTrace = []
    holdDeferredVerification = false
    deferredRequestReceived = false
    releaseDeferredResponse = null
    deferredResponseSent = false
  })

  it('proves the natural SDK SIGNED_IN event race: deferred verification in flight is dropped when signed out before resolution', async () => {
    // 1. Setup real GoTrueClient instance with in-memory storage
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

    // Natural event observer (read-only listener to verify SDK's natural emissions)
    const naturalEvents: Array<{ event: string; userId?: string }> = []
    client.onAuthStateChange((event, session) => {
      naturalEvents.push({ event, userId: session?.user?.id })
    })

    const supabaseWrapper = { auth: client }
    const spy = vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(supabaseWrapper as any)
    let getUserSpy: { mockRestore: () => void; mock: { calls: unknown[][] } } | null = null

    try {
      // Record every authenticated-state assignment after sign-out starts, not only final state.
      const store: Record<string, { value: any }> = {}
      let signOutInitiated = false
      let nullAssignments = 0
      const restoredAfterSignOut: string[] = []
      ;(globalThis as any).useState = (key: string, init: () => any) => {
        if (!store[key]) {
          if (key === 'auth-user') {
            let current = init()
            store[key] = {
              get value() { return current },
              set value(next) {
                if (next == null) nullAssignments++
                if (signOutInitiated && next?.signedIn) restoredAfterSignOut.push(next.id)
                current = next
              },
            }
          } else {
            store[key] = { value: init() }
          }
        }
        return store[key]
      }
      ;(globalThis as any).navigateTo = vi.fn()

      const auth = useAuth()

      // 2. Initialize auth through production composable useAuth.initAuth()
      // This attaches the production createSafeAuthStateHandler via client.auth.onAuthStateChange
      await auth.initAuth()
      expect(auth.user.value).toBeNull()

      // INITIAL_SESSION must be fully observed with an empty session before the race.
      // Otherwise a concurrent initial-session check could be misidentified as request #2.
      await waitForCondition(
        () => naturalEvents.some((e) => e.event === 'INITIAL_SESSION'),
        'empty INITIAL_SESSION notification',
      )
      expect(naturalEvents.find((e) => e.event === 'INITIAL_SESSION')?.userId).toBeUndefined()
      await waitForCondition(
        () => nullAssignments >= 2,
        'production listener to process empty INITIAL_SESSION after initial getUser',
      )
      expect(requestTrace).toEqual([])

      // Instrument the public SDK method without changing its result: setSession's
      // internal _getUser is distinct from the app listener's public getUser.
      const actualGetUser = client.getUser.bind(client)
      let appVerificationCompleted = 0
      getUserSpy = vi.spyOn(client, 'getUser').mockImplementation(async () => {
        try { return await actualGetUser() }
        finally { appVerificationCompleted++ }
      })

      // 3. Configure gate: HOLD Request #2 (the deferred verification), allow Request #1 (pre-event SDK call)
      holdDeferredVerification = true

      // 4. Trigger natural SIGNED_IN event using real SDK setSession()
      // NEVER invoke _notifyAllSubscribers manually
      const setSessionPromise = client.setSession({
        access_token: syntheticJwtUserA,
        refresh_token: 'refresh-token-user-a',
      })

      // Await natural setSession completion.
      // During setSession, SDK makes Request #1 (pre-event), saves session, and naturally emits SIGNED_IN.
      const setSessionResult = await setSessionPromise
      expect(setSessionResult.error).toBeNull()
      expect(setSessionResult.data.session).not.toBeNull()

      // Verify that the natural SIGNED_IN event was emitted by the SDK
      expect(naturalEvents.some((e) => e.event === 'SIGNED_IN')).toBe(true)

      // 5. Wait deterministically for the production listener's deferred verification (Request #2) to reach network
      await waitForCondition(
        () => deferredRequestReceived && requestTrace.some((r) => r.type === 'deferred_listener_user'),
        'deferred verification request (#2) to reach network',
        4000
      )

      // Assert precise ordering state BEFORE initiating sign-out:
      // - Pre-event request (#1) completed
      // - Natural SIGNED_IN event fired
      // - Deferred verification request (#2) is actively held in-flight on network
      // - Response has NOT yet been sent
      // - User is not yet verified (user.value is null)
      expect(requestTrace[0]?.type).toBe('pre_event_sdk_user')
      expect(requestTrace[1]?.type).toBe('deferred_listener_user')
      expect(getUserSpy.mock.calls.length).toBe(1)
      expect(deferredResponseSent).toBe(false)
      expect(auth.user.value).toBeNull()

      // 6. Initiate production signOut() while deferred request #2 is held in flight
      const genBefore = store['auth-state-generation']?.value ?? 0
      signOutInitiated = true
      const signOutPromise = auth.signOut()

      // Prove that invalidation began synchronously:
      // useAuth.signOut() immediately bumps stateGeneration.value before awaiting executeSignOut
      const genAfter = store['auth-state-generation']?.value ?? 0
      expect(genAfter).toBeGreaterThan(genBefore)

      // 7. Release the held deferred /user verification response
      expect(releaseDeferredResponse).toBeTypeOf('function')
      if (releaseDeferredResponse) {
        releaseDeferredResponse()
      }

      // Wait deterministically for the deferred response to finish sending
      await waitForCondition(
        () => deferredResponseSent,
        'held deferred verification response to finish sending',
        4000
      )
      await waitForCondition(
        () => appVerificationCompleted === 1,
        'app-wired getUser verification to settle',
        4000
      )

      // Await completion of production signOut()
      await signOutPromise

      // Allow any microtasks / async handlers to settle deterministically
      await new Promise((r) => setTimeout(r, 20))

      // 8. Negative Race Assertion:
      // Despite the deferred verification resolving with valid user-A data,
      // the generation / sequence check in createSafeAuthStateHandler dropped the stale verification!
      // auth.user.value MUST remain null and NEVER be restored!
      expect(auth.user.value).toBeNull()
      expect(auth.user.value?.signedIn).toBeFalsy()
      expect(restoredAfterSignOut).toEqual([])

      // Assert event and request ordering
      const userRequestTypes = requestTrace.map((r) => r.type)
      expect(userRequestTypes).toContain('pre_event_sdk_user')
      expect(userRequestTypes).toContain('deferred_listener_user')
      expect(userRequestTypes).toContain('logout')
      expect(naturalEvents.some((e) => e.event === 'SIGNED_OUT')).toBe(true)
    } finally {
      getUserSpy?.mockRestore()
      spy.mockRestore()
    }
  })

  it('Positive Control: uninterrupted natural SDK SIGNED_IN event resolves to verified user', async () => {
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

    const naturalEvents: Array<{ event: string; userId?: string }> = []
    client.onAuthStateChange((event, session) => {
      naturalEvents.push({ event, userId: session?.user?.id })
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
      await auth.initAuth()
      expect(auth.user.value).toBeNull()

      // Allow all requests to complete without holding
      holdDeferredVerification = false

      // Trigger real SDK setSession() naturally
      const setSessionResult = await client.setSession({
        access_token: syntheticJwtUserA,
        refresh_token: 'refresh-token-user-a',
      })
      expect(setSessionResult.error).toBeNull()

      // Verify that natural SIGNED_IN event was observed
      expect(naturalEvents.some((e) => e.event === 'SIGNED_IN')).toBe(true)

      // Wait deterministically for deferred verification to update auth.user.value
      await waitForCondition(
        () => auth.user.value?.signedIn === true,
        'auth.user.value to become signedIn: true',
        4000
      )

      // Positive Control Assertion: User is verified and populated
      expect(auth.user.value).not.toBeNull()
      expect(auth.user.value?.id).toBe('user-A')
      expect(auth.user.value?.email).toBe('userA@rpr.ac.th')
      expect(auth.user.value?.signedIn).toBe(true)

      // Verify both Request #1 (pre-event) and Request #2 (deferred) completed
      expect(requestTrace.filter((r) => r.type === 'pre_event_sdk_user').length).toBe(1)
      expect(requestTrace.filter((r) => r.type === 'deferred_listener_user').length).toBe(1)
    } finally {
      spy.mockRestore()
    }
  })
})
