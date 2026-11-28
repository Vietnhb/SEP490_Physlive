import 'package:flutter/material.dart';

import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';

enum _Status { all, paid, failed, pending }

/// Every payment schools made: totals, a search, a status filter, grouped by month.
class PaymentsScreen extends StatefulWidget {
  const PaymentsScreen({super.key, this.asTab = false});

  /// A tab of its own gets the large header; opened from the overview it is a page with a back arrow.
  final bool asTab;

  @override
  State<PaymentsScreen> createState() => _PaymentsScreenState();
}

class _PaymentsScreenState extends State<PaymentsScreen> {
  _Status _status = _Status.all;
  String _query = '';
  int? _year;
  int? _month;
  String? _planCode;
  int _limit = 15;

  Future<List<Payment>> _load() async {
    final items = asJsonList(await SessionScope.api(context).get('/admin/payments')).map(Payment.new).toList();
    items.sort((a, b) => (b.createdAt ?? DateTime(0)).compareTo(a.createdAt ?? DateTime(0)));
    return items;
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      appBar: widget.asTab
          ? const HeroBar(title: 'Thanh toán', subtitle: 'Giao dịch của các trường', art: Art.billing)
          : AppBar(title: const Text('Thanh toán')) as PreferredSizeWidget,
      body: Loader<List<Payment>>(
        load: _load,
        skeleton: const SkeletonList(withStats: true),
        builder: (context, allItems, reload) {
          final years = <int>{
            for (final x in allItems)
              if (x.createdAt != null) x.createdAt!.year,
          }.toList()
            ..sort((a, b) => b.compareTo(a));
          final plans = <String>{
            for (final x in allItems)
              if (x.planCode.isNotEmpty) x.planCode,
          }.toList()
            ..sort();

          // Apply year / month / plan filter first so KPIs & status counts match the selected period
          final scoped = allItems.where((x) {
            if (_year != null && x.createdAt?.year != _year) return false;
            if (_month != null && x.createdAt?.month != _month) return false;
            if (_planCode != null && x.planCode != _planCode) return false;
            return true;
          }).toList();

          final paid = scoped.where((x) => x.paid).toList();
          final failed = scoped.where((x) => x.failed).toList();
          final pending = scoped.where((x) => !x.paid && !x.failed).toList();
          final query = _query.toLowerCase();
          final filtered = switch (_status) {
            _Status.all => scoped,
            _Status.paid => paid,
            _Status.failed => failed,
            _Status.pending => pending,
          }
              .where((x) => query.isEmpty ||
                  '${x.schoolName} ${x.managerEmail ?? ''} ${x.planCode}'.toLowerCase().contains(query))
              .toList();

          final shown = filtered.take(_limit).toList();
          final remaining = (filtered.length - shown.length).clamp(0, filtered.length);
          final hasExtraFilters = _year != null || _month != null || _planCode != null;

          // one heading per month, newest first
          final groups = <String, List<Payment>>{};
          for (final x in shown) {
            final d = x.createdAt;
            groups.putIfAbsent(d == null ? 'Không rõ ngày' : 'Tháng ${d.month}/${d.year}', () => []).add(x);
          }
          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(padding: const EdgeInsets.fromLTRB(16, 14, 16, 28), children: [
              Pair(
                StatTile(
                  label: 'Đã thu',
                  value: compactVnd(paid.fold<int>(0, (s, x) => s + x.amount)),
                  detail: '${paid.length} giao dịch',
                  icon: Icons.savings_rounded,
                  tint: p.green,
                ),
                StatTile(
                  label: 'Thất bại',
                  value: '${failed.length}',
                  detail: '${pending.length} đang chờ',
                  icon: Icons.sms_failed_rounded,
                  tint: p.rose,
                ),
              ),
              const SizedBox(height: 12),
              SearchBox(
                hint: 'Tìm theo trường, email, gói',
                onChanged: (v) => setState(() {
                  _query = v;
                  _limit = 15;
                }),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: DropdownButtonFormField<int?>(
                      initialValue: years.contains(_year) ? _year : null,
                      isExpanded: true,
                      borderRadius: BorderRadius.circular(14),
                      dropdownColor: p.surface,
                      elevation: 4,
                      decoration: const InputDecoration(labelText: 'Năm', isDense: true),
                      items: [
                        const DropdownMenuItem<int?>(value: null, child: Text('Tất cả năm', overflow: TextOverflow.ellipsis)),
                        for (final y in years) DropdownMenuItem<int?>(value: y, child: Text('$y')),
                      ],
                      onChanged: (v) => setState(() {
                        _year = v;
                        _limit = 15;
                      }),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: DropdownButtonFormField<int?>(
                      initialValue: _month,
                      isExpanded: true,
                      borderRadius: BorderRadius.circular(14),
                      dropdownColor: p.surface,
                      elevation: 4,
                      menuMaxHeight: 300,
                      decoration: const InputDecoration(labelText: 'Tháng', isDense: true),
                      items: [
                        const DropdownMenuItem<int?>(value: null, child: Text('Tất cả tháng', overflow: TextOverflow.ellipsis)),
                        for (var m = 1; m <= 12; m++) DropdownMenuItem<int?>(value: m, child: Text('Tháng $m')),
                      ],
                      onChanged: (v) => setState(() {
                        _month = v;
                        _limit = 15;
                      }),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: DropdownButtonFormField<String?>(
                      initialValue: plans.contains(_planCode) ? _planCode : null,
                      isExpanded: true,
                      borderRadius: BorderRadius.circular(14),
                      dropdownColor: p.surface,
                      elevation: 4,
                      decoration: const InputDecoration(labelText: 'Gói', isDense: true),
                      items: [
                        const DropdownMenuItem<String?>(value: null, child: Text('Tất cả gói', overflow: TextOverflow.ellipsis)),
                        for (final c in plans) DropdownMenuItem<String?>(value: c, child: Text(_plan(c), overflow: TextOverflow.ellipsis)),
                      ],
                      onChanged: (v) => setState(() {
                        _planCode = v;
                        _limit = 15;
                      }),
                    ),
                  ),
                ],
              ),
              if (hasExtraFilters)
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: () => setState(() {
                      _year = null;
                      _month = null;
                      _planCode = null;
                      _limit = 15;
                    }),
                    child: const Text('Xóa bộ lọc'),
                  ),
                ),
              const SizedBox(height: 8),
              ChoiceRow<_Status>(
                selected: _status,
                onSelected: (s) => setState(() {
                  _status = s;
                  _limit = 15;
                }),
                options: [
                  (_Status.all, 'Tất cả', scoped.length),
                  (_Status.paid, 'Đã thanh toán', paid.length),
                  (_Status.failed, 'Thất bại', failed.length),
                  (_Status.pending, 'Đang chờ', pending.length),
                ],
              ),
              const SizedBox(height: 6),
              if (shown.isEmpty)
                const EmptyState(art: Art.billing, title: 'Không có giao dịch phù hợp')
              else ...[
                for (final entry in groups.entries) ...[
                  GroupLabel(entry.key,
                      trailing: Text(
                        compactVnd(entry.value.where((x) => x.paid).fold<int>(0, (s, x) => s + x.amount)),
                        style: TextStyle(color: p.muted, fontSize: 12, fontWeight: FontWeight.w700),
                      )),
                  Card(
                    clipBehavior: Clip.antiAlias,
                    child: Column(children: [
                      for (final x in entry.value) ...[
                        _PaymentTile(payment: x),
                        if (x != entry.value.last) const Divider(indent: 64),
                      ],
                    ]),
                  ),
                  const SizedBox(height: 6),
                ],
                if (remaining > 0)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: OutlinedButton.icon(
                      onPressed: () => setState(() => _limit += 20),
                      icon: const Icon(Icons.expand_more_rounded, size: 18),
                      label: Text('Xem thêm (còn $remaining giao dịch)'),
                    ),
                  )
                else if (filtered.length > 15)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: TextButton.icon(
                      onPressed: () => setState(() => _limit = 15),
                      icon: const Icon(Icons.expand_less_rounded, size: 18),
                      label: const Text('Thu gọn danh sách'),
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

(String, Tone) paymentStatus(Payment x) => x.paid
    ? ('Đã thanh toán', Tone.success)
    : x.failed
        ? ('Thất bại', Tone.danger)
        : ('Đang chờ', Tone.warning);

class _PaymentTile extends StatelessWidget {
  const _PaymentTile({required this.payment});
  final Payment payment;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final x = payment;
    final (label, tone) = paymentStatus(x);
    final c = toneColors(context, tone);
    return InkWell(
      onTap: () => _showPayment(context, x),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
        child: Row(children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(color: c.bg, borderRadius: BorderRadius.circular(12)),
            child: Icon(x.paid ? Icons.check_rounded : (x.failed ? Icons.close_rounded : Icons.hourglass_top_rounded),
                color: c.fg, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(x.schoolName, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 2),
              Text('${_plan(x.planCode)} · ${formatDateTime(x.createdAt)}',
                  maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: p.muted, fontSize: 12)),
            ]),
          ),
          const SizedBox(width: 8),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(compactVnd(x.amount),
                style: TextStyle(fontWeight: FontWeight.w700, color: x.paid ? p.ink : p.muted,
                    decoration: x.failed ? TextDecoration.lineThrough : null)),
            const SizedBox(height: 2),
            Text(label, style: TextStyle(color: c.fg, fontSize: 11, fontWeight: FontWeight.w600)),
          ]),
        ]),
      ),
    );
  }
}

