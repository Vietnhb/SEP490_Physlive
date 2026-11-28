import 'package:flutter/material.dart';

import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../account/account_screens.dart';
import '../library/library_screen.dart';
import '../school/school_classes_screen.dart';
import 'teacher_assignment_screen.dart';
import 'teacher_assignments_screen.dart';
import 'teacher_classes_screen.dart';
import 'teacher_composer_and_lab_screen.dart';
import 'teacher_reports_screen.dart';

typedef _Progress = ({int recipients, int submitted, int awaiting, int confirmed});

class _OverviewData {
  _OverviewData(this.classes, this.assignments, this.progress);
  final List<TeacherClass> classes;
  final List<Assignment> assignments;
  final Map<String, _Progress> progress;
}

/// MTeacher — Tổng quan giáo viên (Không gian giảng dạy).
class TeacherOverviewScreen extends StatefulWidget {
  const TeacherOverviewScreen({
    super.key,
    required this.onOpenClasses,
    required this.onOpenLab,
  });
  final VoidCallback onOpenClasses;
  final VoidCallback onOpenLab;

  @override
  State<TeacherOverviewScreen> createState() => _TeacherOverviewScreenState();
}

class _TeacherOverviewScreenState extends State<TeacherOverviewScreen> {
  int _reload = 0;

  Future<_OverviewData> _load() async {
    final api = SessionScope.api(context);
    final results = await Future.wait([
      api.get('/assignments/mine/teacher/classes').then<Object?>((v) => v, onError: (_) => null),
      api.get('/assignments/mine/teacher').then<Object?>((v) => v, onError: (_) => null),
      api.get('/assignments/mine/teacher/progress').then<Object?>((v) => v, onError: (_) => null),
    ]);
    final classes = asJsonList(results[0]).map(TeacherClass.new).toList()
      ..sort((a, b) => a.name.compareTo(b.name));
    final assignments = asJsonList(results[1]).map(Assignment.new).toList()
      ..sort((a, b) => (b.assignedAt ?? DateTime(0)).compareTo(a.assignedAt ?? DateTime(0)));
    final progress = <String, _Progress>{
      for (final row in asJsonList(results[2]))
        asString(row['assignmentId']) ?? '': (
          recipients: asInt(row['recipients']) ?? 0,
          submitted: asInt(row['submitted']) ?? 0,
          awaiting: asInt(row['awaitingGrade']) ?? 0,
          confirmed: asInt(row['confirmed']) ?? 0,
        ),
    };
    return _OverviewData(classes, assignments, progress);
  }

