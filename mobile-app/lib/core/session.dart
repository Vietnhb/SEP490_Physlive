import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';
import 'config.dart';
import 'models.dart';

/// The signed-in account and the API client that acts for it. The token is
/// kept on the device so the app opens signed in; it is dropped on sign-out
/// or as soon as the server rejects it.
class Session extends ChangeNotifier {
  Session(this.config) : api = ApiClient(config.apiUrl) {
    api.onUnauthorized = () {
      if (_user != null) _clear('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.');
    };
  }

  static const _tokenKey = 'physlive.token';

  final AppConfig config;
  final ApiClient api;
  User? _user;
  bool _restoring = true;
  String? notice;

  User? get user => _user;
  bool get restoring => _restoring;

  Future<void> restore() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString(_tokenKey);
    if (token != null) {
      api.token = token;
      try {
        _user = User(asJson(await api.get('/user/me')));
      } on ApiException catch (error) {
        if (error.unauthorized || error.status == 403) {
          api.token = null;
          await prefs.remove(_tokenKey);
        } else {
          notice = error.message;
        }
      }
    }
    _restoring = false;
    notifyListeners();
  }

  Future<void> signIn(String email, String password) async {
    final data = asJson(await api.post('/auth/login', {'email': email.trim(), 'password': password},
        const Duration(seconds: 60)));
    final token = asString(data['token']);
    if (token == null) throw ApiException('Máy chủ không trả về phiên đăng nhập.');
    api.token = token;
    _user = User(asJson(data['user']));
    notice = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
    notifyListeners();
  }

  Future<void> changePassword(String current, String next) async {
    _user = User(asJson(await api.put('/user/me/password', {'currentPassword': current, 'newPassword': next})));
    notifyListeners();
  }

  Future<void> refreshUser() async {
    _user = User(asJson(await api.get('/user/me')));
    notifyListeners();
  }

  Future<void> signOut() async {
    try {
      if (api.token != null) await api.post('/auth/logout');
    } on ApiException {
      // the token is forgotten on this device either way
    }
    await _clear(null);
  }

  Future<void> _clear(String? message) async {
    _user = null;
    api.token = null;
    notice = message;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    notifyListeners();
  }
}

/// Gives every screen below it the session; screens rebuild when it changes.
class SessionScope extends InheritedNotifier<Session> {
  const SessionScope({super.key, required Session session, required super.child}) : super(notifier: session);

  static Session of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<SessionScope>()!.notifier!;

  static ApiClient api(BuildContext context) =>
      context.getInheritedWidgetOfExactType<SessionScope>()!.notifier!.api;
}
