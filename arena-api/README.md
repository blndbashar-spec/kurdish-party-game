# ڵەگەل هاڕێیان.🎮

API ی ماڵپەڕی یاری ڕەقەبەری **Arena** — سیستەمی ژووری زیندوو (realtime) بۆ یارییە ڕەقەبەرەکان بە کوردی (سۆرانی).

## تێکی (Stack)

| بەش | تێکی |
|---|---|
| ڕەنەندەر | Node.js ٢٠+ / Express.js / TypeScript |
| بنکەی داتا | PostgreSQL ١٦ + **Drizzle ORM** |
| کاش / خاڵ | Redis ٧ |
| ڕەقەبەری (realtime) | **Socket.io** — namespace-ی `/game` |
| نهێنی | JWT (access ١٥خ + refresh ٣٠ڕۆژ، httpOnly cookie، rotation) |
| شیکاری | **Zod** بۆ هەموو input-ەکان |
| سەلامەتی | Helmet + CSP، CORS ڕێگەپێدراو، XSS sanitize، rate limiting |
| تاقیکردنەوە | E2E بە Postgres-ی ڕاستەقینە (embedded) + Redis stub |

## پێکەندی فایلەکان

```
arena-api/
├── src/
│   ├── config/
│   │   ├── env.ts          # شیکاری گشتی ڕەسەن بە Zod
│   │   ├── db.ts           # Drizzle + postgres.js
│   │   └── redis.ts        # ioredis
│   ├── models/
│   │   └── schema.ts       # ٩ شێمە: users, games, questions, categories,
│   │                       # rooms, room_players, game_sessions, scores,
│   │                       # refresh_tokens
│   ├── schemas/            # سکیماکانی Zod (auth, games, questions, rooms, categories)
│   ├── middleware/
│   │   ├── auth.ts         # requireAuth (JWT) + requireAdmin
│   │   ├── error.ts        # ApiError + errorHandler
│   │   ├── ratelimit.ts    # ١٠/١٥خ گشتی، ١٠/خ auth
│   │   ├── security.ts     # Helmet+CSP, CORS, XSS
│   │   └── validate.ts     # zodBody / zodQuery
│   ├── services/
│   │   ├── auth.service.ts # register/login/refresh rotation (bcrypt + SHA-256)
│   │   ├── game.service.ts # CRUD ی games/questions/categories + leaderboard
│   │   └── room.service.ts # دروستکردن/داخڵبوون/دەستپێکردنی ژوور + Redis scores
│   ├── controllers/        # controller-ەکانی باریک
│   ├── routes/             # auth, games, categories, questions, rooms
│   ├── socket/
│   │   ├── index.ts        # attachSocket — Server + CORS + engine logs
│   │   └── game.server.ts  # هەموو لۆجیکی یاری: نۆرە، تایمەر، خاڵ، وینەڕ
│   ├── utils/              # jwt, roomCode (٦پیت), asyncHandler, shuffle
│   ├── db/migrate.ts       # جێبەجێکردنی مایگرەیشن
│   ├── seed/seed.ts        # ١٨ یاری کوردی + ٤١ پرسیار + admin
│   └── index.ts            # bootstrap ی Express + Socket.io
├── scripts/
│   ├── e2e.mjs             # ٣٩ تاقیکردنەوە E2E (Postgres-ی ڕاستەقینە)
│   └── redis-stub.mjs      # stub-ی Redis بۆ تاقیکردنەوە
├── drizzle/                # مایگرەیشنەکانی SQL (تۆمارکراو)
├── Dockerfile              # multi-stage, non-root, healthcheck
├── docker-compose.yml      # postgres + redis + api
├── drizzle.config.ts
├── .env.example
└── package.json
```

## دەستپێکردن

### شێوازی ١ — Docker (پێشنیاریکراو)

```bash
cd arena-api
docker compose up -d --build
# API: http://localhost:4000  |  Socket.io: /socket.io
# seed:
docker compose exec api node dist/db/migrate.js   # (خۆکارانە جێبەجێدەکرێت لە CMD)
```

### شێوازی ٢ — بە دەست (development)

