import { ref, computed } from 'vue'
import { countCodePoints, MAX_TITLE_CODE_POINTS, MAX_BODY_CODE_POINTS } from '../utils/teacherDraft'

export type SimulatedPersona = 'teacher' | 'student'
export type StudentApprovalStatus = 'pending' | 'approved'
export type ArticleStatus = 'draft' | 'published'

export interface SyntheticOffering {
  id: string
  code: string
  nameTh: string
  teacherNameTh: string
  descriptionTh: string
}

export interface SyntheticArticle {
  id: string
  offeringId: string
  title: string
  body: string
  status: ArticleStatus
  createdAt: string
  updatedAt: string
  publishedAt?: string
}

export interface SyntheticStudent {
  id: string
  nameTh: string
  enrolledOfferingId: string
  applicationStatus: StudentApprovalStatus
}

export interface DemoState {
  version: number
  activePersona: SimulatedPersona
  teacherSelectedOfferingId: string
  currentArticleId: string | null
  draftTitle: string
  draftBody: string
  articles: SyntheticArticle[]
  student: SyntheticStudent
  studentSelectedOfferingId: string
  studentViewingArticleId: string | null
  noticeMessage: string | null
  errorMessage: string | null
}

export const DEMO_STORAGE_KEY = 'classroom_demo_ux_v1'

export const INITIAL_OFFERINGS: SyntheticOffering[] = [
  {
    id: 'd0000000-0000-0000-0000-000000000001',
    code: 'MATH-M4-01',
    nameTh: 'คณิตศาสตร์ ม.4 (SEC-01)',
    teacherNameTh: 'อ. สมชาย (อาจารย์จำลอง)',
    descriptionTh: 'ตรรกศาสตร์ เซต และระบบจำนวนจริง สำหรับนักเรียนชั้นมัธยมศึกษาปีที่ 4 ห้อง 1',
  },
  {
    id: 'd0000000-0000-0000-0000-000000000002',
    code: 'PHYS-M4-02',
    nameTh: 'ฟิสิกส์ ม.4 (SEC-02)',
    teacherNameTh: 'อ. วินัย (อาจารย์จำลอง)',
    descriptionTh: 'การเคลื่อนที่แนวตรง แรง และกฎการเคลื่อนที่ของนิวตัน',
  },
]

export function getInitialArticles(): SyntheticArticle[] {
  return [
    {
      id: 'art-00000000-0000-0000-0000-000000000001',
      offeringId: 'd0000000-0000-0000-0000-000000000001',
      title: 'บทที่ 1: ตรรกศาสตร์และประพจน์พื้นฐาน',
      body: `ยินดีต้อนรับสู่วิชาคณิตศาสตร์ ม.4 (SEC-01)

ประพจน์ (Proposition) คือ ประโยคบอกเล่าหรือประโยคปฏิเสธที่มีค่าความจริงเป็น "จริง" หรือ "เท็จ" อย่างใดอย่างหนึ่งเท่านั้น

ตัวอย่างประพจน์:
1. 2 + 2 = 4 (ค่าความจริงเป็นจริง: T)
2. ดวงอาทิตย์ขึ้นทางทิศตะวันตก (ค่าความจริงเป็นเท็จ: F)

ประโยคที่ไม่ใช่ประพจน์:
- คำถาม คำสั่ง ขอร้อง อุทาน เช่น "กรุณาปิดหน้าต่าง", "ทำไมมาสาย?"`,
      status: 'published',
      createdAt: '2026-10-01T08:00:00.000Z',
      updatedAt: '2026-10-01T08:30:00.000Z',
      publishedAt: '2026-10-01T08:30:00.000Z',
    },
    {
      id: 'art-00000000-0000-0000-0000-000000000002',
      offeringId: 'd0000000-0000-0000-0000-000000000001',
      title: 'แบบฝึกหัดท้ายบท: การเชื่อมประพจน์ (ฉบับร่างครู)',
      body: `แบบฝึกหัดทบทวนการเชื่อมประพจน์ด้วยตัวเชื่อม:
1. "และ" (∧)
2. "หรือ" (∨)
3. "ถ้า...แล้ว..." (→)
4. "ก็ต่อเมื่อ" (↔)

(เนื้อหานี้อยู่ระหว่างการร่างโดยอาจารย์ — ยังไม่เผยแพร่สู่ห้องเรียน)`,
      status: 'draft',
      createdAt: '2026-10-02T10:00:00.000Z',
      updatedAt: '2026-10-02T10:15:00.000Z',
    },
    {
      id: 'art-00000000-0000-0000-0000-000000000003',
      offeringId: 'd0000000-0000-0000-0000-000000000002',
      title: 'บทที่ 1: การเคลื่อนที่แนวตรง (วิชาฟิสิกส์)',
      body: `เนื้อหาวิชาฟิสิกส์ ม.4 (SEC-02):
- ระยะทาง (Distance) และการกระจัด (Displacement)
- อัตราเร็วเฉลี่ย และความเร็วเฉลี่ย
- ความเร่งใน 1 มิติ`,
      status: 'published',
      createdAt: '2026-10-02T11:00:00.000Z',
      updatedAt: '2026-10-02T11:30:00.000Z',
      publishedAt: '2026-10-02T11:30:00.000Z',
    },
  ]
}

