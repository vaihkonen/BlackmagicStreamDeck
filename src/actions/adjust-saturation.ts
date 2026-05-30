import streamDeck, {
  action,
  type DialRotateEvent,
  type KeyDownEvent,
  SingletonAction,
  type WillAppearEvent,
  type WillDisappearEvent,
} from "@elgato/streamdeck";
import { getCameraClient } from "../camera/client-manager";

interface SatSettings {
  direction?: "up" | "down";
}

/**
 * Adjust colour saturation (0.0–2.0, default 1.0).
 * - Key button: ±0.05 per press in the configured direction.
 * - Encoder dial: rotate to adjust; clockwise = more saturated.
 *
 * All active instances are kept in sync.
 */
@action({ UUID: "com.juhani.blackmagic-camera.adjust-saturation" })
export class AdjustSaturationAction extends SingletonAction {
  private readonly contexts = new Map<string, WillAppearEvent["action"]>();

  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    this.contexts.set(ev.action.id, ev.action);
    await this.refresh(ev.action);
  }

  override async onWillDisappear(ev: WillDisappearEvent): Promise<void> {
    this.contexts.delete(ev.action.id);
  }

  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    const delta = (ev.payload.settings as SatSettings).direction === "down" ? -0.05 : 0.05;
    await this.adjust(ev.action, delta);
  }

  override async onDialRotate(ev: DialRotateEvent): Promise<void> {
    await this.adjust(ev.action, ev.payload.ticks * 0.05);
  }

  private async adjust(action: WillAppearEvent["action"], delta: number): Promise<void> {
    const client = await getCameraClient();
    if (!client) { await action.showAlert(); return; }
    try {
      const current = await client.getSaturation();
      const newSat = Math.max(0, Math.min(2, +(current + delta).toFixed(3)));
      await client.setSaturation(newSat);
      await this.broadcastDisplay(newSat);
    } catch (err) {
      streamDeck.logger.error(`Adjust saturation failed: ${err}`);
      await action.showAlert();
    }
  }

  private async refresh(action: WillAppearEvent["action"]): Promise<void> {
    const client = await getCameraClient();
    if (!client) return;
    try {
      const sat = await client.getSaturation();
      await this.updateDisplay(action, sat);
    } catch { /* camera may be offline */ }
  }

  private async broadcastDisplay(sat: number): Promise<void> {
    await Promise.all([...this.contexts.values()].map(ctx => this.updateDisplay(ctx, sat)));
  }

  private async updateDisplay(action: WillAppearEvent["action"], sat: number): Promise<void> {
    const display = sat.toFixed(2);
    if (action.isKey()) {
      await action.setTitle(`Sat\n${display}`);
    } else if (action.isDial()) {
      const pct = Math.round((sat / 2) * 100);
      await action.setFeedback({ title: "Saturation", value: display, indicator: pct });
    }
  }
}
