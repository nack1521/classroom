<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { fetchUserRoles, type SafeUserRoles } from '../utils/auth'
import { useTeacherReview, type TeacherReviewApplication } from '../composables/useTeacherReview'

definePageMeta({
  middleware: ['auth'],
})

const { user, client, signOut } = useAuth()
const {
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
} = useTeacherReview()

const roles = ref<SafeUserRoles>({
  isAdmin: false,
  isTeacher: false,
  roles: [],
})
const isCheckingRoles = ref(true)

async function loadUserRolesAndQueue() {
  isCheckingRoles.value = true
  if (!user.value?.id || !client) {
    roles.value = { isAdmin: false, isTeacher: false, roles: [] }
    isCheckingRoles.value = false
    clearReviewState()
    return
  }

  const fetchedRoles = await fetchUserRoles(client, user.value.id)
  roles.value = fetchedRoles

  if (fetchedRoles.isAdmin || fetchedRoles.isTeacher) {
    await fetchApplications(selectedClassId.value || undefined)
  } else {
    clearReviewState()
  }
  isCheckingRoles.value = false
}

onMounted(async () => {
  await loadUserRolesAndQueue()
})

watch(
  () => user.value?.id,
  async (newId, oldId) => {
    if (!newId || (oldId && newId !== oldId)) {
      clearReviewState()
      await loadUserRolesAndQueue()
    }
  }
)

async function handleClassChange() {
  await fetchApplications(selectedClassId.value || undefined)
}

async function handleConfirmApproval() {
  if (!targetToConfirm.value) return
  await executeApproval(targetToConfirm.value.id)
}

async function handleSignOut() {
  clearReviewState()
  await signOut()
}
</script>

