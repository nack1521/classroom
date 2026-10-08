<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { fetchUserRoles, type SafeUserRoles } from '../../utils/auth'
import { useTeacherDrafts } from '../../composables/useTeacherDrafts'

definePageMeta({
  middleware: ['auth'],
})

const { user, client, checkVerifiedUser, signOut } = useAuth()
const {
  offerings,
  selectedOfferingId,
  articles,
  currentArticleId,
  currentArticleStatus,
  currentArticlePublishedAt,
  lastSavedTitle,
  hasUnsavedChanges,
  title,
  body,
  isPreview,
  isLoading,
  isSaving,
  isPublishing,
  errorMessage,
  successMessage,
  fieldErrors,
  MAX_TITLE_CODE_POINTS,
  MAX_BODY_CODE_POINTS,
  countCodePoints,
  fetchOfferings,
  fetchArticles,
  selectOffering,
  startNewDraft,
  loadDraft,
  saveDraft,
  publishArticle,
  togglePreview,
  clearDraftState,
} = useTeacherDrafts()

const showPublishConfirm = ref(false)

function handlePublish() {
  showPublishConfirm.value = true
}

async function confirmPublish() {
  showPublishConfirm.value = false
  await publishArticle()
}

function cancelPublish() {
  showPublishConfirm.value = false
}

const roles = ref<SafeUserRoles>({
  isAdmin: false,
  isTeacher: false,
  roles: [],
})
const isCheckingRoles = ref(true)

async function loadOfferingsAndDrafts() {
  isCheckingRoles.value = true
  if (!user.value?.id && checkVerifiedUser) {
    try {
      await checkVerifiedUser()
    } catch {}
  }
  if (!user.value?.id || !client) {
    roles.value = { isAdmin: false, isTeacher: false, roles: [] }
    isCheckingRoles.value = false
    clearDraftState()
    return
  }

  const fetchedRoles = await fetchUserRoles(client, user.value.id)
  roles.value = fetchedRoles

  if (fetchedRoles.isTeacher) {
    await fetchOfferings()
  } else {
    clearDraftState()
  }
  isCheckingRoles.value = false
}

onMounted(async () => {
  await loadOfferingsAndDrafts()
})

watch(
  () => user.value?.id,
  async (newId, oldId) => {
    if (newId !== oldId) {
      clearDraftState()
      if (newId) {
        await loadOfferingsAndDrafts()
      }
    }
  }
)

async function onOfferingChange(e: Event) {
  const target = e.target as HTMLSelectElement
  if (target?.value) {
    await selectOffering(target.value)
  }
}

async function handleSave() {
  await saveDraft()
}
</script>

