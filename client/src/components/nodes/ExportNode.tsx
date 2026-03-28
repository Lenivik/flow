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

  const getExportUrl = () => {
    if (inputConnections.length === 0) return undefined
    const conn = inputConnections[0]
    const sourceData = getNode(conn.source)?.data as Record<string, unknown> | undefined
    if (conn.sourceHandle === 'image_result') return sourceData?.captureUrl as string | undefined
    if (conn.sourceHandle === 'result') return (sourceData?.modelFile || sourceData?.imageUrl) as string | undefined
    return sourceData?.imageUrl as string | undefined
  }

  const imageUrl = getExportUrl()

  const handleDownload = async () => {
    const currentUrl = getExportUrl()
    if (!currentUrl) return
    setDownloading(true)
    try {
      const res = await fetch(currentUrl)
      const blob = await res.blob()
      const ext = blob.type === 'model/gltf-binary' ? 'glb' : (blob.type.split('/')[1] || 'png')
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
    <div className={`bg-[#1a1a1a] border border-[#27272A] rounded-xl shadow-xl min-w-[240px] ${locked ? 'ring-1 ring-neutral-700' : ''}`}>
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

      <div className="flex flex-col p-4 gap-3.5">
        <span className="text-[10px] text-gray-500 font-mono bg-[#18181B] px-1.5 py-0.5 rounded border border-[#27272A] w-fit">Utility</span>

        <div className="flex justify-between items-center">
          {!imageUrl ? (
            <p className="text-[10px] text-neutral-500">Connect an image or 3D model to export</p>
          ) : <div />}
          <button
            onClick={handleDownload}
            disabled={!imageUrl || downloading}
            className="px-3 py-1 bg-[#cccccc] hover:bg-[#e0e0e0] disabled:bg-[#cccccc]/50 disabled:text-[#1C1C1E]/50 text-[#1C1C1E] text-[10px] font-bold rounded-sm flex items-center gap-1.5 transition-colors uppercase"
          >
            {downloading ? (
              <><Loader2 size={10} className="animate-spin" /> Saving</>
            ) : (
              <><Download size={10} /> Export</>
            )}
          </button>
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className={`!w-[7px] !h-[7px] !bg-[#00FFC5] !border-0 !-left-[9px] handle-green ${inputConnections.length > 0 ? 'connected' : ''}`}
        title="Input"
      />
      <div className="absolute text-[10px] bg-black/30 backdrop-blur-sm px-1 rounded font-medium" style={{ top: 'calc(50% - 24px)', right: 'calc(100% + 18px)', color: '#00FFC5' }}>Input</div>
    </div>
  )
}

export default memo(ExportNode)
