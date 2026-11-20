import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/models.dart';
import 'scene.dart';

/// Files a simulation can be handed out as, the same two the web offers: its numbers over time, and a page that
/// replays the run in any browser with no server and no new calculation.
class SimulationExport {
  SimulationExport._();

  /// One row per solver frame: time first, then every value the run recorded (the web's CSV layout).
  static String csv(SimulationScene scene) {
    final frames = asJsonList(scene.timeline['frames']);
    final keys = <String>{for (final frame in frames) ...asJson(frame['values']).keys};
    String cell(Object? value) => '"${'${value ?? ''}'.replaceAll('"', '""')}"';
    return [
      ['time_seconds', ...keys].map(cell).join(','),
      for (final frame in frames)
        [frame['t'], for (final key in keys) asJson(frame['values'])[key]].map(cell).join(','),
    ].join('\r\n');
  }

  /// The app's own player page with this run built in, plus play / restart buttons, so it works on its own.
  static Future<String> replayPage(SimulationScene scene) async {
    final host = await rootBundle.loadString('assets/player/player.html');
    String script(Object? value) =>
        jsonEncode(value).replaceAll('<', r'<').replaceAll(' ', r' ').replaceAll(' ', r' ');
    final title = scene.description.trim().isEmpty ? 'Mô phỏng PhysLive' : scene.description.trim();
    final extra = '''
<style>html,body{background:#f6f8fb;overflow:auto}body{font:15px system-ui,sans-serif;color:#0f172a;display:flex;flex-direction:column;height:100%}
#bar{display:flex;gap:8px;align-items:center;padding:10px 12px;border-bottom:1px solid #e2e8f0;background:#fff}
#bar button{font:inherit;padding:6px 12px;border:1px solid #cbd5e1;border-radius:8px;background:#fff}
#bar span{margin-left:auto;color:#64748b;font-size:13px}iframe{flex:1;height:auto;min-height:60vh;background:#fff}
#note{padding:10px 12px;color:#475569;font-size:13px;white-space:pre-wrap}</style>
<div id="bar"><button id="play">Tạm dừng</button><button id="restart">Phát lại</button><span id="clock">0 s</span></div>
<div id="note"></div>
<script>
const SCENE = ${script(scene.stagePayload('light'))};
let playing = true;
document.getElementById('note').textContent = ${script(title)} + '\\nPhát lại số liệu đã lưu; không tính lại khi ngoại tuyến.';
document.getElementById('play').onclick = e => { playing = !playing; physlive.send({ type: 'play', playing }); e.target.textContent = playing ? 'Tạm dừng' : 'Phát'; };
document.getElementById('restart').onclick = () => physlive.send({ type: 'seek', t: 0 });
addEventListener('message', ({ data }) => { if (data && data.channel === 'pixi-runtime' && Number.isFinite(data.t)) document.getElementById('clock').textContent = data.t.toFixed(2) + ' s'; });
physlive.start(SCENE, { speed: ${scene.playbackRate}, loop: true, playing: true });
document.body.insertBefore(document.getElementById('bar'), document.body.firstChild);
document.body.insertBefore(document.getElementById('note'), document.querySelector('iframe').nextSibling);
</script>''';
    final end = host.lastIndexOf('</body>');
    return end < 0 ? host + extra : host.substring(0, end) + extra + host.substring(end);
  }

  /// Writes the file to the app's cache and opens Android's share sheet (Zalo, Drive, Gmail …).
  static Future<void> share(String fileName, String content, String mimeType, {String? subject}) async {
    final directory = await getTemporaryDirectory();
    final file = File('${directory.path}/$fileName');
    await file.writeAsString(content, flush: true);
    await SharePlus.instance.share(ShareParams(files: [XFile(file.path, mimeType: mimeType)], subject: subject));
  }

  /// A short ASCII file name from the simulation's description.
  static String fileStem(SimulationScene scene) {
    const accents = 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ';
    const plain = 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd';
    final lower = scene.description.toLowerCase().split('').map((c) {
      final i = accents.indexOf(c);
      return i < 0 ? c : plain[i];
    }).join();
    final words = lower.replaceAll(RegExp(r'[^a-z0-9]+'), ' ').trim().split(' ').where((w) => w.isNotEmpty).take(6);
    return words.isEmpty ? 'physlive' : 'physlive-${words.join('-')}';
  }
}
