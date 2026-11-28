import 'package:flutter/material.dart';

import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import 'student_assignment_screen.dart';

enum _Filter { todo, overdue, done, all }

/// The student's assignments: how far along they are, what is due next, and a search over everything.
class StudentAssignmentsScreen extends StatefulWidget {
  const StudentAssignmentsScreen({super.key});

  @override
  State<StudentAssignmentsScreen> createState() => _StudentAssignmentsScreenState();
}

class _StudentAssignmentsScreenState extends State<StudentAssignmentsScreen> {
  _Filter _filter = _Filter.todo;
  String _query = '';
  int _reload = 0;

  Future<List<Assignment>> _load() async {
    final data = await SessionScope.api(context).get('/assignments/mine/student');
    final items = asJsonList(data).map(Assignment.new).toList();
    // what is due soonest first; work without a deadline after it
    items.sort((a, b) {
      final ad = a.dueAt, bd = b.dueAt;
      if (ad == null && bd == null) return (b.assignedAt ?? DateTime(0)).compareTo(a.assignedAt ?? DateTime(0));
      if (ad == null) return 1;
      if (bd == null) return -1;
      return ad.compareTo(bd);
    });
    return items;
  }

  Future<void> _open(Assignment assignment) async {
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => StudentAssignmentScreen(assignment: assignment)));
    if (mounted) setState(() => _reload++);
  }

  bool _matches(Assignment a) {
    if (_query.isEmpty) return true;
    final text = '${a.title} ${a.className ?? ''} ${a.assignedByName ?? ''} ${a.libraryItemTitle ?? ''}'.toLowerCase();
    return text.contains(_query.toLowerCase());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const HeroBar(
        title: 'Bài tập được giao',
        subtitle: 'Tập trung vào bài cần làm hôm nay.',
        art: Art.notebook,
      ),
      body: Loader<List<Assignment>>(
        load: _load,
        reloadKey: _reload,
        skeleton: const SkeletonList(withStats: true),
        builder: (context, items, reload) {
          final todo = items.where((a) => !a.done && !a.overdue).toList();
          final overdue = items.where((a) => a.overdue).toList();
          final done = items.where((a) => a.done).toList();
          final shown = switch (_filter) {
            _Filter.todo => todo,
            _Filter.overdue => overdue,
            _Filter.done => done,
            _Filter.all => items,
          }.where(_matches).toList();
          final next = todo.where((a) => a.dueAt != null).firstOrNull;
          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 28), children: [
              _ProgressCard(total: items.length, done: done.length, overdue: overdue.length, next: next, onOpen: _open),
              const SizedBox(height: 14),
              SearchBox(hint: 'Tìm bài theo tên, lớp, giáo viên', onChanged: (v) => setState(() => _query = v)),
              const SizedBox(height: 10),
              ChoiceRow<_Filter>(
                selected: _filter,
                onSelected: (f) => setState(() => _filter = f),
                options: [
                  (_Filter.todo, 'Cần làm', todo.length),
                  (_Filter.overdue, 'Quá hạn', overdue.length),
                  (_Filter.done, 'Đã nộp', done.length),
                  (_Filter.all, 'Tất cả', items.length),
                ],
              ),
              const SizedBox(height: 12),
              if (shown.isEmpty)
                EmptyState(
                  art: _query.isNotEmpty ? Art.empty : (_filter == _Filter.todo ? Art.success : Art.empty),
                  title: _query.isNotEmpty
                      ? 'Không có bài nào khớp "$_query"'
                      : switch (_filter) {
                          _Filter.todo => 'Không còn bài cần làm',
                          _Filter.overdue => 'Không có bài quá hạn',
                          _Filter.done => 'Chưa nộp bài nào',
                          _Filter.all => 'Chưa có bài tập',
                        },
                  message: _query.isEmpty && _filter == _Filter.todo ? 'Bài mới giáo viên giao sẽ hiện ở đây.' : null,
                )
              else
                for (final item in shown) ...[
                  _AssignmentCard(assignment: item, onTap: () => _open(item)),
                  const SizedBox(height: 10),
                ],
            ]),
          );
        },
      ),
    );
  }
}

