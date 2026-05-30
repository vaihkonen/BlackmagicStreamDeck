import streamDeck, {
  action,
  type DialDownEvent,
  type DialRotateEvent,
  type KeyDownEvent,
  SingletonAction,
  type WillAppearEvent,
  type WillDisappearEvent,
} from "@elgato/streamdeck";
import { getCameraClient } from "../camera/client-manager";

interface FocusSettings {
  /** "near" = closer, "far" = further */
  direction?: "near" | "far";
}

/**
 * Manual focus pull using normalised lens focus (0.0 = near, 1.0 = far).
 * - Key button: step 5% in the configured direction.
 * - Encoder dial: rotate to pull focus; clockwise = further.
 * - Encoder press: trigger auto focus.
 *
 * All active instances are kept in sync.
 */
@action({ UUID: "com.juhani.blackmagic-camera.adjust-focus" })
export class AdjustFocusAction extends SingletonAction {
  private readonly contexts = new Map<string, WillAppearEvent["action"]>();

  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    this.contexts.set(ev.action.id, ev.action);
    await this.refresh(ev.action);
  }

  override async onWillDisappear(ev: WillDisappearEvent): Promise<void> {
    this.contexts.delete(ev.action.id);
  }

  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    const dir = (ev.payload.settings as FocusSettings).direction === "near" ? -0.05 : 0.05;
    await this.adjust(ev.action, dir);
  }

  override async onDialRotate(ev: DialRotateEvent): Promise<void> {
    // Clockwise = further (higher normalised value)
    await this.adjust(ev.action, ev.payload.ticks * 0.05);
  }

  override async onDialDown(ev: DialDownEvent): Promise<void> {
    const client = await getCameraClient();
    if (!client) return;
    try {
      await client.doAutoFocus();
      await this.refresh(ev.action);
    } catch (err) {
      streamDeck.logger.error(`Auto focus failed: ${err}`);
    }
  }

  private async adjust(action: WillAppearEvent["action"], delta: number): Promise<void> {
    const client = await getCameraClient();
    if (!client) { await action.showAlert(); return; }
    try {
      const current = await client.getLensFocus();
      const newFocus = Math.max(0, Math.min(1, +(current + delta).toFixed(3)));
      await client.setLensFocus(newFocus);
      await this.broadcastDisplay(newFocus);
    } catch (err) {
      streamDeck.logger.error(`Adjust focus failed: ${err}`);
      await action.showAlert();
    }
  }

  private async refresh(action: WillAppearEvent["action"]): Promise<void> {
    const client = await getCameraClient();
    if (!client) return;
    try {
      const f = await client.getLensFocus();
      await this.updateDisplay(action, f);
    } catch { /* camera may be offline */ }
  }

  private async broadcastDisplay(normalised: number): Promise<void> {
    await Promise.all([...this.contexts.values()].map(ctx => this.updateDisplay(ctx, normalised)));
  }

  private async updateDisplay(action: WillAppearEvent["action"], normalised: number): Promise<void> {
    const pct = Math.round(normalised * 100);
    if (action.isKey()) {
      await action.setTitle(`Focus\n${pct}%`);
    } else if (action.isDial()) {
      await action.setFeedback({ title: "Focus", value: `${pct}%`, indicator: pct });
    }
  }
}
