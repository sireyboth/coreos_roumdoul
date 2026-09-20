import { ApiError } from "@/lib/api";

export type Coords = { latitude: number; longitude: number };

/** A one-off position reading. Resolves null — never throws — when it's unavailable, denied or times out. */
export function getPosition(timeoutMs = 10000): Promise<Coords | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs },
    );
  });
}

/**
 * Scans are fast — often faster than the phone can find its position. So the
 * scan is sent straight away, and only if the server says this site requires
 * a location (code "location_required") do we fetch one and try once more.
 * When no position can be had, the server's own message is shown, which tells
 * the employee what to turn on.
 */
export async function withLocationRetry<T, D extends Partial<Coords>>(call: (data: D) => Promise<T>, data: D): Promise<T> {
  try {
    return await call(data);
  } catch (err) {
    if (!(err instanceof ApiError) || err.code !== "location_required" || data.latitude !== undefined) throw err;

    const position = await getPosition();
    if (!position) throw err;

    return call({ ...data, ...position });
  }
}
