import 'package:flutter/material.dart';

import '../../core/api.dart';
import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../simulation/player.dart';
import '../simulation/scene.dart';

/// One assignment, in the web's steps: predict (when the activity asks for it),
/// observe the simulation, then write the conclusion and hand it in.
class StudentAssignmentScreen extends StatefulWidget {
  const StudentAssignmentScreen({super.key, required this.assignment});
  final Assignment assignment;

  @override
  State<StudentAssignmentScreen> createState() => _StudentAssignmentScreenState();
}

class _StudentAssignmentScreenState extends State<StudentAssignmentScreen> {
  late Assignment _a = widget.assignment;
  final _prediction = TextEditingController();
  final _reasoning = TextEditingController();
  final _estimate = TextEditingController();
  final _conclusion = TextEditingController();
  bool _sendingPrediction = false, _submitting = false, _simLoading = false;
  String? _predictionError, _submitError, _simError;
  SimulationScene? _scene;
  bool _sceneMissing = false;

  late final ApiClient _api = SessionScope.api(context);

  @override
  void initState() {
    super.initState();
    final previous = _a.predictions;
    if (_a.retryAllowed) {
      _prediction.text = asString(previous['answerText']) ?? '';
      _reasoning.text = asString(previous['reasoning']) ?? '';
      final estimate = asDouble(previous['estimatedValue']);
      if (estimate != null) _estimate.text = formatScore(estimate);
    } else {
      _conclusion.text = asString(previous['conclusion']) ?? '';
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _log('ASSIGNMENT_OPENED');
      if (!_a.needsPrediction) _loadSimulation();
    });
  }

  @override
  void dispose() {
    _prediction.dispose();
    _reasoning.dispose();
    _estimate.dispose();
    _conclusion.dispose();
    super.dispose();
  }

  void _log(String action, [Object? payload]) {
    _api.post('/student/action-logs', {'assignmentId': _a.id, 'action': action, 'payload': ?payload})
        .catchError((_) => null);
  }

  Future<void> _loadSimulation() async {
    setState(() {
      _simLoading = true;
      _simError = null;
    });
    try {
      final data = asJson(await _api.get('/assignments/${_a.id}/simulation', timeout: const Duration(seconds: 30)));
      final result = data['rawResult'] ?? data['result'];
      if (!mounted) return;
      setState(() {
        if (SimulationScene.hasScene(result)) {
          _scene = SimulationScene(asJson(result));
        } else {
          _sceneMissing = true;
        }
      });
    } catch (error) {
      if (mounted) setState(() => _simError = errorText(error));
    } finally {
      if (mounted) setState(() => _simLoading = false);
    }
  }

  Future<void> _sendPrediction() async {
    final answer = _prediction.text.trim();
    if (answer.isEmpty) {
      setState(() => _predictionError = 'Hãy viết dự đoán của bạn.');
      return;
    }
    final estimate = double.tryParse(_estimate.text.trim().replaceAll(',', '.'));
    if (_a.autoGrade && estimate == null) {
      setState(() => _predictionError = 'Vui lòng nhập kết quả dự đoán bằng số.');
      return;
    }
    final payload = {
      'answerText': answer,
      if (_a.autoGrade) 'estimatedValue': estimate,
      if (_reasoning.text.trim().isNotEmpty) 'reasoning': _reasoning.text.trim(),
    };
    setState(() {
      _sendingPrediction = true;
      _predictionError = null;
    });
    try {
      final submission = asJson(await _api.post('/assignments/${_a.id}/predictions', {'predictions': payload}));
      if (!mounted) return;
      _log('PREDICTION_SUBMITTED', payload);
      setState(() => _a = _a.copyWith({
            'predictionSubmitted': true,
            'submissionCompleted': false,
            'completedAt': null,
            'retryAllowed': false,
            'predictions': payload,
            'score': submission['score'],
            'feedback': submission['feedback'],
            'gradingStatus': submission['gradingStatus'],
          }));
      _conclusion.clear();
      _loadSimulation();
    } catch (error) {
      if (mounted) setState(() => _predictionError = errorText(error));
    } finally {
      if (mounted) setState(() => _sendingPrediction = false);
    }
  }

  Future<void> _submit() async {
    final conclusion = _conclusion.text.trim();
    final measuring = _a.activity == ActivityType.measurement;
    final value = double.tryParse(_estimate.text.trim().replaceAll(',', '.'));
    if (measuring && value == null) {
      setState(() => _submitError = 'Vui lòng nhập kết quả đo bằng số trước khi nộp bài.');
      return;
    }
    if (conclusion.isEmpty) {
      setState(() => _submitError = 'Hãy viết kết luận trước khi nộp.');
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Nộp bài?'),
        content: const Text('Sau khi nộp, bạn chỉ sửa được khi giáo viên trả bài lại.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Xem lại')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Nộp bài')),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    final poe = _a.activity == ActivityType.predictObserveExplain;
    setState(() {
      _submitting = true;
      _submitError = null;
    });
    try {
      final submission = asJson(await _api.post('/assignments/${_a.id}/submit', {
        'conclusion': conclusion,
        'answerText': poe ? _a.predictions['answerText'] : conclusion,
        if (measuring) 'estimatedValue': value,
      }));
      if (!mounted) return;
      _log('ASSIGNMENT_SUBMITTED', {'conclusion': conclusion});
      setState(() => _a = _a.copyWith({
            'submissionCompleted': true,
            'completedAt': submission['completedAt'],
            'predictions': {
              ..._a.predictions,
              'conclusion': conclusion,
              if (!poe) 'answerText': conclusion,
              if (measuring) 'estimatedValue': value,
            },
            'score': submission['score'],
            'feedback': submission['feedback'],
            'gradingStatus': submission['gradingStatus'],
            'retryAllowed': false,
          }));
      showMessage(context, 'Đã nộp bài.');
    } catch (error) {
      if (mounted) setState(() => _submitError = errorText(error));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final a = _a;
    final steps = a.activity == ActivityType.predictObserveExplain
        ? ['Dự đoán', 'Quan sát', 'Kết luận']
        : ['Đọc nhiệm vụ', a.activity == ActivityType.measurement ? 'Đo lường' : 'Khảo sát', 'Kết luận'];
    final step = a.done ? 3 : (a.needsPrediction ? 0 : (_conclusion.text.trim().isNotEmpty ? 2 : 1));
    return Scaffold(
      appBar: AppBar(title: const Text('Bài tập')),
      body: GestureDetector(
        onTap: () => FocusScope.of(context).unfocus(),
        child: ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 32), children: [
          _header(p),
          const SizedBox(height: 14),
          _Stepper(steps: steps, current: step),
          const SizedBox(height: 14),
          if (a.feedback != null || (a.score != null && !a.retryAllowed)) ...[_result(p), const SizedBox(height: 12)],
          if (a.retryAllowed) ...[
            _note(p, Icons.replay_rounded, 'Bài được trả lại. Xem nhận xét và gửi lại bài làm.', p.warning, p.warningSoft),
            const SizedBox(height: 12),
          ],
          Section(
            title: 'Yêu cầu',
            icon: Icons.menu_book_rounded,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (a.description != null && a.description!.trim().isNotEmpty && a.description != a.prompt) ...[
                Text(a.description!, style: const TextStyle(height: 1.45)),
                const SizedBox(height: 8),
              ],
              Text(a.prompt.isEmpty ? 'Quan sát mô phỏng và trả lời theo hướng dẫn của giáo viên.' : a.prompt,
                  style: const TextStyle(height: 1.45)),
            ]),
          ),
          const SizedBox(height: 12),
          if (a.needsPrediction) _predictionForm(p) else ...[
            Section(title: steps[1], icon: Icons.science_outlined, child: _simulation(p)),
            const SizedBox(height: 12),
            _answer(p, steps[2]),
          ],
        ]),
      ),
    );
  }

  Widget _header(Palette p) {
    final a = _a;
    Widget meta(IconData icon, String label, String value, {Color? color}) => Expanded(
          child: Row(children: [
            Icon(icon, size: 18, color: color ?? p.muted),
            const SizedBox(width: 8),
            Flexible(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(label, style: TextStyle(color: p.muted, fontSize: 12)),
                Text(value, style: TextStyle(fontWeight: FontWeight.w600, color: color ?? p.ink)),
              ]),
            ),
          ]),
        );
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      if (a.className != null) Pill(a.className!, tone: Tone.accent),
      const SizedBox(height: 8),
      Text(a.title, style: Theme.of(context).textTheme.titleLarge),
      if (a.assignedByName != null) ...[
        const SizedBox(height: 2),
        Text('Giáo viên: ${a.assignedByName}', style: TextStyle(color: p.muted)),
      ],
      const SizedBox(height: 12),
      Row(children: [
        meta(Icons.event_rounded, 'Hạn nộp', a.dueAt == null ? 'Không giới hạn' : formatDateTime(a.dueAt),
            color: a.overdue ? p.danger : null),
        meta(Icons.grade_outlined, 'Thang điểm', formatScore(a.maxScore)),
      ]),
    ]);
  }

  Widget _result(Palette p) {
    final a = _a;
    return Card(
      color: p.accentSoft,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (a.score != null && !a.retryAllowed) ...[
            Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text(formatScore(a.score!),
                  style: TextStyle(fontSize: 34, fontWeight: FontWeight.w800, color: p.accent, height: 1)),
              Text(' / ${formatScore(a.maxScore)}', style: TextStyle(fontSize: 16, color: p.muted)),
              const Spacer(),
              Pill(a.gradingStatus == 'TEACHER_CONFIRMED' ? 'Đã xác nhận' : 'Tạm tính · chờ xác nhận',
                  tone: a.gradingStatus == 'TEACHER_CONFIRMED' ? Tone.success : Tone.warning),
            ]),
            if (a.feedback != null) const SizedBox(height: 12),
          ],
          if (a.feedback != null) ...[
            Text('Nhận xét của giáo viên', style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 4),
            Text(a.feedback!, style: const TextStyle(height: 1.45)),
          ],
        ]),
      ),
    );
  }

  Widget _note(Palette p, IconData icon, String text, Color fg, Color bg) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
        child: Row(children: [
          Icon(icon, color: fg, size: 20),
          const SizedBox(width: 10),
          Expanded(child: Text(text, style: TextStyle(color: fg))),
        ]),
      );

  Widget _predictionForm(Palette p) {
    final busy = _sendingPrediction;
    return Section(
      title: 'Dự đoán',
      icon: Icons.lightbulb_outline_rounded,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text('Trước khi xem mô phỏng, hãy dự đoán kết quả. Mô phỏng sẽ mở sau khi bạn gửi.',
            style: TextStyle(color: p.muted, height: 1.4)),
        const SizedBox(height: 14),
        TextField(
          controller: _prediction,
          enabled: !busy,
          minLines: 3,
          maxLines: 8,
          maxLength: 4000,
          decoration: const InputDecoration(
              labelText: 'Dự đoán kết quả *', hintText: 'Kết quả bạn dự đoán từ dữ kiện của đề bài…',
              alignLabelWithHint: true),
        ),
        const SizedBox(height: 4),
        TextField(
          controller: _reasoning,
          enabled: !busy,
          minLines: 2,
          maxLines: 6,
          maxLength: 4000,
          decoration: const InputDecoration(
              labelText: 'Lập luận hoặc công thức (không bắt buộc)', alignLabelWithHint: true),
        ),
        if (_a.autoGrade) ...[
          const SizedBox(height: 4),
          TextField(
            controller: _estimate,
            enabled: !busy,
            keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
            decoration: const InputDecoration(
                labelText: 'Kết quả dự đoán bằng số *', helperText: 'Dùng đơn vị trong đề bài.'),
          ),
        ],
        if (_predictionError != null) ...[
          const SizedBox(height: 10),
          Text(_predictionError!, style: TextStyle(color: p.danger)),
        ],
        const SizedBox(height: 16),
        FilledButton.icon(
          onPressed: busy ? null : _sendPrediction,
          icon: busy
              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2.2))
              : const Icon(Icons.lock_open_rounded),
          label: const Text('Gửi dự đoán & mở mô phỏng'),
        ),
      ]),
    );
  }

  Widget _simulation(Palette p) {
    if (_simLoading) {
      return const Padding(padding: EdgeInsets.symmetric(vertical: 40), child: Center(child: CircularProgressIndicator()));
    }
    if (_simError != null) {
      return Column(children: [
        Text(_simError!, style: TextStyle(color: p.danger), textAlign: TextAlign.center),
        const SizedBox(height: 8),
        OutlinedButton(onPressed: _loadSimulation, child: const Text('Thử lại')),
      ]);
    }
    if (_sceneMissing) {
      return Text('Bài này dùng bản lưu cũ chưa có hình minh hoạ. Hãy mở trên bản web để xem.',
          style: TextStyle(color: p.muted));
    }
    final scene = _scene;
    if (scene == null) return const SizedBox(height: 40);
    return SimulationPlayer(scene: scene);
  }

  Widget _answer(Palette p, String title) {
    final a = _a;
    final measurement = a.measurement;
    final investigation = a.investigation;
    final busy = _submitting;
    return Section(
      title: a.done ? 'Bài đã nộp' : title,
      icon: Icons.edit_note_rounded,
      trailing: a.done ? const Pill('Đã nộp', tone: Tone.success) : null,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (a.activity == ActivityType.measurement && measurement != null)
          _task(p, 'Nhiệm vụ đo', '${measurement.seriesLabel} tại t = ${formatNumber(measurement.sampleTime)} s',
              'Đơn vị: ${measurement.unit.isEmpty ? 'không đơn vị' : measurement.unit} · Sai số: ±${formatNumber(measurement.tolerance)}'),
        if (a.activity == ActivityType.parameterInvestigation && investigation != null)
          _task(p, 'Nhiệm vụ khảo sát', 'Thay đổi ${investigation.parameterLabel}',
              investigation.outcomeLabel == null ? null : 'Quan sát ${investigation.outcomeLabel}'),
        if (a.activity == ActivityType.predictObserveExplain && asString(a.predictions['answerText']) != null) ...[
          Text('Dự đoán đã gửi', style: TextStyle(color: p.muted, fontSize: 12)),
          const SizedBox(height: 4),
          Text(a.predictions['answerText'].toString(), style: const TextStyle(height: 1.4)),
          const SizedBox(height: 14),
        ],
        if (a.done) ...[
          Text('Kết luận', style: TextStyle(color: p.muted, fontSize: 12)),
          const SizedBox(height: 4),
          Text(asString(a.predictions['conclusion']) ?? _conclusion.text, style: const TextStyle(height: 1.45)),
          if (a.completedAt != null) ...[
            const SizedBox(height: 8),
            Text('Nộp lúc ${formatDateTime(a.completedAt)}', style: TextStyle(color: p.muted, fontSize: 12)),
          ],
        ] else ...[
          if (a.activity == ActivityType.measurement) ...[
            TextField(
              controller: _estimate,
              enabled: !busy,
              keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
              decoration: InputDecoration(labelText: 'Kết quả đo (${measurement?.unit ?? 'giá trị số'}) *'),
            ),
            const SizedBox(height: 12),
          ],
          TextField(
            controller: _conclusion,
            enabled: !busy && !a.closed,
            minLines: 4,
            maxLines: 10,
            maxLength: 4000,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              labelText: 'Kết luận *',
              alignLabelWithHint: true,
              hintText: a.activity == ActivityType.predictObserveExplain
                  ? 'So sánh quan sát với dự đoán và giải thích kết quả…'
                  : 'Ghi kết quả quan sát và giải thích…',
            ),
          ),
          if (_submitError != null) ...[
            const SizedBox(height: 8),
            Text(_submitError!, style: TextStyle(color: p.danger)),
          ],
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: busy || a.closed || _conclusion.text.trim().isEmpty ? null : _submit,
            icon: busy
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2.2))
                : const Icon(Icons.send_rounded),
            label: Text(a.closed ? 'Bài đã đóng' : (a.overdue ? 'Nộp muộn' : 'Nộp bài')),
          ),
        ],
      ]),
    );
  }

  Widget _task(Palette p, String title, String main, String? detail) => Container(
        margin: const EdgeInsets.only(bottom: 14),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: p.accentSoft, borderRadius: BorderRadius.circular(10)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: TextStyle(color: p.accent, fontWeight: FontWeight.w700, fontSize: 13)),
          const SizedBox(height: 4),
          Text(main, style: const TextStyle(fontWeight: FontWeight.w600)),
          if (detail != null) ...[
            const SizedBox(height: 2),
            Text(detail, style: TextStyle(color: p.muted, fontSize: 12)),
          ],
        ]),
      );
}

