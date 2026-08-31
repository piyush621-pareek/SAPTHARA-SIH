import 'dart:convert';
import 'package:http/http.dart' as http;
import 'api_config.dart';

class ApiException implements Exception {
  final int statusCode;
  final String message;
  ApiException(this.statusCode, this.message);
  @override
  String toString() => 'ApiException($statusCode): $message';
}

/// Thin HTTP client for the NER backend. Short timeouts so the offline-first UI
/// fails fast and falls back to cached data / the outbox.
class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  final http.Client _client = http.Client();
  static const Duration _timeout = Duration(seconds: 8);

  String? _authToken;

  /// Sets/clears the bearer token attached to every subsequent request.
  void setAuthToken(String? token) => _authToken = token;
  bool get hasAuth => _authToken != null;

  Map<String, String> _headers([bool json = false]) => {
        if (json) 'content-type': 'application/json',
        if (_authToken != null) 'authorization': 'Bearer $_authToken',
      };

  Future<dynamic> getJson(String path, {Map<String, String>? query}) async {
    final uri = Uri.parse('${ApiConfig.apiV1}$path')
        .replace(queryParameters: query);
    final res = await _client.get(uri, headers: _headers()).timeout(_timeout);
    return _decode(res);
  }

  Future<dynamic> postJson(String path, Object body) async {
    final uri = Uri.parse('${ApiConfig.apiV1}$path');
    final res = await _client
        .post(uri, headers: _headers(true), body: jsonEncode(body))
        .timeout(_timeout);
    return _decode(res);
  }

  dynamic _decode(http.Response res) {
    final dynamic data = res.body.isNotEmpty ? jsonDecode(res.body) : null;
    if (res.statusCode >= 200 && res.statusCode < 300) return data;
    final msg = (data is Map && data['error'] is Map)
        ? (data['error']['message']?.toString() ?? 'HTTP ${res.statusCode}')
        : 'HTTP ${res.statusCode}';
    throw ApiException(res.statusCode, msg);
  }
}
