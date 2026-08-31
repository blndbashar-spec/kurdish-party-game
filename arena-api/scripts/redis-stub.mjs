// ═══════════════════════════════════════════════════════════════
//  Stub-ی سووک بۆ Redis — تەنها بۆ تاقیکردنەوە (e2e)
//  دەتوانێت: PING, INFO, SELECT, AUTH, HINCRBY, HGETALL, DEL
// ═══════════════════════════════════════════════════════════════
import net from 'node:net';

const PORT = process.env.STUB_PORT ? Number(process.env.STUB_PORT) : 6379;
const store = new Map(); // key → Map(field → number)

function tryParse(buf) {
  // *N\r\n $len\r\n data \r\n ...
  if (buf.length < 1 || buf[0] !== 0x2a /* * */) return null;
  const lineEnd = buf.indexOf('\r\n', 0);
  if (lineEnd === -1) return null;
  const n = parseInt(buf.subarray(1, lineEnd).toString(), 10);
  if (!Number.isFinite(n)) return null;

  let pos = lineEnd + 2;
  const args = [];
  for (let i = 0; i < n; i++) {
    if (buf[pos] !== 0x24 /* $ */) return null;
    const lenEnd = buf.indexOf('\r\n', pos);
    if (lenEnd === -1) return null;
    const len = parseInt(buf.subarray(pos + 1, lenEnd).toString(), 10);
    const dataStart = lenEnd + 2;
    const dataEnd = dataStart + len;
    if (buf.length < dataEnd + 2) return null;
    args.push(buf.subarray(dataStart, dataEnd).toString('utf8'));
    pos = dataEnd + 2;
  }
  return { args, rest: buf.subarray(pos) };
}

function bulk(s) {
  return `$${Buffer.byteLength(s, 'utf8')}\r\n${s}\r\n`;
}

function handle(args) {
  const cmd = (args[0] ?? '').toUpperCase();
  switch (cmd) {
    case 'PING':
      return '+PONG\r\n';
    case 'SELECT':
    case 'AUTH':
      return '+OK\r\n';
    case 'INFO':
      return bulk(
        'redis_version:7.0.0\r\nredis_mode:standalone\r\nrole:master\r\n# Keyspace\r\n',
      );
    case 'HINCRBY': {
      const [, key, field, incr] = args;
      const h = store.get(key) ?? new Map();
      const v = (h.get(field) ?? 0) + parseInt(incr, 10);
      h.set(field, v);
      store.set(key, h);
      return `:${v}\r\n`;
    }
    case 'HGETALL': {
      const h = store.get(args[1]);
      if (!h || h.size === 0) return '*0\r\n';
      const parts = [];
      for (const [f, v] of h) parts.push(bulk(f), bulk(String(v)));
      return `*${parts.length}\r\n${parts.join('')}`;
    }
    case 'DEL': {
      let n = 0;
      for (let i = 1; i < args.length; i++) if (store.delete(args[i])) n++;
      return `:${n}\r\n`;
    }
    default:
      return '+OK\r\n';
  }
}

const server = net.createServer((sock) => {
  let buf = Buffer.alloc(0);
  sock.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    let parsed;
    while ((parsed = tryParse(buf))) {
      buf = parsed.rest;
      try {
        sock.write(Buffer.from(handle(parsed.args)));
      } catch {
        sock.write(Buffer.from('-ERR\r\n'));
      }
    }
  });
  sock.on('error', () => {});
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[redis-stub] ready on 127.0.0.1:${PORT}`);
});
