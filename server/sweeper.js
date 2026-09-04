/**
 * Background housekeeping: self-destructing messages, expired stories and
 * stale invites. Runs every 15 s inside the app process — no external cron
 * needed for a single-node deployment.
 */
module.exports = function startSweeper(io, prisma) {
  const tick = async () => {
    const now = new Date();
    try {
      const doomed = await prisma.message.findMany({
        where: { expiresAt: { lte: now }, deletedAt: null },
        select: { id: true, chatId: true },
      });
      if (doomed.length) {
        await prisma.message.updateMany({
          where: { id: { in: doomed.map((m) => m.id) } },
          data: { deletedAt: now, deletedForAll: true, content: '' },
        });
        for (const m of doomed) {
          io.to(`chat:${m.chatId}`).emit('message:deleted', {
            messageId: m.id,
            chatId: m.chatId,
            forAll: true,
            reason: 'self_destruct',
          });
        }
      }

      const expiredStories = await prisma.story.deleteMany({ where: { expiresAt: { lte: now } } });
      if (expiredStories.count) io.emit('stories:expired', { count: expiredStories.count });

      await prisma.invite.deleteMany({ where: { expiresAt: { lte: now } } });
    } catch (err) {
      console.error('[lumina] sweeper', err.message);
    }
  };

  tick();
  const timer = setInterval(tick, 15_000);
  timer.unref?.();
  return timer;
};