String _plan(String code) => switch (code) {
      'STARTER' => 'Starter',
      'PROFESSIONAL' => 'Professional',
      'ENTERPRISE' => 'Enterprise',
      '' => 'Gói',
      _ => code,
    };

void _showPayment(BuildContext context, Payment x) {
  final (label, tone) = paymentStatus(x);
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (context) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Expanded(child: Text(formatVnd(x.amount), style: Theme.of(context).textTheme.headlineSmall)),
            Pill(label, tone: tone),
          ]),
          const SizedBox(height: 4),
          Text(x.schoolName, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          InfoRow(label: 'Gói', value: _plan(x.planCode)),
          if (x.purpose != null) InfoRow(label: 'Loại', value: x.purpose == 'RENEWAL' ? 'Gia hạn' : (x.purpose == 'UPGRADE' ? 'Nâng cấp' : x.purpose!)),
          if (x.managerEmail != null) InfoRow(label: 'Người thanh toán', value: x.managerEmail!),
          InfoRow(label: 'Tạo lúc', value: formatDateTime(x.createdAt)),
          InfoRow(label: 'Thanh toán lúc', value: x.paidAt == null ? '—' : formatDateTime(x.paidAt)),
          InfoRow(label: 'Mã giao dịch', value: x.id.split('-').first.toUpperCase()),
        ]),
      ),
    ),
  );
}
