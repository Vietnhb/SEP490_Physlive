import 'package:flutter/material.dart';

import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../account/account_screens.dart';
import 'teacher_assignment_screen.dart';
import 'teacher_composer_and_lab_screen.dart';
import 'teacher_reports_screen.dart';

class _ClassesData {
  _ClassesData(this.classes, this.assignmentCount, this.awaitingCount);
  final List<TeacherClass> classes;
  final Map<String, int> assignmentCount;
  final Map<String, int> awaitingCount;
}

/// MTeacherClasses — Lớp phụ trách.
class TeacherClassesScreen extends StatefulWidget {
  const TeacherClassesScreen({super.key});

  @override
  State<TeacherClassesScreen> createState() => _TeacherClassesScreenState();
}

class _TeacherClassesScreenState extends State<TeacherClassesScreen> {
  String _query = '';

  Future<_ClassesData> _load() async {
    final api = SessionScope.api(context);
    final results = await Future.wait([
      api.get('/assignments/mine/teacher/classes'),
      api.get('/assignments/mine/teacher').then<Object?>((v) => v, onError: (_) => null),
      api.get('/assignments/mine/teacher/progress').then<Object?>((v) => v, onError: (_) => null),
    ]);
    final classes = asJsonList(results[0]).map(TeacherClass.new).toList()
      ..sort((a, b) => a.name.compareTo(b.name));
    final assignments = asJsonList(results[1]).map(Assignment.new).toList();
    final awaitingByAssign = <String, int>{
      for (final row in asJsonList(results[2]))
        asString(row['assignmentId']) ?? '': asInt(row['awaitingGrade']) ?? 0,
    };
    final assignCount = <String, int>{};
    final awaitingCount = <String, int>{};
    for (final a in assignments) {
      final cname = a.className;
      if (cname == null) continue;
      assignCount[cname] = (assignCount[cname] ?? 0) + 1;
      awaitingCount[cname] = (awaitingCount[cname] ?? 0) + (awaitingByAssign[a.id] ?? 0);
    }
    return _ClassesData(classes, assignCount, awaitingCount);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      appBar: const RoleTopBar(subtitle: 'Giảng dạy'),
      body: Loader<_ClassesData>(
        load: _load,
        skeleton: const SkeletonList(withStats: true),
        builder: (context, data, reload) {
          final classes = data.classes;
          final query = _query.toLowerCase();
          final shown = classes
              .where((c) => query.isEmpty ||
                  c.name.toLowerCase().contains(query) ||
                  (c.schoolYear ?? '').toLowerCase().contains(query) ||
                  c.students.any((s) => (asString(s['fullName']) ?? '').toLowerCase().contains(query)))
              .toList();
          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 28), children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Lớp phụ trách',
                          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                            color: p.brand,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Chọn lớp để giao bài, xem học sinh và chấm điểm.',
                          style: TextStyle(color: p.muted, fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  SizedBox(width: 68, height: 54, child: ArtImage(Art.classes)),
                ],
              ),
              const SizedBox(height: 14),
              SearchBox(hint: 'Tìm lớp hoặc năm học...', onChanged: (v) => setState(() => _query = v)),
              const SizedBox(height: 12),
              if (shown.isEmpty)
                EmptyState(
                  art: Art.classes,
                  title: _query.isEmpty ? 'Chưa được phân công lớp nào' : 'Không có lớp nào khớp "$_query"',
                  message: _query.isEmpty ? 'Nhà trường hoặc tổ trưởng phân công lớp cho bạn.' : null,
                )
              else
                for (final c in shown) ...[
                  _ClassCard(
                    item: c,
                    assignmentsCount: data.assignmentCount[c.name] ?? 0,
                    awaitingCount: data.awaitingCount[c.name] ?? 0,
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => TeacherClassScreen(item: c))),
                  ),
                  const SizedBox(height: 10),
                ],
            ]),
          );
        },
      ),
    );
  }
}

