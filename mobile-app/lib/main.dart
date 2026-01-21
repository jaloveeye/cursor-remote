import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
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

// 메시지 타입 상수
class MessageType {
  static const String normal = 'normal';
  static const String chatResponse = 'chat_response';
  static const String chatResponseHeader = 'chat_response_header';
  static const String chatResponseDivider = 'chat_response_divider';
  static const String userMessage = 'user_message';
  static const String userPrompt = 'user_prompt'; // 사용자가 입력한 프롬프트
  static const String geminiResponse = 'gemini_response';
  static const String terminalOutput = 'terminal_output';
  static const String system = 'system'; // Sent, Received, Command succeeded 등
}

// 필터 카테고리
enum MessageFilter {
  aiResponse,   // Cursor AI Response
  userPrompt,   // 사용자가 입력한 프롬프트
  system,       // Sent, Received, Command succeeded 등
}

class MessageItem {
  final String text;
  final String type; // MessageType 상수 사용
  final DateTime timestamp;
  
  MessageItem(this.text, {this.type = MessageType.normal}) : timestamp = DateTime.now();
  
  // 필터 카테고리 결정
  MessageFilter? get filterCategory {
    switch (type) {
      case MessageType.chatResponse:
      case MessageType.chatResponseHeader:
      case MessageType.chatResponseDivider:
      case MessageType.geminiResponse:
        return MessageFilter.aiResponse;
      case MessageType.userPrompt:
        return MessageFilter.userPrompt;
      case MessageType.system:
      case MessageType.normal:
      case MessageType.terminalOutput:
        return MessageFilter.system;
      default:
        return MessageFilter.system;
    }
  }
}

class _HomePageState extends State<HomePage> with WidgetsBindingObserver {
  WebSocketChannel? _channel;
  String _serverAddress = '';
  bool _isConnected = false;
  bool _isWaitingForResponse = false; // 응답 대기 중 상태
  final List<MessageItem> _messages = [];
  final TextEditingController _commandController = TextEditingController();
  final TextEditingController _serverAddressController = TextEditingController();
  final FocusNode _serverAddressFocusNode = FocusNode();
  final FocusNode _commandFocusNode = FocusNode();
  final ScrollController _scrollController = ScrollController();
  final ExpansionTileController _expansionTileController = ExpansionTileController();
  
  // 필터 상태 (기본값: 모두 활성화)
  final Map<MessageFilter, bool> _activeFilters = {
    MessageFilter.aiResponse: true,
    MessageFilter.userPrompt: true,
    MessageFilter.system: true,
  };
  
  // 필터링된 메시지 목록
  List<MessageItem> get _filteredMessages {
    return _messages.where((msg) {
      final category = msg.filterCategory;
      if (category == null) return true;
      return _activeFilters[category] ?? true;
    }).toList();
  }

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
                  _messages.add(MessageItem('Received: $json', type: MessageType.system));
                  
