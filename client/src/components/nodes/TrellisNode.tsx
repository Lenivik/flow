import { memo, useState, Suspense, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Handle, Position, useNodeConnections, useReactFlow, type NodeProps } from '@xyflow/react'
import { Loader2, Download, Box, ZoomIn, ZoomOut, Focus, Maximize2, X } from 'lucide-react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF, Environment } from '@react-three/drei'
import * as THREE from 'three'
import NodeHeader from './NodeHeader'
import { GridView, NavigationOverlay, type HistoryEntry } from './ImageHistory'
import { useNodeActions } from '../../hooks/useNodeActions'

const NODE_WIDTH = 352
const VIEWER_HEIGHT = 280

type CameraState = { position: THREE.Vector3; target: THREE.Vector3 }

function Model({ url, onFitted }: { url: string; onFitted?: (state: CameraState) => void }) {
  const { scene } = useGLTF(url)
  const { camera } = useThree()
  const prevUrl = useRef('')

  useEffect(() => {
    if (!scene || url === prevUrl.current) return
    prevUrl.current = url

    const box = new THREE.Box3().setFromObject(scene)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())

    scene.position.sub(center)

    const maxDim = Math.max(size.x, size.y, size.z)
    const fov = (camera as THREE.PerspectiveCamera).fov * (Math.PI / 180)
    const dist = maxDim / (2 * Math.tan(fov / 2)) * 1.2
    const pos = new THREE.Vector3(dist * 0.7, dist * 0.4, dist * 0.7)
    camera.position.copy(pos)
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()

    onFitted?.({ position: pos.clone(), target: new THREE.Vector3(0, 0, 0) })
  }, [scene, camera, url, onFitted])

  return <primitive object={scene} />
}

function CameraControls({ controlsRef, defaultState }: { controlsRef: React.RefObject<any>; defaultState: React.RefObject<CameraState | null> }) {
  const { camera } = useThree()

  const zoom = useCallback((factor: number) => {
    const controls = controlsRef.current
    if (!controls) return
    const dir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize()
    const dist = camera.position.distanceTo(controls.target)
    camera.position.copy(controls.target).addScaledVector(dir, dist * factor)
    controls.update()
  }, [camera, controlsRef])

  const reset = useCallback(() => {
    const controls = controlsRef.current
    const state = defaultState.current
    if (!controls || !state) return
    camera.position.copy(state.position)
    controls.target.copy(state.target)
    controls.update()
  }, [camera, controlsRef, defaultState])

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current._zoomIn = () => zoom(0.75)
      controlsRef.current._zoomOut = () => zoom(1.33)
      controlsRef.current._reset = reset
    }
  }, [zoom, reset, controlsRef])

  return null
}

function ViewerControls({ controlsRef, onFullscreen }: { controlsRef: React.RefObject<any>; onFullscreen?: () => void }) {
  return (
    <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 nodrag">
      <button onClick={() => controlsRef.current?._zoomIn?.()} className="p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors">
        <ZoomIn size={14} />
      </button>
      <button onClick={() => controlsRef.current?._zoomOut?.()} className="p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors">
        <ZoomOut size={14} />
      </button>
      <button onClick={() => controlsRef.current?._reset?.()} className="p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors">
        <Focus size={14} />
      </button>
      {onFullscreen && (
        <button onClick={onFullscreen} className="p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors">
          <Maximize2 size={14} />
        </button>
      )}
    </div>
  )
}

