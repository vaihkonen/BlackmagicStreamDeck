import streamDeck, {
  action,
  type DialRotateEvent,
  type KeyDownEvent,
  SingletonAction,
  type WillAppearEvent,
} from "@elgato/streamdeck";
import { getCameraClient } from "../camera/client-manager";

interface ZoomSettings {
  direction?: "up" | "down"; // up = tele (zoom in), down = wide (zoom out)
  step?: number; // normalised step per press (default 0.05 = 5%)
}

/**
 * Adjust lens zoom in or out.
 * - Key button: press to zoom in or out by the configured step.
 * - Encoder dial: rotate; clockwise = zoom in (tele).
 */
@action({ UUID: "com.juhani.blackmagic-camera.adjust-zoom" })
export class AdjustZoomAction extends SingletonAction {
  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    await this.refresh(ev.action);
  }

  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    const s = ev.payload.settings as ZoomSettings;
    const step = s.step ?? 0.05;
    const dir = s.direction === "down" ? -step : step;
    await this.adjust(ev.action, dir);
  }

  override async onDialRotate(ev: DialRotateEvent): Promise<void> {
    const step = (ev.payload.settings as ZoomSettings).step ?? 0.05;
    await this.adjust(ev.action, ev.payload.ticks * step);
  }

  private async adjust(action: WillAppearEvent["action"], delta: number): Promise<void> {
    const client = await getCameraClient();
    if (!client) { await action.showAlert(); return; }
    try {
      const zoom = await client.getLensZoom();
      const newNorm = Math.max(0.0, Math.min(1.0, zoom.normalised + delta));
      await client.setLensZoom(newNorm);
      await this.updateDisplay(action, newNorm, zoom.focalLength);
    } catch (err) {
      streamDeck.logger.error(`Adjust Zoom failed: ${err}`);
      await action.showAlert();
    }
  }

  private async refresh(action: WillAppearEvent["action"]): Promise<void> {
    const client = await getCameraClient();
    if (!client) return;
    try {
      const zoom = await client.getLensZoom();
      await this.updateDisplay(action, zoom.normalised, zoom.focalLength);
    } catch { /* camera may be offline */ }
  }

  private async updateDisplay(
    action: WillAppearEvent["action"],
    normalised: number,
    focalLength?: number
  ): Promise<void> {
    const label = focalLength !== undefined ? `${focalLength}mm` : `${Math.round(normalised * 100)}%`;
    const pct = Math.round(normalised * 100);
    if (action.isKey()) {
      await action.setTitle(`ZOOM\n${label}`);
    } else if (action.isDial()) {
      await action.setFeedback({ title: "Zoom", value: label, indicator: pct });
    }
  }
}
