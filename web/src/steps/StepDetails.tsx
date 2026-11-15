import { ChevronDown, Languages, Sparkles } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from '../components/form'
import { BusinessesEditor, ChildrenEditor } from '../components/Repeaters'
import { Callout, CheckboxGroupField, ComboField, cx, DateField, Section, SegmentedField, SelectField, TextField } from '../components/ui'
import {
  CITIZENSHIP, CIVIL_STATUS, COUNTRIES, entityByKey, GENDERS, INCOME_OTHER, INCOME_SOURCES, ORG_SALUTATIONS, PROFESSION_OTHER, PROFESSIONS,
  RESIDENT_STATUS, SALUTATIONS, SRI_LANKA, YES_NO,
} from '../lib/config'
import { normaliseNic, parseNic } from '../lib/validation'

const today = new Date().toISOString().slice(0, 10)
const upper = (v: string) => v.toUpperCase()
const collapse = (v: string) => v.replace(/\s+/g, ' ').trim()
const noCommas = (v: string) => v.replace(/,/g, '')

function initialsFrom(full: string) {
  const parts = collapse(full).split(' ').filter(Boolean)
  if (parts.length < 2) return ''
  const last = parts.pop()!
  return `${parts.map((p) => p[0].toUpperCase() + '.').join(' ')} ${last[0].toUpperCase()}${last.slice(1)}`
}

function IndividualDetails({ foreign }: { foreign: boolean }) {
  const { data, patch } = useForm()
  const derived = !foreign ? parseNic(data.nic) : null
  const mismatch = derived && data.dob && !data.dobFromNic && (data.dob !== derived.dob || (data.gender && data.gender !== derived.gender))
  const suggestion = initialsFrom(data.fullName)

  // Sensible defaults for a local individual, only if the user hasn't chosen yet.
  useEffect(() => {
    const p: Parameters<typeof patch>[0] = {}
    if (!data.birthCountry && !foreign) p.birthCountry = SRI_LANKA
    if (!data.citizenship) p.citizenship = foreign ? '2' : '1'
    if (Object.keys(p).length) patch(p)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foreign])

  const onNic = (raw: string) => {
    const nic = raw.toUpperCase().replace(/[^0-9VX]/g, '').slice(0, 12)
    const p: Parameters<typeof patch>[0] = { nic }
    const d = parseNic(nic)
    if (d && (!data.dob || data.dobFromNic)) Object.assign(p, { dob: d.dob, gender: d.gender, dobFromNic: true })
    patch(p)
  }

  return (
    <div className="space-y-8">
      <Section title="Identity" description={foreign ? 'As shown on your passport.' : 'As shown on your National Identity Card.'}>
        {!foreign ? (
          <TextField
            name="nic"
            label="NIC number"
            required
            placeholder="e.g. 199012345678 or 901234567V"
            autoComplete="off"
            onValue={onNic}
            onBlurValue={normaliseNic}
            hint={derived ? <span className="inline-flex items-center gap-1 text-brand-700 dark:text-brand-300"><Sparkles className="size-3.5" /> We filled in your date of birth and gender from this.</span> : 'Old (9 digits + V/X) or new (12 digits) format.'}
            className="sm:col-span-2"
          />
        ) : (
          <>
            <TextField name="passportNo" label="Passport number" required transform={upper} autoComplete="off" />
            <ComboField name="passportCountry" label="Issuing country" required options={COUNTRIES} />
          </>
        )}
        <SelectField name="salutation" label="Title" required options={SALUTATIONS} />
        <div className="hidden sm:block" />
        <TextField name="fullName" label="Full name" required autoComplete="name" className="sm:col-span-2" transform={noCommas} onBlurValue={collapse} hint="Every name, exactly as on your ID, in English." />
        <TextField
          name="nameWithInitials"
          label="Name with initials"
          required
          className="sm:col-span-2"
          placeholder={suggestion || 'e.g. A. B. Perera'}
          transform={noCommas}
          onBlurValue={collapse}
          aside={
            !data.nameWithInitials && suggestion ? (
              <button type="button" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300" onClick={() => patch({ nameWithInitials: suggestion })}>
                Use “{suggestion}”
              </button>
            ) : undefined
          }
        />
        <div className="sm:col-span-2">
          <button
            type="button"
            onClick={() => patch({ showOtherLanguages: !data.showOtherLanguages })}
            aria-expanded={data.showOtherLanguages}
            className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"
          >
            <Languages className="size-4" /> {data.showOtherLanguages ? 'Hide' : 'Add'} name in Sinhala / Tamil <span className="font-normal text-slate-500">(optional)</span>
            <ChevronDown className={cx('size-4 transition', data.showOtherLanguages && 'rotate-180')} />
          </button>
        </div>
        {data.showOtherLanguages && (
          <>
            <TextField name="fullNameSi" label="Full name (Sinhala)" optional lang="si" transform={noCommas} className="animate-slide-up" />
            <TextField name="nameWithInitialsSi" label="Name with initials (Sinhala)" optional lang="si" transform={noCommas} className="animate-slide-up" />
            <TextField name="fullNameTa" label="Full name (Tamil)" optional lang="ta" transform={noCommas} className="animate-slide-up" />
            <TextField name="nameWithInitialsTa" label="Name with initials (Tamil)" optional lang="ta" transform={noCommas} className="animate-slide-up" />
          </>
        )}
      </Section>

      <Section title="Personal details">
        <DateField name="dob" label="Date of birth" required max={today} min="1900-01-01" />
        <SegmentedField name="gender" label="Gender" required options={GENDERS} />
        {mismatch && (
          <div className="sm:col-span-2">
            <Callout tone="warn">
              Your date of birth or gender doesn’t match your NIC (NIC suggests {derived!.dob}, {derived!.gender === '1' ? 'male' : 'female'}).{' '}
              <button type="button" className="font-semibold underline" onClick={() => patch({ dob: derived!.dob, gender: derived!.gender, dobFromNic: true })}>
                Use NIC details
              </button>
            </Callout>
          </div>
        )}
        <ComboField name="birthCountry" label="Country of birth" required options={COUNTRIES} />
        <SegmentedField name="citizenship" label="Sri Lankan citizenship" required options={CITIZENSHIP} />
        <SegmentedField name="dualCitizenship" label="Dual citizenship?" required options={YES_NO} />
        {data.dualCitizenship === 'Y' ? <ComboField name="dualCountry" label="Other country of citizenship" required options={COUNTRIES} className="animate-slide-up" /> : <div className="hidden sm:block" />}
        <SegmentedField
          name="residentStatus"
          label="Tax residency"
          required
          options={RESIDENT_STATUS}
          className="sm:col-span-2"
          hint="You’re usually resident if you stay in Sri Lanka 183 days or more in a year of assessment."
        />
      </Section>

      <Section title="Income and work">
        <CheckboxGroupField name="incomeSources" label="Sources of income" required options={INCOME_SOURCES} className="sm:col-span-2" hint="Choose all that apply." />
        {data.incomeSources.includes(INCOME_OTHER) && (
          <TextField name="incomeOther" label="Other source of income" required className="animate-slide-up sm:col-span-2" maxLength={100} />
        )}
        <ComboField name="profession" label="Profession" required options={PROFESSIONS} />
        {data.profession === PROFESSION_OTHER ? <TextField name="professionOther" label="Your profession" required maxLength={100} className="animate-slide-up" /> : <div className="hidden sm:block" />}
        {data.incomeSources.includes('1') && (
          <div className="space-y-3 sm:col-span-2">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              Registered businesses <span className="font-normal text-slate-500">(optional)</span>
            </p>
            <p className="-mt-2 text-sm text-slate-500">Add any sole-proprietor businesses registered in your name.</p>
            <BusinessesEditor />
          </div>
        )}
      </Section>

      <Section title="Family" description="Used to link related taxpayer records.">
        <SegmentedField name="civilStatus" label="Civil status" required options={CIVIL_STATUS} className="sm:col-span-2" />
        {data.civilStatus === 'MARRIED' && (
          <>
            <TextField name="spouseName" label="Spouse’s name" required className="animate-slide-up sm:col-span-2" transform={noCommas} onBlurValue={collapse} />
            <TextField name="spouseNic" label="Spouse’s NIC" optional transform={(v) => v.toUpperCase().replace(/[^0-9VX]/g, '').slice(0, 12)} className="animate-slide-up" />
            <TextField name="spouseTin" label="Spouse’s TIN" optional inputMode="numeric" transform={(v) => v.replace(/\D/g, '').slice(0, 9)} className="animate-slide-up" />
          </>
        )}
        <div className="space-y-3 sm:col-span-2">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
            Children <span className="font-normal text-slate-500">(optional)</span>
          </p>
          <ChildrenEditor />
        </div>
      </Section>
    </div>
  )
}

