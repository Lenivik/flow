import { memo, useState, Suspense, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Handle, Position, useNodeConnections, useReactFlow, type NodeProps } from '@xyflow/react'
import { Loader2, Box, ZoomIn, ZoomOut, Focus, Maximize2, X, Play } from 'lucide-react'
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

function CameraControls({ controlsRef, defaultState, onCapture }: { controlsRef: React.RefObject<any>; defaultState: React.RefObject<CameraState | null>; onCapture?: (dataUrl: string) => void }) {
  const { camera, gl, scene } = useThree()

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

  const capture = useCallback(() => {
    gl.render(scene, camera)
    return gl.domElement.toDataURL('image/png')
  }, [gl, scene, camera])

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current._zoomIn = () => zoom(0.75)
      controlsRef.current._zoomOut = () => zoom(1.33)
      controlsRef.current._reset = reset
      controlsRef.current._capture = capture
      // Called by ThreeScene.handleFitted after model is loaded + camera positioned
      controlsRef.current._captureOnReady = () => {
        const id = requestAnimationFrame(() => requestAnimationFrame(() => {
          if (onCapture) onCapture(capture())
        }))
        return id
      }
    }
  }, [zoom, reset, capture, controlsRef, onCapture])

  // Auto-capture when orbit ends
  useEffect(() => {
    const controls = controlsRef.current
    if (!controls || !onCapture) return
    const handleEnd = () => onCapture(capture())
    controls.addEventListener('end', handleEnd)
    return () => controls.removeEventListener('end', handleEnd)
  }, [controlsRef, onCapture, capture])

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

function ThreeScene({ url, controlsRef, defaultCameraState, offsetSize, onCapture, interactive }: { url: string; controlsRef: React.RefObject<any>; defaultCameraState: React.MutableRefObject<CameraState | null>; offsetSize?: boolean; onCapture?: (dataUrl: string) => void; interactive?: boolean }) {
  const handleFitted = useCallback((state: CameraState) => {
    defaultCameraState.current = state
    // Capture after the model is loaded and camera is positioned (not a blank frame)
    controlsRef.current?._captureOnReady?.()
  }, [defaultCameraState, controlsRef])

  return (
    <Canvas camera={{ position: [0, 0, 3], fov: 45 }} gl={{ preserveDrawingBuffer: true }} resize={{ scroll: false, ...(offsetSize ? { offsetSize: true } : {}) }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <Suspense fallback={null}>
        <Model url={url} onFitted={handleFitted} />
        <Environment preset="studio" />
      </Suspense>
      <OrbitControls ref={controlsRef} enablePan enableZoom enableRotate makeDefault enabled={!!interactive} />
      <CameraControls controlsRef={controlsRef} defaultState={defaultCameraState} onCapture={onCapture} />
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

function TrellisNode({ id, data, selected }: NodeProps) {
  const inputConnections = useNodeConnections({ handleType: 'target', handleId: 'input' })
  const resultConnections = useNodeConnections({ handleType: 'source', handleId: 'result' })
  const imageResultConnections = useNodeConnections({ handleType: 'source', handleId: 'image_result' })
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

  // captureUrl is a data URL stored only in React state — never persisted to server
  // Downstream nodes (Flux2Edit, BgRemoval) receive it inline via the API request
  const handleViewCapture = useCallback((dataUrl: string) => {
    setNodes((nds) =>
      nds.map((n) => n.id === id ? { ...n, data: { ...n.data, captureUrl: dataUrl } } : n),
    )
  }, [id, setNodes])

  return (
    <div className={`bg-[#1a1a1a] border border-[#27272A] rounded-xl shadow-xl ${locked ? 'ring-1 ring-neutral-700' : ''}`} style={{ width: NODE_WIDTH }}>
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

      <div className="flex flex-col p-4 gap-3.5">
        {gridView && history.length > 0 ? (
          <GridView
            history={history}
            imageIndex={imageIndex}
            onSelect={(i) => { navigateModel(i); setGridView(false) }}
            onClose={() => setGridView(false)}
            renderThumb={(_entry, i) => (
              <>
                <Box size={20} className={i === imageIndex ? 'text-purple-400' : 'text-neutral-500'} />
                <span className="absolute bottom-0.5 right-1 text-[9px] text-neutral-500 tabular-nums">{i + 1}</span>
              </>
            )}
          />
        ) : modelFile ? (
          <div className="relative group">
            <div className={`w-full rounded-lg overflow-hidden border border-[#27272A]/80 shadow-inner nodrag ${selected ? 'nowheel' : ''}`} style={{ height: VIEWER_HEIGHT, background: '#1a1a1a' }}>
              <ThreeScene url={modelFile} controlsRef={controlsRef} defaultCameraState={defaultCameraState} offsetSize onCapture={handleViewCapture} interactive={selected} />
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

        <span className="text-[10px] text-gray-500 font-mono bg-[#18181B] px-1.5 py-0.5 rounded border border-[#27272A] w-fit">Image to 3D</span>
      </div>

      {error && (
        <div className="px-4 pb-2">
          <p className="text-[11px] text-red-400">{error}</p>
        </div>
      )}

      <div className="px-4 pb-4 flex justify-between items-center">
        {inputConnections.length === 0 && !modelFile ? (
          <p className="text-[10px] text-neutral-500">Connect an image to generate 3D</p>
        ) : <div />}
        <button
          onClick={handleRunModel}
          disabled={loading || locked}
          className="px-3 py-1 bg-[#cccccc] hover:bg-[#e0e0e0] disabled:bg-[#cccccc]/50 disabled:text-[#1C1C1E]/50 text-[#1C1C1E] text-[10px] font-bold rounded-sm flex items-center gap-1.5 transition-colors uppercase"
        >
          {loading ? (<><Loader2 size={10} className="animate-spin" /> Running</>) : (<><Play size={10} className="fill-current" /> Run</>)}
        </button>
      </div>

      <Handle type="target" position={Position.Left} id="input"
        className={`!w-[7px] !h-[7px] !bg-[#00FFC5] !border-0 !-left-[9px] handle-green ${inputConnections.length > 0 ? 'connected' : ''}`}
        title="Input" />
      <div className="absolute text-[10px] bg-black/30 backdrop-blur-sm px-1 rounded font-medium" style={{ top: 'calc(50% - 24px)', right: 'calc(100% + 18px)', color: '#00FFC5' }}>Input</div>

      <Handle type="source" position={Position.Right} id="image_result"
        style={{ top: '38%' }}
        className={`!w-[7px] !h-[7px] !bg-[#00FFC5] !border-0 !-right-[9px] handle-green ${imageResultConnections.length > 0 ? 'connected' : ''}`}
        title="Image Result" />
      <div className="absolute text-[10px] bg-black/30 backdrop-blur-sm px-1 rounded font-medium" style={{ top: 'calc(38% - 8px)', left: 'calc(100% + 18px)', color: '#00FFC5' }}>Image</div>

      <Handle type="source" position={Position.Right} id="result"
        style={{ top: '60%' }}
        className={`!w-[7px] !h-[7px] !bg-[#00FFC5] !border-0 !-right-[9px] handle-green ${resultConnections.length > 0 ? 'connected' : ''}`}
        title="3D Result" />
      <div className="absolute text-[10px] bg-black/30 backdrop-blur-sm px-1 rounded font-medium" style={{ top: 'calc(60% - 8px)', left: 'calc(100% + 18px)', color: '#00FFC5' }}>3D</div>

      {fullscreen && modelFile && (
        <FullscreenViewer url={modelFile} onClose={() => setFullscreen(false)} />
      )}
    </div>
  )
}

export default memo(TrellisNode)
