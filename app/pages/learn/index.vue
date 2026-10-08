<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useEnrolledReader } from '../../composables/useEnrolledReader'

definePageMeta({
  middleware: 'auth',
})

const {
  offerings,
  selectedOfferingId,
  articles,
  currentArticleId,
  currentArticle,
  isLoading,
  errorMessage,
  fetchPermittedOfferings,
  selectOffering,
  loadArticle,
  backToArticles,
  backToOfferings,
} = useEnrolledReader()

const currentOffering = computed(() => {
  return offerings.value.find((o) => o.id === selectedOfferingId.value) || null
})

onMounted(async () => {
  await fetchPermittedOfferings()
})
</script>

<template>
  <div class="reader-page-container">
    <header class="reader-header">
      <div class="reader-nav-top">
        <NuxtLink to="/" class="btn btn-outline btn-sm" id="reader-home-link">
          ← หน้าหลัก
        </NuxtLink>
        <span class="badge badge-reader">ห้องเรียนออนไลน์ (Learner Reader)</span>
      </div>
      <h1 class="reader-title">บทเรียนที่ลงทะเบียนเรียน</h1>
      <p class="reader-subtitle">
        อ่านบทความและเอกสารประกอบการเรียนที่เผยแพร่แล้วในรายวิชาของคุณ
      </p>
    </header>

    <!-- Global error message -->
    <div v-if="errorMessage" class="alert alert-danger" id="reader-error-alert">
      <strong>ข้อผิดพลาด:</strong> {{ errorMessage }}
    </div>

    <!-- Global loading indicator -->
    <div v-if="isLoading" class="card loading-card" id="reader-loading-card">
      <div class="spinner"></div>
      <p>กำลังโหลดข้อมูล...</p>
    </div>

    <!-- LEVEL 1: Offering Selection View -->
    <div v-if="!selectedOfferingId" class="reader-view-section" id="offering-selection-view">
      <div class="section-heading">
        <h2>รายวิชาที่คุณมีสิทธิ์เข้าถึง</h2>
        <p class="text-muted">เลือกรายวิชาที่ต้องการอ่านบทเรียน</p>
      </div>

      <!-- Empty state: No enrolled offerings -->
      <div v-if="!isLoading && offerings.length === 0" class="card empty-card" id="no-offerings-card">
        <div class="empty-icon">📚</div>
        <h3>ยังไม่มีรายวิชาที่คุณมีสิทธิ์เข้าถึง</h3>
        <p>
          หากคุณเพิ่งสมัครเข้าร่วมชั้นเรียน กรุณารอครูผู้สอนตรวจสอบและอนุมัติคำขอลงทะเบียน
        </p>
        <div class="empty-actions">
          <NuxtLink to="/apply" class="btn btn-primary" id="check-application-status-btn">
            ตรวจสอบสถานะคำขอลงทะเบียน
          </NuxtLink>
        </div>
      </div>

      <!-- Offerings list -->
      <div v-else-if="offerings.length > 0" class="offerings-grid" id="offerings-list">
        <div
          v-for="offering in offerings"
          :key="offering.id"
          class="offering-card"
          :id="`offering-card-${offering.id}`"
          @click="selectOffering(offering.id)"
        >
          <div class="offering-badge">
            {{ offering.subject_code }}
          </div>
          <h3 class="offering-name">{{ offering.subject_name }}</h3>
          <div class="offering-meta">
            <span class="meta-class">ห้อง {{ offering.class_name }}</span>
            <span class="meta-dot">•</span>
            <span class="meta-term">ภาคเรียนที่ {{ offering.term }}/{{ offering.academic_year }}</span>
          </div>
          <button
            class="btn btn-outline btn-block select-offering-btn"
            type="button"
            :id="`select-offering-btn-${offering.id}`"
            @click.stop="selectOffering(offering.id)"
          >
            เข้าสู่รายวิชา →
          </button>
        </div>
      </div>
    </div>

    <!-- LEVEL 2: Articles List View for Selected Offering -->
    <div
      v-else-if="selectedOfferingId && !currentArticleId"
      class="reader-view-section"
      id="articles-list-view"
    >
      <div class="navigation-bar">
        <button class="btn btn-secondary btn-sm" id="back-to-offerings-btn" @click="backToOfferings">
          ← เลือกรายวิชาอื่น
        </button>
      </div>

      <div v-if="currentOffering" class="offering-banner" id="current-offering-banner">
        <span class="offering-banner-code">{{ currentOffering.subject_code }}</span>
        <h2 class="offering-banner-title">{{ currentOffering.subject_name }}</h2>
        <p class="offering-banner-sub">
          ห้อง {{ currentOffering.class_name }} | ภาคเรียนที่ {{ currentOffering.term }}/{{ currentOffering.academic_year }}
        </p>
      </div>

      <!-- Empty state: No published articles -->
      <div v-if="!isLoading && articles.length === 0" class="card empty-card" id="no-articles-card">
        <div class="empty-icon">📝</div>
        <h3>ยังไม่มีบทเรียนที่เผยแพร่ในรายวิชานี้</h3>
        <p>ครูผู้สอนยังไม่ได้เผยแพร่บทเรียนสำหรับรายวิชานี้ กรุณาตรวจสอบอีกครั้งในภายหลัง</p>
      </div>

      <!-- Articles list -->
      <div v-else-if="articles.length > 0" class="articles-list-container" id="published-articles-list">
        <div
          v-for="article in articles"
          :key="article.id"
          class="article-item-card"
          :id="`article-item-${article.id}`"
          @click="loadArticle(article.id)"
        >
          <div class="article-item-header">
            <h3 class="article-item-title">{{ article.title }}</h3>
            <span class="article-version-badge">v{{ article.version }}</span>
          </div>
          <div class="article-item-footer">
            <span v-if="article.published_at" class="article-published-date">
              เผยแพร่เมื่อ: {{ new Date(article.published_at).toLocaleDateString('th-TH') }}
            </span>
            <button
              class="btn btn-sm btn-outline read-article-btn"
              type="button"
              :id="`read-article-btn-${article.id}`"
              @click.stop="loadArticle(article.id)"
            >
              อ่านบทเรียน →
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- LEVEL 3: Article Reading View -->
    <div
      v-else-if="selectedOfferingId && currentArticleId"
      class="reader-view-section"
      id="article-reading-view"
    >
      <div class="navigation-bar">
        <button class="btn btn-secondary btn-sm" id="back-to-articles-btn" @click="backToArticles">
          ← กลับไปยังรายการบทเรียน
        </button>
      </div>

      <article v-if="currentArticle" class="article-view-card" id="article-detail-card">
        <header class="article-view-header">
          <div class="article-view-tags">
            <span class="badge badge-published">เผยแพร่แล้ว</span>
            <span class="badge badge-version">เวอร์ชัน {{ currentArticle.version }}</span>
          </div>
          <!-- Title rendered strictly as literal plain text -->
          <h1 class="article-view-title" id="article-view-title">
            {{ currentArticle.title }}
          </h1>
          <div v-if="currentArticle.published_at" class="article-view-meta">
            เผยแพร่เมื่อ: {{ new Date(currentArticle.published_at).toLocaleDateString('th-TH') }}
          </div>
        </header>

        <div class="article-divider"></div>

        <!-- Body rendered strictly as literal plain text (NO v-html) -->
        <div class="article-body-content" id="article-body-text">
          {{ currentArticle.body }}
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.reader-page-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 1.5rem 1rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  color: #1f2937;
}

