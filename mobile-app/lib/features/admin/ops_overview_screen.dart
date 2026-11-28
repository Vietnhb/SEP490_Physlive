import 'package:flutter/material.dart';

import '../../core/models.dart';
import '../../core/session.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../account/account_screens.dart';
import '../manager/manager_modules_screen.dart';
import 'payments_screen.dart';

class _Overview {
  _Overview(this.counts, this.pending, this.analytics);
  final Json counts;
  final int? pending;
  final Json? analytics;
}

/// The platform at a glance for the operations team and administrators: accounts, schools, revenue, validation.
class OpsOverviewScreen extends StatelessWidget {
  const OpsOverviewScreen({super.key, this.onOpenSupport, this.onOpenUsers, this.onOpenSchools});
  final VoidCallback? onOpenSupport, onOpenUsers, onOpenSchools;

  Future<_Overview> _load(BuildContext context) async {
    final api = SessionScope.api(context);
    final manager = SessionScope.read(context).user?.isManager ?? false;
    final results = await Future.wait([
      api.get('/admin/overview-counts'),
      // the inbox and the revenue are extras: the overview still shows without them
      manager
          ? api.get('/support/inbox/pending-count').then<Object?>((v) => v, onError: (_) => null)
          : Future<Object?>.value(null),
      api.get('/admin/analytics').then<Object?>((v) => v, onError: (_) => null),
    ]);
    return _Overview(asJson(results[0]), results[1] == null ? null : asInt(asJson(results[1])['count']),
        results[2] == null ? null : asJson(results[2]));
  }

  @override
  Widget build(BuildContext context) {
    final user = SessionScope.of(context).user;
    if (user == null) return const Scaffold();
    return Scaffold(
      appBar: RoleTopBar(subtitle: user.isManager ? 'Vận hành' : 'Quản trị'),
      body: Loader<_Overview>(
        load: () => _load(context),
        skeleton: const SkeletonList(withStats: true, count: 3),
        builder: (context, data, reload) {
          final p = context.palette;
          final accounts = asJson(data.counts['accounts']);
          final validation = asJson(data.counts['validation']);
          final revenue = data.analytics == null ? null : asJson(data.analytics!['revenue']);
          final schools = asInt(data.counts['schools']) ?? 0;
          final activeSchools = asInt(data.counts['activeSchools']) ?? 0;
          final total = asInt(accounts['total']) ?? 0;
          final failureRate = (asDouble(validation['failureRate']) ?? 0) * 100;
          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 28), children: [
              if (data.pending != null) ...[
                _Notice(pending: data.pending!, onTap: onOpenSupport),
                const SizedBox(height: 12),
              ],
              Pair(
                StatTile(
                  label: 'Tài khoản',
                  value: groupDigits(total),
                  detail: '${groupDigits(asInt(accounts['suspended']) ?? 0)} tạm khoá',
                  icon: Icons.people_alt_rounded,
                  tint: p.blue,
                  onTap: onOpenUsers,
                ),
                StatTile(
                  label: 'Trường học',
                  value: groupDigits(schools),
                  detail: '$activeSchools đang hoạt động',
                  icon: Icons.apartment_rounded,
                  tint: p.amber,
                  onTap: onOpenSchools,
                ),
              ),
              const SizedBox(height: 12),
              if (revenue != null) ...[
                _RevenueCard(revenue: revenue, timeline: asJsonList(revenue['timeline'])),
                const SizedBox(height: 12),
              ],
              Section(
                title: 'Tài khoản theo vai trò',
                icon: Icons.donut_small_rounded,
                child: Column(children: [
                  for (final role in const ['STUDENT', 'STAFF', 'SCHOOL', 'REVIEWER', 'MANAGER', 'ADMIN'])
                    _RoleBar(role: role, count: asInt(accounts[role]) ?? 0, total: total),
                ]),
              ),
              const SizedBox(height: 12),
              Pair(
                StatTile(
                  label: 'Lượt kiểm định',
                  value: groupDigits(asInt(validation['total']) ?? 0),
                  icon: Icons.verified_rounded,
                  tint: p.green,
                  detail: 'mô phỏng đã chạy',
                  onTap: user.isManager
                      ? () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ManagerValidationScreen()))
                      : null,
                ),
                StatTile(
                  label: 'Không đạt',
                  value: groupDigits(asInt(validation['failed']) ?? 0),
                  icon: Icons.report_gmailerrorred_rounded,
                  tint: p.rose,
                  detail: '${failureRate.toStringAsFixed(1)}% tổng số',
                  onTap: user.isManager
                      ? () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ManagerValidationScreen()))
                      : null,
                ),
              ),
              if (user.isManager) ...[
                const SizedBox(height: 12),
                Card(
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
                        child: Text('Cần theo dõi', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                      ),
                      ListTile(
                        leading: Icon(Icons.bar_chart_rounded, color: p.teal.fg),
                        title: const Text('Sử dụng khách hàng', style: TextStyle(fontWeight: FontWeight.w600)),
                        subtitle: Text('Theo dõi lượt dùng AI & sắp hết hạn', style: TextStyle(color: p.muted, fontSize: 12)),
                        trailing: Icon(Icons.chevron_right_rounded, color: p.muted),
                        onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ManagerUsageScreen())),
                      ),
                      Divider(height: 1, indent: 56, color: p.line),
                      ListTile(
                        leading: Icon(Icons.mail_outline_rounded, color: p.blue.fg),
                        title: const Text('Nhật ký email tự động', style: TextStyle(fontWeight: FontWeight.w600)),
                        subtitle: Text('Xem trạng thái gửi và phản hồi', style: TextStyle(color: p.muted, fontSize: 12)),
                        trailing: Icon(Icons.chevron_right_rounded, color: p.muted),
                        onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ManagerEmailsScreen())),
                      ),
                    ],
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

