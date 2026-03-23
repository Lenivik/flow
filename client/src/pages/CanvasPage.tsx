import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ReactFlow,
  Background,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type EdgeChange,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow,
  SelectionMode,
} from '@xyflow/react'
import { Workflow, Plus, Minus, Maximize, Share2 } from 'lucide-react'
import { api } from '../lib/api'
import { OperationQueue } from '../lib/operationQueue'
import ConnectionDropMenu from '../components/ConnectionDropMenu'
import CanvasToolbar, { type ToolMode } from '../components/toolbar/CanvasToolbar'
import TextPromptNode from '../components/nodes/TextPromptNode'
import ImageGenNode from '../components/nodes/ImageGenNode'
import ExportNode from '../components/nodes/ExportNode'

const nodeTypes = {
  textPrompt: TextPromptNode,
  imageGen: ImageGenNode,
  export: ExportNode,
}

const handleColors: Record<string, string> = {
  prompt: '#a78bfa',
  negative_prompt: '#a78bfa',
  result: '#34d399',
  input: '#34d399',
}

// Handle color groups for compatibility matching
const handleColorGroup: Record<string, string> = {
  prompt: 'purple',
  negative_prompt: 'purple',
  result: 'green',
  input: 'green',
}

// Node catalog with handle info for drop-to-connect filtering
const nodeCatalog = [
  {
    type: 'textPrompt',
    label: 'Text Prompt',
    targetHandles: [] as string[],
    sourceHandles: ['prompt'],
  },
  {
    type: 'imageGen',
    label: 'Image Generation',
    targetHandles: ['prompt', 'negative_prompt'],
    sourceHandles: ['result'],
  },
  {
    type: 'export',
    label: 'Export',
    targetHandles: ['input'],
    sourceHandles: [] as string[],
  },
]

const defaultEdgeOptions = {
  style: { stroke: '#a78bfa', strokeWidth: 2 },
  type: 'default',
}

