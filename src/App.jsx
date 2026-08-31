import { useState, useMemo, useEffect, useRef } from 'react'
import studies from './data/studies.json'
import WorldMap from './WorldMap'
import { EFFECT_STATUS, ViewToggle, CategoryStudyList, StudyModal } from './ChartControls.jsx'
import ExportButtons from './ExportButtons.jsx'
import './App.css'

const FILTERS = [
  { key: 'sex', label: 'Population', get: s => s.population?.sex_tag, options: ['Girls only', 'Boys only', 'Women only', 'Mixed'] },
  { key: 'country', label: 'Country', get: s => s.country, options: [...new Set(studies.map(s => s.country))] },
  { key: 'region', label: 'Region', get: s => s.region, options: [...new Set(studies.map(s => s.region))] },
  { key: 'income', label: 'Income setting', get: s => s.income_setting, options: [...new Set(studies.map(s => s.income_setting).filter(Boolean))] },
  { key: 'setting', label: 'Intervention setting', get: s => s.population?.setting, options: ['School', 'Community', 'Home/family', 'Online/digital', 'Mixed'] },
  { key: 'ageGroup', label: 'Age group', get: s => s.population?.age_group_tag, options: ['Under 10', '10-14', '15-19', 'Mixed/all ages'] },
  { key: 'duration', label: 'Duration', get: s => s.intervention?.duration_bucket, options: ['Short (<6 months)', 'Medium (6-18 months)', 'Long (>18 months)', 'Not reported'] },
  { key: 'design', label: 'Study design', get: s => s.study_design, options: ['RCT', 'Quasi-experimental', 'Cohort', 'Qualitative'] },
  { key: 'effect', label: 'Effectiveness', get: s => s.effect?.overall_tag, options: ['Worked', 'Mixed', "Didn't work"] },
]

