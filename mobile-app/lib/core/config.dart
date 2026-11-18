import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Where the PhysLive API lives. A release build gets it at build time
/// (--dart-define=PHYSLIVE_API_URL=https://…/api); a debug build talks to the
/// backend on the developer's machine, which the emulator reaches at 10.0.2.2.
class AppConfig {
  AppConfig._(this._prefs, this._apiUrl);

  static const _key = 'physlive.apiUrl';
  static const _built = String.fromEnvironment('PHYSLIVE_API_URL');
  static const _debugDefault = 'http://10.0.2.2:8080/api';

  final SharedPreferences _prefs;
  final Uri _apiUrl;

  Uri get apiUrl => _apiUrl;

  /// The address the build ships with, used when nothing else is saved.
  static Uri? get builtIn =>
      apiAddress(_built.isNotEmpty ? _built : (kDebugMode ? _debugDefault : ''));

  static Future<AppConfig?> load() async {
    final prefs = await SharedPreferences.getInstance();
    final address = apiAddress(prefs.getString(_key) ?? '') ?? builtIn;
    return address == null ? null : AppConfig._(prefs, address);
  }

  static Future<AppConfig> save(Uri address) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, address.toString());
    return AppConfig._(prefs, address);
  }

  Future<void> reset() => _prefs.remove(_key);
}

/// The API address a user may enter: HTTPS, or plain HTTP only on this machine
/// or the emulator's host. The path is kept ("/api"), a trailing slash is not.
Uri? apiAddress(String value) {
  final uri = Uri.tryParse(value.trim());
  if (uri == null || uri.host.isEmpty || uri.userInfo.isNotEmpty) return null;
  final local = {'localhost', '127.0.0.1', '10.0.2.2'}.contains(uri.host);
  if (uri.scheme != 'https' && !(local && uri.scheme == 'http')) return null;
  final path = uri.path.endsWith('/') ? uri.path.substring(0, uri.path.length - 1) : uri.path;
  return uri.replace(path: path, query: null, fragment: null);
}
