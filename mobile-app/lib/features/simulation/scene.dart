import '../../core/format.dart';
import '../../core/models.dart';

/// One adjustable value of the plan (a slider).
class SceneParameter {
  SceneParameter(Json json)
      : name = asString(json['name']) ?? '',
        label = sentenceCase((asString(json['label']) ?? '').trim().isEmpty ? '${json['name']}' : '${json['label']}'),
        unit = prettyUnit(asString(json['unit']) ?? ''),
        value = asDouble(json['value']) ?? 0,
        min = asDouble(json['min']),
        max = asDouble(json['max']),
        step = asDouble(json['step']);
  final String name, label, unit;
  final double value;
  final double? min, max, step;

  bool get adjustable => min != null && max != null && min! < max! && name.isNotEmpty;
}

/// A value the stage reports: its name, symbol, unit and range over the run.
class SceneField {
  SceneField(this.key, this.label, this.symbol, this.unit, this.scale);
  final String key, label, symbol, unit;
  final double scale;

  /// Four significant digits, as a reading on an instrument; the full precision stays in the exported data.
  String read(double? value) {
    final number = formatNumber(value, scale: scale);
    return unit.isEmpty ? number : '$number $unit';
  }
}

/// A saved simulation as its author built it (the PixiJS scene program, the
/// solver timeline and its parameters), plus what the app needs to show its numbers.
class SimulationScene {
  SimulationScene(this.result) {
    _read();
  }

  /// GeneratedSimulationResult, as the API returns it.
  final Json result;

  late Json spec;
  late Json timeline;
  late List<SceneParameter> parameters;
  late Map<String, double> values;
  late Map<String, SceneField> fields;
  late List<String> watched;
  late Map<String, String> captions;

  String get code => asString(asJson(spec['visualProgram'])['code']) ?? '';
  String get description => asString(result['description']) ?? '';
  double get playbackRate {
    final rate = asDouble(asJson(spec['visualProgram'])['playbackRate']);
    return rate != null && rate > 0 ? rate : 1;
  }

  double get duration => asDouble(timeline['durationSeconds']) ?? 0;
  String get verification => asString(asJson(result['validation'])['status']) ?? 'UNKNOWN';
  Json? get presentation => result['presentation'] is Map ? asJson(result['presentation']) : null;
  bool get playable => code.isNotEmpty && asJsonList(timeline['frames']).isNotEmpty;

  static bool hasScene(Object? value) {
    final spec = asJson(asJson(value)['simulationSpec']);
    return spec['visualProgram'] is Map && spec['solverTimeline'] is Map;
  }

  void _read() {
    spec = asJson(result['simulationSpec']);
    timeline = asJson(spec['solverTimeline']);
    parameters = asJsonList(result['parameters']).map(SceneParameter.new).where((p) => p.name.isNotEmpty).toList();
    final saved = asJson(result['savedParameters']);
    values = {
      for (final p in parameters) p.name: asDouble(saved[p.name]) ?? p.value,
    };
    _describe();
  }

  /// Names, symbols and units come from the approved catalogue the backend sent with the run.
  void _describe() {
    final meta = asJson(spec['solverFieldMeta']);
    final ranges = <String, (double, double)>{};
    for (final frame in asJsonList(timeline['frames'])) {
      asJson(frame['values']).forEach((key, raw) {
        final value = asDouble(raw);
        if (key == 't' || value == null || !value.isFinite) return;
        final range = ranges[key];
        ranges[key] = range == null ? (value, value) : (range.$1 < value ? range.$1 : value, range.$2 > value ? range.$2 : value);
      });
    }
    fields = {};
    ranges.forEach((key, range) {
      final supplied = asJson(meta[key]);
      final quantity = key.contains('.') ? key.substring(key.indexOf('.') + 1) : key;
      final label = (asString(supplied['label']) ?? '').trim().isNotEmpty
          ? supplied['label'].toString().trim()
          : sentenceCase(quantity.replaceAll(RegExp(r'[_-]+'), ' ').trim());
      final symbol = (asString(supplied['symbol']) ?? '').trim().isNotEmpty ? supplied['symbol'].toString().trim() : label;
      final scale = range.$1.abs() > range.$2.abs() ? range.$1.abs() : range.$2.abs();
      fields[key] = SceneField(key, label, symbol, prettyUnit(asString(supplied['unit']) ?? ''), scale);
    });
    watched = [];
    captions = {};
    for (final item in asJsonList(spec['observables'])) {
      final key = asString(item['field']);
      if (key == null || !fields.containsKey(key) || watched.contains(key)) continue;
      watched.add(key);
      final caption = (asString(item['label']) ?? '').trim();
      if (caption.isNotEmpty) captions[key] = sentenceCase(caption);
    }
  }