<template>
  <div class="teacher-drafts-page">
    <header class="app-header">
      <div class="header-inner">
        <div class="brand">
          <NuxtLink to="/" class="brand-link">
            <span class="brand-name">Classroom</span>
          </NuxtLink>
          <span class="brand-badge">ครูผู้สอน</span>
        </div>
        <div class="user-controls">
          <span id="user-display-email" class="user-email">{{ user?.email }}</span>
          <button id="btn-sign-out" class="btn btn-secondary btn-sm" @click="signOut">
            ออกจากระบบ
          </button>
        </div>
      </div>
    </header>

    <main id="main-content" class="main-container">
      <div class="page-title-section">
        <h1 class="page-title">ระบบจัดการฉบับร่างบทเรียน</h1>
        <p class="page-subtitle">จัดทำและแก้ไขเอกสารบทเรียนฉบับร่างส่วนตัวในรายวิชาที่ได้รับมอบหมาย</p>
      </div>

      <!-- Alerts -->
      <div v-if="errorMessage" id="alert-save-error" role="alert" class="alert alert-error">
        {{ errorMessage }}
      </div>
      <div v-if="successMessage" id="alert-save-success" role="status" class="alert alert-success">
        {{ successMessage }}
      </div>

      <!-- Checking Roles or Initial Loading -->
      <div v-if="isCheckingRoles || (isLoading && offerings.length === 0)" id="loading-indicator" class="loading-state">
        <div class="spinner" aria-hidden="true"></div>
        <span>กำลังโหลดข้อมูล...</span>
      </div>

      <!-- Not a Teacher View -->
      <div v-else-if="!roles.isTeacher" id="not-teacher-state" class="empty-card">
        <h2>ไม่พบสิทธิ์ครูผู้สอน</h2>
        <p>บัญชีของคุณไม่มีบทบาทครูผู้สอนในระบบ กรุณาติดต่อผู้ดูแลระบบเพื่อขอรับสิทธิ์</p>
      </div>

      <!-- Teacher has no assigned offerings -->
      <div v-else-if="offerings.length === 0" id="empty-offerings-state" class="empty-card">
        <h2>ยังไม่มีรายวิชาที่สอน</h2>
        <p>คุณยังไม่มีรายวิชาที่ได้รับมอบหมายให้สอนในขณะนี้ หากต้องการเพิ่มสิทธิ์การสอน กรุณาติดต่อผู้ดูแลระบบ</p>
      </div>

      <!-- Main Workspace -->
      <div v-else class="workspace-grid">
        <!-- Sidebar: Offering Selector and Drafts List -->
        <aside class="workspace-sidebar">
          <div class="sidebar-section">
            <label for="offering-select" class="form-label">เลือกรายวิชาที่สอน</label>
            <select
              id="offering-select"
              class="form-select"
              :value="selectedOfferingId"
              aria-label="เลือกรายวิชาที่สอน"
              @change="onOfferingChange"
            >
              <option v-for="off in offerings" :key="off.id" :value="off.id">
                [{{ off.subject_code }}] {{ off.subject_name }} ({{ off.class_name }})
              </option>
            </select>
          </div>

          <div class="sidebar-section drafts-list-section">
            <div class="section-header">
              <h2 class="section-title">ฉบับร่างของคุณ</h2>
              <button
                id="btn-new-draft"
                class="btn btn-outline btn-sm"
                @click="startNewDraft"
              >
                + สร้างฉบับร่างใหม่
              </button>
            </div>

            <div v-if="isLoading" class="list-loading">กำลังโหลดฉบับร่าง...</div>
            <div v-else-if="articles.length === 0" id="empty-drafts-notice" class="empty-notice">
              ยังไม่มีฉบับร่างในรายวิชานี้
            </div>
            <ul v-else id="drafts-list-container" class="drafts-list" role="list">
              <li
                v-for="art in articles"
                :key="art.id"
                class="draft-item"
                :class="{ active: currentArticleId === art.id }"
              >
                <button
                  :id="`btn-open-draft-${art.id}`"
                  class="draft-item-button"
                  @click="loadDraft(art.id)"
                >
                  <span class="draft-item-title">{{ art.title }}</span>
                  <span
                    :class="['draft-item-badge', art.status === 'published' ? 'badge-published' : 'badge-draft']"
                  >
                    {{ art.status === 'published' ? 'เผยแพร่แล้ว' : 'ฉบับร่างส่วนตัว' }}
                  </span>
                </button>
              </li>
            </ul>
          </div>
        </aside>

        <!-- Main Editor / Preview -->
        <section class="workspace-editor">
          <div class="editor-header">
            <div class="editor-status">
              <span v-if="!currentArticleId" class="badge badge-neutral">สร้างฉบับร่างใหม่</span>
              <template v-else-if="currentArticleStatus === 'published'">
                <span class="badge badge-success">กำลังแก้ไขบทความที่เผยแพร่แล้ว (Published)</span>
                <span v-if="hasUnsavedChanges" id="badge-unsaved-published" class="badge badge-warning">
                  มีข้อความที่ยังไม่ได้บันทึก (ผู้อ่านจะยังเห็นเฉพาะเนื้อหาที่บันทึกก่อนหน้านี้)
                </span>
              </template>
              <template v-else>
                <span class="badge badge-info">กำลังแก้ไขฉบับร่าง (ยังไม่เผยแพร่)</span>
                <span v-if="hasUnsavedChanges" id="badge-unsaved-draft" class="badge badge-warning">
                  มีข้อความที่แก้ไขแต่ยังไม่ได้บันทึก
                </span>
              </template>
            </div>
            <div class="editor-actions">
              <button
                id="btn-toggle-preview"
                class="btn btn-secondary"
                type="button"
                @click="togglePreview()"
              >
                {{ isPreview ? 'กลับไปหน้าแก้ไข' : 'ดูตัวอย่าง' }}
              </button>
              <button
                id="btn-save-draft"
                class="btn btn-primary"
                type="button"
                :disabled="isSaving || isPublishing || isLoading || !selectedOfferingId"
                @click="handleSave"
              >
                {{ isSaving ? 'กำลังบันทึก...' : (currentArticleStatus === 'published' ? 'บันทึกการแก้ไข' : 'บันทึกฉบับร่าง') }}
              </button>
              <button
                v-if="currentArticleId && currentArticleStatus === 'draft'"
                id="btn-publish-article"
                class="btn btn-publish"
                type="button"
                :disabled="isSaving || isPublishing || isLoading || hasUnsavedChanges"
                :title="hasUnsavedChanges ? 'มีข้อความที่ยังไม่ได้บันทึก กรุณากดบันทึกก่อนเผยแพร่' : 'เผยแพร่บทความ'"
                @click="handlePublish"
              >
                {{ isPublishing ? 'กำลังเผยแพร่...' : '🚀 เผยแพร่บทความ' }}
              </button>
              <span
                v-else-if="currentArticleStatus === 'published'"
                id="published-status-indicator"
                class="badge badge-success badge-inline"
              >
                ✓ เผยแพร่แล้ว
              </span>
            </div>
          </div>

          <!-- Publish Confirmation Dialog -->
          <div
            v-if="showPublishConfirm"
            id="modal-publish-confirm"
            class="modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-publish-title"
          >
            <div class="modal-box">
              <h3 id="modal-publish-title" class="modal-title">ยืนยันการเผยแพร่บทเรียน</h3>
              <p class="modal-desc">
                คุณกำลังจะเผยแพร่บทความ: <strong>{{ lastSavedTitle }}</strong>
                <br />
                เมื่อเผยแพร่แล้ว บทความนี้จะเปิดให้อ่านในรายวิชานี้ (คุณยังสามารถแก้ไขเนื้อหาและกดบันทึกในภายหลังได้ตลอดเวลา)
              </p>
              <div class="modal-actions">
                <button
                  id="btn-cancel-publish"
                  type="button"
                  class="btn btn-secondary"
                  @click="cancelPublish"
                >
                  ยกเลิก
                </button>
                <button
                  id="btn-confirm-publish"
                  type="button"
                  class="btn btn-publish"
                  :disabled="isPublishing"
                  @click="confirmPublish"
                >
                  {{ isPublishing ? 'กำลังเผยแพร่...' : 'ยืนยันเผยแพร่' }}
                </button>
              </div>
            </div>
          </div>

          <!-- Preview Mode -->
          <div v-if="isPreview" id="draft-preview-container" class="preview-panel">
            <div v-if="currentArticleStatus === 'published' && hasUnsavedChanges" class="preview-banner preview-banner-warning">
              <strong>โหมดแสดงตัวอย่าง (Preview)</strong> - บทความนี้เผยแพร่แล้ว แต่หน้าจอมีการแก้ไขที่ยังไม่ได้บันทึก (ผู้อ่านที่ได้รับอนุญาตจะเห็นเฉพาะเนื้อหาที่บันทึกก่อนหน้านี้)
            </div>
            <div v-else-if="currentArticleStatus === 'published'" class="preview-banner preview-banner-published">
              <strong>โหมดแสดงตัวอย่าง (Preview)</strong> - บทความนี้เผยแพร่แล้ว (ผู้อ่านที่ได้รับอนุญาตจะเห็นเนื้อหาที่บันทึกล่าสุด)
            </div>
            <div v-else class="preview-banner">
              <strong>โหมดแสดงตัวอย่าง (Preview)</strong> - เอกสารนี้เป็นฉบับร่างส่วนตัว ยังไม่ได้เผยแพร่
            </div>
            <h2 id="draft-preview-title" class="preview-title">{{ title || '(ไม่มีชื่อเรื่อง)' }}</h2>
            <div id="draft-preview-body" class="preview-body">{{ body || '(ไม่มีเนื้อหา)' }}</div>
          </div>

          <!-- Edit Mode -->
          <div v-else class="editor-form">
            <div class="form-group">
              <div class="label-row">
                <label id="label-draft-title" for="draft-title" class="form-label">
                  ชื่อเรื่อง <span class="required">*</span>
                </label>
                <span id="counter-draft-title" class="char-counter">
                  {{ countCodePoints(title) }} / {{ MAX_TITLE_CODE_POINTS }}
                </span>
              </div>
              <input
                id="draft-title"
                v-model="title"
                type="text"
                class="form-input"
                :class="{ 'input-error': fieldErrors.title }"
                placeholder="ระบุชื่อเรื่องของบทเรียน"
                maxlength="300"
                aria-required="true"
              />
              <span v-if="fieldErrors.title" id="error-draft-title" class="field-error">
                {{ fieldErrors.title }}
              </span>
            </div>

            <div class="form-group">
              <div class="label-row">
                <label id="label-draft-body" for="draft-body" class="form-label">
                  เนื้อหาบทเรียน <span class="required">*</span>
                </label>
                <span id="counter-draft-body" class="char-counter">
                  {{ countCodePoints(body) }} / {{ MAX_BODY_CODE_POINTS.toLocaleString() }}
                </span>
              </div>
              <textarea
                id="draft-body"
                v-model="body"
                class="form-textarea"
                :class="{ 'input-error': fieldErrors.body }"
                rows="16"
                placeholder="พิมพ์เนื้อหาบทเรียนที่นี่ (รองรับการขึ้นบรรทัดใหม่และการเว้นวรรคย่อหน้า)"
                aria-required="true"
              ></textarea>
              <span v-if="fieldErrors.body" id="error-draft-body" class="field-error">
                {{ fieldErrors.body }}
              </span>
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<style scoped>
.teacher-drafts-page {
  min-height: 100vh;
  background-color: #f8fafc;
  color: #1e293b;
  display: flex;
  flex-direction: column;
}

