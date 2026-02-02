/**
 * Relay Server Client for Cursor Remote Extension
 * Handles communication with the relay server for remote mobile client connections
 */

import * as vscode from "vscode";
import * as https from "https";
import * as http from "http";
import { URL } from "url";

export interface RelayMessage {
  type: string;
  data?: any;
  to?: "mobile" | "pc";
  from?: "mobile" | "pc";
  timestamp?: number;
}

export interface Session {
  sessionId: string;
  createdAt: number;
  expiresAt: number;
  pcDeviceId?: string;
  mobileDeviceId?: string;
}

export class RelayClient {
  private relayServerUrl: string;
  private deviceId: string;
  private sessionId: string | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private isConnected: boolean = false;
  private outputChannel: vscode.OutputChannel;
  private onMessageCallback: ((message: string) => void) | null = null;
  private onSessionConnectedCallback: (() => void) | null = null;
  private lastSessionDiscoveryTime: number = 0;
  private lastPollHeartbeatTime: number = 0;
  private lastNoSessionHeartbeatTime: number = 0; // 세션 없을 때 폴링 동작 확인용
  private readonly SESSION_DISCOVERY_INTERVAL = 5000; // 5초마다 세션 탐지 (빠른 연결용)
  private readonly POLL_INTERVAL = 2000; // 2초마다 폴링
  private readonly POLL_HEARTBEAT_INTERVAL = 30000; // 30초마다 폴링 동작 로그

  constructor(relayServerUrl: string, outputChannel: vscode.OutputChannel) {
    this.relayServerUrl = relayServerUrl;
    this.deviceId = `pc-${Date.now()}`;
    this.outputChannel = outputChannel;
  }

