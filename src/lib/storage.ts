import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import type { AttachmentKind } from '@/types';

const MAX_MB = Number(process.env.MAX_UPLOAD_MB || 100);
const UPLOAD_ROOT = path.join(process.cwd(), 'public', 'uploads');

export const MAX_UPLOAD_BYTES = MAX_MB * 1024 * 1024;

export function kindFromMime(mime: string): AttachmentKind {
  if (mime.startsWith('image/')) return 'IMAGE';
  if (mime.startsWith('video/')) return 'VIDEO';
  if (mime.startsWith('audio/')) return 'AUDIO';
  return 'DOC';
}

function safeExtension(name: string, mime: string) {
  const ext = path.extname(name).toLowerCase().replace(/[^a-z0-9.]/g, '');
  if (ext && ext.length <= 6) return ext;
  const guess = mime.split('/')[1]?.replace(/[^a-z0-9]/g, '') || 'bin';
  return `.${guess.slice(0, 5)}`;
}

export interface StoredFile {
  url: string;
  thumbUrl: string | null;
  name: string;
  mime: string;
  size: number;
  kind: AttachmentKind;
  width: number | null;
  height: number | null;
}

/**
 * Persists an upload under public/uploads/<yyyy>/<mm>/.
 * Images are re-encoded (metadata stripped, max edge 2560) and get a 480px
 * thumbnail; everything else is stored byte-for-byte.
 *
 * STORAGE_DRIVER exists so this is the single place to swap in S3 / Vercel Blob:
 * only this function needs to change.
 */
export async function saveUpload(file: File, opts: { voice?: boolean } = {}): Promise<StoredFile> {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(`Файл больше ${MAX_MB} МБ`);

  const now = new Date();
  const dir = path.join(UPLOAD_ROOT, String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, '0'));
  await mkdir(dir, { recursive: true });

  const mime = file.type || 'application/octet-stream';
  const kind: AttachmentKind = opts.voice ? 'VOICE' : kindFromMime(mime);
  const id = randomUUID();
  const buffer = Buffer.from(await file.arrayBuffer());
  const publicBase = `/uploads/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;

  if (kind === 'IMAGE' && !mime.includes('svg') && !mime.includes('gif')) {
    const image = sharp(buffer, { failOn: 'none' }).rotate();
    const meta = await image.metadata();
    const main = await image
      .resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 86 })
      .toBuffer();
    const thumb = await sharp(buffer, { failOn: 'none' })
      .rotate()
      .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer();

    await writeFile(path.join(dir, `${id}.webp`), main);
    await writeFile(path.join(dir, `${id}_thumb.webp`), thumb);
    return {
      url: `${publicBase}/${id}.webp`,
      thumbUrl: `${publicBase}/${id}_thumb.webp`,
      name: file.name || 'image.webp',
      mime: 'image/webp',
      size: main.byteLength,
      kind,
      width: meta.width ?? null,
      height: meta.height ?? null,
    };
  }

  const ext = safeExtension(file.name || '', mime);
  await writeFile(path.join(dir, `${id}${ext}`), buffer);
  return {
    url: `${publicBase}/${id}${ext}`,
    thumbUrl: null,
    name: file.name || `file${ext}`,
    mime,
    size: buffer.byteLength,
    kind,
    width: null,
    height: null,
  };
}
