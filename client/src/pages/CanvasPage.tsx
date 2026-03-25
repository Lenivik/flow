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
import { Workflow, Plus, Minus, Maximize, Share2, ChevronDown, X, Loader2, Play, ArrowLeft, Settings, ChevronRight } from 'lucide-react'
import { api } from '../lib/api'
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

const nodeTypes = {
  textPrompt: TextPromptNode,
  imageGen: ImageGenNode,
  flux2Flash: Flux2FlashNode,
  relight: RelightNode,
  bgRemoval: BgRemovalNode,
  trellis: TrellisNode,
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
    type: 'flux2Flash',
    label: 'Flux 2 Flash',
    targetHandles: ['prompt'],
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
    sourceHandles: [] as string[],
  },
  {
    type: 'export',
    label: 'Export',
    targetHandles: ['input'],
    sourceHandles: [] as string[],
  },
]

function SubNavField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] text-neutral-500 font-medium leading-none">{label}</span>
      {children}
    </div>
  )
}

function SubNavSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[][] }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-neutral-800 text-[12px] text-neutral-200 rounded-lg pl-2.5 pr-6 py-1 outline-none cursor-pointer hover:bg-neutral-700 transition-colors"
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
    </div>
  )
}

function SubNavNumber({ value, onChange, min, max, step }: { value: number; onChange: (v: number) => void; min: number; max: number; step: number }) {
  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => { const n = parseFloat(e.target.value); if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n))) }}
      className="w-14 bg-neutral-800 text-[12px] text-neutral-200 text-center rounded-lg py-1 outline-none hover:bg-neutral-700 transition-colors"
    />
  )
}

function SubNavSlider({ value, onChange, min, max, step }: { value: number; onChange: (v: number) => void; min: number; max: number; step: number }) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-16 h-1 accent-neutral-400 bg-neutral-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-neutral-200"
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => { const n = parseFloat(e.target.value); if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n))) }}
        className="w-14 bg-neutral-800 text-[12px] text-neutral-200 text-center rounded-lg py-1 outline-none hover:bg-neutral-700 transition-colors"
      />
    </div>
  )
}

function SubNavCheck({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-7 h-4 rounded-full transition-colors ${checked ? 'bg-purple-500' : 'bg-neutral-700'}`}
    >
      <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform mx-0.5 ${checked ? 'translate-x-3' : 'translate-x-0'}`} />
    </button>
  )
}

function SidebarDropdown({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[][] }) {
  return (
    <div>
      <span className="text-[11px] font-medium text-neutral-400 mb-1.5 block">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-neutral-800 text-xs text-neutral-200 rounded-lg pl-3 pr-7 py-2 outline-none cursor-pointer border border-neutral-700 hover:border-neutral-600 transition-colors"
        >
          {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
      </div>
    </div>
  )
}

function SidebarSlider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div>
      <span className="text-[11px] font-medium text-neutral-400 mb-1.5 block">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="flex-1 min-w-0 h-1 accent-neutral-400 bg-neutral-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-neutral-200"
        />
        <input
          type="number" min={min} max={max} step={step} value={value}
          onChange={(e) => { const n = parseFloat(e.target.value); if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n))) }}
          className="w-12 bg-neutral-800 text-xs text-neutral-200 text-center rounded-md py-1 outline-none border border-neutral-700 focus:border-neutral-500"
        />
      </div>
    </div>
  )
}

const defaultEdgeOptions = {
  style: { stroke: '#a78bfa', strokeWidth: 2 },
  type: 'default',
}

