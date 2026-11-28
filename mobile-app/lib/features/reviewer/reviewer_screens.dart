import 'package:flutter/material.dart';

import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../account/account_screens.dart';
import '../library/simulation_screen.dart';
import 'reviewer_topics_and_gaps_screen.dart';

class _ReviewerOverviewData {
  _ReviewerOverviewData(this.library, this.complaints, this.gaps, this.draftSchemas, this.openComplaints);
  final Json library, complaints, gaps;
  final int draftSchemas;
  final List<SupportItem> openComplaints;
}

/// MReviewer — Công việc kiểm duyệt (4 KPI, Ưu tiên xử lý, Tình hình tuần này).
class ReviewerHomeScreen extends StatelessWidget {
  const ReviewerHomeScreen({super.key, this.onOpenModeration, this.onOpenComplaints});
  final VoidCallback? onOpenModeration, onOpenComplaints;

  Future<_ReviewerOverviewData> _load(BuildContext context) async {
    final api = SessionScope.api(context);
    Future<Json> safeObj(String path) => api.get(path).then<Json>(asJson, onError: (_) => <String, dynamic>{});
    Future<List<Json>> safeList(String path) => api.get(path).then<List<Json>>(asJsonList, onError: (_) => const []);
    final results = await Future.wait([
      api.get('/reviewer/library/counts').then<Json>(asJson),
      safeObj('/support/complaints/counts'),
      safeObj('/reviewer/law-gaps/counts'),
      safeList('/schemas'),
      safeList('/support/complaints/review'),
    ]);
    final schemas = results[3] as List<Json>;
    final draftCount = schemas.where((s) => (asString(s['lifecycleStatus']) ?? '').toUpperCase() == 'DRAFT').length;
    final complaintsList = (results[4] as List<Json>)
        .map(SupportItem.new)
        .where((i) => !i.resolved)
        .toList()
      ..sort((a, b) => (a.createdAt ?? DateTime.now()).compareTo(b.createdAt ?? DateTime.now()));
    return _ReviewerOverviewData(results[0] as Json, results[1] as Json, results[2] as Json, draftCount, complaintsList);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      appBar: const RoleTopBar(subtitle: 'Kiểm duyệt'),
      body: Loader<_ReviewerOverviewData>(
        load: () => _load(context),
        skeleton: const SkeletonList(withStats: true, count: 3),
        builder: (context, data, reload) {
          final pending = asInt(data.library['PENDING']) ?? 0;
          final approved = asInt(data.library['APPROVED']) ?? 0;
          final rejected = asInt(data.library['REJECTED']) ?? 0;
          final open = (asInt(data.complaints['open']) ?? 0) + (asInt(data.complaints['read']) ?? 0);
          final resolvedComplaints = asInt(data.complaints['resolved']) ?? 0;
          final over48 = asInt(data.complaints['over48h']) ?? 0;
          final gapsOpen = asInt(data.gaps['OPEN']) ?? asInt(data.gaps['open']) ?? 0;
          final decided = approved + rejected;
          final totalComplaints = open + resolvedComplaints;

          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Công việc cần xử lý',
                            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                              color: p.brand,
                              letterSpacing: -0.4,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text('Ưu tiên nội dung đang chờ và báo lỗi.', style: TextStyle(color: p.muted, fontSize: 13)),
                        ],
                      ),
                    ),
                    const SizedBox(width: 10),
                    SizedBox(width: 70, height: 56, child: ArtImage(Art.validate)),
                  ],
                ),
                const SizedBox(height: 16),

                // 4 KPI Cards
                Pair(
                  StatTile(
                    label: 'Mô phỏng chờ duyệt',
                    value: '$pending',
                    detail: 'Công khai từ giáo viên',
                    icon: Icons.fact_check_rounded,
                    tint: pending > 0 ? p.amber : p.green,
                    onTap: onOpenModeration,
                  ),
                  StatTile(
                    label: 'Báo lỗi mô phỏng',
                    value: '$open',
                    detail: over48 > 0 ? '$over48 chờ quá 48 giờ' : 'Không có việc trễ',
                    icon: Icons.report_rounded,
                    tint: open > 0 ? p.rose : p.green,
                    onTap: onOpenComplaints,
                  ),
                ),
                const SizedBox(height: 10),
                Pair(
                  StatTile(
                    label: 'Định luật cần rà soát',
                    value: '$gapsOpen',
                    detail: 'Cần kiểm tra dữ liệu',
                    icon: Icons.functions_rounded,
                    tint: gapsOpen > 0 ? p.violet : p.teal,
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const ReviewerLawGapsScreen()),
                    ),
                  ),
                  StatTile(
                    label: 'Bản nháp chủ đề',
                    value: '${data.draftSchemas}',
                    detail: 'Chờ phê duyệt',
                    icon: Icons.science_outlined,
                    tint: p.blue,
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const ReviewerTopicsScreen(initialStatus: 'DRAFT')),
                    ),
                  ),
                ),
                const SizedBox(height: 14),

                // Ưu tiên xử lý
                Card(
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
                        child: Text('Ưu tiên xử lý', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                      ),
                      if (pending == 0 && data.openComplaints.isEmpty)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 6, 16, 16),
                          child: Text('Hiện không có mô phỏng hay báo lỗi nào đang chờ.', style: TextStyle(color: p.muted, fontSize: 13)),
                        )
                      else ...[
                        if (pending > 0) ...[
                          _PriorityTile(
                            icon: Icons.verified_user_outlined,
                            title: '$pending mô phỏng chờ duyệt',
                            subtitle: 'Kiểm tra nội dung trước khi công khai',
                            badge: '$pending',
                            badgeTone: Tone.warning,
                            onTap: onOpenModeration ?? () {},
                          ),
                          if (data.openComplaints.isNotEmpty) Divider(height: 1, indent: 68, color: p.line),
                        ],
                        if (data.openComplaints.isNotEmpty)
                          _PriorityTile(
                            icon: Icons.chat_bubble_outline_rounded,
                            title: data.openComplaints.first.subject,
                            subtitle: 'Giáo viên ${data.openComplaints.first.senderName}',
                            onTap: onOpenComplaints ?? () {},
                          ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 14),

                // Tình hình kiểm duyệt
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text('Tình hình kiểm duyệt', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(child: Text('Đã kiểm duyệt', style: TextStyle(color: p.muted, fontSize: 13))),
                            Text('${groupDigits(decided)} mô phỏng (${groupDigits(approved)} duyệt)', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                          ],
                        ),
                        const SizedBox(height: 6),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(99),
                          child: LinearProgressIndicator(
                            value: decided == 0 ? 0 : (approved / decided).clamp(0.0, 1.0),
                            minHeight: 7,
                            color: p.success,
                            backgroundColor: p.surface2,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(child: Text('Đã giải quyết báo lỗi', style: TextStyle(color: p.muted, fontSize: 13))),
                            Text('$resolvedComplaints / $totalComplaints báo lỗi', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                          ],
                        ),
                        const SizedBox(height: 6),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(99),
                          child: LinearProgressIndicator(
                            value: totalComplaints == 0 ? 1 : (resolvedComplaints / totalComplaints).clamp(0.0, 1.0),
                            minHeight: 7,
                            color: p.accent,
                            backgroundColor: p.surface2,
                          ),
                        ),
                      ],
                    ),
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

