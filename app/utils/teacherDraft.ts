export const MAX_TITLE_CODE_POINTS = 200
export const MAX_BODY_CODE_POINTS = 50000

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Counts the exact number of Unicode code points in a string.
 * Uses Array spreading ([...str]) so that supplementary plane characters
 * (like emojis) and multi-byte characters are counted as single code points,
 * matching PostgreSQL char_length(str) behavior.
 */
export function countCodePoints(str: string): number {
  if (typeof str !== 'string') {
    return 0
  }
  return [...str].length
}

export interface TeacherDraftValidationResult {
  valid: boolean
  errors?: {
    offering_id?: string
    title?: string
    body?: string
  }
  sanitized?: {
    offering_id: string
    title: string
    body: string
  }
}

/**
 * Validates teacher draft creation and update inputs according to Slice 1A requirements:
 * - Title: nonblank after trim, max 200 Unicode code points.
 * - Body: nonblank after whitespace check, max 50,000 Unicode code points, preserving whitespace/newlines.
 * - Offering ID: valid UUID format.
 */
export function validateTeacherDraftInput(
  input: any,
  options: { requireOfferingId?: boolean } = { requireOfferingId: true }
): TeacherDraftValidationResult {
  const errors: { offering_id?: string; title?: string; body?: string } = {}

  // 1. Validate offering_id
  const requireOffering = options?.requireOfferingId !== false
  const offeringId = typeof input?.offering_id === 'string' ? input.offering_id.trim() : ''
  if (requireOffering) {
    if (!offeringId || !UUID_REGEX.test(offeringId)) {
      errors.offering_id = 'กรุณาระบุวิชา/ห้องเรียนที่ถูกต้อง'
    }
  } else if (offeringId && !UUID_REGEX.test(offeringId)) {
    errors.offering_id = 'รหัสวิชา/ห้องเรียนไม่ถูกต้อง'
  }

  // 2. Validate title
  const rawTitle = typeof input?.title === 'string' ? input.title : ''
  const trimmedTitle = rawTitle.trim()

  if (!trimmedTitle) {
    errors.title = 'กรุณาระบุชื่อเรื่อง'
  } else if (countCodePoints(trimmedTitle) > MAX_TITLE_CODE_POINTS) {
    errors.title = `ชื่อเรื่องต้องมีความยาวไม่เกิน ${MAX_TITLE_CODE_POINTS} ตัวอักษร`
  }

  // 3. Validate body
  const rawBody = typeof input?.body === 'string' ? input.body : ''
  const trimmedBody = rawBody.trim()

  if (!trimmedBody) {
    errors.body = 'กรุณาระบุเนื้อหา'
  } else if (countCodePoints(rawBody) > MAX_BODY_CODE_POINTS) {
    errors.body = `เนื้อหาต้องมีความยาวไม่เกิน ${MAX_BODY_CODE_POINTS.toLocaleString()} ตัวอักษร`
  }

  const valid = Object.keys(errors).length === 0

  if (!valid) {
    return { valid: false, errors }
  }

  return {
    valid: true,
    sanitized: {
      offering_id: offeringId,
      title: trimmedTitle,
      body: rawBody, // Preserves leading indentation, line breaks, and whitespace
    },
  }
}
