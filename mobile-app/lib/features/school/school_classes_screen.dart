import 'package:flutter/material.dart';

import '../../core/api.dart';
import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../account/account_screens.dart';
import '../simulation/export.dart';

/// MSchoolClasses — Quản lý lớp học (KPI, tìm kiếm, tạo lớp, chỉnh sửa, sĩ số theo khối).
class SchoolClassesScreen extends StatefulWidget {
  const SchoolClassesScreen({super.key});

  @override
  State<SchoolClassesScreen> createState() => _SchoolClassesScreenState();
}

class _SchoolClassesScreenState extends State<SchoolClassesScreen> {
  int? _grade;
  String _query = '';
  bool _includeArchived = false;
  int _reload = 0;

  Future<List<Json>> _load() async {
    final schoolId = SessionScope.read(context).user?.schoolId;
    if (schoolId == null) throw ApiException('Tài khoản chưa gắn với trường nào.');
    final items = asJsonList(await SessionScope.api(context).get(
      '/schools/$schoolId/classes',
      query: {'includeInactive': '$_includeArchived'},
    ));
    items.sort((a, b) {
      final activeCmp = (b['active'] != false ? 1 : 0).compareTo(a['active'] != false ? 1 : 0);
      if (activeCmp != 0) return activeCmp;
      final g = (asInt(a['gradeLevel']) ?? 0).compareTo(asInt(b['gradeLevel']) ?? 0);
      return g != 0 ? g : (asString(a['name']) ?? '').compareTo(asString(b['name']) ?? '');
    });
    return items;
  }

  Future<void> _toggleArchive(Json c) async {
    final schoolId = SessionScope.read(context).user?.schoolId;
    if (schoolId == null) return;
    final active = c['active'] != false;
    final name = asString(c['name']) ?? 'lớp';
    final ok = await confirm(
      context,
      title: active ? 'Lưu trữ lớp $name?' : 'Khôi phục lớp $name?',
      message: active
          ? 'Lớp sẽ tạm ẩn khỏi danh sách hoạt động nhưng vẫn giữ toàn bộ dữ liệu và bảng điểm.'
          : 'Lớp sẽ hoạt động trở lại bình thường.',
      action: active ? 'Lưu trữ' : 'Khôi phục',
    );
    if (!ok || !mounted) return;
    try {
      final id = asString(c['id']);
      if (active) {
        await SessionScope.api(context).delete('/schools/$schoolId/classes/$id');
      } else {
        await SessionScope.api(context).post('/schools/$schoolId/classes/$id/restore');
      }
      if (!mounted) return;
      showMessage(context, active ? 'Đã lưu trữ lớp $name.' : 'Đã khôi phục lớp $name.');
      setState(() => _reload++);
    } catch (error) {
      if (mounted) showMessage(context, errorText(error), error: true);
    }
  }

