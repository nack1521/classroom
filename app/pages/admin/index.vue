<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ALLOWED_TITLES } from '../../utils/studentApplication'
import { fetchUserRoles, type SafeUserRoles } from '../../utils/auth'
import { useAdminDashboard } from '../../composables/useAdminDashboard'

definePageMeta({
  middleware: ['auth'],
})

const { user, client, signOut } = useAuth()
const {
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
} = useAdminDashboard()

const roles = useState<SafeUserRoles>('auth-roles', () => ({
  isAdmin: false,
  isTeacher: false,
  roles: [],
}))
const isCheckingRoles = ref(true)

// Teacher assignment form state
const assignTeacherId = ref('')
const assignClassId = ref('')
const confirmingAssignment = ref<{ teacher_id: string; class_id: string; class_name?: string } | null>(null)
const confirmingRevocation = ref<{ teacher_id: string; class_id: string; class_name?: string } | null>(null)

// Course setup form states
const newClassName = ref('')
const newClassYear = ref('')
const newSubjectCode = ref('')
const newSubjectName = ref('')
const selectedOfferingSubjectId = ref('')
const selectedOfferingClassId = ref('')
const selectedOfferingTerm = ref(1)

const activeClasses = computed(() => classes.value.filter((c) => c.is_active))
const activeSubjects = computed(() => subjects.value.filter((s) => s.is_active))

async function handleCreateClass() {
  const name = newClassName.value.trim()
  const year = newClassYear.value.trim()
  if (!name || !year) return
  const res = await createClass(name, year)
  if (res.success) {
    newClassName.value = ''
    newClassYear.value = ''
    if (res.class?.id) {
      selectedOfferingClassId.value = res.class.id
    }
  }
}

async function handleCreateSubject() {
  const code = newSubjectCode.value.trim()
  const name = newSubjectName.value.trim()
  if (!code || !name) return
  const res = await createSubject(code, name)
  if (res.success) {
    newSubjectCode.value = ''
    newSubjectName.value = ''
    if (res.subject?.id) {
      selectedOfferingSubjectId.value = res.subject.id
    }
  }
}

async function handleCreateOffering() {
  if (!selectedOfferingSubjectId.value || !selectedOfferingClassId.value || !selectedOfferingTerm.value) return
  const res = await createOfferingAndAssignSelf(
    selectedOfferingSubjectId.value,
    selectedOfferingClassId.value,
    selectedOfferingTerm.value
  )
  if (res.success) {
    selectedOfferingSubjectId.value = ''
    selectedOfferingClassId.value = ''
    selectedOfferingTerm.value = 1
  }
}

function promptAssignTeacher() {
  const trimmedTeacherId = assignTeacherId.value.trim()
  const trimmedClassId = assignClassId.value.trim()
  if (!trimmedTeacherId || !trimmedClassId) return

  if (user.value?.id && user.value.id === trimmedTeacherId) {
    errorMessage.value = 'ไม่สามารถมอบหมายห้องเรียนให้ตนเองได้ (Self-assignment is not allowed)'
    return
  }

  const targetClass = classes.value.find((c) => c.id === trimmedClassId)
  confirmingAssignment.value = {
    teacher_id: trimmedTeacherId,
    class_id: trimmedClassId,
    class_name: targetClass ? `${targetClass.name} (ปี ${targetClass.academic_year})` : trimmedClassId,
  }
}

function cancelAssignPrompt() {
  confirmingAssignment.value = null
}

async function executeAssignTeacher() {
  if (!confirmingAssignment.value) return
  const { teacher_id, class_id } = confirmingAssignment.value
  const res = await assignTeacherToClass(teacher_id, class_id)
  if (res.success) {
    assignTeacherId.value = ''
    assignClassId.value = ''
    confirmingAssignment.value = null
  }
}

function promptRevokeTeacher(assignment: any) {
  confirmingRevocation.value = {
    teacher_id: assignment.teacher_id,
    class_id: assignment.class_id,
    class_name: assignment.class ? `${assignment.class.name} (ปี ${assignment.class.academic_year})` : assignment.class_id,
  }
}

function cancelRevokePrompt() {
  confirmingRevocation.value = null
}

async function executeRevokeTeacher() {
  if (!confirmingRevocation.value) return
  const { teacher_id, class_id } = confirmingRevocation.value
  const res = await revokeTeacherFromClass(teacher_id, class_id)
  if (res.success) {
    confirmingRevocation.value = null
  }
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    return d.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return dateStr
  }
}

