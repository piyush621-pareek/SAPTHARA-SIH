import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * Lightweight 4-language i18n for the command dashboard — mirrors the phone
 * app's language support (English / Hindi / Assamese / Bengali). Only the
 * operator-facing labels are translated; live data (place names, plates) stays
 * as-is. Missing keys fall back to English.
 */
export type Lang = "en" | "hi" | "as" | "bn";

export const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "as", label: "অসমীয়া" },
  { code: "bn", label: "বাংলা" },
];

type Dict = Record<string, string>;

const STRINGS: Record<Lang, Dict> = {
  en: {
    brandTitle: "Command & Control",
    brandSub: "North Eastern Region",
    active: "On the move",
    hazards: "Hazards",
    breaches: "Breaches",
    delayed: "Delayed",
    sos: "SOS",
    live: "Live",
    reconnecting: "Reconnecting…",
    fleet: "Our Fleet",
    liveAlerts: "What's happening now",
    allClear: "All clear — every corridor looks good right now.",
    district: "District Connectivity",
    ledger: "Trust Ledger",
    verified: "Verified",
    mapHint: "Tap anywhere on the map to check its hazard risk",
    planRoute: "Plan a trip",
    from: "From",
    to: "To",
    findRoute: "Find safe route",
    reportHazard: "Report a hazard",
    report: "Report",
    submit: "Send report",
    cancel: "Cancel",
    notes: "What did you see?",
    urgency: "How urgent?",
    hazardType: "Type",
    reportSent: "Thank you — your report has reached the control room.",
    signIn: "Sign in",
    guest: "Look around as guest",
    language: "Language",
    noFix: "waiting for GPS…",
    clearRoute: "Clear road ahead",
    rerouted: "Safer detour suggested",
  },
  hi: {
    brandTitle: "कमांड और नियंत्रण",
    brandSub: "स्मार्ट लॉजिस्टिक्स · पूर्वोत्तर क्षेत्र",
    active: "चल रहे",
    hazards: "खतरे",
    breaches: "उल्लंघन",
    delayed: "विलंबित",
    sos: "एसओएस",
    live: "लाइव",
    reconnecting: "पुनः जुड़ रहा…",
    fleet: "हमारा बेड़ा",
    liveAlerts: "अभी क्या हो रहा है",
    allClear: "सब ठीक है — अभी हर मार्ग सुरक्षित दिख रहा है।",
    district: "जिला संपर्क",
    ledger: "विश्वास बही",
    verified: "सत्यापित",
    mapHint: "किसी भी स्थान का खतरा जांचने के लिए मानचित्र पर टैप करें",
    planRoute: "यात्रा की योजना",
    from: "कहाँ से",
    to: "कहाँ तक",
    findRoute: "सुरक्षित मार्ग खोजें",
    reportHazard: "खतरे की सूचना दें",
    report: "रिपोर्ट",
    submit: "रिपोर्ट भेजें",
    cancel: "रद्द करें",
    notes: "आपने क्या देखा?",
    urgency: "कितना जरूरी?",
    hazardType: "प्रकार",
    reportSent: "धन्यवाद — आपकी रिपोर्ट नियंत्रण कक्ष तक पहुँच गई।",
    signIn: "साइन इन करें",
    guest: "अतिथि के रूप में देखें",
    language: "भाषा",
    noFix: "जीपीएस की प्रतीक्षा…",
    clearRoute: "आगे रास्ता साफ",
    rerouted: "सुरक्षित मार्ग सुझाया गया",
  },
  as: {
    brandTitle: "কমাণ্ড আৰু নিয়ন্ত্ৰণ",
    brandSub: "স্মাৰ্ট লজিষ্টিক্স · উত্তৰ-পূব অঞ্চল",
    active: "চলি আছে",
    hazards: "বিপদ",
    breaches: "উলংঘন",
    delayed: "পলম",
    sos: "SOS",
    live: "লাইভ",
    reconnecting: "পুনৰ সংযোগ…",
    fleet: "আমাৰ বহৰ",
    liveAlerts: "এতিয়া কি হৈ আছে",
    allClear: "সকলো ঠিক আছে — এতিয়া প্ৰতিটো পথ সুৰক্ষিত।",
    district: "জিলা সংযোগ",
    ledger: "বিশ্বাস লেজাৰ",
    verified: "সত্যাপিত",
    mapHint: "যিকোনো ঠাইৰ বিপদ চাবলৈ মেপত টেপ কৰক",
    planRoute: "যাত্ৰাৰ পৰিকল্পনা",
    from: "ক'ৰ পৰা",
    to: "ক'লৈ",
    findRoute: "সুৰক্ষিত পথ বিচাৰক",
    reportHazard: "বিপদৰ খবৰ দিয়ক",
    report: "প্ৰতিবেদন",
    submit: "প্ৰতিবেদন পঠিয়াওক",
    cancel: "বাতিল",
    notes: "আপুনি কি দেখিলে?",
    urgency: "কিমান জৰুৰী?",
    hazardType: "প্ৰকাৰ",
    reportSent: "ধন্যবাদ — আপোনাৰ প্ৰতিবেদন নিয়ন্ত্ৰণ কক্ষত পালেহি।",
    signIn: "ছাইন ইন",
    guest: "অতিথি হিচাপে চাওক",
    language: "ভাষা",
    noFix: "জিপিএছৰ বাবে অপেক্ষা…",
    clearRoute: "আগৰ পথ পৰিষ্কাৰ",
    rerouted: "সুৰক্ষিত পথ পৰামৰ্শ",
  },
  bn: {
    brandTitle: "কমান্ড ও নিয়ন্ত্রণ",
    brandSub: "স্মার্ট লজিস্টিক্স · উত্তর-পূর্বাঞ্চল",
    active: "চলছে",
    hazards: "বিপদ",
    breaches: "লঙ্ঘন",
    delayed: "বিলম্বিত",
    sos: "SOS",
    live: "লাইভ",
    reconnecting: "পুনঃসংযোগ…",
    fleet: "আমাদের বহর",
    liveAlerts: "এখন কী ঘটছে",
    allClear: "সব ঠিক আছে — এখন প্রতিটি পথ নিরাপদ দেখাচ্ছে।",
    district: "জেলা সংযোগ",
    ledger: "বিশ্বাস লেজার",
    verified: "যাচাইকৃত",
    mapHint: "যেকোনো স্থানের বিপদ দেখতে মানচিত্রে ট্যাপ করুন",
    planRoute: "যাত্রার পরিকল্পনা",
    from: "কোথা থেকে",
    to: "কোথায়",
    findRoute: "নিরাপদ পথ খুঁজুন",
    reportHazard: "বিপদের খবর দিন",
    report: "প্রতিবেদন",
    submit: "প্রতিবেদন পাঠান",
    cancel: "বাতিল",
    notes: "আপনি কী দেখলেন?",
    urgency: "কতটা জরুরি?",
    hazardType: "ধরন",
    reportSent: "ধন্যবাদ — আপনার প্রতিবেদন নিয়ন্ত্রণ কক্ষে পৌঁছেছে।",
    signIn: "সাইন ইন",
    guest: "অতিথি হিসেবে দেখুন",
    language: "ভাষা",
    noFix: "জিপিএসের অপেক্ষায়…",
    clearRoute: "সামনে পথ পরিষ্কার",
    rerouted: "নিরাপদ পথ প্রস্তাবিত",
  },
};

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<Ctx>({
  lang: "en",
  setLang: () => {},
  t: (k) => k,
});

const LANG_KEY = "ner_dash_lang";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      return (localStorage.getItem(LANG_KEY) as Lang) || "en";
    } catch {
      return "en";
    }
  });
  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      /* private mode */
    }
  };
  const t = (key: string) => STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang(): Ctx {
  return useContext(LanguageContext);
}

/** Compact language dropdown for the top bar. */
export function LanguageSwitcher() {
  const { lang, setLang } = useLang();
  return (
    <select
      className="lang-switch"
      value={lang}
      onChange={(e) => setLang(e.target.value as Lang)}
      aria-label="Language"
    >
      {LANGS.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}
