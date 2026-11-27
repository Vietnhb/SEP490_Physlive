import 'package:flutter/material.dart';

import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../library/simulation_screen.dart';

class _Counts {
  _Counts(this.library, this.complaints, this.gaps);
  final Json library, complaints, gaps;
}

/// What waits for a physics reviewer: simulations to approve, complaints to answer, laws to look at.
class ReviewerHomeScreen extends StatelessWidget {
  const ReviewerHomeScreen({super.key, this.onOpenModeration, this.onOpenComplaints});
  final VoidCallback? onOpenModeration, onOpenComplaints;

  Future<_Counts> _load(BuildContext context) async {
    final api = SessionScope.api(context);
    Future<Json> safe(String path) => api.get(path).then<Json>(asJson, onError: (_) => <String, dynamic>{});
    final results = await Future.wait([
      api.get('/reviewer/library/counts').then<Json>(asJson),
      safe('/support/complaints/counts'),
      safe('/reviewer/law-gaps/counts'),
    ]);
    return _Counts(results[0], results[1], results[2]);
  }

  @override
  Widget build(BuildContext context) {
    final user = SessionScope.of(context).user!;
    return Scaffold(
      appBar: HeroBar(title: 'Việc cần làm', subtitle: 'Xin chào, ${user.fullName.split(' ').last}', art: Art.validate),
      body: Loader<_Counts>(
        load: () => _load(context),
        skeleton: const SkeletonList(withStats: true, count: 2),
        builder: (context, c, reload) {
          final p = context.palette;
          final pending = asInt(c.library['PENDING']) ?? 0;
          final approved = asInt(c.library['APPROVED']) ?? 0;
          final rejected = asInt(c.library['REJECTED']) ?? 0;
          final open = (asInt(c.complaints['open']) ?? 0) + (asInt(c.complaints['read']) ?? 0);
          final over48 = asInt(c.complaints['over48h']) ?? 0;
          final gapsOpen = asInt(c.gaps['OPEN']) ?? asInt(c.gaps['open']) ?? 0;
          final decided = approved + rejected;
          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 28), children: [
              Pair(
                StatTile(label: 'Mô phỏng chờ duyệt', value: '$pending', icon: Icons.fact_check_rounded,
                    tint: pending > 0 ? p.amber : p.green, detail: 'chia sẻ công khai', onTap: onOpenModeration),
                StatTile(label: 'Khiếu nại cần xử lý', value: '$open', icon: Icons.report_rounded,
                    tint: open > 0 ? p.rose : p.green, detail: over48 > 0 ? '$over48 chờ quá 48 giờ' : 'không có việc trễ',
                    onTap: onOpenComplaints),
              ),
              const SizedBox(height: 12),
              Section(
                title: 'Kết quả kiểm duyệt',
                icon: Icons.donut_large_rounded,
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  InfoRow(label: 'Đã duyệt', value: groupDigits(approved)),
                  InfoRow(label: 'Đã từ chối', value: groupDigits(rejected)),
                  if (decided > 0) ...[
                    const SizedBox(height: 6),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(99),
                      child: LinearProgressIndicator(value: approved / decided, minHeight: 8, color: p.success, backgroundColor: p.dangerSoft),
                    ),
                    const SizedBox(height: 6),
                    Text('Tỷ lệ đạt ${(approved / decided * 100).round()}%', style: TextStyle(color: p.muted, fontSize: 12)),
                  ],
                ]),
              ),
              const SizedBox(height: 12),
              ListCard(
                leading: Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(color: p.violet.bg, borderRadius: BorderRadius.circular(12)),
                  child: Icon(Icons.functions_rounded, color: p.violet.fg),
                ),
                title: '$gapsOpen định luật cần rà soát',
                subtitle: 'Đại lượng mô phỏng chưa có định luật đối chiếu. Biên soạn trên bản web.',
              ),
            ]),
          );
        },
      ),
    );
  }
}

