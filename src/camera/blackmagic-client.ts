/**
 * Blackmagic Camera REST API client for Node.js.
 * Mirrors the Python BlackmagicAPIClient from the BlackmagicMicroControl project,
 * using Node.js built-in https/http modules with SSL verification disabled
 * to handle the camera's self-signed certificate.
 */

import https from "https";
import http from "http";
import dns from "dns";
import { execFile } from "child_process";
import { promisify } from "util";
import streamDeck from "@elgato/streamdeck";

const dnsLookup = promisify(dns.lookup);

export interface CameraConfig {
  host: string;
  port?: number;
  useHttps?: boolean;
  username: string;
  password: string;
  verifySSL?: boolean;
  timeout?: number;
}

export interface TransportStatus {
  recording: boolean;
  /** Raw mode string: "InputPreview", "InputRecord", or "Output" */
  mode: string;
}

export interface ShutterState {
  shutterSpeed?: number;  // denominator of 1/x (e.g. 50 → 1/50 s)
  shutterAngle?: number;  // degrees (1.0–360.0)
  continuousShutterAutoExposure: boolean;
}

export class BlackmagicClient {
  private readonly config: Required<CameraConfig>;
  private resolvedHost: string | null = null;

  constructor(config: CameraConfig) {
    this.config = {
      port: config.useHttps !== false ? 443 : 80,
      useHttps: true,
      verifySSL: false,
      timeout: 10000,
      ...config,
    };
  }

  /** Resolve .local mDNS hostname to an IP address. */
  private async getHost(): Promise<string> {
    if (this.resolvedHost) return this.resolvedHost;

    const host = this.config.host;

    // Plain IP address — use directly
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
      this.resolvedHost = host;
      return host;
    }

    if (host.endsWith(".local")) {
      // macOS: dscacheutil queries the Bonjour/mDNS cache via Directory Services
      if (process.platform === "darwin") {
        const ip = await new Promise<string | null>((resolve) => {
          execFile(
            "/usr/bin/dscacheutil",
            ["-q", "host", "-a", "name", host],
            { timeout: 5000 },
            (err, stdout) => {
              if (err) {
                streamDeck.logger.warn(`dscacheutil error: ${err.message}`);
                resolve(null);
                return;
              }
              const match = stdout?.match(/ip_address:\s*(\S+)/);
              resolve(match ? match[1] : null);
            }
          );
        });
        if (ip) {
          streamDeck.logger.info(`Resolved ${host} → ${ip} via dscacheutil`);
          this.resolvedHost = ip;
          return ip;
        }
        streamDeck.logger.warn(`dscacheutil could not resolve ${host}`);
      }

      // Linux (standalone Stream Deck) / Windows (with Bonjour): dns.lookup
      // uses getaddrinfo which on these platforms can resolve .local via
      // avahi/nss-mdns (Linux) or Apple Bonjour (Windows)
      try {
        const result = await dnsLookup(host, { family: 4 });
        streamDeck.logger.info(`Resolved ${host} → ${result.address} via dns.lookup`);
        this.resolvedHost = result.address;
        return result.address;
      } catch (err) {
        streamDeck.logger.warn(`dns.lookup could not resolve ${host}: ${err}`);
      }
    }

