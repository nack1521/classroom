export const ALLOWED_TITLES = ['นาย', 'นาง', 'นางสาว', 'ด.ช.', 'ด.ญ.'] as const
export type AllowedTitle = typeof ALLOWED_TITLES[number]

export interface ValidatedApplicationInput {
  title: AllowedTitle
  first_name: string
  last_name: string
  student_id: string
  class_id: string
  roll_number: number
}

export interface StudentApplicationRecord extends ValidatedApplicationInput {
  id: string
  user_id: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  updated_at: string
  class?: {
    id: string
    name: string
    academic_year: string
  }
}

export interface ClassRecord {
  id: string
  name: string
  academic_year: string
  is_active: boolean
}

/**
 * Validates that title is in the allowed Thai titles set.
 */
export function isValidTitle(title: string): title is AllowedTitle {
  return (ALLOWED_TITLES as readonly string[]).includes(title)
}

/**
 * Validates that student ID is exact 5 ASCII digits, preserving leading zeros (e.g. '01234').
 */
export function isValidStudentId(studentId: string): boolean {
  if (typeof studentId !== 'string') return false
  return /^[0-9]{5}$/.test(studentId)
}

/**
 * Validates that roll number is an integer in range 1-45.
 */
export function isValidRollNumber(roll: number): boolean {
  if (typeof roll !== 'number' || !Number.isInteger(roll)) return false
  return roll >= 1 && roll <= 45
}

/**
 * Validates UUID format for class_id.
 */
export function isValidClassId(classId: string): boolean {
  if (typeof classId !== 'string') return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(classId)
}

/**
 * Sanitizes Thai names: strips HTML tags to prevent XSS, normalizes spaces, and limits length.
 */
export function sanitizeThaiName(name: string): string {
  if (typeof name !== 'string') return ''
  // Strip any HTML tags
  const stripped = name.replace(/<[^>]*>/g, '')
  // Collapse multiple whitespaces and trim
  return stripped.replace(/\s+/g, ' ').trim().slice(0, 100)
}

/**
 * Validates and sanitizes untrusted client submission.
 * Discards client-supplied user_id, status, or unexpected fields to prevent identity/privilege spoofing.
 */
export function validateStudentApplicationInput(input: unknown): {
  valid: boolean
  errors: Record<string, string>
  sanitized?: ValidatedApplicationInput
} {
  const errors: Record<string, string> = {}

  if (!input || typeof input !== 'object') {
    return { valid: false, errors: { form: 'Invalid request body' } }
  }

  const raw = input as Record<string, unknown>

  // 1. Title
  const rawTitle = typeof raw.title === 'string' ? raw.title.trim() : ''
  if (!rawTitle) {
    errors.title = 'คำนำหน้าชื่อเป็นข้อมูลที่จำเป็น'
  } else if (!isValidTitle(rawTitle)) {
    errors.title = 'คำนำหน้าชื่อต้องเป็น นาย, นาง, นางสาว, ด.ช. หรือ ด.ญ. เท่านั้น'
  }

  // 2. First name
  const sanitizedFirstName = typeof raw.first_name === 'string' ? sanitizeThaiName(raw.first_name) : ''
  if (!sanitizedFirstName) {
    errors.first_name = 'ชื่อเป็นข้อมูลที่จำเป็น'
  }

  // 3. Last name
  const sanitizedLastName = typeof raw.last_name === 'string' ? sanitizeThaiName(raw.last_name) : ''
  if (!sanitizedLastName) {
    errors.last_name = 'นามสกุลเป็นข้อมูลที่จำเป็น'
  }

  // 4. Student ID (exact 5 ASCII digits)
  const rawStudentId = typeof raw.student_id === 'string' ? raw.student_id.trim() : ''
  if (!rawStudentId) {
    errors.student_id = 'รหัสประจำตัวนักเรียนเป็นข้อมูลที่จำเป็น'
  } else if (!isValidStudentId(rawStudentId)) {
    errors.student_id = 'รหัสประจำตัวนักเรียนต้องเป็นตัวเลข 5 หลักเท่านั้น (เช่น 01234)'
  }

  // 5. Class ID
  const rawClassId = typeof raw.class_id === 'string' ? raw.class_id.trim() : ''
  if (!rawClassId) {
    errors.class_id = 'กรุณาเลือกชั้นเรียน'
  } else if (!isValidClassId(rawClassId)) {
    errors.class_id = 'รหัสห้องเรียนไม่ถูกต้อง'
  }

  // 6. Roll Number (1-45)
  const rawRoll = Number(raw.roll_number)
  if (raw.roll_number === undefined || raw.roll_number === null || isNaN(rawRoll)) {
    errors.roll_number = 'เลขที่เป็นข้อมูลที่จำเป็น'
  } else if (!isValidRollNumber(rawRoll)) {
    errors.roll_number = 'เลขที่ต้องอยู่ระหว่าง 1 ถึง 45 เท่านั้น'
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors }
  }

  return {
    valid: true,
    errors: {},
    sanitized: {
      title: rawTitle as AllowedTitle,
      first_name: sanitizedFirstName,
      last_name: sanitizedLastName,
      student_id: rawStudentId,
      class_id: rawClassId,
      roll_number: rawRoll,
    },
  }
}
