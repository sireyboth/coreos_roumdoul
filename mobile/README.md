# Business OS — mobile app

Expo (SDK 58) + Expo Router + TypeScript. One app for every employee; it talks to the
same Laravel API as the web app, on **`/api/v1`**, with the same Bearer token.

## Run it

```bash
cp .env.example .env        # set EXPO_PUBLIC_API_URL (your Mac's Wi-Fi IP for a real phone)
npm install
npx expo start              # scan the QR code with Expo Go on your phone
```

The backend must be reachable from the phone: `php artisan serve --host=0.0.0.0 --port=8000`
in `backend/`, phone and Mac on the same Wi-Fi.

## Layout

```
src/app/                 screens (Expo Router: every file is a route)
  _layout.tsx            session + guards: signed out → sign-in, signed in → (app)/
  sign-in.tsx            employee ID or email sign-in
  (app)/index.tsx        home for a signed-in person
src/lib/api/             API client, like the web app's lib/api/
  client.ts              base URL (/api/v1), token, headers, ApiError { message, code, requestId }
  account.ts             login, me, logout
  index.ts               merges every module into `api`
src/lib/session.tsx      who is signed in (useSession)
src/lib/storage.ts       token in SecureStore (encrypted keychain); localStorage on web only
```

## UI

Same approach as the web app (Tailwind + shadcn + lucide), built for phones:

- **NativeWind 4** — Tailwind classes on native views: `<View className="rounded-xl bg-card p-4">`.
- **React Native Reusables** — shadcn-style components in `src/components/ui/`
  (button, card, input, label, text, icon). Add more: `npx @react-native-reusables/cli@latest add dialog`.
- **lucide-react-native** — the web app's icons: `<Icon as={Wallet} className="text-primary" />`.
- Colors: `src/global.css` (light + `.dark:root`), mirrored in `src/lib/theme.ts` for places
  that can't take classes. Brand primary is the web's indigo `#4f46e5`. Light/dark follows the phone.

Add a module the same way as on the web: `src/lib/api/<module>.ts` (types + `<module>Api`),
one line in `index.ts`, screens under `src/app/(app)/`.

## Checks (CI runs them)

```bash
npx tsc --noEmit
npm run lint
```

Expo changes between SDK versions — read `AGENTS.md` before adding Expo packages
(always `npx expo install <package>`).