function CanvasInner() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { screenToFlowPosition, zoomIn, zoomOut, fitView } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [toolMode, setToolMode] = useState<ToolMode>('select')
  const [projectName, setProjectName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const prevToolMode = useRef<ToolMode>('select')
  const [connectionLineColor, setConnectionLineColor] = useState('#a78bfa')
  const [dropMenu, setDropMenu] = useState<{
    x: number
    y: number
    flowPosition: { x: number; y: number }
    sourceNodeId: string
    sourceHandleId: string
    sourceHandleType: 'source' | 'target'
  } | null>(null)
  const connectStartRef = useRef<{
    nodeId: string
    handleId: string
    handleType: 'source' | 'target'
  } | null>(null)

  // Load canvas data
  useEffect(() => {
    if (!id) return
    api.getProject(id).then((data) => {
      setProjectName(data.name)
      if (data.nodes?.length) {
        setNodes(
          data.nodes.map((n: { id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }) => {
            const nodeData = { ...n.data, onChange: handleNodeDataChange, onRunModel: handleRunModel }
            if (n.data.activeImageId) {
              nodeData.imageUrl = api.nodeImageUrl(n.data.activeImageId as number)
            }
            return { id: n.id, type: n.type, position: n.position, data: nodeData }
          }),
        )
      }
      if (data.edges?.length) {
        setEdges(data.edges.map((e: Edge) => ({
          ...e,
          style: { stroke: handleColors[e.sourceHandle || ''] || '#a78bfa', strokeWidth: 2 },
        })))
      }
    })
  }, [id])

  // Spacebar for hand tool
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !(e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement)) {
        e.preventDefault()
        prevToolMode.current = toolMode
        setSpaceHeld(true)
        setToolMode('hand')
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpaceHeld(false)
        setToolMode(prevToolMode.current)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [toolMode, spaceHeld])

  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  useEffect(() => { nodesRef.current = nodes }, [nodes])
  useEffect(() => { edgesRef.current = edges }, [edges])

  // Operation queue for delta persistence
  const queueRef = useRef<OperationQueue | null>(null)
  if (!queueRef.current && id) {
    queueRef.current = new OperationQueue(id, (idMap) => {
      const hasNewIds = Object.keys(idMap).some((cid) => cid !== idMap[cid])
      if (!hasNewIds) return
      setNodes((nds) => nds.map((n) => idMap[n.id] ? { ...n, id: idMap[n.id] } : n))
      setEdges((eds) => eds.map((e) => ({
        ...e,
        id: idMap[e.id] || e.id,
        source: idMap[e.source] || e.source,
        target: idMap[e.target] || e.target,
      })))
    })
  }

  // Flush operations on page unload via sendBeacon
  useEffect(() => {
    const handleBeforeUnload = () => {
      queueRef.current?.flushBeacon()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  const handleNodeDataChange = useCallback((nodeId: string, value: string) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, prompt: value } } : n)),
    )
    queueRef.current?.push({
      type: 'node_update',
      payload: { id: nodeId, data: { prompt: value } },
    })
  }, [setNodes])

  const handleRunModel = useCallback(async (nodeId: string): Promise<string | null> => {
    const currentNodes = nodesRef.current
    const currentEdges = edgesRef.current

    // Find prompt connected to this node's "prompt" handle
    const promptEdge = currentEdges.find((e) => e.target === nodeId && e.targetHandle === 'prompt')
    const promptNode = promptEdge ? currentNodes.find((n) => n.id === promptEdge.source) : null
    const prompt = (promptNode?.data as Record<string, unknown>)?.prompt as string | undefined

    // Find prompt connected to this node's "negative_prompt" handle
    const negEdge = currentEdges.find((e) => e.target === nodeId && e.targetHandle === 'negative_prompt')
    const negNode = negEdge ? currentNodes.find((n) => n.id === negEdge.source) : null
    const negativePrompt = (negNode?.data as Record<string, unknown>)?.prompt as string | undefined

    if (!prompt?.trim()) {
      return 'No prompt connected. Connect a Text Prompt node to the Prompt input.'
    }

    try {
      // Only pass numeric IDs (persisted nodes) to the API
      const serverNodeId = nodeId.match(/^\d+$/) ? nodeId : undefined
      const result = await api.generateImage(prompt, negativePrompt, serverNodeId)
      if (result.error) return result.error

      // Use persisted image URL if we have an image ID, otherwise fall back to inline base64
      const imageUrl = result.node_image_id
        ? api.nodeImageUrl(result.node_image_id)
        : `data:${result.mime_type};base64,${result.image_data}`

      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, imageUrl, activeImageId: result.node_image_id } } : n)),
      )
      return null
    } catch (err) {
      return err instanceof Error ? err.message : 'Generation failed'
    }
  }, [setNodes])

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Filter out remove changes for locked nodes
      const filtered = changes.filter((c) => {
        if (c.type === 'remove') {
          const node = nodesRef.current.find((n) => n.id === c.id)
          if (node && (node.data as Record<string, unknown>).locked) return false
        }
        return true
      })
      onNodesChange(filtered)
      for (const change of filtered) {
        if (change.type === 'position' && change.position) {
          queueRef.current?.push({
            type: 'node_update',
            payload: { id: change.id, position: change.position },
          })
        } else if (change.type === 'remove') {
          queueRef.current?.push({
            type: 'node_delete',
            payload: { id: change.id },
          })
        }
      }
    },
    [onNodesChange],
  )

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes)
      for (const change of changes) {
        if (change.type === 'remove') {
          queueRef.current?.push({
            type: 'edge_delete',
            payload: { id: change.id },
          })
        }
      }
    },
    [onEdgesChange],
  )

  const onConnectStart = useCallback(
    (_: unknown, params: { nodeId: string | null; handleId: string | null; handleType: 'source' | 'target' | null }) => {
      const color = handleColors[params.handleId || ''] || '#a78bfa'
      setConnectionLineColor(color)
      connectStartRef.current = {
        nodeId: params.nodeId || '',
        handleId: params.handleId || '',
        handleType: params.handleType || 'source',
      }
    },
    [],
  )

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement
      if (target.closest('.react-flow__handle') || !connectStartRef.current) {
        connectStartRef.current = null
        return
      }
      const clientPos = 'changedTouches' in event
        ? { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY }
        : { x: (event as MouseEvent).clientX, y: (event as MouseEvent).clientY }

      setDropMenu({
        x: clientPos.x,
        y: clientPos.y,
        flowPosition: screenToFlowPosition(clientPos),
        sourceNodeId: connectStartRef.current.nodeId,
        sourceHandleId: connectStartRef.current.handleId,
        sourceHandleType: connectStartRef.current.handleType,
      })
      connectStartRef.current = null
    },
    [screenToFlowPosition],
  )

  // Get compatible nodes for the drop menu
  const getDropMenuItems = useCallback(() => {
    if (!dropMenu) return []
    const dragColor = handleColorGroup[dropMenu.sourceHandleId]
    if (!dragColor) return []

    if (dropMenu.sourceHandleType === 'source') {
      // Dragged from a source handle → need nodes with a compatible target handle
      return nodeCatalog.filter((n) =>
        n.targetHandles.some((h) => handleColorGroup[h] === dragColor),
      )
    } else {
      // Dragged from a target handle → need nodes with a compatible source handle
      return nodeCatalog.filter((n) =>
        n.sourceHandles.some((h) => handleColorGroup[h] === dragColor),
      )
    }
  }, [dropMenu])

  const handleDropMenuSelect = useCallback(
    (nodeType: string) => {
      if (!dropMenu) return

      const catalogEntry = nodeCatalog.find((n) => n.type === nodeType)
      if (!catalogEntry) return

      const clientId = `temp_${Date.now()}`
      const newNode: Node = {
        id: clientId,
        type: nodeType,
        position: dropMenu.flowPosition,
        data: { onChange: handleNodeDataChange, onRunModel: handleRunModel },
      }
      setNodes((nds) => [...nds, newNode])
      queueRef.current?.push({
        type: 'node_create',
        payload: { client_id: clientId, type: nodeType, position: dropMenu.flowPosition, data: {} },
      })

      // Auto-connect
      const dragColor = handleColorGroup[dropMenu.sourceHandleId]
      const edgeId = `temp_edge_${Date.now()}`
      let source: string, target: string, sourceHandle: string, targetHandle: string

      if (dropMenu.sourceHandleType === 'source') {
        source = dropMenu.sourceNodeId
        sourceHandle = dropMenu.sourceHandleId
        target = clientId
        targetHandle = catalogEntry.targetHandles.find((h) => handleColorGroup[h] === dragColor) || catalogEntry.targetHandles[0]
      } else {
        target = dropMenu.sourceNodeId
        targetHandle = dropMenu.sourceHandleId
        source = clientId
        sourceHandle = catalogEntry.sourceHandles.find((h) => handleColorGroup[h] === dragColor) || catalogEntry.sourceHandles[0]
      }

      const color = handleColors[sourceHandle] || '#a78bfa'
      setEdges((eds) => addEdge({
        id: edgeId,
        source,
        target,
        sourceHandle,
        targetHandle,
        style: { stroke: color, strokeWidth: 2 },
      }, eds))
      queueRef.current?.push({
        type: 'edge_create',
        payload: { client_id: edgeId, source, target, source_handle: sourceHandle, target_handle: targetHandle },
      })

      setDropMenu(null)
    },
    [dropMenu, setNodes, setEdges, handleNodeDataChange, handleRunModel],
  )

  const onConnect = useCallback(
    (params: Connection) => {
      const color = handleColors[params.sourceHandle || ''] || '#a78bfa'
      const edgeId = `temp_edge_${Date.now()}`
      setEdges((eds) => addEdge({ ...params, id: edgeId, style: { stroke: color, strokeWidth: 2 } }, eds))
      queueRef.current?.push({
        type: 'edge_create',
        payload: {
          client_id: edgeId,
          source: params.source,
          target: params.target,
          source_handle: params.sourceHandle,
          target_handle: params.targetHandle,
        },
      })
    },
    [setEdges],
  )

  const addNode = useCallback(
    (type: string) => {
      const position = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
      const clientId = `temp_${Date.now()}`
      const newNode: Node = {
        id: clientId,
        type,
        position,
        data: { onChange: handleNodeDataChange, onRunModel: handleRunModel },
      }
      setNodes((nds) => [...nds, newNode])
      queueRef.current?.push({
        type: 'node_create',
        payload: { client_id: clientId, type, position, data: {} },
      })
    },
    [screenToFlowPosition, setNodes, handleNodeDataChange, handleRunModel],
  )

  return (
    <div className="h-screen w-screen bg-neutral-950 relative">
      {/* Logo pill */}
      <div className="absolute top-4 left-4 z-40 flex items-center gap-1 bg-neutral-900 border border-neutral-800 rounded-2xl px-1.5 py-1.5 shadow-2xl">
        <button
          onClick={() => navigate('/projects')}
          className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl transition-colors"
          title="Back to projects"
        >
          <Workflow size={18} />
        </button>
        <div className="h-5 w-px bg-neutral-800" />
        {editingName ? (
          <input
            ref={nameInputRef}
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={() => {
              const trimmed = draftName.trim()
              if (trimmed && trimmed !== projectName && id) {
                setProjectName(trimmed)
                api.updateProject(id, trimmed)
              }
              setEditingName(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') { setDraftName(projectName); setEditingName(false) }
            }}
            className="bg-transparent text-sm font-medium text-neutral-200 outline-none px-2.5 py-1.5 min-w-[80px] max-w-[200px] rounded-lg focus:bg-neutral-800"
            style={{ width: `${Math.max(80, draftName.length * 8 + 20)}px` }}
          />
        ) : (
          <button
            onClick={() => { setDraftName(projectName); setEditingName(true); setTimeout(() => nameInputRef.current?.select(), 0) }}
            className="text-sm font-medium text-neutral-200 hover:bg-neutral-800 rounded-lg px-2.5 py-1.5 transition-colors"
          >
            {projectName}
          </button>
        )}
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionLineStyle={{ stroke: connectionLineColor, strokeWidth: 2 }}
        panOnDrag={toolMode === 'hand' ? true : [1, 2]}
        selectionOnDrag={toolMode === 'select'}
        selectionMode={SelectionMode.Partial}
        deleteKeyCode={['Backspace', 'Delete']}
        panOnScroll={false}
        zoomOnScroll
        fitView
        className="bg-neutral-950"
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#333" />
      </ReactFlow>

      {/* Top-right controls */}
      <div className="absolute top-4 right-4 z-40 flex items-center gap-1 bg-neutral-900 border border-neutral-800 rounded-2xl px-1.5 py-1.5 shadow-2xl">
        <button onClick={() => zoomOut()} className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl transition-colors" title="Zoom out">
          <Minus size={18} />
        </button>
        <button onClick={() => zoomIn()} className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl transition-colors" title="Zoom in">
          <Plus size={18} />
        </button>
        <button onClick={() => fitView({ padding: 0.2 })} className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl transition-colors" title="Fit to view">
          <Maximize size={18} />
        </button>
        <div className="h-5 w-px bg-neutral-800" />
        <button className="px-3 py-1.5 text-sm font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl transition-colors flex items-center gap-1.5" title="Share">
          <Share2 size={14} />
          Share
        </button>
      </div>

      <CanvasToolbar
        toolMode={toolMode}
        onToolModeChange={setToolMode}
        onAddNode={addNode}
      />

      {dropMenu && (
        <ConnectionDropMenu
          x={dropMenu.x}
          y={dropMenu.y}
          items={getDropMenuItems()}
          onSelect={handleDropMenuSelect}
          onClose={() => setDropMenu(null)}
        />
      )}
    </div>
  )
}

export default function CanvasPage() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  )
}
