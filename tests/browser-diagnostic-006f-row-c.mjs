import http from 'http'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Handoff 006F — Row C: Rendered Successful Callback & Route Continuation Browser Diagnostic
 *
 * Core Requirements:
 * 1. Fresh built Nuxt server + controlled loopback Auth + Playwright.
 * 2. Matching exchange / verified identity displays the correct success UI (.state-success, "Authentication Succeeded", user email).
 * 3. Auto-navigates to /protected without clicking any button (proving callback.vue setTimeout auto-navigation).
 * 4. Hard reload of /protected persists verified authentication on /protected.
 * 5. Separately assert denied callback (access_denied), invalid authorization code, and identity mismatch:
 *    - Render safe error notices.
 *    - NO .state-success rendered.
 *    - NO protected-success link (a[href="/protected"]) rendered.
 *    - NO automatic continuation (remains on /auth/callback).
 * 6. Browser/server cleanup and no raw tokens or error markers printed.
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

// Harness state
let stubServer = null
let nuxtProc = null
let browser = null
let stubBaseUrl = ''
let nuxtBaseUrl = ''
let verificationCount = 0

function sanitizeUrl(url) {
  if (!url) return ''
  try {
    return new URL(url).pathname
  } catch {
    return '[INVALID_URL]'
  }
}

function sanitizeText(text) {
  if (!text) return ''
  return String(text)
    .replace(/https?:\/\/[^\s/]+/g, '[REDACTED_URL]')
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
      stubServer.closeAllConnections?.()
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

    if (req.url?.includes('/token') || req.url?.includes('/auth/v1/token')) {
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
        } else if (parsed.auth_code === 'invalid-code-123') {
          res.writeHead(400, corsHeaders)
          res.end(JSON.stringify({
            error: 'invalid_grant',
            error_description: 'Invalid authorization code',
          }))
        } else {
          // Mismatch code: token issued for User A
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

      if (authHeader === 'Bearer token-matching-user-a') {
        res.writeHead(200, corsHeaders)
        res.end(JSON.stringify({ id: 'user-A', email: 'userA@rpr.ac.th' }))
      } else if (authHeader === 'Bearer token-mismatch-user-a') {
        // Mismatch: resolves to user-B
        res.writeHead(200, corsHeaders)
        res.end(JSON.stringify({ id: 'user-B', email: 'userB@rpr.ac.th' }))
      } else {
        res.writeHead(401, corsHeaders)
        res.end(JSON.stringify({ message: 'Unauthorized' }))
      }
      return
    }

    if (req.url?.includes('/logout') || req.url?.includes('/auth/v1/logout')) {
      res.writeHead(200, corsHeaders)
      res.end('{}')
      return
    }

    res.writeHead(404, corsHeaders)
    res.end(JSON.stringify({ message: 'Not found' }))
  })

  await new Promise((resolve) => {
    stubServer.listen(0, '127.0.0.1', () => {
      const addr = stubServer.address()
      stubBaseUrl = `http://127.0.0.1:${addr.port}`
      resolve()
    })
  })
}

function getFreePort() {
  return new Promise((resolve) => {
    const s = http.createServer()
    s.listen(0, '127.0.0.1', () => {
      const port = s.address().port
      s.close(() => resolve(port))
    })
  })
}

async function startBuiltNuxtServer() {
  const nuxtPort = await getFreePort()
  nuxtBaseUrl = `http://127.0.0.1:${nuxtPort}`

  const env = {
    ...process.env,
    PORT: String(nuxtPort),
    HOST: '127.0.0.1',
    NODE_ENV: 'production',
    NUXT_PUBLIC_SUPABASE_URL: stubBaseUrl,
    NUXT_PUBLIC_SUPABASE_KEY: 'test-anon-key',
    NUXT_PUBLIC_SITE_URL: nuxtBaseUrl,
  }

  nuxtProc = spawn('node', [builtServerPath], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  // Readiness poll
  const start = Date.now()
  let isReady = false
  while (Date.now() - start < 15000) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`${nuxtBaseUrl}/`, (res) => {
          if (res.statusCode === 200) resolve()
          else reject(new Error(`Status ${res.statusCode}`))
        })
        req.on('error', reject)
        req.setTimeout(500, () => {
          req.destroy()
          reject(new Error('timeout'))
        })
      })
      isReady = true
      break
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }

  if (!isReady) {
    throw new Error(`Nuxt server on port ${nuxtPort} failed to become ready within 15 seconds.`)
  }
}

