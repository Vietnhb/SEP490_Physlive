import 'package:flutter/material.dart';

import '../../core/session.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import 'server_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

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
    // the email kept by "Ghi nhớ đăng nhập" last time, so only the password is left to type
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final saved = await SessionScope.of(context).rememberedEmail();
      if (mounted && saved != null && _email.text.isEmpty)
        setState(() => _email.text = saved);
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
      await SessionScope.of(
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
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 16),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _form,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          // the same mark as the web app: the logo on a white tile with a hairline border
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: p.line),
                          ),
                          clipBehavior: Clip.antiAlias,
                          child: Image.asset(
                            'assets/brand/logo.png',
                            fit: BoxFit.cover,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Text(
                          'PhysLive',
                          style: Theme.of(context).textTheme.headlineSmall
                              ?.copyWith(fontWeight: FontWeight.w800),
                        ),
                      ],
                    ),
                    const SizedBox(height: 32),
                    Text(
                      'Đăng nhập',
                      style: Theme.of(context).textTheme.headlineMedium
                          ?.copyWith(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Dùng tài khoản trường đã cấp cho bạn.',
                      style: TextStyle(color: p.muted, fontSize: 15),
                    ),
                    const SizedBox(height: 28),
                    if (notice != null) ...[
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: p.dangerSoft,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              Icons.error_outline,
                              color: p.danger,
                              size: 20,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                notice,
                                style: TextStyle(color: p.danger),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],
                    TextFormField(
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      autofillHints: const [AutofillHints.email],
                      textInputAction: TextInputAction.next,
                      enabled: !_busy,
                      decoration: const InputDecoration(
                        labelText: 'Email',
                        hintText: 'Nhập email của bạn',
                        floatingLabelBehavior: FloatingLabelBehavior.always,
                        prefixIcon: Icon(Icons.mail_outline),
                      ),
                      validator: (value) =>
                          value == null || !value.contains('@')
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
                    const SizedBox(height: 6),
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
                              style: TextStyle(color: p.ink, fontSize: 14),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: _busy ? null : _submit,
                      child: _busy
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.4,
                              ),
                            )
                          : const Text('Đăng nhập'),
                    ),
                    const SizedBox(height: 28),
                    Center(
                      child: TextButton.icon(
                        onPressed: _busy
                            ? null
                            : () => Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => ServerScreen(
                                    current: session.config.apiUrl,
                                  ),
                                ),
                              ),
                        icon: Icon(
                          Icons.dns_outlined,
                          size: 18,
                          color: p.muted,
                        ),
                        label: Text(
                          session.config.apiUrl.host,
                          style: TextStyle(color: p.muted),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
