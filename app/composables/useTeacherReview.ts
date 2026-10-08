import type { ClassRecord } from '../utils/studentApplication'
import type { SafeUserDisplay } from '../utils/auth'

export interface TeacherReviewApplication {
  id: string
  user_id: string
  title: string
  first_name: string
  last_name: string
  student_id: string
  class_id: string
  roll_number: number
  status: string
  created_at: string
  updated_at: string
  class?: {
    id: string
    name: string
    academic_year: string
  } | null
}

export function useTeacherReview() {
  const applications = useState<TeacherReviewApplication[]>('teacher-review-apps', () => [])
  const assignedClasses = useState<ClassRecord[]>('teacher-assigned-classes', () => [])
  const selectedClassId = useState<string>('teacher-review-selected-class', () => '')
  const boundUserId = useState<string | null>('teacher-review-bound-user', () => null)
  const authUser = useState<SafeUserDisplay | null>('auth-user', () => null)
  const stateGeneration = useState<number>('teacher-review-generation', () => 0)

  const isLoading = useState<boolean>('teacher-review-loading', () => false)
  const isApproving = useState<boolean>('teacher-review-approving', () => false)
  const errorMessage = useState<string | null>('teacher-review-error', () => null)
  const successMessage = useState<string | null>('teacher-review-success', () => null)
  const targetToConfirm = useState<TeacherReviewApplication | null>('teacher-review-confirm-target', () => null)

  function clearReviewState() {
    stateGeneration.value++
    applications.value = []
    assignedClasses.value = []
    selectedClassId.value = ''
    boundUserId.value = null
    isLoading.value = false
    isApproving.value = false
    errorMessage.value = null
    successMessage.value = null
    targetToConfirm.value = null
  }

  // Identity sync: if user identity changes or unauthenticated, clear review data immediately
  const currentAuthId = authUser.value?.id || null
  if (currentAuthId) {
    if (boundUserId.value && boundUserId.value !== currentAuthId) {
      clearReviewState()
      boundUserId.value = currentAuthId
    } else if (!boundUserId.value) {
      boundUserId.value = currentAuthId
    }
  } else if (
    authUser.value === null &&
    (boundUserId.value !== null || applications.value.length > 0 || errorMessage.value !== null || successMessage.value !== null)
  ) {
    clearReviewState()
  }

  async function fetchApplications(classId?: string) {
    const gen = ++stateGeneration.value
    const expectedUserId = authUser.value?.id || null

    isLoading.value = true
    errorMessage.value = null

    try {
      const url = classId ? `/api/teacher/applications?class_id=${encodeURIComponent(classId)}` : '/api/teacher/applications'
      const res = await $fetch<{
        applications: TeacherReviewApplication[]
        assigned_classes: ClassRecord[]
      }>(url)

      const currentUserId = authUser.value?.id || null
      const isStale =
        gen !== stateGeneration.value ||
        (expectedUserId !== null && currentUserId !== expectedUserId) ||
        (expectedUserId !== null && !currentUserId)

      if (isStale) {
        return { success: false }
      }

      applications.value = res.applications || []
      assignedClasses.value = res.assigned_classes || []
      boundUserId.value = currentUserId
      return { success: true }
    } catch (err: any) {
      const currentUserId = authUser.value?.id || null
      const isStale =
        gen !== stateGeneration.value ||
        (expectedUserId !== null && currentUserId !== expectedUserId) ||
        (expectedUserId !== null && !currentUserId)

      if (isStale) {
        return { success: false }
      }

      errorMessage.value = err.data?.statusMessage || err.data?.message || err.message || 'ไม่สามารถโหลดรายการคำขอได้'
      applications.value = []
      return { success: false, error: errorMessage.value }
    } finally {
      if (gen === stateGeneration.value) {
        isLoading.value = false
      }
    }
  }

  function confirmApproval(app: TeacherReviewApplication) {
    errorMessage.value = null
    successMessage.value = null
    targetToConfirm.value = app
  }

  function cancelConfirmation() {
    targetToConfirm.value = null
  }

  async function executeApproval(applicationId: string) {
    const gen = ++stateGeneration.value
    const expectedUserId = authUser.value?.id || null

    isApproving.value = true
    errorMessage.value = null
    successMessage.value = null

    try {
      const res = await $fetch<{
        success: boolean
        idempotent?: boolean
        membership_id?: string
      }>('/api/applications/approve', {
        method: 'POST',
        body: { application_id: applicationId },
      })

      const currentUserId = authUser.value?.id || null
      const isStale =
        gen !== stateGeneration.value ||
        (expectedUserId !== null && currentUserId !== expectedUserId) ||
        (expectedUserId !== null && !currentUserId)

      if (isStale) {
        return { success: false }
      }

      if (res.success) {
        // Remove approved application from local pending queue
        applications.value = applications.value.filter((a) => a.id !== applicationId)
        targetToConfirm.value = null

        if (res.idempotent) {
          successMessage.value = 'คำขอนี้ได้รับการอนุมัติเรียบร้อยแล้วก่อนหน้า (การทำรายการซ้ำ)'
        } else {
          successMessage.value = 'อนุมัติคำขอลงทะเบียนเรียบร้อยแล้ว'
        }
        return { success: true }
      }
      return { success: false }
    } catch (err: any) {
      const currentUserId = authUser.value?.id || null
      const isStale =
        gen !== stateGeneration.value ||
        (expectedUserId !== null && currentUserId !== expectedUserId) ||
        (expectedUserId !== null && !currentUserId)

      if (isStale) {
        return { success: false }
      }

      errorMessage.value = err.data?.statusMessage || err.data?.message || err.message || 'เกิดข้อผิดพลาดในการอนุมัติคำขอ'
      targetToConfirm.value = null
      return { success: false, error: errorMessage.value }
    } finally {
      if (gen === stateGeneration.value) {
        isApproving.value = false
      }
    }
  }

  return {
    applications,
    assignedClasses,
    selectedClassId,
    isLoading,
    isApproving,
    errorMessage,
    successMessage,
    targetToConfirm,
    clearReviewState,
    fetchApplications,
    confirmApproval,
    cancelConfirmation,
    executeApproval,
  }
}
