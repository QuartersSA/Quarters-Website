# Quarters Website — Architecture & Feature Reference

> **Purpose:** Deep reference for Claude Code sessions working on this repo.
> Read this before making non-trivial changes. Keep it accurate as the codebase evolves.
> **Read together with:** [CLAUDE.md](../CLAUDE.md) (deployment rules — non-negotiable)
> and [AGENTS.md](../AGENTS.md) (build/push contract).

---

## 1. Executive Summary

**Quarters Website** is a production SaaS for **multi-branch retail operations management** — likely a Saudi coffee/café chain (the codebase has strong Arabic-first UI, includes specialized green-coffee-bean order tracking, runs on `quarters.sa`).

It bundles **5 internal modules** under one app:

| Module | Path prefix | Audience | Purpose |
|--------|-------------|----------|---------|
| **Admin** | `/admin/*` | Managers | Branch & inventory management, low-stock alerts, KPIs |
| **Accounting** | `/accounting/*` | Accountants | Cash counts, expenses, payroll, shift-close, green-bean orders |
| **HR** | `/hr/*` | HR staff | Employee directory, bonuses, deductions |
| **Workspace** | `/workspace/*` | Teams | Task management (inbox, templates, threads, attachments) |
| **Inventory / Employee** | `/inventory/*`, `/employee/*` | Warehouse + line staff | Stock counts, daily inventory submissions |

Plus public pages: `/` (landing with role selector + AR/EN toggle), `/privacy-policy`, `/support`.

**The app is Arabic-first** (RTL by default in module layouts) with English fallback. Numbers/dates use `ar-SA-u-nu-latn` locale (Arabic phrasing, Latin numerals).

---

## 2. Tech Stack

### Runtime & Framework
- **React Router v7.6** — file-based routing via `@react-router/fs-routes`, full SSR (`ssr: true`)
- **Hono 4.x** — HTTP backbone, integrated via `react-router-hono-server`
- **React 18.2** — strictly v18 (deduped in vite alias)
- **Bun 1.3+** — package manager and script runner (project requires; `bun.lock` is the only lockfile)
- **Node 22 LTS** — production runtime for `build/server/index.js`
- **TypeScript 5.8** — strict mode, ES2022, bundler resolution

### Data & Auth
- **Neon Postgres** (`@neondatabase/serverless`) — pooled serverless connection
- **Auth.js** (`@auth/core` + `@hono/auth-js`) — JWT session strategy, custom Neon adapter
- **argon2** — password hashing (signup `hash`, signin `verify`)
- **Stripe** — proxied through `src/__create/stripe.ts` (Create.xyz integration, falls back to npm `stripe`)

### UI Layer
- **Tailwind CSS 3** + autoprefixer (PostCSS)
- **Chakra UI 2.8** + `@emotion/react`/`styled` — primitives via `src/client-integrations/chakra-ui.jsx`
- **@lshay/ui 0.1.32** — shadcn-style Radix component bundle (Dialog, Drawer, Sheet, Select, Tabs, etc.)
- **styled-jsx 5.x** — scoped CSS-in-JS via Babel plugin
- **Lucide React** — icons
- **Custom design tokens** in `src/components/Workspace/ui.js` (`ws.glass`, `ws.btnPrimary`, etc.) — dark glass aesthetic

### Client State & Forms
- **@tanstack/react-query 5.72** — primary server-state cache (50+ custom hooks in `src/hooks/`)
- **React local state** (`useState`) — UI/forms (no Redux/Zustand actually used despite being in deps)
- Validation is **inline + toast** (sonner). `react-hook-form` and `yup` are deps but currently unused.

### Specialty Libraries
| Lib | Used for |
|-----|----------|
| `@tanstack/react-table` | All data grids (Payroll, Employees, Items) |
| `recharts` | Dashboard charts (PieChart health gauge, BarChart, LineChart) |
| `@dnd-kit/core` + `sortable` | GreenBeanOrders reorderable order builder |
| `@vis.gl/react-google-maps` | Branch maps |
| `cmdk` | Command palette (via @lshay/ui) |
| `vaul` | Mobile drawer/sheet |
| `sonner` | Toast notifications (`toast.success`, `toast.error`) |
| `motion` | Animations (framer-motion successor) |
| `papaparse` | CSV import for bulk green-bean orders |
| `html-to-image` | Export tables to PNG (payroll exports, monthly summary) |
| `pdfjs-dist` | PDF rendering utilities |
| `three` | Currently unused — listed in deps but no observed usage |

