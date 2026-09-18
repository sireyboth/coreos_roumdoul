# Business OS

A Business Operating System for Cambodian businesses. Attendance is the first
module; the platform is architected as a modular monolith so future modules
(HR, Payroll, POS, Inventory, CRM, Accounting, Intelligence, …) can be added
without a rewrite.

## Structure

```
business-os/
├── backend/    Laravel 12 API + Filament Platform Admin panel
└── frontend/   Next.js customer-facing Business OS web app
```

## Backend (`backend/`)

- Laravel 12, PHP 8.4
- PostgreSQL (transactional data) — pending local install/config
- Redis (cache, queues) — pending local install/config
- Laravel Sanctum (API auth)
- Filament (Platform Owner admin panel at `/admin`)

```bash
cd backend
composer install
php artisan key:generate
php artisan migrate
php artisan serve --port=8000
```

## Frontend (`frontend/`)

- Next.js (App Router), React, TypeScript
- Tailwind CSS, shadcn/ui

```bash
cd frontend
npm install
npm run dev
```

## Running locally

Run each app in its own terminal (no combined script — kept them separate):

```bash
# Terminal 1 — backend
cd backend && php artisan serve --port=8000

# Terminal 2 — frontend
cd frontend && npm run dev
```

- Backend API: http://localhost:8000 (`/api/health`, `/up`)
- Platform Admin (Filament): http://localhost:8000/admin/login
- Frontend: http://localhost:3000 (calls the backend `/api/health` on load)

## Two administration levels

- **Platform Owner** — Filament panel at `backend`'s `/admin`. Controls the
  entire SaaS platform: companies, subscriptions, plans, modules, billing.
- **Customer Company** — the Next.js app. Each company only ever sees and
  controls its own organization; tenant isolation is enforced server-side.

See project notes for the full roadmap (Stage 0 foundation → Attendance →
Workforce → Operations → Commerce → Finance → Intelligence).
