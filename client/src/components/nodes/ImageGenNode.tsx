import { memo, useState, useRef, useEffect } from 'react'
import { Handle, Position, useNodeConnections, useReactFlow, type NodeProps } from '@xyflow/react'
import { Loader2, Lock } from 'lucide-react'
import NodeContextMenu from './NodeContextMenu'

const IMAGE_WIDTH = 320

function ImageGenNode({ id, data }: NodeProps) {
  const promptConnections = useNodeConnections({ handleType: 'target', handleId: 'prompt' })
  const negativeConnections = useNodeConnections({ handleType: 'target', handleId: 'negative_prompt' })
  const resultConnections = useNodeConnections({ handleType: 'source', handleId: 'result' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [imageHeight, setImageHeight] = useState<number | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const prevImageUrl = useRef<string | undefined>(undefined)
  const { setNodes, setEdges, getNode } = useReactFlow()
  const locked = !!data.locked

  const handleRunModel = () => {
    if (data.onRunModel) {
      setLoading(true)
      setError(null)
      ;(data.onRunModel as (nodeId: string) => Promise<string | null>)(id)
        .then((err) => { if (err) setError(err) })
        .finally(() => setLoading(false))
    }
  }

  const handleDuplicate = () => {
    const node = getNode(id)
    if (!node) return
    const newNode = {
      ...node,
      id: `temp_${Date.now()}`,
      position: { x: node.position.x + 50, y: node.position.y + 50 },
      selected: false,
      data: { ...node.data, imageUrl: undefined, locked: false },
      draggable: true,
    }
    setNodes((nds) => [...nds, newNode])
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

  const imageUrl = data.imageUrl as string | undefined

  // Reset when a new image URL appears
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
    const targetHeight = Math.round(IMAGE_WIDTH * aspect)
    // Start the animated transition
    requestAnimationFrame(() => {
      setImageHeight(targetHeight)
      setImageLoaded(true)
    })
  }

  // Placeholder height before image loads
  const placeholderHeight = 192
  const containerHeight = imageHeight ?? placeholderHeight

  return (
    <div className={`bg-neutral-900 rounded-xl shadow-2xl ${locked ? 'ring-1 ring-neutral-700' : ''}`} style={{ width: IMAGE_WIDTH + 32 }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800/50">
        <span className="text-sm font-medium text-neutral-300 flex items-center gap-2">
          {locked && <Lock size={12} className="text-neutral-500" />}
          Google Nano Banana
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

      {/* Image preview area */}
      <div className="p-4">
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
              alt="Generated"
              onLoad={handleImageLoad}
              className="w-full rounded-lg"
              style={{
                opacity: imageLoaded ? 1 : 0,
                transition: 'opacity 0.3s ease-in',
              }}
            />
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="px-4 pb-2">
          <p className="text-[11px] text-red-400">{error}</p>
        </div>
      )}

      {/* Run Model button */}
      <div className="px-4 pb-4">
        <button
          onClick={handleRunModel}
          disabled={loading || locked}
          className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 text-white rounded-lg py-2 text-sm font-medium transition-colors"
        >
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Generating...
            </>
          ) : (
            'Run Model'
          )}
        </button>
      </div>

      {/* Input handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="prompt"
        className={`!w-2.5 !h-2.5 !bg-purple-400 !border-0 !-left-[7px] handle-purple ${promptConnections.length > 0 ? 'connected' : ''}`}
        style={{ top: '35%' }}
        title="Prompt"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="negative_prompt"
        className={`!w-2.5 !h-2.5 !bg-purple-400 !border-0 !-left-[7px] handle-purple ${negativeConnections.length > 0 ? 'connected' : ''}`}
        style={{ top: '55%' }}
        title="Negative Prompt"
      />

      <div className="absolute left-3 text-[10px] text-purple-300 font-medium" style={{ top: 'calc(35% - 6px)' }}>Prompt</div>
      <div className="absolute left-3 text-[10px] text-purple-300 font-medium" style={{ top: 'calc(55% - 6px)' }}>Negative</div>

      {/* Output handle */}
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

export default memo(ImageGenNode)
