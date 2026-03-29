import { memo, useState, useRef, useCallback, useEffect, useLayoutEffect, Suspense, useMemo } from 'react'
import { Handle, Position, useNodeConnections, useReactFlow, useNodes, type NodeProps } from '@xyflow/react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, TransformControls, Environment } from '@react-three/drei'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { Layers, Move, RotateCw, Maximize2, Camera } from 'lucide-react'
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

function ImageSticker({ url, selected, onClick }: { url: string; selected: boolean; onClick: () => void }) {
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
      },
      undefined,
      (err) => console.warn('Scene3D: texture load failed', url, err),
    )
    return () => { setTex(null) }
  }, [url])

  if (!tex) return null

  return (
    <group onClick={(e) => { e.stopPropagation(); onClick() }}>
      <mesh>
        <planeGeometry args={[aspect * 2, 2]} />
        {/* transparent + alphaTest preserves PNG alpha channel (e.g. BG removal output) */}
        <meshBasicMaterial map={tex} side={THREE.DoubleSide} transparent alphaTest={0.05} />
      </mesh>
      {selected && (
        <mesh>
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

function GlbObject({ url, selected, onClick }: { url: string; selected: boolean; onClick: () => void }) {
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
      },
      undefined,
      (err) => console.warn('Scene3D: GLB load failed', url, err),
    )
    return () => { active = false }
  }, [url])

  if (!sceneObj) return null

  return (
    <group onClick={(e) => { e.stopPropagation(); onClick() }}>
      <primitive object={sceneObj} />
      {selected && (
        <mesh>
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

function SceneObject({ layer, transform, selected, mode, onSelect, onTransformChange }: {
  layer: SceneLayer
  transform: LayerTransform
  selected: boolean
  mode: TransformMode
  onSelect: () => void
  onTransformChange: (t: LayerTransform) => void
}) {
  const groupRef = useRef<THREE.Group>(null)
  const isDragging = useRef(false)

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

  return (
    <>
      <group ref={groupRef}>
        {layer.type === 'image'
          ? <ImageSticker url={layer.url} selected={selected} onClick={onSelect} />
          : <GlbObject url={layer.url} selected={selected} onClick={onSelect} />
        }
      </group>
      {selected && groupRef.current && (
        <TransformControls
          object={groupRef as React.RefObject<THREE.Object3D>}
          mode={mode}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
        />
      )}
    </>
  )
}

// ─── OrbitCapture — stores a PNG snapshot of the viewport after orbit ─────────

function OrbitCapture({ controlsRef, onCapture }: {
  controlsRef: React.RefObject<any>
  onCapture: (dataUrl: string) => void
}) {
  const { gl, scene, camera } = useThree()

  const snap = useCallback(() => {
    gl.render(scene, camera)
    onCapture(gl.domElement.toDataURL('image/png'))
  }, [gl, scene, camera, onCapture])

  useEffect(() => {
    const ctrl = controlsRef.current
    if (!ctrl) return
    ctrl.addEventListener('end', snap)
    return () => ctrl.removeEventListener('end', snap)
  }, [controlsRef, snap])

  // Initial capture after first two frames (model/texture may still be loading,
  // but this at least captures an empty scene for downstream nodes)
  const done = useRef(false)
  useEffect(() => {
    if (done.current) return
    const id = requestAnimationFrame(() => requestAnimationFrame(() => { snap(); done.current = true }))
    return () => cancelAnimationFrame(id)
  }, [snap])

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

  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  const [transformMode, setTransformMode] = useState<TransformMode>('translate')
  const controlsRef = useRef<any>(null)

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
            {layers.length === 0 ? (
              <p className="text-[10px] text-neutral-600 text-center mt-6 px-2 leading-relaxed">
                Connect images or 3D models to the Layers input
              </p>
            ) : (
              layers.map((layer) => (
                <button
                  key={layer.id}
                  onClick={() => setSelectedLayerId(layer.id === selectedLayerId ? null : layer.id)}
                  className={`w-full text-left px-2 py-1.5 rounded text-[10px] font-medium transition-colors nodrag truncate ${
                    layer.id === selectedLayerId
                      ? 'bg-[#00FFC5]/15 text-[#00FFC5] border border-[#00FFC5]/30'
                      : 'bg-[#111] text-neutral-400 border border-[#27272A] hover:border-neutral-600'
                  }`}
                >
                  <span className="mr-1 text-[8px] opacity-50">{layer.type === 'model' ? '3D' : 'IMG'}</span>
                  {layer.label}
                </button>
              ))
            )}
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

            {/* All layers always visible — selection only adds gizmo overlay */}
            {layers.map((layer) => (
              <SceneObject
                key={layer.id}
                layer={layer}
                transform={getTransform(layer.id)}
                selected={layer.id === selectedLayerId}
                mode={transformMode}
                onSelect={() => setSelectedLayerId(layer.id)}
                onTransformChange={(t) => updateTransform(layer.id, t)}
              />
            ))}

            <OrbitControls ref={controlsRef} enablePan enableZoom enableRotate makeDefault enabled={!!selected} />
            <OrbitCapture controlsRef={controlsRef} onCapture={handleCapture} />
          </Canvas>

          {/* T/R/S mode buttons — always visible on canvas */}
          <div className="absolute top-2 left-2 flex gap-1 z-10">
            {([
              { mode: 'translate' as TransformMode, label: 'T', title: 'Move' },
              { mode: 'rotate' as TransformMode, label: 'R', title: 'Rotate' },
              { mode: 'scale' as TransformMode, label: 'S', title: 'Scale' },
            ]).map(({ mode, label, title }) => (
              <button
                key={mode}
                title={title}
                onClick={(e) => { e.stopPropagation(); setTransformMode(mode) }}
                className={`w-6 h-6 rounded text-[10px] font-bold transition-colors nodrag ${
                  transformMode === mode
                    ? 'bg-[#00FFC5] text-black'
                    : 'bg-black/60 text-neutral-400 hover:text-white hover:bg-black/80'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Capture button */}
          <button
            title="Capture scene"
            onClick={(e) => {
              e.stopPropagation()
              const canvas = e.currentTarget.parentElement?.querySelector('canvas')
              if (canvas) handleCapture(canvas.toDataURL('image/png'))
            }}
            className="absolute bottom-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors z-10 nodrag"
          >
            <Camera size={12} />
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
    </div>
  )
}

export default memo(Scene3DNode)
