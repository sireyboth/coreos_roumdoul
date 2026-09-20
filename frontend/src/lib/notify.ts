import { toast } from "sonner";
import { ApiError } from "@/lib/api";

/** One place that turns any failure into a toast a person can act on. */
export function notifyError(err: unknown, fallback = "Something went wrong. Please try again.") {
  if (err instanceof ApiError) {
    if (err.code === "plan_limit_reached") {
      toast.error("Plan limit reached", { description: err.message });
      return;
    }
    toast.error(err.message || fallback);
    return;
  }

  // fetch() itself failing — no response at all.
  if (err instanceof TypeError) {
    toast.error("Can't reach the server", { description: "Check your internet connection and try again." });
    return;
  }

  toast.error(fallback);
}

export function notifySuccess(message: string, description?: string) {
  toast.success(message, description ? { description } : undefined);
}
