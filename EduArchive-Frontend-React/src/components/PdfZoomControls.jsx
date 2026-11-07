import { HiOutlineZoomIn, HiOutlineZoomOut } from 'react-icons/hi'

export default function PdfZoomControls({ zoom, onChange }) {
  return (
    <div className="pdf-zoom-controls inline-flex items-center gap-1 rounded-lg border border-gray-600 bg-gray-800 p-1 text-white" role="group" aria-label="PDF zoom">
      <button type="button" aria-label="Zoom out" title="Zoom out" disabled={zoom <= 0.25}
        onClick={() => onChange(value => Math.max(0.25, +(value - 0.25).toFixed(2)))}
        className="p-1.5 rounded hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">
        <HiOutlineZoomOut className="w-5 h-5" />
      </button>
      <button type="button" onClick={() => onChange(1)} title="Reset zoom" aria-label="Reset zoom"
        className="min-w-12 px-1 py-1.5 text-xs font-semibold rounded hover:bg-gray-700">{Math.round(zoom * 100)}%</button>
      <button type="button" aria-label="Zoom in" title="Zoom in" disabled={zoom >= 3}
        onClick={() => onChange(value => Math.min(3, +(value + 0.25).toFixed(2)))}
        className="p-1.5 rounded hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">
        <HiOutlineZoomIn className="w-5 h-5" />
      </button>
    </div>
  )
}
