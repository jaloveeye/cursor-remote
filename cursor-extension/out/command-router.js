"use strict";
/**
 * Command routing module for handling WebSocket commands
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandRouter = void 0;
class CommandRouter {
    constructor(commandHandler, wsServer, outputChannel) {
        this.commandHandler = commandHandler;
        this.wsServer = wsServer;
        this.outputChannel = outputChannel;
    }
    log(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ${message}`;
        this.outputChannel.appendLine(logMessage);
        console.log(logMessage);
    }
    logError(message, error) {
        const timestamp = new Date().toLocaleTimeString();
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        const logMessage = `[${timestamp}] ❌ ${message}: ${errorMsg}`;
        this.outputChannel.appendLine(logMessage);
        console.error(logMessage);
    }
    /**
     * Handle incoming command
     */
    async handleCommand(command) {
        if (!this.commandHandler || !this.wsServer) {
            return;
        }
        const commandId = command.id || Date.now().toString();
        this.log(`HandleCommand: type=${command.type}, clientId=${command.clientId || "none"}`);
        try {
            let result = null;
            switch (command.type) {
                case "insert_text":
                    result = await this.handleInsertText(command);
                    break;
                case "execute_command":
                    result = await this.handleExecuteCommand(command);
                    break;
                case "get_ai_response":
                    result = await this.handleGetAIResponse();
                    break;
                case "get_session_info":
                    result = await this.handleGetSessionInfo(command);
                    break;
                case "get_chat_history":
                    result = await this.handleGetChatHistory(command);
                    break;
                case "get_active_file":
                    result = await this.handleGetActiveFile();
                    break;
                case "save_file":
                    result = await this.handleSaveFile();
                    break;
                case "stop_prompt":
                    result = await this.handleStopPrompt();
                    break;
                case "execute_action":
                    result = await this.handleExecuteAction(command);
                    break;
                default:
                    const errorMsg = `Unknown command type: ${command.type}`;
                    this.log(errorMsg);
                    console.warn("Unknown command type:", command.type);
                    this.wsServer.send(JSON.stringify({
                        id: commandId,
                        type: "command_result",
                        success: false,
                        error: errorMsg,
                    }));
                    return;
            }
            // Send success response
            const successMsg = `Command ${command.type} executed successfully`;
            this.log(successMsg);
            // result에 success가 이미 포함되어 있을 수 있으므로 분리
            const { success: _, ...resultWithoutSuccess } = result || {};
            this.wsServer.send(JSON.stringify({
                id: commandId,
                type: "command_result",
                success: true,
                command_type: command.type,
                ...resultWithoutSuccess,
            }));
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : "Unknown error";
            this.logError("Error handling command", error);
            console.error("Error handling command:", error);
            this.wsServer.send(JSON.stringify({
                id: commandId,
                type: "command_result",
                success: false,
                error: errorMsg,
            }));
        }
    }
    /**
     * Cursor 스트림 JSON(시스템/유저 라인)이 그대로 text로 오면 사용자 발화만 추출
     */
    normalizePromptText(raw) {
        const trimmed = (raw ?? "").trim();
        if (!trimmed)
            return trimmed;
        // 한 줄에 하나의 JSON인 스트림 형식: {"type":"system",...}\n{"type":"user","message":{...}}
        const lines = trimmed.split("\n").filter((line) => line.trim().length > 0);
        for (const line of lines) {
            try {
                const obj = JSON.parse(line.trim());
                if (obj.type === "user" && obj.message?.content?.length) {
                    for (const c of obj.message.content) {
                        if (c.type === "text" && typeof c.text === "string" && c.text) {
                            return c.text.trim();
                        }
                    }
                }
            }
            catch {
                // JSON이 아니면 무시
            }
        }
        // 단일 JSON 객체로 전체가 감싸진 경우 (예: message.content[0].text)
        try {
            const obj = JSON.parse(trimmed);
            if (obj.type === "user" && obj.message?.content?.length) {
                for (const c of obj.message.content) {
                    if (c.type === "text" && typeof c.text === "string" && c.text) {
                        return c.text.trim();
                    }
                }
            }
        }
        catch {
            // 전체가 JSON이 아니면 원문 그대로 사용
        }
        return trimmed;
    }
    /**
     * Handle insert_text command
     */
    async handleInsertText(command) {
        try {
            const rawText = command.text ?? "";
            const text = this.normalizePromptText(rawText);
            if (rawText !== text && text) {
                this.log(`insert_text: extracted user text from stream JSON (length ${rawText.length} -> ${text.length})`);
            }
            this.log(`insert_text command - terminal: ${command.terminal}, prompt: ${command.prompt}, text length: ${text.length}, clientId: ${command.clientId || "none"}`);
            const isTerminal = command.terminal === true || command.terminal === "true";
            const isPrompt = command.prompt === true || command.prompt === "true";
            const execute = command.execute === true;
            if (isTerminal) {
                this.log("Routing to terminal");
                await this.commandHandler.insertToTerminal(text, execute);
                return {
                    success: true,
                    message: execute
                        ? "Text sent to terminal and executed"
                        : "Text sent to terminal",
                };
            }
            else if (isPrompt) {
                this.log("Routing to prompt");
                const newSession = command.newSession === true;
                const agentMode = command.agentMode || "auto";
                await this.commandHandler.insertToPrompt(text, execute, command.clientId, newSession, agentMode, command.senderDeviceId // 유니캐스트 응답용
                );
                return {
                    success: true,
                    message: execute
                        ? "Text inserted to prompt and executed"
                        : "Text inserted to prompt",
                };
            }
            else {
                this.log("Routing to editor (fallback)");
                await this.commandHandler.insertText(text);
                return { success: true, message: "Text inserted" };
            }
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : "Unknown error";
            this.logError("Error in insert_text", error);
            return { success: false, error: errorMsg };
        }
    }
    /**
     * Handle execute_command
     */
    async handleExecuteCommand(command) {
        const result = await this.commandHandler.executeCommand(command.command || "", ...(command.args || []));
        return { success: true, result: result };
    }
    /**
     * Handle get_ai_response
     */
    async handleGetAIResponse() {
        const response = await this.commandHandler.getAIResponse();
        return { success: true, data: response };
    }
    /**
     * Handle get_session_info
     */
    async handleGetSessionInfo(command) {
        const clientId = command.clientId;
        const sessionInfo = await this.commandHandler.getSessionInfo(clientId);
        return { success: true, data: sessionInfo };
    }
    /**
     * Handle get_chat_history
     */
    async handleGetChatHistory(command) {
        const clientId = command.clientId;
        const sessionId = command.sessionId;
        const limit = command.limit || 50;
        const history = await this.commandHandler.getChatHistory(clientId, sessionId, limit);
        return { success: true, data: history };
    }
    /**
     * Handle get_active_file
     */
    async handleGetActiveFile() {
        const result = await this.commandHandler.getActiveFile();
        if (result) {
            return { success: true, ...result };
        }
        return { success: false, error: "No active file" };
    }
    /**
     * Handle save_file
     */
    async handleSaveFile() {
        const result = await this.commandHandler.saveFile();
        return result;
    }
    /**
     * Handle stop_prompt
     */
    async handleStopPrompt() {
        const result = await this.commandHandler.stopPrompt();
        return result;
    }
    /**
     * Handle execute_action
     */
    async handleExecuteAction(command) {
        const result = await this.commandHandler.executeAction(command.action || "");
        return result;
    }
}
exports.CommandRouter = CommandRouter;
//# sourceMappingURL=command-router.js.map