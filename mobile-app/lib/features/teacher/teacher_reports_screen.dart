import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../account/account_screens.dart';
import '../simulation/export.dart';
import 'teacher_assignment_screen.dart';

/// MTeacherReports — Báo cáo kết quả bài tập theo lớp (KPI, Donut, Line Chart, CSV).
class TeacherReportsScreen extends StatefulWidget {
  const TeacherReportsScreen({super.key, this.initialClassId});
  final String? initialClassId;

  @override
  State<TeacherReportsScreen> createState() => _TeacherReportsScreenState();
}

class _TeacherReportsScreenState extends State<TeacherReportsScreen> {
  List<TeacherClass> _classes = const [];
  String? _classId;
  DateTime? _from;
  DateTime? _to;
  bool _loadingClasses = true;
  String? _classError;
  int _reload = 0;
  bool _showAllItems = false;

  @override
  void initState() {
    super.initState();
    _loadClasses();
  }

  Future<void> _loadClasses() async {
    setState(() {
      _loadingClasses = true;
      _classError = null;
    });
    try {
      final list = asJsonList(await SessionScope.api(context).get('/assignments/mine/teacher/classes'))
          .map(TeacherClass.new)
          .toList()
        ..sort((a, b) => a.name.compareTo(b.name));
      if (!mounted) return;
      setState(() {
        _classes = list;
        _classId = widget.initialClassId ?? (list.isNotEmpty ? list.first.id : null);
        _loadingClasses = false;
      });
    } catch (error) {
      if (mounted) {
        setState(() {
          _classError = errorText(error);
          _loadingClasses = false;
        });
      }
    }
  }

