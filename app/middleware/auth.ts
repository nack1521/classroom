import type { RouteLocationNormalized } from 'vue-router'
import { checkRouteAccess } from '../utils/auth'

/**
 * Pure guard function testable in isolation.
 */
export function authGuard(
  to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  isAuthenticated: boolean,
  redirectFn: (to: string) => any
) {
  const check = checkRouteAccess(to.path, isAuthenticated)
  if (!check.allowed && check.redirect) {
    return redirectFn(`${check.redirect}?auth_required=true`)
  }
}

/**
 * Route middleware handler executing authentication verification and route protection.
 */
export async function authMiddlewareHandler(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  auth: { user: { value: { signedIn: boolean } | null }; isConfigured: boolean; checkVerifiedUser: () => Promise<any> },
  redirectFn: (path: string) => any
) {
  const requiresAuth = !checkRouteAccess(to.path, false).allowed

  let isAuthenticated = false

  if (requiresAuth) {
    if (auth.isConfigured) {
      try {
        const verifiedResult = await auth.checkVerifiedUser()
        isAuthenticated = Boolean(verifiedResult?.signedIn)
      } catch {
        isAuthenticated = false
      }
    } else {
      isAuthenticated = false
    }
  } else {
    if (!auth.user.value?.signedIn && auth.isConfigured) {
      try {
        await auth.checkVerifiedUser()
      } catch {}
    }
    isAuthenticated = Boolean(auth.user.value?.signedIn)
  }

  return authGuard(to, from, isAuthenticated, redirectFn)
}

export default typeof defineNuxtRouteMiddleware === 'function'
  ? defineNuxtRouteMiddleware(async (to, from) => {
      const auth = useAuth()
      return authMiddlewareHandler(to, from, auth, (path) => navigateTo(path))
    })
  : (authGuard as any)
