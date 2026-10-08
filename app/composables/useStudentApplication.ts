import {
  type ClassRecord,
  type StudentApplicationRecord,
  type ValidatedApplicationInput,
  validateStudentApplicationInput,
} from '../utils/studentApplication'
import type { SafeUserDisplay } from '../utils/auth'

export function useStudentApplication() {
  const application = useState<StudentApplicationRecord | null>('student-application', () => null)
  const classes = useState<ClassRecord[]>('student-classes', () => [])
  const authUser = useState<SafeUserDisplay | null>('auth-user', () => null)
  const boundUserId = useState<string | null>('student-application-user-id', () => null)
  const stateGeneration = useState<number>('student-application-generation', () => 0)

  const isLoading = useState<boolean>('student-application-loading', () => false)
  const isSubmitting = useState<boolean>('student-application-submitting', () => false)
  const errorMessage = useState<string | null>('student-application-error', () => null)
  const fieldErrors = useState<Record<string, string>>('student-application-field-errors', () => ({}))
  const successMessage = useState<string | null>('student-application-success', () => null)

  /**
   * Resets and clears all cached student application state and notices.
   */
  function clearApplication() {
    stateGeneration.value++
    application.value = null
    boundUserId.value = null
    isLoading.value = false
    isSubmitting.value = false
    errorMessage.value = null
    fieldErrors.value = {}
    successMessage.value = null
  }

  // Immediately synchronize identity binding:
  // If application exists for a different user, clear it immediately
  const currentAuthId = authUser.value?.id || null
  if (currentAuthId) {
    if (application.value && application.value.user_id !== currentAuthId) {
      clearApplication()
      boundUserId.value = currentAuthId
    } else if (boundUserId.value && boundUserId.value !== currentAuthId) {
      clearApplication()
      boundUserId.value = currentAuthId
    } else if (!boundUserId.value) {
      boundUserId.value = currentAuthId
    }
  } else if (
    authUser.value === null &&
    (boundUserId.value !== null ||
      application.value !== null ||
      errorMessage.value !== null ||
      successMessage.value !== null)
  ) {
    clearApplication()
  }

  /**
   * Fetches the list of active classes.
   */
  async function fetchClasses(): Promise<ClassRecord[]> {
    try {
      const response = await $fetch<{ classes: ClassRecord[] }>('/api/classes')
      classes.value = response.classes || []
      return classes.value
    } catch (err: any) {
      errorMessage.value = err.data?.message || err.message || 'ไม่สามารถโหลดรายชื่อชั้นเรียนได้'
      return []
    }
  }

  /**
   * Fetches the current user's student application (if any).
   * Strictly identity-bound and race-protected:
   * - Clears cached application if user identity changed or unauthenticated.
   * - Invalidates prior in-flight fetches via state generation.
   * - Discards stale responses and errors so late responses from prior users cannot set errorMessage.
   * - On 401 or any fetch error for current user, guarantees application.value is set to null.
   */
  async function fetchMyApplication(): Promise<StudentApplicationRecord | null> {
    const gen = ++stateGeneration.value
    const expectedUserId = authUser.value?.id || null

    // If an application is cached and belongs to a different identity, clear immediately
    if (application.value && expectedUserId && application.value.user_id !== expectedUserId) {
      clearApplication()
      boundUserId.value = expectedUserId
    } else if (expectedUserId && boundUserId.value && boundUserId.value !== expectedUserId) {
      clearApplication()
      boundUserId.value = expectedUserId
    } else if (!expectedUserId && (boundUserId.value || application.value)) {
      clearApplication()
    }

    isLoading.value = true
    errorMessage.value = null
    try {
      const response = await $fetch<{ application: StudentApplicationRecord | null }>('/api/applications/my-application')

      // Check if stale or superseded by subsequent call, sign-out, or user switch
      const currentUserId = authUser.value?.id || null
      const isStale =
        gen !== stateGeneration.value ||
        (expectedUserId !== null && currentUserId !== expectedUserId) ||
        (expectedUserId !== null && !currentUserId)

      if (isStale) {
        return null
      }

      // If user is currently signed in, ensure response matches the signed-in user
      if (currentUserId && response.application && response.application.user_id !== currentUserId) {
        application.value = null
        boundUserId.value = null
        return null
      }

      application.value = response.application
      boundUserId.value = response.application?.user_id || currentUserId || null
      return application.value
    } catch (err: any) {
      const currentUserId = authUser.value?.id || null
      const isStale =
        gen !== stateGeneration.value ||
        (expectedUserId !== null && currentUserId !== expectedUserId) ||
        (expectedUserId !== null && !currentUserId)

      if (isStale) {
        return null
      }

      application.value = null
      boundUserId.value = null

      if (err.statusCode !== 401) {
        errorMessage.value = err.data?.message || err.message || 'ไม่สามารถโหลดข้อมูลคำขอได้'
      }
      return null
    } finally {
      if (gen === stateGeneration.value) {
        isLoading.value = false
      }
    }
  }

  /**
   * Submits a student application.
   * Strictly identity-bound and race-protected:
   * - Bumps generation counter and captures request-start identity.
   * - If user signs out or switches identity while in-flight, response and errors are discarded.
   * - Uninterrupted same-user valid submissions update application, notices, and pending status.
   */
  async function submitApplication(input: Partial<ValidatedApplicationInput>): Promise<{ success: boolean; error?: string }> {
    const gen = ++stateGeneration.value
    const expectedUserId = authUser.value?.id || null

    isSubmitting.value = true
    errorMessage.value = null
    fieldErrors.value = {}
    successMessage.value = null

    // Client-side pre-validation
    const validation = validateStudentApplicationInput(input)
    if (!validation.valid || !validation.sanitized) {
      fieldErrors.value = validation.errors
      isSubmitting.value = false
      return { success: false, error: 'กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้อง' }
    }

    try {
      const response = await $fetch<{ success: boolean; application: StudentApplicationRecord }>('/api/applications/submit', {
        method: 'POST',
        body: validation.sanitized,
      })

      // Check if stale or superseded by sign-out or identity change while in-flight
      const currentUserId = authUser.value?.id || null
      const isStale =
        gen !== stateGeneration.value ||
        (expectedUserId !== null && currentUserId !== expectedUserId) ||
        (expectedUserId !== null && !currentUserId)

      if (isStale) {
        return { success: false, error: 'Session changed during submission' }
      }

      if (response.success && response.application) {
        // Double check application user_id matches active user
        if (currentUserId && response.application.user_id && response.application.user_id !== currentUserId) {
          return { success: false, error: 'Session mismatch during submission' }
        }
        application.value = response.application
        boundUserId.value = response.application.user_id || currentUserId || null
        successMessage.value = 'ส่งคำขอลงทะเบียนเรียบร้อยแล้ว อยู่ระหว่างรอครูผู้สอนตรวจสอบ'
        return { success: true }
      }
      return { success: false, error: 'การส่งข้อมูลล้มเหลว' }
    } catch (err: any) {
      const currentUserId = authUser.value?.id || null
      const isStale =
        gen !== stateGeneration.value ||
        (expectedUserId !== null && currentUserId !== expectedUserId) ||
        (expectedUserId !== null && !currentUserId)

      if (isStale) {
        return { success: false, error: 'Session changed during submission' }
      }

      const statusMsg = err.data?.statusMessage || err.statusMessage || err.message || 'เกิดข้อผิดพลาดในการส่งข้อมูล'
      if (err.data?.data?.errors) {
        fieldErrors.value = err.data.data.errors
      }
      errorMessage.value = statusMsg
      return { success: false, error: statusMsg }
    } finally {
      if (gen === stateGeneration.value) {
        isSubmitting.value = false
      }
    }
  }

  return {
    application,
    classes,
    isLoading,
    isSubmitting,
    errorMessage,
    fieldErrors,
    successMessage,
    clearApplication,
    fetchClasses,
    fetchMyApplication,
    submitApplication,
  }
}
