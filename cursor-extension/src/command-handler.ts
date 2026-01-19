import * as vscode from 'vscode';
import * as path from 'path';

export class CommandHandler {
    async insertText(text: string): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            throw new Error('No active editor');
        }

        await editor.edit(editBuilder => {
            const position = editor.selection.active;
            editBuilder.insert(position, text);
        });
    }

    async executeCommand(command: string, ...args: any[]): Promise<any> {
        return await vscode.commands.executeCommand(command, ...args);
    }

    async getActiveFile(): Promise<{ path: string; content: string } | null> {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !editor.document) {
            return null;
        }

        return {
            path: editor.document.fileName,
            content: editor.document.getText()
        };
    }

    async saveFile(): Promise<{ success: boolean; path?: string }> {
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

    async getAIResponse(): Promise<string> {
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
