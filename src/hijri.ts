import { Language } from './types';

export interface HijriDate {
  hy: number; // Year (e.g. 1447)
  hm: number; // Month (1-12)
  hd: number; // Day (1-30)
}

export const HIJRI_MONTHS_AR = [
  "محرم",
  "صفر",
  "ربيع الأول",
  "ربيع الآخر",
  "جمادى الأولى",
  "جمادى الآخرة",
  "رجب",
  "شعبان",
  "رمضان",
  "شوال",
  "ذو القعدة",
  "ذو الحجة"
];

export const HIJRI_MONTHS_EN = [
  "Muharram",
  "Safar",
  "Rabi' al-Awwal",
  "Rabi' al-Thani",
  "Jumada al-Awwal",
  "Jumada al-Thani",
  "Rajab",
  "Sha'ban",
  "Ramadan",
  "Shawwal",
  "Dhu al-Qi'dah",
  "Dhu al-Hijjah"
];

/**
 * Converts a Gregorian Date to Hijri Date (Umm al-Qura calendar with accurate KSA timezone alignment)
 */
export function gregorianToHijri(date: Date): HijriDate {
  try {
    const formatter = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
      calendar: 'islamic-umalqura',
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      timeZone: 'Asia/Riyadh'
    });
    
    const parts = formatter.formatToParts(date);
    let hd = 1;
    let hm = 1;
    let hy = 1447;
    
    for (const part of parts) {
      if (part.type === 'day') {
        hd = parseInt(part.value, 10);
      } else if (part.type === 'month') {
        hm = parseInt(part.value, 10);
      } else if (part.type === 'year') {
        hy = parseInt(part.value, 10);
      }
    }
    
    return { hy, hm, hd };
  } catch (e) {
    const gYear = date.getFullYear();
    const gMonth = date.getMonth() + 1;
    const gDay = date.getDate();
  
    let jd = 0;
    if (gYear > 1582 || (gYear === 1582 && gMonth > 10) || (gYear === 1582 && gMonth === 10 && gDay >= 15)) {
      jd = Math.floor((1461 * (gYear + 4800 + Math.floor((gMonth - 14) / 12))) / 4) +
           Math.floor((367 * (gMonth - 2 - 12 * Math.floor((gMonth - 14) / 12))) / 12) -
           Math.floor((3 * Math.floor((gYear + 4900 + Math.floor((gMonth - 14) / 12)) / 100)) / 4) +
           gDay - 32075;
    } else {
      jd = 367 * gYear - Math.floor((7 * (gYear + 5001 + Math.floor((gMonth - 9) / 7))) / 4) +
           Math.floor((275 * gMonth) / 9) + gDay + 1729777;
    }
  
    const l = jd - 1948440; // Fixed: Removed the incorrect +385 offset shift
    const n = Math.floor((l - 1) / 10631);
    const i = l - 10631 * n;
    const j = Math.floor((i - 1) / 354);
    const k = i - 354 * j - Math.floor((3 + 11 * j) / 30);
    let hy = 30 * n + j + 1;
    let hm = Math.floor((k + 28.5) / 29.5) + 1;
    let hd = k - Math.floor(29.5 * (hm - 1)) + 1;
  
    if (hm > 12) hm = 12;
    if (hd > 30) hd = 30;
  
    return { hy, hm, hd };
  }
}

/**
 * Converts a Hijri Date to Gregorian Date
 */
export function hijriToGregorian(hy: number, hm: number, hd: number): Date {
  try {
    let gYear = Math.floor(hy * 0.97 + 622);
    let guess = new Date(gYear, hm - 1, hd);
    
    for (let iter = 0; iter < 10; iter++) {
      const hGuess = gregorianToHijri(guess);
      if (hGuess.hy === hy && hGuess.hm === hm && hGuess.hd === hd) {
        return guess;
      }
      
      const diffDays = (hy - hGuess.hy) * 354.37 + (hm - hGuess.hm) * 29.53 + (hd - hGuess.hd);
      guess = new Date(guess.getTime() + Math.round(diffDays) * 86400000);
    }
    return guess;
  } catch (e) {
    const jd = hd + Math.ceil(29.5 * (hm - 1)) + (hy - 1) * 354 + Math.floor((3 + 11 * hy) / 30) + 1948440; // Fixed: Removed incorrect -385 shift
    
    const l = jd + 68569;
    const n = Math.floor((497244 * l) / 1825242);
    const i = l - Math.floor((1825242 * n + 3) / 497244);
    const j = Math.floor((4000 * (i + 1)) / 1461001);
    const k = i - Math.floor((1461001 * j) / 4000) + 31;
    const y = Math.floor((80 * k) / 2447);
    const d = k - Math.floor((2447 * y) / 80);
    const m = y + 2 - 12 * Math.floor(y / 11);
    const gYear = 100 * (n - 49) + j + Math.floor(m / 9);
    const gMonth = m - 1; // 0-indexed in JS
    
    return new Date(gYear, gMonth, d);
  }
}

/**
 * Formats a Hijri Date string (YYYY-MM-DD) into a readable localized format
 */
export function formatHijriString(hijriStr: string, lang: Language): string {
  if (!hijriStr) return "";
  const parts = hijriStr.split("-");
  if (parts.length !== 3) return hijriStr;
  
  const hy = parseInt(parts[0], 10);
  const hm = parseInt(parts[1], 10);
  const hd = parseInt(parts[2], 10);
  
  if (isNaN(hy) || isNaN(hm) || isNaN(hd) || hm < 1 || hm > 12) {
    return hijriStr;
  }

  const monthName = lang === 'ar' ? HIJRI_MONTHS_AR[hm - 1] : HIJRI_MONTHS_EN[hm - 1];
  
  if (lang === 'ar') {
    // Standard Arabic numerals or native formatting
    return `${hd} ${monthName} ${hy} هـ`;
  } else {
    return `${hd} ${monthName} ${hy} AH`;
  }
}

/**
 * Formats a HijriDate object into a readable localized format
 */
export function formatHijriDate(date: HijriDate, lang: Language): string {
  const monthName = lang === 'ar' ? HIJRI_MONTHS_AR[date.hm - 1] : HIJRI_MONTHS_EN[date.hm - 1];
  if (lang === 'ar') {
    return `${date.hd} ${monthName} ${date.hy} هـ`;
  } else {
    return `${date.hd} ${monthName} ${date.hy} AH`;
  }
}

/**
 * Standardizes a Hijri string format into YYYY-MM-DD
 */
export function toHijriString(hy: number, hm: number, hd: number): string {
  return `${hy}-${String(hm).padStart(2, '0')}-${String(hd).padStart(2, '0')}`;
}
