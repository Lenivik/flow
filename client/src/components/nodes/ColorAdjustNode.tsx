import { memo, useState, useRef, useCallback, useEffect } from 'react'
import { Handle, Position, useNodeConnections, useNodes, useReactFlow, type NodeProps } from '@xyflow/react'
import { Sliders } from 'lucide-react'
import NodeHeader from './NodeHeader'
import { useNodeActions } from '../../hooks/useNodeActions'

const NODE_WIDTH = 320
const PREVIEW_WIDTH = NODE_WIDTH - 32

function ColorAdjustNode({ id, data }: NodeProps) {
  const inputConnections = useNodeConnections({ handleType: 'target', handleId: 'input' })
  const resultConnections = useNodeConnections({ handleType: 'source', handleId: 'result' })
  const allNodes = useNodes()
  const { setNodes } = useReactFlow()
  const d = data as Record<string, unknown>
  const locked = !!d.locked
  const { menuOpen, setMenuOpen, handleDuplicate, handleLock, handleDelete } = useNodeActions(id, locked)

  // Settings: -100..+100 for bright/contrast/sat, -180..+180 for hue. Default 0 = no change.
  // Values come in as strings from updateSelectedNodeData, so always parse as Number.
  const brightness = Number(d.brightness ?? 0)
  const contrast = Number(d.contrast ?? 0)
  const saturation = Number(d.saturation ?? 0)
  const hue = Number(d.hue ?? 0)

  // Resolve source image from the connected input handle
  const sourceConn = inputConnections[0]
  const sourceNode = sourceConn ? allNodes.find((n) => n.id === sourceConn.source) : null
  const sourceData = sourceNode?.data as Record<string, unknown> | undefined
  const sourceImageUrl =
    (sourceData?.imageUrl as string | undefined) ||
    (sourceData?.captureUrl as string | undefined)

  // CSS filter for the live preview — applied directly to the <img> for instant feedback
  const cssFilter = `brightness(${(brightness + 100) / 100}) contrast(${(contrast + 100) / 100}) saturate(${(saturation + 100) / 100}) hue-rotate(${hue}deg)`

  // Preview height tracks the source image aspect ratio
  const [previewHeight, setPreviewHeight] = useState<number | null>(null)
  const [imgLoaded, setImgLoaded] = useState(false)
  const prevSourceUrl = useRef<string | undefined>()

  useEffect(() => {
    if (sourceImageUrl !== prevSourceUrl.current) {
      setImgLoaded(false)
      setPreviewHeight(null)
      prevSourceUrl.current = sourceImageUrl
    }
  }, [sourceImageUrl])

  const handlePreviewLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    setPreviewHeight(Math.round(PREVIEW_WIDTH * (img.naturalHeight / img.naturalWidth)))
    setImgLoaded(true)
  }, [])

  // Canvas output generation — debounced so rapid slider drags don't flood canvas ops
  // Caches the loaded HTMLImageElement to avoid reloading on every settings tweak.
  const cachedImgRef = useRef<{ url: string; img: HTMLImageElement } | null>(null)

  useEffect(() => {
    if (!sourceImageUrl) {
      cachedImgRef.current = null
      return
    }

    const applyToCanvas = (img: HTMLImageElement) => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.filter = `brightness(${(brightness + 100) / 100}) contrast(${(contrast + 100) / 100}) saturate(${(saturation + 100) / 100}) hue-rotate(${hue}deg)`
      ctx.drawImage(img, 0, 0)
      const url = canvas.toDataURL('image/png')
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, imageUrl: url, captureUrl: url } } : n,
        ),
      )
    }

    // Reuse cached image if source URL hasn't changed (only settings changed)
    if (cachedImgRef.current?.url === sourceImageUrl) {
      const cached = cachedImgRef.current.img
      const timer = setTimeout(() => applyToCanvas(cached), 80)
      return () => clearTimeout(timer)
    }

    // Load the new source image, cache it, then apply
    const img = new Image()
    let cancelled = false
    img.onload = () => {
      if (cancelled) return
      cachedImgRef.current = { url: sourceImageUrl, img }
      applyToCanvas(img)
    }
    img.src = sourceImageUrl
    return () => {
      cancelled = true
      img.onload = null
    }
  }, [sourceImageUrl, brightness, contrast, saturation, hue, id, setNodes])

  const containerHeight = previewHeight ?? 200

  return (
    <div
      style={{ width: NODE_WIDTH }}
      className="bg-[#1a1a1a] border border-[#27272A] rounded-xl shadow-xl"
    >
      <NodeHeader
        title="Color Adjust"
        icon={<Sliders size={14} className="text-violet-400" />}
        locked={locked}
        menuOpen={menuOpen}
        onMenuToggle={() => setMenuOpen(!menuOpen)}
        onDuplicate={handleDuplicate}
        onLock={handleLock}
        onDelete={handleDelete}
        onCloseMenu={() => setMenuOpen(false)}
      />

      <div className="p-4">
        {!sourceImageUrl ? (
          <div
            className="w-full rounded-lg flex items-center justify-center"
            style={{
              height: 160,
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
            <Sliders size={28} className="text-neutral-600" />
          </div>
        ) : (
          <div
            className="w-full rounded-lg overflow-hidden bg-[#0a0a0a]"
            style={{ height: containerHeight }}
          >
            <img
              src={sourceImageUrl}
              alt=""
              className="w-full h-full object-contain"
              style={{
                filter: cssFilter,
                opacity: imgLoaded ? 1 : 0,
                transition: 'opacity 0.2s',
              }}
              onLoad={handlePreviewLoad}
              draggable={false}
            />
          </div>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className={`!w-[7px] !h-[7px] !bg-[#00FFC5] !border-0 !-left-[9px] handle-green ${inputConnections.length > 0 ? 'connected' : ''}`}
        title="Input"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="result"
        className={`!w-[7px] !h-[7px] !bg-[#00FFC5] !border-0 !-right-[9px] handle-green ${resultConnections.length > 0 ? 'connected' : ''}`}
        title="Result"
      />
    </div>
  )
}

export default memo(ColorAdjustNode)