function OrganisationDetails() {
  const { data } = useForm()
  const entity = entityByKey(data.entityType)!
  const dsp = entity.kind === 'dsp'
  const noDate = ['government', 'semi_government', 'embassy'].includes(entity.key)
  return (
    <div className="space-y-8">
      <Section title={dsp ? 'Business' : 'Organisation'}>
        <TextField name="orgName" label={dsp ? 'Legal business name' : 'Registered name'} required className="sm:col-span-2" onBlurValue={collapse} autoComplete="organization" maxLength={100} />
        {!dsp && (
          <>
            <TextField name="regNo" label={entity.regNoLabel ?? 'Registration number'} required={entity.regNoRequired} optional={!entity.regNoRequired} transform={upper} maxLength={30} />
            {!noDate ? <DateField name="incorporationDate" label="Date of registration / incorporation" required max={today} /> : <div className="hidden sm:block" />}
            <TextField
              name="businessActivity"
              label="Principal business activity"
              required
              className="sm:col-span-2"
              placeholder="e.g. Computer programming and software development"
              hint="Describe what earns most of your income."
            />
          </>
        )}
        {dsp && (
          <>
            <ComboField name="dspCountry" label="Country of residence" required options={COUNTRIES} />
            <TextField name="dspTaxId" label="Tax ID in home country" optional transform={upper} />
            <TextField name="dspWebsite" label="Website or app" required className="sm:col-span-2" placeholder="example.com" type="url" inputMode="url" autoComplete="url" />
          </>
        )}
      </Section>
      <Section title="Correspondence" description="Who should our letters be addressed to?">
        <ComboField
          name="contactSalutation"
          label="Address letters to"
          required
          options={ORG_SALUTATIONS}
          freeText
          transform={upper}
          placeholder="e.g. THE DIRECTOR"
          hint="Choose a suggestion or type your own."
        />
        <TextField name="contactName" label="Contact person" required onBlurValue={collapse} autoComplete="name" />
      </Section>
    </div>
  )
}

export function StepDetails() {
  const { data } = useForm()
  const entity = entityByKey(data.entityType)
  if (!entity) return null
  return entity.kind === 'individual' ? <IndividualDetails foreign={entity.key === 'individual_foreign'} /> : <OrganisationDetails />
}
