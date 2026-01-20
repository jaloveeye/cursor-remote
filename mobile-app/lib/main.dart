import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Cursor Remote',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
        useMaterial3: true,
      ),
      home: const HomePage(),
    );
  }
}

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class MessageItem {
  final String text;
  final String type; // 'normal', 'chat_response', 'user_message', etc.
  
  MessageItem(this.text, {this.type = 'normal'});
}

class _HomePageState extends State<HomePage> with WidgetsBindingObserver {
  WebSocketChannel? _channel;
  String _serverAddress = '';
  bool _isConnected = false;
  final List<MessageItem> _messages = [];
  final TextEditingController _commandController = TextEditingController();
  final TextEditingController _serverAddressController = TextEditingController();
  final FocusNode _serverAddressFocusNode = FocusNode();
  final FocusNode _commandFocusNode = FocusNode();
  final ScrollController _scrollController = ScrollController();

  void _connect() {
    // TextField에서 값을 가져오기
    final address = _serverAddressController.text.trim();
    if (address.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('서버 주소를 입력하세요')),
      );
      return;
    }
    
    setState(() {
      _serverAddress = address;
    });

    try {
      final uri = Uri.parse('ws://$_serverAddress:8767');
      _channel = WebSocketChannel.connect(uri);

      _channel!.stream.listen(
        (message) {
          if (!mounted) return; // 위젯이 마운트되지 않았으면 리턴
          // Future.microtask를 사용하여 다음 프레임에서 setState 실행
          Future.microtask(() {
            if (!mounted) return;
            try {
              setState(() {
                try {
                  final json = message.toString();
                  _messages.add(MessageItem('Received: $json'));
                  
                  // JSON 파싱 시도
                  final decoded = jsonDecode(json);
                  if (decoded is Map) {
                    final type = decoded['type'];
                    if (type == 'command_result') {
                      if (decoded['success'] == true) {
                        _messages.add(MessageItem('✅ Command succeeded'));
                      } else {
                        _messages.add(MessageItem('❌ Command failed: ${decoded['error']}'));
                      }
                    } else if (type == 'connected') {
                      _messages.add(MessageItem('✅ ${decoded['message']}'));
                      // 연결 확인 시 상태 업데이트
                      if (!_isConnected) {
                        _isConnected = true;
                      }
                    } else if (type == 'error') {
                      _messages.add(MessageItem('❌ Error: ${decoded['message']}'));
                    } else if (type == 'user_message') {
                      // 사용자 메시지 (대화 히스토리용)
                      final text = decoded['text'] ?? '';
                      _messages.add(MessageItem('💬 You: $text', type: 'user_message'));
                    } else if (type == 'gemini_response') {
                      // Gemini 응답 (대화 히스토리용)
                      final text = decoded['text'] ?? '';
                      _messages.add(MessageItem('🤖 Gemini: $text', type: 'gemini_response'));
                    } else if (type == 'terminal_output') {
                      // 터미널 출력
                      final text = decoded['text'] ?? '';
                      _messages.add(MessageItem('📟 Terminal: $text', type: 'terminal_output'));
                    } else if (type == 'chat_response') {
                      // Cursor IDE 채팅 응답 - 구분감 있게 표시
                      final text = decoded['text'] ?? '';
                      _messages.add(MessageItem('', type: 'chat_response_divider')); // 구분선
                      _messages.add(MessageItem('🤖 Cursor AI Response', type: 'chat_response_header'));
                      _messages.add(MessageItem(text, type: 'chat_response'));
                      _messages.add(MessageItem('', type: 'chat_response_divider')); // 구분선
                    }
                  }
                } catch (e) {
                  _messages.add(MessageItem('Received: $message'));
                }
              });
              // 새 메시지 추가 후 자동으로 맨 아래로 스크롤
              _scrollToBottom();
            } catch (e) {
              // setState 에러 처리
              if (mounted) {
                try {
                  setState(() {
                    _messages.add(MessageItem('Error processing message: $e'));
                  });
                } catch (setStateError) {
                  // setState 에러 무시
                }
              }
            }
          });
        },
        onError: (error) {
          if (!mounted) return;
          try {
            setState(() {
              _isConnected = false;
              _messages.add(MessageItem('Error: $error'));
            });
          } catch (e) {
            // setState 에러 무시
          }
        },
        onDone: () {
          if (!mounted) return;
          try {
            setState(() {
              _isConnected = false;
              _messages.add(MessageItem('Connection closed'));
            });
          } catch (e) {
            // setState 에러 무시
          }
        },
        cancelOnError: false, // 에러 발생 시 스트림 취소 방지
      );

      if (mounted) {
        setState(() {
          _isConnected = true;
          _messages.add(MessageItem('Connected to $_serverAddress:8767'));
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Connection error: $e')),
        );
        setState(() {
          _isConnected = false;
          _messages.add(MessageItem('Connection failed: $e'));
        });
      }
    }
  }

  void _disconnect() {
    try {
      _channel?.sink.close();
    } catch (e) {
      // 연결이 이미 끊어진 경우 무시
    }
    if (mounted) {
      setState(() {
        _isConnected = false;
        _messages.add(MessageItem('Disconnected'));
      });
    }
  }

  void _sendCommand(String type, {String? text, String? command, List<dynamic>? args, bool? prompt, bool? terminal, bool? execute, String? action}) {
    // 연결 상태 재확인
    _checkConnectionState();
    
    if (_channel == null || !_isConnected) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Not connected')),
        );
      }
      return;
    }

    try {
      final message = {
        'type': type,
        'id': DateTime.now().millisecondsSinceEpoch.toString(),
        if (text != null) 'text': text,
        if (command != null) 'command': command,
        if (args != null) 'args': args,
        if (prompt != null) 'prompt': prompt,
        if (terminal != null) 'terminal': terminal,
        if (execute != null) 'execute': execute,
        if (action != null) 'action': action,
      };

      _channel!.sink.add(jsonEncode(message));
      if (mounted) {
        try {
          setState(() {
            _messages.add(MessageItem('Sent: ${message.toString()}'));
          });
          // 새 메시지 추가 후 자동으로 맨 아래로 스크롤
          _scrollToBottom();
        } catch (e) {
          // setState 에러 무시
        }
      }
    } catch (e) {
      if (mounted) {
        try {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed to send command: $e')),
          );
          setState(() {
            _isConnected = false;
            _messages.add(MessageItem('Send error: $e'));
          });
        } catch (setStateError) {
          // setState 에러 무시
        }
      }
    }
  }

  void _scrollToBottom() {
    // 다음 프레임에서 스크롤 (위젯이 빌드된 후)
    if (!mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && _scrollController.hasClients) {
        try {
          _scrollController.animateTo(
            _scrollController.position.maxScrollExtent,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeOut,
          );
        } catch (e) {
          // 스크롤 에러 무시
        }
      }
    });
  }

  Widget _buildMessageItem(MessageItem message) {
    // 구분선
    if (message.type == 'chat_response_divider') {
      return const Divider(
        height: 1,
        thickness: 2,
        color: Colors.blue,
      );
    }
    
    // 헤더
    if (message.type == 'chat_response_header') {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
        color: Colors.blue.withOpacity(0.1),
        child: Row(
          children: [
            const Icon(Icons.smart_toy, size: 18, color: Colors.blue),
            const SizedBox(width: 8),
            Text(
              message.text,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: Colors.blue,
              ),
            ),
          ],
        ),
      );
    }
    
    // 채팅 응답 본문
    if (message.type == 'chat_response') {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
        color: Colors.blue.withOpacity(0.05),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SelectableText(
              message.text,
              style: const TextStyle(
                fontSize: 13,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 4),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                IconButton(
                  icon: const Icon(Icons.copy, size: 16),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  onPressed: () {
                    Clipboard.setData(ClipboardData(text: message.text));
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('메시지가 클립보드에 복사되었습니다'),
                        duration: Duration(seconds: 1),
                      ),
                    );
                  },
                ),
              ],
            ),
          ],
        ),
      );
    }
    
    // 일반 메시지
    return ListTile(
      title: Text(
        message.text,
        style: const TextStyle(fontSize: 13),
      ),
      dense: true,
      contentPadding: const EdgeInsets.symmetric(
        horizontal: 16.0,
        vertical: 2.0,
      ),
      trailing: IconButton(
        icon: const Icon(Icons.copy, size: 16),
        padding: EdgeInsets.zero,
        constraints: const BoxConstraints(),
        onPressed: () {
          Clipboard.setData(ClipboardData(text: message.text));
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('메시지가 클립보드에 복사되었습니다'),
              duration: Duration(seconds: 1),
            ),
          );
        },
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    if (state == AppLifecycleState.resumed) {
      // 앱이 다시 활성화되었을 때 연결 상태 확인 및 UI 갱신
      if (mounted) {
        // 연결 상태 확인
        _checkConnectionState();
        // UI 강제 갱신 - Future.microtask를 사용하여 다음 프레임에서 실행
        Future.microtask(() {
          if (mounted) {
            setState(() {
              // 상태 갱신으로 UI 다시 렌더링
            });
          }
        });
      }
    } else if (state == AppLifecycleState.paused) {
      // 앱이 백그라운드로 갔을 때는 특별한 처리가 필요 없음
    }
  }

  // 연결 상태 확인 및 필요시 재연결
  void _checkConnectionState() {
    if (_channel == null && _isConnected) {
      // 채널이 null인데 연결 상태가 true면 상태 불일치
      if (mounted) {
        setState(() {
          _isConnected = false;
          _messages.add(MessageItem('⚠️ Connection lost, please reconnect'));
        });
      }
    } else if (_channel != null && !_isConnected) {
      // 채널이 있는데 연결 상태가 false면 상태 불일치
      if (mounted) {
        setState(() {
          _isConnected = true;
        });
      }
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    try {
      _channel?.sink.close();
    } catch (e) {
      // 연결이 이미 끊어진 경우 무시
    }
    _commandController.dispose();
    _serverAddressController.dispose();
    _scrollController.dispose();
    _serverAddressFocusNode.dispose();
    _commandFocusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        title: const Text('Cursor Remote'),
      ),
      body: Column(
        children: [
          // 최상단: 접었다 폈다 할 수 있는 서버 연결 섹션
          ExpansionTile(
            leading: Icon(
              _isConnected ? Icons.cloud_done : Icons.cloud_off,
              color: _isConnected ? Colors.green : Colors.grey,
            ),
            title: Text(
              _isConnected ? 'Connected' : 'Disconnected',
              style: TextStyle(
                color: _isConnected ? Colors.green : Colors.grey,
                fontWeight: FontWeight.bold,
              ),
            ),
            subtitle: _isConnected && _serverAddress.isNotEmpty
                ? Text(
                    '$_serverAddress:8767',
                    style: const TextStyle(fontSize: 12),
                  )
                : null,
            initiallyExpanded: false,
            children: [
              Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextField(
                      controller: _serverAddressController,
                      focusNode: _serverAddressFocusNode,
                      decoration: const InputDecoration(
                        labelText: 'Server Address',
                        hintText: '192.168.0.10',
                        border: OutlineInputBorder(),
                        isDense: true,
                        contentPadding: EdgeInsets.all(12),
                      ),
                      enabled: !_isConnected,
                      keyboardType: TextInputType.number,
                      onChanged: (value) {
                        setState(() {
                          _serverAddress = value;
                        });
                      },
                    ),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: [
                        Expanded(
                          child: ElevatedButton(
                            onPressed: _isConnected ? null : _connect,
                            style: ElevatedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                            child: const Text('Connect'),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: ElevatedButton(
                            onPressed: _isConnected ? _disconnect : null,
                            style: ElevatedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                            child: const Text('Disconnect'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const Divider(height: 1),
          // 가운데: 메시지 로그 (가장 많은 공간 차지)
          Expanded(
            child: Card(
              margin: const EdgeInsets.all(8.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Padding(
                    padding: EdgeInsets.all(12.0),
                    child: Text(
                      'Messages',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  const Divider(height: 1),
                  Expanded(
                    child: _messages.isEmpty
                        ? const Center(
                            child: Text(
                              'No messages yet',
                              style: TextStyle(
                                color: Colors.grey,
                                fontSize: 14,
                              ),
                            ),
                          )
                        : ListView.builder(
                            controller: _scrollController,
                            itemCount: _messages.length,
                            padding: const EdgeInsets.symmetric(vertical: 4),
                            itemBuilder: (context, index) {
                              return GestureDetector(
                                onLongPress: () {
                                  Clipboard.setData(ClipboardData(text: _messages[index].text));
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text('메시지가 클립보드에 복사되었습니다'),
                                      duration: Duration(seconds: 1),
                                    ),
                                  );
                                },
                                child: _buildMessageItem(_messages[index]),
                              );
                            },
                          ),
                  ),
                ],
              ),
            ),
          ),
          // 맨 아래: 명령 입력 섹션
          if (_isConnected) ...[
            const Divider(height: 1),
            Card(
              margin: const EdgeInsets.all(8.0),
              child: Padding(
                padding: const EdgeInsets.all(12.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                      controller: _commandController,
                      focusNode: _commandFocusNode,
                      decoration: const InputDecoration(
                        labelText: 'Command',
                        border: OutlineInputBorder(),
                        isDense: true,
                        contentPadding: EdgeInsets.all(12),
                      ),
                      textInputAction: TextInputAction.newline,
                      keyboardType: TextInputType.multiline,
                      maxLines: 3,
                      minLines: 2,
                      enableSuggestions: true,
                      autocorrect: true,
                      textCapitalization: TextCapitalization.none,
                      // 한영전환 문제 해결을 위한 설정
                      onChanged: (value) {
                        // 입력 변경 시 UI 강제 업데이트
                        if (mounted) {
                          setState(() {
                            // TextField 상태 업데이트를 위해 setState 호출
                          });
                          // 포커스 유지
                          if (!_commandFocusNode.hasFocus) {
                            _commandFocusNode.requestFocus();
                          }
                        }
                      },
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: [
                        Expanded(
                          child: ElevatedButton(
                            onPressed: _isConnected ? () {
                              if (!mounted) return;
                              final text = _commandController.text;
                              if (text.isNotEmpty) {
                                // UI 업데이트를 위해 명시적으로 setState 호출
                                setState(() {
                                  // 버튼 클릭 상태 업데이트
                                });
                                _sendCommand('insert_text', text: text, prompt: true, execute: true);
                                // 텍스트 클리어 후 UI 업데이트
                                _commandController.clear();
                                if (mounted) {
                                  setState(() {
                                    // TextField 클리어 후 UI 업데이트
                                  });
                                }
                              }
                            } : null,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.blue,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                            ),
                            child: const Text('Send to Prompt'),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: ElevatedButton(
                            onPressed: _isConnected ? () {
                              if (!mounted) return;
                              // UI 업데이트를 위해 명시적으로 setState 호출
                              setState(() {
                                // 버튼 클릭 상태 업데이트
                              });
                              _sendCommand('stop_prompt');
                            } : null,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.red,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                            ),
                            child: const Text('Stop'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