---

## 3. Routing & Feature Map

### Convention
File-based routing — every `page.jsx` under `src/app/` becomes a URL.
- `src/app/page.jsx` → `/`
- `src/app/admin/employees/page.jsx` → `/admin/employees`
- `src/app/admin/items/[id]/page.jsx` → `/admin/items/:id`
- `src/app/...[...catchAll]/page.jsx` → `*` (catch-all)

**Layouts** — `layout.jsx` files wrap pages in their directory tree. Hierarchy:
- `src/app/layout.jsx` → root (React Query provider, fonts, error boundary)
- `src/app/admin/layout.jsx` → admin shell + auth gate
- `src/app/accounting/layout.jsx` → accounting shell (`dir="rtl"`)
- `src/app/hr/layout.jsx` → HR shell (`dir="rtl"`)
- `src/app/workspace/layout.jsx` → workspace shell + permission gate
- `src/app/__create/not-found.tsx` → 404 sitemap explorer

**Layout wrapping** is implemented by the custom `layoutWrapperPlugin` (`plugins/layouts.ts`), which walks the directory tree and composes nested layouts at build time.

### Route Inventory (page count: ~31 pages)

#### Public
- `/` — landing (role selector, AR/EN toggle, `localStorage.appLang`)
- `/privacy-policy`
- `/support`

#### Auth Entry Points (all public)
- `/admin/login` — admin/manager login (`role === "Admin"`)
- `/inventory/login` — warehouse staff
- `/employee/login` — line staff (for daily inventory checks)
- `/shift-close/login` — cashiers/managers for end-of-shift reconciliation

#### Admin Module
| Path | Page | Notes |
|------|------|-------|
| `/admin` | Dashboard | KPIs, branch performance, item history charts, variance |
| `/admin/employees` | Employee CRUD | Full table + modal, branch assignment, PDF/CSV export |
| `/admin/branches` | Branch list/CRUD | |
| `/admin/items` | Item catalog (SKUs) | Categories, pricing, reorder thresholds |
| `/admin/items-summary` | Item analytics | Stock levels, movement trends |
| `/admin/low-stock` | Reorder alerts | Filter by branch |
| `/admin/operations` | Active inventory ops | Counts, transfers |

#### Accounting Module (`can_manage_accounting`)
| Path | Page | Notes |
|------|------|-------|
| `/accounting` | Dashboard | Financial KPIs |
| `/accounting/cash-calculator` | Cash count tool | Per-register reconciliation, variance |
| `/accounting/expenses` | Expense log | Categories, dates, export |
| `/accounting/green-bean-calculator` | Cost calculator | Coffee bean import margin |
| `/accounting/green-bean-orders` | Supplier orders | CSV bulk import, deposit tracking, drag-drop reorder |
| `/accounting/payroll` | Monthly payroll | Bonuses + deductions integration |
| `/accounting/shift-close` | Submitted closures | Filter by branch/date |

#### HR Module (`can_access_hr` or legacy `can_manage_employees`)
| Path | Page | Notes |
|------|------|-------|
| `/hr` | HR dashboard | (sets `localStorage.adminMode = "hr"`) |
| `/hr/employees` | Employee directory | |
| `/hr/bonuses` | Performance bonuses | Per-employee or group, monthly |
| `/hr/deductions` | Salary deductions | Loans, insurance |

#### Workspace Module (`can_access_workspace`)
| Path | Page | Notes |
|------|------|-------|
| `/workspace` | Task overview | Status counts, overdue, quick actions |
| `/workspace/inbox` | Personal tasks | Assigned to current user |
| `/workspace/tasks` | All tasks | Advanced filters, bulk actions |
| `/workspace/team` | Team roster | |
| `/workspace/templates` | Recurring templates | "Monthly Inventory Count", "Payroll Cycle" |

#### Inventory / Employee
- `/inventory` — warehouse dashboard (auth gated)
- `/employee/inventory` — staff submission UI (posts to `/api/items/batch-inventory`)

