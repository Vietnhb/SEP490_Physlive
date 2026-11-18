import 'package:flutter/material.dart';

import '../../core/api.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
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
