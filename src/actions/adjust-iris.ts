import streamDeck, {
  action,
  type DialRotateEvent,
  type KeyDownEvent,
  SingletonAction,
  type WillAppearEvent,
} from "@elgato/streamdeck";
import { getCameraClient } from "../camera/client-manager";

interface IrisSettings {
  direction?: "up" | "down"; // up = open (lower f-number), down = close
  step?: number; // adjustmentStep magnitude (default 1)
}

/**
 * Adjust lens iris (aperture) open or closed.
 * Uses the camera's own relative adjustmentStep API so the camera handles
 * the actual f-stop calculations.
 * - Key button: press to open (+) or close (-) aperture.
 * - Encoder dial: rotate; clockwise = open aperture.
 */
@action({ UUID: "com.juhani.blackmagic-camera.adjust-iris" })
export class AdjustIrisAction extends SingletonAction {
  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    await this.refresh(ev.action);
  }

  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    const s = ev.payload.settings as IrisSettings;
    const step = s.step ?? 1;
    const dir = s.direction === "down" ? -step : step;
    await this.adjust(ev.action, dir);
  }

  override async onDialRotate(ev: DialRotateEvent): Promise<void> {
    const step = (ev.payload.settings as IrisSettings).step ?? 1;
    await this.adjust(ev.action, ev.payload.ticks * step);
  }

  private async adjust(action: WillAppearEvent["action"], adjustmentStep: number): Promise<void> {
    const client = await getCameraClient();
    if (!client) { await action.showAlert(); return; }
    try {
      await client.adjustIris(adjustmentStep);
      await this.refresh(action);
    } catch (err) {
      streamDeck.logger.error(`Adjust Iris failed: ${err}`);
      await action.showAlert();
    }
  }

  private async refresh(action: WillAppearEvent["action"]): Promise<void> {
    const client = await getCameraClient();
    if (!client) return;
    try {
      const iris = await client.getLensIris();
      const label = iris.apertureStop !== undefined
        ? `f/${iris.apertureStop.toFixed(1)}`
        : `${Math.round(iris.normalised * 100)}%`;
      if (action.isKey()) {
        await action.setTitle(`IRIS\n${label}`);
      } else if (action.isDial()) {
        const pct = Math.round(iris.normalised * 100);
        await action.setFeedback({ title: "Iris", value: label, indicator: pct });
      }
    } catch { /* camera may be offline */ }
  }
}
