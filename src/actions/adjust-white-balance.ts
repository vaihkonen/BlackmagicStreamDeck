import streamDeck, {
  action,
  type DialDownEvent,
  type DialRotateEvent,
  type KeyDownEvent,
  SingletonAction,
  type WillAppearEvent,
} from "@elgato/streamdeck";
import { getCameraClient } from "../camera/client-manager";

interface WBSettings {
  direction?: "up" | "down";
  step?: number; // Kelvin per step (default 100)
}

/**
 * Adjust white balance up or down.
 * - Key button: each press moves WB by the configured step in Kelvin.
 * - Encoder dial: rotate to adjust; clockwise = warmer (higher K).
 * - Encoder press: trigger auto white balance.
 */
@action({ UUID: "com.juhani.blackmagic-camera.adjust-white-balance" })
export class AdjustWhiteBalanceAction extends SingletonAction {
  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    await this.refresh(ev.action);
  }

  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    const s = ev.payload.settings as WBSettings;
    const step = s.step ?? 100;
    const dir = s.direction === "down" ? -step : step;
    await this.adjust(ev.action, dir);
  }

  override async onDialRotate(ev: DialRotateEvent): Promise<void> {
    const step = (ev.payload.settings as WBSettings).step ?? 100;
    await this.adjust(ev.action, ev.payload.ticks * step);
  }

  override async onDialDown(ev: DialDownEvent): Promise<void> {
    const client = await getCameraClient();
    if (!client) return;
    try {
      await client.doAutoWhiteBalance();
      await this.refresh(ev.action);
    } catch (err) {
      streamDeck.logger.error(`Auto WB failed: ${err}`);
    }
  }

  private async adjust(action: WillAppearEvent["action"], delta: number): Promise<void> {
    const client = await getCameraClient();
    if (!client) { await action.showAlert(); return; }
    try {
      const current = await client.getWhiteBalance();
      // Round to nearest 100K for clean values
      const newWB = Math.max(2500, Math.min(10000, Math.round((current + delta) / 100) * 100));
      await client.setWhiteBalance(newWB);
      await this.updateDisplay(action, newWB);
    } catch (err) {
      streamDeck.logger.error(`Adjust WB failed: ${err}`);
      await action.showAlert();
    }
  }

  private async refresh(action: WillAppearEvent["action"]): Promise<void> {
    const client = await getCameraClient();
    if (!client) return;
    try {
      const wb = await client.getWhiteBalance();
      await this.updateDisplay(action, wb);
    } catch { /* camera may be offline */ }
  }

  private async updateDisplay(action: WillAppearEvent["action"], kelvin: number): Promise<void> {
    if (action.isKey()) {
      await action.setTitle(`WB\n${kelvin}K`);
    } else if (action.isDial()) {
      const pct = Math.round(((kelvin - 2500) / (10000 - 2500)) * 100);
      await action.setFeedback({ title: "White Balance", value: `${kelvin}K`, indicator: pct });
    }
  }
}
