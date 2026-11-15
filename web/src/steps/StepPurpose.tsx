import { HardDriveDownload } from 'lucide-react'
import { FileUpload, formatBytes } from '../components/FileUpload'
import { useForm } from '../components/form'
import { CheckboxField, Callout, ComboField, Section, SelectField, TextareaField, TextField } from '../components/ui'
import { BANKS, entityByKey, FILES_TOTAL_MAX_BYTES, PURPOSE_OTHER, PURPOSES, REMARKS_MAX } from '../lib/config'

export function StepPurpose() {
  const { data, files, errors, patch, touch } = useForm()
  const total = files.reduce((n, f) => n + f.size, 0)
  const entity = entityByKey(data.entityType)
  if (!entity) return null
  const other = data.purposeCode === PURPOSE_OTHER

  return (
    <div className="space-y-8">
      <Section title="Purpose of registration">
        <SelectField
          name="purposeCode"
          label="Why do you need a TIN?"
          required
          className="sm:col-span-2"
          options={PURPOSES}
          onValue={(v) => {
            // Keep remarks text even if they switch away and back — never discard typing.
            patch({ purposeCode: v })
            touch('purposeCode')
          }}
        />
        {other && (
          <div className="animate-slide-up sm:col-span-2">
            <TextareaField
              name="purposeRemarks"
              label="Please specify"
              required
              maxLength={REMARKS_MAX}
              rows={3}
              placeholder="Briefly describe why you are registering."
            />
          </div>
        )}
      </Section>

      <Section title="Bank account" description="Optional. Used for tax refunds.">
        <ComboField name="bankCode" label="Bank" optional options={BANKS} />
        <TextField name="bankAccount" label="Account number" optional inputMode="numeric" transform={(v) => v.replace(/[^\d-]/g, '').slice(0, 30)} />
      </Section>

      {entity.documents.length > 0 && (
        <section className="border-t border-slate-200 pt-6 dark:border-slate-800">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Supporting documents</h3>
          <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm text-slate-500 dark:text-slate-400">Upload clear scans or phone photos.</p>
            <p className={total > FILES_TOTAL_MAX_BYTES ? 'text-sm font-medium text-red-600' : 'text-sm text-slate-500'} aria-live="polite">
              {formatBytes(total)} of {formatBytes(FILES_TOTAL_MAX_BYTES)} used
            </p>
          </div>
          {errors['doc:total'] && <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{errors['doc:total']}</p>}
          <div className="mt-4">
            <Callout tone="info" icon={<HardDriveDownload className="size-4" />}>
              Files are kept on this device until you submit, so you can close the page and come back without uploading again.
            </Callout>
          </div>
          <div className="mt-4 grid gap-4">
            {entity.documents.map((d) => (
              <FileUpload key={d.id} doc={d} />
            ))}
          </div>
        </section>
      )}

      {entity.kind === 'dsp' && (
        <section className="border-t border-slate-200 pt-6 dark:border-slate-800">
          <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-slate-100">Consent</h3>
          <CheckboxField
            name="dspConsent"
            label="I consent to the Inland Revenue Department contacting the business electronically and to the processing of the details provided for registering as a non-resident digital service provider."
          />
        </section>
      )}
    </div>
  )
}