/// The public simulations waiting for a decision: search, preview, approve or reject with a reason.
class ModerationScreen extends StatefulWidget {
  const ModerationScreen({super.key});

  @override
  State<ModerationScreen> createState() => _ModerationScreenState();
}

class _ModerationScreenState extends State<ModerationScreen> {
  String _status = 'PENDING';
  String _query = '';
  int _reload = 0;

  Future<List<Json>> _load() async {
    final items = asJsonList(await SessionScope.api(context).get('/reviewer/library', query: {'status': _status}));
    items.sort((a, b) => (asDate(a['createdAt']) ?? DateTime(0)).compareTo(asDate(b['createdAt']) ?? DateTime(0)));
    return items;
  }

  Future<void> _open(Json item) async {
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _ModerationSheet(item: item),
    );
    if (changed == true && mounted) setState(() => _reload++);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      appBar: const HeroBar(title: 'Duyệt mô phỏng', subtitle: 'Kiểm duyệt nội dung', art: Art.community),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
          child: Column(children: [
            SearchBox(hint: 'Tìm theo tên, tác giả, trường', onChanged: (v) => setState(() => _query = v)),
            const SizedBox(height: 10),
            ChoiceRow<String>(
              selected: _status,
              onSelected: (s) => setState(() {
                _status = s;
                _reload++;
              }),
              options: const [('PENDING', 'Chờ duyệt', null), ('APPROVED', 'Đã duyệt', null), ('REJECTED', 'Đã từ chối', null)],
            ),
          ]),
        ),
        Expanded(
          child: Loader<List<Json>>(
            load: _load,
            reloadKey: _reload,
            builder: (context, items, reload) {
              final query = _query.toLowerCase();
              final shown = items
                  .where((i) => query.isEmpty ||
                      '${asString(i['title']) ?? ''} ${asString(i['sharedByName']) ?? ''} ${asString(i['schoolName']) ?? ''}'
                          .toLowerCase()
                          .contains(query))
                  .toList();
              return RefreshIndicator(
                onRefresh: reload,
                child: ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 28), children: [
                  if (shown.isEmpty)
                    EmptyState(
                      art: _status == 'PENDING' && query.isEmpty ? Art.success : Art.empty,
                      title: query.isNotEmpty
                          ? 'Không có mô phỏng nào khớp "$_query"'
                          : (_status == 'PENDING' ? 'Đã duyệt hết mô phỏng' : 'Chưa có mô phỏng nào'),
                    )
                  else
                    for (final i in shown) ...[
                      ListCard(
                        onTap: () => _open(i),
                        leading: Container(
                          width: 52,
                          height: 52,
                          padding: const EdgeInsets.all(4),
                          decoration: BoxDecoration(color: p.surface2, borderRadius: BorderRadius.circular(14)),
                          child: ArtImage(Art.forSimulation(asString(i['topic']), asString(i['title']) ?? '')),
                        ),
                        title: asString(i['title']) ?? 'Mô phỏng',
                        subtitle: [asString(i['sharedByName']), asString(i['schoolName'])].whereType<String>().join(' · '),
                        trailing: _statusPill(asString(i['moderationStatus'])),
                        footer: MetaLine(
                          icon: Icons.schedule_rounded,
                          text: 'Gửi ${formatDateTime(asDate(i['createdAt']))}'
                              '${asString(i['assignedToName']) == null ? '' : ' · ${asString(i['assignedToName'])} đang xử lý'}',
                          trailing: Icon(Icons.chevron_right_rounded, color: p.muted, size: 20),
                        ),
                      ),
                      const SizedBox(height: 10),
                    ],
                ]),
              );
            },
          ),
        ),
      ]),
    );
  }
}

Pill _statusPill(String? status) => switch (status) {
      'APPROVED' => const Pill('Đã duyệt', tone: Tone.success),
      'REJECTED' => const Pill('Từ chối', tone: Tone.danger),
      _ => const Pill('Chờ duyệt', tone: Tone.warning),
    };

