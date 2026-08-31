// Shared chart-card building blocks used by both App.jsx (dashboard charts)
// and WorldMap.jsx - kept in their own module so WorldMap can reuse them
// without an App.jsx <-> WorldMap.jsx circular import.

import { useState, useEffect } from 'react'

export const EFFECT_STATUS = [
  { key: 'Worked', label: 'Worked', status: 'good', icon: '✓' },
  { key: 'Mixed', label: 'Mixed', status: 'warning', icon: '~' },
  { key: "Didn't work", label: "Didn't work", status: 'critical', icon: '✕' },
]

function ChartGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M2 14V9M7 14V4M12 14V6.5" />
    </svg>
  )
}
function TableGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="2" y="2" width="12" height="12" rx="1.5" />
      <path d="M2 8H14M8 2V14" />
    </svg>
  )
}
function ListGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M5 4H14M5 8H14M5 12H14" />
      <circle cx="2" cy="4" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="2" cy="8" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="2" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

const VIEW_MODES = [
  { key: 'chart', label: 'Show as chart', icon: <ChartGlyph /> },
  { key: 'table', label: 'Show as table', icon: <TableGlyph /> },
  { key: 'list', label: 'List studies by category', icon: <ListGlyph /> },
]

// Replaces the old single show-table toggle with three icon buttons that
// switch a chart card between its bar/line chart, a data table, and a
// per-category list of the actual studies behind each row.
export function ViewToggle({ mode, onChange }) {
  return (
    <div className="view-toggle" role="group" aria-label="Chart view">
      {VIEW_MODES.map(m => (
        <button
          key={m.key}
          type="button"
          className={`view-toggle-btn${mode === m.key ? ' is-active' : ''}`}
          aria-pressed={mode === m.key}
          aria-label={m.label}
          title={m.label}
          onClick={() => onChange(m.key)}
        >
          {m.icon}
        </button>
      ))}
    </div>
  )
}

function StudyDetails({ study }) {
  return (
    <div className="detail-panel">
      <div className="key-message">{study.key_message}</div>
      {study.source && <div><strong>Source:</strong> {study.source}</div>}
      <div><strong>Population:</strong> {study.population.age_range}, {study.population.sex}, {study.population.setting} setting</div>
      <div><strong>Sample size:</strong> {study.population.sample_size} ({study.population.sample_size_detail})</div>
      <div><strong>Design:</strong> {study.study_design_full}</div>
      <div><strong>Intervention:</strong> {study.intervention.description}</div>
      <div><strong>Outcomes measured:</strong> {study.outcomes_measured.join(', ')}</div>
      <div>
        <strong>Worked for:</strong>
        <ul>{study.effect.worked_for.map((x, i) => <li key={i}>{x}</li>)}</ul>
      </div>
      {study.effect.did_not_work_for?.length > 0 && (
        <div>
          <strong>Did not work for:</strong>
          <ul>{study.effect.did_not_work_for.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </div>
      )}
      <div>
        <strong>Limitations:</strong>
        <ul>{study.limitations.map((x, i) => <li key={i}>{x}</li>)}</ul>
      </div>
      {study.url && (
        <div>
          <a className="view-source-btn" href={study.url} target="_blank" rel="noreferrer">View source</a>
        </div>
      )}
    </div>
  )
}

export function StudyModal({ study, onClose }) {
  useEffect(() => {
    const onKeyDown = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={study.intervention_name}
        onClick={e => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        <h3>{study.intervention_name}</h3>
        <p className="citation">{study.citation}</p>
        <p className="location">{study.country}{study.region ? `, ${study.region}` : ''}</p>
        <StudyDetails study={study} />
      </div>
    </div>
  )
}

// The "list" view shared by every chart card: one group per category/year/
// country, each listing the studies behind it with a small effect-status
// dot (or a neutral dot for citation-only records with no effect tag yet).
// `onClear`, when given, renders a "back to all categories" link above the
// groups - used when a chart has drilled into a single clicked segment.
export function CategoryStudyList({ rows, onClear }) {
  const [openStudy, setOpenStudy] = useState(null)

  return (
    <div className="chart-list">
      {onClear && (
        <button type="button" className="list-clear-btn" onClick={onClear}>
          &larr; Back to all categories
        </button>
      )}
      {rows.map(r => (
        <div className="list-group" key={r.label}>
          <h3 className="list-group-title">{r.label} <span className="list-group-count">{r.total}</span></h3>
          <ul>
            {r.studies.map(s => {
              const effectMeta = EFFECT_STATUS.find(e => e.key === s.effect?.overall_tag)
              const isFull = s.completeness === 'full'
              return (
                <li key={s.id}>
                  <span
                    className={`list-effect-dot status-${effectMeta ? effectMeta.status : 'neutral'}`}
                    title={effectMeta ? effectMeta.label : 'Citation only'}
                    aria-hidden="true"
                  />
                  {isFull ? (
                    <span
                      role="button"
                      tabIndex={0}
                      className="list-study-link"
                      onClick={() => setOpenStudy(s)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenStudy(s) } }}
                    >
                      {s.intervention_name}
                    </span>
                  ) : (
                    s.intervention_name
                  )}
                  {' '}<span className="list-study-citation">— {s.citation}</span>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
      {openStudy && <StudyModal study={openStudy} onClose={() => setOpenStudy(null)} />}
    </div>
  )
}