export function getInitialDemoState(): DemoState {
  return {
    version: 1,
    activePersona: 'teacher',
    teacherSelectedOfferingId: INITIAL_OFFERINGS[0].id,
    currentArticleId: 'art-00000000-0000-0000-0000-000000000002', // Starts with draft loaded for easy trial
    draftTitle: 'แบบฝึกหัดท้ายบท: การเชื่อมประพจน์ (ฉบับร่างครู)',
    draftBody: `แบบฝึกหัดทบทวนการเชื่อมประพจน์ด้วยตัวเชื่อม:
1. "และ" (∧)
2. "หรือ" (∨)
3. "ถ้า...แล้ว..." (→)
4. "ก็ต่อเมื่อ" (↔)

(เนื้อหานี้อยู่ระหว่างการร่างโดยอาจารย์ — ยังไม่เผยแพร่สู่ห้องเรียน)`,
    articles: getInitialArticles(),
    student: {
      id: 'stu-00000000-0000-0000-0000-000000000001',
      nameTh: 'สมหญิง เรียนดี (นักเรียนจำลอง)',
      enrolledOfferingId: INITIAL_OFFERINGS[0].id, // Enrolled in SEC-01
      applicationStatus: 'pending', // Starts pending
    },
    studentSelectedOfferingId: INITIAL_OFFERINGS[0].id,
    studentViewingArticleId: null,
    noticeMessage: null,
    errorMessage: null,
  }
}

/**
 * Validates the entire stored DemoState structure.
 * Rejects missing, malformed, broken, or oversized objects/arrays fail-closed.
 */
export function isValidDemoState(val: unknown): val is DemoState {
  if (typeof val !== 'object' || val === null || Array.isArray(val)) {
    return false
  }

  const s = val as Record<string, any>

  if (s.version !== 1) {
    return false
  }

  if (s.activePersona !== 'teacher' && s.activePersona !== 'student') {
    return false
  }

  if (
    typeof s.teacherSelectedOfferingId !== 'string' ||
    !INITIAL_OFFERINGS.some((o) => o.id === s.teacherSelectedOfferingId)
  ) {
    return false
  }

  if (s.currentArticleId !== null && typeof s.currentArticleId !== 'string') {
    return false
  }

  if (
    typeof s.draftTitle !== 'string' ||
    countCodePoints(s.draftTitle) > MAX_TITLE_CODE_POINTS
  ) {
    return false
  }

  if (
    typeof s.draftBody !== 'string' ||
    countCodePoints(s.draftBody) > MAX_BODY_CODE_POINTS
  ) {
    return false
  }

  // Student shape validation
  if (
    typeof s.student !== 'object' ||
    s.student === null ||
    Array.isArray(s.student)
  ) {
    return false
  }

  if (typeof s.student.id !== 'string' || s.student.id.trim().length === 0) {
    return false
  }

  if (typeof s.student.nameTh !== 'string' || s.student.nameTh.trim().length === 0) {
    return false
  }

  if (
    typeof s.student.enrolledOfferingId !== 'string' ||
    !INITIAL_OFFERINGS.some((o) => o.id === s.student.enrolledOfferingId)
  ) {
    return false
  }

  if (
    s.student.applicationStatus !== 'pending' &&
    s.student.applicationStatus !== 'approved'
  ) {
    return false
  }

  if (
    typeof s.studentSelectedOfferingId !== 'string' ||
    !INITIAL_OFFERINGS.some((o) => o.id === s.studentSelectedOfferingId)
  ) {
    return false
  }

  if (s.studentViewingArticleId !== null && typeof s.studentViewingArticleId !== 'string') {
    return false
  }

  // Articles array validation
  if (!Array.isArray(s.articles)) {
    return false
  }

  for (const a of s.articles) {
    if (typeof a !== 'object' || a === null || Array.isArray(a)) {
      return false
    }
    if (typeof a.id !== 'string' || a.id.trim().length === 0) {
      return false
    }
    if (
      typeof a.offeringId !== 'string' ||
      !INITIAL_OFFERINGS.some((o) => o.id === a.offeringId)
    ) {
      return false
    }
    if (
      typeof a.title !== 'string' ||
      countCodePoints(a.title) > MAX_TITLE_CODE_POINTS
    ) {
      return false
    }
    if (
      typeof a.body !== 'string' ||
      countCodePoints(a.body) > MAX_BODY_CODE_POINTS
    ) {
      return false
    }
    if (a.status !== 'draft' && a.status !== 'published') {
      return false
    }
    if (typeof a.createdAt !== 'string' || a.createdAt.trim().length === 0) {
      return false
    }
    if (typeof a.updatedAt !== 'string' || a.updatedAt.trim().length === 0) {
      return false
    }
    if (a.publishedAt !== undefined && typeof a.publishedAt !== 'string') {
      return false
    }
  }

  return true
}

