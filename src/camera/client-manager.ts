/**
 * Camera client manager — holds a single shared BlackmagicClient instance
 * that is re-created whenever global plugin settings change.
 */

import streamDeck from "@elgato/streamdeck";
import { BlackmagicClient } from "./blackmagic-client";

export interface GlobalCameraSettings {
  cameraHost: string;
  cameraPort: number;
  useHttps: boolean;
  username: string;
  password: string;
}

// Module-level cache — populated by the onDidReceiveGlobalSettings listener
let storedSettings: Partial<GlobalCameraSettings> = {};
let cachedClient: BlackmagicClient | null = null;

/**
 * Called once during plugin startup.
 * Registers the global-settings listener and requests the current settings
 * so the cache is populated before the first button press.
 */
export function initClientManager(): void {
  streamDeck.settings.onDidReceiveGlobalSettings((ev) => {
    const incoming = ev.settings as Partial<GlobalCameraSettings>;
    const prev = JSON.stringify(storedSettings);
    storedSettings = incoming;

    if (JSON.stringify(incoming) !== prev) {
      // Invalidate the cached client whenever connection details change
      cachedClient = null;
      streamDeck.logger.info("Camera settings updated — client cache cleared.");
    }
  });

  // Kick off an immediate fetch so settings are ready as soon as possible
  streamDeck.settings.getGlobalSettings().then((s) => {
    storedSettings = s as Partial<GlobalCameraSettings>;
  }).catch(() => { /* ignore if not yet set */ });
}

/**
 * Returns (and caches) a BlackmagicClient built from the latest global
 * plugin settings.  Returns null if no camera host has been configured yet.
 *
 * Async so it can fetch settings from Stream Deck if they haven't arrived yet
 * (handles the race between plugin startup and the first button press).
 */
export async function getCameraClient(): Promise<BlackmagicClient | null> {
  if (cachedClient) return cachedClient;

  // If we don't have a host yet, pull settings directly — handles the case
  // where onDidReceiveGlobalSettings hasn't fired before the first key press.
  if (!storedSettings.cameraHost) {
    try {
      const s = await streamDeck.settings.getGlobalSettings();
      storedSettings = s as Partial<GlobalCameraSettings>;
      streamDeck.logger.info(`Fetched global settings on demand: host="${storedSettings.cameraHost}"`);
    } catch (err) {
      streamDeck.logger.warn(`Could not fetch global settings: ${err}`);
    }
  }

  const host = storedSettings.cameraHost?.trim();
  if (!host) {
    streamDeck.logger.warn(`No camera host configured. storedSettings=${JSON.stringify(storedSettings)}`);
    return null;
  }

  cachedClient = new BlackmagicClient({
    host,
    port: storedSettings.cameraPort ?? 443,
    useHttps: storedSettings.useHttps !== false,
    username: storedSettings.username ?? "",
    password: storedSettings.password ?? "",
    verifySSL: false,
  });

  return cachedClient;
}
