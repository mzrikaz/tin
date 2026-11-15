// Static reference data for the TIN registration flow.
// Real IRD (RAMIS) values come from src/data/ird-lookups.json, scraped from
// eservices.ird.gov.lk on 2026-11-15 (raw captures in ../ird-reference/).
import L from '../data/ird-lookups.json'
import type { Option } from './types'

export type EntityKind = 'individual' | 'organisation' | 'dsp'

export interface DocumentType {
  /** Unique key within an entity. */
  id: string
  /** IRD DMS sub-document type (GetSubDocumentTypeByCriteria, doc type 100). */
  subType: string
  label: string
  hint?: string
  required: boolean
}

export interface EntityType {
  key: string
  kind: EntityKind
  label: string
  description: string
  /** EntityCode from /Registration/TPRCommon/GetEntityCodeForCGTAndNonCGT. */
  legacyCode: string
  /** Show in the first block of the picker; the rest sit behind "More types". */
  common?: boolean
  regNoLabel?: string
  regNoRequired?: boolean
  documents: DocumentType[]
}

// IRD DMS sub-types: 10002 NATIONAL IDENTITY CARD, 10006 CERTIFICATION, 10001 OTHER SUPPORTING DOCUMENTS.
export const DOC_TYPE = L.docType
const NIC_DOC: DocumentType = { id: 'nic', subType: '10002', label: 'Copy of NIC (both sides)', hint: 'Clear scan or photo of the front and back.', required: true }
const PASSPORT_DOC: DocumentType = { id: 'passport', subType: '10001', label: 'Copy of passport (bio-data page)', required: true }
const OTHER_DOC: DocumentType = { id: 'other', subType: '10001', label: 'Other supporting documents', hint: 'E.g. an authorisation letter if someone is applying on your behalf.', required: false }
const cert = (label: string, required = true): DocumentType => ({ id: `cert-${label.toLowerCase().replace(/\W+/g, '-')}`, subType: '10006', label, required })

const org = (
  key: string, legacyCode: string, label: string, description: string,
  regNoLabel: string, regNoRequired: boolean, docs: DocumentType[], common = false,
): EntityType => ({ key, kind: 'organisation', legacyCode, label, description, regNoLabel, regNoRequired, documents: [...docs, OTHER_DOC], common })

export const ENTITY_TYPES: EntityType[] = [
  {
    key: 'individual', legacyCode: '1', kind: 'individual', common: true,
    label: 'Individual', description: 'Sri Lankan with an NIC, including sole proprietors.',
    documents: [NIC_DOC, OTHER_DOC],
  },
  {
    key: 'individual_foreign', legacyCode: '2', kind: 'individual', common: true,
    label: 'Foreign individual', description: 'Non-citizen identified by passport.',
    documents: [PASSPORT_DOC, OTHER_DOC],
  },
  org('company', '3', 'Registered company', 'Company registered with the Registrar of Companies.', 'Company registration number', true,
    [cert('Certificate of incorporation'), cert('Form 20 / list of directors'), { ...NIC_DOC, id: 'dir-nic', label: 'NIC copy of the signing director' }], true),
  org('partnership', '4', 'Partnership', 'Two or more partners carrying on business together.', 'Business registration number', true,
    [cert('Business registration certificate'), { ...NIC_DOC, id: 'partner-nic', label: 'NIC copies of partners' }], true),
  org('foreign_company', '17', 'Foreign company', 'Company incorporated outside Sri Lanka.', 'Registration number (Sri Lanka)', true, [cert('Certificate of registration')], true),
  org('association', '8', 'Association / club', 'Clubs, societies and other associations.', 'Registration number (if any)', false, [cert('Constitution / rules')], true),
  org('trust', '12', 'Trust', 'Trusts and similar arrangements.', 'Trust deed number', false, [cert('Trust deed')]),
  org('ngo', '5', 'NGO', 'Non-governmental organisation.', 'NGO registration number', true, [cert('NGO registration certificate')]),
  org('charity', '6', 'Charity', 'Approved charitable institution.', 'Registration number', true, [cert('Registration certificate')]),
  org('coop', '7', 'Co-operative society', 'Registered co-operative.', 'Co-op registration number', true, [cert('Registration certificate')]),
  org('branch', '18', 'Branch', 'Branch of a local or foreign entity.', 'Registration number', true, [cert('Registration certificate')]),
  org('joint_venture', '13', 'Joint venture', 'Joint venture between two or more parties.', 'Agreement / registration number', false, [cert('Joint venture agreement')]),
  org('government', '9', 'Government institution', 'Ministries, departments and statutory bodies.', 'Gazette / Act reference (if any)', false, [cert('Letter from head of institution')]),
  org('semi_government', '10', 'Semi-government institution', 'Corporations and boards partly owned by the state.', 'Gazette / Act reference (if any)', false, [cert('Letter from head of institution')]),
  org('provident_fund', '11', 'Provident fund', 'Approved provident or pension funds.', 'Fund registration number', false, [cert('Approval / registration letter')]),
  org('embassy', '15', 'Embassy / high commission', 'Diplomatic missions in Sri Lanka.', 'Reference number (if any)', false, [cert('Letter from the mission')]),
  org('project', '14', 'Project', 'Funded projects requiring a separate TIN.', 'Project reference (if any)', false, [cert('Project approval letter')]),
  org('other', '19', 'Other', 'Any other type of taxpayer.', 'Registration number (if any)', false, [cert('Registration / constitution document')]),
  {
    key: 'dsp', legacyCode: '21', kind: 'dsp', common: true,
    label: 'Non-resident digital service provider', description: 'Overseas business supplying digital services to Sri Lankan customers.',
    documents: [],
  },
]
// Not offered yet: 20 INDIVIDUAL CHILD (form not captured).

