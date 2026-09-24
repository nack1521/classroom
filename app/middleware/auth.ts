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

export default typeof defineNuxtRouteMiddleware === 'function'
  ? defineNuxtRouteMiddleware(async (to, from) => {
      const { user, isConfigured, checkVerifiedUser } = useAuth()

      if (!user.value?.signedIn && isConfigured) {
        await checkVerifiedUser()
      }

      const isAuthenticated = Boolean(user.value?.signedIn)
      return authGuard(to, from, isAuthenticated, (path) => navigateTo(path))
    })
  : (authGuard as any)
