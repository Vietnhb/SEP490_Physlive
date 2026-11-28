import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../manager/manager_modules_screen.dart';
import '../student/student_assignment_screen.dart';

/// Trigger background notification sync from anywhere (e.g. HomeShell on login or after reading an email).
Future<void> syncNotifications(Session session) async {
  if (session.user == null) {
    _NotifStore.unreadCount.value = 0;
    return;
  }
  await _NotifStore.fetchAll(session);
}

/// Persists read notification IDs per user and exposes the live unread count for the bell badge.
class _NotifStore {
  static final ValueNotifier<int> unreadCount = ValueNotifier<int>(0);
  static final Set<String> _readIds = {};
  static int? _loadedForUserId;

  static String _key(int userId) => 'physlive.readNotifs.$userId';

  static Future<void> ensureLoaded(int userId) async {
    if (_loadedForUserId == userId) return;
    final prefs = await SharedPreferences.getInstance();
    _readIds
      ..clear()
      ..addAll(prefs.getStringList(_key(userId)) ?? const []);
    _loadedForUserId = userId;
  }

  static bool isUnread(_NotifItem item) => item.unread && !_readIds.contains(item.id);

  static Future<void> markRead(int userId, String id, List<_NotifItem> all) async {
    await ensureLoaded(userId);
    if (_readIds.add(id)) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setStringList(_key(userId), _readIds.toList());
    }
    unreadCount.value = all.where(isUnread).length;
  }

  static Future<void> markAllRead(int userId, List<_NotifItem> all) async {
    await ensureLoaded(userId);
    for (final item in all) {
      _readIds.add(item.id);
    }
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_key(userId), _readIds.toList());
    unreadCount.value = 0;
  }

  static Future<List<_NotifItem>> fetchAll(Session session) async {
    final user = session.user!;
    await ensureLoaded(user.id);
    final api = session.api;
    final list = <_NotifItem>[];

    if (user.isStudent) {
      try {
        final assignments = asJsonList(await api.get('/assignments/mine/student')).map(Assignment.new).toList();
        for (final a in assignments) {
          if (a.done && a.score != null) {
            list.add(_NotifItem(
              id: 'graded-${a.id}',
              icon: Icons.check_rounded,
              title: 'Bài thực hành đã được chấm',
              subtitle: '${a.title} · ${formatScore(a.score!)}/${formatScore(a.maxScore)} điểm',
              unread: true,
              onTap: (ctx) => Navigator.of(ctx).push(
                MaterialPageRoute(builder: (_) => StudentAssignmentScreen(assignment: a)),
              ),
            ));
          } else if (!a.done && a.dueAt != null && a.dueAt!.difference(DateTime.now()).inHours <= 48) {
            list.add(_NotifItem(
              id: 'due-${a.id}',
              icon: Icons.schedule_rounded,
              title: a.overdue ? 'Bài tập đã quá hạn' : 'Hạn nộp bài sắp tới',
              subtitle: '${a.title} · ${formatDue(a.dueAt!)}',
              unread: true,
              onTap: (ctx) => Navigator.of(ctx).push(
                MaterialPageRoute(builder: (_) => StudentAssignmentScreen(assignment: a)),
              ),
            ));
          }
        }
      } catch (_) {}
    }

    if (user.isManager) {
      try {
        final notif = asJson(await api.get('/reports/customer-usage/email-inbox/notifications'));
        for (final raw in asJsonList(notif['items'])) {
          final id = asString(raw['id']) ?? '';
          final unreadCnt = asInt(raw['unreadCount']) ?? 1;
          list.add(_NotifItem(
            id: 'email-reply-$id-${asString(raw['latestReplyId']) ?? unreadCnt}',
            icon: Icons.mark_email_unread_outlined,
            title: 'Phản hồi email từ ${asString(raw['schoolName']) ?? 'trường'}',
            subtitle: asString(raw['subject']) ?? 'Nhấn để xem phản hồi',
            unread: unreadCnt > 0,
            onTap: (ctx) => Navigator.of(ctx).push(
              MaterialPageRoute(builder: (_) => const ManagerEmailsScreen()),
            ),
          ));
        }
      } catch (_) {}
    }

    try {
      final supports = asJsonList(await api.get('/support/mine'));
      for (final raw in supports) {
        final id = asString(raw['id']) ?? '';
        final resp = asString(raw['adminResponse']);
        if (resp != null && resp.trim().isNotEmpty) {
          list.add(_NotifItem(
            id: 'support-$id',
            icon: Icons.chat_bubble_outline_rounded,
            title: 'Có phản hồi yêu cầu hỗ trợ',
            subtitle: asString(raw['subject']) ?? 'Nhấn để xem chi tiết',
            unread: asString(raw['status']) != 'RESOLVED',
            onTap: (ctx) => Navigator.of(ctx).push(
              MaterialPageRoute(builder: (_) => MySupportDetailScreen(item: raw)),
            ),
          ));
        }
      }
    } catch (_) {}

    unreadCount.value = list.where(isUnread).length;
    return list;
  }
}

