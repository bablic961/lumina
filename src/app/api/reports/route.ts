import { prisma } from '@/lib/prisma';
import { HttpError, jsonError, requireUser } from '@/lib/guards';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

/** File a report about a user or a message; moderators read it in the admin panel. */
export async function POST(req: Request) {
  try {
    const me = await requireUser();
    const body = (await req.json()) as {
      targetUserId?: string;
      targetMessageId?: string;
      reason?: string;
      details?: string;
    };
    const reason = (body.reason || '').trim();
    if (!reason) throw new HttpError(400, 'Укажите причину');
    if (!body.targetUserId && !body.targetMessageId) throw new HttpError(400, 'Не указан объект жалобы');

    const report = await prisma.report.create({
      data: {
        reporterId: me.id,
        targetUserId: body.targetUserId ?? null,
        targetMessageId: body.targetMessageId ?? null,
        reason: reason.slice(0, 200),
        details: body.details?.slice(0, 2000) ?? null,
      },
    });
    return Response.json({ ok: true, id: report.id });
  } catch (err) {
    return jsonError(err);
  }
}
