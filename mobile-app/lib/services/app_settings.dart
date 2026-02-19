import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/connection_models.dart';

enum ThemeModeSetting {
  light,
  dark,
  system,
}

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

  // 최대 히스토리 개수
  static const int _maxHistoryCount = 5;

  // 현재 설정값
  ThemeModeSetting _themeMode = ThemeModeSetting.system;
  bool _showHistory = false; // 기본값: 숨김
  String _defaultAgentMode = 'auto';
  bool _autoConnect = false;
  List<ConnectionHistoryItem> _connectionHistory = [];

  // getters
  ThemeModeSetting get themeMode => _themeMode;
  bool get showHistory => _showHistory;
  String get defaultAgentMode => _defaultAgentMode;
  bool get autoConnect => _autoConnect;
  List<ConnectionHistoryItem> get connectionHistory =>
      List.unmodifiable(_connectionHistory);

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

    // 테마
    final themeModeIndex = prefs.getInt(_keyThemeMode) ?? 2; // system default
    _themeMode = ThemeModeSetting.values[themeModeIndex.clamp(0, 2)];

    // 히스토리 표시
    _showHistory = prefs.getBool(_keyShowHistory) ?? false;

    // 기본 에이전트 모드
    _defaultAgentMode = prefs.getString(_keyDefaultAgentMode) ?? 'auto';

    // 자동 연결
    _autoConnect = prefs.getBool(_keyAutoConnect) ?? false;

    // 연결 히스토리
    final historyJson = prefs.getString(_keyConnectionHistory);
    if (historyJson != null && historyJson.isNotEmpty) {
      _connectionHistory = parseConnectionHistory(historyJson);
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