.reader-header {
  margin-bottom: 2rem;
}

.reader-nav-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.badge-reader {
  background-color: #e0f2fe;
  color: #0369a1;
}

.badge-published {
  background-color: #dcfce7;
  color: #15803d;
}

.badge-version {
  background-color: #f3f4f6;
  color: #4b5563;
}

.reader-title {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0 0 0.5rem 0;
  color: #111827;
}

.reader-subtitle {
  font-size: 0.95rem;
  color: #6b7280;
  margin: 0;
}

.alert {
  padding: 0.875rem 1rem;
  border-radius: 0.5rem;
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
}

.alert-danger {
  background-color: #fee2e2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.loading-card {
  text-align: center;
  padding: 2rem;
  color: #6b7280;
}

.spinner {
  display: inline-block;
  width: 2rem;
  height: 2rem;
  border: 3px solid #e5e7eb;
  border-radius: 50%;
  border-top-color: #2563eb;
  animation: spin 1s linear infinite;
  margin-bottom: 0.75rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.empty-card {
  text-align: center;
  padding: 3rem 1.5rem;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.empty-card h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
}

.empty-card p {
  color: #6b7280;
  margin: 0 0 1.5rem 0;
  font-size: 0.95rem;
}

.section-heading {
  margin-bottom: 1.25rem;
}

.section-heading h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 0.25rem 0;
}