### API Endpoints (~70+, all under `/api/*`)
Routes auto-discovered from `src/app/api/**/route.js` by `__create/route-builder.ts` using `import.meta.glob()`. Filesystem `[id]` becomes Hono `:id`; `[...catchAll]` becomes `*`. Each `route.js` exports any of `GET | POST | PUT | DELETE | PATCH`.

**Key endpoint groups:**
- `/api/employees/*` and `/api/employees/login` — primary auth + admin CRUD
- `/api/hr/employees|bonuses|deductions/*`
- `/api/items/*` (incl. `/summary`, `/low-stock`, `/batch-inventory`, `/[id]/analysis`, `/[id]/history`)
- `/api/branches`, `/api/item-categories`
- `/api/accounting/cash-counts|expenses|expense-types|payroll|shift-closings|green-beans|green-bean-orders|green-bean-order-items`
- `/api/inventory-operations`, `/api/inventory-transfers`, `/api/opening-sessions`
- `/api/workspace/tasks|spaces|templates|users|threads|summary|cron|overdue|reminders` (full task management API including subtasks, checklist, attachments, updates, history)
- `/api/uploads/*` — chunked uploads (init → chunk → complete → file), `MAX_UPLOAD_BYTES` configurable
- `/api/auth/*` — Auth.js handler (when `AUTH_SECRET` is set)
- `/api/uploadcare/config`, `/api/wasender/test` (WhatsApp), `/api/dashboard/analytics`, `/api/variance`, `/api/setup`

---

## 4. Server Architecture

### Entry Point: `__create/index.ts`

This file IS the server. Reading it is essential before changing anything server-side.

**Initialization order:**
1. **Neon Pool** — `new Pool({ connectionString: DATABASE_URL })` for the auth adapter.
2. **AsyncLocalStorage (ALS)** — stores `requestId` per request. Console methods are patched to prepend `[traceId:REQUEST_ID]` to all output. **Implication:** never replace global `console` in server code; the trace tag is invaluable for production debugging.
3. **Hono app** with middleware chain:
   - `requestId()` → generates UUID per request
   - ALS runner → binds requestId to async context
   - `contextStorage()` → SSR context propagation
4. **Global `app.onError`** — GET requests get HTML error page (via `getHTMLForErrorPage()`), others get JSON.
5. **CORS** — only if `CORS_ORIGINS` env is set.
6. **Body limit** — 4.5 MB cap (Vercel-style limit).
7. **Auth.js init** — only if `AUTH_SECRET` is set:
   - `basePath: "/api/auth"`, JWT strategy
   - Cookies: `secure: true, sameSite: "none"` (cross-site)
   - Credentials provider for both signin (argon2 verify) and signup (argon2 hash)
   - Callback maps `token.sub` → `session.user.id`
8. **Legacy guard** — `/_create/api/upload` returns 410 Gone with Arabic message.
9. **Integration proxy** — `/integrations/*` → `NEXT_PUBLIC_CREATE_BASE_URL` (default `https://www.create.xyz`); forwards trace headers; supports streaming (`duplex: "half"`).
10. **Auth handler** — `/api/auth/*` → `authHandler()` (only for valid auth actions per `is-auth-action.ts`).
11. **API mount** — `/api/*` → dynamic router from `route-builder.ts`.
12. **Production listen** — `createHonoServer()` listens on `process.env.PORT` (default 3000 prod).

### `__create/` Scaffolding (server-side glue)

| File | Role |
|------|------|
| `index.ts` | Server entry (above) |
| `adapter.ts` | Auth.js Neon adapter — implements `Adapter` interface (users/accounts/sessions/verification-tokens) on Postgres |
| `is-auth-action.ts` | Whitelist for `/api/auth/*` paths: `providers, session, csrf, signin, signout, callback, verify-request, error, webauthn-options` |
| `route-builder.ts` | Dynamic API router — `import.meta.glob()` discovery + path conversion |
| `get-html-for-error-page.ts` | Sandboxed-iframe-aware HTML error renderer (posts to parent, listens for `sandbox:navigation`) |

### `src/__create/` (client-side shims)

