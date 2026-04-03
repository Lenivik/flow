import { memo, useState, useRef, useCallback, useEffect } from 'react'
import { Handle, Position, useNodeConnections, useNodes, useReactFlow, type NodeProps } from '@xyflow/react'
import { Crop } from 'lucide-react'
import NodeHeader from './NodeHeader'
import { useNodeActions } from '../../hooks/useNodeActions'

const NODE_WIDTH = 340
const PREVIEW_WIDTH = NODE_WIDTH - 32
const MAX_PREVIEW_HEIGHT = 260
const MIN_CROP_FRAC = 0.02

// Corner handle dimensions
const CORNER_W = 14
const CORNER_H = 14
// Edge handle dimensions (N/S = wide horizontal bar, E/W = tall vertical bar)
const EDGE_NS_W = 36
const EDGE_NS_H = 10
const EDGE_EW_W = 10
const EDGE_EW_H = 36

type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

interface CropValues {
  x: number // 0–1 normalized left edge
  y: number // 0–1 normalized top edge
  w: number // 0–1 normalized width
  h: number // 0–1 normalized height
}

const DEFAULT_CROP: CropValues = { x: 0, y: 0, w: 1, h: 1 }

function computeDisplayGeometry(naturalW: number, naturalH: number) {
  const aspect = naturalW / naturalH
  const uncappedH = PREVIEW_WIDTH / aspect

  if (uncappedH <= MAX_PREVIEW_HEIGHT) {
    return {
      displayW: PREVIEW_WIDTH,
      displayH: uncappedH,
      offsetX: 0,
      offsetY: 0,
      containerH: Math.ceil(uncappedH),
    }
  }

  const displayH = MAX_PREVIEW_HEIGHT
  const displayW = MAX_PREVIEW_HEIGHT * aspect
  const offsetX = (PREVIEW_WIDTH - displayW) / 2
  return { displayW, displayH, offsetX, offsetY: 0, containerH: MAX_PREVIEW_HEIGHT }
}

