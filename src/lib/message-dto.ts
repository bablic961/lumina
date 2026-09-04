/**
 * One include shape for every route that returns a message, so the client always
 * receives the same MessageDTO regardless of which endpoint produced it.
 */
export const MESSAGE_INCLUDE = {
  sender: { select: { id: true, name: true, username: true, avatarUrl: true, verified: true } },
  attachments: true,
  reactions: true,
  replyTo: {
    select: {
      id: true,
      content: true,
      contentType: true,
      sender: { select: { id: true, name: true, username: true, avatarUrl: true, verified: true } },
    },
  },
  forwardedFrom: {
    select: {
      id: true,
      content: true,
      sender: { select: { id: true, name: true, username: true, avatarUrl: true, verified: true } },
    },
  },
  poll: { include: { options: { include: { votes: true }, orderBy: { order: 'asc' as const } } } },
  sticker: true,
  reads: { select: { userId: true, readAt: true } },
};

/** Collapses raw reaction rows into `[{ emoji, count, userIds }]`, most used first. */
export function withReactionSummary<T extends { reactions: { emoji: string; userId: string }[] }>(message: T) {
  const map = new Map<string, { emoji: string; count: number; userIds: string[] }>();
  for (const reaction of message.reactions) {
    const entry = map.get(reaction.emoji) ?? { emoji: reaction.emoji, count: 0, userIds: [] };
    entry.count += 1;
    entry.userIds.push(reaction.userId);
    map.set(reaction.emoji, entry);
  }
  return { ...message, reactionSummary: [...map.values()].sort((a, b) => b.count - a.count) };
}
