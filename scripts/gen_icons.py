#!/usr/bin/env python3
"""Generate placeholder icons for the Stream Deck plugin."""
import struct, zlib, os

BASE = os.path.join(os.path.dirname(__file__), '..', 'com.juhani.blackmagic-camera.sdPlugin', 'imgs')

def write_png(path, width, height, pixels):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    raw = b''
    for row in range(height):
        raw += b'\x00'
        for col in range(width):
            r, g, b, a = pixels[row * width + col]
            raw += bytes([r, g, b, a])
    def chunk(t, d):
        c = t + d
        return struct.pack('>I', len(d)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)  # RGBA
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(data)
    print(f'  wrote {os.path.relpath(path)}')

def svg(path, content, viewbox='0 0 72 72'):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}">\n{content}\n</svg>\n')
    print(f'  wrote {os.path.relpath(path)}')

DARK = '#1d1d1d'
WHITE = '#dcdcdc'
RED = '#e03c3c'
ORANGE = '#e08040'

# ── Plugin-level ─────────────────────────────────────────────────────────────

# category-icon.svg — camera outline
svg(f'{BASE}/plugin/category-icon.svg', f"""
  <rect width="72" height="72" fill="{DARK}"/>
  <!-- camera body -->
  <rect x="8" y="22" width="56" height="34" rx="4" fill="none" stroke="{WHITE}" stroke-width="3"/>
  <!-- viewfinder bump -->
  <rect x="24" y="14" width="18" height="10" rx="2" fill="none" stroke="{WHITE}" stroke-width="3"/>
  <!-- lens -->
  <circle cx="36" cy="39" r="11" fill="none" stroke="{WHITE}" stroke-width="3"/>
  <circle cx="36" cy="39" r="5" fill="none" stroke="{WHITE}" stroke-width="2"/>
  <!-- record dot -->
  <circle cx="55" cy="28" r="4" fill="{RED}"/>
""")

# marketplace.png — 144x144 camera logo PNG
def marketplace_pixels():
    px = []
    BG = (29, 29, 29, 255)
    W = (220, 220, 220, 255)
    R = (224, 60, 60, 255)
    N = 144
    for y in range(N):
        for x in range(N):
            # camera body rect 20..124 x 36..100
            in_body = (20 <= x <= 124) and (36 <= y <= 100)
            on_body_edge = (in_body and
                (x in (20,21,22,122,123,124) or y in (36,37,38,98,99,100)))
            # viewfinder bump 50..82 x 24..38
            in_bump = (50 <= x <= 82) and (24 <= y <= 38)
            on_bump_edge = (in_bump and
                (x in (50,51,80,81,82) or y in (24,25,36,37,38)))
            # lens circle cx=72 cy=68 r=20
            d2 = (x-72)**2 + (y-68)**2
            on_lens_outer = abs(d2 - 20**2) < 400
            on_lens_inner = abs(d2 - 10**2) < 200
            # record dot cx=105 cy=46 r=8
            on_dot = (x-105)**2 + (y-46)**2 <= 64
            if on_dot:
                px.append(R)
            elif on_body_edge or on_bump_edge or on_lens_outer or on_lens_inner:
                px.append(W)
            else:
                px.append(BG)
    return px

write_png(f'{BASE}/plugin/marketplace.png', 144, 144, marketplace_pixels())

# @2x high-resolution variant (288x288) — same design, double the pixels
def marketplace_pixels_2x():
    px = []
    BG = (29, 29, 29, 255)
    W = (220, 220, 220, 255)
    R = (224, 60, 60, 255)
    N = 288
    for y in range(N):
        for x in range(N):
            in_body = (40 <= x <= 248) and (72 <= y <= 200)
            on_body_edge = (in_body and
                (x in range(40, 46) or x in range(243, 249) or y in range(72, 78) or y in range(195, 201)))
            in_bump = (100 <= x <= 164) and (48 <= y <= 76)
            on_bump_edge = (in_bump and
                (x in range(100, 106) or x in range(159, 165) or y in range(48, 54) or y in range(70, 76)))
            d2 = (x - 144) ** 2 + (y - 136) ** 2
            on_lens_outer = abs(d2 - 40 ** 2) < 1600
            on_lens_inner = abs(d2 - 20 ** 2) < 800
            on_dot = (x - 210) ** 2 + (y - 92) ** 2 <= 256
            if on_dot:
                px.append(R)
            elif on_body_edge or on_bump_edge or on_lens_outer or on_lens_inner:
                px.append(W)
            else:
                px.append(BG)
    return px

write_png(f'{BASE}/plugin/marketplace@2x.png', 288, 288, marketplace_pixels_2x())

