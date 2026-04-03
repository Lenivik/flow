import { useState, useEffect } from 'react'
import type { Node, Edge } from '@xyflow/react'
import { api } from '../lib/api'

type SetNodes = (updater: (nodes: Node[]) => Node[]) => void
type SetEdges = (edges: Edge[]) => void

const IMAGE_NODE_TYPES = new Set(['imageGen', 'flux2Flash', 'flux2Edit', 'relight', 'bgRemoval', 'trellis', 'meshyV6', 'import'])

interface NodeImageMeta { id: number; mime_type: string }

interface UseCanvasLoadOptions {
  id: string | undefined
  setNodes: SetNodes
  setEdges: SetEdges
  makeNodeData: (extra?: Record<string, unknown>) => Record<string, unknown>
  handleColors: Record<string, string>
}

export function useCanvasLoad({ id, setNodes, setEdges, makeNodeData, handleColors }: UseCanvasLoadOptions) {
  const [projectName, setProjectName] = useState('')

  useEffect(() => {
    if (!id) return
    let cancelled = false
    api.getProject(id).then(async (data) => {
      if (cancelled) return
      setProjectName(data.name)
      if (data.nodes?.length) {
        const loadedNodes = await Promise.all(data.nodes.map(async (n: { id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }) => {
          const nodeData: Record<string, unknown> = { ...n.data, ...makeNodeData() }
          // 3D nodes: skip activeImageId — history loading (filtered by MIME type) sets modelFile
          if (n.data.activeImageId && n.type !== 'trellis' && n.type !== 'meshyV6') {
            try {
              nodeData.imageUrl = await api.fetchNodeImageBlob(n.data.activeImageId as number)
            } catch { /* image may have been deleted */ }
          }
          return { id: n.id, type: n.type, position: n.position, data: nodeData }
        }))
        if (cancelled) return
        setNodes(() => loadedNodes)

        for (const n of loadedNodes) {
          if (IMAGE_NODE_TYPES.has(n.type) && n.id.match(/^\d+$/)) {
            api.getNodeImages(n.id).then(async (images: NodeImageMeta[]) => {
              if (!images?.length || cancelled) return

              // Filter by expected MIME type to guard against mixed content in the DB
              const is3dNode = n.type === 'trellis' || n.type === 'meshyV6'
              const filtered = is3dNode
                ? images.filter((img) => img.mime_type === 'model/gltf-binary')
                : images.filter((img) => img.mime_type?.startsWith('image/'))

              if (!filtered.length) return

              const history = await Promise.all(
                filtered.reverse().map(async (img) => {
                  try {
                    const url = await api.fetchNodeImageBlob(img.id)
                    return { id: img.id, url }
                  } catch {
                    return { id: img.id, url: '' }
                  }
                })
              )
              if (cancelled) return
              const validHistory = history.filter((h) => h.url)
              if (!validHistory.length) return

              if (is3dNode) {
                // Use the most recent GLB as the active model
                const latest = validHistory[validHistory.length - 1]
                setNodes((nds) =>
                  nds.map((node) => node.id === n.id
                    ? { ...node, data: { ...node.data, modelFile: latest.url, activeImageId: latest.id, imageHistory: validHistory, imageIndex: validHistory.length - 1 } }
                    : node
                  ),
                )
              } else {
                const activeId = n.data.activeImageId as number | undefined
                const activeIdx = activeId ? validHistory.findIndex((h) => h.id === activeId) : validHistory.length - 1
                setNodes((nds) =>
                  nds.map((node) => node.id === n.id
                    ? { ...node, data: { ...node.data, imageHistory: validHistory, imageIndex: activeIdx >= 0 ? activeIdx : validHistory.length - 1 } }
                    : node
                  ),
                )
              }
            })
          }
        }
      }
      if (data.edges?.length) {
        setEdges(data.edges.map((e: Edge) => ({
          ...e,
          style: { stroke: handleColors[e.sourceHandle || ''] || '#ADF5FF', strokeWidth: 2 },
        })))
      }
    })
    return () => { cancelled = true }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps — load once per project id

  return { projectName, setProjectName }
}
