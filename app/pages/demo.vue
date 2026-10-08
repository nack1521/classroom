<script setup lang="ts">
import { onMounted } from 'vue'
import { useOwnerTrialDemo } from '../composables/useOwnerTrialDemo'

// Defense-in-depth: if ever accessed in production build, fail closed with 404
if (import.meta.env.PROD) {
  throw createError({ statusCode: 404, statusMessage: 'Not Found', fatal: true })
}

const {
  state,
  offerings,
  teacherArticles,
  currentTeacherArticle,
  studentCurrentOffering,
  studentEnrolledOffering,
  studentVisibleArticles,
  studentReadingArticle,
  studentAccessCheck,
  titleCodePointCount,
  bodyCodePointCount,
  MAX_TITLE_CODE_POINTS,
  MAX_BODY_CODE_POINTS,
  loadFromStorage,
  resetState,
  setPersona,
  selectTeacherOffering,
  loadArticleForEditing,
  startNewDraft,
  saveDraft,
  publishArticle,
  unpublishArticle,
  simulateReload,
  setStudentApprovalStatus,
  selectStudentOffering,
  viewStudentArticle,
  closeStudentArticle,
} = useOwnerTrialDemo()

onMounted(() => {
  loadFromStorage()
})
</script>

<template>
  <div class="demo-page">
    <!-- Top Warning & Rehearsal Banner -->
    <header class="demo-header">
      <div class="demo-badge">LOCAL SYNTHETIC DEMO ONLY (012A)</div>
      <h1 class="demo-title">ห้องทดลอง UX จำลอง — วงจรบทความและการอ่าน (Owner Trial)</h1>
      <p class="demo-subtitle">
        หน้านี้เป็นการจำลองประสบการณ์ใช้งาน (Synthetic In-Browser Rehearsal) เพื่อรับฟังความคิดเห็นจากเจ้าของระบบ (Nack)
        <strong>ไม่มีการเชื่อมต่อฐานข้อมูล ไม่มีการใช้ Docker ไม่ใช้บัญชีจริง และไม่ได้ผ่านการตรวจสอบสิทธิ์จริง</strong>
      </p>

      <div class="banner-box">
        <strong>คำชี้แจงความปลอดภัยและขอบเขต:</strong>
        <ul>
          <li>ข้อมูลทั้งหมดจำลองขึ้นในเบราว์เซอร์เท่านั้น (Fictional In-Browser State)</li>
          <li>ปุ่มสลับบทบาทด้านล่างเป็นเพียงการเปลี่ยนหน้าจอจำลอง (Mock Tabs) — ไม่ใช่การข้ามระบบล็อกอิน (Login Bypass)</li>
          <li>การอนุมัติใบสมัครในหน้านี้เปลี่ยนเฉพาะข้อมูลในเดโม — ไม่ใช่การอนุมัติในระบบจริง</li>
        </ul>
      </div>

      <!-- Quick Reset & Action Row -->
      <div class="header-action-bar">
        <button class="btn btn-reset" @click="resetState">
          🗑️ รีเซ็ตข้อมูลจำลองทั้งหมด (Reset Demo)
        </button>
        <button class="btn btn-reload" @click="simulateReload">
          🔄 จำลองโหลดหน้าใหม่ (Simulate Page Reload)
        </button>
      </div>

      <!-- Notification Alerts -->
      <div v-if="state.noticeMessage" class="alert alert-success" role="status">
        {{ state.noticeMessage }}
      </div>
      <div v-if="state.errorMessage" class="alert alert-danger" role="alert">
        {{ state.errorMessage }}
      </div>
    </header>

    <!-- Persona Switcher -->
    <nav class="persona-nav" aria-label="Simulated Persona Selector">
      <div class="nav-title">เลือกบทบาทจำลอง (Simulated Persona):</div>
      <div class="nav-tabs">
        <button
          type="button"
          class="tab-btn"
          :class="{ active: state.activePersona === 'teacher' }"
          @click="setPersona('teacher')"
        >
          👨‍🏫 อาจารย์ / ผู้ดูแล (Admin + Teacher Persona)
        </button>
        <button
          type="button"
          class="tab-btn"
          :class="{ active: state.activePersona === 'student' }"
          @click="setPersona('student')"
        >
          🧑‍🎓 นักเรียนจำลอง (Simulated Student Persona)
        </button>
      </div>
    </nav>

    <!-- ===================================================================== -->
    <!-- PERSONA 1: TEACHER / ADMIN                                            -->
    <!-- ===================================================================== -->
    <main v-if="state.activePersona === 'teacher'" class="persona-panel teacher-panel">
      <div class="section-badge">มุมมองอาจารย์ผู้สอน (Teacher Workspace)</div>

      <!-- Offering Selection -->
      <div class="card offering-selector-card">
        <label for="teacher-offering-select" class="form-label">
          <strong>1. เลือกวิชาที่สอน (Select Assigned Offering):</strong>
        </label>
        <select
          id="teacher-offering-select"
          class="form-select"
          :value="state.teacherSelectedOfferingId"
          @change="selectTeacherOffering(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="offering in offerings" :key="offering.id" :value="offering.id">
            {{ offering.nameTh }} — ผู้สอน: {{ offering.teacherNameTh }}
          </option>
        </select>
      </div>

      <!-- Article Manager & Editor Grid -->
      <div class="editor-grid">
        <!-- Left: Article List -->
        <aside class="card article-list-card">
          <div class="list-header">
            <h3>รายการบทความในวิชานี้</h3>
            <button class="btn btn-sm btn-primary" @click="startNewDraft">
              + เขียนบทความใหม่
            </button>
          </div>

          <div v-if="teacherArticles.length === 0" class="empty-text">
            ยังไม่มีบทความในวิชานี้ กรุณากด "+ เขียนบทความใหม่"
          </div>

          <ul v-else class="article-list" role="list">
            <li
              v-for="art in teacherArticles"
              :key="art.id"
              class="article-item-wrapper"
            >
              <button
                type="button"
                class="article-item-btn"
                :class="{ selected: art.id === state.currentArticleId }"
                :aria-pressed="art.id === state.currentArticleId"
                @click="loadArticleForEditing(art.id)"
              >
                <div class="item-title">{{ art.title }}</div>
                <div class="item-meta">
                  <span :class="['badge', art.status === 'published' ? 'badge-success' : 'badge-warning']">
                    {{ art.status === 'published' ? 'เผยแพร่แล้ว (Published)' : 'ฉบับร่าง (Draft)' }}
                  </span>
                  <span class="meta-date">อัปเดต: {{ new Date(art.updatedAt).toLocaleTimeString('th-TH') }}</span>
                </div>
              </button>
            </li>
          </ul>
        </aside>

        <!-- Right: Editor Form & Live Preview -->
        <section class="card editor-card">
          <div class="editor-header">
            <h3>
              {{ state.currentArticleId ? 'แก้ไขบทความ' : 'เขียนบทความใหม่' }}
              <span v-if="currentTeacherArticle" :class="['badge', currentTeacherArticle.status === 'published' ? 'badge-success' : 'badge-warning']">
                {{ currentTeacherArticle.status === 'published' ? 'สถานะ: เผยแพร่แล้ว' : 'สถานะ: ฉบับร่าง' }}
              </span>
            </h3>
          </div>

          <!-- Title Input -->
          <div class="form-group">
            <div class="label-with-counter">
              <label for="draft-title-input">หัวข้อบทความ (Title):</label>
              <span
                class="char-counter"
                :class="{ 'counter-exceeded': titleCodePointCount > MAX_TITLE_CODE_POINTS }"
              >
                {{ titleCodePointCount }} / {{ MAX_TITLE_CODE_POINTS }}
              </span>
            </div>
            <input
              id="draft-title-input"
              v-model="state.draftTitle"
              type="text"
              class="form-input"
              placeholder="ระบุหัวข้อบทความ (ห้ามว่าง, สูงสุด 200 ตัวอักษร)..."
            />
          </div>

          <!-- Body Textarea -->
          <div class="form-group">
            <div class="label-with-counter">
              <label for="draft-body-input">เนื้อหาบทความ (Body Plain Text):</label>
              <span
                class="char-counter"
                :class="{ 'counter-exceeded': bodyCodePointCount > MAX_BODY_CODE_POINTS }"
              >
                {{ bodyCodePointCount }} / {{ MAX_BODY_CODE_POINTS }}
              </span>
            </div>
            <textarea
              id="draft-body-input"
              v-model="state.draftBody"
              rows="9"
              class="form-textarea"
              placeholder="พิมพ์เนื้อหาบทความแบบข้อความล้วน (Plain Text) — รองรับการเว้นวรรคและการขึ้นบรรทัดใหม่..."
            ></textarea>
          </div>

          <!-- Action Buttons -->
          <div class="editor-actions">
            <button class="btn btn-primary" @click="saveDraft">
              💾 บันทึกร่าง (Save Draft)
            </button>

            <button
              v-if="currentTeacherArticle && currentTeacherArticle.status === 'draft'"
              class="btn btn-publish"
              @click="publishArticle(currentTeacherArticle.id)"
            >
              🚀 เผยแพร่บทความ (Publish Article)
            </button>

            <button
              v-if="currentTeacherArticle && currentTeacherArticle.status === 'published'"
              class="btn btn-unpublish"
              @click="unpublishArticle(currentTeacherArticle.id)"
            >
              ↩️ ยกเลิกเผยแพร่ (Unpublish to Draft)
            </button>
          </div>

          <!-- Teacher Phone-Readable Article View -->
          <div v-if="currentTeacherArticle" class="teacher-reading-preview">
            <h4>มุมมองอ่านของครู (Phone-Readable Preview):</h4>
            <div class="phone-viewport">
              <article class="article-paper">
                <header class="paper-header">
                  <h2 class="paper-title">{{ currentTeacherArticle.title }}</h2>
                  <div class="paper-meta">
                    <span>ผู้เขียน: อ. สมชาย (อาจารย์จำลอง)</span>
                    <span v-if="currentTeacherArticle.publishedAt">
                      เผยแพร่เมื่อ: {{ new Date(currentTeacherArticle.publishedAt).toLocaleDateString('th-TH') }}
                    </span>
                  </div>
                </header>
                <!-- Literal text rendering without HTML interpretation -->
                <div class="paper-body">{{ currentTeacherArticle.body }}</div>
              </article>
            </div>
          </div>
        </section>
      </div>
    </main>

    <!-- ===================================================================== -->
    <!-- PERSONA 2: STUDENT                                                    -->
    <!-- ===================================================================== -->
    <main v-else class="persona-panel student-panel">
      <div class="section-badge student-badge">มุมมองนักเรียน (Student Persona)</div>

      <!-- Student Simulated Profile & Application Control -->
      <section class="card student-status-card">
        <h3>สถานะนักเรียนจำลอง (Student Simulation Controls)</h3>
        <p class="card-desc">
          กล่องนี้ใช้จำลองสิทธิ์ของนักเรียนเพื่อทดสอบว่าระบบจะอนุญาตหรือปฏิเสธการเข้าถึงบทความตามสถานะการสมัคร
        </p>

        <div class="status-grid">
          <div class="status-field">
            <span class="field-label">ชื่อนักเรียน:</span>
            <strong>{{ state.student.nameTh }}</strong>
          </div>
          <div class="status-field">
            <span class="field-label">วิชาที่ลงทะเบียน:</span>
            <strong>{{ studentEnrolledOffering?.nameTh }}</strong>
          </div>
          <div class="status-field">
            <span class="field-label">สถานะการอนุมัติใบสมัคร (Approval Status):</span>
            <span :class="['badge', state.student.applicationStatus === 'approved' ? 'badge-success' : 'badge-warning']">
              {{ state.student.applicationStatus === 'approved' ? 'อนุมัติแล้ว (Approved)' : 'รออนุมัติ (Pending)' }}
            </span>
          </div>
        </div>

        <div class="approval-toggle-box">
          <span>จำลองสลับสถานะใบสมัคร:</span>
          <button
            class="btn btn-sm"
            :class="state.student.applicationStatus === 'pending' ? 'btn-warning-active' : 'btn-outline'"
            @click="setStudentApprovalStatus('pending')"
          >
            ⏳ รออนุมัติ (Pending)
          </button>
          <button
            class="btn btn-sm"
            :class="state.student.applicationStatus === 'approved' ? 'btn-success-active' : 'btn-outline'"
            @click="setStudentApprovalStatus('approved')"
          >
            ✅ อนุมัติแล้ว (Approved)
          </button>
        </div>
      </section>

      <!-- Course & Article Reading Area -->
      <section class="card student-course-card">
        <div class="course-header">
          <label for="student-offering-select"><strong>เลือกดูวิชาเรียน (Select Course to View):</strong></label>
          <select
            id="student-offering-select"
            class="form-select"
            :value="state.studentSelectedOfferingId"
            @change="selectStudentOffering(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="offering in offerings" :key="offering.id" :value="offering.id">
              {{ offering.nameTh }} {{ offering.id === state.student.enrolledOfferingId ? '(วิชาที่ลงทะเบียน)' : '(วิชาอื่น)' }}
            </option>
          </select>
        </div>

        <!-- Case 1: Student Pending Denial -->
        <div v-if="state.student.applicationStatus !== 'approved'" class="alert alert-warning denial-box">
          <h4>🚫 ไม่สามารถเข้าถึงเนื้อหาได้ (Application Pending)</h4>
          <p>
            ใบสมัครของคุณสำหรับวิชา <strong>{{ studentEnrolledOffering?.nameTh }}</strong> อยู่ระหว่างรอให้อาจารย์ตรวจสอบและอนุมัติ
            <br />
            คุณจะไม่สามารถเห็นหรืออ่านบทความใดๆ จนกว่าจะได้รับสถานะ "อนุมัติแล้ว (Approved)"
          </p>
        </div>

        <!-- Case 2: Wrong Offering Denial -->
        <div
          v-else-if="state.studentSelectedOfferingId !== state.student.enrolledOfferingId"
          class="alert alert-danger denial-box"
        >
          <h4>🚫 ปฏิเสธการเข้าถึง: วิชาไม่ถูกต้อง (Access Denied: Wrong Offering)</h4>
          <p>
            คุณลงทะเบียนเฉพาะวิชา <strong>{{ studentEnrolledOffering?.nameTh }}</strong>
            <br />
            ไม่สามารถเข้าถึงหรืออ่านบทความในวิชา <strong>{{ studentCurrentOffering?.nameTh }}</strong> ได้
          </p>
        </div>

        <!-- Case 3: Approved & Enrolled: Show Course Articles -->
        <div v-else class="enrolled-article-area">
          <div class="area-intro">
            <h4>คลังบทความวิชา {{ studentCurrentOffering?.nameTh }}</h4>
            <p class="text-muted">
              แสดงเฉพาะบทความที่อาจารย์ได้กด <strong>"เผยแพร่แล้ว (Published)"</strong> เท่านั้น (บทความฉบับร่างจะไม่แสดงที่นี่)
            </p>
          </div>

          <div v-if="studentVisibleArticles.length === 0" class="empty-text">
            ขณะนี้ยังไม่มีบทความที่เผยแพร่ในวิชานี้ (หากอาจารย์เพิ่งเขียนร่าง กรุณาสลับไปบทบาทอาจารย์เพื่อกด "เผยแพร่")
          </div>

          <div v-else class="student-article-grid">
            <article
              v-for="art in studentVisibleArticles"
              :key="art.id"
              class="student-article-card"
            >
              <div class="card-badge">บทความเผยแพร่</div>
              <h4 class="card-title">{{ art.title }}</h4>
              <p class="card-snippet">{{ art.body.slice(0, 120) }}{{ art.body.length > 120 ? '...' : '' }}</p>
              <button
                type="button"
                class="btn btn-sm btn-primary open-article-btn"
                :aria-label="`เปิดอ่านบทความ ${art.title}`"
                @click="viewStudentArticle(art.id)"
              >
                📖 เปิดอ่านบทความ
              </button>
            </article>
          </div>
        </div>

        <!-- Modal / Full Reading View for Student -->
        <div
          v-if="studentReadingArticle"
          class="student-reader-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="student-reader-modal-title"
          tabindex="-1"
          @keydown.esc="closeStudentArticle"
        >
          <div class="reader-container">
            <div class="reader-top-bar">
              <button
                type="button"
                class="btn btn-sm btn-secondary close-reader-btn"
                aria-label="ปิดหน้าอ่านบทความ"
                @click="closeStudentArticle"
              >
                ← ปิดหน้าอ่านบทความ
              </button>
              <span class="reader-indicator">อ่านบทความนักเรียน (Phone-Readable View)</span>
            </div>

            <!-- Access verification display -->
            <div v-if="studentAccessCheck.status !== 'allowed'" class="alert alert-danger">
              {{ studentAccessCheck.reasonTh }}
            </div>

            <!-- Full Article Reader View -->
            <article v-else class="student-article-view">
              <header class="reader-header">
                <span class="badge badge-success">เผยแพร่แล้ว</span>
                <h2 id="student-reader-modal-title" class="reader-title">{{ studentReadingArticle.title }}</h2>
                <div class="reader-meta">
                  <span>วิชา: {{ studentCurrentOffering?.nameTh }}</span>
                  <span v-if="studentReadingArticle.publishedAt">
                    วันที่เผยแพร่: {{ new Date(studentReadingArticle.publishedAt).toLocaleDateString('th-TH') }}
                  </span>
                </div>
              </header>

              <!-- Literal text rendering without HTML interpretation -->
              <div class="reader-content">{{ studentReadingArticle.body }}</div>
            </article>
          </div>
        </div>
      </section>
    </main>

    <!-- Links to Existing Separately Gated Surfaces -->
    <footer class="demo-footer">
      <div class="footer-title">🔗 ลิงก์ไปยังหน้าระบบจริง (Existing Surfaces — มี Route Guard & Auth แยกต่างหาก):</div>
      <p class="footer-desc">
        หน้าระบบด้านล่างเป็นหน้างานจริงของระบบ ไม่ได้ใช้ข้อมูลจำลองของเดโมนี้ และต้องใช้การล็อกอินจริง:
      </p>
      <div class="footer-links">
        <NuxtLink to="/" class="footer-link">หน้าแรก (Home / OAuth Spike)</NuxtLink>
        <NuxtLink to="/apply" class="footer-link">ส่งใบสมัครเรียน (/apply)</NuxtLink>
        <NuxtLink to="/review" class="footer-link">ตรวจสอบใบสมัคร (/review)</NuxtLink>
        <NuxtLink to="/teacher/drafts" class="footer-link">หน้าร่างบทความครู (/teacher/drafts)</NuxtLink>
        <NuxtLink to="/admin" class="footer-link">แดชบอร์ดผู้ดูแล (/admin)</NuxtLink>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.demo-page {
  max-width: 1080px;
  margin: 0 auto;
  padding: 1.5rem 1rem 3rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Thai', sans-serif;
  color: #1f2937;
  line-height: 1.5;
}