  Future<void> _openComposer() async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const TeacherComposerScreen()),
    );
    if (created == true && mounted) setState(() => _reload++);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final user = SessionScope.of(context).user;
    if (user == null) return const Scaffold();

    return Scaffold(
      appBar: const RoleTopBar(subtitle: 'Giảng dạy'),
      body: Loader<_OverviewData>(
        load: _load,
        reloadKey: _reload,
        skeleton: const SkeletonList(withStats: true),
        builder: (context, data, reload) {
          final totalStudents = data.classes.fold<int>(0, (s, c) => s + c.students.length);
          final totalAwaiting = data.assignments.fold<int>(
            0,
            (s, a) => s + (data.progress[a.id]?.awaiting ?? 0),
          );

          // Priority 1: assignments with submissions awaiting grade
          final needsGrading = data.assignments
              .where((a) => (data.progress[a.id]?.awaiting ?? 0) > 0)
              .toList()
            ..sort((a, b) => (data.progress[b.id]?.awaiting ?? 0).compareTo(data.progress[a.id]?.awaiting ?? 0));

          // Priority 2: open assignments due soon
          final now = DateTime.now();
          final dueSoon = data.assignments
              .where((a) => !a.closed && a.dueAt != null && a.dueAt!.isAfter(now))
              .toList()
            ..sort((a, b) => a.dueAt!.compareTo(b.dueAt!));

          // Per-class submission rate
          final classStats = <({TeacherClass cls, int assignments, int pct})>[];
          for (final c in data.classes) {
            final clsAssigns = data.assignments.where((a) => a.className == c.name).toList();
            var rec = 0, sub = 0;
            for (final a in clsAssigns) {
              final pr = data.progress[a.id];
              rec += pr?.recipients ?? a.studentCount;
              sub += pr?.submitted ?? 0;
            }
            final pct = rec == 0 ? 0 : ((sub / rec) * 100).round().clamp(0, 100);
            classStats.add((cls: c, assignments: clsAssigns.length, pct: pct));
          }

          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
              children: [
                // Heading matching MTeacher
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Không gian giảng dạy',
                            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                              color: p.brand,
                              letterSpacing: -0.4,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            user.schoolName?.isNotEmpty == true
                                ? user.schoolName!
                                : 'Xin chào, ${user.fullName}',
                            style: TextStyle(color: p.muted, fontSize: 13),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 10),
                    SizedBox(width: 72, height: 58, child: ArtImage(Art.classes)),
                  ],
                ),
                const SizedBox(height: 16),

                // 2 KPI cards
                Pair(
                  StatTile(
                    label: 'Lớp phụ trách',
                    value: '${data.classes.length}',
                    detail: '$totalStudents học sinh',
                    icon: Icons.groups_rounded,
                    tint: p.blue,
                    onTap: widget.onOpenClasses,
                  ),
                  StatTile(
                    label: 'Bài chờ chấm',
                    value: '$totalAwaiting',
                    detail: 'Trong ${data.classes.length} lớp phụ trách',
                    icon: Icons.rate_review_rounded,
                    tint: totalAwaiting > 0 ? p.amber : p.green,
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const TeacherAssignmentsScreen()),
                    ),
                  ),
                ),
                const SizedBox(height: 14),

                // Ưu tiên hôm nay
                Card(
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
                        child: Text(
                          'Ưu tiên hôm nay',
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                        ),
                      ),
                      if (needsGrading.isEmpty && dueSoon.isEmpty)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 6, 16, 16),
                          child: Text(
                            'Hiện chưa có bài nộp chờ chấm hay bài sắp đến hạn.',
                            style: TextStyle(color: p.muted, fontSize: 13),
                          ),
                        )
                      else ...[
                        for (final a in needsGrading.take(2)) ...[
                          _PriorityRow(
                            icon: Icons.assignment_turned_in_outlined,
                            title: 'Chấm bài ${a.className ?? a.title}',
                            subtitle: '${data.progress[a.id]?.awaiting ?? 0} bài nộp đang chờ bạn · ${a.title}',
                            badge: '${data.progress[a.id]?.awaiting ?? 0}',
                            badgeTone: Tone.warning,
                            onTap: () async {
                              await Navigator.of(context).push(
                                MaterialPageRoute(builder: (_) => TeacherAssignmentScreen(assignment: a)),
                              );
                              if (mounted) setState(() => _reload++);
                            },
                          ),
                          Divider(height: 1, indent: 68, color: p.line),
                        ],
                        if (dueSoon.isNotEmpty)
                          _PriorityRow(
                            icon: Icons.schedule_rounded,
                            title: 'Bài sắp đến hạn',
                            subtitle: '${dueSoon.first.title} · ${formatDue(dueSoon.first.dueAt!)}',
                            onTap: () => Navigator.of(context).push(
                              MaterialPageRoute(builder: (_) => TeacherAssignmentScreen(assignment: dueSoon.first)),
                            ),
                          ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 14),

                // 2 Quick Shortcuts: Tạo mô phỏng / Giao bài mới
                Row(
                  children: [
                    Expanded(
                      child: _ShortcutTile(
                        icon: Icons.science_outlined,
                        label: 'Tạo mô phỏng',
                        tint: p.teal,
                        onTap: widget.onOpenLab,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _ShortcutTile(
                        icon: Icons.add_task_rounded,
                        label: 'Giao bài mới',
                        tint: p.blue,
                        onTap: _openComposer,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),

                // Lớp phụ trách
                Card(
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 14, 12, 6),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                'Lớp phụ trách',
                                style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                              ),
                            ),
                            TextButton(
                              onPressed: widget.onOpenClasses,
                              child: const Text('Tất cả'),
                            ),
                          ],
                        ),
                      ),
                      if (classStats.isEmpty)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                          child: Text('Chưa được phân công lớp nào.', style: TextStyle(color: p.muted, fontSize: 13)),
                        )
                      else
                        for (var i = 0; i < classStats.take(4).length; i++) ...[
                          if (i > 0) Divider(height: 1, indent: 68, color: p.line),
                          _PriorityRow(
                            icon: Icons.menu_book_rounded,
                            title: classStats[i].cls.name,
                            subtitle: '${classStats[i].cls.students.length} học sinh · ${classStats[i].assignments} bài đã giao',
                            onTap: () => Navigator.of(context).push(
                              MaterialPageRoute(builder: (_) => TeacherClassScreen(item: classStats[i].cls)),
                            ),
                          ),
                        ],
                    ],
                  ),
                ),

                // Tiến độ các lớp
                if (classStats.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            'Tiến độ các lớp',
                            style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 12),
                          for (var i = 0; i < classStats.length; i++) ...[
                            if (i > 0) const SizedBox(height: 12),
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    classStats[i].cls.name,
                                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5),
                                  ),
                                ),
                                Text(
                                  '${classStats[i].pct}% đã nộp',
                                  style: TextStyle(color: p.ink, fontWeight: FontWeight.w700, fontSize: 13),
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(99),
                              child: LinearProgressIndicator(
                                value: classStats[i].pct / 100.0,
                                minHeight: 7,
                                color: p.accent,
                                backgroundColor: p.surface2,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}

class _PriorityRow extends StatelessWidget {
  const _PriorityRow({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.badge,
    this.badgeTone = Tone.neutral,
  });
  final IconData icon;
  final String title, subtitle;
  final VoidCallback onTap;
  final String? badge;
  final Tone badgeTone;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(color: p.blue.bg, shape: BoxShape.circle),
              child: Icon(icon, color: p.blue.fg, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                  const SizedBox(height: 2),
                  Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: p.muted, fontSize: 12)),
                ],
              ),
            ),
            if (badge != null) ...[
              const SizedBox(width: 8),
              Pill(badge!, tone: badgeTone),
            ],
            const SizedBox(width: 4),
            Icon(Icons.chevron_right_rounded, color: p.muted, size: 20),
          ],
        ),
      ),
    );
  }
}

