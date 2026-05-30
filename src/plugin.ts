import streamDeck from "@elgato/streamdeck";

import { initClientManager } from "./camera/client-manager";
import { ToggleRecordingAction } from "./actions/toggle-recording";
import { AdjustISOAction } from "./actions/adjust-iso";
import { AdjustWhiteBalanceAction } from "./actions/adjust-white-balance";
import { AdjustTintAction } from "./actions/adjust-tint";
import { AdjustShutterAction } from "./actions/adjust-shutter";
import { AdjustIrisAction } from "./actions/adjust-iris";
import { AdjustZoomAction } from "./actions/adjust-zoom";
import { AutoFocusAction } from "./actions/auto-focus";
import { AdjustGainAction } from "./actions/adjust-gain";
import { AdjustFocusAction } from "./actions/adjust-focus";
import { AdjustSaturationAction } from "./actions/adjust-saturation";
import { AdjustContrastAction } from "./actions/adjust-contrast";

// Initialise the global-settings listener before registering actions
initClientManager();

// Register all actions — must be done before streamDeck.connect()
streamDeck.actions.registerAction(new ToggleRecordingAction());
streamDeck.actions.registerAction(new AdjustISOAction());
streamDeck.actions.registerAction(new AdjustWhiteBalanceAction());
streamDeck.actions.registerAction(new AdjustTintAction());
streamDeck.actions.registerAction(new AdjustShutterAction());
streamDeck.actions.registerAction(new AdjustIrisAction());
streamDeck.actions.registerAction(new AdjustZoomAction());
streamDeck.actions.registerAction(new AutoFocusAction());
streamDeck.actions.registerAction(new AdjustGainAction());
streamDeck.actions.registerAction(new AdjustFocusAction());
streamDeck.actions.registerAction(new AdjustSaturationAction());
streamDeck.actions.registerAction(new AdjustContrastAction());

// Connect to Stream Deck
streamDeck.connect();

