import { useState, useRef, useEffect } from 'react'
import {
  MousePointer2,
  Hand,
  ImageIcon,
  Wrench,
  ChevronDown,
  ChevronRight,
  Box,
  Video,
  Sparkles,
  Search,
} from 'lucide-react'

export type ToolMode = 'select' | 'hand'

interface CanvasToolbarProps {
  toolMode: ToolMode
  onToolModeChange: (mode: ToolMode) => void
  onAddNode: (type: string) => void
}

interface Model {
  label: string
  nodeType: string | null
  description: string
}

interface Subcategory {
  id: string
  label: string
  models: Model[]
}

interface Category {
  id: string
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>
  label: string
  subcategories: Subcategory[]
}

const MENU_DATA: Category[] = [
  {
    id: 'tools',
    icon: Wrench,
    label: 'Tools',
    subcategories: [
      {
        id: 'utilities',
        label: 'Utilities',
        models: [
          { label: 'Export', nodeType: 'export', description: 'Download generated images from the canvas.' },
        ],
      },
      {
        id: 'text_tools',
        label: 'Text tools',
        models: [
          { label: 'Text Prompt', nodeType: 'textPrompt', description: 'Write and connect text prompts to models.' },
        ],
      },
      {
        id: 'editing_tools',
        label: 'Editing tools',
        models: [
          { label: 'Crop', nodeType: null, description: 'Crop images to a specific region.' },
          { label: 'Resize', nodeType: null, description: 'Resize images to specific dimensions.' },
          { label: 'Color Adjust', nodeType: null, description: 'Adjust brightness, contrast, and saturation.' },
        ],
      },
      {
        id: 'iterators',
        label: 'Iterators',
        models: [
          { label: 'Batch Runner', nodeType: null, description: 'Run a workflow multiple times with varied inputs.' },
          { label: 'Prompt Variations', nodeType: null, description: 'Generate multiple prompt variations automatically.' },
          { label: 'Grid Compare', nodeType: null, description: 'Compare outputs side-by-side in a grid.' },
        ],
      },
    ],
  },
  {
    id: 'image',
    icon: ImageIcon,
    label: 'Image models',
    subcategories: [
      {
        id: 't2i',
        label: 'Text to image',
        models: [
          { label: 'Nano Banana 2', nodeType: 'imageGen', description: 'Fast text-to-image generation with negative prompt support.' },
          { label: 'Flux 2 Flash', nodeType: 'flux2Flash', description: 'High-quality text-to-image with guidance control.' },
          { label: 'Flux.1 Pro', nodeType: null, description: 'Professional-grade text-to-image model.' },
          { label: 'Flux.1 Dev', nodeType: null, description: 'Developer-focused text-to-image model.' },
          { label: 'Flux.1 Schnell', nodeType: null, description: 'Ultra-fast text-to-image generation.' },
          { label: 'SDXL 1.0', nodeType: null, description: 'Stable Diffusion XL for high-resolution images.' },
        ],
      },
      {
        id: 'i2i',
        label: 'Image to image',
        models: [
          { label: 'Relight 2.0', nodeType: 'relight', description: 'Re-light images with text-guided illumination control.' },
          { label: 'ControlNet (Canny)', nodeType: null, description: 'Edge-guided image-to-image transformation.' },
          { label: 'ControlNet (Depth)', nodeType: null, description: 'Depth-guided image-to-image transformation.' },
          { label: 'ControlNet (Pose)', nodeType: null, description: 'Pose-guided image-to-image transformation.' },
          { label: 'SDXL Img2Img', nodeType: null, description: 'Stable Diffusion XL image-to-image.' },
        ],
      },
      {
        id: 'edit',
        label: 'Edit images',
        models: [
          { label: 'BG Removal', nodeType: 'bgRemoval', description: 'Remove backgrounds from images automatically.' },
          { label: 'Flux 2 Edit', nodeType: 'flux2Edit', description: 'Edit images with text prompts. Describe changes to apply.' },
          { label: 'Generative Fill', nodeType: null, description: 'AI-powered inpainting and fill.' },
          { label: 'Magic Eraser', nodeType: null, description: 'Remove unwanted objects from images.' },
          { label: 'SDXL Inpaint', nodeType: null, description: 'Stable Diffusion XL inpainting.' },
          { label: 'SDXL Outpaint', nodeType: null, description: 'Extend images beyond their borders.' },
        ],
      },
      {
        id: 'enhance',
        label: 'Enhance images',
        models: [
          { label: 'Magnific AI', nodeType: null, description: 'AI-powered image upscaling and enhancement.' },
          { label: 'Topaz Gigapixel', nodeType: null, description: 'Intelligent image upscaling.' },
          { label: 'Upscayl', nodeType: null, description: 'Open-source AI image upscaler.' },
        ],
      },
    ],
  },
  {
    id: 'video',
    icon: Video,
    label: 'Video models',
    subcategories: [
      {
        id: 't2v_vid',
        label: 'Text to video',
        models: [
          { label: 'Runway Gen-3 Alpha', nodeType: null, description: 'State-of-the-art text-to-video generation.' },
          { label: 'Luma Dream Machine', nodeType: null, description: 'High-quality text-to-video synthesis.' },
          { label: 'Kling AI', nodeType: null, description: 'AI-powered text-to-video model.' },
          { label: 'Stable Video Diffusion', nodeType: null, description: 'Open text-to-video diffusion model.' },
        ],
      },
      {
        id: 'i2v_vid',
        label: 'Image to video',
        models: [
          { label: 'Luma Dream Machine (I2V)', nodeType: null, description: 'Animate images into video.' },
          { label: 'Runway Gen-3 (I2V)', nodeType: null, description: 'Image-to-video with Gen-3 quality.' },
          { label: 'Kling AI (I2V)', nodeType: null, description: 'Image-to-video animation.' },
        ],
      },
      {
        id: 'v2v_vid',
        label: 'Video to video',
        models: [
          { label: 'Runway Gen-1 (V2V)', nodeType: null, description: 'Style transfer for video.' },
          { label: 'Domo AI', nodeType: null, description: 'AI video transformation.' },
        ],
      },
    ],
  },
  {
    id: 'models3d',
    icon: Box,
    label: '3D models',
    subcategories: [
      {
        id: 't23d',
        label: 'Text to 3D',
        models: [
          { label: 'Tripo3D', nodeType: null, description: 'Text-to-3D model generation.' },
          { label: 'Meshy (Text)', nodeType: null, description: 'Generate 3D meshes from text.' },
          { label: 'Spline AI', nodeType: null, description: '3D design with AI assistance.' },
        ],
      },
      {
        id: 'i23d',
        label: 'Image to 3D',
        models: [
          { label: 'Trellis', nodeType: 'trellis', description: 'Generate 3D models from a single image.' },
          { label: 'Meshy (Image)', nodeType: null, description: 'Image-to-3D mesh generation.' },
          { label: 'Era3D', nodeType: null, description: 'Multi-view 3D reconstruction from images.' },
        ],
      },
    ],
  },
]