class _Notice extends StatelessWidget {
  const _Notice({required this.pending, this.onTap});
  final int pending;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final t = pending > 0 ? p.amber : p.green;
    return Material(
      color: p.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide(color: p.line)),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(children: [
            Container(
              width: 40,
              height: 40,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: t.bg, borderRadius: BorderRadius.circular(12)),
              child: Text('$pending', style: TextStyle(color: t.fg, fontWeight: FontWeight.w800, fontSize: 16)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(pending > 0 ? '$pending yêu cầu đang chờ xử lý' : 'Không có yêu cầu nào đang chờ',
                    style: const TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 2),
                Text('Góp ý và tin nhắn từ người dùng', style: TextStyle(color: p.muted, fontSize: 12)),
              ]),
            ),
            Icon(Icons.chevron_right_rounded, color: p.muted),
          ]),
        ),
      ),
    );
  }
}

/// Paid revenue: the last 4 weeks as bars, the windows the backend counts, and a way into the payments.
class _RevenueCard extends StatelessWidget {
  const _RevenueCard({required this.revenue, required this.timeline});
  final Json revenue;
  final List<Json> timeline;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final amounts = [for (final t in timeline) (asInt(t['amountVnd']) ?? 0).toDouble()];
    final top = amounts.fold<double>(0, (m, v) => v > m ? v : m);
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const PaymentsScreen())),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(color: p.teal.bg, borderRadius: BorderRadius.circular(8)),
                child: Icon(Icons.payments_rounded, size: 16, color: p.teal.fg),
              ),
              const SizedBox(width: 10),
              Expanded(child: Text('Doanh thu đã thanh toán', style: Theme.of(context).textTheme.titleMedium)),
              Text('Xem giao dịch', style: TextStyle(color: p.accent, fontWeight: FontWeight.w600, fontSize: 13)),
              Icon(Icons.chevron_right_rounded, color: p.accent, size: 18),
            ]),
            const SizedBox(height: 12),
            Text(compactVnd(asInt(revenue['totalVnd'])),
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: p.ink, letterSpacing: -0.6)),
            Text('Tổng cộng · ${asInt(revenue['paidCount']) ?? 0} giao dịch đã thanh toán',
                style: TextStyle(color: p.muted, fontSize: 12)),
            if (timeline.isNotEmpty && top == 0) ...[
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(color: p.surface2, borderRadius: BorderRadius.circular(12)),
                child: Row(children: [
                  Icon(Icons.insights_rounded, size: 18, color: p.muted),
                  const SizedBox(width: 8),
                  Expanded(child: Text('Chưa có giao dịch thanh toán nào trong 4 tuần gần nhất.',
                      style: TextStyle(color: p.muted, fontSize: 13))),
                ]),
              ),
            ],
            if (timeline.isNotEmpty && top > 0) ...[
              const SizedBox(height: 16),
              SizedBox(
                height: 92,
                child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  for (var i = 0; i < timeline.length; i++) ...[
                    Expanded(
                      child: Column(mainAxisAlignment: MainAxisAlignment.end, children: [
                        Text(amounts[i] == 0 ? '0' : compactVnd(amounts[i]).replaceAll(' ₫', ''),
                            style: TextStyle(color: p.muted, fontSize: 10, fontWeight: FontWeight.w600)),
                        const SizedBox(height: 4),
                        Container(
                          height: top == 0 ? 4 : 4 + 52 * amounts[i] / top,
                          decoration: BoxDecoration(
                            color: i == timeline.length - 1 ? p.accent : p.accent.withValues(alpha: 0.35),
                            borderRadius: const BorderRadius.vertical(top: Radius.circular(6)),
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(asString(timeline[i]['period']) ?? '',
                            maxLines: 1, style: TextStyle(color: p.muted, fontSize: 11)),
                      ]),
                    ),
                    if (i < timeline.length - 1) const SizedBox(width: 10),
                  ],
                ]),
              ),
            ],
            const SizedBox(height: 14),
            Row(children: [
              _Mini(label: '30 ngày qua', value: compactVnd(asInt(revenue['monthlyVnd']))),
              _Mini(label: '7 ngày qua', value: compactVnd(asInt(revenue['weeklyVnd']))),
              _Mini(
                label: 'Chờ / lỗi',
                value: '${asInt(revenue['pendingCount']) ?? 0} / ${asInt(revenue['failedCount']) ?? 0}',
                color: (asInt(revenue['failedCount']) ?? 0) > 0 ? p.danger : null,
              ),
            ]),
          ]),
        ),
      ),
    );
  }
}

class _Mini extends StatelessWidget {
  const _Mini({required this.label, required this.value, this.color});
  final String label, value;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Expanded(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: TextStyle(color: p.muted, fontSize: 12)),
        const SizedBox(height: 2),
        Text(value, style: TextStyle(fontWeight: FontWeight.w700, color: color ?? p.ink)),
      ]),
    );
  }
}

class _RoleBar extends StatelessWidget {
  const _RoleBar({required this.role, required this.count, required this.total});
  final String role;
  final int count, total;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final t = roleTint(context, role);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Container(width: 8, height: 8, decoration: BoxDecoration(color: t.fg, shape: BoxShape.circle)),
          const SizedBox(width: 8),
          Expanded(child: Text(roleName(role), style: TextStyle(color: p.ink, fontSize: 13))),
          Text(groupDigits(count), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
        ]),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(99),
          child: LinearProgressIndicator(
            value: total == 0 ? 0 : (count / total).clamp(0.0, 1.0),
            minHeight: 6,
            color: t.fg,
            backgroundColor: t.bg,
          ),
        ),
      ]),
    );
  }
}
