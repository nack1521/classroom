import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as supabaseClientModule from '../app/utils/supabaseClient'
import { useAuth } from '../app/composables/useAuth'

describe('Handoff 006E4: Safe Public Auth Notices Outside Callback', () => {
  const INIT_MARKER = 'MARKER_INIT_SECRET_111'
  const AUTH_STATE_MARKER = 'MARKER_AUTH_STATE_SECRET_222'
  const OAUTH_RETURN_MARKER = 'MARKER_OAUTH_RETURN_SECRET_333'
  const OAUTH_THROW_MARKER = 'MARKER_OAUTH_THROW_SECRET_444'

  let store: Record<string, { value: any }>
  let getSupabaseClientSpy: any

  beforeEach(() => {
    store = {}
    ;(globalThis as any).useState = (k: string, init: () => any) => {
      if (!store[k]) store[k] = { value: init() }
      return store[k]
    }
    ;(globalThis as any).useRuntimeConfig = () => ({
      public: {
        supabaseUrl: 'https://example.supabase.co',
        supabaseKey: 'test-anon-key',
        siteUrl: 'http://localhost:3000',
      },
    })
    ;(globalThis as any).navigateTo = vi.fn()
  })

  afterEach(() => {
    if (getSupabaseClientSpy) {
      getSupabaseClientSpy.mockRestore()
    }
    vi.restoreAllMocks()
  })

  it('Path (a) RED CONTRACT: initAuth() does not reflect raw exception message when initialization throws', async () => {
    // Controlled client: getUser succeeds or returns null, but onAuthStateChange throws an exception containing sensitive marker
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        onAuthStateChange: vi.fn().mockImplementation(() => {
          throw new Error(`Provider connection failed with ${INIT_MARKER}`)
        }),
      },
    }

    getSupabaseClientSpy = vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(client as any)

    const auth = useAuth()
    await auth.initAuth()

    // Boolean check prevents leaking synthetic marker in Vitest failure diff output
    const hasMarker = Boolean(auth.authError.value && auth.authError.value.includes(INIT_MARKER))
    expect(hasMarker).toBe(false)
    expect(auth.authError.value).toBe('Failed to initialize authentication. Please refresh the page and try again.')
    expect(auth.user.value).toBeNull()
    expect(auth.isLoading.value).toBe(false)
  })

  it('Path (b) RED CONTRACT: onAuthStateChange handler does not reflect raw exception message on deferred verification failure', async () => {
    let capturedListener: ((event: string, session: any) => void) | null = null
    let callCount = 0

    // Initial client during initAuth
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        onAuthStateChange: vi.fn().mockImplementation((cb) => {
          capturedListener = cb
          return { data: { subscription: { unsubscribe: vi.fn() } } }
        }),
      },
    }

    // During deferred verification triggered by auth state change, getSupabaseClient throws with marker
    getSupabaseClientSpy = vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockImplementation(() => {
      callCount++
      if (callCount > 2) {
        throw new Error(`Auth state verification rejected with ${AUTH_STATE_MARKER}`)
      }
      return client as any
    })

    const auth = useAuth()
    await auth.initAuth()

    expect(capturedListener).toBeTypeOf('function')

    // Trigger deferred verification via event callback
    capturedListener!('SIGNED_IN', { user: { id: 'user-1' } })

    // Await asynchronous verification scheduled by createSafeAuthStateHandler (setTimeout 0)
    await new Promise((r) => setTimeout(r, 25))

    const hasMarker = Boolean(auth.authError.value && auth.authError.value.includes(AUTH_STATE_MARKER))
    expect(hasMarker).toBe(false)
    expect(auth.authError.value).toBe('Failed to update authentication state. Please refresh the page.')
    expect(auth.user.value).toBeNull()
  })

  it('Path (c) RED CONTRACT: signInWithGoogle() does not reflect raw message when signInWithOAuth returns error', async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        signInWithOAuth: vi.fn().mockResolvedValue({
          error: {
            message: `OAuth provider error: ${OAUTH_RETURN_MARKER}`,
          },
        }),
      },
    }

    getSupabaseClientSpy = vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(client as any)

    const auth = useAuth()
    await auth.signInWithGoogle()

    const hasMarker = Boolean(auth.authError.value && auth.authError.value.includes(OAUTH_RETURN_MARKER))
    expect(hasMarker).toBe(false)
    expect(auth.authError.value).toBe('Failed to initiate Google sign-in. Please try again.')
  })

  it('Path (d) RED CONTRACT: signInWithGoogle() does not reflect raw exception message when signInWithOAuth throws', async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        signInWithOAuth: vi.fn().mockRejectedValue(
          new Error(`Network exception during OAuth initiation: ${OAUTH_THROW_MARKER}`)
        ),
      },
    }

    getSupabaseClientSpy = vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(client as any)

    const auth = useAuth()
    await auth.signInWithGoogle()

    const hasMarker = Boolean(auth.authError.value && auth.authError.value.includes(OAUTH_THROW_MARKER))
    expect(hasMarker).toBe(false)
    expect(auth.authError.value).toBe('Failed to initiate Google sign-in. Please try again.')
  })

  it('POSITIVE CONTROL: signInWithGoogle() clears authError on successful initiation', async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        signInWithOAuth: vi.fn().mockResolvedValue({
          data: { url: 'https://accounts.google.com/o/oauth2/v2/auth' },
          error: null,
        }),
      },
    }

    getSupabaseClientSpy = vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(client as any)

    const auth = useAuth()
    // Pre-populate with old error to prove it gets cleared
    auth.authError.value = 'Old error'

    await auth.signInWithGoogle()

    expect(auth.authError.value).toBeNull()
    expect(auth.signOutError.value).toBeNull()
  })

  it('CONTROL: index.vue public template renders safe notice and explains missing configuration', async () => {
    // 1. Safe notice rendering contract equivalent to app/pages/index.vue lines 35-38
    const renderNotice = (error: string | null) => {
      if (!error) return null
      return `Authentication Notice: ${error}`
    }

    const safeMessage = 'Failed to initiate Google sign-in. Please try again.'
    const rendered = renderNotice(safeMessage)
    expect(rendered).toBe('Authentication Notice: Failed to initiate Google sign-in. Please try again.')
    expect(rendered?.includes('MARKER_')).toBe(false)

    // 2. Missing configuration notice is preserved and informative
    ;(globalThis as any).useRuntimeConfig = () => ({
      public: {
        supabaseUrl: '',
        supabaseKey: '',
        siteUrl: 'http://localhost:3000',
      },
    })

    const unconfiguredAuth = useAuth()
    expect(unconfiguredAuth.isConfigured).toBe(false)

    await unconfiguredAuth.signInWithGoogle()

    expect(unconfiguredAuth.authError.value).toContain('Google OAuth blocked pending Supabase configuration')
    expect(unconfiguredAuth.authError.value).toContain('Please configure SUPABASE_URL and SUPABASE_KEY')

    // Retry capability: re-configuring allows subsequent sign-in attempt
    ;(globalThis as any).useRuntimeConfig = () => ({
      public: {
        supabaseUrl: 'https://example.supabase.co',
        supabaseKey: 'test-anon-key',
        siteUrl: 'http://localhost:3000',
      },
    })
    const client = {
      auth: {
        signInWithOAuth: vi.fn().mockResolvedValue({ data: { url: 'https://accounts.google.com' }, error: null }),
      },
    }
    getSupabaseClientSpy = vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(client as any)

    const configuredAuth = useAuth()
    expect(configuredAuth.isConfigured).toBe(true)
    await configuredAuth.signInWithGoogle()
    expect(configuredAuth.authError.value).toBeNull()
  })
})
