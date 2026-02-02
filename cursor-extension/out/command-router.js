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
     * Handle insert_text command
     */
    async handleInsertText(command) {
        try {
            this.log(`insert_text command - terminal: ${command.terminal}, prompt: ${command.prompt}, text length: ${command.text?.length || 0}, clientId: ${command.clientId || "none"}`);
            const isTerminal = command.terminal === true || command.terminal === "true";
            const isPrompt = command.prompt === true || command.prompt === "true";
            const execute = command.execute === true;
            if (isTerminal) {
                this.log("Routing to terminal");
                await this.commandHandler.insertToTerminal(command.text || "", execute);
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
                await this.commandHandler.insertToPrompt(command.text || "", execute, command.clientId, newSession, agentMode, command.senderDeviceId // 유니캐스트 응답용
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
                await this.commandHandler.insertText(command.text || "");
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