class _ShortcutTile extends StatelessWidget {
  const _ShortcutTile({
    required this.icon,
    required this.label,
    required this.tint,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final Tint tint;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
          child: Column(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(color: tint.bg, borderRadius: BorderRadius.circular(13)),
                child: Icon(icon, color: tint.fg, size: 22),
              ),
              const SizedBox(height: 10),
              Text(
                label,
                textAlign: TextAlign.center,
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// MTeacherMore — Tab "Thêm" cho Giáo viên.
class TeacherMoreScreen extends StatelessWidget {
  const TeacherMoreScreen({super.key, required this.onOpenClasses});
  final VoidCallback onOpenClasses;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final user = SessionScope.of(context).user;
    if (user == null) return const Scaffold();
    final isDepartmentLead = user.permissions.any((perm) =>
        perm == 'MANAGE_CLASS' ||
        perm == 'MODERATE_SCHOOL_LIBRARY' ||
        perm == 'VIEW_SCHOOL_REPORTS' ||
        perm == 'MANAGE_DEPARTMENT');

    return Scaffold(
      appBar: const RoleTopBar(subtitle: 'Giảng dạy'),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 18, 16, 28),
        children: [
          Text(
            'Không gian giảng dạy',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: p.brand,
            ),
          ),
          const SizedBox(height: 14),
          Card(
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: [
                _MoreTile(
                  icon: Icons.menu_book_rounded,
                  title: 'Lớp phụ trách',
                  subtitle: 'Danh sách lớp, học sinh và bảng điểm',
                  onTap: onOpenClasses,
                ),
                Divider(height: 1, indent: 68, color: p.line),
                _MoreTile(
                  icon: Icons.assignment_outlined,
                  title: 'Tất cả bài đã giao',
                  subtitle: 'Theo dõi tiến độ và chấm bài',
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const TeacherAssignmentsScreen()),
                  ),
                ),
                Divider(height: 1, indent: 68, color: p.line),
                _MoreTile(
                  icon: Icons.bar_chart_rounded,
                  title: 'Báo cáo kết quả',
                  subtitle: 'Thống kê nộp bài, điểm TB và xuất CSV',
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const TeacherReportsScreen()),
                  ),
                ),
                Divider(height: 1, indent: 68, color: p.line),
                _MoreTile(
                  icon: Icons.science_outlined,
                  title: 'Thư viện của tôi',
                  subtitle: 'Mô phỏng cá nhân, trường và cộng đồng',
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const LibraryScreen()),
                  ),
                ),
                Divider(height: 1, indent: 68, color: p.line),
                _MoreTile(
                  icon: Icons.bug_report_outlined,
                  title: 'Báo lỗi đã gửi',
                  subtitle: 'Theo dõi phản hồi từ Reviewer',
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const MySupportScreen()),
                  ),
                ),
                if (isDepartmentLead) ...[
                  Divider(height: 1, indent: 68, color: p.line),
                  _MoreTile(
                    icon: Icons.groups_2_outlined,
                    title: 'Tổ bộ môn',
                    subtitle: 'Công việc dành cho tổ trưởng chuyên môn',
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const TeacherDepartmentScreen()),
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 14),
          Card(
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: [
                _MoreTile(
                  icon: Icons.person_outline_rounded,
                  title: 'Hồ sơ & bảo mật',
                  subtitle: 'Thông tin cá nhân, mật khẩu, giao diện',
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const AccountScreen()),
                  ),
                ),
                Divider(height: 1, indent: 68, color: p.line),
                _MoreTile(
                  icon: Icons.chat_bubble_outline_rounded,
                  title: 'Hỗ trợ & khiếu nại',
                  subtitle: 'Gửi và theo dõi yêu cầu',
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const MySupportScreen()),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MoreTile extends StatelessWidget {
  const _MoreTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });
  final IconData icon;
  final String title, subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(color: p.blue.bg, shape: BoxShape.circle),
              child: Icon(icon, color: p.blue.fg, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5)),
                  const SizedBox(height: 2),
                  Text(subtitle, style: TextStyle(color: p.muted, fontSize: 12)),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded, color: p.muted, size: 20),
          ],
        ),
      ),
    );
  }
}

