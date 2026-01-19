import * as vscode from 'vscode';

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

    async getAIResponse(): Promise<string> {
        // Cursor AI 응답을 가져오는 로직
        // 실제 구현은 Cursor API에 따라 달라질 수 있음
        // TODO: Cursor AI API 연동
        return 'AI response placeholder';
    }

    dispose() {
        // 정리 작업
    }
}
