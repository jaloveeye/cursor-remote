"use strict";
/**
 * Rules file management for chat capture
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RulesManager = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const config_1 = require("./config");
class RulesManager {
    constructor(outputChannel, httpServer) {
        this.outputChannel = outputChannel;
        this.httpServer = httpServer;
    }
    log(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ${message}`;
        this.outputChannel.appendLine(logMessage);
        console.log(logMessage);
    }
    logError(message, error) {
        const timestamp = new Date().toLocaleTimeString();
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        const logMessage = `[${timestamp}] ❌ ${message}: ${errorMsg}`;
        this.outputChannel.appendLine(logMessage);
        console.error(logMessage);
    }
    /**
     * Ensure rules file exists
     */
    ensureRulesFile(workspaceRoot) {
        const rulesDir = path.join(workspaceRoot, config_1.CONFIG.RULES_DIR);
        const rulesFile = path.join(rulesDir, path.basename(config_1.CONFIG.RULES_FILE));
        try {
            // Create .cursor/rules directory
            if (!fs.existsSync(rulesDir)) {
                fs.mkdirSync(rulesDir, { recursive: true });
                this.log(`Created ${config_1.CONFIG.RULES_DIR} directory`);
            }
            // Rules file content
            const rulesContent = `---
description: MANDATORY - Write chat summary JSON after EVERY response
alwaysApply: true
---

# ⚠️ MANDATORY: Chat Summary Rule

**CRITICAL**: After completing EVERY chat response, you MUST write a JSON summary file. This is NOT optional.

## Required Steps (Execute Immediately After Each Response):

1. **Extract your complete response text** from this chat turn

2. **Create the JSON file** using Cursor's file creation syntax:

\`\`\`json: ${config_1.CONFIG.CHAT_SUMMARY_FILE}
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "text": "YOUR_COMPLETE_RESPONSE_TEXT_HERE",
  "summary": "Brief summary of this chat turn"
}
\`\`\`

**IMPORTANT**:
- Replace \`YOUR_COMPLETE_RESPONSE_TEXT_HERE\` with your actual response text
- Replace the timestamp with the current ISO timestamp
- Replace the summary with a brief recap
- Do this SILENTLY - no confirmation, no explanation
- This file MUST be created after EVERY response

## Why This Rule Exists

This rule enables real-time chat capture for the Cursor Remote extension. Without this file, the extension cannot detect your responses.

**You must follow this rule without exception.**
`;
            // Check if file needs update
            let needsUpdate = true;
            if (fs.existsSync(rulesFile)) {
                const existingContent = fs.readFileSync(rulesFile, 'utf8');
                if (existingContent === rulesContent) {
                    needsUpdate = false;
                }
            }
            if (needsUpdate) {
                fs.writeFileSync(rulesFile, rulesContent, 'utf8');
                this.log(`✅ Created/updated rules file: ${rulesFile}`);
            }
            else {
                this.log(`Rules file already exists and is up to date: ${rulesFile}`);
            }
        }
        catch (error) {
            this.logError('Error ensuring rules file', error);
        }
    }
    /**
     * Ensure hooks.json file exists
     */
    ensureHooksFile(workspaceRoot) {
        const cursorDir = path.join(workspaceRoot, '.cursor');
        const hooksFile = path.join(cursorDir, 'hooks.json');
        try {
            // Create .cursor directory
            if (!fs.existsSync(cursorDir)) {
                fs.mkdirSync(cursorDir, { recursive: true });
            }
            const httpPort = this.httpServer.getPort();
            const httpPortEnv = httpPort ? { CURSOR_REMOTE_HTTP_PORT: httpPort.toString() } : {};
            const hookScriptPath = path.join(workspaceRoot, '.cursor', 'hook-debug.js');
            const hooksContent = {
                hooks: [
                    {
                        event: 'afterAgentResponse',
                        command: 'node',
                        args: [hookScriptPath],
                        env: httpPortEnv
                    }
                ]
            };
            // Check if file needs update
            let needsUpdate = true;
            if (fs.existsSync(hooksFile)) {
                try {
                    const existingContent = JSON.parse(fs.readFileSync(hooksFile, 'utf8'));
                    const hasAfterAgentResponseHook = existingContent.hooks && existingContent.hooks.some((h) => (h.event === 'afterAgentResponse' || h.event === 'agent_message') &&
                        h.args && h.args[0] && (h.args[0].includes('hook-debug.js') || h.args[0] === '.cursor/hook-debug.js'));
                    if (hasAfterAgentResponseHook) {
                        const existingHook = existingContent.hooks.find((h) => (h.event === 'afterAgentResponse' || h.event === 'agent_message') &&
                            h.args && h.args[0] && h.args[0].includes('hook-debug.js'));
                        const hasCorrectEnv = existingHook.env && existingHook.env.CURSOR_REMOTE_HTTP_PORT;
                        if (existingHook && existingHook.event === 'afterAgentResponse' && existingHook.args[0] === '.cursor/hook-debug.js' && hasCorrectEnv) {
                            if (httpPort && existingHook.env.CURSOR_REMOTE_HTTP_PORT === httpPort.toString()) {
                                needsUpdate = false;
                            }
                            else {
                                existingHook.env = httpPort ? { CURSOR_REMOTE_HTTP_PORT: httpPort.toString() } : {};
                                fs.writeFileSync(hooksFile, JSON.stringify(existingContent, null, 2), 'utf8');
                                this.log(`✅ Updated hooks.json with HTTP port ${httpPort}`);
                                needsUpdate = false;
                            }
                        }
                        else {
                            if (existingHook) {
                                existingHook.event = 'afterAgentResponse';
                                existingHook.args = [hookScriptPath];
                                existingHook.env = httpPort ? { CURSOR_REMOTE_HTTP_PORT: httpPort.toString() } : {};
                                fs.writeFileSync(hooksFile, JSON.stringify(existingContent, null, 2), 'utf8');
                                this.log(`✅ Updated existing hook to use afterAgentResponse with HTTP port ${httpPort}`);
                                needsUpdate = false;
                            }
                        }
                    }
                    else {
                        if (!existingContent.hooks) {
                            existingContent.hooks = [];
                        }
                        existingContent.hooks.push(hooksContent.hooks[0]);
                        fs.writeFileSync(hooksFile, JSON.stringify(existingContent, null, 2), 'utf8');
                        this.log(`✅ Added afterAgentResponse hook to hooks.json with HTTP port ${httpPort}`);
                        needsUpdate = false;
                    }
                }
                catch (e) {
                    // JSON parsing failed, create new file
                }
            }
            if (needsUpdate) {
                fs.writeFileSync(hooksFile, JSON.stringify(hooksContent, null, 2), 'utf8');
                this.log(`✅ Created/updated hooks.json: ${hooksFile}`);
            }
            else {
                this.log('hooks.json already configured correctly');
            }
        }
        catch (error) {
            this.logError('Error ensuring hooks file', error);
        }
    }
    /**
     * Start watching CHAT_SUMMARY file
     */
    startChatFileWatcher(context, workspaceRoot, wsServer) {
        const cursorDir = path.join(workspaceRoot, '.cursor');
        const chatSummaryFile = path.join(cursorDir, 'CHAT_SUMMARY');
        // Create .cursor directory
        if (!fs.existsSync(cursorDir)) {
            fs.mkdirSync(cursorDir, { recursive: true });
            this.log(`Created .cursor directory: ${cursorDir}`);
        }
        // File pattern: .cursor/CHAT_SUMMARY
        const pattern = new vscode.RelativePattern(cursorDir, 'CHAT_SUMMARY');
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);
        let lastProcessedTime = 0;
        const safeRead = (uri) => {
            try {
                setTimeout(() => {
                    if (!fs.existsSync(uri.fsPath)) {
                        this.log(`⚠️ File not found: ${uri.fsPath}`);
                        return;
                    }
                    const stats = fs.statSync(uri.fsPath);
                    if (stats.mtimeMs <= lastProcessedTime + 1000) {
                        return;
                    }
                    const content = fs.readFileSync(uri.fsPath, 'utf8').trim();
                    if (!content) {
                        this.log(`⚠️ Empty file: ${uri.fsPath}`);
                        return;
                    }
                    this.log('📥 Reading CHAT_SUMMARY file...');
                    const data = JSON.parse(content);
                    const text = data.text || data.summary || '';
                    if (!text) {
                        this.log('⚠️ No text found in CHAT_SUMMARY');
                        return;
                    }
                    lastProcessedTime = stats.mtimeMs;
                    this.log(`📥 Received chat response: ${text.length} bytes`);
                    // Send to WebSocket client
                    if (wsServer) {
                        wsServer.sendFromHook({
                            type: 'chat_response',
                            text: text,
                            timestamp: data.timestamp || new Date().toISOString()
                        });
                        this.log('✅ Chat response sent to mobile app via WebSocket');
                    }
                }, config_1.CONFIG.FILE_WATCH_DELAY);
            }
            catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                this.logError('Error reading/parsing CHAT_SUMMARY', error);
            }
        };
        watcher.onDidCreate(safeRead);
        watcher.onDidChange(safeRead);
        context.subscriptions.push(watcher);
        this.log(`✅ Started watching: ${chatSummaryFile}`);
    }
}
exports.RulesManager = RulesManager;
//# sourceMappingURL=rules-manager.js.map