/// MAccount — Tài khoản cá nhân (ảnh đại diện, trạng thái, menu 4 mục, giao diện, đăng xuất).
class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  bool _syncedNotifs = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_syncedNotifs) {
      _syncedNotifs = true;
      final session = SessionScope.read(context);
      if (session.user != null) {
        _NotifStore.fetchAll(session);
      }
    }
  }

  Future<void> _signOut(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Đăng xuất?'),
        content: const Text('Bạn sẽ cần đăng nhập lại để dùng ứng dụng.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Huỷ')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Đăng xuất')),
        ],
      ),
    );
    if (confirmed == true && context.mounted) {
      Navigator.of(context).popUntil((route) => route.isFirst);
      await SessionScope.read(context).signOut();
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final session = SessionScope.of(context);
    final user = session.user;
    if (user == null) return const Scaffold();

    return Scaffold(
      appBar: _AccountTopBar(
        subtitle: user.roleLabel,
        onOpenNotifications: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const NotificationsScreen()),
        ),
        onOpenProfile: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const ProfileEditScreen()),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 18, 16, 28),
        children: [
          // Centered Profile Card matching MAccount screenshot
          Card(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 22),
              child: Column(
                children: [
                  Avatar(
                    name: user.fullName,
                    url: user.avatarUrl,
                    size: 72,
                    tint: roleTint(context, user.role),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    user.fullName,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontSize: 22,
                      fontWeight: FontWeight.w700,
                      color: p.brand,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    user.email,
                    textAlign: TextAlign.center,
                    style: TextStyle(color: p.muted, fontSize: 13),
                  ),
                  const SizedBox(height: 12),
                  Pill(
                    user.suspended ? 'Tài khoản đang tạm khóa' : 'Tài khoản đang hoạt động',
                    tone: user.suspended ? Tone.danger : Tone.success,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),

          // 4-item Action Card matching MAccount screenshot
          Card(
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: [
                _MenuTile(
                  icon: Icons.person_outline_rounded,
                  title: 'Thông tin cá nhân',
                  subtitle: 'Ảnh đại diện, tên, ngày sinh',
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const ProfileEditScreen()),
                  ),
                ),
                Divider(height: 1, indent: 68, color: p.line),
                _MenuTile(
                  icon: Icons.lock_outline_rounded,
                  title: 'Đổi mật khẩu',
                  subtitle: 'Bảo vệ tài khoản của bạn',
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const ChangePasswordScreen()),
                  ),
                ),
                Divider(height: 1, indent: 68, color: p.line),
                _MenuTile(
                  icon: Icons.notifications_none_rounded,
                  title: 'Thông báo',
                  subtitle: 'Nhắc hạn và kết quả học tập',
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const NotificationsScreen()),
                  ),
                ),
                Divider(height: 1, indent: 68, color: p.line),
                _MenuTile(
                  icon: Icons.chat_bubble_outline_rounded,
                  title: 'Hỗ trợ & khiếu nại',
                  subtitle: 'Theo dõi các yêu cầu đã gửi',
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const MySupportScreen()),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Soft red Sign Out button matching MAccount screenshot
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(48),
              backgroundColor: p.dangerSoft,
              foregroundColor: p.danger,
              side: BorderSide(color: p.danger.withValues(alpha: 0.28)),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            onPressed: () => _signOut(context),
            icon: const Icon(Icons.arrow_forward_rounded, size: 18),
            label: const Text('Đăng xuất', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
          const SizedBox(height: 18),

          // Theme & server settings compact card
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('Giao diện ứng dụng', style: TextStyle(color: p.muted, fontSize: 12, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 10),
                  ValueListenableBuilder<ThemeMode>(
                    valueListenable: appTheme,
                    builder: (context, mode, _) => SegmentedButton<ThemeMode>(
                      showSelectedIcon: false,
                      segments: const [
                        ButtonSegment(value: ThemeMode.light, icon: Icon(Icons.light_mode_rounded, size: 16), label: Text('Sáng')),
                        ButtonSegment(value: ThemeMode.dark, icon: Icon(Icons.dark_mode_rounded, size: 16), label: Text('Tối')),
                        ButtonSegment(value: ThemeMode.system, icon: Icon(Icons.phone_android_rounded, size: 16), label: Text('Hệ thống')),
                      ],
                      selected: {mode},
                      onSelectionChanged: (value) => appTheme.set(value.first),
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'Máy chủ: ${session.config.apiUrl.host}',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: p.muted, fontSize: 11.5),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Public top bar reused across roles (PhysLive logo, subtitle, live unread bell badge, profile icon).
class RoleTopBar extends StatelessWidget implements PreferredSizeWidget {
  const RoleTopBar({
    super.key,
    required this.subtitle,
    this.showBack = false,
    this.showNotifications = true,
    this.showProfile = true,
    this.extraAction,
  });
  final String subtitle;
  final bool showBack;
  final bool showNotifications;
  final bool showProfile;
  final Widget? extraAction;

  @override
  Size get preferredSize => const Size.fromHeight(62);

  @override
  Widget build(BuildContext context) {
    return _AccountTopBar(
      subtitle: subtitle,
      showBack: showBack,
      extraAction: extraAction,
      onOpenNotifications: showNotifications
          ? () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const NotificationsScreen()),
              )
          : null,
      onOpenProfile: showProfile
          ? () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const AccountScreen()),
              )
          : null,
    );
  }
}

