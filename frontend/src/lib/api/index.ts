// Everything the app imports from "@/lib/api". One file per module; add a new module
// (e.g. sales.ts) with its types and a `salesApi` object, then add it below.

export { ACCOUNT_BLOCKED_CODES, ACCOUNT_BLOCKED_EVENT, ApiError, clearToken, getMeSnapshot, getToken, photoSrc, saveMeSnapshot, setToken } from "./client";

export * from "./account";
export * from "./organization";
export * from "./access";
export * from "./schedules";
export * from "./attendance";
export * from "./requests";
export * from "./payroll";

import { accountApi } from "./account";
import { organizationApi } from "./organization";
import { accessApi } from "./access";
import { schedulesApi } from "./schedules";
import { attendanceApi } from "./attendance";
import { requestsApi } from "./requests";
import { payrollApi } from "./payroll";

export const api = {
  ...accountApi,
  ...organizationApi,
  ...accessApi,
  ...schedulesApi,
  ...attendanceApi,
  ...requestsApi,
  ...payrollApi,
};
