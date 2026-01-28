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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
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
     * CHAT_SUMMARY 규칙 파일 생성 제거됨
     * 이제 stdout 응답만 사용하므로 규칙 파일이 더 이상 필요하지 않음
     */
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
}
exports.RulesManager = RulesManager;
//# sourceMappingURL=rules-manager.js.map