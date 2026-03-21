import { memo } from 'react'
import { Handle, Position, useHandleConnections, type NodeProps } from '@xyflow/react'
import { Download } from 'lucide-react'

function ExportNode(_props: NodeProps) {
  const inputConnections = useHandleConnections({ type: 'target', id: 'input' })

  return (
    <div className="bg-neutral-900 rounded-xl shadow-2xl min-w-[240px]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800/50">
        <span className="text-sm font-medium text-neutral-300">Export</span>
        <button className="text-neutral-500 hover:text-neutral-300 transition-colors">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="3" cy="8" r="1.5" />
            <circle cx="8" cy="8" r="1.5" />
            <circle cx="13" cy="8" r="1.5" />
          </svg>
        </button>
      </div>

      <div className="p-4">
        <button
          className="w-full flex items-center justify-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg py-2.5 text-sm font-medium transition-colors"
        >
          <Download size={16} />
          Download
        </button>
        <p className="text-[10px] text-neutral-500 mt-2 text-center">Connect an image output to export</p>
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