  String _isoDate(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Future<Json> _loadReport() async {
    final id = _classId!;
    final query = <String, String>{
      'size': '50',
      if (_from != null) 'from': _isoDate(_from!),
      if (_to != null) 'to': _isoDate(_to!),
    };
    return asJson(await SessionScope.api(context).get('/assignments/mine/teacher/classes/$id/report', query: query));
  }

  Future<void> _pickDate(bool isFrom) async {
    final initial = (isFrom ? _from : _to) ?? DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2023),
      lastDate: DateTime(2030),
    );
    if (picked == null || !mounted) return;
    setState(() {
      if (isFrom) {
        _from = picked;
      } else {
        _to = picked;
      }
      _reload++;
    });
  }

  Future<void> _exportCsv(String className, List<Json> rows) async {
    String cell(Object? v) => '"${'${v ?? ''}'.replaceAll('"', '""')}"';
    final lines = <String>[
      ['Bai tap', 'Trang thai', 'Da nop', 'Tong HS', 'Cho cham', 'Diem TB'].map(cell).join(','),
      for (final r in rows)
        [
          r['title'],
          r['status'],
          r['submitted'],
          r['recipients'],
          r['awaitingGrade'],
          r['average10'] ?? '',
        ].map(cell).join(','),
    ];
    await SimulationExport.share(
      'bao-cao-$className.csv',
      '\uFEFF${lines.join('\r\n')}',
      'text/csv',
      subject: 'Báo cáo kết quả lớp $className',
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      appBar: const RoleTopBar(subtitle: 'Giảng dạy', showBack: true),
      body: _loadingClasses
          ? const SkeletonList(withStats: true)
          : _classError != null
              ? EmptyState(
                  art: Art.empty,
                  title: 'Không tải được danh sách lớp',
                  message: _classError,
                  action: FilledButton(onPressed: _loadClasses, child: const Text('Thử lại')),
                )
              : _classes.isEmpty
                  ? const EmptyState(art: Art.classes, title: 'Chưa có lớp phụ trách')
                  : Loader<Json>(
                      load: _loadReport,
                      reloadKey: _reload,
                      skeleton: const SkeletonList(withStats: true),
                      builder: (context, report, reload) {
                        final summary = asJson(report['summary']);
                        final items = asJsonList(report['items']);
                        final className = asString(report['className']) ??
                            _classes.firstWhere((c) => c.id == _classId, orElse: () => _classes.first).name;
                        final recipients = asInt(summary['recipients']) ?? 0;
                        final submitted = asInt(summary['submitted']) ?? 0;
                        final notSubmitted = asInt(summary['notSubmitted']) ?? (recipients - submitted).clamp(0, recipients);
                        final awaiting = asInt(summary['awaitingGrade']) ?? 0;
                        final avg10 = asDouble(summary['average10']);
                        final rate = asDouble(summary['submissionRate']) ??
                            (recipients == 0 ? 0.0 : (submitted / recipients) * 100.0);

                        final scorePoints = <({String label, double value})>[
                          for (var i = 0; i < items.length; i++)
                            if (asDouble(items[i]['average10']) != null)
                              (label: 'Bài ${i + 1}', value: asDouble(items[i]['average10'])!),
                        ];

                        return RefreshIndicator(
                          onRefresh: reload,
                          child: ListView(
                            padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
                            children: [
                              Text(
                                'Kết quả bài tập theo lớp',
                                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                                  fontSize: 22,
                                  fontWeight: FontWeight.w800,
                                  color: p.brand,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text('Lọc theo lớp và ngày giao bài.', style: TextStyle(color: p.muted, fontSize: 13)),
                              const SizedBox(height: 14),

                              // Filter card
                              Card(
                                child: Padding(
                                  padding: const EdgeInsets.all(14),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.stretch,
                                    children: [
                                      DropdownButtonFormField<String>(
                                        initialValue: _classId,
                                        borderRadius: BorderRadius.circular(14),
                                        dropdownColor: p.surface,
                                        elevation: 4,
                                        menuMaxHeight: 320,
                                        decoration: const InputDecoration(labelText: 'Lớp báo cáo'),
                                        items: [
                                          for (final c in _classes)
                                            DropdownMenuItem(value: c.id, child: Text('Lớp ${c.name}')),
                                        ],
                                        onChanged: (v) {
                                          if (v == null || v == _classId) return;
                                          setState(() {
                                            _classId = v;
                                            _reload++;
                                          });
                                        },
                                      ),
                                      const SizedBox(height: 10),
                                      Row(
                                        children: [
                                          Expanded(
                                            child: OutlinedButton.icon(
                                              onPressed: () => _pickDate(true),
                                              icon: const Icon(Icons.date_range_rounded, size: 16),
                                              label: Text(_from == null ? 'Từ ngày' : _isoDate(_from!), overflow: TextOverflow.ellipsis),
                                            ),
                                          ),
                                          const SizedBox(width: 8),
                                          Expanded(
                                            child: OutlinedButton.icon(
                                              onPressed: () => _pickDate(false),
                                              icon: const Icon(Icons.date_range_rounded, size: 16),
                                              label: Text(_to == null ? 'Đến ngày' : _isoDate(_to!), overflow: TextOverflow.ellipsis),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              const SizedBox(height: 14),

                              // 4 KPI cards
                              Pair(
                                StatTile(
                                  label: 'Lượt được giao',
                                  value: '$recipients',
                                  detail: '${asInt(summary['assignments']) ?? items.length} bài thực hành',
                                  icon: Icons.assignment_outlined,
                                  tint: p.blue,
                                ),
                                StatTile(
                                  label: 'Đã nộp',
                                  value: '$submitted',
                                  detail: '${rate.round()}% đã hoàn thành',
                                  icon: Icons.check_circle_outline_rounded,
                                  tint: p.green,
                                ),
                              ),
                              const SizedBox(height: 10),
                              Pair(
                                StatTile(
                                  label: 'Chờ chấm',
                                  value: '$awaiting',
                                  detail: 'Cần giáo viên xem xét',
                                  icon: Icons.schedule_rounded,
                                  tint: awaiting > 0 ? p.amber : p.teal,
                                ),
                                StatTile(
                                  label: 'Điểm trung bình',
                                  value: avg10 == null ? '—' : formatScore(avg10),
                                  detail: 'Điểm đã xác nhận / 10',
                                  icon: Icons.show_chart_rounded,
                                  tint: p.violet,
                                ),
                              ),
                              const SizedBox(height: 14),

                              // Donut chart
                              Card(
                                child: Padding(
                                  padding: const EdgeInsets.all(16),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text('Tiến độ nộp bài', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                                      const SizedBox(height: 14),
                                      Row(
                                        children: [
                                          SizedBox(
                                            width: 96,
                                            height: 96,
                                            child: CustomPaint(
                                              painter: _DonutPainter(
                                                ratio: (rate / 100.0).clamp(0.0, 1.0),
                                                color: p.accent,
                                                track: p.surface2,
                                              ),
                                              child: Center(
                                                child: Column(
                                                  mainAxisSize: MainAxisSize.min,
                                                  children: [
                                                    Text('${rate.round()}%', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                                                    Text('đã nộp', style: TextStyle(fontSize: 11, color: p.muted)),
                                                  ],
                                                ),
                                              ),
                                            ),
                                          ),
                                          const SizedBox(width: 18),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                _KvRow('Đã nộp', '$submitted'),
                                                const SizedBox(height: 6),
                                                _KvRow('Chưa nộp', '$notSubmitted'),
                                                if (awaiting > 0) ...[
                                                  const SizedBox(height: 10),
                                                  Pill('$awaiting bài chờ chấm', tone: Tone.warning),
                                                ],
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              ),

                              // Line chart
                              if (scorePoints.isNotEmpty) ...[
                                const SizedBox(height: 14),
                                Card(
                                  child: Padding(
                                    padding: const EdgeInsets.all(16),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text('Điểm qua các bài thực hành', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                                        const SizedBox(height: 12),
                                        SizedBox(
                                          height: 164,
                                          width: double.infinity,
                                          child: CustomPaint(
                                            painter: _ScoreLinePainter(
                                              points: scorePoints,
                                              lineColor: p.accent,
                                              gridColor: p.line,
                                              labelColor: p.muted,
                                              valueColor: p.ink,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],

                              // Per-assignment breakdown + CSV export
                              const SizedBox(height: 14),
                              Card(
                                clipBehavior: Clip.antiAlias,
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.stretch,
                                  children: [
                                    Padding(
                                      padding: const EdgeInsets.fromLTRB(16, 12, 10, 6),
                                      child: Row(
                                        children: [
                                          Expanded(
                                            child: Text(
                                              'Chi tiết từng bài (${items.length})',
                                              style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                                            ),
                                          ),
                                          if (items.length > 4)
                                            TextButton(
                                              onPressed: () => setState(() => _showAllItems = !_showAllItems),
                                              child: Text(_showAllItems ? 'Thu gọn' : 'Hiện tất cả'),
                                            ),
                                        ],
                                      ),
                                    ),
                                    if (items.isEmpty)
                                      Padding(
                                        padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                                        child: Text('Chưa có bài tập nào trong khoảng thời gian này.', style: TextStyle(color: p.muted, fontSize: 13)),
                                      )
                                    else ...[
                                      () {
                                        final visible = _showAllItems ? items : items.take(4).toList();
                                        return Column(
                                          children: [
                                            for (var i = 0; i < visible.length; i++) ...[
                                              if (i > 0) Divider(height: 1, indent: 16, endIndent: 16, color: p.line),
                                              ListTile(
                                                title: Text(
                                                  asString(visible[i]['title']) ?? 'Bài tập',
                                                  maxLines: 1,
                                                  overflow: TextOverflow.ellipsis,
                                                  style: const TextStyle(fontWeight: FontWeight.w600),
                                                ),
                                                subtitle: Text(
                                                  '${visible[i]['submitted'] ?? 0}/${visible[i]['recipients'] ?? 0} đã nộp'
                                                  '${asDouble(visible[i]['average10']) != null ? ' · TB ${formatScore(asDouble(visible[i]['average10'])!)} / 10' : ''}',
                                                  style: TextStyle(color: p.muted, fontSize: 12),
                                                ),
                                                trailing: (asInt(visible[i]['awaitingGrade']) ?? 0) > 0
                                                    ? Pill('${visible[i]['awaitingGrade']} chờ chấm', tone: Tone.warning)
                                                    : null,
                                              ),
                                            ],
                                          ],
                                        );
                                      }(),
                                      if (items.length > 4)
                                        Padding(
                                          padding: const EdgeInsets.fromLTRB(14, 4, 14, 0),
                                          child: TextButton.icon(
                                            onPressed: () => setState(() => _showAllItems = !_showAllItems),
                                            icon: Icon(
                                              _showAllItems ? Icons.expand_less_rounded : Icons.expand_more_rounded,
                                              size: 18,
                                            ),
                                            label: Text(
                                              _showAllItems
                                                  ? 'Ẩn bớt (chỉ hiện 4 bài)'
                                                  : 'Xem thêm ${items.length - 4} bài nữa',
                                            ),
                                          ),
                                        ),
                                    ],
                                    Padding(
                                      padding: const EdgeInsets.all(14),
                                      child: OutlinedButton.icon(
                                        onPressed: items.isEmpty ? null : () => _exportCsv(className, items),
                                        icon: const Icon(Icons.download_rounded, size: 18),
                                        label: const Text('Xuất báo cáo CSV'),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
    );
  }
}

/// MTeacherStudent — Hồ sơ học sinh trong lớp của giáo viên.
class TeacherStudentProfileScreen extends StatefulWidget {
  const TeacherStudentProfileScreen({
    super.key,
    required this.classItem,
    required this.student,
  });
  final TeacherClass classItem;
  final Json student;

  @override
  State<TeacherStudentProfileScreen> createState() => _TeacherStudentProfileScreenState();
}

class _StudentProfileData {
  _StudentProfileData(this.profile, this.results);
  final Json profile;
  final List<({Assignment assignment, Submission? submission})> results;
}

class _TeacherStudentProfileScreenState extends State<TeacherStudentProfileScreen> {
  Future<_StudentProfileData> _load() async {
    final api = SessionScope.api(context);
    final studentId = asInt(widget.student['id']) ?? 0;
    final profileFuture = api
        .get('/assignments/mine/teacher/classes/${widget.classItem.id}/students/$studentId/profile')
        .then<Object?>((v) => v, onError: (_) => widget.student);
    final assignsFuture = api.get('/assignments/mine/teacher').then<Object?>((v) => v, onError: (_) => null);
    final res = await Future.wait([profileFuture, assignsFuture]);
    final profile = asJson(res[0]);
    final classAssigns = asJsonList(res[1])
        .map(Assignment.new)
        .where((a) => a.className == widget.classItem.name)
        .toList()
      ..sort((a, b) => (b.assignedAt ?? DateTime(0)).compareTo(a.assignedAt ?? DateTime(0)));

    final results = <({Assignment assignment, Submission? submission})>[];
    for (final a in classAssigns.take(15)) {
      try {
        final subs = asJsonList(await api.get('/assignments/${a.id}/submissions')).map(Submission.new);
        Submission? match;
        for (final s in subs) {
          if (asInt(s.json['studentId']) == studentId) {
            match = s;
            break;
          }
        }
        results.add((assignment: a, submission: match));
      } catch (_) {
        results.add((assignment: a, submission: null));
      }
    }
    return _StudentProfileData(profile, results);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final fallbackName = asString(widget.student['fullName']) ?? 'Học sinh';
    final fallbackEmail = asString(widget.student['email']) ?? '';

    return Scaffold(
      appBar: const RoleTopBar(subtitle: 'Giảng dạy', showBack: true),
      body: Loader<_StudentProfileData>(
        load: _load,
        builder: (context, data, reload) {
          final name = asString(data.profile['fullName']) ?? fallbackName;
          final email = asString(data.profile['email']) ?? fallbackEmail;
          final avatarUrl = asString(data.profile['avatarUrl']) ?? asString(widget.student['avatarUrl']);
          final dob = asString(data.profile['dateOfBirth']);
          final school = asString(data.profile['schoolName']);
          final total = data.results.length;
          final submitted = data.results.where((r) => r.submission?.completed == true).length;
          final scores = data.results
              .where((r) => r.submission?.gradingStatus == 'TEACHER_CONFIRMED' && r.submission?.score != null)
              .map((r) => r.submission!.score!)
              .toList();
          final avg = scores.isEmpty ? null : scores.reduce((a, b) => a + b) / scores.length;

          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      children: [
                        Avatar(name: name, url: avatarUrl, size: 68),
                        const SizedBox(height: 12),
                        Text(name, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800, color: p.brand)),
                        const SizedBox(height: 4),
                        Text('$email · Lớp ${widget.classItem.name}', style: TextStyle(color: p.muted, fontSize: 13)),
                        const SizedBox(height: 10),
                        const Pill('Đang học', tone: Tone.success),
                        if (dob != null || school != null) ...[
                          const SizedBox(height: 14),
                          Divider(height: 1, color: p.line),
                          const SizedBox(height: 10),
                          if (dob != null) _KvRow('Ngày sinh', dob),
                          if (school != null) ...[
                            const SizedBox(height: 6),
                            _KvRow('Trường', school),
                          ],
                        ],
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Pair(
                  StatTile(
                    label: 'Đã nộp',
                    value: '$submitted / $total',
                    detail: '${total - submitted} bài chưa hoàn thành',
                    icon: Icons.check_rounded,
                    tint: p.teal,
                  ),
                  StatTile(
                    label: 'Điểm trung bình',
                    value: avg == null ? '—' : formatScore(avg),
                    detail: 'Điểm đã xác nhận',
                    icon: Icons.show_chart_rounded,
                    tint: p.blue,
                  ),
                ),
                const SizedBox(height: 14),
                Card(
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
                        child: Text('Kết quả thực hành', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                      ),
                      if (data.results.isEmpty)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                          child: Text('Chưa có bài tập nào của lớp.', style: TextStyle(color: p.muted, fontSize: 13)),
                        )
                      else
                        for (var i = 0; i < data.results.length; i++) ...[
                          if (i > 0) Divider(height: 1, indent: 16, endIndent: 16, color: p.line),
                          _StudentResultTile(
                            assignment: data.results[i].assignment,
                            submission: data.results[i].submission,
                            onTap: () => Navigator.of(context).push(
                              MaterialPageRoute(builder: (_) => TeacherAssignmentScreen(assignment: data.results[i].assignment)),
                            ),
                          ),
                        ],
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _StudentResultTile extends StatelessWidget {
  const _StudentResultTile({required this.assignment, required this.submission, required this.onTap});
  final Assignment assignment;
  final Submission? submission;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final s = submission;
    final String statusText;
    final Tone tone;
    if (s == null || !s.completed) {
      statusText = 'Chưa nộp';
      tone = Tone.neutral;
    } else if (s.gradingStatus == 'TEACHER_CONFIRMED' && s.score != null) {
      statusText = '${formatScore(s.score!)}/${formatScore(s.maxScore)}';
      tone = Tone.success;
    } else {
      statusText = 'Chờ chấm';
      tone = Tone.warning;
    }

    return ListTile(
      onTap: onTap,
      title: Text(assignment.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600)),
      subtitle: Text(
        s?.completed == true ? 'Nộp ${formatDateTime(s!.completedAt)}' : 'Chưa hoàn thành',
        style: TextStyle(color: p.muted, fontSize: 12),
      ),
      trailing: Pill(statusText, tone: tone),
    );
  }
}

/// MTeacherGrades — Tab "Bảng điểm" trong Chi tiết lớp (chọn bài, lọc HS, xuất CSV).
class TeacherClassGradebookTab extends StatefulWidget {
  const TeacherClassGradebookTab({super.key, required this.classItem});
  final TeacherClass classItem;

  @override
  State<TeacherClassGradebookTab> createState() => _TeacherClassGradebookTabState();
}

class _TeacherClassGradebookTabState extends State<TeacherClassGradebookTab> {
  List<Assignment> _assignments = const [];
  Assignment? _selected;
  List<Submission> _submissions = const [];
  String _query = '';
  bool _loading = true;
  bool _loadingSubs = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadAssignments();
  }

  Future<void> _loadAssignments() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final all = asJsonList(await SessionScope.api(context).get('/assignments/mine/teacher')).map(Assignment.new);
      final mine = all.where((a) => a.className == widget.classItem.name).toList()
        ..sort((a, b) => (b.assignedAt ?? DateTime(0)).compareTo(a.assignedAt ?? DateTime(0)));
      if (!mounted) return;
      setState(() {
        _assignments = mine;
        _selected = mine.isNotEmpty ? mine.first : null;
        _loading = false;
      });
      if (_selected != null) await _loadSubs(_selected!);
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = errorText(error);
          _loading = false;
        });
      }
    }
  }

  Future<void> _loadSubs(Assignment a) async {
    setState(() => _loadingSubs = true);
    try {
      final list = asJsonList(await SessionScope.api(context).get('/assignments/${a.id}/submissions'))
          .map(Submission.new)
          .toList();
      if (mounted) setState(() => _submissions = list);
    } catch (_) {
      if (mounted) setState(() => _submissions = const []);
    } finally {
      if (mounted) setState(() => _loadingSubs = false);
    }
  }

  Future<void> _exportCsv() async {
    final a = _selected;
    if (a == null) return;
    final subByStudent = {for (final s in _submissions) asInt(s.json['studentId']): s};
    String cell(Object? v) => '"${'${v ?? ''}'.replaceAll('"', '""')}"';
    final lines = <String>[
      ['Ho va ten', 'Email', 'Trang thai', 'Diem', 'Diem toi da'].map(cell).join(','),
      for (final st in widget.classItem.students)
        () {
          final sub = subByStudent[asInt(st['id'])];
          final status = sub == null || !sub.completed
              ? 'Chua nop'
              : sub.gradingStatus == 'TEACHER_CONFIRMED'
                  ? 'Da cham'
                  : 'Cho cham';
          return [
            asString(st['fullName']) ?? '',
            asString(st['email']) ?? '',
            status,
            sub?.score == null ? '' : formatScore(sub!.score!),
            formatScore(a.maxScore),
          ].map(cell).join(',');
        }(),
    ];
    await SimulationExport.share(
      'bang-diem-${widget.classItem.name}.csv',
      '\uFEFF${lines.join('\r\n')}',
      'text/csv',
      subject: 'Bảng điểm ${widget.classItem.name} - ${a.title}',
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    if (_loading) return const SkeletonList();
    if (_error != null) {
      return EmptyState(
        art: Art.empty,
        title: 'Không tải được bảng điểm',
        message: _error,
        action: FilledButton(onPressed: _loadAssignments, child: const Text('Thử lại')),
      );
    }
    if (_assignments.isEmpty) {
      return const EmptyState(art: Art.assign, title: 'Chưa có bài tập nào cho lớp này');
    }

    final subByStudent = {for (final s in _submissions) asInt(s.json['studentId']): s};
    final q = _query.toLowerCase();
    final students = widget.classItem.students
        .where((s) => q.isEmpty || '${asString(s['fullName']) ?? ''} ${asString(s['email']) ?? ''}'.toLowerCase().contains(q))
        .toList();

    return RefreshIndicator(
      onRefresh: () async {
        if (_selected != null) await _loadSubs(_selected!);
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
        children: [
          DropdownButtonFormField<Assignment>(
            initialValue: _selected,
            isExpanded: true,
            borderRadius: BorderRadius.circular(14),
            dropdownColor: p.surface,
            elevation: 4,
            menuMaxHeight: 320,
            decoration: const InputDecoration(labelText: 'Bài tập'),
            items: [
              for (final a in _assignments)
                DropdownMenuItem(value: a, child: Text(a.title, maxLines: 1, overflow: TextOverflow.ellipsis)),
            ],
            onChanged: (a) {
              if (a == null) return;
              setState(() => _selected = a);
              _loadSubs(a);
            },
          ),
          const SizedBox(height: 12),
          SearchBox(hint: 'Tìm học sinh...', onChanged: (v) => setState(() => _query = v)),
          const SizedBox(height: 12),
          if (_loadingSubs)
            const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator()))
          else
            Card(
              clipBehavior: Clip.antiAlias,
              child: Column(
                children: [
                  for (var i = 0; i < students.length; i++) ...[
                    if (i > 0) Divider(height: 1, indent: 68, color: p.line),
                    () {
                      final st = students[i];
                      final sub = subByStudent[asInt(st['id'])];
                      final Pill badge;
                      if (sub == null || !sub.completed) {
                        badge = const Pill('Chưa nộp');
                      } else if (sub.gradingStatus == 'TEACHER_CONFIRMED' && sub.score != null) {
                        badge = Pill('${formatScore(sub.score!)}/${formatScore(sub.maxScore)}', tone: Tone.success);
                      } else {
                        badge = const Pill('Chờ chấm', tone: Tone.warning);
                      }
                      return ListTile(
                        leading: Avatar(name: asString(st['fullName']) ?? '?', url: asString(st['avatarUrl'])),
                        title: Text(asString(st['fullName']) ?? 'Học sinh', style: const TextStyle(fontWeight: FontWeight.w600)),
                        subtitle: Text(asString(st['email']) ?? '', style: TextStyle(color: p.muted, fontSize: 12)),
                        trailing: badge,
                        onTap: _selected == null
                            ? null
                            : () => Navigator.of(context).push(
                                  MaterialPageRoute(builder: (_) => TeacherAssignmentScreen(assignment: _selected!)),
                                ),
                      );
                    }(),
                  ],
                ],
              ),
            ),
          const SizedBox(height: 14),
          OutlinedButton.icon(
            onPressed: _exportCsv,
            icon: const Icon(Icons.download_rounded, size: 18),
            label: const Text('Xuất điểm CSV'),
          ),
        ],
      ),
    );
  }
}

class _KvRow extends StatelessWidget {
  const _KvRow(this.label, this.value);
  final String label, value;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Row(
      children: [
        Expanded(child: Text(label, style: TextStyle(color: p.muted, fontSize: 13))),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
      ],
    );
  }
}

class _DonutPainter extends CustomPainter {
  _DonutPainter({required this.ratio, required this.color, required this.track});
  final double ratio;
  final Color color, track;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = math.min(size.width, size.height) / 2 - 7;
    final bgPaint = Paint()
      ..color = track
      ..style = PaintingStyle.stroke
      ..strokeWidth = 10;
    final fgPaint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 10
      ..strokeCap = StrokeCap.round;

    canvas.drawCircle(center, radius, bgPaint);
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      -math.pi / 2,
      2 * math.pi * ratio,
      false,
      fgPaint,
    );
  }

  @override
  bool shouldRepaint(covariant _DonutPainter old) => old.ratio != ratio || old.color != color;
}

class _ScoreLinePainter extends CustomPainter {
  _ScoreLinePainter({
    required this.points,
    required this.lineColor,
    required this.gridColor,
    required this.labelColor,
    required this.valueColor,
  });
  final List<({String label, double value})> points;
  final Color lineColor, gridColor, labelColor, valueColor;

  @override
  void paint(Canvas canvas, Size size) {
    const padLeft = 28.0, padRight = 16.0, padTop = 22.0, padBottom = 26.0;
    final w = size.width - padLeft - padRight;
    final h = size.height - padTop - padBottom;

    final gridPaint = Paint()..color = gridColor..strokeWidth = 1;
    for (final entry in const [(0.0, '10'), (0.5, '5'), (1.0, '0')]) {
      final y = padTop + h * entry.$1;
      canvas.drawLine(Offset(padLeft, y), Offset(padLeft + w, y), gridPaint);
      final axisTp = TextPainter(
        text: TextSpan(text: entry.$2, style: TextStyle(color: labelColor, fontSize: 10)),
        textDirection: TextDirection.ltr,
      )..layout();
      axisTp.paint(canvas, Offset(padLeft - axisTp.width - 6, y - axisTp.height / 2));
    }

    final coords = <Offset>[];
    for (var i = 0; i < points.length; i++) {
      final x = points.length == 1 ? padLeft + w / 2 : padLeft + w * (i / (points.length - 1));
      final y = padTop + h * (1 - (points[i].value.clamp(0.0, 10.0) / 10.0));
      coords.add(Offset(x, y));
    }

    if (coords.length >= 2) {
      final fillPath = Path()..moveTo(coords.first.dx, padTop + h);
      for (final c in coords) {
        fillPath.lineTo(c.dx, c.dy);
      }
      fillPath
        ..lineTo(coords.last.dx, padTop + h)
        ..close();
      canvas.drawPath(fillPath, Paint()..color = lineColor.withValues(alpha: 0.12));

      final linePath = Path()..moveTo(coords.first.dx, coords.first.dy);
      for (final c in coords.skip(1)) {
        linePath.lineTo(c.dx, c.dy);
      }
      canvas.drawPath(
        linePath,
        Paint()
          ..color = lineColor
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.4,
      );
    }

    final dotFill = Paint()..color = Colors.white;
    final dotStroke = Paint()..color = lineColor..style = PaintingStyle.stroke..strokeWidth = 2;
    for (var i = 0; i < coords.length; i++) {
      canvas.drawCircle(coords[i], 3.8, dotFill);
      canvas.drawCircle(coords[i], 3.8, dotStroke);

      // Score value label at each point
      final valTp = TextPainter(
        text: TextSpan(
          text: formatScore(points[i].value),
          style: TextStyle(color: valueColor, fontSize: 10.5, fontWeight: FontWeight.w700),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      final valX = (coords[i].dx - valTp.width / 2).clamp(padLeft, size.width - valTp.width - 2);
      final valY = coords[i].dy - valTp.height - 6;
      valTp.paint(canvas, Offset(valX, valY < 0 ? coords[i].dy + 6 : valY));

      // Bottom X label
      final tp = TextPainter(
        text: TextSpan(text: points[i].label, style: TextStyle(color: labelColor, fontSize: 10.5)),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas, Offset((coords[i].dx - tp.width / 2).clamp(padLeft - 4, size.width - tp.width), padTop + h + 7));
    }
  }

  @override
  bool shouldRepaint(covariant _ScoreLinePainter old) => old.points != points;
}
