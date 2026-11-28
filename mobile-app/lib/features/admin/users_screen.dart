import 'package:flutter/material.dart';

import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../school/school_billing_and_reports_screen.dart';
import 'admin_overview_screen.dart';

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
      builder: (_) => _UserSheet(user: user, schoolId: widget.schoolId),
    );
    if (changed == true && mounted) _restart();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final school = widget.schoolId != null;
    final currentUser = SessionScope.of(context).user;
    final isAdmin = currentUser?.isAdmin ?? false;
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
      floatingActionButton: school
          ? FloatingActionButton.extended(
              onPressed: () async {
                final created = await Navigator.of(context).push<bool>(
                  MaterialPageRoute(builder: (_) => const SchoolCreateUserScreen()),
                );
                if (created == true && mounted) _restart();
              },
              icon: const Icon(Icons.person_add_alt_1_rounded),
              label: const Text('Tạo tài khoản'),
            )
          : isAdmin
              ? FloatingActionButton.extended(
                  onPressed: () async {
                    final created = await Navigator.of(context).push<bool>(
                      MaterialPageRoute(builder: (_) => const AdminCreateManagerScreen()),
                    );
                    if (created == true && mounted) _restart();
                  },
                  icon: const Icon(Icons.person_add_alt_1_rounded),
                  label: const Text('Tạo Manager'),
                )
              : null,
      body: RefreshIndicator(
        onRefresh: _restart,
        child: ListView(controller: _scroll, padding: const EdgeInsets.fromLTRB(16, 14, 16, 28), children: [
          if (_counts['total'] != null) ...[
            Pair(
              StatTile(
                label: 'Tổng tài khoản',
                value: groupDigits(_counts['total'] ?? 0),
                detail: school ? 'Tài khoản thuộc trường' : 'Toàn bộ nền tảng',
                icon: Icons.people_alt_outlined,
                tint: p.blue,
                onTap: () {
                  _role = 'ALL';
                  _status = '';
                  _restart();
                },
              ),
              StatTile(
                label: 'Giáo viên',
                value: groupDigits(_counts['STAFF'] ?? 0),
                detail: school ? 'Tài khoản giảng dạy' : (_counts['SCHOOL'] != null ? 'Thuộc ${_counts['SCHOOL']} trường' : 'Giáo viên'),
                icon: Icons.menu_book_rounded,
                tint: p.teal,
                onTap: () {
                  _role = 'STAFF';
                  _status = '';
                  _restart();
                },
              ),
            ),
            const SizedBox(height: 10),
            Pair(
              StatTile(
                label: 'Học sinh',
                value: groupDigits(_counts['STUDENT'] ?? 0),
                detail: school ? 'Học sinh trong trường' : (_counts['SCHOOL'] != null ? 'Thuộc ${_counts['SCHOOL']} trường' : 'Học sinh'),
                icon: Icons.school_outlined,
                tint: p.violet,
                onTap: () {
                  _role = 'STUDENT';
                  _status = '';
                  _restart();
                },
              ),
              StatTile(
                label: 'Tạm khóa',
                value: groupDigits(_counts['suspended'] ?? 0),
                detail: 'Tài khoản bị tạm khóa',
                icon: Icons.lock_outline_rounded,
                tint: (_counts['suspended'] ?? 0) > 0 ? p.rose : p.green,
                onTap: school
                    ? null
                    : () {
                        _role = 'ALL';
                        _status = 'SUSPENDED';
                        _restart();
                      },
              ),
            ),
            const SizedBox(height: 14),
          ],
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
  const _UserSheet({required this.user, this.schoolId});
  final ManagedUser user;
  final String? schoolId;

  @override
  State<_UserSheet> createState() => _UserSheetState();
}

class _UserSheetState extends State<_UserSheet> {
  bool _busy = false;

  String get _basePath => widget.schoolId == null
      ? '/admin/users/${widget.user.id}'
      : '/schools/${widget.schoolId}/users/${widget.user.id}';

  Future<void> _suspend() async {
    final reason = await showDialog<String>(context: context, builder: (_) => const _ReasonDialog());
    if (reason == null || !mounted) return;
    await _run(() => SessionScope.api(context).put('$_basePath/suspend', {'reason': reason}),
        'Đã tạm khoá tài khoản.');
  }

  Future<void> _restore() async {
    final ok = await confirm(context,
        title: 'Mở khoá tài khoản?',
        message: '${widget.user.fullName} sẽ đăng nhập và dùng PhysLive bình thường trở lại.',
        action: 'Mở khoá');
    if (!ok || !mounted) return;
    await _run(() => SessionScope.api(context).put('$_basePath/restore'), 'Đã mở khoá tài khoản.');
  }

  Future<void> _resetPassword() async {
    final pw = TextEditingController();
    final newPassword = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Đặt lại mật khẩu'),
        content: TextField(
          controller: pw,
          obscureText: true,
          autofocus: true,
          decoration: const InputDecoration(labelText: 'Mật khẩu mới (tối thiểu 8 ký tự)'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Huỷ')),
          FilledButton(
            onPressed: () {
              if (pw.text.length >= 8) Navigator.pop(ctx, pw.text);
            },
            child: const Text('Cập nhật'),
          ),
        ],
      ),
    );
    pw.dispose();
    if (newPassword == null || !mounted) return;
    await _run(
      () => SessionScope.api(context).post('$_basePath/reset-password', {'newPassword': newPassword}),
      'Đã đặt lại mật khẩu.',
    );
  }

  Future<void> _editSchoolUser() async {
    final u = widget.user;
    final nameCtrl = TextEditingController(text: u.fullName);
    final idCtrl = TextEditingController(text: u.institutionId ?? '');
    final existingPerms = (u.json['permissions'] is List)
        ? (u.json['permissions'] as List).map((e) => '$e').toSet()
        : <String>{if (u.role == 'STAFF') 'TEACH'};
    final saved = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlg) => AlertDialog(
          title: const Text('Sửa tài khoản'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Họ và tên')),
                const SizedBox(height: 10),
                TextField(controller: idCtrl, decoration: const InputDecoration(labelText: 'Mã định danh (tuỳ chọn)')),
                if (u.role == 'STAFF') ...[
                  const SizedBox(height: 12),
                  const Align(alignment: Alignment.centerLeft, child: Text('Quyền giáo viên', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
                  CheckboxListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    value: existingPerms.contains('TEACH'),
                    title: const Text('Giảng dạy (TEACH)'),
                    onChanged: (v) => setDlg(() => v == true ? existingPerms.add('TEACH') : existingPerms.remove('TEACH')),
                  ),
                  CheckboxListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    value: existingPerms.contains('MANAGE_CLASS'),
                    title: const Text('Tổ bộ môn / Phân công lớp'),
                    onChanged: (v) => setDlg(() => v == true ? existingPerms.add('MANAGE_CLASS') : existingPerms.remove('MANAGE_CLASS')),
                  ),
                  CheckboxListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    value: existingPerms.contains('MODERATE_SCHOOL_LIBRARY'),
                    title: const Text('Duyệt thư viện trường'),
                    onChanged: (v) => setDlg(() => v == true ? existingPerms.add('MODERATE_SCHOOL_LIBRARY') : existingPerms.remove('MODERATE_SCHOOL_LIBRARY')),
                  ),
                ],
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Huỷ')),
            FilledButton(
              onPressed: () {
                if (nameCtrl.text.trim().isNotEmpty) Navigator.pop(ctx, true);
              },
              child: const Text('Lưu'),
            ),
          ],
        ),
      ),
    );
    final newName = nameCtrl.text.trim();
    final newInst = idCtrl.text.trim();
    nameCtrl.dispose();
    idCtrl.dispose();
    if (saved != true || !mounted) return;
    await _run(
      () => SessionScope.api(context).put(_basePath, {
        'fullName': newName,
        'role': u.role,
        'institutionId': newInst.isEmpty ? null : newInst,
        if (u.role == 'STAFF') 'permissions': existingPerms.toList(),
      }),
      'Đã cập nhật tài khoản.',
    );
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
    final current = SessionScope.of(context).user;
    final me = current?.id == u.id;
    final isAdmin = current?.isAdmin ?? false;
    final canEditProfile = widget.schoolId != null || (isAdmin && (u.role == 'MANAGER' || u.role == 'REVIEWER'));
    final isAdminSchoolScope = isAdmin && widget.schoolId == null && (u.role == 'STUDENT' || u.role == 'STAFF' || u.role == 'SCHOOL');
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
          if (me)
            Text('Đây là tài khoản của bạn.', textAlign: TextAlign.center, style: TextStyle(color: p.muted))
          else ...[
            if (isAdminSchoolScope) ...[
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: p.blue.bg, borderRadius: BorderRadius.circular(12)),
                child: Row(
                  children: [
                    Icon(Icons.info_outline_rounded, color: p.blue.fg, size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Quản lý thông tin giáo viên và học sinh thuộc phạm vi nhà trường.',
                        style: TextStyle(color: p.blue.fg, fontSize: 12.5, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            if (canEditProfile) ...[
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _busy ? null : _editSchoolUser,
                      icon: const Icon(Icons.edit_outlined, size: 17),
                      label: const Text('Sửa thông tin'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _busy ? null : _resetPassword,
                      icon: const Icon(Icons.key_rounded, size: 17),
                      label: const Text('Đặt mật khẩu'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
            ],
            if (u.suspended)
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
                label: Text(isAdminSchoolScope ? 'Tạm khoá cấp hệ thống' : 'Tạm khoá tài khoản'),
              ),
          ],
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