export type StudentArticleAccessStatus =
  | 'allowed'
  | 'denied_pending'
  | 'denied_wrong_offering'
  | 'denied_draft'
  | 'not_found'

export function evaluateStudentAccess(
  student: SyntheticStudent,
  selectedOfferingId: string,
  article: SyntheticArticle | undefined
): { status: StudentArticleAccessStatus; reasonTh: string } {
  if (student.applicationStatus !== 'approved') {
    return {
      status: 'denied_pending',
      reasonTh: 'ใบสมัครของนักเรียนยังไม่ได้รับการอนุมัติ (สถานะ: รออนุมัติ) — ยังไม่สามารถเข้าถึงบทความใดๆ ได้',
    }
  }

  if (selectedOfferingId !== student.enrolledOfferingId) {
    return {
      status: 'denied_wrong_offering',
      reasonTh: 'นักเรียนลงทะเบียนเฉพาะวิชาที่กำหนด — ไม่สามารถเข้าถึงหรืออ่านบทความของวิชาอื่นได้',
    }
  }

  if (!article) {
    return {
      status: 'not_found',
      reasonTh: 'ไม่พบบทความที่ร้องขอ',
    }
  }

  if (article.offeringId !== student.enrolledOfferingId) {
    return {
      status: 'denied_wrong_offering',
      reasonTh: 'บทความนี้สังกัดวิชาอื่นที่นักเรียนไม่ได้ลงทะเบียน',
    }
  }

  if (article.status !== 'published') {
    return {
      status: 'denied_draft',
      reasonTh: 'บทความนี้ยังเป็นฉบับร่างของอาจารย์ (ยังไม่เผยแพร่) — นักเรียนไม่สามารถอ่านได้',
    }
  }

  return {
    status: 'allowed',
    reasonTh: 'อนุญาตให้อ่านบทความได้',
  }
}

