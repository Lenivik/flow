# Flow — Visual AI Workflow Builder

## Project Structure

Monorepo with two apps:

- `api/` — Rails 8 API (Ruby 3.x, SQLite, Puma)
- `client/` — React 19 + TypeScript + Vite frontend

## Quick Start

```bash
# API
cd api
bin/rails db:setup
bin/rails server -p 3000

# Client (separate terminal)
cd client
npm install
npm run dev
```

The Vite dev server proxies `/api` requests to Rails on port 3000.

## Architecture

### Frontend

- **React Flow** (`@xyflow/react`) — node-based canvas editor
- **React Three Fiber** — 3D model viewer in TrellisNode
- **Tailwind CSS v4** — styling
- **No state management library** — React state + refs + operation queue

Key patterns:
- `CanvasPage.tsx` — main orchestrator; holds all nodes/edges state, operation queue, settings mode
- Node components are presentational — they receive all callbacks via `data` props, never import from CanvasPage
- `makeNodeData()` in CanvasPage — single factory that builds the callbacks object attached to every node; used by canvas load, drop menu, and toolbar add — add new callbacks here
- `useRunCallbacks` — all model run functions; add new `handleRunX` here, nowhere else
- `useCanvasLoad` — project load on mount; hydrates nodes with callbacks via `makeNodeData`
- `useImageNode` — image loading, history navigation, and run triggering for any image-output node
- `useNodeActions` — duplicate/lock/delete actions wired into every node header
- `nodeSettings.ts` — data-driven settings config (field types, defaults, groups) for every node type
- `NodeSettingsPanel` / `SidebarPanel` — render settings in any layout from `nodeSettings` config; no per-node settings JSX needed in CanvasPage
- `NodeSettings.tsx` — inline debug controls (used only inside node components when `debugSettings=true`/`settingsMode='inline'`)
- `OperationQueue` — batches delta ops (create/update/delete), coalesces rapid updates, syncs with retry and beacon on unload
- Images are fetched as blob ObjectURLs via authenticated requests (tokens never in query strings)

### Backend

- **JWT auth** — 30-day tokens via Authorization header, no cookie/session fallback
- **FalService** base class — all AI model integrations (submit → poll → download pattern)
- **Delta operations** — `POST /projects/:id/canvas/operations` processes batched node/edge CRUD
- Rate limiting: 30 requests/hour on generation endpoints, 10/3min on login

### Node Types

| Type | Purpose | Target handles | Source handles |
|------|---------|---------------|----------------|
| `textPrompt` | Text input | — | `prompt` |
| `imageGen` | Nano Banana 2 (fal.ai) | `prompt`, `negative_prompt` | `result` |
| `flux2Flash` | Flux 2 Flash (fal.ai) | `prompt` | `result` |
| `flux2Edit` | Flux 2 Edit image-to-image (fal.ai) | `prompt`, `input` | `result` |
| `relight` | Relight 2.0 (fal.ai) | `prompt`, `negative_prompt` | `result` |
| `bgRemoval` | Background removal (fal.ai) | `input` | `result` |
| `trellis` | 3D model generation (fal.ai) | `input` | `result` |
| `export` | Download image | `input` | — |

Handle color groups: `prompt` / `negative_prompt` = purple; `input` / `result` = green.

### API Endpoints

```
POST   /api/signup
POST   /api/login
GET    /api/me
DELETE /api/logout

GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
PATCH  /api/projects/:id
DELETE /api/projects/:id

POST   /api/projects/:id/canvas/operations   (delta ops)
POST   /api/projects/:id/canvas/save          (full state, legacy)

POST   /api/generate/image
POST   /api/generate/flux2_flash
POST   /api/generate/flux2_edit
POST   /api/generate/remove_bg
POST   /api/generate/trellis

GET    /api/node_images/:id                   (binary image data)
GET    /api/nodes/:node_id/images             (image history list)
```

## Adding a New fal.ai Node

Follow all steps in order. Steps 1–5 are backend; steps 6–8 are frontend.

### 1. Fetch the OpenAPI schema

