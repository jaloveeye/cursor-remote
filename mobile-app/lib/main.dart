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
  local, // 로컬 서버 (IP 주소 직접 연결)
  relay, // 릴레이 서버 (세션 ID 사용)
}

// 테마 모드
enum ThemeModeSetting {
  light,
  dark,
  system,
}

// ============================================================
// 앱 설정 관리
// ============================================================
// ============================================================
// 연결 히스토리 항목
// ============================================================
class ConnectionHistoryItem {
  final ConnectionType type;
  final String? ip; // 로컬 모드일 때
  final String? sessionId; // 릴레이 모드일 때
  final DateTime timestamp;

  ConnectionHistoryItem({
    required this.type,
    this.ip,
    this.sessionId,
    required this.timestamp,
  });

  // JSON 직렬화
  Map<String, dynamic> toJson() => {
        'type': type.index,
        'ip': ip,
        'sessionId': sessionId,
        'timestamp': timestamp.toIso8601String(),
      };

  // JSON 역직렬화
  factory ConnectionHistoryItem.fromJson(Map<String, dynamic> json) {
    return ConnectionHistoryItem(
      type: ConnectionType.values[json['type'] as int],
      ip: json['ip'] as String?,
      sessionId: json['sessionId'] as String?,
      timestamp: DateTime.parse(json['timestamp'] as String),
    );
  }

  // 동일 연결인지 확인 (타입과 주소/세션ID가 같으면 동일)
  bool isSameConnection(ConnectionHistoryItem other) {
    if (type != other.type) return false;
    if (type == ConnectionType.local) {
      return ip == other.ip;
    } else {
      return sessionId == other.sessionId;
    }
  }

  // 표시용 문자열
  String get displayText {
    if (type == ConnectionType.local) {
      return ip ?? 'Unknown IP';
    } else {
      return sessionId ?? 'Unknown Session';
    }
  }

  // 상대 시간 문자열
  String get relativeTime {
    final now = DateTime.now();
    final diff = now.difference(timestamp);

    if (diff.inMinutes < 1) {
      return '방금 전';
    } else if (diff.inMinutes < 60) {
      return '${diff.inMinutes}분 전';
    } else if (diff.inHours < 24) {
      return '${diff.inHours}시간 전';
    } else if (diff.inDays < 7) {
      return '${diff.inDays}일 전';
    } else {
      return '${timestamp.month}/${timestamp.day}';
    }
  }
}

// ============================================================
// 앱 설정 관리
// ============================================================
class AppSettings extends ChangeNotifier {
  static final AppSettings _instance = AppSettings._internal();
  factory AppSettings() => _instance;
  AppSettings._internal();

  // 설정 키
  static const String _keyThemeMode = 'theme_mode';
  static const String _keyShowHistory = 'show_history';
  static const String _keyDefaultAgentMode = 'default_agent_mode';
  static const String _keyAutoConnect = 'auto_connect';
  static const String _keyConnectionHistory = 'connection_history';

  // 설정 값
  ThemeModeSetting _themeMode = ThemeModeSetting.system;
  bool _showHistory = false; // 기본값: 숨김
  String _defaultAgentMode = 'auto';
  bool _autoConnect = false;
  List<ConnectionHistoryItem> _connectionHistory = [];

  // 최대 히스토리 개수
  static const int _maxHistoryCount = 5;

  // Getters
  ThemeModeSetting get themeMode => _themeMode;
  bool get showHistory => _showHistory;
  String get defaultAgentMode => _defaultAgentMode;
  bool get autoConnect => _autoConnect;
  List<ConnectionHistoryItem> get connectionHistory =>
      List.unmodifiable(_connectionHistory);

  // 테마 모드를 ThemeMode로 변환
  ThemeMode get themeModeValue {
    switch (_themeMode) {
      case ThemeModeSetting.light:
        return ThemeMode.light;
      case ThemeModeSetting.dark:
        return ThemeMode.dark;
      case ThemeModeSetting.system:
        return ThemeMode.system;
    }
  }

  // 설정 로드
  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();

    final themeModeIndex = prefs.getInt(_keyThemeMode) ?? 2; // 기본값: system
    _themeMode = ThemeModeSetting.values[themeModeIndex.clamp(0, 2)];

    _showHistory = prefs.getBool(_keyShowHistory) ?? false;
    _defaultAgentMode = prefs.getString(_keyDefaultAgentMode) ?? 'auto';
    _autoConnect = prefs.getBool(_keyAutoConnect) ?? false;

    // 연결 히스토리 로드
    final historyJson = prefs.getString(_keyConnectionHistory);
    if (historyJson != null) {
      try {
        final List<dynamic> historyList = jsonDecode(historyJson);
        _connectionHistory = historyList
            .map((item) =>
                ConnectionHistoryItem.fromJson(item as Map<String, dynamic>))
            .toList();
      } catch (e) {
        _connectionHistory = [];
      }
    }

    notifyListeners();
  }

  // 테마 모드 설정
  Future<void> setThemeMode(ThemeModeSetting mode) async {
    _themeMode = mode;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_keyThemeMode, mode.index);
    notifyListeners();
  }

  // 히스토리 표시 설정
  Future<void> setShowHistory(bool value) async {
    _showHistory = value;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyShowHistory, value);
    notifyListeners();
  }

  // 기본 에이전트 모드 설정
  Future<void> setDefaultAgentMode(String mode) async {
    _defaultAgentMode = mode;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyDefaultAgentMode, mode);
    notifyListeners();
  }

  // 자동 연결 설정
  Future<void> setAutoConnect(bool value) async {
    _autoConnect = value;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyAutoConnect, value);
    notifyListeners();
  }

  // 연결 히스토리에 추가
  Future<void> addConnectionHistory(ConnectionHistoryItem item) async {
    // 동일한 연결이 있으면 제거 (최신으로 갱신하기 위해)
    _connectionHistory.removeWhere((h) => h.isSameConnection(item));

    // 맨 앞에 추가
    _connectionHistory.insert(0, item);

    // 최대 개수 유지
    if (_connectionHistory.length > _maxHistoryCount) {
      _connectionHistory = _connectionHistory.sublist(0, _maxHistoryCount);
    }

    // 저장
    await _saveConnectionHistory();
    notifyListeners();
  }

  // 연결 히스토리 저장
  Future<void> _saveConnectionHistory() async {
    final prefs = await SharedPreferences.getInstance();
    final historyJson =
        jsonEncode(_connectionHistory.map((h) => h.toJson()).toList());
    await prefs.setString(_keyConnectionHistory, historyJson);
  }

  // 연결 히스토리 삭제
  Future<void> removeConnectionHistory(ConnectionHistoryItem item) async {
    _connectionHistory.removeWhere((h) => h.isSameConnection(item));
    await _saveConnectionHistory();
    notifyListeners();
  }

  // 연결 히스토리 전체 삭제
  Future<void> clearConnectionHistory() async {
    _connectionHistory.clear();
    await _saveConnectionHistory();
    notifyListeners();
  }
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await AppSettings().load();
  runApp(const MyApp());
}

// ============================================================
// 라이트 테마
// ============================================================
final ThemeData lightTheme = ThemeData(
  useMaterial3: true,
  colorScheme: ColorScheme(
    brightness: Brightness.light,
    // Primary 색상 (다크 네이비 블루)
    primary: const Color(0xFF1A232E),
    onPrimary: Colors.white,
    primaryContainer: const Color(0xFF2A3441),
    onPrimaryContainer: const Color(0xFFE8EAF6),
    // Secondary 색상 (약간 밝은 네이비)
    secondary: const Color(0xFF3A4A5E),
    onSecondary: Colors.white,
    secondaryContainer: const Color(0xFFE3E8F0),
    onSecondaryContainer: const Color(0xFF1A232E),
    // Tertiary 색상 (청록색 계열 강조)
    tertiary: const Color(0xFF00B4D8),
    onTertiary: Colors.white,
    tertiaryContainer: const Color(0xFFB3E5FC),
    onTertiaryContainer: const Color(0xFF006064),
    // Error 색상
    error: const Color(0xFFDC3545),
    onError: Colors.white,
    errorContainer: const Color(0xFFFFEBEE),
    onErrorContainer: const Color(0xFFB71C1C),
    // Surface 색상
    surface: Colors.white,
    onSurface: const Color(0xFF1A232E),
    surfaceContainerHighest: const Color(0xFFF5F7FA),
    onSurfaceVariant: const Color(0xFF4A5568),
    // Outline 색상
    outline: const Color(0xFFCBD5E0),
    outlineVariant: const Color(0xFFE2E8F0),
    // Shadow
    shadow: Colors.black.withOpacity(0.1),
    scrim: Colors.black.withOpacity(0.5),
    // Inverse
    inverseSurface: const Color(0xFF1A232E),
    onInverseSurface: Colors.white,
    inversePrimary: const Color(0xFF4A5A6E),
  ),
  appBarTheme: const AppBarTheme(
    centerTitle: false,
    elevation: 0,
    scrolledUnderElevation: 1,
  ),
  cardTheme: CardThemeData(
    elevation: 0,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(12),
      side: const BorderSide(
        color: Color(0xFFCBD5E0), // outline 색상
        width: 1,
      ),
    ),
  ),
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: BorderSide.none,
    ),
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
  ),
  elevatedButtonTheme: ElevatedButtonThemeData(
    style: ElevatedButton.styleFrom(
      elevation: 0,
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
    ),
  ),
  outlinedButtonTheme: OutlinedButtonThemeData(
    style: OutlinedButton.styleFrom(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
    ),
  ),
);

// ============================================================
// 다크 테마
// ============================================================
final ThemeData darkTheme = ThemeData(
  useMaterial3: true,
  colorScheme: ColorScheme(
    brightness: Brightness.dark,
    // Primary 색상 (밝은 청록색)
    primary: const Color(0xFF4DB6E5),
    onPrimary: const Color(0xFF003544),
    primaryContainer: const Color(0xFF1A3A4A),
    onPrimaryContainer: const Color(0xFFB3E5FC),
    // Secondary 색상 (부드러운 블루그레이)
    secondary: const Color(0xFF8BA4B8),
    onSecondary: const Color(0xFF1A2A36),
    secondaryContainer: const Color(0xFF2A3A4A),
    onSecondaryContainer: const Color(0xFFD0E4F0),
    // Tertiary 색상 (시안 계열 강조)
    tertiary: const Color(0xFF00D4FF),
    onTertiary: const Color(0xFF003344),
    tertiaryContainer: const Color(0xFF004D5C),
    onTertiaryContainer: const Color(0xFFB3F0FF),
    // Error 색상
    error: const Color(0xFFFF6B6B),
    onError: const Color(0xFF3D0000),
    errorContainer: const Color(0xFF5C2323),
    onErrorContainer: const Color(0xFFFFDADA),
    // Surface 색상
    surface: const Color(0xFF121820),
    onSurface: const Color(0xFFE8EAF0),
    surfaceContainerHighest: const Color(0xFF1E2630),
    onSurfaceVariant: const Color(0xFFB0B8C4),
    // Outline 색상
    outline: const Color(0xFF3A4550),
    outlineVariant: const Color(0xFF2A3440),
    // Shadow
    shadow: Colors.black.withOpacity(0.3),
    scrim: Colors.black.withOpacity(0.6),
    // Inverse
    inverseSurface: const Color(0xFFE8EAF0),
    onInverseSurface: const Color(0xFF1A232E),
    inversePrimary: const Color(0xFF1A6080),
  ),
  appBarTheme: const AppBarTheme(
    centerTitle: false,
    elevation: 0,
    scrolledUnderElevation: 1,
  ),
  cardTheme: CardThemeData(
    elevation: 0,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(12),
      side: const BorderSide(
        color: Color(0xFF3A4550), // outline 색상 (다크)
        width: 1,
      ),
    ),
  ),
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: BorderSide.none,
    ),
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
  ),
  elevatedButtonTheme: ElevatedButtonThemeData(
    style: ElevatedButton.styleFrom(
      elevation: 0,
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
    ),
  ),
  outlinedButtonTheme: OutlinedButtonThemeData(
    style: OutlinedButton.styleFrom(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
    ),
  ),
);