# ── Recording ─────────────────────────────────────────────────────────────────

svg(f'{BASE}/actions/recording/icon.svg', f"""
  <rect width="72" height="72" fill="{DARK}"/>
  <rect x="8" y="20" width="44" height="32" rx="3" fill="none" stroke="{WHITE}" stroke-width="3"/>
  <polygon points="56,22 64,36 56,50" fill="{WHITE}"/>
  <circle cx="30" cy="36" r="10" fill="none" stroke="{WHITE}" stroke-width="2.5"/>
  <circle cx="30" cy="36" r="4" fill="{WHITE}"/>
  <circle cx="54" cy="22" r="5" fill="{RED}"/>
""")

svg(f'{BASE}/actions/recording/key-idle.svg', f"""
  <rect width="72" height="72" fill="{DARK}"/>
  <circle cx="36" cy="30" r="14" fill="none" stroke="{WHITE}" stroke-width="3"/>
  <circle cx="36" cy="30" r="6" fill="{RED}"/>
  <text x="36" y="58" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="bold" fill="{WHITE}">REC</text>
""")

svg(f'{BASE}/actions/recording/key-active.svg', f"""
  <rect width="72" height="72" fill="#3a0000"/>
  <rect x="24" y="18" width="24" height="24" rx="3" fill="{RED}"/>
  <text x="36" y="58" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="bold" fill="{RED}">STOP</text>
""")

# ── ISO ───────────────────────────────────────────────────────────────────────

svg(f'{BASE}/actions/iso/icon.svg', f"""
  <rect width="72" height="72" fill="{DARK}"/>
  <text x="36" y="30" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" font-weight="bold" fill="{WHITE}">ISO</text>
  <line x1="14" y1="38" x2="58" y2="38" stroke="{WHITE}" stroke-width="2" opacity="0.4"/>
  <text x="36" y="54" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" font-weight="bold" fill="{WHITE}">▲▼</text>
""")

svg(f'{BASE}/actions/iso/key.svg', f"""
  <rect width="72" height="72" fill="{DARK}"/>
  <text x="36" y="30" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" font-weight="bold" fill="{WHITE}">ISO</text>
  <line x1="14" y1="38" x2="58" y2="38" stroke="{WHITE}" stroke-width="2" opacity="0.4"/>
  <text x="36" y="54" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" font-weight="bold" fill="{WHITE}">▲▼</text>
""")

# ── White Balance ─────────────────────────────────────────────────────────────

svg(f'{BASE}/actions/wb/icon.svg', f"""
  <rect width="72" height="72" fill="{DARK}"/>
  <circle cx="36" cy="28" r="10" fill="{ORANGE}"/>
  <line x1="36" y1="12" x2="36" y2="6" stroke="{ORANGE}" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="48" y1="16" x2="52" y2="12" stroke="{ORANGE}" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="52" y1="28" x2="58" y2="28" stroke="{ORANGE}" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="20" y1="28" x2="14" y2="28" stroke="{ORANGE}" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="24" y1="16" x2="20" y2="12" stroke="{ORANGE}" stroke-width="2.5" stroke-linecap="round"/>
  <text x="36" y="58" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="bold" fill="{WHITE}">WB ▲▼</text>
""")

svg(f'{BASE}/actions/wb/key.svg', f"""
  <rect width="72" height="72" fill="{DARK}"/>
  <circle cx="36" cy="28" r="10" fill="{ORANGE}"/>
  <line x1="36" y1="12" x2="36" y2="6" stroke="{ORANGE}" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="48" y1="16" x2="52" y2="12" stroke="{ORANGE}" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="52" y1="28" x2="58" y2="28" stroke="{ORANGE}" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="20" y1="28" x2="14" y2="28" stroke="{ORANGE}" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="24" y1="16" x2="20" y2="12" stroke="{ORANGE}" stroke-width="2.5" stroke-linecap="round"/>
  <text x="36" y="58" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="bold" fill="{WHITE}">WB ▲▼</text>
""")

# ── Shutter ───────────────────────────────────────────────────────────────────

svg(f'{BASE}/actions/shutter/icon.svg', f"""
  <rect width="72" height="72" fill="{DARK}"/>
  <circle cx="36" cy="32" r="16" fill="none" stroke="{WHITE}" stroke-width="3"/>
  <line x1="36" y1="18" x2="36" y2="46" stroke="{DARK}" stroke-width="3"/>
  <line x1="22" y1="24" x2="50" y2="40" stroke="{DARK}" stroke-width="3"/>
  <line x1="22" y1="40" x2="50" y2="24" stroke="{DARK}" stroke-width="3"/>
  <circle cx="36" cy="32" r="5" fill="{WHITE}"/>
  <text x="36" y="60" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" fill="{WHITE}">SHUTTER</text>
""")

