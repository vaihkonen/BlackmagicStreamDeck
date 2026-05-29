/**
 * Shared Stream Deck property inspector helpers.
 * Provides lightweight wrappers around the WebSocket protocol used
 * by all Blackmagic Camera property inspector pages.
 */

/* global connectElgatoStreamDeckSocket */

(function () {
  "use strict";

  let _ws = null;
  let _uuid = null;
  let _onSettings = null;
  let _onGlobalSettings = null;
  let _currentActionSettings = {};
  let _currentGlobalSettings = {};

  /**
   * Called by Stream Deck when the property inspector is opened.
   * This global function name is required by the SDK protocol.
   */
  window.connectElgatoStreamDeckSocket = function (
    port,
    uuid,
    registerEvent,
    _info,
    actionInfo
  ) {
    _uuid = uuid;

    try {
      const parsed = JSON.parse(actionInfo);
      _currentActionSettings = parsed.payload?.settings ?? {};
    } catch (_e) {
      _currentActionSettings = {};
    }

    _ws = new WebSocket("ws://127.0.0.1:" + port);

    _ws.onopen = function () {
      // Register this property inspector with Stream Deck
      send({ event: registerEvent, uuid });
      // Request the current global (plugin-level) settings
      send({ event: "getGlobalSettings", context: uuid });
    };

    _ws.onmessage = function (evt) {
      let msg;
      try {
        msg = JSON.parse(evt.data);
      } catch (_e) {
        return;
      }

      if (msg.event === "didReceiveSettings") {
        _currentActionSettings = msg.payload?.settings ?? {};
        if (typeof _onSettings === "function") _onSettings(_currentActionSettings);
      } else if (msg.event === "didReceiveGlobalSettings") {
        _currentGlobalSettings = msg.payload?.settings ?? {};
        if (typeof _onGlobalSettings === "function")
          _onGlobalSettings(_currentGlobalSettings);
      }
    };
  };

  function send(obj) {
    if (_ws && _ws.readyState === WebSocket.OPEN) {
      _ws.send(JSON.stringify(obj));
    }
  }

  /** Save per-action settings */
  window.sdSaveSettings = function (settings) {
    _currentActionSettings = settings;
    send({ event: "setSettings", context: _uuid, payload: settings });
  };

  /** Save global (plugin-level) settings */
  window.sdSaveGlobalSettings = function (settings) {
    _currentGlobalSettings = settings;
    send({ event: "setGlobalSettings", context: _uuid, payload: settings });
  };

  /** Register a callback for when action settings arrive */
  window.sdOnSettings = function (cb) {
    _onSettings = cb;
    // Fire immediately with cached value if we already have settings
    if (Object.keys(_currentActionSettings).length > 0) cb(_currentActionSettings);
  };

  /** Register a callback for when global settings arrive */
  window.sdOnGlobalSettings = function (cb) {
    _onGlobalSettings = cb;
    if (Object.keys(_currentGlobalSettings).length > 0) cb(_currentGlobalSettings);
  };

  /** Get the current action settings (synchronous snapshot) */
  window.sdGetSettings = function () {
    return _currentActionSettings;
  };

  /** Get the current global settings (synchronous snapshot) */
  window.sdGetGlobalSettings = function () {
    return _currentGlobalSettings;
  };
})();