/// How much of the work is handed in, and the next deadline.
class _ProgressCard extends StatelessWidget {
  const _ProgressCard({required this.total, required this.done, required this.overdue, required this.next, required this.onOpen});
  final int total, done, overdue;
  final Assignment? next;
  final void Function(Assignment) onOpen;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final ratio = total == 0 ? 0.0 : done / total;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [p.teal.bg, p.blue.bg],
        ),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          SizedBox(
            width: 64,
            height: 64,
            child: Stack(fit: StackFit.expand, children: [
              CircularProgressIndicator(
                value: ratio,
                strokeWidth: 7,
                strokeCap: StrokeCap.round,
                color: p.accent,
                backgroundColor: p.surface.withValues(alpha: 0.7),
              ),
              Center(child: Text('${(ratio * 100).round()}%', style: TextStyle(fontWeight: FontWeight.w800, color: p.ink))),
            ]),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Đã nộp $done/$total bài', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 4),
              Text(
                overdue > 0 ? '$overdue bài đã quá hạn, làm sớm nhé' : (total == done ? 'Bạn đã hoàn thành hết bài' : 'Đang đúng tiến độ'),
                style: TextStyle(color: overdue > 0 ? p.danger : p.muted, fontSize: 13),
              ),
            ]),
          ),
        ]),
        if (next != null) ...[
          const SizedBox(height: 14),
          Material(
            color: p.surface,
            borderRadius: BorderRadius.circular(14),
            child: InkWell(
              borderRadius: BorderRadius.circular(14),
              onTap: () => onOpen(next!),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 10, 8, 10),
                child: Row(children: [
                  Icon(Icons.flag_rounded, color: p.amber.fg, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('Hạn gần nhất · ${formatDue(next!.dueAt!)}',
                          style: TextStyle(color: p.amber.fg, fontSize: 12, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 2),
                      Text(next!.title, maxLines: 1, overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.w600)),
                    ]),
                  ),
                  Icon(Icons.chevron_right_rounded, color: p.muted),
                ]),
              ),
            ),
          ),
        ],
      ]),
    );
  }
}

class _AssignmentCard extends StatelessWidget {
  const _AssignmentCard({required this.assignment, required this.onTap});
  final Assignment assignment;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final a = assignment;
    final Pill status;
    if (a.done && a.score != null) {
      status = Pill('${formatScore(a.score!)}/${formatScore(a.maxScore)} điểm',
          tone: a.gradingStatus == 'TEACHER_CONFIRMED' ? Tone.success : Tone.accent);
    } else if (a.done) {
      status = const Pill('Chờ chấm', tone: Tone.info);
    } else if (a.retryAllowed) {
      status = const Pill('Được làm lại', tone: Tone.warning);
    } else if (a.closed) {
      status = const Pill('Đã đóng');
    } else if (a.overdue) {
      status = const Pill('Quá hạn', tone: Tone.danger);
    } else if (a.predictionSubmitted) {
      status = const Pill('Đang làm', tone: Tone.accent);
    } else {
      status = const Pill('Chưa làm');
    }
    final art = Art.forSimulation(null, '${a.libraryItemTitle ?? ''} ${a.title}');
    return ListCard(
      onTap: onTap,
      leading: Container(
        width: 52,
        height: 52,
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(color: p.surface2, borderRadius: BorderRadius.circular(14)),
        child: ArtImage(art),
      ),
      title: a.title,
      subtitle: [a.className, a.assignedByName].whereType<String>().join(' · '),
      trailing: status,
      footer: MetaLine(
        icon: a.overdue ? Icons.error_outline_rounded : Icons.schedule_rounded,
        color: a.overdue ? p.danger : null,
        text: a.dueAt == null
            ? 'Không giới hạn thời gian'
            : a.done
                ? 'Hạn ${formatDateTime(a.dueAt)}'
                : '${formatDue(a.dueAt!)} · ${formatDateTime(a.dueAt)}',
        trailing: Icon(Icons.chevron_right_rounded, color: p.muted, size: 20),
      ),
    );
  }
}