const DESIGN_ORDER = FILTERS.find(f => f.key === 'design').options
const AGE_GROUP_ORDER = ['Under 10', '10-14', '15-19', 'Mixed/all ages']
const INCOME_ORDER = ['Low income', 'Lower middle income', 'Upper middle income', 'High income']
const REGION_ORDER = [...new Set(studies.map(s => s.region))]
const SETTING_ORDER = ['School', 'Community', 'Home/family', 'Online/digital', 'Mixed']
const DURATION_ORDER = ['Short (<6 months)', 'Medium (6-18 months)', 'Long (>18 months)', 'Not reported']
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
function CategoryEffectivenessChart({ studies, title, subtitle, columnLabel, categories, getCategory, onSegmentSelect }) {
  const [viewMode, setViewMode] = useState('chart')
  // A segment click drills this chart - and only this chart - into its own
  // List view for just that category+effectiveness combination; it never
  // touches the shared filters, other charts, or the results count. It
  // also reports the matching studies up to App() (onSegmentSelect) so
  // the dashboard's "Read matching studies" button can offer to jump
  // straight to just these studies, without that reporting affecting how
  // any other chart renders.
  const [selected, setSelected] = useState(null) // { category, effectKey } | null

  const rows = useMemo(() => {
    return categories
      .map(category => {
        const inCategory = studies.filter(s => getCategory(s) === category)
        const segments = EFFECT_STATUS.map(e => ({
          ...e,
          count: inCategory.filter(s => s.effect?.overall_tag === e.key).length,
        }))
        return { category, total: inCategory.length, segments, studies: inCategory }
      })
      .filter(r => r.total > 0)
  }, [studies, categories, getCategory])

  const maxTotal = Math.max(1, ...rows.map(r => r.total))

  const isSelected = (category, effectKey) => selected?.category === category && selected?.effectKey === effectKey
  const handleSegmentClick = (category, effectKey) => {
    if (isSelected(category, effectKey)) {
      setSelected(null)
      onSegmentSelect?.(null)
    } else {
      setSelected({ category, effectKey })
      setViewMode('list')
      const matching = rows.find(r => r.category === category)?.studies.filter(s => s.effect?.overall_tag === effectKey) ?? []
      const effectLabel = EFFECT_STATUS.find(e => e.key === effectKey)?.label ?? effectKey
      onSegmentSelect?.(matching, `${columnLabel}: ${category} · ${effectLabel}`)
    }
  }
  const handleViewChange = mode => {
    if (selected) onSegmentSelect?.(null)
    setSelected(null)
    setViewMode(mode)
  }

  const listRows = selected
    ? rows
        .filter(r => r.category === selected.category)
        .map(r => ({ label: r.category, total: r.studies.filter(s => s.effect?.overall_tag === selected.effectKey).length, studies: r.studies.filter(s => s.effect?.overall_tag === selected.effectKey) }))
    : rows.map(r => ({ label: r.category, total: r.total, studies: r.studies }))

  return (
    <section className="chart-card">
      <div className="chart-head">
        <h2>{title}</h2>
        {rows.length > 0 && <ViewToggle mode={viewMode} onChange={handleViewChange} />}
      </div>
      {subtitle && <p className="chart-subtitle">{subtitle}</p>}

      {rows.length === 0 ? (
        <p className="chart-empty">No studies match these filters yet.</p>
      ) : (
        <>
          {viewMode !== 'list' && (
            <div className="chart-legend">
              {EFFECT_STATUS.map(e => (
                <span className="legend-item" key={e.key}>
                  <span className={`legend-swatch status-${e.status}`} aria-hidden="true">{e.icon}</span>
                  {e.label}
                </span>
              ))}
            </div>
          )}

          {viewMode === 'list' ? (
            <CategoryStudyList rows={listRows} onClear={selected ? () => setSelected(null) : undefined} />
          ) : viewMode === 'table' ? (
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
                          className={`bar-segment status-${s.status}${isSelected(r.category, s.key) ? ' is-selected' : ''}`}
                          style={{ flexGrow: s.count, flexBasis: 0 }}
                          onClick={() => handleSegmentClick(r.category, s.key)}
                          aria-pressed={isSelected(r.category, s.key)}
                        >
                          {(s.count / r.total) * 100 >= 14 && <span className="segment-label">{s.count}</span>}
                          <span className="segment-tooltip" role="tooltip">
                            <strong>{s.count}</strong> {s.label} · {r.category} · click to list these studies
                          </span>
                          <span className="sr-only">{`${r.category}: ${s.count} of ${r.total} studies ${s.label}. Click to list these studies here.`}</span>
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

function StudyCard({ study, selected, onToggleSelect }) {
  const [showModal, setShowModal] = useState(false)
  const isFull = study.completeness === 'full'
  const effectTag = study.effect?.overall_tag
  const effectMeta = EFFECT_STATUS.find(e => e.key === effectTag)

  return (
    <div className="study-card">
      <div className="card-tags">
        {onToggleSelect && (
          <input
            type="checkbox"
            className="study-select"
            checked={selected}
            onChange={() => onToggleSelect(study.id)}
            aria-label={`Select ${study.intervention_name} for export`}
          />
        )}
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

          <button className="show-more-btn" onClick={() => setShowModal(true)}>
            Show more
          </button>

          {showModal && <StudyModal study={study} onClose={() => setShowModal(false)} />}
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

  const [resetSignal, setResetSignal] = useState(0)
  // Set by a chart's segment click (via onSegmentSelect) to scope the
  // bottom "Read matching studies" button/results view to just that
  // segment's studies, independent of the shared filters.
  const [segmentSelection, setSegmentSelection] = useState(null) // { label, studies } | null
  // Hand-picked studies to export from the results view. Empty = export
  // everything currently shown, same as before this existed.
  const [selectedIds, setSelectedIds] = useState(new Set())

  const setFilter = (key, value) => setActive(prev => ({ ...prev, [key]: value }))
  const toggleSelected = id => setSelectedIds(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  // The inputs allow a transient empty string while typing (e.g. after
  // backspacing to clear a field) without forcing it back to a number on
  // every keystroke - see the range inputs below. An empty field just means
  // "no bound on this side yet" for filtering purposes.
  const numOr = (raw, fallback) => (raw === '' || Number.isNaN(raw) ? fallback : raw)
  const effYearFrom = numOr(yearFrom, MIN_YEAR)
  const effYearTo = numOr(yearTo, MAX_YEAR)
  const effAgeFrom = numOr(ageFrom, MIN_AGE)
  const effAgeTo = numOr(ageTo, MAX_AGE)

  const hasActiveFilters = keyword !== '' || Object.values(active).some(Boolean)
    || effYearFrom !== MIN_YEAR || effYearTo !== MAX_YEAR || effAgeFrom !== MIN_AGE || effAgeTo !== MAX_AGE

  const resetFilters = () => {
    setKeyword('')
    setActive({})
    setYearFrom(MIN_YEAR)
    setYearTo(MAX_YEAR)
    setAgeFrom(MIN_AGE)
    setAgeTo(MAX_AGE)
    setSegmentSelection(null)
    setSelectedIds(new Set())
    setResetSignal(n => n + 1)
  }

  const matchState = { active, keyword, yearFrom: effYearFrom, yearTo: effYearTo, ageFrom: effAgeFrom, ageTo: effAgeTo }

  const filtered = useMemo(
    () => studies.filter(s => studyMatches(s, { ...matchState, skipKey: null })),
    [active, keyword, effYearFrom, effYearTo, effAgeFrom, effAgeTo]
  )

  const resultsSource = segmentSelection ? segmentSelection.studies : filtered
  const handleSegmentSelect = (matching, label) => setSegmentSelection(matching ? { label, studies: matching } : null)
  const collectionLabel = segmentSelection ? segmentSelection.label : hasActiveFilters ? 'Filtered results' : 'All studies'

  // A hand-picked subset (results view only) narrows what gets exported;
  // with nothing selected, export behaves exactly as it did before.
  const exportStudies = selectedIds.size > 0 ? resultsSource.filter(s => selectedIds.has(s.id)) : resultsSource
  const exportCollectionLabel = selectedIds.size > 0
    ? `${selectedIds.size} selected ${selectedIds.size === 1 ? 'study' : 'studies'}`
    : collectionLabel

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
      <header className="app-header">
        <span className="header-kicker">Evidence for prevention</span>
        <h1>Prevention of Violence Against Women and Girls Evidence Platform</h1>
      </header>

      <div className="beta-banner">
        This platform is in beta. New studies are being added on an ongoing basis.
      </div>

      <div className="app-body">
        <div className="filter-bar">
          <div className="filter-bar-head">
            <button
              type="button"
              className="reset-filters-btn"
              onClick={resetFilters}
              disabled={!hasActiveFilters}
            >
              Reset all filters
            </button>
          </div>
          <div className="filter-bar-fields">
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
        </div>

        <p className="result-count">{filtered.length} of {studies.length} studies</p>

        {view === 'dashboard' ? (
          <>
            <div className="charts-grid">
              <CategoryEffectivenessChart
                key={`design-${resetSignal}`}
                studies={filtered}
                title="Trial Design & Effectiveness"
                subtitle="Whether the strength of the evidence (RCT vs quasi-experimental) tracks with how often the intervention worked."
                columnLabel="Trial design"
                categories={DESIGN_ORDER}
                getCategory={s => s.study_design}
                onSegmentSelect={handleSegmentSelect}
              />
              <CategoryEffectivenessChart
                key={`ageGroup-${resetSignal}`}
                studies={filtered}
                title="Age Group & Effectiveness"
                subtitle="Which age groups interventions tend to be effective for."
                columnLabel="Age group"
                categories={AGE_GROUP_ORDER}
                getCategory={s => s.population?.age_group_tag}
                onSegmentSelect={handleSegmentSelect}
              />
              <CategoryEffectivenessChart
                key={`setting-${resetSignal}`}
                studies={filtered}
                title="Intervention Setting & Effectiveness"
                subtitle="Whether delivery setting - school, community, home, or online - affects effectiveness."
                columnLabel="Setting"
                categories={SETTING_ORDER}
                getCategory={s => s.population?.setting}
                onSegmentSelect={handleSegmentSelect}
              />
              <CategoryEffectivenessChart
                key={`duration-${resetSignal}`}
                studies={filtered}
                title="Intervention Duration & Effectiveness"
                subtitle="Whether longer programmes are more likely to work than shorter ones."
                columnLabel="Duration"
                categories={DURATION_ORDER}
                getCategory={s => s.intervention?.duration_bucket}
                onSegmentSelect={handleSegmentSelect}
              />
              <CategoryEffectivenessChart
                key={`income-${resetSignal}`}
                studies={filtered}
                title="Income Setting & Effectiveness"
                subtitle="Whether interventions work differently depending on the country's income level."
                columnLabel="Income setting"
                categories={INCOME_ORDER}
                getCategory={s => s.income_setting}
                onSegmentSelect={handleSegmentSelect}
              />
              <CategoryEffectivenessChart
                key={`region-${resetSignal}`}
                studies={filtered}
                title="Region & Effectiveness"
                subtitle="Where the evidence base is strongest, and how effectiveness varies by region."
                columnLabel="Region"
                categories={REGION_ORDER}
                getCategory={s => s.region}
                onSegmentSelect={handleSegmentSelect}
              />
            </div>

            <WorldMap
              key={`map-${resetSignal}`}
              studies={filtered}
              activeCountry={active.country}
              onSelectCountry={country => setFilter('country', active.country === country ? '' : country)}
            />

            <button className="view-results-cta" onClick={() => setView('results')} disabled={resultsSource.length === 0}>
              {resultsSource.length === 0
                ? 'No studies match these filters yet'
                : (
                  <>
                    Read {resultsSource.length} {resultsSource.length === 1 ? 'study' : 'studies'}
                    {segmentSelection ? <> — {segmentSelection.label}</> : ' matching these filters'}
                    {' '}<span className="cta-arrow">→</span>
                  </>
                )}
            </button>
            {segmentSelection && (
              <button type="button" className="clear-segment-btn" onClick={() => setSegmentSelection(null)}>
                Show all {filtered.length} matching studies instead
              </button>
            )}
            <ExportButtons studies={resultsSource} collectionLabel={collectionLabel} />
          </>
        ) : (
          <>
            <div className="results-toolbar">
              <button
                className="back-to-dashboard"
                onClick={() => { setSegmentSelection(null); setSelectedIds(new Set()); setView('dashboard') }}
              >
                &larr; Back to overview
              </button>
              <div className="selection-controls">
                {selectedIds.size > 0 && (
                  <button type="button" className="clear-selection-btn" onClick={() => setSelectedIds(new Set())}>
                    Clear selection
                  </button>
                )}
                <button
                  type="button"
                  className="select-all-btn"
                  onClick={() => setSelectedIds(new Set(resultsSource.map(s => s.id)))}
                  disabled={resultsSource.length === 0}
                >
                  Select all
                </button>
              </div>
              <ExportButtons studies={exportStudies} collectionLabel={exportCollectionLabel} />
            </div>

            <main className="results-grid">
              {resultsSource.length === 0 && <p className="no-results">No studies match these filters yet.</p>}
              {resultsSource.map(s => (
                <StudyCard
                  key={s.id}
                  study={s}
                  selected={selectedIds.has(s.id)}
                  onToggleSelect={toggleSelected}
                />
              ))}
            </main>
          </>
        )}
      </div>
    </div>
  )
}
