import { useState, useMemo, useEffect, useRef } from 'react'
import studies from './data/studies.json'
import WorldMap from './WorldMap'
import './App.css'

const FILTERS = [
  { key: 'sex', label: 'Population', get: s => s.population?.sex_tag, options: ['Girls only', 'Boys only', 'Women only', 'Mixed'] },
  { key: 'country', label: 'Country', get: s => s.country, options: [...new Set(studies.map(s => s.country))] },
  { key: 'region', label: 'Region', get: s => s.region, options: [...new Set(studies.map(s => s.region))] },
  { key: 'income', label: 'Income setting', get: s => s.income_setting, options: [...new Set(studies.map(s => s.income_setting).filter(Boolean))] },
  { key: 'setting', label: 'Setting', get: s => s.population?.setting, options: ['School', 'Community', 'Home/family', 'Online/digital', 'Mixed'] },
  { key: 'design', label: 'Study design', get: s => s.study_design, options: ['RCT', 'Quasi-experimental', 'Cohort', 'Qualitative'] },
  { key: 'effect', label: 'Effectiveness', get: s => s.effect?.overall_tag, options: ['Worked', 'Mixed', "Didn't work"] },
  { key: 'completeness', label: 'Completeness', get: s => s.completeness === 'full' ? 'Full record' : 'Citation only', options: ['Full record', 'Citation only'] },
]

const DESIGN_ORDER = FILTERS.find(f => f.key === 'design').options
const EFFECT_STATUS = [
  { key: 'Worked', label: 'Worked', status: 'good', icon: '✓' },
  { key: 'Mixed', label: 'Mixed', status: 'warning', icon: '~' },
  { key: "Didn't work", label: "Didn't work", status: 'critical', icon: '✕' },
]
const EFFECT_TAG_CLASS = { Worked: 'tag-success', Mixed: 'tag-warning', "Didn't work": 'tag-critical' }

const getYear = s => {
  const m = s.citation?.match(/\((\d{4})\)/)
  return m ? Number(m[1]) : null
}
const STUDY_YEARS = studies.map(getYear).filter(Boolean)
const MIN_YEAR = Math.min(...STUDY_YEARS)
const MAX_YEAR = Math.max(...STUDY_YEARS)

const MIN_AGE = Math.min(...studies.map(s => s.population?.age_min).filter(v => v != null))
const MAX_AGE = Math.max(...studies.map(s => s.population?.age_max).filter(v => v != null))

// Whether a study matches the current filter/search state. `skipKey` excludes
// one FILTERS entry from the check - used to work out, for each dropdown
// option, whether it's reachable in combination with every OTHER active
// filter (so we can show "3 studies have this tag, but 0 combine with your
// other selections" instead of silently hiding or renumbering options).
function studyMatches(s, { active, skipKey, keyword, yearFrom, yearTo, ageFrom, ageTo }) {
  for (const f of FILTERS) {
    if (f.key === skipKey) continue
    const val = active[f.key]
    if (val && f.get(s) !== val) return false
  }
  const year = getYear(s)
  if (year && (year < yearFrom || year > yearTo)) return false
  const { age_min, age_max } = s.population || {}
  if (age_min != null && age_max != null && (age_min > ageTo || age_max < ageFrom)) return false
  if (keyword) {
    const hay = `${s.intervention_name} ${s.citation} ${s.country}`.toLowerCase()
    if (!hay.includes(keyword.toLowerCase())) return false
  }
  return true
}

