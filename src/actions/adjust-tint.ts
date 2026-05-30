import streamDeck, {
  action,
  type DialRotateEvent,
  type KeyDownEvent,
  SingletonAction,
  type WillAppearEvent,
  type WillDisappearEvent,
} from "@elgato/streamdeck";
import { getCameraClient } from "../camera/client-manager";

interface TintSettings {
  direction?: "up" | "down";
}

/**
 * Adjust white balance tint (green/magenta offset, -50 to +50).
 * - Key button: each press moves tint by 1 step in the configured direction.
 * - Encoder dial: rotate to adjust; clockwise = more magenta (positive).
 *
 * All active instances are kept in sync — any change updates every visible button.
 */
@action({ UUID: "com.juhani.blackmagic-camera.adjust-tint" })
export class AdjustTintAction extends SingletonAction {
  private readonly contexts = new Map<string, WillAppearEvent["action"]>();

  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    this.contexts.set(ev.action.id, ev.action);
    await this.refresh(ev.action);
  }

  override async onWillDisappear(ev: WillDisappearEvent): Promise<void> {
    this.contexts.delete(ev.action.id);
  }

  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    const delta = (ev.payload.settings as TintSettings).direction === "down" ? -1 : 1;
    await this.adjust(ev.action, delta);
  }

  override async onDialRotate(ev: DialRotateEvent): Promise<void> {
    await this.adjust(ev.action, ev.payload.ticks);
  }

  private async adjust(action: WillAppearEvent["action"], delta: number): Promise<void> {
    const client = await getCameraClient();
    if (!client) { await action.showAlert(); return; }
    try {
      const current = await client.getWhiteBalanceTint();
      const newTint = Math.max(-50, Math.min(50, current + delta));
      await client.setWhiteBalanceTint(newTint);
      await this.broadcastDisplay(newTint);
    } catch (err) {
      streamDeck.logger.error(`Adjust tint failed: ${err}`);
      await action.showAlert();
    }
  }

  private async refresh(action: WillAppearEvent["action"]): Promise<void> {
    const client = await getCameraClient();
    if (!client) return;
    try {
      const tint = await client.getWhiteBalanceTint();
      await this.updateDisplay(action, tint);
    } catch { /* camera may be offline */ }
  }

  private async broadcastDisplay(tint: number): Promise<void> {
    await Promise.all([...this.contexts.values()].map(ctx => this.updateDisplay(ctx, tint)));
  }

  private async updateDisplay(action: WillAppearEvent["action"], tint: number): Promise<void> {
    const sign = tint > 0 ? "+" : "";
    if (action.isKey()) {
      await action.setTitle(`Tint\n${sign}${tint}`);
    } else if (action.isDial()) {
      // Map -50…+50 to 0…100 for the indicator bar
      const pct = Math.round(((tint + 50) / 100) * 100);
      await action.setFeedback({ title: "Tint", value: `${sign}${tint}`, indicator: pct });
    }
  }
}