class _ModerationSheet extends StatefulWidget {
  const _ModerationSheet({required this.item});
  final Json item;

  @override
  State<_ModerationSheet> createState() => _ModerationSheetState();
}

class _ModerationSheetState extends State<_ModerationSheet> {
  final _comment = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  Future<void> _decide(String status) async {
    final comment = _comment.text.trim();
    if (status == 'REJECTED' && comment.isEmpty) {
      showMessage(context, 'Cần nhập lý do khi từ chối.', error: true);
      return;
    }
    final ok = await confirm(
      context,
      title: status == 'APPROVED' ? 'Duyệt mô phỏng?' : 'Từ chối mô phỏng?',
      message: status == 'APPROVED'
          ? 'Mô phỏng sẽ hiện trong kho cộng đồng cho mọi trường.'
          : 'Tác giả sẽ nhận được lý do và mô phỏng không được công khai.',
      action: status == 'APPROVED' ? 'Duyệt' : 'Từ chối',
      danger: status == 'REJECTED',
    );
    if (!ok || !mounted) return;
    setState(() => _busy = true);
    try {
      await SessionScope.api(context).put('/reviewer/library/${asString(widget.item['id'])}', {
        'status': status,
        if (comment.isNotEmpty) 'comment': comment,
        'expectedStatus': asString(widget.item['moderationStatus']) ?? 'PENDING',
      });
      if (!mounted) return;
      Navigator.of(context).pop(true);
      showMessage(context, status == 'APPROVED' ? 'Đã duyệt mô phỏng.' : 'Đã từ chối mô phỏng.');
    } catch (error) {
      if (mounted) showMessage(context, errorText(error), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final i = widget.item;
    final pending = (asString(i['moderationStatus']) ?? 'PENDING') == 'PENDING';
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(asString(i['title']) ?? 'Mô phỏng',
                maxLines: 3, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontSize: 17)),
            const SizedBox(height: 8),
            Wrap(spacing: 6, children: [_statusPill(asString(i['moderationStatus']))]),
            const SizedBox(height: 6),
            if (asString(i['sharedByName']) != null) InfoRow(label: 'Tác giả', value: asString(i['sharedByName'])!),
            if (asString(i['schoolName']) != null) InfoRow(label: 'Trường', value: asString(i['schoolName'])!),
            InfoRow(label: 'Gửi lúc', value: formatDateTime(asDate(i['createdAt']))),
            if ((asString(i['moderationComment']) ?? '').isNotEmpty)
              InfoRow(label: 'Nhận xét', value: asString(i['moderationComment'])!, strong: false),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: () => Navigator.of(context)
                  .push(MaterialPageRoute(builder: (_) => SimulationScreen(item: LibraryItem(i)))),
              icon: const Icon(Icons.play_circle_outline_rounded),
              label: const Text('Xem và chạy thử mô phỏng'),
            ),
            if (pending) ...[
              const SizedBox(height: 14),
              TextField(
                controller: _comment,
                enabled: !_busy,
                minLines: 2,
                maxLines: 5,
                maxLength: 4000,
                decoration: const InputDecoration(hintText: 'Nhận xét cho tác giả (bắt buộc khi từ chối)'),
              ),
              const SizedBox(height: 6),
              Row(children: [
                Expanded(
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(foregroundColor: p.danger, side: BorderSide(color: p.danger.withValues(alpha: 0.4))),
                    onPressed: _busy ? null : () => _decide('REJECTED'),
                    child: const Text('Từ chối'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton(
                    onPressed: _busy ? null : () => _decide('APPROVED'),
                    child: const Text('Duyệt'),
                  ),
                ),
              ]),
            ],
          ]),
        ),
      ),
    );
  }
}

/// Teachers' complaints about simulations: what is open, how long it has waited, and what was answered.
class ComplaintsScreen extends StatefulWidget {
  const ComplaintsScreen({super.key});

