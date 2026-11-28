import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api.dart';
import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../account/account_screens.dart';
import '../simulation/export.dart';
import 'school_overview_screen.dart';

/// MSchoolBilling & MSchoolTransaction — Mua & gia hạn gói, báo giá, lịch sử thanh toán.
class SchoolBillingScreen extends StatefulWidget {
  const SchoolBillingScreen({super.key});

  @override
  State<SchoolBillingScreen> createState() => _SchoolBillingScreenState();
}

class _BillingData {
  _BillingData(this.billing, this.plans);
  final Json billing;
  final List<Json> plans;
}

class _SchoolBillingScreenState extends State<SchoolBillingScreen> {
  String? _selectedPlan;
  Json? _quote;
  bool _quoting = false;
  bool _paying = false;
  String? _error;

  Future<_BillingData> _load() async {
    final api = SessionScope.api(context);
    final res = await Future.wait([
      api.get('/school/billing'),
      api.get('/auth/plans').then<Object?>((v) => v, onError: (_) => null),
    ]);
    final billing = asJson(res[0]);
    final plans = asJsonList(res[1]).where((p) => p['active'] != false).toList();
    _selectedPlan ??= asString(billing['planCode']) ?? (plans.isNotEmpty ? asString(plans.first['code']) : null);
    return _BillingData(billing, plans);
  }

  Future<void> _getQuote() async {
    final code = _selectedPlan;
    if (code == null) return;
    setState(() {
      _quoting = true;
      _error = null;
      _quote = null;
    });
    try {
      final q = asJson(await SessionScope.api(context).post('/school/billing/quote', {'planCode': code}));
      if (mounted) setState(() => _quote = q);
    } catch (error) {
      if (mounted) setState(() => _error = errorText(error));
    } finally {
      if (mounted) setState(() => _quoting = false);
    }
  }

  Future<void> _checkout() async {
    final q = _quote;
    if (q == null) return;
    setState(() {
      _paying = true;
      _error = null;
    });
    try {
      final res = asJson(await SessionScope.api(context).post('/school/billing/checkout', {
        'planCode': asString(q['planCode']),
        'expectedAmountVnd': asInt(q['amountVnd']),
      }));
      final url = asString(res['paymentUrl']);
      if (url != null && url.isNotEmpty) {
        await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      } else if (mounted) {
        showMessage(context, 'Đã tạo yêu cầu thanh toán.');
      }
    } catch (error) {
      if (mounted) setState(() => _error = errorText(error));
    } finally {
      if (mounted) setState(() => _paying = false);
    }
  }

