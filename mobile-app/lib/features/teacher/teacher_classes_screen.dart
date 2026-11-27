import 'package:flutter/material.dart';

import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import 'teacher_assignment_screen.dart';

/// The classes a teacher teaches: find one, see its students and the work set for it.
class TeacherClassesScreen extends StatefulWidget {
  const TeacherClassesScreen({super.key});

  @override
  State<TeacherClassesScreen> createState() => _TeacherClassesScreenState();
}

class _TeacherClassesScreenState extends State<TeacherClassesScreen> {
  String _query = '';

  Future<List<TeacherClass>> _load() async {
    final items = asJsonList(await SessionScope.api(context).get('/assignments/mine/teacher/classes'))
        .map(TeacherClass.new)
        .toList();
    items.sort((a, b) => a.name.compareTo(b.name));
    return items;
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      appBar: const HeroBar(title: 'Lớp phụ trách', subtitle: 'Giảng dạy', art: Art.classes),
      body: Loader<List<TeacherClass>>(
        load: _load,
        skeleton: const SkeletonList(withStats: true),
        builder: (context, classes, reload) {
          final students = classes.fold<int>(0, (sum, c) => sum + c.students.length);
          final query = _query.toLowerCase();
          final shown = classes
              .where((c) => query.isEmpty ||
                  c.name.toLowerCase().contains(query) ||
                  c.students.any((s) => (asString(s['fullName']) ?? '').toLowerCase().contains(query)))
              .toList();
          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 28), children: [
              Pair(
                StatTile(label: 'Lớp', value: '${classes.length}', icon: Icons.class_rounded, tint: p.violet,
                    detail: 'đang phụ trách'),
                StatTile(label: 'Học sinh', value: '$students', icon: Icons.groups_rounded, tint: p.blue,
                    detail: 'trong các lớp'),
              ),
              const SizedBox(height: 14),
              SearchBox(hint: 'Tìm lớp hoặc tên học sinh', onChanged: (v) => setState(() => _query = v)),
              const SizedBox(height: 12),
              if (shown.isEmpty)
                EmptyState(
                  art: Art.classes,
                  title: _query.isEmpty ? 'Chưa được phân công lớp nào' : 'Không có lớp nào khớp "$_query"',
                  message: _query.isEmpty ? 'Nhà trường hoặc tổ trưởng phân công lớp trên bản web.' : null,
                )
              else
                for (final c in shown) ...[
                  _ClassCard(
                    item: c,
                    tint: p.tints[classes.indexOf(c) % p.tints.length],
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
  const _ClassCard({required this.item, required this.tint, required this.onTap});
  final TeacherClass item;
  final Tint tint;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final students = item.students;
    return ListCard(
      onTap: onTap,
      leading: Container(
        width: 48,
        height: 48,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: tint.bg, borderRadius: BorderRadius.circular(14)),
        child: Text(item.gradeLevel?.toString() ?? item.name.characters.first,
            style: TextStyle(color: tint.fg, fontWeight: FontWeight.w800, fontSize: 18)),
      ),
      title: 'Lớp ${item.name}',
      subtitle: [
        if (item.subject != null) item.subject!,
        if (item.schoolYear != null) 'Năm học ${item.schoolYear}',
      ].join(' · '),
      footer: Row(children: [
        SizedBox(
          width: 22.0 * students.take(5).length + 10,
          height: 30,
          child: Stack(children: [
            for (var i = 0; i < students.take(5).length; i++)
              Positioned(
                left: i * 22,
                child: Container(
                  decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: p.surface, width: 2)),
                  child: Avatar(name: asString(students[i]['fullName']) ?? '?', url: asString(students[i]['avatarUrl']), size: 28),
                ),
              ),
          ]),
        ),
        Expanded(child: Text('${students.length} học sinh', style: TextStyle(color: p.muted, fontSize: 13))),
        Icon(Icons.chevron_right_rounded, color: p.muted, size: 20),
      ]),
    );
  }
}

/// One class: its students (searchable) and the assignments set for it.
class TeacherClassScreen extends StatefulWidget {
  const TeacherClassScreen({super.key, required this.item});
  final TeacherClass item;

  @override
  State<TeacherClassScreen> createState() => _TeacherClassScreenState();
}

class _TeacherClassScreenState extends State<TeacherClassScreen> {
  String _query = '';

  Future<List<Assignment>> _load() async {
    final all = asJsonList(await SessionScope.api(context).get('/assignments/mine/teacher')).map(Assignment.new);
    final mine = all.where((a) => a.className == widget.item.name).toList();
    mine.sort((a, b) => (b.assignedAt ?? DateTime(0)).compareTo(a.assignedAt ?? DateTime(0)));
    return mine;
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
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: Text('Lớp ${c.name}'),
          bottom: TabBar(tabs: [Tab(text: 'Học sinh (${students.length})'), const Tab(text: 'Bài tập')]),
        ),
        body: TabBarView(children: [
          ListView(padding: const EdgeInsets.fromLTRB(16, 14, 16, 28), children: [
            SearchBox(hint: 'Tìm học sinh', onChanged: (v) => setState(() => _query = v)),
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
                    ),
                    if (s != shown.last) const Divider(indent: 72),
                  ],
                ]),
              ),
          ]),
          Loader<List<Assignment>>(
            load: _load,
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
        ]),
      ),
    );
  }

  static String _lastName(Json s) => (asString(s['fullName']) ?? '').trim().split(' ').last;
}
