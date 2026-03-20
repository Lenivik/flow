import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'

function ImageGenNode({ data }: NodeProps) {
  return (
    <div className="bg-neutral-900 rounded-xl shadow-2xl min-w-[320px] max-w-[400px]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800/50">
        <span className="text-sm font-medium text-neutral-300">Google Nano Banana 2</span>
        <button className="text-neutral-500 hover:text-neutral-300 transition-colors">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="3" cy="8" r="1.5" />
            <circle cx="8" cy="8" r="1.5" />
            <circle cx="13" cy="8" r="1.5" />
          </svg>
        </button>
      </div>

      {/* Image preview area with checkerboard pattern */}
      <div className="p-4">
        <div
          className="w-full h-48 rounded-lg overflow-hidden"
          style={{
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
          {(data.imageUrl as string) && (
            <img src={data.imageUrl as string} alt="Generated" className="w-full h-full object-cover" />
          )}
        </div>
      </div>

      {/* Run Model button */}
      <div className="px-4 pb-4">
        <button
          className="w-full bg-purple-600 hover:bg-purple-500 text-white rounded-lg py-2 text-sm font-medium transition-colors"
          title="TODO: Connect to Google Nano Banana 2 API"
        >
          Run Model
        </button>
      </div>

      {/* Input handles - left side */}
      <Handle
        type="target"
        position={Position.Left}
        id="prompt"
        className="!w-2.5 !h-2.5 !bg-purple-400 !border-0 !-left-[7px] handle-purple"
        style={{ top: '35%' }}
        title="Prompt"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="negative_prompt"
        className="!w-2.5 !h-2.5 !bg-purple-400 !border-0 !-left-[7px] handle-purple"
        style={{ top: '55%' }}
        title="Negative Prompt"
      />

      {/* Labels for input handles */}
      <div className="absolute left-3 text-[10px] text-purple-300 font-medium" style={{ top: 'calc(35% - 6px)' }}>Prompt</div>
      <div className="absolute left-3 text-[10px] text-purple-300 font-medium" style={{ top: 'calc(55% - 6px)' }}>Negative</div>

      {/* Output handle - right side */}
      <Handle
        type="source"
        position={Position.Right}
        id="result"
        className="!w-2.5 !h-2.5 !bg-emerald-400 !border-0 !-right-[7px] handle-green"
        title="Result"
      />
      <div className="absolute right-3 text-[10px] text-emerald-300 font-medium" style={{ top: 'calc(50% - 6px)', textAlign: 'right' }}>Result</div>
    </div>
  )
}

export default memo(ImageGenNode)