  Future<void> _openForm([Json? existing]) async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => SchoolClassFormScreen(existing: existing)),
    );
    if (changed == true && mounted) setState(() => _reload++);
  }

  Future<void> _openDetail(Json c) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => SchoolClassDetailScreen(
          classId: asString(c['id']) ?? '',
          className: asString(c['name']) ?? 'Lớp',
        ),
      ),
    );
    if (mounted) setState(() => _reload++);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      appBar: const RoleTopBar(subtitle: 'Quản lý trường'),
      body: Loader<List<Json>>(
        load: _load,
        reloadKey: _reload,
        skeleton: const SkeletonList(withStats: true),
        builder: (context, items, reload) {
          final grades = <int>{for (final c in items) if (asInt(c['gradeLevel']) != null) asInt(c['gradeLevel'])!}.toList()..sort();
          final students = items.fold<int>(0, (sum, c) => sum + (asInt(c['studentCount']) ?? 0));
          final noTeacher = items.where((c) => (asInt(c['teacherCount']) ?? 0) == 0).toList();
          final query = _query.toLowerCase();
          final shown = items
              .where((c) => _grade == null || asInt(c['gradeLevel']) == _grade)
              .where((c) => query.isEmpty ||
                  '${asString(c['name']) ?? ''} ${(c['teacherNames'] as List?)?.join(' ') ?? ''}'.toLowerCase().contains(query))
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
                          'Quản lý lớp học',
                          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                            color: p.brand,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text('Lớp học, giáo viên và học sinh trong trường.', style: TextStyle(color: p.muted, fontSize: 13)),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  SizedBox(width: 68, height: 54, child: ArtImage(Art.classes)),
                ],
              ),
              const SizedBox(height: 14),
              Pair(
                StatTile(
                  label: 'Lớp hoạt động',
                  value: '${items.length}',
                  detail: '${groupDigits(students)} học sinh',
                  icon: Icons.class_rounded,
                  tint: p.violet,
                ),
                StatTile(
                  label: 'Chưa có giáo viên',
                  value: '${noTeacher.length}',
                  detail: noTeacher.isEmpty ? 'Đã phân công đủ' : 'Lớp ${asString(noTeacher.first['name']) ?? ''}',
                  icon: Icons.person_search_rounded,
                  tint: noTeacher.isNotEmpty ? p.rose : p.green,
                ),
              ),
              const SizedBox(height: 14),
              SearchBox(hint: 'Tìm lớp hoặc giáo viên...', onChanged: (v) => setState(() => _query = v)),
              const SizedBox(height: 10),
              ChoiceRow<bool>(
                selected: _includeArchived,
                onSelected: (v) => setState(() {
                  _includeArchived = v;
                  _reload++;
                }),
                options: const [
                  (false, 'Đang hoạt động', null),
                  (true, 'Gồm lớp đã lưu trữ', null),
                ],
              ),
              if (grades.length > 1) ...[
                const SizedBox(height: 8),
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
              FilledButton.icon(
                onPressed: () => _openForm(),
                icon: const Icon(Icons.add_rounded, size: 18),
                label: const Text('Tạo lớp học'),
              ),
              const SizedBox(height: 12),
              if (shown.isEmpty)
                EmptyState(
                  art: Art.classes,
                  title: _query.isEmpty ? 'Trường chưa có lớp nào' : 'Không tìm thấy lớp phù hợp',
                  message: _query.isEmpty ? 'Bấm "Tạo lớp học" để thêm lớp mới.' : null,
                )
              else
                for (final c in shown) ...[
                  _SchoolClassCard(
                    item: c,
                    onView: () => _openDetail(c),
                    onEdit: () => _openForm(c),
                    onToggleArchive: () => _toggleArchive(c),
                  ),
                  const SizedBox(height: 10),
                ],
              if (grades.isNotEmpty) ...[
                const SizedBox(height: 6),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Sĩ số trung bình theo khối', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                        const SizedBox(height: 12),
                        for (var i = 0; i < grades.length; i++) ...[
                          if (i > 0) const SizedBox(height: 10),
                          () {
                            final g = grades[i];
                            final inGrade = items.where((c) => asInt(c['gradeLevel']) == g).toList();
                            final avg = inGrade.isEmpty
                                ? 0.0
                                : inGrade.fold<int>(0, (s, c) => s + (asInt(c['studentCount']) ?? 0)) / inGrade.length;
                            return Column(
                              children: [
                                Row(
                                  children: [
                                    Expanded(child: Text('Khối $g (${inGrade.length} lớp)', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13))),
                                    Text('${avg.round()} học sinh/lớp', style: TextStyle(color: p.ink, fontWeight: FontWeight.w700, fontSize: 13)),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(99),
                                  child: LinearProgressIndicator(
                                    value: (avg / 45.0).clamp(0.05, 1.0),
                                    minHeight: 7,
                                    color: p.accent,
                                    backgroundColor: p.surface2,
                                  ),
                                ),
                              ],
                            );
                          }(),
                        ],
                      ],
                    ),
                  ),
                ),
              ],
            ]),
          );
        },
      ),
    );
  }
}

