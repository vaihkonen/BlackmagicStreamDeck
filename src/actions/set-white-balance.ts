import streamDeck, {
  action,
  type KeyDownEvent,
  SingletonAction,
  type WillAppearEvent,
  type DidReceiveSettingsEvent,
} from "@elgato/streamdeck";
import { getCameraClient } from "../camera/client-manager";

interface WhiteBalanceSettings {
  /** White balance in Kelvin (e.g. 5600) */
  kelvin: number;
}

/**
 * Sets a specific white balance value on the Blackmagic camera.
 * The target colour temperature (K) is configured in the property inspector.
 */
@action({ UUID: "com.juhani.blackmagic-camera.set-white-balance" })
export class SetWhiteBalanceAction extends SingletonAction {
  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    const kelvin = (ev.payload.settings as Partial<WhiteBalanceSettings>).kelvin;
    await this.updateTitle(ev.action, kelvin);
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent): Promise<void> {
    const kelvin = (ev.payload.settings as Partial<WhiteBalanceSettings>).kelvin;
    await this.updateTitle(ev.action, kelvin);
  }

  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    const client = await getCameraClient();
    if (!client) {
      streamDeck.logger.warn("Set WB: no camera configured.");
      await ev.action.showAlert();
      return;
    }

    const kelvin = (ev.payload.settings as Partial<WhiteBalanceSettings>).kelvin;
    if (!kelvin || kelvin < 2500 || kelvin > 10000) {
      streamDeck.logger.warn(`Set WB: invalid Kelvin value ${kelvin} (must be 2500–10000).`);
      await ev.action.showAlert();
      return;
    }

    try {
      await client.setWhiteBalance(kelvin);
      await this.updateTitle(ev.action, kelvin);
    } catch (err) {
      streamDeck.logger.error(`Set WB failed: ${err}`);
      await ev.action.showAlert();
    }
  }

  private async updateTitle(
    act: WillAppearEvent["action"],
    kelvin: number | undefined
  ): Promise<void> {
    const label = kelvin ? `${kelvin}K` : "WB";
    await act.setTitle(label);
  }
}
