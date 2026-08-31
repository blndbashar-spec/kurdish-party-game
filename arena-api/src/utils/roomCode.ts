// پیتە و ژمارە سەرنخۆشەکان — ئەو پیتە/ژمارەیە لەدەست دەدرێن کە لە یەکتر
// دەکەونەوە (I/L, O/0/1) بۆ ئەوەی کۆدەکە بە ئاسانی بخرێتە شوێن
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(length = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}
