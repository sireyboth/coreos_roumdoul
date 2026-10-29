# CoreOS Roumdoul — Business OS

Modular monolith for Cambodian businesses. One Laravel API serves every client.

```
backend/    Laravel 12 API (/api/*) + Filament platform admin (/admin)
frontend/   Next.js web app — see frontend/CLAUDE.md
mobile/     Expo (SDK 58) app — same API on /api/v1, same token — see mobile/README.md
```

## Rules for new code

- **One API for all clients.** Web and mobile call the same endpoints with a Sanctum
  Bearer token. Never build a separate backend for a client.
- **Modules.** Each business area (attendance, payroll, sales, inventory, …) is gated by
  `module:<key>` middleware and `company_permission:<perm>`. Keep a module's code together:
  `Controllers/Api/<Module>/`, `Services/<Module>/`, `tests/Feature/Api/<Module>/`.
  Modules today: Account, Organization, Schedules, Access, Attendance, Requests, Payroll.
  Shared services stay at `app/Services/` root (`AuditLogger`, `NotificationService`).
- **Frontend layout.** `components/dashboard/<module>/` (attendance, schedules, employees,
  organization, access, payroll, requests, excel, charts) + `layout/` (sidebar, nav, header,
  bell) + `shared/`. `lib/api/`, `lib/excel/`, `lib/pdf/`, `lib/export/`. Never add files
  flat in `components/dashboard/` or `lib/` when a module folder fits.
- **Routes.** One file per module in `backend/routes/api/`, loaded from `routes/api.php`
  inside the signed-in, active-company group. A new module = a new file + one `require`.
  `RouteProtectionTest` fails if any API route is left open without sign-in.
- **Frontend API client.** `frontend/src/lib/api/`: `client.ts` (token, headers, retry,
  errors) + one file per module with its types and a `<module>Api` object, merged into
  `api` in `index.ts`. Everyone imports from `@/lib/api`. A new module = a new file + one
  line in `index.ts`.
- **Thin controllers.** Business rules live in `app/Services`, not controllers.
- **Tenancy.** Every business table has `company_id` (and `branch_id` where it applies).
  Never query across companies.
- **Modules don't write each other's tables.** Call the other module's service or
  dispatch an event (e.g. a completed sale lowers stock through an event).
- **Stock is a ledger** of movements (in, out, transfer, adjust), never one overwritten number.
- **Files always go to S3** (disk `s3`), in every environment.
- **Don't break old endpoints** — older app versions stay on phones. Add, don't rename.
- **API versions.** Every route is served at `/api/...` (web app, older clients) and
  `/api/v1/...` (route names `v1.*`). The mobile app uses `/api/v1`. A breaking change
  goes into a new version, never into v1.
- **Local database is local.** `backend/.env` uses PostgreSQL on this Mac
  (`127.0.0.1`, database `business_os`) — the same type as production. Never point a
  local `.env` at the Laravel Cloud production database. Tests use SQLite in memory.

## Errors and debugging

- Every request gets an ID (`AssignRequestId` middleware): `X-Request-Id` header, on every
  log line, and in every API error body. Ask a client for it, then search the logs.
- API errors always look like: `{ message, code, request_id }` (+ `errors` on 422).
  Set your own `code` for business errors (`plan_limit_reached`, `trial_expired`); it is kept.
- Logged errors include `user_id` and `company_id` automatically (`bootstrap/app.php`).

## Checks (CI runs these on every push — `.github/workflows/ci.yml`)

```bash
# backend/
./vendor/bin/pint          # fix code style (CI runs: pint --test)
./vendor/bin/phpstan analyse --memory-limit=1G   # Larastan; old findings in phpstan-baseline.neon, new code must be clean
composer audit             # known vulnerable packages
php artisan test           # all tests must pass

# frontend/
npm run lint
npx next typegen && npx tsc --noEmit   # typegen: Next's generated LayoutProps/PageProps
npm run build

# mobile/  (read mobile/AGENTS.md first; add packages with `npx expo install`)
npm run lint
npx tsc --noEmit
```

- **Mobile app.** `mobile/src/lib/api/` mirrors `frontend/src/lib/api/` (one file per module,
  merged into `api`), always on `/api/v1`. Token in SecureStore, never AsyncStorage.
  Screens in `mobile/src/app/(app)/`; `_layout.tsx` guards sign-in with `Stack.Protected`.
  UI = NativeWind (Tailwind classes) + React Native Reusables (`src/components/ui/`, shadcn-style)
  + lucide icons via `<Icon as={…}>`. No hand-written `StyleSheet` for new screens.

Add a feature test for every new endpoint and every bug fix.

## Docs

System documentation (architecture, ERD, flows): keep updating the one existing doc,
never create a new one.
