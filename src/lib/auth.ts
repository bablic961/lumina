import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import DiscordProvider from 'next-auth/providers/discord';
import AppleProvider from 'next-auth/providers/apple';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/utils';
import { verifyTotp } from '@/lib/totp';

/**
 * Sessions are JWT-based on purpose: the Socket.io layer decodes the very same
 * cookie (server/io.js) instead of maintaining a second auth mechanism.
 *
 * OAuth accounts are provisioned by hand rather than through the Prisma
 * adapter, because Lumina users carry a required unique @username that the
 * generic adapter has no way to generate.
 */

const oauthProviders = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  oauthProviders.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  );
}
if (process.env.GITHUB_ID && process.env.GITHUB_SECRET) {
  oauthProviders.push(
    GitHubProvider({ clientId: process.env.GITHUB_ID, clientSecret: process.env.GITHUB_SECRET }),
  );
}
if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
  oauthProviders.push(
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
    }),
  );
}
if (process.env.APPLE_ID && process.env.APPLE_SECRET) {
  oauthProviders.push(
    AppleProvider({ clientId: process.env.APPLE_ID, clientSecret: process.env.APPLE_SECRET }),
  );
}

export const enabledOAuth = {
  google: Boolean(process.env.GOOGLE_CLIENT_ID),
  github: Boolean(process.env.GITHUB_ID),
  discord: Boolean(process.env.DISCORD_CLIENT_ID),
  apple: Boolean(process.env.APPLE_ID),
};

async function uniqueUsername(base: string) {
  const seed = slugify(base).replace(/-/g, '_') || 'lumen';
  let candidate = seed.slice(0, 24);
  let attempt = 0;
  // eslint-disable-next-line no-await-in-loop
  while (await prisma.user.findUnique({ where: { username: candidate } })) {
    attempt += 1;
    candidate = `${seed.slice(0, 20)}_${attempt}`;
  }
  return candidate;
}

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: '/login', error: '/login' },
  providers: [
    ...oauthProviders,
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        identifier: { label: 'Email or @username', type: 'text' },
        password: { label: 'Password', type: 'password' },
        code: { label: '2FA code', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials.password) return null;
        const identifier = credentials.identifier.trim().toLowerCase().replace(/^@/, '');
        const user = await prisma.user.findFirst({
          where: { OR: [{ email: identifier }, { username: identifier }] },
        });
        if (!user?.passwordHash || user.banned) return null;
        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;
        // With 2FA on, the password alone is not enough — the login form reveals
        // the code field after the first failure.
        if (user.twoFactorEnabled) {
          const code = credentials.code?.trim();
          if (!code || !user.twoFactorSecret || !verifyTotp(user.twoFactorSecret, code)) return null;
        }
        return { id: user.id, name: user.name, email: user.email, image: user.avatarUrl };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!account || account.provider === 'credentials') return true;
      const email = user.email ?? (profile as { email?: string } | undefined)?.email;
      if (!email) return false;

      let dbUser = await prisma.user.findUnique({ where: { email } });
      if (!dbUser) {
        dbUser = await prisma.user.create({
          data: {
            email,
            name: user.name || email.split('@')[0],
            username: await uniqueUsername(user.name || email.split('@')[0]),
            avatarUrl: user.image ?? null,
            presence: 'ONLINE',
          },
        });
      }
      if (dbUser.banned) return false;

      await prisma.account.upsert({
        where: {
          provider_providerAccountId: {
            provider: account.provider,
            providerAccountId: account.providerAccountId,
          },
        },
        create: {
          userId: dbUser.id,
          type: account.type,
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          access_token: account.access_token,
          refresh_token: account.refresh_token,
          expires_at: account.expires_at,
          token_type: account.token_type,
          scope: account.scope,
          id_token: account.id_token,
        },
        update: { access_token: account.access_token, refresh_token: account.refresh_token },
      });

      user.id = dbUser.id;
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      if (token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { username: true, role: true, name: true, avatarUrl: true, verified: true },
        });
        if (dbUser) {
          token.username = dbUser.username;
          token.role = dbUser.role;
          token.name = dbUser.name;
          token.picture = dbUser.avatarUrl;
          token.verified = dbUser.verified;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.username = token.username as string;
        session.user.role = token.role as string;
        session.user.verified = Boolean(token.verified);
      }
      return session;
    },
  },
};
