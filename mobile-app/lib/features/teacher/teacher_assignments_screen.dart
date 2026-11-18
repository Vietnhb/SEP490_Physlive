import 'package:flutter/material.dart';

import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import 'teacher_assignment_screen.dart';

class TeacherAssignmentsScreen extends StatefulWidget {
  const TeacherAssignmentsScreen({super.key});

  @override
  State<TeacherAssignmentsScreen> createState() => _TeacherAssignmentsScreenState();
}

class _TeacherAssignmentsScreenState extends State<TeacherAssignmentsScreen> {
  int _reload = 0;
  bool _showClosed = false;

  Future<List<Assignment>> _load() async {
    final items = asJsonList(await SessionScope.api(context).get('/assignments/mine/teacher')).map(Assignment.new).toList();
    items.sort((a, b) => (b.assignedAt ?? DateTime(0)).compareTo(a.assignedAt ?? DateTime(0)));
    return items;
  }

  Future<void> _open(Assignment assignment) async {
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => TeacherAssignmentScreen(assignment: assignment)));
    if (mounted) setState(() => _reload++);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Bài đã giao')),
      body: Loader<List<Assignment>>(
        load: _load,
        reloadKey: _reload,
        builder: (context, items, reload) {
          final open = items.where((a) => !a.closed).toList();
          final closed = items.where((a) => a.closed).toList();
          final shown = _showClosed ? closed : open;
          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 24), children: [
              SegmentedButton<bool>(
                showSelectedIcon: false,
                segments: [
                  ButtonSegment(value: false, label: Text('Đang mở (${open.length})')),
                  ButtonSegment(value: true, label: Text('Đã đóng (${closed.length})')),
                ],
                selected: {_showClosed},
                onSelectionChanged: (value) => setState(() => _showClosed = value.first),
              ),
              const SizedBox(height: 14),
              if (shown.isEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 40),
                  child: EmptyState(
                    icon: Icons.assignment_outlined,
                    title: _showClosed ? 'Chưa có bài nào đã đóng' : 'Chưa có bài đang mở',
                    message: _showClosed ? null : 'Giao bài mới từ thư viện trên bản web.',
                  ),
                )
              else
                for (final item in shown) ...[
                  _TeacherCard(assignment: item, onTap: () => _open(item)),
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
  const _TeacherCard({required this.assignment, required this.onTap});
  final Assignment assignment;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final a = assignment;
    final late = a.dueAt != null && a.dueAt!.isBefore(DateTime.now());
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
              a.closed
                  ? const Pill('Đã đóng')
                  : late
                      ? const Pill('Hết hạn', tone: Tone.warning)
                      : const Pill('Đang mở', tone: Tone.success),
            ]),
            const SizedBox(height: 4),
            Text(
              [a.className ?? 'Học sinh được chọn', '${a.studentCount} học sinh'].join(' · '),
              style: TextStyle(color: p.muted, fontSize: 13),
            ),
            const SizedBox(height: 10),
            Row(children: [
              Icon(Icons.schedule_rounded, size: 16, color: p.muted),
              const SizedBox(width: 6),
              Text(a.dueAt == null ? 'Không giới hạn thời gian' : 'Hạn ${formatDateTime(a.dueAt)}',
                  style: TextStyle(color: p.muted, fontSize: 13)),
              const Spacer(),
              Icon(Icons.chevron_right_rounded, color: p.muted),
            ]),
          ]),
        ),
      ),
    );
  }
}
