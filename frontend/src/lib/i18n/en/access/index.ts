// Access module — one file per screen; the file name is the key's middle part,
// e.g. t("access.usersPage.title") lives in en/access/usersPage.ts.

import { usersPage } from "./usersPage";
import { rolesPage } from "./rolesPage";
import { roleDialog } from "./roleDialog";
import { auditPage } from "./auditPage";
import { profilePage } from "./profilePage";
import { createLogin } from "./createLogin";
import { loginLink } from "./loginLink";
import { signInMethod } from "./signInMethod";

export const access = { usersPage, rolesPage, roleDialog, auditPage, profilePage, createLogin, loginLink, signInMethod };
