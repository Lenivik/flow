import { useRef, useEffect } from 'react'
import { Copy, Type, Lock, Unlock, Trash2 } from 'lucide-react'

interface NodeContextMenuProps {
  locked?: boolean
  onDuplicate: () => void
  onRename: () => void
  onLock: () => void
  onDelete: () => void
  onClose: () => void
}

export default function NodeContextMenu({ locked, onDuplicate, onRename, onLock, onDelete, onClose }: NodeContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as globalThis.Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div ref={ref} className="absolute top-8 right-0 bg-neutral-800 border border-neutral-700 rounded-xl shadow-2xl py-1.5 min-w-[200px] z-50">
      <button
        onClick={onDuplicate}
        className="w-full text-left px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-700 hover:text-white transition-colors flex items-center justify-between"
      >
        <span className="flex items-center gap-2.5"><Copy size={14} /> Duplicate</span>
        <span className="text-[11px] text-neutral-500">cmd+d</span>
      </button>
      <button
        onClick={onRename}
        className="w-full text-left px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-700 hover:text-white transition-colors flex items-center gap-2.5"
      >
        <Type size={14} /> Rename
      </button>
      <button
        onClick={onLock}
        className="w-full text-left px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-700 hover:text-white transition-colors flex items-center gap-2.5"
      >
        {locked ? <><Unlock size={14} /> Unlock</> : <><Lock size={14} /> Lock</>}
      </button>
      <div className="border-t border-neutral-700 my-1" />
      <button
        onClick={onDelete}
        className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-neutral-700 hover:text-red-300 transition-colors flex items-center justify-between"
      >
        <span className="flex items-center gap-2.5"><Trash2 size={14} /> Delete</span>
        <span className="text-[11px] text-neutral-500">delete / backspace</span>
      </button>
    </div>
  )
}
