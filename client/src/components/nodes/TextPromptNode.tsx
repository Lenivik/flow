import { memo, useCallback } from 'react'
import { Handle, Position, useHandleConnections, type NodeProps } from '@xyflow/react'

function TextPromptNode({ id, data }: NodeProps) {
  const promptConnections = useHandleConnections({ type: 'source', id: 'prompt' })

  const onChange = useCallback(
    (evt: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (data.onChange) {
        (data.onChange as (id: string, value: string) => void)(id, evt.target.value)
      }
    },
    [id, data],
  )

  return (
    <div className="bg-neutral-900 rounded-xl shadow-2xl min-w-[320px] max-w-[400px]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800/50">
        <span className="text-sm font-medium text-neutral-300">Prompt</span>
        <button className="text-neutral-500 hover:text-neutral-300 transition-colors">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="3" cy="8" r="1.5" />
            <circle cx="8" cy="8" r="1.5" />
            <circle cx="13" cy="8" r="1.5" />
          </svg>
        </button>
      </div>
      <div className="p-4">
        <textarea
          value={(data.prompt as string) || ''}
          onChange={onChange}
          placeholder="Enter your prompt..."
          rows={5}
          className="w-full bg-neutral-800 rounded-lg px-3 py-2.5 text-sm text-neutral-200 resize-none focus:outline-none transition-colors placeholder-neutral-600"
        />
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="prompt"
        className={`!w-2.5 !h-2.5 !bg-purple-400 !border-0 !-right-[7px] handle-purple ${promptConnections.length > 0 ? 'connected' : ''}`}
        title="Prompt"
      />
    </div>
  )
}

export default memo(TextPromptNode)
