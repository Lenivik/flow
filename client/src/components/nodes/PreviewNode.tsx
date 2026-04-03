import { memo, useState, useEffect, useRef, Suspense, useCallback } from 'react'
import { Handle, Position, useNodeConnections, useNodes, type NodeProps } from '@xyflow/react'
import { Eye } from 'lucide-react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import NodeHeader from './NodeHeader'
import { useNodeActions } from '../../hooks/useNodeActions'

const NODE_WIDTH = 320
const PREVIEW_HEIGHT = 240

type FileInfo = { format: string; resolution: string }

function getFormatFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/png': 'PNG',
    'image/jpeg': 'JPEG',
    'image/webp': 'WEBP',
    'image/gif': 'GIF',
    'model/gltf-binary': 'GLB',
  }
  return map[mime] || mime.split('/')[1]?.toUpperCase() || 'FILE'
}

// Using GLTFLoader directly (not useGLTF) to avoid cross-canvas WebGL context issues
function ModelScene({ url }: { url: string }) {
  const { camera } = useThree()
  const [obj, setObj] = useState<THREE.Group | null>(null)

  useEffect(() => {
    const loader = new GLTFLoader()
    loader.load(url, (gltf) => {
      const scene = gltf.scene
      const box = new THREE.Box3().setFromObject(scene)
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
      scene.position.sub(center)
      const maxDim = Math.max(size.x, size.y, size.z)
      const fov = (camera as THREE.PerspectiveCamera).fov * (Math.PI / 180)
      const dist = (maxDim / (2 * Math.tan(fov / 2))) * 1.2
      const pos = new THREE.Vector3(dist * 0.7, dist * 0.4, dist * 0.7)
      camera.position.copy(pos)
      camera.lookAt(0, 0, 0)
      camera.updateProjectionMatrix()
      setObj(scene)
    })
    return () => { setObj(null) }
  }, [url, camera])

  if (!obj) return null
  return <primitive object={obj} />
}

const checkerStyle: React.CSSProperties = {
  backgroundImage: `
    linear-gradient(45deg, #1a1a1a 25%, transparent 25%),
    linear-gradient(-45deg, #1a1a1a 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #1a1a1a 75%),
    linear-gradient(-45deg, transparent 75%, #1a1a1a 75%)
  `,
  backgroundSize: '20px 20px',
  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0',
  backgroundColor: '#252525',
}

