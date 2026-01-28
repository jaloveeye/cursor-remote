"use strict";
/**
 * Chat capture module for monitoring and capturing AI responses
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
exports.ChatCapture = void 0;
const vscode = __importStar(require("vscode"));
const config_1 = require("./config");
class ChatCapture {
    constructor(outputChannel, wsServer) {
        this.monitor = {
            interval: null,
            lastContent: '',
            currentUri: null,
            isProcessing: false,
            lastProcessedHash: '',
            debounceTimer: null
        };
        this.outputChannel = outputChannel;
        this.wsServer = wsServer;
    }
    log(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ${message}`;
        this.outputChannel.appendLine(logMessage);
        console.log(logMessage);
    }
    /**
     * Setup chat document monitoring
     */
    setup(context) {
        this.log('Setting up chat document monitoring...');
        this.outputChannel.show(true);
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const workspaceRoot = workspaceFolders[0].uri.fsPath;
            this.startDocumentMonitoring(context);
        }
        else {
            this.log('⚠️ No workspace folder found, skipping chat monitoring');
        }
        this.log('✅ Chat document monitoring setup complete');
    }
    /**
     * Start monitoring chat documents
     */
    startDocumentMonitoring(context) {
        this.log('🔍 Checking all open documents...');
        vscode.workspace.textDocuments.forEach((doc) => {
            this.log(`📄 Document: ${doc.uri.scheme}://${doc.uri.toString()}`);
        });
        // Active editor change listener
        const editorChangeListener = vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor) {
                const uri = editor.document.uri;
                this.log(`🔄 Active editor changed: ${uri.scheme}://${uri.toString()}`);
                const isChatDocument = this.isChatDocument(uri, editor.document);
                if (isChatDocument) {
                    this.log(`📝 Chat document detected: ${uri.toString()}`);
                    this.monitor.currentUri = uri;
                    this.monitor.lastContent = editor.document.getText();
                    this.log(`📊 Initial content length: ${this.monitor.lastContent.length} bytes`);
                    if (!this.monitor.interval) {
                        this.startPolling();
                    }
                }
                else {
                    // Monitor any document for debugging
                    this.log(`📝 Monitoring any document: ${uri.toString()}`);
                    this.monitor.currentUri = uri;
                    this.monitor.lastContent = editor.document.getText();
                    if (!this.monitor.interval) {
                        this.startPolling();
                    }
                }
            }
        });
        context.subscriptions.push(editorChangeListener);
        // Initial active editor check
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            const uri = activeEditor.document.uri;
            this.log(`📄 Initial active editor: ${uri.scheme}://${uri.toString()}`);
            this.monitor.currentUri = uri;
            this.monitor.lastContent = activeEditor.document.getText();
            this.log(`📊 Initial content: ${this.monitor.lastContent.length} bytes`);
            this.startPolling();
        }
        else {
            this.log('⚠️ No active editor found');
        }
        // Document change listener
        const documentChangeListener = vscode.workspace.onDidChangeTextDocument((event) => {
            const uri = event.document.uri;
            if (uri.scheme === 'output') {
                return; // Ignore output channel changes
            }
            if (this.monitor.isProcessing) {
                return;
            }
            if (this.monitor.currentUri && event.document.uri.toString() === this.monitor.currentUri.toString()) {
                const newContent = event.document.getText();
                // Duplicate check
                const contentHash = newContent.substring(Math.max(0, newContent.length - config_1.CONFIG.MAX_CONTENT_CHECK_LENGTH));
                if (contentHash === this.monitor.lastProcessedHash && newContent.length === this.monitor.lastContent.length) {
                    return;
                }
                if (newContent.length > this.monitor.lastContent.length) {
                    // Debounce
                    if (this.monitor.debounceTimer) {
                        clearTimeout(this.monitor.debounceTimer);
                    }
                    this.monitor.debounceTimer = setTimeout(() => {
                        const addedContent = newContent.substring(this.monitor.lastContent.length);
                        const addedContentHash = addedContent.substring(0, Math.min(500, addedContent.length));
                        if (addedContentHash === this.monitor.lastProcessedHash) {
                            return;
                        }
                        this.monitor.lastProcessedHash = contentHash;
                        this.processNewContent(addedContent, newContent);
                        this.monitor.lastContent = newContent;
                    }, config_1.CONFIG.CHAT_DEBOUNCE_DELAY);
                }
            }
        });
        context.subscriptions.push(documentChangeListener);
    }
    /**
     * Check if document is a chat document
     */
    isChatDocument(uri, document) {
        return uri.scheme === 'vscode' ||
            uri.scheme === 'cursor' ||
            uri.scheme === 'output' ||
            uri.fsPath.includes('chat') ||
            uri.toString().includes('chat') ||
            uri.toString().includes('Chat') ||
            document.languageId === 'markdown' ||
            document.fileName.includes('chat');
    }
    /**
     * Start polling chat document
     */
    startPolling() {
        if (this.monitor.interval) {
            return; // Already running
        }
        this.monitor.interval = setInterval(() => {
            if (this.monitor.isProcessing) {
                return;
            }
            if (!this.monitor.currentUri) {
                // Check all documents
                const allDocs = vscode.workspace.textDocuments;
                if (allDocs.length > 0) {
                    const doc = allDocs[allDocs.length - 1];
                    if (doc.uri.scheme !== 'output') {
                        this.monitor.currentUri = doc.uri;
                        this.monitor.lastContent = doc.getText();
                    }
                }
                return;
            }
            try {
                const document = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === this.monitor.currentUri.toString());
                if (document) {
                    if (document.uri.scheme === 'output') {
                        return;
                    }
                    const currentContent = document.getText();
                    if (currentContent.length > this.monitor.lastContent.length) {
                        const newContent = currentContent.substring(this.monitor.lastContent.length);
                        const contentHash = currentContent.substring(Math.max(0, currentContent.length - config_1.CONFIG.MAX_CONTENT_CHECK_LENGTH));
                        if (contentHash !== this.monitor.lastProcessedHash) {
                            this.monitor.lastProcessedHash = contentHash;
                            this.processNewContent(newContent, currentContent);
                            this.monitor.lastContent = currentContent;
                        }
                    }
                    else if (currentContent.length < this.monitor.lastContent.length) {
                        // Content decreased (new chat started)
                        this.monitor.lastContent = currentContent;
                        this.monitor.lastProcessedHash = '';
                    }
                }
            }
            catch (error) {
                // Silently handle errors
            }
        }, config_1.CONFIG.CHAT_POLLING_INTERVAL);
    }
    /**
     * Process new chat content
     */
    processNewContent(newContent, fullContent) {
        if (this.monitor.isProcessing) {
            return;
        }
        this.monitor.isProcessing = true;
        try {
            const lines = fullContent.split('\n');
            // Find AI response start
            let aiResponseStart = -1;
            for (let i = lines.length - 1; i >= 0; i--) {
                for (const pattern of config_1.CONFIG.AI_RESPONSE_PATTERNS) {
                    if (lines[i].match(pattern)) {
                        aiResponseStart = i;
                        break;
                    }
                }
                if (aiResponseStart >= 0)
                    break;
            }
            // If pattern not found but content is large enough, treat as AI response
            if (aiResponseStart < 0 && newContent.length > 100) {
                const lastBlock = lines.slice(Math.max(0, lines.length - 20)).join('\n').trim();
                if (lastBlock.length > config_1.CONFIG.MIN_AI_RESPONSE_LENGTH) {
                    const blockHash = lastBlock.substring(0, Math.min(config_1.CONFIG.CONTENT_HASH_LENGTH, lastBlock.length));
                    if (blockHash !== this.monitor.lastProcessedHash) {
                        this.monitor.lastProcessedHash = blockHash;
                        if (this.wsServer) {
                            this.wsServer.sendFromHook({
                                type: 'chat_response',
                                text: lastBlock,
                                timestamp: new Date().toISOString()
                            });
                        }
                    }
                }
                return;
            }
            if (aiResponseStart >= 0) {
                const aiResponse = lines.slice(aiResponseStart + 1).join('\n').trim();
                if (aiResponse.length > config_1.CONFIG.MIN_AI_RESPONSE_LENGTH) {
                    const responseHash = aiResponse.substring(0, Math.min(config_1.CONFIG.CONTENT_HASH_LENGTH, aiResponse.length));
                    if (responseHash !== this.monitor.lastProcessedHash) {
                        this.monitor.lastProcessedHash = responseHash;
                        if (this.wsServer) {
                            this.wsServer.sendFromHook({
                                type: 'chat_response',
                                text: aiResponse,
                                timestamp: new Date().toISOString()
                            });
                        }
                    }
                }
            }
        }
        finally {
            setTimeout(() => {
                this.monitor.isProcessing = false;
            }, 500);
        }
    }
    /**
     * Dispose resources
     */
    dispose() {
        if (this.monitor.interval) {
            clearInterval(this.monitor.interval);
            this.monitor.interval = null;
        }
        if (this.monitor.debounceTimer) {
            clearTimeout(this.monitor.debounceTimer);
            this.monitor.debounceTimer = null;
        }
    }
}
exports.ChatCapture = ChatCapture;
//# sourceMappingURL=chat-capture.js.map