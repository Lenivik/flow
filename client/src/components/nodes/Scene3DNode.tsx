import { memo, useState, useRef, useCallback, useEffect, useLayoutEffect, Suspense, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Handle, Position, useNodeConnections, useReactFlow, useNodes, type NodeProps } from '@xyflow/react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, TransformControls, Environment } from '@react-three/drei'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { Layers, Move, RotateCw, Maximize2, X } from 'lucide-react'
import NodeHeader from './NodeHeader'
import { useNodeActions } from '../../hooks/useNodeActions'

const NODE_WIDTH = 700
const SCENE_HEIGHT = 400
const PANEL_WIDTH = 200

// ─── Types ────────────────────────────────────────────────────────────────────

interface LayerTransform {
  position: [number, number, number]
  rotation: [number, number, number] // degrees
  scale: [number, number, number]
}

interface SceneLayer {
  id: string
  label: string
  type: 'image' | 'model'
  url: string
}

type TransformMode = 'translate' | 'rotate' | 'scale'

const DEFAULT_TRANSFORM: LayerTransform = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
}

function toRad(deg: number) { return (deg * Math.PI) / 180 }
function toDeg(rad: number) { return (rad * 180) / Math.PI }

// ─── ImageSticker — 2D image as a repositionable flat plane ──────────────────

// Hides all objects tagged userData.selectionUI, renders a clean frame, then restores visibility
function captureWithoutSelectionUI(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  onCapture: (dataUrl: string) => void,
) {
  const hidden: THREE.Object3D[] = []
  scene.traverse((obj) => {
    if (obj.userData.selectionUI && obj.visible) {
      obj.visible = false
      hidden.push(obj)
    }
  })
  gl.render(scene, camera)
  hidden.forEach((obj) => { obj.visible = true })
  onCapture(gl.domElement.toDataURL('image/png'))
}

function ImageSticker({ url, selected, onClick, onLoad }: { url: string; selected: boolean; onClick: () => void; onLoad?: () => void }) {
  const [tex, setTex] = useState<THREE.Texture | null>(null)
  const [aspect, setAspect] = useState(1)

  useEffect(() => {
    const loader = new THREE.TextureLoader()
    loader.load(
      url,
      (t) => {
        t.needsUpdate = true
        const img = t.image as HTMLImageElement
        const w = img.naturalWidth || img.width || 1
        const h = img.naturalHeight || img.height || 1
        setAspect(w / h)
        setTex(t)
        onLoad?.()
      },
      undefined,
      (err) => console.warn('Scene3D: texture load failed', url, err),
    )
    return () => { setTex(null) }
  }, [url]) // eslint-disable-line react-hooks/exhaustive-deps — onLoad is stable ref

  if (!tex) return null

  return (
    <group onClick={(e) => { e.stopPropagation(); onClick() }}>
      <mesh>
        <planeGeometry args={[aspect * 2, 2]} />
        {/* transparent + alphaTest preserves PNG alpha channel (e.g. BG removal output) */}
        <meshBasicMaterial map={tex} side={THREE.DoubleSide} transparent alphaTest={0.05} />
      </mesh>
      {selected && (
        <mesh userData={{ selectionUI: true }}>
          <planeGeometry args={[aspect * 2, 2]} />
          <meshBasicMaterial color="#00FFC5" wireframe transparent opacity={0.6} />
        </mesh>
      )}
    </group>
  )
}

// ─── GlbObject — fresh loader per canvas, never shares with TrellisNode ──────
// useGLTF caches globally across canvases which breaks WebGL context isolation.
// Using GLTFLoader directly in a useEffect guarantees fresh context-local objects.