```bash
curl -H "Authorization: Key $FAL_KEY" https://fal.run/fal-ai/{model-id}/openapi.json
```

### 2. Create the Rails service

`api/app/services/fal_{name}.rb` — extend `FalService`:

```ruby
class FalMyModel < FalService
  FAL_MODEL_ID = "fal-ai/my-model"

  def build_input
    input = { prompt: @prompt }
    # Map camelCase settings keys (sent from client) to fal.ai snake_case params
    input[:guidance_scale] = @settings["guidance_scale"].to_f if @settings["guidance_scale"]
    # For booleans always use this pattern (handles both Ruby bool and string from HTTP params):
    input[:enable_safety_checker] = [true, "true"].include?(@settings["enable_safety_checker"]) unless @settings["enable_safety_checker"].nil?
    input
  end
end
```

### 3. Add the controller endpoint

`api/app/controllers/generate_controller.rb`:

```ruby
def my_model
  result = FalMyModel.new(
    prompt: params[:prompt],
    node_id: params[:node_id],
    settings: params[:settings]&.to_unsafe_h || {}
  ).call
  render json: result
end
```

### 4. Add the route

`api/config/routes.rb`:

```ruby
post 'generate/my_model'
```

### 5. Add the API client method

`client/src/lib/api.ts`:

```typescript
async generateMyModel(prompt: string, nodeId?: string, settings?: Record<string, string>) {
  return this.post('/api/generate/my_model', { prompt, node_id: nodeId, settings })
}
```

### 6. Create the node component

`client/src/components/nodes/MyModelNode.tsx` — use `useImageNode`:

```typescript
import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import NodeHeader from './NodeHeader'
import { GridView, NavigationOverlay } from './ImageHistory'
import { useNodeActions } from '../../hooks/useNodeActions'
import { useImageNode } from '../../hooks/useImageNode'

function MyModelNode({ id, data }: NodeProps) {
  const locked = !!data.locked
  const d = data as Record<string, unknown>
  const { menuOpen, setMenuOpen, handleDuplicate, handleLock, handleDelete } = useNodeActions(id, locked)
  const {
    loading, error, imageLoaded, gridView, setGridView,
    history, imageIndex, imageUrl, navigateImage,
    handleRunModel, handleImageLoad, containerHeight,
  } = useImageNode({
    id,
    data: d,
    runCallback: 'onRunMyModel', // must match the key added to makeNodeData in step 8b
    defaultHeight: 192,
  })

  return (
    <div style={{ width: 320 }}>
      <NodeHeader title="My Model" locked={locked}
        menuOpen={menuOpen} onMenuToggle={() => setMenuOpen(!menuOpen)}
        onDuplicate={handleDuplicate} onLock={handleLock} onDelete={handleDelete}
        onCloseMenu={() => setMenuOpen(false)} />
      {/* Keep node body compact — settings go in sub-nav via nodeSettings.ts, not here */}
      <Handle type="target" position={Position.Left} id="prompt" />
      <Handle type="source" position={Position.Right} id="result" />
    </div>
  )
}

export default memo(MyModelNode)
```

### 7. Register in CanvasPage

**a. `nodeTypes`** — add the import and component:
```typescript
import MyModelNode from '../components/nodes/MyModelNode'

const nodeTypes = {
  // ...existing
  myModel: MyModelNode,
}
```

**b. `nodeCatalog`** — declare handles (drives the drop-to-connect menu and auto-wiring):
```typescript
{ type: 'myModel', label: 'My Model', targetHandles: ['prompt'], sourceHandles: ['result'] }
```

### 8. Wire the run callback