```bash
cd arena-api
cp .env.example .env            # SECRET-ەکان بگۆڕە
npm install

# PostgreSQL و Redis بنێ (لە docker یان جیاواز)
npm run db:migrate              # مایگرەیشن
npm run seed                    # ١٨ یاری + پرسیارەکان + admin
npm run dev                     # http://localhost:4000
```

**بەکارهێنەری admin** (لە seed-دا): `admin` / `admin1234` — بۆ گەشەپێدان تەنها!

## گشتی ڕەسەن (Environment)

| گشت | بنەڕەت | تێبینی |
|---|---|---|
| `PORT` | `4000` | پۆرتی API |
| `DATABASE_URL` | — | `postgresql://user:pass@host:5432/db` |
| `REDIS_URL` | — | `redis://host:6379` |
| `JWT_SECRET` | — | **پێویستە**، کەمترین ١٦ پیت |
| `JWT_EXPIRES_IN` | `15m` | مەودای access token |
| `REFRESH_EXPIRES_DAYS` | `30` | مەودای refresh token |
| `CORS_ORIGINS` | `http://localhost:5173,...` | لایستەی origin، بە کۆما |
| `TRUST_PROXY` | `false` | لە پشت nginx/dokcer-دا `true` |
| `AUTH_RATE_LIMIT` | `10` | داواکاری auth / خولەک / IP |

## ڕێچکەکانی API

### Auth
| ڕێچکە | چۆن | تێبینی |
|---|---|---|
| `POST /api/auth/register` | `{username, email?, password}` | ٢٠١ + `accessToken` + cookie |
| `POST /api/auth/login` | `{username, password}` | access + refresh cookie |
| `POST /api/auth/refresh` | (cookie) | rotation — توکنی کۆن میر دەبێت |
| `POST /api/auth/logout` | (cookie) | ڕەتکردنەوەی refresh |
| `GET /api/auth/me` | Bearer | زانیاری بەکارهێنەر |

### Games / Categories / Questions
| ڕێچکە | چۆن | تێبینی |
|---|---|---|
| `GET /api/games` | — | ١٨ یاری چالاک |
| `GET /api/games/leaderboard?gameId=&limit=` | — | خاڵەکانی گشتی |
| `GET /api/games/:slug` | — | یارییەکە |
| `POST /api/games` | admin | `{slug, nameKu, config...}` |
| `PATCH /api/games/:slug` | admin | گۆڕانکاری |
| `DELETE /api/games/:slug` | admin | سڕینەوە (cascade) |
| `GET /api/questions?gameId=&category=&limit=` | — | پرسیارەکان |
| `POST/PATCH/DELETE /api/questions...` | admin | CRUD |
| `GET/POST /api/categories`، `DELETE /api/categories/:slug` | POST/DELETE: admin | |

### Rooms
| ڕێچکە | چۆن | تێبینی |
|---|---|---|
| `POST /api/rooms` | Bearer | `{gameId, maxPlayers?, config?}` → کۆدی ٦پیت |
| `GET /api/rooms/:code` | — | ڕەسەن |
| `POST /api/rooms/:code/join` | Bearer | داخڵبوون (idempotent) |
| `POST /api/rooms/:code/ready` | Bearer | `{ready: bool}` |
| `POST /api/rooms/:code/leave` | Bearer | خاوەن → گواستنەوەی host |
| `POST /api/rooms/:code/start` | Bearer (host) | waiting → playing |
| `DELETE /api/rooms/:code` | Bearer (host) | تەواوکردن |

## Socket.io — namespace-ی `/game`

کۆنێکت:
```js
import { io } from "socket.io-client";
const s = io("https://arena.com/game", { auth: { token: accessToken } });
```

### کڕانت → سێرڤەر
| ڕووداو | داتا | ئەنجام |
|---|---|---|
| `room:join` | `{roomCode}` | داخڵبوونی ژوور (ack) |
| `room:leave` | `{roomCode}` | چوونەدەرەوە |
| `room:ready` | `{roomCode, ready}` | ئامادەیی |
| `game:start` | `{roomCode}` | **host تەنها** — دەستپێکردن |
| `game:answer` | `{roomCode, answerIndex}` | وەڵام (تەنها نۆرەی خۆ) |
| `game:skip` | `{roomCode}` | پاڵاوی نۆرە |
| `room:close` | `{roomCode}` | host تەنها — داخستن |