    this.resolvedHost = host;
    return host;
  }

  private buildAuthHeader(): string {
    const credentials = `${this.config.username}:${this.config.password}`;
    return `Basic ${Buffer.from(credentials).toString("base64")}`;
  }

  private async makeRequest(
    method: "GET" | "PUT" | "POST",
    path: string,
    body?: object
  ): Promise<Record<string, unknown>> {
    const host = await this.getHost();
    // Body is sent for PUT/POST; for POST with no body, send an empty object
    // so Content-Length is correct and the camera doesn't reject the request.
    const hasBody = method === "PUT" || method === "POST";
    const bodyStr = hasBody ? JSON.stringify(body ?? {}) : undefined;

    const options: https.RequestOptions = {
      hostname: host,
      port: this.config.port,
      path,
      method,
      headers: {
        Authorization: this.buildAuthHeader(),
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(bodyStr !== undefined
          ? { "Content-Length": Buffer.byteLength(bodyStr) }
          : {}),
      },
      // Disable SSL certificate verification for the camera's self-signed cert
      rejectUnauthorized: false,
      timeout: this.config.timeout,
    };

    return new Promise((resolve, reject) => {
      const protocol = this.config.useHttps ? https : http;

      const req = (protocol as typeof https).request(options, (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => (data += chunk.toString()));
        res.on("end", () => {
          const statusCode = res.statusCode ?? 0;

          if (statusCode >= 400) {
            reject(
              new Error(`HTTP ${statusCode} ${res.statusMessage} — ${data}`)
            );
            return;
          }

          const trimmed = data.trim();
          if (!trimmed) {
            resolve({ success: true, statusCode });
            return;
          }

          try {
            resolve(JSON.parse(trimmed) as Record<string, unknown>);
          } catch {
            // Non-JSON body on a success response is acceptable for PUT/POST
            resolve({ success: true, statusCode });
          }
        });
      });

      req.on("error", reject);
      req.on("timeout", () =>
        req.destroy(new Error("Request timed out"))
      );

      if (bodyStr !== undefined) req.write(bodyStr);
      req.end();
    });
  }

  // ─── Transport / Recording ───────────────────────────────────────────────────

  async getTransportStatus(): Promise<TransportStatus> {
    const response = await this.makeRequest(
      "GET",
      "/control/api/v1/transports/0"
    );
    const mode = (response.mode as string) ?? "Unknown";
    return {
      // The camera is recording when mode is "InputRecord"
      recording: mode === "InputRecord",
      mode,
    };
  }

  /**
   * Start recording. Uses POST /transports/0/record (preferred over deprecated PUT).
   * Optionally supply a clip name.
   */
  async startRecording(clipName?: string): Promise<void> {
    const body = clipName ? { clipName } : undefined;
    await this.makeRequest("POST", "/control/api/v1/transports/0/record", body);
  }

  /**
   * Stop recording/transport. Uses POST /transports/0/stop.
   */
  async stopRecording(): Promise<void> {
    await this.makeRequest("POST", "/control/api/v1/transports/0/stop");
  }

  // ─── Video — ISO ──────────────────────────────────────────────────────────

  async getISO(): Promise<number> {
    try {
      const r = await this.makeRequest("GET", "/control/api/v1/video/iso");
      if (typeof r.iso === "number") return r.iso;
    } catch {
      // Fall through to gain endpoint
    }
    try {
      const r = await this.makeRequest("GET", "/control/api/v1/video/gain");
      return 400 + ((r.gain as number) ?? 0) * 100;
    } catch {
      return 800;
    }
  }

  async setISO(iso: number): Promise<void> {
    try {
      await this.makeRequest("PUT", "/control/api/v1/video/iso", { iso });
    } catch {
      // Some cameras expose gain instead of ISO
      const gain = Math.max(0, Math.floor((iso - 400) / 100));
      await this.makeRequest("PUT", "/control/api/v1/video/gain", { gain });
    }
  }

  // ─── Video — Shutter ──────────────────────────────────────────────────────

  /**
   * Returns the full shutter state, including which measurement mode is active
   * (shutterSpeed or shutterAngle) and whether auto-exposure is controlling it.
   */
  async getShutter(): Promise<ShutterState> {
    const r = await this.makeRequest("GET", "/control/api/v1/video/shutter");
    return {
      shutterSpeed: r.shutterSpeed as number | undefined,
      shutterAngle: r.shutterAngle as number | undefined,
      continuousShutterAutoExposure:
        (r.continuousShutterAutoExposure as boolean) ?? false,
    };
  }

  /**
   * Set shutter speed (denominator of 1/x, e.g. 50 → 1/50 s).
   * Takes priority over shutterAngle if the camera accepts both.
   */
  async setShutterSpeed(denominator: number): Promise<void> {
    await this.makeRequest("PUT", "/control/api/v1/video/shutter", {
      shutterSpeed: denominator,
    });
  }

  /**
   * Set shutter angle (degrees, 1.0–360.0).
   */
  async setShutterAngle(angle: number): Promise<void> {
    await this.makeRequest("PUT", "/control/api/v1/video/shutter", {
      shutterAngle: angle,
    });
  }

  // ─── Video — White Balance ────────────────────────────────────────────────

  /** White balance range per spec: 2500–10000 K */
  async getWhiteBalance(): Promise<number> {
    const r = await this.makeRequest(
      "GET",
      "/control/api/v1/video/whiteBalance"
    );
    return (r.whiteBalance as number) ?? 5600;
  }

  /** @param kelvin  2500–10000 */
  async setWhiteBalance(kelvin: number): Promise<void> {
    await this.makeRequest("PUT", "/control/api/v1/video/whiteBalance", {
      whiteBalance: kelvin,
    });
  }

  /** Trigger auto white balance. */
  async doAutoWhiteBalance(): Promise<void> {
    await this.makeRequest("PUT", "/control/api/v1/video/whiteBalance/doAuto");
  }

  /** White balance tint offset: -50 to +50 */
  async setWhiteBalanceTint(tint: number): Promise<void> {
    await this.makeRequest("PUT", "/control/api/v1/video/whiteBalanceTint", {
      whiteBalanceTint: tint,
    });
  }

  // ─── Lens — Focus ─────────────────────────────────────────────────────────

  async doAutoFocus(): Promise<void> {
    await this.makeRequest(
      "PUT",
      "/control/api/v1/lens/focus/doAutoFocus",
      {}
    );
  }

  // ─── Video — Supported values (useful for populating UI) ──────────────────

  async getSupportedISOs(): Promise<number[]> {
    const r = await this.makeRequest("GET", "/control/api/v1/video/supportedISOs");
    return (r.supportedISOs as number[]) ?? [];
  }

  async getSupportedGains(): Promise<number[]> {
    const r = await this.makeRequest("GET", "/control/api/v1/video/supportedGains");
    return (r.supportedGains as number[]) ?? [];
  }

  // ─── System ───────────────────────────────────────────────────────────────

  async getSystemFormat(): Promise<Record<string, unknown>> {
    return this.makeRequest("GET", "/control/api/v1/system/format");
  }

  async getSystemProduct(): Promise<Record<string, unknown>> {
    return this.makeRequest("GET", "/control/api/v1/system/product");
  }

  // ─── Lens — Iris ─────────────────────────────────────────────────────────

  async getLensIris(): Promise<{ normalised: number; apertureStop?: number }> {
    const r = await this.makeRequest("GET", "/control/api/v1/lens/iris");
    return {
      normalised: (r.normalised as number) ?? 0.5,
      apertureStop: r.apertureStop as number | undefined,
    };
  }

  /** Relative aperture adjustment using the camera's own step API. Positive = open up. */
  async adjustIris(adjustmentStep: number): Promise<void> {
    await this.makeRequest("PUT", "/control/api/v1/lens/iris", { adjustmentStep });
  }

  // ─── Lens — Zoom ──────────────────────────────────────────────────────────

  async getLensZoom(): Promise<{ normalised: number; focalLength?: number }> {
    const r = await this.makeRequest("GET", "/control/api/v1/lens/zoom");
    return {
      normalised: (r.normalised as number) ?? 0.5,
      focalLength: r.focalLength as number | undefined,
    };
  }

  /** @param normalised  0.0 (wide) – 1.0 (tele) */
  async setLensZoom(normalised: number): Promise<void> {
    await this.makeRequest("PUT", "/control/api/v1/lens/zoom", { normalised });
  }

  // ─── Video — Supported shutters ───────────────────────────────────────────

  async getSupportedShutters(): Promise<{ shutterSpeeds: number[]; shutterAngles: number[] }> {
    const r = await this.makeRequest("GET", "/control/api/v1/video/supportedShutters");
    return {
      shutterSpeeds: (r.shutterSpeeds as number[]) ?? [],
      shutterAngles: (r.shutterAngles as number[]) ?? [],
    };
  }

  // ─── Video — White balance tint ───────────────────────────────────────────

  async getWhiteBalanceTint(): Promise<number> {
    const r = await this.makeRequest("GET", "/control/api/v1/video/whiteBalanceTint");
    return (r.whiteBalanceTint as number) ?? 0;
  }

  // ─── Video — Gain ──────────────────────────────────────────────────────────

  async getGain(): Promise<number> {
    const r = await this.makeRequest("GET", "/control/api/v1/video/gain");
    return (r.gain as number) ?? 0;
  }

  async setGain(dB: number): Promise<void> {
    await this.makeRequest("PUT", "/control/api/v1/video/gain", { gain: dB });
  }

  // ─── Lens — Manual Focus ──────────────────────────────────────────────────

  async getLensFocus(): Promise<number> {
    const r = await this.makeRequest("GET", "/control/api/v1/lens/focus");
    return (r.normalised as number) ?? 0.5;
  }

  async setLensFocus(normalised: number): Promise<void> {
    await this.makeRequest("PUT", "/control/api/v1/lens/focus", { normalised });
  }

  // ─── Colour Correction — Saturation ───────────────────────────────────────

  async getSaturation(): Promise<number> {
    const r = await this.makeRequest("GET", "/control/api/v1/colorCorrection/color");
    return (r.saturation as number) ?? 1.0;
  }

  async setSaturation(saturation: number): Promise<void> {
    await this.makeRequest("PUT", "/control/api/v1/colorCorrection/color", { saturation });
  }

  // ─── Colour Correction — Contrast ─────────────────────────────────────────

  async getContrast(): Promise<number> {
    const r = await this.makeRequest("GET", "/control/api/v1/colorCorrection/contrast");
    return (r.adjust as number) ?? 1.0;
  }

  async setContrast(adjust: number): Promise<void> {
    await this.makeRequest("PUT", "/control/api/v1/colorCorrection/contrast", { adjust });
  }

  // ─── Connection test ──────────────────────────────────────────────────────

  async testConnection(): Promise<boolean> {
    try {
      await this.makeRequest("GET", "/control/api/v1/transports/0");
      return true;
    } catch {
      return false;
    }
  }
}
