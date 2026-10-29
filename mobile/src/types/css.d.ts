// CSS imports (src/global.css, used on web). Expo generates expo-env.d.ts with this on
// `expo start`, but that file is git-ignored — this keeps `tsc` working in a fresh checkout (CI).
declare module '*.css';
