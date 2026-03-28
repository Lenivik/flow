import { type ReactNode } from 'react'
import { Lock, MoreHorizontal } from 'lucide-react'
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
    <div className="flex items-center justify-between px-4 py-3 border-b border-[#27272A]/50">
      <div className="flex items-center gap-2.5">
        {locked && <Lock size={12} className="text-neutral-500" />}
        {icon}
        <span className="text-sm font-medium text-gray-200">{title}</span>
      </div>
      <div className="relative">
        <button onClick={onMenuToggle} className="text-gray-500 hover:text-gray-300 transition-colors">
          <MoreHorizontal size={16} />
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
