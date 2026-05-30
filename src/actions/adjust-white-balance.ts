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

interface WBSettings {
  direction?: "up" | "down";
}

/**
 * Adjust white balance up or down.
 * - Key button: each press moves WB by 100 K in the configured direction.
 * - Encoder dial: rotate to adjust; clockwise = warmer (higher K).
 * - Encoder press: trigger auto white balance.
 *
 * All active instances (e.g. two buttons: one up, one down) are kept in sync —
 * whenever any button changes the WB, every button refreshes its title.
 */
@action({ UUID: "com.juhani.blackmagic-camera.adjust-white-balance" })
export class AdjustWhiteBalanceAction extends SingletonAction {
  /** All currently visible action contexts keyed by context id */
  private readonly contexts = new Map<string, WillAppearEvent["action"]>();

  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    this.contexts.set(ev.action.id, ev.action);
    await this.refresh(ev.action);
  }

  override async onWillDisappear(ev: WillDisappearEvent): Promise<void> {
    this.contexts.delete(ev.action.id);
  }

  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    const dir = (ev.payload.settings as WBSettings).direction === "down" ? -100 : 100;
    await this.adjust(ev.action, dir);
  }

  override async onDialRotate(ev: DialRotateEvent): Promise<void> {
    await this.adjust(ev.action, ev.payload.ticks * 100);
  }

  override async onDialDown(ev: DialDownEvent): Promise<void> {
    const client = await getCameraClient();
    if (!client) return;
    try {
      await client.doAutoWhiteBalance();
      // Read back the new value and broadcast to all buttons
      const wb = await client.getWhiteBalance();
      await this.broadcastDisplay(wb);
    } catch (err) {
      streamDeck.logger.error(`Auto WB failed: ${err}`);
    }
  }

  private async adjust(action: WillAppearEvent["action"], delta: number): Promise<void> {
    const client = await getCameraClient();
    if (!client) { await action.showAlert(); return; }
    try {
      const current = await client.getWhiteBalance();
      const newWB = Math.max(2500, Math.min(10000, Math.round((current + delta) / 100) * 100));
      await client.setWhiteBalance(newWB);
      // Update every visible WB button, not just the one that was pressed
      await this.broadcastDisplay(newWB);
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

  /** Push a WB value to every currently visible instance of this action. */
  private async broadcastDisplay(kelvin: number): Promise<void> {
    await Promise.all([...this.contexts.values()].map(ctx => this.updateDisplay(ctx, kelvin)));
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