function CanvasInner() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { screenToFlowPosition, flowToScreenPosition, getZoom, zoomIn, zoomOut, fitView } = useReactFlow()
  const viewport = useViewport()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [toolMode, setToolMode] = useState<ToolMode>('select')
  const [projectName, setProjectName] = useState('')
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
    let cancelled = false
    api.getProject(id).then(async (data) => {
      if (cancelled) return
      setProjectName(data.name)
      if (data.nodes?.length) {
        const loadedNodes = await Promise.all(data.nodes.map(async (n: { id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }) => {
          const nodeData = { ...n.data, onChange: handleNodeDataChange, onRunModel: handleRunModel, onRunFlux2Flash: handleRunFlux2Flash, onRunBgRemoval: handleRunBgRemoval, onRunTrellis: handleRunTrellis }
          if (n.data.activeImageId) {
            try {
              const url = await api.fetchNodeImageBlob(n.data.activeImageId as number)
              if (n.type === 'trellis') {
                nodeData.modelFile = url
              } else {
                nodeData.imageUrl = url
              }
            } catch { /* image may have been deleted */ }
          }
          return { id: n.id, type: n.type, position: n.position, data: nodeData }
        }))
        if (cancelled) return
        setNodes(loadedNodes)

        // Load image history for image generation nodes
        for (const n of loadedNodes) {
          if ((n.type === 'imageGen' || n.type === 'flux2Flash' || n.type === 'relight' || n.type === 'bgRemoval' || n.type === 'trellis') && n.id.match(/^\d+$/)) {
            api.getNodeImages(n.id).then(async (images: { id: number }[]) => {
              if (!images?.length || cancelled) return
              const history = await Promise.all(
                images.reverse().map(async (img: { id: number }) => {
                  try {
                    const url = await api.fetchNodeImageBlob(img.id)
                    return { id: img.id, url }
                  } catch {
                    return { id: img.id, url: '' }
                  }
                })
              )
              if (cancelled) return
              const validHistory = history.filter((h) => h.url)
              const activeId = n.data.activeImageId as number | undefined
              const activeIdx = activeId ? validHistory.findIndex((h) => h.id === activeId) : validHistory.length - 1
              setNodes((nds) =>
                nds.map((node) => node.id === n.id
                  ? { ...node, data: { ...node.data, imageHistory: validHistory, imageIndex: activeIdx >= 0 ? activeIdx : validHistory.length - 1 } }
                  : node
                ),
              )
            })
          }
        }
      }
      if (data.edges?.length) {
        setEdges(data.edges.map((e: Edge) => ({
          ...e,
          style: { stroke: handleColors[e.sourceHandle || ''] || '#a78bfa', strokeWidth: 2 },
        })))
      }
    })
    return () => { cancelled = true }
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

  // Persist settings mode to localStorage
  useEffect(() => {
    localStorage.setItem('flow_settings_mode', settingsMode)
  }, [settingsMode])

  // Close logo menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (logoMenuRef.current && !logoMenuRef.current.contains(e.target as Node)) {
        setLogoMenuOpen(false)
        setSettingsSubOpen(false)
        setSubNavSubOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Sync debug settings flag into all nodes
  const debugSettings = settingsMode === 'inline'
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => n.data.debugSettings === debugSettings ? n : { ...n, data: { ...n.data, debugSettings } }),
    )
  }, [debugSettings, setNodes])

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
      const genNode = currentNodes.find((n) => n.id === nodeId)
      const nodeData = genNode?.data as Record<string, unknown> | undefined
      const settings: Record<string, string> = {}
      if (nodeData?.resolution) settings.resolution = nodeData.resolution as string
      if (nodeData?.aspectRatio) settings.aspect_ratio = nodeData.aspectRatio as string
      if (nodeData?.outputFormat) settings.output_format = nodeData.outputFormat as string
      if (nodeData?.seed) settings.seed = nodeData.seed as string
      if (nodeData?.safetyTolerance) settings.safety_tolerance = nodeData.safetyTolerance as string
      const result = await api.generateImage(prompt, negativePrompt, serverNodeId, settings)
      if (result.error) return result.error

      // Fetch the persisted image via authenticated request
      const imageUrl = result.node_image_id
        ? await api.fetchNodeImageBlob(result.node_image_id)
        : `data:${result.mime_type};base64,${result.image_data}`

      const newEntry = { id: result.node_image_id, url: imageUrl }

      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n
          const nd = n.data as Record<string, unknown>
          const history = [...((nd.imageHistory as { id: number; url: string }[]) || [])]
          history.push(newEntry)
          return { ...n, data: { ...nd, imageUrl, activeImageId: result.node_image_id, imageHistory: history, imageIndex: history.length - 1 } }
        }),
      )
      return null
    } catch (err) {
      return err instanceof Error ? err.message : 'Generation failed'
    }
  }, [setNodes])

  const handleRunBgRemoval = useCallback(async (nodeId: string): Promise<string | null> => {
    const currentNodes = nodesRef.current
    const currentEdges = edgesRef.current

    // Find the image connected to this node's "input" handle
    const inputEdge = currentEdges.find((e) => e.target === nodeId && e.targetHandle === 'input')
    const sourceNode = inputEdge ? currentNodes.find((n) => n.id === inputEdge.source) : null
    const sourceData = sourceNode?.data as Record<string, unknown> | undefined
    const sourceImageId = sourceData?.activeImageId as number | undefined

    if (!sourceImageId) {
      return 'No image connected. Connect an image output to the Input handle.'
    }

    try {
      const serverNodeId = nodeId.match(/^\d+$/) ? nodeId : undefined
      const result = await api.removeBg(sourceImageId, serverNodeId)
      if (result.error) return result.error

      const imageUrl = result.node_image_id
        ? await api.fetchNodeImageBlob(result.node_image_id)
        : `data:${result.mime_type};base64,${result.image_data}`

      const newEntry = { id: result.node_image_id, url: imageUrl }

      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n
          const nd = n.data as Record<string, unknown>
          const history = [...((nd.imageHistory as { id: number; url: string }[]) || [])]
          history.push(newEntry)
          return { ...n, data: { ...nd, imageUrl, activeImageId: result.node_image_id, imageHistory: history, imageIndex: history.length - 1 } }
        }),
      )
      return null
    } catch (err) {
      return err instanceof Error ? err.message : 'Background removal failed'
    }
  }, [setNodes])

  const handleRunTrellis = useCallback(async (nodeId: string): Promise<string | null> => {
    const currentNodes = nodesRef.current
    const currentEdges = edgesRef.current

    const inputEdge = currentEdges.find((e) => e.target === nodeId && e.targetHandle === 'input')
    const sourceNode = inputEdge ? currentNodes.find((n) => n.id === inputEdge.source) : null
    const sourceData = sourceNode?.data as Record<string, unknown> | undefined
    const sourceImageId = sourceData?.activeImageId as number | undefined

    if (!sourceImageId) {
      return 'No image connected. Connect an image output to the Input handle.'
    }

    try {
      const serverNodeId = nodeId.match(/^\d+$/) ? nodeId : undefined
      const result = await api.generateTrellis(sourceImageId, serverNodeId)
      if (result.error) return result.error

      const modelUrl = result.node_image_id
        ? await api.fetchNodeImageBlob(result.node_image_id)
        : undefined

      const newEntry = { id: result.node_image_id, url: modelUrl || '' }

      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n
          const nd = n.data as Record<string, unknown>
          const history = [...((nd.imageHistory as { id: number; url: string }[]) || [])]
          history.push(newEntry)
          return {
            ...n,
            data: {
              ...nd,
              modelFile: modelUrl,
              activeImageId: result.node_image_id,
              imageHistory: history,
              imageIndex: history.length - 1,
            },
          }
        }),
      )
      return null
    } catch (err) {
      return err instanceof Error ? err.message : '3D generation failed'
    }
  }, [setNodes])

  const handleRunFlux2Flash = useCallback(async (nodeId: string): Promise<string | null> => {
    const currentNodes = nodesRef.current
    const currentEdges = edgesRef.current

    const promptEdge = currentEdges.find((e) => e.target === nodeId && e.targetHandle === 'prompt')
    const promptNode = promptEdge ? currentNodes.find((n) => n.id === promptEdge.source) : null
    const prompt = (promptNode?.data as Record<string, unknown>)?.prompt as string | undefined

    if (!prompt?.trim()) {
      return 'No prompt connected. Connect a Text Prompt node to the Prompt input.'
    }

    try {
      const serverNodeId = nodeId.match(/^\d+$/) ? nodeId : undefined
      const genNode = currentNodes.find((n) => n.id === nodeId)
      const nodeData = genNode?.data as Record<string, unknown> | undefined
      const settings: Record<string, string> = {}
      if (nodeData?.imageSize) settings.image_size = nodeData.imageSize as string
      if (nodeData?.guidanceScale) settings.guidance_scale = nodeData.guidanceScale as string
      if (nodeData?.outputFormat) settings.output_format = nodeData.outputFormat as string
      if (nodeData?.seed) settings.seed = nodeData.seed as string
      if (nodeData?.enablePromptExpansion) settings.enable_prompt_expansion = nodeData.enablePromptExpansion as string
      if (nodeData?.enableSafetyChecker !== undefined) settings.enable_safety_checker = String(nodeData.enableSafetyChecker)
      const result = await api.generateFlux2Flash(prompt, serverNodeId, settings)
      if (result.error) return result.error

      const imageUrl = result.node_image_id
        ? await api.fetchNodeImageBlob(result.node_image_id)
        : `data:${result.mime_type};base64,${result.image_data}`

      const newEntry = { id: result.node_image_id, url: imageUrl }

      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n
          const nd = n.data as Record<string, unknown>
          const history = [...((nd.imageHistory as { id: number; url: string }[]) || [])]
          history.push(newEntry)
          return { ...n, data: { ...nd, imageUrl, activeImageId: result.node_image_id, imageHistory: history, imageIndex: history.length - 1 } }
        }),
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
        data: { onChange: handleNodeDataChange, onRunModel: handleRunModel, onRunBgRemoval: handleRunBgRemoval, onRunTrellis: handleRunTrellis, debugSettings },
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
    [dropMenu, setNodes, setEdges, handleNodeDataChange, handleRunModel, handleRunFlux2Flash, handleRunBgRemoval, handleRunTrellis, debugSettings],
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
        data: { onChange: handleNodeDataChange, onRunModel: handleRunModel, onRunBgRemoval: handleRunBgRemoval, onRunTrellis: handleRunTrellis, debugSettings },
      }
      setNodes((nds) => [...nds, newNode])
      queueRef.current?.push({
        type: 'node_create',
        payload: { client_id: clientId, type, position, data: {} },
      })
    },
    [screenToFlowPosition, setNodes, handleNodeDataChange, handleRunModel, handleRunFlux2Flash, handleRunBgRemoval, handleRunTrellis, debugSettings],
  )

  // Detect single selected node for sub-nav
  const selectedNodes = nodes.filter((n) => n.selected)
  const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : null
  const showSubNav = selectedNode?.type === 'imageGen' || selectedNode?.type === 'flux2Flash' || selectedNode?.type === 'relight'

  const handleRunSelected = () => {
    if (!selectedNode) return
    setRunningSelected(true)
    const runner = selectedNode.type === 'bgRemoval' ? handleRunBgRemoval : selectedNode.type === 'trellis' ? handleRunTrellis : selectedNode.type === 'flux2Flash' ? handleRunFlux2Flash : handleRunModel
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
    <div className="h-screen w-screen bg-neutral-950 relative">
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
        defaultEdgeOptions={defaultEdgeOptions}
        connectionLineStyle={{ stroke: connectionLineColor, strokeWidth: 2 }}
        panOnDrag={toolMode === 'hand' ? true : [1, 2]}
        selectionOnDrag={toolMode === 'select'}
        selectionMode={SelectionMode.Partial}
        deleteKeyCode={['Backspace', 'Delete']}
        panOnScroll
        zoomOnScroll={false}
        zoomOnPinch
        fitView
        className={`bg-neutral-950 ${toolMode === 'select' ? 'cursor-select-mode' : ''}`}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#333" />

        {/* Attached under-node settings — rendered inside ReactFlow so it pans/zooms with the canvas */}
        {settingsMode === 'attached' && selectedNode && showSubNav && (() => {
          const sd = selectedNode.data as Record<string, unknown>
          const up = (key: string, value: unknown) => updateSelectedNodeData(key, String(value))
          const nodeWidth = selectedNode.measured?.width ?? 352
          const nodeHeight = selectedNode.measured?.height ?? 300
          const flowX = selectedNode.position.x + nodeWidth / 2
          const flowY = selectedNode.position.y + nodeHeight
          const screenX = flowX * viewport.zoom + viewport.x
          const screenY = flowY * viewport.zoom + viewport.y

          return (
            <div
              className="absolute z-[5] pointer-events-auto"
              style={{
                left: screenX,
                top: screenY + 8 * viewport.zoom,
                transform: `translateX(-50%) scale(${viewport.zoom})`,
                transformOrigin: 'top center',
              }}
            >
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl p-3 space-y-2">
                {selectedNode.type === 'imageGen' && (
                  <div className="flex items-center gap-2">
                    <SubNavField label="Resolution">
                      <SubNavSelect value={(sd.resolution as string) || '1K'} onChange={(val) => up('resolution', val)}
                        options={[['0.5K','0.5K'],['1K','1K'],['2K','2K'],['4K','4K']]} />
                    </SubNavField>
                    <SubNavField label="Aspect">
                      <SubNavSelect value={(sd.aspectRatio as string) || 'auto'} onChange={(val) => up('aspectRatio', val)}
                        options={[['auto','Auto'],['1:1','1:1'],['4:3','4:3'],['3:4','3:4'],['16:9','16:9'],['9:16','9:16']]} />
                    </SubNavField>
                    <SubNavField label="Format">
                      <SubNavSelect value={(sd.outputFormat as string) || 'png'} onChange={(val) => up('outputFormat', val)}
                        options={[['png','PNG'],['jpeg','JPEG'],['webp','WebP']]} />
                    </SubNavField>
                  </div>
                )}
                {selectedNode.type === 'flux2Flash' && (
                  <div className="flex items-center gap-2">
                    <SubNavField label="Size">
                      <SubNavSelect value={(sd.imageSize as string) || 'landscape_4_3'} onChange={(val) => up('imageSize', val)}
                        options={[['square','Sq'],['square_hd','Sq HD'],['portrait_4_3','4:3 P'],['portrait_16_9','16:9 P'],['landscape_4_3','4:3 L'],['landscape_16_9','16:9 L']]} />
                    </SubNavField>
                    <SubNavField label="Guidance">
                      <SubNavSlider value={(sd.guidanceScale as number) ?? 2.5} onChange={(val) => up('guidanceScale', val)} min={0} max={20} step={0.5} />
                    </SubNavField>
                    <SubNavField label="Format">
                      <SubNavSelect value={(sd.outputFormat as string) || 'png'} onChange={(val) => up('outputFormat', val)}
                        options={[['png','PNG'],['jpeg','JPEG'],['webp','WebP']]} />
                    </SubNavField>
                    <SubNavField label="Expand">
                      <SubNavCheck checked={(sd.enablePromptExpansion as boolean) ?? false} onChange={(val) => up('enablePromptExpansion', String(val))} />
                    </SubNavField>
                  </div>
                )}
                {selectedNode.type === 'relight' && (
                  <>
                    <div className="flex items-center gap-2">
                      <SubNavField label="Size">
                        <SubNavSelect value={(sd.imageSize as string) || 'square_hd'} onChange={(val) => up('imageSize', val)}
                          options={[['square','Sq'],['square_hd','Sq HD'],['portrait_4_3','4:3 P'],['portrait_16_9','16:9 P'],['landscape_4_3','4:3 L'],['landscape_16_9','16:9 L']]} />
                      </SubNavField>
                      <SubNavField label="Steps">
                        <SubNavSlider value={(sd.inferenceSteps as number) ?? 28} onChange={(val) => up('inferenceSteps', String(val))} min={1} max={100} step={1} />
                      </SubNavField>
                      <SubNavField label="Guidance">
                        <SubNavSlider value={(sd.guidanceScale as number) ?? 5} onChange={(val) => up('guidanceScale', String(val))} min={1} max={20} step={0.5} />
                      </SubNavField>
                      <SubNavField label="CFG">
                        <SubNavSlider value={(sd.cfg as number) ?? 1} onChange={(val) => up('cfg', String(val))} min={0} max={30} step={0.5} />
                      </SubNavField>
                    </div>
                    <div className="flex items-center gap-2">
                      <SubNavField label="Lo Denoise">
                        <SubNavSlider value={(sd.lowResDenoise as number) ?? 0.98} onChange={(val) => up('lowResDenoise', String(val))} min={0} max={1} step={0.01} />
                      </SubNavField>
                      <SubNavField label="Hi Denoise">
                        <SubNavSlider value={(sd.highResDenoise as number) ?? 0.95} onChange={(val) => up('highResDenoise', String(val))} min={0} max={1} step={0.01} />
                      </SubNavField>
                      <SubNavField label="HR Down">
                        <SubNavSlider value={(sd.hrDownscale as number) ?? 0.5} onChange={(val) => up('hrDownscale', String(val))} min={0.1} max={1} step={0.05} />
                      </SubNavField>
                      <SubNavField label="Format">
                        <SubNavSelect value={(sd.outputFormat as string) || 'png'} onChange={(val) => up('outputFormat', val)}
                          options={[['png','PNG'],['jpeg','JPEG'],['webp','WebP']]} />
                      </SubNavField>
                    </div>
                  </>
                )}
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
      {showSubNav && settingsMode !== 'sidebar' && settingsMode !== 'narrow' && settingsMode !== 'attached' && selectedNode && (() => {
        const sd = selectedNode.data as Record<string, unknown>
        return (
          <div className="absolute bottom-[5.5rem] left-1/2 -translate-x-1/2 z-40">
            <div className="flex items-end gap-3 bg-neutral-900 border border-neutral-800 rounded-2xl px-3 py-2 shadow-2xl">
              {selectedNode.type === 'imageGen' && (
                <>
                  <SubNavField label="Resolution">
                    <SubNavSelect
                      value={(sd.resolution as string) || '1K'}
                      onChange={(v) => updateSelectedNodeData('resolution', v)}
                      options={[['0.5K','0.5K'],['1K','1K'],['2K','2K'],['4K','4K']]}
                    />
                  </SubNavField>
                  <SubNavField label="Aspect Ratio">
                    <SubNavSelect
                      value={(sd.aspectRatio as string) || 'auto'}
                      onChange={(v) => updateSelectedNodeData('aspectRatio', v)}
                      options={[['auto','Auto'],['1:1','1:1'],['4:3','4:3'],['3:4','3:4'],['16:9','16:9'],['9:16','9:16'],['3:2','3:2'],['2:3','2:3'],['21:9','21:9'],['5:4','5:4'],['4:5','4:5']]}
                    />
                  </SubNavField>
                  <SubNavField label="Format">
                    <SubNavSelect
                      value={(sd.outputFormat as string) || 'png'}
                      onChange={(v) => updateSelectedNodeData('outputFormat', v)}
                      options={[['png','PNG'],['jpeg','JPEG'],['webp','WebP']]}
                    />
                  </SubNavField>
                </>
              )}
              {selectedNode.type === 'flux2Flash' && (
                <>
                  <SubNavField label="Image Size">
                    <SubNavSelect
                      value={(sd.imageSize as string) || 'landscape_4_3'}
                      onChange={(v) => updateSelectedNodeData('imageSize', v)}
                      options={[['square','Square'],['square_hd','Square HD'],['portrait_4_3','4:3 P'],['portrait_16_9','16:9 P'],['landscape_4_3','4:3 L'],['landscape_16_9','16:9 L']]}
                    />
                  </SubNavField>
                  <SubNavField label="Guidance">
                    <SubNavNumber value={(sd.guidanceScale as number) ?? 2.5} onChange={(v) => updateSelectedNodeData('guidanceScale', String(v))} min={0} max={20} step={0.5} />
                  </SubNavField>
                  <SubNavField label="Format">
                    <SubNavSelect
                      value={(sd.outputFormat as string) || 'png'}
                      onChange={(v) => updateSelectedNodeData('outputFormat', v)}
                      options={[['png','PNG'],['jpeg','JPEG'],['webp','WebP']]}
                    />
                  </SubNavField>
                  <SubNavField label="Expand">
                    <SubNavCheck checked={(sd.enablePromptExpansion as boolean) ?? false} onChange={(v) => updateSelectedNodeData('enablePromptExpansion', String(v))} />
                  </SubNavField>
                </>
              )}
              {selectedNode.type === 'relight' && (
                <>
                  <SubNavField label="Image Size">
                    <SubNavSelect
                      value={(sd.imageSize as string) || 'square_hd'}
                      onChange={(v) => updateSelectedNodeData('imageSize', v)}
                      options={[['square','Square'],['square_hd','Square HD'],['portrait_4_3','4:3 P'],['portrait_16_9','16:9 P'],['landscape_4_3','4:3 L'],['landscape_16_9','16:9 L']]}
                    />
                  </SubNavField>
                  <div className="h-8 w-px bg-neutral-800" />
                  <SubNavField label="Steps">
                    <SubNavNumber value={(sd.inferenceSteps as number) ?? 28} onChange={(v) => updateSelectedNodeData('inferenceSteps', String(v))} min={1} max={100} step={1} />
                  </SubNavField>
                  <SubNavField label="Guidance">
                    <SubNavNumber value={(sd.guidanceScale as number) ?? 5} onChange={(v) => updateSelectedNodeData('guidanceScale', String(v))} min={1} max={20} step={0.5} />
                  </SubNavField>
                  <SubNavField label="CFG">
                    <SubNavNumber value={(sd.cfg as number) ?? 1} onChange={(v) => updateSelectedNodeData('cfg', String(v))} min={0} max={30} step={0.5} />
                  </SubNavField>
                  <div className="h-8 w-px bg-neutral-800" />
                  <SubNavField label="Lo Denoise">
                    <SubNavNumber value={(sd.lowResDenoise as number) ?? 0.98} onChange={(v) => updateSelectedNodeData('lowResDenoise', String(v))} min={0} max={1} step={0.01} />
                  </SubNavField>
                  <SubNavField label="Hi Denoise">
                    <SubNavNumber value={(sd.highResDenoise as number) ?? 0.95} onChange={(v) => updateSelectedNodeData('highResDenoise', String(v))} min={0} max={1} step={0.01} />
                  </SubNavField>
                  <SubNavField label="HR Down">
                    <SubNavNumber value={(sd.hrDownscale as number) ?? 0.5} onChange={(v) => updateSelectedNodeData('hrDownscale', String(v))} min={0.1} max={1} step={0.05} />
                  </SubNavField>
                  <div className="h-8 w-px bg-neutral-800" />
                  <SubNavField label="Seed">
                    <div className="flex items-center gap-1.5">
                      <SubNavNumber value={(sd.seed as number) ?? 42} onChange={(v) => updateSelectedNodeData('seed', String(v))} min={0} max={999999} step={1} />
                      <span className="text-[10px] text-neutral-500">Rng</span>
                      <SubNavCheck checked={(sd.randomSeed as boolean) ?? true} onChange={(v) => updateSelectedNodeData('randomSeed', String(v))} />
                    </div>
                  </SubNavField>
                  <div className="h-8 w-px bg-neutral-800" />
                  <SubNavField label="Latent">
                    <SubNavSelect
                      value={(sd.initialLatent as string) || 'none'}
                      onChange={(v) => updateSelectedNodeData('initialLatent', v)}
                      options={[['none','None'],['image','Image']]}
                    />
                  </SubNavField>
                  <SubNavField label="Format">
                    <SubNavSelect
                      value={(sd.outputFormat as string) || 'png'}
                      onChange={(v) => updateSelectedNodeData('outputFormat', v)}
                      options={[['png','PNG'],['jpeg','JPEG'],['webp','WebP']]}
                    />
                  </SubNavField>
                  <div className="h-8 w-px bg-neutral-800" />
                  <SubNavField label="HR Fix">
                    <SubNavCheck checked={(sd.enableHRFix as boolean) ?? true} onChange={(v) => updateSelectedNodeData('enableHRFix', String(v))} />
                  </SubNavField>
                  <SubNavField label="Safety">
                    <SubNavCheck checked={(sd.enableSafetyChecker as boolean) ?? true} onChange={(v) => updateSelectedNodeData('enableSafetyChecker', String(v))} />
                  </SubNavField>
                </>
              )}
              <div className="h-8 w-px bg-neutral-800" />
              <button
                onClick={handleRunSelected}
                disabled={runningSelected}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
              >
                {runningSelected ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                {runningSelected ? 'Running...' : 'Run'}
              </button>
            </div>
          </div>
        )
      })()}

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
      {settingsMode === 'sidebar' && selectedNode && showSubNav && (() => {
        const sd = selectedNode.data as Record<string, unknown>
        const defaults: Record<string, unknown> = {
          imageSize: 'landscape_4_3', guidanceScale: 2.5, enablePromptExpansion: false,
          enableSafetyChecker: true, inferenceSteps: 28, randomSeed: true, seed: 42,
          initialLatent: 'none', enableHRFix: true, cfg: 1, lowResDenoise: 0.98,
          highResDenoise: 0.95, hrDownscale: 0.5, guidanceScale: 5,
          enableSafetyChecker: true, outputFormat: 'png',
          resolution: '1K', aspectRatio: 'auto', safetyTolerance: '4',
        }
        const v = (key: string) => sd[key] !== undefined ? sd[key] : defaults[key]
        const up = (key: string, value: unknown) => updateSelectedNodeData(key, String(value))

        return (
          <div className="absolute right-4 w-72 z-40 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl flex flex-col" style={{ top: '5.5rem', bottom: '6.5rem' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
              <span className="text-sm font-medium text-neutral-200">
                {selectedNode.type === 'imageGen' ? 'Nano Banana 2' : selectedNode.type === 'flux2Flash' ? 'Flux 2 Flash' : selectedNode.type === 'bgRemoval' ? 'BG Removal' : selectedNode.type === 'trellis' ? 'Trellis' : 'Relight 2.0'}
              </span>
              <button onClick={() => setSettingsMode('off')} className="p-1 text-neutral-500 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {selectedNode.type === 'imageGen' && (
                <>
                  <SidebarDropdown label="Resolution" value={v('resolution') as string} onChange={(val) => up('resolution', val)}
                    options={[['0.5K','0.5K'],['1K','1K'],['2K','2K'],['4K','4K']]} />
                  <SidebarDropdown label="Aspect Ratio" value={v('aspectRatio') as string} onChange={(val) => up('aspectRatio', val)}
                    options={[['auto','Auto'],['1:1','1:1'],['4:3','4:3'],['3:4','3:4'],['16:9','16:9'],['9:16','9:16'],['3:2','3:2'],['2:3','2:3'],['21:9','21:9'],['5:4','5:4'],['4:5','4:5']]} />
                  <SidebarDropdown label="Output Format" value={v('outputFormat') as string} onChange={(val) => up('outputFormat', val)}
                    options={[['png','PNG'],['jpeg','JPEG'],['webp','WebP']]} />
                  <SidebarDropdown label="Safety" value={v('safetyTolerance') as string} onChange={(val) => up('safetyTolerance', val)}
                    options={[['1','1 (Strict)'],['2','2'],['3','3'],['4','4 (Default)'],['5','5'],['6','6 (Relaxed)']]} />
                </>
              )}
              {selectedNode.type === 'flux2Flash' && (
                <>
                  <SidebarDropdown label="Image Size" value={v('imageSize') as string} onChange={(val) => up('imageSize', val)}
                    options={[['square','Square'],['square_hd','Square HD'],['portrait_4_3','Portrait 4:3'],['portrait_16_9','Portrait 16:9'],['landscape_4_3','Landscape 4:3'],['landscape_16_9','Landscape 16:9']]} />
                  <SidebarSlider label="Guidance Scale" value={v('guidanceScale') as number} min={0} max={20} step={0.5} onChange={(val) => up('guidanceScale', val)} />
                  <SidebarDropdown label="Output Format" value={v('outputFormat') as string} onChange={(val) => up('outputFormat', val)}
                    options={[['png','PNG'],['jpeg','JPEG'],['webp','WebP']]} />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={(v('enablePromptExpansion') as boolean) ?? false} onChange={(e) => up('enablePromptExpansion', e.target.checked)} className="w-3.5 h-3.5 rounded border-neutral-600 bg-neutral-800 accent-purple-500 cursor-pointer" />
                      <span className="text-[11px] font-medium text-neutral-400">Prompt Expansion</span>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={(v('enableSafetyChecker') as boolean) ?? true} onChange={(e) => up('enableSafetyChecker', e.target.checked)} className="w-3.5 h-3.5 rounded border-neutral-600 bg-neutral-800 accent-purple-500 cursor-pointer" />
                      <span className="text-[11px] font-medium text-neutral-400">Safety Checker</span>
                    </label>
                  </div>
                </>
              )}
              {selectedNode.type === 'relight' && (
                <>
                  <SidebarDropdown label="Image Size" value={v('imageSize') as string} onChange={(val) => up('imageSize', val)}
                    options={[['square','Square'],['square_hd','Square HD'],['portrait_4_3','Portrait 4:3'],['portrait_16_9','Portrait 16:9'],['landscape_4_3','Landscape 4:3'],['landscape_16_9','Landscape 16:9']]} />
                  <SidebarSlider label="Inference Steps" value={v('inferenceSteps') as number} min={1} max={100} step={1} onChange={(val) => up('inferenceSteps', val)} />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={v('randomSeed') as boolean} onChange={(e) => up('randomSeed', e.target.checked)} className="w-3.5 h-3.5 rounded border-neutral-600 bg-neutral-800 accent-purple-500 cursor-pointer" />
                      <span className="text-[11px] font-medium text-neutral-400">Random Seed</span>
                    </label>
                    <input type="number" value={v('seed') as number} onChange={(e) => { const n = parseInt(e.target.value); if (!isNaN(n)) up('seed', n) }}
                      disabled={v('randomSeed') as boolean}
                      className="w-16 bg-neutral-800 text-xs text-neutral-200 text-center rounded-md py-1 outline-none border border-neutral-700 disabled:opacity-40" />
                  </div>
                  <SidebarDropdown label="Initial Latent" value={v('initialLatent') as string} onChange={(val) => up('initialLatent', val)}
                    options={[['none','None'],['image','Image']]} />
                  <SidebarSlider label="Guidance Scale" value={v('guidanceScale') as number} min={1} max={20} step={0.5} onChange={(val) => up('guidanceScale', val)} />
                  <SidebarSlider label="CFG" value={v('cfg') as number} min={0} max={30} step={0.5} onChange={(val) => up('cfg', val)} />
                  <SidebarSlider label="Low-res Denoise" value={v('lowResDenoise') as number} min={0} max={1} step={0.01} onChange={(val) => up('lowResDenoise', val)} />
                  <SidebarSlider label="High-res Denoise" value={v('highResDenoise') as number} min={0} max={1} step={0.01} onChange={(val) => up('highResDenoise', val)} />
                  <SidebarSlider label="HR Downscale" value={v('hrDownscale') as number} min={0.1} max={1} step={0.05} onChange={(val) => up('hrDownscale', val)} />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={v('enableHRFix') as boolean} onChange={(e) => up('enableHRFix', e.target.checked)} className="w-3.5 h-3.5 rounded border-neutral-600 bg-neutral-800 accent-purple-500 cursor-pointer" />
                      <span className="text-[11px] font-medium text-neutral-400">Enable HR Fix</span>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={v('enableSafetyChecker') as boolean} onChange={(e) => up('enableSafetyChecker', e.target.checked)} className="w-3.5 h-3.5 rounded border-neutral-600 bg-neutral-800 accent-purple-500 cursor-pointer" />
                      <span className="text-[11px] font-medium text-neutral-400">Safety Checker</span>
                    </label>
                  </div>
                  <SidebarDropdown label="Output Format" value={v('outputFormat') as string} onChange={(val) => up('outputFormat', val)}
                    options={[['png','PNG'],['jpeg','JPEG'],['webp','WebP']]} />
                </>
              )}
            </div>
            <div className="px-4 py-3 border-t border-neutral-800">
              <button
                onClick={handleRunSelected}
                disabled={runningSelected}
                className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 text-white rounded-lg py-2 text-sm font-medium transition-colors"
              >
                {runningSelected ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                {runningSelected ? 'Running...' : 'Run Selected'}
              </button>
            </div>
          </div>
        )
      })()}

      {/* Narrow sidebar */}
      {settingsMode === 'narrow' && selectedNode && showSubNav && (() => {
        const sd = selectedNode.data as Record<string, unknown>
        const defaults: Record<string, unknown> = {
          imageSize: 'landscape_4_3', guidanceScale: 2.5, enablePromptExpansion: false,
          enableSafetyChecker: true, inferenceSteps: 28, randomSeed: true, seed: 42,
          initialLatent: 'none', enableHRFix: true, cfg: 1, lowResDenoise: 0.98,
          highResDenoise: 0.95, hrDownscale: 0.5,
          outputFormat: 'png', resolution: '1K', aspectRatio: 'auto', safetyTolerance: '4',
        }
        const v = (key: string) => sd[key] !== undefined ? sd[key] : defaults[key]
        const up = (key: string, value: unknown) => updateSelectedNodeData(key, String(value))

        return (
          <div className="absolute right-4 w-48 z-40 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl flex flex-col" style={{ top: '5.5rem', bottom: '6.5rem' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
              <span className="text-sm font-medium text-neutral-200 truncate">
                {selectedNode.type === 'imageGen' ? 'Nano Banana 2' : selectedNode.type === 'flux2Flash' ? 'Flux 2 Flash' : selectedNode.type === 'bgRemoval' ? 'BG Removal' : selectedNode.type === 'trellis' ? 'Trellis' : 'Relight 2.0'}
              </span>
              <button onClick={() => setSettingsMode('off')} className="p-1 text-neutral-500 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {selectedNode.type === 'imageGen' && (
                <>
                  <SidebarDropdown label="Resolution" value={v('resolution') as string} onChange={(val) => up('resolution', val)}
                    options={[['0.5K','0.5K'],['1K','1K'],['2K','2K'],['4K','4K']]} />
                  <SidebarDropdown label="Aspect Ratio" value={v('aspectRatio') as string} onChange={(val) => up('aspectRatio', val)}
                    options={[['auto','Auto'],['1:1','1:1'],['4:3','4:3'],['3:4','3:4'],['16:9','16:9'],['9:16','9:16'],['3:2','3:2'],['2:3','2:3'],['21:9','21:9'],['5:4','5:4'],['4:5','4:5']]} />
                  <SidebarDropdown label="Output Format" value={v('outputFormat') as string} onChange={(val) => up('outputFormat', val)}
                    options={[['png','PNG'],['jpeg','JPEG'],['webp','WebP']]} />
                  <SidebarDropdown label="Safety" value={v('safetyTolerance') as string} onChange={(val) => up('safetyTolerance', val)}
                    options={[['1','1 (Strict)'],['2','2'],['3','3'],['4','4 (Default)'],['5','5'],['6','6 (Relaxed)']]} />
                </>
              )}
              {selectedNode.type === 'flux2Flash' && (
                <>
                  <SidebarDropdown label="Image Size" value={v('imageSize') as string} onChange={(val) => up('imageSize', val)}
                    options={[['square','Square'],['square_hd','Square HD'],['portrait_4_3','Portrait 4:3'],['portrait_16_9','Portrait 16:9'],['landscape_4_3','Landscape 4:3'],['landscape_16_9','Landscape 16:9']]} />
                  <SidebarSlider label="Guidance Scale" value={v('guidanceScale') as number} min={0} max={20} step={0.5} onChange={(val) => up('guidanceScale', val)} />
                  <SidebarDropdown label="Output Format" value={v('outputFormat') as string} onChange={(val) => up('outputFormat', val)}
                    options={[['png','PNG'],['jpeg','JPEG'],['webp','WebP']]} />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={(v('enablePromptExpansion') as boolean) ?? false} onChange={(e) => up('enablePromptExpansion', e.target.checked)} className="w-3.5 h-3.5 rounded border-neutral-600 bg-neutral-800 accent-purple-500 cursor-pointer" />
                      <span className="text-[11px] font-medium text-neutral-400">Prompt Expansion</span>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={(v('enableSafetyChecker') as boolean) ?? true} onChange={(e) => up('enableSafetyChecker', e.target.checked)} className="w-3.5 h-3.5 rounded border-neutral-600 bg-neutral-800 accent-purple-500 cursor-pointer" />
                      <span className="text-[11px] font-medium text-neutral-400">Safety Checker</span>
                    </label>
                  </div>
                </>
              )}
              {selectedNode.type === 'relight' && (
                <>
                  <SidebarDropdown label="Image Size" value={v('imageSize') as string} onChange={(val) => up('imageSize', val)}
                    options={[['square','Square'],['square_hd','Square HD'],['portrait_4_3','Portrait 4:3'],['portrait_16_9','Portrait 16:9'],['landscape_4_3','Landscape 4:3'],['landscape_16_9','Landscape 16:9']]} />
                  <SidebarSlider label="Inference Steps" value={v('inferenceSteps') as number} min={1} max={100} step={1} onChange={(val) => up('inferenceSteps', val)} />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={v('randomSeed') as boolean} onChange={(e) => up('randomSeed', e.target.checked)} className="w-3.5 h-3.5 rounded border-neutral-600 bg-neutral-800 accent-purple-500 cursor-pointer" />
                      <span className="text-[11px] font-medium text-neutral-400">Random Seed</span>
                    </label>
                    <input type="number" value={v('seed') as number} onChange={(e) => { const n = parseInt(e.target.value); if (!isNaN(n)) up('seed', n) }}
                      disabled={v('randomSeed') as boolean}
                      className="w-16 bg-neutral-800 text-xs text-neutral-200 text-center rounded-md py-1 outline-none border border-neutral-700 disabled:opacity-40" />
                  </div>
                  <SidebarDropdown label="Initial Latent" value={v('initialLatent') as string} onChange={(val) => up('initialLatent', val)}
                    options={[['none','None'],['image','Image']]} />
                  <SidebarSlider label="Guidance Scale" value={v('guidanceScale') as number} min={1} max={20} step={0.5} onChange={(val) => up('guidanceScale', val)} />
                  <SidebarSlider label="CFG" value={v('cfg') as number} min={0} max={30} step={0.5} onChange={(val) => up('cfg', val)} />
                  <SidebarSlider label="Low-res Denoise" value={v('lowResDenoise') as number} min={0} max={1} step={0.01} onChange={(val) => up('lowResDenoise', val)} />
                  <SidebarSlider label="High-res Denoise" value={v('highResDenoise') as number} min={0} max={1} step={0.01} onChange={(val) => up('highResDenoise', val)} />
                  <SidebarSlider label="HR Downscale" value={v('hrDownscale') as number} min={0.1} max={1} step={0.05} onChange={(val) => up('hrDownscale', val)} />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={v('enableHRFix') as boolean} onChange={(e) => up('enableHRFix', e.target.checked)} className="w-3.5 h-3.5 rounded border-neutral-600 bg-neutral-800 accent-purple-500 cursor-pointer" />
                      <span className="text-[11px] font-medium text-neutral-400">Enable HR Fix</span>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={v('enableSafetyChecker') as boolean} onChange={(e) => up('enableSafetyChecker', e.target.checked)} className="w-3.5 h-3.5 rounded border-neutral-600 bg-neutral-800 accent-purple-500 cursor-pointer" />
                      <span className="text-[11px] font-medium text-neutral-400">Safety Checker</span>
                    </label>
                  </div>
                  <SidebarDropdown label="Output Format" value={v('outputFormat') as string} onChange={(val) => up('outputFormat', val)}
                    options={[['png','PNG'],['jpeg','JPEG'],['webp','WebP']]} />
                </>
              )}
            </div>
            <div className="px-4 py-3 border-t border-neutral-800">
              <button
                onClick={handleRunSelected}
                disabled={runningSelected}
                className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 text-white rounded-lg py-2 text-sm font-medium transition-colors"
              >
                {runningSelected ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                {runningSelected ? 'Running...' : 'Run Selected'}
              </button>
            </div>
          </div>
        )
      })()}

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
