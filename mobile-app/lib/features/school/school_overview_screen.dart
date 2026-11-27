import 'package:flutter/material.dart';

import '../../core/api.dart';
import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';

/// A school account's glance at its school: people and classes, the licence, and this month's AI use.
class SchoolOverviewScreen extends StatelessWidget {
  const SchoolOverviewScreen({super.key});

  Future<(Json, String?, int)> _load(BuildContext context) async {
    final api = SessionScope.api(context);
    final schoolId = SessionScope.of(context).user!.schoolId;
    if (schoolId == null) throw ApiException('Tài khoản chưa gắn với trường nào.');
    final results = await Future.wait([
      api.get('/schools/$schoolId/reports/summary'),
      // the plan's sales name and the pending unlock requests are extras: the overview still shows without them
      api.get('/auth/plans').then<Object?>((value) => value, onError: (_) => null),
      api.get('/support/inbox/pending-count').then<Object?>((value) => value, onError: (_) => null),
    ]);
    final summary = asJson(results[0]);
    final code = asString(summary['planCode']);
    final plan = asJsonList(results[1]).where((p) => asString(p['code']) == code).firstOrNull;
    return (summary, plan == null ? code : asString(plan['name']), asInt(asJson(results[2])['count']) ?? 0);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: HeroBar(title: 'Tổng quan', subtitle: SessionScope.of(context).user!.schoolName ?? 'Trường', art: Art.school),
      body: Loader<(Json, String?, int)>(
        load: () => _load(context),
        skeleton: const SkeletonList(withStats: true, count: 3),
        builder: (context, data, reload) {
          final p = context.palette;
          final (s, planName, pending) = data;
          final status = asString(s['licenseStatus']) ?? '';
          final licenceEnd = asDate(s['licenseEnd']);
          final daysLeft = licenceEnd?.difference(DateTime.now()).inDays;
          final used = asInt(s['usedTokens']) ?? 0;
          final quota = asInt(s['tokenQuota']);
          final students = asInt(s['students']) ?? 0;
          final studentQuota = asInt(s['studentQuota']);
          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 28), children: [
              Pair(
                StatTile(label: 'Học sinh', value: groupDigits(students), icon: Icons.school_rounded, tint: p.blue,
                    detail: '${asInt(s['enrolledStudents']) ?? 0} đã xếp lớp'),
                StatTile(label: 'Giáo viên', value: '${asInt(s['teachers']) ?? 0}', icon: Icons.co_present_rounded, tint: p.teal,
                    detail: '${asInt(s['activeClasses']) ?? 0} lớp đang học'),
              ),
              const SizedBox(height: 12),
              Section(
                title: 'Bản quyền',
                icon: Icons.workspace_premium_rounded,
                trailing: Pill(_licenceLabel(status), tone: status == 'ACTIVE' ? Tone.success : Tone.warning),
                child: Column(children: [
                  _Row(label: 'Gói', value: planName ?? 'Chưa thiết lập'),
                  _Row(label: 'Hiệu lực', value: '${_date(asDate(s['licenseStart']))} – ${_date(licenceEnd)}'),
                  if (daysLeft != null && status == 'ACTIVE')
                    _Row(label: 'Còn lại', value: daysLeft < 0 ? 'Đã hết hạn' : '$daysLeft ngày'),
                  _Row(label: 'Học sinh', value: studentQuota == null ? '$students' : '$students / $studentQuota'),
                ]),
              ),
              const SizedBox(height: 12),
              Section(
                title: 'Token AI ${_month(asDate(s['usageMonth']))}',
                icon: Icons.auto_awesome_rounded,
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Text(quota == null ? '${_number(used)} token · không giới hạn' : '${_number(used)} / ${_number(quota)} token',
                      style: const TextStyle(fontWeight: FontWeight.w600)),
                  if (quota != null && quota > 0) ...[
                    const SizedBox(height: 8),
                    LinearProgressIndicator(
                      minHeight: 8,
                      borderRadius: BorderRadius.circular(99),
                      value: (used / quota).clamp(0, 1).toDouble(),
                      color: used >= quota ? p.danger : (used >= quota * 0.8 ? p.warning : p.accent),
                      backgroundColor: p.surface2,
                    ),
                  ],
                ]),
              ),
              if (pending > 0) ...[
                const SizedBox(height: 12),
                Card(
                  child: ListTile(
                    leading: Icon(Icons.lock_open_rounded, color: p.warning),
                    title: Text('$pending yêu cầu mở khoá đang chờ'),
                    subtitle: const Text('Duyệt trên bản web, mục Yêu cầu mở khóa.'),
                  ),
                ),
              ],
              const SizedBox(height: 16),
              Text('Thêm tài khoản, xếp lớp, nhập dữ liệu và gia hạn gói trên bản web.',
                  textAlign: TextAlign.center, style: TextStyle(color: p.muted, fontSize: 12)),
            ]),
          );
        },
      ),
    );
  }
}

String _licenceLabel(String status) => switch (status) {
      'ACTIVE' => 'Đang hiệu lực',
      'EXPIRED' => 'Đã hết hạn',
      'UPCOMING' => 'Chưa đến hạn',
      'UNLICENSED' || '' => 'Chưa có bản quyền',
      'SUSPENDED' => 'Tạm ngưng',
      _ => status,
    };

String _two(int value) => value.toString().padLeft(2, '0');
String _date(DateTime? value) => value == null ? '—' : '${_two(value.day)}/${_two(value.month)}/${value.year}';
String _month(DateTime? value) => value == null ? 'tháng này' : 'tháng ${value.month}/${value.year}';
String _number(int value) => formatVnd(value).replaceAll(' ₫', '');

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});
  final String label, value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(children: [
        Expanded(child: Text(label, style: TextStyle(color: context.palette.muted))),
        Flexible(child: Text(value, textAlign: TextAlign.end, style: const TextStyle(fontWeight: FontWeight.w600))),
      ]),
    );
  }
}
