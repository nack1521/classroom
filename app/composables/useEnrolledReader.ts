import { getCurrentScope, onScopeDispose, watch } from 'vue'
import type { SafeUserDisplay } from '../utils/auth'

export interface EnrolledOfferingItem {
  id: string
  subject_id: string
  subject_code: string
  subject_name: string
  class_id: string
  class_name: string
  term: number
  academic_year: string
}

export interface EnrolledArticleSummary {
  id: string
  offering_id: string
  title: string
  published_at: string | null
  version: number
}

export interface EnrolledArticleDetail {
  id: string
  offering_id: string
  title: string
  body: string
  published_at: string | null
  version: number
}

export function clearEnrolledReaderState() {
  const offerings = useState<EnrolledOfferingItem[]>('enrolled-reader-offerings', () => [])
  const selectedOfferingId = useState<string>('enrolled-reader-selected-offering', () => '')
  const articles = useState<EnrolledArticleSummary[]>('enrolled-reader-articles', () => [])
  const currentArticleId = useState<string | null>('enrolled-reader-current-article-id', () => null)
  const currentArticle = useState<EnrolledArticleDetail | null>('enrolled-reader-current-article', () => null)
  const isLoading = useState<boolean>('enrolled-reader-loading', () => false)
  const errorMessage = useState<string | null>('enrolled-reader-error', () => null)
  const boundUserId = useState<string | null>('enrolled-reader-bound-user', () => null)
  const stateGeneration = useState<number>('enrolled-reader-generation', () => 0)

  stateGeneration.value++
  offerings.value = []
  selectedOfferingId.value = ''
  articles.value = []
  currentArticleId.value = null
  currentArticle.value = null
  isLoading.value = false
  errorMessage.value = null
  boundUserId.value = null
}

