import { useState, useRef, useEffect, useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { HistoryEntry } from '../components/nodes/ImageHistory'

const IMAGE_WIDTH = 320

interface UseImageNodeOptions {
  id: string
  data: Record<string, unknown>
  runCallback?: string // key in data for the run function (e.g. 'onRunModel', 'onRunBgRemoval')
  defaultHeight?: number
}

export function useImageNode({ id, data, runCallback, defaultHeight = 160 }: UseImageNodeOptions) {
  const { setNodes } = useReactFlow()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageHeight, setImageHeight] = useState<number | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [gridView, setGridView] = useState(false)
  const prevImageUrl = useRef<string | undefined>(undefined)

  const history = (data.imageHistory as HistoryEntry[]) || []
  const imageIndex = (data.imageIndex as number) ?? history.length - 1
  const imageUrl = data.imageUrl as string | undefined

  useEffect(() => {
    if (imageUrl && imageUrl !== prevImageUrl.current) {
      setImageLoaded(false)
      setImageHeight(null)
    }
    prevImageUrl.current = imageUrl
  }, [imageUrl])

  const navigateImage = useCallback((newIndex: number) => {
    if (newIndex < 0 || newIndex >= history.length) return
    const entry = history[newIndex]
    setNodes((nds) =>
      nds.map((n) => n.id === id ? { ...n, data: { ...n.data, imageUrl: entry.url, activeImageId: entry.id, imageIndex: newIndex } } : n),
    )
  }, [id, history, setNodes])

  const handleRunModel = useCallback(() => {
    const fn = runCallback ? data[runCallback] : undefined
    if (fn) {
      setLoading(true)
      setError(null)
      ;(fn as (nodeId: string) => Promise<string | null>)(id)
        .then((err) => { if (err) setError(err) })
        .finally(() => setLoading(false))
    }
  }, [id, data, runCallback])

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    const aspect = img.naturalHeight / img.naturalWidth
    requestAnimationFrame(() => {
      setImageHeight(Math.round(IMAGE_WIDTH * aspect))
      setImageLoaded(true)
    })
  }, [])

  const containerHeight = imageHeight ?? defaultHeight

  return {
    loading,
    error,
    imageHeight,
    imageLoaded,
    gridView,
    setGridView,
    history,
    imageIndex,
    imageUrl,
    navigateImage,
    handleRunModel,
    handleImageLoad,
    containerHeight,
    setNodes,
  }
}