class _AccountTopBar extends StatelessWidget implements PreferredSizeWidget {
  const _AccountTopBar({
    required this.subtitle,
    this.showBack = false,
    this.onOpenNotifications,
    this.onOpenProfile,
    this.extraAction,
  });
  final String subtitle;
  final bool showBack;
  final VoidCallback? onOpenNotifications;
  final VoidCallback? onOpenProfile;
  final Widget? extraAction;

  @override
  Size get preferredSize => const Size.fromHeight(62);

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final canPop = showBack || Navigator.of(context).canPop();
    return Material(
      color: p.surface,
      child: SafeArea(
        bottom: false,
        child: Container(
          height: 62,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(border: Border(bottom: BorderSide(color: p.line))),
          child: Row(
            children: [
              if (canPop) ...[
                IconButton(
                  tooltip: 'Quay lại',
                  onPressed: () => Navigator.of(context).maybePop(),
                  icon: const Icon(Icons.chevron_left_rounded, size: 26),
                ),
                const SizedBox(width: 2),
              ],
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(11),
                  border: Border.all(color: p.line),
                ),
                clipBehavior: Clip.antiAlias,
                child: Image.asset('assets/brand/logo.png', fit: BoxFit.cover),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'PhysLive',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.4,
                        height: 1.15,
                      ),
                    ),
                    Text(subtitle, style: TextStyle(color: p.muted, fontSize: 11, height: 1.2)),
                  ],
                ),
              ),
              if (extraAction != null) extraAction!,
              if (onOpenNotifications != null)
                ValueListenableBuilder<int>(
                  valueListenable: _NotifStore.unreadCount,
                  builder: (context, count, _) => IconButton(
                    tooltip: count > 0 ? 'Thông báo ($count chưa đọc)' : 'Thông báo',
                    onPressed: onOpenNotifications,
                    icon: Stack(
                      clipBehavior: Clip.none,
                      children: [
                        Icon(Icons.notifications_none_rounded, color: p.ink, size: 23),
                        if (count > 0)
                          Positioned(
                            right: -6,
                            top: -5,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                              constraints: const BoxConstraints(minWidth: 17, minHeight: 17),
                              decoration: BoxDecoration(
                                color: p.danger,
                                borderRadius: BorderRadius.circular(99),
                                border: Border.all(color: p.surface, width: 1.5),
                              ),
                              alignment: Alignment.center,
                              child: Text(
                                count > 9 ? '9+' : '$count',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  height: 1.1,
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              if (onOpenProfile != null)
                IconButton(
                  tooltip: 'Thông tin cá nhân',
                  onPressed: onOpenProfile,
                  icon: Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(color: p.blue.bg, shape: BoxShape.circle),
                    child: Icon(Icons.person_outline_rounded, color: p.blue.fg, size: 19),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MenuTile extends StatelessWidget {
  const _MenuTile({
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
                  Text(title, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontSize: 14.5)),
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

/// MProfile — Thông tin cá nhân (chọn ảnh đại diện, họ tên, ngày sinh, email).
class ProfileEditScreen extends StatefulWidget {
  const ProfileEditScreen({super.key});

  @override
  State<ProfileEditScreen> createState() => _ProfileEditScreenState();
}

class _ProfileEditScreenState extends State<ProfileEditScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _dob = TextEditingController();
  bool _initialized = false;
  String? _avatarUrl;
  bool _busy = false;
  String? _error;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_initialized) {
      final user = SessionScope.read(context).user!;
      _name.text = user.fullName;
      _dob.text = user.dateOfBirth ?? '';
      _avatarUrl = user.avatarUrl;
      _initialized = true;
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _dob.dispose();
    super.dispose();
  }

  Future<void> _pickAvatar() async {
    final choice = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Chọn ảnh từ thiết bị'),
              onTap: () => Navigator.of(ctx).pop('gallery'),
            ),
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('Chụp ảnh mới'),
              onTap: () => Navigator.of(ctx).pop('camera'),
            ),
            if (_avatarUrl != null && _avatarUrl!.isNotEmpty)
              ListTile(
                leading: Icon(Icons.delete_outline_rounded, color: ctx.palette.danger),
                title: Text('Xóa ảnh đại diện', style: TextStyle(color: ctx.palette.danger)),
                onTap: () => Navigator.of(ctx).pop('clear'),
              ),
          ],
        ),
      ),
    );
    if (choice == null || !mounted) return;
    if (choice == 'clear') {
      setState(() => _avatarUrl = null);
      return;
    }
    try {
      final picked = await ImagePicker().pickImage(
        source: choice == 'camera' ? ImageSource.camera : ImageSource.gallery,
        maxWidth: 320,
        maxHeight: 320,
        imageQuality: 80,
      );
      if (picked == null || !mounted) return;
      final bytes = await picked.readAsBytes();
      final mime = picked.path.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      if (mounted) {
        setState(() => _avatarUrl = 'data:$mime;base64,${base64Encode(bytes)}');
      }
    } catch (error) {
      if (mounted) showMessage(context, 'Không thể chọn ảnh: ${errorText(error)}', error: true);
    }
  }

  Future<void> _pickDate() async {
    final initial = DateTime.tryParse(_dob.text) ?? DateTime(2010, 9, 15);
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(1940),
      lastDate: DateTime.now(),
    );
    if (picked != null) {
      final y = picked.year.toString().padLeft(4, '0');
      final m = picked.month.toString().padLeft(2, '0');
      final d = picked.day.toString().padLeft(2, '0');
      setState(() => _dob.text = '$y-$m-$d');
    }
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await SessionScope.read(context).updateProfile(
        fullName: _name.text,
        dateOfBirth: _dob.text,
        avatarUrl: _avatarUrl,
      );
      if (!mounted) return;
      showMessage(context, 'Đã lưu thông tin cá nhân.');
      Navigator.of(context).pop();
    } catch (error) {
      if (mounted) setState(() => _error = errorText(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final user = SessionScope.of(context).user;
    if (user == null) return const Scaffold();

    return Scaffold(
      appBar: _AccountTopBar(subtitle: user.roleLabel, showBack: true),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 20, 18, 32),
          children: [
            Text(
              'Thông tin cá nhân',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontSize: 24,
                fontWeight: FontWeight.w700,
                color: p.brand,
              ),
            ),
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Center(
                      child: Avatar(
                        name: _name.text.isEmpty ? user.fullName : _name.text,
                        url: _avatarUrl,
                        size: 74,
                        tint: roleTint(context, user.role),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Center(
                      child: OutlinedButton(
                        onPressed: _busy ? null : _pickAvatar,
                        child: const Text('Chọn ảnh đại diện'),
                      ),
                    ),
                    const SizedBox(height: 18),
                    TextFormField(
                      controller: _name,
                      enabled: !_busy,
                      decoration: const InputDecoration(labelText: 'Họ và tên'),
                      validator: (v) => v == null || v.trim().isEmpty ? 'Nhập họ và tên.' : null,
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _dob,
                      readOnly: true,
                      enabled: !_busy,
                      onTap: _pickDate,
                      decoration: const InputDecoration(
                        labelText: 'Ngày sinh',
                        hintText: 'YYYY-MM-DD',
                        suffixIcon: Icon(Icons.calendar_today_outlined, size: 18),
                      ),
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      initialValue: user.email,
                      enabled: false,
                      decoration: const InputDecoration(labelText: 'Email'),
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      Text(_error!, style: TextStyle(color: p.danger, fontSize: 13)),
                    ],
                    const SizedBox(height: 20),
                    FilledButton(
                      onPressed: _busy ? null : _save,
                      child: _busy
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4))
                          : const Text('Lưu thay đổi'),
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

class _NotifItem {
  _NotifItem({
    required this.id,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.unread,
    this.onTap,
  });
  final String id, title, subtitle;
  final IconData icon;
  final bool unread;
  final void Function(BuildContext)? onTap;
}

/// MNotifications — Thông báo (tổng hợp thực tế từ bài tập đã chấm, hạn nộp hôm nay và phản hồi hỗ trợ).
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  bool _unreadOnly = false;

  Future<List<_NotifItem>> _load() => _NotifStore.fetchAll(SessionScope.read(context));

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final user = SessionScope.of(context).user;
    if (user == null) return const Scaffold();

    return Scaffold(
      appBar: _AccountTopBar(subtitle: user.roleLabel, showBack: true),
      body: Loader<List<_NotifItem>>(
        load: _load,
        builder: (context, items, reload) {
          final unreadTotal = items.where(_NotifStore.isUnread).length;
          final shown = _unreadOnly ? items.where(_NotifStore.isUnread).toList() : items;

          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(18, 20, 18, 32),
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Thông báo',
                            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                              fontSize: 24,
                              fontWeight: FontWeight.w700,
                              color: p.brand,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text('Thông tin mới dành cho bạn.', style: TextStyle(color: p.muted, fontSize: 13)),
                        ],
                      ),
                    ),
                    if (unreadTotal > 0)
                      TextButton(
                        onPressed: () async {
                          await _NotifStore.markAllRead(user.id, items);
                          if (mounted) setState(() {});
                        },
                        child: const Text('Đọc tất cả'),
                      ),
                  ],
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    _DarkFilterPill(
                      label: 'Tất cả (${items.length})',
                      selected: !_unreadOnly,
                      onTap: () => setState(() => _unreadOnly = false),
                    ),
                    const SizedBox(width: 8),
                    _DarkFilterPill(
                      label: 'Chưa đọc ($unreadTotal)',
                      selected: _unreadOnly,
                      onTap: () => setState(() => _unreadOnly = true),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                if (shown.isEmpty)
                  const EmptyState(
                    art: Art.empty,
                    title: 'Không có thông báo mới',
                    message: 'Khi có bài được chấm, sắp đến hạn hoặc phản hồi hỗ trợ sẽ hiện tại đây.',
                  )
                else
                  Card(
                    clipBehavior: Clip.antiAlias,
                    child: Column(
                      children: [
                        for (var i = 0; i < shown.length; i++) ...[
                          if (i > 0) Divider(height: 1, indent: 68, color: p.line),
                          InkWell(
                            onTap: () async {
                              await _NotifStore.markRead(user.id, shown[i].id, items);
                              if (!context.mounted) return;
                              setState(() {});
                              shown[i].onTap?.call(context);
                            },
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                              child: Row(
                                children: [
                                  Container(
                                    width: 40,
                                    height: 40,
                                    decoration: BoxDecoration(color: p.blue.bg, shape: BoxShape.circle),
                                    child: Icon(shown[i].icon, color: p.blue.fg, size: 19),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          shown[i].title,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: Theme.of(context).textTheme.titleSmall,
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          shown[i].subtitle,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(color: p.muted, fontSize: 12),
                                        ),
                                      ],
                                    ),
                                  ),
                                  if (_NotifStore.isUnread(shown[i])) ...[
                                    const SizedBox(width: 6),
                                    const Pill('Mới', tone: Tone.danger),
                                  ],
                                  const SizedBox(width: 4),
                                  Icon(Icons.chevron_right_rounded, color: p.muted, size: 19),
                                ],
                              ),
                            ),
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

class _DarkFilterPill extends StatelessWidget {
  const _DarkFilterPill({required this.label, required this.selected, required this.onTap});
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Material(
      color: selected ? p.ink : p.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(11),
        side: BorderSide(color: selected ? p.ink : p.line),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(11),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          child: Text(
            label,
            style: TextStyle(
              color: selected ? p.surface : p.ink,
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }
}

/// MMySupport — Hỗ trợ & khiếu nại của tôi (GET /support/mine + POST /support/messages|/feedback).
class MySupportScreen extends StatefulWidget {
  const MySupportScreen({super.key});

  @override
  State<MySupportScreen> createState() => _MySupportScreenState();
}

class _MySupportScreenState extends State<MySupportScreen> {
  String _query = '';
  String _status = 'ALL';
  int _reload = 0;

  Future<List<Json>> _load() async => asJsonList(
        await SessionScope.api(context).get('/support/mine'),
      );

  Future<void> _openCreateSheet() async {
    final subject = TextEditingController();
    final content = TextEditingController();
    var kind = 'MESSAGE';
    var busy = false;
    String? error;

    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) => Padding(
          padding: EdgeInsets.fromLTRB(20, 4, 20, MediaQuery.of(ctx).viewInsets.bottom + 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Gửi yêu cầu hỗ trợ', style: Theme.of(ctx).textTheme.titleLarge),
              const SizedBox(height: 12),
              SegmentedButton<String>(
                showSelectedIcon: false,
                segments: const [
                  ButtonSegment(value: 'MESSAGE', label: Text('Yêu cầu hỗ trợ')),
                  ButtonSegment(value: 'FEEDBACK', label: Text('Góp ý')),
                ],
                selected: {kind},
                onSelectionChanged: busy ? null : (v) => setSheet(() => kind = v.first),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: subject,
                enabled: !busy,
                decoration: const InputDecoration(labelText: 'Tiêu đề', hintText: 'Tóm tắt vấn đề bạn gặp phải'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: content,
                enabled: !busy,
                maxLines: 4,
                decoration: const InputDecoration(labelText: 'Nội dung chi tiết', hintText: 'Mô tả rõ để đội ngũ hỗ trợ nhanh hơn'),
              ),
              if (error != null) ...[
                const SizedBox(height: 8),
                Text(error!, style: TextStyle(color: ctx.palette.danger, fontSize: 12.5)),
              ],
              const SizedBox(height: 16),
              FilledButton(
                onPressed: busy
                    ? null
                    : () async {
                        if (subject.text.trim().isEmpty || content.text.trim().isEmpty) {
                          setSheet(() => error = 'Vui lòng nhập đầy đủ tiêu đề và nội dung.');
                          return;
                        }
                        setSheet(() {
                          busy = true;
                          error = null;
                        });
                        try {
                          await SessionScope.api(context).post(
                            kind == 'MESSAGE' ? '/support/messages' : '/support/feedback',
                            {'subject': subject.text.trim(), 'content': content.text.trim()},
                          );
                          if (ctx.mounted) Navigator.of(ctx).pop(true);
                        } catch (e) {
                          setSheet(() {
                            busy = false;
                            error = errorText(e);
                          });
                        }
                      },
                child: busy
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.2))
                    : const Text('Gửi yêu cầu'),
              ),
            ],
          ),
        ),
      ),
    );
    subject.dispose();
    content.dispose();
    if (created == true && mounted) {
      showMessage(context, 'Đã gửi yêu cầu hỗ trợ.');
      setState(() => _reload++);
    }
  }

  void _openFilterSheet() {
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Lọc theo trạng thái', style: Theme.of(ctx).textTheme.titleLarge),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final entry in const [
                  ('ALL', 'Tất cả'),
                  ('OPEN', 'Chờ xử lý'),
                  ('READ', 'Đang xem xét'),
                  ('RESOLVED', 'Đã giải quyết'),
                ])
                  ChoiceChip(
                    label: Text(entry.$2),
                    selected: _status == entry.$1,
                    onSelected: (_) {
                      setState(() => _status = entry.$1);
                      Navigator.of(ctx).pop();
                    },
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final user = SessionScope.of(context).user;
    if (user == null) return const Scaffold();

    return Scaffold(
      appBar: _AccountTopBar(subtitle: user.roleLabel, showBack: true),
      body: Loader<List<Json>>(
        load: _load,
        reloadKey: _reload,
        builder: (context, items, reload) {
          final shown = items.where((item) {
            final st = asString(item['status']) ?? 'OPEN';
            if (_status != 'ALL' && st != _status) return false;
            if (_query.isEmpty) return true;
            return '${item['id'] ?? ''} ${item['subject'] ?? ''} ${item['content'] ?? ''}'
                .toLowerCase()
                .contains(_query);
          }).toList();

          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(18, 20, 18, 32),
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Hỗ trợ & khiếu nại',
                            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                              fontSize: 24,
                              fontWeight: FontWeight.w700,
                              color: p.brand,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text('Gửi yêu cầu và theo dõi kết quả.', style: TextStyle(color: p.muted, fontSize: 13)),
                        ],
                      ),
                    ),
                    const ArtImage(Art.complaint, width: 88, height: 74),
                  ],
                ),
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: _openCreateSheet,
                  icon: const Icon(Icons.add_rounded, size: 20),
                  label: const Text('Gửi yêu cầu'),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: SearchBox(
                        hint: 'Tìm mã hoặc tiêu đề...',
                        onChanged: (v) => setState(() => _query = v.trim().toLowerCase()),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Material(
                      color: _status != 'ALL' ? p.accentSoft : p.surface,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: BorderSide(color: _status != 'ALL' ? p.accent : p.line),
                      ),
                      child: IconButton(
                        tooltip: 'Bộ lọc trạng thái',
                        onPressed: _openFilterSheet,
                        icon: Icon(Icons.filter_list_rounded, color: _status != 'ALL' ? p.accent : p.ink),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                if (shown.isEmpty)
                  EmptyState(
                    art: Art.complaint,
                    title: 'Chưa có yêu cầu nào',
                    message: _query.isEmpty ? 'Bấm "Gửi yêu cầu" khi bạn cần hỗ trợ hoặc góp ý.' : 'Không tìm thấy yêu cầu phù hợp.',
                  )
                else
                  for (final item in shown) ...[
                    _SupportCard(
                      item: item,
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => MySupportDetailScreen(item: item)),
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],
              ],
            ),
          );
        },
      ),
    );
  }
}

