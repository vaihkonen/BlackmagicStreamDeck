# Blackmagic Camera — Stream Deck Plugin

Control your Blackmagic camera directly from your Stream Deck.

## Available Actions

| Action | What it does |
|---|---|
| **Toggle Recording** | Start / stop recording. Button shows REC (idle) or STOP (recording) |
| **Set ISO** | Set the camera's ISO to a preset value (100 – 25600) |
| **Set Shutter Speed** | Set the camera's shutter speed (1/25 – 1/2000 s) |
| **Set White Balance** | Set the camera's white balance (preset or custom Kelvin) |
| **Auto Focus** | Trigger AF (requires an electronic, AF-capable lens) |

---

## Prerequisites

- [Node.js](https://nodejs.org/) 20 or higher
- [Stream Deck](https://www.elgato.com/downloads) 6.6 or higher
- Stream Deck device (or Stream Deck Mobile)
- Stream Deck CLI: `npm install -g @elgato/cli`
- Your Blackmagic camera on the same network (connected via Ethernet or Wi-Fi)

---

## Getting Started

### 1. Install dependencies

```bash
cd BlackmagicStreamDeck
npm install
```

### 2. Build the plugin

```bash
npm run build
```

### 3. Install the plugin in Stream Deck

The `.sdPlugin` folder (`com.juhani.blackmagic-camera.sdPlugin`) is the
compiled plugin package. Copy or symlink it to the Stream Deck plugins directory:

**macOS:**
```bash
cp -r com.juhani.blackmagic-camera.sdPlugin \
  ~/Library/Application\ Support/com.elgato.StreamDeck/Plugins/
```

**Windows:**
```
%APPDATA%\Elgato\StreamDeck\Plugins\
```

Restart Stream Deck after copying.

### 4. Configure camera connection

Drag any action onto your Stream Deck canvas and click it to open the
property inspector on the right. Fill in:

| Field | Example |
|---|---|
| **Host** | `juhaninmicro.local` or an IP address |
| **Port** | `443` (HTTPS default) |
| **Username** | your camera username |
| **Password** | your camera password |
| **Use HTTPS** | ✓ (recommended) |

Camera connection settings are **shared** across all actions — update them in
any property inspector and they apply everywhere.

---

## Development (hot-reload)

```bash
npm run watch
```

Any change to `./src` automatically rebuilds the plugin and restarts it in
Stream Deck.

---

## Project Structure

```
BlackmagicStreamDeck/
├── com.juhani.blackmagic-camera.sdPlugin/   ← compiled plugin (deploy this)
│   ├── bin/                                 ← compiled JS (generated)
│   ├── imgs/                                ← action icons
│   ├── ui/                                  ← property inspector HTML/CSS/JS
│   │   ├── sdpi.css
│   │   ├── sdpi.js
│   │   ├── toggle-recording.html
│   │   ├── set-iso.html
│   │   ├── set-shutter.html
│   │   ├── set-white-balance.html
│   │   └── auto-focus.html
│   └── manifest.json
├── src/
│   ├── camera/
│   │   ├── blackmagic-client.ts             ← HTTPS REST client
│   │   └── client-manager.ts               ← shared client w/ global settings
│   ├── actions/
│   │   ├── toggle-recording.ts
│   │   ├── set-iso.ts
│   │   ├── set-shutter.ts
│   │   ├── set-white-balance.ts
│   │   └── auto-focus.ts
│   └── plugin.ts                           ← entry point
├── package.json
├── rollup.config.mjs
└── tsconfig.json
```

---

## Icons

The `imgs/` folders are placeholders. Replace each `icon.png` and `key.png`
with 72×72 and 144×144 (2×) PNG files. Elgato's UX guidelines recommend a
white icon on a transparent background.

Refer to the [Elgato icon resources](https://docs.elgato.com/resources/icons)
for downloadable base templates.

---

## Camera API Reference

This plugin uses the Blackmagic Camera REST API (`/control/api/v1/`):

| Operation | Endpoint |
|---|---|
| Transport status | `GET /transports/0` |
| Toggle recording | `PUT /transports/0/record` |
| ISO | `PUT /video/iso` |
| Shutter speed | `PUT /video/shutter` |
| White balance | `PUT /video/whiteBalance` |
| Auto focus | `PUT /lens/focus/doAutoFocus` |

SSL certificate verification is disabled to handle the camera's self-signed
certificate, matching the behaviour of the original Python project.

---

## Related Project

[BlackmagicMicroControl](../BlackmagicMicroControl/) — the original Python/Tkinter
desktop app that this plugin is based on.
