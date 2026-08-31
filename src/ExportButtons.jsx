import { exportToExcel, exportToPdf } from './export.js'

// Shared by the dashboard and the results view - both already compute the
// same `resultsSource` (filtered studies, or a clicked segment's studies
// when one is selected), so exporting always matches what's on screen.
export default function ExportButtons({ studies, collectionLabel }) {
  const disabled = studies.length === 0
  return (
    <div className="export-buttons">
      <button
        type="button"
        className="export-btn"
        onClick={() => exportToPdf(studies, { collectionLabel })}
        disabled={disabled}
      >
        Export PDF
      </button>
      <button
        type="button"
        className="export-btn"
        onClick={() => exportToExcel(studies)}
        disabled={disabled}
      >
        Export Excel
      </button>
    </div>
  )
}