| File | Role |
|------|------|
| `stripe.ts` | Stripe proxy — wraps `npm:stripe`; if `CREATE_TEMP_API_KEY` + `NEXT_PUBLIC_PROJECT_GROUP_ID` + `NEXT_PUBLIC_CREATE_API_BASE_URL` set → routes through Create.xyz; otherwise raw stripe. Aliased via `vite.config.ts: "stripe" → src/__create/stripe`. |
| `fetch.ts` | Fetch interceptor — adds `x-createxyz-project-group-id`, posts errors to parent, prefixes relative URLs server-side |
| `@auth/create.js` | Shim mapping `@auth/create/react` → `@hono/auth-js/react` |
| `PolymorphicComponent.tsx` | `<Button as="a">`-style component wrapper |
| `useDevServerHeartbeat.ts` | Dev-only HMR health poll |
| `dev-error-overlay.js` | Client error overlay |

### Request Lifecycle (one round-trip)

1. **Hono receives request** → `requestId` middleware stamps trace ID → ALS context binds it.
2. **Middleware chain** runs: CORS → body-limit → Auth session lookup (if enabled).
3. **Route match:**
   - `/api/auth/*` → Auth.js handler
   - `/api/*` → `route-builder.ts` (dynamic glob-based)
   - everything else → React Router SSR handler (loaders → component → HTML)
4. **Errors** → `app.onError` (HTML for GET, JSON otherwise).
5. **All console output** during the request carries `[traceId:...]` prefix automatically.

---

## 5. Auth System

**Two parallel systems coexist:**

### A. Auth.js (`@auth/core` + `@hono/auth-js`)
- Mounted at `/api/auth/*` when `AUTH_SECRET` is set.
- JWT session strategy.
- Credentials provider with argon2 password verification.
- Custom Neon adapter (`__create/adapter.ts`) maps to:
  - `auth_users` (id, name, email, emailVerified, image)
  - `auth_accounts` (userId, provider, password for credentials)
  - `auth_sessions` (userId, sessionToken, expires)
  - `auth_verification_token`

### B. Custom Employee Login (the real production flow for this app)
- `POST /api/employees/login` — username + password.
- Server SQL-fetches the row from `employees` table, verifies password with `argon2.verify`.
- Returns `{ employee, token }`. Token is a signed JWT.
- The client stores everything in `localStorage`:

| Key | Contents |
|-----|----------|
| `adminAuth` | boolean — admin is logged in |
| `adminUser` | full user object with all `can_*` flags |
| `adminMode` | `"inventory" \| "workspace" \| "accounting" \| "hr"` |
| `workspaceUser` | copy of adminUser used in workspace context |
| `appLang` | `"ar" \| "en"` |
| `adminToken`, `employeeInventoryToken`, `shiftCloseToken` | bearer tokens by role |

- Client-side fetch helpers (`adminFetch`, `employeeInventoryFetch`, `shiftCloseFetch`) inject the bearer token.

### Permission Flags (boolean columns on `employees`)
- `can_access_workspace` — `/workspace/*`
- `can_manage_inventory` — admin item/branch ops
- `can_manage_accounting` — `/accounting/*`
- `can_access_hr` (legacy: `can_manage_employees`) — `/hr/*`
- `can_manage_deductions` — deduction edit power
- `can_do_inventory` — daily inventory submission
- `can_close_shift` — shift-close module

Layout components read these from `localStorage.adminUser` and redirect on missing permission. **Server endpoints SHOULD also enforce** — verify on every API change.

---

## 6. Data Layer

### Driver
`@neondatabase/serverless` — both pooled (`Pool`) for the Auth.js adapter and template-tagged (`neon()` via `src/app/api/utils/sql.js`) for app routes.

### Query Pattern
**No ORM.** Raw parameterized SQL via tagged templates:

```js
import sql from "@/app/api/utils/sql";
const rows = await sql`
  SELECT * FROM accounting_cash_counts
  WHERE branch_id = ${branchId} AND count_month = ${month}
`;
```

### Schema (entities identified, not exhaustive)
- **Auth:** `auth_users`, `auth_accounts`, `auth_sessions`, `auth_verification_token`
- **Identity:** `employees`, `branches`, `employee_branches` (M:M)
- **Inventory:** `items`, `item_categories`, `inventory_operations`, `inventory_transfers`, `opening_sessions`, `purchase_receipts`
- **Finance:** `accounting_cash_counts` + `..._logs`, `accounting_expenses`, `accounting_expense_types`, `payroll`, `shift_closings`
- **Green beans (specialty):** `green_beans`, `green_bean_orders`, `green_bean_order_items`
- **HR:** `bonuses`, `deductions`
- **Workspace:** `tasks`, `task_subtasks`, `task_checklist`, `task_attachments`, `task_updates`, `task_history`, `templates`, `spaces`, `threads`, `thread_messages`

