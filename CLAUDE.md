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
| `trellis` | 3D model generation (fal.ai) | `input` | `result` (GLB), `image_result` (viewport PNG) |
| `meshyV6` | Meshy v6 image-to-3D (fal.ai) | `input`, `texture` | `result` (GLB), `image_result` (viewport PNG) |
| `scene3d` | Compose images + 3D models into a 3D scene | `layers` (multi) | `image_result` (viewport PNG) |
| `preview` | Preview asset as it will appear when exported | `input` | — |
| `export` | Download image or 3D file | `input` | — |

Handle color groups: `prompt` / `negative_prompt` = purple; `input` / `result` / `image_result` / `layers` / `texture` = green.

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
POST   /api/generate/meshy_v6

GET    /api/node_images/:id                   (binary image data)
GET    /api/nodes/:node_id/images             (image history list)
```

## Adding a New fal.ai Node

Follow all steps in order. Steps 1–5 are backend; steps 6–9 are frontend.

### Schema-first policy

**Always fetch the full OpenAPI schema before implementing.** Do not guess at parameters — incomplete settings have been a source of bugs. Proactively expose every parameter the model supports. If a parameter requires a UI feature that doesn't yet exist (e.g. a new field type, a file upload, a secondary image handle), implement the infrastructure first and flag it, rather than silently omitting the setting.

```bash
curl -H "Authorization: Key $FAL_KEY" https://fal.run/fal-ai/{model-id}/openapi.json | jq '.components.schemas'
```

Check for:
- All scalar inputs (strings, numbers, booleans) → map to `select`, `slider`, `check`, `text` settings fields
- Optional image inputs beyond the primary source image → add as additional target handles (green group) and resolve in the run callback
- Any new field types required → add to `SettingsControls.tsx`, `nodeSettings.ts` types, and `NodeSettingsPanel.tsx` before wiring the node

### 1. Create the Rails service

`api/app/services/fal_{name}.rb` — extend `FalService`:

```ruby
class FalMyModel < FalService
  ENDPOINT = "https://queue.fal.run/fal-ai/my-model"

  def initialize(image_url:, settings: {})
    @image_url = image_url
    @settings = settings
  end

  def call
    input = { image_url: @image_url }
    # Map every API parameter — do not omit any
    input[:guidance_scale] = @settings["guidance_scale"].to_f if @settings["guidance_scale"].present?
    # Booleans: always use this pattern to handle both Ruby bool and string from HTTP params
    input[:enable_safety_checker] = [true, "true"].include?(@settings["enable_safety_checker"]) unless @settings["enable_safety_checker"].nil?
    # Optional secondary image (e.g. texture, style reference) resolved server-side
    input[:texture_image_url] = @settings["texture_image_url"] if @settings["texture_image_url"].present?

    output = submit_and_poll(ENDPOINT, input)
    parse_output(output)
  end

  private

  def parse_output(output)
    # Adapt to the model's actual response shape
    url = output.dig("images", 0, "url") || output["image_url"]
    raise ApiError, "No output in response" unless url
    result = download_file(url)
    { image_data: Base64.strict_encode64(result.body), mime_type: "image/png" }
  end
end
```

### 2. Add the controller endpoint

`api/app/controllers/generate_controller.rb`:

- Add the action name to the `rate_limit` list at the top
- Resolve the primary source image via `load_source_image` (already scoped to current user)
- For any **optional secondary image** connected from the canvas (e.g. texture, style), resolve it the same way — always scope to `Current.session.user_id`:

```ruby
def my_model
  source_image = load_source_image
  data_uri = "data:#{source_image.mime_type};base64,#{source_image.image_data}"

  # Permit every parameter the model supports
  settings = params.permit(:guidance_scale, :output_format, :enable_safety_checker, :my_text_param).to_h

  # Resolve optional secondary image handle (secure: scoped to current user)
  if params[:secondary_image_id].present?
    secondary = NodeImage.joins(node: { project: :user })
      .where(projects: { user_id: Current.session.user_id })
      .find_by(id: params[:secondary_image_id])
    settings["secondary_image_url"] = "data:#{secondary.mime_type};base64,#{secondary.image_data}" if secondary
  end

  result = FalMyModel.new(image_url: data_uri, settings: settings).call
  node_image = save_result_to_node(result, prompt: "my model generation")

  render json: { image_data: result[:image_data], mime_type: result[:mime_type], node_image_id: node_image&.id }
rescue FalService::ApiError => e
  Rails.logger.warn("fal.ai API error in MyModel: #{e.message}")
  render json: { error: e.message }, status: :bad_gateway
rescue => e
  Rails.logger.error("MyModel failed: #{e.class} - #{e.message}\n#{e.backtrace&.first(10)&.join("\n")}")
  render json: { error: "Generation failed" }, status: :internal_server_error
