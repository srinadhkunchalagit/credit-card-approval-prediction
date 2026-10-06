// translations.js - 22 Official Languages of India + English reference
export const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'ur', name: 'Urdu', native: 'اردو' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'or', name: 'Odia', native: 'ଓଡ଼ିଆ' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'as', name: 'Assamese', native: 'অসমীয়া' },
  { code: 'ma', name: 'Maithili', native: 'मैथिली' },
  { code: 'sa', name: 'Sanskrit', native: 'संस्कृतम्' },
  { code: 'ne', name: 'Nepali', native: 'नेपाली' },
  { code: 'ko', name: 'Konkani', native: 'कोंकणी' },
  { code: 'sd', name: 'Sindhi', native: 'سنڌي / सिन्धी' },
  { code: 'dg', name: 'Dogri', native: 'डोगरी' },
  { code: 'mn', name: 'Manipuri', native: 'মৈতৈলোন্' },
  { code: 'bd', name: 'Bodo', native: 'बड़ो' },
  { code: 'st', name: 'Santali', native: 'ᱥᱟᱱᱛᱟᱲᱤ' },
  { code: 'ks', name: 'Kashmiri', native: 'कॉशुर' }
];

let translationsCache = null;

export async function getTranslations() {
  if (translationsCache) return translationsCache;
  try {
    const res = await fetch('/static/js/translations-data.json');
    translationsCache = await res.json();
    return translationsCache;
  } catch (err) {
    console.error('Error fetching translations data:', err);
    return {};
  }
}

export function translate(dict, lang, key, fallback = '') {
  if (!dict) return fallback;
  const langDict = dict[lang] || dict['en'] || {};
  return langDict[key] || dict['en']?.[key] || fallback;
}