function CropNode({ id, data }: NodeProps) {
  const inputConnections = useNodeConnections({ handleType: 'target', handleId: 'input' })
  const resultConnections = useNodeConnections({ handleType: 'source', handleId: 'result' })
  const allNodes = useNodes()
  const { setNodes } = useReactFlow()
  const d = data as Record<string, unknown>
  const locked = !!d.locked
  const { menuOpen, setMenuOpen, handleDuplicate, handleLock, handleDelete } = useNodeActions(id, locked)
  const onDataChange = d.onDataChange as ((nodeId: string, patch: Record<string, unknown>) => void) | undefined

  // Resolve source image URL from connected input handle
  const sourceConn = inputConnections[0]
  const sourceNode = sourceConn ? allNodes.find((n) => n.id === sourceConn.source) : null
  const sourceData = sourceNode?.data as Record<string, unknown> | undefined
  const sourceImageUrl =
    (sourceData?.imageUrl as string | undefined) ||
    (sourceData?.captureUrl as string | undefined)

  const imgRef = useRef<HTMLImageElement>(null)
  // containerRef is on the outer wrapper div (no overflow-hidden) so getBoundingClientRect
  // gives screen-space dimensions including React Flow's zoom transform.
  const containerRef = useRef<HTMLDivElement>(null)
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null)

  // Crop values — local state for smooth real-time drag; persisted to node data on drag end
  const [crop, setCrop] = useState<CropValues>(() => (d.cropValues as CropValues) || DEFAULT_CROP)
  const currentCropRef = useRef(crop)
  currentCropRef.current = crop

  // Drag tracking ref — no React state so drag is never batched
  const draggingRef = useRef<{
    handle: HandleId
    startX: number
    startY: number
    startCrop: CropValues
    displayW: number
    displayH: number
  } | null>(null)

  // Keep a stable ref to the latest geo so startDrag can read it without depending on it
  const geo = imgSize ? computeDisplayGeometry(imgSize.w, imgSize.h) : null
  const geoRef = useRef(geo)
  geoRef.current = geo

  // Generate the cropped image via the Canvas API.
  // Stored as both imageUrl (for standard downstream nodes) and captureUrl
  // (so BgRemoval / Flux2Edit can consume it without a server-side image ID).
  const generateOutput = useCallback(
    (cropVals: CropValues, imgEl?: HTMLImageElement | null) => {
      const img = imgEl ?? imgRef.current
      if (!img?.naturalWidth) return
      const nw = img.naturalWidth
      const nh = img.naturalHeight
      const sw = Math.max(1, Math.round(nw * cropVals.w))
      const sh = Math.max(1, Math.round(nh * cropVals.h))
      const canvas = document.createElement('canvas')
      canvas.width = sw
      canvas.height = sh
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(img, nw * cropVals.x, nh * cropVals.y, nw * cropVals.w, nh * cropVals.h, 0, 0, sw, sh)
      const url = canvas.toDataURL('image/png')
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, imageUrl: url, captureUrl: url } } : n,
        ),
      )
    },
    [id, setNodes],
  )

  const handleImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight })
      generateOutput(currentCropRef.current, img)
    },
    [generateOutput],
  )

  // Global mouse move + up for drag — attached once, reads from refs
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const drag = draggingRef.current
      if (!drag) return

      const dx = (e.clientX - drag.startX) / drag.displayW
      const dy = (e.clientY - drag.startY) / drag.displayH
      const c = drag.startCrop
      let { x, y, w, h } = c

      if (drag.handle.includes('w')) { x = c.x + dx; w = c.w - dx }
      if (drag.handle.includes('e')) { w = c.w + dx }
      if (drag.handle.includes('n')) { y = c.y + dy; h = c.h - dy }
      if (drag.handle.includes('s')) { h = c.h + dy }

      // Enforce minimum crop size
      if (w < MIN_CROP_FRAC) { w = MIN_CROP_FRAC; if (drag.handle.includes('w')) x = c.x + c.w - MIN_CROP_FRAC }
      if (h < MIN_CROP_FRAC) { h = MIN_CROP_FRAC; if (drag.handle.includes('n')) y = c.y + c.h - MIN_CROP_FRAC }

      // Clamp within image bounds
      x = Math.max(0, Math.min(x, 1 - w))
      y = Math.max(0, Math.min(y, 1 - h))
      w = Math.min(w, 1 - x)
      h = Math.min(h, 1 - y)

      const newCrop = { x, y, w, h }
      currentCropRef.current = newCrop
      setCrop(newCrop)
      generateOutput(newCrop)
    }

    const onUp = () => {
      if (draggingRef.current) {
        onDataChange?.(id, { cropValues: currentCropRef.current })
      }
      draggingRef.current = null
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [id, onDataChange, generateOutput])

  // startDrag uses getBoundingClientRect to get actual screen-space dimensions,
  // which correctly accounts for React Flow's CSS zoom transform.
  const startDrag = useCallback(
    (e: React.MouseEvent, handle: HandleId) => {
      e.preventDefault()
      e.stopPropagation()
      const currentGeo = geoRef.current
      if (!currentGeo) return
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const scaleX = rect.width / PREVIEW_WIDTH
      const scaleY = rect.height / currentGeo.containerH
      draggingRef.current = {
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startCrop: { ...currentCropRef.current },
        displayW: currentGeo.displayW * scaleX,
        displayH: currentGeo.displayH * scaleY,
      }
    },
    [],
  )

  // ─── Manual pixel dimension inputs ───────────────────────────────────────────

  const [editW, setEditW] = useState<string | null>(null)
  const [editH, setEditH] = useState<string | null>(null)
  // Prevent double-commit when Enter blurs the input (Enter → blur → onBlur)
  const enterCommittedW = useRef(false)
  const enterCommittedH = useRef(false)

  // commitW/commitH do NOT call setEditW/setEditH — clearing is owned by onBlur so that
  // setEditW(null) and setCrop(newCrop) always land in the same React batch (triggered by
  // the explicit .blur() call in onKeyDown, which fires onBlur synchronously).
  const commitW = useCallback(
    (raw: string) => {
      const val = parseInt(raw, 10)
      if (!imgSize || !val || val < 1) return
      const newW = Math.max(MIN_CROP_FRAC, Math.min(val / imgSize.w, 1 - currentCropRef.current.x))
      const newCrop = { ...currentCropRef.current, w: newW }
      setCrop(newCrop)
      currentCropRef.current = newCrop
      generateOutput(newCrop)
      onDataChange?.(id, { cropValues: newCrop })
    },
    [imgSize, id, onDataChange, generateOutput],
  )

  const commitH = useCallback(
    (raw: string) => {
      const val = parseInt(raw, 10)
      if (!imgSize || !val || val < 1) return
      const newH = Math.max(MIN_CROP_FRAC, Math.min(val / imgSize.h, 1 - currentCropRef.current.y))
      const newCrop = { ...currentCropRef.current, h: newH }
      setCrop(newCrop)
      currentCropRef.current = newCrop
      generateOutput(newCrop)
      onDataChange?.(id, { cropValues: newCrop })
    },
    [imgSize, id, onDataChange, generateOutput],
  )

  // ─── Display geometry ────────────────────────────────────────────────────────

  const containerH = geo?.containerH ?? 180

  const cropPx = geo
    ? {
        left: geo.offsetX + crop.x * geo.displayW,
        top: geo.offsetY + crop.y * geo.displayH,
        w: crop.w * geo.displayW,
        h: crop.h * geo.displayH,
      }
    : null

  const pixelW = imgSize ? Math.round(imgSize.w * crop.w) : null
  const pixelH = imgSize ? Math.round(imgSize.h * crop.h) : null

  return (
    <div
      style={{ width: NODE_WIDTH }}
      className={`bg-[#1a1a1a] border border-[#27272A] rounded-xl shadow-xl ${locked ? 'ring-1 ring-neutral-700' : ''}`}
    >
      <NodeHeader
        title="Crop"
        icon={<Crop size={14} className="text-sky-400" />}
        locked={locked}
        menuOpen={menuOpen}
        onMenuToggle={() => setMenuOpen(!menuOpen)}
        onDuplicate={handleDuplicate}
        onLock={handleLock}
        onDelete={handleDelete}
        onCloseMenu={() => setMenuOpen(false)}
      />

      <div className="p-4 flex flex-col gap-2">
        {!sourceImageUrl ? (
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
            <Crop size={28} className="text-neutral-600" />
          </div>
        ) : (
          // Outer wrapper: provides positioning context for handles, NO overflow-hidden
          // so handles at the crop boundary aren't clipped.
          <div
            ref={containerRef}
            className="relative select-none nodrag nowheel"
            style={{ width: PREVIEW_WIDTH, height: containerH }}
          >
            {/* Inner image container: overflow-hidden for visual crop masking */}
            <div
              className="absolute inset-0 rounded-lg overflow-hidden bg-[#0a0a0a]"
            >
              {/* Source image */}
              <img
                ref={imgRef}
                src={sourceImageUrl}
                className="absolute pointer-events-none"
                style={{
                  left: geo ? geo.offsetX : 0,
                  top: geo ? geo.offsetY : 0,
                  width: geo ? geo.displayW : PREVIEW_WIDTH,
                  height: geo ? geo.displayH : 'auto',
                  visibility: geo ? 'visible' : 'hidden',
                }}
                onLoad={handleImageLoad}
                draggable={false}
                alt=""
              />

              {cropPx && geo && (
                <>
                  {/* ── Outside-crop overlays (Figma-style dark mask) ── */}
                  <div className="absolute pointer-events-none bg-black/50"
                    style={{ left: geo.offsetX, top: geo.offsetY, width: geo.displayW, height: Math.max(0, cropPx.top - geo.offsetY) }} />
                  <div className="absolute pointer-events-none bg-black/50"
                    style={{ left: geo.offsetX, top: cropPx.top + cropPx.h, width: geo.displayW, height: Math.max(0, geo.offsetY + geo.displayH - cropPx.top - cropPx.h) }} />
                  <div className="absolute pointer-events-none bg-black/50"
                    style={{ left: geo.offsetX, top: cropPx.top, width: Math.max(0, cropPx.left - geo.offsetX), height: cropPx.h }} />
                  <div className="absolute pointer-events-none bg-black/50"
                    style={{ left: cropPx.left + cropPx.w, top: cropPx.top, width: Math.max(0, geo.offsetX + geo.displayW - cropPx.left - cropPx.w), height: cropPx.h }} />

                  {/* ── Crop border ── */}
                  <div className="absolute pointer-events-none border border-white/80"
                    style={{ left: cropPx.left, top: cropPx.top, width: cropPx.w, height: cropPx.h }} />

                  {/* ── Rule-of-thirds guides ── */}
                  <div className="absolute pointer-events-none" style={{ left: cropPx.left + cropPx.w / 3, top: cropPx.top, width: 1, height: cropPx.h, background: 'rgba(255,255,255,0.15)' }} />
                  <div className="absolute pointer-events-none" style={{ left: cropPx.left + (cropPx.w * 2) / 3, top: cropPx.top, width: 1, height: cropPx.h, background: 'rgba(255,255,255,0.15)' }} />
                  <div className="absolute pointer-events-none" style={{ left: cropPx.left, top: cropPx.top + cropPx.h / 3, width: cropPx.w, height: 1, background: 'rgba(255,255,255,0.15)' }} />
                  <div className="absolute pointer-events-none" style={{ left: cropPx.left, top: cropPx.top + (cropPx.h * 2) / 3, width: cropPx.w, height: 1, background: 'rgba(255,255,255,0.15)' }} />
                </>
              )}
            </div>

            {/* Handles layer: sits OUTSIDE overflow-hidden so edge/corner handles
                at the image boundary aren't clipped. z-index 30 puts them above
                everything inside the inner image container. */}
            {cropPx && geo && (
              <div className="absolute inset-0" style={{ zIndex: 30, pointerEvents: 'none' }}>
                {/* ── Corner handles ── */}
                {([
                  { h: 'nw' as HandleId, cx: cropPx.left,            cy: cropPx.top,            cursor: 'nwse-resize' },
                  { h: 'ne' as HandleId, cx: cropPx.left + cropPx.w, cy: cropPx.top,            cursor: 'nesw-resize' },
                  { h: 'sw' as HandleId, cx: cropPx.left,            cy: cropPx.top + cropPx.h, cursor: 'nesw-resize' },
                  { h: 'se' as HandleId, cx: cropPx.left + cropPx.w, cy: cropPx.top + cropPx.h, cursor: 'nwse-resize' },
                ]).map(({ h, cx, cy, cursor }) => (
                  <div
                    key={h}
                    onMouseDown={(e) => startDrag(e, h)}
                    className="absolute bg-white shadow-md"
                    style={{
                      width: CORNER_W,
                      height: CORNER_H,
                      left: cx - CORNER_W / 2,
                      top: cy - CORNER_H / 2,
                      cursor,
                      borderRadius: 2,
                      pointerEvents: 'auto',
                    }}
                  />
                ))}

                {/* ── Edge handles (rectangular bars) ── */}
                {([
                  { h: 'n' as HandleId, cx: cropPx.left + cropPx.w / 2, cy: cropPx.top,                cursor: 'ns-resize',  w: EDGE_NS_W, hh: EDGE_NS_H },
                  { h: 's' as HandleId, cx: cropPx.left + cropPx.w / 2, cy: cropPx.top + cropPx.h,     cursor: 'ns-resize',  w: EDGE_NS_W, hh: EDGE_NS_H },
                  { h: 'w' as HandleId, cx: cropPx.left,                cy: cropPx.top + cropPx.h / 2, cursor: 'ew-resize',  w: EDGE_EW_W, hh: EDGE_EW_H },
                  { h: 'e' as HandleId, cx: cropPx.left + cropPx.w,    cy: cropPx.top + cropPx.h / 2, cursor: 'ew-resize',  w: EDGE_EW_W, hh: EDGE_EW_H },
                ]).map(({ h, cx, cy, cursor, w: ew, hh: eh }) => (
                  <div
                    key={h}
                    onMouseDown={(e) => startDrag(e, h)}
                    className="absolute bg-white shadow-md"
                    style={{
                      width: ew,
                      height: eh,
                      left: cx - ew / 2,
                      top: cy - eh / 2,
                      cursor,
                      borderRadius: 3,
                      pointerEvents: 'auto',
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pixel dimension inputs */}
        <div className="flex items-center gap-2 nodrag">
          {imgSize ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-neutral-500 font-medium">W</span>
                <input
                  className="w-[58px] text-[11px] font-mono bg-[#111] border border-[#333] rounded px-1.5 py-0.5 text-neutral-300 text-center focus:outline-none focus:border-[#555]"
                  value={editW ?? (pixelW?.toString() ?? '')}
                  onFocus={() => setEditW(pixelW?.toString() ?? '')}
                  onChange={(e) => setEditW(e.target.value)}
                  onBlur={(e) => {
                    setEditW(null)
                    if (!enterCommittedW.current) commitW(e.target.value)
                    enterCommittedW.current = false
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      enterCommittedW.current = true
                      commitW((e.target as HTMLInputElement).value)
                      ;(e.target as HTMLInputElement).blur()
                    }
                  }}
                />
              </div>
              <span className="text-neutral-600 text-[11px]">×</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-neutral-500 font-medium">H</span>
                <input
                  className="w-[58px] text-[11px] font-mono bg-[#111] border border-[#333] rounded px-1.5 py-0.5 text-neutral-300 text-center focus:outline-none focus:border-[#555]"
                  value={editH ?? (pixelH?.toString() ?? '')}
                  onFocus={() => setEditH(pixelH?.toString() ?? '')}
                  onChange={(e) => setEditH(e.target.value)}
                  onBlur={(e) => {
                    setEditH(null)
                    if (!enterCommittedH.current) commitH(e.target.value)
                    enterCommittedH.current = false
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      enterCommittedH.current = true
                      commitH((e.target as HTMLInputElement).value)
                      ;(e.target as HTMLInputElement).blur()
                    }
                  }}
                />
              </div>
              <span className="text-[10px] text-neutral-500">px</span>
            </>
          ) : (
            <span className="text-[11px] text-neutral-600">Connect an image to crop</span>
          )}
        </div>
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

export default memo(CropNode)
