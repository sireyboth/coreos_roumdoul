"use client";

import { api } from "@/lib/api";

/**
 * Push notifications on this device (phone or computer), delivered by the
 * service worker in /sw.js even when the app is closed.
 *
 * States:
 *  - unsupported   the browser can't do push
 *  - needs-install an iPhone/iPad in a browser tab: push only works once added to the Home Screen
 *  - unavailable   the server has no push keys set up
 *  - blocked       the person said no in the browser; only browser settings can undo it
 *  - off           can be turned on
 *  - on            this device receives pushes for the signed-in person
 */
export type PushState = "unsupported" | "needs-install" | "unavailable" | "blocked" | "off" | "on";

const SW_URL = "/sw.js";

function supported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** iPhone/iPad only allow push for an app added to the Home Screen. */
function isIosBrowserTab(): boolean {
  if (typeof window === "undefined") return false;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

/** The server wants the keys as base64url; the browser hands them over as bytes. */
function toBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function existingSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration(SW_URL);
  return registration ? registration.pushManager.getSubscription() : null;
}

async function send(subscription: PushSubscription) {
  const json = subscription.toJSON();
  await api.push.subscribe({
    endpoint: subscription.endpoint,
    keys: { p256dh: json.keys?.p256dh ?? toBase64Url(subscription.getKey("p256dh")), auth: json.keys?.auth ?? toBase64Url(subscription.getKey("auth")) },
    content_encoding: (PushManager as unknown as { supportedContentEncodings?: string[] }).supportedContentEncodings?.includes("aes128gcm")
      ? "aes128gcm"
      : "aesgcm",
  });
}

export async function pushState(): Promise<PushState> {
  if (isIosBrowserTab()) return "needs-install";
  if (!supported()) return "unsupported";
  if (Notification.permission === "denied") return "blocked";

  try {
    const { enabled } = await api.push.key();
    if (!enabled) return "unavailable";
  } catch {
    return "unavailable";
  }

  return Notification.permission === "granted" && (await existingSubscription()) ? "on" : "off";
}

/** Must run from a click — browsers ignore permission requests that aren't. */
export async function enablePush(): Promise<PushState> {
  if (!supported()) return "unsupported";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "blocked" : "off";

  const { enabled, public_key } = await api.push.key();
  if (!enabled || !public_key) return "unavailable";

  const registration = await navigator.serviceWorker.register(SW_URL, { scope: "/" });
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  const serverKey = fromBase64Url(public_key);

  // Subscribed under an older server key: start over, or pushes would be rejected.
  const currentKey = subscription?.options.applicationServerKey;
  if (subscription && currentKey && toBase64Url(currentKey) !== public_key) {
    await subscription.unsubscribe();
    subscription = null;
  }

  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: serverKey });
  await send(subscription);

  return "on";
}

/** Stops pushes to this device for whoever is signed in. */
export async function disablePush(): Promise<PushState> {
  if (!supported()) return "unsupported";

  const subscription = await existingSubscription();
  if (subscription) {
    await api.push.unsubscribe(subscription.endpoint).catch(() => {});
    await subscription.unsubscribe().catch(() => {});
  }

  return "off";
}

/**
 * On every app load: if this device is already subscribed, tell the server
 * again — it may belong to whoever signed in now, or the browser may have
 * rotated it. Silent; never asks for permission.
 */
export async function syncPush(): Promise<void> {
  if (!supported() || Notification.permission !== "granted") return;
  const subscription = await existingSubscription().catch(() => null);
  if (subscription) await send(subscription).catch(() => {});
}

/** The unread count on the installed app's icon, where supported. */
export function setAppBadge(count: number) {
  const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> }) : null;
  if (!nav?.setAppBadge) return;
  (count > 0 ? nav.setAppBadge(count) : nav.clearAppBadge!()).catch(() => {});
}
