import { AlertCircle, CheckCircle2, Paperclip, Pencil, RefreshCw, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatBytes } from '../components/FileUpload'
import { useForm } from '../components/form'
import { CheckboxField, cx, FieldShell } from '../components/ui'
import type { Captcha, SubmitAction } from '../lib/api'
import { ActionLinks } from '../components/ActionLinks'
import {
  BANKS, CITIZENSHIP, CIVIL_STATUS, COMM_MODES, COUNTRIES, entityByKey, GENDERS, INCOME_OTHER, INCOME_SOURCES, LANGUAGES, NEAREST_OFFICES,
  PROFESSION_OTHER, PROFESSIONS, PURPOSE_OTHER, PURPOSES, RESIDENT_STATUS, SALUTATIONS,
} from '../lib/config'
import { geoName } from '../lib/geo'
import type { Errors, FileMeta, FormState, Option, StepId } from '../lib/types'

type Row = [string, ReactNode]

const fmtDate = (d: string) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '')

const lab = (opts: Option[], v: string) => opts.find((o) => o.value === v)?.label ?? v
const joinAddr = (...xs: string[]) => xs.map((x) => x.trim()).filter(Boolean).join(', ')

export function summarise(data: FormState, files: FileMeta[]): { step: StepId; title: string; rows: Row[] }[] {
  const e = entityByKey(data.entityType)
  if (!e) return []
  let details: Row[]
  if (e.kind === 'individual') {
    const married = data.civilStatus === 'MARRIED'
    details = [
      e.key === 'individual' ? ['NIC', data.nic] : ['Passport', `${data.passportNo} (${lab(COUNTRIES, data.passportCountry)})`],
      ['Name', `${lab(SALUTATIONS, data.salutation)} ${data.fullName}`],
      ['Name with initials', data.nameWithInitials],
      ...((data.fullNameSi || data.nameWithInitialsSi) ? [['Name (Sinhala)', [data.fullNameSi, data.nameWithInitialsSi].filter(Boolean).join(' · ')] as Row] : []),
      ...((data.fullNameTa || data.nameWithInitialsTa) ? [['Name (Tamil)', [data.fullNameTa, data.nameWithInitialsTa].filter(Boolean).join(' · ')] as Row] : []),
      ['Date of birth', fmtDate(data.dob)],
      ['Gender', lab(GENDERS, data.gender)],
      ['Country of birth', lab(COUNTRIES, data.birthCountry)],
      ['Citizenship', lab(CITIZENSHIP, data.citizenship) + (data.dualCitizenship === 'Y' ? ` · dual with ${lab(COUNTRIES, data.dualCountry)}` : '')],
      ['Tax residency', lab(RESIDENT_STATUS, data.residentStatus)],
      ['Income sources', data.incomeSources.map((v) => (v === INCOME_OTHER ? `Other (${data.incomeOther})` : lab(INCOME_SOURCES, v))).join(', ')],
      ['Profession', data.profession === PROFESSION_OTHER ? data.professionOther : lab(PROFESSIONS, data.profession)],
      ...(data.businesses.length ? [['Businesses', <ul className="space-y-1">{data.businesses.map((b) => <li key={b.id}>{b.name} <span className="text-slate-500">· {b.regNo} · {b.activity}</span></li>)}</ul>] as Row] : []),
      ['Civil status', lab(CIVIL_STATUS, data.civilStatus)],
      ...(married ? [['Spouse', [data.spouseName, data.spouseNic && `NIC ${data.spouseNic}`, data.spouseTin && `TIN ${data.spouseTin}`].filter(Boolean).join(' · ')] as Row] : []),
      ...(data.children.length ? [['Children', <ul className="space-y-1">{data.children.map((c) => <li key={c.id}>{c.name} <span className="text-slate-500">· {fmtDate(c.dob)} · {lab(GENDERS, c.gender)}</span></li>)}</ul>] as Row] : []),
    ]
  } else {
    details = [
      [e.kind === 'dsp' ? 'Business name' : 'Registered name', data.orgName],
      ...(e.kind === 'organisation'
        ? ([
            [e.regNoLabel ?? 'Registration no.', data.regNo],
            ...(data.incorporationDate ? [['Registered on', fmtDate(data.incorporationDate)] as Row] : []),
            ['Business activity', data.businessActivity],
          ] as Row[])
        : ([
            ['Country', lab(COUNTRIES, data.dspCountry)],
            ['Home tax ID', data.dspTaxId],
            ['Website', data.dspWebsite],
          ] as Row[])),
      ['Letters addressed to', data.contactSalutation],
      ['Contact person', data.contactName],
    ]
  }
  const address = e.kind === 'dsp' ? data.foreignAddress : joinAddr(data.premisesNo, data.unitNo, data.addressLine1, data.addressLine2, data.addressLine3, data.postalCode)
  const area = e.kind === 'dsp' ? '' : [geoName('g', data.gnDivision), data.dsDivision && `${geoName('s', data.dsDivision)} DS`, data.district && `${geoName('d', data.district)} District`, data.province && `${geoName('p', data.province)} Province`].filter(Boolean).join(' · ')
  const residence = e.kind === 'individual' ? (data.resSame ? 'Same as permanent address' : joinAddr(data.resPremisesNo, data.resUnitNo, data.resLine1, data.resLine2, data.resLine3, data.resPostalCode)) : ''
  const purpose = PURPOSES.find((p) => p.value === data.purposeCode)?.label ?? ''
  return [
    { step: 'type', title: 'Registering as', rows: [['Taxpayer type', e.label]] },
    { step: 'details', title: e.kind === 'individual' ? 'Personal details' : 'Organisation details', rows: details },
    {
      step: 'contact',
      title: 'Address & contact',
      rows: [
        ['Address', <span className="whitespace-pre-line">{address}</span>],
        ...(area ? [['Area', area] as Row] : []),
        ...(residence ? [['Residence', residence] as Row] : []),
        ['Email', data.email],
        ['Mobile', data.mobile],
        ...(data.officeNo ? [['Office', data.officeNo] as Row] : []),
        ...(data.homeNo ? [['Home', data.homeNo] as Row] : []),
        ...(data.faxNo ? [['Fax', data.faxNo] as Row] : []),
        ...(data.website ? [['Website', data.website] as Row] : []),
        ['Contact by', COMM_MODES.find((m) => m.value === data.preferredMode)?.label ?? ''],
        ...(e.kind === 'individual' ? [['Language', lab(LANGUAGES, data.language)] as Row] : []),
        ...(data.nearestOffice ? [['Nearest office', lab(NEAREST_OFFICES, data.nearestOffice)] as Row] : []),
      ],
    },
    {
      step: 'purpose',
      title: 'Purpose & documents',
      rows: [
        ['Purpose', data.purposeCode === PURPOSE_OTHER ? `Other — ${data.purposeRemarks}` : purpose],
        ...(data.bankCode ? [['Bank', `${lab(BANKS, data.bankCode)} · ${data.bankAccount}`] as Row] : []),
        ...(e.documents.length
          ? ([
              [
                'Documents',
                files.length ? (
                  <ul className="space-y-1">
                    {files.map((f) => (
                      <li key={f.id} className="flex min-w-0 items-center gap-1.5">
                        <Paperclip className="size-3.5 shrink-0 text-slate-400" />
                        <span className="truncate">{f.name}</span>
                        <span className="shrink-0 text-xs text-slate-500">· {e.documents.find((d) => d.id === f.docType)?.label} · {formatBytes(f.size)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  ''
                ),
              ],
            ] as Row[])
          : []),
        ...(e.kind === 'dsp' ? [['Consent', data.dspConsent ? 'Given' : '']] as Row[] : []),
      ],
    },
  ]
}

export function SummaryList({ rows }: { rows: Row[] }) {
  return (
    <dl className="divide-y divide-slate-100 dark:divide-slate-800">
      {rows.map(([k, v]) => (
        <div key={k} className="grid gap-1 py-2.5 text-sm sm:grid-cols-[180px_1fr] sm:gap-4">
          <dt className="text-slate-500 dark:text-slate-400">{k}</dt>
          <dd className="min-w-0 font-medium wrap-break-word text-slate-900 dark:text-slate-100">{v || <span className="font-normal text-slate-400">—</span>}</dd>
        </div>
      ))}
    </dl>
  )
}

interface Props {
  issues: Record<StepId, Errors>
  goTo: (s: StepId) => void
  captcha: Captcha | null
  captchaAnswer: string
  setCaptchaAnswer: (v: string) => void
  refreshCaptcha: () => void
  captchaError?: string
  captchaLoading: boolean
  submitError?: string | null
  submitActions?: SubmitAction[]
}

export function StepReview({ issues, goTo, captcha, captchaAnswer, setCaptchaAnswer, refreshCaptcha, captchaError, captchaLoading, submitError, submitActions }: Props) {
  const { data, files } = useForm()
  const sections = summarise(data, files)
  return (
    <div className="space-y-6">
      {sections.map((s) => {
        const n = Object.keys(issues[s.step] ?? {}).length
        return (
          <section key={s.step} className={cx('rounded-xl border p-5', n ? 'border-amber-300 bg-amber-50/40 dark:border-amber-800 dark:bg-amber-950/10' : 'border-slate-200 dark:border-slate-800')}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                {n ? <AlertCircle className="size-4 text-amber-600" /> : <CheckCircle2 className="size-4 text-emerald-600" />}
                {s.title}
              </h3>
              <button
                type="button"
                onClick={() => goTo(s.step)}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium text-brand-700 hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none dark:text-brand-300 dark:hover:bg-brand-900/40"
                aria-label={`Change ${s.title}`}
              >
                <Pencil className="size-3.5" /> {n ? 'Fix' : 'Change'}
              </button>
            </div>
            {n > 0 && (
              <p className="mb-2 text-sm text-amber-800 dark:text-amber-300">
                {n === 1 ? 'One thing needs your attention' : `${n} things need your attention`}: {Object.values(issues[s.step]).slice(0, 2).join(' ')}
              </p>
            )}
            <SummaryList rows={s.rows} />
          </section>
        )
      })}

      <section className="rounded-xl border border-slate-200 p-5 dark:border-slate-800">
        <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
          <ShieldCheck className="size-4 text-brand-600" /> Confirm and submit
        </h3>
        <div className="space-y-5">
          {submitError && (
            <div id="submit-error-inline" role="alert" className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 animate-fade-in dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-semibold">We couldn’t submit your application</p>
                <p className="mt-0.5">{submitError}</p>
                <ActionLinks actions={submitActions} />
              </div>
            </div>
          )}
          <FieldShell id="f-captcha" label="Security check" required error={captchaError} hint="Type the characters you see. Not case-sensitive.">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-14 w-45 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700">
                {captcha ? <img src={captcha.image} alt="Security code image" className="h-full w-full object-cover" /> : <span className="text-xs text-slate-500">Loading…</span>}
              </div>
              <button
                type="button"
                onClick={refreshCaptcha}
                className="rounded-lg p-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none dark:hover:bg-slate-800"
                aria-label="Get a new security code"
                title="New code"
              >
                <RefreshCw className={cx('size-4', captchaLoading && 'animate-spin')} />
              </button>
              <input
                id="f-captcha"
                className="input w-40 font-mono tracking-widest uppercase"
                value={captchaAnswer}
                onChange={(e) => setCaptchaAnswer(e.target.value.toUpperCase().replace(/\s/g, ''))}
                maxLength={8}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                aria-invalid={!!captchaError}
                aria-describedby={captchaError ? 'f-captcha-err' : 'f-captcha-hint'}
              />
            </div>
          </FieldShell>
          <CheckboxField
            name="declaration"
            label="I declare that the information given is true and complete to the best of my knowledge, and I understand that giving false information is an offence under the Inland Revenue Act."
          />
        </div>
      </section>
    </div>
  )
}
