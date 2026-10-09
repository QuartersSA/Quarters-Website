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
| `/accounting/green-bean-calculator` | Cost calculator | Pricing what-ifs only (`accounting_green_beans` rows; does not touch `items`) |
| `/accounting/green-bean-orders` | **Archive (read-only)** | Legacy supplier orders; all write routes return 410. Coffee purchasing now lives in purchase invoices (see §Coffee costing) |
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
- `/api/accounting/cash-counts|expenses|expense-types|payroll|shift-closings|green-beans` (calculator) — `green-bean-orders*` / `green-bean-order-items` are read-only archive (writes → 410 via `utils/legacyGreenBean.js`)
- `/api/accounting/purchase-invoices` (+ `/arrival`), `purchase-invoice-payments` (+ `/bulk`), `purchase-invoice-batches`, `recurring-purchase-invoices`, `accounts`, `contacts`, `beneficiaries`, `bank-accounts`, `purchase-audit-log`, `vat-reports`
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
- `can_manage_purchases` — Admin only: `/accounting/purchases*` without the rest of accounting (plus read-only list of branch projects for the invoice modal)
- `can_manage_branch_projects` — Admin only: `/accounting/branch-projects*` without the rest of accounting (`REQUIRE_BRANCH_PROJECTS`); `can_manage_accounting` still covers everything. Because project costs are purchase invoices, the flag is also admitted to what the project expenses tab needs: GET `contacts`, `accounts`, `bank-accounts`, `branches`, GET + POST `purchase-invoices` (and its `check-number` / `analyze` helpers) — never PUT/DELETE on the invoice ledger (those stay on the project-scoped `/branch-projects/:id/invoices/*` routes)

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

---

## 13. Coffee costing inside purchase invoices (روستد كوفي)

Owner decisions: roasting cost is **not** part of the supplier invoice total or VAT; a separate roasting invoice is auto-generated on contact «محمصة درر» (pending payment, due = bean invoice date + 15 days, VAT 0%, default 9 SAR/kg); item cost = net cost per kg **including VAT** from the last fully-received invoice; SAR only.

**Shared math:** `src/utils/coffeeMath.js` (`computeCoffeeLine`, `allocateDiscount`, `wasteFlag`, `coffeeLineStatus`) — used verbatim on server and client so previews equal stored numbers.

**Server:** `src/app/api/utils/coffeeInvoices.js`
- `ensureCoffeeSchema()` (memoized, run from purchase-invoices/accounts/items/item-categories routes): line columns on `accounting_purchase_invoice_items` (`roast_enabled`, `item_id`, `quantity_unit` sack|kg, `kg_per_sack`, `roast_per_kg`, `raw_kg`, `bean_cost_*`, `roast_total_net`, `landed_*`, `received_kg`, `arrival_*`, `waste_percent`, `net_incl_per_kg`, `receipt_batch_id`, `deposited_kg`, `roast_for_item_id`), header columns (`invoice_kind` purchase|roast, `source_invoice_id`, `roast_link_state`, `roast_confirmed`, `roaster_reference`, `roaster_contact_id`, `due_date_auto`), `item_categories.is_roasted_coffee/roast_cost_per_kg/roast_tax_rate/default_roaster_contact_id`, `items.bag_size_kg/roast_cost_per_kg/cost_source*`, `measurement_units.kg_per_unit`, `accounting_accounts.system_key` ('roasting' account under 52), seeds category «بن قهوة محمصة» + contact «محمصة درر».
- Eligibility: a line is a bean line when its account mirrors an active item whose category has `is_roasted_coffee` (`loadBeanInfo`); `accounts` GET exposes `bean: {...}` per account and `is_roasting_account`.
- `applyCoffeeToItems` (validation, defaults, raw-price guard 3–500 SAR/kg unless `free_sample`/`confirm_unusual_price`), `planLineReconcile` (UPDATE by line id / INSERT / DELETE — never delete+insert; server-owned arrival columns kept), `syncRoastInvoice` (create/update/deactivate child `ROAST-{id}`; payment lock: fully paid → 409 `roast_paid`; manual edit of roast invoice sets `roast_confirmed` and `reverseSyncRoastToBean`), `recordArrival` (finalize vs report-only for `can_add_purchase_invoices`; deposits via deterministic `purchase_receipts.receipt_batch_id = PINV-{invoice}-L{line}` at arrival date; waste > 60% needs `confirm_high_waste`), `reverseDeposits`, `recomputeItemCost` (latest complete line by arrival_date → `items.cost/base_purchase_cost` = net incl per kg × kg_per_base_unit, `cost_source='invoice'`; manual edit in item form resets to `'manual'`).
- Routes: `purchase-invoices` POST/PUT/DELETE (409 codes `stale_invoice`, `inactive_invoice`, `roast_paid`, `reconfirm_received`, `deposited`, `has_payments`, `roast_linked`; DELETE `detach=1` for roast kind), `purchase-invoices/arrival` POST (`reverse_deposit: true` to undo). Recurring templates are refused for coffee lines.