class _ClassCard extends StatelessWidget {
  const _ClassCard({
    required this.item,
    required this.assignmentsCount,
    required this.awaitingCount,
    required this.onTap,
  });
  final TeacherClass item;
  final int assignmentsCount;
  final int awaitingCount;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final eyebrow = [
      (item.subject ?? 'VẬT LÝ').toUpperCase(),
      if (item.schoolYear != null) item.schoolYear!,
    ].join(' · ');

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          eyebrow,
                          style: TextStyle(color: p.muted, fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.4),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          item.name,
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(color: p.blue.bg, shape: BoxShape.circle),
                    child: Icon(Icons.menu_book_rounded, color: p.blue.fg, size: 20),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                '${item.students.length} học sinh · $assignmentsCount bài đã giao',
                style: TextStyle(color: p.muted, fontSize: 13),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  if (awaitingCount > 0)
                    Pill('Có $awaitingCount bài chờ chấm', tone: Tone.warning)
                  else
                    const Pill('Đang hoạt động', tone: Tone.success),
                  const Spacer(),
                  TextButton.icon(
                    onPressed: onTap,
                    icon: const Icon(Icons.arrow_forward_rounded, size: 16),
                    label: const Text('Xem lớp'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// MTeacherClass — Chi tiết lớp (3 tab: Học sinh, Bài đã giao, Bảng điểm).
class TeacherClassScreen extends StatefulWidget {
  const TeacherClassScreen({super.key, required this.item});
  final TeacherClass item;

  @override
  State<TeacherClassScreen> createState() => _TeacherClassScreenState();
}

class _TeacherClassScreenState extends State<TeacherClassScreen> {
  String _query = '';
  int _reload = 0;

  Future<List<Assignment>> _loadAssignments() async {
    final all = asJsonList(await SessionScope.api(context).get('/assignments/mine/teacher')).map(Assignment.new);
    final mine = all.where((a) => a.className == widget.item.name).toList();
    mine.sort((a, b) => (b.assignedAt ?? DateTime(0)).compareTo(a.assignedAt ?? DateTime(0)));
    return mine;
  }

  Future<void> _openComposer() async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => TeacherComposerScreen(initialClass: widget.item)),
    );
    if (created == true && mounted) setState(() => _reload++);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final c = widget.item;
    final students = [...c.students]..sort((a, b) => _lastName(a).compareTo(_lastName(b)));
    final query = _query.toLowerCase();
    final shown = students
        .where((s) => query.isEmpty || '${asString(s['fullName']) ?? ''} ${asString(s['email']) ?? ''}'.toLowerCase().contains(query))
        .toList();

    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: Text('Lớp ${c.name}'),
          actions: [
            IconButton(
              tooltip: 'Giao bài cho lớp này',
              onPressed: _openComposer,
              icon: const Icon(Icons.add_task_rounded),
            ),
            IconButton(
              tooltip: 'Báo cáo kết quả lớp',
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => TeacherReportsScreen(initialClassId: c.id)),
              ),
              icon: const Icon(Icons.bar_chart_rounded),
            ),
          ],
          bottom: TabBar(
            tabs: [
              Tab(text: 'Học sinh (${students.length})'),
              const Tab(text: 'Bài đã giao'),
              const Tab(text: 'Bảng điểm'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            // Tab 1: Students
            ListView(padding: const EdgeInsets.fromLTRB(16, 14, 16, 28), children: [
              FilledButton.icon(
                onPressed: _openComposer,
                icon: const Icon(Icons.add_rounded, size: 18),
                label: const Text('Giao bài cho lớp này'),
              ),
              const SizedBox(height: 12),
              SearchBox(hint: 'Tìm tên hoặc email...', onChanged: (v) => setState(() => _query = v)),
              const SizedBox(height: 12),
              if (shown.isEmpty)
                EmptyState(art: Art.users, title: students.isEmpty ? 'Lớp chưa có học sinh' : 'Không tìm thấy học sinh')
              else
                Card(
                  clipBehavior: Clip.antiAlias,
                  child: Column(children: [
                    for (final s in shown) ...[
                      ListTile(
                        leading: Avatar(name: asString(s['fullName']) ?? '?', url: asString(s['avatarUrl'])),
                        title: Text(asString(s['fullName']) ?? 'Học sinh', style: const TextStyle(fontWeight: FontWeight.w600)),
                        subtitle: Text(asString(s['email']) ?? '', style: TextStyle(color: p.muted, fontSize: 12)),
                        trailing: Icon(Icons.chevron_right_rounded, color: p.muted, size: 20),
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => TeacherStudentProfileScreen(classItem: c, student: s)),
                        ),
                      ),
                      if (s != shown.last) const Divider(indent: 72),
                    ],
                  ]),
                ),
            ]),

            // Tab 2: Assignments
            Loader<List<Assignment>>(
              load: _loadAssignments,
              reloadKey: _reload,
              builder: (context, items, reload) => RefreshIndicator(
                onRefresh: reload,
                child: items.isEmpty
                    ? ListView(children: const [
                        SizedBox(height: 30),
                        EmptyState(art: Art.assign, title: 'Chưa giao bài cho lớp này'),
                      ])
                    : ListView.separated(
                        padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
                        itemCount: items.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 10),
                        itemBuilder: (context, i) {
                          final a = items[i];
                          return ListCard(
                            title: a.title,
                            subtitle: a.dueAt == null ? 'Không giới hạn thời gian' : 'Hạn ${formatDateTime(a.dueAt)}',
                            trailing: a.closed
                                ? const Pill('Đã đóng')
                                : a.dueAt != null && a.dueAt!.isBefore(DateTime.now())
                                    ? const Pill('Hết hạn', tone: Tone.warning)
                                    : const Pill('Đang mở', tone: Tone.success),
                            onTap: () => Navigator.of(context)
                                .push(MaterialPageRoute(builder: (_) => TeacherAssignmentScreen(assignment: a))),
                          );
                        },
                      ),
              ),
            ),

            // Tab 3: Gradebook (MTeacherGrades)
            TeacherClassGradebookTab(classItem: c),
          ],
        ),
      ),
    );
  }

  static String _lastName(Json s) => (asString(s['fullName']) ?? '').trim().split(' ').last;
}