  private log(message: string, level: "info" | "warn" | "error" = "info") {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] [Relay] ${message}`;
    this.outputChannel.appendLine(logMessage);
    console.log(logMessage);
  }

  private logError(message: string, error?: any) {
    const errorMessage =
      error instanceof Error ? error.message : String(error || "");
    const logMessage = `[Relay] ERROR: ${message}${
      errorMessage ? ` - ${errorMessage}` : ""
    }`;
    this.outputChannel.appendLine(logMessage);
    console.error(logMessage, error);
  }

  /**
   * Set callback for receiving messages from relay server
   */
  setOnMessage(callback: (message: string) => void) {
    this.onMessageCallback = callback;
  }

  /**
   * Set callback for when session is connected (e.g. to update status bar)
   */
  setOnSessionConnected(callback: () => void) {
    this.onSessionConnectedCallback = callback;
  }

  /**
   * Start relay client - begin session discovery and polling
   */
  async start(): Promise<void> {
    this.log("Starting relay client...");
    this.log(`Relay Server: ${this.relayServerUrl}`);
    this.log(`Device ID: ${this.deviceId}`);

    // Start polling for session discovery
    this.startPolling();
    this.log(
      "Relay client started - waiting for mobile client to create session..."
    );
  }

  /**
   * Stop relay client
   */
  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isConnected = false;
    this.sessionId = null;
    this.log("Relay client stopped");
  }

  /**
   * Start polling for messages and session discovery
   */
  private startPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    this.pollInterval = setInterval(() => {
      this.pollMessages().catch((err) => {
        this.logError("pollMessages threw", err);
      });
    }, this.POLL_INTERVAL);
    this.log(
      "⏱️ Poll interval started (every 2s) - 세션 탐지/메시지 수신 대기 중"
    );
  }

  /**
   * Poll messages from relay server and discover sessions
   */
  private async pollMessages(): Promise<void> {
    // If no session, try to discover one
    if (!this.sessionId) {
      const now = Date.now();
      if (
        now - this.lastNoSessionHeartbeatTime >=
        this.POLL_HEARTBEAT_INTERVAL
      ) {
        this.lastNoSessionHeartbeatTime = now;
        this.log(
          "⏳ 세션 없음 - 폴링 루프 동작 중 (모바일에서 릴레이 세션 생성 후 대기)"
        );
      }
      const discoveredSessionId = await this.discoverSession();
      if (discoveredSessionId) {
        this.log(
          `🔍 Found session waiting for Extension: ${discoveredSessionId}`
        );
        await this.connectToSession(discoveredSessionId);
        return;
      }
      return; // No session found, try again next poll
    }

    // If session exists, poll for messages
    if (!this.sessionId || !this.isConnected) {
      this.log(
        `⚠️ Polling skipped: sessionId=${this.sessionId}, isConnected=${this.isConnected}`
      );
      return;
    }

    try {
      const now = Date.now();
      if (now - this.lastPollHeartbeatTime >= this.POLL_HEARTBEAT_INTERVAL) {
        this.lastPollHeartbeatTime = now;
        this.log(`🔄 Polling sessionId=${this.sessionId} (정상 폴링 중)`);
      }

      const pollUrl = `${this.relayServerUrl}/api/poll?sessionId=${this.sessionId}&deviceType=pc`;
      const data = await this.httpRequest(pollUrl);

      if (!data) {
        this.logError("⚠️ Poll returned null/undefined data");
        return;
      }

      // 응답 형식 허용: data.data.messages 또는 data.messages
      const messages: any[] = Array.isArray(data.data?.messages)
        ? data.data.messages
        : Array.isArray((data as any).messages)
        ? (data as any).messages
        : [];

      if (messages.length > 0) {
        this.log(`📥 Received ${messages.length} message(s) from relay`);
        this.log(
          `📋 Messages: ${JSON.stringify(
            messages.map((m: any) => ({
              id: m.id,
              type: m.type,
              from: m.from,
              hasData: !!m.data,
            }))
          )}`
        );
      }

      for (const msg of messages) {
        this.log(
          `📨 Processing message: id=${msg.id}, type=${msg.type}, from=${msg.from}`
        );
        // Forward message to callback (Extension WebSocket server)
        if (this.onMessageCallback) {
          // 페이로드: msg.data가 있으면 그대로, 없으면 전체 msg (하위 호환)
          const payload =
            msg.data !== undefined && msg.data !== null ? msg.data : msg;
          const messageStr =
            typeof payload === "string" ? payload : JSON.stringify(payload);
          this.log(
            `📤 Calling onMessageCallback with: ${messageStr.substring(0, 200)}`
          );
          this.onMessageCallback(messageStr);
          this.log(`✅ onMessageCallback completed`);
        } else {
          this.logError(
            "⚠️ onMessageCallback is null - cannot forward message"
          );
        }
      }

      if (!data.success) {
        this.logError(`Poll failed: ${data.error}`);
      } else if (messages.length === 0 && data.success) {
        // No messages - this is normal, don't log
      }
    } catch (error) {
      this.logError("Polling error", error);
      if (error instanceof Error) {
        this.logError(`   Error message: ${error.message}`);
        this.logError(`   Error stack: ${error.stack}`);
      }
    }
  }

  /**
   * Discover sessions waiting for Extension (this client) to connect
   */
  private async discoverSession(): Promise<string | null> {
    if (this.sessionId) {
      return null; // Already connected to a session
    }

    // Rate limiting
    const now = Date.now();
    if (now - this.lastSessionDiscoveryTime < this.SESSION_DISCOVERY_INTERVAL) {
      return null;
    }
    this.lastSessionDiscoveryTime = now;

    try {
      const discoveryUrl = `${this.relayServerUrl}/api/sessions-waiting-for-pc`;
      this.log(`🔍 Discovery: GET ${discoveryUrl}`);
      const data = await this.httpRequest(discoveryUrl);

      if (!data) {
        this.log("🔍 Discovery: API returned no data");
        return null;
      }
      if (!data.success) {
        this.log(
          `🔍 Discovery: API error - ${(data as any).error ?? "unknown"}`
        );
        return null;
      }
      const sessions = data.data?.sessions ?? [];
      const sessionsCount = Array.isArray(sessions) ? sessions.length : 0;
      this.log(
        `🔍 Discovery: 서버 응답 success=true, sessionsCount=${sessionsCount}`
      );
      if (sessionsCount === 0) {
        this.log(
          "🔍 Discovery: no sessions waiting for PC (모바일이 세션 생성 후 대기 중이어야 함)"
        );
        this.log(
          "💡 다른 Cursor 창이 열려 있으면 그 익스텐션이 세션을 먼저 가져갔을 수 있습니다. 다른 창을 모두 닫고 새 세션으로 다시 시도해 보세요."
        );
        return null;
      }
      const foundSession = sessions[0];
      if (foundSession.sessionId) {
        this.log(`🔍 Discovery: 세션 발견 → ${foundSession.sessionId}`);
        return foundSession.sessionId;
      }
      this.log("🔍 Discovery: session has no sessionId");
      return null;
    } catch (error) {
      this.logError("Discovery failed", error);
      return null;
    }
  }

  /**
   * Connect to a relay session
   */
  private async connectToSession(sid: string): Promise<void> {
    this.log(`🔗 Connecting to session ${sid}...`);

    try {
      const data = await this.httpRequest(
        `${this.relayServerUrl}/api/connect`,
        "POST",
        {
          sessionId: sid,
          deviceId: this.deviceId,
          deviceType: "pc",
        }
      );

      if (!data) {
        return;
      }

      if (data.success) {
        this.sessionId = sid;
        this.isConnected = true;
        this.log(`✅ Connected to session: ${this.sessionId}`);
        this.log(
          `💡 Mobile client can connect with session ID: ${this.sessionId}`
        );
        if (this.onSessionConnectedCallback) {
          this.onSessionConnectedCallback();
        }
      } else {
        this.logError(`Failed to connect: ${data.error}`);
      }
    } catch (error) {
      this.logError("Error connecting to session", error);
    }
  }

  /**
   * Send message to relay server
   */
  async sendMessage(message: string): Promise<void> {
    if (!this.sessionId || !this.isConnected) {
      this.logError("Cannot send message: not connected to session");
      return;
    }

    try {
      const parsed = JSON.parse(message);
      if (parsed.type === "chat_response") {
        this.log(
          `Sending chat_response to relay (text length: ${
            (parsed.text || "").length
          })`
        );
      }
      const data = await this.httpRequest(
        `${this.relayServerUrl}/api/send`,
        "POST",
        {
          sessionId: this.sessionId,
          deviceId: this.deviceId,
          deviceType: "pc",
          type: parsed.type || "message",
          data: parsed,
        }
      );

      if (!data) {
        this.logError("Relay /api/send returned no data");
        return;
      }
      if (data.success) {
        this.log("✅ Message sent to relay");
      } else {
        this.logError(`Failed to send to relay: ${data.error}`);
      }
    } catch (error) {
      this.logError("Error sending to relay", error);
    }
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Check if connected to relay session
   */
  isConnectedToSession(): boolean {
    return this.isConnected && this.sessionId !== null;
  }

  /**
   * HTTP request helper (using Node.js http/https modules)
   */
  private async httpRequest(
    url: string,
    method: "GET" | "POST" = "GET",
    body?: any
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === "https:";
      const httpModule = isHttps ? https : http;

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: method,
        headers: {
          "Content-Type": "application/json",
        },
      };

      const req = httpModule.request(options, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(data);
              resolve(parsed);
            } catch (error) {
              this.logError("Failed to parse response", error);
              resolve(null);
            }
          } else {
            this.logError(`HTTP ${res.statusCode}: ${data}`);
            resolve(null);
          }
        });
      });

      req.on("error", (error) => {
        this.logError("Request error", error);
        resolve(null);
      });

      if (body && method === "POST") {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }
}
