import bcrypt from 'bcryptjs';
import { inArray } from 'drizzle-orm';
import { client, db } from '../config/db';
import { categories, games, questions, users } from '../models/schema';

// ═══════════════════════════════════════════════════════════════
//  Seed — ١٨ یاری ڕەقەبەری بە کوردی (سۆرانی)
//  بەکارهێنان: npm run seed
//  (idempotent: پرسیارەکان پێش هەر جارێک دەسڕدرێنەوە)
// ═══════════════════════════════════════════════════════════════

const catData = [
  { slug: 'general', nameKu: 'گشتی', nameEn: 'General' },
  { slug: 'kurdish', nameKu: 'کوردی', nameEn: 'Kurdish' },
  { slug: 'nature', nameKu: 'دەشت و سروشت', nameEn: 'Nature' },
  { slug: 'music', nameKu: 'مۆسیقا', nameEn: 'Music' },
  { slug: 'sport', nameKu: 'وەرزش', nameEn: 'Sport' },
  { slug: 'humor', nameKu: 'ڕەنگاوڕەنگ', nameEn: 'Humor' },
];

const gameData = [
  { slug: 'quiz', nameKu: 'پرسیار و وەڵام', nameEn: 'Quiz', icon: '❓', color: '#735cff', minPlayers: 2, maxPlayers: 12, config: { timeLimit: 15, rounds: 3, pointsPerCorrect: 10 } },
  { slug: 'trivia', nameKu: 'زانیاری گشتی', nameEn: 'General Trivia', icon: '🧠', color: '#4b8cff', minPlayers: 2, maxPlayers: 10, config: { timeLimit: 12, rounds: 3, pointsPerCorrect: 10 } },
  { slug: 'emoji', nameKu: 'ڕووخۆڵ', nameEn: 'Emoji Guess', icon: '😄', color: '#ffbd3f', minPlayers: 2, maxPlayers: 10, config: { timeLimit: 20, rounds: 2, pointsPerCorrect: 5 } },
  {
    slug: 'spy', nameKu: 'جاسوس', nameEn: 'Spy', icon: '🕵️', color: '#64748b', minPlayers: 3, maxPlayers: 10,
    config: { timeLimit: 30, rounds: 1, pointsPerCorrect: 5, items: ['بازاڕ', 'کافیتێری', 'پارک', 'نەخۆشخانە', 'قەرەوول', 'پەیمانگای وەرزشی', 'هەوانێگە', 'دەرگاوی هەولێر'] },
  },
  { slug: 'bomb', nameKu: 'بەمبە', nameEn: 'Bomb', icon: '💣', color: '#f25c69', minPlayers: 2, maxPlayers: 10, config: { timeLimit: 12, rounds: 1, pointsPerCorrect: 0 } },
  { slug: 'truth-dare', nameKu: 'ڕاستی و داوا', nameEn: 'Truth & Dare', icon: '🎲', color: '#ff4f9a', minPlayers: 2, maxPlayers: 12, config: { timeLimit: 30, rounds: 1, pointsPerCorrect: 0 } },
  { slug: 'charades', nameKu: 'وەشان', nameEn: 'Charades', icon: '🎬', color: '#14b8a6', minPlayers: 3, maxPlayers: 12, config: { timeLimit: 60, rounds: 1, pointsPerCorrect: 10 } },
  { slug: 'word-chain', nameKu: 'زنجیرەی وشە', nameEn: 'Word Chain', icon: '🔗', color: '#24bd7b', minPlayers: 2, maxPlayers: 10, config: { timeLimit: 15, rounds: 3, pointsPerCorrect: 5 } },
  { slug: 'memory', nameKu: 'بیری بۆشە', nameEn: 'Memory Match', icon: '🃏', color: '#19b8d0', minPlayers: 2, maxPlayers: 8, config: { timeLimit: 10, rounds: 1, pointsPerCorrect: 5 } },
  { slug: 'reaction', nameKu: 'خێراتی', nameEn: 'Reaction', icon: '⚡', color: '#ff8b3f', minPlayers: 2, maxPlayers: 8, config: { timeLimit: 5, rounds: 5, pointsPerCorrect: 10 } },
  { slug: 'red-hunt', nameKu: 'گەڕۆکی سوور', nameEn: 'Red Hunt', icon: '🔴', color: '#e63946', minPlayers: 2, maxPlayers: 8, config: { timeLimit: 8, rounds: 5, pointsPerCorrect: 10 } },
  { slug: 'quick-math', nameKu: 'ژمارە خێرا', nameEn: 'Quick Math', icon: '➕', color: '#7c5cff', minPlayers: 2, maxPlayers: 10, config: { timeLimit: 10, rounds: 3, pointsPerCorrect: 5 } },
  { slug: 'guess-price', nameKu: 'بڕوانی بەها', nameEn: 'Price Guess', icon: '💰', color: '#f4b942', minPlayers: 2, maxPlayers: 8, config: { timeLimit: 15, rounds: 3, pointsPerCorrect: 10 } },
  { slug: 'taboo', nameKu: 'وشە قەدەغە', nameEn: 'Taboo', icon: '🚫', color: '#9333ea', minPlayers: 3, maxPlayers: 10, config: { timeLimit: 45, rounds: 2, pointsPerCorrect: 10 } },
  { slug: 'story', nameKu: 'چیرۆک بچووک', nameEn: 'Story Chain', icon: '📖', color: '#0ea5e9', minPlayers: 2, maxPlayers: 12, config: { timeLimit: 20, rounds: 1, pointsPerCorrect: 5 } },
  { slug: 'rps', nameKu: 'بەتڵ و شوڕ', nameEn: 'Rock Paper Scissors', icon: '✊', color: '#5b6b7f', minPlayers: 2, maxPlayers: 8, config: { timeLimit: 5, rounds: 3, pointsPerCorrect: 10 } },
  { slug: 'lucky-number', nameKu: 'ژمارەی بەخت', nameEn: 'Lucky Number', icon: '🍀', color: '#16a34a', minPlayers: 2, maxPlayers: 10, config: { timeLimit: 20, rounds: 3, pointsPerCorrect: 5 } },
  { slug: 'karaoke', nameKu: 'گۆرانی', nameEn: 'Karaoke', icon: '🎤', color: '#ec4899', minPlayers: 2, maxPlayers: 12, config: { timeLimit: 60, rounds: 1, pointsPerCorrect: 10 } },
];

