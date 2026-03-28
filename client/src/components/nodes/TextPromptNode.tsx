import { memo, useCallback } from 'react'
import { Handle, Position, useNodeConnections, type NodeProps } from '@xyflow/react'
import NodeHeader from './NodeHeader'
import { useNodeActions } from '../../hooks/useNodeActions'

function TextPromptNode({ id, data }: NodeProps) {
  const promptConnections = useNodeConnections({ handleType: 'source', handleId: 'prompt' })
  const locked = !!data.locked
  const { menuOpen, setMenuOpen, handleDuplicate, handleLock, handleDelete } = useNodeActions(id, locked)

  const onChange = useCallback(
    (evt: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (data.onChange) {
        (data.onChange as (id: string, value: string) => void)(id, evt.target.value)
      }
    },
    [id, data],
  )

  return (
    <div className={`bg-[#1a1a1a] border border-[#27272A] rounded-xl shadow-xl min-w-[320px] max-w-[400px] ${locked ? 'ring-1 ring-neutral-700' : ''}`}>
      <NodeHeader
        title="Prompt"
        locked={locked}
        menuOpen={menuOpen}
        onMenuToggle={() => setMenuOpen(!menuOpen)}
        onDuplicate={handleDuplicate}
        onLock={handleLock}
        onDelete={handleDelete}
        onCloseMenu={() => setMenuOpen(false)}
      />
      <div className="p-4">
        <textarea
          value={(data.prompt as string) || ''}
          onChange={onChange}
          placeholder="Enter your prompt..."
          rows={5}
          readOnly={locked}
          className={`w-full bg-[#222222] border border-[#27272A]/80 rounded-lg px-3 py-2.5 text-sm text-neutral-200 resize-none focus:outline-none transition-colors placeholder-neutral-600 ${locked ? 'opacity-60 cursor-not-allowed' : ''}`}
        />
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="prompt"
        className={`!w-[7px] !h-[7px] !bg-[#ADF5FF] !border-0 !-right-[9px] handle-purple ${promptConnections.length > 0 ? 'connected' : ''}`}
        title="Prompt"
      />
    </div>
  )
}

export default memo(TextPromptNode)
