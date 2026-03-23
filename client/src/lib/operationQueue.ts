import { api } from './api'

export interface Operation {
  type: 'node_create' | 'node_update' | 'node_delete' | 'edge_create' | 'edge_delete'
  payload: Record<string, unknown>
}

type IdMapCallback = (idMap: Record<string, string>) => void

export class OperationQueue {
  private queue: Operation[] = []
  private timer: ReturnType<typeof setTimeout> | null = null
  private projectId: string
  private clientToServer: Record<string, string> = {}
  private onIdMap: IdMapCallback | null = null
  private retryCount = 0
  private flushing = false

  constructor(projectId: string, onIdMap?: IdMapCallback) {
    this.projectId = projectId
    this.onIdMap = onIdMap || null
  }

  setOnIdMap(cb: IdMapCallback) {
    this.onIdMap = cb
  }

  push(op: Operation, immediate = false) {
    this.queue.push(op)
    if (this.timer) clearTimeout(this.timer)

    if (immediate || this.isStructural(op)) {
      this.flush()
    } else {
      this.timer = setTimeout(() => this.flush(), 500)
    }
  }

  async flush() {
    if (this.flushing || this.queue.length === 0) return
    this.flushing = true

    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }

    const ops = this.coalesce([...this.queue])
    this.queue = []

    // Translate any known client IDs to server IDs before sending
    const translated = ops.map((op) => ({
      type: op.type,
      payload: this.translatePayload(op),
    }))

    try {
      const result = await api.sendOperations(this.projectId, translated)
      this.retryCount = 0
      if (result?.id_map) {
        const idMap = result.id_map as Record<string, string>
        Object.assign(this.clientToServer, idMap)
        this.onIdMap?.(idMap)
      }
    } catch {
      // Put ops back and retry with exponential backoff
      this.queue = [...ops, ...this.queue]
      if (this.retryCount < 3) {
        const delay = Math.pow(2, this.retryCount) * 1000
        this.retryCount++
        this.timer = setTimeout(() => this.flush(), delay)
      }
    } finally {
      this.flushing = false
    }
  }

  flushBeacon() {
    if (this.queue.length === 0) return
    const ops = this.coalesce([...this.queue])
    this.queue = []

    const translated = ops.map((op) => ({
      type: op.type,
      payload: this.translatePayload(op),
    }))

    api.beaconOperations(this.projectId, translated)
  }

  resolveId(clientId: string): string {
    return this.clientToServer[clientId] || clientId
  }

  private isStructural(op: Operation): boolean {
    return op.type !== 'node_update'
  }

  private coalesce(ops: Operation[]): Operation[] {
    const result: Operation[] = []
    const lastUpdateIndex = new Map<string, number>()

    for (const op of ops) {
      if (op.type === 'node_update') {
        const nodeId = op.payload.id as string
        const existing = lastUpdateIndex.get(nodeId)
        if (existing !== undefined) {
          // Merge: latest position/data wins
          const prev = result[existing]
          result[existing] = {
            type: 'node_update',
            payload: {
              id: nodeId,
              ...(prev.payload.position || op.payload.position
                ? { position: op.payload.position || prev.payload.position }
                : {}),
              ...(prev.payload.data || op.payload.data
                ? { data: op.payload.data || prev.payload.data }
                : {}),
            },
          }
        } else {
          lastUpdateIndex.set(nodeId, result.length)
          result.push(op)
        }
      } else {
        result.push(op)
      }
    }

    return result
  }

  private translatePayload(op: Operation): Record<string, unknown> {
    const p = { ...op.payload }
    if (op.type === 'node_update' || op.type === 'node_delete') {
      p.id = this.clientToServer[p.id as string] || p.id
    }
    if (op.type === 'edge_create') {
      p.source = this.clientToServer[p.source as string] || p.source
      p.target = this.clientToServer[p.target as string] || p.target
    }
    if (op.type === 'edge_delete') {
      p.id = this.clientToServer[p.id as string] || p.id
    }
    return p
  }
}
