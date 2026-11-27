import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'core/config.dart';
import 'core/session.dart';
import 'features/account/account_screens.dart';
import 'features/auth/login_screen.dart';
import 'features/auth/server_screen.dart';
import 'features/home/home_shell.dart';
import 'ui/theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  await appTheme.load();
  runApp(PhysLiveApp(config: await AppConfig.load()));
}

class PhysLiveApp extends StatefulWidget {
  const PhysLiveApp({super.key, required this.config});
  final AppConfig? config;

  @override
  State<PhysLiveApp> createState() => _PhysLiveAppState();
}

class _PhysLiveAppState extends State<PhysLiveApp> {
  Session? _session;
  int _generation = 0;

  @override
  void initState() {
    super.initState();
    if (widget.config != null) _open(widget.config!);
  }

  void _open(AppConfig config) {
    setState(() {
      _session = Session(config)..restore();
      _generation++;
    });
  }

  @override
  Widget build(BuildContext context) {
    final session = _session;
    final app = ValueListenableBuilder<ThemeMode>(
      valueListenable: appTheme,
      builder: (context, mode, _) => MaterialApp(
        key: ValueKey(_generation),
        title: 'PhysLive',
        debugShowCheckedModeBanner: false,
        theme: buildTheme(Brightness.light),
        darkTheme: buildTheme(Brightness.dark),
        themeMode: mode,
        locale: const Locale('vi'),
        builder: (context, child) => AppRestartScope(restart: _open, child: child!),
        home: session == null
            ? ServerScreen(firstRun: true, onSaved: _open)
            : const _Gate(),
      ),
    );
    // above the navigator, so every screen pushed later reaches the session too
    return session == null ? app : SessionScope(session: session, child: app);
  }
}

/// Picks the screen for the session's state: restoring, signed out, a forced
/// password change, an account the app is not made for, or the app itself.
class _Gate extends StatelessWidget {
  const _Gate();

  @override
  Widget build(BuildContext context) {
    final session = SessionScope.of(context);
    final user = session.user;
    final Widget screen;
    if (session.restoring) {
      screen = const Scaffold(key: ValueKey('splash'), body: Center(child: CircularProgressIndicator()));
    } else if (user == null) {
      screen = const LoginScreen(key: ValueKey('login'));
    } else if (user.mustChangePassword) {
      screen = const ChangePasswordScreen(key: ValueKey('password'), forced: true);
    } else if (!user.usesApp) {
      screen = const WebOnlyScreen(key: ValueKey('web-only'));
    } else {
      screen = HomeShell(key: ValueKey('home-${user.id}'));
    }
    return AnimatedSwitcher(duration: const Duration(milliseconds: 220), child: screen);
  }
}