class _PriorityTile extends StatelessWidget {
  const _PriorityTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.badge,
    this.badgeTone = Tone.neutral,
  });
  final IconData icon;
  final String title, subtitle;
  final VoidCallback onTap;
  final String? badge;
  final Tone badgeTone;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
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
                  Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                  const SizedBox(height: 2),
                  Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: p.muted, fontSize: 12)),
                ],
              ),
            ),
            if (badge != null) ...[
              const SizedBox(width: 8),
              Pill(badge!, tone: badgeTone),
            ],
            const SizedBox(width: 4),
            Icon(Icons.chevron_right_rounded, color: p.muted, size: 20),
          ],
        ),
      ),
    );
  }
}

/// MReviewerModeration — Mô phỏng chờ duyệt.
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
      showDragHandle: true,
      builder: (_) => _ModerationSheet(item: item),
    );
    if (changed == true && mounted) setState(() => _reload++);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      appBar: const RoleTopBar(subtitle: 'Kiểm duyệt'),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(
              'Mô phỏng chờ duyệt',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontSize: 22, fontWeight: FontWeight.w800, color: p.brand),
            ),
            const SizedBox(height: 4),
            Text('Chạy thử và phê duyệt mô phỏng chia sẻ cộng đồng.', style: TextStyle(color: p.muted, fontSize: 13)),
            const SizedBox(height: 12),
            SearchBox(hint: 'Tìm theo tên, tác giả, trường...', onChanged: (v) => setState(() => _query = v)),
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

/// MReviewerComplaints & MReviewerComplaint — Báo lỗi mô phỏng (trả lời & chuyển thành định luật rà soát).
class ComplaintsScreen extends StatefulWidget {
  const ComplaintsScreen({super.key});

  @override
  State<ComplaintsScreen> createState() => _ComplaintsScreenState();
}

class _ComplaintsScreenState extends State<ComplaintsScreen> {
  int _view = 0;
  String _query = '';
  int _reload = 0;

  Future<List<SupportItem>> _load() async =>
      asJsonList(await SessionScope.api(context).get('/support/complaints/review')).map(SupportItem.new).toList()
        ..sort((a, b) => (b.createdAt ?? DateTime(0)).compareTo(a.createdAt ?? DateTime(0)));

