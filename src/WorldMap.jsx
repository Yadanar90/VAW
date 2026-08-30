import { useMemo, useRef, useState } from 'react'
import { feature } from 'topojson-client'
import { geoNaturalEarth1, geoPath } from 'd3-geo'
import worldTopo from 'world-atlas/countries-110m.json'
import { ViewToggle, CategoryStudyList } from './ChartControls.jsx'

const WIDTH = 960
const HEIGHT = 460

// Dataset country name -> world-atlas feature name, only where they differ.
const COUNTRY_ALIASES = { England: 'United Kingdom' }

const SEQUENTIAL_STEPS = ['#9ecbf5', '#63a2ec', '#3979dc', '#1f52a8', '#0d2f66']
const NO_DATA_FILL = '#eceae2'

function colorForCount(count, maxCount) {
  if (count === 0) return NO_DATA_FILL
  if (maxCount <= 1) return SEQUENTIAL_STEPS[2]
  const t = (count - 1) / (maxCount - 1)
  return SEQUENTIAL_STEPS[Math.round(t * (SEQUENTIAL_STEPS.length - 1))]
}

const rawFeatures = feature(worldTopo, worldTopo.objects.countries).features
  .filter(f => f.properties.name !== 'Antarctica')

// Natural Earth projection reads true, undistorted on a flat map (unlike the
// naive equirectangular projection, which visibly stretches landmasses at
// higher latitudes). fitExtent scales/centers it to the visible countries.
const projection = geoNaturalEarth1().fitExtent([[8, 8], [WIDTH - 8, HEIGHT - 8]], {
  type: 'FeatureCollection',
  features: rawFeatures,
})
const pathGenerator = geoPath(projection)

const countryFeatures = rawFeatures.map(f => ({ name: f.properties.name, d: pathGenerator(f) }))

export default function WorldMap({ studies, activeCountry, onSelectCountry }) {
  const [viewMode, setViewMode] = useState('chart')
  const [hover, setHover] = useState(null)
  const containerRef = useRef(null)

  const byMapName = useMemo(() => {
    const map = new Map()
    for (const s of studies) {
      const mapName = COUNTRY_ALIASES[s.country] || s.country
      if (!map.has(mapName)) map.set(mapName, { rawCountry: s.country, count: 0, studyNames: [], studies: [] })
      const entry = map.get(mapName)
      entry.count += 1
      entry.studyNames.push(s.intervention_name)
      entry.studies.push(s)
    }
    return map
  }, [studies])

  const maxCount = Math.max(1, ...[...byMapName.values()].map(v => v.count))

  const showTooltipAt = (clientX, clientY, mapName) => {
    const entry = byMapName.get(mapName)
    if (!entry) return
    const rect = containerRef.current.getBoundingClientRect()
    setHover({
      name: mapName,
      count: entry.count,
      studyNames: entry.studyNames,
      x: clientX - rect.left,
      y: clientY - rect.top,
    })
  }

  const tableRows = [...byMapName.entries()]
    .map(([mapName, v]) => ({ mapName, ...v }))
    .sort((a, b) => b.count - a.count)

  return (
    <section className="chart-card world-map-card">
      <div className="chart-head">
        <h2>Where the Evidence Comes From</h2>
        {tableRows.length > 0 && <ViewToggle mode={viewMode} onChange={setViewMode} />}
      </div>
      <p className="chart-subtitle">Which countries the included studies were conducted in, and how many per country.</p>

      {tableRows.length === 0 ? (
        <p className="chart-empty">No studies match these filters yet.</p>
      ) : viewMode === 'list' ? (
        <CategoryStudyList
          rows={tableRows.map(r => ({ label: r.rawCountry, total: r.count, studies: r.studies }))}
        />
      ) : viewMode === 'table' ? (
        <table className="chart-table">
          <thead>
            <tr><th>Country</th><th>Studies</th></tr>
          </thead>
          <tbody>
            {tableRows.map(r => (
              <tr key={r.mapName}>
                <td>{r.rawCountry}</td>
                <td>{r.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          <div className="map-legend">
            <span className="map-legend-label">Fewer studies</span>
            <span className="map-legend-gradient" aria-hidden="true" />
            <span className="map-legend-label">More studies</span>
            <span className="map-legend-item">
              <span className="map-legend-swatch" style={{ background: NO_DATA_FILL }} aria-hidden="true" />
              No studies
            </span>
          </div>

          <div className="map-container" ref={containerRef}>
            <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="world-map-svg" role="img" aria-label="Map of countries with included studies">
              {countryFeatures.map(({ name, d }) => {
                const entry = byMapName.get(name)
                const count = entry?.count || 0
                const isActive = entry && activeCountry === entry.rawCountry
                const interactive = count > 0
                return (
                  <path
                    key={name}
                    d={d}
                    className={`map-country${isActive ? ' is-active' : ''}${interactive ? ' is-interactive' : ''}`}
                    fill={colorForCount(count, maxCount)}
                    tabIndex={interactive ? 0 : undefined}
                    onMouseMove={interactive ? e => showTooltipAt(e.clientX, e.clientY, name) : undefined}
                    onMouseLeave={interactive ? () => setHover(null) : undefined}
                    onFocus={interactive ? e => {
                      const r = e.target.getBoundingClientRect()
                      showTooltipAt(r.left + r.width / 2, r.top + r.height / 2, name)
                    } : undefined}
                    onBlur={interactive ? () => setHover(null) : undefined}
                    onClick={interactive ? () => onSelectCountry(entry.rawCountry) : undefined}
                  >
                    {interactive && <title>{`${entry.rawCountry}: ${count} ${count === 1 ? 'study' : 'studies'}`}</title>}
                  </path>
                )
              })}
            </svg>

            {hover && (
              <div className="map-tooltip" style={{ left: hover.x, top: hover.y }} role="tooltip">
                <strong>{hover.name}</strong> — {hover.count} {hover.count === 1 ? 'study' : 'studies'}
                <ul>
                  {hover.studyNames.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              </div>
            )}
          </div>
          <p className="map-hint">Click a highlighted country to filter the list below by it.</p>
        </>
      )}
    </section>
  )
}
