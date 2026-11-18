import 'package:flutter/material.dart';

import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import 'student_assignment_screen.dart';

enum _Filter { todo, done }

class StudentAssignmentsScreen extends StatefulWidget {
  const StudentAssignmentsScreen({super.key});

  @override
  State<StudentAssignmentsScreen> createState() => _StudentAssignmentsScreenState();
}

class _StudentAssignmentsScreenState extends State<StudentAssignmentsScreen> {
  _Filter _filter = _Filter.todo;
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

  @override
  Widget build(BuildContext context) {
    final user = SessionScope.of(context).user!;
    return Scaffold(
      appBar: AppBar(title: Text('Chào ${user.fullName.split(' ').last}')),
      body: Loader<List<Assignment>>(
        load: _load,
        reloadKey: _reload,
        builder: (context, items, reload) {
          final todo = items.where((a) => !a.done).toList();
          final done = items.where((a) => a.done).toList();
          final shown = _filter == _Filter.todo ? todo : done;
          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 24), children: [
              SegmentedButton<_Filter>(
                showSelectedIcon: false,
                segments: [
                  ButtonSegment(value: _Filter.todo, label: Text('Cần làm (${todo.length})')),
                  ButtonSegment(value: _Filter.done, label: Text('Đã nộp (${done.length})')),
                ],
                selected: {_filter},
                onSelectionChanged: (value) => setState(() => _filter = value.first),
              ),
              const SizedBox(height: 14),
              if (shown.isEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 40),
                  child: EmptyState(
                    icon: _filter == _Filter.todo ? Icons.task_alt_rounded : Icons.inbox_outlined,
                    title: _filter == _Filter.todo ? 'Không còn bài cần làm' : 'Chưa nộp bài nào',
                    message: _filter == _Filter.todo ? 'Bài mới giáo viên giao sẽ hiện ở đây.' : null,
                  ),
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
      status = const Pill('Đã nộp · chờ chấm', tone: Tone.success);
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
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(
                child: Text(a.title,
                    maxLines: 2, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.titleMedium),
              ),
              const SizedBox(width: 8),
              status,
            ]),
            if (a.className != null || a.assignedByName != null) ...[
              const SizedBox(height: 4),
              Text([a.className, a.assignedByName].whereType<String>().join(' · '),
                  style: TextStyle(color: p.muted, fontSize: 13)),
            ],
            const SizedBox(height: 10),
            Row(children: [
              Icon(Icons.schedule_rounded, size: 16, color: a.overdue ? p.danger : p.muted),
              const SizedBox(width: 6),
              Text(
                a.dueAt == null
                    ? 'Không giới hạn thời gian'
                    : a.done
                        ? 'Hạn ${formatDateTime(a.dueAt)}'
                        : '${formatDue(a.dueAt!)} · ${formatDateTime(a.dueAt)}',
                style: TextStyle(color: a.overdue ? p.danger : p.muted, fontSize: 13),
              ),
              const Spacer(),
              Icon(Icons.chevron_right_rounded, color: p.muted),
            ]),
          ]),
        ),
      ),
    );
  }
}