interface SeedQuestion {
  game: string;
  category?: string;
  content: string;
  options?: string[];
  correctIndex?: number;
  tags?: string[];
}

const questionData: SeedQuestion[] = [
  // ── quiz ──────────────────────────────────────────────────────
  { game: 'quiz', category: 'general', content: 'پایتەختی عێراق کەراشتە؟', options: ['بەغدا', 'هەولێر', 'سلێمانی', 'دهۆک'], correctIndex: 0, tags: ['جوگرافی'] },
  { game: 'quiz', category: 'general', content: 'گەورەترین وڵاتی جیهان بە ڕووی کەشتی کەسە؟', options: ['ڕوسیا', 'کانادا', 'چین', 'ئەمریکا'], correctIndex: 0, tags: ['جوگرافی'] },
  { game: 'quiz', category: 'kurdish', content: 'لە هەرێمی کوردستان چەند پارێزگا هەیە؟', options: ['٣', '٤', '٢', '٥'], correctIndex: 0, tags: ['کوردستان'] },
  { game: 'quiz', category: 'kurdish', content: '"دەروازەی کوردستان" چی ناوی لێدەن؟', options: ['هەولێر', 'سلێمانی', 'دهۆک', 'کەرکووک'], correctIndex: 0, tags: ['کوردستان'] },
  { game: 'quiz', category: 'kurdish', content: 'دووەم گەورەترین شاری هەرێم کەسە؟', options: ['سلێمانی', 'هەولێر', 'دهۆک', 'کەرکووک'], correctIndex: 0, tags: ['کوردستان'] },
  { game: 'quiz', category: 'general', content: 'چەند وڵات لە ڕێکخراوی نەتەوە یەکگرتووەکاندا هەیە؟', options: ['١٩٣', '١٩٠', '٢٠٠', '١٨٠'], correctIndex: 0, tags: ['گشتی'] },
  { game: 'quiz', category: 'nature', content: 'پەڕاوێزی دۆکان لە سەر ڕووباری چییە؟', options: ['زاوی چووەک', 'دێجلە', 'زاوی گەورە', 'سێیران'], correctIndex: 0, tags: ['سروشت'] },
  { game: 'quiz', category: 'kurdish', content: 'زەمانی کوردی چەند شێوەزاری سەرەکی هەیە؟', options: ['٢', '٣', '٤', '٥'], correctIndex: 0, tags: ['زمان'] },

  // ── trivia ────────────────────────────────────────────────────
  { game: 'trivia', category: 'kurdish', content: 'قەڵای هەولێر نزیکە بە چەند ساڵێکی مێژوو؟', options: ['٥٠٠٠ ساڵ', '١٠٠ ساڵ', '٥٠٠ ساڵ', '٢٠٠ ساڵ'], correctIndex: 0, tags: ['مێژوو'] },
  { game: 'trivia', category: 'general', content: 'یەکەم ژن کە خەڵاتی نۆبێل وەرگرت کەسە؟', options: ['ماریا کیری', 'کلارە بۆستۆک', 'ڕوزەلین یۆسڵین', 'دۆروثی وۆستەکت'], correctIndex: 0, tags: ['مێژوو'] },
  { game: 'trivia', category: 'kurdish', content: 'نەهەشتم لە ساڵی چی ڕوویدا؟', options: ['٢٠١٩', '٢٠١٤', '٢٠١٢', '٢٠٢١'], correctIndex: 0, tags: ['مێژوو'] },
  { game: 'trivia', category: 'kurdish', content: 'قەڵای ئامێدە لە پارێزگای چییە؟', options: ['سلێمانی', 'هەولێر', 'هەڵەبجە', 'دهۆک'], correctIndex: 0, tags: ['جوگرافی'] },
  { game: 'trivia', category: 'kurdish', content: '"هەڵۆ" لە کوردی چی واتایە؟', options: ['موجە', 'با', 'ئاژنگ', 'شەپۆل'], correctIndex: 0, tags: ['زمان'] },
  { game: 'trivia', category: 'nature', content: 'دەریای ڕێو لە نێوان کوردستان و چ وڵاتێکدایە؟', options: ['ئێران', 'تورکیا', 'سوریا', 'کەنداو'], correctIndex: 0, tags: ['سروشت'] },

  // ── emoji ─────────────────────────────────────────────────────
  { game: 'emoji', content: '🐘 — ئەم ڕووخۆلە چییە؟', options: ['گێلانە', 'مەشک', 'گێن', 'بۆچ'], correctIndex: 0, tags: ['ئەژدی'] },
  { game: 'emoji', content: '🐫 — ئەم ڕووخۆلە چییە؟', options: ['میتمە', 'ئەژدەها', 'گێل', 'مێشک'], correctIndex: 0, tags: ['ئەژدی'] },
  { game: 'emoji', category: 'nature', content: '🌊 — ئەم ڕووخۆلە چییە؟', options: ['دەریا', 'چیا', 'باغچە', 'بازاڕ'], correctIndex: 0, tags: ['سروشت'] },
  { game: 'emoji', content: '📖 — ئەم ڕووخۆلە چییە؟', options: ['کتێب', 'ڕۆژنامە', 'بۆمبەل', 'پەنجا'], correctIndex: 0, tags: ['گشتی'] },
  { game: 'emoji', category: 'sport', content: '⚽ — ئەم ڕووخۆلە چییە؟', options: ['تۆپی پێ', 'تینس', 'ڤۆلیبال', 'بۆولینگ'], correctIndex: 0, tags: ['وەرزش'] },
  { game: 'emoji', category: 'nature', content: '🌹 — ئەم ڕووخۆلە چییە؟', options: ['گوڵ', 'گوێز', 'گوێری', 'گوێڕ'], correctIndex: 0, tags: ['سروشت'] },

  // ── truth & dare ──────────────────────────────────────────────
  { game: 'truth-dare', category: 'humor', content: 'ڕاستی: بۆ هاوڕێیەکەت پەیامێک بنووسە کە چۆن سەیری لێدەکەیت — بە ڕاستی!' },
  { game: 'truth-dare', category: 'humor', content: 'ڕاستی: دوا شتەکەی خواردووت چی بوو؟' },
  { game: 'truth-dare', category: 'humor', content: 'ڕاستی: دوو وشەی سەرەتا بۆ ناوی کەسێک بنووسە کە تۆیە.' },
  { game: 'truth-dare', category: 'humor', content: 'ڕاستی: باشترین ئاژەڵی جیهان چییە و بۆچی؟' },
  { game: 'truth-dare', category: 'humor', content: 'داوا: بە دەنگی خۆڵەمێش دوو قەفەز قسە بکە.' },
  { game: 'truth-dare', category: 'humor', content: 'داوا: بە ٣٠ چرکە گەڕاوە لە ژوورەکە!' },
  { game: 'truth-dare', category: 'humor', content: 'داوا: وێنەیەکی خودی لەگەڵ کەسێک لە تەلەفۆنەکەت هەڵبژێرە (بێ پەیام)!' },
  { game: 'truth-dare', category: 'humor', content: 'داوا: دوو قەفەز "هێل" (پێچ) بکە بەبێ پێچوێنی!' },

  // ── charades ──────────────────────────────────────────────────
  { game: 'charades', category: 'general', content: 'گێلانە' },
  { game: 'charades', category: 'general', content: 'کەلوو' },
  { game: 'charades', category: 'general', content: 'چێز' },
  { game: 'charades', category: 'general', content: 'ئاگر' },
  { game: 'charades', category: 'general', content: 'مامۆستا' },
  { game: 'charades', category: 'general', content: 'کەڵک' },
  { game: 'charades', category: 'general', content: 'دەرگا' },
  { game: 'charades', category: 'music', content: 'مۆسیقا' },

  // ── guess price ───────────────────────────────────────────────
  { game: 'guess-price', content: 'بڕوانی: بلیتێکی فلیپ (هەواڵە) لە هەولێر بۆ سلێمانی بە نزیکەیی بەچەندە؟', options: ['٨٠٠ هەزار دینار', '٣ ملیۆن دینار', '١٠ ملیۆن دینار', '١٠٠ هەزار دینار'], correctIndex: 0, tags: ['بەها'] },
  { game: 'guess-price', content: 'بڕوانی: قەڵای هەولێر بە نزیکەیی چەند ساڵە لەمەوبەر؟', options: ['٥٠٠٠ ساڵ', '١٠٠٠ ساڵ', '٥٠٠ ساڵ', '٥٠ ساڵ'], correctIndex: 0, tags: ['مێژوو'] },
  { game: 'guess-price', content: 'بڕوانی: بەهای یەک لیتری شیری لە بازاڕ بە نزیکەیی بەچەندە؟', options: ['٥٠ دینار', '٥٠٠٠ دینار', '٥٠ هەزار دینار', '٥٠٠ دینار'], correctIndex: 0, tags: ['بەها'] },

  // ── story ─────────────────────────────────────────────────────
  { game: 'story', category: 'humor', content: 'دەستپێک: "لە شەوی مانگەدان، کەسێک دەستی کردە —"' },
  { game: 'story', category: 'humor', content: 'دەستپێک: "مێرێک بە تەلەفۆنەکەی دەکەوت کە —"' },
];

