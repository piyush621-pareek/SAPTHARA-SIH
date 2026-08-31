import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:saptahara/app/auth.dart';
import 'package:saptahara/core/theme/app_theme.dart';

/// Create a new account. Anyone (driver or field officer) can self-register;
/// the account is stored in the backend database and they are signed in.
class SignupScreen extends ConsumerStatefulWidget {
  const SignupScreen({super.key});
  @override
  ConsumerState<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends ConsumerState<SignupScreen> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  final _state = TextEditingController();
  String _role = 'driver'; // 'driver' or 'field_officer'
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _password.dispose();
    _state.dispose();
    super.dispose();
  }

  Future<void> _create() async {
    if (_name.text.trim().length < 2) {
      setState(() => _error = 'Enter your full name.');
      return;
    }
    if (_phone.text.trim().length < 8) {
      setState(() => _error = 'Enter a valid phone number.');
      return;
    }
    if (_password.text.length < 6) {
      setState(() => _error = 'Password must be at least 6 characters.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    final err = await ref.read(authProvider.notifier).register(
          fullName: _name.text.trim(),
          phone: _phone.text.trim(),
          password: _password.text,
          role: _role,
          homeState: _state.text.trim(),
        );
    if (!mounted) return;
    if (err == null) {
      Navigator.of(context).pop(); // signed in — _Root shows the app shell
    } else {
      setState(() {
        _busy = false;
        _error = err;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.white,
      appBar: AppBar(title: const Text('Create Account')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 8),
              const Text('I am a', style: TextStyle(fontWeight: FontWeight.w800)),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(child: _roleCard('driver', 'Driver', Icons.local_shipping_rounded)),
                  const SizedBox(width: 10),
                  Expanded(child: _roleCard('field_officer', 'Field Officer', Icons.badge_rounded)),
                ],
              ),
              const SizedBox(height: 18),
              TextField(controller: _name, decoration: _dec('Full name', Icons.person_rounded)),
              const SizedBox(height: 12),
              TextField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                decoration: _dec('Phone number', Icons.phone_rounded),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _password,
                obscureText: true,
                decoration: _dec('Password (min 6 chars)', Icons.lock_rounded),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _state,
                decoration: _dec('Home state (optional)', Icons.map_rounded),
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
                  onPressed: _busy ? null : _create,
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
                      : const Text('CREATE ACCOUNT',
                          style: TextStyle(color: AppColors.white, fontWeight: FontWeight.w900)),
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Your account is stored securely on the NER server (password encrypted). '
                'You can sign in from any device.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: AppColors.black),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _roleCard(String value, String label, IconData icon) {
    final selected = _role == value;
    return InkWell(
      onTap: () => setState(() => _role = value),
      borderRadius: BorderRadius.circular(AppRadii.card),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: selected ? AppColors.safeGreen : AppColors.white,
          borderRadius: BorderRadius.circular(AppRadii.card),
          border: Border.all(color: AppColors.black, width: selected ? 2.5 : 1.5),
        ),
        child: Column(
          children: [
            Icon(icon, color: selected ? AppColors.white : AppColors.black, size: 30),
            const SizedBox(height: 6),
            Text(label,
                style: TextStyle(
                    color: selected ? AppColors.white : AppColors.black,
                    fontWeight: FontWeight.w800)),
          ],
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
