import { type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Grid3X3, Maximize2 } from 'lucide-react'

export type HistoryEntry = { id: number; url: string }

interface GridViewProps {
  history: HistoryEntry[]
  imageIndex: number
  onSelect: (index: number) => void
  onClose: () => void
  renderThumb?: (entry: HistoryEntry, index: number) => ReactNode
}

export function GridView({ history, imageIndex, onSelect, onClose, renderThumb }: GridViewProps) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1.5 nowheel nodrag">
        {history.map((entry, i) => (
          <button
            key={entry.id}
            onClick={() => onSelect(i)}
            className={`relative rounded-md overflow-hidden aspect-square ${i === imageIndex ? 'ring-2 ring-purple-500' : 'hover:ring-1 hover:ring-neutral-600'}`}
          >
            {renderThumb ? renderThumb(entry, i) : (
              <img src={entry.url} alt="" className="w-full h-full object-cover" />
            )}
          </button>
        ))}
      </div>
      <button
        onClick={onClose}
        className="w-full flex items-center justify-center gap-1.5 text-[11px] text-neutral-400 hover:text-neutral-200 py-1 transition-colors"
      >
        <Maximize2 size={11} />
        Single view
      </button>
    </div>
  )
}

interface NavigationOverlayProps {
  imageIndex: number
  total: number
  onPrev: () => void
  onNext: () => void
  onGridView: () => void
}

export function NavigationOverlay({ imageIndex, total, onPrev, onNext, onGridView }: NavigationOverlayProps) {
  if (total <= 1) return null

  return (
    <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity z-10">
      <button
        onClick={onPrev}
        disabled={imageIndex <= 0}
        className="p-1 rounded-full bg-black/60 text-white hover:bg-black/80 disabled:opacity-0 transition-all nodrag"
      >
        <ChevronLeft size={16} />
      </button>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-white bg-black/60 rounded-full px-2 py-0.5 tabular-nums">
          {imageIndex + 1} / {total}
        </span>
        <button
          onClick={onGridView}
          className="p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors nodrag"
        >
          <Grid3X3 size={12} />
        </button>
      </div>
      <button
        onClick={onNext}
        disabled={imageIndex >= total - 1}
        className="p-1 rounded-full bg-black/60 text-white hover:bg-black/80 disabled:opacity-0 transition-all nodrag"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
