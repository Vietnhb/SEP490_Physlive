import 'package:flutter/material.dart';

import '../../core/api.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../account/account_screens.dart';
import 'school_billing_and_reports_screen.dart';
import 'school_classes_screen.dart';

class _SchoolOverviewData {
  _SchoolOverviewData(this.summary, this.planName, this.pendingAppeals, this.classes, this.monthlyTokens);
  final Json summary;
  final String? planName;
  final int pendingAppeals;
  final List<Json> classes;
  final List<Json> monthlyTokens;
}

/// MSchool — Tổng quan quản lý trường.
class SchoolOverviewScreen extends StatefulWidget {
  const SchoolOverviewScreen({
    super.key,
    this.onOpenClasses,
  });
  final VoidCallback? onOpenClasses;

  @override
  State<SchoolOverviewScreen> createState() => _SchoolOverviewScreenState();
}

class _SchoolOverviewScreenState extends State<SchoolOverviewScreen> {
  Future<_SchoolOverviewData> _load() async {
    final api = SessionScope.api(context);
    final schoolId = SessionScope.read(context).user?.schoolId;
    if (schoolId == null) throw ApiException('Tài khoản chưa gắn với trường nào.');
    final results = await Future.wait([
      api.get('/schools/$schoolId/reports/summary'),
      api.get('/auth/plans').then<Object?>((v) => v, onError: (_) => null),
      api.get('/support/inbox/pending-count').then<Object?>((v) => v, onError: (_) => null),
      api.get('/schools/$schoolId/classes').then<Object?>((v) => v, onError: (_) => null),
      api.get('/schools/$schoolId/reports/tokens/monthly').then<Object?>((v) => v, onError: (_) => null),
    ]);
    final summary = asJson(results[0]);
    final code = asString(summary['planCode']);
    final plan = asJsonList(results[1]).where((p) => asString(p['code']) == code).firstOrNull;
    final pending = asInt(asJson(results[2])['count']) ?? 0;
    final classes = asJsonList(results[3]);
    final monthly = asJsonList(results[4]);
    return _SchoolOverviewData(summary, plan == null ? code : asString(plan['name']), pending, classes, monthly);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final user = SessionScope.of(context).user;
    if (user == null) return const Scaffold();
    return Scaffold(
      appBar: const RoleTopBar(subtitle: 'Quản lý trường'),
      body: Loader<_SchoolOverviewData>(
        load: _load,
        skeleton: const SkeletonList(withStats: true, count: 3),
        builder: (context, data, reload) {
          final s = data.summary;
          final schoolName = asString(s['schoolName']) ?? user.schoolName ?? 'Nhà trường';
          final status = asString(s['licenseStatus']) ?? '';
          final licenceEnd = asDate(s['licenseEnd']);
          final daysLeft = licenceEnd?.difference(DateTime.now()).inDays;
          final used = asInt(s['usedTokens']) ?? 0;
          final quota = asInt(s['tokenQuota']);
          final tokenPct = (quota != null && quota > 0) ? ((used / quota) * 100).round().clamp(0, 100) : null;
          final students = asInt(s['students']) ?? 0;
          final studentQuota = asInt(s['studentQuota']);
          final teachers = asInt(s['teachers']) ?? 0;
          final activeClasses = asInt(s['activeClasses']) ?? data.classes.length;
          final unassigned = data.classes.where((c) => (asInt(c['teacherCount']) ?? 0) == 0).toList();

          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
              children: [
                // Heading matching MSchool
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            schoolName,
                            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                              color: p.brand,
                              letterSpacing: -0.4,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            data.planName != null ? 'Gói ${data.planName}' : 'Không gian quản trị trường',
                            style: TextStyle(color: p.muted, fontSize: 13),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 10),
                    SizedBox(width: 70, height: 56, child: ArtImage(Art.school)),
                  ],
                ),

                // License expiry warning notice
                if (status != 'ACTIVE' || (daysLeft != null && daysLeft <= 14)) ...[
                  const SizedBox(height: 12),
                  InkWell(
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const SchoolBillingScreen()),
                    ),
                    borderRadius: BorderRadius.circular(14),
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: p.amber.bg,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.notifications_active_outlined, color: p.amber.fg, size: 20),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              status != 'ACTIVE'
                                  ? 'Bản quyền chưa kích hoạt hoặc đã hết hạn. Chạm để gia hạn gói.'
                                  : 'Gói sử dụng còn ${daysLeft! < 0 ? 0 : daysLeft} ngày. Gia hạn để hoạt động không bị gián đoạn.',
                              style: TextStyle(color: p.amber.fg, fontSize: 13, fontWeight: FontWeight.w600),
                            ),
                          ),
                          Icon(Icons.chevron_right_rounded, color: p.amber.fg, size: 20),
                        ],
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 14),

                // 4 KPI Cards
                Pair(
                  StatTile(
                    label: 'Học sinh',
                    value: groupDigits(students),
                    detail: studentQuota == null ? '${asInt(s['enrolledStudents']) ?? 0} đã xếp lớp' : 'Trong hạn mức ${groupDigits(studentQuota)}',
                    icon: Icons.school_rounded,
                    tint: p.blue,
                  ),
                  StatTile(
                    label: 'Giáo viên',
                    value: groupDigits(teachers),
                    detail: 'Tài khoản thuộc trường',
                    icon: Icons.co_present_rounded,
                    tint: p.teal,
                  ),
                ),
                const SizedBox(height: 10),
                Pair(
                  StatTile(
                    label: 'Lớp hoạt động',
                    value: '$activeClasses',
                    detail: '${asInt(s['enrolledStudents']) ?? 0} HS đã xếp lớp',
                    icon: Icons.menu_book_rounded,
                    tint: p.violet,
                    onTap: widget.onOpenClasses,
                  ),
                  StatTile(
                    label: 'Token AI',
                    value: _shortTokens(used),
                    detail: tokenPct == null ? 'Không giới hạn' : '$tokenPct% hạn mức tháng',
                    icon: Icons.auto_awesome_rounded,
                    tint: tokenPct != null && tokenPct >= 80 ? p.amber : p.green,
                  ),
                ),

                // Cần chú ý
                if (data.pendingAppeals > 0 || unassigned.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  Card(
                    clipBehavior: Clip.antiAlias,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
                          child: Text('Cần chú ý', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                        ),
                        if (data.pendingAppeals > 0) ...[
                          _NavRow(
                            icon: Icons.lock_open_rounded,
                            title: '${data.pendingAppeals} yêu cầu mở khóa',
                            subtitle: 'Giáo viên và học sinh đang chờ duyệt',
                            badge: '${data.pendingAppeals}',
                            badgeTone: Tone.warning,
                            onTap: () => Navigator.of(context).push(
                              MaterialPageRoute(builder: (_) => const SchoolAppealsScreen()),
                            ),
                          ),
                          if (unassigned.isNotEmpty) Divider(height: 1, indent: 68, color: p.line),
                        ],
                        for (var i = 0; i < unassigned.take(2).length; i++) ...[
                          if (i > 0) Divider(height: 1, indent: 68, color: p.line),
                          _NavRow(
                            icon: Icons.person_search_rounded,
                            title: 'Lớp ${asString(unassigned[i]['name']) ?? ''} chưa có giáo viên',
                            subtitle: '${asInt(unassigned[i]['studentCount']) ?? 0} học sinh trong lớp',
                            onTap: () => Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => SchoolClassDetailScreen(
                                  classId: asString(unassigned[i]['id']) ?? '',
                                  className: asString(unassigned[i]['name']) ?? 'Lớp',
                                ),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],

                // Lớp học gần đây
                const SizedBox(height: 14),
                Card(
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 12, 10, 4),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text('Lớp học gần đây', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                            ),
                            if (widget.onOpenClasses != null)
                              TextButton(onPressed: widget.onOpenClasses, child: const Text('Xem tất cả')),
                          ],
                        ),
                      ),
                      if (data.classes.isEmpty)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                          child: Text('Trường chưa có lớp học nào.', style: TextStyle(color: p.muted, fontSize: 13)),
                        )
                      else
                        for (var i = 0; i < data.classes.take(3).length; i++) ...[
                          if (i > 0) Divider(height: 1, indent: 68, color: p.line),
                          _NavRow(
                            icon: Icons.menu_book_rounded,
                            title: asString(data.classes[i]['name']) ?? 'Lớp',
                            subtitle: '${asInt(data.classes[i]['studentCount']) ?? 0} học sinh · ${asInt(data.classes[i]['teacherCount']) ?? 0} giáo viên',
                            onTap: () => Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => SchoolClassDetailScreen(
                                  classId: asString(data.classes[i]['id']) ?? '',
                                  className: asString(data.classes[i]['name']) ?? 'Lớp',
                                ),
                              ),
                            ),
                          ),
                        ],
                    ],
                  ),
                ),

                // Token AI theo tháng bar chart
                if (data.monthlyTokens.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Token AI theo tháng', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                          const SizedBox(height: 14),
                          SchoolTokenBars(rows: data.monthlyTokens),
                        ],
                      ),
                    ),
                  ),
                ],

                const SizedBox(height: 14),
                OutlinedButton.icon(
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const SchoolBillingScreen()),
                  ),
                  icon: const Icon(Icons.credit_card_rounded, size: 18),
                  label: const Text('Xem gói & thanh toán'),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

