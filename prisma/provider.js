/**
 * Aligns the datasource provider with DATABASE_URL before `prisma generate`.
 *
 * The project develops on SQLite (zero setup) and deploys on PostgreSQL, and
 * Prisma cannot read the provider from an env var. Rather than keep two schema
 * files that drift apart, the build rewrites the one line that differs — and
 * only when it actually differs, so a local build leaves the file untouched.
 */
const fs = require('fs');
const path = require('path');

const SCHEMA = path.join(__dirname, 'schema.prisma');
const NEWLINE = String.fromCharCode(10);

/**
 * Hosting platforms pass DATABASE_URL as a real env var; locally it lives in
 * .env, which nothing has loaded yet this early in the build.
 */
function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
    const line = env.split(NEWLINE).find((row) => row.trim().startsWith('DATABASE_URL='));
    if (!line) return '';
    return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
  } catch {
    return '';
  }
}

const url = databaseUrl();
const wanted = /^postgres(ql)?:/.test(url) ? 'postgresql' : 'sqlite';

const schema = fs.readFileSync(SCHEMA, 'utf8');
const current = schema.match(/provider\s*=\s*"(sqlite|postgresql)"/);

if (!current) {
  console.error('[lumina] datasource provider not found in schema.prisma');
  process.exit(1);
}

if (current[1] === wanted) {
  console.log('[lumina] prisma provider already ' + wanted);
  process.exit(0);
}

fs.writeFileSync(SCHEMA, schema.replace(current[0], 'provider = "' + wanted + '"'), 'utf8');
console.log('[lumina] prisma provider ' + current[1] + ' -> ' + wanted);
