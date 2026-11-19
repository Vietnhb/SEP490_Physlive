import 'package:flutter/material.dart';

import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';

/// The operations team's support inbox: feedback and messages to answer, simulation complaints to read.
class ManagerSupportScreen extends StatefulWidget {
  const ManagerSupportScreen({super.key});

  @override
  State<ManagerSupportScreen> createState() => _ManagerSupportScreenState();
}

class _ManagerSupportScreenState extends State<ManagerSupportScreen> {
  int _reload = 0;
  /// 0 = to handle, 1 = done, 2 = simulation complaints (reviewers handle them; read-only here).
  int _view = 0;

  Future<List<SupportItem>> _load() async =>
      asJsonList(await SessionScope.api(context).get('/support/admin')).map(SupportItem.new).toList();

  Future<void> _open(SupportItem item) async {
    final changed = await Navigator.of(context)
        .push<bool>(MaterialPageRoute(builder: (_) => ManagerSupportDetailScreen(item: item)));
    if (changed == true && mounted) setState(() => _reload++);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Yêu cầu hỗ trợ')),
      body: Loader<List<SupportItem>>(
        load: _load,
        reloadKey: _reload,
        builder: (context, items, reload) {
          final requests = items.where((item) => !item.isComplaint);
          final todo = requests.where((item) => !item.resolved).toList();
          final done = requests.where((item) => item.resolved).toList();
          final complaints = items.where((item) => item.isComplaint).toList();
          final shown = [todo, done, complaints][_view];
          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 24), children: [
              SegmentedButton<int>(
                showSelectedIcon: false,
                segments: [
                  ButtonSegment(value: 0, label: Text('Cần xử lý (${todo.length})')),
                  ButtonSegment(value: 1, label: Text('Đã xong (${done.length})')),
                  ButtonSegment(value: 2, label: Text('Báo lỗi (${complaints.length})')),
                ],
                selected: {_view},
                onSelectionChanged: (value) => setState(() => _view = value.first),
              ),
              if (_view == 2)
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Text('Báo lỗi mô phỏng do người kiểm duyệt xử lý; bạn chỉ theo dõi.',
                      style: TextStyle(color: context.palette.muted, fontSize: 13)),
                ),
              const SizedBox(height: 14),
              if (shown.isEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 40),
                  child: EmptyState(
                    icon: Icons.inbox_outlined,
                    title: const ['Không còn yêu cầu nào cần xử lý', 'Chưa có yêu cầu nào đã xong', 'Chưa có báo lỗi mô phỏng'][_view],
                  ),
                )
              else
                for (final item in shown) ...[
                  _SupportCard(item: item, onTap: () => _open(item)),
                  const SizedBox(height: 10),
                ],
            ]),
          );
        },
      ),
    );
  }
}

Tone _statusTone(SupportItem item) => switch (item.status) {
      'OPEN' => Tone.warning,
      'READ' => Tone.accent,
      'RESOLVED' => Tone.success,
      _ => Tone.neutral,
    };

class _SupportCard extends StatelessWidget {
  const _SupportCard({required this.item, required this.onTap});
  final SupportItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(
                child: Text(item.subject,
                    maxLines: 2, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.titleMedium),
              ),
              const SizedBox(width: 8),
              Pill(item.statusLabel, tone: _statusTone(item)),
            ]),
            const SizedBox(height: 4),
            Text('${item.kindLabel} · ${item.senderName}', style: TextStyle(color: p.muted, fontSize: 13)),
            const SizedBox(height: 8),
            Row(children: [
              Icon(Icons.schedule_rounded, size: 16, color: p.muted),
              const SizedBox(width: 6),
              Text(formatDateTime(item.createdAt), style: TextStyle(color: p.muted, fontSize: 13)),
              const Spacer(),
              Icon(Icons.chevron_right_rounded, color: p.muted),
            ]),
          ]),
        ),
      ),
    );
  }
}

