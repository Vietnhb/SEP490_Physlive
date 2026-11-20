import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';

/// An assignment the teacher gave: who handed in, the work, and grading.
class TeacherAssignmentScreen extends StatefulWidget {
  const TeacherAssignmentScreen({super.key, required this.assignment});
  final Assignment assignment;

  @override
  State<TeacherAssignmentScreen> createState() => _TeacherAssignmentScreenState();
}

class _TeacherAssignmentScreenState extends State<TeacherAssignmentScreen> {
  late Assignment _a = widget.assignment;
  int _reload = 0;
  bool _toggling = false;

  Future<List<Submission>> _load() async {
    final items =
        asJsonList(await SessionScope.api(context).get('/assignments/${_a.id}/submissions')).map(Submission.new).toList();
    // work waiting for a grade first, then the newest
    int rank(Submission s) => s.completed && s.gradingStatus != 'TEACHER_CONFIRMED' && !s.retryAllowed ? 0 : 1;
    items.sort((a, b) {
      final byRank = rank(a).compareTo(rank(b));
      return byRank != 0 ? byRank : (b.completedAt ?? b.submittedAt ?? DateTime(0)).compareTo(a.completedAt ?? a.submittedAt ?? DateTime(0));
    });
    return items;
  }

  Future<void> _toggleOpen() async {
    final open = _a.closed;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(open ? 'Mở lại bài?' : 'Đóng bài?'),
        content: Text(open ? 'Học sinh có thể nộp bài trở lại.' : 'Học sinh sẽ không nộp được bài nữa.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Huỷ')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: Text(open ? 'Mở lại' : 'Đóng bài')),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() => _toggling = true);
    try {
      final data = asJson(await SessionScope.api(context).post('/assignments/${_a.id}/${open ? 'open' : 'close'}'));
      if (mounted) setState(() => _a = Assignment({..._a.json, ...data}));
    } catch (error) {
      if (mounted) showMessage(context, errorText(error), error: true);
    } finally {
      if (mounted) setState(() => _toggling = false);
    }
  }

  Future<void> _grade(Submission submission) async {
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      useSafeArea: true,
      builder: (_) => _GradeSheet(assignment: _a, submission: submission),
    );
    if (changed == true && mounted) setState(() => _reload++);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final a = _a;
    return Scaffold(
      appBar: AppBar(
        title: Text(a.title, maxLines: 1, overflow: TextOverflow.ellipsis),
        actions: [
          PopupMenuButton<String>(
            enabled: !_toggling,
            onSelected: (_) => _toggleOpen(),
            itemBuilder: (_) => [
              PopupMenuItem(value: 'toggle', child: Text(a.closed ? 'Mở lại bài' : 'Đóng bài')),
            ],
          ),
        ],
      ),
      body: Loader<List<Submission>>(
        load: _load,
        reloadKey: _reload,
        builder: (context, items, reload) {
          final handedIn = items.where((s) => s.completed).length;
          final waiting = items.where((s) => s.completed && s.gradingStatus != 'TEACHER_CONFIRMED' && !s.retryAllowed).length;
          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 24), children: [
              Wrap(spacing: 6, runSpacing: 6, children: [
                if (a.className != null) Pill(a.className!, tone: Tone.accent),
                a.closed ? const Pill('Đã đóng') : const Pill('Đang mở', tone: Tone.success),
                if (a.dueAt != null) Pill('Hạn ${formatDateTime(a.dueAt)}'),
              ]),
              if (a.prompt.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text(a.prompt, style: TextStyle(color: p.muted, height: 1.4)),
              ],
              const SizedBox(height: 14),
              Row(children: [
                _Stat(label: 'Đã nộp', value: '$handedIn/${a.studentCount}'),
                const SizedBox(width: 10),
                _Stat(label: 'Chờ chấm', value: '$waiting', highlight: waiting > 0),
              ]),
              const SizedBox(height: 16),
              Text('Bài làm', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              if (items.isEmpty)
                const Padding(
                  padding: EdgeInsets.only(top: 24),
                  child: EmptyState(icon: Icons.hourglass_empty_rounded, title: 'Chưa có học sinh nào làm bài'),
                )
              else
                Card(
                  clipBehavior: Clip.antiAlias,
                  child: Column(children: [
                    for (var i = 0; i < items.length; i++) ...[
                      if (i > 0) const Divider(indent: 16, endIndent: 16),
                      _SubmissionTile(submission: items[i], onTap: () => _grade(items[i])),
                    ],
                  ]),
                ),
            ]),
          );
        },
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value, this.highlight = false});
  final String label, value;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: highlight ? p.warningSoft : p.surface,
          border: Border.all(color: highlight ? Colors.transparent : p.line),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: TextStyle(color: highlight ? p.warning : p.muted, fontSize: 12)),
          const SizedBox(height: 2),
          Text(value,
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: highlight ? p.warning : p.ink)),
        ]),
      ),
    );
  }
}

/// The given name's first letter (the last word that starts with a letter: "Test 10A1 04" → T).
String _initial(String name) {
  final words = name.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty && RegExp(r'^\p{L}', unicode: true).hasMatch(w));
  return words.isEmpty ? '?' : words.last.characters.first.toUpperCase();
}

