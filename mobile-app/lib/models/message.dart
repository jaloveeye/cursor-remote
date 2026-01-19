class Message {
  final String type;
  final Map<String, dynamic>? data;
  final String? id;
  final bool? success;
  final String? error;

  Message({
    required this.type,
    this.data,
    this.id,
    this.success,
    this.error,
  });

  factory Message.fromJson(Map<String, dynamic> json) {
    return Message(
      type: json['type'] as String,
      data: json['data'] as Map<String, dynamic>?,
      id: json['id'] as String?,
      success: json['success'] as bool?,
      error: json['error'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'type': type,
      if (data != null) 'data': data,
      if (id != null) 'id': id,
      if (success != null) 'success': success,
      if (error != null) 'error': error,
    };
  }
}
