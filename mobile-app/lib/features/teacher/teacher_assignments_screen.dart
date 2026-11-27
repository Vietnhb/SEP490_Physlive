import 'package:flutter/material.dart';

import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import 'teacher_assignment_screen.dart';

enum _Filter { open, toGrade, late, closed }

typedef _Progress = ({int recipients, int submitted, int awaiting, int confirmed});

class _Data {
  _Data(this.items, this.progress);
  final List<Assignment> items;
  final Map<String, _Progress> progress;
}

/// The teacher's assignments with how many students handed in and how many wait for a grade.
class TeacherAssignmentsScreen extends StatefulWidget {
  const TeacherAssignmentsScreen({super.key});

  @override
  State<TeacherAssignmentsScreen> createState() => _TeacherAssignmentsScreenState();
}

class _TeacherAssignmentsScreenState extends State<TeacherAssignmentsScreen> {
  int _reload = 0;
  _Filter _filter = _Filter.open;
  String _query = '';

  Future<_Data> _load() async {
    final api = SessionScope.api(context);
    final results = await Future.wait([
      api.get('/assignments/mine/teacher'),
      // the counts are a bonus: the list still shows without them
      api.get('/assignments/mine/teacher/progress').then<Object?>((v) => v, onError: (_) => null),
    ]);
    final items = asJsonList(results[0]).map(Assignment.new).toList();
    items.sort((a, b) => (b.assignedAt ?? DateTime(0)).compareTo(a.assignedAt ?? DateTime(0)));
    final progress = <String, _Progress>{
      for (final row in asJsonList(results[1]))
        asString(row['assignmentId']) ?? '': (
          recipients: asInt(row['recipients']) ?? 0,
          submitted: asInt(row['submitted']) ?? 0,
          awaiting: asInt(row['awaitingGrade']) ?? 0,
          confirmed: asInt(row['confirmed']) ?? 0,
        ),
    };
    return _Data(items, progress);
  }

  Future<void> _open(Assignment assignment) async {
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => TeacherAssignmentScreen(assignment: assignment)));
    if (mounted) setState(() => _reload++);
  }

  bool _late(Assignment a) => !a.closed && a.dueAt != null && a.dueAt!.isBefore(DateTime.now());

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      appBar: const HeroBar(title: 'Bài đã giao', subtitle: 'Giảng dạy', art: Art.assign),
      body: Loader<_Data>(
        load: _load,
        reloadKey: _reload,
        skeleton: const SkeletonList(withStats: true),
        builder: (context, data, reload) {
          final items = data.items;
          int awaiting(Assignment a) => data.progress[a.id]?.awaiting ?? 0;
          final open = items.where((a) => !a.closed && !_late(a)).toList();
          final toGrade = items.where((a) => awaiting(a) > 0).toList();
          final late = items.where(_late).toList();
          final closed = items.where((a) => a.closed).toList();
          final query = _query.toLowerCase();
          final shown = switch (_filter) {
            _Filter.open => open,
            _Filter.toGrade => toGrade,
            _Filter.late => late,
            _Filter.closed => closed,
          }.where((a) => query.isEmpty || '${a.title} ${a.className ?? ''}'.toLowerCase().contains(query)).toList();
          final waiting = items.fold<int>(0, (sum, a) => sum + awaiting(a));
          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 28), children: [
              Pair(
                StatTile(
                  label: 'Bài đang mở',
                  value: '${open.length}',
                  detail: '${late.length} đã hết hạn · ${items.length} bài đã giao',
                  icon: Icons.assignment_rounded,
                  tint: p.teal,
                  onTap: () => setState(() => _filter = _Filter.open),
                ),
                StatTile(
                  label: 'Bài nộp chờ chấm',
                  value: '$waiting',
                  detail: '${toGrade.length} bài có bài nộp mới',
                  icon: Icons.rate_review_rounded,
                  tint: waiting > 0 ? p.amber : p.green,
                  onTap: () => setState(() => _filter = _Filter.toGrade),
                ),
              ),
              const SizedBox(height: 14),
              SearchBox(hint: 'Tìm theo tên bài hoặc lớp', onChanged: (v) => setState(() => _query = v)),
              const SizedBox(height: 10),
              ChoiceRow<_Filter>(
                selected: _filter,
                onSelected: (f) => setState(() => _filter = f),
                options: [
                  (_Filter.open, 'Đang mở', open.length),
                  (_Filter.toGrade, 'Cần chấm', toGrade.length),
                  (_Filter.late, 'Hết hạn', late.length),
                  (_Filter.closed, 'Đã đóng', closed.length),
                ],
              ),
              const SizedBox(height: 12),
              if (shown.isEmpty)
                EmptyState(
                  art: _filter == _Filter.toGrade ? Art.success : Art.assign,
                  title: _query.isNotEmpty
                      ? 'Không có bài nào khớp "$_query"'
                      : switch (_filter) {
                          _Filter.open => 'Chưa có bài đang mở',
                          _Filter.toGrade => 'Đã chấm hết bài nộp',
                          _Filter.late => 'Không có bài hết hạn',
                          _Filter.closed => 'Chưa có bài nào đã đóng',
                        },
                  message: _query.isEmpty && _filter == _Filter.open ? 'Giao bài mới từ thư viện trên bản web.' : null,
                )
              else
                for (final item in shown) ...[
                  _TeacherCard(assignment: item, progress: data.progress[item.id], late: _late(item), onTap: () => _open(item)),
                  const SizedBox(height: 10),
                ],
            ]),
          );
        },
      ),
    );
  }
}

class _TeacherCard extends StatelessWidget {
  const _TeacherCard({required this.assignment, required this.progress, required this.late, required this.onTap});
  final Assignment assignment;
  final _Progress? progress;
  final bool late;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final a = assignment;
    final recipients = progress?.recipients ?? a.studentCount;
    final submitted = progress?.submitted ?? 0;
    final ratio = recipients == 0 ? 0.0 : (submitted / recipients).clamp(0.0, 1.0);
    return ListCard(
      onTap: onTap,
      title: a.title,
      subtitle: [a.className ?? 'Học sinh được chọn', '$recipients học sinh'].join(' · '),
      trailing: a.closed
          ? const Pill('Đã đóng')
          : late
              ? const Pill('Hết hạn', tone: Tone.warning)
              : const Pill('Đang mở', tone: Tone.success),
      footer: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Text('Đã nộp $submitted/$recipients', style: TextStyle(color: p.ink, fontSize: 13, fontWeight: FontWeight.w600)),
          const Spacer(),
          if ((progress?.awaiting ?? 0) > 0)
            Text('${progress!.awaiting} chờ chấm', style: TextStyle(color: p.amber.fg, fontSize: 12, fontWeight: FontWeight.w700)),
        ]),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(99),
          child: LinearProgressIndicator(value: ratio, minHeight: 6, color: p.accent, backgroundColor: p.surface2),
        ),
        const SizedBox(height: 10),
        MetaLine(
          icon: Icons.schedule_rounded,
          text: a.dueAt == null ? 'Không giới hạn thời gian' : 'Hạn ${formatDateTime(a.dueAt)}',
          trailing: Icon(Icons.chevron_right_rounded, color: p.muted, size: 20),
        ),
      ]),
    );
  }
}
