import streamDeck, {
  action,
  type KeyDownEvent,
  SingletonAction,
  type WillAppearEvent,
  type DidReceiveSettingsEvent,
} from "@elgato/streamdeck";
import { getCameraClient } from "../camera/client-manager";

const ISO_PRESETS = [100, 200, 400, 800, 1600, 3200, 6400, 12800, 25600];

/**
 * Sets a specific ISO value on the Blackmagic camera.
 * The target ISO is configured in the property inspector.
 */
@action({ UUID: "com.juhani.blackmagic-camera.set-iso" })
export class SetISOAction extends SingletonAction {
  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    const iso = (ev.payload.settings as { isoValue?: number }).isoValue ?? 800;
    await ev.action.setTitle(`ISO\n${iso}`);
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent): Promise<void> {
    const iso = (ev.payload.settings as { isoValue?: number }).isoValue ?? 800;
    await ev.action.setTitle(`ISO\n${iso}`);
  }

  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    const client = await getCameraClient();
    if (!client) {
      streamDeck.logger.warn("Set ISO: no camera configured.");
      await ev.action.showAlert();
      return;
    }

    const iso = (ev.payload.settings as { isoValue?: number }).isoValue;
    if (!iso || !ISO_PRESETS.includes(iso)) {
      streamDeck.logger.warn(`Set ISO: invalid ISO value ${iso}.`);
      await ev.action.showAlert();
      return;
    }

    try {
      await client.setISO(iso);
      await ev.action.setTitle(`ISO\n${iso}`);
    } catch (err) {
      streamDeck.logger.error(`Set ISO failed: ${err}`);
      await ev.action.showAlert();
    }
  }
}
