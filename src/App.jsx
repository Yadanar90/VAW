import { useState, useMemo } from 'react'
import studies from './data/studies.json'
import './App.css'

const FILTERS = [
  { key: 'age', label: 'Age group', get: s => s.population?.age_group_tag, options: ['Under 10', '10-14', '15-19', 'Mixed/all ages'] },
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

  return (
    <div className="study-card">
      <div className="card-tags">
        {isFull && study.study_design && <span className="tag tag-accent">{study.study_design}</span>}
        <span className={`tag ${isFull ? 'tag-success' : 'tag-neutral'}`}>
          {isFull ? 'Full record' : 'Citation only'}
        </span>
      </div>
      <h3>{study.intervention_name}</h3>
      <p className="citation">{study.citation}{study.source ? ` · ${study.source}` : ''}</p>
      <p className="location">{study.country}{study.region ? `, ${study.region}` : ''}</p>

      {isFull ? (
        <>
          <p className="quick-facts">
            {study.population.age_range} · n={study.population.sample_size}
          </p>
          <p className="key-message">{study.key_message}</p>

          <button className="expand-btn" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Show less' : 'Show full detail'}
          </button>

          {expanded && (
            <div className="detail-panel">
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
  const [keyword, setKeyword] = useState('')
  const [active, setActive] = useState({})

  const setFilter = (key, value) => setActive(prev => ({ ...prev, [key]: value }))

  const filtered = useMemo(() => {
    return studies.filter(s => {
      for (const f of FILTERS) {
        const val = active[f.key]
        if (val && f.get(s) !== val) return false
      }
      if (keyword) {
        const hay = `${s.intervention_name} ${s.citation} ${s.country}`.toLowerCase()
        if (!hay.includes(keyword.toLowerCase())) return false
      }
      return true
    })
  }, [active, keyword])

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
          {FILTERS.map(f => (
            <div className="filter-field" key={f.key}>
              <label>{f.label}</label>
              <select value={active[f.key] || ''} onChange={e => setFilter(f.key, e.target.value)}>
                <option value="">Any</option>
                {f.options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>

        <p className="result-count">{filtered.length} of {studies.length} studies</p>

        <EffectivenessChart studies={filtered} />

        <main className="results-grid">
          {filtered.length === 0 && <p className="no-results">No studies match these filters yet.</p>}
          {filtered.map(s => <StudyCard key={s.id} study={s} />)}
        </main>
      </div>
    </div>
  )
}
