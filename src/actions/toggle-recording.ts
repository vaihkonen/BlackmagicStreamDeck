import streamDeck, {
  action,
  type KeyDownEvent,
  SingletonAction,
  type WillAppearEvent,
} from "@elgato/streamdeck";
import { getCameraClient } from "../camera/client-manager";

/**
 * Toggles recording on the Blackmagic camera.
 *
 * State 0 = idle (not recording)
 * State 1 = recording
 */
@action({ UUID: "com.juhani.blackmagic-camera.toggle-recording" })
export class ToggleRecordingAction extends SingletonAction {
  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    await this.syncState(ev.action);
  }

  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    const client = await getCameraClient();
    if (!client) {
      streamDeck.logger.warn("Toggle Recording: no camera configured.");
      await ev.action.showAlert();
      return;
    }

    try {
      const { recording } = await client.getTransportStatus();
      if (recording) {
        await client.stopRecording();
        await ev.action.setState(0);
        await ev.action.setTitle("REC");
      } else {
        await client.startRecording();
        await ev.action.setState(1);
        await ev.action.setTitle("STOP");
      }
    } catch (err) {
      streamDeck.logger.error(`Toggle Recording failed: ${err}`);
      await ev.action.showAlert();
    }
  }

  private async syncState(act: WillAppearEvent["action"]): Promise<void> {
    if (!act.isKey()) return;
    const client = await getCameraClient();
    if (!client) return;

    try {
      const { recording } = await client.getTransportStatus();
      await act.setState(recording ? 1 : 0);
      await act.setTitle(recording ? "STOP" : "REC");
    } catch {
      // Camera may be unreachable on startup — silently ignore
    }
  }
}
