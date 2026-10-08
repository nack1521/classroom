import type { ClassRecord } from '../utils/studentApplication'
import type { SafeUserDisplay, SafeUserRoles } from '../utils/auth'

export interface AdminStudentRecord {
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
  active_membership?: {
    id: string
    user_id: string
    class_id: string
    student_id: string
    roll_number: number
    academic_year: string
    status: string
    approved_at: string
  } | null
}

export interface CorrectionPayload {
  application_id: string
  title: string
  first_name: string
  last_name: string
  student_id: string
  class_id: string
  roll_number: number
  status?: string
}

export interface TeacherAssignmentRecord {
  teacher_id: string
  class_id: string
  assigned_at: string
  class?: {
    id: string
    name: string
    academic_year: string
    is_active: boolean
  } | null
}

export interface TransferPayload {
  membership_id: string
  destination_class_id: string
  new_roll_number?: number | null
}

export interface SubjectRecord {
  id: string
  code: string
  name: string
  is_active: boolean
}

export function useAdminDashboard() {
  const applications = useState<AdminStudentRecord[]>('admin-dash-applications', () => [])
  const classes = useState<ClassRecord[]>('admin-dash-classes', () => [])
  const subjects = useState<SubjectRecord[]>('admin-dash-subjects', () => [])
  const assignments = useState<TeacherAssignmentRecord[]>('admin-dash-assignments', () => [])
  const authUser = useState<SafeUserDisplay | null>('auth-user', () => null)
  const authRoles = useState<SafeUserRoles>('auth-roles', () => ({
    isAdmin: false,
    isTeacher: false,
    roles: [],
  }))
  const boundUserId = useState<string | null>('admin-dash-bound-user', () => null)
  const stateGeneration = useState<number>('admin-dash-generation', () => 0)

  const isLoading = useState<boolean>('admin-dash-loading', () => false)
  const isProcessing = useState<boolean>('admin-dash-processing', () => false)
  const errorMessage = useState<string | null>('admin-dash-error', () => null)
  const successMessage = useState<string | null>('admin-dash-success', () => null)

  const editingApplication = useState<CorrectionPayload | null>('admin-dash-editing', () => null)
  const transferringStudent = useState<AdminStudentRecord | null>('admin-dash-transferring', () => null)
  const approvingApplication = useState<AdminStudentRecord | null>('admin-dash-approving', () => null)

  function clearAdminState() {
    stateGeneration.value++
    applications.value = []
    classes.value = []
    subjects.value = []
    assignments.value = []
    boundUserId.value = null
    isLoading.value = false
    isProcessing.value = false
    errorMessage.value = null
    successMessage.value = null
    editingApplication.value = null
    transferringStudent.value = null
    approvingApplication.value = null
  }

  // Identity sync: wipe all admin dashboard data if identity changes or unauthenticated
  const currentAuthId = authUser.value?.id || null
  if (currentAuthId) {
    if (boundUserId.value && boundUserId.value !== currentAuthId) {
      clearAdminState()
      boundUserId.value = currentAuthId
    } else if (!boundUserId.value) {
      boundUserId.value = currentAuthId
    }
  } else if (
    authUser.value === null &&
    (boundUserId.value !== null || applications.value.length > 0 || classes.value.length > 0 || errorMessage.value !== null || successMessage.value !== null)
  ) {
    clearAdminState()
  }

  function isStaleContext(gen: number, expectedUserId: string | null, requireTeacher: boolean = false): boolean {
    const currentUserId = authUser.value?.id || null
    if (gen !== stateGeneration.value) return true
    if (expectedUserId === null || currentUserId !== expectedUserId) return true
    if (!currentUserId) return true
    if (!authRoles.value?.isAdmin) return true
    if (requireTeacher && !authRoles.value?.isTeacher) return true
    return false
  }

  async function fetchOverview() {
    const gen = ++stateGeneration.value
    const expectedUserId = authUser.value?.id || null

    isLoading.value = true
    errorMessage.value = null

    try {
      const res = await $fetch<{
        classes: ClassRecord[]
        applications: AdminStudentRecord[]
        assignments?: TeacherAssignmentRecord[]
        subjects?: SubjectRecord[]
      }>('/api/admin/overview')

      const currentUserId = authUser.value?.id || null
      const isStale =
        gen !== stateGeneration.value ||
        (expectedUserId !== null && currentUserId !== expectedUserId) ||
        (expectedUserId !== null && !currentUserId)

      if (isStale) {
        return { success: false, generation: gen }
      }

      classes.value = res.classes || []
      applications.value = res.applications || []
      assignments.value = res.assignments || []
      subjects.value = res.subjects || []
      boundUserId.value = currentUserId
      return { success: true, generation: gen }
    } catch (err: any) {
      const currentUserId = authUser.value?.id || null
      const isStale =
        gen !== stateGeneration.value ||
        (expectedUserId !== null && currentUserId !== expectedUserId) ||
        (expectedUserId !== null && !currentUserId)

      if (isStale) {
        return { success: false, generation: gen }
      }

      errorMessage.value = err.data?.statusMessage || err.data?.message || err.message || 'ไม่สามารถโหลดข้อมูลผู้ดูแลระบบได้'
      return { success: false, error: errorMessage.value, generation: gen }
    } finally {
      if (gen === stateGeneration.value) {
        isLoading.value = false
      }
    }
  }

  function startCorrection(app: AdminStudentRecord) {
    errorMessage.value = null
    successMessage.value = null
    approvingApplication.value = null
    transferringStudent.value = null
    editingApplication.value = {
      application_id: app.id,
      title: app.title,
      first_name: app.first_name,
      last_name: app.last_name,
      student_id: app.student_id,
      class_id: app.class_id,
      roll_number: app.roll_number,
      status: app.status,
    }
  }

  function cancelCorrection() {
    editingApplication.value = null
  }

  async function submitCorrection() {
    if (!editingApplication.value) return { success: false }

    const gen = ++stateGeneration.value
    const expectedUserId = authUser.value?.id || null

    isProcessing.value = true
    errorMessage.value = null
    successMessage.value = null

    try {
      const res = await $fetch<{ success: boolean; result: any }>('/api/admin/applications/correct', {
        method: 'POST',
        body: editingApplication.value,
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
        editingApplication.value = null
        successMessage.value = 'แก้ไขข้อมูลนักเรียนและบันทึกประวัติการเปลี่ยนแปลงเรียบร้อยแล้ว'
        await fetchOverview()
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

      errorMessage.value = err.data?.statusMessage || err.data?.message || err.message || 'เกิดข้อผิดพลาดในการแก้ไขข้อมูล'
      return { success: false, error: errorMessage.value }
    } finally {
      isProcessing.value = false
    }
  }

  function startTransfer(app: AdminStudentRecord) {
    errorMessage.value = null
    successMessage.value = null
    editingApplication.value = null
    approvingApplication.value = null
    transferringStudent.value = app
  }

  function cancelTransfer() {
    transferringStudent.value = null
  }

  async function submitTransfer(destinationClassId: string, newRollNumber?: number | null) {
    if (!transferringStudent.value?.active_membership) {
      errorMessage.value = 'ไม่พบข้อมูลการเป็นสมาชิกชั้นเรียนที่ใช้งานอยู่'
      return { success: false }
    }

    const gen = ++stateGeneration.value
    const expectedUserId = authUser.value?.id || null

    isProcessing.value = true
    errorMessage.value = null
    successMessage.value = null

    try {
      const res = await $fetch<{ success: boolean; result: any }>('/api/admin/memberships/transfer', {
        method: 'POST',
        body: {
          membership_id: transferringStudent.value.active_membership.id,
          destination_class_id: destinationClassId,
          new_roll_number: newRollNumber || undefined,
        },
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
        transferringStudent.value = null
        successMessage.value = 'ย้ายห้องเรียนนักเรียนเรียบร้อยแล้ว'
        await fetchOverview()
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

      errorMessage.value = err.data?.statusMessage || err.data?.message || err.message || 'เกิดข้อผิดพลาดในการย้ายห้องเรียน'
      return { success: false, error: errorMessage.value }
    } finally {
      isProcessing.value = false
    }
  }

  function startApproval(app: AdminStudentRecord) {
    errorMessage.value = null
    successMessage.value = null
    editingApplication.value = null
    transferringStudent.value = null
    approvingApplication.value = app
  }

  function cancelApproval() {
    approvingApplication.value = null
  }

  async function submitApproval(applicationId: string) {
    if (!applicationId) return { success: false }

    const gen = ++stateGeneration.value
    const expectedUserId = authUser.value?.id || null
    let expectedEndGen = gen

    isProcessing.value = true
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

      if (isStaleContext(gen, expectedUserId, false)) {
        return { success: false }
      }

      if (res.success) {
        approvingApplication.value = null
        const overviewResult = await fetchOverview()

        if (
          overviewResult.generation !== stateGeneration.value ||
          isStaleContext(overviewResult.generation, expectedUserId, false)
        ) {
          return { success: false }
        }

        expectedEndGen = overviewResult.generation

        if (!overviewResult.success) {
          return { success: false, error: overviewResult.error }
        }

        if (res.idempotent) {
          successMessage.value = 'คำขอนี้ได้รับการอนุมัติเรียบร้อยแล้วก่อนหน้า (การทำรายการซ้ำ)'
        } else {
          successMessage.value = 'อนุมัติคำขอลงทะเบียนเรียบร้อยแล้ว'
        }

        return { success: true, idempotent: res.idempotent, membership_id: res.membership_id }
      }
      return { success: false }
    } catch (err: any) {
      if (isStaleContext(gen, expectedUserId, false)) {
        return { success: false }
      }

      errorMessage.value = err.data?.statusMessage || err.data?.message || err.message || 'เกิดข้อผิดพลาดในการอนุมัติคำขอ'
      return { success: false, error: errorMessage.value }
    } finally {
      if (expectedEndGen === stateGeneration.value && !isStaleContext(expectedEndGen, expectedUserId, false)) {
        isProcessing.value = false
      }
    }
  }

  async function assignTeacherToClass(teacherId: string, classId: string) {
    const trimmedTeacherId = teacherId.trim()
    const trimmedClassId = classId.trim()
    if (!trimmedTeacherId || !trimmedClassId) {
      errorMessage.value = 'กรุณาระบุรหัสผู้ใช้ครู (Teacher UUID) และเลือกห้องเรียน'
      return { success: false, error: errorMessage.value }
    }

    if (authUser.value?.id && authUser.value.id === trimmedTeacherId) {
      errorMessage.value = 'ไม่สามารถมอบหมายห้องเรียนให้ตนเองได้ (Self-assignment is not allowed)'
      return { success: false, error: errorMessage.value }
    }

    const gen = ++stateGeneration.value
    const expectedUserId = authUser.value?.id || null

    isProcessing.value = true
    errorMessage.value = null
    successMessage.value = null

    try {
      const res = await $fetch<{ success: boolean; result: any }>('/api/admin/teachers/assign', {
        method: 'POST',
        body: {
          teacher_id: trimmedTeacherId,
          class_id: trimmedClassId,
          action: 'assign',
        },
      })

      const currentUserId = authUser.value?.id || null
      const isStale =
        gen !== stateGeneration.value ||
        (expectedUserId !== null && currentUserId !== expectedUserId) ||
        (expectedUserId !== null && !currentUserId)

      if (isStale) return { success: false }

      if (res.success) {
        successMessage.value = 'มอบหมายครูประจำชั้นเรียบร้อยแล้ว'
        await fetchOverview()
        return { success: true }
      }
      return { success: false }
    } catch (err: any) {
      const currentUserId = authUser.value?.id || null
      const isStale =
        gen !== stateGeneration.value ||
        (expectedUserId !== null && currentUserId !== expectedUserId) ||
        (expectedUserId !== null && !currentUserId)

      if (isStale) return { success: false }

      errorMessage.value = err.data?.statusMessage || err.data?.message || err.message || 'เกิดข้อผิดพลาดในการมอบหมายครูประจำชั้น'
      return { success: false, error: errorMessage.value }
    } finally {
      isProcessing.value = false
    }
  }

  async function revokeTeacherFromClass(teacherId: string, classId: string) {
    const gen = ++stateGeneration.value
    const expectedUserId = authUser.value?.id || null

    isProcessing.value = true
    errorMessage.value = null
    successMessage.value = null

    try {
      const res = await $fetch<{ success: boolean; result: any }>('/api/admin/teachers/assign', {
        method: 'POST',
        body: {
          teacher_id: teacherId,
          class_id: classId,
          action: 'revoke',
        },
      })

      const currentUserId = authUser.value?.id || null
      const isStale =
        gen !== stateGeneration.value ||
        (expectedUserId !== null && currentUserId !== expectedUserId) ||
        (expectedUserId !== null && !currentUserId)

      if (isStale) return { success: false }

      if (res.success) {
        successMessage.value = 'เพิกถอนการมอบหมายครูประจำชั้นเรียบร้อยแล้ว'
        await fetchOverview()
        return { success: true }
      }
      return { success: false }
    } catch (err: any) {
      const currentUserId = authUser.value?.id || null
      const isStale =
        gen !== stateGeneration.value ||
        (expectedUserId !== null && currentUserId !== expectedUserId) ||
        (expectedUserId !== null && !currentUserId)

      if (isStale) return { success: false }

      errorMessage.value = err.data?.statusMessage || err.data?.message || err.message || 'เกิดข้อผิดพลาดในการเพิกถอนการมอบหมาย'
      return { success: false, error: errorMessage.value }
    } finally {
      isProcessing.value = false
    }
  }

  async function createClass(name: string, academic_year: string) {
    const gen = ++stateGeneration.value
    const expectedUserId = authUser.value?.id || null

    isProcessing.value = true
    errorMessage.value = null
    successMessage.value = null

    try {
      const res = await $fetch<{ success: boolean; class: ClassRecord }>('/api/admin/classes', {
        method: 'POST',
        body: { name, academic_year },
      })

      if (isStaleContext(gen, expectedUserId, false)) {
        return { success: false }
      }

      if (res?.class) {
        classes.value.push(res.class)
      }
      successMessage.value = 'สร้างห้องเรียนสำเร็จ'
      return { success: true, class: res?.class }
    } catch (err: any) {
      if (isStaleContext(gen, expectedUserId, false)) {
        return { success: false }
      }

      errorMessage.value = err.data?.statusMessage || err.message || 'ไม่สามารถสร้างห้องเรียนได้'
      return { success: false, error: errorMessage.value }
    } finally {
      if (gen === stateGeneration.value) {
        isProcessing.value = false
      }
    }
  }

  async function createSubject(code: string, name: string) {
    const gen = ++stateGeneration.value
    const expectedUserId = authUser.value?.id || null

    isProcessing.value = true
    errorMessage.value = null
    successMessage.value = null

    try {
      const res = await $fetch<{ success: boolean; subject: SubjectRecord }>('/api/admin/subjects', {
        method: 'POST',
        body: { code, name },
      })

      if (isStaleContext(gen, expectedUserId, false)) {
        return { success: false }
      }

      if (res?.subject) {
        subjects.value.push(res.subject)
      }
      successMessage.value = 'สร้างรายวิชาสำเร็จ'
      return { success: true, subject: res?.subject }
    } catch (err: any) {
      if (isStaleContext(gen, expectedUserId, false)) {
        return { success: false }
      }

      errorMessage.value = err.data?.statusMessage || err.message || 'ไม่สามารถสร้างรายวิชาได้'
      return { success: false, error: errorMessage.value }
    } finally {
      if (gen === stateGeneration.value) {
        isProcessing.value = false
      }
    }
  }

  async function createOfferingAndAssignSelf(subjectId: string, classId: string, term: number) {
    const gen = ++stateGeneration.value
    const expectedUserId = authUser.value?.id || null

    isProcessing.value = true
    errorMessage.value = null
    successMessage.value = null

    try {
      const res = await $fetch<{ success: boolean; offering_id: string }>('/api/admin/offerings', {
        method: 'POST',
        body: { subject_id: subjectId, class_id: classId, term },
      })

      if (isStaleContext(gen, expectedUserId, true)) {
        return { success: false }
      }

      successMessage.value = 'เปิดกลุ่มการเรียนและมอบหมายสิทธิ์การสอนให้แก่ตนเองสำเร็จ'
      return { success: true, offering_id: res?.offering_id }
    } catch (err: any) {
      if (isStaleContext(gen, expectedUserId, true)) {
        return { success: false }
      }

      errorMessage.value = err.data?.statusMessage || err.message || 'ไม่สามารถเปิดกลุ่มการเรียนได้'
      return { success: false, error: errorMessage.value }
    } finally {
      if (gen === stateGeneration.value) {
        isProcessing.value = false
      }
    }
  }

  return {
    applications,
    classes,
    subjects,
    assignments,
    isLoading,
    isProcessing,
    errorMessage,
    successMessage,
    editingApplication,
    transferringStudent,
    approvingApplication,
    clearAdminState,
    fetchOverview,
    startCorrection,
    cancelCorrection,
    submitCorrection,
    startTransfer,
    cancelTransfer,
    submitTransfer,
    startApproval,
    cancelApproval,
    submitApproval,
    assignTeacherToClass,
    revokeTeacherFromClass,
    createClass,
    createSubject,
    createOfferingAndAssignSelf,
  }
}
