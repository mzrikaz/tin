import { entityByKey, FILES_TOTAL_MAX_BYTES, INCOME_OTHER, PROFESSION_OTHER, PURPOSE_OTHER, REMARKS_MAX } from './config'
import type { Errors, FileMeta, FormState, StepId } from './types'

const NIC_OLD = /^\d{9}[VvXx]$/
const NIC_NEW = /^\d{12}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const NAME = /^[^,]*$/ // IRD: "Commas in the names are not allowed."
const LATIN_NAME = /^[A-Za-z][A-Za-z .'-]*$/

export const normaliseNic = (v: string) => v.replace(/\s+/g, '').toUpperCase()
export const isNic = (v: string) => NIC_OLD.test(normaliseNic(v)) || NIC_NEW.test(normaliseNic(v))

/** Sri Lankan NIC encodes birth date and gender. Day-of-year always counts Feb as 29 days.
 *  Gender uses IRD codes: '1' male, '2' female. */
export function parseNic(raw: string): { dob: string; gender: '1' | '2' } | null {
  const nic = normaliseNic(raw)
  let year: number
  let day: number
  if (NIC_OLD.test(nic)) {
    year = 1900 + Number(nic.slice(0, 2))
    day = Number(nic.slice(2, 5))
  } else if (NIC_NEW.test(nic)) {
    year = Number(nic.slice(0, 4))
    day = Number(nic.slice(4, 7))
  } else return null

  let gender: '1' | '2' = '1'
  if (day > 500) {
    gender = '2'
    day -= 500
  }
  if (day < 1 || day > 366 || year < 1900 || year > new Date().getFullYear()) return null

  const months = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  let m = 0
  while (day > months[m]) day -= months[m++]
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
  if (m === 1 && day === 29 && !leap) return null

  const pad = (n: number) => String(n).padStart(2, '0')
  return { dob: `${year}-${pad(m + 1)}-${pad(day)}`, gender }
}

/** Accepts 07XXXXXXXX, 7XXXXXXXX, +947XXXXXXXX, 947XXXXXXXX → returns 07XXXXXXXX or null. */
export function normaliseSlMobile(raw: string): string | null {
  const d = raw.replace(/[\s()-]/g, '')
  const m = d.match(/^(?:\+?94|0)?(7\d{8})$/)
  return m ? `0${m[1]}` : null
}

/** IRD stores phone numbers as 10–16 digits. */
export const phoneDigits = (v: string) => v.replace(/\D/g, '')
const isPhone = (v: string) => /^\d{10,16}$/.test(phoneDigits(v)) && /^[+\d\s()-]+$/.test(v.trim())
const today = () => new Date().toISOString().slice(0, 10)
const URL_RE = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i

export function validateStep(step: StepId, f: FormState, files: FileMeta[]): Errors {
  const e: Errors = {}
  const entity = entityByKey(f.entityType)
  const req = (key: keyof FormState, msg: string) => {
    const v = f[key]
    if (Array.isArray(v) ? !v.length : typeof v === 'string' ? !v.trim() : !v) e[key] = msg
  }
  const max = (key: keyof FormState, n: number) => {
    const v = f[key]
    if (typeof v === 'string' && v.length > n && !e[key]) e[key] = `Keep this under ${n} characters.`
  }
  const name = (key: keyof FormState) => {
    const v = f[key] as string
    if (v && !NAME.test(v)) e[key] = 'Commas are not allowed in names.'
    max(key, 100)
  }

  if (step === 'type') {
    if (!entity) e.entityType = 'Choose who you are registering.'
    return e
  }
  if (!entity) return e

  if (step === 'details') {
    if (entity.kind === 'individual') {
      if (entity.key === 'individual') {
        const nic = normaliseNic(f.nic)
        if (!nic) e.nic = 'Enter your NIC number.'
        else if (!isNic(nic)) e.nic = 'NIC must be 9 digits followed by V or X (e.g. 851234567V), or 12 digits.'
        else if (!parseNic(nic)) e.nic = 'This NIC number is not valid — please check the digits.'
      } else {
        req('passportNo', 'Enter your passport number.')
        if (f.passportNo && !/^[A-Za-z0-9]{5,15}$/.test(f.passportNo.trim())) e.passportNo = 'Passport number should be 5–15 letters or digits.'
        req('passportCountry', 'Choose the issuing country.')
      }
      req('salutation', 'Choose a title.')
      req('fullName', 'Enter your full name as shown on your ID.')
      if (f.fullName && !LATIN_NAME.test(f.fullName.trim())) e.fullName = 'Use English letters, spaces, dots, apostrophes or hyphens only.'
      max('fullName', 100)
      req('nameWithInitials', 'Enter your name with initials.')
      if (f.nameWithInitials && !LATIN_NAME.test(f.nameWithInitials.trim())) e.nameWithInitials = 'Use English letters, spaces, dots, apostrophes or hyphens only.'
      max('nameWithInitials', 100)
      ;(['fullNameSi', 'fullNameTa', 'nameWithInitialsSi', 'nameWithInitialsTa'] as const).forEach(name)

      req('dob', 'Enter your date of birth.')
      if (f.dob && f.dob > today()) e.dob = 'Date of birth cannot be in the future.'
      if (f.dob && f.dob < '1900-01-01') e.dob = 'Check the year.'
      req('gender', 'Choose an option.')
      req('birthCountry', 'Choose your country of birth.')
      req('citizenship', 'Choose your citizenship.')
      req('dualCitizenship', 'Choose an option.')
      if (f.dualCitizenship === 'Y') req('dualCountry', 'Choose the other country of citizenship.')
      req('residentStatus', 'Choose your residency status.')

      req('incomeSources', 'Choose at least one source of income.')
      if (f.incomeSources.includes(INCOME_OTHER)) req('incomeOther', 'Tell us your other source of income.')
      max('incomeOther', 100)
      req('profession', 'Choose your profession, or “Not applicable”.')
      if (f.profession === PROFESSION_OTHER) req('professionOther', 'Tell us your profession.')
      max('professionOther', 100)

      f.businesses.forEach((b) => {
        const k = (x: string) => `businesses.${b.id}.${x}`
        if (!b.name.trim()) e[k('name')] = 'Enter the business name.'
        if (!b.regNo.trim()) e[k('regNo')] = 'Enter the registration number.'
        if (!b.activity.trim()) e[k('activity')] = 'Describe the principal activity.'
        if (!b.commencementDate) e[k('commencementDate')] = 'Enter the date business started.'
        else if (b.commencementDate > today()) e[k('commencementDate')] = 'Date cannot be in the future.'
        if (!b.line1.trim()) e[k('line1')] = 'Enter the business address.'
        if (b.postalCode && !/^\d{1,10}$/.test(b.postalCode)) e[k('postalCode')] = 'Postal code must be digits only.'
      })

      req('civilStatus', 'Choose your civil status.')
      if (f.civilStatus === 'MARRIED') {
        req('spouseName', 'Enter your spouse’s name.')
        name('spouseName')
        if (f.spouseNic && !isNic(f.spouseNic)) e.spouseNic = 'Enter a valid NIC, or leave blank.'
        if (f.spouseTin && !/^\d{9}$/.test(f.spouseTin.trim())) e.spouseTin = 'TIN is 9 digits, or leave blank.'
      }
      f.children.forEach((c) => {
        const k = (x: string) => `children.${c.id}.${x}`
        if (!c.name.trim()) e[k('name')] = 'Enter the child’s name.'
        else if (!NAME.test(c.name)) e[k('name')] = 'Commas are not allowed in names.'
        if (!c.dob) e[k('dob')] = 'Enter date of birth.'
        else if (c.dob > today()) e[k('dob')] = 'Date cannot be in the future.'
        if (!c.gender) e[k('gender')] = 'Choose gender.'
        if (c.nic && !isNic(c.nic) && !/^\d{9}$/.test(c.nic.trim())) e[k('nic')] = 'Enter a valid NIC or 9-digit TIN, or leave blank.'
      })
    } else {
      req('orgName', entity.kind === 'dsp' ? 'Enter the legal business name.' : 'Enter the registered name.')
      max('orgName', 100)
      if (entity.kind === 'organisation') {
        if (entity.regNoRequired) req('regNo', `Enter the ${entity.regNoLabel?.toLowerCase()}.`)
        max('regNo', 30)
        if (!['government', 'semi_government', 'embassy'].includes(entity.key)) {
          req('incorporationDate', 'Enter the date of registration.')
          if (f.incorporationDate && f.incorporationDate > today()) e.incorporationDate = 'Date cannot be in the future.'
        }
        req('businessActivity', 'Describe the main business activity.')
      } else {
        req('dspCountry', 'Choose the country of residence.')
        req('dspWebsite', 'Enter the website or app where services are offered.')
        if (f.dspWebsite && !URL_RE.test(f.dspWebsite.trim())) e.dspWebsite = 'Enter a valid web address, e.g. example.com.'
      }
      req('contactSalutation', 'Enter how we should address correspondence, e.g. THE DIRECTOR.')
      req('contactName', 'Enter the contact person’s name.')
    }
    return e
  }

  if (step === 'contact') {
    const foreign = entity.kind === 'dsp'
    if (foreign) {
      req('foreignAddress', 'Enter the registered business address.')
    } else {
      max('premisesNo', 25)
      max('unitNo', 10)
      req('addressLine1', 'Enter the street address.')
      ;(['addressLine1', 'addressLine2', 'addressLine3'] as const).forEach((k) => max(k, 100))
      if (f.postalCode && !/^\d{1,10}$/.test(f.postalCode.trim())) e.postalCode = 'Postal code must be digits only.'
      req('province', 'Choose a province.')
      req('district', 'Choose a district.')
      req('dsDivision', 'Choose a divisional secretariat.')
      req('gnDivision', 'Choose a Grama Niladhari division.')
      if (!f.resSame) {
        max('resPremisesNo', 25)
        max('resUnitNo', 10)
        req('resLine1', 'Enter the street address.')
        ;(['resLine1', 'resLine2', 'resLine3'] as const).forEach((k) => max(k, 100))
        if (f.resPostalCode && !/^\d{1,10}$/.test(f.resPostalCode.trim())) e.resPostalCode = 'Postal code must be digits only.'
      }
    }

    req('preferredMode', 'Choose how we should contact you.')
    if (entity.kind === 'individual') req('language', 'Choose your preferred language.')

    const phones = ['mobile', 'officeNo', 'homeNo', 'faxNo'] as const
    for (const k of phones) {
      if (f[k].trim() && !isPhone(f[k])) e[k] = k === 'mobile' && !foreign ? 'Enter a mobile number, e.g. 077 123 4567.' : 'Enter 10–16 digits, including the area or country code.'
    }
    if (!f.mobile.trim() && f.preferredMode === '2') e.mobile = 'Mobile number is required because you chose SMS.'

    const emailRequired = entity.kind === 'individual' || foreign || f.preferredMode === '3'
    if (f.email.trim()) {
      if (!EMAIL.test(f.email.trim())) e.email = 'Enter a valid email address, e.g. name@example.com.'
      max('email', 100)
    } else if (emailRequired) e.email = 'Enter your email address.'

    if (!e.mobile && !e.email && !phones.some((k) => f[k].trim()) && !f.email.trim()) e.mobile = 'Give at least one contact number or email.'

    if (f.website.trim() && !URL_RE.test(f.website.trim())) e.website = 'Enter a valid web address, e.g. example.com.'
    max('website', 80)
    return e
  }

  if (step === 'purpose') {
    req('purposeCode', 'Choose the purpose of registration.')
    if (f.purposeCode === PURPOSE_OTHER && !f.purposeRemarks.trim()) e.purposeRemarks = 'Tell us the purpose of registration.'
    if (f.purposeRemarks.length > REMARKS_MAX) e.purposeRemarks = `Keep this under ${REMARKS_MAX} characters.`

    if (f.bankCode && !f.bankAccount.trim()) e.bankAccount = 'Enter the account number, or clear the bank.'
    if (!f.bankCode && f.bankAccount.trim()) e.bankCode = 'Choose the bank for this account.'
    if (f.bankAccount && !/^[\d-]{4,30}$/.test(f.bankAccount.trim())) e.bankAccount = 'Account number should be digits only.'

    for (const doc of entity.documents) {
      if (doc.required && !files.some((x) => x.docType === doc.id)) e[`doc:${doc.id}`] = `Upload: ${doc.label}.`
    }
    const total = files.reduce((n, x) => n + x.size, 0)
    if (total > FILES_TOTAL_MAX_BYTES) e['doc:total'] = 'Your files add up to more than 20 MB. Remove or compress some files.'
    if (entity.kind === 'dsp' && !f.dspConsent) e.dspConsent = 'You must give consent to continue.'
    return e
  }

  if (step === 'review') {
    if (!f.declaration) e.declaration = 'Confirm the declaration to submit.'
  }
  return e
}

export const STEP_ORDER: StepId[] = ['type', 'details', 'contact', 'purpose', 'review']

export function validateAll(f: FormState, files: FileMeta[]) {
  const byStep = {} as Record<StepId, Errors>
  for (const s of STEP_ORDER) byStep[s] = s === 'review' ? {} : validateStep(s, f, files)
  return byStep
}

const CONTACT_FIELDS = new Set([
  'premisesNo', 'unitNo', 'addressLine1', 'addressLine2', 'addressLine3', 'postalCode', 'province', 'district', 'dsDivision',
  'gnDivision', 'foreignAddress', 'resPremisesNo', 'resUnitNo', 'resLine1', 'resLine2', 'resLine3', 'resPostalCode',
  'preferredMode', 'language', 'nearestOffice', 'website', 'mobile', 'officeNo', 'homeNo', 'faxNo', 'email',
])
const PURPOSE_FIELDS = new Set(['purposeCode', 'purposeRemarks', 'dspConsent', 'bankCode', 'bankAccount'])

export function stepOfField(field: string): StepId {
  if (field === 'entityType') return 'type'
  if (field === 'declaration' || field === 'captcha') return 'review'
  if (field.startsWith('doc:') || PURPOSE_FIELDS.has(field)) return 'purpose'
  if (CONTACT_FIELDS.has(field)) return 'contact'
  return 'details'
}
