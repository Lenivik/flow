import { useState, useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'

export function useNodeActions(id: string, locked: boolean) {
  const { setNodes, setEdges, getNode } = useReactFlow()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleDuplicate = useCallback(() => {
    const node = getNode(id)
    if (!node) return
    setNodes((nds) => [...nds, {
      ...node,
      id: `temp_${Date.now()}`,
      position: { x: node.position.x + 50, y: node.position.y + 50 },
      selected: false,
      data: { ...node.data, imageUrl: undefined, modelFile: undefined, locked: false, imageHistory: [], imageIndex: 0 },
      draggable: true,
    }])
    setMenuOpen(false)
  }, [id, getNode, setNodes])

  const handleLock = useCallback(() => {
    setNodes((nds) =>
      nds.map((n) => n.id === id ? { ...n, draggable: locked, data: { ...n.data, locked: !locked } } : n),
    )
    setMenuOpen(false)
  }, [id, locked, setNodes])

  const handleDelete = useCallback(() => {
    if (locked) return
    setNodes((nds) => nds.filter((n) => n.id !== id))
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id))
    setMenuOpen(false)
  }, [id, locked, setNodes, setEdges])

  return { menuOpen, setMenuOpen, handleDuplicate, handleLock, handleDelete }
}
