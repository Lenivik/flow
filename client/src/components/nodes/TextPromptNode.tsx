import { memo, useCallback, useState } from 'react'
import { Handle, Position, useNodeConnections, useReactFlow, type NodeProps } from '@xyflow/react'
import { Lock } from 'lucide-react'
import NodeContextMenu from './NodeContextMenu'

function TextPromptNode({ id, data }: NodeProps) {
  const promptConnections = useNodeConnections({ handleType: 'source', handleId: 'prompt' })
  const [menuOpen, setMenuOpen] = useState(false)
  const { setNodes, setEdges, getNode } = useReactFlow()
  const locked = !!data.locked

  const onChange = useCallback(
    (evt: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (data.onChange) {
        (data.onChange as (id: string, value: string) => void)(id, evt.target.value)
      }
    },
    [id, data],
  )

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
    <div className={`bg-neutral-900 rounded-xl shadow-2xl min-w-[320px] max-w-[400px] ${locked ? 'ring-1 ring-neutral-700' : ''}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800/50">
        <span className="text-sm font-medium text-neutral-300 flex items-center gap-2">
          {locked && <Lock size={12} className="text-neutral-500" />}
          Prompt
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
        <textarea
          value={(data.prompt as string) || ''}
          onChange={onChange}
          placeholder="Enter your prompt..."
          rows={5}
          readOnly={locked}
          className={`w-full bg-neutral-800 rounded-lg px-3 py-2.5 text-sm text-neutral-200 resize-none focus:outline-none transition-colors placeholder-neutral-600 ${locked ? 'opacity-60 cursor-not-allowed' : ''}`}
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
