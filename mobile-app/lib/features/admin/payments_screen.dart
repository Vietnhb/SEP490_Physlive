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
        builder: (context, items, reload) {
          final paid = items.where((x) => x.paid).toList();
          final failed = items.where((x) => x.failed).toList();
          final pending = items.where((x) => !x.paid && !x.failed).toList();
          final query = _query.toLowerCase();
          final shown = switch (_status) {
            _Status.all => items,
            _Status.paid => paid,
            _Status.failed => failed,
            _Status.pending => pending,
          }
              .where((x) => query.isEmpty ||
                  '${x.schoolName} ${x.managerEmail ?? ''} ${x.planCode}'.toLowerCase().contains(query))
              .toList();
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
              const SizedBox(height: 14),
              SearchBox(hint: 'Tìm theo trường, email, gói', onChanged: (v) => setState(() => _query = v)),
              const SizedBox(height: 10),
              ChoiceRow<_Status>(
                selected: _status,
                onSelected: (s) => setState(() => _status = s),
                options: [
                  (_Status.all, 'Tất cả', items.length),
                  (_Status.paid, 'Đã thanh toán', paid.length),
                  (_Status.failed, 'Thất bại', failed.length),
                  (_Status.pending, 'Đang chờ', pending.length),
                ],
              ),
              const SizedBox(height: 6),
              if (shown.isEmpty)
                const EmptyState(art: Art.billing, title: 'Không có giao dịch phù hợp')
              else
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
