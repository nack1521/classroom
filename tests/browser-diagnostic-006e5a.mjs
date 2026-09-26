import http from 'http'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Handoff 006E5B: Browser Regression Diagnostic for Ambiguous Callback Identity
 *
 * Investigates:
 * When an OAuth callback produces an identity mismatch between the token response
 * and independent user verification, does production code locally quarantine the session
 * so that a deliberate SPA click on the protected route (and SSR hard reload) fails closed?
 *
 * Modes:
 * - 'controls': Runs only passing controls (matching identity, older session with access_denied, absent session).
 * - 'contract': Runs only the policy contract (deliberate SPA click and hard reload after mismatch).
 * - 'all' (default): Runs controls and policy contract. Exits nonzero on policy failure.
 */

const playwrightModulePath = process.env.PLAYWRIGHT_MODULE_PATH || '/Users/nack/.hermes/hermes-agent/node_modules/playwright/index.mjs'

if (!fs.existsSync(playwrightModulePath)) {
  console.error(`[FATAL] Host Playwright module not found at: ${playwrightModulePath}`)
  console.error('Please specify PLAYWRIGHT_MODULE_PATH pointing to host playwright/index.mjs')
  process.exit(2)
}

const { chromium } = await import(playwrightModulePath)

const builtServerPath = path.resolve(__dirname, '../.output/server/index.mjs')
if (!fs.existsSync(builtServerPath)) {
  console.error(`[FATAL] Built server artifact missing at ${builtServerPath}. Run "npm run build" first.`)
  process.exit(2)
}

// Global harness state
let stubServer = null
let nuxtProc = null
let browser = null
let stubBaseUrl = ''
let nuxtBaseUrl = ''
let verificationCount = 0
let logoutRequests = []
const mode = process.argv[2] || 'all' // 'all' | 'controls' | 'contract'

function sanitizeUrl(url) {
  if (!url) return ''
  try {
    const u = new URL(url)
    return u.pathname + u.search + u.hash
  } catch {
    return url.replace(/https?:\/\/[^\s/]+/g, '')
  }
}

function sanitizeText(text) {
  if (!text) return ''
  return String(text)
    .replace(/https?:\/\/[^\s'"]+/g, '[REDACTED_URL]')
    .replace(/token-[A-Za-z0-9_-]+/g, '[REDACTED_TOKEN]')
    .replace(/base64-[A-Za-z0-9_-]+/g, '[REDACTED_COOKIE]')
}

async function cleanup() {
  if (browser) {
    try {
      await browser.close()
    } catch {}
    browser = null
  }
  if (nuxtProc) {
    try {
      nuxtProc.kill('SIGTERM')
      await new Promise((resolve) => setTimeout(resolve, 300))
      nuxtProc.kill('SIGKILL')
    } catch {}
    nuxtProc = null
  }
  if (stubServer) {
    try {
      await new Promise((resolve) => stubServer.close(resolve))
    } catch {}
    stubServer = null
  }
}

process.on('SIGINT', async () => {
  console.log('\n[ABORT] SIGINT received, cleaning up...')
  await cleanup()
  process.exit(130)
})

process.on('SIGTERM', async () => {
  console.log('\n[ABORT] SIGTERM received, cleaning up...')
  await cleanup()
  process.exit(143)
})

async function startStubServer() {
  verificationCount = 0
  logoutRequests = []

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

    if (req.url?.includes('/token')) {
      let body = ''
      req.on('data', chunk => { body += chunk })
      req.on('end', () => {
        let parsed = {}
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
          // Default mismatch fixture: token grant specifies User A
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
      verificationCount++
      const authHeader = req.headers.authorization

      if (authHeader === 'Bearer token-mismatch-user-a') {
        // Contradictory provider identity: token for A resolves to User B
        res.writeHead(200, corsHeaders)
        res.end(JSON.stringify({ id: 'user-B', email: 'userB@rpr.ac.th' }))
      } else if (authHeader === 'Bearer token-matching-user-a') {
        // Matching identity
        res.writeHead(200, corsHeaders)
        res.end(JSON.stringify({ id: 'user-A', email: 'userA@rpr.ac.th' }))
      } else if (authHeader === 'Bearer valid-older-token') {
        // Older session
        res.writeHead(200, corsHeaders)
        res.end(JSON.stringify({ id: 'user-older-101', email: 'older101@rpr.ac.th' }))
      } else {
        res.writeHead(401, corsHeaders)
        res.end(JSON.stringify({ message: 'Unauthorized' }))
      }
      return
    }

    if (req.url?.includes('/logout') || req.url?.includes('/auth/v1/logout')) {
      logoutRequests.push({ url: req.url, auth: req.headers.authorization })
      res.writeHead(200, corsHeaders)
      res.end('{}')
      return
    }

    res.writeHead(200, corsHeaders)
    res.end('{}')
  })

  await new Promise((resolve) => stubServer.listen(0, '127.0.0.1', resolve))
  const stubPort = stubServer.address().port
  stubBaseUrl = `http://127.0.0.1:${stubPort}`
}

async function startNuxtServer() {
  const freePortServer = http.createServer()
  await new Promise((resolve) => freePortServer.listen(0, '127.0.0.1', resolve))
  const nuxtPort = freePortServer.address().port
  await new Promise((resolve) => freePortServer.close(resolve))

  nuxtBaseUrl = `http://127.0.0.1:${nuxtPort}`

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
    stdio: 'ignore',
  })

  const start = Date.now()
  let isReady = false
  while (Date.now() - start < 8000) {
    try {
      const res = await fetch(`${nuxtBaseUrl}/`)
      if (res.status === 200) {
        isReady = true
        break
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150))
  }

  if (!isReady) {
    throw new Error(`Nuxt server failed to become ready at ${nuxtBaseUrl} within 8000ms`)
  }
}