                  // JSON 파싱 시도
                  final decoded = jsonDecode(json);
                  if (decoded is Map) {
                    final type = decoded['type'];
                    if (type == 'command_result') {
                      if (decoded['success'] == true) {
                        _messages.add(MessageItem('✅ Command succeeded', type: MessageType.system));
                        // command_result는 프롬프트 전송 성공을 의미하지만, 실제 응답은 chat_response로 옴
                        // 따라서 여기서는 대기 상태를 유지
                        // 단, stop_prompt 명령의 경우 대기 상태 해제
                        final commandType = decoded['command_type'] ?? '';
                        if (commandType == 'stop_prompt') {
                          _isWaitingForResponse = false;
                        }
                      } else {
                        _messages.add(MessageItem('❌ Command failed: ${decoded['error']}', type: MessageType.system));
                        // 명령 실패 시 대기 상태 해제
                        _isWaitingForResponse = false;
                      }
                    } else                     if (type == 'connected') {
                      _messages.add(MessageItem('✅ ${decoded['message']}', type: MessageType.system));
                      // 연결 확인 시 상태 업데이트
                      if (!_isConnected) {
                        _isConnected = true;
                      }
                      // 연결 성공 시 connect 화면 자동 닫기
                      try {
                        _expansionTileController.collapse();
                      } catch (e) {
                        // ExpansionTileController가 아직 연결되지 않은 경우 무시
                      }
                    } else if (type == 'error') {
                      _messages.add(MessageItem('❌ Error: ${decoded['message']}', type: MessageType.system));
                      // 에러 발생 시 대기 상태 해제
                      _isWaitingForResponse = false;
                    } else if (type == 'user_message') {
                      // 사용자 메시지 (대화 히스토리용)
                      final text = decoded['text'] ?? '';
                      _messages.add(MessageItem('💬 You: $text', type: MessageType.userMessage));
                    } else if (type == 'gemini_response') {
                      // Gemini 응답 (대화 히스토리용)
                      final text = decoded['text'] ?? '';
                      _messages.add(MessageItem('🤖 Gemini: $text', type: MessageType.geminiResponse));
                    } else if (type == 'terminal_output') {
                      // 터미널 출력
                      final text = decoded['text'] ?? '';
                      _messages.add(MessageItem('📟 Terminal: $text', type: MessageType.terminalOutput));
                    } else if (type == 'chat_response') {
                      // Cursor IDE 채팅 응답 - 구분감 있게 표시
                      final text = decoded['text'] ?? '';
                      _messages.add(MessageItem('', type: MessageType.chatResponseDivider)); // 구분선
                      _messages.add(MessageItem('🤖 Cursor AI Response', type: MessageType.chatResponseHeader));
                      _messages.add(MessageItem(text, type: MessageType.chatResponse));
                      _messages.add(MessageItem('', type: MessageType.chatResponseDivider)); // 구분선
                      
                      // 응답을 받았으므로 대기 상태 해제
                      _isWaitingForResponse = false;
                    }
                  }
                } catch (e) {
                  _messages.add(MessageItem('Received: $message', type: MessageType.system));
                }
              });
              // 새 메시지 추가 후 자동으로 맨 아래로 스크롤
              _scrollToBottom();
            } catch (e) {
              // setState 에러 처리
              if (mounted) {
                try {
                  setState(() {
                    _messages.add(MessageItem('Error processing message: $e', type: MessageType.system));
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
              _messages.add(MessageItem('Error: $error', type: MessageType.system));
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
              _messages.add(MessageItem('Connection closed', type: MessageType.system));
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
          _messages.add(MessageItem('Connected to $_serverAddress:8767', type: MessageType.system));
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Connection error: $e')),
        );
        setState(() {
          _isConnected = false;
          _messages.add(MessageItem('Connection failed: $e', type: MessageType.system));
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
        _messages.add(MessageItem('Disconnected', type: MessageType.system));
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

      // 프롬프트 전송 시 사용자 프롬프트를 별도로 기록하고 응답 대기 상태 설정
      if (prompt == true && execute == true && text != null) {
        setState(() {
          _isWaitingForResponse = true;
          // 사용자 프롬프트를 별도 타입으로 추가
          _messages.add(MessageItem(text, type: MessageType.userPrompt));
        });
      }

      _channel!.sink.add(jsonEncode(message));
      if (mounted) {
        try {
          setState(() {
            _messages.add(MessageItem('Sent: ${message.toString()}', type: MessageType.system));
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
            _isWaitingForResponse = false; // 에러 시 대기 상태 해제
            _messages.add(MessageItem('Send error: $e', type: MessageType.system));
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
    if (message.type == MessageType.chatResponseDivider) {
      return const Divider(
        height: 1,
        thickness: 2,
        color: Colors.blue,
      );
    }
    
    // 헤더
    if (message.type == MessageType.chatResponseHeader) {
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
    if (message.type == MessageType.chatResponse) {
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
    
    // 사용자 프롬프트 (입력한 내용) - 구분감 있게 표시
    if (message.type == MessageType.userPrompt) {
      return Container(
        margin: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
        padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
        decoration: BoxDecoration(
          color: Colors.green.withOpacity(0.1),
          borderRadius: BorderRadius.circular(8.0),
          border: Border.all(color: Colors.green.withOpacity(0.3)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.person, size: 18, color: Colors.green),
                const SizedBox(width: 8),
                const Text(
                  '📝 Your Prompt',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: Colors.green,
                  ),
                ),
                const Spacer(),
                Text(
                  _formatTime(message.timestamp),
                  style: TextStyle(
                    fontSize: 11,
                    color: Colors.grey[600],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
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
    
    // 시스템 메시지 스타일
    if (message.type == MessageType.system) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 6.0),
        child: Row(
          children: [
            Icon(
              _getSystemMessageIcon(message.text),
              size: 14,
              color: Colors.grey[600],
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                message.text,
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey[600],
                  fontStyle: FontStyle.italic,
                ),
              ),
            ),
            IconButton(
              icon: const Icon(Icons.copy, size: 14),
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
              iconSize: 14,
              color: Colors.grey[400],
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
  
  // 시스템 메시지 아이콘 결정
  IconData _getSystemMessageIcon(String text) {
    if (text.startsWith('✅')) return Icons.check_circle;
    if (text.startsWith('❌')) return Icons.error;
    if (text.startsWith('⚠️')) return Icons.warning;
    if (text.startsWith('Sent:')) return Icons.send;
    if (text.startsWith('Received:')) return Icons.download;
    if (text.contains('Connected')) return Icons.link;
    if (text.contains('Disconnected') || text.contains('Connection')) return Icons.link_off;
    return Icons.info_outline;
  }
  
  // 시간 포맷팅
  String _formatTime(DateTime time) {
    return '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}:${time.second.toString().padLeft(2, '0')}';
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
          _messages.add(MessageItem('⚠️ Connection lost, please reconnect', type: MessageType.system));
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
        actions: [
          // 응답 대기 중 인디케이터
          if (_isWaitingForResponse)
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    '응답 대기 중...',
                    style: TextStyle(fontSize: 12),
                  ),
                ],
              ),
            ),
        ],
      ),
      body: Column(
        children: [
          // 최상단: 접었다 폈다 할 수 있는 서버 연결 섹션
          ExpansionTile(
            controller: _expansionTileController,
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
                      textInputAction: TextInputAction.done,
                      onSubmitted: (value) {
                        // Enter 키를 눌렀을 때 Connect 시도
                        if (!_isConnected && value.trim().isNotEmpty) {
                          _connect();
                        }
                      },
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
                  // Messages 헤더 및 필터
                  Padding(
                    padding: const EdgeInsets.all(12.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text(
                              'Messages',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            // 메시지 개수 표시
                            Text(
                              '${_filteredMessages.length}/${_messages.length}',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.grey[600],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        // 필터 칩들
                        Wrap(
                          spacing: 8.0,
                          runSpacing: 4.0,
                          children: [
                            FilterChip(
                              label: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.smart_toy, size: 14),
                                  SizedBox(width: 4),
                                  Text('AI Response', style: TextStyle(fontSize: 12)),
                                ],
                              ),
                              selected: _activeFilters[MessageFilter.aiResponse] ?? true,
                              selectedColor: Colors.blue.withOpacity(0.2),
                              checkmarkColor: Colors.blue,
                              onSelected: (selected) {
                                setState(() {
                                  _activeFilters[MessageFilter.aiResponse] = selected;
                                });
                              },
                            ),
                            FilterChip(
                              label: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.person, size: 14),
                                  SizedBox(width: 4),
                                  Text('User Prompt', style: TextStyle(fontSize: 12)),
                                ],
                              ),
                              selected: _activeFilters[MessageFilter.userPrompt] ?? true,
                              selectedColor: Colors.green.withOpacity(0.2),
                              checkmarkColor: Colors.green,
                              onSelected: (selected) {
                                setState(() {
                                  _activeFilters[MessageFilter.userPrompt] = selected;
                                });
                              },
                            ),
                            FilterChip(
                              label: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.info_outline, size: 14),
                                  SizedBox(width: 4),
                                  Text('System', style: TextStyle(fontSize: 12)),
                                ],
                              ),
                              selected: _activeFilters[MessageFilter.system] ?? true,
                              selectedColor: Colors.grey.withOpacity(0.2),
                              checkmarkColor: Colors.grey,
                              onSelected: (selected) {
                                setState(() {
                                  _activeFilters[MessageFilter.system] = selected;
                                });
                              },
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const Divider(height: 1),
                  Expanded(
                    child: _filteredMessages.isEmpty && !_isWaitingForResponse
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  _messages.isEmpty ? Icons.chat_bubble_outline : Icons.filter_alt,
                                  size: 48,
                                  color: Colors.grey[400],
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  _messages.isEmpty ? 'No messages yet' : 'No messages match the filter',
                                  style: TextStyle(
                                    color: Colors.grey,
                                    fontSize: 14,
                                  ),
                                ),
                              ],
                            ),
                          )
                        : ListView.builder(
                            controller: _scrollController,
                            itemCount: _filteredMessages.length + (_isWaitingForResponse ? 1 : 0),
                            padding: const EdgeInsets.symmetric(vertical: 4),
                            itemBuilder: (context, index) {
                              // 마지막에 로딩 메시지 추가
                              if (index == _filteredMessages.length && _isWaitingForResponse) {
                                return Container(
                                  padding: const EdgeInsets.all(16.0),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      const SizedBox(
                                        width: 20,
                                        height: 20,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                      Text(
                                        '응답을 기다리는 중...',
                                        style: TextStyle(
                                          fontSize: 14,
                                          color: Colors.grey[600],
                                          fontStyle: FontStyle.italic,
                                        ),
                                      ),
                                    ],
                                  ),
                                );
                              }
                              final message = _filteredMessages[index];
                              return GestureDetector(
                                onLongPress: () {
                                  Clipboard.setData(ClipboardData(text: message.text));
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text('메시지가 클립보드에 복사되었습니다'),
                                      duration: Duration(seconds: 1),
                                    ),
                                  );
                                },
                                child: _buildMessageItem(message),
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
                    KeyboardListener(
                      focusNode: FocusNode(),
                      onKeyEvent: (event) {
                        // Enter 키를 눌렀을 때 (Shift+Enter가 아닌 경우)
                        if (event is KeyDownEvent &&
                            event.logicalKey == LogicalKeyboardKey.enter &&
                            !HardwareKeyboard.instance.isShiftPressed &&
                            _commandFocusNode.hasFocus &&
                            _isConnected) {
                          final text = _commandController.text.trim();
                          if (text.isNotEmpty) {
                            // Enter 키 기본 동작(줄바꿈) 방지
                            // Send to Prompt 실행
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
                        }
                      },
                      child: TextField(
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
                            child: _isWaitingForResponse
                                ? const Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      SizedBox(
                                        width: 16,
                                        height: 16,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                          valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                        ),
                                      ),
                                      SizedBox(width: 8),
                                      Text('대기 중...'),
                                    ],
                                  )
                                : const Text('Send to Prompt'),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: ElevatedButton(
                            onPressed: (_isConnected && _isWaitingForResponse) ? () {
                              if (!mounted) return;
                              // UI 업데이트를 위해 명시적으로 setState 호출
                              setState(() {
                                // 버튼 클릭 상태 업데이트
                                _isWaitingForResponse = false; // Stop 버튼 클릭 시 대기 상태 해제
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
