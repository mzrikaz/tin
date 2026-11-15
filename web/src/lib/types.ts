export interface Option {
  value: string
  label: string
}

export interface FileMeta {
  id: string
  /** DocumentType.id within the entity. */
  docType: string
  name: string
  size: number
  type: string
  /** Set when the file was converted (e.g. PNG → JPEG) or renamed for IRD. */
  note?: string
}

export interface Child {
  id: string
  name: string
  nic: string
  dob: string
  gender: string
}

export interface Business {
  id: string
  name: string
  regType: string
  regNo: string
  activity: string
  commencementDate: string
  line1: string
  line2: string
  line3: string
  postalCode: string
}

export interface FormState {
  entityType: string

  // Individual — identity
  salutation: string
  fullName: string
  fullNameSi: string
  fullNameTa: string
  nameWithInitials: string
  nameWithInitialsSi: string
  nameWithInitialsTa: string
  showOtherLanguages: boolean
  nic: string
  passportNo: string
  passportCountry: string
  dob: string
  dobFromNic: boolean
  gender: string
  birthCountry: string
  citizenship: string
  dualCitizenship: string
  dualCountry: string
  residentStatus: string

  // Individual — income
  incomeSources: string[]
  incomeOther: string
  profession: string
  professionOther: string
  businesses: Business[]

  // Individual — family
  civilStatus: string
  spouseName: string
  spouseNic: string
  spouseTin: string
  children: Child[]

  // Organisation
  orgName: string
  regNo: string
  incorporationDate: string
  contactSalutation: string
  contactName: string
  businessActivity: string

  // Non-resident DSP
  dspCountry: string
  dspTaxId: string
  dspWebsite: string
  dspConsent: boolean

  // Permanent address (TaxpayerOfficialAddressModel)
  premisesNo: string
  unitNo: string
  addressLine1: string
  addressLine2: string
  addressLine3: string
  postalCode: string
  province: string
  district: string
  dsDivision: string
  gnDivision: string
  foreignAddress: string

  // Residential address (TaxpayerRegisteredAddressModel)
  resSame: boolean
  resPremisesNo: string
  resUnitNo: string
  resLine1: string
  resLine2: string
  resLine3: string
  resPostalCode: string

  // Contact & preferences
  preferredMode: string
  language: string
  nearestOffice: string
  website: string
  mobile: string
  officeNo: string
  homeNo: string
  faxNo: string
  email: string

  // Bank (optional)
  bankCode: string
  bankAccount: string

  // Purpose
  purposeCode: string
  purposeRemarks: string

  declaration: boolean
}

export const EMPTY_FORM: FormState = {
  entityType: '',
  salutation: '',
  fullName: '',
  fullNameSi: '',
  fullNameTa: '',
  nameWithInitials: '',
  nameWithInitialsSi: '',
  nameWithInitialsTa: '',
  showOtherLanguages: false,
  nic: '',
  passportNo: '',
  passportCountry: '',
  dob: '',
  dobFromNic: false,
  gender: '',
  birthCountry: '',
  citizenship: '',
  dualCitizenship: 'N',
  dualCountry: '',
  residentStatus: '',
  incomeSources: [],
  incomeOther: '',
  profession: '',
  professionOther: '',
  businesses: [],
  civilStatus: '',
  spouseName: '',
  spouseNic: '',
  spouseTin: '',
  children: [],
  orgName: '',
  regNo: '',
  incorporationDate: '',
  contactSalutation: '',
  contactName: '',
  businessActivity: '',
  dspCountry: '',
  dspTaxId: '',
  dspWebsite: '',
  dspConsent: false,
  premisesNo: '',
  unitNo: '',
  addressLine1: '',
  addressLine2: '',
  addressLine3: '',
  postalCode: '',
  province: '',
  district: '',
  dsDivision: '',
  gnDivision: '',
  foreignAddress: '',
  resSame: true,
  resPremisesNo: '',
  resUnitNo: '',
  resLine1: '',
  resLine2: '',
  resLine3: '',
  resPostalCode: '',
  preferredMode: '3',
  language: '1',
  nearestOffice: '',
  website: '',
  mobile: '',
  officeNo: '',
  homeNo: '',
  faxNo: '',
  email: '',
  bankCode: '',
  bankAccount: '',
  purposeCode: '',
  purposeRemarks: '',
  declaration: false,
}

/** Fields whose default value shouldn't count as "the user typed something". */
export const DEFAULTED_FIELDS: (keyof FormState)[] = ['preferredMode', 'language', 'dualCitizenship', 'resSame', 'dobFromNic', 'showOtherLanguages']

export type Errors = Partial<Record<string, string>>

export type StepId = 'type' | 'details' | 'contact' | 'purpose' | 'review'

export interface Acknowledgement {
  /** IRD "Acknowledgement No." (or DEMO-… in demo mode). */
  referenceNo: string
  submittedAt: string
  /** Date/Time exactly as IRD printed it, e.g. "2026-09-28 08:52:54 AM". */
  irdDateTime?: string
  /** IRD's own acknowledgement HTML returned by SaveRequest (live mode only). */
  irdHtml?: string
  demo?: boolean
  data: FormState
  files: FileMeta[]
}
