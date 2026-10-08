import { computed, watch, effectScope, getCurrentScope, onScopeDispose, type EffectScope, type Ref } from 'vue'
import type { SafeUserDisplay } from '../utils/auth'
import { validateTeacherDraftInput, countCodePoints, MAX_TITLE_CODE_POINTS, MAX_BODY_CODE_POINTS } from '../utils/teacherDraft'

// Tracks active watcher per owner EffectScope (e.g. component setup scope or explicit effectScope)
const scopeWatchers = new WeakMap<EffectScope, () => void>()

// Fallback for unmanaged execution contexts (e.g. bare unit tests outside any active effect scope),
// keyed by the context's unique editorRevision Ref instance so independent app/request contexts never interfere.
const unmanagedContextScopes = new WeakMap<object, EffectScope>()

function ensureWatcher(titleRef: Ref<string>, bodyRef: Ref<string>, revisionRef: Ref<number>) {
  const currentScope = getCurrentScope()
  if (currentScope) {
    // 1. Owner-scoped lifecycle: tied to active Vue component or effectScope
    if (scopeWatchers.has(currentScope)) {
      return
    }
    const stopWatcher = watch(
      [titleRef, bodyRef],
      () => {
        revisionRef.value++
      },
      { flush: 'sync' }
    )
    scopeWatchers.set(currentScope, stopWatcher)
    onScopeDispose(() => {
      stopWatcher()
      scopeWatchers.delete(currentScope)
    })
  } else {
    // 2. Unmanaged context fallback: outside any Vue component/effectScope (e.g. bare unit test),
    // bind an owner scope keyed to this context's unique revisionRef.
    if (unmanagedContextScopes.has(revisionRef)) {
      return
    }
    const ctxScope = effectScope()
    ctxScope.run(() => {
      watch(
        [titleRef, bodyRef],
        () => {
          revisionRef.value++
        },
        { flush: 'sync' }
      )
    })
    unmanagedContextScopes.set(revisionRef, ctxScope)
  }
}

export interface CourseOfferingItem {
  id: string
  subject_id: string
  subject_code: string
  subject_name: string
  class_id: string
  class_name: string
  term: number
  academic_year: string
}

export interface ArticleDraftItem {
  id: string
  offering_id: string
  title: string
  body: string
  status: 'draft' | 'published' | string
  created_at: string
  updated_at: string
  published_at?: string | null
  author_id?: string
  version?: number
}

export interface TeacherDraftFieldErrors {
  offering_id?: string
  title?: string
  body?: string
}

export function clearTeacherDraftState() {
  const offerings = useState<CourseOfferingItem[]>('teacher-draft-offerings', () => [])
  const selectedOfferingId = useState<string>('teacher-draft-selected-offering', () => '')
  const articles = useState<ArticleDraftItem[]>('teacher-draft-articles', () => [])
  const currentArticleId = useState<string | null>('teacher-draft-current-id', () => null)
  const currentArticleStatus = useState<'draft' | 'published' | null>('teacher-draft-current-status', () => null)
  const currentArticlePublishedAt = useState<string | null>('teacher-draft-current-published-at', () => null)
  const lastSavedUpdatedAt = useState<string | null>('teacher-draft-last-updated-at', () => null)
  const lastSavedVersion = useState<number | null>('teacher-draft-last-saved-version', () => null)
  const lastSavedTitle = useState<string>('teacher-draft-last-saved-title', () => '')
  const lastSavedBody = useState<string>('teacher-draft-last-saved-body', () => '')
  const title = useState<string>('teacher-draft-title', () => '')
  const body = useState<string>('teacher-draft-body', () => '')
  const isPreview = useState<boolean>('teacher-draft-is-preview', () => false)
  const isLoading = useState<boolean>('teacher-draft-loading', () => false)
  const isSaving = useState<boolean>('teacher-draft-saving', () => false)
  const isPublishing = useState<boolean>('teacher-draft-publishing', () => false)
  const errorMessage = useState<string | null>('teacher-draft-error', () => null)
  const successMessage = useState<string | null>('teacher-draft-success', () => null)
  const fieldErrors = useState<TeacherDraftFieldErrors>('teacher-draft-field-errors', () => ({}))
  const boundUserId = useState<string | null>('teacher-draft-bound-user', () => null)
  const stateGeneration = useState<number>('teacher-draft-generation', () => 0)
  const editorRevision = useState<number>('teacher-draft-editor-revision', () => 0)
  const articlesGeneration = useState<number>('teacher-draft-articles-generation', () => 0)

  stateGeneration.value++
  articlesGeneration.value++
  offerings.value = []
  selectedOfferingId.value = ''
  articles.value = []
  currentArticleId.value = null
  currentArticleStatus.value = null
  currentArticlePublishedAt.value = null
  lastSavedUpdatedAt.value = null
  lastSavedVersion.value = null
  lastSavedTitle.value = ''
  lastSavedBody.value = ''
  title.value = ''
  body.value = ''
  isPreview.value = false
  isLoading.value = false
  isSaving.value = false
  isPublishing.value = false
  errorMessage.value = null
  successMessage.value = null
  fieldErrors.value = {}
  boundUserId.value = null
  editorRevision.value = 0
}

