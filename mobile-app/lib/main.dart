import 'package:flutter/material.dart';
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

class _HomePageState extends State<HomePage> {
  WebSocketChannel? _channel;
  String _serverAddress = '';
  bool _isConnected = false;
  final List<String> _messages = [];
  final TextEditingController _commandController = TextEditingController();

  void _connect() {
    if (_serverAddress.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('서버 주소를 입력하세요')),
      );
      return;
    }

    try {
      final uri = Uri.parse('ws://$_serverAddress:8766');
      _channel = WebSocketChannel.connect(uri);

      _channel!.stream.listen(
        (message) {
          setState(() {
            _messages.add('Received: $message');
          });
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
        _messages.add('Connected to $_serverAddress:8766');
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

  void _sendCommand(String type, {String? text, String? command}) {
    if (_channel == null || !_isConnected) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Not connected')),
      );
      return;
    }

    final message = {
      'type': type,
      if (text != null) 'text': text,
      if (command != null) 'command': command,
    };

    _channel!.sink.add(message.toString());
    setState(() {
      _messages.add('Sent: ${message.toString()}');
    });
  }

  @override
  void dispose() {
    _channel?.sink.close();
    _commandController.dispose();
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
                      decoration: const InputDecoration(
                        labelText: 'Server Address',
                        hintText: '192.168.0.10',
                        border: OutlineInputBorder(),
                      ),
                      enabled: !_isConnected,
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
                      ),
                      const SizedBox(height: 8),
                      ElevatedButton(
                        onPressed: () {
                          final text = _commandController.text;
                          if (text.isNotEmpty) {
                            _sendCommand('insert_text', text: text);
                            _commandController.clear();
                          }
                        },
                        child: const Text('Send Text'),
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
                        itemCount: _messages.length,
                        itemBuilder: (context, index) {
                          return ListTile(
                            title: Text(_messages[index]),
                            dense: true,
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
