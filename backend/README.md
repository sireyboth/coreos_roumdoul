# Business OS — backend

Laravel 12 API (`/api/*`) and the Filament platform admin (`/admin`).
Project rules, layout and the checks to run: see `../CLAUDE.md` and `../README.md`.

```
app/Http/Controllers/Api/<Module>/   one folder per module (Account, Organization, Schedules,
                                     Access, Attendance, Requests, Payroll)
app/Services/<Module>/               business rules; AuditLogger and NotificationService are shared
routes/api.php + routes/api/*.php    one route file per module
tests/Feature/Api/                   feature tests (RouteProtectionTest guards sign-in on every route)
```

```bash
composer install && php artisan key:generate && php artisan migrate
php artisan serve --host=0.0.0.0 --port=8000   # reachable from a phone on the same Wi-Fi
./vendor/bin/pint && php artisan test          # before every push
```