// ============================================================
// 앱 루트
// ============================================================
class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  @override
  void initState() {
    super.initState();
    AppSettings().addListener(_onSettingsChanged);
  }

  @override
  void dispose() {
    AppSettings().removeListener(_onSettingsChanged);
    super.dispose();
  }

  void _onSettingsChanged() {
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Cursor Remote',
      theme: lightTheme,
      darkTheme: darkTheme,
      themeMode: AppSettings().themeModeValue,
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
  static const String chatResponseChunk = 'chat_response_chunk'; // 스트리밍 청크
  static const String chatResponseComplete =
      'chat_response_complete'; // 스트리밍 완료
  static const String chatResponseHeader = 'chat_response_header';
  static const String chatResponseDivider = 'chat_response_divider';
  static const String userMessage = 'user_message';
  static const String userPrompt = 'user_prompt'; // 사용자가 입력한 프롬프트
  static const String geminiResponse = 'gemini_response';
  static const String terminalOutput = 'terminal_output';
  static const String system = 'system'; // Sent, Received, Command succeeded 등
  static const String log = 'log'; // 실시간 로그
}

// 필터 카테고리
enum MessageFilter {
  aiResponse, // Cursor AI Response
  userPrompt, // 사용자가 입력한 프롬프트
  system, // Sent, Received, Command succeeded 등
  log, // 실시간 로그
}

// 로그 레벨
enum LogLevel {
  error, // 에러
  warning, // 경고
  info, // 정보
}

class MessageItem {
  final String text;
  final String type; // MessageType 상수 사용
  final DateTime timestamp;
  String? agentMode; // 에이전트 모드 (userPrompt 타입일 때만 사용)
  LogLevel? logLevel; // 로그 레벨 (log 타입일 때만 사용)

  MessageItem(this.text,
      {this.type = MessageType.normal, this.agentMode, this.logLevel})
      : timestamp = DateTime.now();

