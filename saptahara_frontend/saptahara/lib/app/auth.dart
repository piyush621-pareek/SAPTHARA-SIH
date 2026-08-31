import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:saptahara/core/network/api_client.dart';
import 'package:saptahara/core/storage/local_store.dart';

class AuthState {
  final String? token;
  final String? name;
  final bool guest;
  const AuthState({this.token, this.name, this.guest = false});

  bool get isAuthenticated => token != null || guest;
  String get displayName => name ?? (guest ? "Guest" : "");
}

/// Handles login / guest / logout and attaches the JWT to the shared ApiClient.
/// A stored token is restored on start so sessions persist across restarts.
class AuthController extends StateNotifier<AuthState> {
  AuthController() : super(const AuthState()) {
    _restore();
  }

  void _restore() {
    final token = LocalStore.getString("auth_token");
    if (token != null) {
      ApiClient.instance.setAuthToken(token);
      state = AuthState(token: token, name: LocalStore.getString("auth_name"));
    }
  }

  /// Returns null on success, or an error message.
  Future<String?> login(String phone, String password) async {
    try {
      final res = await ApiClient.instance
          .postJson("/auth/login", {"phone": phone, "password": password});
      final data = res is Map ? res["data"] as Map? : null;
      final token = data?["token"]?.toString();
      final name = (data?["user"] as Map?)?["full_name"]?.toString();
      final refresh = data?["refreshToken"]?.toString();
      if (token == null) return "Unexpected response from server";
      ApiClient.instance.setAuthToken(token);
      await LocalStore.setString("auth_token", token);
      if (refresh != null) await LocalStore.setString("auth_refresh", refresh);
      if (name != null) await LocalStore.setString("auth_name", name);
      state = AuthState(token: token, name: name);
      return null;
    } catch (e) {
      return "Sign-in failed. Check your phone/password or connection.";
    }
  }

  void continueAsGuest() => state = const AuthState(guest: true);

  Future<void> logout() async {
    ApiClient.instance.setAuthToken(null);
    await LocalStore.remove("auth_token");
    await LocalStore.remove("auth_refresh");
    await LocalStore.remove("auth_name");
    state = const AuthState();
  }
}

final authProvider =
    StateNotifierProvider<AuthController, AuthState>((ref) => AuthController());
