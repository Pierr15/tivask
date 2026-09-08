import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import qrcode from "qrcode";
import WA from "whatsapp-web.js";
import type { Client, Message } from "whatsapp-web.js";
import { env, backendRoot, dataPath } from "../../config/env.js";
import { JsonStore } from "../../core/JsonStore.js";
import { AppError } from "../../core/errors.js";
import { logger } from "../../core/logger.js";
import { splitWhatsApp } from "./WhatsAppFormatter.js";
import type { ConversationService } from "../conversation/ConversationService.js";
export function shouldHandle(
  m: {
    from: string;
    fromMe: boolean;
    body: string;
    type: string;
    timestamp: number;
  },
  now = Date.now(),
) {
  return (
    !m.fromMe &&
    !m.from.endsWith("@g.us") &&
    m.from !== "status@broadcast" &&
    !m.from.endsWith("@broadcast") &&
    (m.from.endsWith("@c.us") || m.from.endsWith("@lid")) &&
    m.type === "chat" &&
    m.body.trim().length > 0 &&
    m.body.length <= 2000 &&
    m.timestamp * 1000 > now - 5 * 60 * 1000
  );
}
export class WhatsAppProvider {
  private client: Client | null = null;
  private stopping = false;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private lifecycle: Promise<unknown> = Promise.resolve();
  private receipts = new JsonStore<
    Record<string, { status: string; at: number }>
  >(dataPath("fallback", "receipts.json"), () => ({}));
  state: {
    status: string;
    qr: string | null;
    phone: string | null;
    accountName: string | null;
    error: string | null;
  } = {
    status: "DISCONNECTED",
    qr: null,
    phone: null,
    accountName: null,
    error: null,
  };
  constructor(private conversation: ConversationService) {}
  private serialize(work: () => Promise<void>) {
    const job = this.lifecycle.catch(() => {}).then(work);
    this.lifecycle = job;
    return job;
  }
  connect() {
    return this.serialize(() => this.start());
  }
  private async start() {
    if (
      this.client &&
      ["INITIALIZING", "SCAN_QR", "CONNECTED"].includes(this.state.status)
    )
      return;
    this.stopping = false;
    await this.destroy();
    this.state = {
      status: "INITIALIZING",
      qr: null,
      phone: null,
      accountName: null,
      error: null,
    };
    const executablePath = [
      env.CHROME_EXECUTABLE_PATH,
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    ].find((p) => p && existsSync(p));
    if (!executablePath) {
      this.state.status = "ERROR";
      this.state.error =
        "Chrome/Edge tidak ditemukan. Isi CHROME_EXECUTABLE_PATH pada .env.";
      return;
    }
    const client = new WA.Client({
      authStrategy: new WA.LocalAuth({
        dataPath: path.resolve(backendRoot, env.WA_SESSION_PATH),
      }),
      puppeteer: {
        headless: true,
        executablePath,
        args: ["--disable-dev-shm-usage", "--disable-gpu"],
      },
      authTimeoutMs: 60000,
    });
    this.client = client;
    client.on("qr", (qr: string) => {
      void qrcode
        .toDataURL(qr)
        .then((url) => {
          if (this.client === client)
            this.state = {
              ...this.state,
              status: "SCAN_QR",
              qr: url,
              error: null,
            };
        })
        .catch(() => {});
    });
    client.on("ready", () => {
      if (this.client !== client) return;
      this.attempts = 0;
      this.state = {
        status: "CONNECTED",
        qr: null,
        phone: client.info?.wid?.user ?? null,
        accountName: client.info?.pushname ?? null,
        error: null,
      };
      void this.conversation.persistence
        .event("WHATSAPP_CONNECTED")
        .catch(() => {});
    });
    client.on("auth_failure", () => {
      if (this.client === client) {
        this.state = {
          ...this.state,
          status: "ERROR",
          qr: null,
          error:
            "Autentikasi gagal. Gunakan Hubungkan ulang atau Logout lalu scan QR.",
        };
      }
    });
    client.on("disconnected", () => {
      if (this.client !== client) return;
      this.state = { ...this.state, status: "DISCONNECTED", qr: null };
      void this.conversation.persistence
        .event("WHATSAPP_DISCONNECTED")
        .catch(() => {});
      if (!this.stopping && this.attempts < 5) {
        this.retry = setTimeout(
          () => {
            this.attempts++;
            void this.connect().catch(() => {});
          },
          Math.min(30000, 3000 * 2 ** this.attempts),
        );
      }
    });
    client.on("message", (m: Message) => {
      void this.incoming(m).catch((error) => {
        console.error("WhatsApp message processing failed:", error);
      });
    });
    // Initialization resolves after browser startup, while QR/ready events drive actual connection state.
    void client
      .initialize()
      .then(async () => {
        if (this.client !== client) await client.destroy().catch(() => {});
      })
      .catch(() => {
        if (this.client === client)
          this.state = {
            ...this.state,
            status: "ERROR",
            qr: null,
            error:
              "WhatsApp gagal dimulai. Periksa internet/browser lalu Hubungkan ulang.",
          };
      });
  }
  private async incoming(message: Message) {
    if (!shouldHandle(message)) return;
    const rawId =
      message.id?._serialized ??
      message.id?.id ??
      `${message.from ?? "unknown"}:${message.timestamp ?? Date.now()}:${message.body ?? ""}`;

    const id = createHash("sha256").update(String(rawId)).digest("hex");

    const claimed = await this.receipts.update((s) => {
      if (s[id]) return false;
      s[id] = { status: "PROCESSING", at: Date.now() };
      for (const [key, v] of Object.entries(s))
        if (v.at < Date.now() - 7 * 86400000) delete s[key];
      return true;
    });
    if (!claimed) return;
    try {
      const response = await this.conversation.handle(
        message.from,
        message.body.trim(),
        "WHATSAPP",
        id,
      );
      await this.send(message.from, response.text);
      await this.conversation.persistence.delivery(response.messageId, "SENT");
      await this.receipts.update((s) => {
        s[id] = { status: "SENT", at: Date.now() };
      });
    } catch {
      await this.receipts.update((s) => {
        s[id] = { status: "UNCERTAIN", at: Date.now() };
      });
      await this.conversation.persistence
        .event("ERROR", null, "WHATSAPP")
        .catch(() => {});
    }
  }
  async send(to: string, text: string) {
    if (this.state.status !== "CONNECTED" || !this.client)
      throw new AppError(409, "WhatsApp belum terhubung.");
    if (!/^\d+@(c\.us|lid)$/.test(to))
      throw new AppError(400, "Tujuan WhatsApp tidak valid.");
    for (const block of splitWhatsApp(text))
      await this.client.sendMessage(to, block);
  }
  private async destroy() {
    const previous = this.client;
    this.client = null;
    if (previous) await previous.destroy().catch(() => {});
  }
  disconnect() {
    return this.serialize(async () => {
      this.stopping = true;
      if (this.retry) clearTimeout(this.retry);
      await this.destroy();
      this.state = {
        status: "DISCONNECTED",
        qr: null,
        phone: null,
        accountName: null,
        error: null,
      };
    });
  }
  reconnect() {
    return this.serialize(async () => {
      this.stopping = true;
      if (this.retry) clearTimeout(this.retry);
      await this.destroy();
      this.attempts = 0;
      await this.start();
    });
  }
  logout() {
    return this.serialize(async () => {
      this.stopping = true;
      if (this.retry) clearTimeout(this.retry);
      if (this.client) await this.client.logout();
      await this.destroy();
      this.state = {
        status: "DISCONNECTED",
        qr: null,
        phone: null,
        accountName: null,
        error: null,
      };
    });
  }
}
