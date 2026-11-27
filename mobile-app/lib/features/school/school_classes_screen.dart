import 'package:flutter/material.dart';

import '../../core/api.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';

/// The school's classes: by grade, with their teachers and size, and the ones still without a teacher.
class SchoolClassesScreen extends StatefulWidget {
  const SchoolClassesScreen({super.key});

  @override
  State<SchoolClassesScreen> createState() => _SchoolClassesScreenState();
}

class _SchoolClassesScreenState extends State<SchoolClassesScreen> {
  int? _grade;
  String _query = '';

  Future<List<Json>> _load() async {
    final schoolId = SessionScope.of(context).user!.schoolId;
    if (schoolId == null) throw ApiException('Tài khoản chưa gắn với trường nào.');
    final items = asJsonList(await SessionScope.api(context).get('/schools/$schoolId/classes'));
    items.sort((a, b) {
      final g = (asInt(a['gradeLevel']) ?? 0).compareTo(asInt(b['gradeLevel']) ?? 0);
      return g != 0 ? g : (asString(a['name']) ?? '').compareTo(asString(b['name']) ?? '');
    });
    return items;
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      appBar: const HeroBar(title: 'Lớp học', subtitle: 'Nhà trường', art: Art.classes),
      body: Loader<List<Json>>(
        load: _load,
        skeleton: const SkeletonList(withStats: true),
        builder: (context, items, reload) {
          final grades = <int>{for (final c in items) if (asInt(c['gradeLevel']) != null) asInt(c['gradeLevel'])!}.toList()..sort();
          final students = items.fold<int>(0, (sum, c) => sum + (asInt(c['studentCount']) ?? 0));
          final noTeacher = items.where((c) => (asInt(c['teacherCount']) ?? 0) == 0).length;
          final query = _query.toLowerCase();
          final shown = items
              .where((c) => _grade == null || asInt(c['gradeLevel']) == _grade)
              .where((c) => query.isEmpty ||
                  '${asString(c['name']) ?? ''} ${(c['teacherNames'] as List?)?.join(' ') ?? ''}'.toLowerCase().contains(query))
              .toList();
          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(padding: const EdgeInsets.fromLTRB(16, 14, 16, 28), children: [
              Pair(
                StatTile(label: 'Lớp đang học', value: '${items.length}', detail: '${groupDigits(students)} học sinh',
                    icon: Icons.class_rounded, tint: p.violet),
                StatTile(label: 'Chưa có giáo viên', value: '$noTeacher', detail: 'cần phân công',
                    icon: Icons.person_search_rounded, tint: noTeacher > 0 ? p.rose : p.green),
              ),
              const SizedBox(height: 14),
              SearchBox(hint: 'Tìm lớp hoặc giáo viên', onChanged: (v) => setState(() => _query = v)),
              if (grades.length > 1) ...[
                const SizedBox(height: 10),
                ChoiceRow<int?>(
                  selected: _grade,
                  onSelected: (g) => setState(() => _grade = g),
                  options: [
                    (null, 'Tất cả khối', items.length),
                    for (final g in grades) (g, 'Khối $g', items.where((c) => asInt(c['gradeLevel']) == g).length),
                  ],
                ),
              ],
              const SizedBox(height: 12),
              if (shown.isEmpty)
                EmptyState(art: Art.classes, title: _query.isEmpty ? 'Trường chưa có lớp nào' : 'Không tìm thấy lớp phù hợp',
                    message: _query.isEmpty ? 'Tạo lớp hoặc nhập danh sách lớp trên bản web.' : null)
              else
                for (final c in shown) ...[
                  _ClassCard(item: c),
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
  const _ClassCard({required this.item});
  final Json item;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final grade = asInt(item['gradeLevel']);
    final teachers = (item['teacherNames'] as List?)?.map((e) => '$e').toList() ?? const <String>[];
    final t = p.tints[(grade ?? 0) % p.tints.length];
    return ListCard(
      leading: Container(
        width: 48,
        height: 48,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: t.bg, borderRadius: BorderRadius.circular(14)),
        child: Text(grade?.toString() ?? '–', style: TextStyle(color: t.fg, fontWeight: FontWeight.w800, fontSize: 18)),
      ),
      title: 'Lớp ${asString(item['name']) ?? ''}',
      subtitle: [
        if (asString(item['subject']) != null) asString(item['subject'])!,
        if (asString(item['schoolYear']) != null) 'Năm học ${asString(item['schoolYear'])}',
      ].join(' · '),
      trailing: Pill('${asInt(item['studentCount']) ?? 0} HS', tone: Tone.info),
      footer: teachers.isEmpty
          ? MetaLine(icon: Icons.warning_amber_rounded, text: 'Chưa phân công giáo viên', color: p.danger)
          : MetaLine(icon: Icons.person_rounded, text: teachers.join(', ')),
    );
  }
}
