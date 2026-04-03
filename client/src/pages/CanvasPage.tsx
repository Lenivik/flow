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
  useViewport,
  SelectionMode,
} from '@xyflow/react'
import { Workflow, Plus, Minus, Maximize, Share2, Loader2, Play, ArrowLeft, Settings, ChevronRight } from 'lucide-react'
import { NodeSettingsPanel, SidebarPanel } from '../components/settings/NodeSettingsPanel'
import { api } from '../lib/api'
import { useRunCallbacks } from '../hooks/useRunCallbacks'
import { useCanvasLoad } from '../hooks/useCanvasLoad'
import { OperationQueue } from '../lib/operationQueue'
import ConnectionDropMenu from '../components/ConnectionDropMenu'
import CanvasToolbar, { type ToolMode } from '../components/toolbar/CanvasToolbar'
import TextPromptNode from '../components/nodes/TextPromptNode'
import ImageGenNode from '../components/nodes/ImageGenNode'
import ExportNode from '../components/nodes/ExportNode'
import RelightNode from '../components/nodes/RelightNode'
import BgRemovalNode from '../components/nodes/BgRemovalNode'
import TrellisNode from '../components/nodes/TrellisNode'
import Flux2FlashNode from '../components/nodes/Flux2FlashNode'
import Flux2EditNode from '../components/nodes/Flux2EditNode'
import Scene3DNode from '../components/nodes/Scene3DNode'
import MeshyV6Node from '../components/nodes/MeshyV6Node'
import PreviewNode from '../components/nodes/PreviewNode'
import CropNode from '../components/nodes/CropNode'
import ColorAdjustNode from '../components/nodes/ColorAdjustNode'
import ImportNode from '../components/nodes/ImportNode'
import DeletableEdge from '../components/edges/DeletableEdge'

const nodeTypes = {
  textPrompt: TextPromptNode,
  imageGen: ImageGenNode,
  flux2Flash: Flux2FlashNode,
  flux2Edit: Flux2EditNode,
  relight: RelightNode,
  bgRemoval: BgRemovalNode,
  trellis: TrellisNode,
  meshyV6: MeshyV6Node,
  scene3d: Scene3DNode,
  preview: PreviewNode,
  crop: CropNode,
  colorAdjust: ColorAdjustNode,
  import: ImportNode,
  export: ExportNode,
}

const handleColors: Record<string, string> = {
  prompt: '#ADF5FF',
  negative_prompt: '#ADF5FF',
  result: '#00FFC5',
  input: '#00FFC5',
  image_result: '#00FFC5',
  layers: '#00FFC5',
  texture: '#00FFC5',
}

// Handle color groups for compatibility matching
const handleColorGroup: Record<string, string> = {
  prompt: 'purple',
  negative_prompt: 'purple',
  result: 'green',
  input: 'green',
  image_result: 'green',
  layers: 'green',
  texture: 'green',
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
    type: 'flux2Flash',
    label: 'Flux 2 Flash',
    targetHandles: ['prompt'],
    sourceHandles: ['result'],
  },
  {
    type: 'flux2Edit',
    label: 'Flux 2 Edit',
    targetHandles: ['prompt', 'input'],
    sourceHandles: ['result'],
  },
  {
    type: 'relight',
    label: 'Relight 2.0',
    targetHandles: ['prompt', 'negative_prompt'],
    sourceHandles: ['result'],
  },
  {
    type: 'bgRemoval',
    label: 'BG Removal',
    targetHandles: ['input'],
    sourceHandles: ['result'],
  },
  {
    type: 'trellis',
    label: 'Trellis',
    targetHandles: ['input'],
    sourceHandles: ['result', 'image_result'],
  },
  {
    type: 'meshyV6',
    label: 'Meshy v6',
    targetHandles: ['input', 'texture'],
    sourceHandles: ['result', 'image_result'],
  },
  {
    type: 'scene3d',
    label: '3D Scene',
    targetHandles: ['layers'],
    sourceHandles: ['image_result'],
  },
  {
    type: 'preview',
    label: 'Preview',
    targetHandles: ['input'],
    sourceHandles: [] as string[],
  },
  {
    type: 'crop',
    label: 'Crop',
    targetHandles: ['input'],
    sourceHandles: ['result'],
  },
  {
    type: 'colorAdjust',
    label: 'Color Adjust',
    targetHandles: ['input'],
    sourceHandles: ['result'],
  },
  {
    type: 'import',
    label: 'Import Image',
    targetHandles: [] as string[],
    sourceHandles: ['result'],
  },
  {
    type: 'export',
    label: 'Export',
    targetHandles: ['input'],
    sourceHandles: [] as string[],
  },
]


