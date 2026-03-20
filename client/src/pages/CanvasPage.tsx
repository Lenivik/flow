import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow,
  SelectionMode,
} from '@xyflow/react'
import { ArrowLeft } from 'lucide-react'
import { api } from '../lib/api'
import CanvasToolbar, { type ToolMode } from '../components/toolbar/CanvasToolbar'
import TextPromptNode from '../components/nodes/TextPromptNode'
import ImageGenNode from '../components/nodes/ImageGenNode'
import ExportNode from '../components/nodes/ExportNode'

const nodeTypes = {
  textPrompt: TextPromptNode,
  imageGen: ImageGenNode,
  export: ExportNode,
}

const defaultEdgeOptions = {
  style: { stroke: '#6b21a8', strokeWidth: 2 },
  type: 'smoothstep',
  animated: true,
}

function CanvasInner() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { screenToFlowPosition } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [toolMode, setToolMode] = useState<ToolMode>('select')
  const [projectName, setProjectName] = useState('')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const [spaceHeld, setSpaceHeld] = useState(false)
  const prevToolMode = useRef<ToolMode>('select')

  // Load canvas data
  useEffect(() => {
    if (!id) return
    api.getProject(id).then((data) => {
      setProjectName(data.name)
      if (data.nodes?.length) {
        setNodes(
          data.nodes.map((n: { id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }) => ({
            id: n.id,
            type: n.type,
            position: n.position,
            data: { ...n.data, onChange: handleNodeDataChange },
          })),
        )
      }
      if (data.edges?.length) {
        setEdges(data.edges)
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

  // Auto-save debounced
  const saveCanvas = useCallback(() => {
    if (!id) return
    const saveNodes = nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: { prompt: (n.data as Record<string, unknown>).prompt, label: (n.data as Record<string, unknown>).label },
    }))
    api.saveCanvas(id, { nodes: saveNodes, edges })
  }, [id, nodes, edges])

  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(saveCanvas, 2000)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [nodes, edges, saveCanvas])

  const handleNodeDataChange = useCallback((nodeId: string, value: string) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, prompt: value } } : n)),
    )
  }, [setNodes])

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds))
    },
    [setEdges],
  )

  const addNode = useCallback(
    (type: string) => {
      const position = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
      const newNode: Node = {
        id: `temp_${Date.now()}`,
        type,
        position,
        data: { onChange: handleNodeDataChange },
      }
      setNodes((nds) => [...nds, newNode])
    },
    [screenToFlowPosition, setNodes, handleNodeDataChange],
  )

  return (
    <div className="h-screen w-screen bg-neutral-950 relative">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 py-3 bg-neutral-950/80 backdrop-blur-sm border-b border-neutral-800/50">
        <button
          onClick={() => navigate('/projects')}
          className="p-1.5 text-neutral-400 hover:text-white transition-colors rounded-lg hover:bg-neutral-800"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="text-sm font-medium text-white">{projectName}</span>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        panOnDrag={toolMode === 'hand' ? true : [1, 2]}
        selectionOnDrag={toolMode === 'select'}
        selectionMode={SelectionMode.Partial}
        panOnScroll={false}
        zoomOnScroll
        fitView
        className="bg-neutral-950"
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#333" />
        <Controls
          className="!bg-neutral-900 !border-neutral-800 !rounded-xl !shadow-2xl [&>button]:!bg-neutral-900 [&>button]:!border-neutral-800 [&>button]:!text-neutral-400 [&>button:hover]:!bg-neutral-800 [&>button:hover]:!text-white [&>button>svg]:!fill-current"
          position="top-right"
        />
      </ReactFlow>

      <CanvasToolbar
        toolMode={toolMode}
        onToolModeChange={setToolMode}
        onAddNode={addNode}
      />
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
