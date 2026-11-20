import 'package:flutter/material.dart';

import '../../core/api.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../simulation/export.dart';
import '../simulation/player.dart';
import '../simulation/scene.dart';

/// A library simulation as its author saved it. A teacher can change its
/// parameters; the backend computes the new run, the app only draws it.
class SimulationScreen extends StatelessWidget {
  const SimulationScreen({super.key, required this.item});
  final LibraryItem item;

  Future<SimulationScene> _load(ApiClient api) async {
    Object? data;
    try {
      data = await api.get('/simulations/shared/${item.simulationId}', query: {'view': 'generated'},
          timeout: const Duration(seconds: 30));
    } on ApiException catch (error) {
      // the owner's private copy is read from their own saves
      if (error.status != 403 && error.status != 404) rethrow;
      data = await api.get('/simulation/saved/${item.simulationId}', timeout: const Duration(seconds: 30));
    }
    if (!SimulationScene.hasScene(data)) {
      throw ApiException('Mô phỏng này dùng bản lưu cũ chưa có hình minh hoạ. Hãy mở trên bản web.');
    }
    return SimulationScene(asJson(data));
  }

  static Future<Json> _recompute(ApiClient api, SimulationScene scene, Map<String, double> parameters) async {
    final result = scene.result;
    return asJson(await api.post('/simulation/compute', {
      'schemaId': result['schemaId'],
      'schemaVersion': result['schemaVersion'],
      'description': result['description'],
      'planSignature': result['planSignature'],
      'simulationSpec': result['simulationSpec'],
      'parameters': parameters,
    }, const Duration(seconds: 45)));
  }

  @override
  Widget build(BuildContext context) {
    final session = SessionScope.of(context);
    final api = session.api;
    final p = context.palette;
    return Scaffold(
      appBar: AppBar(title: Text(item.title, maxLines: 1, overflow: TextOverflow.ellipsis)),
      body: Loader<SimulationScene>(
        load: () => _load(api),
        builder: (context, scene, _) => ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 32), children: [
          SimulationPlayer(
            scene: scene,
            recompute: session.user!.isTeacher ? (scene, values) => _recompute(api, scene, values) : null,
          ),
          const SizedBox(height: 12),
          _ExportBar(scene: scene, title: item.title),
          if (scene.description.trim().isNotEmpty) ...[
            const SizedBox(height: 16),
            Section(
              title: 'Mô tả',
              icon: Icons.notes_rounded,
              child: Text(scene.description, style: TextStyle(height: 1.45, color: p.ink)),
            ),
          ],
          if (asString(scene.result['explanation'])?.trim().isNotEmpty ?? false) ...[
            const SizedBox(height: 12),
            Section(
              title: 'Giải thích',
              icon: Icons.lightbulb_outline_rounded,
              child: Text(scene.result['explanation'].toString(), style: const TextStyle(height: 1.45)),
            ),
          ],
        ]),
      ),
    );
  }
}

/// Hands the simulation on screen out as files, through Android's share sheet.
class _ExportBar extends StatefulWidget {
  const _ExportBar({required this.scene, required this.title});
  final SimulationScene scene;
  final String title;

  @override
  State<_ExportBar> createState() => _ExportBarState();
}

class _ExportBarState extends State<_ExportBar> {
  bool _busy = false;

  Future<void> _run(Future<void> Function() action) async {
    setState(() => _busy = true);
    try {
      await action();
    } catch (error) {
      if (mounted) showMessage(context, 'Chưa xuất được: ${errorText(error)}', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scene = widget.scene;
    final stem = SimulationExport.fileStem(scene);
    return Section(
      title: 'Xuất mô phỏng',
      icon: Icons.ios_share_rounded,
      child: Wrap(spacing: 10, runSpacing: 8, children: [
        OutlinedButton.icon(
          onPressed: _busy ? null : () => _run(() => SimulationExport.share(
              '$stem.csv', SimulationExport.csv(scene), 'text/csv', subject: widget.title)),
          icon: const Icon(Icons.table_chart_outlined),
          label: const Text('Số liệu (CSV)'),
        ),
        OutlinedButton.icon(
          onPressed: _busy || !scene.playable ? null : () => _run(() async => SimulationExport.share(
              '$stem-phat-lai.html', await SimulationExport.replayPage(scene), 'text/html', subject: widget.title)),
          icon: const Icon(Icons.play_circle_outline_rounded),
          label: const Text('Trang phát lại (HTML)'),
        ),
      ]),
    );
  }
}
