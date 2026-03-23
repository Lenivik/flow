import { useState, useEffect, useRef } from 'react'
import { Search } from 'lucide-react'

export interface DropMenuItem {
  type: string
  label: string
}

interface ConnectionDropMenuProps {
  x: number
  y: number
  items: DropMenuItem[]
  onSelect: (type: string) => void
  onClose: () => void
}

export default function ConnectionDropMenu({ x, y, items, onSelect, onClose }: ConnectionDropMenuProps) {
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const filtered = items.filter((item) =>
    item.label.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl py-2 w-60"
      style={{ left: x, top: y }}
    >
      <div className="flex items-center gap-2 px-3 pb-2 border-b border-neutral-800">
        <Search size={14} className="text-neutral-500 shrink-0" />
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search"
          className="bg-transparent text-sm text-neutral-300 placeholder-neutral-500 outline-none w-full"
        />
      </div>
      <div className="max-h-64 overflow-y-auto pt-1">
        {filtered.map((item) => (
          <button
            key={item.type}
            onClick={() => onSelect(item.type)}
            className="w-full text-left px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 transition-colors"
          >
            {item.label}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="px-4 py-2 text-sm text-neutral-500">No matching nodes</p>
        )}
      </div>
    </div>
  )
}