class _SubmissionTile extends StatelessWidget {
  const _SubmissionTile({required this.submission, required this.onTap});
  final Submission submission;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final s = submission;
    final Pill status;
    if (s.retryAllowed) {
      status = const Pill('Đã trả lại', tone: Tone.warning);
    } else if (!s.completed) {
      status = const Pill('Đang làm');
    } else if (s.gradingStatus == 'TEACHER_CONFIRMED') {
      status = Pill('${formatScore(s.score ?? 0)}/${formatScore(s.maxScore)}', tone: Tone.success);
    } else if (s.gradingStatus == 'AI_GRADED' && s.score != null) {
      status = Pill('Tạm: ${formatScore(s.score!)} · chờ xác nhận', tone: Tone.accent);
    } else {
      status = const Pill('Chờ chấm', tone: Tone.warning);
    }
    return ListTile(
      onTap: s.completed ? onTap : null,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      leading: CircleAvatar(
        backgroundColor: p.accentSoft,
        child: Text(_initial(s.studentName),
            style: TextStyle(color: p.accent, fontWeight: FontWeight.w700)),
      ),
      title: Text(s.studentName, style: const TextStyle(fontWeight: FontWeight.w600)),
      subtitle: Text(
        s.completed ? 'Nộp ${formatDateTime(s.completedAt)}' : 'Đã gửi dự đoán ${formatDateTime(s.submittedAt)}',
        style: TextStyle(color: p.muted, fontSize: 12),
      ),
      trailing: status,
    );
  }
}

/// The student's work and the grade: score, comment, and confirm or send back.
class _GradeSheet extends StatefulWidget {
  const _GradeSheet({required this.assignment, required this.submission});
  final Assignment assignment;
  final Submission submission;

  @override
  State<_GradeSheet> createState() => _GradeSheetState();
}

class _GradeSheetState extends State<_GradeSheet> {
  late final _score = TextEditingController(text: widget.submission.score == null ? '' : formatScore(widget.submission.score!));
  late final _feedback = TextEditingController(text: widget.submission.feedback ?? '');
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _score.dispose();
    _feedback.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final max = widget.submission.maxScore;
    final score = double.tryParse(_score.text.trim().replaceAll(',', '.'));
    if (score == null || score < 0 || score > max) {
      setState(() => _error = 'Điểm từ 0 đến ${formatScore(max)}.');
      return;
    }
    await _run(() => SessionScope.api(context).put(
        '/assignments/${widget.assignment.id}/submissions/${widget.submission.id}/grade',
        {'score': score, 'feedback': _feedback.text.trim(), 'confirm': true}));
  }

  Future<void> _sendBack() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Trả bài để học sinh làm lại?'),
        content: const Text('Học sinh sẽ được sửa và nộp lại bài này.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Huỷ')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Trả bài')),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    await _run(() => SessionScope.api(context)
        .post('/assignments/${widget.assignment.id}/submissions/${widget.submission.id}/reopen'));
  }

  Future<void> _run(Future<dynamic> Function() action) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      if (mounted) setState(() => _error = errorText(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final s = widget.submission;
    final work = s.predictions;
    Widget field(String label, Object? value) {
      final text = asString(value);
      if (text == null || text.trim().isEmpty) return const SizedBox.shrink();
      return Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: TextStyle(color: p.muted, fontSize: 12)),
          const SizedBox(height: 3),
          Text(text, style: const TextStyle(height: 1.45)),
        ]),
      );
    }

    final estimate = asDouble(work['estimatedValue']);
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(s.studentName, style: Theme.of(context).textTheme.titleLarge),
          Text('Nộp ${formatDateTime(s.completedAt)}', style: TextStyle(color: p.muted)),
          const SizedBox(height: 16),
          field('Dự đoán', widget.assignment.activity == ActivityType.predictObserveExplain ? work['answerText'] : null),
          field('Lập luận', work['reasoning']),
          if (estimate != null) field('Giá trị số', formatNumber(estimate)),
          field('Kết luận', work['conclusion']),
          if (s.gradingStatus == 'AI_GRADED')
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: p.accentSoft, borderRadius: BorderRadius.circular(10)),
              child: Text('Điểm này mới lưu tạm, chưa xác nhận. Lưu để xác nhận.', style: TextStyle(color: p.accent)),
            ),
          const Divider(),
          const SizedBox(height: 14),
          TextField(
            controller: _score,
            enabled: !_busy,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))],
            decoration: InputDecoration(labelText: 'Điểm', suffixText: '/ ${formatScore(s.maxScore)}'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _feedback,
            enabled: !_busy,
            minLines: 3,
            maxLines: 8,
            maxLength: 4000,
            decoration: const InputDecoration(labelText: 'Nhận xét', alignLabelWithHint: true),
          ),
          if (_error != null) Text(_error!, style: TextStyle(color: p.danger)),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: _busy ? null : _save,
            child: _busy
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4))
                : const Text('Lưu điểm'),
          ),
          const SizedBox(height: 8),
          if (!s.retryAllowed)
            OutlinedButton(onPressed: _busy ? null : _sendBack, child: const Text('Trả bài để làm lại')),
        ]),
      ),
    );
  }
}
