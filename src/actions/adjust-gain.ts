import streamDeck, {
  action,
  type DialRotateEvent,
  type KeyDownEvent,
  SingletonAction,
  type WillAppearEvent,
  type WillDisappearEvent,
} from "@elgato/streamdeck";
import { getCameraClient } from "../camera/client-manager";

interface GainSettings {
  direction?: "up" | "down";
}

/**
 * Adjust gain (dB) by stepping through the camera's supported gain values.
 * - Key button: step one value in the configured direction.
 * - Encoder dial: rotate to step; clockwise = higher gain.
 *
 * All active instances are kept in sync.
 */
@action({ UUID: "com.juhani.blackmagic-camera.adjust-gain" })
export class AdjustGainAction extends SingletonAction {
  private cachedGains: number[] = [];
  private readonly contexts = new Map<string, WillAppearEvent["action"]>();

  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    this.contexts.set(ev.action.id, ev.action);
    await this.refresh(ev.action);
  }

  override async onWillDisappear(ev: WillDisappearEvent): Promise<void> {
    this.contexts.delete(ev.action.id);
  }

  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    const dir = (ev.payload.settings as GainSettings).direction === "down" ? -1 : 1;
    await this.step(ev.action, dir);
  }

  override async onDialRotate(ev: DialRotateEvent): Promise<void> {
    await this.step(ev.action, ev.payload.ticks);
  }

  private async step(action: WillAppearEvent["action"], ticks: number): Promise<void> {
    const client = await getCameraClient();
    if (!client) { await action.showAlert(); return; }
    try {
      if (this.cachedGains.length === 0) {
        this.cachedGains = (await client.getSupportedGains()).sort((a, b) => a - b);
      }
      if (this.cachedGains.length === 0) { await action.showAlert(); return; }

      const current = await client.getGain();
      let idx = this.cachedGains.findIndex(v => v === current);
      if (idx < 0) idx = this.cachedGains.findIndex(v => v >= current);
      if (idx < 0) idx = this.cachedGains.length - 1;

      const newIdx = Math.max(0, Math.min(this.cachedGains.length - 1, idx + ticks));
      const newGain = this.cachedGains[newIdx];
      await client.setGain(newGain);
      await this.broadcastDisplay(newGain, newIdx, this.cachedGains.length - 1);
    } catch (err) {
      streamDeck.logger.error(`Adjust gain failed: ${err}`);
      await action.showAlert();
    }
  }

  private async refresh(action: WillAppearEvent["action"]): Promise<void> {
    const client = await getCameraClient();
    if (!client) return;
    try {
      if (this.cachedGains.length === 0) {
        this.cachedGains = (await client.getSupportedGains()).sort((a, b) => a - b);
      }
      const current = await client.getGain();
      const idx = Math.max(0, this.cachedGains.findIndex(v => v >= current));
      await this.updateDisplay(action, current, idx, Math.max(1, this.cachedGains.length - 1));
    } catch { /* camera may be offline */ }
  }

  private async broadcastDisplay(dB: number, idx: number, maxIdx: number): Promise<void> {
    await Promise.all([...this.contexts.values()].map(ctx => this.updateDisplay(ctx, dB, idx, maxIdx)));
  }

  private async updateDisplay(
    action: WillAppearEvent["action"],
    dB: number,
    idx: number,
    maxIdx: number
  ): Promise<void> {
    if (action.isKey()) {
      await action.setTitle(`Gain\n${dB}dB`);
    } else if (action.isDial()) {
      const pct = maxIdx > 0 ? Math.round((idx / maxIdx) * 100) : 50;
      await action.setFeedback({ title: "Gain", value: `${dB} dB`, indicator: pct });
    }
  }
}
