import { memo } from 'react'
import { Handle, Position, useNodeConnections, useReactFlow, type NodeProps } from '@xyflow/react'
import { Loader2, Play } from 'lucide-react'
import { SettingsSlider, SettingsDropdown, SettingsCheck } from './NodeSettings'
import NodeHeader from './NodeHeader'
import { GridView, NavigationOverlay } from './ImageHistory'
import { useNodeActions } from '../../hooks/useNodeActions'
import { useImageNode } from '../../hooks/useImageNode'

function RelightNode({ id, data }: NodeProps) {
  const promptConnections = useNodeConnections({ handleType: 'target', handleId: 'prompt' })
  const negativeConnections = useNodeConnections({ handleType: 'target', handleId: 'negative_prompt' })
  const resultConnections = useNodeConnections({ handleType: 'source', handleId: 'result' })
  const locked = !!data.locked
  const debugSettings = !!data.debugSettings
  const d = data as Record<string, unknown>
  const { menuOpen, setMenuOpen, handleDuplicate, handleLock, handleDelete } = useNodeActions(id, locked)
  const { setNodes } = useReactFlow()
  const {
    loading, error, imageLoaded, gridView, setGridView,
    history, imageIndex, imageUrl, navigateImage,
    handleRunModel, handleImageLoad, containerHeight,
  } = useImageNode({ id, data: d, runCallback: 'onRunModel' })

  const defaults: Record<string, unknown> = {
    imageSize: 'square_hd', inferenceSteps: 28, randomSeed: true, seed: 42,
    initialLatent: 'none', enableHRFix: true, cfg: 1, lowResDenoise: 0.98,
    highResDenoise: 0.95, hrDownscale: 0.5, guidanceScale: 5,
    enableSafetyChecker: true, outputFormat: 'png',
  }
  const v = (key: string) => d[key] !== undefined ? d[key] : defaults[key]

  const update = (key: string, value: unknown) => {
    setNodes((nds) =>
      nds.map((n) => n.id === id ? { ...n, data: { ...n.data, [key]: value } } : n),
    )
  }

  return (
    <div className={`bg-[#1a1a1a] border border-[#27272A] rounded-xl shadow-xl ${locked ? 'ring-1 ring-neutral-700' : ''}`} style={{ width: 320 }}>
      <NodeHeader
        title="Relight 2.0"
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

        <span className="text-[10px] text-gray-500 font-mono bg-[#18181B] px-1.5 py-0.5 rounded border border-[#27272A] w-fit">Image to image</span>
      </div>

      {debugSettings && (
        <div className="px-4 pb-3 space-y-3 nodrag nowheel">
          <div className="grid grid-cols-2 gap-2">
            <SettingsDropdown label="Image Size" value={v('imageSize') as string} onChange={(val) => update('imageSize', val)}
              options={[
                { value: 'square', label: 'Square' }, { value: 'square_hd', label: 'Square HD' },
                { value: 'portrait_4_3', label: 'Portrait 4:3' }, { value: 'portrait_16_9', label: 'Portrait 16:9' },
                { value: 'landscape_4_3', label: 'Landscape 4:3' }, { value: 'landscape_16_9', label: 'Landscape 16:9' },
              ]} />
            <SettingsDropdown label="Output Format" value={v('outputFormat') as string} onChange={(val) => update('outputFormat', val)}
              options={[{ value: 'png', label: 'PNG' }, { value: 'jpeg', label: 'JPEG' }, { value: 'webp', label: 'WebP' }]} />
          </div>
          <SettingsSlider label="Inference Steps" value={v('inferenceSteps') as number} min={1} max={100} step={1} onChange={(val) => update('inferenceSteps', val)} tooltip="Number of denoising steps" />
          <SettingsCheck label="Random Seed" checked={v('randomSeed') as boolean} onChange={(val) => update('randomSeed', val)} tooltip="Use a random seed each run">
            <input type="number" value={v('seed') as number}
              onChange={(e) => { const n = parseInt(e.target.value); if (!isNaN(n)) update('seed', n) }}
              disabled={v('randomSeed') as boolean}
              className="w-16 bg-neutral-800 text-xs text-neutral-200 text-center rounded-md py-1 outline-none border border-neutral-700 focus:border-neutral-500 disabled:opacity-40" />
          </SettingsCheck>
          <SettingsDropdown label="Initial Latent" value={v('initialLatent') as string} onChange={(val) => update('initialLatent', val)}
            options={[{ value: 'none', label: 'None' }, { value: 'image', label: 'Image' }]} />
          <div className="grid grid-cols-2 gap-2">
            <SettingsSlider label="Guidance Scale" value={v('guidanceScale') as number} min={1} max={20} step={0.5} onChange={(val) => update('guidanceScale', val)} />
            <SettingsSlider label="CFG" value={v('cfg') as number} min={0} max={30} step={0.5} onChange={(val) => update('cfg', val)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <SettingsSlider label="Low-res Denoise" value={v('lowResDenoise') as number} min={0} max={1} step={0.01} onChange={(val) => update('lowResDenoise', val)} />
            <SettingsSlider label="High-res Denoise" value={v('highResDenoise') as number} min={0} max={1} step={0.01} onChange={(val) => update('highResDenoise', val)} />
          </div>
          <SettingsSlider label="HR Downscale" value={v('hrDownscale') as number} min={0.1} max={1} step={0.05} onChange={(val) => update('hrDownscale', val)} />
          <div className="grid grid-cols-2 gap-2">
            <SettingsCheck label="Enable HR Fix" checked={v('enableHRFix') as boolean} onChange={(val) => update('enableHRFix', val)} />
            <SettingsCheck label="Safety Checker" checked={v('enableSafetyChecker') as boolean} onChange={(val) => update('enableSafetyChecker', val)} />
          </div>
        </div>
      )}

      {error && (
        <div className="px-4 pb-2">
          <p className="text-[11px] text-red-400">{error}</p>
        </div>
      )}

      <div className="px-4 pb-4 flex justify-end">
        <button onClick={handleRunModel} disabled={loading || locked}
          className="px-3 py-1 bg-[#cccccc] hover:bg-[#e0e0e0] disabled:bg-[#cccccc]/50 disabled:text-[#1C1C1E]/50 text-[#1C1C1E] text-[10px] font-bold rounded-sm flex items-center gap-1.5 transition-colors uppercase">
          {loading ? (<><Loader2 size={10} className="animate-spin" /> Running</>) : (<><Play size={10} className="fill-current" /> Run</>)}
        </button>
      </div>

      <Handle type="target" position={Position.Left} id="prompt"
        className={`!w-[7px] !h-[7px] !bg-[#ADF5FF] !border-0 !-left-[9px] handle-purple ${promptConnections.length > 0 ? 'connected' : ''}`}
        style={{ top: '35%' }} title="Prompt" />
      <Handle type="target" position={Position.Left} id="negative_prompt"
        className={`!w-[7px] !h-[7px] !bg-[#ADF5FF] !border-0 !-left-[9px] handle-purple ${negativeConnections.length > 0 ? 'connected' : ''}`}
        style={{ top: '55%' }} title="Negative Prompt" />
      <div className="absolute text-[10px] bg-black/30 backdrop-blur-sm px-1 rounded font-medium" style={{ top: 'calc(35% - 24px)', right: 'calc(100% + 18px)', color: '#ADF5FF' }}>Prompt</div>
      <div className="absolute text-[10px] bg-black/30 backdrop-blur-sm px-1 rounded font-medium" style={{ top: 'calc(55% - 24px)', right: 'calc(100% + 18px)', color: '#ADF5FF' }}>Negative</div>

      <Handle type="source" position={Position.Right} id="result"
        className={`!w-[7px] !h-[7px] !bg-[#00FFC5] !border-0 !-right-[9px] handle-green ${resultConnections.length > 0 ? 'connected' : ''}`}
        title="Result" />
      <div className="absolute text-[10px] bg-black/30 backdrop-blur-sm px-1 rounded font-medium" style={{ top: 'calc(50% - 24px)', left: 'calc(100% + 18px)', color: '#00FFC5' }}>Result</div>
    </div>
  )
}

export default memo(RelightNode)
