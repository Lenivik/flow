const BASE = '/api'

async function request(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, { ...options, headers })

  if (res.status === 401) {
    localStorage.removeItem('token')
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }

  if (res.status === 204) return null
  return res.json()
}

export const api = {
  signup: (data: { email_address: string; password: string; password_confirmation: string }) =>
    request('/signup', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: { email_address: string; password: string }) =>
    request('/login', { method: 'POST', body: JSON.stringify(data) }),

  me: () => request('/me'),

  logout: () => request('/logout', { method: 'DELETE' }),

  getProjects: () => request('/projects'),

  createProject: (name: string) =>
    request('/projects', { method: 'POST', body: JSON.stringify({ name }) }),

  getProject: (id: string) => request(`/projects/${id}`),

  updateProject: (id: string, name: string) =>
    request(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),

  deleteProject: (id: string) =>
    request(`/projects/${id}`, { method: 'DELETE' }),

  saveCanvas: (projectId: string, data: { nodes: unknown[]; edges: unknown[] }) =>
    request(`/projects/${projectId}/canvas/save`, { method: 'POST', body: JSON.stringify(data) }),

  generateImage: (prompt: string, negativePrompt?: string, nodeId?: string, settings?: Record<string, string>) =>
    request('/generate/image', { method: 'POST', body: JSON.stringify({ prompt, negative_prompt: negativePrompt, node_id: nodeId, ...settings }) }),

  sendOperations: (projectId: string, operations: unknown[]) =>
    request(`/projects/${projectId}/canvas/operations`, { method: 'POST', body: JSON.stringify({ operations }) }),

  beaconOperations: (projectId: string, operations: unknown[]) => {
    const token = localStorage.getItem('token')
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    fetch(`${BASE}/projects/${projectId}/canvas/operations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ operations }),
      keepalive: true,
    })
  },

  generateFlux2Flash: (prompt: string, nodeId?: string, settings?: Record<string, string>) =>
    request('/generate/flux2_flash', { method: 'POST', body: JSON.stringify({ prompt, node_id: nodeId, ...settings }) }),

  generateFlux2Edit: (prompt: string, sourceImageId?: number, nodeId?: string, settings?: Record<string, string>, captureDataUrl?: string) =>
    request('/generate/flux2_edit', { method: 'POST', body: JSON.stringify({ prompt, source_image_id: sourceImageId, capture_data: captureDataUrl, node_id: nodeId, ...settings }) }),

  removeBg: (sourceImageId?: number, nodeId?: string, captureDataUrl?: string) =>
    request('/generate/remove_bg', { method: 'POST', body: JSON.stringify({ source_image_id: sourceImageId, node_id: nodeId, capture_data: captureDataUrl }) }),

  generateTrellis: (sourceImageId: number, nodeId?: string, settings?: Record<string, unknown>) =>
    request('/generate/trellis', { method: 'POST', body: JSON.stringify({ source_image_id: sourceImageId, node_id: nodeId, ...settings }) }),

  getNodeImages: (nodeId: string) => request(`/nodes/${nodeId}/images`),

  nodeImageUrl: (imageId: number) => `${BASE}/node_images/${imageId}`,

  fetchNodeImageBlob: async (imageId: number): Promise<string> => {
    const token = localStorage.getItem('token')
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(`${BASE}/node_images/${imageId}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch image')
    const blob = await res.blob()
    return URL.createObjectURL(blob)
  },
}