.demo-header {
  margin-bottom: 1.5rem;
}

.demo-badge {
  display: inline-block;
  padding: 0.25rem 0.6rem;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  background-color: #fee2e2;
  color: #991b1b;
  border-radius: 4px;
  margin-bottom: 0.5rem;
}

.demo-title {
  font-size: 1.6rem;
  font-weight: 800;
  margin: 0 0 0.5rem;
  color: #111827;
}

.demo-subtitle {
  font-size: 0.95rem;
  color: #4b5563;
  margin: 0 0 1rem;
}

.banner-box {
  background-color: #fffbeb;
  border-left: 4px solid #f59e0b;
  padding: 0.75rem 1rem;
  border-radius: 4px;
  font-size: 0.85rem;
  color: #92400e;
  margin-bottom: 1rem;
}

.banner-box ul {
  margin: 0.4rem 0 0 1.2rem;
  padding: 0;
}

.header-action-bar {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.persona-nav {
  background: #f3f4f6;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.nav-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: #4b5563;
  margin-bottom: 0.5rem;
}

.nav-tabs {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.tab-btn {
  padding: 0.6rem 1.2rem;
  border: 1px solid #d1d5db;
  background: #ffffff;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
}

.tab-btn:hover {
  background: #f9fafb;
}

.tab-btn.active {
  background: #2563eb;
  color: #ffffff;
  border-color: #2563eb;
  box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
}

.card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1.25rem;
  margin-bottom: 1.25rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.section-badge {
  display: inline-block;
  padding: 0.2rem 0.5rem;
  font-size: 0.8rem;
  font-weight: 700;
  background: #e0e7ff;
  color: #3730a3;
  border-radius: 4px;
  margin-bottom: 0.75rem;
}

.student-badge {
  background: #ecfdf5;
  color: #065f46;
}

.editor-grid {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 1.25rem;
}

@media (max-width: 768px) {
  .editor-grid {
    grid-template-columns: 1fr;
  }
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.list-header h3 {
  margin: 0;
  font-size: 1rem;
}

.article-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.article-item-wrapper {
  margin-bottom: 0.5rem;
}

.article-item-btn {
  display: block;
  width: 100%;
  text-align: left;
  background: #ffffff;
  padding: 0.6rem 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  font-family: inherit;
  color: inherit;
}

.article-item-btn:hover {
  background: #f9fafb;
}

.article-item-btn.selected {
  border-color: #2563eb;
  background: #eff6ff;
}

.article-item-btn:focus-visible,
.open-article-btn:focus-visible,
.close-reader-btn:focus-visible,
.btn:focus-visible,
.tab-btn:focus-visible,
.form-select:focus-visible,
.form-input:focus-visible,
.form-textarea:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}

.item-title {
  font-weight: 600;
  font-size: 0.9rem;
  margin-bottom: 0.25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  align-items: center;
}

.badge {
  display: inline-block;
  padding: 0.15rem 0.4rem;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 4px;
}

.badge-success {
  background: #dcfce7;
  color: #166534;
}

.badge-warning {
  background: #fef3c7;
  color: #92400e;
}

.form-group {
  margin-bottom: 1rem;
}

.label-with-counter {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.25rem;
  font-size: 0.85rem;
  font-weight: 600;
}

.char-counter {
  font-size: 0.75rem;
  color: #6b7280;
}

.counter-exceeded {
  color: #dc2626;
  font-weight: 700;
}

.form-input,
.form-textarea,
.form-select {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.95rem;
  box-sizing: border-box;
}

.form-input:focus,
.form-textarea:focus,
.form-select:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
}

.editor-actions {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.btn {
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  font-weight: 600;
  border-radius: 6px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-primary {
  background: #2563eb;
  color: white;
}

.btn-primary:hover {
  background: #1d4ed8;
}

.btn-publish {
  background: #10b981;
  color: white;
}

.btn-publish:hover {
  background: #059669;
}

.btn-unpublish {
  background: #f59e0b;
  color: white;
}

.btn-unpublish:hover {
  background: #d97706;
}

.btn-reset {
  background: #fee2e2;
  color: #991b1b;
  border-color: #fca5a5;
}

.btn-reset:hover {
  background: #fecaca;
}

.btn-reload {
  background: #e5e7eb;
  color: #374151;
}

.btn-reload:hover {
  background: #d1d5db;
}

.btn-sm {
  padding: 0.3rem 0.6rem;
  font-size: 0.8rem;
}

.btn-outline {
  background: white;
  border-color: #d1d5db;
  color: #374151;
}

.btn-warning-active {
  background: #fef3c7;
  color: #92400e;
  border-color: #f59e0b;
  font-weight: 700;
}

.btn-success-active {
  background: #dcfce7;
  color: #166534;
  border-color: #10b981;
  font-weight: 700;
}

.phone-viewport {
  max-width: 480px;
  background: #fafafa;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  padding: 1rem;
  margin-top: 0.5rem;
}

.article-paper {
  background: #ffffff;
  padding: 1.25rem;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.paper-title {
  font-size: 1.2rem;
  font-weight: 700;
  margin: 0 0 0.4rem;
}

.paper-meta {
  font-size: 0.75rem;
  color: #6b7280;
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  border-bottom: 1px solid #f3f4f6;
  padding-bottom: 0.5rem;
}

.paper-body,
.reader-content {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.95rem;
  line-height: 1.7;
  color: #1f2937;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.75rem;
  background: #f9fafb;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  margin-bottom: 0.75rem;
}

.status-field {
  display: flex;
  flex-direction: column;
  font-size: 0.85rem;
}

.field-label {
  color: #6b7280;
  font-size: 0.75rem;
}

.approval-toggle-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  font-weight: 600;
}

.denial-box {
  padding: 1rem 1.25rem;
  border-radius: 8px;
  margin-top: 1rem;
}

.student-article-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.student-article-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem;
  transition: all 0.15s;
  background: #ffffff;
}

.student-article-card:hover {
  border-color: #2563eb;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.card-badge {
  font-size: 0.7rem;
  font-weight: 700;
  color: #059669;
  text-transform: uppercase;
  margin-bottom: 0.25rem;
}

.card-title {
  font-size: 1rem;
  font-weight: 700;
  margin: 0 0 0.5rem;
}

.card-snippet {
  font-size: 0.85rem;
  color: #4b5563;
  margin: 0 0 1rem;
}

.student-reader-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem;
  z-index: 1000;
}

.reader-container {
  background: #ffffff;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
}

.reader-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 0.75rem;
}

.reader-indicator {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 600;
}

.reader-title {
  font-size: 1.4rem;
  font-weight: 800;
  margin: 0.5rem 0;
}

.reader-meta {
  font-size: 0.8rem;
  color: #6b7280;
  display: flex;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.demo-footer {
  margin-top: 3rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e5e7eb;
}

.footer-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #374151;
  margin-bottom: 0.25rem;
}

.footer-desc {
  font-size: 0.8rem;
  color: #6b7280;
  margin: 0 0 0.75rem;
}

.footer-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.footer-link {
  font-size: 0.85rem;
  color: #2563eb;
  text-decoration: none;
  padding: 0.3rem 0.6rem;
  background: #eff6ff;
  border-radius: 4px;
}

.footer-link:hover {
  text-decoration: underline;
  background: #dbeafe;
}

.alert {
  padding: 0.75rem 1rem;
  border-radius: 6px;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.alert-success {
  background: #ecfdf5;
  color: #065f46;
  border: 1px solid #a7f3d0;
}

.alert-danger {
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.alert-warning {
  background: #fffbeb;
  color: #92400e;
  border: 1px solid #fde68a;
}
</style>