async function runRowCDiagnostic() {
  console.log('============================================================')
  console.log('Handoff 006F — Row C: Rendered Successful Callback Diagnostic')
  console.log(`Playwright Module: ${playwrightModulePath}`)
  console.log(`Built Server:      ${builtServerPath}`)
  console.log('============================================================')

  let scenario1Passed = false
  let scenario2Passed = false
  let scenario3Passed = false
  let scenario4Passed = false

  try {
    await startStubServer()
    await startBuiltNuxtServer()

    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    // =========================================================================
    // Scenario 1: Matching Exchange & Rendered Success UI & Auto-Navigation & Hard Reload
    // =========================================================================
    console.log('\n============================================================')
    console.log('Scenario 1: Matching Exchange & Rendered Success UI & Auto-Navigation & Hard Reload')
    console.log('============================================================')
    {
      const context = await browser.newContext()
      const page = await context.newPage()

      // 1. Establish PKCE code verifier in browser session
      await page.goto(`${nuxtBaseUrl}/`)
      await page.route('**/auth/v1/authorize*', (route) => route.abort())
      try {
        await page.click('#google-signin-btn')
      } catch {}
      await page.waitForTimeout(300)

      // 2. Navigate to callback with matching code
      await page.goto(`${nuxtBaseUrl}/auth/callback?code=matching-code-a`)

      // Assert rendered .state-success box
      await page.waitForSelector('.state-success', { timeout: 4000 })
      const content = await page.content()

      const hasSuccessBox = await page.locator('.state-success').isVisible()
      const hasSuccessHeading = content.includes('Authentication Succeeded')
      const hasUserEmail = content.includes('userA@rpr.ac.th')
      const hasRedirectHint = content.includes('Redirecting to protected classroom route...')
      const hasProtectedLink = await page.locator('.state-success a[href="/protected"]').isVisible()

      console.log(`  [INFO] .state-success visible: ${hasSuccessBox}`)
      console.log(`  [INFO] Shows "Authentication Succeeded": ${hasSuccessHeading}`)
      console.log(`  [INFO] Displays "userA@rpr.ac.th": ${hasUserEmail}`)
      console.log(`  [INFO] Shows redirect hint: ${hasRedirectHint}`)
      console.log(`  [INFO] Contains success button to /protected: ${hasProtectedLink}`)

      if (!hasSuccessBox || !hasSuccessHeading || !hasUserEmail || !hasProtectedLink) {
        throw new Error('Scenario 1 failed: Rendered success UI did not match contract')
      }

      // 3. AUTO-NAVIGATION: Do NOT click any button. Wait for callback.vue's setTimeout(..., 1200)
      console.log('  [INFO] Waiting for automatic navigation to /protected (no manual click)...')
      await page.waitForURL('**/protected', { timeout: 4000 })

      const currentUrl = sanitizeUrl(page.url())
      const protectedContent = await page.content()
      const hasVerified = protectedContent.includes('Authentication Verified')
      const hasProtectedEmail = protectedContent.includes('userA@rpr.ac.th')

      console.log(`  [INFO] Path after auto-navigation: ${currentUrl}`)
      console.log(`  [INFO] /protected shows "Authentication Verified": ${hasVerified}`)
      console.log(`  [INFO] /protected displays "userA@rpr.ac.th": ${hasProtectedEmail}`)

      if (currentUrl !== '/protected' || !hasVerified || !hasProtectedEmail) {
        throw new Error(`Scenario 1 failed auto-navigation: url=${currentUrl}, verified=${hasVerified}`)
      }

      // 4. HARD RELOAD: Reload the protected page and assert authentication persists
      console.log('  [INFO] Performing hard reload of /protected...')
      await page.reload()
      await page.waitForTimeout(600)

      const reloadedUrl = sanitizeUrl(page.url())
      const reloadedContent = await page.content()
      const reloadedHasVerified = reloadedContent.includes('Authentication Verified')
      const reloadedHasEmail = reloadedContent.includes('userA@rpr.ac.th')

      console.log(`  [INFO] Path after hard reload: ${reloadedUrl}`)
      console.log(`  [INFO] Reloaded /protected shows "Authentication Verified": ${reloadedHasVerified}`)
      console.log(`  [INFO] Reloaded /protected displays "userA@rpr.ac.th": ${reloadedHasEmail}`)

      if (reloadedUrl !== '/protected' || !reloadedHasVerified || !reloadedHasEmail) {
        throw new Error(`Scenario 1 failed hard reload persistence: url=${reloadedUrl}`)
      }

      console.log('  [PASS] Scenario 1 PASSED: Success UI rendered, auto-navigated to /protected, hard reload persisted')
      scenario1Passed = true
      await context.close()
    }

    // =========================================================================
    // Scenario 2: Provider Denial (access_denied)
    // =========================================================================
    console.log('\n============================================================')
    console.log('Scenario 2: Provider Denial (access_denied)')
    console.log('============================================================')
    {
      const context = await browser.newContext()
      const page = await context.newPage()

      await page.goto(`${nuxtBaseUrl}/auth/callback?error=access_denied&error_description=Consent+denied`)
      await page.waitForSelector('.state-error', { timeout: 4000 })

      const errorText = await page.locator('.error-text').textContent()
      const hasErrorBox = await page.locator('.state-error').isVisible()
      const hasSuccessBox = await page.locator('.state-success').count() > 0
      const callbackProtectedLinkCount = await page.locator('.callback-card a[href="/protected"]').count()
      const returnHomeLink = await page.locator('.callback-card a[href="/"]').isVisible()

      console.log(`  [INFO] .state-error visible: ${hasErrorBox}`)
      console.log(`  [INFO] Safe error message: ${sanitizeText(errorText)}`)
      console.log(`  [INFO] .state-success present: ${hasSuccessBox}`)
      console.log(`  [INFO] Callback card link to /protected count: ${callbackProtectedLinkCount}`)
      console.log(`  [INFO] Return to Public Home link visible: ${returnHomeLink}`)

      // Wait 1600ms (more than the 1200ms auto-nav timer) to prove NO automatic navigation occurs
      await page.waitForTimeout(1600)
      const currentUrl = sanitizeUrl(page.url())
      console.log(`  [INFO] URL after 1600ms: ${currentUrl}`)

      const urlOk = currentUrl.startsWith('/auth/callback')
      const msgOk = errorText?.includes('OAuth sign-in was denied (access_denied)')
      const noSuccessOk = !hasSuccessBox && callbackProtectedLinkCount === 0 && returnHomeLink

      if (hasErrorBox && msgOk && noSuccessOk && urlOk) {
        console.log('  [PASS] Scenario 2 PASSED: Safe error displayed, no success UI, no protected link, no auto-continuation')
        scenario2Passed = true
      } else {
        throw new Error(`Scenario 2 failed: hasErrorBox=${hasErrorBox}, msgOk=${msgOk}, url=${currentUrl}`)
      }

      await context.close()
    }

    // =========================================================================
    // Scenario 3: Invalid Authorization Code
    // =========================================================================
    console.log('\n============================================================')
    console.log('Scenario 3: Invalid Authorization Code')
    console.log('============================================================')
    {
      const context = await browser.newContext()
      const page = await context.newPage()

      await page.goto(`${nuxtBaseUrl}/`)
      await page.route('**/auth/v1/authorize*', (route) => route.abort())
      try {
        await page.click('#google-signin-btn')
      } catch {}
      await page.waitForTimeout(300)

      await page.goto(`${nuxtBaseUrl}/auth/callback?code=invalid-code-123`)
      await page.waitForSelector('.state-error', { timeout: 4000 })

      const errorText = await page.locator('.error-text').textContent()
      const hasErrorBox = await page.locator('.state-error').isVisible()
      const hasSuccessBox = await page.locator('.state-success').count() > 0
      const callbackProtectedLinkCount = await page.locator('.callback-card a[href="/protected"]').count()
      const returnHomeLink = await page.locator('.callback-card a[href="/"]').isVisible()

      console.log(`  [INFO] .state-error visible: ${hasErrorBox}`)
      console.log(`  [INFO] Safe error message: ${sanitizeText(errorText)}`)
      console.log(`  [INFO] .state-success present: ${hasSuccessBox}`)
      console.log(`  [INFO] Callback card link to /protected count: ${callbackProtectedLinkCount}`)
      console.log(`  [INFO] Return to Public Home link visible: ${returnHomeLink}`)

      await page.waitForTimeout(1600)
      const currentUrl = sanitizeUrl(page.url())
      console.log(`  [INFO] URL after 1600ms: ${currentUrl}`)

      const urlOk = currentUrl.startsWith('/auth/callback')
      const msgOk = errorText?.includes('Failed to exchange authorization code')
      const noSuccessOk = !hasSuccessBox && callbackProtectedLinkCount === 0 && returnHomeLink

      if (hasErrorBox && msgOk && noSuccessOk && urlOk) {
        console.log('  [PASS] Scenario 3 PASSED: Invalid code rejected safely, no success UI, no auto-continuation')
        scenario3Passed = true
      } else {
        throw new Error(`Scenario 3 failed: hasErrorBox=${hasErrorBox}, msgOk=${msgOk}, url=${currentUrl}`)
      }

      await context.close()
    }

    // =========================================================================
    // Scenario 4: Identity Mismatch
    // =========================================================================
    console.log('\n============================================================')
    console.log('Scenario 4: Identity Mismatch')
    console.log('============================================================')
    {
      const context = await browser.newContext()
      const page = await context.newPage()

      await page.goto(`${nuxtBaseUrl}/`)
      await page.route('**/auth/v1/authorize*', (route) => route.abort())
      try {
        await page.click('#google-signin-btn')
      } catch {}
      await page.waitForTimeout(300)

      await page.goto(`${nuxtBaseUrl}/auth/callback?code=mismatch-code-1`)
      await page.waitForSelector('.state-error', { timeout: 4000 })

      const errorText = await page.locator('.error-text').textContent()
      const hasErrorBox = await page.locator('.state-error').isVisible()
      const hasSuccessBox = await page.locator('.state-success').count() > 0
      const callbackProtectedLinkCount = await page.locator('.callback-card a[href="/protected"]').count()
      const returnHomeLink = await page.locator('.callback-card a[href="/"]').isVisible()

      console.log(`  [INFO] .state-error visible: ${hasErrorBox}`)
      console.log(`  [INFO] Safe error message: ${sanitizeText(errorText)}`)
      console.log(`  [INFO] .state-success present: ${hasSuccessBox}`)
      console.log(`  [INFO] Callback card link to /protected count: ${callbackProtectedLinkCount}`)
      console.log(`  [INFO] Return to Public Home link visible: ${returnHomeLink}`)

      await page.waitForTimeout(1600)
      const currentUrl = sanitizeUrl(page.url())
      console.log(`  [INFO] URL after 1600ms: ${currentUrl}`)

      const urlOk = currentUrl.startsWith('/auth/callback')
      const msgOk = errorText?.includes('OAuth session identity could not be verified')
      const noSuccessOk = !hasSuccessBox && callbackProtectedLinkCount === 0 && returnHomeLink

      if (hasErrorBox && msgOk && noSuccessOk && urlOk) {
        console.log('  [PASS] Scenario 4 PASSED: Mismatch rejected safely, no success UI, no auto-continuation')
        scenario4Passed = true
      } else {
        throw new Error(`Scenario 4 failed: hasErrorBox=${hasErrorBox}, msgOk=${msgOk}, url=${currentUrl}`)
      }

      await context.close()
    }

    console.log('\n============================================================')
    console.log('[SUITE SUMMARY] Row C Rendered Successful Callback Diagnostic')
    const allPassed = scenario1Passed && scenario2Passed && scenario3Passed && scenario4Passed
    console.log(`Overall Status: ${allPassed ? 'ALL PASSED (GREEN)' : 'SOME FAILED (RED)'}`)
    console.log('============================================================')

    if (!allPassed) {
      process.exitCode = 1
    }
  } finally {
    await cleanup()
  }
}

runRowCDiagnostic().catch(async (err) => {
  console.error('[FATAL ERROR in Row C browser diagnostic]:', sanitizeText(err?.message || err))
  await cleanup()
  process.exit(1)
})
