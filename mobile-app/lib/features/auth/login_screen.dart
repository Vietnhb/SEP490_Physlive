import 'package:flutter/material.dart';

import '../../core/session.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../public/public_screens.dart';
import 'server_screen.dart';

/// MLogin — Đăng nhập (tương thích cả chế độ độc lập và nhúng trong PublicShell).
class LoginScreen extends StatefulWidget {
  const LoginScreen({
    super.key,
    this.embedded = false,
    this.onBackToLanding,
    this.onOpenPlans,
  });
  final bool embedded;
  final VoidCallback? onBackToLanding;
  final VoidCallback? onOpenPlans;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false, _hidden = true, _remember = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    // Pre-fill the email remembered from the previous sign-in so only the password is left.
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      final saved = await SessionScope.read(context).rememberedEmail();
      if (mounted && saved != null && _email.text.isEmpty) {
        setState(() => _email.text = saved);
      }
    });
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await SessionScope.read(
        context,
      ).signIn(_email.text, _password.text, remember: _remember);
    } catch (error) {
      if (mounted) setState(() => _error = errorText(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final session = SessionScope.of(context);
    final notice = _error ?? session.notice;

    return Scaffold(
      appBar: PublicTopBar(onBack: widget.onBackToLanding),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 22, 18, 28),
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Đăng nhập',
                        style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          fontSize: 25,
                          fontWeight: FontWeight.w700,
                          letterSpacing: -0.7,
                          color: p.brand,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Dùng tài khoản nhà trường hoặc PhysLive cấp.',
                        style: TextStyle(color: p.muted, fontSize: 13, height: 1.5),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                const ArtImage(Art.notebook, width: 90, height: 78),
              ],
            ),
            const SizedBox(height: 18),
            if (notice != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: p.dangerSoft,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    Icon(Icons.error_outline, color: p.danger, size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(notice, style: TextStyle(color: p.danger, fontSize: 13)),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
            ],
            Card(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextFormField(
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      autofillHints: const [AutofillHints.email],
                      textInputAction: TextInputAction.next,
                      enabled: !_busy,
                      decoration: const InputDecoration(
                        labelText: 'Email',
                        hintText: 'you@school.edu.vn',
                        floatingLabelBehavior: FloatingLabelBehavior.always,
                        prefixIcon: Icon(Icons.mail_outline),
                      ),
                      validator: (value) => value == null || !value.contains('@')
                          ? 'Nhập email hợp lệ.'
                          : null,
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _password,
                      obscureText: _hidden,
                      autofillHints: const [AutofillHints.password],
                      textInputAction: TextInputAction.done,
                      enabled: !_busy,
                      onFieldSubmitted: (_) => _submit(),
                      decoration: InputDecoration(
                        labelText: 'Mật khẩu',
                        hintText: 'Nhập mật khẩu của bạn',
                        floatingLabelBehavior: FloatingLabelBehavior.always,
                        prefixIcon: const Icon(Icons.lock_outline),
                        suffixIcon: IconButton(
                          tooltip: _hidden ? 'Hiện mật khẩu' : 'Ẩn mật khẩu',
                          onPressed: () => setState(() => _hidden = !_hidden),
                          icon: Icon(
                            _hidden
                                ? Icons.visibility_outlined
                                : Icons.visibility_off_outlined,
                          ),
                        ),
                      ),
                      validator: (value) => value == null || value.isEmpty
                          ? 'Nhập mật khẩu.'
                          : null,
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Checkbox(
                          value: _remember,
                          onChanged: _busy
                              ? null
                              : (v) => setState(() => _remember = v ?? true),
                          visualDensity: VisualDensity.compact,
                        ),
                        Expanded(
                          child: GestureDetector(
                            behavior: HitTestBehavior.opaque,
                            onTap: _busy
                                ? null
                                : () => setState(() => _remember = !_remember),
                            child: Text(
                              'Ghi nhớ đăng nhập',
                              style: TextStyle(color: p.ink, fontSize: 13.5),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    FilledButton.icon(
                      onPressed: _busy ? null : _submit,
                      icon: _busy
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2.2),
                            )
                          : const Icon(Icons.arrow_forward_rounded, size: 18),
                      label: Text(_busy ? 'Đang đăng nhập…' : 'Đăng nhập'),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
              decoration: BoxDecoration(
                color: p.infoSoft,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: p.info.withValues(alpha: 0.18)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.info_outline_rounded, color: p.info, size: 19),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Quên mật khẩu? Liên hệ quản lý trường để được đặt lại.',
                      style: TextStyle(color: p.info, fontSize: 12.5, height: 1.5),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (widget.onOpenPlans != null)
                  TextButton(
                    onPressed: _busy ? null : widget.onOpenPlans,
                    child: const Text('Đăng ký cho trường'),
                  ),
                TextButton.icon(
                  onPressed: _busy
                      ? null
                      : () => Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => ServerScreen(
                                current: session.config.apiUrl,
                              ),
                            ),
                          ),
                  icon: Icon(Icons.dns_outlined, size: 17, color: p.muted),
                  label: Text(
                    session.config.apiUrl.host,
                    style: TextStyle(color: p.muted, fontSize: 13),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