  Future<void> _openComplaint(SupportItem item) async {
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _ComplaintReplySheet(item: item),
    );
    if (changed == true && mounted) setState(() => _reload++);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      appBar: const RoleTopBar(subtitle: 'Kiểm duyệt'),
      body: Loader<List<SupportItem>>(
        load: _load,
        reloadKey: _reload,
        builder: (context, items, reload) {
          final open = items.where((i) => !i.resolved).toList();
          final done = items.where((i) => i.resolved).toList();
          final query = _query.toLowerCase();
          final shown = [open, done][_view]
              .where((i) => query.isEmpty || '${i.subject} ${i.senderName} ${i.content}'.toLowerCase().contains(query))
              .toList();
          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 28), children: [
              Text(
                'Báo lỗi mô phỏng',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontSize: 22, fontWeight: FontWeight.w800, color: p.brand),
              ),
              const SizedBox(height: 4),
              Text('Phản hồi giáo viên hoặc chuyển sang định luật cần rà soát.', style: TextStyle(color: p.muted, fontSize: 13)),
              const SizedBox(height: 12),
              SearchBox(hint: 'Tìm theo tiêu đề, giáo viên, nội dung...', onChanged: (v) => setState(() => _query = v)),
              const SizedBox(height: 10),
              ChoiceRow<int>(
                selected: _view,
                onSelected: (v) => setState(() => _view = v),
                options: [(0, 'Cần xử lý', open.length), (1, 'Đã xong', done.length)],
              ),
              const SizedBox(height: 12),
              if (shown.isEmpty)
                EmptyState(art: _view == 0 ? Art.success : Art.empty,
                    title: _view == 0 ? 'Không còn báo lỗi cần xử lý' : 'Chưa có báo lỗi đã xong')
              else
                for (final i in shown) ...[
                  ListCard(
                    onTap: () => _openComplaint(i),
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
                      trailing: Icon(Icons.chevron_right_rounded, color: p.muted, size: 18),
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

class _ComplaintReplySheet extends StatefulWidget {
  const _ComplaintReplySheet({required this.item});
  final SupportItem item;

  @override
  State<_ComplaintReplySheet> createState() => _ComplaintReplySheetState();
}

class _ComplaintReplySheetState extends State<_ComplaintReplySheet> {
  late final _reply = TextEditingController(text: widget.item.response ?? '');
  bool _busy = false;

  @override
  void dispose() {
    _reply.dispose();
    super.dispose();
  }

  Future<void> _respond(String status) async {
    final text = _reply.text.trim();
    if (status == 'RESOLVED' && text.isEmpty) {
      showMessage(context, 'Nhập nội dung phản hồi trước khi đánh dấu đã xong.', error: true);
      return;
    }
    setState(() => _busy = true);
    try {
      await SessionScope.api(context).put('/support/complaints/review/${widget.item.id}', {
        'status': status,
        'adminResponse': text,
      });
      if (!mounted) return;
      Navigator.of(context).pop(true);
      showMessage(context, status == 'RESOLVED' ? 'Đã gửi phản hồi và hoàn tất.' : 'Đã cập nhật phản hồi.');
    } catch (error) {
      if (mounted) showMessage(context, errorText(error), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _escalate() async {
    setState(() => _busy = true);
    try {
      await SessionScope.api(context).post('/support/complaints/review/${widget.item.id}/escalate-law-gap', {});
      if (!mounted) return;
      Navigator.of(context).pop(true);
      showMessage(context, 'Đã chuyển sang danh sách Định luật cần rà soát.');
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
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(i.subject, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 4),
            Text('${i.senderName} · ${formatDateTime(i.createdAt)}', style: TextStyle(color: p.muted, fontSize: 13)),
            const SizedBox(height: 12),
            Section(title: 'Nội dung báo lỗi', icon: Icons.notes_rounded, child: SelectableText(i.content, style: const TextStyle(height: 1.45))),
            const SizedBox(height: 14),
            TextField(
              controller: _reply,
              enabled: !_busy && !i.resolved,
              minLines: 3,
              maxLines: 6,
              decoration: const InputDecoration(
                labelText: 'Phản hồi gửi giáo viên',
                hintText: 'Nhập giải thích hoặc kết quả xử lý...',
                alignLabelWithHint: true,
              ),
            ),
            if (!i.resolved) ...[
              const SizedBox(height: 12),
              FilledButton(
                onPressed: _busy ? null : () => _respond('RESOLVED'),
                child: _busy
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2.2))
                    : const Text('Gửi phản hồi & Đánh dấu đã xong'),
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: _busy ? null : _escalate,
                icon: const Icon(Icons.functions_rounded, size: 18),
                label: const Text('Chuyển thành định luật cần rà soát'),
              ),
            ],
          ]),
        ),
      ),
    );
  }
}

String _waited(DateTime from) {
  final d = DateTime.now().difference(from);
  return d.inDays >= 1 ? '${d.inDays} ngày' : '${d.inHours.clamp(1, 23)} giờ';
}