function ThreeScene({ url, controlsRef, defaultCameraState, offsetSize }: { url: string; controlsRef: React.RefObject<any>; defaultCameraState: React.MutableRefObject<CameraState | null>; offsetSize?: boolean }) {
  const handleFitted = useCallback((state: CameraState) => {
    defaultCameraState.current = state
  }, [defaultCameraState])

  return (
    <Canvas camera={{ position: [0, 0, 3], fov: 45 }} resize={{ scroll: false, ...(offsetSize ? { offsetSize: true } : {}) }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <Suspense fallback={null}>
        <Model url={url} onFitted={handleFitted} />
        <Environment preset="studio" />
      </Suspense>
      <OrbitControls ref={controlsRef} enablePan enableZoom enableRotate makeDefault />
      <CameraControls controlsRef={controlsRef} defaultState={defaultCameraState} />
    </Canvas>
  )
}

function FullscreenViewer({ url, onClose }: { url: string; onClose: () => void }) {
  const controlsRef = useRef<any>(null)
  const defaultCameraState = useRef<CameraState | null>(null)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative bg-neutral-900 rounded-2xl overflow-hidden shadow-2xl"
        style={{ width: '80vw', height: '80vh', maxWidth: 1200, maxHeight: 900 }}
        onClick={(e) => e.stopPropagation()}
      >
        <ThreeScene url={url} controlsRef={controlsRef} defaultCameraState={defaultCameraState} />
        <button onClick={onClose} className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors z-10">
          <X size={18} />
        </button>
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5 z-10">
          <button onClick={() => controlsRef.current?._zoomIn?.()} className="p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors">
            <ZoomIn size={16} />
          </button>
          <button onClick={() => controlsRef.current?._zoomOut?.()} className="p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors">
            <ZoomOut size={16} />
          </button>
          <button onClick={() => controlsRef.current?._reset?.()} className="p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors">
            <Focus size={16} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function TrellisNode({ id, data }: NodeProps) {
  const inputConnections = useNodeConnections({ handleType: 'target', handleId: 'input' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gridView, setGridView] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const { setNodes } = useReactFlow()
  const controlsRef = useRef<any>(null)
  const defaultCameraState = useRef<CameraState | null>(null)
  const locked = !!data.locked
  const d = data as Record<string, unknown>
  const { menuOpen, setMenuOpen, handleDuplicate, handleLock, handleDelete } = useNodeActions(id, locked)

  const modelFile = d.modelFile as string | undefined
  const history = (d.imageHistory as HistoryEntry[]) || []
  const imageIndex = (d.imageIndex as number) ?? history.length - 1

  const navigateModel = (newIndex: number) => {
    if (newIndex < 0 || newIndex >= history.length) return
    const entry = history[newIndex]
    setNodes((nds) =>
      nds.map((n) => n.id === id ? { ...n, data: { ...n.data, modelFile: entry.url, activeImageId: entry.id, imageIndex: newIndex } } : n),
    )
  }

  const handleRunModel = () => {
    if (d.onRunTrellis) {
      setLoading(true)
      setError(null)
      ;(d.onRunTrellis as (nodeId: string) => Promise<string | null>)(id)
        .then((err) => { if (err) setError(err) })
        .finally(() => setLoading(false))
    }
  }

  const handleDownload = (url: string, filename: string) => {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return (
    <div className={`bg-neutral-900 rounded-xl shadow-2xl ${locked ? 'ring-1 ring-neutral-700' : ''}`} style={{ width: NODE_WIDTH }}>
      <NodeHeader
        title="Trellis"
        icon={<Box size={14} className="text-purple-400" />}
        locked={locked}
        menuOpen={menuOpen}
        onMenuToggle={() => setMenuOpen(!menuOpen)}
        onDuplicate={handleDuplicate}
        onLock={handleLock}
        onDelete={handleDelete}
        onCloseMenu={() => setMenuOpen(false)}
      />

      <div className="p-4">
        {gridView && history.length > 0 ? (
          <GridView
            history={history}
            imageIndex={imageIndex}
            onSelect={(i) => { navigateModel(i); setGridView(false) }}
            onClose={() => setGridView(false)}
            renderThumb={(entry, i) => (
              <>
                <Box size={20} className={i === imageIndex ? 'text-purple-400' : 'text-neutral-500'} />
                <span className="absolute bottom-0.5 right-1 text-[9px] text-neutral-500 tabular-nums">{i + 1}</span>
              </>
            )}
          />
        ) : modelFile ? (
          <div className="relative group">
            <div className="w-full rounded-lg overflow-hidden nodrag nowheel" style={{ height: VIEWER_HEIGHT, background: '#1a1a1a' }}>
              <ThreeScene url={modelFile} controlsRef={controlsRef} defaultCameraState={defaultCameraState} offsetSize />
            </div>
            <ViewerControls controlsRef={controlsRef} onFullscreen={() => setFullscreen(true)} />
            <NavigationOverlay
              imageIndex={imageIndex}
              total={history.length}
              onPrev={() => navigateModel(imageIndex - 1)}
              onNext={() => navigateModel(imageIndex + 1)}
              onGridView={() => setGridView(true)}
            />
          </div>
        ) : (
          <div
            className="w-full rounded-lg flex items-center justify-center"
            style={{
              height: 180,
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
            <Box size={32} className="text-neutral-600" />
          </div>
        )}
      </div>

      {modelFile && (
        <div className="px-4 pb-3 nodrag">
          <button
            onClick={() => handleDownload(modelFile, `trellis-${Date.now()}.glb`)}
            className="w-full flex items-center justify-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg py-1.5 text-xs font-medium transition-colors"
          >
            <Download size={12} /> Download GLB
          </button>
        </div>
      )}

      {error && (
        <div className="px-4 pb-2">
          <p className="text-[11px] text-red-400">{error}</p>
        </div>
      )}

      <div className="px-4 pb-4">
        <button
          onClick={handleRunModel}
          disabled={loading || locked}
          className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 text-white rounded-lg py-2 text-sm font-medium transition-colors"
        >
          {loading ? (<><Loader2 size={14} className="animate-spin" /> Generating 3D...</>) : 'Generate 3D'}
        </button>
        {inputConnections.length === 0 && !modelFile && (
          <p className="text-[10px] text-neutral-500 mt-2 text-center">Connect an image output to generate 3D</p>
        )}
      </div>

      <Handle type="target" position={Position.Left} id="input"
        className={`!w-2.5 !h-2.5 !bg-emerald-400 !border-0 !-left-[7px] handle-green ${inputConnections.length > 0 ? 'connected' : ''}`}
        title="Input" />
      <div className="absolute left-3 text-[10px] text-emerald-300 font-medium" style={{ top: 'calc(50% - 6px)' }}>Input</div>

      {fullscreen && modelFile && (
        <FullscreenViewer url={modelFile} onClose={() => setFullscreen(false)} />
      )}
    </div>
  )
}

export default memo(TrellisNode)
