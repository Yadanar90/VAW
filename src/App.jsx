import { useState, useMemo } from 'react'
import studies from './data/studies.json'
import './App.css'

const FILTERS = [
  { key: 'age', label: 'Age group', get: s => s.population?.age_group_tag, options: ['Under 10', '10-14', '15-19', 'Mixed/all ages'] },
  { key: 'sex', label: 'Population', get: s => s.population?.sex_tag, options: ['Girls only', 'Boys only', 'Mixed'] },
  { key: 'country', label: 'Country', get: s => s.country, options: [...new Set(studies.map(s => s.country))] },
  { key: 'region', label: 'Region', get: s => s.region, options: [...new Set(studies.map(s => s.region))] },
  { key: 'income', label: 'Income setting', get: s => s.income_setting, options: [...new Set(studies.map(s => s.income_setting).filter(Boolean))] },
  { key: 'setting', label: 'Setting', get: s => s.population?.setting, options: ['School', 'Community', 'Home/family', 'Mixed'] },
  { key: 'design', label: 'Study design', get: s => s.study_design, options: ['RCT', 'Quasi-experimental', 'Cohort', 'Qualitative', 'Systematic review/synthesis'] },
  { key: 'effect', label: 'Effectiveness', get: s => s.effect?.overall_tag, options: ['Worked', 'Mixed', "Didn't work"] },
  { key: 'completeness', label: 'Completeness', get: s => s.completeness === 'full' ? 'Full record' : 'Citation only', options: ['Full record', 'Citation only'] },
]

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
        <h1>VAWG Evidence Platform</h1>
        <p>Filter school-based intervention evidence for preventing violence against girls</p>
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

        <main className="results-grid">
          {filtered.length === 0 && <p className="no-results">No studies match these filters yet.</p>}
          {filtered.map(s => <StudyCard key={s.id} study={s} />)}
        </main>
      </div>
    </div>
  )
}
