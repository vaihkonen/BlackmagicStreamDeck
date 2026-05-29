import streamDeck, {
  action,
  type KeyDownEvent,
  SingletonAction,
  type WillAppearEvent,
  type DidReceiveSettingsEvent,
} from "@elgato/streamdeck";
import { getCameraClient } from "../camera/client-manager";

interface ShutterSettings {
  /** Denominator of 1/x shutter speed (e.g. 50 means 1/50 s) */
  shutterDenominator: number;
}

/**
 * Sets a specific shutter speed on the Blackmagic camera.
 * The target speed (as 1/x denominator) is configured in the property inspector.
 */
@action({ UUID: "com.juhani.blackmagic-camera.set-shutter" })
export class SetShutterAction extends SingletonAction {
  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    const denom = (ev.payload.settings as Partial<ShutterSettings>).shutterDenominator;
    await this.updateTitle(ev.action, denom);
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent): Promise<void> {
    const denom = (ev.payload.settings as Partial<ShutterSettings>).shutterDenominator;
    await this.updateTitle(ev.action, denom);
  }

  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    const client = await getCameraClient();
    if (!client) {
      streamDeck.logger.warn("Set Shutter: no camera configured.");
      await ev.action.showAlert();
      return;
    }

    const denom = (ev.payload.settings as Partial<ShutterSettings>).shutterDenominator;
    if (!denom || denom < 1) {
      streamDeck.logger.warn(`Set Shutter: invalid denominator ${denom}.`);
      await ev.action.showAlert();
      return;
    }

    try {
      await client.setShutterSpeed(denom);
      await this.updateTitle(ev.action, denom);
    } catch (err) {
      streamDeck.logger.error(`Set Shutter failed: ${err}`);
      await ev.action.showAlert();
    }
  }

  private async updateTitle(
    act: WillAppearEvent["action"],
    denom: number | undefined
  ): Promise<void> {
    const label = denom ? `1/${denom}` : "Shutter";
    await act.setTitle(label);
  }
}