function GlbObject({ url, selected, onClick, onLoad }: { url: string; selected: boolean; onClick: () => void; onLoad?: () => void }) {
  const [sceneObj, setSceneObj] = useState<THREE.Group | null>(null)

  useEffect(() => {
    let active = true
    const loader = new GLTFLoader()
    loader.load(
      url,
      (gltf) => {
        if (!active) return
        const root = gltf.scene

        // Center and normalize to ~1 unit
        const box = new THREE.Box3().setFromObject(root)
        if (!box.isEmpty()) {
          const center = box.getCenter(new THREE.Vector3())
          const size = box.getSize(new THREE.Vector3())
          const maxDim = Math.max(size.x, size.y, size.z)
          root.position.sub(center)
          if (maxDim > 0) root.scale.setScalar(1 / maxDim)
        }
        setSceneObj(root)
        onLoad?.()
      },
      undefined,
      (err) => console.warn('Scene3D: GLB load failed', url, err),
    )
    return () => { active = false }
  }, [url]) // eslint-disable-line react-hooks/exhaustive-deps — onLoad is stable ref

  if (!sceneObj) return null

  return (
    <group onClick={(e) => { e.stopPropagation(); onClick() }}>
      <primitive object={sceneObj} />
      {selected && (
        <mesh userData={{ selectionUI: true }}>
          <boxGeometry args={[1.15, 1.15, 1.15]} />
          <meshBasicMaterial color="#00FFC5" wireframe opacity={0.5} transparent />
        </mesh>
      )}
    </group>
  )
}

// ─── SceneObject — wraps a layer with imperative transforms + gizmo ───────────
// The outer group has NO JSX position/rotation/scale props — transforms are
// applied imperatively via useLayoutEffect so React never fights the gizmo.

function SceneObject({ layer, transform, selected, mode, onSelect, onTransformChange, onLoad }: {
  layer: SceneLayer
  transform: LayerTransform
  selected: boolean
  mode: TransformMode
  onSelect: () => void
  onTransformChange: (t: LayerTransform) => void
  onLoad?: () => void
}) {
  const groupRef = useRef<THREE.Group>(null)
  const isDragging = useRef(false)
  // Stable ref callback — must not be an inline arrow function or React re-calls it every render,
  // which causes TransformControls to detach/reattach and triggers an infinite update loop.
  const tcRefCallback = useCallback((tc: any) => {
    if (tc) tc.userData.selectionUI = true
  }, [])

  // Sync React state → Three.js object. useLayoutEffect fires before paint so
  // there's no frame where the object is at the wrong position. Skip during drag.
  useLayoutEffect(() => {
    if (!groupRef.current || isDragging.current) return
    groupRef.current.position.set(...transform.position)
    groupRef.current.rotation.set(toRad(transform.rotation[0]), toRad(transform.rotation[1]), toRad(transform.rotation[2]))
    groupRef.current.scale.set(...transform.scale)
  })

  const handleMouseDown = useCallback(() => { isDragging.current = true }, [])

  const handleMouseUp = useCallback(() => {
    if (!groupRef.current) return
    isDragging.current = false
    const o = groupRef.current
    onTransformChange({
      position: [o.position.x, o.position.y, o.position.z],
      rotation: [toDeg(o.rotation.x), toDeg(o.rotation.y), toDeg(o.rotation.z)],
      scale: [o.scale.x, o.scale.y, o.scale.z],
    })
  }, [onTransformChange])

  // Fire on every gizmo drag frame so TransformField values update live
  const handleChange = useCallback(() => {
    if (!groupRef.current || !isDragging.current) return
    const o = groupRef.current
    onTransformChange({
      position: [o.position.x, o.position.y, o.position.z],
      rotation: [toDeg(o.rotation.x), toDeg(o.rotation.y), toDeg(o.rotation.z)],
      scale: [o.scale.x, o.scale.y, o.scale.z],
    })
  }, [onTransformChange])

  return (
    <>
      <group ref={groupRef}>
        {layer.type === 'image'
          ? <ImageSticker url={layer.url} selected={selected} onClick={onSelect} onLoad={onLoad} />
          : <GlbObject url={layer.url} selected={selected} onClick={onSelect} onLoad={onLoad} />
        }
      </group>
      {selected && groupRef.current && (
        <TransformControls
          ref={tcRefCallback}
          object={groupRef as React.RefObject<THREE.Object3D>}
          mode={mode}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onChange={handleChange}
        />
      )}
    </>
  )
}

// ─── CaptureOnLoad — fires a capture on the next frame when an asset loads ────
// Uses useFrame so the capture always happens after Three.js has rendered the
// loaded object. GlbObject / ImageSticker call scheduleCapture() on load.

