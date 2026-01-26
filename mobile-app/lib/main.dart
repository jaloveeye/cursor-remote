import 'dart:convert';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:http/http.dart' as http;
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:shared_preferences/shared_preferences.dart';

// Relay 서버 URL
const String RELAY_SERVER_URL = 'https://relay.jaloveeye.com';

// 연결 타입
enum ConnectionType {
  local,   // 로컬 서버 (IP 주소 직접 연결)
  relay,   // 릴레이 서버 (세션 ID 사용)
}

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
  // 연결 타입
  ConnectionType _connectionType = ConnectionType.relay;
  
  // Relay 서버 관련
  String? _sessionId;
  String _deviceId = '';
  bool _isConnected = false;
  bool _isWaitingForResponse = false; // 응답 대기 중 상태
  
  // Cursor CLI 세션 관련
  String? _currentCursorSessionId; // 현재 Cursor CLI 세션 ID
  String? _currentClientId; // 현재 클라이언트 ID
  Timer? _pollTimer;
  
  // 세션 및 대화 히스토리
  Map<String, dynamic>? _sessionInfo; // 현재 세션 정보
  List<Map<String, dynamic>> _chatHistory = []; // 대화 히스토리 목록
  List<String> _availableSessions = []; // 사용 가능한 세션 목록
  
  // 로컬 서버 관련
  WebSocketChannel? _localWebSocket;
  final TextEditingController _localIpController = TextEditingController();
  
  final List<MessageItem> _messages = [];
  final TextEditingController _commandController = TextEditingController();
  final TextEditingController _sessionIdController = TextEditingController();
  final FocusNode _sessionIdFocusNode = FocusNode();
  final FocusNode _localIpFocusNode = FocusNode();
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

  // 새 세션 생성 (릴레이 서버 연결 시에만 사용)
  Future<void> _createSession() async {
    try {
      setState(() {
        _messages.add(MessageItem('Creating new session...', type: MessageType.system));
      });
      
      final response = await http.post(
        Uri.parse('$RELAY_SERVER_URL/api/session'),
        headers: {'Content-Type': 'application/json'},
      );
      
      if (response.statusCode == 201) {
        final data = jsonDecode(response.body);
        if (data['success'] == true) {
          final sessionId = data['data']['sessionId'];
          setState(() {
            _sessionIdController.text = sessionId;
            _messages.add(MessageItem('✅ Session created: $sessionId', type: MessageType.system));
          });
          // 자동으로 세션에 연결
          await _connectToSession(sessionId);
        }
      } else {
        setState(() {
          _messages.add(MessageItem('❌ Failed to create session: ${response.body}', type: MessageType.system));
        });
      }
    } catch (e) {
      setState(() {
        _messages.add(MessageItem('❌ Error creating session: $e', type: MessageType.system));
      });
    }
  }
  
  // 로컬 서버 연결
  Future<void> _connectToLocal() async {
    final ip = _localIpController.text.trim();
    if (ip.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('IP 주소를 입력하세요')),
      );
      return;
    }
    
    try {
      setState(() {
        _messages.add(MessageItem('Connecting to local server at $ip:8767...', type: MessageType.system));
      });
      
      // WebSocket 연결 (PC 서버의 WebSocket 포트는 8767)
      final wsUrl = 'ws://$ip:8767';
      _localWebSocket = WebSocketChannel.connect(Uri.parse(wsUrl));
      
      _localWebSocket!.stream.listen(
        (message) {
          // 로컬 서버에서 메시지 수신
          _handleLocalMessage(message.toString());
        },
        onError: (error) {
          if (mounted) {
            setState(() {
              _messages.add(MessageItem('❌ Local connection error: $error', type: MessageType.system));
              _isConnected = false;
            });
          }
        },
        onDone: () {
          if (mounted) {
            setState(() {
              _messages.add(MessageItem('Local connection closed', type: MessageType.system));
              _isConnected = false;
            });
          }
        },
      );
      
      setState(() {
        _isConnected = true;
        _messages.add(MessageItem('✅ Connected to local server at $ip', type: MessageType.system));
      });
      
      // 연결 성공 시 connect 화면 자동 닫기
      try {
        _expansionTileController.collapse();
      } catch (e) {
        // ExpansionTileController가 아직 연결되지 않은 경우 무시
      }
      
      // 연결 성공 시 즉시 최근 히스토리 조회 (clientId 없이도 가능)
      // clientId는 첫 메시지 응답에서 받을 수 있으므로, 일단 모든 최근 히스토리 조회
      Future.delayed(const Duration(milliseconds: 300), () {
        _loadChatHistory(); // clientId 없이 최근 히스토리 조회
      });
    } catch (e) {
      setState(() {
        _messages.add(MessageItem('❌ Error connecting to local server: $e', type: MessageType.system));
      });
    }
  }
  
  // 로컬 서버에서 받은 메시지 처리
  void _handleLocalMessage(String message) {
    if (!mounted) return;
    
    try {
      final data = jsonDecode(message);
      final type = data['type'] ?? 'unknown';
      
      setState(() {
        if (type == 'chat_response') {
          // 세션 ID 추출 및 저장
          if (data['sessionId'] != null) {
            setState(() {
              _currentCursorSessionId = data['sessionId'] as String;
            });
          }
          if (data['clientId'] != null) {
            final newClientId = data['clientId'] as String;
            setState(() {
              // clientId가 처음 설정되면 세션 정보 및 히스토리 조회
              if (_currentClientId == null) {
                _currentClientId = newClientId;
                _loadSessionInfo();
                _loadChatHistory();
              } else if (_currentClientId != newClientId) {
                // clientId가 변경된 경우
                _currentClientId = newClientId;
                _loadSessionInfo();
                _loadChatHistory();
              } else {
                // 같은 clientId면 히스토리만 새로고침
                Future.delayed(const Duration(milliseconds: 500), () {
                  _loadChatHistory();
                });
              }
            });
          } else if (_currentClientId != null) {
            // clientId가 이미 있으면 응답 수신 후 히스토리만 새로고침
            Future.delayed(const Duration(milliseconds: 500), () {
              _loadChatHistory();
            });
          }
          final text = data['text'] ?? '';
          _messages.add(MessageItem('', type: MessageType.chatResponseDivider));
          _messages.add(MessageItem('🤖 Cursor AI Response', type: MessageType.chatResponseHeader));
          _messages.add(MessageItem(text, type: MessageType.chatResponse));
          _messages.add(MessageItem('', type: MessageType.chatResponseDivider));
          _isWaitingForResponse = false;
        } else if (type == 'command_result') {
          if (data['success'] == true) {
            final commandType = data['command_type'] as String? ?? '';
            
            // 세션 정보 조회 결과 처리
            if (commandType == 'get_session_info' && data['data'] != null) {
              setState(() {
                _sessionInfo = data['data'] as Map<String, dynamic>;
                if (_sessionInfo!['currentSessionId'] != null) {
                  _currentCursorSessionId = _sessionInfo!['currentSessionId'] as String;
                }
                if (_sessionInfo!['clientId'] != null) {
                  _currentClientId = _sessionInfo!['clientId'] as String;
                }
              });
            }
            // 대화 히스토리 조회 결과 처리
            else if (commandType == 'get_chat_history' && data['data'] != null) {
              final historyData = data['data'] as Map<String, dynamic>;
              if (historyData['entries'] != null) {
                setState(() {
                  _chatHistory = List<Map<String, dynamic>>.from(historyData['entries'] as List);
                  // 세션 목록 추출
                  _availableSessions = _chatHistory
                      .map((entry) => entry['sessionId'] as String? ?? '')
                      .where((id) => id.isNotEmpty)
                      .toSet()
                      .toList();
                });
              }
            }
            
            // 일반 명령 성공 메시지는 세션/히스토리 조회 시에는 표시하지 않음
            if (commandType != 'get_session_info' && commandType != 'get_chat_history') {
              _messages.add(MessageItem('✅ Command succeeded', type: MessageType.system));
            }
            if (commandType == 'stop_prompt') {
              _isWaitingForResponse = false;
            }
          } else {
            _messages.add(MessageItem('❌ Command failed: ${data['error']}', type: MessageType.system));
            _isWaitingForResponse = false;
          }
        }
      });
      _scrollToBottom();
    } catch (e) {
      // JSON 파싱 실패 시 원본 메시지 표시
      if (mounted) {
        setState(() {
          _messages.add(MessageItem('Received: $message', type: MessageType.system));
        });
      }
    }
  }

  // 기존 세션에 연결
  Future<void> _connectToSession(String sessionId) async {
    if (sessionId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('세션 ID를 입력하세요')),
      );
      return;
    }
    
    // 디바이스 ID 생성 (없으면)
    if (_deviceId.isEmpty) {
      _deviceId = 'mobile-${DateTime.now().millisecondsSinceEpoch}';
    }
    
    try {
      setState(() {
        _messages.add(MessageItem('Connecting to session $sessionId...', type: MessageType.system));
      });
      
      final response = await http.post(
        Uri.parse('$RELAY_SERVER_URL/api/connect'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'sessionId': sessionId,
          'deviceId': _deviceId,
          'deviceType': 'mobile',
        }),
      );
      
      final data = jsonDecode(response.body);
      
      if (response.statusCode == 200 && data['success'] == true) {
        setState(() {
          _sessionId = sessionId;
          _isConnected = true;
          _messages.add(MessageItem('✅ Connected to session $sessionId', type: MessageType.system));
        });
        
        // 연결 성공 시 connect 화면 자동 닫기
        try {
          _expansionTileController.collapse();
        } catch (e) {
          // ExpansionTileController가 아직 연결되지 않은 경우 무시
        }
        
        // 폴링 시작
        _startPolling();
        
        // 연결 성공 시 즉시 최근 히스토리 조회 (clientId 없이도 가능)
        // clientId는 첫 메시지 응답에서 받을 수 있으므로, 일단 모든 최근 히스토리 조회
        Future.delayed(const Duration(milliseconds: 300), () {
          _loadChatHistory(); // clientId 없이 최근 히스토리 조회
        });
      } else {
        final error = data['error'] ?? 'Unknown error';
        setState(() {
          _messages.add(MessageItem('❌ Failed to connect: $error', type: MessageType.system));
        });
        
        // 세션이 없으면 자동으로 새 세션 생성 시도
        if (error == 'Session not found' || error.toString().contains('Session not found')) {
          setState(() {
            _messages.add(MessageItem('🔄 Session not found. Creating new session...', type: MessageType.system));
          });
          // 세션 ID를 비우고 새 세션 생성
          _sessionIdController.clear();
          await _createSession();
        }
      }
    } catch (e) {
      setState(() {
        _messages.add(MessageItem('❌ Error connecting to session: $e', type: MessageType.system));
      });
    }
  }

  void _connect() {
    if (_connectionType == ConnectionType.local) {
      // 로컬 서버 연결
      _connectToLocal();
    } else {
      // 릴레이 서버 연결
      final sessionId = _sessionIdController.text.trim();
      if (sessionId.isEmpty) {
        // 세션 ID가 없으면 새 세션 생성
        _createSession();
      } else {
        // 세션 ID가 있으면 해당 세션에 연결
        _connectToSession(sessionId);
      }
    }
  }
  
  // 메시지 폴링 시작
  void _startPolling() {
    _stopPolling(); // 기존 타이머 정지
    
    _pollTimer = Timer.periodic(const Duration(seconds: 2), (_) async {
      if (!_isConnected || _sessionId == null) return;
      
      try {
        final response = await http.get(
          Uri.parse('$RELAY_SERVER_URL/api/poll?sessionId=$_sessionId&deviceType=mobile'),
        );
        
        if (response.statusCode == 200) {
          final data = jsonDecode(response.body);
          if (data['success'] == true && data['data']['messages'] != null) {
            final messages = data['data']['messages'] as List;
            for (final msg in messages) {
              _handleRelayMessage(msg);
            }
          }
        }
      } catch (e) {
        // 폴링 에러는 조용히 무시 (일시적인 네트워크 문제일 수 있음)
      }
    });
  }
  
  void _stopPolling() {
    _pollTimer?.cancel();
    _pollTimer = null;
  }
  
  // relay 서버에서 받은 메시지 처리
  void _handleRelayMessage(Map<String, dynamic> msg) {
    if (!mounted) return;
    
    final type = msg['type'] ?? msg['data']?['type'];
    final messageData = msg['data'] ?? msg;
    
    setState(() {
      _messages.add(MessageItem('Received: ${jsonEncode(msg)}', type: MessageType.system));
      
      if (type == 'command_result') {
        if (messageData['success'] == true) {
          final commandType = messageData['command_type'] as String? ?? '';
          
          // 세션 정보 조회 결과 처리
          if (commandType == 'get_session_info' && messageData['data'] != null) {
            setState(() {
              _sessionInfo = messageData['data'] as Map<String, dynamic>;
              if (_sessionInfo!['currentSessionId'] != null) {
                _currentCursorSessionId = _sessionInfo!['currentSessionId'] as String;
              }
              if (_sessionInfo!['clientId'] != null) {
                _currentClientId = _sessionInfo!['clientId'] as String;
              }
            });
          }
          // 대화 히스토리 조회 결과 처리
          else if (commandType == 'get_chat_history' && messageData['data'] != null) {
            final historyData = messageData['data'] as Map<String, dynamic>;
            if (historyData['entries'] != null) {
              setState(() {
                _chatHistory = List<Map<String, dynamic>>.from(historyData['entries'] as List);
                // 세션 목록 추출
                _availableSessions = _chatHistory
                    .map((entry) => entry['sessionId'] as String? ?? '')
                    .where((id) => id.isNotEmpty)
                    .toSet()
                    .toList();
              });
            }
          }
          
          // 일반 명령 성공 메시지는 세션/히스토리 조회 시에는 표시하지 않음
          if (commandType != 'get_session_info' && commandType != 'get_chat_history') {
            _messages.add(MessageItem('✅ Command succeeded', type: MessageType.system));
          }
          if (commandType == 'stop_prompt') {
            _isWaitingForResponse = false;
          }
        } else {
          _messages.add(MessageItem('❌ Command failed: ${messageData['error']}', type: MessageType.system));
          _isWaitingForResponse = false;
        }
      } else if (type == 'error') {
        _messages.add(MessageItem('❌ Error: ${messageData['message']}', type: MessageType.system));
        _isWaitingForResponse = false;
      } else if (type == 'user_message') {
        final text = messageData['text'] ?? '';
        _messages.add(MessageItem('💬 You: $text', type: MessageType.userMessage));
      } else if (type == 'gemini_response') {
        final text = messageData['text'] ?? '';
        _messages.add(MessageItem('🤖 Gemini: $text', type: MessageType.geminiResponse));
      } else if (type == 'terminal_output') {
        final text = messageData['text'] ?? '';
        _messages.add(MessageItem('📟 Terminal: $text', type: MessageType.terminalOutput));
      } else if (type == 'chat_response') {
        // 세션 ID 추출 및 저장
        if (messageData['sessionId'] != null) {
          setState(() {
            _currentCursorSessionId = messageData['sessionId'] as String;
          });
        }
        if (messageData['clientId'] != null) {
          final newClientId = messageData['clientId'] as String;
          setState(() {
            // clientId가 처음 설정되면 세션 정보 및 히스토리 조회
            if (_currentClientId == null) {
              _currentClientId = newClientId;
              _loadSessionInfo();
              _loadChatHistory();
            } else if (_currentClientId != newClientId) {
              // clientId가 변경된 경우
              _currentClientId = newClientId;
              _loadSessionInfo();
              _loadChatHistory();
            } else {
              // 같은 clientId면 히스토리만 새로고침
              Future.delayed(const Duration(milliseconds: 500), () {
                _loadChatHistory();
              });
            }
          });
        } else if (_currentClientId != null) {
          // clientId가 이미 있으면 응답 수신 후 히스토리만 새로고침
          Future.delayed(const Duration(milliseconds: 500), () {
            _loadChatHistory();
          });
        }
        final text = messageData['text'] ?? '';
        _messages.add(MessageItem('', type: MessageType.chatResponseDivider));
        _messages.add(MessageItem('🤖 Cursor AI Response', type: MessageType.chatResponseHeader));
        _messages.add(MessageItem(text, type: MessageType.chatResponse));
        _messages.add(MessageItem('', type: MessageType.chatResponseDivider));
        _isWaitingForResponse = false;
      }
    });
    _scrollToBottom();
  }

  void _disconnect() {
    _stopPolling();
    
    // 로컬 WebSocket 연결 종료
    _localWebSocket?.sink.close();
    _localWebSocket = null;
    
    if (mounted) {
      setState(() {
        _isConnected = false;
        _sessionId = null;
        _messages.add(MessageItem('Disconnected', type: MessageType.system));
      });
    }
  }

  Future<void> _sendCommand(String type, {String? text, String? command, List<dynamic>? args, bool? prompt, bool? terminal, bool? execute, String? action, bool? newSession, String? clientId, String? sessionId, int? limit}) async {
    // 연결 상태 재확인
    _checkConnectionState();
    
    if (!_isConnected) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Not connected')),
        );
      }
      return;
    }

    try {
      final commandData = {
        'type': type,
        'id': DateTime.now().millisecondsSinceEpoch.toString(),
        if (text != null) 'text': text,
        if (command != null) 'command': command,
        if (args != null) 'args': args,
        if (prompt != null) 'prompt': prompt,
        if (terminal != null) 'terminal': terminal,
        if (execute != null) 'execute': execute,
        if (action != null) 'action': action,
        if (newSession != null) 'newSession': newSession,
        if (clientId != null) 'clientId': clientId,
        if (sessionId != null) 'sessionId': sessionId,
        if (limit != null) 'limit': limit,
      };

      // 프롬프트 전송 시 사용자 프롬프트를 별도로 기록하고 응답 대기 상태 설정
      if (prompt == true && execute == true && text != null) {
        setState(() {
          _isWaitingForResponse = true;
          // 사용자 프롬프트를 별도 타입으로 추가
          _messages.add(MessageItem(text, type: MessageType.userPrompt));
        });
      }

      if (_connectionType == ConnectionType.local) {
        // 로컬 서버로 메시지 전송 (WebSocket)
        if (_localWebSocket != null) {
          _localWebSocket!.sink.add(jsonEncode(commandData));
          if (mounted) {
            setState(() {
              _messages.add(MessageItem('✅ Message sent to local server', type: MessageType.system));
            });
            _scrollToBottom();
          }
        } else {
          throw Exception('Local WebSocket not connected');
        }
      } else {
        // 릴레이 서버로 메시지 전송
        if (_sessionId == null) {
          throw Exception('Session ID is required for relay connection');
        }
        
        final response = await http.post(
          Uri.parse('$RELAY_SERVER_URL/api/send'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({
            'sessionId': _sessionId,
            'deviceId': _deviceId,
            'deviceType': 'mobile',
            'type': type,
            'data': commandData,
          }),
        );
        
        if (mounted) {
          final responseData = jsonDecode(response.body);
          setState(() {
            _messages.add(MessageItem('Sent: ${commandData.toString()}', type: MessageType.system));
            if (response.statusCode == 200 && responseData['success'] == true) {
              _messages.add(MessageItem('✅ Message sent to relay', type: MessageType.system));
            } else {
              _messages.add(MessageItem('❌ Failed to send: ${responseData['error'] ?? 'Unknown error'}', type: MessageType.system));
              _isWaitingForResponse = false;
            }
          });
          _scrollToBottom();
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to send command: $e')),
        );
        setState(() {
          _isWaitingForResponse = false;
          _messages.add(MessageItem('Send error: $e', type: MessageType.system));
        });
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

  // 세션 정보 조회
  Future<void> _loadSessionInfo() async {
    if (!_isConnected) return;
    
    // clientId가 아직 없으면 잠시 대기 후 재시도
    if (_currentClientId == null) {
      Future.delayed(const Duration(milliseconds: 500), () {
        if (_isConnected) _loadSessionInfo();
      });
      return;
    }
    
    try {
      await _sendCommand('get_session_info', clientId: _currentClientId);
    } catch (e) {
      // 에러는 조용히 무시
    }
  }
  
  // 대화 히스토리 조회
  Future<void> _loadChatHistory({String? sessionId, int limit = 50}) async {
    if (!_isConnected) return;
    
    // clientId가 없어도 최근 히스토리를 조회할 수 있도록 수정
    // clientId가 있으면 해당 클라이언트의 히스토리만, 없으면 모든 최근 히스토리 조회
    try {
      await _sendCommand('get_chat_history', 
        clientId: _currentClientId, // null이어도 됨 (Extension에서 모든 히스토리 반환)
        sessionId: sessionId ?? _currentCursorSessionId,
        limit: limit
      );
    } catch (e) {
      // 에러는 조용히 무시
    }
  }
  
  // 연결 상태 확인 및 필요시 재연결
  void _checkConnectionState() {
    if (_connectionType == ConnectionType.local) {
      // 로컬 연결: WebSocket 상태 확인
      if (_localWebSocket == null && _isConnected) {
        if (mounted) {
          setState(() {
            _isConnected = false;
            _messages.add(MessageItem('⚠️ Local connection lost, please reconnect', type: MessageType.system));
          });
        }
      }
    } else {
      // 릴레이 연결: 세션 ID 확인
      if (_sessionId == null && _isConnected) {
        // 세션이 null인데 연결 상태가 true면 상태 불일치
        if (mounted) {
          setState(() {
            _isConnected = false;
            _messages.add(MessageItem('⚠️ Connection lost, please reconnect', type: MessageType.system));
          });
        }
      } else if (_sessionId != null && !_isConnected) {
        // 세션이 있는데 연결 상태가 false면 상태 불일치
        if (mounted) {
          setState(() {
            _isConnected = true;
          });
        }
      }
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _stopPolling();
    _localWebSocket?.sink.close();
    _commandController.dispose();
    _sessionIdController.dispose();
    _localIpController.dispose();
    _scrollController.dispose();
    _sessionIdFocusNode.dispose();
    _localIpFocusNode.dispose();
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
            subtitle: _isConnected
                ? Text(
                    _connectionType == ConnectionType.local
                        ? 'Local Mode'
                        : (_sessionId != null ? 'Relay Mode (Session: $_sessionId)' : 'Relay Mode'),
                    style: TextStyle(
                      color: _isConnected ? Colors.green : Colors.grey,
                      fontSize: 12,
                    ),
                  )
                : const Text(
                    'relay.jaloveeye.com',
                    style: TextStyle(fontSize: 12, color: Colors.grey),
                  ),
            initiallyExpanded: true,
            children: [
              Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // 연결 타입 선택
                    const Text(
                      'Connection Type',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: RadioListTile<ConnectionType>(
                            title: const Text('Local Server'),
                            subtitle: const Text('Direct IP connection'),
                            value: ConnectionType.local,
                            groupValue: _connectionType,
                            onChanged: _isConnected ? null : (value) {
                              if (value != null) {
                                setState(() {
                                  _connectionType = value;
                                });
                              }
                            },
                            dense: true,
                            contentPadding: EdgeInsets.zero,
                          ),
                        ),
                        Expanded(
                          child: RadioListTile<ConnectionType>(
                            title: const Text('Relay Server'),
                            subtitle: const Text('Session ID'),
                            value: ConnectionType.relay,
                            groupValue: _connectionType,
                            onChanged: _isConnected ? null : (value) {
                              if (value != null) {
                                setState(() {
                                  _connectionType = value;
                                });
                              }
                            },
                            dense: true,
                            contentPadding: EdgeInsets.zero,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    // 로컬 서버 연결 UI
                    if (_connectionType == ConnectionType.local) ...[
                      TextField(
                        controller: _localIpController,
                        focusNode: _localIpFocusNode,
                        decoration: const InputDecoration(
                          labelText: 'PC Server IP Address',
                          hintText: '192.168.0.10',
                          border: OutlineInputBorder(),
                          isDense: true,
                          contentPadding: EdgeInsets.all(12),
                          prefixIcon: Icon(Icons.computer),
                        ),
                        enabled: !_isConnected,
                        keyboardType: TextInputType.number,
                        textInputAction: TextInputAction.done,
                        onSubmitted: (value) {
                          if (!_isConnected) {
                            _connect();
                          }
                        },
                      ),
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.orange.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.info_outline, size: 18, color: Colors.orange),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'PC와 모바일이 같은 네트워크에 있어야 합니다',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Colors.orange[900],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ] else ...[
                      // 릴레이 서버 연결 UI
                      TextField(
                        controller: _sessionIdController,
                        focusNode: _sessionIdFocusNode,
                        decoration: const InputDecoration(
                          labelText: 'Session ID (leave empty to create new)',
                          hintText: 'ABC123',
                          border: OutlineInputBorder(),
                          isDense: true,
                          contentPadding: EdgeInsets.all(12),
                          prefixIcon: Icon(Icons.cloud),
                        ),
                        enabled: !_isConnected,
                        keyboardType: TextInputType.text,
                        textCapitalization: TextCapitalization.characters,
                        textInputAction: TextInputAction.done,
                        onSubmitted: (value) {
                          if (!_isConnected) {
                            _connect();
                          }
                        },
                      ),
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.blue.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.info_outline, size: 18, color: Colors.blue),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                '세션 ID를 비워두면 새 세션이 생성됩니다',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Colors.blue[900],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: [
                        Expanded(
                          child: ElevatedButton(
                            onPressed: _isConnected ? null : _connect,
                            style: ElevatedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              backgroundColor: Colors.green,
                              foregroundColor: Colors.white,
                            ),
                            child: Text(
                              _connectionType == ConnectionType.local
                                  ? 'Connect'
                                  : (_sessionIdController.text.trim().isEmpty ? 'Create & Connect' : 'Connect'),
                            ),
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
                    if (_isConnected && _connectionType == ConnectionType.relay && _sessionId != null) ...[
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.blue.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.info_outline, size: 18, color: Colors.blue),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'PC에서 같은 세션 ID로 연결하세요: $_sessionId',
                                style: const TextStyle(fontSize: 12),
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.copy, size: 18),
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(),
                              onPressed: () {
                                Clipboard.setData(ClipboardData(text: _sessionId!));
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('세션 ID가 클립보드에 복사되었습니다'),
                                    duration: Duration(seconds: 1),
                                  ),
                                );
                              },
                            ),
                          ],
                        ),
                      ),
                    ],
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
                            _sendCommand('insert_text', text: text, prompt: true, execute: true, newSession: false);
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
                                _sendCommand('insert_text', text: text, prompt: true, execute: true, newSession: false);
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
                    const SizedBox(height: 8),
                    // 세션 정보 및 대화 히스토리 표시
                    if (_isConnected) ...[
                      // 현재 세션 정보
                      if (_currentCursorSessionId != null)
                        Container(
                          padding: const EdgeInsets.all(8.0),
                          margin: const EdgeInsets.only(bottom: 8.0),
                          decoration: BoxDecoration(
                            color: Colors.blue.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(8.0),
                            border: Border.all(color: Colors.blue.withOpacity(0.3)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.chat_bubble_outline, size: 16, color: Colors.blue),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  '현재 세션: ${_currentCursorSessionId!.substring(0, 8)}...',
                                  style: const TextStyle(fontSize: 12, color: Colors.blue),
                                ),
                              ),
                            ],
                          ),
                        ),
                      
                      // 세션 목록 및 대화 히스토리
                      ExpansionTile(
                        title: const Text('세션 및 대화 히스토리', style: TextStyle(fontSize: 14)),
                        leading: const Icon(Icons.history, size: 20),
                        children: [
                          // 세션 목록
                          if (_availableSessions.isNotEmpty) ...[
                            const Padding(
                              padding: EdgeInsets.all(8.0),
                              child: Text('사용 가능한 세션:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                            ),
                            ..._availableSessions.map((sessionId) => ListTile(
                              dense: true,
                              leading: const Icon(Icons.chat, size: 16),
                              title: Text(
                                sessionId.length > 20 ? '${sessionId.substring(0, 20)}...' : sessionId,
                                style: const TextStyle(fontSize: 12),
                              ),
                              trailing: IconButton(
                                icon: const Icon(Icons.refresh, size: 16),
                                onPressed: () => _loadChatHistory(sessionId: sessionId),
                                tooltip: '이 세션의 대화 히스토리 조회',
                              ),
                            )),
                            const Divider(),
                          ],
                          
                          // 대화 히스토리
                          if (_chatHistory.isNotEmpty) ...[
                            const Padding(
                              padding: EdgeInsets.all(8.0),
                              child: Text('대화 히스토리:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                            ),
                            SizedBox(
                              height: 200,
                              child: ListView.builder(
                                shrinkWrap: true,
                                itemCount: _chatHistory.length,
                                itemBuilder: (context, index) {
                                  final entry = _chatHistory[index];
                                  final userMsg = entry['userMessage'] as String? ?? '';
                                  final assistantMsg = entry['assistantResponse'] as String? ?? '';
                                  final timestamp = entry['timestamp'] as String? ?? '';
                                  
                                  return Card(
                                    margin: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
                                    child: Padding(
                                      padding: const EdgeInsets.all(8.0),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          if (userMsg.isNotEmpty)
                                            Padding(
                                              padding: const EdgeInsets.only(bottom: 4.0),
                                              child: Text(
                                                '👤 $userMsg',
                                                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                                              ),
                                            ),
                                          if (assistantMsg.isNotEmpty)
                                            Padding(
                                              padding: const EdgeInsets.only(bottom: 4.0),
                                              child: Text(
                                                '🤖 ${assistantMsg.length > 50 ? "${assistantMsg.substring(0, 50)}..." : assistantMsg}',
                                                style: const TextStyle(fontSize: 11),
                                              ),
                                            ),
                                          if (timestamp.isNotEmpty)
                                            Text(
                                              _formatTime(DateTime.parse(timestamp)),
                                              style: TextStyle(fontSize: 9, color: Colors.grey[600]),
                                            ),
                                        ],
                                      ),
                                    ),
                                  );
                                },
                              ),
                            ),
                          ] else ...[
                            const Padding(
                              padding: EdgeInsets.all(16.0),
                              child: Text('대화 히스토리가 없습니다.', style: TextStyle(fontSize: 12, color: Colors.grey)),
                            ),
                          ],
                          
                          // 새로고침 버튼
                          Padding(
                            padding: const EdgeInsets.all(8.0),
                            child: ElevatedButton.icon(
                              onPressed: () {
                                _loadSessionInfo();
                                _loadChatHistory();
                              },
                              icon: const Icon(Icons.refresh, size: 16),
                              label: const Text('새로고침'),
                              style: ElevatedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: (_isConnected && _commandController.text.trim().isNotEmpty) ? () {
                              if (!mounted) return;
                              final text = _commandController.text.trim();
                              if (text.isNotEmpty) {
                                setState(() {
                                  // 버튼 클릭 상태 업데이트
                                });
                                _sendCommand('insert_text', text: text, prompt: true, execute: true, newSession: true);
                                _commandController.clear();
                                if (mounted) {
                                  setState(() {
                                    // TextField 클리어 후 UI 업데이트
                                  });
                                }
                              }
                            } : null,
                            icon: const Icon(Icons.refresh, size: 18),
                            label: const Text('새 대화'),
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: _isConnected && _currentCursorSessionId != null ? () {
                              if (!mounted) return;
                              final text = _commandController.text;
                              if (text.isNotEmpty) {
                                setState(() {
                                  // 버튼 클릭 상태 업데이트
                                });
                                _sendCommand('insert_text', text: text, prompt: true, execute: true, newSession: false);
                                _commandController.clear();
                                if (mounted) {
                                  setState(() {
                                    // TextField 클리어 후 UI 업데이트
                                  });
                                }
                              }
                            } : null,
                            icon: const Icon(Icons.replay, size: 18),
                            label: const Text('이어가기'),
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
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
