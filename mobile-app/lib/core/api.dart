import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

/// A request that did not succeed, with a message the user can read.
class ApiException implements Exception {
  ApiException(this.message, {this.status, this.code});
  final String message;
  final int? status;
  final String? code;

  bool get unauthorized => status == 401;

  @override
  String toString() => message;
}

/// JSON over HTTP with the signed-in user's token. Every failure becomes an
/// [ApiException] in Vietnamese; a rejected token is reported once through
/// [onUnauthorized] so the app can return to the sign-in screen.
class ApiClient {
  ApiClient(this.base, {this.onUnauthorized});

  final Uri base;
  void Function()? onUnauthorized;
  String? token;
  final http.Client _http = http.Client();

  Uri _uri(String path, [Map<String, String>? query]) {
    final full = base.replace(path: base.path + path, queryParameters: query);
    return full;
  }

  Map<String, String> get _headers => {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-PhysLive-Client': 'android',
        if (token != null) 'Authorization': 'Bearer $token',
      };

  Future<dynamic> get(String path, {Map<String, String>? query, Duration timeout = const Duration(seconds: 20)}) =>
      _send(() => _http.get(_uri(path, query), headers: _headers), timeout);

  Future<dynamic> post(String path, [Object? body, Duration timeout = const Duration(seconds: 30)]) =>
      _send(() => _http.post(_uri(path), headers: _headers, body: body == null ? null : jsonEncode(body)), timeout);

  Future<dynamic> put(String path, [Object? body]) =>
      _send(() => _http.put(_uri(path), headers: _headers, body: body == null ? null : jsonEncode(body)),
          const Duration(seconds: 30));

  Future<dynamic> _send(Future<http.Response> Function() request, Duration timeout) async {
    final sentWith = token;
    http.Response response;
    try {
      response = await request().timeout(timeout);
    } on TimeoutException {
      throw ApiException('Máy chủ phản hồi quá lâu. Hãy thử lại.');
    } on SocketException {
      throw ApiException('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.');
    } on http.ClientException {
      throw ApiException('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.');
    }
    final text = utf8.decode(response.bodyBytes);
    dynamic data;
    if (text.isNotEmpty) {
      try {
        data = jsonDecode(text);
      } on FormatException {
        data = null;
      }
    }
    if (response.statusCode >= 200 && response.statusCode < 300) return data;
    final status = response.statusCode;
    if (status == 401 && sentWith != null && sentWith == token) onUnauthorized?.call();
    final serverMessage = data is Map ? (data['message'] ?? data['error'])?.toString() : null;
    final code = data is Map ? data['code']?.toString() : null;
    throw ApiException(_message(status, serverMessage), status: status, code: code);
  }

  static String _message(int status, String? server) {
    if (server != null && server.trim().isNotEmpty && status < 500) return server.trim();
    return switch (status) {
      401 => 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.',
      403 => 'Tài khoản không có quyền thực hiện thao tác này.',
      404 => 'Không tìm thấy dữ liệu.',
      429 => 'Bạn thao tác quá nhanh. Hãy thử lại sau giây lát.',
      _ when status >= 500 => 'Máy chủ đang gặp sự cố. Hãy thử lại sau.',
      _ => 'Yêu cầu không thành công ($status).',
    };
  }
}
