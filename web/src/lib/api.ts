// API layer. `mock` (default) runs fully in the browser so the UX can be tested end to end.
// `legacy` talks to the existing ASP.NET endpoints seen in inline-script-one.js.
// Select with VITE_API_MODE=mock|legacy.
import { DOC_TYPE, entityByKey } from './config'
import { getFile } from './draft'
import { dsOptions, gnOptions, loadGeo } from './geo'
import { normaliseNic, normaliseSlMobile, phoneDigits } from './validation'
import type { FileMeta, FormState, Option } from './types'

export interface Captcha {
  image: string // data URL or URL
  token: string // CaptchaDeText in the legacy system
}

export type SubmitResult =
  | { ok: true; referenceNo: string; submittedAt: string; irdDateTime?: string; irdHtml?: string; demo?: boolean }
  | { ok: false; message: string; fieldErrors?: Record<string, string>; captcha?: Captcha; actions?: SubmitAction[] }

export interface SubmitAction {
  label: string
  href: string
}

/** Real IRD pages (opened in a new tab). */
export const IRD_LINKS = {
  pinRequest: { label: 'Request IRD PIN', href: 'https://eservices.ird.gov.lk/Registration/PINRequest/ShowPINRequestDetail' },
  eservices: { label: 'IRD e-Services login', href: 'https://eservices.ird.gov.lk/' },
  verify: { label: 'Verify IRD registration', href: 'https://eservices.ird.gov.lk/Registration/VerifyIRDInformation/Index' },
} satisfies Record<string, SubmitAction>

