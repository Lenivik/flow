import { memo, useState, Suspense } from 'react'
import { Handle, Position, useNodeConnections, useReactFlow, type NodeProps } from '@xyflow/react'
import { Loader2, Lock, Download, Box, ChevronLeft, ChevronRight, Grid3X3, Maximize2 } from 'lucide-react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, useGLTF, Environment, Center } from '@react-three/drei'
import NodeContextMenu from './NodeContextMenu'

const NODE_WIDTH = 352
const VIEWER_HEIGHT = 280

type HistoryEntry = { id: number; url: string }

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url)
  return (
    <Center>
      <primitive object={scene} />
    </Center>
  )
}

function TrellisNode({ id, data }: NodeProps) {
  const inputConnections = useNodeConnections({ handleType: 'target', handleId: 'input' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [gridView, setGridView] = useState(false)
  const { setNodes, setEdges, getNode } = useReactFlow()
  const locked = !!data.locked
  const d = data as Record<string, unknown>

  const modelFile = d.modelFile as string | undefined
  const history = (d.imageHistory as HistoryEntry[]) || []
  const imageIndex = (d.imageIndex as number) ?? history.length - 1
  const hasHistory = history.length > 1
  const canGoBack = imageIndex > 0
  const canGoForward = imageIndex < history.length - 1

  const navigateModel = (newIndex: number) => {
    if (newIndex < 0 || newIndex >= history.length) return
    const entry = history[newIndex]
    setNodes((nds) =>
      nds.map((n) => n.id === id ? { ...n, data: { ...n.data, modelFile: entry.url, activeImageId: entry.id, imageIndex: newIndex } } : n),
    )
  }

  const selectFromGrid = (index: number) => {
    navigateModel(index)
    setGridView(false)
  }

  const handleRunModel = () => {
    if (d.onRunTrellis) {
      setLoading(true)
      setError(null)
      ;(d.onRunTrellis as (nodeId: string) => Promise<string | null>)(id)
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
      data: { ...node.data, modelFile: undefined, locked: false, imageHistory: [], imageIndex: 0 },
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

  const handleDownload = (url: string, filename: string) => {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return (
    <div className={`bg-neutral-900 rounded-xl shadow-2xl ${locked ? 'ring-1 ring-neutral-700' : ''}`} style={{ width: NODE_WIDTH }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800/50">
        <span className="text-sm font-medium text-neutral-300 flex items-center gap-2">
          {locked && <Lock size={12} className="text-neutral-500" />}
          <Box size={14} className="text-purple-400" />
          Trellis
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

      {/* 3D Preview / Grid / Placeholder */}
      <div className="p-4">
        {gridView && history.length > 0 ? (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-1.5 nowheel nodrag">
              {history.map((entry, i) => (
                <button
                  key={entry.id}
                  onClick={() => selectFromGrid(i)}
                  className={`relative rounded-md overflow-hidden aspect-square flex items-center justify-center bg-neutral-800 ${i === imageIndex ? 'ring-2 ring-purple-500' : 'hover:ring-1 hover:ring-neutral-600'}`}
                >
                  <Box size={20} className={i === imageIndex ? 'text-purple-400' : 'text-neutral-500'} />
                  <span className="absolute bottom-0.5 right-1 text-[9px] text-neutral-500 tabular-nums">{i + 1}</span>
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
        ) : modelFile ? (
          <div className="relative group">
            <div className="w-full rounded-lg overflow-hidden nodrag nowheel" style={{ height: VIEWER_HEIGHT, background: '#1a1a1a' }}>
              <Canvas camera={{ position: [0, 0, 3], fov: 45 }}>
                <ambientLight intensity={0.6} />
                <directionalLight position={[5, 5, 5]} intensity={1} />
                <Suspense fallback={null}>
                  <Model url={modelFile} />
                  <Environment preset="studio" />
                </Suspense>
                <OrbitControls enablePan enableZoom enableRotate makeDefault />
              </Canvas>
            </div>

            {/* Top bar: arrows, counter, grid toggle */}
            {hasHistory && (
              <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button
                  onClick={() => navigateModel(imageIndex - 1)}
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
                  onClick={() => navigateModel(imageIndex + 1)}
                  disabled={!canGoForward}
                  className="p-1 rounded-full bg-black/60 text-white hover:bg-black/80 disabled:opacity-0 transition-all nodrag"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div
            className="w-full rounded-lg flex items-center justify-center"
            style={{
              height: 180,
              backgroundImage: `
                linear-gradient(45deg, #1a1a1a 25%, transparent 25%),
                linear-gradient(-45deg, #1a1a1a 25%, transparent 25%),
                linear-gradient(45deg, transparent 75%, #1a1a1a 75%),
                linear-gradient(-45deg, transparent 75%, #1a1a1a 75%)
              `,
              backgroundSize: '20px 20px',
              backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0',
              backgroundColor: '#252525',
            }}
          >
            <Box size={32} className="text-neutral-600" />
          </div>
        )}
      </div>

      {/* Download button */}
      {modelFile && (
        <div className="px-4 pb-3 nodrag">
          <button
            onClick={() => handleDownload(modelFile, `trellis-${Date.now()}.glb`)}
            className="w-full flex items-center justify-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg py-1.5 text-xs font-medium transition-colors"
          >
            <Download size={12} />
            Download GLB
          </button>
        </div>
      )}

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
              Generating 3D...
            </>
          ) : (
            'Generate 3D'
          )}
        </button>
        {inputConnections.length === 0 && !modelFile && (
          <p className="text-[10px] text-neutral-500 mt-2 text-center">Connect an image output to generate 3D</p>
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
    </div>
  )
}

export default memo(TrellisNode)