// A dropdown whose options show how many studies carry that value (dataset-
// wide, so the number never changes) and are colored green/grey depending on
// whether that option is still reachable given every other active filter.
function FilterDropdown({ label, value, onChange, options }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKeyDown = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const selected = options.find(o => o.value === value)

  return (
    <div className="filter-field dropdown-field" ref={ref}>
      <label>{label}</label>
      <button
        type="button"
        className="dropdown-trigger"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{selected ? selected.label : 'Any'}</span>
        <span className={`expand-icon${open ? ' is-expanded' : ''}`} aria-hidden="true">⌄</span>
      </button>
      {open && (
        <ul className="dropdown-menu" role="listbox">
          <li role="option" aria-selected={!value}>
            <button type="button" className="dropdown-option" onClick={() => { onChange(''); setOpen(false) }}>
              Any
            </button>
          </li>
          {options.map(o => (
            <li key={o.value} role="option" aria-selected={value === o.value}>
              <button
                type="button"
                className={`dropdown-option${value === o.value ? ' is-selected' : ''}`}
                onClick={() => { onChange(o.value); setOpen(false) }}
              >
                <span>{o.label}</span>
                <span className={o.available ? 'count-available' : 'count-unavailable'}>({o.count})</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function EffectivenessChart({ studies }) {
  const [showTable, setShowTable] = useState(false)

  const rows = useMemo(() => {
    return DESIGN_ORDER
      .map(design => {
        const inDesign = studies.filter(s => s.study_design === design)
        const segments = EFFECT_STATUS.map(e => ({
          ...e,
          count: inDesign.filter(s => s.effect?.overall_tag === e.key).length,
        }))
        return { design, total: inDesign.length, segments }
      })
      .filter(r => r.total > 0)
  }, [studies])

  const maxTotal = Math.max(1, ...rows.map(r => r.total))

  return (
    <section className="chart-card">
      <div className="chart-head">
        <h2>Trial design &amp; effectiveness</h2>
        {rows.length > 0 && (
          <button className="table-toggle" onClick={() => setShowTable(v => !v)}>
            {showTable ? 'Show chart' : 'Show as table'}
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="chart-empty">No studies match these filters yet.</p>
      ) : (
        <>
          <div className="chart-legend">
            {EFFECT_STATUS.map(e => (
              <span className="legend-item" key={e.key}>
                <span className={`legend-swatch status-${e.status}`} aria-hidden="true">{e.icon}</span>
                {e.label}
              </span>
            ))}
          </div>

          {showTable ? (
            <table className="chart-table">
              <thead>
                <tr>
                  <th>Trial design</th>
                  {EFFECT_STATUS.map(e => <th key={e.key}>{e.label}</th>)}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.design}>
                    <td>{r.design}</td>
                    {r.segments.map(s => <td key={s.key}>{s.count}</td>)}
                    <td>{r.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="chart-bars">
              {rows.map(r => (
                <div className="bar-row" key={r.design}>
                  <div className="bar-label">{r.design}</div>
                  <div className="bar-track-outer">
                    <div className="bar-track" style={{ width: `${(r.total / maxTotal) * 100}%` }}>
                      {r.segments.filter(s => s.count > 0).map(s => (
                        <button
                          type="button"
                          key={s.key}
                          className={`bar-segment status-${s.status}`}
                          style={{ flexGrow: s.count, flexBasis: 0 }}
                        >
                          {(s.count / r.total) * 100 >= 14 && <span className="segment-label">{s.count}</span>}
                          <span className="segment-tooltip" role="tooltip">
                            <strong>{s.count}</strong> {s.label} · {r.design}
                          </span>
                          <span className="sr-only">{`${r.design}: ${s.count} of ${r.total} studies ${s.label}`}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="bar-total">{r.total}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}

function StudyCard({ study }) {
  const [expanded, setExpanded] = useState(false)
  const isFull = study.completeness === 'full'
  const effectTag = study.effect?.overall_tag
  const effectMeta = EFFECT_STATUS.find(e => e.key === effectTag)

  return (
    <div className="study-card">
      <div className="card-tags">
        {isFull && study.study_design && <span className="tag tag-accent">{study.study_design}</span>}
        {isFull && effectMeta ? (
          <span className={`tag ${EFFECT_TAG_CLASS[effectTag]}`}>{effectMeta.icon} {effectMeta.label}</span>
        ) : (
          <span className="tag tag-neutral">Citation only</span>
        )}
      </div>
      <h3>{study.intervention_name}</h3>
      <p className="citation">{study.citation}</p>
      <p className="location">{study.country}{study.region ? `, ${study.region}` : ''}</p>

      {isFull ? (
        <>
          <p className="quick-facts">n={study.population.sample_size}</p>

          <button
            className="expand-btn"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Show less' : 'Show more'}
          >
            <span className={`expand-icon${expanded ? ' is-expanded' : ''}`} aria-hidden="true">⌄</span>
          </button>

          {expanded && (
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
              <div><strong>Quality appraisal:</strong> {study.quality_appraisal}</div>
              {study.url && <div><a href={study.url} target="_blank" rel="noreferrer">View source</a></div>}
            </div>
          )}
        </>
      ) : (
        <p className="incomplete-note">
          Only name, first citation, and country available. Sample size, design, and outcomes need the primary study.
        </p>
      )}
    </div>
  )
}

export default function App() {
  const [view, setView] = useState('dashboard') // 'dashboard' | 'results'
  const [keyword, setKeyword] = useState('')
  const [active, setActive] = useState({})
  const [yearFrom, setYearFrom] = useState(MIN_YEAR)
  const [yearTo, setYearTo] = useState(MAX_YEAR)
  const [ageFrom, setAgeFrom] = useState(MIN_AGE)
  const [ageTo, setAgeTo] = useState(MAX_AGE)

  const setFilter = (key, value) => setActive(prev => ({ ...prev, [key]: value }))

  const matchState = { active, keyword, yearFrom, yearTo, ageFrom, ageTo }

  const filtered = useMemo(
    () => studies.filter(s => studyMatches(s, { ...matchState, skipKey: null })),
    [active, keyword, yearFrom, yearTo, ageFrom, ageTo]
  )

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Prevention of Violence Against Women and Girls Evidence Platform</h1>
      </header>

      <div className="app-body">
        <div className="filter-bar">
          <div className="filter-field filter-field-wide">
            <label>Keyword</label>
            <input
              type="text"
              placeholder="e.g. curriculum, bystander..."
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
            />
          </div>
          <div className="filter-field">
            <label>Publication year</label>
            <div className="year-range">
              <input
                type="number"
                min={MIN_YEAR}
                max={yearTo}
                value={yearFrom}
                onChange={e => setYearFrom(Math.min(Number(e.target.value) || MIN_YEAR, yearTo))}
                aria-label="From year"
              />
              <span aria-hidden="true">–</span>
              <input
                type="number"
                min={yearFrom}
                max={MAX_YEAR}
                value={yearTo}
                onChange={e => setYearTo(Math.max(Number(e.target.value) || MAX_YEAR, yearFrom))}
                aria-label="To year"
              />
            </div>
          </div>
          <div className="filter-field">
            <label>Age range</label>
            <div className="year-range">
              <input
                type="number"
                min={MIN_AGE}
                max={ageTo}
                value={ageFrom}
                onChange={e => setAgeFrom(Math.min(Number(e.target.value) || MIN_AGE, ageTo))}
                aria-label="From age"
              />
              <span aria-hidden="true">–</span>
              <input
                type="number"
                min={ageFrom}
                max={MAX_AGE}
                value={ageTo}
                onChange={e => setAgeTo(Math.max(Number(e.target.value) || MAX_AGE, ageFrom))}
                aria-label="To age"
              />
            </div>
          </div>
          {FILTERS.map(f => {
            const options = f.options.map(o => ({
              value: o,
              label: o,
              count: studies.filter(s => f.get(s) === o).length,
              available: studies.some(s => f.get(s) === o && studyMatches(s, { ...matchState, skipKey: f.key })),
            }))
            return (
              <FilterDropdown
                key={f.key}
                label={f.label}
                value={active[f.key] || ''}
                onChange={v => setFilter(f.key, v)}
                options={options}
              />
            )
          })}
        </div>

        <p className="result-count">{filtered.length} of {studies.length} studies</p>

        {view === 'dashboard' ? (
          <>
            <div className="charts-row">
              <EffectivenessChart studies={filtered} />
              <WorldMap
                studies={filtered}
                activeCountry={active.country}
                onSelectCountry={country => setFilter('country', active.country === country ? '' : country)}
              />
            </div>

            <button className="view-results-cta" onClick={() => setView('results')} disabled={filtered.length === 0}>
              {filtered.length === 0
                ? 'No studies match these filters yet'
                : `Read the ${filtered.length} matching ${filtered.length === 1 ? 'study' : 'studies'} →`}
            </button>
          </>
        ) : (
          <>
            <button className="back-to-dashboard" onClick={() => setView('dashboard')}>
              &larr; Back to overview
            </button>

            <main className="results-grid">
              {filtered.length === 0 && <p className="no-results">No studies match these filters yet.</p>}
              {filtered.map(s => <StudyCard key={s.id} study={s} />)}
            </main>
          </>
        )}
      </div>
    </div>
  )
}