/// MSchoolMore — Tab "Thêm" cho Quản lý trường.
class SchoolMoreScreen extends StatelessWidget {
  const SchoolMoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      appBar: const RoleTopBar(subtitle: 'Quản lý trường'),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 18, 16, 28),
        children: [
          Text(
            'Không gian quản lý trường',
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
                _NavRow(
                  icon: Icons.upload_file_rounded,
                  title: 'Nhập dữ liệu CSV',
                  subtitle: 'Nhập hàng loạt tài khoản, lớp học, xếp lớp',
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const SchoolImportScreen()),
                  ),
                ),
                Divider(height: 1, indent: 68, color: p.line),
                _NavRow(
                  icon: Icons.lock_open_rounded,
                  title: 'Yêu cầu mở khóa',
                  subtitle: 'Xem và xử lý khiếu nại tài khoản bị tạm khóa',
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const SchoolAppealsScreen()),
                  ),
                ),
                Divider(height: 1, indent: 68, color: p.line),
                _NavRow(
                  icon: Icons.bar_chart_rounded,
                  title: 'Báo cáo trường',
                  subtitle: 'Thống kê lớp học, token AI và xuất CSV',
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const SchoolReportsScreen()),
                  ),
                ),
                Divider(height: 1, indent: 68, color: p.line),
                _NavRow(
                  icon: Icons.credit_card_rounded,
                  title: 'Mua & gia hạn gói',
                  subtitle: 'Xem gói hiện tại, báo giá và lịch sử thanh toán',
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const SchoolBillingScreen()),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Card(
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: [
                _NavRow(
                  icon: Icons.person_outline_rounded,
                  title: 'Hồ sơ & bảo mật',
                  subtitle: 'Thông tin cá nhân, mật khẩu, giao diện',
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const AccountScreen()),
                  ),
                ),
                Divider(height: 1, indent: 68, color: p.line),
                _NavRow(
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

class _NavRow extends StatelessWidget {
  const _NavRow({
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
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
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
                  Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5)),
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

/// Reusable monthly AI token bar chart matching MSchool / MSchoolReports.
class SchoolTokenBars extends StatelessWidget {
  const SchoolTokenBars({super.key, required this.rows, this.showAll = false});
  final List<Json> rows;
  final bool showAll;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final shown = showAll ? rows : (rows.length > 6 ? rows.sublist(rows.length - 6) : rows);
    final compact = shown.length > 6;
    final maxVal = shown.fold<int>(1, (m, r) {
      final v = asInt(r['tokens']) ?? 0;
      return v > m ? v : m;
    });
    return SizedBox(
      height: 140,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          for (final r in shown)
            Expanded(
              child: Padding(
                padding: EdgeInsets.symmetric(horizontal: compact ? 2 : 4),
                child: () {
                  final tokens = asInt(r['tokens']) ?? 0;
                  final barHeight = tokens == 0 ? 4.0 : (tokens / maxVal * 82).clamp(8.0, 82.0);
                  return Column(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(
                          tokens == 0 && compact ? '' : _shortTokens(tokens),
                          style: TextStyle(
                            fontSize: compact ? 9 : 10.5,
                            fontWeight: FontWeight.w700,
                            color: tokens == 0 ? p.muted : p.ink,
                          ),
                        ),
                      ),
                      const SizedBox(height: 5),
                      Container(
                        height: barHeight,
                        decoration: BoxDecoration(
                          color: tokens == 0 ? p.line : p.accent,
                          borderRadius: BorderRadius.circular(compact ? 4 : 6),
                        ),
                      ),
                      const SizedBox(height: 6),
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(
                          _monthLabel(asString(r['month'])),
                          style: TextStyle(
                            fontSize: compact ? 9.5 : 11,
                            color: tokens == 0 ? p.muted : p.ink,
                            fontWeight: tokens == 0 ? FontWeight.w500 : FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  );
                }(),
              ),
            ),
        ],
      ),
    );
  }
}

String _shortTokens(int value) {
  if (value >= 1000000) return '${(value / 1000000).toStringAsFixed(1)}M';
  if (value >= 1000) return '${(value / 1000).round()}k';
  return '$value';
}

String _monthLabel(String? iso) {
  if (iso == null || iso.length < 7) return '—';
  final m = int.tryParse(iso.substring(5, 7));
  return m == null ? iso : 'T$m';
}