class _SupportCard extends StatelessWidget {
  const _SupportCard({required this.item, required this.onTap});
  final Json item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final status = asString(item['status']) ?? 'OPEN';
    final (label, tone) = switch (status) {
      'RESOLVED' => ('Đã giải quyết', Tone.success),
      'READ' => ('Đang xem xét', Tone.info),
      _ => ('Chờ xử lý', Tone.warning),
    };
    final id = (asString(item['id']) ?? '').split('-').first.toUpperCase();
    final created = asDate(item['createdAt']);

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      asString(item['subject']) ?? 'Yêu cầu hỗ trợ',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(fontSize: 15),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Pill(label, tone: tone),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                [if (id.isNotEmpty) '#$id', if (created != null) formatDateTime(created)].join(' · '),
                style: TextStyle(color: p.muted, fontSize: 12),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Nhấn để xem nội dung và phản hồi',
                      style: TextStyle(color: p.muted, fontSize: 12.5),
                    ),
                  ),
                  Icon(Icons.chevron_right_rounded, color: p.muted, size: 19),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// MMySupportDetail — Chi tiết yêu cầu hỗ trợ & phản hồi.
class MySupportDetailScreen extends StatelessWidget {
  const MySupportDetailScreen({super.key, required this.item});
  final Json item;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final status = asString(item['status']) ?? 'OPEN';
    final (label, tone) = switch (status) {
      'RESOLVED' => ('Đã giải quyết', Tone.success),
      'READ' => ('Đang xem xét', Tone.info),
      _ => ('Chờ xử lý', Tone.warning),
    };
    final response = asString(item['adminResponse']);
    final responder = asString(item['responderName']);
    final created = asDate(item['createdAt']);
    final respondedAt = asDate(item['respondedAt']);

