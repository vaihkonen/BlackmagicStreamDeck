import streamDeck, {
  action,
  type DialRotateEvent,
  type KeyDownEvent,
  SingletonAction,
  type WillAppearEvent,
} from "@elgato/streamdeck";
import { getCameraClient } from "../camera/client-manager";

interface ISOSettings {
  direction?: "up" | "down";
}

/**
 * Adjust ISO up or down.
 * - Key button: each press steps one ISO value in the configured direction.
 * - Encoder dial: rotate to step through ISO values; clockwise = higher ISO.
 */
@action({ UUID: "com.juhani.blackmagic-camera.adjust-iso" })
export class AdjustISOAction extends SingletonAction {
  private cachedISOs: number[] = [];

  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    await this.refresh(ev.action);
  }

  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    const dir = (ev.payload.settings as ISOSettings).direction === "down" ? -1 : 1;
    await this.step(ev.action, dir);
  }

  override async onDialRotate(ev: DialRotateEvent): Promise<void> {
    await this.step(ev.action, ev.payload.ticks);
  }

  private async step(action: WillAppearEvent["action"], ticks: number): Promise<void> {
    const client = await getCameraClient();
    if (!client) { await action.showAlert(); return; }

    try {
      if (this.cachedISOs.length === 0) {
        this.cachedISOs = (await client.getSupportedISOs()).sort((a, b) => a - b);
      }
      if (this.cachedISOs.length === 0) { await action.showAlert(); return; }

      const current = await client.getISO();
      let idx = this.cachedISOs.findIndex(v => v === current);
      if (idx < 0) idx = this.cachedISOs.findIndex(v => v >= current);
      if (idx < 0) idx = this.cachedISOs.length - 1;

      const newIdx = Math.max(0, Math.min(this.cachedISOs.length - 1, idx + ticks));
      const newISO = this.cachedISOs[newIdx];
      await client.setISO(newISO);
      await this.updateDisplay(action, newISO, newIdx, this.cachedISOs.length - 1);
    } catch (err) {
      streamDeck.logger.error(`Adjust ISO failed: ${err}`);
      await action.showAlert();
    }
  }

  private async refresh(action: WillAppearEvent["action"]): Promise<void> {
    const client = await getCameraClient();
    if (!client) return;
    try {
      if (this.cachedISOs.length === 0) {
        this.cachedISOs = (await client.getSupportedISOs()).sort((a, b) => a - b);
      }
      const current = await client.getISO();
      const idx = Math.max(0, this.cachedISOs.findIndex(v => v >= current));
      await this.updateDisplay(action, current, idx, Math.max(1, this.cachedISOs.length - 1));
    } catch { /* camera may be offline on startup */ }
  }

  private async updateDisplay(
    action: WillAppearEvent["action"],
    iso: number,
    idx: number,
    maxIdx: number
  ): Promise<void> {
    if (action.isKey()) {
      await action.setTitle(`ISO\n${iso}`);
    } else if (action.isDial()) {
      const pct = maxIdx > 0 ? Math.round((idx / maxIdx) * 100) : 50;
      await action.setFeedback({ title: "ISO", value: String(iso), indicator: pct });
    }
  }
}
