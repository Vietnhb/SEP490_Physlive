import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../core/format.dart';
import '../../core/models.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import 'scene.dart';

/// Computes a new run of the scene's plan for other parameter values.
typedef Recompute = Future<Json> Function(SimulationScene scene, Map<String, double> parameters);

/// A simulation: the authored scene drawn by the bundled PixiJS stage (offline,
/// sandboxed, no network), with native playback controls, the watched values
/// and, when [recompute] is given, the plan's parameters as sliders.
class SimulationPlayer extends StatefulWidget {
  const SimulationPlayer({super.key, required this.scene, this.recompute, this.autoplay = true});
  final SimulationScene scene;
  final Recompute? recompute;
  final bool autoplay;

  @override
  State<SimulationPlayer> createState() => _SimulationPlayerState();
}

class _SimulationPlayerState extends State<SimulationPlayer> with WidgetsBindingObserver {
  static const _speeds = [0.25, 0.5, 1.0, 2.0];

  late final WebViewController _web;
  bool _hostReady = false, _ready = false, _playing = true, _loop = false, _dragging = false, _computing = false;
  double _time = 0, _speed = 1;
  String? _error, _computeError;
  Map<String, double>? _exact;
  late Map<String, double> _draft;
  Timer? _debounce;
  int _run = 0;