function CaptureOnLoad({ scheduled, onCapture }: {
  scheduled: React.MutableRefObject<boolean>
  onCapture: (dataUrl: string) => void
}) {
  const { gl, scene, camera } = useThree()

  useFrame(() => {
    if (!scheduled.current) return
    scheduled.current = false
    captureWithoutSelectionUI(gl, scene, camera, onCapture)
  })

  return null
}

// ─── OrbitCapture — stores a PNG snapshot of the viewport after orbit ─────────

function OrbitCapture({ controlsRef, onCapture }: {
  controlsRef: React.RefObject<any>
  onCapture: (dataUrl: string) => void
}) {
  const { gl, scene, camera } = useThree()

  const snap = useCallback(() => {
    captureWithoutSelectionUI(gl, scene, camera, onCapture)
  }, [gl, scene, camera, onCapture])

  useEffect(() => {
    const ctrl = controlsRef.current
    if (!ctrl) return
    ctrl.addEventListener('end', snap)
    return () => ctrl.removeEventListener('end', snap)
  }, [controlsRef, snap])

  return null
}

// ─── TransformField ───────────────────────────────────────────────────────────

function TransformField({ label, values, onChange }: {
  label: string
  values: [number, number, number]
  onChange: (v: [number, number, number]) => void
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] text-neutral-500 uppercase tracking-wide">{label}</span>
      <div className="flex gap-1">
        {(['X', 'Y', 'Z'] as const).map((axis, i) => (
          <div key={axis} className="flex flex-col items-center gap-0.5 flex-1">
            <span className="text-[8px] text-neutral-600">{axis}</span>
            <input
              type="number"
              value={Number(values[i].toFixed(3))}
              step={label === 'Scale' ? 0.1 : label === 'Rotation' ? 15 : 0.1}
              className="w-full bg-[#111] border border-[#27272A] rounded text-[9px] text-neutral-300 px-1 py-0.5 text-center nodrag"
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                if (isNaN(v)) return
                const next = [...values] as [number, number, number]
                next[i] = v
                onChange(next)
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── LayerList — draggable, reorderable sidebar layer list ───────────────────
// Uses HTML5 drag-and-drop. The `nodrag` class prevents React Flow from
// intercepting pointer events and treating the drag as a canvas pan.

function LayerList({
  layers,
  selectedLayerId,
  setSelectedLayerId,
  updateLayerOrder,
}: {
  layers: SceneLayer[]
  selectedLayerId: string | null
  setSelectedLayerId: (id: string | null) => void
  updateLayerOrder: (newOrder: string[]) => void
}) {
  const [dragLayerId, setDragLayerId] = useState<string | null>(null)
  const [dragOverLayerId, setDragOverLayerId] = useState<string | null>(null)

  if (layers.length === 0) {
    return (
      <p className="text-[10px] text-neutral-600 text-center mt-6 px-2 leading-relaxed">
        Connect images or 3D models to the Layers input
      </p>
    )
  }

  return (
    <>
      {layers.map((layer) => (
        <div
          key={layer.id}
          draggable
          onDragStart={(e) => { e.stopPropagation(); setDragLayerId(layer.id) }}
          onDragEnd={() => { setDragLayerId(null); setDragOverLayerId(null) }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverLayerId(layer.id) }}
          onDragLeave={(e) => { e.stopPropagation(); if (dragOverLayerId === layer.id) setDragOverLayerId(null) }}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (!dragLayerId || dragLayerId === layer.id) return
            const ids = layers.map((l) => l.id)
            const fromIdx = ids.indexOf(dragLayerId)
            const toIdx = ids.indexOf(layer.id)
            const newOrder = [...ids]
            newOrder.splice(fromIdx, 1)
            newOrder.splice(toIdx, 0, dragLayerId)
            updateLayerOrder(newOrder)
            setDragLayerId(null)
            setDragOverLayerId(null)
          }}
          className={`nodrag rounded transition-opacity ${dragLayerId === layer.id ? 'opacity-30' : 'opacity-100'} ${
            dragOverLayerId === layer.id && dragLayerId !== layer.id ? 'ring-1 ring-[#00FFC5]/60' : ''
          }`}
        >
          <button
            onClick={() => setSelectedLayerId(layer.id === selectedLayerId ? null : layer.id)}
            className={`w-full text-left px-2 py-1.5 rounded text-[10px] font-medium transition-colors truncate cursor-grab active:cursor-grabbing ${
              layer.id === selectedLayerId
                ? 'bg-[#00FFC5]/15 text-[#00FFC5] border border-[#00FFC5]/30'
                : 'bg-[#111] text-neutral-400 border border-[#27272A] hover:border-neutral-600'
            }`}
          >
            <span className="mr-1 text-[8px] opacity-50">{layer.type === 'model' ? '3D' : 'IMG'}</span>
            {layer.label}
          </button>
        </div>
      ))}
    </>
  )
}

// ─── FullscreenScene3D — full editing UI expanded to cover the viewport ────────
// Shares selectedLayerId / transformMode / transforms with the inline node so
// edits made in fullscreen are reflected when the user closes back to canvas.

function FullscreenScene3D({
  layers,
  orderedLayers,
  transforms,
  selectedLayerId,
  setSelectedLayerId,
  transformMode,
  setTransformMode,
  updateTransform,
  updateLayerOrder,
  captureScheduledRef,
  handleCapture,
  onClose,
}: {
  layers: SceneLayer[]
  orderedLayers: SceneLayer[]
  transforms: Record<string, LayerTransform>
  selectedLayerId: string | null
  setSelectedLayerId: (id: string | null) => void
  transformMode: TransformMode
  setTransformMode: (m: TransformMode) => void
  updateTransform: (lid: string, t: LayerTransform) => void
  updateLayerOrder: (newOrder: string[]) => void
  captureScheduledRef: React.MutableRefObject<boolean>
  handleCapture: (dataUrl: string) => void
  onClose: () => void
}) {
  const fsControlsRef = useRef<any>(null)
  const scheduleCapture = useCallback(() => { captureScheduledRef.current = true }, [captureScheduledRef])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const selectedLayer = layers.find((l) => l.id === selectedLayerId) ?? null
  const selectedTransform = selectedLayerId ? (transforms[selectedLayerId] || DEFAULT_TRANSFORM) : DEFAULT_TRANSFORM

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-[#1a1a1a] flex flex-col">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#27272A] bg-[#141414] shrink-0">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-emerald-400" />
          <span className="text-sm font-medium text-neutral-300">3D Scene</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg bg-[#27272A] hover:bg-[#3f3f3f] text-neutral-400 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0">
        {/* Left panel */}
        <div className="flex flex-col border-r border-[#27272A] shrink-0" style={{ width: 240 }}>
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 min-h-0">
            <LayerList
              layers={orderedLayers}
              selectedLayerId={selectedLayerId}
              setSelectedLayerId={setSelectedLayerId}
              updateLayerOrder={updateLayerOrder}
            />
          </div>

          {selectedLayer && (
            <div className="border-t border-[#27272A] p-2 flex flex-col gap-2 shrink-0">
              <div className="flex gap-1">
                {([
                  { mode: 'translate' as TransformMode, icon: Move, title: 'Move' },
                  { mode: 'rotate' as TransformMode, icon: RotateCw, title: 'Rotate' },
                  { mode: 'scale' as TransformMode, icon: Maximize2, title: 'Scale' },
                ]).map(({ mode, icon: Icon, title }) => (
                  <button
                    key={mode}
                    title={title}
                    onClick={() => setTransformMode(mode)}
                    className={`flex-1 flex items-center justify-center py-1.5 rounded transition-colors ${
                      transformMode === mode
                        ? 'bg-[#00FFC5]/20 text-[#00FFC5] border border-[#00FFC5]/40'
                        : 'bg-[#111] text-neutral-500 border border-[#27272A] hover:border-neutral-600'
                    }`}
                  >
                    <Icon size={12} />
                  </button>
                ))}
              </div>
              <TransformField
                label="Position"
                values={selectedTransform.position}
                onChange={(v) => updateTransform(selectedLayer.id, { ...selectedTransform, position: v })}
              />
              <TransformField
                label="Rotation"
                values={selectedTransform.rotation}
                onChange={(v) => updateTransform(selectedLayer.id, { ...selectedTransform, rotation: v })}
              />
              <TransformField
                label="Scale"
                values={selectedTransform.scale}
                onChange={(v) => updateTransform(selectedLayer.id, { ...selectedTransform, scale: v })}
              />
            </div>
          )}
        </div>

        {/* 3D viewport — orbit always enabled in fullscreen */}
        <div className="flex-1 relative" style={{ background: '#111' }}>
          <Canvas
            camera={{ position: [0, 2, 5], fov: 50 }}
            gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true }}
            resize={{ scroll: false, offsetSize: true }}
            onPointerMissed={() => setSelectedLayerId(null)}
          >
            <ambientLight intensity={2} />
            <Environment preset="studio" />
            {layers.map((layer) => (
              <SceneObject
                key={layer.id}
                layer={layer}
                transform={transforms[layer.id] || DEFAULT_TRANSFORM}
                selected={layer.id === selectedLayerId}
                mode={transformMode}
                onSelect={() => setSelectedLayerId(layer.id)}
                onTransformChange={(t) => updateTransform(layer.id, t)}
                onLoad={scheduleCapture}
              />
            ))}
            <OrbitControls ref={fsControlsRef} enablePan enableZoom enableRotate makeDefault enabled />
            <OrbitCapture controlsRef={fsControlsRef} onCapture={handleCapture} />
            <CaptureOnLoad scheduled={captureScheduledRef} onCapture={handleCapture} />
          </Canvas>

          {/* Transform mode buttons */}
          <div className="absolute top-3 left-3 flex gap-1 z-10">
            {([
              { mode: 'translate' as TransformMode, icon: Move, title: 'Move' },
              { mode: 'rotate' as TransformMode, icon: RotateCw, title: 'Rotate' },
              { mode: 'scale' as TransformMode, icon: Maximize2, title: 'Scale' },
            ]).map(({ mode, icon: Icon, title }) => (
              <button
                key={mode}
                title={title}
                onClick={() => setTransformMode(mode)}
                className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                  transformMode === mode
                    ? 'bg-[#00FFC5] text-black'
                    : 'bg-black/60 text-neutral-400 hover:text-white hover:bg-black/80'
                }`}
              >
                <Icon size={13} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ─── Main node ────────────────────────────────────────────────────────────────

function Scene3DNode({ id, data, selected }: NodeProps) {
  const layerConnections = useNodeConnections({ handleType: 'target', handleId: 'layers' })
  const imageResultConnections = useNodeConnections({ handleType: 'source', handleId: 'image_result' })
  // useNodes() makes layers reactive to source node data changes (e.g. modelFile loading in)
  const allNodes = useNodes()
  const { setNodes } = useReactFlow()
  const locked = !!(data as Record<string, unknown>).locked
  const { menuOpen, setMenuOpen, handleDuplicate, handleLock, handleDelete } = useNodeActions(id, locked)
  const d = data as Record<string, unknown>

  const layers: SceneLayer[] = useMemo(() => {
    return layerConnections.map((conn) => {
      const sourceNode = allNodes.find((n) => n.id === conn.source)
      const sd = sourceNode?.data as Record<string, unknown> | undefined

      let url = ''
      let type: 'image' | 'model' = 'image'

      if (conn.sourceHandle === 'result') {
        // Trellis outputs a GLB (modelFile); every other node outputs an image (imageUrl)
        if (sd?.modelFile) {
          url = sd.modelFile as string
          type = 'model'
        } else {
          url = (sd?.imageUrl as string | undefined) || ''
          type = 'image'
        }
      } else if (conn.sourceHandle === 'image_result') {
        url = (sd?.captureUrl as string | undefined) || ''
        type = 'image'
      } else {
        // Fallback: any other handle — try imageUrl
        url = (sd?.imageUrl as string | undefined) || ''
        type = 'image'
      }

      // source+handle composite key so two handles from the same node don't collide
      const id = `${conn.source}-${conn.sourceHandle ?? 'default'}`
      return { id, label: sourceNode?.type || conn.source, type, url }
    }).filter((l) => l.url)
  }, [layerConnections, allNodes])

  const transforms = (d.transforms as Record<string, LayerTransform>) || {}
  const getTransform = (lid: string): LayerTransform => transforms[lid] || DEFAULT_TRANSFORM
  const onDataChange = d.onDataChange as ((nodeId: string, patch: Record<string, unknown>) => void) | undefined

  const updateTransform = useCallback((lid: string, t: LayerTransform) => {
    const newTransforms = { ...transforms, [lid]: t }
    onDataChange?.(id, { transforms: newTransforms })
  }, [id, transforms, onDataChange])

  // Layer ordering — persisted in node data so it survives project reload
  const layerOrder = (d.layerOrder as string[] | undefined) || []
  const orderedLayers = useMemo(() => {
    const map = new Map(layers.map((l) => [l.id, l]))
    const known = layerOrder.filter((lid) => map.has(lid)).map((lid) => map.get(lid)!)
    const novel = layers.filter((l) => !layerOrder.includes(l.id))
    return [...known, ...novel]
  }, [layers, layerOrder])

  const updateLayerOrder = useCallback((newOrder: string[]) => {
    onDataChange?.(id, { layerOrder: newOrder })
  }, [id, onDataChange])

  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  const [transformMode, setTransformMode] = useState<TransformMode>('translate')
  const [fullscreen, setFullscreen] = useState(false)
  const controlsRef = useRef<any>(null)
  // Signals CaptureOnLoad (inside Canvas) to grab a fresh frame on the next useFrame tick
  const captureScheduledRef = useRef(false)
  const scheduleCapture = useCallback(() => { captureScheduledRef.current = true }, [])

  const handleCapture = useCallback((dataUrl: string) => {
    setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, captureUrl: dataUrl } } : n))
  }, [id, setNodes])

  const selectedLayer = layers.find((l) => l.id === selectedLayerId) ?? null
  const selectedTransform = selectedLayerId ? getTransform(selectedLayerId) : DEFAULT_TRANSFORM

  return (
    <div
      className={`bg-[#1a1a1a] border border-[#27272A] rounded-xl shadow-xl ${locked ? 'ring-1 ring-neutral-700' : ''}`}
      style={{ width: NODE_WIDTH }}
    >
      <NodeHeader
        title="3D Scene"
        icon={<Layers size={14} className="text-emerald-400" />}
        locked={locked}
        menuOpen={menuOpen}
        onMenuToggle={() => setMenuOpen(!menuOpen)}
        onDuplicate={handleDuplicate}
        onLock={handleLock}
        onDelete={handleDelete}
        onCloseMenu={() => setMenuOpen(false)}
      />

      <div className="flex" style={{ height: SCENE_HEIGHT }}>
        {/* ── Left panel ── */}
        <div className="flex flex-col border-r border-[#27272A] shrink-0" style={{ width: PANEL_WIDTH }}>
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 min-h-0">
            <LayerList
              layers={orderedLayers}
              selectedLayerId={selectedLayerId}
              setSelectedLayerId={setSelectedLayerId}
              updateLayerOrder={updateLayerOrder}
            />
          </div>

          {selectedLayer && (
            <div className="border-t border-[#27272A] p-2 flex flex-col gap-2 nodrag shrink-0">
              <div className="flex gap-1">
                {([
                  { mode: 'translate' as TransformMode, icon: Move, title: 'Move' },
                  { mode: 'rotate' as TransformMode, icon: RotateCw, title: 'Rotate' },
                  { mode: 'scale' as TransformMode, icon: Maximize2, title: 'Scale' },
                ]).map(({ mode, icon: Icon, title }) => (
                  <button
                    key={mode}
                    title={title}
                    onClick={() => setTransformMode(mode)}
                    className={`flex-1 flex items-center justify-center py-1 rounded transition-colors ${
                      transformMode === mode
                        ? 'bg-[#00FFC5]/20 text-[#00FFC5] border border-[#00FFC5]/40'
                        : 'bg-[#111] text-neutral-500 border border-[#27272A] hover:border-neutral-600'
                    }`}
                  >
                    <Icon size={10} />
                  </button>
                ))}
              </div>
              <TransformField
                label="Position"
                values={selectedTransform.position}
                onChange={(v) => updateTransform(selectedLayer.id, { ...selectedTransform, position: v })}
              />
              <TransformField
                label="Rotation"
                values={selectedTransform.rotation}
                onChange={(v) => updateTransform(selectedLayer.id, { ...selectedTransform, rotation: v })}
              />
              <TransformField
                label="Scale"
                values={selectedTransform.scale}
                onChange={(v) => updateTransform(selectedLayer.id, { ...selectedTransform, scale: v })}
              />
            </div>
          )}
        </div>

        {/* ── 3D viewport ── */}
        <div className={`flex-1 relative nodrag ${selected ? 'nowheel' : ''}`} style={{ background: '#111' }}>
          <Canvas
            camera={{ position: [0, 2, 5], fov: 50 }}
            gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true }}
            resize={{ scroll: false, offsetSize: true }}
            onPointerMissed={() => setSelectedLayerId(null)}
          >
            <ambientLight intensity={2} />
            <Environment preset="studio" />

            {/* Render in user-defined order — selection only adds gizmo overlay */}
            {orderedLayers.map((layer) => (
              <SceneObject
                key={layer.id}
                layer={layer}
                transform={getTransform(layer.id)}
                selected={layer.id === selectedLayerId}
                mode={transformMode}
                onSelect={() => setSelectedLayerId(layer.id)}
                onTransformChange={(t) => updateTransform(layer.id, t)}
                onLoad={scheduleCapture}
              />
            ))}

            <OrbitControls ref={controlsRef} enablePan enableZoom enableRotate makeDefault enabled={!!selected} />
            <OrbitCapture controlsRef={controlsRef} onCapture={handleCapture} />
            <CaptureOnLoad scheduled={captureScheduledRef} onCapture={handleCapture} />
          </Canvas>

          {/* Transform mode buttons */}
          <div className="absolute top-2 left-2 flex gap-1 z-10">
            {([
              { mode: 'translate' as TransformMode, icon: Move, title: 'Move' },
              { mode: 'rotate' as TransformMode, icon: RotateCw, title: 'Rotate' },
              { mode: 'scale' as TransformMode, icon: Maximize2, title: 'Scale' },
            ]).map(({ mode, icon: Icon, title }) => (
              <button
                key={mode}
                title={title}
                onClick={(e) => { e.stopPropagation(); setTransformMode(mode) }}
                className={`w-6 h-6 rounded flex items-center justify-center transition-colors nodrag ${
                  transformMode === mode
                    ? 'bg-[#00FFC5] text-black'
                    : 'bg-black/60 text-neutral-400 hover:text-white hover:bg-black/80'
                }`}
              >
                <Icon size={11} />
              </button>
            ))}
          </div>

          {/* Fullscreen button */}
          <button
            title="Focus mode"
            onClick={(e) => { e.stopPropagation(); setFullscreen(true) }}
            className="absolute bottom-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors z-10 nodrag"
          >
            <Maximize2 size={12} />
          </button>
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        id="layers"
        className={`!w-[7px] !h-[7px] !bg-[#00FFC5] !border-0 !-left-[9px] handle-green ${layerConnections.length > 0 ? 'connected' : ''}`}
        title="Layers"
      />
      <div
        className="absolute text-[10px] bg-black/30 backdrop-blur-sm px-1 rounded font-medium"
        style={{ top: 'calc(50% - 7px)', right: 'calc(100% + 18px)', color: '#00FFC5' }}
      >
        Layers
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="image_result"
        className={`!w-[7px] !h-[7px] !bg-[#00FFC5] !border-0 !-right-[9px] handle-green ${imageResultConnections.length > 0 ? 'connected' : ''}`}
        title="Image Result"
      />
      <div
        className="absolute text-[10px] bg-black/30 backdrop-blur-sm px-1 rounded font-medium"
        style={{ top: 'calc(50% - 7px)', left: 'calc(100% + 18px)', color: '#00FFC5' }}
      >
        Image
      </div>

      {fullscreen && (
        <FullscreenScene3D
          layers={layers}
          orderedLayers={orderedLayers}
          transforms={transforms}
          selectedLayerId={selectedLayerId}
          setSelectedLayerId={setSelectedLayerId}
          transformMode={transformMode}
          setTransformMode={setTransformMode}
          updateTransform={updateTransform}
          updateLayerOrder={updateLayerOrder}
          captureScheduledRef={captureScheduledRef}
          handleCapture={handleCapture}
          onClose={() => setFullscreen(false)}
        />
      )}
    </div>
  )
}

export default memo(Scene3DNode)