/// MTeacherDepartment — Quản lý chuyên môn Tổ bộ môn (Lớp & phân công, Bài tập trong trường, Duyệt nội dung nội bộ).
class TeacherDepartmentScreen extends StatefulWidget {
  const TeacherDepartmentScreen({super.key, this.embedded = false});
  final bool embedded;

  @override
  State<TeacherDepartmentScreen> createState() => _TeacherDepartmentScreenState();
}

class _DeptData {
  _DeptData(this.classes, this.assignments, this.library);
  final List<Json> classes;
  final List<Json> assignments;
  final List<Json> library;
}

class _TeacherDepartmentScreenState extends State<TeacherDepartmentScreen> {
  String _tab = 'classes'; // classes | assignments | library
  String _libStatus = 'PENDING';
  String _query = '';
  int _reload = 0;

  Future<_DeptData> _load(String schoolId) async {
    final api = SessionScope.api(context);
    final res = await Future.wait([
      api.get('/schools/$schoolId/classes/page', query: {'page': '0', 'size': '50', 'status': 'ALL'})
          .then<Object?>((v) => v, onError: (_) => null),
      api.get('/schools/$schoolId/assignments', query: {'page': '0', 'size': '50'})
          .then<Object?>((v) => v, onError: (_) => null),
      api.get('/schools/$schoolId/library', query: {'status': _libStatus})
          .then<Object?>((v) => v, onError: (_) => null),
    ]);
    final classes = res[0] == null ? const <Json>[] : asJsonList(asJson(res[0])['items']);
    final assignments = res[1] == null ? const <Json>[] : asJsonList(asJson(res[1])['content']);
    final library = res[2] == null ? const <Json>[] : asJsonList(res[2]);
    return _DeptData(classes, assignments, library);
  }

