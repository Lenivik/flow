import { memo, useState } from 'react'
import { Handle, Position, useNodeConnections, useReactFlow, type NodeProps } from '@xyflow/react'
import { Download, Loader2, Lock } from 'lucide-react'
import NodeContextMenu from './NodeContextMenu'

function ExportNode({ id, data }: NodeProps) {
  const inputConnections = useNodeConnections({ handleType: 'target', handleId: 'input' })
  const [menuOpen, setMenuOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const { setNodes, setEdges, getNode } = useReactFlow()
  const locked = !!data.locked

  const getImageUrl = () => {
    if (inputConnections.length === 0) return undefined
    const sourceNode = getNode(inputConnections[0].source)
    return (sourceNode?.data as Record<string, unknown>)?.imageUrl as string | undefined
  }

  const imageUrl = getImageUrl()

  const handleDownload = async () => {
    // Re-read at download time to always get the latest image
    const currentUrl = getImageUrl()
    if (!currentUrl) return
    setDownloading(true)
    try {
      const res = await fetch(currentUrl)
      const blob = await res.blob()
      const ext = blob.type.split('/')[1] || 'png'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `export-${Date.now()}.${ext}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
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
      data: { ...node.data, locked: false },
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

  return (
    <div className={`bg-neutral-900 rounded-xl shadow-2xl min-w-[240px] ${locked ? 'ring-1 ring-neutral-700' : ''}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800/50">
        <span className="text-sm font-medium text-neutral-300 flex items-center gap-2">
          {locked && <Lock size={12} className="text-neutral-500" />}
          Export
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
        <button
          onClick={handleDownload}
          disabled={!imageUrl || downloading}
          className="w-full flex items-center justify-center gap-2 bg-neutral-800 hover:bg-neutral-700 disabled:bg-neutral-800/50 disabled:text-neutral-500 text-neutral-300 rounded-lg py-2.5 text-sm font-medium transition-colors"
        >
          {downloading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Downloading...
            </>
          ) : (
            <>
              <Download size={16} />
              Download
            </>
          )}
        </button>
        {!imageUrl && (
          <p className="text-[10px] text-neutral-500 mt-2 text-center">Connect an image output to export</p>
        )}
      </div>

      {/* Input handle */}
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

export default memo(ExportNode)