> No migration files in repo. Schema is implicit from API routes — verify by reading the SQL in `src/app/api/.../route.js` when modifying any table.

---

## 7. Stripe

`src/__create/stripe.ts` proxies through Create.xyz when env is configured, otherwise uses raw `npm:stripe`. Operations supported: checkout sessions, products, prices, customers, payment intents, payment methods, subscriptions, invoices, charges, refunds, webhook endpoint creation.

**Status in the app:** **No active Stripe webhook routes** in `src/app/api/`. The infrastructure exists but no payment flow currently uses it. If you implement payments, plan webhooks under `/api/payments/*` or `/api/stripe/webhook`.

---

## 8. UI / Styling

### Layered stack — why so many libraries
- **Tailwind** for utility classes (the bulk of styling)
- **Chakra** for reliable accessibility primitives (re-exported in `src/client-integrations/chakra-ui.jsx`)
- **@lshay/ui** for shadcn/Radix-style composed components (Dialog, Drawer, Select, Tabs, Table, Sheet, etc.) (re-exported in `src/client-integrations/shadcn-ui.jsx`)
- **styled-jsx** for scoped per-component CSS (via Babel)
- **emotion** as the engine under Chakra
- **Workspace tokens** (`src/components/Workspace/ui.js`) — the cohesive design system: dark-glass aesthetic with `backdrop-blur-xl`, `bg-[#132044]/50`, `border-white/10`, emerald primary (`#10b981`), amber warnings, red dangers; gradient bg `from-[#0d1426] via-[#101c38] to-[#090f1f]`. Keys: `ws.glass`, `ws.glassSoft`, `ws.btnPrimary`, `ws.btnNeutral`, `ws.btnDanger`, `ws.title`, `ws.muted`.

### Theming
- **Dark mode only** — no light theme.
- **Arabic-first** — module layouts set `dir="rtl"` (admin layout less explicit).
- Localized formatting: `toLocaleString("ar-SA-u-nu-latn", ...)`.

### Components Tree (`src/components/`)
Top-level folders mirror domain areas:
```
Accounting/         (PayrollTable, ExpenseForm, PayrollExportMenu, ...)
Admin/              (Sidebar)
Dashboard/          (HealthScoreCard, ItemAnalysisChart, VarianceChart, MonthlySummaryExport, ...)
Employees/          (EmployeeTable, EmployeeModal/, EmployeeStatistics)
GreenBeanCalculator/  GreenBeanOrders/  HR/  Inventory/  Items/  ItemsSummary/
Operations/         (TransferModal, OperationDetailsModal/, EditOperationModal)
Tasks/              (TaskModal/, TaskChecklistSection)
Workspace/          (ui.js — design tokens; layout components)
AppSectionSwitcher.jsx
```

### Hooks (`src/hooks/`) — 50+ files
Per-domain React Query wrappers, e.g.:
- `useEmployeesData`, `useEmployeeMutations`, `useEmployeeForm`
- `usePayrollData`, `usePayrollMutations`
- `useDashboardAnalytics` (refetches every 5 minutes)
- `useTasksData`, `useTaskMutations`
- Token-bearing fetch helpers (one per role)

### Fonts & Icons
- Fonts dynamically generated by `loadFontsFromTailwindSource` plugin scanning Tailwind classes against ~1500 Google Fonts. Arabic-friendly (Almarai, Amiri, Alef). HMR-aware via `update-font-links` event in dev.
- Icons: `lucide-react` everywhere.

---

## 9. Custom Vite Plugins (`plugins/`)