  // 필터 카테고리 결정
  MessageFilter? get filterCategory {
    switch (type) {
      case MessageType.chatResponse:
      case MessageType.chatResponseChunk:
      case MessageType.chatResponseComplete:
      case MessageType.chatResponseHeader:
      case MessageType.chatResponseDivider:
      case MessageType.geminiResponse:
        return MessageFilter.aiResponse;
      case MessageType.userPrompt:
        return MessageFilter.userPrompt;
      case MessageType.log:
        return MessageFilter.log;
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

  // 스트리밍 관련
  int? _streamingMessageIndex; // 현재 스트리밍 중인 메시지의 인덱스
  String _streamingText = ''; // 스트리밍 중인 텍스트

  // 세션 및 대화 히스토리
  Map<String, dynamic>? _sessionInfo; // 현재 세션 정보
  List<Map<String, dynamic>> _chatHistory = []; // 대화 히스토리 목록
  List<String> _availableSessions = []; // 사용 가능한 세션 목록

  // 로컬 서버 관련
  WebSocketChannel? _localWebSocket;
  final TextEditingController _localIpController = TextEditingController();

  // 재연결 관련
  Timer? _reconnectTimer;
  int _reconnectAttempts = 0;
  bool _isReconnecting = false;
  String? _lastConnectionError;

  // 에이전트 모드 관련
  String _selectedAgentMode = 'auto'; // auto, agent, ask, plan, debug
  String? _actualSelectedMode; // 자동 모드로 선택된 경우 실제 선택된 모드 (null이면 사용자가 직접 선택)
  MessageItem? _lastUserPrompt; // 마지막 User Prompt 메시지 (모드 업데이트용)

  final List<MessageItem> _messages = [];
  final TextEditingController _commandController = TextEditingController();
  final TextEditingController _sessionIdController = TextEditingController();

  // 입력창 상태 관리
  int _textFieldKey = 0; // TextField 재생성용 Key
  DateTime? _lastPromptSubmitTime; // Enter 중복 전송 방지용 debounce
  final FocusNode _sessionIdFocusNode = FocusNode();
  final FocusNode _localIpFocusNode = FocusNode();
  final FocusNode _commandFocusNode = FocusNode();
  final ScrollController _scrollController = ScrollController();
  final ExpansibleController _expansionTileController = ExpansibleController();

  // 필터 상태 (기본값: AI 응답 + 사용자 프롬프트만 활성화)
  final Map<MessageFilter, bool> _activeFilters = {
    MessageFilter.aiResponse: true,
    MessageFilter.userPrompt: true,
    MessageFilter.system: false,
    MessageFilter.log: false,
  };

  // 로그 레벨별 필터 상태 (기본값: 모두 활성화)
  final Map<LogLevel, bool> _logLevelFilters = {
    LogLevel.error: true,
    LogLevel.warning: true,
    LogLevel.info: true,
  };

  // 필터링된 메시지 목록
  List<MessageItem> get _filteredMessages {
    return _messages.where((msg) {
      final category = msg.filterCategory;
      if (category == null) return true;

      // 로그 메시지인 경우 레벨별 필터도 적용
      if (category == MessageFilter.log &&
          (_activeFilters[MessageFilter.log] ?? false)) {
        final level = msg.logLevel ?? LogLevel.info;
        if (!(_logLevelFilters[level] ?? true)) return false;
      }

      return _activeFilters[category] ?? true;
    }).toList();
  }

  // 새 세션 생성 (릴레이 서버 연결 시에만 사용)
  Future<void> _createSession() async {
    try {
      setState(() {
        _messages.add(
            MessageItem('Creating new session...', type: MessageType.system));
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
            _messages.add(MessageItem('✅ Session created: $sessionId',
                type: MessageType.system));
            _messages.add(MessageItem(
                '💡 Extension이 자동으로 이 세션을 감지하여 연결합니다 (최대 10초 소요)',
                type: MessageType.system));
            _messages.add(
                MessageItem('📋 세션 ID: $sessionId', type: MessageType.system));
          });

          // 자동으로 세션에 연결
          await _connectToSession(sessionId);
        }
      } else {
        setState(() {
          _messages.add(MessageItem(
              '❌ Failed to create session: ${response.body}',
              type: MessageType.system));
        });
      }
    } catch (e) {
      setState(() {
        _messages.add(MessageItem('❌ Error creating session: $e',
            type: MessageType.system));
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
        _messages.add(MessageItem(
            'Connecting to Extension WebSocket server at $ip:8766...',
            type: MessageType.system));
      });

      // Extension의 WebSocket 서버에 직접 연결 (포트 8766)
      // HTTP 확인은 생략 (Extension은 HTTP 서버를 제공하지 않음)
      final wsUrl = 'ws://$ip:8766';
      _localWebSocket = WebSocketChannel.connect(Uri.parse(wsUrl));

      _localWebSocket!.stream.listen(
        (message) {
          // 로컬 서버에서 메시지 수신
          _handleLocalMessage(message.toString());
        },
        onError: (error) {
          if (mounted) {
            setState(() {
              _lastConnectionError = error.toString();
              _messages.add(MessageItem('❌ Local connection error: $error',
                  type: MessageType.system));
              _isConnected = false;
            });
            // 자동 재연결 시도
            _scheduleReconnect();
          }
        },
        onDone: () {
          if (mounted) {
            setState(() {
              _messages.add(MessageItem('Local connection closed',
                  type: MessageType.system));
              _isConnected = false;
            });
            // 자동 재연결 시도
            _scheduleReconnect();
          }
        },
      );

      setState(() {
        _isConnected = true;
        _isReconnecting = false;
        _reconnectAttempts = 0;
        _lastConnectionError = null;
        _stopReconnect();
        _messages.add(MessageItem(
            '✅ Connected to Extension WebSocket server at $ip:8766',
            type: MessageType.system));
      });

      // 연결 설정 저장
      _saveConnectionSettings();

      // 연결 히스토리에 추가
      AppSettings().addConnectionHistory(ConnectionHistoryItem(
        type: ConnectionType.local,
        ip: ip,
        timestamp: DateTime.now(),
      ));

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
        _messages.add(MessageItem('❌ Error connecting to local server: $e',
            type: MessageType.system));
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
          _messages.add(MessageItem('🤖 Cursor AI Response',
              type: MessageType.chatResponseHeader));
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
                  _currentCursorSessionId =
                      _sessionInfo!['currentSessionId'] as String;
                }
                if (_sessionInfo!['clientId'] != null) {
                  _currentClientId = _sessionInfo!['clientId'] as String;
                }
              });
            }
            // 대화 히스토리 조회 결과 처리
            else if (commandType == 'get_chat_history' &&
                data['data'] != null) {
              final historyData = data['data'] as Map<String, dynamic>;
              if (historyData['entries'] != null) {
                setState(() {
                  _chatHistory = List<Map<String, dynamic>>.from(
                      historyData['entries'] as List);
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
            if (commandType != 'get_session_info' &&
                commandType != 'get_chat_history') {
              _messages.add(
                  MessageItem('✅ Command succeeded', type: MessageType.system));
            }
            if (commandType == 'stop_prompt') {
              _isWaitingForResponse = false;
            }
          } else {
            _messages.add(MessageItem('❌ Command failed: ${data['error']}',
                type: MessageType.system));
            _isWaitingForResponse = false;
          }
        } else if (type == 'log') {
          // 실시간 로그 메시지 처리
          final logLevelStr = data['level'] ?? 'info';
          final logMessage = data['message'] ?? '';
          final logSource = data['source'] ?? 'unknown';
          final logError = data['error'];

          // 로그 레벨 파싱
          LogLevel parsedLogLevel;
          switch (logLevelStr) {
            case 'error':
              parsedLogLevel = LogLevel.error;
              break;
            case 'warn':
            case 'warning':
              parsedLogLevel = LogLevel.warning;
              break;
            default:
              parsedLogLevel = LogLevel.info;
          }

          String logPrefix = '';
          switch (logSource) {
            case 'extension':
              logPrefix = '🔌 [Extension]';
              break;
            case 'pc-server':
              logPrefix = '🖥️ [PC Server]';
              break;
            default:
              logPrefix = '📝 [Log]';
          }

          String logText = '$logPrefix $logMessage';
          if (logError != null) {
            logText += ' - Error: $logError';
          }

          _messages.add(MessageItem(logText,
              type: MessageType.log, logLevel: parsedLogLevel));
        } else if (type == 'agent_mode_selected') {
          // 자동 모드로 선택된 실제 모드 정보
          final requestedMode = data['requestedMode'] ?? 'auto';
          final actualMode = data['actualMode'] ?? 'agent';
          final displayName = data['displayName'] ?? actualMode;

          print(
              '📨 Received agent_mode_selected: requestedMode=$requestedMode, actualMode=$actualMode, _selectedAgentMode=$_selectedAgentMode');

          if (mounted) {
            setState(() {
              // 자동 모드로 선택된 경우에만 표시
              if (requestedMode == 'auto' && _selectedAgentMode == 'auto') {
                _actualSelectedMode = actualMode;

                // 마지막 User Prompt의 모드 업데이트
                // 메시지 리스트에서 가장 최근 User Prompt 찾아서 업데이트
                bool found = false;
                for (int i = _messages.length - 1; i >= 0; i--) {
                  if (_messages[i].type == MessageType.userPrompt) {
                    // agentMode가 null인 경우 (자동 모드로 전송된 경우) 업데이트
                    if (_messages[i].agentMode == null) {
                      final updatedItem = MessageItem(
                        _messages[i].text,
                        type: _messages[i].type,
                        agentMode: actualMode,
                      );
                      _messages[i] = updatedItem;
                      // _lastUserPrompt도 업데이트
                      if (_lastUserPrompt != null &&
                          _lastUserPrompt!.text == _messages[i].text) {
                        _lastUserPrompt = updatedItem;
                      }
                      print(
                          '🤖 Updated User Prompt mode to: $actualMode (text: ${_messages[i].text.substring(0, _messages[i].text.length > 30 ? 30 : _messages[i].text.length)}...)');
                      found = true;
                      break;
                    }
                  }
                }

                if (!found) {
                  print('⚠️ Could not find User Prompt to update');
                } else {
                  // UI 강제 업데이트를 위해 스크롤
                  Future.microtask(() {
                    if (mounted) {
                      _scrollToBottom();
                    }
                  });
                }
              }
            });

            // 사용자에게 알림 (SnackBar)
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('🤖 자동 모드: $displayName'),
                duration: const Duration(seconds: 2),
                backgroundColor: Colors.blue.shade700,
              ),
            );
          }
        } else if (type == 'connection_status') {
          // 연결 상태 메시지 처리
          final status = data['status'] ?? 'unknown';
          final source = data['source'] ?? 'unknown';
          final message = data['message'] ?? '';
          final errorCode = data['errorCode'];
          final errorType = data['errorType'];

          String statusText = '';
          switch (status) {
            case 'connected':
              statusText = '✅ $message';
              setState(() {
                _isReconnecting = false;
                _reconnectAttempts = 0;
                _stopReconnect();
              });
              break;
            case 'disconnected':
              statusText = '⚠️ $message';
              setState(() {
                _isConnected = false;
              });
              _scheduleReconnect();
              break;
            case 'error':
              statusText = '❌ $message';
              setState(() {
                _isConnected = false;
                _lastConnectionError = message;
              });
              _scheduleReconnect();
              break;
          }

          if (statusText.isNotEmpty) {
            _messages.add(MessageItem(statusText, type: MessageType.system));
          }
        }
      });
      _scrollToBottom();
    } catch (e) {
      // JSON 파싱 실패 시 원본 메시지 표시
      if (mounted) {
        setState(() {
          _messages
              .add(MessageItem('Received: $message', type: MessageType.system));
        });
      }
    }
  }

  /// PC가 설정한 PIN 입력 다이얼로그 (403 PIN_REQUIRED 시 호출)
  Future<String?> _showPinDialog() async {
    if (!mounted) return null;
    final controller = TextEditingController();
    final navigator = Navigator.of(context);
    return showDialog<String>(
      context: context,
      barrierDismissible: false,
      useSafeArea: true,
      builder: (dialogContext) => AlertDialog(
        title: const Text('PIN 입력'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                '이 세션은 PC에서 PIN 보호가 설정되어 있습니다.\nPC에서 설정한 4~6자리 숫자 PIN을 입력하세요.',
                style: TextStyle(fontSize: 14),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: controller,
                keyboardType: TextInputType.number,
                obscureText: true,
                maxLength: 6,
                autofocus: true,
                decoration: const InputDecoration(
                  labelText: 'PIN',
                  hintText: '4~6자리 숫자',
                  counterText: '',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => navigator.pop(null),
            child: const Text('취소'),
          ),
          FilledButton(
            onPressed: () => navigator.pop(controller.text.trim()),
            child: const Text('확인'),
          ),
        ],
      ),
    );
  }

  // 기존 세션에 연결 (PIN은 PC가 설정한 경우에만 전달)
  Future<void> _connectToSession(String sessionId, [String? pin]) async {
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
        _messages.add(MessageItem(
            pin != null
                ? 'Connecting to session $sessionId with PIN...'
                : 'Connecting to session $sessionId...',
            type: MessageType.system));
      });

      final body = <String, dynamic>{
        'sessionId': sessionId,
        'deviceId': _deviceId,
        'deviceType': 'mobile',
      };
      if (pin != null && pin.isNotEmpty) {
        body['pin'] = pin;
      }

      final response = await http.post(
        Uri.parse('$RELAY_SERVER_URL/api/connect'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(body),
      );

      final data = response.body.isNotEmpty
          ? jsonDecode(response.body) as Map<String, dynamic>?
          : <String, dynamic>{};
      final dataMap = data ?? {};
      final errorCode = dataMap['errorCode']?.toString();
      final errorMessage = dataMap['error']?.toString() ?? '';

      if (response.statusCode == 200 && dataMap['success'] == true) {
        setState(() {
          _sessionId = sessionId;
          _isConnected = true;
          _isReconnecting = false;
          _reconnectAttempts = 0;
          _lastConnectionError = null;
          _stopReconnect();
          _messages.add(MessageItem('✅ Connected to session $sessionId',
              type: MessageType.system));
        });

        // 연결 설정 저장
        _saveConnectionSettings();

        // 연결 히스토리에 추가
        AppSettings().addConnectionHistory(ConnectionHistoryItem(
          type: ConnectionType.relay,
          sessionId: sessionId,
          timestamp: DateTime.now(),
        ));

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
      } else if (response.statusCode == 403 &&
          (errorCode == 'PIN_REQUIRED' ||
              errorMessage.toLowerCase().contains('pin required') ||
              errorMessage.toLowerCase().contains('pin을 입력'))) {
        // PC가 PIN을 설정한 세션 → PIN 입력 후 재시도
        if (!mounted) return;
        setState(() {
          _messages.add(MessageItem('이 세션은 PIN이 필요합니다. PIN을 입력하세요.',
              type: MessageType.system));
        });
        final enteredPin = await _showPinDialog();
        if (!mounted) return;
        if (enteredPin != null && enteredPin.isNotEmpty) {
          await _connectToSession(sessionId, enteredPin);
        } else {
          setState(() {
            _messages.add(MessageItem('PIN을 입력하지 않아 연결하지 않았습니다.',
                type: MessageType.system));
          });
        }
      } else if (response.statusCode == 403 &&
          (errorCode == 'INVALID_PIN' ||
              errorMessage.toLowerCase().contains('invalid pin'))) {
        setState(() {
          _messages.add(MessageItem('❌ PIN이 올바르지 않습니다. PC에서 설정한 PIN을 확인하세요.',
              type: MessageType.system));
        });
      } else {
        final error = errorMessage.isNotEmpty ? errorMessage : 'Unknown error';
        setState(() {
          _lastConnectionError = error;
          _messages
              .add(MessageItem('❌ 연결 실패: $error', type: MessageType.system));
        });
        // Session not found 시 자동 새 세션 생성/재연결 하지 않음 (사용자가 세션 ID 확인 후 재시도)
        final isSessionNotFound =
            error.toLowerCase().contains('session not found');
        if (!isSessionNotFound) {
          _scheduleReconnect();
        }
      }
    } catch (e) {
      setState(() {
        _lastConnectionError = e.toString();
        _messages.add(MessageItem('❌ Error connecting to session: $e',
            type: MessageType.system));
      });
      _scheduleReconnect();
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

  // 히스토리에서 연결
  void _connectFromHistory(ConnectionHistoryItem item) {
    setState(() {
      _connectionType = item.type;
      if (item.type == ConnectionType.local) {
        _localIpController.text = item.ip ?? '';
      } else {
        _sessionIdController.text = item.sessionId ?? '';
      }
    });

    // 연결 시도
    _connect();
  }

  // 메시지 폴링 시작
  void _startPolling() {
    _stopPolling(); // 기존 타이머 정지

    _pollTimer = Timer.periodic(const Duration(seconds: 2), (_) async {
      if (!_isConnected || _sessionId == null) return;

      try {
        final response = await http.get(
          Uri.parse(
              '$RELAY_SERVER_URL/api/poll?sessionId=$_sessionId&deviceType=mobile&deviceId=$_deviceId'),
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
      _messages.add(MessageItem('Received: ${jsonEncode(msg)}',
          type: MessageType.system));

      if (type == 'command_result') {
        if (messageData['success'] == true) {
          final commandType = messageData['command_type'] as String? ?? '';

          // 세션 정보 조회 결과 처리
          if (commandType == 'get_session_info' &&
              messageData['data'] != null) {
            setState(() {
              _sessionInfo = messageData['data'] as Map<String, dynamic>;
              if (_sessionInfo!['currentSessionId'] != null) {
                _currentCursorSessionId =
                    _sessionInfo!['currentSessionId'] as String;
              }
              if (_sessionInfo!['clientId'] != null) {
                _currentClientId = _sessionInfo!['clientId'] as String;
              }
            });
          }
          // 대화 히스토리 조회 결과 처리
          else if (commandType == 'get_chat_history' &&
              messageData['data'] != null) {
            final historyData = messageData['data'] as Map<String, dynamic>;
            if (historyData['entries'] != null) {
              setState(() {
                _chatHistory = List<Map<String, dynamic>>.from(
                    historyData['entries'] as List);
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
          if (commandType != 'get_session_info' &&
              commandType != 'get_chat_history') {
            _messages.add(
                MessageItem('✅ Command succeeded', type: MessageType.system));
          }
          if (commandType == 'stop_prompt') {
            _isWaitingForResponse = false;
          }
        } else {
          _messages.add(MessageItem('❌ Command failed: ${messageData['error']}',
              type: MessageType.system));
          _isWaitingForResponse = false;
        }
      } else if (type == 'error') {
        _messages.add(MessageItem('❌ Error: ${messageData['message']}',
            type: MessageType.system));
        _isWaitingForResponse = false;
      } else if (type == 'user_message') {
        final text = messageData['text'] ?? '';
        _messages
            .add(MessageItem('💬 You: $text', type: MessageType.userMessage));
      } else if (type == 'gemini_response') {
        final text = messageData['text'] ?? '';
        _messages.add(
            MessageItem('🤖 Gemini: $text', type: MessageType.geminiResponse));
      } else if (type == 'terminal_output') {
        final text = messageData['text'] ?? '';
        _messages.add(MessageItem('📟 Terminal: $text',
            type: MessageType.terminalOutput));
      } else if (type == 'chat_response_chunk') {
        // 스트리밍 청크 처리
        final chunkText = messageData['text'] ?? '';
        final fullText = messageData['fullText'] ?? chunkText;
        final isReplace = messageData['isReplace'] == true;

        // 세션 ID 추출 및 저장
        if (messageData['sessionId'] != null) {
          setState(() {
            _currentCursorSessionId = messageData['sessionId'] as String;
          });
        }
        if (messageData['clientId'] != null) {
          final newClientId = messageData['clientId'] as String;
          setState(() {
            if (_currentClientId == null) {
              _currentClientId = newClientId;
              _loadSessionInfo();
              _loadChatHistory();
            } else if (_currentClientId != newClientId) {
              _currentClientId = newClientId;
              _loadSessionInfo();
              _loadChatHistory();
            }
          });
        }

        setState(() {
          // 첫 번째 청크인 경우 메시지 추가
          if (_streamingMessageIndex == null) {
            _messages
                .add(MessageItem('', type: MessageType.chatResponseDivider));
            _messages.add(MessageItem('🤖 Cursor AI Response',
                type: MessageType.chatResponseHeader));
            _streamingText = isReplace ? fullText : chunkText;
            _messages.add(MessageItem(_streamingText,
                type: MessageType.chatResponseChunk));
            _streamingMessageIndex = _messages.length - 1;
          } else {
            // 기존 스트리밍 메시지 업데이트
            if (isReplace) {
              _streamingText = fullText;
            } else {
              _streamingText += chunkText;
            }
            // 메시지 업데이트
            if (_streamingMessageIndex! < _messages.length) {
              _messages[_streamingMessageIndex!] = MessageItem(_streamingText,
                  type: MessageType.chatResponseChunk);
            }
          }
        });
        _scrollToBottom();
      } else if (type == 'chat_response_complete') {
        // 스트리밍 완료 처리
        setState(() {
          if (_streamingMessageIndex != null &&
              _streamingMessageIndex! < _messages.length) {
            // 스트리밍 메시지를 일반 chat_response로 변경
            _messages[_streamingMessageIndex!] =
                MessageItem(_streamingText, type: MessageType.chatResponse);
            _streamingMessageIndex = null;
            _streamingText = '';
          }
          // 세션 ID 추출 및 저장
          if (messageData['clientId'] != null) {
            final newClientId = messageData['clientId'] as String;
            if (_currentClientId == null || _currentClientId != newClientId) {
              _currentClientId = newClientId;
              _loadSessionInfo();
            }
            // 히스토리 새로고침
            Future.delayed(const Duration(milliseconds: 500), () {
              _loadChatHistory();
            });
          } else if (_currentClientId != null) {
            Future.delayed(const Duration(milliseconds: 500), () {
              _loadChatHistory();
            });
          }
          _isWaitingForResponse = false;
        });
        _scrollToBottom();
      } else if (type == 'chat_response') {
        // 기존 방식 (비스트리밍 응답) - 하위 호환성
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
        _messages.add(MessageItem('🤖 Cursor AI Response',
            type: MessageType.chatResponseHeader));
        _messages.add(MessageItem(text, type: MessageType.chatResponse));
        _messages.add(MessageItem('', type: MessageType.chatResponseDivider));
        _isWaitingForResponse = false;
      } else if (type == 'agent_mode_selected') {
        // 자동 모드로 선택된 실제 모드 정보 (릴레이 서버 연결)
        final requestedMode = messageData['requestedMode'] ?? 'auto';
        final actualMode = messageData['actualMode'] ?? 'agent';
        final displayName = messageData['displayName'] ?? actualMode;

        print(
            '📨 Received agent_mode_selected (relay): requestedMode=$requestedMode, actualMode=$actualMode, _selectedAgentMode=$_selectedAgentMode');

        if (mounted) {
          setState(() {
            // 자동 모드로 선택된 경우에만 표시
            if (requestedMode == 'auto' && _selectedAgentMode == 'auto') {
              _actualSelectedMode = actualMode;

              // 마지막 User Prompt의 모드 업데이트
              // 메시지 리스트에서 가장 최근 User Prompt 찾아서 업데이트
              bool found = false;
              for (int i = _messages.length - 1; i >= 0; i--) {
                if (_messages[i].type == MessageType.userPrompt) {
                  // agentMode가 null인 경우 (자동 모드로 전송된 경우) 업데이트
                  if (_messages[i].agentMode == null) {
                    final updatedItem = MessageItem(
                      _messages[i].text,
                      type: _messages[i].type,
                      agentMode: actualMode,
                    );
                    _messages[i] = updatedItem;
                    // _lastUserPrompt도 업데이트
                    if (_lastUserPrompt != null &&
                        _lastUserPrompt!.text == _messages[i].text) {
                      _lastUserPrompt = updatedItem;
                    }
                    print(
                        '🤖 Updated User Prompt mode to: $actualMode (relay, text: ${_messages[i].text.substring(0, _messages[i].text.length > 30 ? 30 : _messages[i].text.length)}...)');
                    found = true;
                    break;
                  }
                }
              }

              if (!found) {
                print('⚠️ Could not find User Prompt to update (relay)');
              } else {
                // UI 강제 업데이트를 위해 스크롤
                Future.microtask(() {
                  if (mounted) {
                    _scrollToBottom();
                  }
                });
              }
            }
          });

          // 사용자에게 알림 (SnackBar)
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('🤖 자동 모드: $displayName'),
              duration: const Duration(seconds: 2),
              backgroundColor: Colors.blue.shade700,
            ),
          );
        }
      } else if (type == 'log') {
        // 실시간 로그 메시지 처리
        final logLevelStr = messageData['level'] ?? 'info';
        final logMessage = messageData['message'] ?? '';
        final logSource = messageData['source'] ?? 'unknown';
        final logError = messageData['error'];

        // 로그 레벨 파싱
        LogLevel parsedLogLevel;
        switch (logLevelStr) {
          case 'error':
            parsedLogLevel = LogLevel.error;
            break;
          case 'warn':
          case 'warning':
            parsedLogLevel = LogLevel.warning;
            break;
          default:
            parsedLogLevel = LogLevel.info;
        }

        String logPrefix = '';
        switch (logSource) {
          case 'extension':
            logPrefix = '🔌 [Extension]';
            break;
          case 'pc-server':
            logPrefix = '🖥️ [PC Server]';
            break;
          default:
            logPrefix = '📝 [Log]';
        }

        String logText = '$logPrefix $logMessage';
        if (logError != null) {
          logText += ' - Error: $logError';
        }

        setState(() {
          _messages.add(MessageItem(logText,
              type: MessageType.log, logLevel: parsedLogLevel));
        });
        _scrollToBottom();
      }
    });
    _scrollToBottom();
  }

  // 모드 이름을 사용자 친화적인 표시 이름으로 변환
  String _getModeDisplayName(String mode) {
    switch (mode) {
      case 'agent':
        return 'Agent';
      case 'ask':
        return 'Ask';
      case 'plan':
        return 'Plan';
      case 'debug':
        return 'Debug';
      case 'auto':
        return 'Auto';
      default:
        return mode;
    }
  }

  // 모드에 따른 아이콘 반환
  IconData _getModeIcon(String mode) {
    switch (mode) {
      case 'agent':
        return Icons.code;
      case 'ask':
        return Icons.help_outline;
      case 'plan':
        return Icons.assignment;
      case 'debug':
        return Icons.bug_report;
      case 'auto':
        return Icons.auto_awesome;
      default:
        return Icons.smart_toy;
    }
  }

  // 텍스트 내용을 분석하여 적절한 에이전트 모드 자동 선택 (Extension의 detectAgentMode와 동일한 로직)
  String? _detectAgentMode(String text) {
    final lowerText = text.toLowerCase();

    // Debug 모드 키워드
    const debugKeywords = [
      'bug',
      'error',
      'fix',
      'debug',
      'issue',
      'problem',
      'crash',
      'exception',
      'trace',
      'log'
    ];
    if (debugKeywords.any((keyword) => lowerText.contains(keyword))) {
      // 버그 관련 키워드가 있지만, 단순 질문인지 확인
      if (lowerText.contains('why') ||
          lowerText.contains('what') ||
          lowerText.contains('how') ||
          lowerText.contains('?')) {
        // 질문 형태면 Ask 모드
        if (lowerText.contains('explain') ||
            lowerText.contains('understand') ||
            lowerText.contains('learn')) {
          return 'ask';
        }
      }
      return 'debug';
    }

    // Plan 모드 키워드
    const planKeywords = [
      'plan',
      'design',
      'architecture',
      'implement',
      'create',
      'build',
      'feature',
      'refactor',
      'analyze',
      'analysis',
      'project',
      'review',
      'overview',
      'structure'
    ];
    if (planKeywords.any((keyword) => lowerText.contains(keyword))) {
      // 복잡한 작업 키워드 확인
      const complexKeywords = [
        'multiple',
        'several',
        'many',
        'system',
        'module',
        'component',
        'project',
        '전체',
        '모든',
        '전반'
      ];
      if (complexKeywords.any((keyword) => lowerText.contains(keyword))) {
        return 'plan';
      }
      // "프로젝트 분석", "전체 분석" 같은 패턴도 Plan 모드
      if (lowerText.contains('analyze') ||
          lowerText.contains('analysis') ||
          lowerText.contains('분석')) {
        return 'plan';
      }
    }

    // Ask 모드 키워드 (질문, 학습, 탐색)
    const askKeywords = [
      'explain',
      'what is',
      'how does',
      'why',
      'understand',
      'learn',
      'show me',
      'tell me'
    ];
    if (askKeywords.any((keyword) => lowerText.contains(keyword)) ||
        lowerText.endsWith('?')) {
      return 'ask';
    }

    // 기본값: Agent 모드 (코드 작성/수정 작업)
    return null; // null이면 기본 Agent 모드 사용
  }

  void _disconnect() {
    _stopPolling();
    _stopReconnect(); // 재연결 중지

    // 로컬 WebSocket 연결 종료
    _localWebSocket?.sink.close();
    _localWebSocket = null;

    if (mounted) {
      setState(() {
        _isConnected = false;
        _sessionId = null;
        _isReconnecting = false;
        _reconnectAttempts = 0;
        _messages.add(MessageItem('Disconnected', type: MessageType.system));
      });
    }
  }

  // 재연결 스케줄링
  void _scheduleReconnect() {
    if (_isReconnecting || _isConnected) return;

    const maxAttempts = 5;
    if (_reconnectAttempts >= maxAttempts) {
      setState(() {
        _isReconnecting = false;
        _messages.add(MessageItem(
            '❌ 재연결 시도 횟수 초과 ($maxAttempts회). 수동으로 연결해주세요.',
            type: MessageType.system));
      });
      return;
    }

    setState(() {
      _isReconnecting = true;
      _reconnectAttempts++;
    });

    // 지수 백오프: 2초, 4초, 8초, 16초, 32초
    final delay = Duration(seconds: 2 * (1 << (_reconnectAttempts - 1)));

    setState(() {
      _messages.add(MessageItem(
          '🔄 ${delay.inSeconds}초 후 재연결 시도... ($_reconnectAttempts/$maxAttempts)',
          type: MessageType.system));
    });

    _reconnectTimer = Timer(delay, () {
      if (mounted && !_isConnected) {
        if (_connectionType == ConnectionType.local) {
          _connectToLocal();
        } else {
          final sessionId = _sessionIdController.text.trim();
          if (sessionId.isNotEmpty) {
            _connectToSession(sessionId);
          } else {
            _createSession();
          }
        }
      }
    });
  }

  // 재연결 중지
  void _stopReconnect() {
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    _isReconnecting = false;
  }

  // 수동 재연결
  void _manualReconnect() {
    _stopReconnect();
    _reconnectAttempts = 0;
    _connect();
  }

  Future<void> _sendCommand(String type,
      {String? text,
      String? command,
      List<dynamic>? args,
      bool? prompt,
      bool? terminal,
      bool? execute,
      String? action,
      bool? newSession,
      String? clientId,
      String? sessionId,
      int? limit,
      String? agentMode}) async {
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
      // agentMode가 제공되지 않으면 선택된 모드 사용 (또는 auto)
      final mode = agentMode ?? _selectedAgentMode;

      // 자동 모드이고 프롬프트인 경우 텍스트를 분석하여 모드 미리 감지
      String? finalModeForCommand;
      if (prompt == true && text != null && mode == 'auto') {
        final detectedMode = _detectAgentMode(text);
        finalModeForCommand = detectedMode ?? 'agent'; // 감지되지 않으면 기본 Agent 모드
        print(
            '🤖 Auto mode detected for command: $finalModeForCommand for text: ${text.substring(0, text.length > 30 ? 30 : text.length)}...');
      } else if (mode != 'auto') {
        finalModeForCommand = mode;
      }

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
        // 자동 모드일 때도 감지된 모드를 전달하여 히스토리에 저장되도록 함
        if (finalModeForCommand != null) 'agentMode': finalModeForCommand,
      };

      // 프롬프트 전송 시 사용자 프롬프트를 별도로 기록하고 응답 대기 상태 설정
      if (prompt == true && execute == true && text != null) {
        setState(() {
          _isWaitingForResponse = true;
          // 사용자 프롬프트를 별도 타입으로 추가 (선택된 모드와 함께)
          final promptItem = MessageItem(
            text,
            type: MessageType.userPrompt,
            agentMode: finalModeForCommand ?? mode, // 감지된 모드 또는 선택된 모드
          );
          _lastUserPrompt = promptItem;
          _messages.add(promptItem);

          // 디버깅: 모드 정보 출력
          print(
              '📝 User Prompt added - mode: $mode, finalModeForCommand: $finalModeForCommand, agentMode: ${promptItem.agentMode}');
        });
      }

      if (_connectionType == ConnectionType.local) {
        // 로컬 서버로 메시지 전송 (WebSocket)
        if (_localWebSocket != null) {
          _localWebSocket!.sink.add(jsonEncode(commandData));
          if (mounted) {
            setState(() {
              _messages.add(MessageItem('✅ Message sent to local server',
                  type: MessageType.system));
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
            _messages.add(MessageItem('Sent: ${commandData.toString()}',
                type: MessageType.system));
            if (response.statusCode == 200 && responseData['success'] == true) {
              _messages.add(MessageItem('✅ Message sent to relay',
                  type: MessageType.system));
            } else {
              _messages.add(MessageItem(
                  '❌ Failed to send: ${responseData['error'] ?? 'Unknown error'}',
                  type: MessageType.system));
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
          _messages
              .add(MessageItem('Send error: $e', type: MessageType.system));
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
        margin: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
        padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.primaryContainer,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Icon(
              Icons.smart_toy,
              size: 20,
              color: Theme.of(context).colorScheme.onPrimaryContainer,
            ),
            const SizedBox(width: 12),
            Text(
              message.text,
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: Theme.of(context).colorScheme.onPrimaryContainer,
              ),
            ),
          ],
        ),
      );
    }

    // 채팅 응답 본문 (스트리밍 중)
    if (message.type == MessageType.chatResponseChunk) {
      return Container(
        margin: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
        padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: Theme.of(context).colorScheme.outline.withOpacity(0.1),
            width: 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: SelectableText(
                    message.text,
                    style: const TextStyle(
                      fontSize: 13,
                      height: 1.5,
                    ),
                  ),
                ),
                // 스트리밍 인디케이터
                const SizedBox(width: 8),
                TweenAnimationBuilder<double>(
                  tween: Tween(begin: 0.0, end: 1.0),
                  duration: const Duration(milliseconds: 500),
                  builder: (context, value, child) {
                    return Opacity(
                      opacity: value,
                      child: Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(
                          color: Colors.blue,
                          shape: BoxShape.circle,
                        ),
                      ),
                    );
                  },
                  onEnd: () {
                    // 애니메이션 반복
                    if (mounted) {
                      setState(() {});
                    }
                  },
                ),
              ],
            ),
          ],
        ),
      );
    }

    // 채팅 응답 본문 (완료)
    if (message.type == MessageType.chatResponse) {
      return Container(
        margin: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
        padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: Theme.of(context).colorScheme.outline.withOpacity(0.1),
            width: 1,
          ),
        ),
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
          color:
              Theme.of(context).colorScheme.secondaryContainer.withOpacity(0.3),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: Theme.of(context).colorScheme.secondary.withOpacity(0.2),
            width: 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.secondaryContainer,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.person,
                    size: 16,
                    color: Theme.of(context).colorScheme.onSecondaryContainer,
                  ),
                ),
                const SizedBox(width: 12),
                Text(
                  '📝 Your Prompt',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: Theme.of(context).colorScheme.onSurface,
                  ),
                ),
                // 에이전트 모드 표시 (null이 아니고 auto가 아닌 모든 경우, 자동 모드도 미리 감지되어 표시됨)
                if (message.agentMode != null &&
                    message.agentMode!.isNotEmpty &&
                    message.agentMode != 'auto') ...[
                  const SizedBox(width: 8),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.blue.shade100,
                      borderRadius: BorderRadius.circular(4),
                      border:
                          Border.all(color: Colors.blue.shade300, width: 0.5),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          _getModeIcon(message.agentMode!),
                          size: 12,
                          color: Colors.blue.shade700,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          _getModeDisplayName(message.agentMode!),
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w500,
                            color: Colors.blue.shade700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                const Spacer(),
                Text(
                  _formatTime(message.timestamp),
                  style: TextStyle(
                    fontSize: 11,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
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

    // 로그 메시지 스타일
    if (message.type == MessageType.log) {
      // 로그 레벨에 따라 색상 결정
      Color logColor;
      IconData logIcon;

      switch (message.logLevel ?? LogLevel.info) {
        case LogLevel.error:
          logColor = Theme.of(context).colorScheme.error;
          logIcon = Icons.error;
        case LogLevel.warning:
          logColor = const Color(0xFFFF9800); // 오렌지
          logIcon = Icons.warning;
        case LogLevel.info:
          logColor = Theme.of(context).colorScheme.tertiary;
          logIcon = Icons.info;
      }

      return Container(
        margin: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 2.0),
        padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 6.0),
        decoration: BoxDecoration(
          color: logColor.withOpacity(0.1),
          borderRadius: BorderRadius.circular(6.0),
          border: Border.all(color: logColor.withOpacity(0.3), width: 1),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              logIcon,
              size: 14,
              color: logColor,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: SelectableText(
                message.text,
                style: TextStyle(
                  fontSize: 11,
                  color: logColor.withOpacity(0.9),
                  fontFamily: 'monospace',
                  height: 1.4,
                ),
              ),
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
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                  fontStyle: FontStyle.italic,
                ),
              ),
            ),
            IconButton(
              icon: const Icon(Icons.copy, size: 14),
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
              iconSize: 14,
              color: Theme.of(context)
                  .colorScheme
                  .onSurfaceVariant
                  .withOpacity(0.6),
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
    if (text.contains('Disconnected') || text.contains('Connection'))
      return Icons.link_off;
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
    _loadConnectionSettings();
    // 설정에서 기본 에이전트 모드 적용
    _selectedAgentMode = AppSettings().defaultAgentMode;
    // 설정 변경 리스너 추가
    AppSettings().addListener(_onAppSettingsChanged);
  }

  void _onAppSettingsChanged() {
    if (mounted) {
      setState(() {
        // 설정 변경 시 UI 업데이트 (히스토리 표시 등)
      });
    }
  }

  // 입력창 클리어 (한글 IME composing 버퍼 완전 초기화)
  void _clearCommandInput() {
    // Controller 텍스트 클리어
    _commandController.clear();

    // Key를 변경하여 TextField 완전 재생성 (IME 상태 완전 리셋)
    setState(() {
      _textFieldKey++;
    });

    // 새 TextField에 포커스 요청
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _commandFocusNode.requestFocus();
      }
    });
  }

  // 연결 설정 로드 (SharedPreferences)
  Future<void> _loadConnectionSettings() async {
    try {
      final prefs = await SharedPreferences.getInstance();

      // 연결 타입 로드
      final connectionTypeStr = prefs.getString('connection_type');
      if (connectionTypeStr != null) {
        setState(() {
          _connectionType = connectionTypeStr == 'local'
              ? ConnectionType.local
              : ConnectionType.relay;
        });
      }

      // PC(Extension) IP 주소 로드
      final savedIp = prefs.getString('pc_server_ip');
      if (savedIp != null && savedIp.isNotEmpty) {
        _localIpController.text = savedIp;
      }

      // 마지막 세션 ID 로드 (선택사항)
      final lastSessionId = prefs.getString('last_session_id');
      if (lastSessionId != null && lastSessionId.isNotEmpty) {
        _sessionIdController.text = lastSessionId;
      }
    } catch (e) {
      // 에러는 조용히 무시 (첫 실행 시 prefs가 없을 수 있음)
    }
  }

  // 연결 설정 저장 (SharedPreferences)
  Future<void> _saveConnectionSettings() async {
    try {
      final prefs = await SharedPreferences.getInstance();

      // 연결 타입 저장
      await prefs.setString('connection_type',
          _connectionType == ConnectionType.local ? 'local' : 'relay');

      // PC(Extension) IP 주소 저장
      if (_localIpController.text.trim().isNotEmpty) {
        await prefs.setString('pc_server_ip', _localIpController.text.trim());
      }

      // 세션 ID 저장 (연결 성공 시)
      if (_sessionId != null && _sessionId!.isNotEmpty) {
        await prefs.setString('last_session_id', _sessionId!);
      }
    } catch (e) {
      // 에러는 조용히 무시
    }
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
          limit: limit);
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
            _messages.add(MessageItem(
                '⚠️ Local connection lost, please reconnect',
                type: MessageType.system));
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
            _messages.add(MessageItem('⚠️ Connection lost, please reconnect',
                type: MessageType.system));
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
    AppSettings().removeListener(_onAppSettingsChanged);
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
        title: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: Image.asset(
                'images/app_icon.png',
                width: 28,
                height: 28,
              ),
            ),
            const SizedBox(width: 8),
            const Text(
              'Cursor Remote',
              style: TextStyle(
                fontWeight: FontWeight.w600,
                letterSpacing: -0.5,
              ),
            ),
          ],
        ),
        actions: [
          // 응답 대기 중 인디케이터
          if (_isWaitingForResponse)
            Padding(
              padding: const EdgeInsets.only(right: 8.0),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.primaryContainer,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          Theme.of(context).colorScheme.primary,
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      '응답 대기 중',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: Theme.of(context).colorScheme.onPrimaryContainer,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          // 설정 버튼
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            tooltip: '설정',
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (context) => const SettingsPage(),
                ),
              );
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // 최상단: 연결 상태 및 설정 카드
          Container(
            margin: const EdgeInsets.all(8.0),
            child: Card(
              child: ExpansionTile(
                controller: _expansionTileController,
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: _isConnected
                        ? Theme.of(context).colorScheme.primaryContainer
                        : Theme.of(context).colorScheme.surfaceContainerHighest,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    _isConnected ? Icons.cloud_done : Icons.cloud_off,
                    color: _isConnected
                        ? Theme.of(context).colorScheme.onPrimaryContainer
                        : Theme.of(context).colorScheme.onSurfaceVariant,
                    size: 20,
                  ),
                ),
                title: Text(
                  _isConnected ? '연결됨' : '연결 안 됨',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: _isConnected
                        ? Theme.of(context).colorScheme.primary
                        : Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
                subtitle: Text(
                  _isConnected
                      ? (_connectionType == ConnectionType.local
                          ? '로컬 서버 모드'
                          : (_sessionId != null
                              ? '릴레이 모드 • 세션: $_sessionId'
                              : '릴레이 모드'))
                      : '연결을 설정하세요',
                  style: TextStyle(
                    fontSize: 12,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
                initiallyExpanded: !_isConnected, // 연결 안 됨일 때만 펼침
                children: [
                  Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // 연결 타입 선택
                        Text(
                          '연결 타입',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: Theme.of(context).colorScheme.onSurface,
                          ),
                        ),
                        const SizedBox(height: 12),
                        SegmentedButton<ConnectionType>(
                          segments: const [
                            ButtonSegment<ConnectionType>(
                              value: ConnectionType.local,
                              label: Text('로컬 서버'),
                              icon: Icon(Icons.computer, size: 18),
                            ),
                            ButtonSegment<ConnectionType>(
                              value: ConnectionType.relay,
                              label: Text('릴레이 서버'),
                              icon: Icon(Icons.cloud, size: 18),
                            ),
                          ],
                          selected: {_connectionType},
                          onSelectionChanged: _isConnected
                              ? null
                              : (Set<ConnectionType> newSelection) {
                                  setState(() {
                                    _connectionType = newSelection.first;
                                  });
                                },
                        ),
                        const SizedBox(height: 16),
                        // 로컬 서버 연결 UI
                        if (_connectionType == ConnectionType.local) ...[
                          TextField(
                            controller: _localIpController,
                            focusNode: _localIpFocusNode,
                            decoration: const InputDecoration(
                              labelText: 'PC IP (Extension이 실행 중인 PC)',
                              hintText: '192.168.0.10',
                              border: OutlineInputBorder(),
                              isDense: true,
                              contentPadding: EdgeInsets.all(12),
                              prefixIcon: Icon(Icons.computer),
                              helperText: '이전에 사용한 IP 주소가 자동으로 표시됩니다',
                            ),
                            enabled: !_isConnected,
                            keyboardType: TextInputType.number,
                            textInputAction: TextInputAction.done,
                            onSubmitted: (value) {
                              if (!_isConnected) {
                                _connect();
                              }
                            },
                            onChanged: (value) {
                              // IP 주소 변경 시 자동 저장 (선택사항)
                              if (value.trim().isNotEmpty) {
                                _saveConnectionSettings();
                              }
                            },
                          ),
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Theme.of(context)
                                  .colorScheme
                                  .tertiaryContainer
                                  .withOpacity(0.5),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                color: Theme.of(context)
                                    .colorScheme
                                    .tertiary
                                    .withOpacity(0.3),
                                width: 1,
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(Icons.info_outline,
                                    size: 18,
                                    color:
                                        Theme.of(context).colorScheme.tertiary),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    'PC와 모바일이 같은 네트워크에 있어야 합니다',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w500,
                                      color: Theme.of(context)
                                          .colorScheme
                                          .onSurface,
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
                              labelText:
                                  'Session ID (leave empty to create new)',
                              hintText: 'ABC123',
                              border: OutlineInputBorder(),
                              isDense: true,
                              contentPadding: EdgeInsets.all(12),
                              prefixIcon: Icon(Icons.cloud),
                              helperText:
                                  '비워두면 새 세션이 생성되고 Extension이 자동으로 연결됩니다',
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
                              color: Theme.of(context)
                                  .colorScheme
                                  .primaryContainer
                                  .withOpacity(0.5),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                color: Theme.of(context)
                                    .colorScheme
                                    .primary
                                    .withOpacity(0.2),
                                width: 1,
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(Icons.info_outline,
                                    size: 18,
                                    color:
                                        Theme.of(context).colorScheme.primary),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    '세션 ID를 비워두면 새 세션이 생성됩니다',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w500,
                                      color: Theme.of(context)
                                          .colorScheme
                                          .onSurface,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                        const SizedBox(height: 12),
                        // 최근 연결 목록
                        if (!_isConnected &&
                            AppSettings().connectionHistory.isNotEmpty) ...[
                          Text(
                            '최근 연결',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: Theme.of(context).colorScheme.onSurface,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Container(
                            decoration: BoxDecoration(
                              color: Theme.of(context)
                                  .colorScheme
                                  .surfaceContainerHighest
                                  .withOpacity(0.5),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: Theme.of(context)
                                    .colorScheme
                                    .outline
                                    .withOpacity(0.2),
                                width: 1,
                              ),
                            ),
                            child: Column(
                              children: AppSettings()
                                  .connectionHistory
                                  .asMap()
                                  .entries
                                  .map((entry) {
                                final index = entry.key;
                                final item = entry.value;
                                final isLast = index ==
                                    AppSettings().connectionHistory.length - 1;
                                return Column(
                                  children: [
                                    InkWell(
                                      onTap: () => _connectFromHistory(item),
                                      borderRadius: BorderRadius.vertical(
                                        top: index == 0
                                            ? const Radius.circular(12)
                                            : Radius.zero,
                                        bottom: isLast
                                            ? const Radius.circular(12)
                                            : Radius.zero,
                                      ),
                                      child: Padding(
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 12, vertical: 10),
                                        child: Row(
                                          children: [
                                            Container(
                                              padding: const EdgeInsets.all(6),
                                              decoration: BoxDecoration(
                                                color: item.type ==
                                                        ConnectionType.local
                                                    ? Theme.of(context)
                                                        .colorScheme
                                                        .secondaryContainer
                                                    : Theme.of(context)
                                                        .colorScheme
                                                        .primaryContainer,
                                                borderRadius:
                                                    BorderRadius.circular(6),
                                              ),
                                              child: Icon(
                                                item.type ==
                                                        ConnectionType.local
                                                    ? Icons.computer
                                                    : Icons.cloud,
                                                size: 14,
                                                color: item.type ==
                                                        ConnectionType.local
                                                    ? Theme.of(context)
                                                        .colorScheme
                                                        .onSecondaryContainer
                                                    : Theme.of(context)
                                                        .colorScheme
                                                        .onPrimaryContainer,
                                              ),
                                            ),
                                            const SizedBox(width: 10),
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.start,
                                                children: [
                                                  Text(
                                                    item.displayText,
                                                    style: TextStyle(
                                                      fontSize: 13,
                                                      fontWeight:
                                                          FontWeight.w500,
                                                      color: Theme.of(context)
                                                          .colorScheme
                                                          .onSurface,
                                                      fontFamily: 'monospace',
                                                    ),
                                                  ),
                                                  Text(
                                                    item.relativeTime,
                                                    style: TextStyle(
                                                      fontSize: 11,
                                                      color: Theme.of(context)
                                                          .colorScheme
                                                          .onSurfaceVariant,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                            Icon(
                                              Icons.chevron_right,
                                              size: 18,
                                              color: Theme.of(context)
                                                  .colorScheme
                                                  .onSurfaceVariant,
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                    if (!isLast)
                                      Divider(
                                        height: 1,
                                        indent: 12,
                                        endIndent: 12,
                                        color: Theme.of(context)
                                            .colorScheme
                                            .outline
                                            .withOpacity(0.2),
                                      ),
                                  ],
                                );
                              }).toList(),
                            ),
                          ),
                          const SizedBox(height: 16),
                        ],
                        // 재연결 중 상태 표시
                        if (_isReconnecting) ...[
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Theme.of(context)
                                  .colorScheme
                                  .tertiaryContainer
                                  .withOpacity(0.5),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                color: Theme.of(context)
                                    .colorScheme
                                    .tertiary
                                    .withOpacity(0.3),
                                width: 1,
                              ),
                            ),
                            child: Row(
                              children: [
                                SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    valueColor: AlwaysStoppedAnimation<Color>(
                                      Theme.of(context).colorScheme.tertiary,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    '재연결 시도 중... ($_reconnectAttempts회)',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w500,
                                      color: Theme.of(context)
                                          .colorScheme
                                          .onSurface,
                                    ),
                                  ),
                                ),
                                TextButton(
                                  onPressed: _stopReconnect,
                                  child: const Text('취소',
                                      style: TextStyle(fontSize: 12)),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 8),
                        ],
                        // 연결 에러 표시
                        if (_lastConnectionError != null &&
                            !_isConnected &&
                            !_isReconnecting) ...[
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Theme.of(context)
                                  .colorScheme
                                  .errorContainer
                                  .withOpacity(0.3),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: Theme.of(context)
                                    .colorScheme
                                    .error
                                    .withOpacity(0.2),
                                width: 1,
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  Icons.error_outline,
                                  size: 20,
                                  color: Theme.of(context).colorScheme.error,
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    '연결 실패: ${_lastConnectionError!.length > 50 ? '${_lastConnectionError!.substring(0, 50)}...' : _lastConnectionError}',
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w500,
                                      color: Theme.of(context)
                                          .colorScheme
                                          .onErrorContainer,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 12),
                        ],
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                          children: [
                            Expanded(
                              child: FilledButton.icon(
                                onPressed: _isConnected || _isReconnecting
                                    ? null
                                    : _connect,
                                icon: Icon(
                                  _connectionType == ConnectionType.local
                                      ? Icons.computer
                                      : Icons.cloud,
                                  size: 18,
                                ),
                                label: Text(
                                  _connectionType == ConnectionType.local
                                      ? '연결'
                                      : (_sessionIdController.text
                                              .trim()
                                              .isEmpty
                                          ? '생성 & 연결'
                                          : '연결'),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            if (!_isConnected &&
                                _lastConnectionError != null) ...[
                              Expanded(
                                child: OutlinedButton.icon(
                                  onPressed:
                                      _isReconnecting ? null : _manualReconnect,
                                  icon: const Icon(Icons.refresh, size: 18),
                                  label: const Text('재연결'),
                                ),
                              ),
                              const SizedBox(width: 8),
                            ],
                            Expanded(
                              child: OutlinedButton(
                                onPressed: _isConnected ? _disconnect : null,
                                child: const Text('연결 해제'),
                              ),
                            ),
                          ],
                        ),
                        // 연결 상태 표시
                        if (_isConnected) ...[
                          const SizedBox(height: 12),
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Theme.of(context)
                                  .colorScheme
                                  .primaryContainer
                                  .withOpacity(0.3),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: Theme.of(context)
                                    .colorScheme
                                    .primary
                                    .withOpacity(0.2),
                                width: 1,
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  Icons.check_circle,
                                  size: 20,
                                  color: Theme.of(context).colorScheme.primary,
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        _connectionType == ConnectionType.local
                                            ? '로컬 서버에 연결됨'
                                            : '릴레이 서버에 연결됨',
                                        style: TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w600,
                                          color: Theme.of(context)
                                              .colorScheme
                                              .onSurface,
                                        ),
                                      ),
                                      if (_connectionType ==
                                              ConnectionType.relay &&
                                          _sessionId != null) ...[
                                        const SizedBox(height: 4),
                                        Row(
                                          children: [
                                            Expanded(
                                              child: Text(
                                                '세션 ID: $_sessionId',
                                                style: TextStyle(
                                                  fontSize: 12,
                                                  fontWeight: FontWeight.w500,
                                                  color: Theme.of(context)
                                                      .colorScheme
                                                      .onSurfaceVariant,
                                                  fontFamily: 'monospace',
                                                ),
                                              ),
                                            ),
                                            IconButton(
                                              icon: const Icon(Icons.copy,
                                                  size: 16),
                                              padding: EdgeInsets.zero,
                                              constraints:
                                                  const BoxConstraints(),
                                              onPressed: () {
                                                Clipboard.setData(ClipboardData(
                                                    text: _sessionId!));
                                                ScaffoldMessenger.of(context)
                                                    .showSnackBar(
                                                  const SnackBar(
                                                    content: Text(
                                                        '세션 ID가 클립보드에 복사되었습니다'),
                                                    duration:
                                                        Duration(seconds: 1),
                                                  ),
                                                );
                                              },
                                            ),
                                          ],
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ] else if (!_isConnected && !_isReconnecting) ...[
                          const SizedBox(height: 12),
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Theme.of(context)
                                  .colorScheme
                                  .surfaceContainerHighest
                                  .withOpacity(0.5),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: Theme.of(context)
                                    .colorScheme
                                    .outline
                                    .withOpacity(0.2),
                                width: 1,
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  Icons.cloud_off,
                                  size: 20,
                                  color: Theme.of(context)
                                      .colorScheme
                                      .onSurfaceVariant,
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    '연결되지 않음',
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w500,
                                      color: Theme.of(context)
                                          .colorScheme
                                          .onSurfaceVariant,
                                    ),
                                  ),
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
            ),
          ),
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
                            Row(
                              children: [
                                Icon(
                                  Icons.chat_bubble_outline,
                                  size: 20,
                                  color: Theme.of(context).colorScheme.primary,
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  '메시지',
                                  style: TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.w600,
                                    color:
                                        Theme.of(context).colorScheme.onSurface,
                                  ),
                                ),
                              ],
                            ),
                            // 메시지 개수 표시
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: Theme.of(context)
                                    .colorScheme
                                    .surfaceContainerHighest,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                '${_filteredMessages.length}/${_messages.length}',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500,
                                  color: Theme.of(context)
                                      .colorScheme
                                      .onSurfaceVariant,
                                ),
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
                                  Text('AI Response',
                                      style: TextStyle(fontSize: 12)),
                                ],
                              ),
                              selected:
                                  _activeFilters[MessageFilter.aiResponse] ??
                                      true,
                              selectedColor: Theme.of(context)
                                  .colorScheme
                                  .tertiaryContainer,
                              checkmarkColor:
                                  Theme.of(context).colorScheme.tertiary,
                              onSelected: (selected) {
                                setState(() {
                                  _activeFilters[MessageFilter.aiResponse] =
                                      selected;
                                });
                              },
                            ),
                            FilterChip(
                              label: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.person, size: 14),
                                  SizedBox(width: 4),
                                  Text('User Prompt',
                                      style: TextStyle(fontSize: 12)),
                                ],
                              ),
                              selected:
                                  _activeFilters[MessageFilter.userPrompt] ??
                                      true,
                              selectedColor: Theme.of(context)
                                  .colorScheme
                                  .secondaryContainer,
                              checkmarkColor:
                                  Theme.of(context).colorScheme.secondary,
                              onSelected: (selected) {
                                setState(() {
                                  _activeFilters[MessageFilter.userPrompt] =
                                      selected;
                                });
                              },
                            ),
                            FilterChip(
                              label: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.bug_report, size: 14),
                                  SizedBox(width: 4),
                                  Text('Logs', style: TextStyle(fontSize: 12)),
                                ],
                              ),
                              selected:
                                  _activeFilters[MessageFilter.log] ?? false,
                              selectedColor: const Color(0xFFFFF3E0), // 오렌지 배경
                              checkmarkColor: const Color(0xFFFF9800), // 오렌지
                              onSelected: (selected) {
                                setState(() {
                                  _activeFilters[MessageFilter.log] = selected;
                                  // 로그 필터 활성화 시 레벨 필터 모두 체크
                                  if (selected) {
                                    _logLevelFilters[LogLevel.error] = true;
                                    _logLevelFilters[LogLevel.warning] = true;
                                    _logLevelFilters[LogLevel.info] = true;
                                  }
                                });
                              },
                            ),
                            // 로그 레벨 필터 (로그 필터 활성화 시에만 표시)
                            if (_activeFilters[MessageFilter.log] ?? false) ...[
                              const SizedBox(width: 4),
                              Container(
                                height: 24,
                                width: 1,
                                color: Theme.of(context)
                                    .colorScheme
                                    .outlineVariant,
                              ),
                              const SizedBox(width: 4),
                              FilterChip(
                                label: const Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(Icons.error,
                                        size: 12, color: Color(0xFFDC3545)),
                                    SizedBox(width: 2),
                                    Text('Error',
                                        style: TextStyle(fontSize: 10)),
                                  ],
                                ),
                                visualDensity: VisualDensity.compact,
                                selected:
                                    _logLevelFilters[LogLevel.error] ?? true,
                                selectedColor: const Color(0xFFFFEBEE),
                                checkmarkColor: const Color(0xFFDC3545),
                                onSelected: (selected) {
                                  setState(() {
                                    _logLevelFilters[LogLevel.error] = selected;
                                  });
                                },
                              ),
                              FilterChip(
                                label: const Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(Icons.warning,
                                        size: 12, color: Color(0xFFFF9800)),
                                    SizedBox(width: 2),
                                    Text('Warn',
                                        style: TextStyle(fontSize: 10)),
                                  ],
                                ),
                                visualDensity: VisualDensity.compact,
                                selected:
                                    _logLevelFilters[LogLevel.warning] ?? true,
                                selectedColor: const Color(0xFFFFF3E0),
                                checkmarkColor: const Color(0xFFFF9800),
                                onSelected: (selected) {
                                  setState(() {
                                    _logLevelFilters[LogLevel.warning] =
                                        selected;
                                  });
                                },
                              ),
                              FilterChip(
                                label: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(Icons.info,
                                        size: 12,
                                        color: Theme.of(context)
                                            .colorScheme
                                            .tertiary),
                                    const SizedBox(width: 2),
                                    const Text('Info',
                                        style: TextStyle(fontSize: 10)),
                                  ],
                                ),
                                visualDensity: VisualDensity.compact,
                                selected:
                                    _logLevelFilters[LogLevel.info] ?? true,
                                selectedColor: Theme.of(context)
                                    .colorScheme
                                    .tertiaryContainer,
                                checkmarkColor:
                                    Theme.of(context).colorScheme.tertiary,
                                onSelected: (selected) {
                                  setState(() {
                                    _logLevelFilters[LogLevel.info] = selected;
                                  });
                                },
                              ),
                            ],
                            FilterChip(
                              label: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.info_outline, size: 14),
                                  SizedBox(width: 4),
                                  Text('System',
                                      style: TextStyle(fontSize: 12)),
                                ],
                              ),
                              selected:
                                  _activeFilters[MessageFilter.system] ?? true,
                              selectedColor: Theme.of(context)
                                  .colorScheme
                                  .surfaceContainerHighest,
                              checkmarkColor: Theme.of(context)
                                  .colorScheme
                                  .onSurfaceVariant,
                              onSelected: (selected) {
                                setState(() {
                                  _activeFilters[MessageFilter.system] =
                                      selected;
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
                                  _messages.isEmpty
                                      ? Icons.chat_bubble_outline
                                      : Icons.filter_alt,
                                  size: 64,
                                  color: Theme.of(context)
                                      .colorScheme
                                      .onSurfaceVariant
                                      .withOpacity(0.4),
                                ),
                                const SizedBox(height: 16),
                                Text(
                                  _messages.isEmpty
                                      ? '메시지가 없습니다'
                                      : '필터와 일치하는 메시지가 없습니다',
                                  style: TextStyle(
                                    color: Theme.of(context)
                                        .colorScheme
                                        .onSurfaceVariant,
                                    fontSize: 15,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                                if (_messages.isEmpty) ...[
                                  const SizedBox(height: 8),
                                  Text(
                                    '프롬프트를 입력하여 시작하세요',
                                    style: TextStyle(
                                      color: Theme.of(context)
                                          .colorScheme
                                          .onSurfaceVariant
                                          .withOpacity(0.7),
                                      fontSize: 13,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          )
                        : ListView.builder(
                            controller: _scrollController,
                            itemCount: _filteredMessages.length +
                                (_isWaitingForResponse ? 1 : 0),
                            padding: const EdgeInsets.symmetric(vertical: 4),
                            itemBuilder: (context, index) {
                              // 마지막에 로딩 메시지 추가
                              if (index == _filteredMessages.length &&
                                  _isWaitingForResponse) {
                                return Container(
                                  margin: const EdgeInsets.symmetric(
                                      horizontal: 8.0, vertical: 8.0),
                                  padding: const EdgeInsets.all(16.0),
                                  decoration: BoxDecoration(
                                    color: Theme.of(context)
                                        .colorScheme
                                        .surfaceContainerHighest
                                        .withOpacity(0.5),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      SizedBox(
                                        width: 20,
                                        height: 20,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                          valueColor:
                                              AlwaysStoppedAnimation<Color>(
                                            Theme.of(context)
                                                .colorScheme
                                                .primary,
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                      Text(
                                        '응답을 기다리는 중...',
                                        style: TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w500,
                                          color: Theme.of(context)
                                              .colorScheme
                                              .onSurfaceVariant,
                                        ),
                                      ),
                                    ],
                                  ),
                                );
                              }
                              final message = _filteredMessages[index];
                              return GestureDetector(
                                onLongPress: () {
                                  Clipboard.setData(
                                      ClipboardData(text: message.text));
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
                    // 에이전트 모드 선택
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color:
                                Theme.of(context).colorScheme.primaryContainer,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Icon(
                            Icons.smart_toy,
                            size: 18,
                            color: Theme.of(context)
                                .colorScheme
                                .onPrimaryContainer,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Text(
                          '에이전트 모드',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: Theme.of(context).colorScheme.onSurface,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 4),
                            decoration: BoxDecoration(
                              color: Theme.of(context)
                                  .colorScheme
                                  .surfaceContainerHighest,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: Theme.of(context)
                                    .colorScheme
                                    .outline
                                    .withOpacity(0.2),
                                width: 1,
                              ),
                            ),
                            child: DropdownButton<String>(
                              value: _selectedAgentMode,
                              isExpanded: true,
                              isDense: true,
                              underline: Container(),
                              style: TextStyle(
                                fontSize: 13,
                                color: Theme.of(context).colorScheme.onSurface,
                              ),
                              dropdownColor:
                                  Theme.of(context).colorScheme.surface,
                              icon: Icon(
                                Icons.arrow_drop_down,
                                color: Theme.of(context)
                                    .colorScheme
                                    .onSurfaceVariant,
                              ),
                              items: const [
                                DropdownMenuItem(
                                  value: 'auto',
                                  child: Row(
                                    children: [
                                      Icon(Icons.auto_awesome, size: 16),
                                      SizedBox(width: 4),
                                      Text('Auto (자동 선택)',
                                          style: TextStyle(fontSize: 12)),
                                    ],
                                  ),
                                ),
                                DropdownMenuItem(
                                  value: 'agent',
                                  child: Row(
                                    children: [
                                      Icon(Icons.code, size: 16),
                                      SizedBox(width: 4),
                                      Text('Agent (코딩 작업)',
                                          style: TextStyle(fontSize: 12)),
                                    ],
                                  ),
                                ),
                                DropdownMenuItem(
                                  value: 'ask',
                                  child: Row(
                                    children: [
                                      Icon(Icons.help_outline, size: 16),
                                      SizedBox(width: 4),
                                      Text('Ask (질문/학습)',
                                          style: TextStyle(fontSize: 12)),
                                    ],
                                  ),
                                ),
                                DropdownMenuItem(
                                  value: 'plan',
                                  child: Row(
                                    children: [
                                      Icon(Icons.assignment, size: 16),
                                      SizedBox(width: 4),
                                      Text('Plan (계획 수립)',
                                          style: TextStyle(fontSize: 12)),
                                    ],
                                  ),
                                ),
                                DropdownMenuItem(
                                  value: 'debug',
                                  child: Row(
                                    children: [
                                      Icon(Icons.bug_report, size: 16),
                                      SizedBox(width: 4),
                                      Text('Debug (버그 수정)',
                                          style: TextStyle(fontSize: 12)),
                                    ],
                                  ),
                                ),
                              ],
                              onChanged: (value) {
                                if (value != null) {
                                  setState(() {
                                    _selectedAgentMode = value;
                                    // 사용자가 직접 모드를 선택하면 실제 모드 표시 초기화
                                    if (value != 'auto') {
                                      _actualSelectedMode = null;
                                    }
                                  });
                                }
                              },
                            ),
                          ),
                        ),
                      ],
                    ),
                    // 자동 모드로 선택된 경우 실제 모드 표시
                    if (_selectedAgentMode == 'auto' &&
                        _actualSelectedMode != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 8.0, left: 42.0),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: Theme.of(context)
                                .colorScheme
                                .primaryContainer
                                .withOpacity(0.3),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.info_outline,
                                size: 14,
                                color: Theme.of(context).colorScheme.primary,
                              ),
                              const SizedBox(width: 6),
                              Text(
                                '실제 모드: ${_getModeDisplayName(_actualSelectedMode!)}',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500,
                                  color: Theme.of(context)
                                      .colorScheme
                                      .onPrimaryContainer,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    const SizedBox(height: 8),
                    // KeyboardListener: Enter 전송. 컨트롤러에서 읽고 debounce + 전송 후 한 프레임 뒤 재정리로 IME 중복 전송 방지.
                    // (Focus+동일 FocusNode는 focus_manager assertion 유발로 사용 안 함)
                    KeyboardListener(
                      focusNode: FocusNode(),
                      onKeyEvent: (event) {
                        if (event is! KeyDownEvent ||
                            event.logicalKey != LogicalKeyboardKey.enter ||
                            HardwareKeyboard.instance.isShiftPressed ||
                            !_commandFocusNode.hasFocus ||
                            !_isConnected) {
                          return;
                        }
                        final now = DateTime.now();
                        if (_lastPromptSubmitTime != null &&
                            now
                                    .difference(_lastPromptSubmitTime!)
                                    .inMilliseconds <
                                400) {
                          return;
                        }
                        final text = _commandController.text.trim();
                        if (text.isEmpty) return;
                        _lastPromptSubmitTime = now;
                        _sendCommand('insert_text',
                            text: text,
                            prompt: true,
                            execute: true,
                            newSession: false,
                            agentMode: _selectedAgentMode);
                        _clearCommandInput();
                      },
                      // ValueListenableBuilder로 입력창 감싸기 (전체 UI 리빌드 방지)
                      child: ValueListenableBuilder<TextEditingValue>(
                        valueListenable: _commandController,
                        builder: (context, textValue, child) {
                          final hasText = textValue.text.trim().isNotEmpty;
                          return TextField(
                            key: ValueKey(_textFieldKey),
                            controller: _commandController,
                            focusNode: _commandFocusNode,
                            decoration: InputDecoration(
                              labelText: '프롬프트 입력',
                              hintText: 'Cursor에게 요청할 내용을 입력하세요...',
                              prefixIcon: const Icon(Icons.edit_note),
                              suffixIcon: hasText
                                  ? IconButton(
                                      icon: Icon(
                                        Icons.clear,
                                        size: 20,
                                        color: Theme.of(context)
                                            .colorScheme
                                            .onSurfaceVariant,
                                      ),
                                      onPressed: _clearCommandInput,
                                    )
                                  : null,
                            ),
                            textInputAction: TextInputAction.newline,
                            keyboardType: TextInputType.multiline,
                            maxLines: 3,
                            minLines: 2,
                            enableSuggestions: true,
                            autocorrect: true,
                            textCapitalization: TextCapitalization.none,
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: 12),
                    // 버튼 영역도 ValueListenableBuilder로 감싸기
                    ValueListenableBuilder<TextEditingValue>(
                      valueListenable: _commandController,
                      builder: (context, textValue, child) {
                        final hasText = textValue.text.trim().isNotEmpty;
                        return Row(
                          children: [
                            Expanded(
                              child: FilledButton.icon(
                                onPressed: _isConnected &&
                                        hasText &&
                                        !_isWaitingForResponse
                                    ? () {
                                        if (!mounted) return;
                                        final text =
                                            _commandController.text.trim();
                                        if (text.isNotEmpty) {
                                          _sendCommand('insert_text',
                                              text: text,
                                              prompt: true,
                                              execute: true,
                                              newSession: false,
                                              agentMode: _selectedAgentMode);
                                          _clearCommandInput();
                                        }
                                      }
                                    : null,
                                icon: _isWaitingForResponse
                                    ? SizedBox(
                                        width: 16,
                                        height: 16,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                          valueColor:
                                              AlwaysStoppedAnimation<Color>(
                                            Theme.of(context)
                                                .colorScheme
                                                .onPrimary,
                                          ),
                                        ),
                                      )
                                    : const Icon(Icons.send, size: 18),
                                label: Text(
                                    _isWaitingForResponse ? '전송 중...' : '전송'),
                                style: FilledButton.styleFrom(
                                  padding:
                                      const EdgeInsets.symmetric(vertical: 14),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            if (_isWaitingForResponse) ...[
                              OutlinedButton.icon(
                                onPressed: _isConnected
                                    ? () {
                                        if (!mounted) return;
                                        setState(() {
                                          _isWaitingForResponse = false;
                                        });
                                        _sendCommand('stop_prompt');
                                      }
                                    : null,
                                icon: const Icon(Icons.stop, size: 18),
                                label: const Text('중지'),
                                style: OutlinedButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(
                                      vertical: 14, horizontal: 16),
                                ),
                              ),
                            ] else ...[
                              OutlinedButton.icon(
                                onPressed: _isConnected && hasText
                                    ? () {
                                        if (!mounted) return;
                                        final text =
                                            _commandController.text.trim();
                                        if (text.isNotEmpty) {
                                          _sendCommand('insert_text',
                                              text: text,
                                              prompt: true,
                                              execute: true,
                                              newSession: true,
                                              agentMode: _selectedAgentMode);
                                          _clearCommandInput();
                                        }
                                      }
                                    : null,
                                icon: const Icon(Icons.refresh, size: 18),
                                label: const Text('새 대화'),
                                style: OutlinedButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(
                                      vertical: 14, horizontal: 16),
                                ),
                              ),
                            ],
                          ],
                        );
                      },
                    ),
                    const SizedBox(height: 8),
                    // 세션 정보 및 대화 히스토리 표시 (설정에서 활성화한 경우만)
                    if (_isConnected && AppSettings().showHistory) ...[
                      // 현재 세션 정보
                      if (_currentCursorSessionId != null)
                        Container(
                          padding: const EdgeInsets.all(12.0),
                          margin: const EdgeInsets.only(bottom: 8.0),
                          decoration: BoxDecoration(
                            color: Theme.of(context)
                                .colorScheme
                                .primaryContainer
                                .withOpacity(0.3),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: Theme.of(context)
                                  .colorScheme
                                  .primary
                                  .withOpacity(0.2),
                              width: 1,
                            ),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                Icons.chat_bubble_outline,
                                size: 18,
                                color: Theme.of(context).colorScheme.primary,
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  '현재 세션: ${_currentCursorSessionId!.substring(0, 8)}...',
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w500,
                                    color:
                                        Theme.of(context).colorScheme.onSurface,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),

                      // 세션 목록 및 대화 히스토리
                      Container(
                        margin: const EdgeInsets.only(top: 8.0),
                        child: Card(
                          child: ExpansionTile(
                            title: Text(
                              '세션 및 대화 히스토리',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                                color: Theme.of(context).colorScheme.onSurface,
                              ),
                            ),
                            leading: Container(
                              padding: const EdgeInsets.all(6),
                              decoration: BoxDecoration(
                                color: Theme.of(context)
                                    .colorScheme
                                    .secondaryContainer,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Icon(
                                Icons.history,
                                size: 18,
                                color: Theme.of(context)
                                    .colorScheme
                                    .onSecondaryContainer,
                              ),
                            ),
                            children: [
                              // 세션 목록
                              if (_availableSessions.isNotEmpty) ...[
                                Padding(
                                  padding: const EdgeInsets.all(12.0),
                                  child: Text(
                                    '사용 가능한 세션',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 13,
                                      color: Theme.of(context)
                                          .colorScheme
                                          .onSurface,
                                    ),
                                  ),
                                ),
                                ..._availableSessions.map((sessionId) =>
                                    ListTile(
                                      dense: true,
                                      leading: const Icon(Icons.chat, size: 16),
                                      title: Text(
                                        sessionId.length > 20
                                            ? '${sessionId.substring(0, 20)}...'
                                            : sessionId,
                                        style: const TextStyle(fontSize: 12),
                                      ),
                                      trailing: IconButton(
                                        icon:
                                            const Icon(Icons.refresh, size: 16),
                                        onPressed: () => _loadChatHistory(
                                            sessionId: sessionId),
                                        tooltip: '이 세션의 대화 히스토리 조회',
                                      ),
                                    )),
                                const Divider(),
                              ],

                              // 대화 히스토리
                              if (_chatHistory.isNotEmpty) ...[
                                Padding(
                                  padding: const EdgeInsets.all(12.0),
                                  child: Text(
                                    '대화 히스토리',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 13,
                                      color: Theme.of(context)
                                          .colorScheme
                                          .onSurface,
                                    ),
                                  ),
                                ),
                                SizedBox(
                                  height: 200,
                                  child: ListView.builder(
                                    shrinkWrap: true,
                                    itemCount: _chatHistory.length,
                                    itemBuilder: (context, index) {
                                      final entry = _chatHistory[index];
                                      final userMsg =
                                          entry['userMessage'] as String? ?? '';
                                      final assistantMsg =
                                          entry['assistantResponse']
                                                  as String? ??
                                              '';
                                      final timestamp =
                                          entry['timestamp'] as String? ?? '';
                                      final agentMode =
                                          entry['agentMode'] as String?;

                                      // 디버깅: 모든 항목 로그 출력 (문제 확인용)
                                      print(
                                          '📋 History entry[$index] - agentMode: $agentMode, userMsg: ${userMsg.length > 20 ? '${userMsg.substring(0, 20)}...' : userMsg}');
                                      print(
                                          '📋 Full entry keys: ${entry.keys.toList()}');

                                      return Card(
                                        margin: const EdgeInsets.symmetric(
                                            horizontal: 8.0, vertical: 4.0),
                                        elevation: 0,
                                        shape: RoundedRectangleBorder(
                                          borderRadius:
                                              BorderRadius.circular(12),
                                          side: BorderSide(
                                            color: Theme.of(context)
                                                .colorScheme
                                                .outline
                                                .withOpacity(0.1),
                                            width: 1,
                                          ),
                                        ),
                                        child: Padding(
                                          padding: const EdgeInsets.all(12.0),
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              if (userMsg.isNotEmpty)
                                                Padding(
                                                  padding:
                                                      const EdgeInsets.only(
                                                          bottom: 4.0),
                                                  child: Row(
                                                    crossAxisAlignment:
                                                        CrossAxisAlignment
                                                            .start,
                                                    children: [
                                                      Expanded(
                                                        child: Text(
                                                          '👤 $userMsg',
                                                          style: const TextStyle(
                                                              fontSize: 11,
                                                              fontWeight:
                                                                  FontWeight
                                                                      .bold),
                                                        ),
                                                      ),
                                                      // 에이전트 모드 표시 (null이 아니고 비어있지 않은 경우, auto도 표시)
                                                      if (agentMode != null &&
                                                          agentMode
                                                              .isNotEmpty) ...[
                                                        const SizedBox(
                                                            width: 4),
                                                        Container(
                                                          padding:
                                                              const EdgeInsets
                                                                  .symmetric(
                                                                  horizontal: 6,
                                                                  vertical: 3),
                                                          decoration:
                                                              BoxDecoration(
                                                            color: Theme.of(
                                                                    context)
                                                                .colorScheme
                                                                .primaryContainer,
                                                            borderRadius:
                                                                BorderRadius
                                                                    .circular(
                                                                        8),
                                                            border: Border.all(
                                                              color: Theme.of(
                                                                      context)
                                                                  .colorScheme
                                                                  .primary
                                                                  .withOpacity(
                                                                      0.3),
                                                              width: 1,
                                                            ),
                                                          ),
                                                          child: Row(
                                                            mainAxisSize:
                                                                MainAxisSize
                                                                    .min,
                                                            children: [
                                                              Icon(
                                                                _getModeIcon(
                                                                    agentMode),
                                                                size: 12,
                                                                color: Theme.of(
                                                                        context)
                                                                    .colorScheme
                                                                    .onPrimaryContainer,
                                                              ),
                                                              const SizedBox(
                                                                  width: 4),
                                                              Text(
                                                                _getModeDisplayName(
                                                                    agentMode),
                                                                style:
                                                                    TextStyle(
                                                                  fontSize: 10,
                                                                  fontWeight:
                                                                      FontWeight
                                                                          .w600,
                                                                  color: Theme.of(
                                                                          context)
                                                                      .colorScheme
                                                                      .onPrimaryContainer,
                                                                ),
                                                              ),
                                                            ],
                                                          ),
                                                        ),
                                                      ],
                                                    ],
                                                  ),
                                                ),
                                              if (assistantMsg.isNotEmpty)
                                                Padding(
                                                  padding:
                                                      const EdgeInsets.only(
                                                          bottom: 4.0),
                                                  child: Text(
                                                    '🤖 ${assistantMsg.length > 50 ? "${assistantMsg.substring(0, 50)}..." : assistantMsg}',
                                                    style: const TextStyle(
                                                        fontSize: 11),
                                                  ),
                                                ),
                                              if (timestamp.isNotEmpty)
                                                Text(
                                                  _formatTime(DateTime.parse(
                                                      timestamp)),
                                                  style: TextStyle(
                                                    fontSize: 9,
                                                    color: Theme.of(context)
                                                        .colorScheme
                                                        .onSurfaceVariant,
                                                  ),
                                                ),
                                            ],
                                          ),
                                        ),
                                      );
                                    },
                                  ),
                                ),
                              ] else ...[
                                Padding(
                                  padding: const EdgeInsets.all(24.0),
                                  child: Column(
                                    children: [
                                      Icon(
                                        Icons.history,
                                        size: 48,
                                        color: Theme.of(context)
                                            .colorScheme
                                            .onSurfaceVariant
                                            .withOpacity(0.4),
                                      ),
                                      const SizedBox(height: 12),
                                      Text(
                                        '대화 히스토리가 없습니다',
                                        style: TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w500,
                                          color: Theme.of(context)
                                              .colorScheme
                                              .onSurfaceVariant,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],

                              // 새로고침 버튼
                              Padding(
                                padding: const EdgeInsets.all(12.0),
                                child: OutlinedButton.icon(
                                  onPressed: () {
                                    _loadSessionInfo();
                                    _loadChatHistory();
                                  },
                                  icon: const Icon(Icons.refresh, size: 18),
                                  label: const Text('새로고침'),
                                  style: OutlinedButton.styleFrom(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 20, vertical: 12),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
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

// ============================================================
// 설정 화면
// ============================================================
class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  final AppSettings _settings = AppSettings();

  @override
  void initState() {
    super.initState();
    _settings.addListener(_onSettingsChanged);
  }

  @override
  void dispose() {
    _settings.removeListener(_onSettingsChanged);
    super.dispose();
  }

  void _onSettingsChanged() {
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          '설정',
          style: TextStyle(fontWeight: FontWeight.w600),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: ListView(
        children: [
          // 외관 섹션
          _buildSectionHeader('외관'),
          _buildThemeModeTile(),
          const Divider(),

          // 기능 섹션
          _buildSectionHeader('기능'),
          _buildShowHistoryTile(),
          const Divider(),

          // 정보 섹션
          _buildSectionHeader('정보'),
          _buildAboutTile(),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Text(
        title,
        style: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: Theme.of(context).colorScheme.primary,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  Widget _buildThemeModeTile() {
    return ListTile(
      leading: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.primaryContainer,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(
          _getThemeIcon(_settings.themeMode),
          color: Theme.of(context).colorScheme.onPrimaryContainer,
          size: 20,
        ),
      ),
      title: const Text('테마'),
      subtitle: Text(_getThemeModeLabel(_settings.themeMode)),
      trailing: const Icon(Icons.chevron_right),
      onTap: () => _showThemeModeDialog(),
    );
  }

  IconData _getThemeIcon(ThemeModeSetting mode) {
    switch (mode) {
      case ThemeModeSetting.light:
        return Icons.light_mode;
      case ThemeModeSetting.dark:
        return Icons.dark_mode;
      case ThemeModeSetting.system:
        return Icons.brightness_auto;
    }
  }

  String _getThemeModeLabel(ThemeModeSetting mode) {
    switch (mode) {
      case ThemeModeSetting.light:
        return '라이트 모드';
      case ThemeModeSetting.dark:
        return '다크 모드';
      case ThemeModeSetting.system:
        return '시스템 설정';
    }
  }

  void _showThemeModeDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('테마 선택'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: ThemeModeSetting.values.map((mode) {
            return RadioListTile<ThemeModeSetting>(
              title: Row(
                children: [
                  Icon(_getThemeIcon(mode), size: 20),
                  const SizedBox(width: 12),
                  Text(_getThemeModeLabel(mode)),
                ],
              ),
              value: mode,
              groupValue: _settings.themeMode,
              onChanged: (value) {
                if (value != null) {
                  _settings.setThemeMode(value);
                  Navigator.of(context).pop();
                }
              },
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildShowHistoryTile() {
    return SwitchListTile(
      secondary: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.secondaryContainer,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(
          Icons.history,
          color: Theme.of(context).colorScheme.onSecondaryContainer,
          size: 20,
        ),
      ),
      title: const Text('세션 및 대화 히스토리'),
      subtitle: const Text('메인 화면에 히스토리 섹션 표시'),
      value: _settings.showHistory,
      onChanged: (value) => _settings.setShowHistory(value),
    );
  }

  Widget _buildAboutTile() {
    return ListTile(
      leading: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(
          Icons.info_outline,
          color: Theme.of(context).colorScheme.onSurfaceVariant,
          size: 20,
        ),
      ),
      title: const Text('Cursor Remote'),
      subtitle: const Text('버전 0.1.0'),
      onTap: () => _showAboutDialog(),
    );
  }

  void _showAboutDialog() {
    showAboutDialog(
      context: context,
      applicationName: 'Cursor Remote',
      applicationVersion: '0.1.0',
      applicationIcon: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.primaryContainer,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(
          Icons.code,
          size: 32,
          color: Theme.of(context).colorScheme.onPrimaryContainer,
        ),
      ),
      children: [
        const SizedBox(height: 16),
        const Text(
          '모바일에서 Cursor AI를 원격으로 제어하세요.',
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(
          '© 2026 jaloveeye',
          style: TextStyle(
            fontSize: 12,
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}