end
```

### 3. Add the route

`api/config/routes.rb`:

```ruby
post 'generate/my_model'
```

### 4. Add the API client method

`client/src/lib/api.ts`:

```typescript
generateMyModel: (sourceImageId: number, nodeId?: string, settings?: Record<string, string>, secondaryImageId?: number) =>
  request('/generate/my_model', { method: 'POST', body: JSON.stringify({ source_image_id: sourceImageId, node_id: nodeId, secondary_image_id: secondaryImageId, ...settings }) }),
```

### 5. Create the node component

`client/src/components/nodes/MyModelNode.tsx` — use `useImageNode` for image-output nodes:

```typescript
import { memo } from 'react'
import { Handle, Position, useNodeConnections, type NodeProps } from '@xyflow/react'
import NodeHeader from './NodeHeader'
import { GridView, NavigationOverlay } from './ImageHistory'
import { useNodeActions } from '../../hooks/useNodeActions'
import { useImageNode } from '../../hooks/useImageNode'

function MyModelNode({ id, data }: NodeProps) {
  const inputConnections = useNodeConnections({ handleType: 'target', handleId: 'input' })
  const secondaryConnections = useNodeConnections({ handleType: 'target', handleId: 'secondary' })
  const locked = !!data.locked
  const d = data as Record<string, unknown>
  const { menuOpen, setMenuOpen, handleDuplicate, handleLock, handleDelete } = useNodeActions(id, locked)
  const {
    loading, error, imageLoaded, gridView, setGridView,
    history, imageIndex, imageUrl, navigateImage,
    handleRunModel, handleImageLoad, containerHeight,
  } = useImageNode({ id, data: d, runCallback: 'onRunMyModel', defaultHeight: 192 })

  return (
    <div style={{ width: 320 }} className="bg-[#1a1a1a] border border-[#27272A] rounded-xl shadow-xl">
      <NodeHeader title="My Model" locked={locked}
        menuOpen={menuOpen} onMenuToggle={() => setMenuOpen(!menuOpen)}
        onDuplicate={handleDuplicate} onLock={handleLock} onDelete={handleDelete}
        onCloseMenu={() => setMenuOpen(false)} />
      {/* Node body — keep compact; settings go in sub-nav via nodeSettings.ts */}

      {/* Multiple left handles: space them explicitly with style={{ top: '...' }} */}
      <Handle type="target" position={Position.Left} id="input" style={{ top: '35%' }}
        className={`!w-[7px] !h-[7px] !bg-[#00FFC5] !border-0 !-left-[9px] handle-green ${inputConnections.length > 0 ? 'connected' : ''}`} />
      <Handle type="target" position={Position.Left} id="secondary" style={{ top: '65%' }}
        className={`!w-[7px] !h-[7px] !bg-[#00FFC5] !border-0 !-left-[9px] handle-green ${secondaryConnections.length > 0 ? 'connected' : ''}`} />
      <Handle type="source" position={Position.Right} id="result"
        className="!w-[7px] !h-[7px] !bg-[#00FFC5] !border-0 !-right-[9px] handle-green" />
    </div>
  )
}

