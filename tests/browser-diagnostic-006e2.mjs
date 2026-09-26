import http from 'http'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { stringToBase64URL } from '@supabase/ssr'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Handoff 006E2A: Repaired Browser Regression Diagnostic Runner
 *
 * Investigates:
 * Can a previously valid older session, which becomes invalid after a denied
 * OAuth callback and home-page hydration, still open /protected through a
 * deliberate client-side Vue-router click without a fresh Auth verification?
 *
 * Core Fixes in 006E2A:
 * 1. Process Cleanup: Guarantees browser, child Nuxt server, and loopback stub
 *    are fully terminated and awaited on every exit path without process leaks.
 * 2. Readiness & Error Hygiene: Explicit readiness failure timeout; sanitized logs.
 * 3. Hard-Reload Control: Explicitly asserted as a passing control (not just logged).
 * 4. Honest Controls: Distinguishes current-behavior route-rendering control from
 *    the two expected RED navigation policy contracts (revoked token and still-valid token).
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
let tokenMode = 'valid' // 'valid' | 'rejected'
let currentStep = 'init'

function sanitizePath(url) {
  if (!url) return ''
  try {
    const u = new URL(url)
    return u.pathname + u.search + u.hash
  } catch {
    return url.replace(/https?:\/\/[^\s/]+/g, '')
  }
}

function sanitizeError(err) {
  let msg = err && err.message ? String(err.message) : 'Unknown error'
  return msg
    .replace(/https?:\/\/[^\s]+/g, '[REDACTED_URL]')
    .replace(/valid-older-token/g, '[REDACTED_TOKEN]')
    .replace(/older101@rpr\.ac\.th/g, '[REDACTED_EMAIL]')
    .replace(/user-older-101/g, '[REDACTED_ID]')
    .replace(/base64-[A-Za-z0-9_-]+/g, '[REDACTED_COOKIE]')
}

function createSupabaseCookieValue(accessToken, email, id) {
  const session = {
    access_token: accessToken,
    refresh_token: 'refresh-' + id,
    token_type: 'bearer',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id, email },
  }
  return 'base64-' + stringToBase64URL(JSON.stringify(session))
}

async function startStubServer() {
  currentStep = 'startStubServer'
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
      verificationCount++
      const authHeader = req.headers.authorization
      if (tokenMode === 'valid' && authHeader === 'Bearer valid-older-token') {
        res.writeHead(200, corsHeaders)
        res.end(JSON.stringify({ id: 'user-older-101', email: 'older101@rpr.ac.th' }))
      } else {
        res.writeHead(401, corsHeaders)
        res.end(JSON.stringify({ message: 'Invalid JWT token' }))
      }
    } else {
      res.writeHead(404, corsHeaders)
      res.end(JSON.stringify({ message: 'Not found' }))
    }
  })

  await new Promise((resolve) => stubServer.listen(0, '127.0.0.1', resolve))
  const stubPort = stubServer.address().port
  stubBaseUrl = `http://127.0.0.1:${stubPort}`
}

async function startNuxtServer() {
  currentStep = 'startNuxtServer'
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
    stdio: 'pipe',
  })

  // Prevent pipe buffer saturation and retain recent stderr for failure diagnostics
  const stderrBuffer = []
  nuxtProc.stderr.on('data', (chunk) => {
    stderrBuffer.push(chunk.toString())
    if (stderrBuffer.length > 20) stderrBuffer.shift()
  })
  nuxtProc.stdout.resume()

  const start = Date.now()
  let isReady = false
  while (Date.now() - start < 7000) {
    try {
      const res = await fetch(`${nuxtBaseUrl}/`)
      if (res.status === 200) {
        isReady = true
        break
      }
    } catch {
      await new Promise((r) => setTimeout(r, 50))
    }
  }

  if (!isReady) {
    const errDetails = stderrBuffer.length > 0 ? `: ${stderrBuffer.join(' ').trim()}` : ''
    throw new Error(`Built Nuxt server failed to reach HTTP ready state within 7000ms${errDetails}`)
  }
}

