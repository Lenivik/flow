import { memo, useState, useRef, useCallback } from 'react'
import { Handle, Position, useNodeConnections, type NodeProps } from '@xyflow/react'
import { ImagePlus, Loader2, RefreshCw } from 'lucide-react'
import NodeHeader from './NodeHeader'
import { useNodeActions } from '../../hooks/useNodeActions'
import { useImageNode } from '../../hooks/useImageNode'
import { api } from '../../lib/api'

const NODE_WIDTH = 320

function ImportNode({ id, data }: NodeProps) {
  const resultConnections = useNodeConnections({ handleType: 'source', handleId: 'result' })
  const locked = !!data.locked
  const d = data as Record<string, unknown>
  const { menuOpen, setMenuOpen, handleDuplicate, handleLock, handleDelete } = useNodeActions(id, locked)
  const { imageUrl, imageLoaded, handleImageLoad, containerHeight, setNodes } = useImageNode({
    id,
    data: d,
    defaultHeight: 200,
  })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const upload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        setError('Only image files are supported')
        return
      }
      setUploading(true)
      setError(null)
      try {
        const serverNodeId = id.match(/^\d+$/) ? id : undefined
        const result = await api.uploadImage(file, serverNodeId)
        if (result.error) {
          setError(result.error)
          return
        }
        const blobUrl = result.node_image_id
          ? await api.fetchNodeImageBlob(result.node_image_id)
          : URL.createObjectURL(file)
        const newEntry = { id: result.node_image_id ?? 0, url: blobUrl }
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id !== id) return n
            const nd = n.data as Record<string, unknown>
            const history = [...((nd.imageHistory as { id: number; url: string }[]) || []), newEntry]
            return {
              ...n,
              data: {
                ...nd,
                imageUrl: blobUrl,
                activeImageId: result.node_image_id,
                imageHistory: history,
                imageIndex: history.length - 1,
              },
            }
          }),
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        setUploading(false)
      }
    },
    [id, setNodes],
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) upload(file)
      // Reset so the same file can be re-selected
      e.target.value = ''
    },
    [upload],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) upload(file)
    },
    [upload],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => setDragOver(false), [])

  const openFilePicker = useCallback(() => {
    if (!locked) fileInputRef.current?.click()
  }, [locked])

  return (
    <div
      style={{ width: NODE_WIDTH }}
      className="bg-[#1a1a1a] border border-[#27272A] rounded-xl shadow-xl"
    >
      <NodeHeader
        title="Import"
        locked={locked}
        menuOpen={menuOpen}
        onMenuToggle={() => setMenuOpen(!menuOpen)}
        onDuplicate={handleDuplicate}
        onLock={handleLock}
        onDelete={handleDelete}
        onCloseMenu={() => setMenuOpen(false)}
      />

      <div className="p-4 flex flex-col gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {!imageUrl ? (
          // Empty state — dropzone
          <div
            className={`w-full rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer border-2 border-dashed transition-colors nodrag nowheel select-none ${
              dragOver
                ? 'border-[#00FFC5] bg-[#00FFC5]/5'
                : 'border-[#333] hover:border-[#555]'
            }`}
            style={{ height: 160 }}
            onClick={openFilePicker}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {uploading ? (
              <>
                <Loader2 size={24} className="text-neutral-500 animate-spin" />
                <span className="text-xs text-neutral-500">Uploading…</span>
              </>
            ) : (
              <>
                <ImagePlus size={24} className="text-neutral-600" />
                <span className="text-xs text-neutral-500">Click or drop an image</span>
              </>
            )}
          </div>
        ) : (
          // Image loaded — show preview with re-upload on hover
          <div
            className={`relative w-full rounded-lg overflow-hidden bg-[#0a0a0a] cursor-pointer nodrag nowheel select-none group border-2 transition-colors ${
              dragOver ? 'border-[#00FFC5]' : 'border-transparent'
            }`}
            style={{ height: containerHeight }}
            onClick={openFilePicker}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <img
              src={imageUrl}
              alt=""
              className="w-full h-full object-contain"
              style={{ opacity: imageLoaded ? 1 : 0, transition: 'opacity 0.2s' }}
              onLoad={handleImageLoad}
              draggable={false}
            />
            {/* Re-upload overlay on hover */}
            {!uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center gap-1.5">
                  <RefreshCw size={18} className="text-white" />
                  <span className="text-[11px] text-white font-medium">Replace image</span>
                </div>
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <Loader2 size={24} className="text-white animate-spin" />
              </div>
            )}
          </div>
        )}

        {error && <p className="text-[11px] text-red-400">{error}</p>}
      </div>

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

export default memo(ImportNode)
