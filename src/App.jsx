import { useState, useMemo, useEffect, useRef } from 'react'
import studies from './data/studies.json'
import WorldMap from './WorldMap'
import headerPattern from './assets/header-pattern.svg'
import './App.css'

const FILTERS = [
  { key: 'sex', label: 'Population', get: s => s.population?.sex_tag, options: ['Girls only', 'Boys only', 'Women only', 'Mixed'] },
  { key: 'country', label: 'Country', get: s => s.country, options: [...new Set(studies.map(s => s.country))] },
  { key: 'region', label: 'Region', get: s => s.region, options: [...new Set(studies.map(s => s.region))] },
  { key: 'income', label: 'Income setting', get: s => s.income_setting, options: [...new Set(studies.map(s => s.income_setting).filter(Boolean))] },
  { key: 'setting', label: 'Intervention setting', get: s => s.population?.setting, options: ['School', 'Community', 'Home/family', 'Online/digital', 'Mixed'] },
  { key: 'design', label: 'Study design', get: s => s.study_design, options: ['RCT', 'Quasi-experimental', 'Cohort', 'Qualitative'] },
  { key: 'effect', label: 'Effectiveness', get: s => s.effect?.overall_tag, options: ['Worked', 'Mixed', "Didn't work"] },
]

const DESIGN_ORDER = FILTERS.find(f => f.key === 'design').options
const AGE_GROUP_ORDER = ['Under 10', '10-14', '15-19', 'Mixed/all ages']
const INCOME_ORDER = ['Low-income', 'Lower-middle-income', 'Upper-middle-income', 'High-income']
const REGION_ORDER = [...new Set(studies.map(s => s.region))]
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

// Fixed at the full plausible human age span, not derived from the current
// dataset, so the filter isn't artificially narrower than what's typable.
const MIN_AGE = 0
const MAX_AGE = 99

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

// A stacked-bar chart of effectiveness (Worked/Mixed/Didn't work) broken
// down by some other categorical field - trial design, age group, income
// setting, region, etc. `categories` is the fixed display order; rows with
// zero studies are hidden rather than shown empty.
function CategoryEffectivenessChart({ studies, title, columnLabel, categories, getCategory }) {
  const [showTable, setShowTable] = useState(false)

  const rows = useMemo(() => {
    return categories
      .map(category => {
        const inCategory = studies.filter(s => getCategory(s) === category)
        const segments = EFFECT_STATUS.map(e => ({
          ...e,
          count: inCategory.filter(s => s.effect?.overall_tag === e.key).length,
        }))
        return { category, total: inCategory.length, segments }
      })
      .filter(r => r.total > 0)
  }, [studies, categories, getCategory])

  const maxTotal = Math.max(1, ...rows.map(r => r.total))

  return (
    <section className="chart-card">
      <div className="chart-head">
        <h2>{title}</h2>
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
                  <th>{columnLabel}</th>
                  {EFFECT_STATUS.map(e => <th key={e.key}>{e.label}</th>)}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.category}>
                    <td>{r.category}</td>
                    {r.segments.map(s => <td key={s.key}>{s.count}</td>)}
                    <td>{r.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="chart-bars">
              {rows.map(r => (
                <div className="bar-row" key={r.category}>
                  <div className="bar-label">{r.category}</div>
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
                            <strong>{s.count}</strong> {s.label} · {r.category}
                          </span>
                          <span className="sr-only">{`${r.category}: ${s.count} of ${r.total} studies ${s.label}`}</span>
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

  // The inputs allow a transient empty string while typing (e.g. after
  // backspacing to clear a field) without forcing it back to a number on
  // every keystroke - see the range inputs below. An empty field just means
  // "no bound on this side yet" for filtering purposes.
  const numOr = (raw, fallback) => (raw === '' || Number.isNaN(raw) ? fallback : raw)
  const effYearFrom = numOr(yearFrom, MIN_YEAR)
  const effYearTo = numOr(yearTo, MAX_YEAR)
  const effAgeFrom = numOr(ageFrom, MIN_AGE)
  const effAgeTo = numOr(ageTo, MAX_AGE)

  const matchState = { active, keyword, yearFrom: effYearFrom, yearTo: effYearTo, ageFrom: effAgeFrom, ageTo: effAgeTo }

  const filtered = useMemo(
    () => studies.filter(s => studyMatches(s, { ...matchState, skipKey: null })),
    [active, keyword, effYearFrom, effYearTo, effAgeFrom, effAgeTo]
  )

  const renderFilterDropdown = key => {
    const f = FILTERS.find(x => x.key === key)
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
  }

  return (
    <div className="app-shell">
      <header className="app-header" style={{ backgroundImage: `url("${headerPattern}")` }}>
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

          {renderFilterDropdown('sex')}

          <div className="filter-field">
            <label>Age range</label>
            <div className="year-range">
              <input
                type="number"
                min={MIN_AGE}
                max={MAX_AGE}
                value={ageFrom}
                onChange={e => setAgeFrom(e.target.value === '' ? '' : Number(e.target.value))}
                onBlur={() => setAgeFrom(prev => numOr(prev, MIN_AGE))}
                aria-label="From age"
              />
              <span aria-hidden="true">–</span>
              <input
                type="number"
                min={MIN_AGE}
                max={MAX_AGE}
                value={ageTo}
                onChange={e => setAgeTo(e.target.value === '' ? '' : Number(e.target.value))}
                onBlur={() => setAgeTo(prev => numOr(prev, MAX_AGE))}
                aria-label="To age"
              />
            </div>
          </div>

          {FILTERS.filter(f => f.key !== 'sex').map(f => renderFilterDropdown(f.key))}

          <div className="filter-field">
            <label>Publication year</label>
            <div className="year-range">
              <input
                type="number"
                min={MIN_YEAR}
                max={MAX_YEAR}
                value={yearFrom}
                onChange={e => setYearFrom(e.target.value === '' ? '' : Number(e.target.value))}
                onBlur={() => setYearFrom(prev => numOr(prev, MIN_YEAR))}
                aria-label="From year"
              />
              <span aria-hidden="true">–</span>
              <input
                type="number"
                min={MIN_YEAR}
                max={MAX_YEAR}
                value={yearTo}
                onChange={e => setYearTo(e.target.value === '' ? '' : Number(e.target.value))}
                onBlur={() => setYearTo(prev => numOr(prev, MAX_YEAR))}
                aria-label="To year"
              />
            </div>
          </div>
        </div>

        <p className="result-count">{filtered.length} of {studies.length} studies</p>

        {view === 'dashboard' ? (
          <>
            <div className="charts-grid">
              <CategoryEffectivenessChart
                studies={filtered}
                title="Trial design & effectiveness"
                columnLabel="Trial design"
                categories={DESIGN_ORDER}
                getCategory={s => s.study_design}
              />
              <CategoryEffectivenessChart
                studies={filtered}
                title="Age group & effectiveness"
                columnLabel="Age group"
                categories={AGE_GROUP_ORDER}
                getCategory={s => s.population?.age_group_tag}
              />
              <CategoryEffectivenessChart
                studies={filtered}
                title="Income setting & effectiveness"
                columnLabel="Income setting"
                categories={INCOME_ORDER}
                getCategory={s => s.income_setting}
              />
              <CategoryEffectivenessChart
                studies={filtered}
                title="Region & effectiveness"
                columnLabel="Region"
                categories={REGION_ORDER}
                getCategory={s => s.region}
              />
            </div>

            <WorldMap
              studies={filtered}
              activeCountry={active.country}
              onSelectCountry={country => setFilter('country', active.country === country ? '' : country)}
            />

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
