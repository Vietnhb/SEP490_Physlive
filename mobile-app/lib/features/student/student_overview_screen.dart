import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import 'student_assignment_screen.dart';

String activityModeLabel(ActivityType type) => switch (type) {
      ActivityType.predictObserveExplain => 'Dự đoán · Quan sát · Giải thích',
      ActivityType.measurement => 'Đo đạc thực nghiệm',
      ActivityType.parameterInvestigation => 'Khảo sát tham số',
      ActivityType.freeExploration => 'Khám phá tự do',
    };

/// MStudent — Tổng quan học sinh (KPIs, Cần làm tiếp, Kết quả học tập, Phản hồi, Lớp của tôi).
class StudentOverviewScreen extends StatefulWidget {
  const StudentOverviewScreen({super.key, required this.onOpenAssignments});
  final VoidCallback onOpenAssignments;

  @override
  State<StudentOverviewScreen> createState() => _StudentOverviewScreenState();
}

class _StudentOverviewScreenState extends State<StudentOverviewScreen> {
  int _reload = 0;

  Future<List<Assignment>> _load() async {
    final data = await SessionScope.api(context).get('/assignments/mine/student');
    final items = asJsonList(data).map(Assignment.new).toList();
    items.sort((a, b) {
      final ad = a.dueAt, bd = b.dueAt;
      if (ad == null && bd == null) {
        return (b.assignedAt ?? DateTime(0)).compareTo(a.assignedAt ?? DateTime(0));
      }
      if (ad == null) return 1;
      if (bd == null) return -1;
      return ad.compareTo(bd);
    });
    return items;
  }