**UI:** `PurchaseInvoiceModal` (`CoffeeLineRow` sub-row, live tiles, roaster select, arrival + deposit at creation for `allowArrival`), `CoffeeArrivalModal` (from the invoices drawer «تسجيل الوصول»), `PurchasesInvoicesPanel` (badges, drawer coffee section, roast-invoice link), `BulkInvoiceUploadPanel` review sub-row, `PurchasesReportsPanel` report key `coffee` («تقرير البن»: by bean / by invoice / monthly, reconciliation of roasting invoices), item/category forms (`ItemFormModal`, `ItemCategoriesModal`), accounts-tree badges «بن محمّص» / «خدمة تحميص».

---

## 14. Lease contracts inside purchases (العقود التأجيرية)

Owner decisions: contracts live under `/accounting/purchases?tab=leases` with three sub-tabs (`sub=contracts|due|reserve`); paying an installment only marks it paid (date, bank, receipt) and is tracked in «سداد المستحق» — **no purchase invoice is created** (owner reversed the earlier `LEASE-{id}-{seq}` invoice design; `unpay` still deactivates a legacy linked invoice if one exists); no partial payments (split the schedule instead); fixed charges («المبالغ الثابتة») are per-installment amounts added after VAT unless flagged taxable; the monthly set-aside («استقطاع شهري») is unrelated to revenue: the **first installment of every contract has no set-aside and no invoices** (paid directly); every later pending installment is split equally over its frequency months (quarterly 3, semi-annual 6, annual 12) ending the month **before** the due month, each month's share is transferred to a separate set-aside account and confirmed in a ledger, and the accumulated total is what pays the installment at due date. Each set-aside month that has arrived gets an **unpaid purchase invoice** `LEASE-{contract}-{seq}-{YYYYMM}` under «إيجار فرع / مستودع» or «إيجار سكن» (children of 52, created on demand), linked via `accounting_purchase_invoices.lease_contract_id/lease_payment_id/lease_month` (`src/app/api/utils/leaseSetAsideInvoices.js`: `generateSetAsideInvoices` runs from the reserve GET and `runPurchaseAutomation`; «تأكيد التحويل» marks it paid, clearing resets it; cancelled/deleted payments deactivate unpaid ones). The invoices list shows a «عقد …» badge linking to `/accounting/purchases?tab=leases&sub=contracts&contract={id}`.

**Shared math:** `src/utils/leaseMath.js` (`installmentAmounts` excl-first so schedule rows reproduce the invoice line to the cent, `generateSchedule`, `setAsideSchedule` = N equal monthly set-asides (N = frequency months) ending the month before the due month (last carries rounding), `reserveForPayment`/`suggestedReserve` kept for reference, `contractStatus` active|upcoming|notice|ended|terminated). Unit tests in `test/leaseMath.test.js`.