async function cleanup() {
  if (browser) {
    try {
      await browser.close()
    } catch {}
    browser = null
  }

  if (nuxtProc && nuxtProc.exitCode === null && nuxtProc.signalCode === null) {
    try {
      await new Promise((resolve) => {
        let resolved = false
        const done = () => {
          if (!resolved) {
            resolved = true
            clearTimeout(timer)
            resolve()
          }
        }
        const timer = setTimeout(() => {
          try {
            nuxtProc.kill('SIGKILL')
          } catch {}
          done()
        }, 2000)

        nuxtProc.once('close', done)
        nuxtProc.once('exit', done)
        try {
          nuxtProc.kill('SIGTERM')
        } catch {
          done()
        }
      })
    } catch {}
    nuxtProc = null
  }

  if (stubServer) {
    try {
      await new Promise((resolve) => {
        stubServer.close(() => resolve())
        setTimeout(resolve, 1000)
      })
    } catch {}
    stubServer = null
  }
}

process.on('SIGINT', async () => {
  await cleanup()
  process.exit(130)
})

process.on('SIGTERM', async () => {
  await cleanup()
  process.exit(143)
})

// -----------------------------------------------------------------------------
// Controls (All Passing)
// -----------------------------------------------------------------------------

/**
 * Control 1: Current-Behavior Route-Rendering Control
 * Tests that with a still-valid token, clicking /protected enters the route and
 * renders the verified identity. Documents that request delta is 0 under current code.
 */
