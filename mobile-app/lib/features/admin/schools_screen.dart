import 'package:flutter/material.dart';

import '../../core/models.dart';
import '../../core/session.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';

enum _Filter { all, licensed, expired, paused }

/// The school customers: find one, see its licence, plan and AI use.
class SchoolsScreen extends StatefulWidget {
  const SchoolsScreen({super.key});

  @override
  State<SchoolsScreen> createState() => _SchoolsScreenState();
}

class _SchoolsScreenState extends State<SchoolsScreen> {
  _Filter _filter = _Filter.all;
  String _query = '';

  Future<List<SchoolAccount>> _load() async {
    final items = asJsonList(await SessionScope.api(context).get('/admin/schools')).map(SchoolAccount.new).toList();
    items.sort((a, b) => a.name.compareTo(b.name));
    return items;
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      appBar: const HeroBar(title: 'Trường học', subtitle: 'Khách hàng', art: Art.school),
      body: Loader<List<SchoolAccount>>(
        load: _load,
        skeleton: const SkeletonList(withStats: true),
        builder: (context, items, reload) {
          final licensed = items.where((s) => s.active && s.licenseActive).toList();
          final expired = items.where((s) => s.active && !s.licenseActive).toList();
          final paused = items.where((s) => !s.active).toList();
          final query = _query.toLowerCase();
          final shown = switch (_filter) {
            _Filter.all => items,
            _Filter.licensed => licensed,
            _Filter.expired => expired,
            _Filter.paused => paused,
          }
              .where((s) => query.isEmpty ||
                  '${s.name} ${s.code ?? ''} ${s.province ?? ''} ${s.email ?? ''}'.toLowerCase().contains(query))
              .toList();
          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(padding: const EdgeInsets.fromLTRB(16, 14, 16, 28), children: [
              Pair(
                StatTile(label: 'Đang hiệu lực', value: '${licensed.length}', detail: 'trên ${items.length} trường',
                    icon: Icons.verified_user_rounded, tint: p.green, onTap: () => setState(() => _filter = _Filter.licensed)),
                StatTile(label: 'Cần gia hạn', value: '${expired.length}', detail: '${paused.length} tạm ngưng',
                    icon: Icons.event_busy_rounded, tint: p.amber, onTap: () => setState(() => _filter = _Filter.expired)),
              ),
              const SizedBox(height: 14),
              SearchBox(hint: 'Tìm theo tên, mã trường, tỉnh thành', onChanged: (v) => setState(() => _query = v)),
              const SizedBox(height: 10),
              ChoiceRow<_Filter>(
                selected: _filter,
                onSelected: (f) => setState(() => _filter = f),
                options: [
                  (_Filter.all, 'Tất cả', items.length),
                  (_Filter.licensed, 'Đang hiệu lực', licensed.length),
                  (_Filter.expired, 'Hết hạn / chưa có', expired.length),
                  (_Filter.paused, 'Tạm ngưng', paused.length),
                ],
              ),
              const SizedBox(height: 12),
              if (shown.isEmpty)
                EmptyState(art: Art.school, title: _query.isEmpty ? 'Không có trường nào' : 'Không tìm thấy "$_query"')
              else
                for (final s in shown) ...[
                  _SchoolCard(school: s, onTap: () => _show(context, s)),
                  const SizedBox(height: 10),
                ],
            ]),
          );
        },
      ),
    );
  }
}

(String, Tone) _status(SchoolAccount s) => !s.active
    ? ('Tạm ngưng', Tone.danger)
    : s.licenseActive
        ? ('Đang hiệu lực', Tone.success)
        : (s.licenseEnd == null ? ('Chưa có gói', Tone.neutral) : ('Hết hạn', Tone.warning));

String _date(DateTime? d) => d == null ? '—' : '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';

String _plan(String? code) => switch (code) {
      'STARTER' => 'Starter',
      'PROFESSIONAL' => 'Professional',
      'ENTERPRISE' => 'Enterprise',
      null || '' => 'Chưa có gói',
      _ => code,
    };

class _SchoolCard extends StatelessWidget {
  const _SchoolCard({required this.school, required this.onTap});
  final SchoolAccount school;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final s = school;
    final (label, tone) = _status(s);
    final days = s.licenseEnd?.difference(DateTime.now()).inDays;
    return ListCard(
      onTap: onTap,
      leading: Avatar(name: s.name, size: 46, tint: p.amber),
      title: s.name,
      subtitle: [if (s.code != null) s.code!, if (s.province != null) s.province!].join(' · '),
      trailing: Pill(label, tone: tone),
      footer: MetaLine(
        icon: Icons.workspace_premium_rounded,
        text: '${_plan(s.planCode)}${s.licenseEnd == null ? '' : ' · đến ${_date(s.licenseEnd)}'}'
            '${days != null && days >= 0 && days <= 30 && s.licenseActive ? ' (còn $days ngày)' : ''}',
        color: days != null && days >= 0 && days <= 30 && s.licenseActive ? p.warning : null,
        trailing: Icon(Icons.chevron_right_rounded, color: p.muted, size: 20),
      ),
    );
  }
}

void _show(BuildContext context, SchoolAccount s) {
  final p = context.palette;
  final (label, tone) = _status(s);
  final quota = s.tokenQuota;
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (context) => SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Avatar(name: s.name, size: 52, tint: p.amber),
            const SizedBox(width: 14),
            Expanded(child: Text(s.name, style: Theme.of(context).textTheme.titleLarge)),
          ]),
          const SizedBox(height: 10),
          Wrap(spacing: 6, children: [Pill(label, tone: tone), Pill(_plan(s.planCode), tone: Tone.accent)]),
          const SizedBox(height: 8),
          if (s.code != null) InfoRow(label: 'Mã trường', value: s.code!),
          if (s.province != null) InfoRow(label: 'Tỉnh / thành', value: s.province!),
          if (s.address != null) InfoRow(label: 'Địa chỉ', value: s.address!, strong: false),
          if (s.email != null) InfoRow(label: 'Email liên hệ', value: s.email!),
          if (s.phone != null) InfoRow(label: 'Điện thoại', value: s.phone!),
          InfoRow(label: 'Bản quyền', value: '${_date(s.licenseStart)} – ${_date(s.licenseEnd)}'),
          if (s.studentQuota != null) InfoRow(label: 'Hạn mức học sinh', value: groupDigits(s.studentQuota!)),
          if (s.annualPrice != null) InfoRow(label: 'Giá năm', value: compactVnd(s.annualPrice)),
          const SizedBox(height: 10),
          Text('Token AI tháng này', style: TextStyle(color: p.muted)),
          const SizedBox(height: 6),
          Text(quota == null ? '${groupDigits(s.usedTokens)} token · không giới hạn' : '${groupDigits(s.usedTokens)} / ${groupDigits(quota)} token',
              style: const TextStyle(fontWeight: FontWeight.w700)),
          if (quota != null && quota > 0) ...[
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(99),
              child: LinearProgressIndicator(
                value: (s.usedTokens / quota).clamp(0.0, 1.0),
                minHeight: 8,
                color: s.usedTokens >= quota ? p.danger : (s.usedTokens >= quota * 0.8 ? p.warning : p.accent),
              ),
            ),
          ],
        ]),
      ),
    ),
  );
}
