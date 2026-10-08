<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { ALLOWED_TITLES, type AllowedTitle } from '../utils/studentApplication'

definePageMeta({
  middleware: ['auth'],
})

const { user, signOut } = useAuth()
const {
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
} = useStudentApplication()

function createEmptyForm() {
  return {
    title: '' as AllowedTitle | '',
    first_name: '',
    last_name: '',
    student_id: '',
    class_id: '',
    roll_number: null as number | null,
  }
}

// Form model
const form = ref(createEmptyForm())

function resetForm() {
  form.value = createEmptyForm()
}

onMounted(async () => {
  await Promise.all([fetchClasses(), fetchMyApplication()])
})

watch(
  () => user.value?.id,
  (newId, oldId) => {
    if (!newId || (oldId && newId !== oldId)) {
      clearApplication()
      resetForm()
    }
  }
)

async function handleSignOut() {
  clearApplication()
  resetForm()
  await signOut()
}

async function handleSubmit() {
  if (!form.value.title || !form.value.first_name || !form.value.last_name || !form.value.student_id || !form.value.class_id || form.value.roll_number === null) {
    return
  }

  const res = await submitApplication({
    title: form.value.title as AllowedTitle,
    first_name: form.value.first_name,
    last_name: form.value.last_name,
    student_id: form.value.student_id,
    class_id: form.value.class_id,
    roll_number: Number(form.value.roll_number),
  })

  if (res.success) {
    resetForm()
  }
}
</script>