  void _showTransaction(Json tx) {
    final p = context.palette;
    final status = (asString(tx['status']) ?? '').toUpperCase();
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(child: Text('Chi tiết giao dịch', style: Theme.of(ctx).textTheme.titleLarge)),
                  Pill(
                    status == 'PAID' ? 'Đã trả' : status == 'FAILED' ? 'Thất bại' : 'Chờ xử lý',
                    tone: status == 'PAID' ? Tone.success : status == 'FAILED' ? Tone.danger : Tone.warning,
                  ),
                ],
              ),
              const SizedBox(height: 14),
              _InfoRow('Mã giao dịch', asString(tx['id']) ?? '—'),
              _InfoRow('Gói dịch vụ', asString(tx['planCode']) ?? '—'),
              _InfoRow('Loại', _purposeLabel(asString(tx['purpose']))),
              _InfoRow('Số tiền', formatVnd(asInt(tx['amountVnd']) ?? 0)),
              _InfoRow('Ngày tạo', formatDateTime(asDate(tx['createdAt']))),
              if (asDate(tx['paidAt']) != null) _InfoRow('Thanh toán lúc', formatDateTime(asDate(tx['paidAt']))),
              const SizedBox(height: 14),
              OutlinedButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: Text('Đóng', style: TextStyle(color: p.ink)),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      appBar: const RoleTopBar(subtitle: 'Quản lý trường', showBack: true),
      body: Loader<_BillingData>(
        load: _load,
        skeleton: const SkeletonList(withStats: true),
        builder: (context, data, reload) {
          final b = data.billing;
          final planCode = asString(b['planCode']) ?? 'Chưa thiết lập';
          final licenseStart = asDate(b['licenseStart']);
          final licenseEnd = asDate(b['licenseEnd']);
          final daysLeft = licenseEnd?.difference(DateTime.now()).inDays;
          final payments = asJsonList(b['payments']);

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
                            'Gói sử dụng',
                            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                              color: p.brand,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text('Chọn gói phù hợp với quy mô trường.', style: TextStyle(color: p.muted, fontSize: 13)),
                        ],
                      ),
                    ),
                    const SizedBox(width: 10),
                    SizedBox(width: 68, height: 54, child: ArtImage(Art.billing)),
                  ],
                ),
                const SizedBox(height: 14),

                // Current plan card
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(child: Text('Gói hiện tại', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700))),
                            if (daysLeft != null)
                              Pill(
                                daysLeft < 0 ? 'Đã hết hạn' : 'Còn $daysLeft ngày',
                                tone: daysLeft <= 14 ? Tone.warning : Tone.success,
                              ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        _InfoRow('Gói', planCode),
                        _InfoRow('Thời hạn', '${_dmy(licenseStart)} – ${_dmy(licenseEnd)}'),
                        _InfoRow(
                          'Học sinh',
                          '${groupDigits(asInt(b['studentsUsed']) ?? 0)} / ${b['studentQuota'] == null ? 'Không giới hạn' : groupDigits(asInt(b['studentQuota'])!)}',
                        ),
                        _InfoRow(
                          'AI tháng này',
                          '${groupDigits(asInt(b['tokensUsed']) ?? 0)} / ${b['monthlyTokenQuota'] == null ? 'Không giới hạn' : groupDigits(asInt(b['monthlyTokenQuota'])!)}',
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 14),

                // Plan upgrade/renewal card
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text('Nâng cấp hoặc gia hạn', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                        const SizedBox(height: 10),
                        for (final plan in data.plans) ...[
                          () {
                            final code = asString(plan['code']) ?? '';
                            final selected = _selectedPlan == code;
                            return InkWell(
                              onTap: () => setState(() {
                                _selectedPlan = code;
                                _quote = null;
                              }),
                              borderRadius: BorderRadius.circular(12),
                              child: Container(
                                margin: const EdgeInsets.only(bottom: 8),
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: selected ? p.accentSoft : p.surface,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: selected ? p.accent : p.line, width: selected ? 1.5 : 1),
                                ),
                                child: Row(
                                  children: [
                                    Icon(
                                      selected ? Icons.radio_button_checked_rounded : Icons.radio_button_off_rounded,
                                      color: selected ? p.accent : p.muted,
                                      size: 20,
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(asString(plan['name']) ?? code, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                                          const SizedBox(height: 2),
                                          Text(
                                            '${plan['studentQuota'] == null ? 'Không giới hạn HS' : '${groupDigits(asInt(plan['studentQuota'])!)} HS'} · '
                                            '${plan['monthlyTokenQuota'] == null ? 'Không giới hạn token' : '${groupDigits(asInt(plan['monthlyTokenQuota'])!)} token/tháng'}',
                                            style: TextStyle(color: p.muted, fontSize: 12),
                                          ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Text(
                                      formatVnd(asInt(plan['annualPriceVnd']) ?? 0),
                                      style: TextStyle(color: p.brand, fontWeight: FontWeight.w800, fontSize: 13),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          }(),
                        ],
                        if (_quote != null) ...[
                          const SizedBox(height: 6),
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(color: p.green.bg, borderRadius: BorderRadius.circular(12)),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Báo giá (${_purposeLabel(asString(_quote!['purpose']))})',
                                  style: TextStyle(color: p.green.fg, fontWeight: FontWeight.w700, fontSize: 13),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  formatVnd(asInt(_quote!['amountVnd']) ?? 0),
                                  style: TextStyle(color: p.green.fg, fontWeight: FontWeight.w800, fontSize: 18),
                                ),
                                Text(
                                  'Hiệu lực: ${_dmy(asDate(_quote!['licenseStart']))} – ${_dmy(asDate(_quote!['licenseEnd']))}',
                                  style: TextStyle(color: p.green.fg, fontSize: 12),
                                ),
                              ],
                            ),
                          ),
                        ],
                        if (_error != null) ...[
                          const SizedBox(height: 8),
                          Text(_error!, style: TextStyle(color: p.danger, fontSize: 13)),
                        ],
                        const SizedBox(height: 12),
                        if (_quote == null)
                          FilledButton.icon(
                            onPressed: _quoting ? null : _getQuote,
                            icon: _quoting
                                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2.2))
                                : const Icon(Icons.request_quote_outlined, size: 18),
                            label: const Text('Lấy báo giá'),
                          )
                        else
                          FilledButton.icon(
                            onPressed: _paying ? null : _checkout,
                            icon: _paying
                                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2.2))
                                : const Icon(Icons.payment_rounded, size: 18),
                            label: const Text('Thanh toán qua VNPay'),
                          ),
                      ],
                    ),
                  ),
                ),

                // Payment history
                const SizedBox(height: 14),
                Card(
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
                        child: Text('Lịch sử thanh toán', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                      ),
                      if (payments.isEmpty)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                          child: Text('Chưa có giao dịch nào.', style: TextStyle(color: p.muted, fontSize: 13)),
                        )
                      else
                        for (var i = 0; i < payments.length; i++) ...[
                          if (i > 0) Divider(height: 1, indent: 16, endIndent: 16, color: p.line),
                          () {
                            final tx = payments[i];
                            final status = (asString(tx['status']) ?? '').toUpperCase();
                            return ListTile(
                              onTap: () => _showTransaction(tx),
                              title: Text(
                                '${asString(tx['planCode']) ?? ''} · ${_purposeLabel(asString(tx['purpose']))}',
                                style: const TextStyle(fontWeight: FontWeight.w600),
                              ),
                              subtitle: Text(
                                '${_dmy(asDate(tx['paidAt']) ?? asDate(tx['createdAt']))} · ${formatVnd(asInt(tx['amountVnd']) ?? 0)}',
                                style: TextStyle(color: p.muted, fontSize: 12),
                              ),
                              trailing: Pill(
                                status == 'PAID' ? 'Đã trả' : status == 'FAILED' ? 'Thất bại' : 'Chờ xử lý',
                                tone: status == 'PAID' ? Tone.success : status == 'FAILED' ? Tone.danger : Tone.warning,
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

/// MSchoolReports — Báo cáo trường (KPI, Token theo tháng, thống kê lớp, xuất CSV).
class SchoolReportsScreen extends StatefulWidget {
  const SchoolReportsScreen({super.key});

  @override
  State<SchoolReportsScreen> createState() => _SchoolReportsScreenState();
}

class _SchoolReportsScreenState extends State<SchoolReportsScreen> {
  bool _showAllClasses = false;
  String _periodMode = 'MONTH'; // MONTH | YEAR
  int _year = DateTime.now().year;
  int _month = DateTime.now().month;
  int _reload = 0;

  String get _monthIso => '$_year-${_month.toString().padLeft(2, '0')}';
  String get _periodLabel => _periodMode == 'YEAR' ? 'Năm $_year' : 'Tháng $_month/$_year';

  Future<(Json, List<Json>, List<Json>)> _load() async {
    final schoolId = SessionScope.read(context).user?.schoolId;
    if (schoolId == null) throw ApiException('Tài khoản chưa gắn với trường nào.');
    final api = SessionScope.api(context);
    final periodQuery = _periodMode == 'YEAR' ? {'year': '$_year'} : {'month': _monthIso};
    final res = await Future.wait([
      api.get('/schools/$schoolId/reports/summary', query: periodQuery),
      api.get('/schools/$schoolId/reports/classes').then<Object?>((v) => v, onError: (_) => null),
      api.get('/schools/$schoolId/reports/tokens/monthly', query: periodQuery).then<Object?>((v) => v, onError: (_) => null),
    ]);
    return (asJson(res[0]), asJsonList(res[1]), asJsonList(res[2]));
  }

  Future<void> _exportCsv(String schoolName, List<Json> classes) async {
    String cell(Object? v) => '"${'${v ?? ''}'.replaceAll('"', '""')}"';
    final lines = <String>[
      ['Lop', 'Khoi', 'Nam hoc', 'Giao vien', 'Hoc sinh'].map(cell).join(','),
      for (final c in classes)
        [c['name'], c['gradeLevel'], c['schoolYear'], c['teachers'], c['students']].map(cell).join(','),
    ];
    await SimulationExport.share(
      'bao-cao-truong.csv',
      '\uFEFF${lines.join('\r\n')}',
      'text/csv',
      subject: 'Báo cáo trường $schoolName',
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      appBar: const RoleTopBar(subtitle: 'Quản lý trường', showBack: true),
      body: Loader<(Json, List<Json>, List<Json>)>(
        load: _load,
        reloadKey: _reload,
        skeleton: const SkeletonList(withStats: true),
        builder: (context, data, reload) {
          final (s, classes, monthly) = data;
          final schoolName = asString(s['schoolName']) ?? 'Nhà trường';
          final visible = _showAllClasses ? classes : classes.take(5).toList();
          final nowYear = DateTime.now().year;
          final years = [nowYear + 1, nowYear, nowYear - 1, nowYear - 2];

          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
              children: [
                Text(
                  'Báo cáo trường',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: p.brand,
                  ),
                ),
                const SizedBox(height: 4),
                Text('$schoolName · $_periodLabel', style: TextStyle(color: p.muted, fontSize: 13)),
                const SizedBox(height: 12),

                // Period filter card (Theo tháng / Theo năm)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        ChoiceRow<String>(
                          selected: _periodMode,
                          onSelected: (v) => setState(() {
                            _periodMode = v;
                            _reload++;
                          }),
                          options: const [
                            ('MONTH', 'Theo tháng', null),
                            ('YEAR', 'Theo năm', null),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            if (_periodMode == 'MONTH') ...[
                              Expanded(
                                child: DropdownButtonFormField<int>(
                                  initialValue: _month,
                                  borderRadius: BorderRadius.circular(14),
                                  dropdownColor: p.surface,
                                  elevation: 4,
                                  menuMaxHeight: 300,
                                  decoration: const InputDecoration(labelText: 'Tháng'),
                                  items: [
                                    for (var m = 1; m <= 12; m++)
                                      DropdownMenuItem(value: m, child: Text('Tháng $m')),
                                  ],
                                  onChanged: (v) {
                                    if (v == null) return;
                                    setState(() {
                                      _month = v;
                                      _reload++;
                                    });
                                  },
                                ),
                              ),
                              const SizedBox(width: 10),
                            ],
                            Expanded(
                              child: DropdownButtonFormField<int>(
                                initialValue: _year,
                                borderRadius: BorderRadius.circular(14),
                                dropdownColor: p.surface,
                                elevation: 4,
                                decoration: const InputDecoration(labelText: 'Năm'),
                                items: [
                                  for (final y in years)
                                    DropdownMenuItem(value: y, child: Text('Năm $y')),
                                ],
                                onChanged: (v) {
                                  if (v == null) return;
                                  setState(() {
                                    _year = v;
                                    _reload++;
                                  });
                                },
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Pair(
                  StatTile(
                    label: 'Học sinh',
                    value: groupDigits(asInt(s['students']) ?? 0),
                    detail: '${asInt(s['enrolledStudents']) ?? 0} đã xếp lớp',
                    icon: Icons.school_rounded,
                    tint: p.blue,
                  ),
                  StatTile(
                    label: 'Giáo viên',
                    value: groupDigits(asInt(s['teachers']) ?? 0),
                    detail: '${asInt(s['activeClasses']) ?? classes.length} lớp hoạt động',
                    icon: Icons.co_present_rounded,
                    tint: p.teal,
                  ),
                ),
                const SizedBox(height: 10),
                StatTile(
                  label: _periodMode == 'YEAR' ? 'Tổng Token AI năm $_year' : 'Token AI tháng $_month/$_year',
                  value: groupDigits(asInt(s['usedTokens']) ?? 0),
                  detail: s['tokenQuota'] == null ? 'Không giới hạn hạn mức' : 'Hạn mức ${groupDigits(asInt(s['tokenQuota'])!)} token/tháng',
                  icon: Icons.auto_awesome_rounded,
                  tint: p.violet,
                ),
                if (monthly.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _periodMode == 'YEAR' ? 'Token AI 12 tháng năm $_year' : 'Token AI 6 tháng đến $_month/$_year',
                            style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 14),
                          SchoolTokenBars(rows: monthly, showAll: _periodMode == 'YEAR'),
                        ],
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 14),
                Card(
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 12, 10, 4),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text('Danh sách lớp (${classes.length})', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                            ),
                            if (classes.length > 5)
                              TextButton(
                                onPressed: () => setState(() => _showAllClasses = !_showAllClasses),
                                child: Text(_showAllClasses ? 'Thu gọn' : 'Hiện tất cả'),
                              ),
                          ],
                        ),
                      ),
                      if (classes.isEmpty)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                          child: Text('Chưa có lớp học nào.', style: TextStyle(color: p.muted, fontSize: 13)),
                        )
                      else
                        for (var i = 0; i < visible.length; i++) ...[
                          if (i > 0) Divider(height: 1, indent: 16, endIndent: 16, color: p.line),
                          ListTile(
                            title: Text('Lớp ${asString(visible[i]['name']) ?? ''}', style: const TextStyle(fontWeight: FontWeight.w600)),
                            subtitle: Text(
                              'Khối ${visible[i]['gradeLevel'] ?? '—'} · ${asString(visible[i]['schoolYear']) ?? ''}',
                              style: TextStyle(color: p.muted, fontSize: 12),
                            ),
                            trailing: Text(
                              '${visible[i]['students'] ?? 0} HS · ${visible[i]['teachers'] ?? 0} GV',
                              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5),
                            ),
                          ),
                        ],
                      Padding(
                        padding: const EdgeInsets.all(14),
                        child: OutlinedButton.icon(
                          onPressed: classes.isEmpty ? null : () => _exportCsv(schoolName, classes),
                          icon: const Icon(Icons.download_rounded, size: 18),
                          label: const Text('Xuất báo cáo CSV'),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                _SchoolTokenAuditCard(
                  periodMode: _periodMode,
                  monthIso: _monthIso,
                  year: _year,
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _SchoolTokenAuditCard extends StatefulWidget {
  const _SchoolTokenAuditCard({
    required this.periodMode,
    required this.monthIso,
    required this.year,
  });
  final String periodMode;
  final String monthIso;
  final int year;

  @override
  State<_SchoolTokenAuditCard> createState() => _SchoolTokenAuditCardState();
}

class _SchoolTokenAuditCardState extends State<_SchoolTokenAuditCard> {
  String _query = '';
  int _page = 0;
  int _reload = 0;

  @override
  void didUpdateWidget(covariant _SchoolTokenAuditCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.periodMode != widget.periodMode ||
        oldWidget.monthIso != widget.monthIso ||
        oldWidget.year != widget.year) {
      _page = 0;
      _reload++;
    }
  }

  Future<Json> _load() async {
    final schoolId = SessionScope.read(context).user!.schoolId!;
    final query = <String, String>{
      'page': '$_page',
      'size': '10',
      if (_query.trim().isNotEmpty) 'query': _query.trim(),
      if (widget.periodMode == 'MONTH') 'month': widget.monthIso else 'year': '${widget.year}',
    };
    return asJson(await SessionScope.api(context).get('/schools/$schoolId/reports/token-audit/page', query: query));
  }

  static String _opLabel(String? op) => switch (op) {
        'AI_GENERATION' => 'Tạo mô phỏng AI',
        'ROUTE' => 'Phân loại chủ đề',
        'MODEL' => 'Phân tích bài toán',
        'OCR' => 'Đọc đề từ ảnh',
        'SCENE' => 'Tạo cảnh mô phỏng',
        _ => op ?? 'AI',
      };

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Lịch sử sử dụng AI', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text('Tra cứu theo email tài khoản trong kỳ đang chọn.', style: TextStyle(color: p.muted, fontSize: 12)),
            const SizedBox(height: 10),
            SearchBox(
              hint: 'Tìm theo email tài khoản...',
              onChanged: (v) => setState(() {
                _query = v;
                _page = 0;
                _reload++;
              }),
            ),
            const SizedBox(height: 10),
            Loader<Json>(
              load: _load,
              reloadKey: _reload,
              skeleton: const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator())),
              builder: (context, data, _) {
                final items = asJsonList(data['items']);
                final total = asInt(data['totalElements']) ?? items.length;
                final totalPages = asInt(data['totalPages']) ?? 1;
                final page = asInt(data['page']) ?? _page;
                if (items.isEmpty) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    child: Text('Không có lượt sử dụng AI nào trong kỳ này.', style: TextStyle(color: p.muted, fontSize: 13)),
                  );
                }
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text('$total lượt sử dụng', style: TextStyle(color: p.muted, fontSize: 12, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 6),
                    for (var i = 0; i < items.length; i++) ...[
                      if (i > 0) Divider(height: 1, color: p.line),
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    asString(items[i]['userEmail']) ?? '',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    '${_opLabel(asString(items[i]['operation']))} · ${formatDateTime(asDate(items[i]['recordedAt']))}',
                                    style: TextStyle(color: p.muted, fontSize: 11.5),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            Pill('${groupDigits(asInt(items[i]['tokens']) ?? 0)} tok', tone: Tone.info),
                          ],
                        ),
                      ),
                    ],
                    if (totalPages > 1) ...[
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          TextButton(
                            onPressed: page <= 0
                                ? null
                                : () => setState(() {
                                      _page = page - 1;
                                      _reload++;
                                    }),
                            child: const Text('Trước'),
                          ),
                          Text('${page + 1}/$totalPages', style: TextStyle(color: p.muted, fontSize: 12)),
                          TextButton(
                            onPressed: page + 1 >= totalPages
                                ? null
                                : () => setState(() {
                                      _page = page + 1;
                                      _reload++;
                                    }),
                            child: const Text('Sau'),
                          ),
                        ],
                      ),
                    ],
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

/// MSchoolAppeals & MSchoolAppeal — Yêu cầu mở khóa tài khoản.
class SchoolAppealsScreen extends StatefulWidget {
  const SchoolAppealsScreen({super.key});

  @override
  State<SchoolAppealsScreen> createState() => _SchoolAppealsScreenState();
}

class _SchoolAppealsScreenState extends State<SchoolAppealsScreen> {
  int _reload = 0;
  String _filter = 'ALL'; // ALL | PENDING | APPROVED | REJECTED

  Future<List<Json>> _load() async =>
      asJsonList(await SessionScope.api(context).get('/admin/appeals'));

  Future<void> _openAppeal(Json item) async {
    final note = TextEditingController();
    final p = context.palette;
    final api = SessionScope.api(context);
    final appealId = asString(item['id']) ?? '';
    final status = (asString(item['status']) ?? 'PENDING').toUpperCase();
    List<Json> evidence = const [];
    try {
      evidence = asJsonList(await api.get('/appeals/$appealId/evidence'));
    } catch (_) {}
    if (!mounted) {
      note.dispose();
      return;
    }
    final resolved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 4, 20, MediaQuery.of(ctx).viewInsets.bottom + 24),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(child: Text(asString(item['userFullName']) ?? asString(item['userEmail']) ?? 'Tài khoản', style: Theme.of(ctx).textTheme.titleLarge)),
                  Pill(
                    status == 'APPROVED' ? 'Đã duyệt' : status == 'REJECTED' ? 'Từ chối' : 'Chờ xử lý',
                    tone: status == 'APPROVED' ? Tone.success : status == 'REJECTED' ? Tone.danger : Tone.warning,
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(asString(item['userEmail']) ?? '', style: TextStyle(color: p.muted, fontSize: 13)),
              const SizedBox(height: 12),
              Text('Lý do khiếu nại', style: TextStyle(color: p.muted, fontSize: 12, fontWeight: FontWeight.w600)),
              const SizedBox(height: 4),
              Text(asString(item['reason']) ?? 'Không có nội dung', style: const TextStyle(height: 1.45)),
              if (evidence.isNotEmpty) ...[
                const SizedBox(height: 12),
                Text('Ảnh minh chứng (${evidence.length})', style: TextStyle(color: p.muted, fontSize: 12, fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                SizedBox(
                  height: 100,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: evidence.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 8),
                    itemBuilder: (_, idx) {
                      final evId = asString(evidence[idx]['id']) ?? '';
                      final url = api.base.replace(path: '${api.base.path}/appeals/$appealId/evidence/$evId').toString();
                      final headers = {if (api.token != null) 'Authorization': 'Bearer ${api.token}'};
                      return GestureDetector(
                        onTap: () => showDialog(
                          context: ctx,
                          builder: (_) => Dialog(
                            child: InteractiveViewer(
                              child: Image.network(url, headers: headers, fit: BoxFit.contain),
                            ),
                          ),
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(10),
                          child: Image.network(
                            url,
                            headers: headers,
                            width: 100,
                            height: 100,
                            fit: BoxFit.cover,
                            errorBuilder: (_, _, _) => Container(
                              width: 100,
                              height: 100,
                              color: p.surface2,
                              alignment: Alignment.center,
                              child: Icon(Icons.broken_image_outlined, color: p.muted),
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
              if (status == 'PENDING') ...[
                const SizedBox(height: 14),
                TextField(
                  controller: note,
                  minLines: 2,
                  maxLines: 4,
                  decoration: const InputDecoration(labelText: 'Ghi chú xử lý (không bắt buộc)'),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () async {
                          await api.put('/admin/appeals/$appealId/resolve', {
                            'approved': false,
                            'resolutionNote': note.text.trim(),
                          });
                          if (ctx.mounted) Navigator.of(ctx).pop(true);
                        },
                        child: const Text('Từ chối'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: FilledButton(
                        onPressed: () async {
                          await api.put('/admin/appeals/$appealId/resolve', {
                            'approved': true,
                            'resolutionNote': note.text.trim(),
                          });
                          if (ctx.mounted) Navigator.of(ctx).pop(true);
                        },
                        child: const Text('Mở khóa'),
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
    note.dispose();
    if (resolved == true && mounted) {
      showMessage(context, 'Đã xử lý yêu cầu mở khóa.');
      setState(() => _reload++);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      appBar: const RoleTopBar(subtitle: 'Quản lý trường', showBack: true),
      body: Loader<List<Json>>(
        load: _load,
        reloadKey: _reload,
        builder: (context, items, reload) {
          String statusOf(Json a) => (asString(a['status']) ?? 'PENDING').toUpperCase();
          final pending = items.where((a) => statusOf(a) == 'PENDING').toList();
          final approved = items.where((a) => statusOf(a) == 'APPROVED').toList();
          final rejected = items.where((a) => statusOf(a) == 'REJECTED').toList();
          final shown = switch (_filter) {
            'PENDING' => pending,
            'APPROVED' => approved,
            'REJECTED' => rejected,
            _ => items,
          };

          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
              children: [
                Text(
                  'Yêu cầu mở khóa',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: p.brand,
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _MiniAppealStat(
                        label: 'Chờ xử lý',
                        value: '${pending.length}',
                        tint: p.amber,
                        selected: _filter == 'PENDING',
                        onTap: () => setState(() => _filter = 'PENDING'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _MiniAppealStat(
                        label: 'Đã duyệt',
                        value: '${approved.length}',
                        tint: p.green,
                        selected: _filter == 'APPROVED',
                        onTap: () => setState(() => _filter = 'APPROVED'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _MiniAppealStat(
                        label: 'Đã từ chối',
                        value: '${rejected.length}',
                        tint: p.rose,
                        selected: _filter == 'REJECTED',
                        onTap: () => setState(() => _filter = 'REJECTED'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                ChoiceRow<String>(
                  selected: _filter,
                  onSelected: (v) => setState(() => _filter = v),
                  options: [
                    ('ALL', 'Tất cả', items.length),
                    ('PENDING', 'Chờ xử lý', pending.length),
                    ('APPROVED', 'Đã duyệt', approved.length),
                    ('REJECTED', 'Từ chối', rejected.length),
                  ],
                ),
                const SizedBox(height: 12),
                if (shown.isEmpty)
                  EmptyState(
                    art: Art.success,
                    title: switch (_filter) {
                      'PENDING' => 'Không có yêu cầu chờ xử lý',
                      'APPROVED' => 'Chưa có yêu cầu đã duyệt',
                      'REJECTED' => 'Chưa có yêu cầu bị từ chối',
                      _ => 'Chưa có yêu cầu mở khóa nào',
                    },
                  )
                else
                  Card(
                    clipBehavior: Clip.antiAlias,
                    child: Column(
                      children: [
                        for (var i = 0; i < shown.length; i++) ...[
                          if (i > 0) Divider(height: 1, indent: 16, endIndent: 16, color: p.line),
                          () {
                            final st = statusOf(shown[i]);
                            final pill = switch (st) {
                              'APPROVED' => const Pill('Đã duyệt', tone: Tone.success),
                              'REJECTED' => const Pill('Từ chối', tone: Tone.danger),
                              _ => const Pill('Chờ xử lý', tone: Tone.warning),
                            };
                            return ListTile(
                              onTap: () => _openAppeal(shown[i]),
                              title: Text(
                                asString(shown[i]['userFullName']) ?? asString(shown[i]['userEmail']) ?? 'Tài khoản',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontWeight: FontWeight.w600),
                              ),
                              subtitle: Text(
                                asString(shown[i]['reason']) ?? '',
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(color: p.muted, fontSize: 12),
                              ),
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  pill,
                                  const SizedBox(width: 4),
                                  Icon(Icons.chevron_right_rounded, color: p.muted, size: 18),
                                ],
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

/// MSchoolCreateUser — Tạo tài khoản học sinh hoặc giáo viên thuộc trường.
class SchoolCreateUserScreen extends StatefulWidget {
  const SchoolCreateUserScreen({super.key});

  @override
  State<SchoolCreateUserScreen> createState() => _SchoolCreateUserScreenState();
}

class _SchoolCreateUserScreenState extends State<SchoolCreateUserScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  String _role = 'STUDENT';
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
    final schoolId = SessionScope.read(context).user?.schoolId;
    if (schoolId == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await SessionScope.api(context).post('/schools/$schoolId/users', {
        'fullName': _name.text.trim(),
        'email': _email.text.trim(),
        'password': _password.text,
        'role': _role,
        if (_role == 'STAFF') 'permissions': ['TEACH'],
      });
      if (!mounted) return;
      showMessage(context, 'Đã tạo tài khoản mới.');
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
      appBar: const RoleTopBar(subtitle: 'Quản lý trường', showBack: true),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 32),
          children: [
            Text(
              'Tạo tài khoản trường',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: p.brand,
              ),
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
                        DropdownMenuItem(value: 'STUDENT', child: Text('Học sinh')),
                        DropdownMenuItem(value: 'STAFF', child: Text('Giáo viên')),
                      ],
                      onChanged: _busy ? null : (v) => setState(() => _role = v ?? 'STUDENT'),
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

/// MSchoolImport & MSchoolImportPreview — Nhập dữ liệu CSV (tải mẫu, dán CSV, xem trước, xác nhận nhập).
class SchoolImportScreen extends StatefulWidget {
  const SchoolImportScreen({super.key});

  @override
  State<SchoolImportScreen> createState() => _SchoolImportScreenState();
}

class _SchoolImportScreenState extends State<SchoolImportScreen> {
  final _csv = TextEditingController();
  String _kind = 'USERS';
  bool _busy = false;
  String? _error;
  Json? _preview;
  List<Map<String, dynamic>> _parsedRows = const [];

  static const _templates = <String, String>{
    'USERS': 'fullName,email,role,dateOfBirth,classCode,schoolYear\nNguyễn Văn A,hs.a@truong.edu.vn,STUDENT,2010-05-12,10A1,2026-2027',
    'CLASSES': 'name,gradeLevel,schoolYear,subject\n10A1,10,2026-2027,Vật lý',
    'ENROLLMENTS': 'studentEmail,classCode,schoolYear\nhs.a@truong.edu.vn,10A1,2026-2027',
    'TEACHER_ASSIGNMENTS': 'teacherEmail,classCode,schoolYear\ngv.a@truong.edu.vn,10A1,2026-2027',
  };

  @override
  void dispose() {
    _csv.dispose();
    super.dispose();
  }

  List<Map<String, dynamic>> _parseCsvText(String raw) {
    final lines = raw
        .replaceAll('\r\n', '\n')
        .replaceAll('\r', '\n')
        .split('\n')
        .map((l) => l.trim())
        .where((l) => l.isNotEmpty)
        .toList();
    if (lines.length < 2) return const [];
    final headers = lines.first.split(',').map((h) => h.trim().replaceAll('"', '')).toList();
    final rows = <Map<String, dynamic>>[];
    for (var i = 1; i < lines.length; i++) {
      final cols = lines[i].split(',').map((c) => c.trim().replaceAll('"', '')).toList();
      final data = <String, String>{};
      for (var j = 0; j < headers.length; j++) {
        data[headers[j]] = j < cols.length ? cols[j] : '';
      }
      rows.add({'row': i + 1, 'data': data});
    }
    return rows;
  }

  Future<void> _shareTemplate() async {
    final content = _templates[_kind] ?? '';
    await SimulationExport.share(
      'mau-nhap-${_kind.toLowerCase()}.csv',
      '\uFEFF$content',
      'text/csv',
      subject: 'Mẫu CSV nhập dữ liệu ($_kind)',
    );
  }

  Future<void> _runPreview() async {
    final schoolId = SessionScope.read(context).user?.schoolId;
    if (schoolId == null) return;
    final rows = _parseCsvText(_csv.text);
    if (rows.isEmpty) {
      setState(() => _error = 'Dán nội dung CSV gồm ít nhất 1 dòng tiêu đề và 1 dòng dữ liệu.');
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
      _preview = null;
      _parsedRows = rows;
    });
    try {
      final res = asJson(await SessionScope.api(context).post('/schools/$schoolId/imports/preview', {
        'kind': _kind,
        'rows': rows,
      }));
      if (mounted) setState(() => _preview = res);
    } catch (error) {
      if (mounted) setState(() => _error = errorText(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _commit() async {
    final schoolId = SessionScope.read(context).user?.schoolId;
    final preview = _preview;
    if (schoolId == null || preview == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final res = asJson(await SessionScope.api(context).post('/schools/$schoolId/imports/commit', {
        'kind': _kind,
        'rows': _parsedRows,
        'previewToken': asString(preview['previewToken']),
      }));
      if (!mounted) return;
      final count = asInt(res['imported']) ?? 0;
      showMessage(context, 'Đã nhập thành công $count dòng dữ liệu.');
      setState(() {
        _preview = null;
        _csv.clear();
      });
    } catch (error) {
      if (mounted) setState(() => _error = errorText(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final previewRows = _preview == null ? const <Json>[] : asJsonList(_preview!['rows']);
    final canCommit = _preview != null && _preview!['canCommit'] == true;

    return Scaffold(
      appBar: const RoleTopBar(subtitle: 'Quản lý trường', showBack: true),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        children: [
          Text(
            'Nhập dữ liệu CSV',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: p.brand,
            ),
          ),
          const SizedBox(height: 4),
          Text('Chọn loại dữ liệu, dán nội dung CSV rồi xem trước trước khi lưu.', style: TextStyle(color: p.muted, fontSize: 13)),
          const SizedBox(height: 14),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  DropdownButtonFormField<String>(
                    initialValue: _kind,
                    borderRadius: BorderRadius.circular(14),
                    dropdownColor: p.surface,
                    elevation: 4,
                    decoration: const InputDecoration(labelText: 'Loại dữ liệu'),
                    items: const [
                      DropdownMenuItem(value: 'USERS', child: Text('Tài khoản (Học sinh / Giáo viên)')),
                      DropdownMenuItem(value: 'CLASSES', child: Text('Danh sách lớp học')),
                      DropdownMenuItem(value: 'ENROLLMENTS', child: Text('Xếp lớp học sinh')),
                      DropdownMenuItem(value: 'TEACHER_ASSIGNMENTS', child: Text('Phân công giáo viên')),
                    ],
                    onChanged: _busy
                        ? null
                        : (v) => setState(() {
                              _kind = v ?? 'USERS';
                              _preview = null;
                            }),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _busy ? null : _shareTemplate,
                          icon: const Icon(Icons.download_rounded, size: 16),
                          label: const Text('Tải mẫu CSV'),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: OutlinedButton(
                          onPressed: _busy ? null : () => setState(() => _csv.text = _templates[_kind] ?? ''),
                          child: const Text('Điền dòng mẫu'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _csv,
                    enabled: !_busy,
                    minLines: 5,
                    maxLines: 10,
                    style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
                    decoration: const InputDecoration(
                      labelText: 'Nội dung CSV',
                      hintText: 'Dán các dòng CSV (dòng đầu là tên cột)...',
                      alignLabelWithHint: true,
                    ),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 10),
                    Text(_error!, style: TextStyle(color: p.danger, fontSize: 13)),
                  ],
                  const SizedBox(height: 14),
                  FilledButton.icon(
                    onPressed: _busy ? null : _runPreview,
                    icon: _busy
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2.2))
                        : const Icon(Icons.preview_rounded, size: 18),
                    label: const Text('Xem trước dữ liệu'),
                  ),
                ],
              ),
            ),
          ),
          if (_preview != null) ...[
            const SizedBox(height: 14),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Expanded(child: Text('Kết quả xem trước', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700))),
                        Pill('${_preview!['validRows'] ?? 0} hợp lệ', tone: Tone.success),
                        if ((asInt(_preview!['invalidRows']) ?? 0) > 0) ...[
                          const SizedBox(width: 6),
                          Pill('${_preview!['invalidRows']} lỗi', tone: Tone.danger),
                        ],
                      ],
                    ),
                    const SizedBox(height: 10),
                    for (final r in previewRows.take(15)) ...[
                      Divider(height: 1, color: p.line),
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Dòng ${r['row']}: ${asJson(r['data']).values.where((v) => '$v'.isNotEmpty).take(3).join(' · ')}',
                              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                            ),
                            for (final err in (r['errors'] as List? ?? const []))
                              Text('• Lỗi: $err', style: TextStyle(color: p.danger, fontSize: 12)),
                            for (final warn in (r['warnings'] as List? ?? const []))
                              Text('• Cảnh báo: $warn', style: TextStyle(color: p.amber.fg, fontSize: 12)),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 12),
                    FilledButton.icon(
                      onPressed: (_busy || !canCommit) ? null : _commit,
                      icon: const Icon(Icons.check_circle_outline_rounded, size: 18),
                      label: const Text('Xác nhận nhập dữ liệu'),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _MiniAppealStat extends StatelessWidget {
  const _MiniAppealStat({
    required this.label,
    required this.value,
    required this.tint,
    required this.selected,
    required this.onTap,
  });
  final String label, value;
  final Tint tint;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
        decoration: BoxDecoration(
          color: tint.bg,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: selected ? tint.fg : Colors.transparent, width: 1.5),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: tint.fg, fontSize: 11.5, fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text(value, style: TextStyle(color: p.ink, fontSize: 20, fontWeight: FontWeight.w800)),
          ],
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow(this.label, this.value);
  final String label, value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(child: Text(label, style: TextStyle(color: context.palette.muted, fontSize: 13))),
          Flexible(child: Text(value, textAlign: TextAlign.end, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
        ],
      ),
    );
  }
}

String _dmy(DateTime? d) {
  if (d == null) return '—';
  final day = d.day.toString().padLeft(2, '0');
  final mon = d.month.toString().padLeft(2, '0');
  return '$day/$mon/${d.year}';
}

String _purposeLabel(String? p) => switch ((p ?? '').toUpperCase()) {
      'RENEW' => 'Gia hạn',
      'UPGRADE' => 'Nâng cấp',
      'NEW' => 'Đăng ký mới',
      _ => p ?? 'Thanh toán',
    };
