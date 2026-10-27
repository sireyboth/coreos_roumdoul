import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { translateNow } from "@/lib/i18n";

/** One place that turns any failure into a toast a person can act on. */
export function notifyError(err: unknown, fallback = translateNow("common.message.somethingWrong")) {
  if (err instanceof ApiError) {
    if (err.code === "plan_limit_reached") {
      toast.error(translateNow("common.message.planLimit"), { description: err.message });
      return;
    }
    toast.error(err.message || fallback);
    return;
  }

  // fetch() itself failing — no response at all. Only fetch's own wording counts:
  // any other TypeError is a bug in the page, and calling it a network problem
  // sends people checking their Wi-Fi instead of reporting it.
  if (err instanceof TypeError && /failed to fetch|networkerror|load failed/i.test(err.message)) {
    toast.error(translateNow("common.message.offline"), { description: translateNow("common.message.offlineHint") });
    return;
  }

  // Kept in the console so the real cause can be found.
  console.error(err);
  toast.error(fallback, err instanceof Error && err.message ? { description: err.message } : undefined);
}

export function notifySuccess(message: string, description?: string) {
  toast.success(message, description ? { description } : undefined);
}
