import { memo, useState } from 'react'
import { Handle, Position, useNodeConnections, useReactFlow, type NodeProps } from '@xyflow/react'
import { Download, Loader2 } from 'lucide-react'
import NodeHeader from './NodeHeader'
import { useNodeActions } from '../../hooks/useNodeActions'

function ExportNode({ id, data }: NodeProps) {
  const inputConnections = useNodeConnections({ handleType: 'target', handleId: 'input' })
  const [downloading, setDownloading] = useState(false)
  const { getNode } = useReactFlow()
  const locked = !!data.locked
  const { menuOpen, setMenuOpen, handleDuplicate, handleLock, handleDelete } = useNodeActions(id, locked)

  const getImageUrl = () => {
    if (inputConnections.length === 0) return undefined
    const sourceNode = getNode(inputConnections[0].source)
    return (sourceNode?.data as Record<string, unknown>)?.imageUrl as string | undefined
  }

  const imageUrl = getImageUrl()

  const handleDownload = async () => {
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

  return (
    <div className={`bg-neutral-900 rounded-xl shadow-2xl min-w-[240px] ${locked ? 'ring-1 ring-neutral-700' : ''}`}>
      <NodeHeader
        title="Export"
        locked={locked}
        menuOpen={menuOpen}
        onMenuToggle={() => setMenuOpen(!menuOpen)}
        onDuplicate={handleDuplicate}
        onLock={handleLock}
        onDelete={handleDelete}
        onCloseMenu={() => setMenuOpen(false)}
      />

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