**Deleting purchase invoices (owner rule, Oct 2026):** there is no "inactive" state any more — `DELETE /api/accounting/purchase-invoices` is always a hard delete (payments, items, attachments, linked roast invoice; deposits reversed first), every automatic deactivation (payroll reopen, roast removal, lease set-aside cleanup, lease unpay) calls `hardDeletePurchaseInvoices` from `src/app/api/utils/purchaseInvoiceDelete.js`, and `purgeInactivePurchaseInvoices` removes any leftover `is_active = FALSE` rows once per server start. The «عرض الموقوفة» toggle was removed from the invoices panel.

**Server:** `src/app/api/utils/leaseContracts.js`
- `ensureLeaseSchema()` (memoized): `accounting_lease_contracts` (header; `installment_amount` stored **pre-VAT** + `amount_includes_vat` flag for display; `status` active|terminated; soft delete via `is_active`; `analysis_json`), `accounting_lease_payments` (schedule rows `seq` unique per contract, `amount_excl/vat_rate/vat_amount/amount_incl`, `status` pending|paid|cancelled, `invoice_id`, `paid_*`), `accounting_lease_reserves` (ledger: one row per payment × month, `amount` confirmed, `suggested_amount`, `revenue_basis`).
- `listContracts` (LATERAL aggregates: paid/pending totals, next due, overdue count), `loadContract` (+payments), `listPayments` (LAG for `reserve_start`; default list = active, non-terminated contracts), `loadReservesByPayment`, `buildScheduleRows`, `replaceSchedule(id, rows, {keepPaid, matchBySeq})` (paid rows kept; generated duplicates skipped by seq for generated schedules, by due date + amount for custom ones), `parseContractInput(body, {requireSchedule})` (status absent → keep stored), `getRentAccountId`.
- `src/app/api/utils/leaseContractAnalysis.js`: smart fill from PDF/image (claude-opus-5-5, adaptive thinking, JSON-schema output; `installment_amount` is always pre-VAT; contact matching by VAT then normalized name; 503 without `ANTHROPIC_API_KEY`).
- Routes `src/app/api/accounting/lease-contracts/`: `route.js` GET(`?includeInactive&q`)/POST (orphan header deleted if the schedule insert fails), `[id]/route.js` GET/PUT (`regenerate_schedule`, `expected_updated_at` → 409 `stale_contract`; `{reactivate:true}` short body re-enables a stopped contract)/DELETE (soft; `?force=1` hard, 409 `has_paid`), `payments/route.js` GET (`?status&from&to&contract_id`), `payments/[id]/route.js` PUT (pending/cancelled only; 409 `paid_row`), `payments/[id]/pay/route.js` POST (`{paid_date, bank_account_id?, receipt_url?, notes?}`; marks paid, no invoice; full amount only → 400 `partial_payment`; 409 `already_paid`/`cancelled_row`/`inactive_contract`), `payments/[id]/unpay/route.js` POST (resets; deactivates a legacy linked invoice), `reserve/route.js` GET (`?month&branch_id` → per pending payment: `schedule[]` from `setAsideSchedule` (window = `window_months` from listPayments) merged with the ledger, `month_rows` for the selected month, totals, `can_confirm` = month ≤ current), `reserve/confirm/route.js` POST/DELETE (upsert/remove a month's confirmed transfer; future months, the due month itself and paid rows refused; sum capped at `amount_incl`), `analyze/route.js` POST. Auth: admins with `can_manage_accounting` or `can_manage_purchases` (`REQUIRE_LEASE`). Audit via `logPurchaseAudit` entity types `lease_contract` / `lease_payment`.

**UI:** `LeaseContractsPanel` (KPI tiles, contracts table + drawer with inline payment edit/cancel/pay/unpay, reactivate/stop/hard delete; due list grouped by month with relative dates; reserve view with suggested amount per row, editable confirm input, «تأكيد الكل بالمقترح», behind-plan chips), `LeaseContractModal` (upload + smart fill with autoFilled/touched ownership, live schedule preview, custom rows, regenerate checkbox on edit), `LeasePayModal` (amount read-only, date, bank, receipt), hooks in `src/hooks/useLeaseContracts.js`, query keys `leaseContracts|leaseContract|leasePayments|leaseReserve`.

## 15. Branch establishment projects (تأسيس الفروع)

- **Owner decisions:** the branch row is created later from the branches page (a project never creates a branch); costs come only through purchase invoices; budget per phase plus a project total; equipment is an establishment expense (account group `53`); pre-opening rent counts as project cost. Gate: Admin with `can_manage_accounting` **or** `can_manage_branch_projects` (`REQUIRE_BRANCH_PROJECTS` — all writes + single-project GET); the list GET (`route.js` GET) uses `REQUIRE_BRANCH_PROJECTS_READ`, which additionally admits `can_manage_purchases` so the purchase-invoice modal can pick a project/phase. A purchases-only admin can no longer open the `/accounting/branch-projects*` pages.
- **Plans:** `.claude/plans/branch-projects.md` (design), `.claude/plans/branch-projects-frontend-contract.md` (data shapes, hooks), `.claude/plans/branch-projects-backend-contract.md` (tables, routes, integration), `.claude/plans/branch-projects-contracts.md` (contractor/supplier contracts + installments inside the expenses tab).
- **Backend is live, mock off:** `src/hooks/useBranchProjects.js` has `BRANCH_PROJECTS_MOCK = false` and talks to `BASE = /api/accounting/branch-projects`; flipping it back to `true` restores the localStorage mock (`src/utils/branchProjectsMock.js`, key `branchProjects.mock.v1`) for offline UI work.
- **Tables** (`src/app/api/utils/branchProjects.js`, `ensureBranchProjectsSchema` memoized via `ensureOnce`; Riyadh timestamps): `branch_projects` (header: `code BP-00N`, name/city/district/address/area_sqm, `status planning|in_progress|on_hold|opened|cancelled`, contract/target/actual dates, `budget_total`, manager, `lease_contract_id/number`, `branch_id`, `is_active`), `branch_project_phases` (sort_order, planned/actual dates, status, budget, weight, progress_override, owner/contractor, color, `template_key`, `default_account_code`), `branch_project_tasks` (phase_id, is_milestone, due/done, assignee), `branch_project_updates` (body + `photos JSONB`), `branch_project_attachments` (url/label/kind). Link columns added on demand: `accounting_purchase_invoices.project_id/project_phase_id/project_contract_id/project_installment_id` (+ `idx_purchase_invoices_project`, `idx_purchase_invoices_project_contract`; `ensureProjectInvoiceLinkColumns()` returns false until the invoices table exists) and `accounting_lease_contracts.project_id`.
- **Contracts (قسم «العقود» in the expenses tab):** a contract is a commitment (agreed amount split into installments); actual payment still happens only through purchase invoices (owner rule). Tables (same ensure): `branch_project_contracts` (`project_id` CASCADE, `phase_id` SET NULL, `kind contractor|supplier|service|other`, `title`, `party_name`, `party_contact_id`, `agreed_amount`, `vat_included`, `start_date/end_date`, `status active|completed|cancelled`, `attachment_url/name`, `notes`, `is_active`, creator; index `project_id`) and `branch_project_contract_installments` (`contract_id` CASCADE, `seq`, `label`, `due_date`, `amount`, `invoice_id`, `notes`; index `(contract_id, seq)`). Installment `status` is **computed, never stored** (`installmentStatus` in `branchProjects.js`, same rule as the frontend helper): `paid` when its invoice is fully paid (paid ≥ total − 0.005), `invoiced` when it has an unpaid invoice, `overdue` when it has no invoice and `due_date < today`, else `pending`; an installment whose invoice is missing/inactive is shown as unlinked. `loadContracts(projectIds)` (active contracts by `created_at, id`, installments by `seq, id` LEFT JOINed to their active invoice for `invoice_number/invoice_total/invoice_paid`, plus one aggregate query for each contract's `invoiced/paid` = sum of active invoices with `project_contract_id`), `loadContract(id, projectId)`, `loadContractHeader`, `loadInstallment`, `parseContractInput(body, existing)` (title + party_name required, kind/status from `CONTRACT_KINDS/CONTRACT_STATUSES`, `agreed_amount ≥ 0`, `vat_included` default true, dates `YYYY-MM-DD` with end ≥ start, `installments` ≤ 60 renumbered by send order; absent/null = keep). `loadProject` returns `contracts: Contract[]`; `listProjects` returns `contracts: []`. `mapInvoiceRow` adds `contract_id, contract_title, installment_id, installment_seq` (INVOICE_SELECT LEFT JOINs both contract tables).
- **Contract routes** (`[id]/contracts/`): `route.js` POST → 201 `{ok, contract}` (header then installments via `json_to_recordset`; installment failure deletes the header); `[contractId]/route.js` PUT → `{ok, contract}` (header update + installment reconcile in one `sql.transaction`: sent rows with a known `id` are updated, rows without `id` inserted, unsent rows **without** `invoice_id` deleted, rows with `invoice_id` always kept, then `seq` renumbered by `(seq, id)`) / DELETE → `{ok}` or 409 `has_invoices` when an active invoice has `project_contract_id` or an installment has `invoice_id`; `[contractId]/installments/[installmentId]/route.js` PUT `{invoice_id}` → `{ok, installment, invoice}`: a number links (404 missing/inactive; 409 `linked_elsewhere` with `project_id` or `contract_id/installment_id` when the invoice belongs to another project or installment; writes `project_id`, `project_phase_id = COALESCE(contract.phase_id, existing)`, `project_contract_id`, `project_installment_id` on the invoice and `invoice_id` on the installment; a previously linked invoice on that installment is unlinked first), `null` unlinks both sides (the invoice keeps its project link). All writes `logProjectAudit` + `touchProject`; invoice-side changes also `logPurchaseAudit` (`contract_linked/contract_unlinked`).
- **Invoice ↔ installment integration:** `createPurchaseInvoice` reads `project_contract_id/project_installment_id` (validated: contract belongs to the sent `project_id`, installment belongs to the contract and has no `invoice_id` → 400 «الدفعة مرتبطة بفاتورة أخرى»), writes them in the INSERT, then `UPDATE … SET invoice_id = <new id> WHERE id = <installment> AND invoice_id IS NULL` (try/catch; if the row was taken meanwhile the invoice's `project_installment_id` is cleared). PUT never changes them. The list SELECT adds `project_contract_id, project_contract_title` (LEFT JOIN `branch_project_contracts pc`). Deleting an invoice from any path unlinks it from installments first: `unlinkInvoicesFromInstallments(ids)` in `purchaseInvoiceDelete.js` (to_regclass + try/catch) is called by `hardDeletePurchaseInvoices` (project tab DELETE, payroll, roast, lease set-aside, unpay) and by the force DELETE in `purchase-invoices/route.js`. Known gap: the project soft-delete only clears `project_id/project_phase_id` on invoices, so `project_contract_id` may remain on them (title then LEFT JOINs to null).
- **Accounts 53:** `ensureEstablishmentAccounts()` creates parent `53 تكاليف تأسيس الفروع` under `5` (non-postable, system) and the postable children from `ESTABLISHMENT_ACCOUNTS` (5301–5399) in `src/utils/branchProjectMath.js`; `getEstablishmentAccountId(code)` (unknown code → 5399).
- **Loaders/parsers:** `listProjects()` / `loadProject(id)` return the frontend `Project` shape (phases sorted by sort_order, tasks, invoices via `mapInvoiceRow` with computed `status` and `source: lease|manual`, updates/attachments newest first), `parseProjectInput/parsePhaseInput/parseTaskInput` mirror `normalize*Input` of the mock, `createProjectWithTemplate` (one transaction, `template default|empty`), `pendingMilestones`, `projectExists`, `phaseBelongsToProject`, `logProjectAudit` (purchase audit log, entity `branch_project`).
- **Routes** `src/app/api/accounting/branch-projects/` (every handler: `requireAuth` → `ensureBranchProjectsSchema`; `_lib.js` holds shared helpers, not a route; contracts routes are listed above): `route.js` GET `{projects}` / POST 201 `{project}`; `[id]/route.js` GET/PUT (`opened` not settable via PUT)/DELETE (unlinks invoices + lease contracts first); `[id]/open` POST `{actual_opening_date, force}` → 409 `milestones_pending` with `pending[]`; `[id]/phases` POST, `phases/reorder` POST `{ids}`, `phases/[phaseId]` PUT/DELETE (409 `has_invoices`); `[id]/tasks` POST, `tasks/[taskId]` PUT/DELETE; `[id]/updates` POST (`photos` ≤ 20) + `[updateId]` DELETE; `[id]/attachments` POST + `[attachmentId]` DELETE; `[id]/invoices` POST **link existing invoice** `{invoice_id, phase_id}` (404 / 409 `linked_elsewhere`); `[id]/invoices/[invoiceId]` PUT `{phase_id?, expense_account_code?}` (repoints header + all lines to the 53 account) / DELETE (hard delete via `hardDeletePurchaseInvoices`; 409 `lease_invoice` for set-aside invoices).
- **Purchase-invoice integration** (`purchase-invoices/route.js`): `ensureSchemaImpl` calls `ensureBranchProjectsSchema()` + `ensureProjectInvoiceLinkColumns()`; the list SELECT LEFT JOINs `branch_projects bp` / `branch_project_phases bpp` and returns `project_id, project_phase_id, project_name, project_code, project_phase_name`; `createPurchaseInvoice` and PUT accept `project_id`/`project_phase_id` (validated: project exists, phase belongs to it → 400; PUT writes them only when `project_id` is present in the body so quick-payment payloads keep the link). `PurchaseInvoiceModal` shows «مشروع تأسيس»/«القسم» selects (only when an active project exists; a phase's `default_account_code` fills the first empty line's account) and takes `projects` + `prefill = {project_id, project_phase_id, expense_account_code}`; `PurchasesInvoicesPanel` renders `ProjectBadge` (→ `/accounting/branch-projects/{id}?tab=expenses`) and a «المشروع» filter next to the branch filter.
- **Lease integration:** `parseContractInput` reads `project_id` (absent key = keep stored), POST/PUT write it, `CONTRACT_SELECT`/`listPayments` return it, `LeaseContractModal` has an optional «مشروع تأسيس» select (`LeaseContractsPanel` passes `projects`). `generateSetAsideInvoices` links each new set-aside invoice to the contract's project (`project_phase_id` = phase with `template_key='lease'`, else first by sort_order) unless the project is `opened` and `lease_month` is after `actual_opening_date`'s month; all of it is try/catch-guarded so set-aside generation never fails because of project tables.
- **Expenses tab** (`ExpensesTab.jsx`): budget summary, per-phase budget vs actual, pie by account, invoice table; «+ فاتورة» opens `PurchaseInvoiceModal` with `prefill` and creates through `useCreateAccountingPurchaseInvoice` then `invalidateBranchProjectQueries`; «ربط فاتورة موجودة» lists unlinked purchase invoices (`useAccountingPurchaseInvoices`, loaded only while open) and calls `useSaveBranchProjectInvoice({project_id, invoice_id, phase_id})`; edit = `ExpenseModal` (phase + 53 account only → PUT); delete = confirm then `useDeleteBranchProjectInvoice` (hard delete); `source === 'lease'` rows show an «إيجار» chip and cannot be deleted from the tab.
- **Math/UI:** `src/utils/branchProjectMath.js` (statuses/labels, `DEFAULT_PHASE_TEMPLATE` with 11 phases + milestones, progress/health/budget/timeline helpers; tests in `test/branchProjectMath.test.js`). Pages `/accounting/branch-projects` and `/accounting/branch-projects/[id]` (`?tab=overview|phases|expenses|updates|attachments|settings`, `?phase=ID`), components in `src/components/Accounting/BranchProjects/`, sidebar row `branch-projects`.