**a. `useRunCallbacks.ts`** — add `handleRunMyModel`:
```typescript
const handleRunMyModel = useCallback(async (nodeId: string): Promise<string | null> => {
  const currentNodes = nodesRef.current
  const currentEdges = edgesRef.current

  // Resolve connected inputs
  const promptEdge = currentEdges.find((e) => e.target === nodeId && e.targetHandle === 'prompt')
  const prompt = (currentNodes.find((n) => n.id === promptEdge?.source)?.data as Record<string, unknown>)?.prompt as string | undefined
  if (!prompt?.trim()) return 'No prompt connected.'

  try {
    const serverNodeId = nodeId.match(/^\d+$/) ? nodeId : undefined
    const nodeData = currentNodes.find((n) => n.id === nodeId)?.data as Record<string, unknown> | undefined
    const settings: Record<string, string> = {}
    // Map camelCase nodeData keys → snake_case settings expected by the controller
    if (nodeData?.guidanceScale !== undefined) settings.guidance_scale = String(nodeData.guidanceScale)
    if (nodeData?.enableSafetyChecker !== undefined) settings.enable_safety_checker = String(nodeData.enableSafetyChecker)

    const result = await api.generateMyModel(prompt, serverNodeId, settings)
    if (result.error) return result.error
    const imageUrl = result.node_image_id
      ? await api.fetchNodeImageBlob(result.node_image_id)
      : `data:${result.mime_type};base64,${result.image_data}`
    appendImageResult(nodeId, imageUrl, result, setNodes)
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'Generation failed'
  }
}, [nodesRef, edgesRef, setNodes])

// Add to return value:
return { ..., handleRunMyModel }
```

**b. `CanvasPage.tsx`** — destructure and add to `makeNodeData`:
```typescript
const { ..., handleRunMyModel } = useRunCallbacks({ nodesRef, edgesRef, setNodes })

const makeNodeData = useCallback((extra = {}) => ({
  // ...existing keys
  onRunMyModel: handleRunMyModel,  // key must match runCallback in useImageNode call
  ...extra,
}), [..., handleRunMyModel])
```

The `onRunMyModel` callback flows automatically into canvas load, drop menu, and toolbar add — no other changes needed.

### 9. Add settings config

`client/src/lib/nodeSettings.ts` — add an entry to the `nodeSettings` record:

```typescript
myModel: {
  label: 'My Model',
  defaults: { guidanceScale: 7.5, outputFormat: 'png', enableSafetyChecker: true },
  groups: [[
    { type: 'slider', key: 'guidanceScale', label: 'Guidance Scale', shortLabel: 'Guidance', min: 0, max: 20, step: 0.5 },
    { type: 'select', key: 'outputFormat', label: 'Output Format', shortLabel: 'Format', options: FORMAT_OPTIONS },
    { type: 'check', key: 'enableSafetyChecker', label: 'Safety Checker', shortLabel: 'Safety' },
  ]],
},
```

Available field types:
| Type | Shape | Notes |
|------|-------|-------|
| `select` | `key, label, options: [value, label][]` | Renders as dropdown |
| `slider` | `key, label, min, max, step` | Slider+number in sub-nav; number-only in attached |
| `check` | `key, label` | Toggle switch |
| `seed` | `key, randomKey, label, min, max` | Number input + random toggle pair |

Shared constants available: `IMAGE_SIZE_OPTIONS`, `FORMAT_OPTIONS`.
Groups within `groups: [[...], [...]]` are separated by a visual divider in the sub-nav.
`NodeSettingsPanel` reads this config and renders correctly for all layout modes (`subnav`, `attached`, `sidebar`, `narrow`) — no JSX changes needed in CanvasPage.

Nodes with no configurable settings need no entry here and will not show the sub-nav.

## Conventions

- Node settings belong in the sub-nav bar (bottom of screen) via `nodeSettings.ts`, not in the node body. Keep nodes compact.
- The `inline` settings mode (`settingsMode === 'inline'` / `debugSettings === true`) renders settings inside the node body directly using `NodeSettings.tsx` controls. This is a debug/power-user mode — not the primary flow.
- Handle colors: purple group = prompt/text inputs; green group = image/model outputs and inputs
- All fal.ai services use the queue API (submit → poll status → fetch result)
- Client-created entities use `temp_` prefixed IDs until the server assigns real IDs
- Boolean settings from HTTP params: always use `[true, "true"].include?(val)` — never `== "true"` — to handle both string and Ruby bool
- Node components always use `memo()` for render optimization
- Use `type` import for React/library types: `import { type ReactNode } from 'react'`
