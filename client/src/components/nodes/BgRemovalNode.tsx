import { memo, useState, useRef, useEffect } from 'react'
import { Handle, Position, useNodeConnections, useReactFlow, type NodeProps } from '@xyflow/react'
import { Loader2, Lock, ChevronLeft, ChevronRight, Grid3X3, Maximize2 } from 'lucide-react'
import NodeContextMenu from './NodeContextMenu'

const IMAGE_WIDTH = 320

type HistoryEntry = { id: number; url: string }

function BgRemovalNode({ id, data }: NodeProps) {
  const inputConnections = useNodeConnections({ handleType: 'target', handleId: 'input' })
  const resultConnections = useNodeConnections({ handleType: 'source', handleId: 'result' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [imageHeight, setImageHeight] = useState<number | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [gridView, setGridView] = useState(false)
  const prevImageUrl = useRef<string | undefined>(undefined)
  const { setNodes, setEdges, getNode } = useReactFlow()
  const locked = !!data.locked
  const d = data as Record<string, unknown>

  const history = (d.imageHistory as HistoryEntry[]) || []
  const imageIndex = (d.imageIndex as number) ?? history.length - 1

  const navigateImage = (newIndex: number) => {
    if (newIndex < 0 || newIndex >= history.length) return
    const entry = history[newIndex]
    setNodes((nds) =>
      nds.map((n) => n.id === id ? { ...n, data: { ...n.data, imageUrl: entry.url, activeImageId: entry.id, imageIndex: newIndex } } : n),
    )
  }

  const selectFromGrid = (index: number) => {
    navigateImage(index)
    setGridView(false)
  }

  const handleRunModel = () => {
    if (d.onRunBgRemoval) {
      setLoading(true)
      setError(null)
      ;(d.onRunBgRemoval as (nodeId: string) => Promise<string | null>)(id)
        .then((err) => { if (err) setError(err) })
        .finally(() => setLoading(false))
    }
  }

  const handleDuplicate = () => {
    const node = getNode(id)
    if (!node) return
    setNodes((nds) => [...nds, {
      ...node,
      id: `temp_${Date.now()}`,
      position: { x: node.position.x + 50, y: node.position.y + 50 },
      selected: false,
      data: { ...node.data, imageUrl: undefined, locked: false, imageHistory: [], imageIndex: 0 },
      draggable: true,
    }])
    setMenuOpen(false)
  }

  const handleLock = () => {
    setNodes((nds) =>
      nds.map((n) => n.id === id ? { ...n, draggable: locked, data: { ...n.data, locked: !locked } } : n),
    )
    setMenuOpen(false)
  }

  const handleDelete = () => {
    if (locked) return
    setNodes((nds) => nds.filter((n) => n.id !== id))
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id))
    setMenuOpen(false)
  }

  const imageUrl = d.imageUrl as string | undefined

  useEffect(() => {
    if (imageUrl && imageUrl !== prevImageUrl.current) {
      setImageLoaded(false)
      setImageHeight(null)
    }
    prevImageUrl.current = imageUrl
  }, [imageUrl])

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    const aspect = img.naturalHeight / img.naturalWidth
    requestAnimationFrame(() => {
      setImageHeight(Math.round(IMAGE_WIDTH * aspect))
      setImageLoaded(true)
    })
  }

  const containerHeight = imageHeight ?? 160
  const hasHistory = history.length > 1
  const canGoBack = imageIndex > 0
  const canGoForward = imageIndex < history.length - 1

  return (
    <div className={`bg-neutral-900 rounded-xl shadow-2xl ${locked ? 'ring-1 ring-neutral-700' : ''}`} style={{ width: IMAGE_WIDTH + 32 }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800/50">
        <span className="text-sm font-medium text-neutral-300 flex items-center gap-2">
          {locked && <Lock size={12} className="text-neutral-500" />}
          BG Removal
        </span>
        <div className="relative">
          <button onClick={() => setMenuOpen(!menuOpen)} className="text-neutral-500 hover:text-neutral-300 transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="3" cy="8" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="13" cy="8" r="1.5" />
            </svg>
          </button>
          {menuOpen && (
            <NodeContextMenu
              locked={locked}
              onDuplicate={handleDuplicate}
              onRename={() => setMenuOpen(false)}
              onLock={handleLock}
              onDelete={handleDelete}
              onClose={() => setMenuOpen(false)}
            />
          )}
        </div>
      </div>

      <div className="p-4">
        {gridView && history.length > 0 ? (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-1.5 nowheel nodrag">
              {history.map((entry, i) => (
                <button
                  key={entry.id}
                  onClick={() => selectFromGrid(i)}
                  className={`relative rounded-md overflow-hidden aspect-square ${i === imageIndex ? 'ring-2 ring-purple-500' : 'hover:ring-1 hover:ring-neutral-600'}`}
                >
                  <img src={entry.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
            <button
              onClick={() => setGridView(false)}
              className="w-full flex items-center justify-center gap-1.5 text-[11px] text-neutral-400 hover:text-neutral-200 py-1 transition-colors"
            >
              <Maximize2 size={11} />
              Single view
            </button>
          </div>
        ) : (
          <div className="relative group">
            <div
              className="w-full rounded-lg overflow-hidden"
              style={{
                height: containerHeight,
                transition: 'height 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                ...(imageUrl ? {} : {
                  backgroundImage: `
                    linear-gradient(45deg, #1a1a1a 25%, transparent 25%),
                    linear-gradient(-45deg, #1a1a1a 25%, transparent 25%),
                    linear-gradient(45deg, transparent 75%, #1a1a1a 75%),
                    linear-gradient(-45deg, transparent 75%, #1a1a1a 75%)
                  `,
                  backgroundSize: '20px 20px',
                  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0',
                  backgroundColor: '#252525',
                }),
              }}
            >
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt="BG Removed"
                  onLoad={handleImageLoad}
                  className="w-full rounded-lg"
                  style={{ opacity: imageLoaded ? 1 : 0, transition: 'opacity 0.3s ease-in' }}
                />
              )}
            </div>

            {hasHistory && imageUrl && (
              <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => navigateImage(imageIndex - 1)}
                  disabled={!canGoBack}
                  className="p-1 rounded-full bg-black/60 text-white hover:bg-black/80 disabled:opacity-0 transition-all nodrag"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white bg-black/60 rounded-full px-2 py-0.5 tabular-nums">
                    {imageIndex + 1} / {history.length}
                  </span>
                  <button
                    onClick={() => setGridView(true)}
                    className="p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors nodrag"
                  >
                    <Grid3X3 size={12} />
                  </button>
                </div>
                <button
                  onClick={() => navigateImage(imageIndex + 1)}
                  disabled={!canGoForward}
                  className="p-1 rounded-full bg-black/60 text-white hover:bg-black/80 disabled:opacity-0 transition-all nodrag"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="px-4 pb-2">
          <p className="text-[11px] text-red-400">{error}</p>
        </div>
      )}

      <div className="px-4 pb-4">
        <button
          onClick={handleRunModel}
          disabled={loading || locked}
          className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 text-white rounded-lg py-2 text-sm font-medium transition-colors"
        >
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Processing...
            </>
          ) : (
            'Remove Background'
          )}
        </button>
        {inputConnections.length === 0 && !imageUrl && (
          <p className="text-[10px] text-neutral-500 mt-2 text-center">Connect an image output to process</p>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className={`!w-2.5 !h-2.5 !bg-emerald-400 !border-0 !-left-[7px] handle-green ${inputConnections.length > 0 ? 'connected' : ''}`}
        title="Input"
      />
      <div className="absolute left-3 text-[10px] text-emerald-300 font-medium" style={{ top: 'calc(50% - 6px)' }}>Input</div>

      <Handle
        type="source"
        position={Position.Right}
        id="result"
        className={`!w-2.5 !h-2.5 !bg-emerald-400 !border-0 !-right-[7px] handle-green ${resultConnections.length > 0 ? 'connected' : ''}`}
        title="Result"
      />
      <div className="absolute right-3 text-[10px] text-emerald-300 font-medium" style={{ top: 'calc(50% - 6px)', textAlign: 'right' }}>Result</div>
    </div>
  )
}

export default memo(BgRemovalNode)
