import 'package:flutter/material.dart';

import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../account/account_screens.dart';

/// MReviewerMore — Tab "Thêm" cho Kiểm duyệt.
class ReviewerMoreScreen extends StatelessWidget {
  const ReviewerMoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      appBar: const RoleTopBar(subtitle: 'Kiểm duyệt'),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 18, 16, 28),
        children: [
          Text(
            'Không gian kiểm duyệt',
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
                  icon: Icons.science_outlined,
                  title: 'Chủ đề vật lý',
                  subtitle: 'Phiên bản đang dùng, bản nháp và ngừng dùng',
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const ReviewerTopicsScreen()),
                  ),
                ),
                Divider(height: 1, indent: 68, color: p.line),
                _MoreTile(
                  icon: Icons.functions_rounded,
                  title: 'Định luật cần rà soát',
                  subtitle: 'Các trường hợp mô phỏng chưa có định luật đối chiếu',
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const ReviewerLawGapsScreen()),
                  ),
                ),
                Divider(height: 1, indent: 68, color: p.line),
                _MoreTile(
                  icon: Icons.history_rounded,
                  title: 'Lịch sử kiểm duyệt',
                  subtitle: 'Toàn bộ phiên bản chủ đề theo thời gian cập nhật',
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const ReviewerTopicsScreen(initialStatus: 'HISTORY')),
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

/// MReviewerTopics & MReviewerTopic — Chủ đề vật lý (Đang dùng, Bản nháp, Ngừng dùng).
class ReviewerTopicsScreen extends StatefulWidget {
  const ReviewerTopicsScreen({super.key, this.initialStatus = 'APPROVED'});
  final String initialStatus;

  @override
  State<ReviewerTopicsScreen> createState() => _ReviewerTopicsScreenState();
}

class _ReviewerTopicsScreenState extends State<ReviewerTopicsScreen> {
  late String _status = widget.initialStatus;
  String _query = '';
  int _reload = 0;

  Future<List<Json>> _load() async =>
      asJsonList(await SessionScope.api(context).get('/schemas'));

