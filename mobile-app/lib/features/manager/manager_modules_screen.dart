import 'package:flutter/material.dart';

import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../account/account_screens.dart';
import '../admin/payments_screen.dart';
import '../admin/users_screen.dart';
import '../simulation/export.dart';

/// MManagerMore — Tab "Thêm" cho Vận hành (Manager).
class ManagerMoreScreen extends StatefulWidget {
  const ManagerMoreScreen({super.key});

  @override
  State<ManagerMoreScreen> createState() => _ManagerMoreScreenState();
}

class _ManagerMoreScreenState extends State<ManagerMoreScreen> {
  int _unreadEmails = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadUnread());
  }

  Future<void> _loadUnread() async {
    try {
      final data = asJson(await SessionScope.api(context).get('/reports/customer-usage/email-inbox/notifications'));
      if (mounted) setState(() => _unreadEmails = asInt(data['unreadCount']) ?? 0);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      appBar: const RoleTopBar(subtitle: 'Vận hành'),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 18, 16, 28),
        children: [
          Text(
            'Không gian vận hành',
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
                  icon: Icons.people_alt_outlined,
                  title: 'Người dùng',
                  subtitle: 'Quản lý toàn bộ tài khoản trên nền tảng',
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const UsersScreen()),
                  ),
                ),
                Divider(height: 1, indent: 68, color: p.line),
                _MoreTile(
                  icon: Icons.workspace_premium_outlined,
                  title: 'Gói dịch vụ',
                  subtitle: 'Cấu hình giá, hạn mức học sinh và token AI',
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const ManagerPlansScreen()),
                  ),
                ),
                Divider(height: 1, indent: 68, color: p.line),
                _MoreTile(
                  icon: Icons.bar_chart_rounded,
                  title: 'Sử dụng khách hàng',
                  subtitle: 'Theo dõi mức dùng AI và hạn bản quyền các trường',
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const ManagerUsageScreen()),
                  ),
                ),
                Divider(height: 1, indent: 68, color: p.line),
                _MoreTile(
                  icon: Icons.receipt_long_outlined,
                  title: 'Thanh toán & doanh thu',
                  subtitle: 'Giao dịch VNPay và báo cáo doanh thu',
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const PaymentsScreen()),
                  ),
                ),
                Divider(height: 1, indent: 68, color: p.line),
                _MoreTile(
                  icon: Icons.mail_outline_rounded,
                  title: 'Nhật ký email tự động',
                  subtitle: 'Theo dõi trạng thái gửi và phản hồi từ trường',
                  badge: _unreadEmails > 0 ? '$_unreadEmails' : null,
                  onTap: () async {
                    await Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const ManagerEmailsScreen()),
                    );
                    if (mounted) _loadUnread();
                  },
                ),
                Divider(height: 1, indent: 68, color: p.line),
                _MoreTile(
                  icon: Icons.menu_book_rounded,
                  title: 'Chương trình học',
                  subtitle: 'Cây chủ đề, học phần và bài học vật lý',
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const ManagerCurriculumScreen()),
                  ),
                ),
                Divider(height: 1, indent: 68, color: p.line),
                _MoreTile(
                  icon: Icons.verified_user_outlined,
                  title: 'Theo dõi kiểm định',
                  subtitle: 'Lịch sử chạy kiểm định vật lý trên hệ thống',
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const ManagerValidationScreen()),
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

/// MManagerPlans — Quản lý gói dịch vụ (GET /admin/plans, PUT /admin/plans/{code}).
class ManagerPlansScreen extends StatefulWidget {
  const ManagerPlansScreen({super.key});

  @override
  State<ManagerPlansScreen> createState() => _ManagerPlansScreenState();
}

class _ManagerPlansScreenState extends State<ManagerPlansScreen> {
  int _reload = 0;

  Future<List<Json>> _load() async =>
      asJsonList(await SessionScope.api(context).get('/admin/plans'));