### سێرڤەر → کڕانت
| ڕووداو | داتا |
|---|---|
| `room:updated` | `{code, status, game, players[]}` |
| `room:closed` | `{reason}` |
| `player:left` | `{userId, username}` |
| `game:started` | `{slug, gameId, timeLimit, rounds, players[]}` |
| `game:turn` | `{playerId, username, turnIndex, totalTurns, timeLimit, question}` |
| `game:turn:end` | کاتی نۆرە بەتا بوو |
| `game:reveal` | `{question, isCorrect, points, answeredBy}` |
| `game:result` | `{isCorrect, points, scores{}}` |
| `game:skipped` | `{playerId, username}` |
| `game:finished` | `{finalScores[], winner, slug}` |

### یارییەکانی seed (١٨)
quiz، trivia، emoji، spy، bomb، truth-dare، charades، word-chain، memory،
reaction، red-hunt، quick-math، guess-price، taboo، story، rps، lucky-number، karaoke

هەر یارییەک `config`-ی تایبەتی هەیە: `timeLimit` (چرکە)، `rounds`، `pointsPerCorrect`،
و بۆ spy `items` (شوێنە نهێنییەکان). پرسیارەکان لە بنکە دەگرن؛ ئەگەر بنکە بەتا بوو،
لە `config.items` دەگرن.

## سەلامەتی

- **JWT**: access token (١٥ خولەک) + refresh token (٣٠ ڕۆژ) لە httpOnly cookie.
  Refresh بە **rotation** — توکنی کۆن دوای یەک بەکارهێنان ڕەتدەکرێتەوە
  (ئەگەر دووبارە بەکاربێتەوە = دزراوە).
- **وشەی نهێنی**: bcrypt (cost ١٠).
- **Zod**: هەموو body/query پێش گەیشتن بۆ لۆجیک دەشکرێنەوە (٤٢٢ + fieldErrors).
- **XSS**: body بە `xss` پاک دەکرێتەوە.
- **SQL injection**: دروست — هەموو query-یەکان بە Drizzle parameterized-ن.
- **Rate limiting**: `100 req/15min/IP` (گشتی) و `10 req/min/IP` (auth).
- **CORS**: تەنها origin-ە ڕێگەپێدراوەکان، `credentials: true`.
- **Helmet**: CSP `default-src 'none'` (API)، `frame-ancestors 'none'`.
- **Socket auth**: JWT لە `handshake.auth.token` — بەبێ توکنی دروست ناتوانیت
  کۆنێکت بکەیت؛ ئەندامی ژووریش بۆ هەر ڕووداوێک پشکنێت.
- **Docker**: non-root user، healthcheck، multi-stage build.

## تاقیکردنەوە (E2E)

```bash
npm run test:e2e
```

٣٩ تاقیکردنەوە لەسەر **Postgres-ی ڕاستەقینە** (embedded) و Redis stub:
auth (register/login/refresh rotation/logout)، CRUD ی games/questions/categories
(bە ڕۆڵی player و admin)، rooms (دروستکردن/داخڵبوون/ready/٤٠)، socket
(auth reject، room:join، membership check)، و یارییەکی تەواوی quiz:
دەستپێکردن → نۆرەی ١ (دروست +١٠) → نۆرەی ٢ (هەڵە +٠) → وەڵامی ناڕێکەوتوو →
`game:finished` → leaderboard → logout.

## ڕێچکەی بەردەوام (CI/CD)

بۆ GitHub Actions:
```yaml
- run: npm ci && npm run typecheck && npm run build
- run: npm run test:e2e
- run: docker build -t arena-api .
```

## ڕووبەرایڕەوەی داهاتوو

- `arena-web`: React 18 + Vite + Tailwind + Zustand + React Router
  (دیزاینی تاریک `#080b14`، RTL)
- Nginx: SSL + rate limiting + proxy بۆ Socket.io
- وەشان/ئەنیمەیشنی Framer Motion بۆ هەر یارییەک