async function runRouteRenderingControl() {
  currentStep = 'runRouteRenderingControl'
  console.log('\n============================================================')
  console.log('Control 1: Current-Behavior Route-Rendering Control (Still-Valid Session)')
  console.log('============================================================')

  tokenMode = 'valid'
  verificationCount = 0

  const context = await browser.newContext()
  const cookieValue = createSupabaseCookieValue('valid-older-token', 'older101@rpr.ac.th', 'user-older-101')
  await context.addCookies([
    {
      name: 'sb-127-auth-token',
      value: cookieValue,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
  ])

  const page = await context.newPage()

  try {
    // 1. Open denied callback
    await page.goto(`${nuxtBaseUrl}/auth/callback?error=access_denied&error_description=User+cancelled`)
    const noticeText = await page.locator('.error-text').textContent()
    const callbackSuccessLinkCount = await page.locator('.callback-card a[href="/protected"]').count()
    const continueButtonCount = await page.locator('a:has-text("Continue to Protected Area")').count()

    if (!noticeText.includes('access_denied')) {
      throw new Error(`Expected callback notice to contain 'access_denied'`)
    }
    if (callbackSuccessLinkCount !== 0 || continueButtonCount !== 0) {
      throw new Error(`Expected no protected success link on callback error page`)
    }
    console.log('  [PASS] Step 1: Callback denied rendered without protected success link')

    // 2. Return to home and wait for hydration
    await page.click('a[href="/"]')
    await page.waitForURL(`${nuxtBaseUrl}/`)
    await page.waitForSelector('.status-authenticated', { timeout: 3000 })
    const homeText = await page.locator('.detail-value').first().textContent()
    if (!homeText.includes('older101@rpr.ac.th')) {
      throw new Error(`Expected home to show verified user email`)
    }
    console.log('  [PASS] Step 2: Home page hydrated with active verified session')

    // Settle pending requests
    await page.waitForTimeout(300)
    const countBeforeClick = verificationCount

    // 3. Token remains valid -> Click /protected
    await page.click('#test-protected-btn')
    await page.waitForTimeout(500)

    const finalUrl = page.url()
    const bodyContent = await page.textContent('body')
    const showsVerified = bodyContent.includes('Authentication Verified') && bodyContent.includes('older101@rpr.ac.th')
    const countAfterClick = verificationCount
    const delta = countAfterClick - countBeforeClick

    console.log(`  [INFO] Path after click: ${sanitizePath(finalUrl)}`)
    console.log(`  [INFO] Auth verification hits before: ${countBeforeClick}, after: ${countAfterClick}, delta: ${delta}`)
    console.log(`  [INFO] Shows "Authentication Verified": ${showsVerified}`)

    if (!finalUrl.includes('/protected') || !showsVerified) {
      throw new Error(`Route-rendering control failed: Expected /protected with verified banner, got path: ${sanitizePath(finalUrl)}`)
    }

    console.log(`  [PASS] Control 1 PASSED: Protected route and verified identity rendered (verification delta: ${delta})`)
    return { success: true, delta, finalUrl }
  } finally {
    await context.close()
  }
}

/**
 * Control 2: Absent-Session Route Protection Control
 * Tests that without a session, clicking /protected redirects to /?auth_required=true.
 */
async function runAbsentSessionControl() {
  currentStep = 'runAbsentSessionControl'
  console.log('\n============================================================')
  console.log('Control 2: Absent-Session Route Protection Control')
  console.log('============================================================')

  verificationCount = 0
  const context = await browser.newContext() // No cookies
  const page = await context.newPage()

  try {
    // 1. Open denied callback
    await page.goto(`${nuxtBaseUrl}/auth/callback?error=access_denied&error_description=User+cancelled`)
    const noticeText = await page.locator('.error-text').textContent()
    const callbackSuccessLinkCount = await page.locator('.callback-card a[href="/protected"]').count()

    if (!noticeText.includes('access_denied')) {
      throw new Error(`Expected callback notice to contain 'access_denied'`)
    }
    if (callbackSuccessLinkCount !== 0) {
      throw new Error(`Expected 0 links to /protected on callback error page`)
    }
    console.log('  [PASS] Step 1: Callback denied rendered without protected link')

    // 2. Return to home
    await page.click('a[href="/"]')
    await page.waitForURL(`${nuxtBaseUrl}/`)
    await page.waitForSelector('.status-unauthenticated', { timeout: 3000 })
    console.log('  [PASS] Step 2: Home page shows unauthenticated visitor status')

    // 3. Click /protected
    await page.click('#test-protected-btn')
    await page.waitForTimeout(500)

    const finalUrl = page.url()
    const bodyContent = await page.textContent('body')
    const showsVerified = bodyContent.includes('Authentication Verified')

    console.log(`  [INFO] Path after click: ${sanitizePath(finalUrl)}`)
    console.log(`  [INFO] Shows "Authentication Verified": ${showsVerified}`)

    if (!finalUrl.includes('/?auth_required=true') || showsVerified) {
      throw new Error(`Absent control failed: Expected redirect to /?auth_required=true, got: ${sanitizePath(finalUrl)}`)
    }

    console.log('  [PASS] Control 2 PASSED: Absent session correctly redirected to /?auth_required=true')
    return { success: true, finalUrl }
  } finally {
    await context.close()
  }
}

/**
 * Control 3: Hard-Reload Revocation Control
 * Proves that server-side SSR verification against the loopback stub DOES occur on hard reload,
 * rejecting the revoked token and redirecting to /?auth_required=true.
 */
async function runHardReloadControl() {
  currentStep = 'runHardReloadControl'
  console.log('\n============================================================')
  console.log('Control 3: Hard-Reload Revocation Control (Server SSR Re-Verification)')
  console.log('============================================================')

  tokenMode = 'valid'
  verificationCount = 0

  const context = await browser.newContext()
  const cookieValue = createSupabaseCookieValue('valid-older-token', 'older101@rpr.ac.th', 'user-older-101')
  await context.addCookies([
    {
      name: 'sb-127-auth-token',
      value: cookieValue,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
  ])

  const page = await context.newPage()

  try {
    // 1. Callback denied and return home
    await page.goto(`${nuxtBaseUrl}/auth/callback?error=access_denied&error_description=User+cancelled`)
    await page.click('a[href="/"]')
    await page.waitForURL(`${nuxtBaseUrl}/`)
    await page.waitForSelector('.status-authenticated', { timeout: 3000 })

    // 2. Enter /protected while synthetic token is VALID
    await page.click('#test-protected-btn')
    await page.waitForTimeout(500)
    const initialUrl = page.url()
    const initialContent = await page.textContent('body')
    const initiallyVerified = initialContent.includes('Authentication Verified') && initialContent.includes('older101@rpr.ac.th')

    if (!initialUrl.includes('/protected') || !initiallyVerified) {
      throw new Error(`Hard-reload setup failed: could not enter /protected with valid token, got URL: ${sanitizePath(initialUrl)}`)
    }
    console.log('  [PASS] Step 1: Entered /protected with valid session and verified identity')

    // 3. Now revoke token on stub while on already-open /protected page
    tokenMode = 'rejected'

    // 4. Assert Hard Reload Control: MUST re-verify against stub, receive 401, and redirect
    const countBeforeReload = verificationCount
    await page.reload()
    await page.waitForTimeout(500)

    const reloadUrl = page.url()
    const reloadDelta = verificationCount - countBeforeReload
    const reloadContent = await page.textContent('body')
    const reloadShowsVerified = reloadContent.includes('Authentication Verified')

    console.log(`  [INFO] Reload path: ${sanitizePath(reloadUrl)}`)
    console.log(`  [INFO] Reload verification delta: ${reloadDelta}`)
    console.log(`  [INFO] Reload shows "Authentication Verified": ${reloadShowsVerified}`)

    if (reloadDelta <= 0) {
      throw new Error(`Hard-reload control FAILED: Expected fresh verification request (delta > 0), got: ${reloadDelta}`)
    }
    if (!reloadUrl.includes('/?auth_required=true')) {
      throw new Error(`Hard-reload control FAILED: Expected redirect to /?auth_required=true, got path: ${sanitizePath(reloadUrl)}`)
    }
    if (reloadShowsVerified) {
      throw new Error(`Hard-reload control FAILED: Page unexpectedly displayed "Authentication Verified" banner after reload`)
    }

    console.log('  [PASS] Control 3 PASSED: Hard reload triggered fresh server verification (delta > 0) and redirected to /?auth_required=true')
    return { success: true, reloadDelta, reloadUrl }
  } finally {
    await context.close()
  }
}

// -----------------------------------------------------------------------------
// Expected RED Navigation Policy Contracts
// -----------------------------------------------------------------------------

/**
 * Contract 1 (Expected RED): Revoked-Session Navigation Policy Contract
 * Expected policy: deliberate SPA navigation to /protected after token revocation MUST
 * issue a fresh verification request (delta > 0) and redirect to /?auth_required=true.
 * Current production behavior: delta === 0, stays on /protected with verified banner.
 */
async function runRevokedSessionContractTest() {
  currentStep = 'runRevokedSessionContractTest'
  console.log('\n============================================================')
  console.log('Contract 1 (Expected RED): Revoked-Session Navigation Policy Contract')
  console.log('============================================================')

  tokenMode = 'valid'
  verificationCount = 0

  const context = await browser.newContext()
  const cookieValue = createSupabaseCookieValue('valid-older-token', 'older101@rpr.ac.th', 'user-older-101')
  await context.addCookies([
    {
      name: 'sb-127-auth-token',
      value: cookieValue,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
  ])

  const page = await context.newPage()

  try {
    // 1. Open denied callback
    await page.goto(`${nuxtBaseUrl}/auth/callback?error=access_denied&error_description=User+cancelled`)
    // 2. Return Home
    await page.click('a[href="/"]')
    await page.waitForURL(`${nuxtBaseUrl}/`)
    await page.waitForSelector('.status-authenticated', { timeout: 3000 })
    await page.waitForTimeout(300)

    const countBeforeClick = verificationCount

    // 3. Revoke token on Auth endpoint
    tokenMode = 'rejected'

    // 4. Deliberately click #test-protected-btn (client-side SPA navigation)
    await page.click('#test-protected-btn')
    await page.waitForTimeout(500)

    const countAfterClick = verificationCount
    const delta = countAfterClick - countBeforeClick
    const currentUrl = page.url()
    const bodyContent = await page.textContent('body')
    const showsVerified = bodyContent.includes('Authentication Verified')

    console.log(`  [INFO] Path after SPA click: ${sanitizePath(currentUrl)}`)
    console.log(`  [INFO] Verification hits before: ${countBeforeClick}, after: ${countAfterClick}, delta: ${delta}`)
    console.log(`  [INFO] Shows "Authentication Verified": ${showsVerified}`)

    // Contract requirement: delta > 0 AND redirected to /?auth_required=true AND !showsVerified
    const contractMet = delta > 0 && currentUrl.includes('/?auth_required=true') && !showsVerified

    if (!contractMet) {
      console.log('\n  >>> CONTRACT 1 VIOLATION DETECTED (EXPECTED RED) <<<')
      console.log(`  - Expected verification delta > 0, received: ${delta}`)
      console.log(`  - Expected redirect to /?auth_required=true, stayed on: ${sanitizePath(currentUrl)}`)
      console.log(`  - Expected NO verified banner, banner was: ${showsVerified ? 'PRESENT' : 'ABSENT'}`)
      console.log('  Root Cause: app/middleware/auth.ts:28-33 skips checkVerifiedUser() because auth.user.value?.signedIn was cached.')
      return { passed: false, delta, currentUrl, showsVerified }
    }

    console.log('  [PASS] Contract 1 PASSED: Revoked session fresh verification triggered redirect to /?auth_required=true')
    return { passed: true, delta, currentUrl, showsVerified }
  } finally {
    await context.close()
  }
}

/**
 * Contract 2 (Expected RED): Still-Valid Session Navigation Policy Contract
 * Expected policy: deliberate SPA navigation to /protected MUST trigger a fresh
 * verification request (delta > 0) on navigation even when the token is still valid.
 * Current production behavior: delta === 0 (relies purely on cached client state).
 */
async function runStillValidNavigationContractTest() {
  currentStep = 'runStillValidNavigationContractTest'
  console.log('\n============================================================')
  console.log('Contract 2 (Expected RED): Still-Valid Session Navigation Policy Contract')
  console.log('============================================================')

  tokenMode = 'valid'
  verificationCount = 0

  const context = await browser.newContext()
  const cookieValue = createSupabaseCookieValue('valid-older-token', 'older101@rpr.ac.th', 'user-older-101')
  await context.addCookies([
    {
      name: 'sb-127-auth-token',
      value: cookieValue,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
  ])

  const page = await context.newPage()

  try {
    // 1. Open denied callback and return home
    await page.goto(`${nuxtBaseUrl}/auth/callback?error=access_denied&error_description=User+cancelled`)
    await page.click('a[href="/"]')
    await page.waitForURL(`${nuxtBaseUrl}/`)
    await page.waitForSelector('.status-authenticated', { timeout: 3000 })
    await page.waitForTimeout(300)

    const countBeforeClick = verificationCount

    // 2. Token remains valid -> Click /protected
    await page.click('#test-protected-btn')
    await page.waitForTimeout(500)

    const countAfterClick = verificationCount
    const delta = countAfterClick - countBeforeClick
    const currentUrl = page.url()
    const bodyContent = await page.textContent('body')
    const showsVerified = bodyContent.includes('Authentication Verified')

    console.log(`  [INFO] Path after SPA click: ${sanitizePath(currentUrl)}`)
    console.log(`  [INFO] Verification hits before: ${countBeforeClick}, after: ${countAfterClick}, delta: ${delta}`)
    console.log(`  [INFO] Shows "Authentication Verified": ${showsVerified}`)

    // Contract requirement: delta > 0 on navigation AND allowed on /protected
    const contractMet = delta > 0 && currentUrl.includes('/protected') && showsVerified

    if (!contractMet) {
      console.log('\n  >>> CONTRACT 2 VIOLATION DETECTED (EXPECTED RED) <<<')
      console.log(`  - Expected verification delta > 0 on navigation, received: ${delta}`)
      console.log(`  - Path: ${sanitizePath(currentUrl)}, Shows verified: ${showsVerified}`)
      console.log('  Root Cause: app/middleware/auth.ts:28-33 skips checkVerifiedUser() because auth.user.value?.signedIn was cached.')
      return { passed: false, delta, currentUrl, showsVerified }
    }

    console.log('  [PASS] Contract 2 PASSED: Still-valid session fresh verification triggered and route allowed')
    return { passed: true, delta, currentUrl, showsVerified }
  } finally {
    await context.close()
  }
}

// -----------------------------------------------------------------------------
// Main Runner with Guaranteed Clean Process Exit
// -----------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2)
  const mode = args.find((a) => a.startsWith('--case='))?.split('=')[1] || 'all'

  console.log('============================================================')
  console.log('Handoff 006E2A: Repaired Browser Regression Diagnostic')
  console.log(`Playwright Module: ${playwrightModulePath}`)
  console.log(`Built Server:      ${builtServerPath}`)
  console.log(`Mode:              ${mode}`)
  console.log('============================================================')

  let exitCode = 0

  try {
    await startStubServer()
    await startNuxtServer()
    browser = await chromium.launch({ headless: true })

    if (mode === 'controls') {
      await runRouteRenderingControl()
      await runAbsentSessionControl()
      await runHardReloadControl()
      console.log('\n[SUMMARY] All 3 controls PASSED successfully.')
      exitCode = 0
    } else if (mode === 'red' || mode === 'contracts') {
      const red1 = await runRevokedSessionContractTest()
      const red2 = await runStillValidNavigationContractTest()

      if (!red1.passed && !red2.passed) {
        console.log('\n[SUMMARY] Both navigation policy contracts FAILED RED as expected against current code.')
        exitCode = 1
      } else if (red1.passed && red2.passed) {
        console.log('\n[SUMMARY] Both navigation policy contracts PASSED.')
        exitCode = 0
      } else {
        console.log('\n[SUMMARY] Partial contract outcome: one passed, one failed.')
        exitCode = 1
      }
    } else if (mode === 'contract1' || mode === 'revoked') {
      const red1 = await runRevokedSessionContractTest()
      exitCode = red1.passed ? 0 : 1
    } else if (mode === 'contract2' || mode === 'still-valid') {
      const red2 = await runStillValidNavigationContractTest()
      exitCode = red2.passed ? 0 : 1
    } else {
      // Default: run all 3 controls + both RED contracts
      await runRouteRenderingControl()
      await runAbsentSessionControl()
      await runHardReloadControl()
      const red1 = await runRevokedSessionContractTest()
      const red2 = await runStillValidNavigationContractTest()

      if (!red1.passed && !red2.passed) {
        console.log('\n============================================================')
        console.log('[SUITE SUMMARY] 3 Controls PASSED | 2 Contracts FAILED RED (as intended)')
        console.log('============================================================')
        exitCode = 1
      } else if (red1.passed && red2.passed) {
        console.log('\n============================================================')
        console.log('[SUITE SUMMARY] 3 Controls PASSED | 2 Contracts PASSED')
        console.log('============================================================')
        exitCode = 0
      } else {
        console.log('\n============================================================')
        console.log('[SUITE SUMMARY] 3 Controls PASSED | Partial Contract Failure')
        console.log('============================================================')
        exitCode = 1
      }
    }
  } catch (err) {
    console.error(`\n[FATAL ERROR] Step: ${currentStep}, Category: ${err?.name || 'Error'}: ${sanitizeError(err)}`)
    exitCode = 2
  } finally {
    await cleanup()
  }

  process.exit(exitCode)
}

main()
