import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:saptahara/core/storage/local_store.dart';

/// Lightweight multilingual support (PS 26002 h). The user's language is
/// persisted and read directly by widgets via [languageProvider] + [tr]; we do
/// not force the MaterialApp locale, which keeps this decoupled from Flutter's
/// built-in localisation set (so Assamese, which Flutter lacks, works cleanly).
class AppStrings {
  AppStrings._();

  /// Language code -> native display name (used by the Settings selector).
  static const supported = <String, String>{
    'en': 'English',
    'hi': 'हिन्दी',
    'as': 'অসমীয়া',
    'bn': 'বাংলা',
  };

  static const Map<String, Map<String, String>> _t = {
    'navHome': {'en': 'Home', 'hi': 'होम', 'as': 'ঘৰ', 'bn': 'হোম'},
    'navRoute': {'en': 'Route', 'hi': 'मार्ग', 'as': 'পথ', 'bn': 'রুট'},
    'navReport': {'en': 'Report', 'hi': 'रिपोर्ट', 'as': 'প্ৰতিবেদন', 'bn': 'রিপোর্ট'},
    'navProfile': {'en': 'Profile', 'hi': 'प्रोफ़ाइल', 'as': 'প্ৰ’ফাইল', 'bn': 'প্রোফাইল'},
    'navSettings': {'en': 'Settings', 'hi': 'सेटिंग्स', 'as': 'ছেটিংছ', 'bn': 'সেটিংস'},
    'currentAlerts': {
      'en': 'Current Alerts',
      'hi': 'वर्तमान अलर्ट',
      'as': 'বৰ্তমান সতৰ্কবাণী',
      'bn': 'বর্তমান সতর্কতা'
    },
    'noAlerts': {
      'en': 'No active alerts.',
      'hi': 'कोई सक्रिय अलर्ट नहीं।',
      'as': 'কোনো সক্ৰিয় সতৰ্কবাণী নাই।',
      'bn': 'কোনো সক্রিয় সতর্কতা নেই।'
    },
    'sos': {
      'en': 'SOS — Emergency',
      'hi': 'एसओएस — आपातकाल',
      'as': 'এছঅ’এছ — জৰুৰীকালীন',
      'bn': 'এসওএস — জরুরি'
    },
    'liveTracking': {
      'en': 'Live Tracking',
      'hi': 'लाइव ट्रैकिंग',
      'as': 'জীৱন্ত ট্ৰেকিং',
      'bn': 'লাইভ ট্র্যাকিং'
    },
    'createReport': {
      'en': 'Create Field Report',
      'hi': 'फील्ड रिपोर्ट बनाएं',
      'as': 'ক্ষেত্ৰ প্ৰতিবেদন সৃষ্টি কৰক',
      'bn': 'ফিল্ড রিপোর্ট তৈরি করুন'
    },
    'takePhoto': {
      'en': 'Tap to take / attach photo',
      'hi': 'फ़ोटो लेने / जोड़ने के लिए टैप करें',
      'as': 'ফটো ল’বলৈ / সংলগ্ন কৰিবলৈ টিপক',
      'bn': 'ছবি তুলতে / যুক্ত করতে ট্যাপ করুন'
    },
    'language': {'en': 'Language', 'hi': 'भाषा', 'as': 'ভাষা', 'bn': 'ভাষা'},
    'backendServer': {
      'en': 'Backend Server',
      'hi': 'बैकएंड सर्वर',
      'as': 'বেকএণ্ড ছাৰ্ভাৰ',
      'bn': 'ব্যাকএন্ড সার্ভার'
    },
    'save': {'en': 'Save', 'hi': 'सहेजें', 'as': 'ছেভ কৰক', 'bn': 'সংরক্ষণ'},
    'reset': {'en': 'Reset', 'hi': 'रीसेट', 'as': 'ৰিছেট', 'bn': 'রিসেট'},
    'submitReport': {
      'en': 'Save Report',
      'hi': 'रिपोर्ट सहेजें',
      'as': 'প্ৰতিবেদন ছেভ কৰক',
      'bn': 'রিপোর্ট সংরক্ষণ'
    },
    'streamingLive': {
      'en': 'Streaming live to dispatch',
      'hi': 'डिस्पैच को लाइव भेजा जा रहा है',
      'as': 'ডিছপেচলৈ জীৱন্ত পঠিওৱা হৈছে',
      'bn': 'ডিসপ্যাচে লাইভ পাঠানো হচ্ছে'
    },
    'tapToGoOnline': {
      'en': 'Tap to go online',
      'hi': 'ऑनलाइन होने के लिए टैप करें',
      'as': 'অনলাইন হ’বলৈ টিপক',
      'bn': 'অনলাইন হতে ট্যাপ করুন'
    },
    'satelliteRisk': {
      'en': 'Satellite Landslide Risk (ISRO)',
      'hi': 'सैटेलाइट भूस्खलन जोखिम (इसरो)',
      'as': 'উপগ্ৰহ ভূমিস্খলন বিপদ (ইছৰো)',
      'bn': 'স্যাটেলাইট ভূমিধস ঝুঁকি (ইসরো)'
    },
    'takeRecommended': {
      'en': 'Take Recommended (Safest)',
      'hi': 'अनुशंसित लें (सबसे सुरक्षित)',
      'as': 'অনুমোদিত লওক (সবাতোকৈ সুৰক্ষিত)',
      'bn': 'প্রস্তাবিত নিন (সবচেয়ে নিরাপদ)'
    },
    'failedRoutes': {
      'en': 'Failed to load routes',
      'hi': 'मार्ग लोड करने में विफल',
      'as': 'পথ ল’ড কৰাত ব্যৰ্থ',
      'bn': 'রুট লোড করতে ব্যর্থ'
    },
    'failedAlerts': {
      'en': 'Failed to load alerts',
      'hi': 'अलर्ट लोड करने में विफल',
      'as': 'সতৰ্কবাণী ল’ড কৰাত ব্যৰ্থ',
      'bn': 'সতর্কতা লোড করতে ব্যর্থ'
    },
    'availableRoutes': {
      'en': 'Available Routes',
      'hi': 'उपलब्ध मार्ग',
      'as': 'উপলব্ধ পথ',
      'bn': 'উপলব্ধ রুট'
    },
    'reportType': {
      'en': 'Report Type',
      'hi': 'रिपोर्ट प्रकार',
      'as': 'প্ৰতিবেদনৰ ধৰণ',
      'bn': 'রিপোর্টের ধরন'
    },
    'description': {
      'en': 'Description',
      'hi': 'विवरण',
      'as': 'বিৱৰণ',
      'bn': 'বিবরণ'
    },
    'connectivity': {
      'en': 'Connectivity',
      'hi': 'कनेक्टिविटी',
      'as': 'সংযোগ',
      'bn': 'সংযোগ'
    },
    'offlineMode': {
      'en': 'Offline Mode',
      'hi': 'ऑफ़लाइन मोड',
      'as': 'অফলাইন ম’ড',
      'bn': 'অফলাইন মোড'
    },
    'dataSync': {
      'en': 'Data Sync',
      'hi': 'डेटा सिंक',
      'as': 'ডেটা ছিংক',
      'bn': 'ডেটা সিঙ্ক'
    },
    'syncNow': {
      'en': 'SYNC NOW',
      'hi': 'अभी सिंक करें',
      'as': 'এতিয়াই ছিংক কৰক',
      'bn': 'এখনই সিঙ্ক করুন'
    },
    'notificationsTitle': {
      'en': 'Notifications',
      'hi': 'सूचनाएं',
      'as': 'জাননী',
      'bn': 'বিজ্ঞপ্তি'
    },
    'mapStyle': {
      'en': 'Map Style',
      'hi': 'मानचित्र शैली',
      'as': 'মানচিত্ৰ শৈলী',
      'bn': 'মানচিত্র শৈলী'
    },
    'locationPermission': {
      'en': 'Location Permission',
      'hi': 'स्थान अनुमति',
      'as': 'অৱস্থানৰ অনুমতি',
      'bn': 'অবস্থানের অনুমতি'
    },
    'privacySecurity': {
      'en': 'Privacy & Security',
      'hi': 'गोपनीयता और सुरक्षा',
      'as': 'গোপনীয়তা আৰু সুৰক্ষা',
      'bn': 'গোপনীয়তা ও নিরাপত্তা'
    },
    'profileTitle': {
      'en': 'Profile',
      'hi': 'प्रोफ़ाइल',
      'as': 'প্ৰ’ফাইল',
      'bn': 'প্রোফাইল'
    },
    'reportsFiled': {
      'en': 'Reports filed',
      'hi': 'दर्ज रिपोर्ट',
      'as': 'দাখিল কৰা প্ৰতিবেদন',
      'bn': 'দাখিল করা রিপোর্ট'
    },
    'logout': {
      'en': 'Log out',
      'hi': 'लॉग आउट',
      'as': 'লগ আউট',
      'bn': 'লগ আউট'
    },
  };

  static String t(String key, String lang) =>
      _t[key]?[lang] ?? _t[key]?['en'] ?? key;
}

/// Current UI language code, persisted across launches.
class LanguageController extends StateNotifier<String> {
  LanguageController() : super(LocalStore.getString('lang') ?? 'en');

  void set(String lang) {
    state = lang;
    LocalStore.setString('lang', lang);
  }
}

final languageProvider =
    StateNotifierProvider<LanguageController, String>((ref) => LanguageController());