<template>
  <div class="review-page-container">
    <header class="header">
      <div class="badge">Slice 0C — Teacher Review Queue</div>
      <h1>ตรวจสอบและอนุมัติคำขอลงทะเบียน (Review Registration Claims)</h1>
      <p class="subtitle">
        ตรวจสอบความถูกต้องของรหัสประจำตัวนักเรียนและเลขที่ในห้องเรียนที่ได้รับมอบหมาย
      </p>
    </header>

    <!-- Error notice -->
    <div v-if="errorMessage" class="alert alert-danger" id="review-error-alert" role="alert">
      <strong>ข้อผิดพลาด:</strong> {{ errorMessage }}
    </div>

    <!-- Success notice -->
    <div v-if="successMessage" class="alert alert-success" id="review-success-alert" role="status">
      <strong>สำเร็จ:</strong> {{ successMessage }}
    </div>

    <!-- Checking roles state -->
    <div v-if="isCheckingRoles || isLoading" class="card loading-card" id="review-loading-view">
      <div class="spinner"></div>
      <p>กำลังโหลดข้อมูลการตรวจสอบ...</p>
    </div>

    <!-- Access Denied: User is neither teacher nor admin -->
    <div
      v-else-if="!roles.isAdmin && !roles.isTeacher"
      class="card denied-card"
      id="review-access-denied-view"
    >
      <h2>ไม่มีสิทธิ์เข้าถึงหน้านี้ (Access Denied)</h2>
      <p class="card-desc">
        หน้านี้สงวนไว้สำหรับครูประจำชั้นที่ได้รับมอบหมายห้องเรียนหรือผู้ดูแลระบบเท่านั้น
      </p>
      <div class="actions">
        <NuxtLink to="/" class="btn btn-primary" id="review-home-btn">
          กลับสู่หน้าหลัก
        </NuxtLink>
        <button class="btn btn-secondary" @click="handleSignOut">
          ออกจากระบบ
        </button>
      </div>
    </div>

    <!-- Authorized View: Teacher / Admin Queue -->
    <div v-else class="card queue-card" id="review-queue-view">
      <div class="queue-toolbar">
        <div class="filter-group">
          <label for="class-filter-select" class="filter-label">เลือกห้องเรียน:</label>
          <select
            id="class-filter-select"
            v-model="selectedClassId"
            class="form-control filter-select"
            @change="handleClassChange"
          >
            <option value="">ทุกห้องที่ได้รับมอบหมาย (All Assigned Classes)</option>
            <option v-for="c in assignedClasses" :key="c.id" :value="c.id">
              {{ c.name }} (ปีการศึกษา {{ c.academic_year }})
            </option>
          </select>
        </div>

        <div class="queue-count">
          คำขอที่รอการตรวจสอบ: <strong>{{ applications.length }}</strong> รายการ
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="applications.length === 0" class="empty-state" id="review-empty-state">
        <div class="empty-icon">📋</div>
        <h3>ไม่มีคำขอลงทะเบียนที่รอการตรวจสอบ</h3>
        <p v-if="assignedClasses.length === 0 && !roles.isAdmin" class="text-muted">
          คุณยังไม่ได้รับมอบหมายห้องเรียน กรุณาติดต่อผู้ดูแลระบบเพื่อกำหนดห้องเรียน
        </p>
        <p v-else class="text-muted">
          คำขอทั้งหมดในห้องเรียนนี้ได้รับการตรวจสอบและอนุมัติแล้ว
        </p>
      </div>

      <!-- Table / Cards of pending applications -->
      <div v-else class="table-responsive">
        <table class="review-table" aria-label="รายการคำขอลงทะเบียนนักเรียน">
          <thead>
            <tr>
              <th scope="col">เลขที่</th>
              <th scope="col">รหัส 5 หลัก</th>
              <th scope="col">ชื่อ - นามสกุล</th>
              <th scope="col">ห้องเรียน</th>
              <th scope="col">วันที่ยื่น</th>
              <th scope="col" class="text-center">การดำเนินการ</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="app in applications" :key="app.id" :id="`app-row-${app.id}`">
              <td class="font-medium text-center">{{ app.roll_number }}</td>
              <td>
                <code class="student-id-badge">{{ app.student_id }}</code>
              </td>
              <td class="font-medium">{{ app.title }} {{ app.first_name }} {{ app.last_name }}</td>
              <td>{{ app.class?.name || '-' }} (ปี {{ app.class?.academic_year || '-' }})</td>
              <td class="text-muted">{{ new Date(app.created_at).toLocaleDateString('th-TH') }}</td>
              <td class="text-center">
                <button
                  type="button"
                  class="btn btn-success btn-sm"
                  :id="`approve-btn-${app.id}`"
                  :disabled="isApproving"
                  @click="confirmApproval(app)"
                >
                  อนุมัติ (Approve)
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Confirmation Modal Dialog -->
    <div
      v-if="targetToConfirm"
      class="modal-backdrop"
      role="presentation"
      @click.self="cancelConfirmation"
    >
      <div
        class="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        <div class="modal-header">
          <h2 id="confirm-modal-title">ยืนยันการอนุมัติคำขอลงทะเบียน</h2>
        </div>
        <div class="modal-body">
          <p>
            กรุณาตรวจสอบข้อมูลกับทะเบียนนักเรียนจริงของโรงเรียนก่อนกดยืนยัน:
          </p>
          <ul class="confirm-list">
            <li>
              <strong>ชื่อ - นามสกุล:</strong>
              {{ targetToConfirm.title }} {{ targetToConfirm.first_name }} {{ targetToConfirm.last_name }}
            </li>
            <li>
              <strong>รหัสประจำตัวนักเรียน:</strong>
              <code>{{ targetToConfirm.student_id }}</code>
            </li>
            <li>
              <strong>ห้องเรียน:</strong>
              {{ targetToConfirm.class?.name || '-' }} (ปี {{ targetToConfirm.class?.academic_year || '-' }})
            </li>
            <li>
              <strong>เลขที่:</strong>
              {{ targetToConfirm.roll_number }}
            </li>
          </ul>
          <p class="modal-warning">
            ⚠️ เมื่ออนุมัติแล้ว รหัสนักเรียน 5 หลักนี้จะถูกจองถาวร และเลขที่ในห้องเรียนจะถูกผูกกับบัญชีนี้
          </p>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-outline"
            id="cancel-approve-btn"
            :disabled="isApproving"
            @click="cancelConfirmation"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            class="btn btn-primary"
            id="confirm-approve-btn"
            :disabled="isApproving"
            @click="handleConfirmApproval"
          >
            {{ isApproving ? 'กำลังบันทึก...' : 'ยืนยันอนุมัติ' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.review-page-container {
  max-width: 1000px;
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
  color: #0284c7;
  background-color: #e0f2fe;
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
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
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

.queue-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e2e8f0;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.filter-label {
  font-weight: 600;
  font-size: 0.95rem;
  color: #334155;
}

.filter-select {
  padding: 0.5rem 0.75rem;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 0.9rem;
  background-color: #ffffff;
  color: #0f172a;
}

.queue-count {
  font-size: 0.95rem;
  color: #475569;
}

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.empty-state h3 {
  font-size: 1.25rem;
  color: #1e293b;
  margin: 0 0 0.5rem 0;
}

.text-muted {
  color: #64748b;
  font-size: 0.9rem;
}

.table-responsive {
  overflow-x: auto;
}

.review-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.review-table th,
.review-table td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #f1f5f9;
  font-size: 0.9rem;
}

.review-table th {
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

.font-medium {
  font-weight: 500;
}

.text-center {
  text-align: center;
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
  background-color: #2563eb;
  color: #ffffff;
}

.btn-primary:hover:not(:disabled) {
  background-color: #1d4ed8;
}

.btn-success {
  background-color: #16a34a;
  color: #ffffff;
}

.btn-success:hover:not(:disabled) {
  background-color: #15803d;
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
  max-width: 500px;
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

.confirm-list {
  list-style: none;
  padding: 0;
  margin: 1rem 0;
  background-color: #f8fafc;
  border-radius: 8px;
  padding: 1rem;
}

.confirm-list li {
  margin-bottom: 0.5rem;
}

.confirm-list li:last-child {
  margin-bottom: 0;
}

.modal-warning {
  margin: 1rem 0 0 0;
  font-size: 0.85rem;
  color: #b45309;
  background-color: #fffbeb;
  padding: 0.75rem;
  border-radius: 6px;
}

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  background-color: #f8fafc;
}
</style>