    return Scaffold(
      appBar: AppBar(title: const Text('Chi tiết yêu cầu')),
      body: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          asString(item['subject']) ?? 'Yêu cầu hỗ trợ',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Pill(label, tone: tone),
                    ],
                  ),
                  if (created != null) ...[
                    const SizedBox(height: 6),
                    Text('Gửi lúc ${formatDateTime(created)}', style: TextStyle(color: p.muted, fontSize: 12)),
                  ],
                  const Divider(height: 24),
                  Text(
                    asString(item['content']) ?? '',
                    style: const TextStyle(fontSize: 14, height: 1.6),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Phản hồi từ hệ thống', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 10),
                  if (response == null || response.trim().isEmpty)
                    Text('Yêu cầu đang được xem xét. Phản hồi sẽ hiện tại đây.', style: TextStyle(color: p.muted))
                  else ...[
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: p.surface2,
                        borderRadius: BorderRadius.circular(12),
                        border: Border(left: BorderSide(color: p.accent, width: 3)),
                      ),
                      child: Text(response.trim(), style: const TextStyle(fontSize: 14, height: 1.55)),
                    ),
                    if (responder != null || respondedAt != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        [if (responder != null) responder, if (respondedAt != null) formatDateTime(respondedAt)].join(' · '),
                        style: TextStyle(color: p.muted, fontSize: 12),
                      ),
                    ],
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class ChangePasswordScreen extends StatefulWidget {
  const ChangePasswordScreen({super.key, this.forced = false});
  final bool forced;

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _form = GlobalKey<FormState>();
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _again = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _again.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    final session = SessionScope.read(context);
    try {
      await session.changePassword(_current.text, _next.text);
      if (!mounted) return;
      showMessage(context, 'Đã đổi mật khẩu.');
      if (!widget.forced) Navigator.of(context).pop();
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
      appBar: AppBar(
        title: const Text('Đổi mật khẩu'),
        automaticallyImplyLeading: !widget.forced,
        actions: [
          if (widget.forced)
            TextButton(onPressed: () => SessionScope.read(context).signOut(), child: const Text('Đăng xuất')),
        ],
      ),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            if (widget.forced) ...[
              Text('Hãy đặt mật khẩu mới trước khi tiếp tục.', style: TextStyle(color: p.muted)),
              const SizedBox(height: 16),
            ],
            TextFormField(
              controller: _current,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Mật khẩu hiện tại'),
              validator: (v) => v == null || v.isEmpty ? 'Nhập mật khẩu hiện tại.' : null,
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _next,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Mật khẩu mới', helperText: 'Ít nhất 8 ký tự.'),
              validator: (v) => v == null || v.length < 8 ? 'Mật khẩu mới cần ít nhất 8 ký tự.' : null,
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _again,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Nhập lại mật khẩu mới'),
              validator: (v) => v != _next.text ? 'Hai mật khẩu chưa khớp.' : null,
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: TextStyle(color: p.danger)),
            ],
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _busy ? null : _save,
              child: _busy
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4))
                  : const Text('Lưu mật khẩu'),
            ),
          ],
        ),
      ),
    );
  }
}

/// Accounts that run a school or the platform work from the web, where their tools are.
class WebOnlyScreen extends StatelessWidget {
  const WebOnlyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = SessionScope.of(context);
    final user = session.user;
    if (user == null) return const Scaffold();
    return Scaffold(
      body: SafeArea(
        child: EmptyState(
          art: Art.web,
          title: 'Tài khoản ${user.roleLabel.toLowerCase()} dùng trên bản web',
          message: 'Công cụ của vai trò này cần màn hình lớn. '
              'Hãy mở PhysLive trên trình duyệt máy tính.',
          action: OutlinedButton(onPressed: session.signOut, child: const Text('Đăng xuất')),
        ),
      ),
    );
  }
}
