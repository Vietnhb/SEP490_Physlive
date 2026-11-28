import 'package:flutter/material.dart';

import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../account/account_screens.dart';
import 'payments_screen.dart';

class _AdminOverviewData {
  _AdminOverviewData(this.counts, this.analytics, this.managers);
  final Json counts;
  final Json? analytics;
  final List<ManagedUser> managers;
}

/// MAdmin — Tổng quan quản trị hệ thống (4 KPI, Tài khoản vận hành, Vai trò, Hoạt động & giao dịch).
class AdminOverviewScreen extends StatefulWidget {
  const AdminOverviewScreen({super.key, this.onOpenUsers});
  final VoidCallback? onOpenUsers;

  @override
  State<AdminOverviewScreen> createState() => _AdminOverviewScreenState();
}

class _AdminOverviewScreenState extends State<AdminOverviewScreen> {
  int _reload = 0;
  String _timeframe = 'week'; // 'week' | 'month'

  void _showOperationDetails(BuildContext context, Json analytics) {
    final p = context.palette;
    final isWeek = _timeframe == 'week';
    final periodLabel = isWeek ? 'tuần này' : 'tháng này';
    final breakdown = asJson(analytics['operationBreakdown']);
    final details = asJson(isWeek ? breakdown['weekly'] : breakdown['monthly']);
    final totalOps = asInt(isWeek ? analytics['operationsThisWeek'] : analytics['operationsThisMonth']);
    final startRaw = asString(isWeek ? breakdown['weekStart'] : breakdown['monthStart']);
    final endRaw = asString(breakdown['measuredAt']);
    final hasDetails = details.isNotEmpty;

    final rows = [
      ('Chạy mô phỏng', asInt(details['simulationRuns']) ?? 0, 'Số bản ghi chạy mô phỏng được tạo trong kỳ.'),
      ('Nộp bài', asInt(details['submissions']) ?? 0, 'Số bài làm có thời điểm nộp trong kỳ.'),
      ('Chấm bài', asInt(details['gradedSubmissions']) ?? 0, 'Số bài làm có thời điểm chấm gần nhất trong kỳ.'),
    ];

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: p.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 22),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(color: p.line, borderRadius: BorderRadius.circular(99)),
                ),
              ),
              const SizedBox(height: 14),
              Text(
                'Chi tiết thao tác $periodLabel',
                style: Theme.of(ctx).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800, color: p.brand),
              ),
              const SizedBox(height: 4),
              Text(
                'Hoạt động trên toàn nền tảng, gồm chạy mô phỏng, nộp bài và chấm bài.',
                style: TextStyle(color: p.muted, fontSize: 13),
              ),
              if (startRaw != null && endRaw != null) ...[
                const SizedBox(height: 8),
                Text(
                  '${formatDateTime(asDate(startRaw))} – ${formatDateTime(asDate(endRaw))} · Giờ Việt Nam',
                  style: TextStyle(color: p.muted, fontSize: 12),
                ),
              ],
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: p.teal.bg,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text('Tổng thao tác', style: TextStyle(fontWeight: FontWeight.w600, color: p.teal.fg)),
                    ),
                    Text(
                      totalOps == null ? '—' : groupDigits(totalOps),
                      style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: p.teal.fg),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              if (hasDetails) ...[
                for (var i = 0; i < rows.length; i++) ...[
                  if (i > 0) Divider(height: 1, color: p.line),
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(rows[i].$1, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                              const SizedBox(height: 2),
                              Text(rows[i].$3, style: TextStyle(color: p.muted, fontSize: 12)),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        Text(
                          groupDigits(rows[i].$2),
                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 6),
                Text(
                  'Một bài vừa được nộp vừa được chấm trong kỳ được tính ở cả hai nhóm. Mục này thống kê hoạt động học tập và mô phỏng trên toàn hệ thống.',
                  style: TextStyle(color: p.muted, fontSize: 11.5, height: 1.4),
                ),
              ] else
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  child: Text('Chưa tải được số liệu chi tiết.', style: TextStyle(color: p.muted, fontSize: 13)),
                ),
              const SizedBox(height: 14),
              FilledButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text('Đóng'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<_AdminOverviewData> _load() async {
    final api = SessionScope.api(context);
    final res = await Future.wait([
      api.get('/admin/overview-counts'),
      api.get('/admin/analytics').then<Object?>((v) => v, onError: (_) => null),
      api.get('/admin/users/page', query: {'role': 'MANAGER', 'page': '0', 'size': '5'})
          .then<Object?>((v) => v, onError: (_) => null),
    ]);
    final counts = asJson(res[0]);
    final analytics = res[1] == null ? null : asJson(res[1]);
    final managers = res[2] == null
        ? const <ManagedUser>[]
        : asJsonList(asJson(res[2])['items']).map(ManagedUser.new).toList();
    return _AdminOverviewData(counts, analytics, managers);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final user = SessionScope.of(context).user;
    if (user == null) return const Scaffold();

    return Scaffold(
      appBar: const RoleTopBar(subtitle: 'Quản trị hệ thống'),
      body: Loader<_AdminOverviewData>(
        load: _load,
        reloadKey: _reload,
        skeleton: const SkeletonList(withStats: true, count: 3),
        builder: (context, data, reload) {
          final accounts = asJson(data.counts['accounts']);
          final total = asInt(accounts['total']) ?? 0;
          final suspended = asInt(accounts['suspended']) ?? 0;
          final active = (total - suspended).clamp(0, total);
          final managerCount = asInt(accounts['MANAGER']) ?? data.managers.length;
          final revenue = data.analytics == null ? null : asJson(data.analytics!['revenue']);
          final timeline = revenue == null ? const <Json>[] : asJsonList(revenue['timeline']);
          final maxAmt = timeline.fold<double>(1, (m, t) {
            final v = (asInt(t['amountVnd']) ?? 0).toDouble();
            return v > m ? v : m;
          });

          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Quản trị hệ thống',
                            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                              color: p.brand,
                              letterSpacing: -0.4,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text('Tài khoản và hoạt động trên nền tảng.', style: TextStyle(color: p.muted, fontSize: 13)),
                        ],
                      ),
                    ),
                    const SizedBox(width: 10),
                    SizedBox(width: 70, height: 56, child: ArtImage(Art.ops)),
                  ],
                ),
                const SizedBox(height: 16),

                // 4 KPI Cards
                Pair(
                  StatTile(
                    label: 'Tổng tài khoản',
                    value: groupDigits(total),
                    detail: 'Tất cả vai trò',
                    icon: Icons.people_alt_rounded,
                    tint: p.blue,
                    onTap: widget.onOpenUsers,
                  ),
                  StatTile(
                    label: 'Hoạt động',
                    value: groupDigits(active),
                    detail: '$suspended tài khoản tạm khóa',
                    icon: Icons.check_circle_outline_rounded,
                    tint: p.green,
                    onTap: widget.onOpenUsers,
                  ),
                ),
                const SizedBox(height: 10),
                Pair(
                  StatTile(
                    label: 'Manager',
                    value: '$managerCount',
                    detail: 'Tài khoản vận hành',
                    icon: Icons.verified_user_outlined,
                    tint: p.violet,
                    onTap: widget.onOpenUsers,
                  ),
                  StatTile(
                    label: 'Tạm khóa',
                    value: '$suspended',
                    detail: 'Kiểm tra quyền truy cập',
                    icon: Icons.lock_outline_rounded,
                    tint: suspended > 0 ? p.rose : p.teal,
                    onTap: widget.onOpenUsers,
                  ),
                ),
                const SizedBox(height: 14),

                // Tài khoản vận hành (Managers)
                Card(
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 12, 10, 4),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text('Tài khoản vận hành', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                            ),
                            TextButton(
                              onPressed: widget.onOpenUsers,
                              child: const Text('Quản lý'),
                            ),
                          ],
                        ),
                      ),
                      if (data.managers.isEmpty)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                          child: Text('Chưa có tài khoản Manager nào.', style: TextStyle(color: p.muted, fontSize: 13)),
                        )
                      else
                        for (var i = 0; i < data.managers.length; i++) ...[
                          if (i > 0) Divider(height: 1, indent: 68, color: p.line),
                          ListTile(
                            onTap: widget.onOpenUsers,
                            leading: Avatar(name: data.managers[i].fullName, url: data.managers[i].avatarUrl, tint: p.violet),
                            title: Text(data.managers[i].fullName, style: const TextStyle(fontWeight: FontWeight.w600)),
                            subtitle: Text(
                              'Manager · ${data.managers[i].suspended ? 'Tạm khóa' : 'Đang hoạt động'}',
                              style: TextStyle(color: data.managers[i].suspended ? p.danger : p.muted, fontSize: 12),
                            ),
                            trailing: Icon(Icons.chevron_right_rounded, color: p.muted, size: 20),
                          ),
                        ],
                      Padding(
                        padding: const EdgeInsets.fromLTRB(14, 4, 14, 14),
                        child: FilledButton.tonalIcon(
                          onPressed: () async {
                            final created = await Navigator.of(context).push<bool>(
                              MaterialPageRoute(builder: (_) => const AdminCreateManagerScreen()),
                            );
                            if (created == true && mounted) setState(() => _reload++);
                          },
                          icon: const Icon(Icons.person_add_alt_1_rounded, size: 18),
                          label: const Text('Tạo tài khoản Manager'),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),

                // Tài khoản theo vai trò
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text('Tài khoản theo vai trò', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                        const SizedBox(height: 12),
                        for (final role in const ['SCHOOL', 'STAFF', 'STUDENT', 'REVIEWER', 'MANAGER', 'ADMIN']) ...[
                          () {
                            final count = asInt(accounts[role]) ?? 0;
                            final ratio = total == 0 ? 0.0 : (count / total).clamp(0.0, 1.0);
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: Column(
                                children: [
                                  Row(
                                    children: [
                                      Expanded(child: Text(roleName(role), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600))),
                                      Text(groupDigits(count), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                                    ],
                                  ),
                                  const SizedBox(height: 5),
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(99),
                                    child: LinearProgressIndicator(
                                      value: count == 0 ? 0 : ratio.clamp(0.04, 1.0),
                                      minHeight: 6,
                                      color: roleTint(context, role).fg,
                                      backgroundColor: p.surface2,
                                    ),
                                  ),
                                ],
                              ),
                            );
                          }(),
                        ],
                      ],
                    ),
                  ),
                ),

                // Hoạt động nền tảng và giao dịch (Chỉ số trong kỳ + Doanh thu 4 tuần gần nhất)
                if (data.analytics != null) ...[
                  const SizedBox(height: 14),
                  () {
                    final analytics = data.analytics!;
                    final isWeek = _timeframe == 'week';
                    final periodLabel = isWeek ? 'tuần này' : 'tháng này';
                    final postBreakdown = asJson(analytics['postBreakdown']);
                    final postStats = asJson(isWeek ? postBreakdown['weekly'] : postBreakdown['monthly']);
                    final posts = asInt(postStats['periodTotalPosts']) ??
                        asInt(isWeek ? analytics['postsThisWeek'] : analytics['postsThisMonth']);
                    final operations = asInt(isWeek ? analytics['operationsThisWeek'] : analytics['operationsThisMonth']);
                    final periodRev = revenue == null
                        ? null
                        : asInt(isWeek ? revenue['weeklyVnd'] : revenue['monthlyVnd']);

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
                                    'Hoạt động nền tảng và giao dịch',
                                    style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                                  ),
                                ),
                                InkWell(
                                  borderRadius: BorderRadius.circular(8),
                                  onTap: () => Navigator.of(context).push(
                                    MaterialPageRoute(builder: (_) => const PaymentsScreen()),
                                  ),
                                  child: Padding(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                                    child: Text('Giao dịch', style: TextStyle(color: p.accent, fontWeight: FontWeight.w700, fontSize: 13)),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                Expanded(
                                  child: Text('Chỉ số trong kỳ', style: TextStyle(color: p.muted, fontSize: 13, fontWeight: FontWeight.w600)),
                                ),
                                Container(
                                  padding: const EdgeInsets.all(3),
                                  decoration: BoxDecoration(
                                    color: p.surface2,
                                    borderRadius: BorderRadius.circular(999),
                                    border: Border.all(color: p.line),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      for (final opt in const [('week', 'Tuần này'), ('month', 'Tháng này')])
                                        GestureDetector(
                                          onTap: () => setState(() => _timeframe = opt.$1),
                                          child: AnimatedContainer(
                                            duration: const Duration(milliseconds: 160),
                                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                            decoration: BoxDecoration(
                                              color: _timeframe == opt.$1 ? p.blue.bg : Colors.transparent,
                                              borderRadius: BorderRadius.circular(999),
                                            ),
                                            child: Text(
                                              opt.$2,
                                              style: TextStyle(
                                                fontSize: 12,
                                                fontWeight: _timeframe == opt.$1 ? FontWeight.w700 : FontWeight.w500,
                                                color: _timeframe == opt.$1 ? p.blue.fg : p.muted,
                                              ),
                                            ),
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            _PeriodMetricBox(
                              label: 'Mô phỏng $periodLabel',
                              value: posts == null ? '—' : groupDigits(posts),
                            ),
                            const SizedBox(height: 8),
                            _PeriodMetricBox(
                              label: 'Thao tác $periodLabel',
                              value: operations == null ? '—' : groupDigits(operations),
                              actionLabel: 'Xem chi tiết',
                              onAction: () => _showOperationDetails(context, analytics),
                            ),
                            const SizedBox(height: 8),
                            _PeriodMetricBox(
                              label: 'Doanh thu $periodLabel',
                              value: periodRev == null ? '—' : (periodRev == 0 ? '0 ₫' : compactVnd(periodRev)),
                            ),
                            if (timeline.isNotEmpty) ...[
                              const SizedBox(height: 16),
                              Divider(height: 1, color: p.line),
                              const SizedBox(height: 14),
                              Text('Doanh thu 4 tuần gần nhất', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: p.ink)),
                              const SizedBox(height: 12),
                              SizedBox(
                                height: 130,
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    for (final t in timeline)
                                      Expanded(
                                        child: Padding(
                                          padding: const EdgeInsets.symmetric(horizontal: 5),
                                          child: () {
                                            final amt = (asInt(t['amountVnd']) ?? 0).toDouble();
                                            final h = amt == 0 ? 5.0 : (amt / maxAmt * 78).clamp(10.0, 78.0);
                                            return Column(
                                              mainAxisAlignment: MainAxisAlignment.end,
                                              children: [
                                                FittedBox(
                                                  fit: BoxFit.scaleDown,
                                                  child: Text(
                                                    amt == 0 ? '0' : compactVnd(amt.round()).replaceAll(' ₫', ''),
                                                    style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: amt == 0 ? p.muted : p.ink),
                                                  ),
                                                ),
                                                const SizedBox(height: 5),
                                                Container(
                                                  height: h,
                                                  decoration: BoxDecoration(
                                                    color: amt == 0 ? p.line : p.accent,
                                                    borderRadius: BorderRadius.circular(6),
                                                  ),
                                                ),
                                                const SizedBox(height: 6),
                                                FittedBox(
                                                  fit: BoxFit.scaleDown,
                                                  child: Text(
                                                    asString(t['label']) ?? '',
                                                    style: TextStyle(fontSize: 10.5, color: p.muted),
                                                  ),
                                                ),
                                              ],
                                            );
                                          }(),
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                            ],
                            () {
                              final plans = revenue == null ? const <Json>[] : asJsonList(revenue['byPlan']);
                              final totalVnd = asInt(revenue?['totalVnd']) ?? 0;
                              final recent = revenue == null ? const <Json>[] : asJsonList(revenue['recentTransactions']).take(4).toList();
                              return Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  if (plans.isNotEmpty) ...[
                                    const SizedBox(height: 16),
                                    Divider(height: 1, color: p.line),
                                    const SizedBox(height: 14),
                                    Row(
                                      children: [
                                        const Expanded(child: Text('Doanh thu theo gói', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
                                        Text('Tổng tích lũy', style: TextStyle(color: p.muted, fontSize: 11.5)),
                                      ],
                                    ),
                                    const SizedBox(height: 10),
                                    for (final plan in plans) ...[
                                      () {
                                        final amt = asInt(plan['amountVnd']) ?? 0;
                                        final cnt = asInt(plan['count']) ?? 0;
                                        final pct = totalVnd > 0 ? ((amt / totalVnd) * 100).round().clamp(0, 100) : 0;
                                        return Padding(
                                          padding: const EdgeInsets.only(bottom: 10),
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Row(
                                                children: [
                                                  Expanded(
                                                    child: Text(
                                                      asString(plan['name']) ?? asString(plan['planCode']) ?? 'Gói',
                                                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                                                    ),
                                                  ),
                                                  Text(compactVnd(amt), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                                                ],
                                              ),
                                              const SizedBox(height: 5),
                                              ClipRRect(
                                                borderRadius: BorderRadius.circular(99),
                                                child: LinearProgressIndicator(
                                                  value: pct == 0 ? 0 : (pct / 100).clamp(0.04, 1.0),
                                                  minHeight: 6,
                                                  color: p.blue.fg,
                                                  backgroundColor: p.surface2,
                                                ),
                                              ),
                                              const SizedBox(height: 3),
                                              Text('$cnt giao dịch · $pct% tổng doanh thu', style: TextStyle(color: p.muted, fontSize: 11.5)),
                                            ],
                                          ),
                                        );
                                      }(),
                                    ],
                                  ],
                                  if (recent.isNotEmpty) ...[
                                    const SizedBox(height: 8),
                                    Divider(height: 1, color: p.line),
                                    const SizedBox(height: 14),
                                    Row(
                                      children: [
                                        const Expanded(child: Text('Giao dịch gần nhất', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
                                        Text('Tối đa 4 giao dịch', style: TextStyle(color: p.muted, fontSize: 11.5)),
                                      ],
                                    ),
                                    const SizedBox(height: 8),
                                    for (var i = 0; i < recent.length; i++) ...[
                                      if (i > 0) Divider(height: 1, color: p.line),
                                      () {
                                        final tx = recent[i];
                                        final st = (asString(tx['status']) ?? '').toUpperCase();
                                        final createdAt = asDate(tx['createdAt']);
                                        return Padding(
                                          padding: const EdgeInsets.symmetric(vertical: 10),
                                          child: Row(
                                            children: [
                                              Expanded(
                                                child: Column(
                                                  crossAxisAlignment: CrossAxisAlignment.start,
                                                  children: [
                                                    Text(
                                                      asString(tx['schoolName']) ?? 'Trường học',
                                                      maxLines: 1,
                                                      overflow: TextOverflow.ellipsis,
                                                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5),
                                                    ),
                                                    const SizedBox(height: 2),
                                                    Text(
                                                      '${asString(tx['planName']) ?? 'Gói'} · ${createdAt == null ? '—' : formatDateTime(createdAt)}',
                                                      style: TextStyle(color: p.muted, fontSize: 11.5),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                              const SizedBox(width: 10),
                                              Column(
                                                crossAxisAlignment: CrossAxisAlignment.end,
                                                children: [
                                                  Text(compactVnd(asInt(tx['amountVnd']) ?? 0), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                                                  const SizedBox(height: 3),
                                                  Pill(
                                                    st == 'PAID' ? 'Đã thanh toán' : (st == 'FAILED' ? 'Thất bại' : 'Chờ thanh toán'),
                                                    tone: st == 'PAID' ? Tone.success : (st == 'FAILED' ? Tone.danger : Tone.warning),
                                                  ),
                                                ],
                                              ),
                                            ],
                                          ),
                                        );
                                      }(),
                                    ],
                                  ],
                                ],
                              );
                            }(),
                          ],
                        ),
                      ),
                    );
                  }(),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}

/// Tạo tài khoản vận hành (Manager / Reviewer) cho Admin (POST /admin/users).
class AdminCreateManagerScreen extends StatefulWidget {
  const AdminCreateManagerScreen({super.key});

  @override
  State<AdminCreateManagerScreen> createState() => _AdminCreateManagerScreenState();
}

class _AdminCreateManagerScreenState extends State<AdminCreateManagerScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  String _role = 'MANAGER';
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await SessionScope.api(context).post('/admin/users', {
        'fullName': _name.text.trim(),
        'email': _email.text.trim(),
        'password': _password.text,
        'role': _role,
      });
      if (!mounted) return;
      showMessage(context, 'Đã tạo tài khoản ${roleName(_role)}.');
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
      appBar: const RoleTopBar(subtitle: 'Quản trị hệ thống', showBack: true),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 32),
          children: [
            Text(
              'Tạo tài khoản quản trị / vận hành',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontSize: 22, fontWeight: FontWeight.w800, color: p.brand),
            ),
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    DropdownButtonFormField<String>(
                      initialValue: _role,
                      borderRadius: BorderRadius.circular(14),
                      dropdownColor: p.surface,
                      elevation: 4,
                      decoration: const InputDecoration(labelText: 'Vai trò'),
                      items: const [
                        DropdownMenuItem(value: 'MANAGER', child: Text('Vận hành (Manager)')),
                        DropdownMenuItem(value: 'REVIEWER', child: Text('Kiểm duyệt vật lý (Reviewer)')),
                      ],
                      onChanged: _busy ? null : (v) => setState(() => _role = v ?? 'MANAGER'),
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _name,
                      enabled: !_busy,
                      decoration: const InputDecoration(labelText: 'Họ và tên'),
                      validator: (v) => v == null || v.trim().isEmpty ? 'Nhập họ và tên.' : null,
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _email,
                      enabled: !_busy,
                      keyboardType: TextInputType.emailAddress,
                      decoration: const InputDecoration(labelText: 'Email'),
                      validator: (v) => v == null || !v.contains('@') ? 'Nhập email hợp lệ.' : null,
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _password,
                      enabled: !_busy,
                      obscureText: true,
                      decoration: const InputDecoration(labelText: 'Mật khẩu tạm (tối thiểu 8 ký tự)'),
                      validator: (v) => v == null || v.length < 8 ? 'Mật khẩu tối thiểu 8 ký tự.' : null,
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
                          : const Text('Tạo tài khoản'),
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

class _PeriodMetricBox extends StatelessWidget {
  const _PeriodMetricBox({
    required this.label,
    required this.value,
    this.actionLabel,
    this.onAction,
  });

  final String label;
  final String value;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: p.surface2,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(label, style: TextStyle(color: p.muted, fontSize: 12.5, fontWeight: FontWeight.w500)),
              ),
              if (actionLabel != null && onAction != null)
                InkWell(
                  borderRadius: BorderRadius.circular(8),
                  onTap: onAction,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(actionLabel!, style: TextStyle(color: p.blue.fg, fontSize: 12, fontWeight: FontWeight.w700)),
                        const SizedBox(width: 3),
                        Icon(Icons.arrow_forward_rounded, size: 14, color: p.blue.fg),
                      ],
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: p.ink),
          ),
        ],
      ),
    );
  }
}