export function useEnrolledReader() {
  const offerings = useState<EnrolledOfferingItem[]>('enrolled-reader-offerings', () => [])
  const selectedOfferingId = useState<string>('enrolled-reader-selected-offering', () => '')
  const articles = useState<EnrolledArticleSummary[]>('enrolled-reader-articles', () => [])
  const currentArticleId = useState<string | null>('enrolled-reader-current-article-id', () => null)
  const currentArticle = useState<EnrolledArticleDetail | null>('enrolled-reader-current-article', () => null)
  const isLoading = useState<boolean>('enrolled-reader-loading', () => false)
  const errorMessage = useState<string | null>('enrolled-reader-error', () => null)
  const boundUserId = useState<string | null>('enrolled-reader-bound-user', () => null)
  const stateGeneration = useState<number>('enrolled-reader-generation', () => 0)

  const authUser = useState<SafeUserDisplay | null>('auth-user', () => null)
  const currentAuthId = authUser.value?.id || null

  // Identity sync: if user identity changes or becomes unauthenticated, clear reader state immediately
  if (currentAuthId) {
    if (boundUserId.value && boundUserId.value !== currentAuthId) {
      clearEnrolledReaderState()
      boundUserId.value = currentAuthId
    } else if (!boundUserId.value) {
      boundUserId.value = currentAuthId
    }
  } else if (
    authUser.value === null &&
    (boundUserId.value !== null ||
      offerings.value.length > 0 ||
      selectedOfferingId.value !== '' ||
      articles.value.length > 0 ||
      currentArticleId.value !== null ||
      currentArticle.value !== null ||
      isLoading.value ||
      errorMessage.value !== null)
  ) {
    clearEnrolledReaderState()
  }

  // Reactive lifecycle and scope disposal
  const scope = getCurrentScope()
  if (scope) {
    // Reactive watcher on authUser identity changes (A->B or sign-out while mounted)
    watch(
      () => authUser.value?.id || null,
      (newId, oldId) => {
        if (newId !== oldId) {
          clearEnrolledReaderState()
          if (newId) {
            boundUserId.value = newId
          }
        }
      }
    )

    // Scope disposal hook (unmount / context teardown)
    onScopeDispose(() => {
      // Invalidate any in-flight async responses
      stateGeneration.value++
      // Clear reader state so unmounted component leaves no stale shared state
      clearEnrolledReaderState()
    })
  }

  async function fetchPermittedOfferings(): Promise<{ success: boolean; offerings?: EnrolledOfferingItem[] }> {
    const gen = stateGeneration.value
    const expectedUserId = authUser.value?.id || null

    if (!expectedUserId) {
      return { success: false }
    }

    isLoading.value = true
    errorMessage.value = null

    try {
      const res = await $fetch<{ offerings: EnrolledOfferingItem[] }>('/api/learn/offerings')
      const currentUserId = authUser.value?.id || null

      if (gen !== stateGeneration.value || currentUserId !== expectedUserId || !currentUserId) {
        return { success: false }
      }

      offerings.value = res.offerings || []
      return { success: true, offerings: offerings.value }
    } catch (err: any) {
      const currentUserId = authUser.value?.id || null
      if (gen !== stateGeneration.value || currentUserId !== expectedUserId || !currentUserId) {
        return { success: false }
      }
      errorMessage.value = err.data?.message || err.statusMessage || 'ไม่สามารถโหลดรายการวิชาที่ลงทะเบียนได้'
      return { success: false }
    } finally {
      const currentUserId = authUser.value?.id || null
      if (gen === stateGeneration.value && currentUserId === expectedUserId) {
        isLoading.value = false
      }
    }
  }

  async function selectOffering(offeringId: string) {
    stateGeneration.value++
    selectedOfferingId.value = offeringId
    currentArticleId.value = null
    currentArticle.value = null
    articles.value = []
    errorMessage.value = null

    if (offeringId) {
      await fetchPublishedArticles(offeringId)
    }
  }

  async function fetchPublishedArticles(offeringId: string): Promise<{ success: boolean; articles?: EnrolledArticleSummary[] }> {
    const gen = stateGeneration.value
    const expectedUserId = authUser.value?.id || null
    const snapOfferingId = offeringId

    if (!expectedUserId || !offeringId) {
      return { success: false }
    }

    isLoading.value = true
    errorMessage.value = null

    try {
      const res = await $fetch<{ articles: EnrolledArticleSummary[] }>('/api/learn/articles', {
        query: { offering_id: offeringId },
      })
      const currentUserId = authUser.value?.id || null

      if (
        gen !== stateGeneration.value ||
        currentUserId !== expectedUserId ||
        !currentUserId ||
        selectedOfferingId.value !== snapOfferingId
      ) {
        return { success: false }
      }

      articles.value = res.articles || []
      return { success: true, articles: articles.value }
    } catch (err: any) {
      const currentUserId = authUser.value?.id || null
      if (
        gen !== stateGeneration.value ||
        currentUserId !== expectedUserId ||
        !currentUserId ||
        selectedOfferingId.value !== snapOfferingId
      ) {
        return { success: false }
      }
      articles.value = []
      errorMessage.value = err.data?.message || err.statusMessage || 'ไม่พบรายวิชา หรือคุณไม่มีสิทธิ์เข้าถึงรายวิชานี้'
      return { success: false }
    } finally {
      const currentUserId = authUser.value?.id || null
      if (gen === stateGeneration.value && currentUserId === expectedUserId && selectedOfferingId.value === snapOfferingId) {
        isLoading.value = false
      }
    }
  }

  async function loadArticle(articleId: string): Promise<{ success: boolean; article?: EnrolledArticleDetail }> {
    const gen = stateGeneration.value
    const expectedUserId = authUser.value?.id || null
    const snapArticleId = articleId
    const snapOfferingId = selectedOfferingId.value

    if (!expectedUserId || !articleId) {
      return { success: false }
    }

    currentArticleId.value = articleId
    isLoading.value = true
    errorMessage.value = null

    try {
      const res = await $fetch<{ article: EnrolledArticleDetail }>(`/api/learn/articles/${articleId}`)
      const currentUserId = authUser.value?.id || null

      if (
        gen !== stateGeneration.value ||
        currentUserId !== expectedUserId ||
        !currentUserId ||
        currentArticleId.value !== snapArticleId ||
        (snapOfferingId && selectedOfferingId.value !== snapOfferingId)
      ) {
        return { success: false }
      }

      currentArticle.value = res.article
      return { success: true, article: res.article }
    } catch (err: any) {
      const currentUserId = authUser.value?.id || null
      if (
        gen !== stateGeneration.value ||
        currentUserId !== expectedUserId ||
        !currentUserId ||
        currentArticleId.value !== snapArticleId
      ) {
        return { success: false }
      }
      currentArticle.value = null
      // Clear cached articles and selected offering on observed denial so private content is not retained
      articles.value = []
      selectedOfferingId.value = ''
      currentArticleId.value = null
      errorMessage.value = err.data?.message || err.statusMessage || 'ไม่พบบทความ หรือบทความนี้ยังไม่ได้เผยแพร่'
      return { success: false }
    } finally {
      const currentUserId = authUser.value?.id || null
      if (gen === stateGeneration.value && currentUserId === expectedUserId) {
        isLoading.value = false
      }
    }
  }

  function backToArticles() {
    stateGeneration.value++
    currentArticleId.value = null
    currentArticle.value = null
    errorMessage.value = null
  }

  function backToOfferings() {
    stateGeneration.value++
    selectedOfferingId.value = ''
    currentArticleId.value = null
    currentArticle.value = null
    articles.value = []
    errorMessage.value = null
  }

  return {
    offerings,
    selectedOfferingId,
    articles,
    currentArticleId,
    currentArticle,
    isLoading,
    errorMessage,
    boundUserId,
    stateGeneration,
    fetchPermittedOfferings,
    selectOffering,
    fetchPublishedArticles,
    loadArticle,
    backToArticles,
    backToOfferings,
    clearReaderState: clearEnrolledReaderState,
  }
}