/// One request: read it, answer it, mark it in progress or done. Complaints are read-only here.
class ManagerSupportDetailScreen extends StatefulWidget {
  const ManagerSupportDetailScreen({super.key, required this.item});
  final SupportItem item;

  @override
  State<ManagerSupportDetailScreen> createState() => _ManagerSupportDetailScreenState();
}

class _ManagerSupportDetailScreenState extends State<ManagerSupportDetailScreen> {
  late SupportItem _item = widget.item;
  late final TextEditingController _reply = TextEditingController(text: widget.item.response ?? '');
  bool _busy = false;
  bool _changed = false;

  @override
  void dispose() {
    _reply.dispose();
    super.dispose();
  }

  Future<void> _save(String status) async {
    final reply = _reply.text.trim();
    if (status == 'RESOLVED' && reply.isEmpty) {
      showMessage(context, 'Cần nhập phản hồi trước khi hoàn tất yêu cầu.', error: true);
      return;
    }
    setState(() => _busy = true);
    try {
      final data = await SessionScope.api(context)
          .put('/support/admin/${_item.id}', {'status': status, if (reply.isNotEmpty) 'response': reply});
      if (!mounted) return;
      setState(() {
        _item = SupportItem(asJson(data));
        _changed = true;
      });
      showMessage(context, status == 'RESOLVED' ? 'Đã hoàn tất yêu cầu.' : 'Đã lưu phản hồi.');
    } catch (error) {
      if (mounted) showMessage(context, errorText(error), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final item = _item;
    // Leaving (back button or gesture) tells the list whether to reload.
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && !_busy) Navigator.of(context).pop(_changed);
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(item.kindLabel),
          leading: BackButton(onPressed: _busy ? null : () => Navigator.of(context).pop(_changed)),
        ),
        body: ListView(padding: const EdgeInsets.fromLTRB(16, 8, 16, 24), children: [
          Row(children: [
            Expanded(child: Text(item.subject, style: Theme.of(context).textTheme.titleLarge)),
            const SizedBox(width: 8),
            Pill(item.statusLabel, tone: _statusTone(item)),
          ]),
          const SizedBox(height: 6),
          Text('${item.senderName} · ${item.senderEmail}', style: TextStyle(color: p.muted)),
          Text('Gửi lúc ${formatDateTime(item.createdAt)}', style: TextStyle(color: p.muted, fontSize: 13)),
          const SizedBox(height: 14),
          Section(
            title: 'Nội dung',
            icon: Icons.notes_rounded,
            child: SelectableText(item.content, style: const TextStyle(height: 1.45)),
          ),
          const SizedBox(height: 12),
          if (item.isComplaint)
            Section(
              title: 'Người kiểm duyệt xử lý',
              icon: Icons.fact_check_rounded,
              child: Text(
                item.response?.trim().isNotEmpty == true
                    ? item.response!
                    : 'Báo lỗi mô phỏng được chuyển thẳng cho người kiểm duyệt. Bộ phận vận hành chỉ theo dõi.',
                style: TextStyle(color: p.muted, height: 1.4),
              ),
            )
          else
            Section(
              title: 'Phản hồi',
              icon: Icons.reply_rounded,
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                if (item.respondedAt != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text('${item.responderName ?? 'Đã trả lời'} · ${formatDateTime(item.respondedAt)}',
                        style: TextStyle(color: p.muted, fontSize: 12)),
                  ),
                TextField(
                  controller: _reply,
                  enabled: !_busy,
                  minLines: 3,
                  maxLines: 8,
                  maxLength: 10000,
                  decoration: const InputDecoration(hintText: 'Nhập phản hồi gửi người dùng…'),
                ),
                const SizedBox(height: 8),
                Row(children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _busy ? null : () => _save('READ'),
                      child: Text(item.resolved ? 'Mở lại' : 'Lưu phản hồi'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton(
                      onPressed: _busy || item.resolved ? null : () => _save('RESOLVED'),
                      child: _busy
                          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Text('Hoàn tất'),
                    ),
                  ),
                ]),
              ]),
            ),
        ]),
      ),
    );
  }
}
