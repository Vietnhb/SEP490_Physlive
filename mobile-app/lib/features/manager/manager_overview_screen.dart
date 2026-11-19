import 'package:flutter/material.dart';

import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';

/// What the operations team checks first: requests waiting, accounts and schools, this month's revenue.
class ManagerOverviewScreen extends StatefulWidget {
  const ManagerOverviewScreen({super.key, required this.onOpenSupport});
  final VoidCallback onOpenSupport;

  @override
  State<ManagerOverviewScreen> createState() => _ManagerOverviewScreenState();
}

class _Overview {
  _Overview(this.counts, this.pending, this.analytics);
  final Json counts;
  final int pending;
  final Json? analytics;
}

class _ManagerOverviewScreenState extends State<ManagerOverviewScreen> {
  Future<_Overview> _load() async {
    final api = SessionScope.api(context);
    final results = await Future.wait([
      api.get('/admin/overview-counts'),
      api.get('/support/inbox/pending-count'),
      // revenue is a bonus: the overview still shows when analytics fail
      api.get('/admin/analytics').then<Object?>((value) => value, onError: (_) => null),
    ]);
    return _Overview(asJson(results[0]), asInt(asJson(results[1])['count']) ?? 0,
        results[2] == null ? null : asJson(results[2]));
  }

  @override
  Widget build(BuildContext context) {
    final user = SessionScope.of(context).user!;
    return Scaffold(
      appBar: AppBar(title: const Text('Tổng quan')),
      body: Loader<_Overview>(
        load: _load,
        builder: (context, data, reload) {
          final p = context.palette;
          final accounts = asJson(data.counts['accounts']);
          final validation = asJson(data.counts['validation']);
          final revenue = data.analytics == null ? null : asJson(data.analytics!['revenue']);
          final schools = asInt(data.counts['schools']) ?? 0;
          final activeSchools = asInt(data.counts['activeSchools']) ?? 0;
          final failureRate = (asDouble(validation['failureRate']) ?? 0) * 100;
          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 24), children: [
              Text('Xin chào, ${user.fullName}', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 4),
              Text('Số liệu toàn nền tảng PhysLive.', style: TextStyle(color: p.muted)),
              const SizedBox(height: 16),
              Card(
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  onTap: widget.onOpenSupport,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(children: [
                      Icon(Icons.support_agent_rounded, color: data.pending > 0 ? p.warning : p.success, size: 28),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(data.pending > 0 ? '${data.pending} yêu cầu đang chờ xử lý' : 'Không có yêu cầu nào đang chờ',
                              style: Theme.of(context).textTheme.titleMedium),
                          const SizedBox(height: 2),
                          Text('Góp ý, tin nhắn; khiếu nại tài khoản xử lý trên web', style: TextStyle(color: p.muted, fontSize: 13)),
                        ]),
                      ),
                      Icon(Icons.chevron_right_rounded, color: p.muted),
                    ]),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(child: _Stat(label: 'Tài khoản', value: '${asInt(accounts['total']) ?? 0}',
                    detail: '${asInt(accounts['suspended']) ?? 0} tạm khoá')),
                const SizedBox(width: 12),
                Expanded(child: _Stat(label: 'Trường học', value: '$schools', detail: '$activeSchools đang hoạt động')),
              ]),
              const SizedBox(height: 12),
              Section(
                title: 'Tài khoản theo vai trò',
                icon: Icons.groups_rounded,
                child: Column(children: [
                  for (final role in const ['STUDENT', 'STAFF', 'SCHOOL', 'REVIEWER', 'MANAGER', 'ADMIN'])
                    _Row(label: User({'role': role}).roleLabel, value: '${asInt(accounts[role]) ?? 0}'),
                ]),
              ),
              const SizedBox(height: 12),
              if (revenue != null) ...[
                Section(
                  title: 'Doanh thu',
                  icon: Icons.payments_rounded,
                  child: Column(children: [
                    _Row(label: 'Tháng này', value: formatVnd(asInt(revenue['monthlyVnd']))),
                    _Row(label: 'Tuần này', value: formatVnd(asInt(revenue['weeklyVnd']))),
                    _Row(label: 'Tổng cộng', value: formatVnd(asInt(revenue['totalVnd']))),
                    _Row(label: 'Giao dịch chờ / lỗi',
                        value: '${asInt(revenue['pendingCount']) ?? 0} / ${asInt(revenue['failedCount']) ?? 0}'),
                  ]),
                ),
                const SizedBox(height: 12),
              ],
              Section(
                title: 'Kiểm định mô phỏng',
                icon: Icons.verified_rounded,
                child: Column(children: [
                  _Row(label: 'Lượt kiểm định', value: '${asInt(validation['total']) ?? 0}'),
                  _Row(label: 'Không đạt', value: '${asInt(validation['failed']) ?? 0} (${failureRate.toStringAsFixed(1)}%)'),
                ]),
              ),
              const SizedBox(height: 16),
              Text('Quản lý trường, gói, thanh toán và chương trình học trên bản web.',
                  textAlign: TextAlign.center, style: TextStyle(color: p.muted, fontSize: 12)),
            ]),
          );
        },
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value, required this.detail});
  final String label, value, detail;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: TextStyle(color: p.muted, fontSize: 13)),
          const SizedBox(height: 4),
          Text(value, style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 2),
          Text(detail, style: TextStyle(color: p.muted, fontSize: 12)),
        ]),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});
  final String label, value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(children: [
        Expanded(child: Text(label, style: TextStyle(color: context.palette.muted))),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
      ]),
    );
  }
}
