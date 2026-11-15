// Builds the same acknowledgement IRD's old page printed after a TIN request
// ("ACKNOWLEDGEMENT / TAXPAYER REGISTRATION … SUCCESSFUL TRANSMISSION"), as a real PDF file.
import { entityByKey } from './config'
import type { Acknowledgement } from './types'

export interface AckFields {
  reference: string // e.g. "NIC 856252078V"
  name: string // e.g. "M I F SUMAIYA"
  designation: string
  contact: string
  ackNo: string
  dateTime: string
  request: string
  demo: boolean
}

export function ackFields(a: Acknowledgement): AckFields {
  const d = a.data
  const e = entityByKey(d.entityType)
  const individual = e?.kind === 'individual'
  const reference = e?.key === 'individual'
    ? `NIC ${d.nic}`
    : e?.key === 'individual_foreign'
      ? `PP ${d.passportNo}`
      : d.regNo ? `REG ${d.regNo}` : '-'
  // IRD prints the name with initials in capitals, without dots.
  const name = (individual ? d.nameWithInitials : d.orgName).toUpperCase().replace(/\./g, ' ').replace(/\s+/g, ' ').trim()
  return {
    reference,
    name,
    designation: individual ? 'SELF' : (d.contactSalutation || '-').replace(/^THE\s+/i, ''),
    contact: d.mobile || d.officeNo || d.homeNo || '-',
    ackNo: a.referenceNo,
    dateTime: a.irdDateTime ?? a.submittedAt,
    request: 'TIN Request',
    demo: !!a.demo || a.referenceNo.startsWith('DEMO'),
  }
}

export const DECLARATION = [
  'The information given in this request and in any supporting documents to be submitted is true, correct and complete.',
  'I am aware that there are penalties for furnishing a request with incorrect information.',
]

export async function downloadAckPdf(a: Acknowledgement) {
  const { jsPDF } = await import('jspdf')
  const f = ackFields(a)
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210
  const L = 20
  const R = W - 20
  let y = 22

  const rule = () => {
    doc.setDrawColor(160)
    doc.line(L, y, R, y)
    y += 7
  }
  const row = (label: string, value: string) => {
    doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(90)
    doc.text(label, L, y)
    doc.setFont('helvetica', 'bold').setTextColor(20)
    doc.text(value, L + 62, y)
    y += 7
  }
  const heading = (t: string) => {
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(20)
    doc.text(t, L, y)
    y += 7
  }

  if (f.demo) {
    doc.setFont('helvetica', 'bold').setFontSize(48).setTextColor(235, 200, 200)
    doc.text('DEMO — NOT SUBMITTED', W / 2, 160, { align: 'center', angle: 35 })
  }

  doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(20)
  doc.text('ACKNOWLEDGEMENT', W / 2, y, { align: 'center' })
  y += 7
  doc.setFontSize(12)
  doc.text('TAXPAYER REGISTRATION', W / 2, y, { align: 'center' })
  y += 6
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(110)
  doc.text('Inland Revenue Department — Sri Lanka', W / 2, y, { align: 'center' })
  y += 8
  rule()

  row('Applicant reference No.', f.reference)
  row('Name of applicant', f.name)
  y += 2
  rule()

  heading('DECLARATION')
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(40)
  doc.text('I declare that:', L, y)
  y += 6
  for (const line of DECLARATION) {
    const wrapped = doc.splitTextToSize(line, R - L - 6)
    doc.text('•', L + 1, y)
    doc.text(wrapped, L + 6, y)
    y += wrapped.length * 5 + 2
  }
  y += 3
  row('Name of applicant', f.name)
  row('Designation of applicant', f.designation)
  row('Contact number', f.contact)
  y += 2
  rule()

  heading(f.demo ? 'DEMO — NOT TRANSMITTED TO IRD' : 'SUCCESSFUL TRANSMISSION')
  row('Acknowledgement No.', f.ackNo)
  row('Date / Time', f.dateTime)
  y += 2
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(40)
  doc.text(f.demo ? 'This is a demo. Nothing was sent to IRD.' : 'You had successfully submitted the following request:', L, y)
  y += 6
  doc.setFont('helvetica', 'bold')
  doc.text(f.request, L + 6, y)
  y += 8
  doc.setFont('helvetica', 'normal')
  if (!f.demo) doc.text('A notification will be mailed to you within 5 working days.', L, y)

  doc.save(`IRD-Acknowledgement-${f.ackNo}.pdf`)
}