async function main() {
  // ١. پۆلەکان
  for (const c of catData) {
    await db.insert(categories).values(c).onConflictDoNothing().returning();
  }
  const catIds = new Map((await db.select().from(categories)).map((c) => [c.slug, c.id]));

  // ٢. یارییەکان
  for (const g of gameData) {
    await db.insert(games).values(g).onConflictDoNothing().returning();
  }
  const gameRows = await db.select().from(games);
  const gameIds = new Map(gameRows.map((g) => [g.slug, g.id]));

  // ٣. پرسیارەکان — سڕینەوەی کۆنان بۆ تۆمارکردنەوەی ئاسان
  const seedGameIds = gameData.map((g) => gameIds.get(g.slug)!).filter(Boolean);
  if (seedGameIds.length) {
    await db.delete(questions).where(inArray(questions.gameId, seedGameIds));
  }

  const rows = questionData.map((q) => ({
    gameId: gameIds.get(q.game)!,
    categoryId: q.category ? catIds.get(q.category) ?? null : null,
    content: q.content,
    options: q.options ?? null,
    correctIndex: q.correctIndex ?? null,
    difficulty: 1,
    tags: q.tags ?? [],
  }));
  if (rows.length) await db.insert(questions).values(rows);

  // ٤. بەکارهێنەری admin (تەنها بۆ development — وشەی نهێنی لەگەڵەوە دەگۆڕدرێت!)
  await db
    .insert(users)
    .values({
      username: 'admin',
      passwordHash: await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD ?? 'admin1234', 10),
      role: 'admin',
    })
    .onConflictDoNothing()
    .returning();

  console.log(
    `✅ Seed تەواو بوو: ${gameRows.length} یاری، ${catIds.size} پۆل، ${rows.length} پرسیار + 1 admin`,
  );
}

main()
  .catch((e) => {
    console.error('❌ Seed هەڵەیەکی ڕوویدا:', e);
    process.exitCode = 1;
  })
  .finally(() => {
    client.end().catch(() => {});
  });
