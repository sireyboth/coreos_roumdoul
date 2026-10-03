"use client";

/**
 * A system notification (the OS pop-up) for a new alert when the app isn't the
 * tab in front. Works only while the app is open somewhere; push to a closed
 * app would need a service worker.
 */

export type SystemPermission = NotificationPermission | "unsupported";

export function systemPermission(): SystemPermission {
  return typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported";
}

/** Must be called from a click: browsers ignore permission requests that aren't. */
export async function requestSystemPermission(): Promise<SystemPermission> {
  if (systemPermission() === "unsupported") return "unsupported";
  return Notification.requestPermission();
}

/**
 * Shows the OS notification — only when the app isn't in front (otherwise the
 * in-page toast already covers it). Clicking it brings the app forward.
 */
export function showSystemNotification(title: string, options: { body?: string; tag: string; onClick?: () => void }) {
  if (systemPermission() !== "granted" || document.visibilityState === "visible") return;

  try {
    const notification = new Notification(title, { body: options.body, tag: options.tag, icon: "/logoroumdoul.png" });
    notification.onclick = () => {
      window.focus();
      options.onClick?.();
      notification.close();
    };
  } catch {
    // Some mobile browsers only allow notifications from a service worker.
  }
}
