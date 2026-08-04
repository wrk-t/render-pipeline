# @wrk-t/render-pipeline

Metadata-driven client-side rendering pipeline for React/Next.js.

Built on top of the backend metadata system (`@wrk-t/nestjs-metadata`), this
package turns `GET /api/v1/components/:id?include=render` responses into UI:

- **Pipeline** — fetch → permission gate → param resolution → registry dispatch
- **Renderers** — 30 blueprint renderers (form, table, section, page, charts, …)
- **Screen routing** — `modules → screens → screen_widgets` URL resolution
- **Engines** — dynamic forms (15 field components + Yup validation) and tables
- **Shared UI** — `BaseDialog`, `Unicon`, `EmptyChart`, date-range picker

## Install

```bash
pnpm add @wrk-t/render-pipeline
```

## Configure (required)

The pipeline delegates two app-owned pieces to the host app:

```ts
import { configureRenderPipeline } from "@wrk-t/render-pipeline";

configureRenderPipeline({
  client,                       // your axios instance (auth wiring)
  useGetUser: useGetMyUserQuery, // hook returning { data: currentUser }
  getUserSnapshot: () => ... ,   // sync user snapshot (screen resolution)
});
```

Call it once at app startup, before any renderer mounts (e.g. in your client
wrapper). Register app-specific renderers the same way:

```ts
import { registerRenderer } from "@wrk-t/render-pipeline";

registerRenderer("swagger-editor", ({ pathParams }) => <MyEditor pathParams={pathParams ?? {}} />);
```

## Usage

```tsx
import { AutoComponent } from "@wrk-t/render-pipeline";

// Fetches + renders any component by its metadata CUID
<AutoComponent componentId="ux31jioy55b05kf0vq99bvvw" />
```

## Development

```bash
pnpm build          # compile src/ → dist/
pnpm dev            # watch mode
pnpm check          # biome check --write
pnpm hooks:install  # install pre-commit hooks
```