export function useOwnerTrialDemo() {
  const state = ref<DemoState>(getInitialDemoState())

  // Storage Persistence with complete schema validation
  function loadFromStorage(): boolean {
    if (typeof window === 'undefined' || !window.localStorage) return false
    try {
      const raw = window.localStorage.getItem(DEMO_STORAGE_KEY)
      if (!raw) return false
      const parsed = JSON.parse(raw)
      if (isValidDemoState(parsed)) {
        state.value = parsed
        return true
      } else {
        // Structurally invalid or corrupted state
        // Safely reset only the namespaced key to initial defaults without touching unrelated storage
        const initial = getInitialDemoState()
        state.value = initial
        window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(initial))
        state.value.noticeMessage =
          'ตรวจพบข้อมูลจำลองในเบราว์เซอร์ไม่ถูกต้องหรือไม่สมบูรณ์ ระบบได้รีเซ็ตเป็นค่าเริ่มต้นที่ปลอดภัยแล้ว'
        return false
      }
    } catch {
      // JSON parse error: reset only namespaced key
      const initial = getInitialDemoState()
      state.value = initial
      try {
        window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(initial))
      } catch {}
      state.value.noticeMessage =
        'ตรวจพบข้อมูลจำลองในเบราว์เซอร์เสียหาย ระบบได้รีเซ็ตเป็นค่าเริ่มต้นที่ปลอดภัยแล้ว'
      return false
    }
  }

  function saveToStorage() {
    if (typeof window === 'undefined' || !window.localStorage) return
    try {
      window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state.value))
    } catch {
      // Storage quota or disabled, ignore in synthetic demo
    }
  }

  function resetState() {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(DEMO_STORAGE_KEY)
    }
    state.value = getInitialDemoState()
    state.value.noticeMessage = 'รีเซ็ตสถานะการจำลองทั้งหมดเป็นค่าเริ่มต้นเรียบร้อยแล้ว'
    state.value.errorMessage = null
  }

  // Persona switching
  function setPersona(persona: SimulatedPersona) {
    state.value.activePersona = persona
    state.value.noticeMessage = null
    state.value.errorMessage = null
    saveToStorage()
  }

  // Teacher offering selection
  function selectTeacherOffering(offeringId: string) {
    state.value.teacherSelectedOfferingId = offeringId
    state.value.currentArticleId = null
    state.value.draftTitle = ''
    state.value.draftBody = ''
    state.value.noticeMessage = null
    state.value.errorMessage = null
    saveToStorage()
  }

  // Teacher load draft/article
  function loadArticleForEditing(articleId: string) {
    const art = state.value.articles.find((a) => a.id === articleId)
    if (art) {
      state.value.currentArticleId = art.id
      state.value.draftTitle = art.title
      state.value.draftBody = art.body
      state.value.noticeMessage = `โหลดบทความ "${art.title}" เรียบร้อยแล้ว (สถานะ: ${art.status === 'published' ? 'เผยแพร่แล้ว' : 'ฉบับร่าง'})`
      state.value.errorMessage = null
      saveToStorage()
    }
  }

  // Teacher new draft
  function startNewDraft() {
    state.value.currentArticleId = null
    state.value.draftTitle = ''
    state.value.draftBody = ''
    state.value.noticeMessage = 'เริ่มเขียนบทความใหม่ (ยังไม่ได้บันทึก)'
    state.value.errorMessage = null
    saveToStorage()
  }

  // Teacher save draft
  function saveDraft(): { success: boolean; error?: string } {
    state.value.noticeMessage = null
    state.value.errorMessage = null

    const titleTrimmed = state.value.draftTitle.trim()
    const bodyTrimmed = state.value.draftBody.trim()

    if (!titleTrimmed) {
      state.value.errorMessage = 'กรุณากรอกหัวข้อบทความ (หัวข้อต้องไม่ว่างเปล่า)'
      return { success: false, error: state.value.errorMessage }
    }

    if (!bodyTrimmed) {
      state.value.errorMessage = 'กรุณากรอกเนื้อหาบทความ (เนื้อหาต้องไม่ว่างเปล่า)'
      return { success: false, error: state.value.errorMessage }
    }

    const titleLen = countCodePoints(state.value.draftTitle)
    if (titleLen > MAX_TITLE_CODE_POINTS) {
      state.value.errorMessage = `หัวข้อยาวเกินกำหนด (${titleLen} / ${MAX_TITLE_CODE_POINTS} ตัวอักษร)`
      return { success: false, error: state.value.errorMessage }
    }

    const bodyLen = countCodePoints(state.value.draftBody)
    if (bodyLen > MAX_BODY_CODE_POINTS) {
      state.value.errorMessage = `เนื้อหายาวเกินกำหนด (${bodyLen} / ${MAX_BODY_CODE_POINTS} ตัวอักษร)`
      return { success: false, error: state.value.errorMessage }
    }

    const now = new Date().toISOString()

    if (state.value.currentArticleId) {
      // Update existing
      const idx = state.value.articles.findIndex((a) => a.id === state.value.currentArticleId)
      if (idx !== -1) {
        state.value.articles[idx].title = state.value.draftTitle
        state.value.articles[idx].body = state.value.draftBody
        state.value.articles[idx].updatedAt = now
        state.value.noticeMessage = `บันทึกร่างบทความ "${state.value.articles[idx].title}" เรียบร้อยแล้ว (อัปเดตเมื่อ ${new Date().toLocaleTimeString('th-TH')})`
        saveToStorage()
        return { success: true }
      }
    }

    // Create new draft
    const newId = `art-${Date.now()}`
    const newArticle: SyntheticArticle = {
      id: newId,
      offeringId: state.value.teacherSelectedOfferingId,
      title: state.value.draftTitle,
      body: state.value.draftBody,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    }
    state.value.articles.push(newArticle)
    state.value.currentArticleId = newId
    state.value.noticeMessage = `สร้างและบันทึกร่างบทความ "${newArticle.title}" สำเร็จ (สถานะ: ฉบับร่าง)`
    saveToStorage()
    return { success: true }
  }

  // Teacher publish article
  function publishArticle(articleId: string) {
    const idx = state.value.articles.findIndex((a) => a.id === articleId)
    if (idx !== -1) {
      const now = new Date().toISOString()
      state.value.articles[idx].status = 'published'
      state.value.articles[idx].publishedAt = now
      state.value.articles[idx].updatedAt = now
      state.value.noticeMessage = `เผยแพร่บทความ "${state.value.articles[idx].title}" เรียบร้อยแล้ว (นักเรียนที่ได้รับอนุมัติในวิชานี้จะสามารถอ่านได้)`
      state.value.errorMessage = null
      saveToStorage()
    }
  }

  // Teacher unpublish article
  function unpublishArticle(articleId: string) {
    const idx = state.value.articles.findIndex((a) => a.id === articleId)
    if (idx !== -1) {
      const now = new Date().toISOString()
      state.value.articles[idx].status = 'draft'
      state.value.articles[idx].updatedAt = now
      state.value.noticeMessage = `ยกเลิกการเผยแพร่บทความ "${state.value.articles[idx].title}" กลับเป็นฉบับร่างแล้ว (นักเรียนจะไม่สามารถเห็นบทความนี้)`
      state.value.errorMessage = null
      saveToStorage()
    }
  }

  // Simulated reload
  function simulateReload() {
    const loaded = loadFromStorage()
    if (loaded) {
      state.value.noticeMessage = 'จำลองโหลดหน้าใหม่สำเร็จ: ดึงข้อมูลล่าสุดจากหน่วยความจำเบราว์เซอร์เรียบร้อยแล้ว'
    } else {
      state.value.noticeMessage = 'จำลองโหลดหน้าใหม่: ข้อมูลเป็นไปตามสถานะปัจจุบัน'
    }
    state.value.errorMessage = null
  }

  // Student Controls
  function setStudentApprovalStatus(status: StudentApprovalStatus) {
    state.value.student.applicationStatus = status
    state.value.studentViewingArticleId = null
    state.value.noticeMessage = `จำลองเปลี่ยนสถานะใบสมัครนักเรียนเป็น: ${status === 'approved' ? 'อนุมัติแล้ว (Approved)' : 'รออนุมัติ (Pending)'}`
    state.value.errorMessage = null
    saveToStorage()
  }

  function selectStudentOffering(offeringId: string) {
    state.value.studentSelectedOfferingId = offeringId
    state.value.studentViewingArticleId = null
    state.value.noticeMessage = null
    state.value.errorMessage = null
    saveToStorage()
  }

  function viewStudentArticle(articleId: string) {
    state.value.studentViewingArticleId = articleId
    saveToStorage()
  }

  function closeStudentArticle() {
    state.value.studentViewingArticleId = null
    saveToStorage()
  }

  // Computed views
  const teacherArticles = computed(() => {
    return state.value.articles.filter(
      (a) => a.offeringId === state.value.teacherSelectedOfferingId
    )
  })

  const currentTeacherArticle = computed(() => {
    return state.value.articles.find((a) => a.id === state.value.currentArticleId)
  })

  const studentCurrentOffering = computed(() => {
    return INITIAL_OFFERINGS.find(
      (o) => o.id === state.value.studentSelectedOfferingId
    )
  })

  const studentEnrolledOffering = computed(() => {
    return INITIAL_OFFERINGS.find(
      (o) => o.id === state.value.student.enrolledOfferingId
    )
  })

  const studentVisibleArticles = computed(() => {
    // Only published articles in the offering
    return state.value.articles.filter(
      (a) =>
        a.offeringId === state.value.studentSelectedOfferingId &&
        a.status === 'published'
    )
  })

  const studentReadingArticle = computed(() => {
    return state.value.articles.find(
      (a) => a.id === state.value.studentViewingArticleId
    )
  })

  const studentAccessCheck = computed(() => {
    return evaluateStudentAccess(
      state.value.student,
      state.value.studentSelectedOfferingId,
      studentReadingArticle.value
    )
  })

  return {
    state,
    offerings: INITIAL_OFFERINGS,
    teacherArticles,
    currentTeacherArticle,
    studentCurrentOffering,
    studentEnrolledOffering,
    studentVisibleArticles,
    studentReadingArticle,
    studentAccessCheck,
    titleCodePointCount: computed(() => countCodePoints(state.value.draftTitle)),
    bodyCodePointCount: computed(() => countCodePoints(state.value.draftBody)),
    MAX_TITLE_CODE_POINTS,
    MAX_BODY_CODE_POINTS,
    loadFromStorage,
    saveToStorage,
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
    evaluateStudentAccess,
    isValidDemoState,
  }
}