  Future<void> _openAssignment(Assignment assignment) async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => StudentAssignmentScreen(assignment: assignment)),
    );
    if (mounted) setState(() => _reload++);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final user = SessionScope.of(context).user;
    if (user == null) return const Scaffold();

    return Scaffold(
      appBar: HeroBar(
        title: 'Hôm nay bạn học gì?',
        subtitle: user.schoolName ?? 'Học tập · PhysLive',
        art: Art.assign,
      ),
      body: Loader<List<Assignment>>(
        load: _load,
        reloadKey: _reload,
        skeleton: const SkeletonList(withStats: true),
        builder: (context, items, reload) {
          final todo = items.where((a) => !a.done).toList()
            ..sort((a, b) {
              // Retryable items surface first, then soonest due date.
              if (a.retryAllowed != b.retryAllowed) return a.retryAllowed ? -1 : 1;
              if (a.dueAt == null && b.dueAt == null) return 0;
              if (a.dueAt == null) return 1;
              if (b.dueAt == null) return -1;
              return a.dueAt!.compareTo(b.dueAt!);
            });
          final done = items.where((a) => a.done).toList();
          final retryCount = todo.where((a) => a.retryAllowed).length;
          final overdueCount = todo.where((a) => a.overdue).length;
          final graded = done.where((a) => a.score != null).toList()
            ..sort((a, b) => (a.completedAt ?? a.assignedAt ?? DateTime(0))
                .compareTo(b.completedAt ?? b.assignedAt ?? DateTime(0)));

          final avgScore = graded.isEmpty
              ? null
              : graded.map((a) => a.score! / (a.maxScore > 0 ? a.maxScore : 10) * 10).reduce((a, b) => a + b) /
                  graded.length;
          final delta = graded.length >= 2
              ? (graded.last.score! / (graded.last.maxScore > 0 ? graded.last.maxScore : 10) * 10) -
                  (graded.first.score! / (graded.first.maxScore > 0 ? graded.first.maxScore : 10) * 10)
              : null;

          final classesMap = <String, ({String name, String? teacher, List<Assignment> list})>{};
          for (final a in items) {
            final cname = (a.className ?? '').trim();
            if (cname.isEmpty) continue;
            final existing = classesMap[cname];
            if (existing == null) {
              classesMap[cname] = (name: cname, teacher: a.assignedByName, list: [a]);
            } else {
              existing.list.add(a);
            }
          }
          final classes = classesMap.values.toList();
          final recentDone = [...done]
            ..sort((a, b) => (b.completedAt ?? b.assignedAt ?? DateTime(0))
                .compareTo(a.completedAt ?? a.assignedAt ?? DateTime(0)));

          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
              children: [
                // 2 KPI stat cards matching MStudent.html
                Row(
                  children: [
                    Expanded(
                      child: _StudentStatCard(
                        icon: Icons.description_outlined,
                        label: 'Cần hoàn thành',
                        value: formatInt(todo.length),
                        note: retryCount > 0
                            ? '$retryCount bài được làm lại'
                            : overdueCount > 0
                                ? '$overdueCount bài quá hạn'
                                : 'Đang đúng tiến độ',
                        highlighted: true,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _StudentStatCard(
                        icon: Icons.check_rounded,
                        label: 'Đã nộp',
                        value: '${done.length} / ${items.length}',
                        note: '${graded.length} bài đã được chấm',
                        highlighted: false,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // Cần làm tiếp
                Card(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(18, 16, 10, 6),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text('Cần làm tiếp', style: Theme.of(context).textTheme.titleMedium),
                            ),
                            TextButton(
                              onPressed: widget.onOpenAssignments,
                              child: const Text('Tất cả'),
                            ),
                          ],
                        ),
                      ),
                      if (todo.isEmpty)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(18, 4, 18, 20),
                          child: Text(
                            'Bạn đã hoàn thành tất cả bài tập được giao.',
                            style: TextStyle(color: p.muted, fontSize: 13),
                          ),
                        )
                      else
                        for (var i = 0; i < math.min(3, todo.length); i++) ...[
                          if (i > 0) Divider(height: 1, color: p.line),
                          _NextTaskTile(
                            assignment: todo[i],
                            onTap: () => _openAssignment(todo[i]),
                          ),
                        ],
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Kết quả học tập (Donut + Line Chart)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Kết quả học tập', style: Theme.of(context).textTheme.titleMedium),
                        const SizedBox(height: 14),
                        Row(
                          children: [
                            SizedBox(
                              width: 88,
                              height: 88,
                              child: Stack(
                                fit: StackFit.expand,
                                children: [
                                  CircularProgressIndicator(
                                    value: avgScore == null ? 0 : (avgScore / 10).clamp(0.0, 1.0),
                                    strokeWidth: 9,
                                    strokeCap: StrokeCap.round,
                                    color: p.accent,
                                    backgroundColor: p.surface2,
                                  ),
                                  Center(
                                    child: Column(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Text(
                                          avgScore == null ? '—' : avgScore.toStringAsFixed(1).replaceAll('.', ','),
                                          style: TextStyle(
                                            fontSize: 21,
                                            fontWeight: FontWeight.w800,
                                            color: p.ink,
                                            height: 1.1,
                                          ),
                                        ),
                                        Text(
                                          'điểm TB / 10',
                                          style: TextStyle(color: p.muted, fontSize: 9.5),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    graded.isEmpty
                                        ? 'Chưa có bài được chấm'
                                        : (delta != null && delta >= 0 ? 'Bạn đang tiến bộ' : 'Giữ vững phong độ'),
                                    style: Theme.of(context).textTheme.titleSmall?.copyWith(fontSize: 15),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    graded.isEmpty
                                        ? 'Hoàn thành bài thực hành để xem tiến độ điểm.'
                                        : 'Điểm đã xác nhận qua ${graded.length} bài thực hành.',
                                    style: TextStyle(color: p.muted, fontSize: 12.5, height: 1.45),
                                  ),
                                  if (delta != null) ...[
                                    const SizedBox(height: 8),
                                    Pill(
                                      '${delta >= 0 ? '+' : ''}${delta.toStringAsFixed(1).replaceAll('.', ',')} so với bài đầu',
                                      tone: delta >= 0 ? Tone.success : Tone.warning,
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ],
                        ),
                        if (graded.length >= 2) ...[
                          const SizedBox(height: 16),
                          SizedBox(
                            height: 126,
                            width: double.infinity,
                            child: CustomPaint(
                              painter: _ScoreTrendPainter(
                                scores: graded
                                    .skip(math.max(0, graded.length - 6))
                                    .map((a) => (a.score! / (a.maxScore > 0 ? a.maxScore : 10) * 10).clamp(0.0, 10.0))
                                    .toList(),
                                accent: p.accent,
                                gridColor: p.line,
                                labelColor: p.muted,
                                dotBg: p.surface,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),

                // Kết quả & phản hồi
                if (recentDone.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(18),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Kết quả & phản hồi', style: Theme.of(context).textTheme.titleMedium),
                          const SizedBox(height: 10),
                          for (var i = 0; i < math.min(3, recentDone.length); i++) ...[
                            if (i > 0) Divider(height: 20, color: p.line),
                            _ResultRow(
                              assignment: recentDone[i],
                              onTap: () => _openAssignment(recentDone[i]),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ],

                // Lớp của tôi
                if (classes.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(18),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Lớp của tôi', style: Theme.of(context).textTheme.titleMedium),
                          const SizedBox(height: 10),
                          for (var i = 0; i < classes.length; i++) ...[
                            if (i > 0) Divider(height: 18, color: p.line),
                            InkWell(
                              borderRadius: BorderRadius.circular(12),
                              onTap: () => Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => StudentClassScreen(
                                    className: classes[i].name,
                                    teacherName: classes[i].teacher,
                                    assignments: classes[i].list,
                                    onOpenAssignment: _openAssignment,
                                  ),
                                ),
                              ),
                              child: Padding(
                                padding: const EdgeInsets.symmetric(vertical: 4),
                                child: Row(
                                  children: [
                                    Container(
                                      width: 42,
                                      height: 42,
                                      decoration: BoxDecoration(color: p.blue.bg, shape: BoxShape.circle),
                                      child: Icon(Icons.menu_book_rounded, color: p.blue.fg, size: 20),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(classes[i].name, style: Theme.of(context).textTheme.titleSmall),
                                          const SizedBox(height: 2),
                                          Text(
                                            classes[i].teacher != null
                                                ? 'Vật lý · Giáo viên ${classes[i].teacher}'
                                                : 'Vật lý · ${classes[i].list.length} bài tập',
                                            style: TextStyle(color: p.muted, fontSize: 12),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Icon(Icons.chevron_right_rounded, color: p.muted),
                                  ],
                                ),
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

class _StudentStatCard extends StatelessWidget {
  const _StudentStatCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.note,
    required this.highlighted,
  });
  final IconData icon;
  final String label, value, note;
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: highlighted ? p.accentSoft : p.surface,
        borderRadius: BorderRadius.circular(17),
        border: Border.all(color: highlighted ? Colors.transparent : p.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 17, color: p.accent),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: p.ink, fontSize: 12, fontWeight: FontWeight.w500),
                ),
              ),
            ],
          ),
          const SizedBox(height: 9),
          Text(
            value,
            style: TextStyle(
              fontSize: 27,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.8,
              color: p.ink,
              height: 1.1,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            note,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(color: p.muted, fontSize: 11),
          ),
        ],
      ),
    );
  }
}

class _NextTaskTile extends StatelessWidget {
  const _NextTaskTile({required this.assignment, required this.onTap});
  final Assignment assignment;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final a = assignment;
    final (badgeLabel, badgeTone, ctaLabel) = a.retryAllowed
        ? ('Cần làm lại', Tone.warning, 'Làm lại')
        : a.overdue
            ? ('Quá hạn', Tone.danger, 'Làm ngay')
            : a.predictionSubmitted
                ? ('Đang làm', Tone.info, 'Tiếp tục')
                : ('Chưa làm', Tone.neutral, 'Làm bài');

    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 12, 18, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    [
                      if (a.className != null) a.className!,
                      if (a.dueAt != null) 'Hạn ${formatDateTime(a.dueAt)}',
                    ].join(' · '),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: p.muted, fontSize: 12),
                  ),
                ),
                const SizedBox(width: 8),
                Pill(badgeLabel, tone: badgeTone),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              a.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.titleSmall?.copyWith(fontSize: 14.5),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: Text(
                    activityModeLabel(a.activity),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: p.muted, fontSize: 12),
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton.icon(
                  style: FilledButton.styleFrom(
                    minimumSize: const Size(0, 36),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    textStyle: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600),
                  ),
                  onPressed: onTap,
                  icon: const Icon(Icons.arrow_forward_rounded, size: 16),
                  label: Text(ctaLabel),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ResultRow extends StatelessWidget {
  const _ResultRow({required this.assignment, required this.onTap});
  final Assignment assignment;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final a = assignment;
    final graded = a.score != null;
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: graded ? p.successSoft : p.infoSoft,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  graded ? Icons.check_rounded : Icons.schedule_rounded,
                  color: graded ? p.success : p.info,
                  size: 19,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      a.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      graded
                          ? 'Đã chấm · ${formatScore(a.score!)} / ${formatScore(a.maxScore)}'
                          : 'Đã nộp${a.completedAt != null ? ' ${formatDateTime(a.completedAt)}' : ''} · Chờ giáo viên chấm',
                      style: TextStyle(color: p.muted, fontSize: 12),
                    ),
                  ],
                ),
              ),
              if (graded)
                Pill('${formatScore(a.score!)}/${formatScore(a.maxScore)}', tone: Tone.success),
              const SizedBox(width: 4),
              Icon(Icons.chevron_right_rounded, color: p.muted, size: 20),
            ],
          ),
          if (a.feedback != null && a.feedback!.trim().isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
              decoration: BoxDecoration(
                color: p.surface2,
                borderRadius: const BorderRadius.only(
                  topRight: Radius.circular(12),
                  bottomRight: Radius.circular(12),
                  bottomLeft: Radius.circular(12),
                  topLeft: Radius.circular(4),
                ),
                border: Border(left: BorderSide(color: p.accent, width: 3)),
              ),
              child: Text(
                '“${a.feedback!.trim()}”',
                style: TextStyle(color: p.ink, fontSize: 12.5, height: 1.5),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ScoreTrendPainter extends CustomPainter {
  _ScoreTrendPainter({
    required this.scores,
    required this.accent,
    required this.gridColor,
    required this.labelColor,
    required this.dotBg,
  });
  final List<double> scores;
  final Color accent, gridColor, labelColor, dotBg;

  @override
  void paint(Canvas canvas, Size size) {
    if (scores.length < 2) return;
    const left = 10.0, right = 10.0, top = 12.0, bottom = 24.0;
    final chartW = size.width - left - right;
    final chartH = size.height - top - bottom;

    final gridPaint = Paint()
      ..color = gridColor
      ..strokeWidth = 1;
    for (final frac in [0.0, 0.5, 1.0]) {
      final y = top + chartH * frac;
      canvas.drawLine(Offset(left, y), Offset(size.width - right, y), gridPaint);
    }

    final pts = <Offset>[];
    for (var i = 0; i < scores.length; i++) {
      final x = left + chartW * (i / (scores.length - 1));
      final y = top + chartH * (1 - (scores[i] / 10).clamp(0.0, 1.0));
      pts.add(Offset(x, y));
    }

    final area = Path()..moveTo(pts.first.dx, top + chartH);
    for (final pt in pts) {
      area.lineTo(pt.dx, pt.dy);
    }
    area
      ..lineTo(pts.last.dx, top + chartH)
      ..close();
    canvas.drawPath(area, Paint()..color = accent.withValues(alpha: 0.12));

    final line = Path()..moveTo(pts.first.dx, pts.first.dy);
    for (var i = 1; i < pts.length; i++) {
      line.lineTo(pts[i].dx, pts[i].dy);
    }
    canvas.drawPath(
      line,
      Paint()
        ..color = accent
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5
        ..strokeJoin = StrokeJoin.round
        ..strokeCap = StrokeCap.round,
    );

    final fillDot = Paint()..color = dotBg;
    final strokeDot = Paint()
      ..color = accent
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;

    for (var i = 0; i < pts.length; i++) {
      canvas.drawCircle(pts[i], 3.8, fillDot);
      canvas.drawCircle(pts[i], 3.8, strokeDot);

      final tp = TextPainter(
        text: TextSpan(
          text: 'Bài ${i + 1}',
          style: TextStyle(color: labelColor, fontSize: 10),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      final dx = (pts[i].dx - tp.width / 2).clamp(0.0, size.width - tp.width);
      tp.paint(canvas, Offset(dx, size.height - 16));
    }
  }

  @override
  bool shouldRepaint(covariant _ScoreTrendPainter old) => old.scores != scores || old.accent != accent;
}

/// MStudentClass — Lớp của tôi (giáo viên phụ trách, bài tập và kết quả trong lớp).
class StudentClassScreen extends StatelessWidget {
  const StudentClassScreen({
    super.key,
    required this.className,
    this.teacherName,
    required this.assignments,
    required this.onOpenAssignment,
  });
  final String className;
  final String? teacherName;
  final List<Assignment> assignments;
  final Future<void> Function(Assignment) onOpenAssignment;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final pending = assignments.where((a) => !a.done).toList();
    final graded = assignments.where((a) => a.done && a.score != null).toList();

    return Scaffold(
      appBar: AppBar(title: Text('Lớp $className')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Lớp $className',
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(color: p.brand),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Vật lý · ${assignments.length} bài tập được giao',
                      style: TextStyle(color: p.muted, fontSize: 13),
                    ),
                  ],
                ),
              ),
              const ArtImage(Art.classes, width: 88, height: 74),
            ],
          ),
          const SizedBox(height: 16),
          if (teacherName != null && teacherName!.trim().isNotEmpty) ...[
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Giáo viên phụ trách', style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Avatar(name: teacherName!, size: 42),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(teacherName!, style: Theme.of(context).textTheme.titleSmall),
                              Text('Giáo viên bộ môn Vật lý', style: TextStyle(color: p.muted, fontSize: 12)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 14),
          ],
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Bài tập trong lớp', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 4),
                  Text(
                    '${pending.length} bài cần hoàn thành · ${graded.length} bài đã chấm',
                    style: TextStyle(color: p.muted, fontSize: 12),
                  ),
                  const SizedBox(height: 10),
                  for (var i = 0; i < assignments.length; i++) ...[
                    if (i > 0) Divider(height: 18, color: p.line),
                    InkWell(
                      borderRadius: BorderRadius.circular(10),
                      onTap: () => onOpenAssignment(assignments[i]),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(assignments[i].title, style: Theme.of(context).textTheme.titleSmall),
                                  const SizedBox(height: 2),
                                  Text(
                                    assignments[i].dueAt != null
                                        ? 'Hạn ${formatDateTime(assignments[i].dueAt)}'
                                        : 'Không giới hạn thời gian',
                                    style: TextStyle(color: p.muted, fontSize: 12),
                                  ),
                                ],
                              ),
                            ),
                            if (assignments[i].done && assignments[i].score != null)
                              Pill('${formatScore(assignments[i].score!)}/${formatScore(assignments[i].maxScore)}',
                                  tone: Tone.success)
                            else if (assignments[i].done)
                              const Pill('Chờ chấm', tone: Tone.info)
                            else
                              const Pill('Cần làm', tone: Tone.warning),
                            const SizedBox(width: 4),
                            Icon(Icons.chevron_right_rounded, color: p.muted, size: 18),
                          ],
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