export default function CanvasToolbar({ toolMode, onToolModeChange, onAddNode }: CanvasToolbarProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveCategory(null)
        setActiveSubcategory(null)
        setSearchQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleCategoryClick = (categoryId: string) => {
    if (activeCategory === categoryId) {
      setActiveCategory(null)
      setActiveSubcategory(null)
      setSearchQuery('')
    } else {
      setActiveCategory(categoryId)
      const cat = MENU_DATA.find((c) => c.id === categoryId)
      if (cat && cat.subcategories.length > 0) {
        setActiveSubcategory('search')
        setSearchQuery('')
        setTimeout(() => searchInputRef.current?.focus(), 50)
      } else {
        setActiveSubcategory(null)
      }
    }
  }

  const closeMenu = () => {
    setActiveCategory(null)
    setActiveSubcategory(null)
    setSearchQuery('')
  }

  const getActiveData = () => MENU_DATA.find((c) => c.id === activeCategory)

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40" ref={containerRef}>
      {/* Mega panel */}
      {activeCategory && getActiveData() && getActiveData()!.subcategories.length > 0 && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-[780px] h-[480px] bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl flex overflow-hidden">
          {/* Left column: subcategories */}
          <div className="w-[220px] border-r border-neutral-800 bg-neutral-950 p-3 flex flex-col gap-1 overflow-y-auto shrink-0">
            <div className="px-3 py-2 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">
              {getActiveData()!.label}
            </div>

            {/* Search bar */}
            <div
              className={`flex items-center gap-2 px-3 py-2 mb-1 rounded-xl cursor-text transition-colors ${
                activeSubcategory === 'search'
                  ? 'bg-neutral-800 border border-neutral-600 text-white'
                  : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
              }`}
              onClick={() => { setActiveSubcategory('search'); setTimeout(() => searchInputRef.current?.focus(), 0) }}
            >
              <Search size={14} className="shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={activeCategory === 'tools' ? 'Search tools...' : 'Search models...'}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setActiveSubcategory('search')
                }}
                className="bg-transparent border-none outline-none w-full text-sm placeholder:text-neutral-500 text-white"
              />
            </div>

            {getActiveData()!.subcategories.map((sub) => (
              <button
                key={sub.id}
                onMouseEnter={() => setActiveSubcategory(sub.id)}
                onClick={() => setActiveSubcategory(sub.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-between ${
                  activeSubcategory === sub.id
                    ? 'bg-neutral-800 text-white border border-neutral-700'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 border border-transparent'
                }`}
              >
                {sub.label}
                <ChevronRight size={14} className={`transition-opacity ${activeSubcategory === sub.id ? 'opacity-100' : 'opacity-0'}`} />
              </button>
            ))}
          </div>

          {/* Right column: model cards */}
          <div className="flex-1 overflow-y-auto">
            {activeSubcategory && (() => {
              let displayModels: { model: Model; subLabel: string }[] = []
              if (activeSubcategory === 'search') {
                const allModels = getActiveData()!.subcategories.flatMap((sub) =>
                  sub.models.map((model) => ({ model, subLabel: sub.label })),
                )
                displayModels = searchQuery
                  ? allModels.filter((m) => m.model.label.toLowerCase().includes(searchQuery.toLowerCase()))
                  : allModels
              } else {
                const activeSub = getActiveData()!.subcategories.find((s) => s.id === activeSubcategory)
                if (activeSub) {
                  displayModels = activeSub.models.map((model) => ({ model, subLabel: activeSub.label }))
                }
              }

              const isTools = activeCategory === 'tools'
              const heading =
                activeSubcategory === 'search'
                  ? searchQuery
                    ? `Results for "${searchQuery}"`
                    : isTools ? 'All tools' : `All ${getActiveData()!.label.replace(/ models/i, '')} models`
                  : getActiveData()!.subcategories.find((s) => s.id === activeSubcategory)?.label ?? ''

              return (
                <>
                  <div className="flex items-center gap-2 sticky top-0 bg-neutral-900 z-10 px-5 pt-5 pb-3">
                    <Sparkles size={16} className="text-blue-400" />
                    <h3 className="text-sm font-semibold text-white">{heading}</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3 px-5 pb-5">
                    {displayModels.length === 0 && (
                      <div className="col-span-2 py-12 text-center text-neutral-500 flex flex-col items-center">
                        <Search size={28} className="mb-3 opacity-20" />
                        <p className="text-sm">No {isTools ? 'tools' : 'models'} found matching &ldquo;{searchQuery}&rdquo;</p>
                      </div>
                    )}
                    {displayModels.map(({ model, subLabel }) => {
                      const available = model.nodeType !== null
                      return (
                        <button
                          key={model.label}
                          onClick={() => {
                            if (available) {
                              onAddNode(model.nodeType!)
                              closeMenu()
                            }
                          }}
                          disabled={!available}
                          className={`text-left rounded-xl border overflow-hidden transition-all ${
                            available
                              ? 'border-neutral-800 bg-neutral-850 hover:border-neutral-600 hover:bg-neutral-800 cursor-pointer'
                              : 'border-neutral-800/50 bg-neutral-900/50 opacity-50 cursor-not-allowed'
                          }`}
                        >
                          <div className="p-3.5">
                            <div className="flex items-center justify-between mb-1.5">
                              <h4 className="text-[13px] font-semibold text-white">{model.label}</h4>
                              {available ? (
                                <span className="text-[10px] font-medium text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">
                                  Available
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium text-neutral-500 bg-neutral-800 px-1.5 py-0.5 rounded">
                                  Coming soon
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mb-2">
                              <span className="text-[10px] text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded border border-blue-400/20">
                                {subLabel.toLowerCase()}
                              </span>
                            </div>
                            <p className="text-[12px] text-neutral-400 leading-relaxed line-clamp-2">{model.description}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}

      {/* Main toolbar */}
      <div className="flex items-center gap-0.5 bg-neutral-900 border border-neutral-800 rounded-2xl px-2 py-1.5 shadow-2xl">
        {/* Pointer / Hand toggle */}
        <div className="relative flex items-center">
          <button
            onClick={() => onToolModeChange(toolMode === 'select' ? 'hand' : 'select')}
            className="p-2.5 rounded-xl transition-colors bg-[#545553] text-white"
            title={toolMode === 'hand' ? 'Hand tool' : 'Move'}
          >
            {toolMode === 'hand' ? <Hand size={18} /> : <MousePointer2 size={18} />}
          </button>
        </div>

        {/* Category buttons with mega panels */}
        {MENU_DATA.map((cat) => {
          const isActive = activeCategory === cat.id
          const Icon = cat.icon
          return (
            <div key={cat.id} className="relative flex items-center">
              <button
                onClick={() => handleCategoryClick(cat.id)}
                className={`p-2.5 rounded-xl transition-colors ${
                  isActive ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                }`}
                title={cat.label}
              >
                <Icon size={18} />
              </button>
              <button
                onClick={() => handleCategoryClick(cat.id)}
                className={`p-1 transition-colors ml-0.5 ${
                  isActive ? 'text-blue-300' : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <ChevronDown size={10} className={`transition-transform ${isActive ? 'rotate-180' : ''}`} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