| Plugin | Phase | Purpose |
|--------|-------|---------|
| `nextPublicProcessEnv` | post (client) | Injects a Proxy so `process.env.X` only resolves `NEXT_PUBLIC_*` in browser; everything else returns `undefined`. Server untouched. |
| `restartEnvFileChange` | dev | Watches `.env*` via `fs.watch`; exits process on change so the supervisor restarts. |
| `aliases` | pre | `@/foo` → `src/foo` resolution with extension fallback (`.ts`, `.js`, `.tsx`, `.jsx`). |
| `addRenderIds` | pre | Wraps JSX intrinsics with `CreatePolymorphicComponent` carrying unique `renderId` for hydration introspection. |
| `consoleToParent` | dev | Forwards `console.*` to parent window via `postMessage` (sandboxed-iframe debugging). |
| `loadFontsFromTailwindSource` | pre + post | Scans tailwind classes for `font-*`, generates Google Fonts `<link>` tags via virtual module `virtual:load-fonts.jsx`. |
| `restart` | dev (serve) | Watches `src/**/page.tsx`, `src/**/layout.tsx`, `src/**/route.js`; full server restart on change (500ms debounce). |
| `layoutWrapperPlugin` | pre | Wraps each `page.jsx` in a chain of nested `layout.jsx` files matched up the directory tree; injects route params. |

Plus standard plugins: `reactRouterHonoServer`, `babel` (styled-jsx), `reactRouter`, `tsconfigPaths`.

### Vite alias map (`resolve.alias`)
```
stripe              → src/__create/stripe
@auth/create        → src/__create/@auth/create
@auth/create/react  → @hono/auth-js/react
npm:stripe          → stripe (real package)
@                   → src
lodash              → lodash-es
```

---

## 10. Build & Deployment

### Build
- `bun run build` → `react-router build` → emits to `build/`:
  - `build/client/assets/` — chunked JS/CSS/fonts/images
  - `build/server/index.js` — single Node-runnable SSR server
- `target: esnext`, no rollup external (everything bundled into server).
- Dev pre-bundling: includes `fast-glob`, `lucide-react`; excludes `@hono/auth-js`, `@auth/core`, `lightningcss`, `fsevents`.

### Deploy: Railway → `quarters.sa`
**Critical contract** (per [CLAUDE.md](../CLAUDE.md) and [AGENTS.md](../AGENTS.md)):

1. **Always rebuild before push** when source changes (`src/`, `__create/`, configs, `package.json`):
   ```
   bun run build
   git add <source files> build/
   git commit -m "..."
   git push
   ```
2. **`build/` MUST be committed** — Railway serves it directly, does not rebuild.
3. **Never put `build/` in `.gitignore`**.
4. **Doc/config-only changes** (.md, .gitignore) don't need rebuild.

**Start command (production):** `node ./build/server/index.js` (or via package.json `start` script).
**Env:** `.env` is gitignored; Railway reads from project env vars (DATABASE_URL, AUTH_SECRET, etc.).
**No `railway.json`/`nixpacks.toml`/`Procfile`** — Railway auto-detects Node.

---

## 11. Environment Variables

Required for full functionality:

| Var | Where used | Notes |
|-----|-----------|-------|
| `DATABASE_URL` | `__create/index.ts`, all API routes | Neon Postgres connection string |
| `AUTH_SECRET` | `__create/index.ts` | Auth.js JWT signing key. **If missing, Auth.js mounting is skipped** — but the custom `/api/employees/login` flow still works |
| `AUTH_URL` | Auth.js default | Public base URL (e.g., `https://quarters.sa`) |
| `PORT` | `vite.config.ts`, `__create/index.ts` | Default 4000 dev / 3000 prod |
| `CORS_ORIGINS` | `__create/index.ts` | Comma-separated allowlist (optional) |
| `NEXT_PUBLIC_CREATE_BASE_URL` | `__create/index.ts`, `src/__create/fetch.ts` | Default `https://www.create.xyz` |
| `NEXT_PUBLIC_CREATE_API_BASE_URL` | `src/__create/stripe.ts`, `src/__create/fetch.ts` | Create API proxy endpoint |
| `NEXT_PUBLIC_CREATE_HOST` | `__create/index.ts` | Forwarded `Host` for proxy |
| `NEXT_PUBLIC_PROJECT_GROUP_ID` | proxy + Stripe shim | Tenant ID for Create.xyz |
| `CREATE_TEMP_API_KEY` | `src/__create/stripe.ts` | If set + above present → use Create Stripe proxy |
| `NODE_ENV` | many | `development` or `production` |

**Browser exposure rule:** `nextPublicProcessEnv` plugin makes only `NEXT_PUBLIC_*` vars readable in client code; every other `process.env.X` returns `undefined` in the browser. Don't expect non-public secrets to leak through bundle accidentally.

