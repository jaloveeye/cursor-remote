/**
 * Rules file management for chat capture
 */

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { CONFIG } from "./config";
import { HttpServer } from "./http-server";
import { WebSocketServer } from "./websocket-server";

export class RulesManager {
  private outputChannel: vscode.OutputChannel;
  private httpServer: HttpServer;

  constructor(outputChannel: vscode.OutputChannel, httpServer: HttpServer) {
    this.outputChannel = outputChannel;
    this.httpServer = httpServer;
  }

  private log(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    this.outputChannel.appendLine(logMessage);
    console.log(logMessage);
  }

  private logError(message: string, error?: any) {
    const timestamp = new Date().toLocaleTimeString();
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    const logMessage = `[${timestamp}] ❌ ${message}: ${errorMsg}`;
    this.outputChannel.appendLine(logMessage);
    console.error(logMessage);
  }

  /**
   * CHAT_SUMMARY 규칙 파일 생성 제거됨
   * 이제 stdout 응답만 사용하므로 규칙 파일이 더 이상 필요하지 않음
   */

  /**
   * Ensure hooks.json file exists
   */
  ensureHooksFile(workspaceRoot: string): void {
    // 워크스페이스가 없거나 루트(/)면 스킵 (F5 테스트 시 ENOENT 방지)
    if (!workspaceRoot || workspaceRoot === "/" || workspaceRoot.length <= 1) {
      return;
    }
    const cursorDir = path.join(workspaceRoot, ".cursor");
    const hooksFile = path.join(cursorDir, "hooks.json");

    try {
      // Create .cursor directory
      if (!fs.existsSync(cursorDir)) {
        fs.mkdirSync(cursorDir, { recursive: true });
      }

      const httpPort = this.httpServer.getPort();
      const httpPortEnv = httpPort
        ? { CURSOR_REMOTE_HTTP_PORT: httpPort.toString() }
        : {};
      const hookScriptPath = path.join(
        workspaceRoot,
        ".cursor",
        "hook-debug.js"
      );
      const hooksContent = {
        hooks: [
          {
            event: "afterAgentResponse",
            command: "node",
            args: [hookScriptPath],
            env: httpPortEnv,
          },
        ],
      };

      // Check if file needs update
      let needsUpdate = true;
      if (fs.existsSync(hooksFile)) {
        try {
          const existingContent = JSON.parse(
            fs.readFileSync(hooksFile, "utf8")
          );
          const hasAfterAgentResponseHook =
            existingContent.hooks &&
            existingContent.hooks.some(
              (h: any) =>
                (h.event === "afterAgentResponse" ||
                  h.event === "agent_message") &&
                h.args &&
                h.args[0] &&
                (h.args[0].includes("hook-debug.js") ||
                  h.args[0] === ".cursor/hook-debug.js")
            );

          if (hasAfterAgentResponseHook) {
            const existingHook = existingContent.hooks.find(
              (h: any) =>
                (h.event === "afterAgentResponse" ||
                  h.event === "agent_message") &&
                h.args &&
                h.args[0] &&
                h.args[0].includes("hook-debug.js")
            );
            const hasCorrectEnv =
              existingHook.env && existingHook.env.CURSOR_REMOTE_HTTP_PORT;
            if (
              existingHook &&
              existingHook.event === "afterAgentResponse" &&
              existingHook.args[0] === ".cursor/hook-debug.js" &&
              hasCorrectEnv
            ) {
              if (
                httpPort &&
                existingHook.env.CURSOR_REMOTE_HTTP_PORT === httpPort.toString()
              ) {
                needsUpdate = false;
              } else {
                existingHook.env = httpPort
                  ? { CURSOR_REMOTE_HTTP_PORT: httpPort.toString() }
                  : {};
                fs.writeFileSync(
                  hooksFile,
                  JSON.stringify(existingContent, null, 2),
                  "utf8"
                );
                this.log(`✅ Updated hooks.json with HTTP port ${httpPort}`);
                needsUpdate = false;
              }
            } else {
              if (existingHook) {
                existingHook.event = "afterAgentResponse";
                existingHook.args = [hookScriptPath];
                existingHook.env = httpPort
                  ? { CURSOR_REMOTE_HTTP_PORT: httpPort.toString() }
                  : {};
                fs.writeFileSync(
                  hooksFile,
                  JSON.stringify(existingContent, null, 2),
                  "utf8"
                );
                this.log(
                  `✅ Updated existing hook to use afterAgentResponse with HTTP port ${httpPort}`
                );
                needsUpdate = false;
              }
            }
          } else {
            if (!existingContent.hooks) {
              existingContent.hooks = [];
            }
            existingContent.hooks.push(hooksContent.hooks[0]);
            fs.writeFileSync(
              hooksFile,
              JSON.stringify(existingContent, null, 2),
              "utf8"
            );
            this.log(
              `✅ Added afterAgentResponse hook to hooks.json with HTTP port ${httpPort}`
            );
            needsUpdate = false;
          }
        } catch (e) {
          // JSON parsing failed, create new file
        }
      }

      if (needsUpdate) {
        fs.writeFileSync(
          hooksFile,
          JSON.stringify(hooksContent, null, 2),
          "utf8"
        );
        this.log(`✅ Created/updated hooks.json: ${hooksFile}`);
      } else {
        this.log("hooks.json already configured correctly");
      }
    } catch (error) {
      this.logError("Error ensuring hooks file", error);
    }
  }

  /**
   * CHAT_SUMMARY 파일 감시 제거됨
   * 이제 stdout 응답만 사용하므로 hook 기반 응답 전송은 더 이상 필요하지 않음
   */
}
