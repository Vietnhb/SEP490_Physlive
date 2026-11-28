import 'package:flutter/material.dart';

import '../../core/models.dart';
import '../../core/session.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../account/account_screens.dart';

enum _Filter { all, licensed, expired, paused }

/// The school customers: find, create, edit, renew license, or pause/activate.
class SchoolsScreen extends StatefulWidget {
  const SchoolsScreen({super.key});

  @override
  State<SchoolsScreen> createState() => _SchoolsScreenState();
}

class _SchoolsScreenState extends State<SchoolsScreen> {
  _Filter _filter = _Filter.all;
  String _query = '';
  int _reload = 0;

  Future<List<SchoolAccount>> _load() async {
    final items = asJsonList(await SessionScope.api(context).get('/admin/schools')).map(SchoolAccount.new).toList();
    items.sort((a, b) => a.name.compareTo(b.name));
    return items;
  }

  Future<void> _openForm([SchoolAccount? school]) async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => _SchoolFormScreen(school: school)),
    );
    if (saved == true && mounted) setState(() => _reload++);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      appBar: const RoleTopBar(subtitle: 'Vận hành'),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openForm(),
        icon: const Icon(Icons.add_business_rounded),
        label: const Text('Thêm trường'),
      ),
      body: Loader<List<SchoolAccount>>(
        load: _load,
        reloadKey: _reload,
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
            child: ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 84), children: [
              Text(
                'Trường học',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontSize: 22, fontWeight: FontWeight.w800, color: p.brand),
              ),
              const SizedBox(height: 4),
              Text('${items.length} trường học trên nền tảng', style: TextStyle(color: p.muted, fontSize: 13)),
              const SizedBox(height: 14),
              Pair(
                StatTile(
                  label: 'Đang hiệu lực',
                  value: '${licensed.length}',
                  detail: 'trên ${items.length} trường',
                  icon: Icons.verified_user_rounded,
                  tint: p.green,
                  onTap: () => setState(() => _filter = _Filter.licensed),
                ),
                StatTile(
                  label: 'Cần gia hạn',
                  value: '${expired.length}',
                  detail: '${paused.length} tạm ngưng',
                  icon: Icons.event_busy_rounded,
                  tint: p.amber,
                  onTap: () => setState(() => _filter = _Filter.expired),
                ),
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
                  _SchoolCard(
                    school: s,
                    onTap: () => _show(
                      context,
                      s,
                      onEdit: () => _openForm(s),
                      onToggled: () {
                        if (mounted) setState(() => _reload++);
                      },
                    ),
                  ),
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

String _isoDate(DateTime? d) => d == null ? '' : '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

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

void _show(
  BuildContext context,
  SchoolAccount s, {
  required VoidCallback onEdit,
  required VoidCallback onToggled,
}) {
  final p = context.palette;
  final (label, tone) = _status(s);
  final quota = s.tokenQuota;
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (ctx) => SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 22),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Avatar(name: s.name, size: 52, tint: p.amber),
            const SizedBox(width: 14),
            Expanded(child: Text(s.name, style: Theme.of(ctx).textTheme.titleLarge)),
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
          Text(
            quota == null ? '${groupDigits(s.usedTokens)} token · không giới hạn' : '${groupDigits(s.usedTokens)} / ${groupDigits(quota)} token',
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
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
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: () {
                    Navigator.of(ctx).pop();
                    onEdit();
                  },
                  icon: const Icon(Icons.edit_outlined, size: 18),
                  label: const Text('Sửa & gia hạn'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: s.active ? p.danger : p.success,
                    side: BorderSide(color: (s.active ? p.danger : p.success).withValues(alpha: 0.45)),
                  ),
                  onPressed: () async {
                    try {
                      await SessionScope.api(context).put('/admin/schools/${s.id}', {
                        'code': s.code ?? '',
                        'name': s.name,
                        'address': s.address ?? '',
                        'active': !s.active,
                        'licenseStart': s.licenseStart == null ? null : _isoDate(s.licenseStart),
                        'licenseEnd': s.licenseEnd == null ? null : _isoDate(s.licenseEnd),
                        'monthlyTokenQuota': s.tokenQuota,
                      });
                      if (!ctx.mounted) return;
                      Navigator.of(ctx).pop();
                      showMessage(context, s.active ? 'Đã tạm ngưng trường học.' : 'Đã kích hoạt lại trường học.');
                      onToggled();
                    } catch (e) {
                      if (ctx.mounted) showMessage(ctx, errorText(e), error: true);
                    }
                  },
                  icon: Icon(s.active ? Icons.pause_circle_outline_rounded : Icons.play_circle_outline_rounded, size: 18),
                  label: Text(s.active ? 'Tạm ngưng' : 'Kích hoạt'),
                ),
              ),
            ],
          ),
        ]),
      ),
    ),
  );
}