  Future<void> _openTopic(Json schema) async {
    final p = context.palette;
    final id = asString(schema['schemaId']) ?? asString(schema['id']) ?? '';
    final status = (asString(schema['lifecycleStatus']) ?? 'DRAFT').toUpperCase();
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
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
                  Expanded(
                    child: Text(
                      asString(schema['name']) ?? asString(schema['topic']) ?? id,
                      style: Theme.of(ctx).textTheme.titleLarge,
                    ),
                  ),
                  _lifecyclePill(status),
                ],
              ),
              const SizedBox(height: 8),
              InfoRow(label: 'Mã chủ đề', value: asString(schema['topic']) ?? '—'),
              InfoRow(label: 'Phiên bản', value: asString(schema['version']) ?? '1.0'),
              if ((asString(schema['description']) ?? '').isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(asString(schema['description'])!, style: TextStyle(color: p.muted, height: 1.45)),
              ],
              const SizedBox(height: 16),
              if (status == 'DRAFT')
                FilledButton.icon(
                  onPressed: () async {
                    try {
                      await SessionScope.api(context).put('/schemas/$id/lifecycle?status=APPROVED');
                      if (ctx.mounted) Navigator.of(ctx).pop(true);
                    } catch (e) {
                      if (ctx.mounted) showMessage(ctx, errorText(e), error: true);
                    }
                  },
                  icon: const Icon(Icons.check_circle_outline_rounded, size: 18),
                  label: const Text('Phê duyệt đưa vào sử dụng'),
                )
              else if (status == 'APPROVED')
                OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(foregroundColor: p.danger, side: BorderSide(color: p.danger.withValues(alpha: 0.4))),
                  onPressed: () async {
                    try {
                      await SessionScope.api(context).put('/schemas/$id/lifecycle?status=DEPRECATED');
                      if (ctx.mounted) Navigator.of(ctx).pop(true);
                    } catch (e) {
                      if (ctx.mounted) showMessage(ctx, errorText(e), error: true);
                    }
                  },
                  icon: const Icon(Icons.archive_outlined, size: 18),
                  label: const Text('Ngừng sử dụng phiên bản này'),
                ),
            ],
          ),
        ),
      ),
    );
    if (changed == true && mounted) {
      showMessage(context, 'Đã cập nhật trạng thái chủ đề.');
      setState(() => _reload++);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      appBar: const RoleTopBar(subtitle: 'Kiểm duyệt', showBack: true),
      body: Loader<List<Json>>(
        load: _load,
        reloadKey: _reload,
        builder: (context, items, reload) {
          String st(Json s) => (asString(s['lifecycleStatus']) ?? 'DRAFT').toUpperCase();
          final approved = items.where((s) => st(s) == 'APPROVED').toList();
          final draft = items.where((s) => st(s) == 'DRAFT').toList();
          final deprecated = items.where((s) => st(s) == 'DEPRECATED').toList();
          final history = [...items]..sort((a, b) {
              final da = asDate(a['updatedAt']) ?? asDate(a['createdAt']) ?? DateTime.fromMillisecondsSinceEpoch(0);
              final db = asDate(b['updatedAt']) ?? asDate(b['createdAt']) ?? DateTime.fromMillisecondsSinceEpoch(0);
              return db.compareTo(da);
            });
          final q = _query.toLowerCase();
          final shown = switch (_status) {
            'DRAFT' => draft,
            'DEPRECATED' => deprecated,
            'HISTORY' => history,
            _ => approved,
          }.where((s) => q.isEmpty || '${asString(s['name']) ?? ''} ${asString(s['topic']) ?? ''}'.toLowerCase().contains(q)).toList();

          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
              children: [
                Text(
                  _status == 'HISTORY' ? 'Lịch sử kiểm duyệt' : 'Chủ đề vật lý',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontSize: 22, fontWeight: FontWeight.w800, color: p.brand),
                ),
                const SizedBox(height: 4),
                Text(
                  _status == 'HISTORY'
                      ? 'Toàn bộ phiên bản chủ đề sắp xếp theo thời gian cập nhật mới nhất.'
                      : 'Chỉ một phiên bản đang dùng cho mỗi chủ đề.',
                  style: TextStyle(color: p.muted, fontSize: 13),
                ),
                const SizedBox(height: 12),
                SearchBox(hint: 'Tìm chủ đề...', onChanged: (v) => setState(() => _query = v)),
                const SizedBox(height: 10),
                ChoiceRow<String>(
                  selected: _status,
                  onSelected: (v) => setState(() => _status = v),
                  options: [
                    ('APPROVED', 'Đang dùng', approved.length),
                    ('DRAFT', 'Bản nháp', draft.length),
                    ('DEPRECATED', 'Ngừng dùng', deprecated.length),
                    ('HISTORY', 'Lịch sử', history.length),
                  ],
                ),
                const SizedBox(height: 12),
                if (shown.isEmpty)
                  const EmptyState(art: Art.library, title: 'Không có chủ đề nào trong mục này')
                else
                  Card(
                    clipBehavior: Clip.antiAlias,
                    child: Column(
                      children: [
                        for (var i = 0; i < shown.length; i++) ...[
                          if (i > 0) Divider(height: 1, indent: 68, color: p.line),
                          ListTile(
                            onTap: () => _openTopic(shown[i]),
                            leading: Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(color: p.blue.bg, shape: BoxShape.circle),
                              child: Icon(Icons.science_outlined, color: p.blue.fg, size: 20),
                            ),
                            title: Text(
                              asString(shown[i]['name']) ?? asString(shown[i]['topic']) ?? 'Chủ đề',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontWeight: FontWeight.w600),
                            ),
                            subtitle: Text(
                              '${asString(shown[i]['topic']) ?? ''} · v${asString(shown[i]['version']) ?? '1.0'}',
                              style: TextStyle(color: p.muted, fontSize: 12),
                            ),
                            trailing: _lifecyclePill(st(shown[i])),
                          ),
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

Pill _lifecyclePill(String status) => switch (status) {
      'APPROVED' => const Pill('Đang dùng', tone: Tone.success),
      'DRAFT' => const Pill('Bản nháp', tone: Tone.warning),
      _ => const Pill('Ngừng dùng'),
    };

/// MReviewerGaps — Định luật cần rà soát.
class ReviewerLawGapsScreen extends StatefulWidget {
  const ReviewerLawGapsScreen({super.key});

  @override
  State<ReviewerLawGapsScreen> createState() => _ReviewerLawGapsScreenState();
}

class _ReviewerLawGapsScreenState extends State<ReviewerLawGapsScreen> {
  String _status = 'OPEN';
  String _query = '';
  int _reload = 0;

  Future<List<Json>> _load() async =>
      asJsonList(await SessionScope.api(context).get('/reviewer/law-gaps', query: {'status': _status}));

  Future<void> _openGap(Json gap) async {
    final note = TextEditingController(text: asString(gap['note']) ?? '');
    final p = context.palette;
    final id = asString(gap['id']) ?? '';
    final status = (asString(gap['status']) ?? 'OPEN').toUpperCase();
    final changed = await showModalBottomSheet<bool>(
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
              Text(
                asString(gap['label']) ?? asString(gap['role']) ?? 'Định luật cần rà soát',
                style: Theme.of(ctx).textTheme.titleLarge,
              ),
              const SizedBox(height: 6),
              Text(
                '${asString(gap['topic']) ?? 'Vật lý'} · ${gap['occurrences'] ?? 1} lượt chạy liên quan',
                style: TextStyle(color: p.muted, fontSize: 13),
              ),
              if ((asString(gap['exampleDescription']) ?? '').isNotEmpty) ...[
                const SizedBox(height: 12),
                Text('Ví dụ đề bài', style: TextStyle(color: p.muted, fontSize: 12, fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                Text(asString(gap['exampleDescription'])!, style: const TextStyle(height: 1.45)),
              ],
              if ((asString(gap['exampleFormula']) ?? '').isNotEmpty) ...[
                const SizedBox(height: 10),
                Text('Công thức', style: TextStyle(color: p.muted, fontSize: 12, fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                Text(asString(gap['exampleFormula'])!, style: const TextStyle(fontFamily: 'monospace')),
              ],
              if (status == 'OPEN') ...[
                const SizedBox(height: 14),
                TextField(
                  controller: note,
                  minLines: 2,
                  maxLines: 4,
                  decoration: const InputDecoration(
                    labelText: 'Hướng xử lý / Ghi chú',
                    hintText: 'Bổ sung định luật hoặc phản hồi trường hợp...',
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () async {
                          try {
                            await SessionScope.api(context).put('/reviewer/law-gaps/$id', {
                              'status': 'DISMISSED',
                              'note': note.text.trim(),
                            });
                            if (ctx.mounted) Navigator.of(ctx).pop(true);
                          } catch (e) {
                            if (ctx.mounted) showMessage(ctx, errorText(e), error: true);
                          }
                        },
                        child: const Text('Bỏ qua'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: FilledButton(
                        onPressed: () async {
                          try {
                            await SessionScope.api(context).put('/reviewer/law-gaps/$id', {
                              'status': 'RESOLVED',
                              'note': note.text.trim(),
                            });
                            if (ctx.mounted) Navigator.of(ctx).pop(true);
                          } catch (e) {
                            if (ctx.mounted) showMessage(ctx, errorText(e), error: true);
                          }
                        },
                        child: const Text('Lưu đã xử lý'),
                      ),
                    ),
                  ],
                ),
              ] else if ((asString(gap['note']) ?? '').isNotEmpty) ...[
                const SizedBox(height: 12),
                InfoRow(label: 'Ghi chú xử lý', value: asString(gap['note'])!, strong: false),
              ],
            ],
          ),
        ),
      ),
    );
    note.dispose();
    if (changed == true && mounted) {
      showMessage(context, 'Đã lưu kết quả rà soát.');
      setState(() => _reload++);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      appBar: const RoleTopBar(subtitle: 'Kiểm duyệt', showBack: true),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Định luật cần rà soát',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontSize: 22, fontWeight: FontWeight.w800, color: p.brand),
                ),
                const SizedBox(height: 4),
                Text('Các trường hợp chưa thể xác minh tự động.', style: TextStyle(color: p.muted, fontSize: 13)),
                const SizedBox(height: 12),
                SearchBox(hint: 'Tìm chủ đề, đại lượng...', onChanged: (v) => setState(() => _query = v)),
                const SizedBox(height: 10),
                ChoiceRow<String>(
                  selected: _status,
                  onSelected: (v) => setState(() {
                    _status = v;
                    _reload++;
                  }),
                  options: const [
                    ('OPEN', 'Cần kiểm tra', null),
                    ('RESOLVED', 'Đã xử lý', null),
                    ('DISMISSED', 'Bỏ qua', null),
                  ],
                ),
              ],
            ),
          ),
          Expanded(
            child: Loader<List<Json>>(
              load: _load,
              reloadKey: _reload,
              builder: (context, items, reload) {
                final q = _query.toLowerCase();
                final shown = items
                    .where((g) => q.isEmpty ||
                        '${asString(g['label']) ?? ''} ${asString(g['topic']) ?? ''} ${asString(g['role']) ?? ''}'
                            .toLowerCase()
                            .contains(q))
                    .toList();
                return RefreshIndicator(
                  onRefresh: reload,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
                    children: [
                      if (shown.isEmpty)
                        EmptyState(
                          art: _status == 'OPEN' ? Art.success : Art.empty,
                          title: _status == 'OPEN' ? 'Không còn định luật cần rà soát' : 'Chưa có mục nào',
                        )
                      else
                        for (final g in shown) ...[
                          ListCard(
                            onTap: () => _openGap(g),
                            title: asString(g['label']) ?? asString(g['role']) ?? 'Đại lượng chưa đối chiếu',
                            subtitle: '${asString(g['topic']) ?? 'Vật lý'} · ${g['occurrences'] ?? 1} lượt chạy liên quan',
                            trailing: _status == 'OPEN'
                                ? const Pill('Cần kiểm tra', tone: Tone.warning)
                                : _status == 'RESOLVED'
                                    ? const Pill('Đã xử lý', tone: Tone.success)
                                    : const Pill('Bỏ qua'),
                            footer: MetaLine(
                              icon: Icons.schedule_rounded,
                              text: formatDateTime(asDate(g['updatedAt']) ?? asDate(g['createdAt'])),
                              trailing: Icon(Icons.chevron_right_rounded, color: p.muted, size: 18),
                            ),
                          ),
                          const SizedBox(height: 10),
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

class _MoreTile extends StatelessWidget {
  const _MoreTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });
  final IconData icon;
  final String title, subtitle;
  final VoidCallback onTap;

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
            Icon(Icons.chevron_right_rounded, color: p.muted, size: 20),
          ],
        ),
      ),
    );
  }
}