.app-header {
  background-color: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  padding: 0.75rem 1.5rem;
}

.header-inner {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.brand-link {
  text-decoration: none;
  color: #0f172a;
}

.brand-name {
  font-size: 1.25rem;
  font-weight: 700;
}

.brand-badge {
  background-color: #e0e7ff;
  color: #4338ca;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.2rem 0.5rem;
  border-radius: 9999px;
}

.user-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-email {
  font-size: 0.875rem;
  color: #64748b;
}

.main-container {
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
  padding: 2rem 1.5rem;
  flex: 1;
}

.page-title-section {
  margin-bottom: 1.5rem;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 0.25rem 0;
}

.page-subtitle {
  font-size: 0.95rem;
  color: #64748b;
  margin: 0;
}

.alert {
  padding: 0.875rem 1rem;
  border-radius: 6px;
  margin-bottom: 1.25rem;
  font-size: 0.95rem;
}

.alert-error {
  background-color: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.alert-success {
  background-color: #f0fdf4;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem;
  color: #64748b;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid #e2e8f0;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.empty-card {
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 3rem;
  text-align: center;
  max-width: 600px;
  margin: 2rem auto;
}

.empty-card h2 {
  font-size: 1.25rem;
  color: #334155;
  margin-bottom: 0.5rem;
}

.empty-card p {
  color: #64748b;
  line-height: 1.5;
}

.workspace-grid {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 1.5rem;
}

.workspace-sidebar {
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.sidebar-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: #334155;
  margin: 0;
}

.drafts-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.draft-item {
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  transition: all 0.15s ease;
}

.draft-item.active {
  border-color: #3b82f6;
  background-color: #eff6ff;
}

.draft-item-button {
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  padding: 0.75rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.draft-item-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: #1e293b;
  word-break: break-word;
}

.draft-item-badge {
  font-size: 0.75rem;
  color: #64748b;
}

.empty-notice,
.list-loading {
  font-size: 0.875rem;
  color: #94a3b8;
  padding: 1rem 0;
  text-align: center;
}

.workspace-editor {
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 1rem;
}

.editor-actions {
  display: flex;
  gap: 0.75rem;
}

.badge {
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.25rem 0.6rem;
  border-radius: 9999px;
}

.badge-info {
  background-color: #e0f2fe;
  color: #0369a1;
}

.badge-neutral {
  background-color: #f1f5f9;
  color: #475569;
}

.badge-success {
  background-color: #dcfce7;
  color: #166534;
}

.badge-warning {
  background-color: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
}

.badge-published {
  color: #166534;
  background-color: #dcfce7;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  display: inline-block;
  font-weight: 600;
}

.badge-draft {
  color: #64748b;
  background-color: #f1f5f9;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  display: inline-block;
}

.badge-inline {
  display: inline-flex;
  align-items: center;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 1.25rem;
}

.label-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.form-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: #334155;
}

.required {
  color: #ef4444;
}

.char-counter {
  font-size: 0.75rem;
  color: #94a3b8;
}

.form-input,
.form-select {
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 0.65rem 0.875rem;
  font-size: 0.95rem;
  color: #1e293b;
  background-color: #ffffff;
  outline: none;
  transition: border-color 0.15s ease;
}

.form-textarea {
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 0.75rem 0.875rem;
  font-size: 0.95rem;
  color: #1e293b;
  background-color: #ffffff;
  outline: none;
  font-family: inherit;
  line-height: 1.6;
  resize: vertical;
  white-space: pre-wrap;
  transition: border-color 0.15s ease;
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.input-error {
  border-color: #ef4444 !important;
}

.field-error {
  font-size: 0.8rem;
  color: #ef4444;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  font-weight: 500;
  padding: 0.55rem 1.1rem;
  border-radius: 6px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #2563eb;
  color: #ffffff;
}

.btn-primary:hover:not(:disabled) {
  background-color: #1d4ed8;
}

.btn-publish {
  background-color: #10b981;
  color: #ffffff;
}

.btn-publish:hover:not(:disabled) {
  background-color: #059669;
}

.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(15, 23, 42, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 1rem;
}

.modal-box {
  background-color: #ffffff;
  border-radius: 8px;
  padding: 1.5rem;
  max-width: 480px;
  width: 100%;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.modal-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 0.75rem 0;
}

.modal-desc {
  font-size: 0.9rem;
  color: #475569;
  line-height: 1.6;
  margin: 0 0 1.5rem 0;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.preview-banner-published {
  background-color: #ecfdf5 !important;
  color: #065f46 !important;
  border-color: #a7f3d0 !important;
}

.preview-banner-warning {
  background-color: #fffbeb !important;
  color: #b45309 !important;
  border-color: #fcd34d !important;
}

.btn-secondary {
  background-color: #f1f5f9;
  color: #334155;
  border-color: #cbd5e1;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #e2e8f0;
}

.btn-outline {
  background-color: transparent;
  color: #2563eb;
  border-color: #bfdbfe;
}

.btn-outline:hover:not(:disabled) {
  background-color: #eff6ff;
}

.btn-sm {
  font-size: 0.8rem;
  padding: 0.35rem 0.7rem;
}

.preview-panel {
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 1.5rem;
  background-color: #ffffff;
}

.preview-banner {
  background-color: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  font-size: 0.85rem;
  margin-bottom: 1.5rem;
}

.preview-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 1rem 0;
  word-break: break-word;
}

.preview-body {
  font-size: 1rem;
  line-height: 1.7;
  color: #334155;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
