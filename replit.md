# TuaVia

Portal brasileiro de comparação e análise técnica de bicicletas elétricas, com catálogo, guias e ferramentas de compra.

## Run & Operate

- `artifacts/tuavia` is the primary website and runs through the managed `artifacts/tuavia: web` workflow.
- `pnpm --filter @workspace/tuavia run dev` — run the Next.js site; the workflow supplies its port.
- `pnpm --filter @workspace/tuavia run build` — build the standalone Next.js server.
- `pnpm run typecheck` — typecheck the shared workspace libraries and services.
- `pnpm --filter @workspace/api-server run dev` — run the optional shared API service.

## Stack

- TuaVia: Next.js 15 App Router, React 19, TypeScript, Tailwind CSS.
- Workspace: pnpm, Node.js 24, TypeScript 5.9.
- Shared API service: Express 5; shared database libraries use PostgreSQL and Drizzle.

## Where things live

- TuaVia pages and API routes: `artifacts/tuavia/app/`.
- TuaVia local catalog and article data: `artifacts/tuavia/data/`.
- Replit runtime and preview configuration: `artifacts/tuavia/.replit-artifact/artifact.toml`.

## Architecture decisions

- The public site uses the bundled JSON data as a local fallback; Firebase Admin and AI credentials are needed only for features that use those services.
- The site runs as a Next.js server, not as a static Vite bundle. The artifact workflow supplies `PORT`.
- Store credentials in Replit Secrets, never in source files, ZIPs, or `.env` files checked into the project.

## Product

The public site compares electric bikes, presents buying guides and articles, and includes comparison and selection tools.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
