import { jsonError, requireUser } from '@/lib/guards';
import { consumeRateLimit } from '@/lib/rateLimit';
import { MAX_UPLOAD_BYTES, saveUpload } from '@/lib/storage';

// Reads the session cookie on every request, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Multipart upload. Next's native FormData parsing handles the streaming, so no
 * multer-style middleware is needed; sharp does the image optimisation inside
 * saveUpload().
 */
export async function POST(req: Request) {
  try {
    const me = await requireUser();
    const form = await req.formData();
    const files = form.getAll('files').filter((f): f is File => f instanceof File);
    const isVoice = form.get('voice') === '1';

    if (files.length === 0) return Response.json({ error: 'Файлы не переданы' }, { status: 422 });
    if (files.length > 10) return Response.json({ error: 'Не больше 10 файлов за раз' }, { status: 422 });

    const oversized = files.find((f) => f.size > MAX_UPLOAD_BYTES);
    if (oversized) {
      return Response.json(
        { error: `«${oversized.name}» превышает лимит ${MAX_UPLOAD_BYTES / 1024 / 1024} МБ` },
        { status: 413 },
      );
    }

    // Charged after validation so a rejected request does not eat the budget.
    await consumeRateLimit('upload', me.id);

    const stored = await Promise.all(files.map((file) => saveUpload(file, { voice: isVoice })));
    return Response.json({ files: stored }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