class _SchoolFormScreen extends StatefulWidget {
  const _SchoolFormScreen({this.school});
  final SchoolAccount? school;

  @override
  State<_SchoolFormScreen> createState() => _SchoolFormScreenState();
}

class _SchoolFormScreenState extends State<_SchoolFormScreen> {
  final _form = GlobalKey<FormState>();
  late final _code = TextEditingController(text: widget.school?.code ?? '');
  late final _name = TextEditingController(text: widget.school?.name ?? '');
  late final _address = TextEditingController(text: widget.school?.address ?? '');
  late final _start = TextEditingController(text: _isoDate(widget.school?.licenseStart));
  late final _end = TextEditingController(text: _isoDate(widget.school?.licenseEnd));
  late final _quota = TextEditingController(
    text: widget.school?.tokenQuota == null ? '' : '${widget.school!.tokenQuota}',
  );
  late bool _active = widget.school?.active ?? true;
  bool _busy = false;
  String? _error;

  bool get _editing => widget.school != null;

  @override
  void dispose() {
    _code.dispose();
    _name.dispose();
    _address.dispose();
    _start.dispose();
    _end.dispose();
    _quota.dispose();
    super.dispose();
  }

  Future<void> _pickDate(TextEditingController ctrl) async {
    final initial = DateTime.tryParse(ctrl.text) ?? DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: DateTime(2035),
    );
    if (picked != null && mounted) {
      setState(() => ctrl.text = _isoDate(picked));
    }
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final quotaText = _quota.text.trim();
      final payload = {
        'code': _code.text.trim(),
        'name': _name.text.trim(),
        'address': _address.text.trim(),
        'active': _active,
        'licenseStart': _start.text.trim().isEmpty ? null : _start.text.trim(),
        'licenseEnd': _end.text.trim().isEmpty ? null : _end.text.trim(),
        'monthlyTokenQuota': quotaText.isEmpty ? null : int.tryParse(quotaText),
      };
      if (_editing) {
        await SessionScope.api(context).put('/admin/schools/${widget.school!.id}', payload);
      } else {
        await SessionScope.api(context).post('/admin/schools', payload);
      }
      if (!mounted) return;
      showMessage(context, _editing ? 'Đã cập nhật trường học.' : 'Đã thêm trường học mới.');
      Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      appBar: const RoleTopBar(subtitle: 'Vận hành', showBack: true),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 32),
          children: [
            Text(
              _editing ? 'Cập nhật trường học' : 'Thêm trường học mới',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontSize: 22, fontWeight: FontWeight.w800, color: p.brand),
            ),
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextFormField(
                      controller: _code,
                      enabled: !_busy && !_editing,
                      decoration: const InputDecoration(labelText: 'Mã trường'),
                      validator: (v) => v == null || v.trim().isEmpty ? 'Nhập mã trường.' : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _name,
                      enabled: !_busy,
                      decoration: const InputDecoration(labelText: 'Tên trường'),
                      validator: (v) => v == null || v.trim().isEmpty ? 'Nhập tên trường.' : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _address,
                      enabled: !_busy,
                      decoration: const InputDecoration(labelText: 'Địa chỉ'),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: TextFormField(
                            controller: _start,
                            readOnly: true,
                            onTap: _busy ? null : () => _pickDate(_start),
                            decoration: const InputDecoration(
                              labelText: 'Bắt đầu bản quyền',
                              suffixIcon: Icon(Icons.calendar_today_rounded, size: 18),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: TextFormField(
                            controller: _end,
                            readOnly: true,
                            onTap: _busy ? null : () => _pickDate(_end),
                            decoration: const InputDecoration(
                              labelText: 'Hết hạn bản quyền',
                              suffixIcon: Icon(Icons.calendar_today_rounded, size: 18),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _quota,
                      enabled: !_busy,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Token AI / tháng (trống = không giới hạn)'),
                    ),
                    const SizedBox(height: 8),
                    SwitchListTile.adaptive(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Đang hoạt động', style: TextStyle(fontWeight: FontWeight.w600)),
                      value: _active,
                      onChanged: _busy ? null : (v) => setState(() => _active = v),
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 10),
                      Text(_error!, style: TextStyle(color: p.danger, fontSize: 13)),
                    ],
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: _busy ? null : _save,
                      child: _busy
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4))
                          : Text(_editing ? 'Lưu thay đổi' : 'Thêm trường'),
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
