import streamDeck, {
  action,
  type DialRotateEvent,
  type KeyDownEvent,
  SingletonAction,
  type WillAppearEvent,
} from "@elgato/streamdeck";
import { getCameraClient } from "../camera/client-manager";

interface ShutterSettings {
  direction?: "up" | "down"; // up = faster shutter (higher denominator / smaller angle)
}

/**
 * Adjust shutter speed or angle up or down through the camera's supported values.
 * - Key button: each press steps one value in the configured direction.
 * - Encoder dial: rotate to step; clockwise = faster shutter.
 */
@action({ UUID: "com.juhani.blackmagic-camera.adjust-shutter" })
export class AdjustShutterAction extends SingletonAction {
  private cachedSpeeds: number[] = [];
  private cachedAngles: number[] = [];

  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    await this.refresh(ev.action);
  }

  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    const dir = (ev.payload.settings as ShutterSettings).direction === "down" ? -1 : 1;
    await this.step(ev.action, dir);
  }

  override async onDialRotate(ev: DialRotateEvent): Promise<void> {
    await this.step(ev.action, ev.payload.ticks);
  }

  private async step(action: WillAppearEvent["action"], ticks: number): Promise<void> {
    const client = await getCameraClient();
    if (!client) { await action.showAlert(); return; }

    try {
      await this.ensureCache(client);
      const state = await client.getShutter();

      if (state.shutterSpeed !== undefined && this.cachedSpeeds.length > 0) {
        // Speed mode: sorted ascending (e.g. 50, 100, 200 …); up = higher denominator = faster
        let idx = this.cachedSpeeds.findIndex(v => v === state.shutterSpeed);
        if (idx < 0) idx = this.cachedSpeeds.findIndex(v => v >= (state.shutterSpeed ?? 50));
        if (idx < 0) idx = 0;
        const newIdx = Math.max(0, Math.min(this.cachedSpeeds.length - 1, idx + ticks));
        const newSpeed = this.cachedSpeeds[newIdx];
        await client.setShutterSpeed(newSpeed);
        await this.updateDisplay(action, `1/${newSpeed}`, newIdx, this.cachedSpeeds.length - 1);
      } else if (state.shutterAngle !== undefined && this.cachedAngles.length > 0) {
        // Angle mode: sorted ascending; up = larger angle = more motion blur
        let idx = this.cachedAngles.findIndex(v => Math.abs(v - (state.shutterAngle ?? 180)) < 0.5);
        if (idx < 0) idx = this.cachedAngles.findIndex(v => v >= (state.shutterAngle ?? 180));
        if (idx < 0) idx = 0;
        const newIdx = Math.max(0, Math.min(this.cachedAngles.length - 1, idx + ticks));
        const newAngle = this.cachedAngles[newIdx];
        await client.setShutterAngle(newAngle);
        await this.updateDisplay(action, `${newAngle}°`, newIdx, this.cachedAngles.length - 1);
      } else {
        await action.showAlert();
      }
    } catch (err) {
      streamDeck.logger.error(`Adjust Shutter failed: ${err}`);
      await action.showAlert();
    }
  }

  private async refresh(action: WillAppearEvent["action"]): Promise<void> {
    const client = await getCameraClient();
    if (!client) return;
    try {
      await this.ensureCache(client);
      const state = await client.getShutter();
      if (state.shutterSpeed !== undefined) {
        const idx = Math.max(0, this.cachedSpeeds.findIndex(v => v >= (state.shutterSpeed ?? 0)));
        await this.updateDisplay(action, `1/${state.shutterSpeed}`, idx, Math.max(1, this.cachedSpeeds.length - 1));
      } else if (state.shutterAngle !== undefined) {
        const idx = Math.max(0, this.cachedAngles.findIndex(v => v >= (state.shutterAngle ?? 0)));
        await this.updateDisplay(action, `${state.shutterAngle}°`, idx, Math.max(1, this.cachedAngles.length - 1));
      }
    } catch { /* camera may be offline */ }
  }

  private async ensureCache(client: Awaited<ReturnType<typeof getCameraClient>> & object): Promise<void> {
    if (this.cachedSpeeds.length === 0 && this.cachedAngles.length === 0) {
      const supported = await client.getSupportedShutters();
      this.cachedSpeeds = supported.shutterSpeeds.sort((a, b) => a - b);
      this.cachedAngles = supported.shutterAngles.sort((a, b) => a - b);
    }
  }

  private async updateDisplay(
    action: WillAppearEvent["action"],
    label: string,
    idx: number,
    maxIdx: number
  ): Promise<void> {
    if (action.isKey()) {
      await action.setTitle(`SHTR\n${label}`);
    } else if (action.isDial()) {
      const pct = maxIdx > 0 ? Math.round((idx / maxIdx) * 100) : 50;
      await action.setFeedback({ title: "Shutter", value: label, indicator: pct });
    }
  }
}