class _Stepper extends StatelessWidget {
  const _Stepper({required this.steps, required this.current});
  final List<String> steps;
  final int current;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Row(children: [
      for (var i = 0; i < steps.length; i++) ...[
        Expanded(
          child: Column(children: [
            Row(children: [
              Expanded(child: Container(height: 2, color: i == 0 ? Colors.transparent : (i <= current ? p.accent : p.line))),
              Container(
                width: 26,
                height: 26,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: i < current ? p.accent : (i == current ? p.accentSoft : p.surface),
                  border: Border.all(color: i <= current ? p.accent : p.line, width: 1.5),
                ),
                child: i < current
                    ? const Icon(Icons.check_rounded, size: 16, color: Colors.white)
                    : Text('${i + 1}',
                        style: TextStyle(
                            fontSize: 12, fontWeight: FontWeight.w700, color: i == current ? p.accent : p.muted)),
              ),
              Expanded(
                  child: Container(
                      height: 2, color: i == steps.length - 1 ? Colors.transparent : (i < current ? p.accent : p.line))),
            ]),
            const SizedBox(height: 6),
            Text(steps[i],
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: i == current ? FontWeight.w700 : FontWeight.w500,
                    color: i <= current ? p.ink : p.muted)),
          ]),
        ),
      ],
    ]);
  }
}
