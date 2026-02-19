import 'dart:convert';

enum ConnectionType {
  local, // 로컬 서버 (IP 주소 직접 연결)
  relay, // 릴레이 서버 (세션 ID 사용)
}

class ConnectionHistoryItem {
  final ConnectionType type;
  final String? ip; // 로컬 모드일 때
  final int? port; // 로컬 모드일 때
  final String? sessionId; // 릴레이 모드일 때
  final DateTime timestamp;

  ConnectionHistoryItem({
    required this.type,
    this.ip,
    this.port,
    this.sessionId,
    required this.timestamp,
  });

  // JSON 직렬화
  Map<String, dynamic> toJson() => {
        'type': type.index,
        'ip': ip,
        'port': port,
        'sessionId': sessionId,
        'timestamp': timestamp.toIso8601String(),
      };

  // JSON 역직렬화
  factory ConnectionHistoryItem.fromJson(Map<String, dynamic> json) {
    return ConnectionHistoryItem(
      type: ConnectionType.values[json['type'] as int],
      ip: json['ip'] as String?,
      port: json['port'] is int
          ? json['port'] as int
          : int.tryParse('${json['port'] ?? ''}'),
      sessionId: json['sessionId'] as String?,
      timestamp: DateTime.parse(json['timestamp'] as String),
    );
  }

  // 동일 연결인지 확인 (타입과 주소/세션ID가 같으면 동일)
  bool isSameConnection(ConnectionHistoryItem other) {
    if (type != other.type) return false;
    if (type == ConnectionType.local) {
      return ip == other.ip && port == other.port;
    } else {
      return sessionId == other.sessionId;
    }
  }

  // 표시용 문자열
  String get displayText {
    if (type == ConnectionType.local) {
      final localIp = ip ?? 'Unknown IP';
      return port != null ? '$localIp:$port' : localIp;
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

List<ConnectionHistoryItem> parseConnectionHistory(String historyJson) {
  try {
    final historyList = jsonDecode(historyJson) as List;
    return historyList
        .map((item) => ConnectionHistoryItem.fromJson(item as Map<String, dynamic>))
        .toList();
  } catch (_) {
    return [];
  }
}