  Future<void> _decide(String schoolId, Json item, String status) async {
    final id = asString(item['id']) ?? '';
    final title = asString(item['title']) ?? 'Mô phỏng';
    String? comment;
    if (status == 'REJECTED' || status == 'REMOVED') {
      final ctrl = TextEditingController();
      comment = await showDialog<String>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text(status == 'REJECTED' ? 'Từ chối nội dung' : 'Gỡ khỏi thư viện trường'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 10),
              TextField(
                controller: ctrl,
                maxLines: 3,
                decoration: const InputDecoration(labelText: 'Lý do (người chia sẻ sẽ thấy)'),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Hủy')),
            FilledButton(
              onPressed: () {
                if (ctrl.text.trim().isEmpty) return;
                Navigator.of(ctx).pop(ctrl.text.trim());
              },
              child: Text(status == 'REJECTED' ? 'Từ chối' : 'Gỡ nội dung'),
            ),
          ],
        ),
      );
      ctrl.dispose();
      if (comment == null) return;
    }
    if (!mounted) return;
    try {
      await SessionScope.api(context).put('/schools/$schoolId/library/$id', {
        'status': status,
        if (comment != null) 'comment': comment,
      });
      if (!mounted) return;
      showMessage(context, status == 'APPROVED' ? 'Đã duyệt nội dung.' : 'Đã cập nhật trạng thái nội dung.');
      setState(() => _reload++);
    } catch (e) {
      if (mounted) showMessage(context, errorText(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final user = SessionScope.of(context).user;
    if (user == null) return const Scaffold();
    final schoolId = user.schoolId ?? '';

    return Scaffold(
      appBar: RoleTopBar(subtitle: 'Tổ bộ môn', showBack: !widget.embedded),
      body: schoolId.isEmpty
          ? const EmptyState(art: Art.school, title: 'Chưa gắn với trường học nào')
          : Loader<_DeptData>(
              load: () => _load(schoolId),
              reloadKey: '$_reload-$_libStatus',
              skeleton: const SkeletonList(withStats: true, count: 4),
              builder: (context, data, reload) {
                final activeClasses = data.classes.where((c) => asBool(c['active'])).toList();
                final activeAssignments = data.assignments.where((a) => asString(a['status']) == 'ACTIVE').toList();
                final teacherNames = data.assignments.map((a) => asString(a['teacherName'])).whereType<String>().toSet();
                final q = _query.trim().toLowerCase();

                final filteredClasses = data.classes.where((c) {
                  if (q.isEmpty) return true;
                  return '${asString(c['name']) ?? ''} ${asString(c['subject']) ?? ''} ${asString(c['schoolYear']) ?? ''}'
                      .toLowerCase()
                      .contains(q);
                }).toList();

                final filteredAssignments = data.assignments.where((a) {
                  if (q.isEmpty) return true;
                  return '${asString(a['title']) ?? ''} ${asString(a['teacherName']) ?? ''} ${asString(a['className']) ?? ''}'
                      .toLowerCase()
                      .contains(q);
                }).toList();

                final filteredLibrary = data.library.where((item) {
                  if (q.isEmpty) return true;
                  return '${asString(item['title']) ?? ''} ${asString(item['sharedByName']) ?? ''}'
                      .toLowerCase()
                      .contains(q);
                }).toList();

                return RefreshIndicator(
                  onRefresh: reload,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
                    children: [
                      Text(
                        'Quản lý chuyên môn',
                        style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          color: p.brand,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text('Tổ Vật lý · ${user.schoolName ?? 'Trường của bạn'}', style: TextStyle(color: p.muted, fontSize: 13)),
                      const SizedBox(height: 14),
                      Pair(
                        StatTile(
                          label: 'Lớp hoạt động',
                          value: '${activeClasses.length}',
                          detail: 'Trên ${data.classes.length} lớp trong trường',
                          icon: Icons.class_outlined,
                          tint: p.blue,
                          onTap: () => setState(() => _tab = 'classes'),
                        ),
                        StatTile(
                          label: 'Bài đang giao',
                          value: '${activeAssignments.length}',
                          detail: '${teacherNames.length} giáo viên giao bài',
                          icon: Icons.assignment_outlined,
                          tint: p.teal,
                          onTap: () => setState(() => _tab = 'assignments'),
                        ),
                      ),
                      const SizedBox(height: 14),
                      ChoiceRow<String>(
                        selected: _tab,
                        onSelected: (v) => setState(() {
                          _tab = v;
                          _query = '';
                        }),
                        options: [
                          ('classes', 'Lớp & phân công', data.classes.length),
                          ('assignments', 'Bài tập trường', data.assignments.length),
                          ('library', 'Duyệt nội bộ', data.library.length),
                        ],
                      ),
                      const SizedBox(height: 10),
                      SearchBox(
                        hint: _tab == 'classes'
                            ? 'Tìm tên lớp, môn học, năm học...'
                            : _tab == 'assignments'
                                ? 'Tìm bài tập, lớp hoặc giáo viên...'
                                : 'Tìm tiêu đề mô phỏng hoặc người chia sẻ...',
                        onChanged: (v) => setState(() => _query = v),
                      ),
                      if (_tab == 'library') ...[
                        const SizedBox(height: 10),
                        ChoiceRow<String>(
                          selected: _libStatus,
                          onSelected: (v) => setState(() => _libStatus = v),
                          options: const [
                            ('PENDING', 'Chờ duyệt', null),
                            ('APPROVED', 'Đã duyệt', null),
                            ('REJECTED', 'Từ chối', null),
                            ('REMOVED', 'Đã gỡ', null),
                          ],
                        ),
                      ],
                      const SizedBox(height: 12),
                      if (_tab == 'classes') ...[
                        if (filteredClasses.isEmpty)
                          const EmptyState(art: Art.classes, title: 'Không tìm thấy lớp học nào')
                        else
                          for (final c in filteredClasses) ...[
                            () {
                              final cid = asString(c['id']) ?? '';
                              final cname = asString(c['name']) ?? 'Lớp học';
                              final active = asBool(c['active']);
                              final teachers = (c['teacherNames'] is List)
                                  ? (c['teacherNames'] as List).where((e) => e != null).join(', ')
                                  : '';
                              final studentCount = asInt(c['studentCount']) ?? 0;
                              return ListCard(
                                onTap: () => Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) => SchoolClassDetailScreen(classId: cid, className: cname),
                                  ),
                                ),
                                leading: Avatar(name: '${asInt(c['gradeLevel']) ?? ''}', tint: p.blue),
                                title: cname,
                                subtitle: 'Khối ${asInt(c['gradeLevel']) ?? '—'} · ${asString(c['schoolYear']) ?? ''} · $studentCount HS',
                                trailing: Pill(active ? 'Hoạt động' : 'Đã lưu trữ', tone: active ? Tone.success : Tone.neutral),
                                footer: MetaLine(
                                  icon: Icons.person_outline_rounded,
                                  text: teachers.isEmpty ? 'Chưa phân công giáo viên' : teachers,
                                  trailing: Text('Phân công', style: TextStyle(color: p.accent, fontWeight: FontWeight.w700, fontSize: 12)),
                                ),
                              );
                            }(),
                            const SizedBox(height: 10),
                          ],
                      ] else if (_tab == 'assignments') ...[
                        if (filteredAssignments.isEmpty)
                          const EmptyState(art: Art.classes, title: 'Chưa có bài tập nào trong trường')
                        else
                          for (final a in filteredAssignments) ...[
                            () {
                              final active = asString(a['status']) == 'ACTIVE';
                              final dueAt = asDate(a['dueAt']);
                              return ListCard(
                                leading: Avatar(name: asString(a['teacherName']) ?? 'GV', tint: p.teal),
                                title: asString(a['title']) ?? 'Bài tập',
                                subtitle: '${asString(a['teacherName']) ?? '—'} · ${asString(a['className']) ?? 'Giao trực tiếp'} · ${asInt(a['studentCount']) ?? 0} HS',
                                trailing: Pill(active ? 'Đang giao' : 'Đã đóng', tone: active ? Tone.success : Tone.neutral),
                                footer: MetaLine(
                                  icon: Icons.schedule_rounded,
                                  text: dueAt == null ? 'Không giới hạn hạn nộp' : 'Hạn: ${formatDateTime(dueAt)}',
                                ),
                              );
                            }(),
                            const SizedBox(height: 10),
                          ],
                      ] else ...[
                        if (filteredLibrary.isEmpty)
                          const EmptyState(art: Art.library, title: 'Không có mô phỏng nào ở trạng thái này')
                        else
                          for (final item in filteredLibrary) ...[
                            () {
                              final st = asString(item['moderationStatus']) ?? _libStatus;
                              final own = asInt(item['sharedById']) == user.id;
                              return Card(
                                child: Padding(
                                  padding: const EdgeInsets.all(14),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Expanded(
                                            child: Text(
                                              asString(item['title']) ?? 'Mô phỏng',
                                              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                                            ),
                                          ),
                                          const SizedBox(width: 8),
                                          Pill(
                                            st == 'APPROVED'
                                                ? 'Đã duyệt'
                                                : st == 'REJECTED'
                                                    ? 'Từ chối'
                                                    : st == 'REMOVED'
                                                        ? 'Đã gỡ'
                                                        : 'Chờ duyệt',
                                            tone: st == 'APPROVED'
                                                ? Tone.success
                                                : st == 'PENDING'
                                                    ? Tone.warning
                                                    : Tone.danger,
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        'Chia sẻ bởi ${asString(item['sharedByName']) ?? 'Giáo viên'}',
                                        style: TextStyle(color: p.muted, fontSize: 12.5),
                                      ),
                                      if ((asString(item['moderationComment']) ?? '').isNotEmpty) ...[
                                        const SizedBox(height: 6),
                                        Text('Ghi chú: ${asString(item['moderationComment'])}', style: TextStyle(color: p.muted, fontSize: 12)),
                                      ],
                                      const SizedBox(height: 10),
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.end,
                                        children: [
                                          if (st != 'REJECTED' && st != 'REMOVED')
                                            OutlinedButton(
                                              onPressed: () => _decide(schoolId, item, st == 'APPROVED' ? 'REMOVED' : 'REJECTED'),
                                              child: Text(st == 'APPROVED' ? 'Gỡ' : 'Từ chối'),
                                            ),
                                          if (st != 'APPROVED') ...[
                                            const SizedBox(width: 8),
                                            FilledButton(
                                              onPressed: own ? null : () => _decide(schoolId, item, 'APPROVED'),
                                              child: Text(own ? 'Của bạn' : 'Duyệt'),
                                            ),
                                          ],
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            }(),
                            const SizedBox(height: 10),
                          ],
                      ],
                    ],
                  ),
                );
              },
            ),
    );
  }
}
