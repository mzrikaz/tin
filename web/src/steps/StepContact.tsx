import { Globe, Mail, Phone, Printer, Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from '../components/form'
import { CheckboxField, ComboField, Section, SegmentedField, SelectField, TextareaField, TextField } from '../components/ui'
import { api } from '../lib/api'
import { COMM_MODES, entityByKey, LANGUAGES, NEAREST_OFFICES } from '../lib/config'
import { districtOptions, isValidChain, loadGeo, provinceOptions, type GeoProvince } from '../lib/geo'
import { normaliseSlMobile } from '../lib/validation'

const digits = (n: number) => (v: string) => v.replace(/\D/g, '').slice(0, n)
const phone = (v: string) => v.replace(/[^\d+\s()-]/g, '').slice(0, 22)

export function StepContact() {
  const { data, patch, touch } = useForm()
  const entity = entityByKey(data.entityType)
  const foreign = entity?.kind === 'dsp'
  const individual = entity?.kind === 'individual'
  const modeHint = COMM_MODES.find((m) => m.value === data.preferredMode)?.hint

  const [geo, setGeo] = useState<GeoProvince[] | null>(null)
  useEffect(() => {
    loadGeo().then(setGeo)
  }, [])
  // Drafts saved before codes were used stored names — clear those so the user re-picks.
  useEffect(() => {
    if (geo && !isValidChain(geo, data.province, data.district)) patch({ province: '', district: '', dsDivision: '', gnDivision: '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo])

  return (
    <div className="space-y-8">
      {foreign ? (
        <Section title="Registered business address">
          <TextareaField name="foreignAddress" label="Address" required rows={4} className="sm:col-span-2" placeholder={'Street, city, postal code\nCountry'} />
        </Section>
      ) : (
        <>
          <Section title={individual ? 'Permanent address' : 'Registered address'} description="Where we post letters and your TIN certificate.">
            <TextField name="premisesNo" label="Premises / house no." optional maxLength={25} autoComplete="address-line1" />
            <TextField name="unitNo" label="Unit / flat no." optional maxLength={10} />
            <TextField name="addressLine1" label="Street" required maxLength={100} autoComplete="address-line2" className="sm:col-span-2" placeholder="e.g. Flower Road" />
            <TextField name="addressLine2" label="Area" optional maxLength={100} className="sm:col-span-2" placeholder="e.g. Kollupitiya" />
            <TextField name="addressLine3" label="City / town" optional maxLength={100} autoComplete="address-level2" />
            <TextField name="postalCode" label="Postal code" optional inputMode="numeric" autoComplete="postal-code" transform={digits(10)} />
            <SelectField
              name="province"
              label="Province"
              required
              options={geo ? provinceOptions(geo) : []}
              placeholder={geo ? 'Select…' : 'Loading…'}
              onValue={(v) => {
                if (v !== data.province) patch({ province: v, district: '', dsDivision: '', gnDivision: '' })
                touch('province')
              }}
            />
            <SelectField
              name="district"
              label="District"
              required
              options={geo ? districtOptions(geo, data.province) : []}
              placeholder={data.province ? 'Select…' : 'Choose a province first'}
              onValue={(v) => {
                if (v !== data.district) patch({ district: v, dsDivision: '', gnDivision: '' })
                touch('district')
              }}
            />
            <ComboField
              key={`ds-${data.district}`}
              name="dsDivision"
              label="Divisional secretariat"
              required
              disabled={!data.district}
              disabledHint="Choose a district first."
              load={() => api.getDsDivisions(data.district)}
              deps={[data.district]}
            />
            <ComboField
              key={`gn-${data.dsDivision}`}
              name="gnDivision"
              label="Grama Niladhari division"
              required
              disabled={!data.dsDivision}
              disabledHint="Choose a divisional secretariat first."
              load={() => api.getGnDivisions(data.district, data.dsDivision)}
              deps={[data.dsDivision]}
              hint="Type to search."
            />
          </Section>

          {individual && (
            <Section title="Residential address">
              <CheckboxField name="resSame" label="I live at my permanent address" className="sm:col-span-2" />
              {!data.resSame && (
                <>
                  <TextField name="resPremisesNo" label="Premises / house no." optional maxLength={25} className="animate-slide-up" />
                  <TextField name="resUnitNo" label="Unit / flat no." optional maxLength={10} className="animate-slide-up" />
                  <TextField name="resLine1" label="Street" required maxLength={100} className="animate-slide-up sm:col-span-2" />
                  <TextField name="resLine2" label="Area" optional maxLength={100} className="animate-slide-up sm:col-span-2" />
                  <TextField name="resLine3" label="City / town" optional maxLength={100} className="animate-slide-up" />
                  <TextField name="resPostalCode" label="Postal code" optional inputMode="numeric" transform={digits(10)} className="animate-slide-up" />
                </>
              )}
            </Section>
          )}
        </>
      )}

      <Section title="Contact details" description="Give at least one phone number or an email address.">
        <TextField
          name="email"
          label="Email address"
          type="email"
          inputMode="email"
          autoComplete="email"
          required={individual || foreign || data.preferredMode === '3'}
          optional={!(individual || foreign || data.preferredMode === '3')}
          prefix={<Mail className="size-4" />}
          onBlurValue={(v) => v.trim().toLowerCase()}
          maxLength={100}
          className="sm:col-span-2"
        />
        <TextField
          name="mobile"
          label="Mobile"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required={data.preferredMode === '2'}
          optional={data.preferredMode !== '2'}
          placeholder={foreign ? '+44 7700 900123' : '077 123 4567'}
          prefix={<Smartphone className="size-4" />}
          transform={phone}
          onBlurValue={(v) => (!foreign && normaliseSlMobile(v)) || v.trim()}
        />
        <TextField name="officeNo" label="Office phone" type="tel" inputMode="tel" optional placeholder={foreign ? '+44 20 7946 0000' : '011 234 5678'} prefix={<Phone className="size-4" />} transform={phone} />
        {individual && <TextField name="homeNo" label="Home phone" type="tel" inputMode="tel" optional prefix={<Phone className="size-4" />} transform={phone} />}
        <TextField name="faxNo" label="Fax" type="tel" inputMode="tel" optional prefix={<Printer className="size-4" />} transform={phone} />
        <TextField name="website" label="Website" optional type="url" inputMode="url" placeholder="example.com" prefix={<Globe className="size-4" />} maxLength={80} className="sm:col-span-2" />
      </Section>

      <Section title="Preferences">
        <SegmentedField name="preferredMode" label="How should we contact you?" required options={COMM_MODES} hint={modeHint} className="sm:col-span-2" />
        {individual && <SegmentedField name="language" label="Preferred language" required options={LANGUAGES} className="sm:col-span-2" />}
        {!foreign && <ComboField name="nearestOffice" label="Nearest IRD regional office" optional options={NEAREST_OFFICES} className="sm:col-span-2" />}
      </Section>
    </div>
  )
}
