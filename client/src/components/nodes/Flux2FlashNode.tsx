import { memo } from 'react'
import { Handle, Position, useNodeConnections, type NodeProps } from '@xyflow/react'
import { Loader2 } from 'lucide-react'
import NodeHeader from './NodeHeader'
import { GridView, NavigationOverlay } from './ImageHistory'
import { useNodeActions } from '../../hooks/useNodeActions'
import { useImageNode } from '../../hooks/useImageNode'

function Flux2FlashNode({ id, data }: NodeProps) {
  const promptConnections = useNodeConnections({ handleType: 'target', handleId: 'prompt' })
  const resultConnections = useNodeConnections({ handleType: 'source', handleId: 'result' })
  const locked = !!data.locked
  const d = data as Record<string, unknown>
  const { menuOpen, setMenuOpen, handleDuplicate, handleLock, handleDelete } = useNodeActions(id, locked)
  const {
    loading, error, imageLoaded, gridView, setGridView,
    history, imageIndex, imageUrl, navigateImage,
    handleRunModel, handleImageLoad, containerHeight,
  } = useImageNode({ id, data: d, runCallback: 'onRunFlux2Flash', defaultHeight: 192 })

  return (
    <div className={`bg-neutral-900 rounded-xl shadow-2xl ${locked ? 'ring-1 ring-neutral-700' : ''}`} style={{ width: 352 }}>
      <NodeHeader
        title="Flux 2 Flash"
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
            onSelect={(i) => { navigateImage(i); setGridView(false) }}
            onClose={() => setGridView(false)}
          />
        ) : (
          <div className="relative group">
            <div
              className="w-full rounded-lg overflow-hidden"
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
                  alt="Generated"
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
      </div>

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
          {loading ? (<><Loader2 size={14} className="animate-spin" /> Generating...</>) : 'Run Model'}
        </button>
      </div>

      <Handle type="target" position={Position.Left} id="prompt"
        className={`!w-2.5 !h-2.5 !bg-purple-400 !border-0 !-left-[7px] handle-purple ${promptConnections.length > 0 ? 'connected' : ''}`}
        style={{ top: '50%' }} title="Prompt" />
      <div className="absolute left-3 text-[10px] text-purple-300 font-medium" style={{ top: 'calc(50% - 6px)' }}>Prompt</div>

      <Handle type="source" position={Position.Right} id="result"
        className={`!w-2.5 !h-2.5 !bg-emerald-400 !border-0 !-right-[7px] handle-green ${resultConnections.length > 0 ? 'connected' : ''}`}
        title="Result" />
      <div className="absolute right-3 text-[10px] text-emerald-300 font-medium" style={{ top: 'calc(50% - 6px)', textAlign: 'right' }}>Result</div>
    </div>
  )
}

export default memo(Flux2FlashNode)
