import 'package:flutter/material.dart';

import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';

/// Every account on the platform: searched and filtered on the server, loaded a page at a time as the list scrolls.
class UsersScreen extends StatefulWidget {
  const UsersScreen({super.key, this.schoolId});

  /// A school account sees its own people, read only; without it the whole platform, with lock and unlock.
  final String? schoolId;

  @override
  State<UsersScreen> createState() => _UsersScreenState();
}

class _UsersScreenState extends State<UsersScreen> {
  static const _size = 20;
  final _scroll = ScrollController();
  final List<ManagedUser> _items = [];
  Map<String, int> _counts = const {};
  String _query = '';
  String _role = 'ALL';
  String _status = '';
  int _page = 0;
  int _total = 0;
  bool _loading = false;
  bool _more = true;
  String? _error;
  int _request = 0;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 400) _next();
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _restart());
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _restart() async {
    setState(() {
      _items.clear();
      _page = 0;
      _more = true;
      _error = null;
    });
    await _next(force: true);
  }

  Future<void> _next({bool force = false}) async {
    if ((_loading && !force) || !_more) return;
    final request = ++_request;
    setState(() => _loading = true);
    try {
      final school = widget.schoolId;
      final data = asJson(await SessionScope.api(context).get(school == null ? '/admin/users/page' : '/schools/$school/users/page', query: {
        'page': '$_page',
        'size': '$_size',
        'query': _query,
        'role': _role,
        'status': _status,
      }));
      if (!mounted || request != _request) return;
      final rows = asJsonList(data['items']).map(ManagedUser.new).toList();
      setState(() {
        _items.addAll(rows);
        _total = asInt(data['totalElements']) ?? _items.length;
        _counts = {for (final e in asJson(data['counts']).entries) e.key: asInt(e.value) ?? 0};
        _page++;
        _more = _page < (asInt(data['totalPages']) ?? 0);
        _loading = false;
      });
    } catch (error) {
      if (!mounted || request != _request) return;
      setState(() {
        _error = errorText(error);
        _loading = false;
      });
    }
  }

  Future<void> _open(ManagedUser user) async {
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _UserSheet(user: user, readOnly: widget.schoolId != null),
    );
    if (changed == true && mounted) _restart();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final school = widget.schoolId != null;
    final roles = school
        ? const ['ALL', 'STUDENT', 'STAFF', 'SCHOOL']
        : const ['ALL', 'STUDENT', 'STAFF', 'SCHOOL', 'REVIEWER', 'MANAGER', 'ADMIN'];
    return Scaffold(
      appBar: HeroBar(
        title: school ? 'Tài khoản' : 'Người dùng',
        subtitle: _counts['total'] == null
            ? (school ? 'Người dùng của trường' : 'Tài khoản trên nền tảng')
            : '${groupDigits(_counts['total']!)} tài khoản',
        art: Art.users,
      ),
      body: RefreshIndicator(
        onRefresh: _restart,
        child: ListView(controller: _scroll, padding: const EdgeInsets.fromLTRB(16, 14, 16, 28), children: [
          SearchBox(
            hint: 'Tìm theo tên, email, mã định danh',
            onChanged: (v) {
              _query = v;
              _restart();
            },
          ),
          const SizedBox(height: 10),
          ChoiceRow<String>(
            selected: _role,
            onSelected: (r) {
              _role = r;
              _restart();
            },
            options: [
              for (final r in roles)
                (r, r == 'ALL' ? 'Tất cả' : roleName(r), r == 'ALL' ? _counts['total'] : _counts[r]),
            ],
          ),
          if (!school) ...[
          const SizedBox(height: 8),
          ChoiceRow<String>(
            selected: _status,
            onSelected: (s) {
              _status = s;
              _restart();
            },
            options: [
              ('', 'Mọi trạng thái', null),
              ('ACTIVE', 'Đang hoạt động', null),
              ('SUSPENDED', 'Tạm khoá', _counts['suspended']),
              ('WARNED', 'Bị cảnh báo', null),
            ],
          ),
          ],
          const SizedBox(height: 12),
          if (_items.isEmpty && _loading)
            for (var i = 0; i < 6; i++) ...[
              const Row(children: [
                Skeleton(width: 44, height: 44, radius: 22),
                SizedBox(width: 12),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Skeleton(width: 160), SizedBox(height: 6), Skeleton(width: 220, height: 11),
                ])),
              ]),
              const SizedBox(height: 16),
            ]
          else if (_items.isEmpty && _error != null)
            EmptyState(art: Art.web, title: 'Chưa tải được', message: _error,
                action: FilledButton.tonal(onPressed: _restart, child: const Text('Thử lại')))
          else if (_items.isEmpty)
            EmptyState(art: Art.users, title: _query.isEmpty ? 'Không có tài khoản nào' : 'Không tìm thấy "$_query"')
          else ...[
            Padding(
              padding: const EdgeInsets.only(left: 2, bottom: 8),
              child: Text('${groupDigits(_total)} kết quả', style: TextStyle(color: p.muted, fontSize: 12)),
            ),
            Card(
              clipBehavior: Clip.antiAlias,
              child: Column(children: [
                for (final u in _items) ...[
                  _UserTile(user: u, onTap: () => _open(u)),
                  if (u != _items.last) const Divider(indent: 68),
                ],
              ]),
            ),
            if (_loading)
              const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator(strokeWidth: 2.4)))
            else if (_error != null)
              TextButton(onPressed: _next, child: const Text('Tải thêm lỗi — thử lại')),
          ],
        ]),
      ),
    );
  }
}

