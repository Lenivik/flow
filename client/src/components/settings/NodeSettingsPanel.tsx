import { Loader2, Play, X } from 'lucide-react'
import { nodeSettings } from '../../lib/nodeSettings'
import type { FieldDef } from '../../lib/nodeSettings'
import { SubNavField, SubNavSelect, SubNavSlider, SubNavNumber, SubNavCheck, SidebarDropdown, SidebarSlider } from './SettingsControls'

export type PanelLayout = 'attached' | 'subnav' | 'sidebar'

interface Props {
  nodeType: string
  nodeData: Record<string, unknown>
  onUpdate: (key: string, value: string) => void
  layout: PanelLayout
}

function useVal(nodeData: Record<string, unknown>, defaults: Record<string, unknown>) {
  return (key: string) => {
    const v = nodeData[key]
    return v !== undefined ? v : defaults[key]
  }
}

function CompactField({ field, val, onUpdate, numericAs }: {
  field: FieldDef
  val: (k: string) => unknown
  onUpdate: (k: string, v: string) => void
  numericAs: 'slider' | 'number'
}) {
  const label = field.shortLabel ?? field.label
  if (field.type === 'select') return (
    <SubNavField label={label}>
      <SubNavSelect value={String(val(field.key) ?? '')} onChange={(v) => onUpdate(field.key, v)} options={field.options} />
    </SubNavField>
  )
  if (field.type === 'slider') return (
    <SubNavField label={label}>
      {numericAs === 'slider'
        ? <SubNavSlider value={val(field.key) as number} onChange={(v) => onUpdate(field.key, String(v))} min={field.min} max={field.max} step={field.step} />
        : <SubNavNumber value={val(field.key) as number} onChange={(v) => onUpdate(field.key, String(v))} min={field.min} max={field.max} step={field.step} />}
    </SubNavField>
  )
  if (field.type === 'check') return (
    <SubNavField label={label}>
      <SubNavCheck checked={val(field.key) as boolean} onChange={(v) => onUpdate(field.key, String(v))} />
    </SubNavField>
  )
  if (field.type === 'seed') return (
    <SubNavField label={label}>
      <div className="flex items-center gap-1.5">
        <SubNavNumber value={val(field.key) as number} onChange={(v) => onUpdate(field.key, String(v))} min={field.min} max={field.max} step={1} />
        <span className="text-[10px] text-neutral-500">Rng</span>
        <SubNavCheck checked={val(field.randomKey) as boolean} onChange={(v) => onUpdate(field.randomKey, String(v))} />
      </div>
    </SubNavField>
  )
  return null
}

function SidebarField({ field, val, onUpdate }: {
  field: FieldDef
  val: (k: string) => unknown
  onUpdate: (k: string, v: string) => void
}) {
  if (field.type === 'select') return (
    <SidebarDropdown label={field.label} value={String(val(field.key) ?? '')} onChange={(v) => onUpdate(field.key, v)} options={field.options} />
  )
  if (field.type === 'slider') return (
    <SidebarSlider label={field.label} value={val(field.key) as number} min={field.min} max={field.max} step={field.step} onChange={(v) => onUpdate(field.key, String(v))} />
  )
  if (field.type === 'check') return (
    <div className="flex items-center justify-between">
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input type="checkbox" checked={val(field.key) as boolean} onChange={(e) => onUpdate(field.key, String(e.target.checked))} className="w-3.5 h-3.5 rounded border-neutral-600 bg-neutral-800 accent-purple-500 cursor-pointer" />
        <span className="text-[11px] font-medium text-neutral-400">{field.label}</span>
      </label>
    </div>
  )
  if (field.type === 'seed') {
    const isRandom = val(field.randomKey) as boolean
    return (
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={isRandom} onChange={(e) => onUpdate(field.randomKey, String(e.target.checked))} className="w-3.5 h-3.5 rounded border-neutral-600 bg-neutral-800 accent-purple-500 cursor-pointer" />
          <span className="text-[11px] font-medium text-neutral-400">Random Seed</span>
        </label>
        <input type="number" value={val(field.key) as number} onChange={(e) => { const n = parseInt(e.target.value); if (!isNaN(n)) onUpdate(field.key, String(n)) }}
          disabled={isRandom}
          className="w-16 bg-neutral-800 text-xs text-neutral-200 text-center rounded-md py-1 outline-none border border-neutral-700 disabled:opacity-40" />
      </div>
    )
  }
  return null
}

interface SidebarPanelProps {
  nodeType: string
  nodeData: Record<string, unknown>
  onUpdate: (key: string, value: string) => void
  onClose: () => void
  onRun: () => void
  running: boolean
  width: string
}

export function SidebarPanel({ nodeType, nodeData, onUpdate, onClose, onRun, running, width }: SidebarPanelProps) {
  const label = nodeSettings[nodeType]?.label ?? nodeType
  return (
    <div className={`absolute right-4 ${width} z-40 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl flex flex-col`} style={{ top: '5.5rem', bottom: '6.5rem' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <span className="text-sm font-medium text-neutral-200 truncate">{label}</span>
        <button onClick={onClose} className="p-1 text-neutral-500 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors">
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <NodeSettingsPanel nodeType={nodeType} nodeData={nodeData} onUpdate={onUpdate} layout="sidebar" />
      </div>
      <div className="px-4 py-3 border-t border-neutral-800">
        <button onClick={onRun} disabled={running} className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 text-white rounded-lg py-2 text-sm font-medium transition-colors">
          {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          {running ? 'Running...' : 'Run Selected'}
        </button>
      </div>
    </div>
  )
}

export function NodeSettingsPanel({ nodeType, nodeData, onUpdate, layout }: Props) {
  const config = nodeSettings[nodeType]
  if (!config) return null
  const val = useVal(nodeData, config.defaults)

  if (layout === 'sidebar') {
    return (
      <>
        {config.groups.flat().map((field, i) => (
          <SidebarField key={`${field.key}-${i}`} field={field} val={val} onUpdate={onUpdate} />
        ))}
      </>
    )
  }

  const numericAs = layout === 'attached' ? 'slider' : 'number'

  if (layout === 'attached') {
    return (
      <>
        {config.groups.map((group, gi) => (
          <div key={gi} className="flex items-center gap-2">
            {group.map((field, fi) => (
              <CompactField key={`${field.key}-${fi}`} field={field} val={val} onUpdate={onUpdate} numericAs={numericAs} />
            ))}
          </div>
        ))}
      </>
    )
  }

  // subnav: single flex row, dividers between groups
  return (
    <>
      {config.groups.flatMap((group, gi) => [
        ...(gi > 0 ? [<div key={`div-${gi}`} className="h-8 w-px bg-neutral-800" />] : []),
        ...group.map((field, fi) => (
          <CompactField key={`${field.key}-${fi}`} field={field} val={val} onUpdate={onUpdate} numericAs={numericAs} />
        )),
      ])}
    </>
  )
}