export interface RegistrationApi {
  getCaptcha(): Promise<Captcha>
  getDsDivisions(district: string): Promise<Option[]>
  getGnDivisions(district: string, ds: string): Promise<Option[]>
  searchBusinessActivities(q: string): Promise<Option[]>
  submit(data: FormState, files: FileMeta[], captcha: { token: string; answer: string }): Promise<SubmitResult>
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** IRD's acknowledgement timestamp format: "2026-09-28 08:52:54 AM". */
export function irdStamp(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  const h = d.getHours() % 12 || 12
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(h)}:${p(d.getMinutes())}:${p(d.getSeconds())} ${d.getHours() < 12 ? 'AM' : 'PM'}`
}

// Business activity codes are SAMPLE data until wired to the real lookup endpoint.
const BUSINESS_ACTIVITIES: Option[] = [
  ['011100', 'Growing of cereals (except rice), leguminous crops and oil seeds'],
  ['011200', 'Growing of rice'],
  ['012700', 'Growing of beverage crops (tea, coffee, cocoa)'],
  ['101000', 'Processing and preserving of meat'],
  ['107900', 'Manufacture of other food products'],
  ['141000', 'Manufacture of wearing apparel, except fur apparel'],
  ['410000', 'Construction of buildings'],
  ['461000', 'Wholesale on a fee or contract basis'],
  ['471100', 'Retail sale in non-specialised stores with food, beverages or tobacco'],
  ['477100', 'Retail sale of clothing, footwear and leather articles'],
  ['492200', 'Other passenger land transport'],
  ['551000', 'Short term accommodation activities (hotels, guest houses)'],
  ['561000', 'Restaurants and mobile food service activities'],
  ['620100', 'Computer programming activities'],
  ['620200', 'Computer consultancy and computer facilities management'],
  ['631200', 'Web portals'],
  ['641900', 'Other monetary intermediation (banking)'],
  ['681000', 'Real estate activities with own or leased property'],
  ['691000', 'Legal activities'],
  ['692000', 'Accounting, bookkeeping and auditing; tax consultancy'],
  ['702000', 'Management consultancy activities'],
  ['731000', 'Advertising'],
  ['791100', 'Travel agency activities'],
  ['851000', 'Pre-primary and primary education'],
  ['862000', 'Medical and dental practice activities'],
  ['949900', 'Activities of other membership organisations'],
].map(([code, label]) => ({ value: `${code} - ${label}`, label: `${code} – ${label}` }))

const lookups = {
  async getDsDivisions(district: string): Promise<Option[]> {
    return dsOptions(await loadGeo(), district)
  },
  async getGnDivisions(district: string, ds: string): Promise<Option[]> {
    return gnOptions(await loadGeo(), district, ds)
  },
  async searchBusinessActivities(q: string): Promise<Option[]> {
    const s = q.trim().toLowerCase()
    return s ? BUSINESS_ACTIVITIES.filter((o) => o.label.toLowerCase().includes(s)) : BUSINESS_ACTIVITIES
  },
}

// ---------------------------------------------------------------------------
// Mock
// ---------------------------------------------------------------------------
const captchaAnswers = new Map<string, string>()

function drawCaptcha(text: string): string {
  const c = document.createElement('canvas')
  c.width = 180
  c.height = 56
  const g = c.getContext('2d')!
  g.fillStyle = '#f1f5f4'
  g.fillRect(0, 0, c.width, c.height)
  for (let i = 0; i < 6; i++) {
    g.strokeStyle = `hsl(${Math.random() * 360} 40% 60% / .6)`
    g.beginPath()
    g.moveTo(Math.random() * 180, Math.random() * 56)
    g.bezierCurveTo(Math.random() * 180, Math.random() * 56, Math.random() * 180, Math.random() * 56, Math.random() * 180, Math.random() * 56)
    g.stroke()
  }
  g.font = 'bold 30px ui-monospace, monospace'
  g.textBaseline = 'middle'
  ;[...text].forEach((ch, i) => {
    g.save()
    g.translate(22 + i * 28, 28 + (Math.random() * 10 - 5))
    g.rotate((Math.random() - 0.5) * 0.5)
    g.fillStyle = `hsl(${170 + Math.random() * 60} 50% 25%)`
    g.fillText(ch, 0, 0)
    g.restore()
  })
  return c.toDataURL()
}

const mockApi: RegistrationApi = {
  ...lookups,
  async getCaptcha() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const text = Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
    const token = crypto.randomUUID()
    captchaAnswers.set(token, text)
    return { image: drawCaptcha(text), token }
  },
  async submit(data, _files, captcha): Promise<SubmitResult> {
    await delay(1200)
    const expected = captchaAnswers.get(captcha.token)
    captchaAnswers.delete(captcha.token)
    if (!expected || expected !== captcha.answer.trim().toUpperCase()) {
      return {
        ok: false,
        message: 'The security code didn’t match. A new code has been generated — your details are untouched.',
        fieldErrors: { captcha: 'Code didn’t match. Try the new one.' },
        captcha: await mockApi.getCaptcha(),
      }
    }
    // Demo of a server-side business rule mapped back onto a field.
    if (normaliseNic(data.nic) === '200000000001') {
      return {
        ok: false,
        message: 'A TIN is already registered for this NIC.',
        fieldErrors: { nic: 'IRD already has a TIN for this applicant, so there’s no need to register again.' },
        actions: [IRD_LINKS.pinRequest, IRD_LINKS.eservices],
        captcha: await mockApi.getCaptcha(),
      }
    }
    const ref = `DEMO-${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`
    return { ok: true, referenceNo: ref, submittedAt: new Date().toISOString(), irdDateTime: irdStamp(new Date()), demo: true }
  },
}

// ---------------------------------------------------------------------------
// Legacy ASP.NET backend adapter.
// Flow mirrors the old page: CreateRegistrationType → SaveToShowSummaryRequest → SaveRequest.
// Field names marked CONFIRMED appear in the scraped sources; the rest are
// best guesses following the same naming pattern and MUST be checked against
// the server's view models before going live.
// ---------------------------------------------------------------------------
const LEGACY_PAGE = import.meta.env.VITE_LEGACY_PAGE ?? '/Registration/TINRegistration/ShowRequestHeader'

let legacyToken = ''
/** Safety: live mode stops after IRD validation unless explicitly enabled. */
const LIVE_FINAL = import.meta.env.VITE_LEGACY_FINAL === 'true'

async function legacyPage(): Promise<{ captcha: Captcha; token: string }> {
  const html = await (await fetch(LEGACY_PAGE, { credentials: 'include' })).text()
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return {
    captcha: {
      image: doc.querySelector<HTMLImageElement>('#CaptchaImage')?.getAttribute('src') ?? '',
      token: doc.querySelector<HTMLInputElement>('#CaptchaDeText')?.value ?? '',
    },
    token: doc.querySelector<HTMLInputElement>('input[name="__RequestVerificationToken"]')?.value ?? '',
  }
}

// Field names below marked ✓ were captured from the live INDIVIDUAL LOCAL form
// (../ird-reference/form-individual-local.json). Others are TODO until those forms are captured.
function legacyFields(f: FormState): Record<string, string> {
  const P = 'TaxpayerDetail.'
  const entity = entityByKey(f.entityType)!
  const out: Record<string, string> = {
    EntityCode: entity.legacyCode, // ✓
    IsCGT: 'False', // ✓
    'CGTConfirmationModel.CumaltiveCapitalGain': 'False', // ✓
    'CGTConfirmationModel.CapitalGain': 'False', // ✓
    [`${P}IntranetRegistrationCommonModel.RegistrationPurposeCode`]: f.purposeCode, // ✓
    [`${P}IntranetRegistrationCommonModel.OtherRegistrationPurpose`]: f.purposeRemarks, // ✓
  }
  const set = (prefix: string, o: Record<string, string>) => Object.entries(o).forEach(([k, v]) => (out[prefix + k] = v))
  const addr = (prefix: string, a: { premises: string; unit: string; l1: string; l2: string; l3: string; postal: string }) =>
    set(prefix, { PremisesNo: a.premises, UnitNo: a.unit, StreetName1: a.l1, StreetName2: a.l2, StreetName3: a.l3, PostalCode: a.postal })

  if (entity.kind !== 'dsp') {
    set(`${P}AdditionalCityAddressModel.`, { // ✓ (IRD codes)
      ProvinceCode: f.province, DistrictCode: f.district, DivisionalSecretariatCode: f.dsDivision, GramaNiladhariDivisionsCode: f.gnDivision,
    })
  }

  if (entity.key === 'individual') {
    const M = `${P}IndividualLocalModel.` // ✓
    const I = `${M}TaxpayerIndividualModel.` // ✓
    set(I, {
      EntityIdCode: '2', // NIC
      EntityId: normaliseNic(f.nic),
      FullName: f.fullName.toUpperCase(),
      FullNameSinhala: f.fullNameSi,
      FullNameTamil: f.fullNameTa,
      NameWithInitialsCode: f.salutation,
      NameWithInitials: f.nameWithInitials.toUpperCase(),
      NameWithInitialsSinhala: f.nameWithInitialsSi,
      NameWithInitialsTamil: f.nameWithInitialsTa,
      BirthDate: f.dob, // TODO confirm date format expected by the model binder
      BirthCountryCode: f.birthCountry,
      GenderCode: f.gender,
      PreferredLanguageCode: f.language,
      PreferredModeCommunicationCode: f.preferredMode,
      WebsiteURL: f.website.trim(),
      ResidentStatus: f.residentStatus,
      Citizenship: f.citizenship,
      DualCitizenship: f.dualCitizenship,
      DualCitizenCountry: f.dualCitizenship === 'Y' ? f.dualCountry : '',
      OtherSourceOfIncome: f.incomeOther,
      Profession: f.profession,
      ProfessionOther: f.professionOther,
      NearestOffice: f.nearestOffice,
    })
    out[`${I}SourceofIncome`] = f.incomeSources.join(',') // ✓ name; multi-value checkbox — send as repeated keys in FormData
    addr(`${M}TaxpayerOfficialAddressModel.`, { premises: f.premisesNo, unit: f.unitNo, l1: f.addressLine1, l2: f.addressLine2, l3: f.addressLine3, postal: f.postalCode })
    const res = f.resSame
      ? { premises: f.premisesNo, unit: f.unitNo, l1: f.addressLine1, l2: f.addressLine2, l3: f.addressLine3, postal: f.postalCode }
      : { premises: f.resPremisesNo, unit: f.resUnitNo, l1: f.resLine1, l2: f.resLine2, l3: f.resLine3, postal: f.resPostalCode }
    addr(`${P}TaxpayerRegisteredAddressModel.`, res)
    set(`${M}TaxpayerContactModel.`, {
      MobileNo: phoneDigits(normaliseSlMobile(f.mobile) ?? f.mobile),
      OfficeNo: phoneDigits(f.officeNo),
      HomeNo: phoneDigits(f.homeNo),
      FaxNo: phoneDigits(f.faxNo),
      Email: f.email.trim(),
    })
    set(`${P}TaxpayerBankModel.`, { BankNameCode: f.bankCode, BankAccount: f.bankAccount })
    set(`${M}FamilyModel.`, {
      MarriedIN: f.civilStatus,
      SpouseName: f.civilStatus === 'MARRIED' ? f.spouseName.toUpperCase() : '',
      SpouseNIC: f.civilStatus === 'MARRIED' ? normaliseNic(f.spouseNic) : '',
      SpouseTIN: f.civilStatus === 'MARRIED' ? f.spouseTin : '',
    })
    // Child / business rows are serialised by TPRJsonToInputArray in the old page — TODO confirm index format.
    f.children.forEach((c, i) => set(`${M}FamilyModel.ChildList[${i}].`, { Name: c.name.toUpperCase(), NIC: c.nic, BirthDate: c.dob, GenderCode: c.gender, IsNew: 'True' }))
    f.businesses.forEach((b, i) => {
      const B = `${M}IndividualBusinessList[${i}].`
      set(B, { BusinessName: b.name, BRNo: b.regType, RegistrationNo: b.regNo, CommencementDate: b.commencementDate, IsNew: 'True' })
      out[`${B}BusinessActivityModelWindow.BusinessActivityDesc`] = b.activity.toUpperCase()
      addr(`${B}AddressModel.`, { premises: '', unit: '', l1: b.line1, l2: b.line2, l3: b.line3, postal: b.postalCode })
    })
  } else if (entity.kind === 'dsp') {
    out[`${P}NonResidentDSPModel.Consent`] = f.dspConsent ? 'true' : 'false' // ✓
    set(`${P}NonResidentDSPModel.`, { Country: f.dspCountry, Website: f.dspWebsite, Address: f.foreignAddress }) // TODO confirm
    set(`${P}NonResidentDSPModel.TaxpayerCompanyContactModel.`, { MobileNo: phoneDigits(f.mobile), Email: f.email.trim() }) // prefix seen in inline-script-one.js
  } else {
    // Organisation & foreign individual forms not captured yet — TODO confirm.
    const O = `${P}NonIndividualModel.`
    set(O, {
      Name: f.orgName.toUpperCase(), RegistrationNo: f.regNo, DateOfIncorporation: f.incorporationDate,
      NameWithInitialsCode: f.contactSalutation, ContactPersonName: f.contactName, PrincipalActivity: f.businessActivity.toUpperCase(),
      FullName: f.fullName.toUpperCase(), PassportNo: f.passportNo.toUpperCase(), PassportCountry: f.passportCountry,
    })
    addr(`${O}TaxpayerOfficialAddressModel.`, { premises: f.premisesNo, unit: f.unitNo, l1: f.addressLine1, l2: f.addressLine2, l3: f.addressLine3, postal: f.postalCode })
    set(`${O}TaxpayerContactModel.`, { MobileNo: phoneDigits(f.mobile), OfficeNo: phoneDigits(f.officeNo), FaxNo: phoneDigits(f.faxNo), Email: f.email.trim() })
  }
  return out
}

const legacyApi: RegistrationApi = {
  ...lookups,
  async getCaptcha() {
    const { captcha, token } = await legacyPage()
    legacyToken = token
    return captcha
  },
  async submit(data, files, captcha): Promise<SubmitResult> {
    const log = (...a: unknown[]) => console.info('[TIN live]', ...a)
    try {
      const entity = entityByKey(data.entityType)!
      // 1. Create registration type — IRD verifies the captcha here and returns the entity form partial.
      const r1 = await fetch('/Registration/TINRegistration/CreateRegistrationType', {
        method: 'POST',
        credentials: 'include',
        body: new URLSearchParams({
          entityCode: entity.legacyCode, isCGT: 'False', CaptchaInputText: captcha.answer, CaptchaDeText: captcha.token,
          __RequestVerificationToken: legacyToken,
        }),
      })
      const t1 = await r1.text()
      log('CreateRegistrationType', r1.status, t1.length, 'chars')
      try {
        const j = JSON.parse(t1)
        const msg = j?.ErrorMessage ?? j?.Message
        if (msg) return { ok: false, message: `IRD: ${msg}`, fieldErrors: { captcha: String(msg) }, captcha: await legacyApi.getCaptcha() }
      } catch {
        /* HTML partial = success */
      }
      if (!r1.ok) return { ok: false, message: `IRD returned HTTP ${r1.status} at the captcha step.`, captcha: await legacyApi.getCaptcha() }
      // A real entity form contains TaxpayerDetail.* inputs; anything else is IRD refusing (usually a wrong captcha).
      if (!/name="TaxpayerDetail\./.test(t1)) {
        const text = new DOMParser().parseFromString(t1, 'text/html').body.innerText.replace(/\s+/g, ' ').trim().slice(0, 200)
        log('CreateRegistrationType refused:', text)
        return {
          ok: false,
          message: 'IRD didn’t accept the security code. A new code has been loaded — your details are untouched.',
          fieldErrors: { captcha: 'Code didn’t match. Try the new one.' },
          captcha: await legacyApi.getCaptcha(),
        }
      }

      // Start from every default the IRD partial renders (hidden flags, prefixes…), then overlay our answers.
      const body = new URLSearchParams()
      const partial = new DOMParser().parseFromString(t1, 'text/html')
      partial.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input[name],select[name],textarea[name]').forEach((el) => {
        if (el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox') && !el.checked) return
        if (el instanceof HTMLInputElement && el.type === 'file') return
        body.append(el.name, el.value)
      })
      const outer: Record<string, string> = {
        EntityCode: entity.legacyCode, CaptchaInputText: captcha.answer, CaptchaDeText: captcha.token, __RequestVerificationToken: legacyToken,
      }
      const fields = { ...legacyFields(data), ...outer }
      for (const [k, v] of Object.entries(fields)) {
        body.delete(k)
        if (k.endsWith('.SourceofIncome')) v.split(',').filter(Boolean).forEach((x) => body.append(k, x))
        else body.append(k, v)
      }
      log('payload keys', [...new Set(body.keys())].length)

      // 2. Validation + summary. Nothing is registered at this step.
      const r2raw = await fetch('/Registration/TINRegistration/SaveToShowSummaryRequest', { method: 'POST', credentials: 'include', body })
      const t2 = await r2raw.text()
      log('SaveToShowSummaryRequest', r2raw.status, t2.slice(0, 500))
      let r2: { HasError?: boolean; ErrorMessage?: unknown; data?: unknown } | null = null
      try {
        r2 = JSON.parse(t2)
      } catch {
        return { ok: false, message: `IRD returned an unexpected response at the validation step (HTTP ${r2raw.status}). See the browser console.` }
      }
      if (r2?.HasError) {
        const msg = Array.isArray(r2.ErrorMessage) ? r2.ErrorMessage.join(' ') : String(r2.ErrorMessage)
        const fieldErrors: Record<string, string> = {}
        if (/registered in IRD/i.test(msg)) {
          const who = entity.kind === 'individual' ? (entity.key === 'individual' ? 'nic' : 'passportNo') : 'regNo'
          fieldErrors[who] = 'IRD already has a TIN for this applicant, so there’s no need to register again.'
          return {
            ok: false,
            message: 'IRD says this applicant is already registered. To see the TIN, request an IRD PIN and log in to e-Services, or contact your nearest IRD regional office.',
            fieldErrors,
            actions: [IRD_LINKS.pinRequest, IRD_LINKS.eservices],
            captcha: await legacyApi.getCaptcha(),
          }
        }
        // IRD captchas are single-use: always hand back a fresh one.
        return { ok: false, message: `IRD: ${msg}`, fieldErrors, captcha: await legacyApi.getCaptcha() }
      }

      if (!LIVE_FINAL) {
        return {
          ok: false,
          message: 'Dry run: IRD accepted these details at the validation step. The final submission was NOT sent (set VITE_LEGACY_FINAL=true to enable it).',
        }
      }

      // 3. Final submit with documents.
      const fd = new FormData()
      for (const [k, v] of body.entries()) fd.append(k, v)
      for (const f of files) {
        const blob = await getFile(f.id)
        const sub = entity.documents.find((d) => d.id === f.docType)?.subType ?? '10001'
        // ✓ FuncTPR001B1_0: input name = "TPR001B1_<docType>_<subType>"
        if (blob) fd.append(`TPR001B1_${DOC_TYPE}_${sub}`, blob, f.name)
      }
      const r3 = await (await fetch('/Registration/TINRegistration/SaveRequest', { method: 'POST', credentials: 'include', body: fd })).json()
      log('SaveRequest', r3)
      if (r3?.HasError) {
        return {
          ok: false,
          message: `IRD: ${String(r3.ErrorMessage)}`,
          captcha: r3.Captcha ? { image: r3.Captcha.CaptchaImage, token: r3.Captcha.CaptchaDeText } : undefined,
        }
      }
      // r3.data is IRD's acknowledgement HTML (the old page injected it and printed it to PDF).
      const irdHtml = String(r3.data ?? '')
      const text = new DOMParser().parseFromString(irdHtml, 'text/html').body.innerText.replace(/\s+/g, ' ')
      const ackNo = /Acknowledgement\s*No\s*\.?\s*:?\s*(\d{5,})/i.exec(text)?.[1]
      const dateTime = /Date\s*\/\s*Time\s*:?\s*(\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}(?::\d{2})?\s*[AP]M)/i.exec(text)?.[1]
      log('acknowledgement', { ackNo, dateTime })
      return {
        ok: true,
        referenceNo: ackNo ?? 'See IRD acknowledgement',
        submittedAt: new Date().toISOString(),
        irdDateTime: dateTime ?? irdStamp(new Date()),
        irdHtml,
      }
    } catch (err) {
      console.error('[TIN live]', err)
      return { ok: false, message: navigator.onLine ? 'We couldn’t reach IRD. Your details are saved — please try again.' : 'You’re offline. Your details are saved — submit again once you’re back online.' }
    }
  },
}

export const api: RegistrationApi = import.meta.env.VITE_API_MODE === 'legacy' ? legacyApi : mockApi
export const isMock = import.meta.env.VITE_API_MODE !== 'legacy'
