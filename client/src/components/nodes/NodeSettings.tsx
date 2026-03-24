import { ChevronDown, Info } from 'lucide-react'

// Reusable setting controls for inline node settings (debug mode)

export function SettingsSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  tooltip,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  tooltip?: string
}) {
  return (
    <div>
      <div className="flex items-center gap-1 mb-1.5">
        <span className="text-[11px] font-medium text-neutral-400">{label}</span>
        {tooltip && (
          <span title={tooltip} className="text-neutral-600 hover:text-neutral-400 cursor-help">
            <Info size={10} />
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="flex-1 h-1 accent-neutral-400 bg-neutral-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-neutral-200"
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const n = parseFloat(e.target.value)
            if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)))
          }}
          className="w-12 bg-neutral-800 text-xs text-neutral-200 text-center rounded-md py-1 outline-none border border-neutral-700 focus:border-neutral-500"
        />
      </div>
    </div>
  )
}

export function SettingsDropdown({
  label,
  value,
  options,
  onChange,
  tooltip,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  tooltip?: string
}) {
  return (
    <div>
      <div className="flex items-center gap-1 mb-1.5">
        <span className="text-[11px] font-medium text-neutral-400">{label}</span>
        {tooltip && (
          <span title={tooltip} className="text-neutral-600 hover:text-neutral-400 cursor-help">
            <Info size={10} />
          </span>
        )}
      </div>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-neutral-800 text-xs text-neutral-200 rounded-lg pl-3 pr-7 py-2 outline-none cursor-pointer border border-neutral-700 hover:border-neutral-600 transition-colors"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
      </div>
    </div>
  )
}

export function SettingsCheck({
  label,
  checked,
  onChange,
  tooltip,
  children,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  tooltip?: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between">
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="w-3.5 h-3.5 rounded border-neutral-600 bg-neutral-800 accent-purple-500 cursor-pointer"
        />
        <span className="text-[11px] font-medium text-neutral-400">{label}</span>
        {tooltip && (
          <span title={tooltip} className="text-neutral-600 hover:text-neutral-400 cursor-help">
            <Info size={10} />
          </span>
        )}
      </label>
      {children}
    </div>
  )
}