export function useTeacherDrafts() {
  const offerings = useState<CourseOfferingItem[]>('teacher-draft-offerings', () => [])
  const selectedOfferingId = useState<string>('teacher-draft-selected-offering', () => '')
  const articles = useState<ArticleDraftItem[]>('teacher-draft-articles', () => [])
  const currentArticleId = useState<string | null>('teacher-draft-current-id', () => null)
  const currentArticleStatus = useState<'draft' | 'published' | null>('teacher-draft-current-status', () => null)
  const currentArticlePublishedAt = useState<string | null>('teacher-draft-current-published-at', () => null)
  const lastSavedUpdatedAt = useState<string | null>('teacher-draft-last-updated-at', () => null)
  const lastSavedVersion = useState<number | null>('teacher-draft-last-saved-version', () => null)
  const lastSavedTitle = useState<string>('teacher-draft-last-saved-title', () => '')
  const lastSavedBody = useState<string>('teacher-draft-last-saved-body', () => '')
  const title = useState<string>('teacher-draft-title', () => '')
  const body = useState<string>('teacher-draft-body', () => '')
  const isPreview = useState<boolean>('teacher-draft-is-preview', () => false)
  const isLoading = useState<boolean>('teacher-draft-loading', () => false)
  const isSaving = useState<boolean>('teacher-draft-saving', () => false)
  const isPublishing = useState<boolean>('teacher-draft-publishing', () => false)
  const errorMessage = useState<string | null>('teacher-draft-error', () => null)
  const successMessage = useState<string | null>('teacher-draft-success', () => null)
  const fieldErrors = useState<TeacherDraftFieldErrors>('teacher-draft-field-errors', () => ({}))
  const boundUserId = useState<string | null>('teacher-draft-bound-user', () => null)
  const stateGeneration = useState<number>('teacher-draft-generation', () => 0)
  const editorRevision = useState<number>('teacher-draft-editor-revision', () => 0)
  const articlesGeneration = useState<number>('teacher-draft-articles-generation', () => 0)

  ensureWatcher(title, body, editorRevision)

  const hasUnsavedChanges = computed(() => {
    if (!currentArticleId.value) {
      return title.value.trim() !== '' || body.value.trim() !== ''
    }
    return title.value !== lastSavedTitle.value || body.value !== lastSavedBody.value
  })

  const authUser = useState<SafeUserDisplay | null>('auth-user', () => null)
  const currentAuthId = authUser.value?.id || null

  // Identity sync: if user identity changes or becomes unauthenticated, clear draft state immediately
  if (currentAuthId) {
    if (boundUserId.value && boundUserId.value !== currentAuthId) {
      clearTeacherDraftState()
      boundUserId.value = currentAuthId
    } else if (!boundUserId.value) {
      boundUserId.value = currentAuthId
    }
  } else if (
    authUser.value === null &&
    (boundUserId.value !== null ||
      offerings.value.length > 0 ||
      articles.value.length > 0 ||
      title.value !== '' ||
      body.value !== '' ||
      errorMessage.value !== null ||
      successMessage.value !== null)
  ) {
    clearTeacherDraftState()
  }

  async function fetchOfferings() {
    const gen = ++stateGeneration.value
    const expectedUserId = authUser.value?.id || null
    isLoading.value = true
    errorMessage.value = null

    try {
      const res = await $fetch<{ offerings: CourseOfferingItem[] }>('/api/teacher/offerings')
      const currentUserId = authUser.value?.id || null
      if (gen !== stateGeneration.value || currentUserId !== expectedUserId || !currentUserId) {
        return { success: false }
      }
      offerings.value = res.offerings || []
      boundUserId.value = currentUserId
      if (offerings.value.length > 0 && !selectedOfferingId.value) {
        selectedOfferingId.value = offerings.value[0].id
        await fetchArticles(selectedOfferingId.value)
      }
      return { success: true, offerings: offerings.value }
    } catch (err: any) {
      const currentUserId = authUser.value?.id || null
      if (gen !== stateGeneration.value || currentUserId !== expectedUserId || !currentUserId) {
        return { success: false }
      }
      errorMessage.value = 'ไม่สามารถดึงข้อมูลรายวิชาได้'
      return { success: false, error: errorMessage.value }
    } finally {
      const currentUserId = authUser.value?.id || null
      if (gen === stateGeneration.value && currentUserId === expectedUserId) {
        isLoading.value = false
      }
    }
  }

  async function fetchArticles(offeringId?: string) {
    const targetOffering = offeringId || selectedOfferingId.value
    if (!targetOffering) {
      articles.value = []
      return { success: true, articles: [] }
    }
    const gen = ++articlesGeneration.value
    const expectedUserId = authUser.value?.id || null
    isLoading.value = true
    errorMessage.value = null

    try {
      const url = `/api/teacher/articles?offering_id=${encodeURIComponent(targetOffering)}`
      const res = await $fetch<{ articles: ArticleDraftItem[] }>(url)
      const currentUserId = authUser.value?.id || null
      if (gen !== articlesGeneration.value || currentUserId !== expectedUserId || !currentUserId) {
        return { success: false }
      }
      articles.value = res.articles || []
      boundUserId.value = currentUserId
      return { success: true, articles: articles.value }
    } catch (err: any) {
      const currentUserId = authUser.value?.id || null
      if (gen !== articlesGeneration.value || currentUserId !== expectedUserId || !currentUserId) {
        return { success: false }
      }
      errorMessage.value = 'ไม่สามารถดึงข้อมูลฉบับร่างได้'
      return { success: false, error: errorMessage.value }
    } finally {
      const currentUserId = authUser.value?.id || null
      if (gen === articlesGeneration.value && currentUserId === expectedUserId) {
        isLoading.value = false
      }
    }
  }

  async function selectOffering(offeringId: string) {
    selectedOfferingId.value = offeringId
    startNewDraft()
    await fetchArticles(offeringId)
  }

  function startNewDraft() {
    stateGeneration.value++
    currentArticleId.value = null
    currentArticleStatus.value = null
    currentArticlePublishedAt.value = null
    lastSavedUpdatedAt.value = null
    lastSavedVersion.value = null
    lastSavedTitle.value = ''
    lastSavedBody.value = ''
    title.value = ''
    body.value = ''
    isPreview.value = false
    isSaving.value = false
    isPublishing.value = false
    errorMessage.value = null
    successMessage.value = null
    fieldErrors.value = {}
    editorRevision.value++
  }

  async function loadDraft(articleId: string) {
    const gen = ++stateGeneration.value
    const expectedUserId = authUser.value?.id || null
    isLoading.value = true
    isSaving.value = false
    isPublishing.value = false
    editorRevision.value++
    errorMessage.value = null
    successMessage.value = null
    fieldErrors.value = {}

    try {
      const res = await $fetch<{ article: ArticleDraftItem }>(`/api/teacher/articles/${articleId}`)
      const currentUserId = authUser.value?.id || null
      if (gen !== stateGeneration.value || currentUserId !== expectedUserId || !currentUserId) {
        return { success: false }
      }
      const article = res.article
      currentArticleId.value = article.id
      title.value = article.title
      body.value = article.body
      lastSavedTitle.value = article.title
      lastSavedBody.value = article.body
      selectedOfferingId.value = article.offering_id
      currentArticleStatus.value = (article.status as 'draft' | 'published') || 'draft'
      currentArticlePublishedAt.value = article.published_at || null
      lastSavedUpdatedAt.value = article.updated_at
      lastSavedVersion.value = article.version ?? null
      isPreview.value = false
      boundUserId.value = currentUserId
      return { success: true, article }
    } catch (err: any) {
      const currentUserId = authUser.value?.id || null
      if (gen !== stateGeneration.value || currentUserId !== expectedUserId || !currentUserId) {
        return { success: false }
      }
      errorMessage.value = 'ไม่พบเอกสารฉบับร่าง หรือคุณไม่มีสิทธิ์เข้าถึง'
      return { success: false, error: errorMessage.value }
    } finally {
      const currentUserId = authUser.value?.id || null
      if (gen === stateGeneration.value && currentUserId === expectedUserId) {
        isLoading.value = false
      }
    }
  }

  async function saveDraft() {
    // Disable overlapping saves or saves during publishing
    if (isSaving.value || isPublishing.value) {
      return { success: false }
    }

    errorMessage.value = null
    successMessage.value = null
    fieldErrors.value = {}

    // Client-side validation
    const validation = validateTeacherDraftInput(
      {
        offering_id: selectedOfferingId.value,
        title: title.value,
        body: body.value,
      },
      { requireOfferingId: true }
    )

    if (!validation.valid || !validation.sanitized) {
      fieldErrors.value = validation.errors || {}
      errorMessage.value = Object.values(validation.errors || {})[0] || 'กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้อง'
      return { success: false, errors: fieldErrors.value }
    }

    // Snapshot state at request start:
    // Article identity, owner generation, offering, editor inputs
    const gen = ++stateGeneration.value
    const expectedUserId = authUser.value?.id || null
    const snapArticleId = currentArticleId.value
    const snapOfferingId = selectedOfferingId.value
    const snapTitle = validation.sanitized.title
    const snapBody = validation.sanitized.body
    const snapRevision = editorRevision.value

    isSaving.value = true

    try {
      let res: { success: boolean; article: ArticleDraftItem }
      if (snapArticleId) {
        // PUT update existing draft or published article
        // Requires expected_version for atomic CAS
        res = await $fetch<{ success: boolean; article: ArticleDraftItem }>(
          `/api/teacher/articles/${snapArticleId}`,
          {
            method: 'PUT',
            body: {
              title: snapTitle,
              body: snapBody,
              expected_version: lastSavedVersion.value ?? undefined,
            },
          }
        )
      } else {
        // POST create new draft
        res = await $fetch<{ success: boolean; article: ArticleDraftItem }>(
          '/api/teacher/articles',
          {
            method: 'POST',
            body: {
              offering_id: snapOfferingId,
              title: snapTitle,
              body: snapBody,
            },
          }
        )
      }

      const currentUserId = authUser.value?.id || null
      // Check generation & identity: if user signed out or identity changed, do not repopulate!
      if (gen !== stateGeneration.value || currentUserId !== expectedUserId || !currentUserId) {
        return { success: false }
      }

      // Check article identity & offering: if user switched article or offering while save was in flight, do not overwrite!
      if (selectedOfferingId.value !== snapOfferingId || (snapArticleId && currentArticleId.value !== snapArticleId)) {
        return { success: false }
      }

      // Advance persisted baseline/version
      currentArticleId.value = res.article.id
      currentArticleStatus.value = (res.article.status as 'draft' | 'published') || 'draft'
      currentArticlePublishedAt.value = res.article.published_at || null
      lastSavedUpdatedAt.value = res.article.updated_at
      lastSavedVersion.value = res.article.version ?? null
      lastSavedTitle.value = res.article.title
      lastSavedBody.value = res.article.body

      // IN-FLIGHT TYPING PRESERVATION:
      // Only set title/body if user hasn't edited during the request!
      if (editorRevision.value === snapRevision) {
        title.value = res.article.title
        body.value = res.article.body
      }

      if (res.article.status === 'published') {
        successMessage.value = 'บันทึกการแก้ไขบทความที่เผยแพร่แล้วเรียบร้อยแล้ว'
      } else {
        successMessage.value = 'บันทึกฉบับร่างเรียบร้อยแล้ว'
      }
      boundUserId.value = currentUserId

      // Refresh articles list
      await fetchArticles(selectedOfferingId.value)

      return { success: true, article: res.article }
    } catch (err: any) {
      const currentUserId = authUser.value?.id || null
      if (
        gen !== stateGeneration.value ||
        currentUserId !== expectedUserId ||
        !currentUserId ||
        selectedOfferingId.value !== snapOfferingId ||
        (snapArticleId && currentArticleId.value !== snapArticleId)
      ) {
        return { success: false }
      }
      // Preserve unsaved inputs (title and body remain unchanged in state)
      // Never announce success on failure!
      errorMessage.value = err.data?.message || err.statusMessage || 'เกิดข้อผิดพลาดในการบันทึก กรุณาลองใหม่อีกครั้ง'
      return { success: false, error: errorMessage.value }
    } finally {
      const currentUserId = authUser.value?.id || null
      if (gen === stateGeneration.value && currentUserId === expectedUserId) {
        isSaving.value = false
      }
    }
  }

  async function publishArticle(articleId?: string) {
    const targetId = articleId || currentArticleId.value
    if (!targetId) {
      errorMessage.value = 'กรุณาบันทึกฉบับร่างก่อนเผยแพร่'
      return { success: false, error: errorMessage.value }
    }

    // Luna Finding 2: block Publish when editor has unsaved changes
    if (hasUnsavedChanges.value) {
      errorMessage.value = 'มีข้อความที่ยังไม่ได้บันทึก กรุณากดบันทึกฉบับร่างก่อนเผยแพร่'
      return { success: false, error: errorMessage.value }
    }

    if (isPublishing.value || isSaving.value) {
      return { success: false }
    }

    errorMessage.value = null
    successMessage.value = null

    // Snapshot at request start
    const gen = ++stateGeneration.value
    const expectedUserId = authUser.value?.id || null
    const snapArticleId = targetId
    const snapOfferingId = selectedOfferingId.value
    const snapTitle = title.value
    const snapBody = body.value
    const snapRevision = editorRevision.value
    const expectedVersion = lastSavedVersion.value

    isPublishing.value = true

    try {
      const res = await $fetch<{ success: boolean; article: ArticleDraftItem; already_published?: boolean }>(
        `/api/teacher/articles/${targetId}/publish`,
        {
          method: 'POST',
          body: {
            expected_version: expectedVersion ?? undefined,
          },
        }
      )

      const currentUserId = authUser.value?.id || null
      if (gen !== stateGeneration.value || currentUserId !== expectedUserId || !currentUserId) {
        return { success: false }
      }

      // Check article identity & offering: if user switched article/offering while publish was in flight, do not overwrite!
      if (currentArticleId.value !== snapArticleId || selectedOfferingId.value !== snapOfferingId) {
        return { success: false }
      }

      currentArticleId.value = res.article.id
      currentArticleStatus.value = 'published'
      currentArticlePublishedAt.value = res.article.published_at || null
      lastSavedUpdatedAt.value = res.article.updated_at
      lastSavedVersion.value = res.article.version ?? null
      lastSavedTitle.value = res.article.title
      lastSavedBody.value = res.article.body

      // IN-FLIGHT TYPING PRESERVATION:
      // Only set title/body if user hasn't edited during the request!
      if (editorRevision.value === snapRevision) {
        title.value = res.article.title
        body.value = res.article.body
      }

      successMessage.value = 'เผยแพร่บทเรียนเรียบร้อยแล้ว'
      boundUserId.value = currentUserId

      await fetchArticles(selectedOfferingId.value)

      return { success: true, article: res.article }
    } catch (err: any) {
      const currentUserId = authUser.value?.id || null
      if (
        gen !== stateGeneration.value ||
        currentUserId !== expectedUserId ||
        !currentUserId ||
        currentArticleId.value !== snapArticleId ||
        selectedOfferingId.value !== snapOfferingId
      ) {
        return { success: false }
      }
      errorMessage.value = err.data?.message || err.statusMessage || 'เกิดข้อผิดพลาดในการเผยแพร่บทเรียน'
      return { success: false, error: errorMessage.value }
    } finally {
      const currentUserId = authUser.value?.id || null
      if (gen === stateGeneration.value && currentUserId === expectedUserId) {
        isPublishing.value = false
      }
    }
  }

  function togglePreview(previewState?: boolean) {
    if (typeof previewState === 'boolean') {
      isPreview.value = previewState
    } else {
      isPreview.value = !isPreview.value
    }
  }

  return {
    offerings,
    selectedOfferingId,
    articles,
    currentArticleId,
    currentArticleStatus,
    currentArticlePublishedAt,
    lastSavedUpdatedAt,
    lastSavedVersion,
    lastSavedTitle,
    lastSavedBody,
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
    boundUserId,
    stateGeneration,
    editorRevision,
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
    clearDraftState: clearTeacherDraftState,
  }
}