<template>
  <div class="page-container">
    <header class="header">
      <div class="badge">Slice 0B — Student Onboarding</div>
      <h1>คำขอลงทะเบียนนักเรียน (Student Registration)</h1>
      <p class="subtitle">
        ลงทะเบียนขอเข้าร่วมชั้นเรียนด้วยบัญชี Google และรหัสประจำตัวนักเรียน 5 หลักเดิม
      </p>
    </header>

    <!-- Error notice -->
    <div v-if="errorMessage" class="alert alert-danger" id="apply-error-alert">
      <strong>ข้อผิดพลาด:</strong> {{ errorMessage }}
    </div>

    <!-- Success notice -->
    <div v-if="successMessage" class="alert alert-success" id="apply-success-alert">
      <strong>สำเร็จ:</strong> {{ successMessage }}
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="card loading-card">
      <div class="spinner"></div>
      <p>กำลังตรวจสอบสถานะการสมัคร...</p>
    </div>

    <!-- State 1: Existing application found (Read-only status card) -->
    <div v-else-if="application" class="card status-card" id="application-status-view">
      <div class="status-header">
        <h2>สถานะคำขอลงทะเบียนของคุณ</h2>
        <span
          class="status-tag"
          :class="{
            'tag-pending': application.status === 'pending',
            'tag-approved': application.status === 'approved',
            'tag-rejected': application.status === 'rejected',
          }"
        >
          {{ application.status === 'pending' ? 'รอการตรวจสอบ (Pending)' : application.status }}
        </span>
      </div>

      <p class="card-desc">
        คุณได้ส่งคำขอลงทะเบียนเรียบร้อยแล้ว ครูผู้สอนจะทำการตรวจสอบข้อมูลกับรายชื่อในระบบของโรงเรียน
      </p>

      <div class="details-table">
        <div class="detail-row">
          <span class="detail-label">ชื่อ - นามสกุล:</span>
          <span class="detail-value font-medium" id="display-name">
            {{ application.title }} {{ application.first_name }} {{ application.last_name }}
          </span>
        </div>

        <div class="detail-row">
          <span class="detail-label">รหัสประจำตัวนักเรียน (5 หลัก):</span>
          <code class="detail-code" id="display-student-id">{{ application.student_id }}</code>
        </div>

        <div class="detail-row">
          <span class="detail-label">ห้องเรียนที่เลือก:</span>
          <span class="detail-value" id="display-class">
            {{ application.class?.name || 'ห้องเรียน' }} (ปีการศึกษา {{ application.class?.academic_year || '-' }})
          </span>
        </div>

        <div class="detail-row">
          <span class="detail-label">เลขที่:</span>
          <span class="detail-value font-medium" id="display-roll">
            {{ application.roll_number }}
          </span>
        </div>

        <div class="detail-row">
          <span class="detail-label">วันที่ส่งคำขอ:</span>
          <span class="detail-value text-muted">
            {{ new Date(application.created_at).toLocaleDateString('th-TH') }}
          </span>
        </div>
      </div>

      <div class="instruction-box">
        <strong>คำแนะนำในการแก้ไขข้อมูล:</strong>
        <p>
          หากข้อมูลที่ส่งไม่ถูกต้อง ซ้ำซ้อน หรือต้องการย้ายห้องเรียน กรุณาติดต่อครูผู้ดูแลระบบ (ครูแน็ค) โดยตรง
          นักเรียนจะไม่สามารถแก้ไขข้อมูลที่ส่งแล้วได้ด้วยตนเอง
        </p>
      </div>

      <div class="security-notice">
        <span>ℹ️ <strong>หมายเหตุ:</strong> การส่งคำขอที่อยู่ในสถานะรอการตรวจสอบ (Pending) ยังไม่ได้รับสิทธิ์เข้าถึงเนื้อหารายวิชา</span>
      </div>

      <div class="actions">
        <NuxtLink
          v-if="application.status === 'approved'"
          to="/learn"
          class="btn btn-primary"
          id="go-to-learn-btn"
        >
          เข้าสู่ห้องเรียนออนไลน์
        </NuxtLink>
        <NuxtLink to="/" class="btn btn-outline" id="back-home-btn">
          กลับสู่หน้าหลัก
        </NuxtLink>
        <button class="btn btn-secondary" @click="handleSignOut">
          ออกจากระบบ
        </button>
      </div>
    </div>

    <!-- State 2: No application yet (Show registration form) -->
    <div v-else class="card form-card" id="application-form-view">
      <h2>แบบฟอร์มขอลงทะเบียนนักเรียน</h2>
      <p class="card-desc">
        กรุณากรอกข้อมูลจริงตามทะเบียนนักเรียนของโรงเรียน เพื่อให้ครูผู้สอนตรวจสอบความถูกต้อง
      </p>

      <form @submit.prevent="handleSubmit" class="apply-form">
        <!-- Title -->
        <div class="form-group">
          <label for="input-title">คำนำหน้าชื่อ <span class="required">*</span></label>
          <select
            id="input-title"
            v-model="form.title"
            class="form-control"
            :class="{ 'is-invalid': fieldErrors.title }"
            required
          >
            <option value="" disabled>-- เลือกคำนำหน้าชื่อ --</option>
            <option v-for="t in ALLOWED_TITLES" :key="t" :value="t">{{ t }}</option>
          </select>
          <span v-if="fieldErrors.title" class="field-error">{{ fieldErrors.title }}</span>
        </div>

        <!-- Name Row -->
        <div class="form-row">
          <div class="form-group flex-1">
            <label for="input-first-name">ชื่อ (ภาษาไทย) <span class="required">*</span></label>
            <input
              id="input-first-name"
              v-model="form.first_name"
              type="text"
              class="form-control"
              :class="{ 'is-invalid': fieldErrors.first_name }"
              placeholder="เช่น สมชาย"
              maxlength="100"
              required
            />
            <span v-if="fieldErrors.first_name" class="field-error">{{ fieldErrors.first_name }}</span>
          </div>

          <div class="form-group flex-1">
            <label for="input-last-name">นามสกุล (ภาษาไทย) <span class="required">*</span></label>
            <input
              id="input-last-name"
              v-model="form.last_name"
              type="text"
              class="form-control"
              :class="{ 'is-invalid': fieldErrors.last_name }"
              placeholder="เช่น ใจดี"
              maxlength="100"
              required
            />
            <span v-if="fieldErrors.last_name" class="field-error">{{ fieldErrors.last_name }}</span>
          </div>
        </div>

        <!-- Student ID (5 ASCII digits) -->
        <div class="form-group">
          <label for="input-student-id">
            รหัสประจำตัวนักเรียนเดิม (5 หลัก) <span class="required">*</span>
          </label>
          <input
            id="input-student-id"
            v-model="form.student_id"
            type="text"
            class="form-control"
            :class="{ 'is-invalid': fieldErrors.student_id }"
            placeholder="เช่น 01234"
            maxlength="5"
            pattern="[0-9]{5}"
            inputmode="numeric"
            required
          />
          <span class="field-hint">กรุณาระบุตัวเลข 5 หลักให้ครบถ้วน รวมถึงเลข 0 นำหน้า</span>
          <span v-if="fieldErrors.student_id" class="field-error">{{ fieldErrors.student_id }}</span>
        </div>

        <!-- Class & Roll Row -->
        <div class="form-row">
          <div class="form-group flex-2">
            <label for="input-class">ห้องเรียน <span class="required">*</span></label>
            <select
              id="input-class"
              v-model="form.class_id"
              class="form-control"
              :class="{ 'is-invalid': fieldErrors.class_id }"
              required
            >
              <option value="" disabled>-- เลือกห้องเรียน --</option>
              <option v-for="c in classes" :key="c.id" :value="c.id">
                {{ c.name }} (ปีการศึกษา {{ c.academic_year }})
              </option>
            </select>
            <span v-if="fieldErrors.class_id" class="field-error">{{ fieldErrors.class_id }}</span>
          </div>

          <div class="form-group flex-1">
            <label for="input-roll">เลขที่ (1–45) <span class="required">*</span></label>
            <input
              id="input-roll"
              v-model.number="form.roll_number"
              type="number"
              min="1"
              max="45"
              class="form-control"
              :class="{ 'is-invalid': fieldErrors.roll_number }"
              placeholder="1–45"
              required
            />
            <span v-if="fieldErrors.roll_number" class="field-error">{{ fieldErrors.roll_number }}</span>
          </div>
        </div>

        <div class="form-footer">
          <button
            type="submit"
            class="btn btn-primary"
            id="submit-application-btn"
            :disabled="isSubmitting"
          >
            {{ isSubmitting ? 'กำลังส่งข้อมูล...' : 'ส่งคำขอลงทะเบียน' }}
          </button>
          <NuxtLink to="/" class="btn btn-outline">
            ยกเลิก
          </NuxtLink>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.page-container {
  max-width: 768px;
  margin: 0 auto;
  padding: 2.5rem 1.5rem;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: #1e293b;
}