  @override
  State<ComplaintsScreen> createState() => _ComplaintsScreenState();
}

class _ComplaintsScreenState extends State<ComplaintsScreen> {
  int _view = 0;
  String _query = '';

  Future<List<SupportItem>> _load() async =>
      asJsonList(await SessionScope.api(context).get('/support/complaints/review')).map(SupportItem.new).toList()
        ..sort((a, b) => (b.createdAt ?? DateTime(0)).compareTo(a.createdAt ?? DateTime(0)));

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      appBar: const HeroBar(title: 'Khiếu nại', subtitle: 'Từ giáo viên', art: Art.complaint),
      body: Loader<List<SupportItem>>(
        load: _load,
        builder: (context, items, reload) {
          final open = items.where((i) => !i.resolved).toList();
          final done = items.where((i) => i.resolved).toList();
          final query = _query.toLowerCase();
          final shown = [open, done][_view]
              .where((i) => query.isEmpty || '${i.subject} ${i.senderName} ${i.content}'.toLowerCase().contains(query))
              .toList();
          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(padding: const EdgeInsets.fromLTRB(16, 14, 16, 28), children: [
              SearchBox(hint: 'Tìm theo tiêu đề, giáo viên, nội dung', onChanged: (v) => setState(() => _query = v)),
              const SizedBox(height: 10),
              ChoiceRow<int>(
                selected: _view,
                onSelected: (v) => setState(() => _view = v),
                options: [(0, 'Cần xử lý', open.length), (1, 'Đã xong', done.length)],
              ),
              const SizedBox(height: 12),
              if (shown.isEmpty)
                EmptyState(art: _view == 0 ? Art.success : Art.empty,
                    title: _view == 0 ? 'Không còn khiếu nại cần xử lý' : 'Chưa có khiếu nại đã xong')
              else
                for (final i in shown) ...[
                  ListCard(
                    onTap: () => _showComplaint(context, i),
                    leading: Avatar(name: i.senderName, size: 40),
                    title: i.subject,
                    subtitle: i.senderName,
                    trailing: Pill(i.statusLabel,
                        tone: i.resolved ? Tone.success : (i.status == 'OPEN' ? Tone.warning : Tone.info)),
                    footer: MetaLine(
                      icon: Icons.schedule_rounded,
                      text: i.resolved || i.createdAt == null
                          ? formatDateTime(i.createdAt)
                          : '${formatDateTime(i.createdAt)} · chờ ${_waited(i.createdAt!)}',
                      color: !i.resolved && i.createdAt != null && DateTime.now().difference(i.createdAt!).inHours >= 48
                          ? p.danger
                          : null,
                    ),
                  ),
                  const SizedBox(height: 10),
                ],
              const SizedBox(height: 8),
              Text('Trả lời, chuyển thành định luật cần rà soát và xử lý chi tiết trên bản web.',
                  textAlign: TextAlign.center, style: TextStyle(color: p.muted, fontSize: 12)),
            ]),
          );
        },
      ),
    );
  }
}

String _waited(DateTime from) {
  final d = DateTime.now().difference(from);
  return d.inDays >= 1 ? '${d.inDays} ngày' : '${d.inHours.clamp(1, 23)} giờ';
}

void _showComplaint(BuildContext context, SupportItem i) {
  final p = context.palette;
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (context) => SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(i.subject, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 4),
          Text('${i.senderName} · ${formatDateTime(i.createdAt)}', style: TextStyle(color: p.muted, fontSize: 13)),
          const SizedBox(height: 12),
          Section(title: 'Nội dung', icon: Icons.notes_rounded, child: SelectableText(i.content, style: const TextStyle(height: 1.45))),
          if ((i.response ?? '').isNotEmpty) ...[
            const SizedBox(height: 10),
            Section(title: 'Đã trả lời', icon: Icons.reply_rounded, child: Text(i.response!, style: const TextStyle(height: 1.45))),
          ],
        ]),
      ),
    ),
  );
}
