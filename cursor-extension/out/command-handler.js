"use strict";
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
exports.CommandHandler = void 0;
const vscode = __importStar(require("vscode"));
class CommandHandler {
    async insertText(text) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            throw new Error('No active editor. Please open a file in Cursor IDE.');
        }
        const success = await editor.edit(editBuilder => {
            const position = editor.selection.active;
            editBuilder.insert(position, text);
        });
        if (!success) {
            throw new Error('Failed to insert text. The editor may be read-only or the edit was rejected.');
        }
    }
    async insertToPrompt(text) {
        try {
            // Cursor IDE의 채팅 패널을 여는 명령 시도
            // 여러 가능한 명령을 시도
            const chatCommands = [
                'cursor.chat.focus',
                'cursor.showChat',
                'workbench.action.chat.open',
                'workbench.action.quickChat',
            ];
            let chatOpened = false;
            for (const cmd of chatCommands) {
                try {
                    await vscode.commands.executeCommand(cmd);
                    chatOpened = true;
                    // 명령이 성공하면 잠시 대기
                    await new Promise(resolve => setTimeout(resolve, 300));
                    break;
                }
                catch (e) {
                    // 명령이 없으면 다음 시도
                    continue;
                }
            }
            // 클립보드에 텍스트 복사
            await vscode.env.clipboard.writeText(text);
            // 붙여넣기 명령 실행
            await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
            // 또는 type 명령으로 직접 입력 시도
            // await vscode.commands.executeCommand('type', { text: text });
        }
        catch (error) {
            // 채팅 패널 열기 실패 시, 입력 상자로 대체
            const result = await vscode.window.showInputBox({
                prompt: '프롬프트 입력',
                value: text,
                ignoreFocusOut: true
            });
            if (result === undefined) {
                throw new Error('프롬프트 입력이 취소되었습니다.');
            }
        }
    }
    async executeCommand(command, ...args) {
        return await vscode.commands.executeCommand(command, ...args);
    }
    async getActiveFile() {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !editor.document) {
            return null;
        }
        return {
            path: editor.document.fileName,
            content: editor.document.getText()
        };
    }
    async saveFile() {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !editor.document) {
            throw new Error('No active editor');
        }
        await editor.document.save();
        return {
            success: true,
            path: editor.document.fileName
        };
    }
    async getAIResponse() {
        // Cursor AI 응답을 가져오는 로직
        // 실제 구현은 Cursor API에 따라 달라질 수 있음
        // TODO: Cursor AI API 연동
        // 현재는 채팅 히스토리나 최근 AI 응답을 가져오는 방식으로 구현 가능
        return 'AI response placeholder - Cursor AI API integration needed';
    }
    dispose() {
        // 정리 작업
    }
}
exports.CommandHandler = CommandHandler;
//# sourceMappingURL=command-handler.js.map