  Future<void> _editPlan([Json? plan]) async {
    final editing = plan != null;
    final codeCtrl = TextEditingController(text: asString(plan?['code']) ?? '');
    final nameCtrl = TextEditingController(text: asString(plan?['name']) ?? '');
    final descCtrl = TextEditingController(text: asString(plan?['description']) ?? '');
    final priceCtrl = TextEditingController(text: '${asInt(plan?['annualPriceVnd']) ?? 0}');
    final studentCtrl = TextEditingController(text: plan?['studentQuota'] == null ? '' : '${plan!['studentQuota']}');
    final tokenCtrl = TextEditingController(text: plan?['monthlyTokenQuota'] == null ? '' : '${plan!['monthlyTokenQuota']}');
    var active = plan == null ? true : plan['active'] != false;

    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) => Padding(
          padding: EdgeInsets.fromLTRB(20, 4, 20, MediaQuery.of(ctx).viewInsets.bottom + 24),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(editing ? 'Sửa gói ${codeCtrl.text}' : 'Thêm gói dịch vụ mới', style: Theme.of(ctx).textTheme.titleLarge),
                const SizedBox(height: 12),
                TextField(
                  controller: codeCtrl,
                  enabled: !editing,
                  textCapitalization: TextCapitalization.characters,
                  decoration: const InputDecoration(labelText: 'Mã gói (VD: STARTER)'),
                ),
                const SizedBox(height: 10),
                TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Tên gói')),
                const SizedBox(height: 10),
                TextField(controller: descCtrl, minLines: 2, maxLines: 3, decoration: const InputDecoration(labelText: 'Mô tả')),
                const SizedBox(height: 10),
                TextField(controller: priceCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Giá/năm (VND)')),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: studentCtrl,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: 'Hạn mức HS', hintText: 'Trống = ∞'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextField(
                        controller: tokenCtrl,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: 'Token/tháng', hintText: 'Trống = ∞'),
                      ),
                    ),
                  ],
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Đang mở bán'),
                  value: active,
                  onChanged: (v) => setSheet(() => active = v),
                ),
                const SizedBox(height: 8),
                FilledButton(
                  onPressed: () async {
                    final code = codeCtrl.text.trim().toUpperCase();
                    if (code.isEmpty || nameCtrl.text.trim().isEmpty) {
                      showMessage(ctx, 'Vui lòng nhập mã gói và tên gói.', error: true);
                      return;
                    }
                    final payload = {
                      'code': code,
                      'name': nameCtrl.text.trim(),
                      'description': descCtrl.text.trim(),
                      'annualPriceVnd': int.tryParse(priceCtrl.text.trim()) ?? 0,
                      'studentQuota': int.tryParse(studentCtrl.text.trim()),
                      'monthlyTokenQuota': int.tryParse(tokenCtrl.text.trim()),
                      'active': active,
                    };
                    try {
                      if (editing) {
                        await SessionScope.api(context).put('/admin/plans/$code', payload);
                      } else {
                        await SessionScope.api(context).post('/admin/plans', payload);
                      }
                      if (ctx.mounted) Navigator.of(ctx).pop(true);
                    } catch (e) {
                      if (ctx.mounted) showMessage(ctx, errorText(e), error: true);
                    }
                  },
                  child: Text(editing ? 'Lưu thay đổi' : 'Tạo gói dịch vụ'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    final savedCode = codeCtrl.text.trim().toUpperCase();
    codeCtrl.dispose();
    nameCtrl.dispose();
    descCtrl.dispose();
    priceCtrl.dispose();
    studentCtrl.dispose();
    tokenCtrl.dispose();
    if (saved == true && mounted) {
      showMessage(context, editing ? 'Đã cập nhật gói $savedCode.' : 'Đã tạo gói $savedCode.');
      setState(() => _reload++);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      appBar: const RoleTopBar(subtitle: 'Vận hành', showBack: true),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _editPlan(),
        icon: const Icon(Icons.add_rounded),
        label: const Text('Thêm gói'),
      ),
      body: Loader<List<Json>>(
        load: _load,
        reloadKey: _reload,
        builder: (context, plans, reload) => RefreshIndicator(
          onRefresh: reload,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
            children: [
              Text('Gói dịch vụ', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontSize: 22, fontWeight: FontWeight.w800, color: p.brand)),
              const SizedBox(height: 4),
              Text('Chạm vào gói để chỉnh sửa giá hoặc hạn mức.', style: TextStyle(color: p.muted, fontSize: 13)),
              const SizedBox(height: 14),
              for (final plan in plans) ...[
                Card(
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: () => _editPlan(plan),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  '${asString(plan['name']) ?? ''} (${asString(plan['code']) ?? ''})',
                                  style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                                ),
                              ),
                              Pill(plan['active'] != false ? 'Đang bán' : 'Tạm ẩn', tone: plan['active'] != false ? Tone.success : Tone.neutral),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(
                            '${formatVnd(asInt(plan['annualPriceVnd']) ?? 0)} / năm',
                            style: TextStyle(color: p.accent, fontWeight: FontWeight.w800, fontSize: 16),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            '${plan['studentQuota'] == null ? 'Không giới hạn HS' : '${groupDigits(asInt(plan['studentQuota'])!)} học sinh'} · '
                            '${plan['monthlyTokenQuota'] == null ? 'Không giới hạn token' : '${groupDigits(asInt(plan['monthlyTokenQuota'])!)} token/tháng'}',
                            style: TextStyle(color: p.muted, fontSize: 12.5),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// MManagerUsage — Sử dụng khách hàng (GET /reports/customer-usage).
class ManagerUsageScreen extends StatefulWidget {
  const ManagerUsageScreen({super.key});

  @override
  State<ManagerUsageScreen> createState() => _ManagerUsageScreenState();
}

class _ManagerUsageScreenState extends State<ManagerUsageScreen> {
  int _year = DateTime.now().year;
  int? _month;
  String _query = '';
  String _attention = 'ALL';
  int _page = 0;
  int _reload = 0;
  List<Json> _cachedAttentionGroups = const [];
  int? _cachedTotalSchools;

  Future<Json> _load() async {
    final query = <String, String>{
      'year': '$_year',
      if (_month != null) 'month': '$_month',
      if (_query.trim().isNotEmpty) 'query': _query.trim(),
      'attention': _attention,
      'page': '$_page',
      'size': '15',
    };
    final res = asJson(await SessionScope.api(context).get('/reports/customer-usage', query: query));
    if (_attention == 'ALL') {
      _cachedAttentionGroups = asJsonList(res['attention']);
      _cachedTotalSchools = asInt(asJson(res['summary'])['schools']);
    }
    return res;
  }

  Future<void> _exportCsv(List<Json> items) async {
    String cell(Object? v) => '"${'${v ?? ''}'.replaceAll('"', '""')}"';
    final lines = <String>[
      ['Truong', 'Ma', 'Goi', 'Nguoi dung', 'Luot AI', 'Token', 'Bai giao', 'Luot nop', 'Doanh thu'].map(cell).join(','),
      for (final r in items)
        [
          r['name'],
          r['code'],
          r['plan'],
          r['activeUsers'],
          r['aiCalls'],
          r['tokens'],
          r['assignments'],
          r['submissions'],
          r['revenue'],
        ].map(cell).join(','),
    ];
    await SimulationExport.share(
      'su-dung-khach-hang-$_year.csv',
      '\uFEFF${lines.join('\r\n')}',
      'text/csv',
      subject: 'Báo cáo sử dụng khách hàng $_year',
    );
  }

  static String _attentionLabel(String? key) => switch ((key ?? '').toUpperCase()) {
        'EXPIRING' || 'EXPIRING_SOON' => 'Sắp hết hạn',
        'EXPIRED' => 'Đã hết hạn',
        'QUOTA' => 'Dùng ≥80% token',
        'IDLE' || 'INACTIVE' || 'LOW_USAGE' => 'Không hoạt động 30 ngày',
        'UNKNOWN' => 'Chưa có hoạt động',
        'NONE' || 'HEALTHY' || 'OK' => 'Bình thường',
        _ => 'Đang theo dõi',
      };

  static Tone _attentionTone(String? key) => switch ((key ?? '').toUpperCase()) {
        'EXPIRING' || 'EXPIRING_SOON' || 'QUOTA' || 'IDLE' || 'INACTIVE' || 'LOW_USAGE' => Tone.warning,
        'EXPIRED' => Tone.danger,
        'NONE' || 'HEALTHY' || 'OK' => Tone.success,
        _ => Tone.neutral,
      };

  static String _trendLabel(String? raw) {
    if (raw == null || raw.isEmpty) return '';
    final m = RegExp(r'^(\d{4})-(\d{2})$').firstMatch(raw);
    if (m != null) return 'T${int.parse(m.group(2)!)}/${m.group(1)!.substring(2)}';
    final d = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$').firstMatch(raw);
    if (d != null) return '${int.parse(d.group(3)!)}/${int.parse(d.group(2)!)}';
    return raw;
  }

  static String _shortNum(int value) {
    if (value >= 1000000) return '${(value / 1000000).toStringAsFixed(1)}M';
    if (value >= 1000) return '${(value / 1000).round()}k';
    return '$value';
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final nowY = DateTime.now().year;
    final years = [nowY + 1, nowY, nowY - 1, nowY - 2];

    return Scaffold(
      appBar: const RoleTopBar(subtitle: 'Vận hành', showBack: true),
      body: Loader<Json>(
        load: _load,
        reloadKey: _reload,
        skeleton: const SkeletonList(withStats: true),
        builder: (context, data, reload) {
          final summary = asJson(data['summary']);
          final rows = asJsonList(data['items']);
          final trend = asJsonList(data['trend']);
          final attentionGroups = _cachedAttentionGroups.isNotEmpty ? _cachedAttentionGroups : asJsonList(data['attention']);
          final totalElements = asInt(data['totalElements']) ?? rows.length;
          final totalPages = asInt(data['totalPages']) ?? 1;
          final maxCalls = trend.fold<int>(1, (m, pt) {
            final v = asInt(pt['aiCalls']) ?? 0;
            return v > m ? v : m;
          });

          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
              children: [
                Text('Sử dụng khách hàng', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontSize: 22, fontWeight: FontWeight.w800, color: p.brand)),
                const SizedBox(height: 12),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: DropdownButtonFormField<int>(
                                initialValue: _year,
                                borderRadius: BorderRadius.circular(14),
                                dropdownColor: p.surface,
                                elevation: 4,
                                decoration: const InputDecoration(labelText: 'Năm'),
                                items: [for (final y in years) DropdownMenuItem(value: y, child: Text('Năm $y'))],
                                onChanged: (v) {
                                  if (v == null) return;
                                  setState(() {
                                    _year = v;
                                    _page = 0;
                                    _reload++;
                                  });
                                },
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: DropdownButtonFormField<int?>(
                                initialValue: _month,
                                borderRadius: BorderRadius.circular(14),
                                dropdownColor: p.surface,
                                elevation: 4,
                                menuMaxHeight: 300,
                                decoration: const InputDecoration(labelText: 'Tháng'),
                                items: [
                                  const DropdownMenuItem<int?>(value: null, child: Text('Cả năm')),
                                  for (var m = 1; m <= 12; m++) DropdownMenuItem<int?>(value: m, child: Text('Tháng $m')),
                                ],
                                onChanged: (v) => setState(() {
                                  _month = v;
                                  _page = 0;
                                  _reload++;
                                }),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        SearchBox(
                          hint: 'Tìm tên hoặc mã trường...',
                          onChanged: (v) => setState(() {
                            _query = v;
                            _page = 0;
                            _reload++;
                          }),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),

                // 4 KPI Cards
                Pair(
                  StatTile(
                    label: 'Lượt dùng AI',
                    value: groupDigits(asInt(summary['aiCalls']) ?? 0),
                    detail: '${asInt(summary['activeSchools']) ?? 0}/${asInt(summary['schools']) ?? 0} trường hoạt động',
                    icon: Icons.auto_awesome_rounded,
                    tint: p.violet,
                  ),
                  StatTile(
                    label: 'Tổng Token AI',
                    value: _shortNum(asInt(summary['tokens']) ?? 0),
                    detail: '${groupDigits(asInt(summary['activeUsers']) ?? 0)} người dùng hoạt động',
                    icon: Icons.bolt_rounded,
                    tint: p.teal,
                  ),
                ),
                const SizedBox(height: 10),
                Pair(
                  StatTile(
                    label: 'Bài tập đã giao',
                    value: groupDigits(asInt(summary['assignments']) ?? 0),
                    detail: '${groupDigits(asInt(summary['submissions']) ?? 0)} lượt nộp bài',
                    icon: Icons.assignment_outlined,
                    tint: p.blue,
                  ),
                  StatTile(
                    label: 'Doanh thu kỳ',
                    value: compactVnd(asInt(summary['revenue']) ?? 0),
                    detail: _month == null ? 'Trong năm $_year' : 'Tháng $_month/$_year',
                    icon: Icons.savings_rounded,
                    tint: p.green,
                  ),
                ),

                // Trend chart
                if (trend.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  'Xu hướng lượt dùng AI',
                                  style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                                ),
                              ),
                              if (trend.length > 6)
                                Text('Vuốt ngang →', style: TextStyle(color: p.muted, fontSize: 11.5)),
                            ],
                          ),
                          const SizedBox(height: 14),
                          SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            child: SizedBox(
                              height: 164,
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  for (final pt in trend)
                                    SizedBox(
                                      width: 58,
                                      child: Padding(
                                        padding: const EdgeInsets.symmetric(horizontal: 6),
                                        child: () {
                                          final calls = asInt(pt['aiCalls']) ?? 0;
                                          final h = calls == 0 ? 5.0 : (calls / maxCalls * 102).clamp(10.0, 102.0);
                                          return Column(
                                            mainAxisAlignment: MainAxisAlignment.end,
                                            children: [
                                              Text(
                                                calls == 0 ? '0' : _shortNum(calls),
                                                style: TextStyle(
                                                  fontSize: 11.5,
                                                  fontWeight: FontWeight.w700,
                                                  color: calls == 0 ? p.muted : p.ink,
                                                ),
                                              ),
                                              const SizedBox(height: 6),
                                              Container(
                                                height: h,
                                                decoration: BoxDecoration(
                                                  color: calls == 0 ? p.line : p.accent,
                                                  borderRadius: BorderRadius.circular(7),
                                                ),
                                              ),
                                              const SizedBox(height: 7),
                                              Text(
                                                _trendLabel(asString(pt['label'])),
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: TextStyle(
                                                  fontSize: 11,
                                                  color: calls == 0 ? p.muted : p.ink,
                                                  fontWeight: FontWeight.w600,
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
                          ),
                        ],
                      ),
                    ),
                  ),
                ],

                // Attention filter chips
                if (attentionGroups.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  ChoiceRow<String>(
                    selected: _attention,
                    onSelected: (v) => setState(() {
                      _attention = v;
                      _page = 0;
                      _reload++;
                    }),
                    options: [
                      ('ALL', 'Tất cả', _cachedTotalSchools),
                      for (final g in attentionGroups)
                        (
                          asString(g['key']) ?? '',
                          _attentionLabel(asString(g['key'])),
                          asInt(g['count']),
                        ),
                    ],
                  ),
                ],

                // Schools list
                const SizedBox(height: 12),
                Card(
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
                        child: Text('Danh sách trường ($totalElements)', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                      ),
                      if (rows.isEmpty)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                          child: Text('Không có trường nào phù hợp bộ lọc.', style: TextStyle(color: p.muted, fontSize: 13)),
                        )
                      else
                        for (var i = 0; i < rows.length; i++) ...[
                          if (i > 0) Divider(height: 1, indent: 16, endIndent: 16, color: p.line),
                          () {
                            final r = rows[i];
                            final att = asString(r['attention']);
                            return InkWell(
                              onTap: () => Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => ManagerSchoolUsageDetailScreen(
                                    schoolRow: r,
                                    year: _year,
                                    month: _month,
                                  ),
                                ),
                              ),
                              child: Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            children: [
                                              Expanded(
                                                child: Text(
                                                  asString(r['name']) ?? 'Trường',
                                                  maxLines: 1,
                                                  overflow: TextOverflow.ellipsis,
                                                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                                                ),
                                              ),
                                              if (att != null && att.isNotEmpty) ...[
                                                const SizedBox(width: 6),
                                                Pill(_attentionLabel(att), tone: _attentionTone(att)),
                                              ],
                                            ],
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            '${asString(r['plan']) ?? 'Chưa có gói'} · ${groupDigits(asInt(r['activeUsers']) ?? 0)} người dùng · ${groupDigits(asInt(r['aiCalls']) ?? 0)} lượt AI · ${_shortNum(asInt(r['tokens']) ?? 0)} token',
                                            style: TextStyle(color: p.muted, fontSize: 12),
                                          ),
                                          const SizedBox(height: 3),
                                          Text(
                                            '${groupDigits(asInt(r['assignments']) ?? 0)} bài giao · ${groupDigits(asInt(r['submissions']) ?? 0)} lượt nộp'
                                            '${(asInt(r['revenue']) ?? 0) > 0 ? ' · ${compactVnd(asInt(r['revenue'])!)}' : ''}',
                                            style: TextStyle(color: p.muted, fontSize: 11.5),
                                          ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(width: 6),
                                    Icon(Icons.chevron_right_rounded, color: p.muted, size: 20),
                                  ],
                                ),
                              ),
                            );
                          }(),
                        ],
                      if (totalPages > 1)
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            TextButton(onPressed: _page <= 0 ? null : () => setState(() { _page--; _reload++; }), child: const Text('Trước')),
                            Text('${_page + 1}/$totalPages', style: TextStyle(color: p.muted, fontSize: 12)),
                            TextButton(onPressed: _page + 1 >= totalPages ? null : () => setState(() { _page++; _reload++; }), child: const Text('Sau')),
                          ],
                        ),
                      Padding(
                        padding: const EdgeInsets.all(14),
                        child: OutlinedButton.icon(
                          onPressed: rows.isEmpty ? null : () => _exportCsv(rows),
                          icon: const Icon(Icons.download_rounded, size: 18),
                          label: const Text('Xuất báo cáo CSV'),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

/// Chi tiết sử dụng của 1 trường (KPI, xu hướng AI, thông tin gói và lịch sử email chăm sóc).
class ManagerSchoolUsageDetailScreen extends StatefulWidget {
  const ManagerSchoolUsageDetailScreen({
    super.key,
    required this.schoolRow,
    required this.year,
    this.month,
  });
  final Json schoolRow;
  final int year;
  final int? month;

  @override
  State<ManagerSchoolUsageDetailScreen> createState() => _ManagerSchoolUsageDetailScreenState();
}

class _ManagerSchoolUsageDetailScreenState extends State<ManagerSchoolUsageDetailScreen> {
  Future<(Json, List<Json>)> _load() async {
    final schoolId = asString(widget.schoolRow['id']) ?? '';
    final api = SessionScope.api(context);
    final res = await Future.wait([
      api.get('/reports/customer-usage', query: {
        'year': '${widget.year}',
        if (widget.month != null) 'month': '${widget.month}',
        'schoolId': schoolId,
        'size': '1',
      }),
      api.get('/reports/customer-usage/$schoolId/emails', query: {'page': '0', 'size': '10'})
          .then<Object?>((v) => v, onError: (_) => null),
    ]);
    final usage = asJson(res[0]);
    final emails = res[1] == null ? const <Json>[] : asJsonList(asJson(res[1])['items']);
    return (usage, emails);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final baseRow = widget.schoolRow;
    final schoolName = asString(baseRow['name']) ?? 'Trường học';
    final periodText = widget.month == null ? 'Năm ${widget.year}' : 'Tháng ${widget.month}/${widget.year}';

    return Scaffold(
      appBar: const RoleTopBar(subtitle: 'Vận hành', showBack: true),
      body: Loader<(Json, List<Json>)>(
        load: _load,
        skeleton: const SkeletonList(withStats: true),
        builder: (context, data, reload) {
          final (usage, emails) = data;
          final items = asJsonList(usage['items']);
          final row = items.isNotEmpty ? items.first : baseRow;
          final trend = asJsonList(usage['trend']);
          final att = asString(row['attention']);
          final maxCalls = trend.fold<int>(1, (m, pt) {
            final v = asInt(pt['aiCalls']) ?? 0;
            return v > m ? v : m;
          });

          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            schoolName,
                            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                              fontSize: 21,
                              fontWeight: FontWeight.w800,
                              color: p.brand,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${asString(row['code']) ?? ''} · $periodText',
                            style: TextStyle(color: p.muted, fontSize: 13),
                          ),
                        ],
                      ),
                    ),
                    if (att != null && att.isNotEmpty)
                      Pill(
                        _ManagerUsageScreenState._attentionLabel(att),
                        tone: _ManagerUsageScreenState._attentionTone(att),
                      ),
                  ],
                ),
                const SizedBox(height: 14),

                // School license info
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      children: [
                        InfoRow(label: 'Gói dịch vụ', value: asString(row['plan']) ?? 'Chưa thiết lập'),
                        InfoRow(label: 'Hết hạn bản quyền', value: asString(row['licenseEnd']) ?? '—'),
                        InfoRow(
                          label: 'Hoạt động gần nhất',
                          value: asDate(row['lastActivity']) == null ? 'Chưa ghi nhận' : formatDateTime(asDate(row['lastActivity'])),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),

                // 4 KPIs for this school
                Pair(
                  StatTile(
                    label: 'Lượt dùng AI',
                    value: groupDigits(asInt(row['aiCalls']) ?? 0),
                    detail: '${groupDigits(asInt(row['activeUsers']) ?? 0)} người dùng hoạt động',
                    icon: Icons.auto_awesome_rounded,
                    tint: p.violet,
                  ),
                  StatTile(
                    label: 'Token AI',
                    value: _ManagerUsageScreenState._shortNum(asInt(row['tokens']) ?? 0),
                    detail: '${groupDigits(asInt(row['tokens']) ?? 0)} token',
                    icon: Icons.bolt_rounded,
                    tint: p.teal,
                  ),
                ),
                const SizedBox(height: 10),
                Pair(
                  StatTile(
                    label: 'Bài tập đã giao',
                    value: groupDigits(asInt(row['assignments']) ?? 0),
                    detail: '${groupDigits(asInt(row['submissions']) ?? 0)} lượt nộp bài',
                    icon: Icons.assignment_outlined,
                    tint: p.blue,
                  ),
                  StatTile(
                    label: 'Doanh thu kỳ',
                    value: compactVnd(asInt(row['revenue']) ?? 0),
                    detail: periodText,
                    icon: Icons.savings_rounded,
                    tint: p.green,
                  ),
                ),

                // School trend bar chart
                if (trend.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  'Xu hướng dùng AI của trường',
                                  style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                                ),
                              ),
                              if (trend.length > 5)
                                Text('Vuốt ngang →', style: TextStyle(color: p.muted, fontSize: 11.5)),
                            ],
                          ),
                          const SizedBox(height: 14),
                          SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            child: SizedBox(
                              height: 158,
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  for (final pt in trend)
                                    SizedBox(
                                      width: 58,
                                      child: Padding(
                                        padding: const EdgeInsets.symmetric(horizontal: 6),
                                        child: () {
                                          final calls = asInt(pt['aiCalls']) ?? 0;
                                          final h = calls == 0 ? 5.0 : (calls / maxCalls * 96).clamp(10.0, 96.0);
                                          return Column(
                                            mainAxisAlignment: MainAxisAlignment.end,
                                            children: [
                                              Text(
                                                calls == 0 ? '0' : _ManagerUsageScreenState._shortNum(calls),
                                                style: TextStyle(
                                                  fontSize: 11.5,
                                                  fontWeight: FontWeight.w700,
                                                  color: calls == 0 ? p.muted : p.ink,
                                                ),
                                              ),
                                              const SizedBox(height: 6),
                                              Container(
                                                height: h,
                                                decoration: BoxDecoration(
                                                  color: calls == 0 ? p.line : p.accent,
                                                  borderRadius: BorderRadius.circular(7),
                                                ),
                                              ),
                                              const SizedBox(height: 6),
                                              Text(
                                                _ManagerUsageScreenState._trendLabel(asString(pt['label'])),
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: TextStyle(fontSize: 11, color: p.muted, fontWeight: FontWeight.w600),
                                              ),
                                            ],
                                          );
                                        }(),
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],

                // Recent emails sent to this school
                const SizedBox(height: 14),
                Card(
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
                        child: Text(
                          'Lịch sử email chăm sóc (${emails.length})',
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                        ),
                      ),
                      if (emails.isEmpty)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                          child: Text('Chưa có email nào gửi tới trường này.', style: TextStyle(color: p.muted, fontSize: 13)),
                        )
                      else
                        for (var i = 0; i < emails.length; i++) ...[
                          if (i > 0) Divider(height: 1, indent: 16, endIndent: 16, color: p.line),
                          () {
                            final m = emails[i];
                            final st = (asString(m['status']) ?? '').toUpperCase();
                            return ListTile(
                              title: Text(asString(m['subject']) ?? 'Email', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600)),
                              subtitle: Text(
                                '${asString(m['recipient']) ?? ''} · ${formatDateTime(asDate(m['sentAt']) ?? asDate(m['createdAt']))}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(color: p.muted, fontSize: 12),
                              ),
                              trailing: Pill(
                                _deliveryLabel(st),
                                tone: _deliveryTone(st),
                              ),
                            );
                          }(),
                        ],
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

/// MManagerEmails & MManagerEmail — Nhật ký email tự động.
class ManagerEmailsScreen extends StatefulWidget {
  const ManagerEmailsScreen({super.key});

  @override
  State<ManagerEmailsScreen> createState() => _ManagerEmailsScreenState();
}

class _ManagerEmailsScreenState extends State<ManagerEmailsScreen> {
  String _filter = 'ALL';
  String _query = '';
  DateTime? _from;
  DateTime? _to;
  int _page = 0;
  int _reload = 0;

  String _isoDate(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Future<void> _pickDate(bool isFrom) async {
    final initial = (isFrom ? _from : _to) ?? DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2023),
      lastDate: DateTime(2030),
    );
    if (picked == null || !mounted) return;
    setState(() {
      if (isFrom) {
        _from = picked;
      } else {
        _to = picked;
      }
      _page = 0;
      _reload++;
    });
  }

  Future<Json> _load() async => asJson(await SessionScope.api(context).get(
        '/reports/customer-usage/email-inbox',
        query: {
          'filter': _filter,
          if (_query.trim().isNotEmpty) 'query': _query.trim(),
          if (_from != null) 'from': _isoDate(_from!),
          if (_to != null) 'to': _isoDate(_to!),
          'page': '$_page',
          'size': '15',
        },
      ));

  Future<void> _openEmail(Json mail) async {
    final schoolId = asString(mail['schoolId']) ?? '';
    final emailId = asString(mail['id']) ?? '';
    Json? detail;
    if (schoolId.isNotEmpty && emailId.isNotEmpty) {
      try {
        detail = asJson(await SessionScope.api(context).get('/reports/customer-usage/$schoolId/emails/$emailId'));
      } catch (_) {}
    }
    if (!mounted) return;
    final emailObj = detail == null ? mail : asJson(detail['email']);
    final replies = detail == null ? const <Json>[] : asJsonList(detail['replies']);
    // Mark unread replies as read on the backend so both web and mobile badge update
    final unreadCount = asInt(mail['unreadCount']) ?? 0;
    if (unreadCount > 0 && emailId.isNotEmpty) {
      final replyIds = [
        for (final r in replies)
          if (asString(r['id']) != null) asString(r['id'])!,
      ];
      if (replyIds.isNotEmpty) {
        try {
          await SessionScope.api(context).post('/reports/customer-usage/email-inbox/$emailId/read', {'replyIds': replyIds});
          if (mounted) {
            syncNotifications(SessionScope.read(context));
            setState(() => _reload++);
          }
        } catch (_) {}
      }
    }
    if (!mounted) return;
    final bodyText = asString(emailObj['body']) ?? asString(mail['preview']) ?? 'Không có nội dung.';
    final status = asString(emailObj['status']) ?? asString(mail['status']);
    final recipient = asString(emailObj['recipient']) ?? asString(mail['recipient']) ?? '';

    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (ctx) {
          final p = ctx.palette;
          return Scaffold(
            appBar: const RoleTopBar(subtitle: 'Vận hành', showBack: true),
            body: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
              children: [
                Text(
                  asString(emailObj['subject']) ?? asString(mail['subject']) ?? 'Email',
                  style: Theme.of(ctx).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800, color: p.brand),
                ),
                const SizedBox(height: 6),
                Text(
                  '${asString(mail['schoolName']) ?? ''}${recipient.isEmpty ? '' : ' · $recipient'}',
                  style: TextStyle(color: p.muted, fontSize: 13),
                ),
                const SizedBox(height: 12),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      children: [
                        InfoRow(label: 'Trạng thái gửi', value: _deliveryLabel(status)),
                        InfoRow(label: 'Thời điểm', value: formatDateTime(asDate(emailObj['sentAt']) ?? asDate(mail['createdAt']))),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Section(
                  title: 'Nội dung email',
                  icon: Icons.mail_outline_rounded,
                  child: SelectableText(bodyText, style: const TextStyle(height: 1.45)),
                ),
                if (replies.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  Text('Phản hồi từ trường (${replies.length})', style: Theme.of(ctx).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  for (final rep in replies) ...[
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(asString(rep['sender']) ?? 'Khách hàng', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                            const SizedBox(height: 2),
                            Text(formatDateTime(asDate(rep['receivedAt'])), style: TextStyle(color: p.muted, fontSize: 11.5)),
                            const SizedBox(height: 8),
                            SelectableText(asString(rep['body']) ?? '', style: const TextStyle(height: 1.45)),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                  ],
                ],
              ],
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      appBar: const RoleTopBar(subtitle: 'Vận hành', showBack: true),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Nhật ký email tự động', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontSize: 22, fontWeight: FontWeight.w800, color: p.brand)),
                const SizedBox(height: 10),
                SearchBox(
                  hint: 'Tìm theo trường, email, tiêu đề...',
                  onChanged: (v) => setState(() {
                    _query = v;
                    _page = 0;
                    _reload++;
                  }),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => _pickDate(true),
                        icon: const Icon(Icons.date_range_rounded, size: 16),
                        label: Text(_from == null ? 'Từ ngày' : _isoDate(_from!), overflow: TextOverflow.ellipsis),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => _pickDate(false),
                        icon: const Icon(Icons.date_range_rounded, size: 16),
                        label: Text(_to == null ? 'Đến ngày' : _isoDate(_to!), overflow: TextOverflow.ellipsis),
                      ),
                    ),
                    if (_from != null || _to != null)
                      IconButton(
                        tooltip: 'Xóa lọc ngày',
                        onPressed: () => setState(() {
                          _from = null;
                          _to = null;
                          _page = 0;
                          _reload++;
                        }),
                        icon: Icon(Icons.close_rounded, color: p.muted, size: 20),
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                ChoiceRow<String>(
                  selected: _filter,
                  onSelected: (v) => setState(() {
                    _filter = v;
                    _page = 0;
                    _reload++;
                  }),
                  options: const [
                    ('ALL', 'Tất cả', null),
                    ('REPLIED', 'Có phản hồi', null),
                    ('UNREAD', 'Chưa đọc', null),
                  ],
                ),
              ],
            ),
          ),
          Expanded(
            child: Loader<Json>(
              load: _load,
              reloadKey: _reload,
              builder: (context, data, reload) {
                final items = asJsonList(data['items']);
                final totalPages = asInt(data['totalPages']) ?? 1;
                return RefreshIndicator(
                  onRefresh: reload,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
                    children: [
                      if (items.isEmpty)
                        const EmptyState(art: Art.empty, title: 'Chưa có email nào trong mục này')
                      else
                        Card(
                          clipBehavior: Clip.antiAlias,
                          child: Column(
                            children: [
                              for (var i = 0; i < items.length; i++) ...[
                                if (i > 0) Divider(height: 1, indent: 16, endIndent: 16, color: p.line),
                                () {
                                  final m = items[i];
                                  final st = (asString(m['status']) ?? asString(m['deliveryStatus']) ?? '').toUpperCase();
                                  final replies = asInt(m['replyCount']) ?? 0;
                                  final unread = asInt(m['unreadCount']) ?? 0;
                                  return ListTile(
                                    onTap: () => _openEmail(m),
                                    title: Row(
                                      children: [
                                        Expanded(
                                          child: Text(
                                            asString(m['subject']) ?? 'Email',
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: TextStyle(fontWeight: unread > 0 ? FontWeight.w800 : FontWeight.w600),
                                          ),
                                        ),
                                        if (unread > 0) ...[
                                          const SizedBox(width: 6),
                                          const Pill('Mới', tone: Tone.accent),
                                        ],
                                      ],
                                    ),
                                    subtitle: Text(
                                      '${asString(m['schoolName']) ?? asString(m['recipient']) ?? ''}'
                                      '${replies > 0 ? ' · $replies phản hồi' : ''}'
                                      ' · ${formatDateTime(asDate(m['activityAt']) ?? asDate(m['createdAt']))}',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(color: p.muted, fontSize: 12),
                                    ),
                                    trailing: Pill(
                                      _deliveryLabel(st),
                                      tone: _deliveryTone(st),
                                    ),
                                  );
                                }(),
                              ],
                            ],
                          ),
                        ),
                      if (totalPages > 1) ...[
                        const SizedBox(height: 8),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            TextButton(onPressed: _page <= 0 ? null : () => setState(() { _page--; _reload++; }), child: const Text('Trước')),
                            Text('${_page + 1}/$totalPages', style: TextStyle(color: p.muted, fontSize: 12)),
                            TextButton(onPressed: _page + 1 >= totalPages ? null : () => setState(() { _page++; _reload++; }), child: const Text('Sau')),
                          ],
                        ),
                      ],
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

/// MManagerCurriculum — Cây chương trình học (GET /curriculum/tree, bật/tắt mục).
class ManagerCurriculumScreen extends StatefulWidget {
  const ManagerCurriculumScreen({super.key});

  @override
  State<ManagerCurriculumScreen> createState() => _ManagerCurriculumScreenState();
}

class _ManagerCurriculumScreenState extends State<ManagerCurriculumScreen> {
  int _reload = 0;
  String _query = '';

  Future<List<Json>> _load() async {
    final res = await SessionScope.api(context).get('/admin/curriculum');
    if (res is List) return asJsonList(res);
    return asJsonList(asJson(res)['topics']);
  }

  static String _labelOf(Object? raw, [String fallback = 'Mục']) {
    if (raw is Map) {
      return asString(raw['vi']) ?? asString(raw['en']) ?? fallback;
    }
    final text = asString(raw);
    return (text == null || text.trim().isEmpty) ? fallback : text;
  }

  Future<void> _toggle(String type, String id) async {
    try {
      await SessionScope.api(context).put('/admin/curriculum/$type/$id/toggle');
      if (mounted) {
        showMessage(context, 'Đã cập nhật trạng thái.');
        setState(() => _reload++);
      }
    } catch (e) {
      if (mounted) showMessage(context, errorText(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      appBar: const RoleTopBar(subtitle: 'Vận hành', showBack: true),
      body: Loader<List<Json>>(
        load: _load,
        reloadKey: _reload,
        builder: (context, topics, reload) {
          var hiddenTopics = 0;
          var totalModules = 0;
          var totalLessons = 0;
          var activeLessons = 0;
          for (final t in topics) {
            final tOn = t['enabled'] != false && t['active'] != false;
            if (!tOn) hiddenTopics++;
            for (final m in asJsonList(t['modules'])) {
              totalModules++;
              final mOn = tOn && m['enabled'] != false && m['active'] != false;
              for (final lv in asJsonList(m['levels'])) {
                final lvOn = mOn && lv['enabled'] != false && lv['active'] != false;
                for (final ls in asJsonList(lv['lessons'])) {
                  totalLessons++;
                  if (lvOn && ls['enabled'] != false && ls['active'] != false) activeLessons++;
                }
              }
            }
          }
          final activePct = totalLessons == 0 ? 100 : ((activeLessons / totalLessons) * 100).round();

          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
              children: [
                Text('Chương trình học', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontSize: 22, fontWeight: FontWeight.w800, color: p.brand)),
                const SizedBox(height: 4),
                Text('Tra cứu và quản lý chủ đề, chương và bài học.', style: TextStyle(color: p.muted, fontSize: 13)),
                const SizedBox(height: 14),
                Pair(
                  StatTile(
                    label: 'Chủ đề',
                    value: groupDigits(topics.length),
                    detail: '$hiddenTopics đang ẩn',
                    icon: Icons.description_outlined,
                    tint: p.rose,
                  ),
                  StatTile(
                    label: 'Chương',
                    value: groupDigits(totalModules),
                    detail: 'Lớp 10–12',
                    icon: Icons.folder_outlined,
                    tint: p.blue,
                  ),
                ),
                const SizedBox(height: 10),
                Pair(
                  StatTile(
                    label: 'Bài học',
                    value: groupDigits(totalLessons),
                    detail: 'Theo chương trình THPT',
                    icon: Icons.menu_book_rounded,
                    tint: p.violet,
                  ),
                  StatTile(
                    label: 'Đang áp dụng',
                    value: groupDigits(activeLessons),
                    detail: '$activePct% bài học',
                    icon: Icons.verified_outlined,
                    tint: p.teal,
                  ),
                ),
                const SizedBox(height: 14),
                SearchBox(hint: 'Tìm chủ đề, chương hoặc bài học...', onChanged: (v) => setState(() => _query = v)),
                const SizedBox(height: 12),
                () {
                  final q = _query.trim().toLowerCase();
                  final filteredTopics = topics.where((t) {
                    if (q.isEmpty) return true;
                    if (_labelOf(t['name'] ?? t['title']).toLowerCase().contains(q)) return true;
                    for (final m in asJsonList(t['modules'])) {
                      if (_labelOf(m['name'] ?? m['title']).toLowerCase().contains(q)) return true;
                      for (final lv in asJsonList(m['levels'])) {
                        for (final ls in asJsonList(lv['lessons'])) {
                          if (_labelOf(ls['name'] ?? ls['title']).toLowerCase().contains(q)) return true;
                        }
                      }
                    }
                    return false;
                  }).toList();
                  if (filteredTopics.isEmpty) {
                    return const EmptyState(art: Art.library, title: 'Không tìm thấy nội dung chương trình học');
                  }
                  return Column(
                    children: [
                      for (final t in filteredTopics) ...[
                        () {
                          final enabled = t['enabled'] != false && t['active'] != false;
                          final modules = asJsonList(t['modules']);
                          return Card(
                            clipBehavior: Clip.antiAlias,
                            child: ExpansionTile(
                              title: Text(_labelOf(t['name'] ?? t['title'], 'Chủ đề'), style: const TextStyle(fontWeight: FontWeight.w700)),
                              subtitle: Text('${modules.length} chương', style: TextStyle(color: p.muted, fontSize: 12)),
                              trailing: Switch(
                                value: enabled,
                                onChanged: (_) => _toggle('topic', asString(t['id']) ?? ''),
                              ),
                              children: [
                                for (final m in modules)
                                  () {
                                    final modEnabled = m['enabled'] != false && m['active'] != false;
                                    final levels = asJsonList(m['levels']);
                                    return ExpansionTile(
                                      tilePadding: const EdgeInsets.only(left: 24, right: 16),
                                      title: Text(_labelOf(m['name'] ?? m['title'], 'Chương'), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                                      trailing: InkWell(
                                        borderRadius: BorderRadius.circular(99),
                                        onTap: () => _toggle('module', asString(m['id']) ?? ''),
                                        child: Pill(modEnabled ? 'Bật' : 'Ẩn', tone: modEnabled ? Tone.success : Tone.neutral),
                                      ),
                                      children: [
                                        for (final lv in levels)
                                          for (final ls in asJsonList(lv['lessons']))
                                            () {
                                              final lsEnabled = ls['enabled'] != false && ls['active'] != false;
                                              return ListTile(
                                                dense: true,
                                                contentPadding: const EdgeInsets.only(left: 38, right: 16),
                                                title: Text(_labelOf(ls['name'] ?? ls['title'], 'Bài học'), style: const TextStyle(fontSize: 13)),
                                                subtitle: Text(_labelOf(lv['name'], ''), style: TextStyle(color: p.muted, fontSize: 11.5)),
                                                trailing: Pill(lsEnabled ? 'Bật' : 'Ẩn', tone: lsEnabled ? Tone.success : Tone.neutral),
                                                onTap: () => _toggle('lesson', asString(ls['id']) ?? ''),
                                              );
                                            }(),
                                      ],
                                    );
                                  }(),
                              ],
                            ),
                          );
                        }(),
                        const SizedBox(height: 10),
                      ],
                    ],
                  );
                }(),
              ],
            ),
          );
        },
      ),
    );
  }
}

/// MManagerValidation — Theo dõi kiểm định mô phỏng (GET /admin/validation-runs/page).
class ManagerValidationScreen extends StatefulWidget {
  const ManagerValidationScreen({super.key});

  @override
  State<ManagerValidationScreen> createState() => _ManagerValidationScreenState();
}

class _ManagerValidationScreenState extends State<ManagerValidationScreen> {
  String _status = 'ALL';
  int _page = 0;
  int _reload = 0;

  Future<(Json, Json)> _load() async {
    final api = SessionScope.api(context);
    final res = await Future.wait([
      api.get('/admin/validation-runs/page', query: {'status': _status, 'page': '$_page', 'size': '15'}),
      api.get('/admin/metrics/validation').then<Object?>((v) => v, onError: (_) => null),
    ]);
    return (asJson(res[0]), asJson(res[1]));
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      appBar: const RoleTopBar(subtitle: 'Vận hành', showBack: true),
      body: Loader<(Json, Json)>(
        load: _load,
        reloadKey: _reload,
        skeleton: const SkeletonList(withStats: true),
        builder: (context, pairData, reload) {
          final (data, metrics) = pairData;
          final items = asJsonList(data['items']);
          final totalPages = asInt(data['totalPages']) ?? 1;
          final total = asInt(metrics['total']) ?? (asInt(data['totalElements']) ?? items.length);
          final failed = asInt(metrics['failed']) ?? 0;
          final passedCount = (total - failed).clamp(0, total);
          final passRate = total == 0 ? 100 : ((passedCount / total) * 100).round();
          final weekAgo = DateTime.now().subtract(const Duration(days: 7));
          final failedTopicsWeek = <String>{
            for (final r in items)
              if (r['passed'] == false && (asDate(r['createdAt'])?.isAfter(weekAgo) ?? false))
                asString(r['topic']) ?? 'OTHER',
          }.length;

          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
              children: [
                Text('Theo dõi kiểm định', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontSize: 22, fontWeight: FontWeight.w800, color: p.brand)),
                const SizedBox(height: 12),
                Pair(
                  StatTile(
                    label: 'Lượt chạy',
                    value: groupDigits(total),
                    detail: 'Tổng lượt kiểm định đã ghi nhận',
                    icon: Icons.verified_outlined,
                    tint: p.teal,
                  ),
                  StatTile(
                    label: 'Tỉ lệ đạt',
                    value: '$passRate%',
                    detail: '${groupDigits(passedCount)} lượt đạt chuẩn',
                    icon: Icons.check_circle_outline_rounded,
                    tint: p.green,
                  ),
                ),
                const SizedBox(height: 10),
                Pair(
                  StatTile(
                    label: 'Không đạt',
                    value: groupDigits(failed),
                    detail: failed == 0 ? 'Không có lỗi ghi nhận' : 'Cần kiểm tra chi tiết',
                    icon: Icons.error_outline_rounded,
                    tint: failed > 0 ? p.rose : p.blue,
                  ),
                  StatTile(
                    label: 'Chủ đề lỗi tuần này',
                    value: '$failedTopicsWeek',
                    detail: failedTopicsWeek == 0 ? 'Không có lỗi trong 7 ngày qua' : 'Trong 7 ngày gần nhất',
                    icon: Icons.report_gmailerrorred_rounded,
                    tint: failedTopicsWeek > 0 ? p.amber : p.blue,
                  ),
                ),
                const SizedBox(height: 12),
                ChoiceRow<String>(
                  selected: _status,
                  onSelected: (v) => setState(() {
                    _status = v;
                    _page = 0;
                    _reload++;
                  }),
                  options: const [
                    ('ALL', 'Tất cả', null),
                    ('PASS', 'Đạt', null),
                    ('FAIL', 'Không đạt', null),
                  ],
                ),
                const SizedBox(height: 12),
                if (items.isEmpty)
                  const EmptyState(art: Art.validate, title: 'Chưa có lượt kiểm định nào')
                else
                  Card(
                    clipBehavior: Clip.antiAlias,
                    child: Column(
                      children: [
                        for (var i = 0; i < items.length; i++) ...[
                          if (i > 0) Divider(height: 1, indent: 16, endIndent: 16, color: p.line),
                          () {
                            final r = items[i];
                            final st = (asString(r['status']) ?? '').toUpperCase();
                            final passed = r['passed'] == true || st == 'PASSED' || st == 'VERIFIED';
                            final isFailed = r['passed'] == false || st == 'FAILED';
                            return ListTile(
                              title: Text(asString(r['topic']) ?? asString(r['schemaId']) ?? 'Mô phỏng', style: const TextStyle(fontWeight: FontWeight.w600)),
                              subtitle: Text(
                                [
                                  formatDateTime(asDate(r['createdAt'])),
                                  if ((asString(r['errorMessage']) ?? '').isNotEmpty) asString(r['errorMessage'])!,
                                ].join(' · '),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(color: p.muted, fontSize: 12),
                              ),
                              trailing: Pill(
                                passed ? 'Đạt' : isFailed ? 'Không đạt' : st == 'UNVERIFIED' ? 'Chưa xác minh' : 'Cảnh báo',
                                tone: passed ? Tone.success : isFailed ? Tone.danger : Tone.warning,
                              ),
                            );
                          }(),
                        ],
                      ],
                    ),
                  ),
                if (totalPages > 1) ...[
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      TextButton(onPressed: _page <= 0 ? null : () => setState(() { _page--; _reload++; }), child: const Text('Trước')),
                      Text('${_page + 1}/$totalPages', style: TextStyle(color: p.muted, fontSize: 12)),
                      TextButton(onPressed: _page + 1 >= totalPages ? null : () => setState(() { _page++; _reload++; }), child: const Text('Sau')),
                    ],
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

String _deliveryLabel(String? status) => switch ((status ?? '').toUpperCase()) {
      'QUEUED' || 'PENDING' => 'Chờ gửi',
      'SENDING' => 'Đang gửi',
      'ACCEPTED' || 'SENT' => 'Đã gửi',
      'DELIVERED' => 'Đã chuyển đến',
      'DELAYED' => 'Chuyển thư chậm',
      'BOUNCED' => 'Bị trả lại',
      'COMPLAINED' => 'Bị báo spam',
      'SKIPPED' => 'Đã bỏ qua',
      'FAILED' => 'Gửi thất bại',
      'UNKNOWN' => 'Chưa xác định kết quả',
      _ => status ?? '—',
    };

Tone _deliveryTone(String? status) => switch ((status ?? '').toUpperCase()) {
      'DELIVERED' => Tone.success,
      'BOUNCED' || 'FAILED' || 'COMPLAINED' => Tone.danger,
      'UNKNOWN' || 'DELAYED' => Tone.warning,
      _ => Tone.info,
    };

class _MoreTile extends StatelessWidget {
  const _MoreTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.badge,
  });
  final IconData icon;
  final String title, subtitle;
  final VoidCallback onTap;
  final String? badge;

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
            if (badge != null) ...[
              const SizedBox(width: 8),
              Pill(badge!, tone: Tone.accent),
            ],
            const SizedBox(width: 4),
            Icon(Icons.chevron_right_rounded, color: p.muted, size: 20),
          ],
        ),
      ),
    );
  }
}
