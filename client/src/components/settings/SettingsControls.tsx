import { ChevronDown } from 'lucide-react'

export function SubNavField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] text-neutral-500 font-medium leading-none">{label}</span>
      {children}
    </div>
  )
}

export function SubNavSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[][] }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-neutral-800 text-[12px] text-neutral-200 rounded-lg pl-2.5 pr-6 py-1 outline-none cursor-pointer hover:bg-neutral-700 transition-colors"
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
    </div>
  )
}

export function SubNavNumber({ value, onChange, min, max, step }: { value: number; onChange: (v: number) => void; min: number; max: number; step: number }) {
  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => { const n = parseFloat(e.target.value); if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n))) }}
      className="w-14 bg-neutral-800 text-[12px] text-neutral-200 text-center rounded-lg py-1 outline-none hover:bg-neutral-700 transition-colors"
    />
  )
}

export function SubNavSlider({ value, onChange, min, max, step }: { value: number; onChange: (v: number) => void; min: number; max: number; step: number }) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-16 h-1 accent-neutral-400 bg-neutral-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-neutral-200"
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => { const n = parseFloat(e.target.value); if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n))) }}
        className="w-14 bg-neutral-800 text-[12px] text-neutral-200 text-center rounded-lg py-1 outline-none hover:bg-neutral-700 transition-colors"
      />
    </div>
  )
}

export function SubNavCheck({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-7 h-4 rounded-full transition-colors ${checked ? 'bg-purple-500' : 'bg-neutral-700'}`}
    >
      <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform mx-0.5 ${checked ? 'translate-x-3' : 'translate-x-0'}`} />
    </button>
  )
}

export function SidebarDropdown({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[][] }) {
  return (
    <div>
      <span className="text-[11px] font-medium text-neutral-400 mb-1.5 block">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-neutral-800 text-xs text-neutral-200 rounded-lg pl-3 pr-7 py-2 outline-none cursor-pointer border border-neutral-700 hover:border-neutral-600 transition-colors"
        >
          {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
      </div>
    </div>
  )
}

export function SidebarSlider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div>
      <span className="text-[11px] font-medium text-neutral-400 mb-1.5 block">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="flex-1 min-w-0 h-1 accent-neutral-400 bg-neutral-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-neutral-200"
        />
        <input
          type="number" min={min} max={max} step={step} value={value}
          onChange={(e) => { const n = parseFloat(e.target.value); if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n))) }}
          className="w-12 bg-neutral-800 text-xs text-neutral-200 text-center rounded-md py-1 outline-none border border-neutral-700 focus:border-neutral-500"
        />
      </div>
    </div>
  )
}