svg(f'{BASE}/actions/shutter/key.svg', f"""
  <rect width="72" height="72" fill="{DARK}"/>
  <circle cx="36" cy="32" r="16" fill="none" stroke="{WHITE}" stroke-width="3"/>
  <line x1="36" y1="18" x2="36" y2="46" stroke="{DARK}" stroke-width="3"/>
  <line x1="22" y1="24" x2="50" y2="40" stroke="{DARK}" stroke-width="3"/>
  <line x1="22" y1="40" x2="50" y2="24" stroke="{DARK}" stroke-width="3"/>
  <circle cx="36" cy="32" r="5" fill="{WHITE}"/>
  <text x="36" y="60" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" fill="{WHITE}">SHUTTER</text>
""")

# ── Iris/Aperture ─────────────────────────────────────────────────────────────

svg(f'{BASE}/actions/iris/icon.svg', f"""
  <rect width="72" height="72" fill="{DARK}"/>
  <!-- aperture blades -->
  <circle cx="36" cy="34" r="18" fill="none" stroke="{WHITE}" stroke-width="2.5"/>
  <circle cx="36" cy="34" r="7" fill="none" stroke="{WHITE}" stroke-width="2"/>
  <!-- 6 blade lines -->
  <line x1="36" y1="16" x2="43" y2="52" stroke="{WHITE}" stroke-width="1.5" opacity="0.6"/>
  <line x1="36" y1="16" x2="29" y2="52" stroke="{WHITE}" stroke-width="1.5" opacity="0.6"/>
  <line x1="18" y1="43" x2="54" y2="25" stroke="{WHITE}" stroke-width="1.5" opacity="0.6"/>
  <line x1="18" y1="25" x2="54" y2="43" stroke="{WHITE}" stroke-width="1.5" opacity="0.6"/>
  <text x="36" y="62" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" fill="{WHITE}">IRIS</text>
""")

# ── Zoom ─────────────────────────────────────────────────────────────────────

svg(f'{BASE}/actions/zoom/icon.svg', f"""
  <rect width="72" height="72" fill="{DARK}"/>
  <!-- magnifying glass -->
  <circle cx="32" cy="30" r="14" fill="none" stroke="{WHITE}" stroke-width="3"/>
  <line x1="42" y1="41" x2="56" y2="56" stroke="{WHITE}" stroke-width="4" stroke-linecap="round"/>
  <!-- plus inside -->
  <line x1="32" y1="23" x2="32" y2="37" stroke="{WHITE}" stroke-width="2"/>
  <line x1="25" y1="30" x2="39" y2="30" stroke="{WHITE}" stroke-width="2"/>
  <text x="36" y="68" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" fill="{WHITE}">ZOOM</text>
""")

# ── Focus ─────────────────────────────────────────────────────────────────────

svg(f'{BASE}/actions/focus/icon.svg', f"""
  <rect width="72" height="72" fill="{DARK}"/>
  <!-- crosshair target -->
  <circle cx="36" cy="34" r="14" fill="none" stroke="{WHITE}" stroke-width="2.5"/>
  <circle cx="36" cy="34" r="4" fill="{WHITE}"/>
  <line x1="36" y1="14" x2="36" y2="22" stroke="{WHITE}" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="36" y1="46" x2="36" y2="54" stroke="{WHITE}" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="16" y1="34" x2="24" y2="34" stroke="{WHITE}" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="48" y1="34" x2="56" y2="34" stroke="{WHITE}" stroke-width="2.5" stroke-linecap="round"/>
  <text x="36" y="64" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" fill="{WHITE}">FOCUS</text>
""")

svg(f'{BASE}/actions/focus/key.svg', f"""
  <rect width="72" height="72" fill="{DARK}"/>
  <circle cx="36" cy="34" r="14" fill="none" stroke="{WHITE}" stroke-width="2.5"/>
  <circle cx="36" cy="34" r="4" fill="{WHITE}"/>
  <line x1="36" y1="14" x2="36" y2="22" stroke="{WHITE}" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="36" y1="46" x2="36" y2="54" stroke="{WHITE}" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="16" y1="34" x2="24" y2="34" stroke="{WHITE}" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="48" y1="34" x2="56" y2="34" stroke="{WHITE}" stroke-width="2.5" stroke-linecap="round"/>
  <text x="36" y="64" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" fill="{WHITE}">FOCUS</text>
""")

print("Done.")
