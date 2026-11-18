import 'package:flutter/material.dart';

import '../../core/config.dart';
import '../../ui/theme.dart';

/// Changes the server the app talks to. Only reachable from the sign-in
/// screen, so no account is ever carried from one server to another.
class ServerScreen extends StatefulWidget {
  const ServerScreen({super.key, this.current, this.firstRun = false, this.onSaved});
  final Uri? current;
  final bool firstRun;
  final void Function(AppConfig config)? onSaved;

  @override
  State<ServerScreen> createState() => _ServerScreenState();
}

class _ServerScreenState extends State<ServerScreen> {
  final _address = TextEditingController();
  String? _error;

  @override
  void initState() {
    super.initState();
    _address.text = (widget.current ?? AppConfig.builtIn)?.toString() ?? 'https://';
  }

  @override
  void dispose() {
    _address.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final address = apiAddress(_address.text);
    if (address == null) {
      setState(() => _error = 'Địa chỉ cần bắt đầu bằng https:// (http:// chỉ dùng cho máy chủ trên máy này).');
      return;
    }
    final config = await AppConfig.save(address);
    if (!mounted) return;
    final saved = widget.onSaved ?? _AppRestart.of(context);
    saved?.call(config);
    if (!widget.firstRun && mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      appBar: AppBar(title: const Text('Máy chủ'), automaticallyImplyLeading: !widget.firstRun),
      body: ListView(padding: const EdgeInsets.all(20), children: [
        Text('Địa chỉ API của PhysLive', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 6),
        Text('Ví dụ: https://physlive.example/api', style: TextStyle(color: p.muted)),
        const SizedBox(height: 16),
        TextField(
          controller: _address,
          keyboardType: TextInputType.url,
          autocorrect: false,
          decoration: InputDecoration(labelText: 'Địa chỉ', errorText: _error, errorMaxLines: 3),
          onSubmitted: (_) => _save(),
        ),
        const SizedBox(height: 20),
        FilledButton(onPressed: _save, child: const Text('Lưu')),
      ]),
    );
  }
}

/// Lets the server screen hand a new configuration to the app root.
class _AppRestart extends InheritedWidget {
  const _AppRestart({required this.restart, required super.child});
  final void Function(AppConfig config) restart;

  static void Function(AppConfig config)? of(BuildContext context) =>
      context.getInheritedWidgetOfExactType<_AppRestart>()?.restart;

  @override
  bool updateShouldNotify(_AppRestart oldWidget) => false;
}

/// Wraps the app so a changed server rebuilds everything from scratch.
class AppRestartScope extends StatelessWidget {
  const AppRestartScope({super.key, required this.restart, required this.child});
  final void Function(AppConfig config) restart;
  final Widget child;

  @override
  Widget build(BuildContext context) => _AppRestart(restart: restart, child: child);
}
