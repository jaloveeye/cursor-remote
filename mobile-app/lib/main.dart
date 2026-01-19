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

class _HomePageState extends State<HomePage> with WidgetsBindingObserver {
  WebSocketChannel? _channel;
  String _serverAddress = '';
  bool _isConnected = false;
  final List<String> _messages = [];
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
          setState(() {
            try {
              final json = message.toString();
              _messages.add('Received: $json');
              
              // JSON 파싱 시도
              final decoded = jsonDecode(json);
              if (decoded is Map) {
                final type = decoded['type'];
                if (type == 'command_result') {
                  if (decoded['success'] == true) {
                    _messages.add('✅ Command succeeded');
                  } else {
                    _messages.add('❌ Command failed: ${decoded['error']}');
                  }
                } else if (type == 'connected') {
                  _messages.add('✅ ${decoded['message']}');
                } else if (type == 'error') {
                  _messages.add('❌ Error: ${decoded['message']}');
                }
              }
            } catch (e) {
              _messages.add('Received: $message');
            }
          });
          // 새 메시지 추가 후 자동으로 맨 아래로 스크롤
          _scrollToBottom();
        },
        onError: (error) {
          setState(() {
            _isConnected = false;
            _messages.add('Error: $error');
          });
        },
        onDone: () {
          setState(() {
            _isConnected = false;
            _messages.add('Connection closed');
          });
        },
      );

      setState(() {
        _isConnected = true;
        _messages.add('Connected to $_serverAddress:8767');
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Connection error: $e')),
      );
    }
  }

  void _disconnect() {
    _channel?.sink.close();
    setState(() {
      _isConnected = false;
      _messages.add('Disconnected');
    });
  }

  void _sendCommand(String type, {String? text, String? command, List<dynamic>? args, bool? prompt, bool? execute, String? action}) {
    if (_channel == null || !_isConnected) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Not connected')),
      );
      return;
    }

    final message = {
      'type': type,
      'id': DateTime.now().millisecondsSinceEpoch.toString(),
      if (text != null) 'text': text,
      if (command != null) 'command': command,
      if (args != null) 'args': args,
      if (prompt != null) 'prompt': prompt,
      if (execute != null) 'execute': execute,
      if (action != null) 'action': action,
    };

    _channel!.sink.add(jsonEncode(message));
    setState(() {
      _messages.add('Sent: ${message.toString()}');
    });
    // 새 메시지 추가 후 자동으로 맨 아래로 스크롤
    _scrollToBottom();
  }

  void _scrollToBottom() {
    // 다음 프레임에서 스크롤 (위젯이 빌드된 후)
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  void dispose() {
    _channel?.sink.close();
    _commandController.dispose();
    _serverAddressController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        title: const Text('Cursor Remote'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            // 연결 섹션
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  children: [
                    TextField(
                      controller: _serverAddressController,
                      decoration: const InputDecoration(
                        labelText: 'Server Address',
                        hintText: '192.168.0.10',
                        border: OutlineInputBorder(),
                      ),
                      enabled: !_isConnected,
                      keyboardType: TextInputType.number,
                      onChanged: (value) {
                        setState(() {
                          _serverAddress = value;
                        });
                      },
                    ),
                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: [
                        ElevatedButton(
                          onPressed: _isConnected ? null : _connect,
                          child: const Text('Connect'),
                        ),
                        ElevatedButton(
                          onPressed: _isConnected ? _disconnect : null,
                          child: const Text('Disconnect'),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          _isConnected ? Icons.cloud_done : Icons.cloud_off,
                          color: _isConnected ? Colors.green : Colors.grey,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          _isConnected ? 'Connected' : 'Disconnected',
                          style: TextStyle(
                            color: _isConnected ? Colors.green : Colors.grey,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            // 명령 입력 섹션
            if (_isConnected) ...[
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      TextField(
                        controller: _commandController,
                        decoration: const InputDecoration(
                          labelText: 'Command',
                          border: OutlineInputBorder(),
                        ),
                        textInputAction: TextInputAction.newline,
                        keyboardType: TextInputType.multiline,
                        maxLines: null,
                        minLines: 3,
                        enableSuggestions: true,
                        autocorrect: true,
                      ),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                        children: [
                          Expanded(
                            child: ElevatedButton(
                              onPressed: () {
                                final text = _commandController.text;
                                if (text.isNotEmpty) {
                                  _sendCommand('insert_text', text: text, prompt: true, execute: true);
                                  _commandController.clear();
                                }
                              },
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.green,
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(vertical: 16),
                              ),
                              child: const Text('Execute Prompt'),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: ElevatedButton(
                              onPressed: () {
                                _sendCommand('stop_prompt');
                              },
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.red,
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(vertical: 16),
                              ),
                              child: const Text('Stop Prompt'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
            const SizedBox(height: 16),
            // 메시지 로그
            Expanded(
              child: Card(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Padding(
                      padding: EdgeInsets.all(16.0),
                      child: Text(
                        'Messages',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    Expanded(
                      child: ListView.builder(
                        controller: _scrollController,
                        itemCount: _messages.length,
                        itemBuilder: (context, index) {
                          return GestureDetector(
                            onLongPress: () {
                              Clipboard.setData(ClipboardData(text: _messages[index]));
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('메시지가 클립보드에 복사되었습니다'),
                                  duration: Duration(seconds: 1),
                                ),
                              );
                            },
                            child: ListTile(
                              title: Text(
                                _messages[index],
                                style: const TextStyle(fontSize: 14),
                              ),
                              dense: true,
                              contentPadding: const EdgeInsets.symmetric(
                                horizontal: 16.0,
                                vertical: 4.0,
                              ),
                              trailing: IconButton(
                                icon: const Icon(Icons.copy, size: 18),
                                onPressed: () {
                                  Clipboard.setData(ClipboardData(text: _messages[index]));
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text('메시지가 클립보드에 복사되었습니다'),
                                      duration: Duration(seconds: 1),
                                    ),
                                  );
                                },
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