export const entityByKey = (key: string) => ENTITY_TYPES.find((e) => e.key === key)

const title = (s: string) => s.toLowerCase().replace(/(^|[\s(\-&/.])([a-z])/g, (_, a, b) => a + b.toUpperCase())
const pairs = (xs: string[][], keepCase = false): Option[] => xs.map(([value, label]) => ({ value, label: keepCase ? label : title(label) }))

// From form.html (TaxpayerDetail.IntranetRegistrationCommonModel.RegistrationPurposeCode)
export const PURPOSES = [
  { value: '1', label: 'Tax purpose' },
  { value: '2', label: 'Clearing the goods from customs' },
  { value: '3', label: 'Export registration process' },
  { value: '4', label: 'Freight forwarding and clearing agents' },
  { value: '5', label: 'Stamp duty payment' },
  { value: '6', label: 'Income tax clearance' },
  { value: '7', label: 'Government regulations' },
  { value: '8', label: 'Non-resident digital service provider' },
  { value: '999', label: 'Other (please specify)' },
]
export const PURPOSE_OTHER = '999'
export const REMARKS_MAX = 500

// IRD: 3 EMAIL, 1 MAIL, 2 SMS
export const COMM_MODES = [
  { value: '3', label: 'Email', hint: 'Fastest. We email your TIN certificate.' },
  { value: '2', label: 'SMS', hint: 'Updates by text message.' },
  { value: '1', label: 'Post', hint: 'Letters to your permanent address.' },
]

const SAL_ORDER = ['1', '2', '3', '6', '5', '10', '7', '13', '14', '4', '8', '12', '9', '11']
export const SALUTATIONS: Option[] = SAL_ORDER.map((v) => {
  const raw = L.salutations.find(([c]) => c === v)![1]
  return { value: v, label: raw === 'THE HON' ? 'The Hon.' : raw.length <= 4 ? raw[0] + raw.slice(1).toLowerCase() : title(raw) }
})
export const GENDERS: Option[] = [{ value: '1', label: 'Male' }, { value: '2', label: 'Female' }]
export const LANGUAGES: Option[] = pairs(L.languages)
export const CITIZENSHIP: Option[] = pairs(L.citizenship)
export const RESIDENT_STATUS: Option[] = pairs([...L.residentStatus].sort((a, b) => a[0].localeCompare(b[0])))
export const YES_NO: Option[] = [{ value: 'Y', label: 'Yes' }, { value: 'N', label: 'No' }]
export const CIVIL_STATUS: Option[] = [{ value: 'SINGLE', label: 'Single' }, { value: 'MARRIED', label: 'Married' }]
export const INCOME_SOURCES: Option[] = pairs(L.sourceOfIncome)
export const INCOME_OTHER = '999'
export const PROFESSIONS: Option[] = pairs(L.professions).sort((a, b) =>
  a.value === '13' ? 1 : b.value === '13' ? -1 : a.value === '12' ? 1 : b.value === '12' ? -1 : a.label.localeCompare(b.label))
export const PROFESSION_OTHER = '12'
export const BANKS: Option[] = pairs(L.banks)
export const NEAREST_OFFICES: Option[] = pairs(L.nearestOffices).sort((a, b) => a.label.localeCompare(b.label))
export const COUNTRIES: Option[] = pairs(L.countries)
export const SRI_LANKA = '144'
export const ORG_SALUTATIONS: Option[] = L.orgSalutations.map((s) => ({ value: s, label: s }))
// Registration number types for individual businesses (EntityIdCode list).
export const BIZ_REG_TYPES: Option[] = [
  { value: '5', label: 'Business registration (BR)' },
  { value: '4', label: 'Company registration (ROC)' },
  { value: '1', label: 'TIN' },
  { value: '22', label: 'Other' },
]

// IRD DMS rules (FuncTPR001B1_0): ≤10 MB per file, ≤20 MB total, these extensions.
export const FILE_EXTS = ['pdf', 'jpg', 'jpeg', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv']
/** Picked images in these formats are converted to JPEG automatically. */
export const CONVERTIBLE_EXTS = ['png', 'webp', 'gif', 'bmp']
export const FILE_ACCEPT = [...FILE_EXTS, ...CONVERTIBLE_EXTS].map((e) => `.${e}`).join(',') + ',image/*'
export const FILE_MAX_BYTES = 10 * 1024 * 1024
export const FILES_TOTAL_MAX_BYTES = 20 * 1024 * 1024
