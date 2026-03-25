import { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import NodeContextMenu from './NodeContextMenu'

interface NodeHeaderProps {
  title: string
  icon?: ReactNode
  locked: boolean
  menuOpen: boolean
  onMenuToggle: () => void
  onDuplicate: () => void
  onLock: () => void
  onDelete: () => void
  onCloseMenu: () => void
}

export default function NodeHeader({ title, icon, locked, menuOpen, onMenuToggle, onDuplicate, onLock, onDelete, onCloseMenu }: NodeHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800/50">
      <span className="text-sm font-medium text-neutral-300 flex items-center gap-2">
        {locked && <Lock size={12} className="text-neutral-500" />}
        {icon}
        {title}
      </span>
      <div className="relative">
        <button onClick={onMenuToggle} className="text-neutral-500 hover:text-neutral-300 transition-colors">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="3" cy="8" r="1.5" />
            <circle cx="8" cy="8" r="1.5" />
            <circle cx="13" cy="8" r="1.5" />
          </svg>
        </button>
        {menuOpen && (
          <NodeContextMenu
            locked={locked}
            onDuplicate={onDuplicate}
            onRename={onCloseMenu}
            onLock={onLock}
            onDelete={onDelete}
            onClose={onCloseMenu}
          />
        )}
      </div>
    </div>
  )
}
