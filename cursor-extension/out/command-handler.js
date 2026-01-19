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
            throw new Error('No active editor');
        }
        await editor.edit(editBuilder => {
            const position = editor.selection.active;
            editBuilder.insert(position, text);
        });
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