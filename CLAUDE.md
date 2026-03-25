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
- `CanvasPage.tsx` is the main orchestrator — holds all nodes/edges state, run callbacks, operation queue
- Node components are presentational — they receive callbacks via `data` props
- Shared hooks: `useNodeActions` (duplicate/lock/delete), `useImageNode` (image loading/history/run)
- Shared components: `NodeHeader`, `GridView`, `NavigationOverlay`
- `OperationQueue` batches delta operations (create/update/delete) and flushes to the server
- Images are fetched via authenticated blob URLs (never tokens in query strings)

### Backend

- **JWT auth** — 30-day tokens via Authorization header, no cookie/session fallback
- **FalService** base class — all AI model integrations (submit → poll → download pattern)
- **Delta operations** — `POST /projects/:id/canvas/operations` processes batched node/edge CRUD
- Rate limiting: 30 requests/hour on generation endpoints, 10/3min on login

### Node Types

| Type | Purpose | Handles |
|------|---------|---------|
| `textPrompt` | Text input | source: `prompt` |
| `imageGen` | Nano Banana 2 (fal.ai) | target: `prompt`, `negative_prompt` / source: `result` |
| `relight` | Relight 2.0 (fal.ai) | target: `prompt`, `negative_prompt` / source: `result` |
| `bgRemoval` | Background removal (fal.ai) | target: `input` / source: `result` |
| `trellis` | 3D model generation (fal.ai) | target: `input` |
| `export` | Download image | target: `input` |

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
POST   /api/generate/remove_bg
POST   /api/generate/trellis

GET    /api/node_images/:id                   (binary image data)
GET    /api/nodes/:node_id/images             (image history list)
```

### Adding a New fal.ai Model

1. Fetch the OpenAPI schema: `curl -H "Authorization: Key $FAL_KEY" https://fal.run/fal-ai/{model-id}/openapi.json`
2. Create `api/app/services/fal_{name}.rb` extending `FalService`
3. Add endpoint in `GenerateController`
4. Add route in `config/routes.rb`
5. Add API method in `client/src/lib/api.ts`
6. Create node component using `useImageNode` hook
7. Register in `nodeTypes` and `nodeCatalog` in `CanvasPage.tsx`
8. Add run callback in `CanvasPage.tsx`

## Conventions

- Node settings belong in the sub-nav bar (bottom of screen), not in the node body. Keep nodes compact.
- Handle colors: purple = prompt/text, green = image/result
- Nodes with no configurable settings don't show the sub-nav
- All fal.ai services use the queue API (submit → poll status → fetch result)
- Client-created entities use `temp_` prefixed IDs until the server assigns real IDs
