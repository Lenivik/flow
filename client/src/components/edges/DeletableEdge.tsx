import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow, type EdgeProps } from '@xyflow/react'
import { Trash2 } from 'lucide-react'

export default function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  selected,
}: EdgeProps) {
  const { deleteElements } = useReactFlow()
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  // Compute perpendicular offset so the button never overlaps the edge line
  const OFFSET = 24
  const dx = targetX - sourceX
  const dy = targetY - sourceY
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  // Two perpendicular directions: (-dy, dx) and (dy, -dx). Pick the one pointing "up" (negative Y).
  let nx = -dy / len
  let ny = dx / len
  if (ny > 0) { nx = -nx; ny = -ny }
  const btnX = labelX + nx * OFFSET
  const btnY = labelY + ny * OFFSET

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      {selected && (
        <EdgeLabelRenderer>
          <button
            onClick={(e) => {
              e.stopPropagation()
              deleteElements({ edges: [{ id }] })
            }}
            className="nodrag nopan p-1.5 bg-neutral-700 hover:bg-neutral-600 text-neutral-300 hover:text-white rounded-md shadow-lg transition-colors cursor-pointer"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${btnX}px,${btnY}px)`,
              pointerEvents: 'all',
            }}
          >
            <Trash2 size={12} />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