function PreviewNode({ id, data, selected }: NodeProps) {
  const inputConnections = useNodeConnections({ handleType: 'target', handleId: 'input' })
  const allNodes = useNodes()
  const locked = !!data.locked
  const { menuOpen, setMenuOpen, handleDuplicate, handleLock, handleDelete } = useNodeActions(id, locked)
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)

  const asset = (() => {
    if (inputConnections.length === 0) return null
    const conn = inputConnections[0]
    const sd = allNodes.find((n) => n.id === conn.source)?.data as Record<string, unknown> | undefined
    if (!sd) return null
    if (conn.sourceHandle === 'image_result') return { url: sd.captureUrl as string | undefined, isModel: false }
    if (conn.sourceHandle === 'result') {
      if (sd.modelFile) return { url: sd.modelFile as string, isModel: true }
      return { url: sd.imageUrl as string | undefined, isModel: false }
    }
    return { url: sd.imageUrl as string | undefined, isModel: false }
  })()

  const url = asset?.url
  const isModel = asset?.isModel ?? false

  // Reset imageLoaded when url changes
  useEffect(() => { setImageLoaded(false) }, [url])

  // Detect file format from URL
  useEffect(() => {
    if (!url) { setFileInfo(null); return }
    if (isModel) { setFileInfo({ format: 'GLB', resolution: '3D Model' }); return }

    if (url.startsWith('data:')) {
      const match = url.match(/^data:([^;]+);/)
      const format = match ? getFormatFromMime(match[1]) : 'FILE'
      setFileInfo((prev) => ({ format, resolution: prev?.resolution || '' }))
      return
    }

    if (url.startsWith('blob:')) {
      fetch(url)
        .then((r) => r.blob())
        .then((blob) => setFileInfo((prev) => ({ format: getFormatFromMime(blob.type), resolution: prev?.resolution || '' })))
        .catch(() => setFileInfo({ format: 'FILE', resolution: '' }))
    }
  }, [url, isModel])

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    setImageLoaded(true)
    setFileInfo((prev) => prev ? { ...prev, resolution: `${img.naturalWidth}×${img.naturalHeight}` } : null)
  }, [])

  return (
    <div
      className={`bg-[#1a1a1a] border border-[#27272A] rounded-xl shadow-xl ${locked ? 'ring-1 ring-neutral-700' : ''}`}
      style={{ width: NODE_WIDTH }}
    >
      <NodeHeader
        title="Preview"
        icon={<Eye size={14} className="text-sky-400" />}
        locked={locked}
        menuOpen={menuOpen}
        onMenuToggle={() => setMenuOpen(!menuOpen)}
        onDuplicate={handleDuplicate}
        onLock={handleLock}
        onDelete={handleDelete}
        onCloseMenu={() => setMenuOpen(false)}
      />

      <div className="flex flex-col p-4 gap-3.5">
        <div
          className="w-full rounded-lg overflow-hidden border border-[#27272A]/80 shadow-inner relative"
          style={{
            height: PREVIEW_HEIGHT,
            ...(url && !isModel ? checkerStyle : { background: '#111' }),
          }}
        >
          {url && isModel ? (
            <div className={`w-full h-full nodrag ${selected ? 'nowheel' : ''}`}>
              <Canvas camera={{ fov: 45 }} gl={{ preserveDrawingBuffer: true }} resize={{ scroll: false }}>
                <ambientLight intensity={2} />
                <directionalLight position={[5, 5, 5]} intensity={1.5} />
                <Suspense fallback={null}>
                  <ModelScene url={url} />
                  <Environment preset="studio" />
                </Suspense>
                <OrbitControls enabled={!!selected} makeDefault />
              </Canvas>
            </div>
          ) : url ? (
            <img
              src={url}
              alt="Preview"
              onLoad={handleImageLoad}
              className="w-full h-full object-contain"
              style={{ opacity: imageLoaded ? 1 : 0, transition: 'opacity 0.3s ease-in' }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Eye size={32} className="text-neutral-600" />
            </div>
          )}

          {/* File info flag */}
          {fileInfo && url && (
            <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-md px-2 py-1 pointer-events-none">
              <span className="text-[10px] font-mono font-bold text-white">{fileInfo.format}</span>
              {fileInfo.resolution && (
                <>
                  <span className="text-[10px] text-neutral-500">·</span>
                  <span className="text-[10px] font-mono text-neutral-300">{fileInfo.resolution}</span>
                </>
              )}
            </div>
          )}
        </div>

        <span className="text-[10px] text-gray-500 font-mono bg-[#18181B] px-1.5 py-0.5 rounded border border-[#27272A] w-fit">Utility</span>
      </div>

      {inputConnections.length === 0 && (
        <div className="px-4 pb-4">
          <p className="text-[10px] text-neutral-500">Connect an image or 3D model to preview</p>
        </div>
      )}

      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className={`!w-[7px] !h-[7px] !bg-[#00FFC5] !border-0 !-left-[9px] handle-green ${inputConnections.length > 0 ? 'connected' : ''}`}
        title="Input"
      />
      <div className="absolute text-[10px] bg-black/30 backdrop-blur-sm px-1 rounded font-medium" style={{ top: 'calc(50% - 24px)', right: 'calc(100% + 18px)', color: '#00FFC5' }}>Input</div>
    </div>
  )
}

export default memo(PreviewNode)
