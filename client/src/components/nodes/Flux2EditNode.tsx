import { memo } from 'react'
import { Handle, Position, useNodeConnections, type NodeProps } from '@xyflow/react'
import { Loader2, Play } from 'lucide-react'
import NodeHeader from './NodeHeader'
import { GridView, NavigationOverlay } from './ImageHistory'
import { useNodeActions } from '../../hooks/useNodeActions'
import { useImageNode } from '../../hooks/useImageNode'

function Flux2EditNode({ id, data }: NodeProps) {
  const promptConnections = useNodeConnections({ handleType: 'target', handleId: 'prompt' })
  const inputConnections = useNodeConnections({ handleType: 'target', handleId: 'input' })
  const resultConnections = useNodeConnections({ handleType: 'source', handleId: 'result' })
  const locked = !!data.locked
  const d = data as Record<string, unknown>
  const { menuOpen, setMenuOpen, handleDuplicate, handleLock, handleDelete } = useNodeActions(id, locked)
  const {
    loading, error, imageLoaded, gridView, setGridView,
    history, imageIndex, imageUrl, navigateImage,
    handleRunModel, handleImageLoad, containerHeight,
  } = useImageNode({ id, data: d, runCallback: 'onRunFlux2Edit', defaultHeight: 192 })

  return (
    <div className={`bg-[#1a1a1a] border border-[#27272A] rounded-xl shadow-xl ${locked ? 'ring-1 ring-neutral-700' : ''}`} style={{ width: 320 }}>
      <NodeHeader
        title="Flux 2 Edit"
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
            onSelect={(i) => { navigateImage(i); setGridView(false) }}
            onClose={() => setGridView(false)}
          />
        ) : (
          <div className="relative group">
            <div
              className="w-full rounded-lg overflow-hidden border border-[#27272A]/80 shadow-inner"
              style={{
                height: containerHeight,
                transition: 'height 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                ...(imageUrl ? {} : {
                  backgroundImage: `
                    linear-gradient(45deg, #1a1a1a 25%, transparent 25%),
                    linear-gradient(-45deg, #1a1a1a 25%, transparent 25%),
                    linear-gradient(45deg, transparent 75%, #1a1a1a 75%),
                    linear-gradient(-45deg, transparent 75%, #1a1a1a 75%)
                  `,
                  backgroundSize: '20px 20px',
                  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0',
                  backgroundColor: '#252525',
                }),
              }}
            >
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt="Edited"
                  onLoad={handleImageLoad}
                  className="w-full rounded-lg"
                  style={{ opacity: imageLoaded ? 1 : 0, transition: 'opacity 0.3s ease-in' }}
                />
              )}
            </div>

            {imageUrl && (
              <NavigationOverlay
                imageIndex={imageIndex}
                total={history.length}
                onPrev={() => navigateImage(imageIndex - 1)}
                onNext={() => navigateImage(imageIndex + 1)}
                onGridView={() => setGridView(true)}
              />
            )}
          </div>
        )}

        <span className="text-[10px] text-gray-500 font-mono bg-[#18181B] px-1.5 py-0.5 rounded border border-[#27272A] w-fit">Image to image</span>
      </div>

      {error && (
        <div className="px-4 pb-2">
          <p className="text-[11px] text-red-400">{error}</p>
        </div>
      )}

      <div className="px-4 pb-4 flex justify-between items-center">
        {inputConnections.length === 0 && !imageUrl ? (
          <p className="text-[10px] text-neutral-500">Connect an image and prompt to edit</p>
        ) : <div />}
        <button
          onClick={handleRunModel}
          disabled={loading || locked}
          className="px-3 py-1 bg-[#cccccc] hover:bg-[#e0e0e0] disabled:bg-[#cccccc]/50 disabled:text-[#1C1C1E]/50 text-[#1C1C1E] text-[10px] font-bold rounded-sm flex items-center gap-1.5 transition-colors uppercase"
        >
          {loading ? (<><Loader2 size={10} className="animate-spin" /> Running</>) : (<><Play size={10} className="fill-current" /> Run</>)}
        </button>
      </div>

      <Handle type="target" position={Position.Left} id="prompt"
        className={`!w-[7px] !h-[7px] !bg-[#ADF5FF] !border-0 !-left-[9px] handle-purple ${promptConnections.length > 0 ? 'connected' : ''}`}
        style={{ top: '35%' }} title="Prompt" />
      <Handle type="target" position={Position.Left} id="input"
        className={`!w-[7px] !h-[7px] !bg-[#00FFC5] !border-0 !-left-[9px] handle-green ${inputConnections.length > 0 ? 'connected' : ''}`}
        style={{ top: '60%' }} title="Input" />
      <div className="absolute text-[10px] bg-black/30 backdrop-blur-sm px-1 rounded font-medium" style={{ top: 'calc(35% - 24px)', right: 'calc(100% + 18px)', color: '#ADF5FF' }}>Prompt</div>
      <div className="absolute text-[10px] bg-black/30 backdrop-blur-sm px-1 rounded font-medium" style={{ top: 'calc(60% - 24px)', right: 'calc(100% + 18px)', color: '#00FFC5' }}>Image</div>

      <Handle type="source" position={Position.Right} id="result"
        className={`!w-[7px] !h-[7px] !bg-[#00FFC5] !border-0 !-right-[9px] handle-green ${resultConnections.length > 0 ? 'connected' : ''}`}
        title="Result" />
      <div className="absolute text-[10px] bg-black/30 backdrop-blur-sm px-1 rounded font-medium" style={{ top: 'calc(50% - 24px)', left: 'calc(100% + 18px)', color: '#00FFC5' }}>Result</div>
    </div>
  )
}

export default memo(Flux2EditNode)