.header {
  margin-bottom: 2rem;
}

.badge {
  display: inline-block;
  padding: 0.25rem 0.6rem;
  background-color: #e0e7ff;
  color: #3730a3;
  font-weight: 600;
  font-size: 0.75rem;
  border-radius: 9999px;
  margin-bottom: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

h1 {
  font-size: 1.85rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 0.5rem 0;
  letter-spacing: -0.02em;
}

.subtitle {
  font-size: 1rem;
  color: #64748b;
  margin: 0;
  line-height: 1.5;
}

.alert {
  padding: 1rem 1.25rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  font-size: 0.95rem;
  line-height: 1.4;
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
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.75rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  margin-bottom: 1.5rem;
}

.card h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 0.25rem 0;
  color: #0f172a;
}

.card-desc {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0 0 1.5rem 0;
  line-height: 1.45;
}

.status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.status-tag {
  display: inline-block;
  padding: 0.35rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.8rem;
  font-weight: 600;
}

.tag-pending {
  background-color: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
}

.tag-approved {
  background-color: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.tag-rejected {
  background-color: #fee2e2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.details-table {
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
}

.detail-label {
  color: #475569;
}

.detail-value {
  color: #0f172a;
}

.font-medium {
  font-weight: 600;
}

.detail-code {
  background-color: #e2e8f0;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.9rem;
  font-family: monospace;
  color: #0f172a;
  letter-spacing: 0.05em;
}

.instruction-box {
  background-color: #f8fafc;
  border-left: 4px solid #3b82f6;
  padding: 0.875rem 1rem;
  border-radius: 0 6px 6px 0;
  margin-bottom: 1.25rem;
  font-size: 0.85rem;
  color: #334155;
  line-height: 1.45;
}

.instruction-box p {
  margin: 0.35rem 0 0 0;
}

.security-notice {
  background-color: #fffbeb;
  border: 1px solid #fef3c7;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  margin-bottom: 1.5rem;
  font-size: 0.85rem;
  color: #92400e;
  line-height: 1.4;
}

.apply-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-row {
  display: flex;
  gap: 1rem;
}

.flex-1 {
  flex: 1;
}

.flex-2 {
  flex: 2;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.form-group label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #334155;
}

.required {
  color: #ef4444;
}

.form-control {
  padding: 0.65rem 0.875rem;
  font-size: 0.95rem;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  color: #1e293b;
  background-color: #ffffff;
  transition: border-color 0.15s ease-in-out;
}

.form-control:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

.form-control.is-invalid {
  border-color: #ef4444;
}

.field-hint {
  font-size: 0.775rem;
  color: #64748b;
}

.field-error {
  font-size: 0.775rem;
  color: #dc2626;
  font-weight: 500;
}

.form-footer {
  display: flex;
  gap: 1rem;
  margin-top: 0.75rem;
}

.actions {
  display: flex;
  gap: 1rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.65rem 1.25rem;
  font-size: 0.9rem;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
  text-decoration: none;
  border: 1px solid transparent;
}

.btn-primary {
  background-color: #2563eb;
  color: #ffffff;
}

.btn-primary:hover:not(:disabled) {
  background-color: #1d4ed8;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background-color: #e2e8f0;
  color: #334155;
}

.btn-secondary:hover {
  background-color: #cbd5e1;
}

.btn-outline {
  background-color: transparent;
  border-color: #cbd5e1;
  color: #334155;
}

.btn-outline:hover {
  background-color: #f8fafc;
  border-color: #94a3b8;
}

.loading-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  gap: 1rem;
  color: #64748b;
}

.spinner {
  width: 32px;
  height: 32px;
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
</style>
