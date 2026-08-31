import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:saptahara/app/auth.dart';
import 'package:saptahara/core/theme/app_theme.dart';
import 'package:saptahara/presentation/auth/signup_screen.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _phone = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _phone.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _signIn() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final err = await ref
        .read(authProvider.notifier)
        .login(_phone.text.trim(), _password.text);
    if (!mounted) return;
    setState(() {
      _busy = false;
      _error = err;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.white,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Image.asset('assets/images/logo.png',
                    height: 88, fit: BoxFit.contain,
                    errorBuilder: (_, __, ___) =>
                        const Icon(Icons.shield_moon_rounded, size: 56, color: AppColors.safeGreen)),
                const SizedBox(height: 12),
                const Text("NER Logistics — Driver & Field Officer",
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.black)),
                const SizedBox(height: 24),
                TextField(
                  controller: _phone,
                  keyboardType: TextInputType.phone,
                  decoration: _dec("Phone", Icons.phone_rounded),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _password,
                  obscureText: true,
                  decoration: _dec("Password", Icons.lock_rounded),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!,
                      style: const TextStyle(color: AppColors.riskyRed, fontWeight: FontWeight.w600)),
                ],
                const SizedBox(height: 20),
                SizedBox(
                  height: 52,
                  child: ElevatedButton(
                    onPressed: _busy ? null : _signIn,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.safeGreen,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppRadii.card),
                        side: const BorderSide(color: AppColors.black, width: 2),
                      ),
                    ),
                    child: _busy
                        ? const SizedBox(
                            width: 20, height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.white))
                        : const Text("SIGN IN",
                            style: TextStyle(color: AppColors.white, fontWeight: FontWeight.w900)),
                  ),
                ),
                const SizedBox(height: 6),
                OutlinedButton(
                  onPressed: _busy
                      ? null
                      : () => Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => const SignupScreen()),
                          ),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: AppColors.black, width: 1.8),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadii.card)),
                    minimumSize: const Size.fromHeight(50),
                  ),
                  child: const Text("Create new account",
                      style: TextStyle(color: AppColors.black, fontWeight: FontWeight.w800)),
                ),
                const SizedBox(height: 4),
                TextButton(
                  onPressed: _busy ? null : () => ref.read(authProvider.notifier).continueAsGuest(),
                  child: const Text("Continue as guest (demo)",
                      style: TextStyle(color: AppColors.black, fontWeight: FontWeight.w700)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  InputDecoration _dec(String label, IconData icon) => InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.card),
          borderSide: const BorderSide(color: AppColors.black, width: 2),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.card),
          borderSide: const BorderSide(color: AppColors.black, width: 1.5),
        ),
      );
}
