import { useState, useRef, useEffect } from 'react'
import { MousePointer2, Hand, Type, ImageIcon, Wrench, ChevronDown } from 'lucide-react'

export type ToolMode = 'select' | 'hand'

interface CanvasToolbarProps {
  toolMode: ToolMode
  onToolModeChange: (mode: ToolMode) => void
  onAddNode: (type: string) => void
}

interface SubMenuItem {
  label: string
  action: () => void
}

interface ToolGroup {
  id: string
  icon: React.ReactNode
  activeIcon?: React.ReactNode
  label: string
  submenu?: SubMenuItem[]
  onClick?: () => void
}

function SubMenu({ items, onClose }: { items: SubMenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div ref={ref} className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-neutral-800 border border-neutral-700 rounded-xl shadow-2xl py-1.5 min-w-[200px] z-50">
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => { item.action(); onClose() }}
          className="w-full text-left px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-700 hover:text-white transition-colors flex items-center gap-2"
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

export default function CanvasToolbar({ toolMode, onToolModeChange, onAddNode }: CanvasToolbarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  const tools: ToolGroup[] = [
    {
      id: 'pointer',
      icon: <MousePointer2 size={18} />,
      activeIcon: toolMode === 'hand' ? <Hand size={18} /> : <MousePointer2 size={18} />,
      label: toolMode === 'hand' ? 'Hand tool' : 'Move',
      submenu: [
        { label: 'Move', action: () => onToolModeChange('select') },
        { label: 'Hand tool', action: () => onToolModeChange('hand') },
      ],
    },
    {
      id: 'text',
      icon: <Type size={18} />,
      label: 'Text Prompts',
      submenu: [
        { label: 'Text Prompt', action: () => onAddNode('textPrompt') },
      ],
    },
    {
      id: 'image',
      icon: <ImageIcon size={18} />,
      label: 'Image Models',
      submenu: [
        { label: 'Google Nano Banana', action: () => onAddNode('imageGen') },
      ],
    },
    {
      id: 'utilities',
      icon: <Wrench size={18} />,
      label: 'Utilities',
      submenu: [
        { label: 'Export', action: () => onAddNode('export') },
      ],
    },
  ]

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40">
      <div className="flex items-center gap-0.5 bg-neutral-900 border border-neutral-800 rounded-2xl px-2 py-1.5 shadow-2xl">
        {tools.map((tool) => (
          <div key={tool.id} className="relative flex items-center">
            {/* Main button */}
            <button
              onClick={() => {
                if (tool.id === 'pointer') {
                  onToolModeChange(toolMode === 'select' ? 'hand' : 'select')
                } else if (tool.submenu) {
                  setOpenMenu(openMenu === tool.id ? null : tool.id)
                }
              }}
              className={`p-2.5 rounded-xl transition-colors ${
                tool.id === 'pointer'
                  ? 'bg-blue-600 text-white'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`}
              title={tool.label}
            >
              {tool.id === 'pointer' ? tool.activeIcon : tool.icon}
            </button>

            {/* Dropdown arrow */}
            {tool.submenu && (
              <button
                onClick={() => setOpenMenu(openMenu === tool.id ? null : tool.id)}
                className="p-1 text-neutral-500 hover:text-neutral-300 transition-colors ml-0.5"
              >
                <ChevronDown size={10} />
              </button>
            )}

            {/* Submenu */}
            {openMenu === tool.id && tool.submenu && (
              <SubMenu items={tool.submenu} onClose={() => setOpenMenu(null)} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
