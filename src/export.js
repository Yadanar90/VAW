import { jsPDF } from 'jspdf'
import * as XLSX from 'xlsx'

const today = () => new Date().toISOString().slice(0, 10)

// Flattens one study into a single spreadsheet row. Optional chaining +
// '' fallbacks so a citation-only record (no population/effect/etc.)
// still produces a row instead of throwing.
function studyToRow(s) {
  return {
    'Intervention Name': s.intervention_name ?? '',
    'Citation': s.citation ?? '',
    'Source': s.source ?? '',
    'Country': s.country ?? '',
    'Region': s.region ?? '',
    'Income Setting': s.income_setting ?? '',
    'Study Design': s.study_design ?? '',
    'Study Design (Full)': s.study_design_full ?? '',
    'Age Range': s.population?.age_range ?? '',
    'Sex': s.population?.sex ?? '',
    'Setting': s.population?.setting ?? '',
    'Sample Size': s.population?.sample_size ?? '',
    'Sample Size Detail': s.population?.sample_size_detail ?? '',
    'Intervention Description': s.intervention?.description ?? '',
    'Duration': s.intervention?.duration ?? '',
    'Effect': s.effect?.overall_tag ?? '',
    'Effect Direction': s.effect?.direction ?? '',
    'Worked For': (s.effect?.worked_for ?? []).join('; '),
    'Did Not Work For': (s.effect?.did_not_work_for ?? []).join('; '),
    'Key Message': s.key_message ?? '',
    'Limitations': (s.limitations ?? []).join('; '),
    'Source URL': s.url ?? '',
  }
}

export function exportToExcel(studies) {
  const rows = studies.map(studyToRow)
  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Studies')
  XLSX.writeFile(workbook, `vawg-evidence-${today()}.xlsx`)
}

const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const MARGIN = 18
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

function makeCursor(doc) {
  let y = MARGIN
  const ensureRoom = needed => {
    if (y + needed > PAGE_HEIGHT - MARGIN) {
      doc.addPage()
      y = MARGIN
    }
  }
  const text = (str, { size = 10, weight = 'normal', gap = 5, color = '#2c2c2a' } = {}) => {
    doc.setFont('helvetica', weight)
    doc.setFontSize(size)
    doc.setTextColor(color)
    const lines = doc.splitTextToSize(str, CONTENT_WIDTH)
    ensureRoom(lines.length * (size * 0.5) + gap)
    doc.text(lines, MARGIN, y)
    y += lines.length * (size * 0.5) + gap
  }
  const bulletList = (items, opts) => {
    for (const item of items) text(`•  ${item}`, opts)
  }
  const rule = () => {
    ensureRoom(6)
    doc.setDrawColor('#e0ddd3')
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
    y += 6
  }
  const newPage = () => { doc.addPage(); y = MARGIN }
  return { text, bulletList, rule, newPage, ensureRoom, get y() { return y }, set y(v) { y = v } }
}

export function exportToPdf(studies, { collectionLabel } = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const c = makeCursor(doc)

  c.text('Prevention of Violence Against Women and Girls', { size: 18, weight: 'bold', color: '#7C1030', gap: 2 })
  c.text('Evidence Export', { size: 13, weight: 'bold', gap: 6 })
  c.text(`Generated ${new Date().toLocaleDateString()} · ${studies.length} ${studies.length === 1 ? 'study' : 'studies'}${collectionLabel ? ` · ${collectionLabel}` : ''}`, { size: 10, color: '#6b6a63', gap: 10 })
  c.rule()

  studies.forEach((s, i) => {
    if (i > 0) c.newPage()
    const isFull = s.completeness === 'full'

    c.text(s.intervention_name, { size: 14, weight: 'bold', gap: 3 })
    c.text(`${s.citation}${s.source ? ` — ${s.source}` : ''}`, { size: 10, color: '#6b6a63', gap: 2 })
    c.text(`${s.country}${s.region ? `, ${s.region}` : ''}`, { size: 10, color: '#6b6a63', gap: 6 })

    if (!isFull) {
      c.text('Citation only - sample size, design, and outcomes need the primary study.', { size: 10, gap: 6 })
      return
    }

    c.text(s.key_message, { size: 11, gap: 6 })

    c.text(`Population: ${s.population.age_range}, ${s.population.sex}, ${s.population.setting} setting`, { size: 10, gap: 3 })
    c.text(`Sample size: ${s.population.sample_size} (${s.population.sample_size_detail})`, { size: 10, gap: 3 })
    c.text(`Design: ${s.study_design_full}`, { size: 10, gap: 3 })
    c.text(`Intervention: ${s.intervention.description}`, { size: 10, gap: 3 })
    c.text(`Outcomes measured: ${s.outcomes_measured.join(', ')}`, { size: 10, gap: 6 })

    c.text('Worked for:', { size: 10, weight: 'bold', gap: 2 })
    c.bulletList(s.effect.worked_for, { size: 10, gap: 2 })
    if (s.effect.did_not_work_for?.length > 0) {
      c.text('Did not work for:', { size: 10, weight: 'bold', gap: 2 })
      c.bulletList(s.effect.did_not_work_for, { size: 10, gap: 2 })
    }
    c.text('Limitations:', { size: 10, weight: 'bold', gap: 2 })
    c.bulletList(s.limitations, { size: 10, gap: 2 })

    if (s.url) {
      c.ensureRoom(6)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor('#7C1030')
      doc.textWithLink(s.url, MARGIN, c.y, { url: s.url })
      c.y += 6
    }
  })

  doc.save(`vawg-evidence-${today()}.pdf`)
}