export default memo(MyModelNode)
```

### 6. Register in CanvasPage

**a. `nodeTypes`** — import and register:
```typescript
import MyModelNode from '../components/nodes/MyModelNode'
const nodeTypes = { /* ...existing */ myModel: MyModelNode }
```

**b. `handleColors` / `handleColorGroup`** — add any new handle IDs (secondary image handles are green group):
```typescript
const handleColors = { /* ...existing */ secondary: '#00FFC5' }
const handleColorGroup = { /* ...existing */ secondary: 'green' }
```

**c. `nodeCatalog`** — declare all handles:
```typescript
{ type: 'myModel', label: 'My Model', targetHandles: ['input', 'secondary'], sourceHandles: ['result'] }
```

### 7. Wire the run callback

**a. `useRunCallbacks.ts`** — add `handleRunMyModel`:
```typescript
const handleRunMyModel = useCallback(async (nodeId: string): Promise<string | null> => {
  const currentNodes = nodesRef.current
  const currentEdges = edgesRef.current

  // Resolve primary image input
  const inputEdge = currentEdges.find((e) => e.target === nodeId && e.targetHandle === 'input')
  const sourceImageId = (currentNodes.find((n) => n.id === inputEdge?.source)?.data as Record<string, unknown>)?.activeImageId as number | undefined
  if (!sourceImageId) return 'No image connected.'

  // Resolve optional secondary image handle
  const secondaryEdge = currentEdges.find((e) => e.target === nodeId && e.targetHandle === 'secondary')
  const secondaryImageId = (currentNodes.find((n) => n.id === secondaryEdge?.source)?.data as Record<string, unknown>)?.activeImageId as number | undefined

  try {
    const serverNodeId = nodeId.match(/^\d+$/) ? nodeId : undefined
    const nodeData = currentNodes.find((n) => n.id === nodeId)?.data as Record<string, unknown> | undefined
    const settings: Record<string, string> = {}
    // Map every camelCase nodeData key → snake_case expected by the controller
    if (nodeData?.guidanceScale !== undefined) settings.guidance_scale = String(nodeData.guidanceScale)
    if (nodeData?.enableSafetyChecker !== undefined) settings.enable_safety_checker = String(nodeData.enableSafetyChecker)
    if (nodeData?.myTextParam) settings.my_text_param = nodeData.myTextParam as string

    const result = await api.generateMyModel(sourceImageId, serverNodeId, settings, secondaryImageId)
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

return { /* ...existing */ handleRunMyModel }
```

**b. `CanvasPage.tsx`** — destructure and add to `makeNodeData`:
```typescript
const { /* ...existing */ handleRunMyModel } = useRunCallbacks({ nodesRef, edgesRef, setNodes })

const makeNodeData = useCallback((extra = {}) => ({
  // ...existing keys
  onRunMyModel: handleRunMyModel,
  ...extra,
}), [/* ...existing */, handleRunMyModel])
```

Also add the node type to `showSubNav` and `handleRunSelected` if it has settings.

### 8. Add to canvas load hydration

`client/src/hooks/useCanvasLoad.ts`:

- Add the node type to `IMAGE_NODE_TYPES` so history is hydrated on project load
- If it outputs a GLB (3D model), add it to the `is3dNode` check so history is filtered for `model/gltf-binary` MIME type and `modelFile` is set instead of `imageUrl`
- Add it to the skip-`activeImageId` condition for 3D nodes

### 9. Add settings config

`client/src/lib/nodeSettings.ts` — expose **every** parameter from the schema:

```typescript
myModel: {
  label: 'My Model',
  defaults: { guidanceScale: 7.5, outputFormat: 'png', enableSafetyChecker: true, myTextParam: '' },
  groups: [
    [
      { type: 'slider', key: 'guidanceScale', label: 'Guidance Scale', shortLabel: 'Guidance', min: 0, max: 20, step: 0.5 },
      { type: 'select', key: 'outputFormat', label: 'Output Format', shortLabel: 'Format', options: FORMAT_OPTIONS },
    ],
    [
      { type: 'check', key: 'enableSafetyChecker', label: 'Safety Checker', shortLabel: 'Safety' },
      { type: 'text', key: 'myTextParam', label: 'Text Param', placeholder: 'Optional...' },
    ],
  ],
},
```

Available field types:
| Type | Shape | Notes |
|------|-------|-------|
| `select` | `key, label, options: [value, label][]` | Renders as dropdown |
| `slider` | `key, label, min, max, step` | Slider+number in sub-nav; number-only in attached |
| `check` | `key, label` | Toggle switch |
| `seed` | `key, randomKey, label, min, max` | Number input + random toggle pair |
| `text` | `key, label, placeholder?` | Single-line text input (e.g. prompts, URLs) |

Shared constants available: `IMAGE_SIZE_OPTIONS`, `FORMAT_OPTIONS`.
Groups within `groups: [[...], [...]]` are separated by a visual divider in the sub-nav.
`NodeSettingsPanel` renders correctly for all layout modes (`subnav`, `attached`, `sidebar`, `narrow`) — no JSX changes needed in CanvasPage.

**If a model parameter requires a field type not listed above**, implement the new type in `SettingsControls.tsx`, add it to the `FieldDef` union in `nodeSettings.ts`, and handle it in both `CompactField` and `SidebarField` in `NodeSettingsPanel.tsx` before wiring the node. Do not silently omit parameters.

## Conventions

- Node settings belong in the sub-nav bar (bottom of screen) via `nodeSettings.ts`, not in the node body. Keep nodes compact.
- The `inline` settings mode (`settingsMode === 'inline'` / `debugSettings === true`) renders settings inside the node body directly using `NodeSettings.tsx` controls. This is a debug/power-user mode — not the primary flow.
- Handle colors: purple group = prompt/text inputs; green group = image/model outputs and inputs
- All fal.ai services use the queue API (submit → poll status → fetch result)
- Client-created entities use `temp_` prefixed IDs until the server assigns real IDs
- Boolean settings from HTTP params: always use `[true, "true"].include?(val)` — never `== "true"` — to handle both string and Ruby bool
- Node components always use `memo()` for render optimization
- Use `type` import for React/library types: `import { type ReactNode } from 'react'`