const edgeTypes = {
  deletable: DeletableEdge,
}

const defaultEdgeOptions = {
  style: { stroke: '#ADF5FF', strokeWidth: 2 },
  type: 'deletable',
}

function CanvasInner() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { screenToFlowPosition, zoomIn, zoomOut, fitView } = useReactFlow()
  const viewport = useViewport()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [toolMode, setToolMode] = useState<ToolMode>(() => {
    const saved = localStorage.getItem('flow_tool_mode')
    return saved === 'hand' ? 'hand' : 'select'
  })
  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [settingsMode, setSettingsMode] = useState<'off' | 'inline' | 'sidebar' | 'narrow' | 'attached'>(() => {
    const saved = localStorage.getItem('flow_settings_mode')
    if (saved && ['off', 'inline', 'sidebar', 'narrow', 'attached'].includes(saved)) return saved as 'off' | 'inline' | 'sidebar' | 'narrow' | 'attached'
    return 'off'
  })
  const [logoMenuOpen, setLogoMenuOpen] = useState(false)
  const [settingsSubOpen, setSettingsSubOpen] = useState(false)
  const [subNavSubOpen, setSubNavSubOpen] = useState(false)
  const logoMenuRef = useRef<HTMLDivElement>(null)
  const [runningSelected, setRunningSelected] = useState(false)
  const prevToolMode = useRef<ToolMode>('select')
  const [connectionLineColor, setConnectionLineColor] = useState('#ADF5FF')
  const [dropMenu, setDropMenu] = useState<{
    x: number
    y: number
    flowPosition: { x: number; y: number }
    sourceNodeId?: string
    sourceHandleId?: string
    sourceHandleType?: 'source' | 'target'
  } | null>(null)
  const connectStartRef = useRef<{
    nodeId: string
    handleId: string
    handleType: 'source' | 'target'
  } | null>(null)

  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  useEffect(() => { nodesRef.current = nodes }, [nodes])
  useEffect(() => { edgesRef.current = edges }, [edges])

  const { handleRunModel, handleRunBgRemoval, handleRunTrellis, handleRunFlux2Flash, handleRunFlux2Edit, handleRunMeshyV6 } =
    useRunCallbacks({ nodesRef, edgesRef, setNodes })

  const handleNodeDataChange = useCallback((nodeId: string, value: string) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, prompt: value } } : n)),
    )
    queueRef.current?.push({
      type: 'node_update',
      payload: { id: nodeId, data: { prompt: value } },
    })
  }, [setNodes])

  // Generic patch: merges into node data and persists (strips function callbacks before sending)
  const handleNodeDataUpdate = useCallback((nodeId: string, patch: Record<string, unknown>) => {
    // Merge inside the functional updater so it always operates on the latest state,
    // not on a stale snapshot from nodesRef. Pre-computed newData would be overwritten
    // by concurrent setNodes calls (e.g. from generateOutput) when applied in batch.
    setNodes((nds) => nds.map((n) => {
      if (n.id !== nodeId) return n
      return { ...n, data: { ...(n.data as Record<string, unknown>), ...patch } }
    }))
    // For the operation queue, nodesRef is an acceptable stale read — the patch is always included
    const node = nodesRef.current.find((n) => n.id === nodeId)
    if (!node) return
    const mergedForQueue = { ...(node.data as Record<string, unknown>), ...patch }
    const serializable = Object.fromEntries(Object.entries(mergedForQueue).filter(([, v]) => typeof v !== 'function'))
    queueRef.current?.push({ type: 'node_update', payload: { id: nodeId, data: serializable } })
  }, [nodesRef, setNodes])

  // Computed here so makeNodeData can capture the current value
  const debugSettings = settingsMode === 'inline'

  const makeNodeData = useCallback((extra: Record<string, unknown> = {}) => ({
    onChange: handleNodeDataChange,
    onDataChange: handleNodeDataUpdate,
    onRunModel: handleRunModel,
    onRunFlux2Flash: handleRunFlux2Flash,
    onRunFlux2Edit: handleRunFlux2Edit,
    onRunBgRemoval: handleRunBgRemoval,
    onRunTrellis: handleRunTrellis,
    onRunMeshyV6: handleRunMeshyV6,
    debugSettings,
    ...extra,
  }), [handleNodeDataChange, handleNodeDataUpdate, handleRunModel, handleRunFlux2Flash, handleRunFlux2Edit, handleRunBgRemoval, handleRunTrellis, handleRunMeshyV6, debugSettings])

  const { projectName, setProjectName } = useCanvasLoad({ id, setNodes, setEdges, makeNodeData, handleColors })

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

  // Persist settings mode to localStorage
  useEffect(() => {
    localStorage.setItem('flow_settings_mode', settingsMode)
  }, [settingsMode])

  // Persist tool mode to localStorage
  useEffect(() => {
    localStorage.setItem('flow_tool_mode', toolMode)
  }, [toolMode])

  // Close logo menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (logoMenuRef.current && !logoMenuRef.current.contains(e.target as globalThis.Node)) {
        setLogoMenuOpen(false)
        setSettingsSubOpen(false)
        setSubNavSubOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Sync debug settings flag into all nodes
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => n.data.debugSettings === debugSettings ? n : { ...n, data: { ...n.data, debugSettings } }),
    )
  }, [debugSettings, setNodes])

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
      const color = handleColors[params.handleId || ''] || '#ADF5FF'
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

    // Canvas click — show all nodes
    if (!dropMenu.sourceHandleId) return nodeCatalog

    const dragColor = handleColorGroup[dropMenu.sourceHandleId]
    if (!dragColor) return nodeCatalog

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
        data: makeNodeData(),
      }
      setNodes((nds) => [...nds, newNode])
      queueRef.current?.push({
        type: 'node_create',
        payload: { client_id: clientId, type: nodeType, position: dropMenu.flowPosition, data: {} },
      })

      // Auto-connect only if opened from a handle drag
      if (dropMenu.sourceNodeId && dropMenu.sourceHandleId && dropMenu.sourceHandleType) {
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

        const color = handleColors[sourceHandle] || '#ADF5FF'
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
      }

      setDropMenu(null)
    },
    [dropMenu, setNodes, setEdges, makeNodeData],
  )


  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      const sourceGroup = handleColorGroup[connection.sourceHandle || ''] || 'purple'
      const targetGroup = handleColorGroup[connection.targetHandle || ''] || 'purple'
      return sourceGroup === targetGroup
    },
    [],
  )

  const onConnect = useCallback(
    (params: Connection) => {
      connectStartRef.current = null // Prevent drop menu from opening on successful connection
      const color = handleColors[params.sourceHandle || ''] || '#ADF5FF'
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
        data: makeNodeData(),
      }
      setNodes((nds) => [...nds, newNode])
      queueRef.current?.push({
        type: 'node_create',
        payload: { client_id: clientId, type, position, data: {} },
      })
    },
    [screenToFlowPosition, setNodes, makeNodeData],
  )

  // Drag image files directly onto the canvas — creates an ImportNode at the drop point
  const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) e.preventDefault()
  }, [])

  const handleCanvasDrop = useCallback(
    async (e: React.DragEvent) => {
      // Only handle file drops — node/edge drags are internal to React Flow
      if (!e.dataTransfer.types.includes('Files')) return
      const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))
      if (!files.length) return
      e.preventDefault()

      for (const file of files) {
        const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
        const clientId = `temp_${Date.now()}_${Math.random()}`
        const newNode: Node = { id: clientId, type: 'import', position, data: makeNodeData() }
        setNodes((nds) => [...nds, newNode])
        queueRef.current?.push({
          type: 'node_create',
          payload: { client_id: clientId, type: 'import', position, data: {} },
        })

        try {
          const result = await api.uploadImage(file)
          if (result.error || !result.node_image_id) continue
          const blobUrl = await api.fetchNodeImageBlob(result.node_image_id)
          const newEntry = { id: result.node_image_id, url: blobUrl }
          setNodes((nds) =>
            nds.map((n) => {
              if (n.id !== clientId) return n
              const nd = n.data as Record<string, unknown>
              const history = [newEntry]
              return { ...n, data: { ...nd, imageUrl: blobUrl, activeImageId: result.node_image_id, imageHistory: history, imageIndex: 0 } }
            }),
          )
        } catch { /* upload errors are silent at canvas level — node shows its own error */ }
      }
    },
    [screenToFlowPosition, setNodes, makeNodeData],
  )

  // Detect single selected node for sub-nav
  const selectedNodes = nodes.filter((n) => n.selected)
  const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : null
  const showSubNav = selectedNode?.type === 'imageGen' || selectedNode?.type === 'flux2Flash' || selectedNode?.type === 'flux2Edit' || selectedNode?.type === 'relight' || selectedNode?.type === 'trellis' || selectedNode?.type === 'meshyV6' || selectedNode?.type === 'colorAdjust'

  const handleRunSelected = () => {
    if (!selectedNode) return
    setRunningSelected(true)
    const runner = selectedNode.type === 'bgRemoval' ? handleRunBgRemoval : selectedNode.type === 'trellis' ? handleRunTrellis : selectedNode.type === 'meshyV6' ? handleRunMeshyV6 : selectedNode.type === 'flux2Flash' ? handleRunFlux2Flash : selectedNode.type === 'flux2Edit' ? handleRunFlux2Edit : handleRunModel
    runner(selectedNode.id).finally(() => setRunningSelected(false))
  }

  const updateSelectedNodeData = useCallback(
    (key: string, value: string) => {
      if (!selectedNode) return
      setNodes((nds) =>
        nds.map((n) => n.id === selectedNode.id ? { ...n, data: { ...n.data, [key]: value } } : n),
      )
      queueRef.current?.push({
        type: 'node_update',
        payload: { id: selectedNode.id, data: { [key]: value } },
      })
    },
    [selectedNode, setNodes],
  )

  return (
    <div className="h-screen w-screen bg-neutral-950 relative" onDragOver={handleCanvasDragOver} onDrop={handleCanvasDrop}>
      {/* Logo pill */}
      <div className="absolute top-4 left-4 z-40 flex items-center gap-1 bg-neutral-900 border border-neutral-800 rounded-2xl px-1.5 py-1.5 shadow-2xl">
        <div className="relative" ref={logoMenuRef}>
          <button
            onClick={() => { setLogoMenuOpen(!logoMenuOpen); if (logoMenuOpen) { setSettingsSubOpen(false); setSubNavSubOpen(false) } }}
            className={`p-2 rounded-xl transition-colors ${logoMenuOpen ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}
            title="Menu"
          >
            <Workflow size={18} />
          </button>
          {logoMenuOpen && (
            <div className="absolute top-full mt-2 left-0 bg-neutral-800 border border-neutral-700 rounded-xl shadow-2xl py-1.5 min-w-[200px] z-50">
              <button
                onClick={() => { setLogoMenuOpen(false); navigate('/projects') }}
                className="w-full text-left px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-700 hover:text-white transition-colors flex items-center gap-2"
              >
                <ArrowLeft size={14} />
                Back to projects
              </button>
              <div className="h-px bg-neutral-700 my-1" />
              <div className="relative">
                <button
                  onClick={() => { setSettingsSubOpen(!settingsSubOpen); setSubNavSubOpen(false) }}
                  className="w-full text-left px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-700 hover:text-white transition-colors flex items-center justify-between"
                >
                  <span className="flex items-center gap-2"><Settings size={14} /> Settings</span>
                  <ChevronRight size={12} />
                </button>
                {settingsSubOpen && (
                  <div className="absolute left-full top-0 ml-1 bg-neutral-800 border border-neutral-700 rounded-xl shadow-2xl py-1.5 min-w-[200px] z-50">
                    <div className="relative">
                      <button
                        onClick={() => setSubNavSubOpen(!subNavSubOpen)}
                        className="w-full text-left px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-700 hover:text-white transition-colors flex items-center justify-between"
                      >
                        Sub nav layout
                        <ChevronRight size={12} />
                      </button>
                      {subNavSubOpen && (
                        <div className="absolute left-full top-0 ml-1 bg-neutral-800 border border-neutral-700 rounded-xl shadow-2xl py-1.5 min-w-[180px] z-50">
                          {([
                            ['off', 'Off'],
                            ['inline', 'Inline'],
                            ['attached', 'Attached'],
                            ['sidebar', 'Sidebar'],
                            ['narrow', 'Narrow sidebar'],
                          ] as const).map(([value, label]) => (
                            <button
                              key={value}
                              onClick={() => { setSettingsMode(value); setLogoMenuOpen(false); setSettingsSubOpen(false); setSubNavSubOpen(false) }}
                              className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between ${
                                settingsMode === value ? 'text-white bg-neutral-700' : 'text-neutral-300 hover:bg-neutral-700 hover:text-white'
                              }`}
                            >
                              {label}
                              {settingsMode === value && <span className="text-blue-400 text-xs">●</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
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

        isValidConnection={isValidConnection}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionLineStyle={{ stroke: connectionLineColor, strokeWidth: 2 }}
        panOnDrag={toolMode === 'hand' ? true : [1, 2]}
        selectionOnDrag={toolMode === 'select'}
        selectionMode={SelectionMode.Partial}
        deleteKeyCode={['Backspace', 'Delete']}
        panOnScroll
        panOnScrollSpeed={2}
        zoomOnScroll={false}
        zoomOnPinch
        fitView
        className={`bg-neutral-950 ${toolMode === 'select' ? 'cursor-select-mode' : ''}`}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#333" />

        {/* Attached under-node settings — rendered inside ReactFlow so it pans/zooms with the canvas */}
        {settingsMode === 'attached' && selectedNode && showSubNav && (() => {
          const nodeWidth = selectedNode.measured?.width ?? 320
          const nodeHeight = selectedNode.measured?.height ?? 300
          const screenX = (selectedNode.position.x + nodeWidth / 2) * viewport.zoom + viewport.x
          const screenY = (selectedNode.position.y + nodeHeight) * viewport.zoom + viewport.y
          return (
            <div className="absolute z-[5] pointer-events-auto" style={{ left: screenX, top: screenY + 8 * viewport.zoom, transform: `translateX(-50%) scale(${viewport.zoom})`, transformOrigin: 'top center' }}>
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl p-3 space-y-2">
                <NodeSettingsPanel nodeType={selectedNode.type!} nodeData={selectedNode.data as Record<string, unknown>} onUpdate={updateSelectedNodeData} layout="attached" />
              </div>
            </div>
          )
        })()}
      </ReactFlow>

      {/* Top-right controls */}
      <div className="absolute top-4 right-4 z-40 w-72 flex items-center justify-between gap-1 bg-neutral-900 border border-neutral-800 rounded-2xl px-1.5 py-1.5 shadow-2xl">
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

      {/* Sub-nav for selected node settings */}
      {showSubNav && settingsMode !== 'sidebar' && settingsMode !== 'narrow' && settingsMode !== 'attached' && selectedNode && (
        <div className="absolute bottom-[5.5rem] left-1/2 -translate-x-1/2 z-40">
          <div className="flex items-end gap-3 bg-neutral-900 border border-neutral-800 rounded-2xl px-3 py-2 shadow-2xl">
            <NodeSettingsPanel nodeType={selectedNode.type!} nodeData={selectedNode.data as Record<string, unknown>} onUpdate={updateSelectedNodeData} layout="subnav" />
            {selectedNode.type !== 'colorAdjust' && (
              <>
                <div className="h-8 w-px bg-neutral-800" />
                <button onClick={handleRunSelected} disabled={runningSelected} className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap">
                  {runningSelected ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                  {runningSelected ? 'Running...' : 'Run'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

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

      {/* Settings sidebar */}
      {settingsMode === 'sidebar' && selectedNode && showSubNav && (
        <SidebarPanel nodeType={selectedNode.type!} nodeData={selectedNode.data as Record<string, unknown>} onUpdate={updateSelectedNodeData} onClose={() => setSettingsMode('off')} onRun={handleRunSelected} running={runningSelected} width="w-72" />
      )}

      {/* Narrow sidebar */}
      {settingsMode === 'narrow' && selectedNode && showSubNav && (
        <SidebarPanel nodeType={selectedNode.type!} nodeData={selectedNode.data as Record<string, unknown>} onUpdate={updateSelectedNodeData} onClose={() => setSettingsMode('off')} onRun={handleRunSelected} running={runningSelected} width="w-48" />
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