async function runBrowserDiagnostic() {
  console.log('============================================================')
  console.log('Handoff 006E5B: Ambiguous Callback Identity Browser Diagnostic')
  console.log(`Playwright Module: ${playwrightModulePath}`)
  console.log(`Built Server:      ${builtServerPath}`)
  console.log(`Mode:              ${mode}`)
  console.log('============================================================\n')

  await startStubServer()
  await startNuxtServer()

  browser = await chromium.launch({ headless: true })

  let control1Passed = false
  let control2Passed = false
  let control3Passed = false
  let contractPassed = false

  try {
    // =========================================================================
    // Control 1: Matching Positive Control (Browser)
    // =========================================================================
    if (mode === 'all' || mode === 'controls') {
      console.log('============================================================')
      console.log('Control 1: Matching Positive Control (Browser SPA Click)')
      console.log('============================================================')

      const context = await browser.newContext()
      const page = await context.newPage()

      // 1. Establish PKCE code verifier cookie via Google sign in button
      await page.goto(`${nuxtBaseUrl}/`)
      await page.route('**/auth/v1/authorize*', (route) => route.abort())
      try {
        await page.click('#google-signin-btn')
      } catch {
        // Expected route abort on OAuth redirection
      }
      await page.waitForTimeout(300)

      // 2. Matching callback execution
      await page.goto(`${nuxtBaseUrl}/auth/callback?code=matching-code-a`)
      await page.waitForTimeout(800)

      const hasSuccess = await page.locator('.state-success').isVisible()
      console.log(`  [INFO] Callback shows success state: ${hasSuccess}`)

      // 3. Return to home
      await page.goto(`${nuxtBaseUrl}/`)
      await page.waitForTimeout(400)

      // 4. Deliberate SPA click to /protected
      const vBefore = verificationCount
      await page.click('#test-protected-btn')
      await page.waitForTimeout(800)
      const vAfter = verificationCount

      const protectedUrl = sanitizeUrl(page.url())
      const protectedContent = await page.content()
      const hasVerified = protectedContent.includes('Authentication Verified')
      const hasUserA = protectedContent.includes('userA@rpr.ac.th')

      const vDelta = vAfter - vBefore
      console.log(`  [INFO] URL after SPA click: ${protectedUrl}`)
      console.log(`  [INFO] Auth verification delta: ${vDelta}`)
      console.log(`  [INFO] Shows "Authentication Verified": ${hasVerified}`)
      console.log(`  [INFO] Displays userA@rpr.ac.th: ${hasUserA}`)

      if (protectedUrl === '/protected' && hasVerified && hasUserA && vDelta > 0) {
        console.log('  [PASS] Control 1 PASSED: Matching identity admitted to /protected (verification delta > 0)')
        control1Passed = true
      } else {
        throw new Error(`Control 1 failed: url=${protectedUrl}, hasVerified=${hasVerified}, vDelta=${vDelta}`)
      }

      await context.close()
    }

    // =========================================================================
    // Control 2: Policy Distinction Control (Older Session + access_denied)
    // =========================================================================
    if (mode === 'all' || mode === 'controls') {
      console.log('\n============================================================')
      console.log('Control 2: Policy Distinction Control (Older Session + access_denied)')
      console.log('============================================================')

      const context = await browser.newContext()
      // Seed older valid session cookie
      const olderSession = {
        access_token: 'valid-older-token',
        refresh_token: 'refresh-older-101',
        token_type: 'bearer',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: 'user-older-101', email: 'older101@rpr.ac.th' },
      }
      const rawJson = JSON.stringify(olderSession)
      const b64 = Buffer.from(rawJson).toString('base64url')
      const hostPart = new URL(nuxtBaseUrl).hostname
      await context.addCookies([{
        name: 'sb-127-auth-token',
        value: `base64-${b64}`,
        domain: hostPart,
        path: '/',
      }])

      const page = await context.newPage()

      // Receive access_denied callback
      await page.goto(`${nuxtBaseUrl}/auth/callback?error=access_denied&error_description=User+cancelled`)
      await page.waitForTimeout(800)

      const errorText = await page.locator('.error-text').textContent()
      console.log(`  [INFO] Callback error notice: ${sanitizeText(errorText)}`)

      // Return to home
      await page.click('a:has-text("Return to Public Home")')
      await page.waitForTimeout(400)

      // Deliberate SPA click to /protected
      const vBefore = verificationCount
      await page.click('#test-protected-btn')
      await page.waitForTimeout(800)
      const vAfter = verificationCount

      const protectedUrl = sanitizeUrl(page.url())
      const protectedContent = await page.content()
      const hasVerified = protectedContent.includes('Authentication Verified')
      const hasOlderUser = protectedContent.includes('older101@rpr.ac.th')

      console.log(`  [INFO] URL after SPA click: ${protectedUrl}`)
      console.log(`  [INFO] Auth verification delta: ${vAfter - vBefore}`)
      console.log(`  [INFO] Displays older101@rpr.ac.th: ${hasOlderUser}`)

      if (protectedUrl === '/protected' && hasVerified && hasOlderUser) {
        console.log('  [PASS] Control 2 PASSED: Older valid session preserved and admitted to /protected')
        control2Passed = true
      } else {
        throw new Error(`Control 2 failed: url=${protectedUrl}, hasOlderUser=${hasOlderUser}`)
      }

      await context.close()
    }

    // =========================================================================
    // Control 3: Absent-Session Route Protection Control
    // =========================================================================
    if (mode === 'all' || mode === 'controls') {
      console.log('\n============================================================')
      console.log('Control 3: Absent-Session Route Protection Control (SPA Click)')
      console.log('============================================================')

      const context = await browser.newContext()
      const page = await context.newPage()

      await page.goto(`${nuxtBaseUrl}/`)
      await page.waitForTimeout(400)

      // Deliberate SPA click on protected button without session
      await page.click('#test-protected-btn')
      await page.waitForTimeout(800)

      const currentUrl = sanitizeUrl(page.url())
      const content = await page.content()
      const hasAccessDenied = content.includes('Access Denied:')

      console.log(`  [INFO] URL after click: ${currentUrl}`)
      console.log(`  [INFO] Shows "Access Denied:" alert: ${hasAccessDenied}`)

      if (currentUrl === '/?auth_required=true' && hasAccessDenied) {
        console.log('  [PASS] Control 3 PASSED: Absent session correctly redirected to /?auth_required=true')
        control3Passed = true
      } else {
        throw new Error(`Control 3 failed: expected redirect to /?auth_required=true, got ${currentUrl}`)
      }

      await context.close()
    }

    // =========================================================================
    // Contract 1: Mismatch Policy Contract (Deliberate SPA Click & Hard Reload)
    // =========================================================================
    if (mode === 'all' || mode === 'contract') {
      console.log('\n============================================================')
      console.log('Contract 1: Mismatch Policy Contract (SPA Click & Hard Reload)')
      console.log('============================================================')

      const context = await browser.newContext()
      const page = await context.newPage()

      // 1. Establish PKCE verifier cookie via Google sign in button
      await page.goto(`${nuxtBaseUrl}/`)
      await page.route('**/auth/v1/authorize*', (route) => route.abort())
      try {
        await page.click('#google-signin-btn')
      } catch {
        // Expected route abort on OAuth redirection
      }
      await page.waitForTimeout(300)

      // 2. Mismatched callback
      await page.goto(`${nuxtBaseUrl}/auth/callback?code=mismatch-code-1`)
      await page.waitForTimeout(800)

      // Assert error notice rendered
      const errorText = await page.locator('.error-text').textContent()
      console.log(`  [INFO] Callback error text: ${sanitizeText(errorText)}`)

      // Assert explicit local-scope logout request occurred and forbid global scope
      const localLogouts = logoutRequests.filter((r) => r.url.includes('scope=local'))
      const globalLogouts = logoutRequests.filter((r) => r.url.includes('scope=global'))
      console.log(`  [INFO] Explicit local-scope logout count: ${localLogouts.length}`)
      console.log(`  [INFO] Global-scope logout count: ${globalLogouts.length}`)

      // 3. Click Return to Public Home
      await page.click('a:has-text("Return to Public Home")')
      await page.waitForTimeout(400)
      console.log(`  [INFO] Home URL: ${sanitizeUrl(page.url())}`)

      // 4. Deliberate SPA click to /protected via #test-protected-btn
      const vBefore = verificationCount
      await page.click('#test-protected-btn')
      await page.waitForTimeout(800)
      const vAfter = verificationCount

      const protectedUrl = sanitizeUrl(page.url())
      const protectedContent = await page.content()
      const hasVerified = protectedContent.includes('Authentication Verified')
      const hasUserA = protectedContent.includes('userA@rpr.ac.th')
      const hasUserB = protectedContent.includes('userB@rpr.ac.th')
      const hasAccessDenied = protectedContent.includes('Access Denied:')

      console.log(`  [INFO] Path after deliberate SPA click: ${protectedUrl}`)
      console.log(`  [INFO] Auth verification delta: ${vAfter - vBefore}`)
      console.log(`  [INFO] Shows "Authentication Verified": ${hasVerified}`)
      console.log(`  [INFO] Shows userA@rpr.ac.th: ${hasUserA}`)
      console.log(`  [INFO] Shows userB@rpr.ac.th: ${hasUserB}`)
      console.log(`  [INFO] Shows "Access Denied:": ${hasAccessDenied}`)

      // 5. Separately perform a fresh document request to /protected (not reload of redirected public home)
      const ssrVBefore = verificationCount
      await page.goto(`${nuxtBaseUrl}/protected`)
      await page.waitForTimeout(800)
      const ssrVAfter = verificationCount
      const ssrVDelta = ssrVAfter - ssrVBefore

      const ssrUrl = sanitizeUrl(page.url())
      const ssrContent = await page.content()
      const ssrHasVerified = ssrContent.includes('Authentication Verified')
      const ssrHasUserA = ssrContent.includes('userA@rpr.ac.th')
      const ssrHasUserB = ssrContent.includes('userB@rpr.ac.th')
      const ssrHasAccessDenied = ssrContent.includes('Access Denied:')

      console.log(`  [INFO] Path after fresh /protected SSR request: ${ssrUrl}`)
      console.log(`  [INFO] Fresh /protected SSR verification delta: ${ssrVDelta}`)
      console.log(`  [INFO] Fresh SSR shows "Authentication Verified": ${ssrHasVerified}`)
      console.log(`  [INFO] Fresh SSR shows userA@rpr.ac.th: ${ssrHasUserA}`)
      console.log(`  [INFO] Fresh SSR shows userB@rpr.ac.th: ${ssrHasUserB}`)
      console.log(`  [INFO] Fresh SSR shows "Access Denied:": ${ssrHasAccessDenied}`)

      // Contract Evaluation:
      // Under Gate 0 policy:
      // 1. Explicit local logout count > 0 and global logout count === 0
      // 2. Deliberate SPA click redirects to /?auth_required=true and does not show A or B
      // 3. Fresh document request to /protected redirects to /?auth_required=true and does not show A or B
      const logoutOk = localLogouts.length > 0 && globalLogouts.length === 0
      const spaOk = protectedUrl === '/?auth_required=true' && !hasVerified && !hasUserA && !hasUserB && hasAccessDenied
      const ssrOk = ssrUrl === '/?auth_required=true' && !ssrHasVerified && !ssrHasUserA && !ssrHasUserB && ssrHasAccessDenied

      if (logoutOk && spaOk && ssrOk) {
        console.log('  [PASS] Contract 1 PASSED: Ambiguous identity quarantined, local logout confirmed, SPA click and fresh /protected SSR request failed closed')
        contractPassed = true
      } else {
        console.log('  [RED CONTRACT] Contract 1 FAILS RED:')
        if (!logoutOk) {
          console.log(`                 Logout check failed: localLogouts=${localLogouts.length}, globalLogouts=${globalLogouts.length}`)
        }
        if (!spaOk) {
          console.log(`                 SPA click failed: url="${protectedUrl}", verified=${hasVerified}, userA=${hasUserA}, userB=${hasUserB}`)
        }
        if (!ssrOk) {
          console.log(`                 Fresh /protected SSR request failed: url="${ssrUrl}", verified=${ssrHasVerified}, userA=${ssrHasUserA}, userB=${ssrHasUserB}`)
        }
        contractPassed = false
      }

      await context.close()
    }

    console.log('\n============================================================')
    console.log(`[SUITE SUMMARY] Mode: ${mode}`)
    let exitCode = 0
    if (mode === 'controls') {
      const allControlsPassed = control1Passed && control2Passed && control3Passed
      console.log(`Controls Status: ${allControlsPassed ? 'ALL PASSED' : 'SOME FAILED'}`)
      console.log('============================================================')
      if (!allControlsPassed) exitCode = 1
    } else if (mode === 'contract') {
      console.log(`Contract Status: ${contractPassed ? 'PASSED (GREEN)' : 'FAILED (RED)'}`)
      console.log('============================================================')
      if (!contractPassed) exitCode = 1
    } else {
      // 'all'
      const allControlsPassed = control1Passed && control2Passed && control3Passed
      console.log(`Controls: ${allControlsPassed ? 'ALL PASSED' : 'SOME FAILED'} | Policy Contract: ${contractPassed ? 'PASSED (GREEN)' : 'FAILED (RED)'}`)
      console.log('============================================================')
      if (!allControlsPassed || !contractPassed) {
        exitCode = 1
      }
    }
    if (exitCode !== 0) {
      process.exitCode = exitCode
    }
  } finally {
    await cleanup()
  }
}

runBrowserDiagnostic().catch(async (err) => {
  console.error('[FATAL ERROR in browser diagnostic]:', sanitizeText(err?.message || err))
  await cleanup()
  process.exit(1)
})