class _SchoolClassCard extends StatelessWidget {
  const _SchoolClassCard({
    required this.item,
    required this.onView,
    required this.onEdit,
    required this.onToggleArchive,
  });
  final Json item;
  final VoidCallback onView;
  final VoidCallback onEdit;
  final VoidCallback onToggleArchive;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final teachers = (item['teacherNames'] as List?)?.map((e) => '$e').toList() ?? const <String>[];
    final active = item['active'] != false;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    asString(item['name']) ?? 'Lớp',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                  ),
                ),
                Pill(active ? 'Hoạt động' : 'Đã lưu trữ', tone: active ? Tone.success : Tone.neutral),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              [
                asString(item['subject']) ?? 'Vật lý',
                if (asString(item['schoolYear']) != null) 'Năm học ${asString(item['schoolYear'])}',
              ].join(' · '),
              style: TextStyle(color: p.muted, fontSize: 12.5),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(child: Text('Giáo viên', style: TextStyle(color: p.muted, fontSize: 13))),
                Flexible(
                  child: Text(
                    teachers.isEmpty ? 'Chưa phân công' : teachers.join(', '),
                    textAlign: TextAlign.end,
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                      color: teachers.isEmpty ? p.danger : p.ink,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                Expanded(child: Text('Học sinh', style: TextStyle(color: p.muted, fontSize: 13))),
                Text('${asInt(item['studentCount']) ?? 0}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: onView,
                    icon: const Icon(Icons.menu_book_rounded, size: 16),
                    label: const Text('Xem lớp'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: FilledButton.tonalIcon(
                    onPressed: onEdit,
                    icon: const Icon(Icons.tune_rounded, size: 16),
                    label: const Text('Chỉnh sửa'),
                  ),
                ),
                const SizedBox(width: 4),
                IconButton(
                  tooltip: active ? 'Lưu trữ lớp' : 'Khôi phục lớp',
                  onPressed: onToggleArchive,
                  icon: Icon(
                    active ? Icons.archive_outlined : Icons.unarchive_outlined,
                    color: active ? p.muted : p.accent,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// MSchoolCreateClass & MSchoolClassEdit — Tạo hoặc chỉnh sửa lớp học.
class SchoolClassFormScreen extends StatefulWidget {
  const SchoolClassFormScreen({super.key, this.existing});
  final Json? existing;

  @override
  State<SchoolClassFormScreen> createState() => _SchoolClassFormScreenState();
}

class _SchoolClassFormScreenState extends State<SchoolClassFormScreen> {
  final _form = GlobalKey<FormState>();
  late final _name = TextEditingController(text: asString(widget.existing?['name']) ?? '');
  late final _year = TextEditingController(text: asString(widget.existing?['schoolYear']) ?? '2026-2027');
  late final _subject = TextEditingController(text: asString(widget.existing?['subject']) ?? 'Vật lý');
  late int _grade = asInt(widget.existing?['gradeLevel']) ?? 10;
  bool _busy = false;
  String? _error;

  bool get _editing => widget.existing != null;

  @override
  void dispose() {
    _name.dispose();
    _year.dispose();
    _subject.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    final schoolId = SessionScope.read(context).user?.schoolId;
    if (schoolId == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final body = {
        'name': _name.text.trim(),
        'gradeLevel': _grade,
        'schoolYear': _year.text.trim(),
        'subject': _subject.text.trim().isEmpty ? 'Vật lý' : _subject.text.trim(),
      };
      if (_editing) {
        final classId = asString(widget.existing!['id']);
        await SessionScope.api(context).put('/schools/$schoolId/classes/$classId', body);
      } else {
        await SessionScope.api(context).post('/schools/$schoolId/classes', body);
      }
      if (!mounted) return;
      showMessage(context, _editing ? 'Đã cập nhật lớp học.' : 'Đã tạo lớp học mới.');
      Navigator.of(context).pop(true);
    } catch (error) {
      if (mounted) setState(() => _error = errorText(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      appBar: const RoleTopBar(subtitle: 'Quản lý trường', showBack: true),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 32),
          children: [
            Text(
              _editing ? 'Chỉnh sửa lớp học' : 'Tạo lớp học mới',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: p.brand,
              ),
            ),
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextFormField(
                      controller: _name,
                      enabled: !_busy,
                      decoration: const InputDecoration(labelText: 'Tên lớp', hintText: 'Ví dụ: 10A1, 11B3'),
                      validator: (v) => v == null || v.trim().isEmpty ? 'Nhập tên lớp.' : null,
                    ),
                    const SizedBox(height: 14),
                    DropdownButtonFormField<int>(
                      initialValue: _grade,
                      borderRadius: BorderRadius.circular(14),
                      dropdownColor: p.surface,
                      elevation: 4,
                      decoration: const InputDecoration(labelText: 'Khối lớp'),
                      items: const [
                        DropdownMenuItem(value: 10, child: Text('Khối 10')),
                        DropdownMenuItem(value: 11, child: Text('Khối 11')),
                        DropdownMenuItem(value: 12, child: Text('Khối 12')),
                      ],
                      onChanged: _busy ? null : (v) => setState(() => _grade = v ?? 10),
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _year,
                      enabled: !_busy,
                      decoration: const InputDecoration(labelText: 'Năm học', hintText: '2026-2027'),
                      validator: (v) => v == null || !RegExp(r'^\d{4}-\d{4}$').hasMatch(v.trim())
                          ? 'Nhập năm học dạng YYYY-YYYY (VD: 2026-2027).'
                          : null,
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _subject,
                      enabled: !_busy,
                      decoration: const InputDecoration(labelText: 'Môn học'),
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      Text(_error!, style: TextStyle(color: p.danger, fontSize: 13)),
                    ],
                    const SizedBox(height: 18),
                    FilledButton(
                      onPressed: _busy ? null : _save,
                      child: _busy
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4))
                          : Text(_editing ? 'Lưu thay đổi' : 'Tạo lớp học'),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// MSchoolClass + MSchoolGrades — Thành viên lớp (Học sinh, Giáo viên, Bảng điểm).
class SchoolClassDetailScreen extends StatefulWidget {
  const SchoolClassDetailScreen({super.key, required this.classId, required this.className});
  final String classId;
  final String className;

  @override
  State<SchoolClassDetailScreen> createState() => _SchoolClassDetailScreenState();
}

class _SchoolClassDetailScreenState extends State<SchoolClassDetailScreen> {
  int _reload = 0;
  String _query = '';
  String _gradeQuery = '';
  String? _selectedAssignmentId; // null = Tất cả bài (TB)

  Future<(Json, Json?)> _load() async {
    final schoolId = SessionScope.read(context).user!.schoolId!;
    final api = SessionScope.api(context);
    final res = await Future.wait([
      api.get('/schools/$schoolId/classes/${widget.classId}'),
      api.get('/schools/$schoolId/classes/${widget.classId}/grades').then<Object?>((v) => v, onError: (_) => null),
    ]);
    return (asJson(res[0]), res[1] == null ? null : asJson(res[1]));
  }

  Future<void> _pickAndAddMember({required bool isTeacher, required Set<int> existingIds}) async {
    final schoolId = SessionScope.read(context).user!.schoolId!;
    final api = SessionScope.api(context);
    try {
      final allUsers = asJsonList(await api.get('/schools/$schoolId/users'));
      final candidates = allUsers.where((u) {
        final id = asInt(u['id']);
        if (id == null || existingIds.contains(id)) return false;
        final role = asString(u['role']) ?? '';
        return isTeacher ? role == 'STAFF' : role == 'STUDENT';
      }).toList();

      if (!mounted) return;
      if (candidates.isEmpty) {
        showMessage(context, isTeacher ? 'Không còn giáo viên khả dụng.' : 'Không còn học sinh khả dụng.');
        return;
      }

      final chosenId = await showModalBottomSheet<int>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (ctx) => SafeArea(
          child: SizedBox(
            height: MediaQuery.of(ctx).size.height * 0.6,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
                  child: Text(
                    isTeacher ? 'Phân công giáo viên' : 'Thêm học sinh vào lớp',
                    style: Theme.of(ctx).textTheme.titleLarge,
                  ),
                ),
                Expanded(
                  child: ListView.separated(
                    itemCount: candidates.length,
                    separatorBuilder: (_, _) => const Divider(height: 1, indent: 72),
                    itemBuilder: (ctx, i) {
                      final u = candidates[i];
                      return ListTile(
                        leading: Avatar(name: asString(u['fullName']) ?? '?', url: asString(u['avatarUrl'])),
                        title: Text(asString(u['fullName']) ?? asString(u['email']) ?? ''),
                        subtitle: Text(asString(u['email']) ?? ''),
                        onTap: () => Navigator.of(ctx).pop(asInt(u['id'])),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
      );

      if (chosenId == null || !mounted) return;
      if (isTeacher) {
        await api.post('/schools/$schoolId/classes/${widget.classId}/teachers', {'teacherId': chosenId});
      } else {
        await api.post('/schools/$schoolId/classes/${widget.classId}/students', {'studentId': chosenId});
      }
      if (!mounted) return;
      showMessage(context, isTeacher ? 'Đã phân công giáo viên.' : 'Đã thêm học sinh vào lớp.');
      setState(() => _reload++);
    } catch (error) {
      if (mounted) showMessage(context, errorText(error), error: true);
    }
  }

  Future<void> _transferStudent({required int studentId, required String studentName}) async {
    final schoolId = SessionScope.read(context).user!.schoolId!;
    final api = SessionScope.api(context);
    try {
      final allClasses = asJsonList(await api.get('/schools/$schoolId/classes'))
          .where((c) => asString(c['id']) != widget.classId && c['active'] != false)
          .toList();
      if (!mounted) return;
      if (allClasses.isEmpty) {
        showMessage(context, 'Không còn lớp hoạt động nào khác để chuyển.');
        return;
      }
      final target = await showModalBottomSheet<Json>(
        context: context,
        showDragHandle: true,
        builder: (ctx) => SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 4, 20, 10),
                child: Text('Chuyển $studentName sang lớp', style: Theme.of(ctx).textTheme.titleLarge),
              ),
              Flexible(
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: allClasses.length,
                  separatorBuilder: (_, _) => const Divider(height: 1, indent: 16, endIndent: 16),
                  itemBuilder: (ctx, i) {
                    final c = allClasses[i];
                    return ListTile(
                      title: Text('Lớp ${asString(c['name']) ?? ''}', style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text('Khối ${c['gradeLevel'] ?? '—'} · ${c['studentCount'] ?? 0} học sinh'),
                      trailing: const Icon(Icons.chevron_right_rounded),
                      onTap: () => Navigator.of(ctx).pop(c),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      );
      if (target == null || !mounted) return;
      final targetId = asString(target['id']);
      await api.put('/schools/$schoolId/classes/$targetId/students/$studentId/transfer');
      if (!mounted) return;
      showMessage(context, 'Đã chuyển $studentName sang lớp ${asString(target['name']) ?? ''}.');
      setState(() => _reload++);
    } catch (error) {
      if (mounted) showMessage(context, errorText(error), error: true);
    }
  }

  Future<void> _removeMember({required bool isTeacher, required int id, required String name}) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(isTeacher ? 'Gỡ giáo viên khỏi lớp?' : 'Xóa học sinh khỏi lớp?'),
        content: Text('Xác nhận gỡ $name khỏi lớp ${widget.className}.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Huỷ')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Xác nhận')),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    final schoolId = SessionScope.read(context).user!.schoolId!;
    try {
      await SessionScope.api(context).delete(
        '/schools/$schoolId/classes/${widget.classId}/${isTeacher ? 'teachers' : 'students'}/$id',
      );
      if (mounted) {
        showMessage(context, 'Đã cập nhật danh sách lớp.');
        setState(() => _reload++);
      }
    } catch (error) {
      if (mounted) showMessage(context, errorText(error), error: true);
    }
  }

  Future<void> _exportGradebookCsv(Json gradebook) async {
    final assignments = asJsonList(gradebook['assignments']);
    final students = asJsonList(gradebook['students']);
    String cell(Object? v) => '"${'${v ?? ''}'.replaceAll('"', '""')}"';
    final header = ['Hoc sinh', 'Email', for (final a in assignments) asString(a['title']) ?? 'Bai tap'];
    final lines = <String>[
      header.map(cell).join(','),
      for (final st in students)
        () {
          final cellsByAssign = {
            for (final c in asJsonList(st['cells'])) asString(c['assignmentId']) ?? '': c,
          };
          return [
            asString(st['fullName']) ?? '',
            asString(st['email']) ?? '',
            for (final a in assignments)
              () {
                final c = cellsByAssign[asString(a['id']) ?? ''];
                final score = asDouble(c?['score']);
                if (score != null) return formatScore(score);
                return asString(c?['state']) ?? '';
              }(),
          ].map(cell).join(',');
        }(),
    ];
    await SimulationExport.share(
      'bang-diem-${widget.className}.csv',
      '\uFEFF${lines.join('\r\n')}',
      'text/csv',
      subject: 'Bảng điểm lớp ${widget.className}',
    );
  }

  Widget _buildGradebookTab(BuildContext context, Json? gradebook, Future<void> Function() reload) {
    final p = context.palette;
    final assignments = gradebook == null ? const <Json>[] : asJsonList(gradebook['assignments']);
    final students = gradebook == null ? const <Json>[] : asJsonList(gradebook['students']);

    if (gradebook == null || students.isEmpty) {
      return RefreshIndicator(
        onRefresh: reload,
        child: ListView(
          children: const [
            SizedBox(height: 60),
            EmptyState(art: Art.assign, title: 'Chưa có dữ liệu bảng điểm'),
          ],
        ),
      );
    }

    final validSelected = assignments.any((a) => asString(a['id']) == _selectedAssignmentId)
        ? _selectedAssignmentId
        : null;
    final q = _gradeQuery.toLowerCase();
    final shown = students
        .where((s) => q.isEmpty || '${asString(s['fullName']) ?? ''} ${asString(s['email']) ?? ''}'.toLowerCase().contains(q))
        .toList();

    return RefreshIndicator(
      onRefresh: reload,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
        children: [
          DropdownButtonFormField<String?>(
            initialValue: validSelected,
            isExpanded: true,
            borderRadius: BorderRadius.circular(14),
            dropdownColor: p.surface,
            elevation: 4,
            menuMaxHeight: 320,
            decoration: const InputDecoration(labelText: 'Bài tập'),
            items: [
              const DropdownMenuItem<String?>(value: null, child: Text('Tất cả bài (Điểm trung bình)')),
              for (final a in assignments)
                DropdownMenuItem<String?>(
                  value: asString(a['id']),
                  child: Text(asString(a['title']) ?? 'Bài tập', maxLines: 1, overflow: TextOverflow.ellipsis),
                ),
            ],
            onChanged: (v) => setState(() => _selectedAssignmentId = v),
          ),
          const SizedBox(height: 10),
          SearchBox(hint: 'Tìm học sinh...', onChanged: (v) => setState(() => _gradeQuery = v)),
          const SizedBox(height: 12),
          Card(
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: [
                for (var i = 0; i < shown.length; i++) ...[
                  if (i > 0) Divider(height: 1, indent: 16, endIndent: 16, color: p.line),
                  () {
                    final st = shown[i];
                    final cells = asJsonList(st['cells']);
                    String subtitle = asString(st['email']) ?? '';
                    Pill trailing;
                    if (validSelected == null) {
                      final graded = cells.where((c) => asDouble(c['score']) != null).toList();
                      final avg = graded.isEmpty
                          ? null
                          : graded.fold<double>(0, (sum, c) {
                                final sc = asDouble(c['score']) ?? 0;
                                final mx = asDouble(c['maxScore']) ?? 10;
                                return sum + (mx > 0 ? sc * 10 / mx : sc);
                              }) /
                              graded.length;
                      subtitle = '${graded.length}/${assignments.length} bài đã chấm · $subtitle';
                      trailing = Pill(
                        avg == null ? 'Chưa có điểm' : 'TB ${formatScore(avg)}',
                        tone: avg == null ? Tone.neutral : Tone.success,
                      );
                    } else {
                      final cell = cells.where((c) => asString(c['assignmentId']) == validSelected).firstOrNull;
                      final state = (asString(cell?['state']) ?? '').toUpperCase();
                      final score = asDouble(cell?['score']);
                      final maxScore = asDouble(cell?['maxScore']) ?? 10;
                      if (score != null && (state == 'CONFIRMED' || state == 'GRADED' || state == 'TEACHER_CONFIRMED' || state == 'MISSED')) {
                        trailing = Pill(
                          '${formatScore(score)}/${formatScore(maxScore)}',
                          tone: state == 'MISSED' ? Tone.danger : Tone.success,
                        );
                      } else if (state == 'AWAITING_GRADE' || state == 'AI_GRADED' || state == 'SUBMITTED') {
                        trailing = const Pill('Chờ chấm', tone: Tone.warning);
                      } else if (state == 'RETURNED' || state == 'RETRY') {
                        trailing = const Pill('Trả lại', tone: Tone.warning);
                      } else if (state == 'MISSED') {
                        trailing = const Pill('Quá hạn (0đ)', tone: Tone.danger);
                      } else if (score != null) {
                        trailing = Pill('${formatScore(score)}/${formatScore(maxScore)}', tone: Tone.accent);
                      } else {
                        trailing = const Pill('Chưa nộp');
                      }
                    }
                    return ListTile(
                      leading: Avatar(name: asString(st['fullName']) ?? '?'),
                      title: Text(asString(st['fullName']) ?? 'Học sinh', style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: p.muted, fontSize: 12)),
                      trailing: trailing,
                    );
                  }(),
                ],
              ],
            ),
          ),
          const SizedBox(height: 14),
          OutlinedButton.icon(
            onPressed: () => _exportGradebookCsv(gradebook),
            icon: const Icon(Icons.download_rounded, size: 18),
            label: const Text('Xuất điểm CSV'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: Text('Lớp ${widget.className}'),
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Học sinh'),
              Tab(text: 'Giáo viên'),
              Tab(text: 'Bảng điểm'),
            ],
          ),
        ),
        body: Loader<(Json, Json?)>(
          load: _load,
          reloadKey: _reload,
          builder: (context, data, reload) {
            final (detail, gradebook) = data;
            final students = asJsonList(detail['students']);
            final teachers = asJsonList(detail['teachers']);
            final studentIds = {for (final s in students) if (asInt(s['id']) != null) asInt(s['id'])!};
            final teacherIds = {for (final t in teachers) if (asInt(t['id']) != null) asInt(t['id'])!};
            final q = _query.toLowerCase();
            final shownStudents = students
                .where((s) => q.isEmpty || '${asString(s['fullName']) ?? ''} ${asString(s['email']) ?? ''}'.toLowerCase().contains(q))
                .toList();

            return TabBarView(
              children: [
                // Tab 1: Students
                RefreshIndicator(
                  onRefresh: reload,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
                    children: [
                      FilledButton.icon(
                        onPressed: () => _pickAndAddMember(isTeacher: false, existingIds: studentIds),
                        icon: const Icon(Icons.person_add_alt_1_rounded, size: 18),
                        label: const Text('Thêm học sinh vào lớp'),
                      ),
                      const SizedBox(height: 12),
                      SearchBox(hint: 'Tìm học sinh...', onChanged: (v) => setState(() => _query = v)),
                      const SizedBox(height: 12),
                      if (shownStudents.isEmpty)
                        const EmptyState(art: Art.users, title: 'Chưa có học sinh trong lớp')
                      else
                        Card(
                          clipBehavior: Clip.antiAlias,
                          child: Column(
                            children: [
                              for (var i = 0; i < shownStudents.length; i++) ...[
                                if (i > 0) Divider(height: 1, indent: 72, color: p.line),
                                ListTile(
                                  leading: Avatar(
                                    name: asString(shownStudents[i]['fullName']) ?? '?',
                                    url: asString(shownStudents[i]['avatarUrl']),
                                  ),
                                  title: Text(asString(shownStudents[i]['fullName']) ?? 'Học sinh', style: const TextStyle(fontWeight: FontWeight.w600)),
                                  subtitle: Text(asString(shownStudents[i]['email']) ?? '', style: TextStyle(color: p.muted, fontSize: 12)),
                                  trailing: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      IconButton(
                                        tooltip: 'Chuyển lớp',
                                        icon: Icon(Icons.swap_horiz_rounded, color: p.accent, size: 20),
                                        onPressed: () => _transferStudent(
                                          studentId: asInt(shownStudents[i]['id']) ?? 0,
                                          studentName: asString(shownStudents[i]['fullName']) ?? 'học sinh',
                                        ),
                                      ),
                                      IconButton(
                                        tooltip: 'Gỡ khỏi lớp',
                                        icon: Icon(Icons.close_rounded, color: p.muted, size: 19),
                                        onPressed: () => _removeMember(
                                          isTeacher: false,
                                          id: asInt(shownStudents[i]['id']) ?? 0,
                                          name: asString(shownStudents[i]['fullName']) ?? 'học sinh',
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                    ],
                  ),
                ),

                // Tab 2: Teachers
                RefreshIndicator(
                  onRefresh: reload,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
                    children: [
                      FilledButton.icon(
                        onPressed: () => _pickAndAddMember(isTeacher: true, existingIds: teacherIds),
                        icon: const Icon(Icons.person_add_alt_1_rounded, size: 18),
                        label: const Text('Phân công giáo viên'),
                      ),
                      const SizedBox(height: 12),
                      if (teachers.isEmpty)
                        const EmptyState(art: Art.users, title: 'Chưa phân công giáo viên cho lớp này')
                      else
                        Card(
                          clipBehavior: Clip.antiAlias,
                          child: Column(
                            children: [
                              for (var i = 0; i < teachers.length; i++) ...[
                                if (i > 0) Divider(height: 1, indent: 72, color: p.line),
                                ListTile(
                                  leading: Avatar(
                                    name: asString(teachers[i]['fullName']) ?? '?',
                                    url: asString(teachers[i]['avatarUrl']),
                                  ),
                                  title: Text(asString(teachers[i]['fullName']) ?? 'Giáo viên', style: const TextStyle(fontWeight: FontWeight.w600)),
                                  subtitle: Text(asString(teachers[i]['email']) ?? '', style: TextStyle(color: p.muted, fontSize: 12)),
                                  trailing: IconButton(
                                    tooltip: 'Gỡ giáo viên',
                                    icon: Icon(Icons.close_rounded, color: p.muted, size: 19),
                                    onPressed: () => _removeMember(
                                      isTeacher: true,
                                      id: asInt(teachers[i]['id']) ?? 0,
                                      name: asString(teachers[i]['fullName']) ?? 'giáo viên',
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                    ],
                  ),
                ),

                // Tab 3: Gradebook (MSchoolGrades)
                _buildGradebookTab(context, gradebook, reload),
              ],
            );
          },
        ),
      ),
    );
  }
}