  SimulationScene get _scene => widget.scene;
  String get _theme => Theme.of(context).brightness == Brightness.dark ? 'DARK' : 'LIGHT';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _playing = widget.autoplay;
    _draft = Map.of(_scene.values);
    _web = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.transparent)
      ..addJavaScriptChannel('PhysLivePlayer', onMessageReceived: (message) => _receive(message.message))
      // the stage never leaves its own page
      ..setNavigationDelegate(NavigationDelegate(
        onNavigationRequest: (request) =>
            request.url.startsWith('file:///android_asset/') || request.url.startsWith('about:')
                ? NavigationDecision.navigate
                : NavigationDecision.prevent,
      ))
      ..loadFlutterAsset('assets/player/player.html');
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _debounce?.cancel();
    super.dispose();
  }

  @override
  void didChangePlatformBrightness() {
    if (_hostReady) _send({'type': 'theme', 'theme': _theme});
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // a hidden app does not keep drawing
    if (state != AppLifecycleState.resumed && _playing) _setPlaying(false);
  }

  void _receive(String raw) {
    final Json data;
    try {
      data = asJson(jsonDecode(raw));
    } on FormatException {
      return;
    }
    if (!mounted) return;
    switch (data['type']) {
      case 'host':
        _hostReady = true;
        _start();
      case 'ready':
        setState(() {
          _ready = true;
          _readTick(data);
        });
      case 'tick':
        if (!_dragging) setState(() => _readTick(data));
      case 'ended':
        setState(() {
          _readTick(data);
          _playing = false;
        });
      case 'error':
        setState(() {
          _error = sentenceCase('${data['message'] ?? 'Không dựng được cảnh.'}');
          _ready = false;
        });
    }
  }

  void _readTick(Json data) {
    final t = asDouble(data['t']);
    if (t != null) _time = t.clamp(0, _scene.duration).toDouble();
    final sample = data['sample'];
    _exact = sample is Map ? {for (final e in sample.entries) '${e.key}': asDouble(e.value) ?? double.nan} : null;
  }

  void _start() {
    if (!_scene.playable) {
      setState(() => _error = 'Mô phỏng này chưa có hình minh hoạ để phát.');
      return;
    }
    setState(() {
      _error = null;
      _ready = false;
      _time = 0;
    });
    final payload = jsonEncode(_scene.stagePayload(_theme));
    final controls = jsonEncode({'speed': _speed * _scene.playbackRate, 'loop': _loop, 'playing': _playing});
    _web.runJavaScript('physlive.start($payload, $controls)');
  }

  void _send(Json message) => _web.runJavaScript('physlive.send(${jsonEncode(message)})');

  void _setPlaying(bool value) {
    setState(() => _playing = value);
    _send({'type': 'play', 'playing': value});
  }

  void _togglePlay() {
    if (!_playing && _time >= _scene.duration - 1e-9 && !_loop) _seek(0);
    _setPlaying(!_playing);
  }

  void _seek(double t) {
    setState(() => _time = t);
    _send({'type': 'seek', 't': t});
  }

  void _restart() {
    _seek(0);
    _setPlaying(true);
  }

  void _changeParameter(SceneParameter parameter, double value) {
    setState(() => _draft[parameter.name] = value);
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), _recompute);
  }

  Future<void> _recompute() async {
    final recompute = widget.recompute;
    if (recompute == null) return;
    final run = ++_run;
    final values = Map.of(_draft);
    setState(() {
      _computing = true;
      _computeError = null;
    });
    try {
      final computed = await recompute(_scene, values);
      if (!mounted || run != _run) return;
      _scene.replaceRun(computed, values);
      _send({'type': 'replace', ..._scene.runPayload()});
      setState(() {
        _time = 0;
        _exact = null;
        _playing = true;
      });
      _send({'type': 'play', 'playing': true});
    } catch (error) {
      if (mounted && run == _run) setState(() => _computeError = errorText(error));
    } finally {
      if (mounted && run == _run) setState(() => _computing = false);
    }
  }

  void _resetParameters() {
    setState(() => _draft = {for (final p in _scene.parameters) p.name: p.value});
    _recompute();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final (badge, tone) = _scene.verificationBadge;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [
        Pill(badge,
            tone: switch (tone) {
              VerificationTone.ok => Tone.success,
              VerificationTone.info => Tone.accent,
              VerificationTone.warn => Tone.warning,
              VerificationTone.pending => Tone.neutral,
            },
            icon: tone == VerificationTone.ok ? Icons.verified_outlined : Icons.info_outline),
        const Spacer(),
        if (_computing) ...[
          const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)),
          const SizedBox(width: 8),
          Text('Đang tính lại…', style: TextStyle(color: p.muted, fontSize: 12)),
        ],
      ]),
      const SizedBox(height: 10),
      _stage(p),
      const SizedBox(height: 8),
      _transport(p),
      if (_scene.duration > 0 && _scene.playbackRate != 1) _rateNote(p),
      if (_computeError != null)
        Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Text(_computeError!, style: TextStyle(color: p.danger, fontSize: 13)),
        ),
      const SizedBox(height: 12),
      _readouts(p),
      if (widget.recompute != null && _scene.parameters.any((x) => x.adjustable)) ...[
        const SizedBox(height: 12),
        _parameters(p),
      ],
    ]);
  }

  Widget _stage(Palette p) {
    return AspectRatio(
      aspectRatio: 4 / 3,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: p.surface,
            border: Border.all(color: p.line),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Stack(fit: StackFit.expand, children: [
            if (_error == null) WebViewWidget(controller: _web),
            if (_error == null && !_ready)
              ColoredBox(
                color: p.surface,
                child: Center(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    const CircularProgressIndicator(),
                    const SizedBox(height: 12),
                    Text('Đang dựng cảnh…', style: TextStyle(color: p.muted)),
                  ]),
                ),
              ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.all(20),
                child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Icon(Icons.broken_image_outlined, color: p.danger, size: 32),
                  const SizedBox(height: 8),
                  Text('Không dựng được cảnh', style: Theme.of(context).textTheme.titleSmall),
                  const SizedBox(height: 4),
                  Text(_error!,
                      textAlign: TextAlign.center, maxLines: 4, overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: p.muted, fontSize: 12)),
                  const SizedBox(height: 10),
                  if (_scene.playable) OutlinedButton(onPressed: _start, child: const Text('Thử lại')),
                ]),
              ),
          ]),
        ),
      ),
    );
  }

  Widget _transport(Palette p) {
    final duration = _scene.duration;
    final disabled = !_ready || duration <= 0;
    return Row(children: [
      IconButton.filled(
        onPressed: disabled ? null : _togglePlay,
        tooltip: _playing ? 'Tạm dừng' : 'Phát',
        icon: Icon(_playing ? Icons.pause_rounded : Icons.play_arrow_rounded),
      ),
      IconButton(
        onPressed: disabled ? null : _restart,
        tooltip: 'Phát lại từ đầu',
        icon: const Icon(Icons.replay_rounded),
      ),
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          SliderTheme(
            data: SliderTheme.of(context).copyWith(
              trackHeight: 3,
              overlayShape: const RoundSliderOverlayShape(overlayRadius: 14),
              thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 7),
            ),
            child: Slider(
              value: duration > 0 ? _time.clamp(0, duration).toDouble() : 0,
              max: duration > 0 ? duration : 1,
              onChangeStart: disabled ? null : (_) => _dragging = true,
              onChanged: disabled ? null : _seek,
              onChangeEnd: disabled ? null : (_) => _dragging = false,
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: Row(children: [
              Text(formatTime(_time, duration),
                  style: TextStyle(fontSize: 12, color: p.ink, fontFeatures: const [FontFeature.tabularFigures()])),
              Text(' / ${formatTime(duration, duration)}', style: TextStyle(fontSize: 12, color: p.muted)),
            ]),
          ),
        ]),
      ),
      PopupMenuButton<Object>(
        tooltip: 'Tốc độ và lặp lại',
        icon: Row(mainAxisSize: MainAxisSize.min, children: [
          Text('${formatNumber(_speed)}×', style: TextStyle(fontWeight: FontWeight.w600, color: p.ink)),
          if (_loop) ...[const SizedBox(width: 2), Icon(Icons.repeat_rounded, size: 16, color: p.accent)],
        ]),
        onSelected: (value) {
          if (value is double) {
            setState(() => _speed = value);
            _send({'type': 'speed', 'speed': value * _scene.playbackRate});
          } else {
            setState(() => _loop = !_loop);
            _send({'type': 'loop', 'loop': _loop});
          }
        },
        itemBuilder: (context) => [
          for (final speed in _speeds)
            CheckedPopupMenuItem<Object>(value: speed, checked: speed == _speed, child: Text('Phát ${formatNumber(speed)}×')),
          const PopupMenuDivider(),
          CheckedPopupMenuItem<Object>(value: 'loop', checked: _loop, child: const Text('Lặp lại')),
        ],
      ),
    ]);
  }

  Widget _rateNote(Palette p) {
    final rate = _scene.playbackRate * _speed;
    final text = rate > 1.5
        ? 'Nhanh hơn thời gian thực ${formatNumber(rate, significant: 3)} lần'
        : rate < 1 / 1.5
            ? 'Chậm hơn thời gian thực ${formatNumber(1 / rate, significant: 3)} lần'
            : null;
    if (text == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(left: 12),
      child: Text(text, style: TextStyle(color: p.muted, fontSize: 12)),
    );
  }

  Widget _readouts(Palette p) {
    final exact = _exact != null && _scene.presentation != null;
    final values = exact ? _exact! : _scene.sample(_time);
    final keys = _scene.watched.isNotEmpty ? _scene.watched : _scene.fields.keys.take(4).toList();
    if (keys.isEmpty) return const SizedBox.shrink();
    final others = _scene.fields.keys.where((k) => !keys.contains(k)).toList();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      LayoutBuilder(builder: (context, box) {
        final width = (box.maxWidth - 8) / 2;
        return Wrap(spacing: 8, runSpacing: 8, children: [
          for (final key in keys)
            SizedBox(
              width: width,
              child: Container(
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                decoration: BoxDecoration(
                  color: p.surface,
                  border: Border.all(color: p.line),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(_scene.labelOf(key),
                      maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(color: p.muted, fontSize: 12)),
                  const SizedBox(height: 4),
                  Text(_scene.fields[key]!.read(values[key]),
                      style: TextStyle(
                          fontSize: 17, fontWeight: FontWeight.w700, color: p.ink,
                          fontFeatures: const [FontFeature.tabularFigures()])),
                ]),
              ),
            ),
        ]);
      }),
      if (others.isNotEmpty)
        Theme(
          data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
          child: ExpansionTile(
            tilePadding: const EdgeInsets.symmetric(horizontal: 4),
            title: Text('Tất cả đại lượng (${_scene.fields.length})', style: const TextStyle(fontSize: 14)),
            children: [
              for (final key in [...keys, ...others])
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 5),
                  child: Row(children: [
                    Expanded(
                      child: Text(_scene.labelOf(key), style: TextStyle(color: p.muted, fontSize: 13)),
                    ),
                    Text(_scene.fields[key]!.read(values[key]),
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600,
                            fontFeatures: [FontFeature.tabularFigures()])),
                  ]),
                ),
            ],
          ),
        ),
    ]);
  }

  Widget _parameters(Palette p) {
    return Section(
      title: 'Thông số',
      icon: Icons.tune_rounded,
      trailing: TextButton(onPressed: _computing ? null : _resetParameters, child: const Text('Đặt lại')),
      child: Column(children: [
        for (final parameter in _scene.parameters.where((x) => x.adjustable))
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(children: [
                Expanded(child: Text(parameter.label, style: const TextStyle(fontSize: 14))),
                Text(
                  '${formatNumber(_draft[parameter.name])}${parameter.unit.isEmpty ? '' : ' ${parameter.unit}'}',
                  style: TextStyle(fontWeight: FontWeight.w700, color: p.accent),
                ),
              ]),
              Slider(
                value: (_draft[parameter.name] ?? parameter.value).clamp(parameter.min!, parameter.max!).toDouble(),
                min: parameter.min!,
                max: parameter.max!,
                divisions: _divisions(parameter),
                onChanged: (value) => _changeParameter(parameter, value),
              ),
            ]),
          ),
      ]),
    );
  }

  int? _divisions(SceneParameter parameter) {
    final step = parameter.step;
    if (step == null || step <= 0) return 100;
    final count = ((parameter.max! - parameter.min!) / step).round();
    return count > 0 && count <= 1000 ? count : 100;
  }
}
