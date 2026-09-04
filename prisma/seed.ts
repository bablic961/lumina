/**
 * Demo data for a fresh database.
 *
 * Idempotent: everything keys off a stable `email` / `slug` / synthetic id, so
 * re-running only refreshes. Safe to run against a database that already has
 * real accounts — nothing is deleted.
 *
 * Logins (password for all of them: `lumina`):
 *   admin@lumina.app   — administrator, verified
 *   nova@lumina.app    — the "you" account most demo chats revolve around
 *   orion@lumina.app, vega@lumina.app, lyra@lumina.app, atlas@lumina.app
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PASSWORD = 'lumina';
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);
const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 3_600_000);

/** Deterministic avatar so the seed needs no network and no binary assets. */
const avatar = (seed: string) =>
  `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(seed)}&backgroundColor=f59e0b,ec4899,14b8a6,8b5cf6`;

interface Person {
  email: string;
  username: string;
  name: string;
  bio: string;
  role?: 'USER' | 'ADMIN';
  verified?: boolean;
  presence?: 'ONLINE' | 'AWAY' | 'DND' | 'OFFLINE';
  statusEmoji?: string;
  statusText?: string;
  accent?: string;
  theme?: string;
  birthday?: Date;
}

const PEOPLE: Person[] = [
  {
    email: 'admin@lumina.app',
    username: 'admin',
    name: 'Лумина Админ',
    bio: 'Держу платформу на плаву. Пишите, если что-то светится не так.',
    role: 'ADMIN',
    verified: true,
    presence: 'ONLINE',
    statusEmoji: '🛠',
    statusText: 'На дежурстве',
    accent: 'violet',
    theme: 'dark',
  },
  {
    email: 'nova@lumina.app',
    username: 'nova',
    name: 'Нова Светлова',
    bio: 'Продуктовый дизайнер. Люблю стекло, свет и аккуратные отступы.',
    verified: true,
    presence: 'ONLINE',
    statusEmoji: '✨',
    statusText: 'Рисую интерфейсы',
    birthday: new Date('1996-04-18T12:00:00.000Z'),
  },
  {
    email: 'orion@lumina.app',
    username: 'orion',
    name: 'Орион Ковалёв',
    bio: 'Backend, распределённые системы, слишком много кофе.',
    presence: 'AWAY',
    statusEmoji: '☕',
    statusText: 'Отошёл за кофе',
    accent: 'teal',
    birthday: new Date('1993-09-07T12:00:00.000Z'),
  },
  {
    email: 'vega@lumina.app',
    username: 'vega',
    name: 'Вега Иртышева',
    bio: 'Фронтенд и анимации. Если что-то плавно едет — вероятно, это я.',
    presence: 'DND',
    statusEmoji: '🎧',
    statusText: 'Глубокая работа',
    accent: 'pink',
  },
  {
    email: 'lyra@lumina.app',
    username: 'lyra',
    name: 'Лира Ким',
    bio: 'QA. Ломаю ваши сборки с любовью.',
    presence: 'ONLINE',
    statusEmoji: '🐞',
    statusText: 'Ищу баги',
    accent: 'lime',
  },
  {
    email: 'atlas@lumina.app',
    username: 'atlas',
    name: 'Атлас Верхов',
    bio: 'DevOps. Всё лежит? Уже поднимаю.',
    presence: 'OFFLINE',
    accent: 'sky',
  },
];

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const users = new Map<string, { id: string; username: string; name: string }>();
  for (const person of PEOPLE) {
    const user = await prisma.user.upsert({
      where: { email: person.email },
      update: {
        name: person.name,
        bio: person.bio,
        avatarUrl: avatar(person.username),
        verified: person.verified ?? false,
        role: person.role ?? 'USER',
        presence: person.presence ?? 'OFFLINE',
        statusEmoji: person.statusEmoji ?? null,
        statusText: person.statusText ?? null,
        accent: person.accent ?? 'amber',
        theme: person.theme ?? 'light',
        lastSeenAt: minutesAgo(person.presence === 'ONLINE' ? 0 : 90),
      },
      create: {
        email: person.email,
        username: person.username,
        name: person.name,
        bio: person.bio,
        passwordHash,
        avatarUrl: avatar(person.username),
        verified: person.verified ?? false,
        role: person.role ?? 'USER',
        presence: person.presence ?? 'OFFLINE',
        statusEmoji: person.statusEmoji ?? null,
        statusText: person.statusText ?? null,
        accent: person.accent ?? 'amber',
        theme: person.theme ?? 'light',
        birthday: person.birthday ?? null,
        lastSeenAt: minutesAgo(person.presence === 'ONLINE' ? 0 : 90),
        createdAt: daysAgo(120),
      },
      select: { id: true, username: true, name: true },
    });
    users.set(person.username, user);
  }
  const who = (username: string) => {
    const user = users.get(username);
    if (!user) throw new Error(`seed: неизвестный пользователь ${username}`);
    return user;
  };

  // ── badges ────────────────────────────────────────────────────────────────
  const BADGES: [string, string[]][] = [
    ['admin', ['founder', 'verified', 'helper']],
    ['nova', ['early-bird', 'verified', 'story-teller', 'chatterbox']],
    ['orion', ['night-owl', 'chatterbox']],
    ['vega', ['polyglot', 'story-teller']],
    ['lyra', ['helper', 'early-bird']],
    ['atlas', ['night-owl']],
  ];
  for (const [username, keys] of BADGES) {
    for (const key of keys) {
      await prisma.badge.upsert({
        where: { userId_key: { userId: who(username).id, key } },
        update: {},
        create: { userId: who(username).id, key, earnedAt: daysAgo(30 + keys.indexOf(key) * 7) },
      });
    }
  }

  // ── folders for nova ──────────────────────────────────────────────────────
  const folders = new Map<string, string>();
  for (const [index, folder] of [
    { name: 'Работа', icon: 'briefcase' },
    { name: 'Друзья', icon: 'heart' },
  ].entries()) {
    const existing = await prisma.folder.findFirst({ where: { userId: who('nova').id, name: folder.name } });
    const row =
      existing ??
      (await prisma.folder.create({
        data: { userId: who('nova').id, name: folder.name, icon: folder.icon, order: index },
      }));
    folders.set(folder.name, row.id);
  }

  // ── sticker packs ─────────────────────────────────────────────────────────
  const STICKERS: [string, string][] = [
    ['star', '⭐'],
    ['fire', '🔥'],
    ['heart', '💜'],
    ['rocket', '🚀'],
    ['coffee', '☕'],
    ['party', '🎉'],
    ['sparkles', '✨'],
    ['cat', '🐱'],
    ['thumbs', '👍'],
    ['think', '🤔'],
    ['ghost', '👻'],
    ['moon', '🌙'],
  ];
  const pack = await prisma.stickerPack.upsert({
    where: { slug: 'lumina-basics' },
    update: { name: 'Lumina Basics', isGlobal: true, coverUrl: '/stickers/star.svg' },
    create: {
      name: 'Lumina Basics',
      slug: 'lumina-basics',
      coverUrl: '/stickers/star.svg',
      isGlobal: true,
      authorId: who('admin').id,
    },
  });
  const stickers = new Map<string, string>();
  for (const [name, emoji] of STICKERS) {
    const url = `/stickers/${name}.svg`;
    const existing = await prisma.sticker.findFirst({ where: { packId: pack.id, url } });
    const row = existing ?? (await prisma.sticker.create({ data: { packId: pack.id, url, emoji, name } }));
    stickers.set(name, row.id);
  }

  const moodPack = await prisma.stickerPack.upsert({
    where: { slug: 'night-mood' },
    update: { name: 'Night Mood', isGlobal: true, animated: true, coverUrl: '/stickers/moon.svg' },
    create: {
      name: 'Night Mood',
      slug: 'night-mood',
      coverUrl: '/stickers/moon.svg',
      isGlobal: true,
      animated: true,
      authorId: who('vega').id,
    },
  });
  for (const name of ['moon', 'ghost', 'think', 'sparkles']) {
    const url = `/stickers/${name}.svg`;
    const existing = await prisma.sticker.findFirst({ where: { packId: moodPack.id, url } });
    if (!existing) {
      await prisma.sticker.create({
        data: { packId: moodPack.id, url, emoji: STICKERS.find((s) => s[0] === name)?.[1] ?? '✨', name },
      });
    }
  }

  // ── chats ─────────────────────────────────────────────────────────────────
  /** DMs have no title, so identity is "the only chat both of us are in". */
  async function ensureDm(a: string, b: string) {
    const [first, second] = [who(a).id, who(b).id];
    const existing = await prisma.chat.findFirst({
      where: {
        type: 'DM',
        AND: [{ members: { some: { userId: first } } }, { members: { some: { userId: second } } }],
      },
    });
    if (existing) return existing.id;
    const chat = await prisma.chat.create({
      data: {
        type: 'DM',
        createdById: first,
        createdAt: daysAgo(40),
        members: { create: [{ userId: first, role: 'MEMBER' }, { userId: second, role: 'MEMBER' }] },
      },
    });
    return chat.id;
  }

  interface RoomSpec {
    type: 'GROUP' | 'CHANNEL';
    title: string;
    description: string;
    owner: string;
    admins?: string[];
    members: string[];
    wallpaper?: string;
    onlyAdminsCanPost?: boolean;
    folder?: string;
    pinned?: boolean;
  }

  async function ensureRoom(spec: RoomSpec) {
    const existing = await prisma.chat.findFirst({ where: { type: spec.type, title: spec.title } });
    if (existing) return existing.id;
    const chat = await prisma.chat.create({
      data: {
        type: spec.type,
        title: spec.title,
        description: spec.description,
        avatarUrl: avatar(spec.title),
        wallpaper: spec.wallpaper ?? null,
        onlyAdminsCanPost: spec.onlyAdminsCanPost ?? spec.type === 'CHANNEL',
        createdById: who(spec.owner).id,
        createdAt: daysAgo(60),
        members: {
          create: [
            { userId: who(spec.owner).id, role: 'OWNER' },
            ...(spec.admins ?? []).map((username) => ({ userId: who(username).id, role: 'ADMIN' })),
            ...spec.members.map((username) => ({ userId: who(username).id, role: 'MEMBER' })),
          ],
        },
      },
    });
    if (spec.folder || spec.pinned) {
      await prisma.chatMember.update({
        where: { chatId_userId: { chatId: chat.id, userId: who('nova').id } },
        data: {
          folderId: spec.folder ? folders.get(spec.folder) ?? null : null,
          isPinned: spec.pinned ?? false,
        },
      });
    }
    return chat.id;
  }

  const dmOrion = await ensureDm('nova', 'orion');
  const dmVega = await ensureDm('nova', 'vega');
  const dmAdmin = await ensureDm('nova', 'admin');
  const teamChat = await ensureRoom({
    type: 'GROUP',
    title: 'Lumina Team',
    description: 'Продуктовая команда. Стендап в 11:00, релизы по вторникам.',
    owner: 'nova',
    admins: ['orion'],
    members: ['vega', 'lyra', 'atlas', 'admin'],
    wallpaper: 'linear-gradient(160deg,#fde68a,#fbcfe8)',
    folder: 'Работа',
    pinned: true,
  });
  const designChat = await ensureRoom({
    type: 'GROUP',
    title: 'Дизайн-ревью',
    description: 'Скидываем макеты, обсуждаем свет и стекло.',
    owner: 'vega',
    admins: ['nova'],
    members: ['lyra'],
    wallpaper: 'linear-gradient(160deg,#a5f3fc,#c7d2fe)',
    folder: 'Работа',
  });
  const channel = await ensureRoom({
    type: 'CHANNEL',
    title: 'Lumina Changelog',
    description: 'Что нового в платформе. Только объявления.',
    owner: 'admin',
    members: ['nova', 'orion', 'vega', 'lyra', 'atlas'],
    onlyAdminsCanPost: true,
  });

  // ── messages ──────────────────────────────────────────────────────────────
  interface Line {
    from: string;
    text?: string;
    /** Minutes before "now" — the script is written newest-last. */
    ago: number;
    type?: 'TEXT' | 'CODE' | 'VOICE' | 'FILE' | 'STICKER' | 'LOCATION' | 'POLL' | 'SYSTEM' | 'CALL';
    codeLanguage?: string;
    /** Index inside the same script this line answers. */
    replyTo?: number;
    pinned?: boolean;
    edited?: boolean;
    sticker?: string;
    selfDestructSec?: number;
    reactions?: [string, string[]][];
    location?: { lat: number; lng: number; name: string };
    attachment?: {
      kind: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'VOICE' | 'DOC';
      url: string;
      name: string;
      mime: string;
      size: number;
      width?: number;
      height?: number;
      duration?: number;
      waveform?: number[];
    };
    poll?: { question: string; multiple?: boolean; options: string[]; votes?: Record<string, string[]> };
    savedBy?: string[];
  }

  /**
   * Only fills a chat that has no messages yet, so re-seeding never duplicates
   * a conversation or clobbers something typed during a demo.
   */
  async function seedMessages(chatId: string, script: Line[]) {
    if ((await prisma.message.count({ where: { chatId } })) > 0) return;
    const created: string[] = [];

    for (const line of script) {
      const createdAt = minutesAgo(line.ago);
      const message = await prisma.message.create({
        data: {
          chatId,
          senderId: line.type === 'SYSTEM' ? null : who(line.from).id,
          content: line.text ?? '',
          contentType: line.type ?? 'TEXT',
          codeLanguage: line.codeLanguage ?? null,
          stickerId: line.sticker ? stickers.get(line.sticker) ?? null : null,
          lat: line.location?.lat ?? null,
          lng: line.location?.lng ?? null,
          locationName: line.location?.name ?? null,
          replyToId: line.replyTo !== undefined ? created[line.replyTo] ?? null : null,
          isPinned: line.pinned ?? false,
          editedAt: line.edited ? new Date(createdAt.getTime() + 60_000) : null,
          selfDestructSec: line.selfDestructSec ?? null,
          expiresAt: line.selfDestructSec ? new Date(createdAt.getTime() + line.selfDestructSec * 1000) : null,
          createdAt,
        },
      });
      created.push(message.id);

      if (line.attachment) {
        const { waveform, ...rest } = line.attachment;
        await prisma.attachment.create({
          data: { ...rest, messageId: message.id, waveform: waveform ? JSON.stringify(waveform) : null },
        });
      }

      for (const [emoji, voters] of line.reactions ?? []) {
        for (const voter of voters) {
          await prisma.reaction.create({
            data: { messageId: message.id, userId: who(voter).id, emoji, createdAt },
          });
        }
      }

      for (const saver of line.savedBy ?? []) {
        await prisma.savedMessage.create({ data: { userId: who(saver).id, messageId: message.id } });
      }

      if (line.poll) {
        const poll = await prisma.poll.create({
          data: {
            messageId: message.id,
            question: line.poll.question,
            multiple: line.poll.multiple ?? false,
            anonymous: true,
            options: { create: line.poll.options.map((text, order) => ({ text, order })) },
          },
          include: { options: true },
        });
        for (const [text, voters] of Object.entries(line.poll.votes ?? {})) {
          const option = poll.options.find((row) => row.text === text);
          if (!option) continue;
          for (const voter of voters) {
            await prisma.pollVote.create({ data: { optionId: option.id, userId: who(voter).id } });
          }
        }
      }
    }

    // Everyone except the last sender has read everything up to the tail.
    const last = script[script.length - 1];
    const lastId = created[created.length - 1];
    const members = await prisma.chatMember.findMany({ where: { chatId } });
    for (const member of members) {
      const isAuthor = member.userId === who(last.from).id;
      await prisma.chatMember.update({
        where: { id: member.id },
        data: {
          lastReadAt: isAuthor ? new Date() : minutesAgo(last.ago + 1),
          lastReadMessageId: isAuthor ? lastId : created[Math.max(0, created.length - 2)] ?? null,
        },
      });
      if (!isAuthor) {
        await prisma.messageRead.createMany({
          data: created.slice(0, -1).map((messageId) => ({ messageId, userId: member.userId })),
        });
      }
    }
    await prisma.chat.update({ where: { id: chatId }, data: { lastMessageAt: minutesAgo(last.ago) } });
  }

  await seedMessages(dmOrion, [
    { from: 'orion', text: 'Привет! Посмотрел твои макеты — стекло выглядит потрясающе 😍', ago: 260 },
    { from: 'nova', text: 'Спасибо! Больше всего мучилась с подсветкой при наведении.', ago: 256 },
    {
      from: 'orion',
      text: 'Кстати, вот как я считаю «важность» уведомления на сервере:',
      ago: 240,
    },
    {
      from: 'orion',
      type: 'CODE',
      codeLanguage: 'typescript',
      text: `export function scoreImportance(text: string, mentioned: boolean) {
  if (mentioned) return 'HIGH';
  if (/срочно|asap|упал|прод/i.test(text)) return 'HIGH';
  if (text.length < 12) return 'LOW';
  return 'NORMAL';
}`,
      ago: 239,
      reactions: [['🔥', ['nova']], ['👍', ['nova']]],
      savedBy: ['nova'],
    },
    { from: 'nova', text: 'Красиво. А «прод» точно стоит в списке? 😅', ago: 230, replyTo: 3 },
    { from: 'orion', text: 'Особенно «прод».', ago: 229, reactions: [['😂', ['nova']]] },
    {
      from: 'orion',
      type: 'VOICE',
      ago: 120,
      attachment: {
        kind: 'VOICE',
        url: '/uploads/demo-voice.webm',
        name: 'Голосовое сообщение',
        mime: 'audio/webm',
        size: 48_120,
        duration: 7.4,
        waveform: [3, 9, 22, 41, 58, 72, 64, 48, 31, 44, 61, 78, 66, 50, 33, 20, 12, 6],
      },
    },
    { from: 'nova', text: 'Слушаю на ходу, отвечу через полчаса 🙌', ago: 110 },
    { from: 'orion', type: 'STICKER', sticker: 'coffee', ago: 108 },
    {
      from: 'nova',
      text: 'Держи техзадание на новый композер.',
      ago: 40,
      attachment: {
        kind: 'DOC',
        url: '/uploads/demo-spec.pdf',
        name: 'composer-spec.pdf',
        mime: 'application/pdf',
        size: 284_310,
      },
    },
    { from: 'orion', text: 'Принял, читаю сегодня вечером.', ago: 24, reactions: [['✨', ['nova']]] },
  ]);

  await seedMessages(dmVega, [
    { from: 'vega', text: 'Нашла идеальный градиент для тёмной темы 🌙', ago: 190 },
    { from: 'nova', text: 'Показывай!', ago: 188 },
    {
      from: 'vega',
      text: 'linear-gradient(160deg, #0f172a, #1e293b) — и сверху 8% amber.',
      ago: 186,
      edited: true,
      reactions: [['💜', ['nova']]],
      savedBy: ['nova'],
    },
    { from: 'nova', text: 'Забираю в токены. Ты гений.', ago: 180 },
    { from: 'vega', type: 'STICKER', sticker: 'sparkles', ago: 179 },
    {
      from: 'vega',
      text: 'Секретный код доступа к прототипу: 4821. Исчезнет через час.',
      ago: 30,
      selfDestructSec: 3600,
    },
  ]);

  await seedMessages(dmAdmin, [
    { from: 'admin', text: 'Привет! Твой аккаунт получил бейдж «early-bird» ✨', ago: 2880 },
    { from: 'nova', text: 'Ого, спасибо! Что он даёт?', ago: 2870 },
    { from: 'admin', text: 'Вечную славу и золотую рамку у аватара 🙂', ago: 2860 },
  ]);

  await seedMessages(teamChat, [
    { from: 'nova', text: 'Всем привет 👋 Заводим канал под новый релиз.', ago: 1440 },
    {
      from: 'nova',
      text: 'Правила простые: обсуждения тут, объявления — в Lumina Changelog.',
      ago: 1438,
      pinned: true,
      reactions: [['👍', ['orion', 'vega', 'lyra']]],
    },
    { from: 'atlas', text: 'Стейджинг поднят: https://staging.lumina.local', ago: 1200 },
    { from: 'lyra', text: 'Начинаю прогон тестов 🐞', ago: 1180 },
    {
      from: 'lyra',
      text: 'Нашла: при 2000 участниках список подтормаживает на бюджетных телефонах.',
      ago: 900,
      reactions: [['😮', ['nova', 'orion']]],
    },
    { from: 'orion', text: 'Виртуализирую список, к вечеру будет.', ago: 890, replyTo: 4 },
    {
      from: 'vega',
      type: 'POLL',
      text: '',
      ago: 600,
      poll: {
        question: 'Какой акцент ставим дефолтным в 1.0?',
        options: ['Amber → Pink', 'Teal → Blue', 'Violet → Pink', 'Gold'],
        votes: {
          'Amber → Pink': ['nova', 'orion', 'lyra'],
          'Violet → Pink': ['vega'],
          'Teal → Blue': ['atlas'],
        },
      },
      pinned: true,
    },
    { from: 'nova', text: '@all не забудьте проголосовать до пятницы 🙏', ago: 300 },
    {
      from: 'atlas',
      text: 'Собрал метрики Lighthouse после виртуализации:',
      ago: 180,
      attachment: {
        kind: 'IMAGE',
        url: '/stories/ocean.svg',
        name: 'lighthouse.svg',
        mime: 'image/svg+xml',
        size: 12_480,
        width: 720,
        height: 1280,
      },
    },
    { from: 'orion', text: 'Performance 97, Accessibility 100. Едем 🚀', ago: 170, reactions: [['🚀', ['nova', 'vega', 'lyra', 'atlas']], ['🔥', ['nova']]] },
    { from: 'lyra', type: 'STICKER', sticker: 'party', ago: 165 },
    { from: 'nova', text: 'Отлично. Финальный созвон завтра в 11:00.', ago: 90 },
  ]);

  await seedMessages(designChat, [
    { from: 'vega', text: 'Скинула новую сетку композера в Figma.', ago: 720 },
    {
      from: 'nova',
      text: 'Смотрю. Кнопка отправки просит на 2px больше свечения.',
      ago: 700,
      reactions: [['🤔', ['vega']]],
    },
    { from: 'vega', text: 'Поправила. Стало заметно живее.', ago: 690, edited: true },
    {
      from: 'lyra',
      text: 'На 320px по ширине панель всё ещё режется — проверьте.',
      ago: 400,
      reactions: [['👍', ['vega']]],
    },
    {
      from: 'nova',
      type: 'LOCATION',
      text: '',
      ago: 120,
      location: { lat: 55.7558, lng: 37.6173, name: 'Офис на Тверской — заходите на воркшоп' },
    },
  ]);

  await seedMessages(channel, [
    {
      from: 'admin',
      text: '🎉 Lumina 1.0 — свет в каждом сообщении.\n\nЧаты, каналы, звонки, истории и сквозное шифрование для личных диалогов. Спасибо всем, кто тестировал!',
      ago: 4320,
      pinned: true,
      reactions: [['🎉', ['nova', 'orion', 'vega', 'lyra', 'atlas']], ['💜', ['nova', 'vega']]],
    },
    {
      from: 'admin',
      text: '1.1 — виртуализация длинных чатов, поиск по вложениям, 12 акцентов оформления.',
      ago: 2880,
      reactions: [['🔥', ['orion', 'atlas']]],
      savedBy: ['nova'],
    },
    {
      from: 'admin',
      text: '1.2 — групповые звонки до 100 участников, виртуальный фон и запись с согласия всех сторон.',
      ago: 1440,
      reactions: [['👍', ['nova', 'lyra']]],
    },
    {
      from: 'admin',
      text: 'Ближайшее: голосовые сообщения с расшифровкой, совместные плейлисты, комнаты ожидания.',
      ago: 200,
      reactions: [['✨', ['nova', 'vega', 'lyra']]],
    },
  ]);

  // ── drafts, invites, stories, gifts ───────────────────────────────────────
  await prisma.chatMember.update({
    where: { chatId_userId: { chatId: teamChat, userId: who('nova').id } },
    data: { draft: 'Напоминание: созвон в 11:00, повестка в закреплённом' },
  });

  const INVITES: { chatId: string; code: string; by: string; maxUses?: number; expiresInHours?: number }[] = [
    { chatId: teamChat, code: 'lumina-team', by: 'nova' },
    { chatId: designChat, code: 'design-review', by: 'vega', maxUses: 25, expiresInHours: 168 },
    { chatId: channel, code: 'changelog', by: 'admin' },
  ];
  for (const invite of INVITES) {
    await prisma.invite.upsert({
      where: { code: invite.code },
      update: {},
      create: {
        chatId: invite.chatId,
        code: invite.code,
        createdById: who(invite.by).id,
        maxUses: invite.maxUses ?? null,
        expiresAt: invite.expiresInHours ? hoursFromNow(invite.expiresInHours) : null,
      },
    });
  }

  const STORY_SPECS: { by: string; file: string; caption: string; agoHours: number; viewers: [string, string?][] }[] = [
    {
      by: 'nova',
      file: 'aurora',
      caption: 'Утро начинается с градиента ☀️',
      agoHours: 3,
      viewers: [['orion', '🔥'], ['vega'], ['lyra', '❤️']],
    },
    { by: 'nova', file: 'forest', caption: 'Дизайн-сессия на природе', agoHours: 9, viewers: [['orion']] },
    { by: 'vega', file: 'midnight', caption: 'Тёмная тема, финальный вариант 🌙', agoHours: 5, viewers: [['nova', '👏']] },
    { by: 'orion', file: 'ocean', caption: 'Деплой прошёл. Можно дышать.', agoHours: 1, viewers: [['nova', '😮'], ['atlas']] },
  ];
  for (const spec of STORY_SPECS) {
    const mediaUrl = `/stories/${spec.file}.svg`;
    const existing = await prisma.story.findFirst({ where: { userId: who(spec.by).id, mediaUrl } });
    const story =
      existing ??
      (await prisma.story.create({
        data: {
          userId: who(spec.by).id,
          kind: 'IMAGE',
          mediaUrl,
          caption: spec.caption,
          createdAt: new Date(Date.now() - spec.agoHours * 3_600_000),
          // 24 h from creation, so the freshest ones stay visible after seeding.
          expiresAt: new Date(Date.now() + (24 - spec.agoHours) * 3_600_000),
        },
      }));
    for (const [viewer, emoji] of spec.viewers) {
      await prisma.storyView.upsert({
        where: { storyId_userId: { storyId: story.id, userId: who(viewer).id } },
        update: {},
        create: { storyId: story.id, userId: who(viewer).id, emoji: emoji ?? null },
      });
    }
  }

  const GIFTS: { from: string; to: string; kind: string; message: string; agoDays: number }[] = [
    { from: 'orion', to: 'nova', kind: 'star', message: 'За лучший редизайн года', agoDays: 3 },
    { from: 'vega', to: 'nova', kind: 'cake', message: 'С прошедшим! 🎂', agoDays: 10 },
    { from: 'nova', to: 'lyra', kind: 'rocket', message: 'За 40 найденных багов', agoDays: 1 },
  ];
  for (const gift of GIFTS) {
    const existing = await prisma.gift.findFirst({
      where: { senderId: who(gift.from).id, receiverId: who(gift.to).id, kind: gift.kind },
    });
    if (!existing) {
      await prisma.gift.create({
        data: {
          senderId: who(gift.from).id,
          receiverId: who(gift.to).id,
          chatId: null,
          kind: gift.kind,
          message: gift.message,
          createdAt: daysAgo(gift.agoDays),
        },
      });
    }
  }

  // ── notifications, moderation, platform config ────────────────────────────
  if ((await prisma.notification.count({ where: { userId: who('nova').id } })) === 0) {
    await prisma.notification.createMany({
      data: [
        {
          userId: who('nova').id,
          type: 'MENTION',
          title: 'Lumina Team',
          body: '@all не забудьте проголосовать до пятницы 🙏',
          chatId: teamChat,
          importance: 'HIGH',
          createdAt: minutesAgo(300),
        },
        {
          userId: who('nova').id,
          type: 'MESSAGE',
          title: 'Орион Ковалёв',
          body: 'Принял, читаю сегодня вечером.',
          chatId: dmOrion,
          importance: 'NORMAL',
          createdAt: minutesAgo(24),
        },
        {
          userId: who('nova').id,
          type: 'SYSTEM',
          title: 'Добро пожаловать в Lumina',
          body: 'Загляните в настройки: 12 акцентов, три плотности и AMOLED-тема.',
          importance: 'LOW',
          read: true,
          createdAt: daysAgo(2),
        },
      ],
    });
  }

  // A closed and an open report so the moderation queue is not empty.
  const spamMessage = await prisma.message.findFirst({
    where: { chatId: channel },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if ((await prisma.report.count()) === 0) {
    await prisma.report.createMany({
      data: [
        {
          reporterId: who('lyra').id,
          targetUserId: who('atlas').id,
          reason: 'SPAM',
          details: 'Присылает одну и ту же ссылку на стейджинг в личку.',
          status: 'OPEN',
          createdAt: minutesAgo(120),
        },
        {
          reporterId: who('vega').id,
          targetMessageId: spamMessage?.id ?? null,
          reason: 'OTHER',
          details: 'Проверьте формулировку — кажется, опечатка в анонсе.',
          status: 'RESOLVED',
          createdAt: daysAgo(4),
        },
      ],
    });
  }

  for (const rule of [
    { key: 'message.send', limit: 30, windowSec: 10 },
    { key: 'integrations.ai', limit: 20, windowSec: 3600 },
    { key: 'upload', limit: 60, windowSec: 3600 },
    { key: 'invite.create', limit: 20, windowSec: 3600 },
    { key: 'story.create', limit: 20, windowSec: 86_400 },
  ]) {
    await prisma.rateLimitRule.upsert({
      where: { key: rule.key },
      update: {},
      create: rule,
    });
  }

  if ((await prisma.auditLog.count()) === 0) {
    await prisma.auditLog.createMany({
      data: [
        { actorId: who('admin').id, action: 'stickerpack.create', target: pack.id, meta: JSON.stringify({ name: 'Lumina Basics' }), createdAt: daysAgo(20) },
        { actorId: who('admin').id, action: 'user.verify', target: who('nova').id, createdAt: daysAgo(18) },
        { actorId: who('admin').id, action: 'broadcast.send', target: '6 получателей', meta: JSON.stringify({ title: 'Lumina 1.2' }), createdAt: daysAgo(1) },
        { actorId: who('admin').id, action: 'ratelimit.update', target: 'message.send', meta: JSON.stringify({ limit: 30, windowSec: 10 }), createdAt: minutesAgo(400) },
      ],
    });
  }

  // A finished call so the chat shows history, plus one demo device per account.
  if ((await prisma.callSession.count({ where: { chatId: teamChat } })) === 0) {
    await prisma.callSession.create({
      data: {
        chatId: teamChat,
        startedById: who('nova').id,
        kind: 'VIDEO',
        startedAt: minutesAgo(1000),
        endedAt: minutesAgo(958),
        participants: JSON.stringify([who('nova').id, who('orion').id, who('vega').id, who('lyra').id]),
      },
    });
  }
  for (const person of PEOPLE) {
    const user = who(person.username);
    const existing = await prisma.device.findFirst({ where: { userId: user.id, label: 'Chrome · Windows' } });
    if (!existing) {
      await prisma.device.create({
        data: {
          userId: user.id,
          label: 'Chrome · Windows',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0 Safari/537.36',
          trusted: true,
          lastActiveAt: minutesAgo(5),
          createdAt: daysAgo(30),
        },
      });
    }
  }

  const counts = {
    пользователи: await prisma.user.count(),
    чаты: await prisma.chat.count(),
    сообщения: await prisma.message.count(),
    истории: await prisma.story.count(),
    стикеры: await prisma.sticker.count(),
  };
  console.log('✨ Lumina seed готов:', counts);
  console.log('   Вход: nova@lumina.app / lumina   ·   админ: admin@lumina.app / lumina');
}

main()
  .catch((error) => {
    console.error('Seed упал:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