class _UserTile extends StatelessWidget {
  const _UserTile({required this.user, required this.onTap});
  final ManagedUser user;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final t = roleTint(context, user.role);
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 11, 12, 11),
        child: Row(children: [
          Avatar(name: user.fullName, url: user.avatarUrl, size: 42, tint: t),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(user.fullName, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 2),
              Text(user.email, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: p.muted, fontSize: 12)),
              const SizedBox(height: 4),
              Row(children: [
                Text(roleName(user.role), style: TextStyle(color: t.fg, fontSize: 11, fontWeight: FontWeight.w700)),
                if (user.schoolName != null)
                  Expanded(
                    child: Text(' · ${user.schoolName}',
                        maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: p.muted, fontSize: 11)),
                  ),
              ]),
            ]),
          ),
          if (user.suspended)
            const Pill('Tạm khoá', tone: Tone.danger)
          else if (user.warned)
            const Pill('Cảnh báo', tone: Tone.warning),
        ]),
      ),
    );
  }
}

/// One account: who they are, when they last signed in, and lock or unlock with a reason.
class _UserSheet extends StatefulWidget {
  const _UserSheet({required this.user, this.readOnly = false});
  final ManagedUser user;
  final bool readOnly;

  @override
  State<_UserSheet> createState() => _UserSheetState();
}

class _UserSheetState extends State<_UserSheet> {
  bool _busy = false;

  Future<void> _suspend() async {
    final reason = await showDialog<String>(context: context, builder: (_) => const _ReasonDialog());
    if (reason == null || !mounted) return;
    await _run(() => SessionScope.api(context).put('/admin/users/${widget.user.id}/suspend', {'reason': reason}),
        'Đã tạm khoá tài khoản.');
  }

  Future<void> _restore() async {
    final ok = await confirm(context,
        title: 'Mở khoá tài khoản?',
        message: '${widget.user.fullName} sẽ đăng nhập và dùng PhysLive bình thường trở lại.',
        action: 'Mở khoá');
    if (!ok || !mounted) return;
    await _run(() => SessionScope.api(context).put('/admin/users/${widget.user.id}/restore'), 'Đã mở khoá tài khoản.');
  }

  Future<void> _run(Future<dynamic> Function() call, String done) async {
    setState(() => _busy = true);
    try {
      await call();
      if (!mounted) return;
      Navigator.of(context).pop(true);
      showMessage(context, done);
    } catch (error) {
      if (mounted) showMessage(context, errorText(error), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final u = widget.user;
    final me = SessionScope.of(context).user!.id == u.id;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Avatar(name: u.fullName, url: u.avatarUrl, size: 56, tint: roleTint(context, u.role)),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(u.fullName, style: Theme.of(context).textTheme.titleLarge),
                Text(u.email, style: TextStyle(color: p.muted, fontSize: 13)),
              ]),
            ),
          ]),
          const SizedBox(height: 12),
          Wrap(spacing: 6, runSpacing: 6, children: [
            Pill(roleName(u.role), tone: Tone.accent),
            u.suspended ? const Pill('Tạm khoá', tone: Tone.danger) : const Pill('Đang hoạt động', tone: Tone.success),
          ]),
          const SizedBox(height: 8),
          if (u.schoolName != null) InfoRow(label: 'Trường', value: u.schoolName!),
          if (u.institutionId != null && u.institutionId!.isNotEmpty) InfoRow(label: 'Mã định danh', value: u.institutionId!),
          InfoRow(label: 'Đăng nhập gần nhất', value: u.lastLogin == null ? 'Chưa đăng nhập' : formatDateTime(u.lastLogin)),
          if (u.suspended && (u.suspensionReason ?? '').isNotEmpty) InfoRow(label: 'Lý do khoá', value: u.suspensionReason!, strong: false),
          const SizedBox(height: 16),
          if (widget.readOnly)
            Text('Thêm, sửa hoặc khoá tài khoản trên bản web.', textAlign: TextAlign.center, style: TextStyle(color: p.muted, fontSize: 12))
          else if (me)
            Text('Đây là tài khoản của bạn.', textAlign: TextAlign.center, style: TextStyle(color: p.muted))
          else if (u.suspended)
            FilledButton.icon(
              onPressed: _busy ? null : _restore,
              icon: const Icon(Icons.lock_open_rounded),
              label: const Text('Mở khoá tài khoản'),
            )
          else
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(foregroundColor: p.danger, side: BorderSide(color: p.danger.withValues(alpha: 0.4))),
              onPressed: _busy ? null : _suspend,
              icon: const Icon(Icons.lock_rounded),
              label: const Text('Tạm khoá tài khoản'),
            ),
        ]),
      ),
    );
  }
}

class _ReasonDialog extends StatefulWidget {
  const _ReasonDialog();

  @override
  State<_ReasonDialog> createState() => _ReasonDialogState();
}

class _ReasonDialogState extends State<_ReasonDialog> {
  final _reason = TextEditingController();

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return AlertDialog(
      title: const Text('Tạm khoá tài khoản?'),
      content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text('Người dùng chỉ còn xem được, không thao tác được cho đến khi mở khoá.', style: TextStyle(color: p.muted)),
        const SizedBox(height: 12),
        TextField(
          controller: _reason,
          autofocus: true,
          minLines: 2,
          maxLines: 4,
          maxLength: 2000,
          onChanged: (_) => setState(() {}),
          decoration: const InputDecoration(hintText: 'Lý do (bắt buộc)'),
        ),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Huỷ')),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: p.danger, foregroundColor: Colors.white),
          onPressed: _reason.text.trim().isEmpty ? null : () => Navigator.pop(context, _reason.text.trim()),
          child: const Text('Khoá'),
        ),
      ],
    );
  }
}