  /// The value's name as the plan words it, without a trailing "(m/s)" when the reading shows that unit anyway.
  String labelOf(String key) {
    final label = captions[key] ?? sentenceCase(fields[key]?.label ?? key);
    final unit = fields[key]?.unit ?? '';
    final suffix = RegExp(r'\s*\(([^()]*)\)\s*$').firstMatch(label);
    if (suffix != null && unit.isNotEmpty && prettyUnit(suffix.group(1)!.trim()) == unit) {
      return label.substring(0, suffix.start);
    }
    return label;
  }

  /// A new run of the same plan, computed by the backend for other parameter values.
  void replaceRun(Json computed, Map<String, double> parameters) {
    result['simulationSpec'] = {...spec, 'solverTimeline': computed['solverTimeline']};
    if (computed['validation'] != null) result['validation'] = computed['validation'];
    if (computed['presentation'] != null) result['presentation'] = computed['presentation'];
    result['savedParameters'] = parameters;
    _read();
  }

  /// What the sandboxed stage needs to start drawing, in the web player's contract.
  Json stagePayload(String theme) => {
        'code': code,
        ...runPayload(),
        'theme': theme,
      };

  Json runPayload() => {
        'timeline': timeline,
        'parameters': values,
        'verificationStatus': verification,
        'fieldMeta': spec['solverFieldMeta'],
        'models': spec['physicsModels'],
        'observables': spec['observables'],
        'parameterInfo': result['parameters'],
        'presentation': ?presentation,
      };

  /// Interpolated values at time t (the web's sampleTimeline).
  Map<String, double> sample(double t) {
    final frames = asJsonList(timeline['frames']);
    if (frames.isEmpty) return const {};
    final time = t.clamp(0, duration).toDouble();
    var lo = 0, hi = frames.length - 1;
    while (lo + 1 < hi) {
      final mid = (lo + hi) >> 1;
      if ((asDouble(frames[mid]['t']) ?? 0) <= time) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    final a = frames[lo], b = frames[hi];
    final ta = asDouble(a['t']) ?? 0, tb = asDouble(b['t']) ?? 0;
    final ratio = tb == ta ? 0.0 : ((time - ta) / (tb - ta)).clamp(0, 1).toDouble();
    final av = asJson(a['values']), bv = asJson(b['values']);
    final out = <String, double>{};
    av.forEach((key, raw) {
      final x = asDouble(raw), y = asDouble(bv[key]);
      if (key != 't' && x != null && y != null) out[key] = x + (y - x) * ratio;
    });
    return out;
  }

  /// The badge the web shows for the physics check (model/verification.ts).
  (String, VerificationTone) get verificationBadge => switch (verification) {
        'VERIFIED_BY_LAWS' => ('Đã đối chiếu định luật', VerificationTone.ok),
        'VERIFIED_PARTLY' => ('Đã đối chiếu một phần', VerificationTone.ok),
        'VERIFIED_ANALYTICAL' || 'VERIFIED_NUMERICAL' => ('Dữ liệu vật lý đã xác minh', VerificationTone.ok),
        'ILLUSTRATIVE' || 'VISUAL_ONLY_UNVERIFIED' => ('Minh hoạ', VerificationTone.info),
        'FLAGGED' => ('Cần kiểm tra lại', VerificationTone.warn),
        'UNSUPPORTED' => ('Chưa mô phỏng được', VerificationTone.warn),
        'UNVERIFIED' => ('Chưa xác minh vật lý', VerificationTone.warn),
        'PENDING' => ('Đang tính lại…', VerificationTone.pending),
        _ => ('Đang sẵn sàng', VerificationTone.pending),
      };
}

enum VerificationTone { ok, info, warn, pending }