// Transfer form model
const transferForm = ref({
  destination_class_id: '',
  new_roll_number: null as number | null,
})

let roleFetchGeneration = 0

async function checkAdminAndLoad() {
  const currentGen = ++roleFetchGeneration
  const reqUserId = user.value?.id || null
  isCheckingRoles.value = true

  if (!reqUserId || !client) {
    roles.value = { isAdmin: false, isTeacher: false, roles: [] }
    isCheckingRoles.value = false
    clearAdminState()
    return
  }

  const fetchedRoles = await fetchUserRoles(client, reqUserId)

  // Guard: Reject old role lookup settling after sign-out, identity change, or newer check
  if (currentGen !== roleFetchGeneration || user.value?.id !== reqUserId || !reqUserId) {
    return
  }

  roles.value = fetchedRoles

  if (fetchedRoles.isAdmin) {
    await fetchOverview()
  } else {
    clearAdminState()
  }
  isCheckingRoles.value = false
}

onMounted(async () => {
  await checkAdminAndLoad()
})

watch(
  () => user.value?.id,
  async (newId, oldId) => {
    if (!newId || (oldId && newId !== oldId)) {
      roleFetchGeneration++
      roles.value = { isAdmin: false, isTeacher: false, roles: [] }
      clearAdminState()
      await checkAdminAndLoad()
    }
  }
)

function handleStartTransfer(app: any) {
  startTransfer(app)
  transferForm.value = {
    destination_class_id: '',
    new_roll_number: app.roll_number,
  }
}

async function handleConfirmTransfer() {
  if (!transferForm.value.destination_class_id) return
  await submitTransfer(
    transferForm.value.destination_class_id,
    transferForm.value.new_roll_number
  )
}

async function handleConfirmApproval() {
  if (!approvingApplication.value || isProcessing.value) return
  await submitApproval(approvingApplication.value.id)
}

async function handleSignOut() {
  roleFetchGeneration++
  roles.value = { isAdmin: false, isTeacher: false, roles: [] }
  clearAdminState()
  await signOut()
}
</script>