---

## 12. Tooling & Tests

### TypeScript
- `tsconfig.json` strict. `@/*` → `src/*`. Includes `.react-router/types/` (generated by `react-router typegen`).
- Typecheck: `bun run typecheck` runs `react-router typegen && tsc --noEmit`.

### PostCSS
`postcss.config.js`: tailwindcss + autoprefixer.

### Babel
Selective via `vite-plugin-babel` — `src/**/*.{js,jsx,ts,tsx}` only, plugin `styled-jsx/babel`. `babelrc: false`, `configFile: false` (no merging with other configs).

### Testing
- **Vitest** + jsdom (`vitest.config.ts`).
- Globals enabled. Setup file: `test/setupTests.ts` (imports `@testing-library/jest-dom`).
- **Currently no actual test files exist** — only the setup. If you add tests, place beside source as `*.test.ts(x)` or under `test/`.

### CI
- **No `.github/workflows/`** — no automated CI/CD. Type checks and builds are run manually before push.

### Scripts
| Script | Command |
|--------|---------|
| `bun run dev` | `react-router dev` (HMR; PORT or 4000) |
| `bun run build` | `react-router build` (writes `build/`) |
| `bun run start` | `node ./build/server/index.js` (run prod build locally) |
| `bun run typecheck` | `react-router typegen && tsc --noEmit` |

---

## 13. Project Quirks & Gotchas

1. **Two auth flows coexist.** `/api/auth/*` (Auth.js) is mounted but production traffic uses `/api/employees/login` (custom). When debugging auth, check **which** flow the page is using.
2. **All authentication state lives in `localStorage`** — no httpOnly cookies for the custom flow. This means XSS = full account takeover. Be cautious when adding any client-injected HTML.
3. **No ORM, no migrations, no seed scripts.** Database schema is whatever production currently has. Discover schema by reading the SQL in `src/app/api/**/route.js`.
4. **`build/` is checked into git.** Railway serves it directly. Forget to rebuild = silent prod regression where GitHub shows new code but live site runs old code.
5. **Heavy deps that are unused or barely used:** `three`, `react-hook-form`, `yup`, `zustand` are in `package.json` but no actual usage in source. Don't add features assuming they're set up.
6. **`.env` is gitignored, but a local `.env` file already exists** in this repo (probably a one-time provisioned dev copy). Treat its contents as secrets — never paste, never commit.
7. **Console logs always carry `[traceId:...]`** in server logs. Use the trace ID to follow a single request across files when debugging production.
8. **Plugins must run in a specific order** — see `vite.config.ts` plugin array. Re-ordering may break (e.g., `nextPublicProcessEnv` post-injects after server-side env replacement).
9. **`react-router-hono-server` runtime** is `node` (set in vite.config). Don't switch to `bun` runtime without testing — Bun may not load argon2 on Linux x64 the same way.
10. **Windows on ARM64 dev machines** need x64 Node for the production server (argon2 has no ARM64 Windows prebuilt). Dev server runs fine on ARM64 because rollup/esbuild/lightningcss DO have ARM64 binaries. See `.claude/launch.json` for the working setup.

---

## 14. Where to look first when…

| Task | Start in |
|------|----------|
| Adding a new page | `src/app/<area>/<path>/page.jsx` (+ `route.js` if it has API) |
| Adding an API endpoint | `src/app/api/<path>/route.js` — export `GET/POST/...` |
| Changing auth gates | `src/app/<area>/layout.jsx` + the `can_*` check |
| Schema change | Find existing SQL in API routes; update those + any consuming hooks |
| New env var | Add to `__create/index.ts` (server) + prefix `NEXT_PUBLIC_` if browser needs it |
| New chart | `src/components/Dashboard/` + recharts; data hook in `src/hooks/` |
| New table | `@tanstack/react-table` + a hook returning `useQuery` data |
| New modal | Pattern: `src/components/<Area>/<Thing>Modal/` + sonner toasts |
| Fix a hydration warning | Often `addRenderIds` plugin or a missing `dir`/`lang` mismatch |
| Build failures on Railway | Reread [CLAUDE.md](../CLAUDE.md) — almost always a missing rebuild or `build/` in `.gitignore` |
