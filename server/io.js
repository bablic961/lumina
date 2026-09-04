/**
 * Socket.io layer — everything that must feel instant.
 *
 * Rooms
 *   user:<userId>   every socket of one account (chat-list updates, calls, notifications)
 *   chat:<chatId>   all members currently watching a conversation
 *
 * Auth reuses the NextAuth session cookie: the JWE is decoded with the same
 * secret the HTTP side uses, so there is no second token to manage.
 */
const { decode } = require('next-auth/jwt');
const { sendPushToUser } = require('./push');
const { checkRateLimit } = require('./rate-limit');

const LIGHT_EMOJI = new Set(['✨', '💡', '🌟', '⚡', '🔥', '🌈']);

/** userId -> Set<socketId> */
const presence = new Map();

function parseCookies(header = '') {
  return header.split(';').reduce((acc, part) => {
    const idx = part.indexOf('=');
    if (idx > 0) acc[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
    return acc;
  }, {});
}

async function resolveUserId(socket) {
  const cookies = parseCookies(socket.handshake.headers.cookie || '');
  const raw =
    cookies['__Secure-next-auth.session-token'] ||
    cookies['next-auth.session-token'] ||
    socket.handshake.auth?.token;
  if (!raw) return null;
  try {
    const token = await decode({ token: raw, secret: process.env.NEXTAUTH_SECRET });
    return token?.sub || token?.id || null;
  } catch {
    return null;
  }
}

/** Heuristic "smart notification" score — mentions and questions cut through mute. */
function scoreImportance(content, mentioned) {
  const text = (content || '').toLowerCase();
  if (mentioned) return 'HIGH';
  if (/(срочно|urgent|asap|важно|deadline|help|911)/.test(text)) return 'HIGH';
  if (text.includes('?')) return 'NORMAL';
  return text.length < 12 ? 'LOW' : 'NORMAL';
}

function aggregateReactions(reactions) {
  const map = new Map();
  for (const r of reactions) {
    const entry = map.get(r.emoji) || { emoji: r.emoji, count: 0, userIds: [] };
    entry.count += 1;
    entry.userIds.push(r.userId);
    map.set(r.emoji, entry);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

const MESSAGE_INCLUDE = {
  sender: { select: { id: true, name: true, username: true, avatarUrl: true, verified: true } },
  attachments: true,
  reactions: true,
  replyTo: {
    select: {
      id: true,
      content: true,
      contentType: true,
      sender: { select: { id: true, name: true, username: true } },
    },
  },
  forwardedFrom: {
    select: { id: true, content: true, sender: { select: { id: true, name: true, username: true } } },
  },
  poll: { include: { options: { include: { votes: true } } } },
  sticker: true,
  reads: { select: { userId: true, readAt: true } },
};

function serialize(message) {
  return { ...message, reactionSummary: aggregateReactions(message.reactions || []) };
}

module.exports = function attachSocketLayer(io, prisma) {
  io.use(async (socket, nextFn) => {
    const userId = await resolveUserId(socket);
    if (!userId) return nextFn(new Error('unauthorized'));
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, banned: true, username: true, name: true, avatarUrl: true },
    });
    if (!user || user.banned) return nextFn(new Error('forbidden'));
    socket.data.user = user;
    nextFn();
  });

  const membership = (chatId, userId) =>
    prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId } },
      include: { chat: true },
    });

  async function broadcastPresence(userId, status) {
    const chatIds = (
      await prisma.chatMember.findMany({ where: { userId }, select: { chatId: true } })
    ).map((m) => m.chatId);
    for (const chatId of chatIds) io.to(`chat:${chatId}`).emit('presence:update', { userId, presence: status });
    io.emit('presence:global', { userId, presence: status });
  }

  io.on('connection', async (socket) => {
    const me = socket.data.user;
    const sockets = presence.get(me.id) || new Set();
    sockets.add(socket.id);
    presence.set(me.id, sockets);

    socket.join(`user:${me.id}`);
    const memberships = await prisma.chatMember.findMany({
      where: { userId: me.id },
      select: { chatId: true },
    });
    for (const m of memberships) socket.join(`chat:${m.chatId}`);

    if (sockets.size === 1) {
      await prisma.user.update({ where: { id: me.id }, data: { presence: 'ONLINE' } });
      await broadcastPresence(me.id, 'ONLINE');
    }
    socket.emit('ready', { userId: me.id, online: [...presence.keys()] });

    // ── presence ──────────────────────────────────────────────
    socket.on('presence:set', async (status) => {
      if (!['ONLINE', 'AWAY', 'DND', 'OFFLINE'].includes(status)) return;
      await prisma.user.update({ where: { id: me.id }, data: { presence: status } });
      await broadcastPresence(me.id, status);
    });

    socket.on('chat:join', async (chatId) => {
      if (typeof chatId !== 'string') return;
      if (await membership(chatId, me.id)) socket.join(`chat:${chatId}`);
    });
    socket.on('chat:leave', (chatId) => socket.leave(`chat:${chatId}`));

    // ── typing ────────────────────────────────────────────────
    socket.on('typing', ({ chatId, isTyping }) => {
      if (typeof chatId !== 'string') return;
      socket.to(`chat:${chatId}`).emit('typing:update', {
        chatId,
        userId: me.id,
        name: me.name,
        isTyping: Boolean(isTyping),
      });
    });

    // ── drafts (autosaved server-side so they survive device switches) ──
    socket.on('draft:save', async ({ chatId, text }) => {
      if (typeof chatId !== 'string') return;
      await prisma.chatMember
        .update({
          where: { chatId_userId: { chatId, userId: me.id } },
          data: { draft: text ? String(text).slice(0, 4000) : null },
        })
        .catch(() => {});
    });

    // ── send ──────────────────────────────────────────────────
    socket.on('message:send', async (payload, ack) => {
      try {
        // Shared with the HTTP routes, so the admin-configured `message.send`
        // budget holds no matter which path a client uses.
        const gate = await checkRateLimit('message.send', me.id, prisma);
        if (!gate.ok) return ack?.({ error: 'rate_limited', reason: gate.message, retryAfterSec: gate.retryAfterSec });
        const {
          chatId,
          content = '',
          contentType = 'TEXT',
          codeLanguage,
          replyToId,
          forwardedFromId,
          stickerId,
          attachments = [],
          selfDestructSec,
          lat,
          lng,
          locationName,
          clientId,
        } = payload || {};

        const member = await membership(chatId, me.id);
        if (!member) return ack?.({ error: 'not_a_member' });

        const isPrivileged = ['OWNER', 'ADMIN', 'MODERATOR'].includes(member.role);
        if ((member.chat.type === 'CHANNEL' || member.chat.onlyAdminsCanPost) && !isPrivileged) {
          return ack?.({ error: 'read_only' });
        }
        if (!content.trim() && attachments.length === 0 && !stickerId) {
          return ack?.({ error: 'empty' });
        }
        if (member.chat.slowModeSec > 0 && !isPrivileged) {
          const last = await prisma.message.findFirst({
            where: { chatId, senderId: me.id },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
          });
          if (last && Date.now() - last.createdAt.getTime() < member.chat.slowModeSec * 1000) {
            return ack?.({ error: 'slow_mode' });
          }
        }
        if (member.chat.type === 'DM') {
          const others = await prisma.chatMember.findMany({
            where: { chatId, userId: { not: me.id } },
            select: { userId: true },
          });
          const blocked = await prisma.block.findFirst({
            where: {
              OR: others.flatMap((o) => [
                { blockerId: o.userId, blockedId: me.id },
                { blockerId: me.id, blockedId: o.userId },
              ]),
            },
          });
          if (blocked) return ack?.({ error: 'blocked' });
        }

        const ttl = Number(selfDestructSec) || null;
        const message = await prisma.message.create({
          data: {
            chatId,
            senderId: me.id,
            content: String(content).slice(0, 8000),
            contentType,
            codeLanguage: codeLanguage || null,
            replyToId: replyToId || null,
            forwardedFromId: forwardedFromId || null,
            stickerId: stickerId || null,
            lat: typeof lat === 'number' ? lat : null,
            lng: typeof lng === 'number' ? lng : null,
            locationName: locationName || null,
            selfDestructSec: ttl,
            expiresAt: ttl ? new Date(Date.now() + ttl * 1000) : null,
            attachments: attachments.length
              ? {
                  create: attachments.slice(0, 10).map((a) => ({
                    kind: a.kind || 'DOC',
                    url: a.url,
                    thumbUrl: a.thumbUrl || null,
                    name: a.name || 'file',
                    mime: a.mime || 'application/octet-stream',
                    size: Number(a.size) || 0,
                    width: a.width || null,
                    height: a.height || null,
                    duration: a.duration || null,
                    waveform: a.waveform ? JSON.stringify(a.waveform) : null,
                    ocrText: a.ocrText || null,
                  })),
                }
              : undefined,
          },
          include: MESSAGE_INCLUDE,
        });

        await prisma.$transaction([
          prisma.chat.update({ where: { id: chatId }, data: { lastMessageAt: message.createdAt } }),
          prisma.chatMember.update({
            where: { chatId_userId: { chatId, userId: me.id } },
            data: { draft: null, lastReadAt: new Date(), lastReadMessageId: message.id },
          }),
        ]);

        io.to(`chat:${chatId}`).emit('message:new', { ...serialize(message), clientId });
        ack?.({ ok: true, message: serialize(message), clientId });
        await notifyMembers({ chatId, message, authorId: me.id });
      } catch (err) {
        console.error('[lumina] message:send', err);
        ack?.({ error: 'server_error' });
      }
    });

    async function notifyMembers({ chatId, message, authorId }) {
      const mentionedUsernames = [...String(message.content).matchAll(/@([a-zA-Z0-9_]{2,32})/g)].map(
        (m) => m[1].toLowerCase(),
      );
      const mentionsAll = /@(all|everyone|все)\b/i.test(message.content);
      const members = await prisma.chatMember.findMany({
        where: { chatId, userId: { not: authorId } },
        include: { user: { select: { id: true, username: true, presence: true } }, chat: true },
      });

      for (const member of members) {
        const mentioned = mentionsAll || mentionedUsernames.includes(member.user.username.toLowerCase());
        const muted = !member.notificationsEnabled || (member.muteUntil && member.muteUntil > new Date());
        const importance = scoreImportance(message.content, mentioned);
        if (muted && importance !== 'HIGH') {
          io.to(`user:${member.userId}`).emit('chat:bump', { chatId, messageId: message.id });
          continue;
        }
        const title = member.chat.type === 'DM' ? message.sender?.name : member.chat.title || 'Lumina';
        const body =
          message.contentType === 'TEXT'
            ? String(message.content).slice(0, 140)
            : `[${message.contentType.toLowerCase()}]`;

        const notification = await prisma.notification.create({
          data: {
            userId: member.userId,
            type: mentioned ? 'MENTION' : 'MESSAGE',
            title: title || 'Lumina',
            body,
            chatId,
            importance,
          },
        });
        io.to(`user:${member.userId}`).emit('notification:new', notification);
        if (member.user.presence !== 'ONLINE') {
          sendPushToUser(prisma, member.userId, { title, body, chatId, tag: chatId }).catch(() => {});
        }
      }
    }

    // ── edit / delete / pin ───────────────────────────────────
    socket.on('message:edit', async ({ messageId, content }, ack) => {
      const message = await prisma.message.findUnique({ where: { id: messageId } });
      if (!message || message.senderId !== me.id || message.deletedAt) return ack?.({ error: 'forbidden' });
      const updated = await prisma.message.update({
        where: { id: messageId },
        data: { content: String(content).slice(0, 8000), editedAt: new Date() },
        include: MESSAGE_INCLUDE,
      });
      io.to(`chat:${message.chatId}`).emit('message:edited', serialize(updated));
      ack?.({ ok: true });
    });

    socket.on('message:delete', async ({ messageId, forAll }, ack) => {
      const message = await prisma.message.findUnique({ where: { id: messageId } });
      if (!message) return ack?.({ error: 'not_found' });
      const member = await membership(message.chatId, me.id);
      const canModerate = member && ['OWNER', 'ADMIN', 'MODERATOR'].includes(member.role);
      if (message.senderId !== me.id && !canModerate) return ack?.({ error: 'forbidden' });

      if (forAll) {
        await prisma.message.update({
          where: { id: messageId },
          data: { deletedAt: new Date(), deletedForAll: true, content: '', isPinned: false },
        });
        io.to(`chat:${message.chatId}`).emit('message:deleted', { messageId, chatId: message.chatId, forAll: true });
      } else {
        await prisma.savedMessage.deleteMany({ where: { userId: me.id, messageId } });
        socket.emit('message:deleted', { messageId, chatId: message.chatId, forAll: false });
      }
      ack?.({ ok: true });
    });

    socket.on('message:pin', async ({ messageId, pinned }, ack) => {
      const message = await prisma.message.findUnique({ where: { id: messageId } });
      if (!message) return ack?.({ error: 'not_found' });
      const member = await membership(message.chatId, me.id);
      if (!member) return ack?.({ error: 'forbidden' });
      if (member.chat.type !== 'DM' && !['OWNER', 'ADMIN', 'MODERATOR'].includes(member.role)) {
        return ack?.({ error: 'forbidden' });
      }
      await prisma.message.update({ where: { id: messageId }, data: { isPinned: Boolean(pinned) } });
      io.to(`chat:${message.chatId}`).emit('message:pinned', { messageId, pinned: Boolean(pinned) });
      ack?.({ ok: true });
    });

    // ── reactions (light bursts for the glow emoji) ────────────
    socket.on('reaction:toggle', async ({ messageId, emoji }, ack) => {
      const message = await prisma.message.findUnique({ where: { id: messageId }, select: { chatId: true } });
      if (!message || !emoji) return ack?.({ error: 'not_found' });
      if (!(await membership(message.chatId, me.id))) return ack?.({ error: 'forbidden' });

      const existing = await prisma.reaction.findUnique({
        where: { messageId_userId_emoji: { messageId, userId: me.id, emoji } },
      });
      if (existing) await prisma.reaction.delete({ where: { id: existing.id } });
      else await prisma.reaction.create({ data: { messageId, userId: me.id, emoji } });

      const reactions = await prisma.reaction.findMany({ where: { messageId } });
      io.to(`chat:${message.chatId}`).emit('reaction:updated', {
        messageId,
        summary: aggregateReactions(reactions),
      });
      if (!existing && LIGHT_EMOJI.has(emoji)) {
        io.to(`chat:${message.chatId}`).emit('light:burst', { messageId, emoji, from: me.id });
      }
      ack?.({ ok: true });
    });

    // ── read receipts ─────────────────────────────────────────
    socket.on('message:read', async ({ chatId, messageId }) => {
      if (!chatId || !messageId) return;
      const member = await membership(chatId, me.id);
      if (!member) return;
      await prisma.messageRead
        .upsert({
          where: { messageId_userId: { messageId, userId: me.id } },
          create: { messageId, userId: me.id },
          update: { readAt: new Date() },
        })
        .catch(() => {});
      await prisma.chatMember.update({
        where: { chatId_userId: { chatId, userId: me.id } },
        data: { lastReadAt: new Date(), lastReadMessageId: messageId },
      });
      io.to(`chat:${chatId}`).emit('message:read', { chatId, messageId, userId: me.id, readAt: new Date() });
    });

    // ── polls ─────────────────────────────────────────────────
    socket.on('poll:vote', async ({ optionId }, ack) => {
      const option = await prisma.pollOption.findUnique({
        where: { id: optionId },
        include: { poll: { include: { message: true, options: true } } },
      });
      if (!option) return ack?.({ error: 'not_found' });
      const { poll } = option;
      if (!(await membership(poll.message.chatId, me.id))) return ack?.({ error: 'forbidden' });
      if (poll.closesAt && poll.closesAt < new Date()) return ack?.({ error: 'closed' });

      const existing = await prisma.pollVote.findFirst({
        where: { userId: me.id, option: { pollId: poll.id } },
      });
      if (existing && !poll.multiple) await prisma.pollVote.delete({ where: { id: existing.id } });
      const already = await prisma.pollVote.findUnique({
        where: { optionId_userId: { optionId, userId: me.id } },
      });
      if (already) await prisma.pollVote.delete({ where: { id: already.id } });
      else await prisma.pollVote.create({ data: { optionId, userId: me.id } });

      const fresh = await prisma.poll.findUnique({
        where: { id: poll.id },
        include: { options: { include: { votes: true }, orderBy: { order: 'asc' } } },
      });
      io.to(`chat:${poll.message.chatId}`).emit('poll:updated', { messageId: poll.messageId, poll: fresh });
      ack?.({ ok: true });
    });

    // ── calls: WebRTC signalling relay ────────────────────────
    socket.on('call:start', async ({ chatId, kind = 'AUDIO' }, ack) => {
      const member = await membership(chatId, me.id);
      if (!member) return ack?.({ error: 'forbidden' });
      const session = await prisma.callSession.create({
        data: { chatId, startedById: me.id, kind, participants: JSON.stringify([me.id]) },
      });
      const others = await prisma.chatMember.findMany({
        where: { chatId, userId: { not: me.id } },
        select: { userId: true },
      });
      for (const o of others) {
        io.to(`user:${o.userId}`).emit('call:incoming', {
          callId: session.id,
          chatId,
          kind,
          from: { id: me.id, name: me.name, username: me.username, avatarUrl: me.avatarUrl },
        });
      }
      socket.join(`call:${session.id}`);
      ack?.({ ok: true, callId: session.id });
    });

    socket.on('call:join', async ({ callId }, ack) => {
      const session = await prisma.callSession.findUnique({ where: { id: callId } });
      if (!session || session.endedAt) return ack?.({ error: 'ended' });
      if (!(await membership(session.chatId, me.id))) return ack?.({ error: 'forbidden' });
      const participants = new Set(JSON.parse(session.participants || '[]'));
      participants.add(me.id);
      await prisma.callSession.update({
        where: { id: callId },
        data: { participants: JSON.stringify([...participants]) },
      });
      socket.join(`call:${callId}`);
      socket.to(`call:${callId}`).emit('call:peer-joined', {
        callId,
        peerId: me.id,
        socketId: socket.id,
        user: { id: me.id, name: me.name, avatarUrl: me.avatarUrl },
      });
      ack?.({ ok: true, participants: [...participants] });
    });

    // Raw SDP/ICE relay — the browser does the negotiating, the server only forwards.
    socket.on('call:signal', ({ callId, to, data }) => {
      if (!callId || !data) return;
      const target = to ? `user:${to}` : `call:${callId}`;
      socket.to(target).emit('call:signal', { callId, from: me.id, socketId: socket.id, data });
    });

    socket.on('call:state', ({ callId, muted, videoOff, screenSharing, recording }) => {
      socket
        .to(`call:${callId}`)
        .emit('call:state', { callId, userId: me.id, muted, videoOff, screenSharing, recording });
    });

    socket.on('call:reject', async ({ callId }) => {
      const session = await prisma.callSession.findUnique({ where: { id: callId } });
      if (!session) return;
      io.to(`user:${session.startedById}`).emit('call:rejected', { callId, by: me.id });
    });

    socket.on('call:end', async ({ callId }) => {
      const session = await prisma.callSession.findUnique({ where: { id: callId } });
      if (!session) return;
      io.to(`call:${callId}`).emit('call:ended', { callId, by: me.id });
      socket.leave(`call:${callId}`);
      if (session.startedById === me.id && !session.endedAt) {
        await prisma.callSession.update({ where: { id: callId }, data: { endedAt: new Date() } });
        const duration = Math.round((Date.now() - session.startedAt.getTime()) / 1000);
        const sys = await prisma.message.create({
          data: {
            chatId: session.chatId,
            senderId: me.id,
            contentType: 'CALL',
            content: JSON.stringify({ kind: session.kind, duration }),
          },
          include: MESSAGE_INCLUDE,
        });
        io.to(`chat:${session.chatId}`).emit('message:new', serialize(sys));
      }
    });

    // ── gifts & live light effects ────────────────────────────
    socket.on('gift:send', async ({ chatId, receiverId, kind, message }, ack) => {
      if (!(await membership(chatId, me.id))) return ack?.({ error: 'forbidden' });
      const gift = await prisma.gift.create({
        data: { senderId: me.id, receiverId, chatId, kind, message: message || null },
      });
      io.to(`chat:${chatId}`).emit('gift:new', { ...gift, sender: me });
      ack?.({ ok: true });
    });

    // ── disconnect ────────────────────────────────────────────
    socket.on('disconnect', async () => {
      const set = presence.get(me.id);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) {
          presence.delete(me.id);
          await prisma.user
            .update({ where: { id: me.id }, data: { presence: 'OFFLINE', lastSeenAt: new Date() } })
            .catch(() => {});
          await broadcastPresence(me.id, 'OFFLINE');
        }
      }
    });
  });

  return io;
};