<template>
  <div class="admin-page-container">
    <header class="header">
      <div class="badge">Slice 0D — Admin Dashboard</div>
      <h1>ระบบจัดการข้อมูลนักเรียน (Admin Dashboard & Corrections)</h1>
      <p class="subtitle">
        แก้ไขข้อมูลนักเรียนที่สะกดผิด ย้ายห้องเรียน และตรวจสอบความถูกต้องของข้อมูล
      </p>
    </header>

    <!-- Error notice -->
    <div v-if="errorMessage" class="alert alert-danger" id="admin-error-alert" role="alert">
      <strong>ข้อผิดพลาด:</strong> {{ errorMessage }}
    </div>

    <!-- Success notice -->
    <div v-if="successMessage" class="alert alert-success" id="admin-success-alert" role="status">
      <strong>สำเร็จ:</strong> {{ successMessage }}
    </div>

    <!-- Loading state -->
    <div v-if="isCheckingRoles || isLoading" class="card loading-card" id="admin-loading-view">
      <div class="spinner"></div>
      <p>กำลังตรวจสอบสิทธิ์ผู้ดูแลระบบ...</p>
    </div>

    <!-- Access Denied -->
    <div
      v-else-if="!roles.isAdmin"
      class="card denied-card"
      id="admin-access-denied-view"
    >
      <h2>ไม่มีสิทธิ์เข้าถึงหน้านี้ (Admin Only)</h2>
      <p class="card-desc">
        หน้านี้สงวนไว้สำหรับผู้ดูแลระบบ (Administrator) เท่านั้น ครูประจำชั้นและนักเรียนไม่สามารถเข้าถึงได้
      </p>
      <div class="actions">
        <NuxtLink to="/" class="btn btn-primary" id="admin-home-btn">
          กลับสู่หน้าหลัก
        </NuxtLink>
        <button class="btn btn-secondary" @click="handleSignOut">
          ออกจากระบบ
        </button>
      </div>
    </div>

    <!-- Authorized Admin View -->
    <div v-else class="card admin-card" id="admin-dashboard-view">
      <!-- Section 0: Course Offering Setup (Slice 014) -->
      <section class="admin-section" id="course-setup-section">
        <div class="admin-toolbar">
          <h2>จัดการรายวิชาและกลุ่มการเรียน (Course Offering Setup)</h2>
        </div>
        <p class="section-desc">
          สร้างห้องเรียน, รายวิชา และเปิดกลุ่มการเรียนสำหรับภาคเรียน พร้อมมอบหมายสิทธิ์การสอนให้แก่ตนเอง (Owner Authoring)
        </p>

        <!-- Informational banner if admin lacks teacher role -->
        <div v-if="!roles.isTeacher" class="alert alert-warning" id="course-setup-teacher-required-notice">
          <strong>ข้อสังเกต:</strong> คุณมีบทบาทผู้ดูแลระบบ (Admin) แต่ยังไม่มีบทบาทครู (Teacher) จึงยังไม่สามารถเปิดกลุ่มการเรียนและมอบหมายสิทธิ์การสอนให้แก่ตนเองได้
        </div>

        <div class="course-setup-grid">
          <!-- Sub-form A: Create Class -->
          <form class="assignment-form" id="create-class-form" @submit.prevent="handleCreateClass">
            <h3 class="subsection-title">1. สร้างห้องเรียนใหม่ (Create Class)</h3>
            <div class="form-row">
              <div class="form-group flex-1">
                <label for="new-class-name">ชื่อห้องเรียน</label>
                <input
                  id="new-class-name"
                  v-model="newClassName"
                  type="text"
                  class="form-control"
                  placeholder="เช่น ม.4/1"
                  required
                  :disabled="isProcessing"
                />
              </div>
              <div class="form-group flex-1">
                <label for="new-class-year">ปีการศึกษา (4 หลัก)</label>
                <input
                  id="new-class-year"
                  v-model="newClassYear"
                  type="text"
                  class="form-control"
                  placeholder="เช่น 2569"
                  pattern="[0-9]{4}"
                  required
                  :disabled="isProcessing"
                />
              </div>
              <div class="form-group form-actions-inline">
                <button
                  type="submit"
                  class="btn btn-primary"
                  id="create-class-btn"
                  :disabled="isProcessing || !newClassName.trim() || !newClassYear.trim()"
                >
                  {{ isProcessing ? 'กำลังสร้าง...' : 'สร้างห้องเรียน' }}
                </button>
              </div>
            </div>
          </form>

          <!-- Sub-form B: Create Subject -->
          <form class="assignment-form" id="create-subject-form" @submit.prevent="handleCreateSubject">
            <h3 class="subsection-title">2. สร้างรายวิชาใหม่ (Create Subject)</h3>
            <div class="form-row">
              <div class="form-group flex-1">
                <label for="new-subject-code">รหัสวิชา (ไม่เกิน 20 ตัวอักษร)</label>
                <input
                  id="new-subject-code"
                  v-model="newSubjectCode"
                  type="text"
                  class="form-control"
                  placeholder="เช่น MATH-M4"
                  maxlength="20"
                  required
                  :disabled="isProcessing"
                />
              </div>
              <div class="form-group flex-1">
                <label for="new-subject-name">ชื่อวิชา (ไม่เกิน 100 ตัวอักษร)</label>
                <input
                  id="new-subject-name"
                  v-model="newSubjectName"
                  type="text"
                  class="form-control"
                  placeholder="เช่น คณิตศาสตร์ ม.4"
                  maxlength="100"
                  required
                  :disabled="isProcessing"
                />
              </div>
              <div class="form-group form-actions-inline">
                <button
                  type="submit"
                  class="btn btn-primary"
                  id="create-subject-btn"
                  :disabled="isProcessing || !newSubjectCode.trim() || !newSubjectName.trim()"
                >
                  {{ isProcessing ? 'กำลังสร้าง...' : 'สร้างรายวิชา' }}
                </button>
              </div>
            </div>
          </form>

          <!-- Sub-form C: Create Offering and Assign Self -->
          <form class="assignment-form" id="create-offering-form" @submit.prevent="handleCreateOffering">
            <h3 class="subsection-title">3. เปิดกลุ่มการเรียนและรับสิทธิ์สอน (Create Offering & Self-Assign)</h3>
            <p class="form-hint-text">
              การสร้างกลุ่มการเรียนนี้จะเปิดรายวิชาสำหรับห้องและภาคเรียนที่ระบุ และมอบหมายสิทธิ์การสอนให้แก่บัญชีครูของคุณโดยอัตโนมัติ (Owner Self-Assignment)
            </p>
            <div class="form-row">
              <div class="form-group flex-1">
                <label for="offering-subject-select">รายวิชา</label>
                <select
                  id="offering-subject-select"
                  v-model="selectedOfferingSubjectId"
                  class="form-control"
                  required
                  :disabled="isProcessing || !roles.isTeacher"
                >
                  <option value="" disabled>-- เลือกรายวิชา --</option>
                  <option v-for="s in activeSubjects" :key="s.id" :value="s.id">
                    [{{ s.code }}] {{ s.name }}
                  </option>
                </select>
              </div>
              <div class="form-group flex-1">
                <label for="offering-class-select">ห้องเรียน</label>
                <select
                  id="offering-class-select"
                  v-model="selectedOfferingClassId"
                  class="form-control"
                  required
                  :disabled="isProcessing || !roles.isTeacher"
                >
                  <option value="" disabled>-- เลือกห้องเรียน --</option>
                  <option v-for="c in activeClasses" :key="c.id" :value="c.id">
                    {{ c.name }} (ปี {{ c.academic_year }})
                  </option>
                </select>
              </div>
              <div class="form-group" style="min-width: 140px;">
                <label for="offering-term-select">ภาคเรียน</label>
                <select
                  id="offering-term-select"
                  v-model.number="selectedOfferingTerm"
                  class="form-control"
                  required
                  :disabled="isProcessing || !roles.isTeacher"
                >
                  <option :value="1">ภาคเรียนที่ 1</option>
                  <option :value="2">ภาคเรียนที่ 2</option>
                </select>
              </div>
              <div class="form-group form-actions-inline">
                <button
                  type="submit"
                  class="btn btn-primary"
                  id="create-offering-btn"
                  :disabled="isProcessing || !roles.isTeacher || !selectedOfferingSubjectId || !selectedOfferingClassId"
                >
                  {{ isProcessing ? 'กำลังเปิดกลุ่ม...' : 'เปิดกลุ่มการเรียนและรับสิทธิ์สอน' }}
                </button>
              </div>
            </div>
          </form>
        </div>
      </section>

      <hr class="section-divider" />

      <!-- Section 1: Teacher Class Assignments -->
      <section class="admin-section" id="admin-teacher-assignments-section">
        <div class="admin-toolbar">
          <h2>การมอบหมายครูประจำชั้น (Teacher Class Assignments)</h2>
        </div>
        <p class="section-desc">
          มอบหมายและเพิกถอนห้องเรียนสำหรับครูผู้สอนเพื่อจัดการคิวตรวจคำขอลงทะเบียน
        </p>

        <!-- Assignment Form -->
        <form class="assignment-form" id="teacher-assign-form" @submit.prevent="promptAssignTeacher">
          <div class="form-row">
            <div class="form-group flex-1">
              <label for="assign-teacher-id">รหัสผู้ใช้ครู (Teacher UUID)</label>
              <input
                id="assign-teacher-id"
                v-model="assignTeacherId"
                type="text"
                class="form-control"
                placeholder="เช่น 009b0000-0000-0000-0000-000000000001"
                required
                :disabled="isProcessing"
              />
            </div>
            <div class="form-group flex-1">
              <label for="assign-class-id">ห้องเรียนที่เปิดใช้งาน</label>
              <select
                id="assign-class-id"
                v-model="assignClassId"
                class="form-control"
                required
                :disabled="isProcessing"
              >
                <option value="" disabled>-- เลือกห้องเรียน --</option>
                <option v-for="c in activeClasses" :key="c.id" :value="c.id">
                  {{ c.name }} (ปีการศึกษา {{ c.academic_year }})
                </option>
              </select>
            </div>
            <div class="form-group form-actions-inline">
              <button
                type="submit"
                class="btn btn-primary"
                id="assign-teacher-btn"
                :disabled="isProcessing || !assignTeacherId || !assignClassId"
              >
                {{ isProcessing ? 'กำลังดำเนินการ...' : 'มอบหมายห้องเรียน' }}
              </button>
            </div>
          </div>
        </form>

        <!-- Current Assignments Table -->
        <div class="assignments-table-container">
          <h3 class="subsection-title">รายการที่มอบหมายแล้ว ({{ assignments.length }} รายการ)</h3>
          <div v-if="assignments.length === 0" class="empty-state-sub" id="no-assignments-msg">
            <p>ยังไม่มีการมอบหมายครูประจำชั้นในระบบ</p>
          </div>
          <div v-else class="table-responsive">
            <table class="admin-table" id="teacher-assignments-table" aria-label="ตารางการมอบหมายครูประจำชั้น">
              <thead>
                <tr>
                  <th scope="col">รหัสผู้ใช้ครู (Teacher ID)</th>
                  <th scope="col">ห้องเรียน</th>
                  <th scope="col">ปีการศึกษา</th>
                  <th scope="col">วันที่มอบหมาย</th>
                  <th scope="col" class="text-center">การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="a in assignments" :key="`${a.teacher_id}-${a.class_id}`">
                  <td><code class="student-id-badge">{{ a.teacher_id }}</code></td>
                  <td class="font-medium">{{ a.class?.name || a.class_id }}</td>
                  <td>{{ a.class?.academic_year || '-' }}</td>
                  <td>{{ formatDate(a.assigned_at) }}</td>
                  <td class="text-center actions-cell">
                    <button
                      type="button"
                      class="btn btn-danger btn-sm"
                      :id="`revoke-btn-${a.teacher_id}-${a.class_id}`"
                      :disabled="isProcessing"
                      @click="promptRevokeTeacher(a)"
                    >
                      เพิกถอนสิทธิ์
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <hr class="section-divider" />

      <!-- Section 2: Student Applications & Registrations -->
      <section class="admin-section" id="admin-applications-section">
        <div class="admin-toolbar">
          <h2>รายชื่อนักเรียนและคำขอลงทะเบียน ({{ applications.length }} รายการ)</h2>
        </div>

        <div v-if="applications.length === 0" class="empty-state">
          <div class="empty-icon">📭</div>
          <h3>ไม่มีข้อมูลคำขอลงทะเบียนในระบบ</h3>
        </div>

        <div v-else class="table-responsive">
          <table class="admin-table" aria-label="ตารางข้อมูลนักเรียนและคำขอลงทะเบียน">
            <thead>
              <tr>
              <th scope="col">เลขที่</th>
              <th scope="col">รหัส 5 หลัก</th>
              <th scope="col">ชื่อ - นามสกุล</th>
              <th scope="col">ห้องเรียน</th>
              <th scope="col">สถานะ</th>
              <th scope="col" class="text-center">การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="app in applications" :key="app.id" :id="`student-row-${app.id}`">
              <td class="font-medium text-center">{{ app.roll_number }}</td>
              <td>
                <code class="student-id-badge">{{ app.student_id }}</code>
              </td>
              <td class="font-medium">{{ app.title }} {{ app.first_name }} {{ app.last_name }}</td>
              <td>{{ app.class?.name || '-' }} (ปี {{ app.class?.academic_year || '-' }})</td>
              <td>
                <span
                  class="status-tag"
                  :class="{
                    'tag-approved': app.status === 'approved',
                    'tag-pending': app.status === 'pending',
                  }"
                >
                  {{ app.status === 'approved' ? 'อนุมัติแล้ว' : 'รอตรวจสอบ' }}
                </span>
              </td>
              <td class="text-center actions-cell">
                <button
                  v-if="app.status === 'pending'"
                  type="button"
                  class="btn btn-primary btn-sm"
                  :id="`approve-btn-${app.id}`"
                  :disabled="isProcessing"
                  @click="startApproval(app)"
                >
                  อนุมัติ
                </button>
                <button
                  type="button"
                  class="btn btn-outline btn-sm"
                  :id="`correct-btn-${app.id}`"
                  :disabled="isProcessing"
                  @click="startCorrection(app)"
                >
                  แก้ไขข้อมูล
                </button>
                <button
                  v-if="app.status === 'approved' && app.active_membership"
                  type="button"
                  class="btn btn-secondary btn-sm"
                  :id="`transfer-btn-${app.id}`"
                  :disabled="isProcessing"
                  @click="handleStartTransfer(app)"
                >
                  ย้ายห้อง
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      </section>
    </div>

    <!-- Modal 1: Correction Modal -->
    <div
      v-if="editingApplication"
      class="modal-backdrop"
      role="presentation"
      @click.self="cancelCorrection"
    >
      <div
        class="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="correct-modal-title"
      >
        <div class="modal-header">
          <h2 id="correct-modal-title">แก้ไขข้อมูลคำขอ / นักเรียน</h2>
        </div>
        <form @submit.prevent="submitCorrection">
          <div class="modal-body">
            <div class="form-group">
              <label for="edit-title">คำนำหน้าชื่อ</label>
              <select id="edit-title" v-model="editingApplication.title" class="form-control">
                <option v-for="t in ALLOWED_TITLES" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>
            <div class="form-group">
              <label for="edit-first-name">ชื่อ</label>
              <input id="edit-first-name" v-model="editingApplication.first_name" type="text" class="form-control" required />
            </div>
            <div class="form-group">
              <label for="edit-last-name">นามสกุล</label>
              <input id="edit-last-name" v-model="editingApplication.last_name" type="text" class="form-control" required />
            </div>
            <div class="form-group">
              <label for="edit-student-id">รหัสประจำตัวนักเรียน (5 หลัก)</label>
              <input id="edit-student-id" v-model="editingApplication.student_id" type="text" class="form-control" maxlength="5" required />
            </div>
            <div class="form-group">
              <label for="edit-class">ห้องเรียน</label>
              <select
                v-if="editingApplication.status !== 'approved'"
                id="edit-class"
                v-model="editingApplication.class_id"
                class="form-control"
              >
                <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.name }} (ปี {{ c.academic_year }})</option>
              </select>
              <div v-else>
                <input
                  id="edit-class"
                  type="text"
                  class="form-control"
                  :value="classes.find(c => c.id === editingApplication.class_id)?.name || editingApplication.class_id"
                  disabled
                />
                <small class="text-muted" id="approved-class-transfer-guidance">
                  นักเรียนที่ได้รับการอนุมัติแล้ว ไม่สามารถเปลี่ยนห้องเรียนผ่านการแก้ไขข้อมูลได้ หากต้องการเปลี่ยนห้องเรียนกรุณาใช้ปุ่ม "ย้ายห้อง" (Transfer)
                </small>
              </div>
            </div>
            <div class="form-group">
              <label for="edit-roll">เลขที่ (1 - 45)</label>
              <input id="edit-roll" v-model.number="editingApplication.roll_number" type="number" min="1" max="45" class="form-control" required />
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" :disabled="isProcessing" @click="cancelCorrection">
              ยกเลิก
            </button>
            <button type="submit" class="btn btn-primary" :disabled="isProcessing" id="save-correction-btn">
              {{ isProcessing ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal 2: Transfer Modal -->
    <div
      v-if="transferringStudent"
      class="modal-backdrop"
      role="presentation"
      @click.self="cancelTransfer"
    >
      <div
        class="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transfer-modal-title"
      >
        <div class="modal-header">
          <h2 id="transfer-modal-title">ย้ายห้องเรียนนักเรียน</h2>
        </div>
        <div class="modal-body">
          <p>
            ย้ายนักเรียน: <strong>{{ transferringStudent.title }} {{ transferringStudent.first_name }} {{ transferringStudent.last_name }}</strong>
            (รหัส <code>{{ transferringStudent.student_id }}</code>)
          </p>
          <p class="text-muted">
            ห้องเรียนปัจจุบัน: {{ transferringStudent.class?.name || '-' }} (เลขที่ {{ transferringStudent.roll_number }})
          </p>

          <div class="form-group">
            <label for="transfer-dest-class">ห้องเรียนปลายทาง:</label>
            <select
              id="transfer-dest-class"
              v-model="transferForm.destination_class_id"
              class="form-control"
              required
            >
              <option value="">-- เลือกห้องเรียนปลายทาง --</option>
              <option
                v-for="c in classes.filter((cl) => cl.is_active && cl.id !== transferringStudent?.class_id)"
                :key="c.id"
                :value="c.id"
              >
                {{ c.name }} (ปีการศึกษา {{ c.academic_year }})
              </option>
            </select>
          </div>

          <div class="form-group">
            <label for="transfer-new-roll">เลขที่ในห้องเรียนใหม่ (1 - 45):</label>
            <input
              id="transfer-new-roll"
              v-model.number="transferForm.new_roll_number"
              type="number"
              min="1"
              max="45"
              class="form-control"
              required
            />
          </div>

          <p class="modal-warning">
            ⚠️ การย้ายห้องเรียนจะทำให้สิทธิ์ของนักเรียนในห้องเรียนเดิมสิ้นสุดลงทันที และบันทึกประวัติการย้ายในระบบตรวจสอบ
          </p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" :disabled="isProcessing" @click="cancelTransfer">
            ยกเลิก
          </button>
          <button
            type="button"
            class="btn btn-primary"
            id="confirm-transfer-btn"
            :disabled="isProcessing || !transferForm.destination_class_id"
            @click="handleConfirmTransfer"
          >
            {{ isProcessing ? 'กำลังดำเนินการ...' : 'ยืนยันการย้ายห้อง' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal 3: Assign Teacher Confirmation Modal -->
    <div
      v-if="confirmingAssignment"
      class="modal-backdrop"
      role="presentation"
      @click.self="cancelAssignPrompt"
    >
      <div
        class="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-assign-title"
      >
        <div class="modal-header">
          <h2 id="confirm-assign-title">ยืนยันการมอบหมายห้องเรียน</h2>
        </div>
        <div class="modal-body">
          <p>
            คุณต้องการมอบหมายห้องเรียน <strong>{{ confirmingAssignment.class_name }}</strong>
            ให้กับครูรหัส <code>{{ confirmingAssignment.teacher_id }}</code> ใช่หรือไม่?
          </p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" :disabled="isProcessing" @click="cancelAssignPrompt">
            ยกเลิก
          </button>
          <button
            type="button"
            class="btn btn-primary"
            id="confirm-assign-submit-btn"
            :disabled="isProcessing"
            @click="executeAssignTeacher"
          >
            {{ isProcessing ? 'กำลังดำเนินการ...' : 'ยืนยันการมอบหมาย' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal 4: Revoke Teacher Confirmation Modal -->
    <div
      v-if="confirmingRevocation"
      class="modal-backdrop"
      role="presentation"
      @click.self="cancelRevokePrompt"
    >
      <div
        class="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-revoke-title"
      >
        <div class="modal-header">
          <h2 id="confirm-revoke-title">ยืนยันการเพิกถอนสิทธิ์ครูประจำชั้น</h2>
        </div>
        <div class="modal-body">
          <p>
            คุณต้องการเพิกถอนการมอบหมายห้องเรียน <strong>{{ confirmingRevocation.class_name }}</strong>
            ของครูรหัส <code>{{ confirmingRevocation.teacher_id }}</code> ใช่หรือไม่?
          </p>
          <p class="modal-warning">
            ⚠️ เมื่อเพิกถอนสิทธิ์แล้ว ครูจะไม่สามารถเข้าถึงคิวการอนุมัติคำขอของห้องเรียนนี้ได้อีกต่อไป
          </p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" :disabled="isProcessing" @click="cancelRevokePrompt">
            ยกเลิก
          </button>
          <button
            type="button"
            class="btn btn-danger"
            id="confirm-revoke-submit-btn"
            :disabled="isProcessing"
            @click="executeRevokeTeacher"
          >
            {{ isProcessing ? 'กำลังดำเนินการ...' : 'ยืนยันการเพิกถอน' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal 5: Approval Confirmation Modal -->
    <div
      v-if="approvingApplication"
      class="modal-backdrop"
      role="presentation"
      @click.self="cancelApproval"
    >
      <div
        class="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="approve-modal-title"
      >
        <div class="modal-header">
          <h2 id="approve-modal-title">ยืนยันการอนุมัติคำขอลงทะเบียน</h2>
        </div>
        <div class="modal-body">
          <p>
            กรุณาตรวจสอบข้อมูลกับทะเบียนนักเรียนจริงของโรงเรียนก่อนกดยืนยัน:
          </p>
          <ul class="confirm-list">
            <li>
              <strong>ชื่อ - นามสกุล:</strong>
              {{ approvingApplication.title }} {{ approvingApplication.first_name }} {{ approvingApplication.last_name }}
            </li>
            <li>
              <strong>รหัสประจำตัวนักเรียน:</strong>
              <code>{{ approvingApplication.student_id }}</code>
            </li>
            <li>
              <strong>ห้องเรียน:</strong>
              {{ approvingApplication.class?.name || '-' }} (ปี {{ approvingApplication.class?.academic_year || '-' }})
            </li>
            <li>
              <strong>เลขที่:</strong>
              {{ approvingApplication.roll_number }}
            </li>
          </ul>
          <p class="modal-warning">
            ⚠️ เมื่ออนุมัติแล้ว ระบบจะสร้างสิทธิ์สมาชิกห้องเรียน (Class Membership) และรหัสนักเรียน 5 หลักนี้จะถูกผูกกับผู้ใช้
          </p>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-outline"
            id="cancel-admin-approve-btn"
            :disabled="isProcessing"
            @click="cancelApproval"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            class="btn btn-primary"
            id="confirm-admin-approve-btn"
            :disabled="isProcessing"
            @click="handleConfirmApproval"
          >
            {{ isProcessing ? 'กำลังบันทึก...' : 'ยืนยันอนุมัติ' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-page-container {
  max-width: 1100px;
  margin: 2rem auto;
  padding: 0 1.5rem;
}

.header {
  margin-bottom: 2rem;
  text-align: center;
}

.badge {
  display: inline-block;
  font-size: 0.8rem;
  font-weight: 600;
  color: #4338ca;
  background-color: #e0e7ff;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  margin-bottom: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

h1 {
  font-size: 1.85rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0 0 0.5rem 0;
  letter-spacing: -0.025em;
}

.subtitle {
  font-size: 1rem;
  color: #64748b;
  margin: 0;
}

.alert {
  padding: 1rem 1.25rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  font-size: 0.95rem;
  line-height: 1.5;
}

.alert-danger {
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
}

.alert-success {
  background-color: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #166534;
}

.card {
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.loading-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  gap: 1rem;
  color: #64748b;
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid #e2e8f0;
  border-top-color: #4338ca;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.denied-card {
  text-align: center;
  padding: 3rem 2rem;
}

.denied-card h2 {
  color: #991b1b;
  font-size: 1.4rem;
  margin-bottom: 0.75rem;
}

.admin-toolbar {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e2e8f0;
}

.admin-toolbar h2 {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
  color: #1e293b;
}

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.table-responsive {
  overflow-x: auto;
}

.admin-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.admin-table th,
.admin-table td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #f1f5f9;
  font-size: 0.9rem;
}

.admin-table th {
  background-color: #f8fafc;
  font-weight: 600;
  color: #475569;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
}

.student-id-badge {
  background-color: #f1f5f9;
  color: #0f172a;
  padding: 0.2rem 0.45rem;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.9rem;
  font-weight: 600;
}

.status-tag {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.2rem 0.5rem;
  border-radius: 9999px;
}

.tag-approved {
  background-color: #dcfce7;
  color: #15803d;
}

.tag-pending {
  background-color: #fef3c7;
  color: #b45309;
}

.font-medium {
  font-weight: 500;
}

.text-center {
  text-align: center;
}

.actions-cell {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s ease;
  text-decoration: none;
}

.btn-sm {
  padding: 0.35rem 0.75rem;
  font-size: 0.85rem;
}

.btn-primary {
  background-color: #4338ca;
  color: #ffffff;
}

.btn-primary:hover:not(:disabled) {
  background-color: #3730a3;
}

.btn-secondary {
  background-color: #f1f5f9;
  color: #475569;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #e2e8f0;
}

.btn-outline {
  border-color: #cbd5e1;
  background-color: #ffffff;
  color: #334155;
}

.btn-outline:hover:not(:disabled) {
  background-color: #f8fafc;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-top: 1.5rem;
}

/* Modal */
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(15, 23, 42, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1.5rem;
}

.modal-dialog {
  background-color: #ffffff;
  border-radius: 12px;
  max-width: 520px;
  width: 100%;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.modal-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #e2e8f0;
}

.modal-header h2 {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
  color: #0f172a;
}

.modal-body {
  padding: 1.5rem;
  font-size: 0.95rem;
  color: #334155;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 0.35rem;
  color: #334155;
}

.form-control {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 0.95rem;
  color: #0f172a;
  background-color: #ffffff;
}

.form-control:focus {
  outline: none;
  border-color: #4338ca;
  box-shadow: 0 0 0 3px rgba(67, 56, 202, 0.15);
}

.modal-warning {
  margin: 1rem 0 0 0;
  font-size: 0.85rem;
  color: #b45309;
  background-color: #fffbeb;
  padding: 0.75rem;
  border-radius: 6px;
}

.confirm-list {
  list-style: none;
  padding: 0;
  margin: 1rem 0;
}

.confirm-list li {
  padding: 0.35rem 0;
  color: #334155;
}

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  background-color: #f8fafc;
}

.admin-section {
  margin-bottom: 2rem;
}

.section-desc {
  font-size: 0.9rem;
  color: #64748b;
  margin: -0.5rem 0 1.25rem 0;
}

.section-divider {
  border: 0;
  border-top: 1px solid #e2e8f0;
  margin: 2.5rem 0;
}

.assignment-form {
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
}

.form-row {
  display: flex;
  gap: 1rem;
  align-items: flex-end;
  flex-wrap: wrap;
}

.flex-1 {
  flex: 1;
  min-width: 200px;
}

.form-actions-inline {
  margin-bottom: 1rem;
}

.subsection-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 0.75rem 0;
}

.empty-state-sub {
  text-align: center;
  padding: 1.5rem;
  background-color: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  color: #64748b;
  font-size: 0.9rem;
}

.btn-danger {
  background-color: #ef4444;
  color: #ffffff;
  border: 1px solid #dc2626;
}

.btn-danger:hover:not(:disabled) {
  background-color: #dc2626;
}
</style>