.text-muted {
  color: #6b7280;
  font-size: 0.875rem;
}

.offerings-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 640px) {
  .offerings-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.offering-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  padding: 1.25rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
}

.offering-card:hover {
  border-color: #93c5fd;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.offering-badge {
  display: inline-block;
  align-self: flex-start;
  padding: 0.2rem 0.5rem;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 0.8rem;
  font-weight: 600;
  border-radius: 0.375rem;
  margin-bottom: 0.5rem;
}

.offering-name {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  color: #111827;
}

.offering-meta {
  font-size: 0.85rem;
  color: #6b7280;
  margin-bottom: 1rem;
}

.meta-dot {
  margin: 0 0.35rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.625rem 1.25rem;
  font-size: 0.95rem;
  font-weight: 500;
  border-radius: 0.5rem;
  border: 1px solid transparent;
  cursor: pointer;
  text-decoration: none;
  min-height: 44px; /* Phone touch target */
  transition: background-color 0.15s ease;
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.85rem;
  min-height: 38px;
}

.btn-primary {
  background-color: #2563eb;
  color: #ffffff;
}

.btn-primary:hover {
  background-color: #1d4ed8;
}

.btn-secondary {
  background-color: #f3f4f6;
  color: #374151;
  border-color: #d1d5db;
}

.btn-secondary:hover {
  background-color: #e5e7eb;
}

.btn-outline {
  background-color: transparent;
  color: #374151;
  border-color: #d1d5db;
}

.btn-outline:hover {
  background-color: #f9fafb;
}

.btn-block {
  width: 100%;
}

.navigation-bar {
  margin-bottom: 1rem;
}

.offering-banner {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 1rem 1.25rem;
  margin-bottom: 1.5rem;
}

.offering-banner-code {
  font-size: 0.8rem;
  font-weight: 600;
  color: #0284c7;
}

.offering-banner-title {
  font-size: 1.3rem;
  font-weight: 700;
  margin: 0.25rem 0 0.25rem 0;
  color: #0f172a;
}

.offering-banner-sub {
  font-size: 0.85rem;
  color: #64748b;
  margin: 0;
}

.articles-list-container {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.article-item-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1rem 1.25rem;
  cursor: pointer;
  transition: all 0.15s ease;
  min-height: 44px;
}

.article-item-card:hover {
  border-color: #93c5fd;
  background-color: #f8fafc;
}

.article-item-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.article-item-title {
  font-size: 1.05rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.article-version-badge {
  font-size: 0.75rem;
  font-weight: 600;
  background: #f3f4f6;
  color: #4b5563;
  padding: 0.15rem 0.4rem;
  border-radius: 0.25rem;
  white-space: nowrap;
}

.article-item-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
  color: #6b7280;
}

.read-link {
  color: #2563eb;
  font-weight: 500;
}

.article-view-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.article-view-header {
  margin-bottom: 1.25rem;
}

.article-view-tags {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.article-view-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
  margin: 0 0 0.5rem 0;
  line-height: 1.3;
}

.article-view-meta {
  font-size: 0.85rem;
  color: #6b7280;
}

.article-divider {
  height: 1px;
  background-color: #e5e7eb;
  margin-bottom: 1.5rem;
}

.article-body-content {
  font-size: 1.05rem;
  line-height: 1.8;
  color: #374151;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
