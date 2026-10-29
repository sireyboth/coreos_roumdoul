// Everything the app imports from "@/lib/api". One file per module, like the web app:
// add a module (e.g. attendance.ts) with its types and an `attendanceApi` object, then add it below.

import { accountApi } from './account';

export { API_URL, ApiError, setLanguage } from './client';
export * from './account';

export const api = {
  ...accountApi,
};
