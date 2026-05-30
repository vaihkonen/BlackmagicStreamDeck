import streamDeck, {
  action,
  type DialRotateEvent,
  type KeyDownEvent,
  SingletonAction,
  type WillAppearEvent,
  type WillDisappearEvent,
} from "@elgato/streamdeck";
import { getCameraClient } from "../camera/client-manager";

interface ContrastSettings {
  direction?: "up" | "down";
}

/**
 * Adjust contrast (0.0–2.0, default 1.0).
 * - Key button: ±0.05 per press in the configured direction.
 * - Encoder dial: rotate to adjust; clockwise = more contrast.
 *
 * All active instances are kept in sync.
 */
@action({ UUID: "com.juhani.blackmagic-camera.adjust-contrast" })
export class AdjustContrastAction extends SingletonAction {
  private readonly contexts = new Map<string, WillAppearEvent["action"]>();

  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    this.contexts.set(ev.action.id, ev.action);
    await this.refresh(ev.action);
  }

  override async onWillDisappear(ev: WillDisappearEvent): Promise<void> {
    this.contexts.delete(ev.action.id);
  }

  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    const delta = (ev.payload.settings as ContrastSettings).direction === "down" ? -0.05 : 0.05;
    await this.adjust(ev.action, delta);
  }

  override async onDialRotate(ev: DialRotateEvent): Promise<void> {
    await this.adjust(ev.action, ev.payload.ticks * 0.05);
  }

  private async adjust(action: WillAppearEvent["action"], delta: number): Promise<void> {
    const client = await getCameraClient();
    if (!client) { await action.showAlert(); return; }
    try {
      const current = await client.getContrast();
      const newContrast = Math.max(0, Math.min(2, +(current + delta).toFixed(3)));
      await client.setContrast(newContrast);
      await this.broadcastDisplay(newContrast);
    } catch (err) {
      streamDeck.logger.error(`Adjust contrast failed: ${err}`);
      await action.showAlert();
    }
  }

  private async refresh(action: WillAppearEvent["action"]): Promise<void> {
    const client = await getCameraClient();
    if (!client) return;
    try {
      const contrast = await client.getContrast();
      await this.updateDisplay(action, contrast);
    } catch { /* camera may be offline */ }
  }

  private async broadcastDisplay(contrast: number): Promise<void> {
    await Promise.all([...this.contexts.values()].map(ctx => this.updateDisplay(ctx, contrast)));
  }

  private async updateDisplay(action: WillAppearEvent["action"], contrast: number): Promise<void> {
    const display = contrast.toFixed(2);
    if (action.isKey()) {
      await action.setTitle(`Cont\n${display}`);
    } else if (action.isDial()) {
      const pct = Math.round((contrast / 2) * 100);
      await action.setFeedback({ title: "Contrast", value: display, indicator: pct });
    }
  }
}
