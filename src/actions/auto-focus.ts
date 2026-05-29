import streamDeck, {
  action,
  type KeyDownEvent,
  SingletonAction,
} from "@elgato/streamdeck";
import { getCameraClient } from "../camera/client-manager";

/**
 * Triggers auto focus on the Blackmagic camera.
 * Requires an electronic lens that supports AF via the REST API.
 */
@action({ UUID: "com.juhani.blackmagic-camera.auto-focus" })
export class AutoFocusAction extends SingletonAction {
  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    const client = await getCameraClient();
    if (!client) {
      streamDeck.logger.warn("Auto Focus: no camera configured.");
      await ev.action.showAlert();
      return;
    }

    try {
      await client.doAutoFocus();
    } catch (err) {
      streamDeck.logger.error(`Auto Focus failed: ${err}`);
      await ev.action.showAlert();
    }
  }
}
