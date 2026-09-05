import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import type { AttachmentKind } from '@/types';

const MAX_MB = Number(process.env.MAX_UPLOAD_MB || 100);
const UPLOAD_ROOT = path.join(process.cwd(), 'public', 'uploads');

export const MAX_UPLOAD_BYTES = MAX_MB * 1024 * 1024;

/**
 * `blob` is for hosts with a read-only filesystem (Vercel); `local` writes into
 * public/uploads and is the default for development and for any box with a disk.
 */
const DRIVER: 'local' | 'blob' = process.env.STORAGE_DRIVER === 'blob' ? 'blob' : 'local';

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
 * Stores one object under `key` (a `<yyyy>/<mm>/<uuid>.<ext>` fragment) and
 * returns the URL to serve it from — site-relative for local disk, absolute for
 * blob storage. Both drivers keep the same key layout, so a database row does
 * not care which one wrote it.
 */
async function put(key: string, data: Buffer, mime: string): Promise<string> {
  if (DRIVER === 'blob') {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error('STORAGE_DRIVER=blob, но BLOB_READ_WRITE_TOKEN не задан');
    }
    // Imported on demand so a local install never has to resolve the package.
    const { put: blobPut } = await import('@vercel/blob');
    const { url } = await blobPut(key, data, {
      access: 'public',
      contentType: mime,
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return url;
  }

  const target = path.join(UPLOAD_ROOT, key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, data);
  return `/uploads/${key}`;
}

/**
 * Persists an upload. Images are re-encoded (metadata stripped, max edge 2560)
 * and get a 480px thumbnail; everything else is stored byte-for-byte.
 */
export async function saveUpload(file: File, opts: { voice?: boolean } = {}): Promise<StoredFile> {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(`Файл больше ${MAX_MB} МБ`);

  const now = new Date();
  const folder = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
  const mime = file.type || 'application/octet-stream';
  const kind: AttachmentKind = opts.voice ? 'VOICE' : kindFromMime(mime);
  const id = randomUUID();
  const buffer = Buffer.from(await file.arrayBuffer());

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

    const [url, thumbUrl] = await Promise.all([
      put(`${folder}/${id}.webp`, main, 'image/webp'),
      put(`${folder}/${id}_thumb.webp`, thumb, 'image/webp'),
    ]);
    return {
      url,
      thumbUrl,
      name: file.name || 'image.webp',
      mime: 'image/webp',
      size: main.byteLength,
      kind,
      width: meta.width ?? null,
      height: meta.height ?? null,
    };
  }

  const ext = safeExtension(file.name || '', mime);
  return {
    url: await put(`${folder}/${id}${ext}`, buffer, mime),
    thumbUrl: null,
    name: file.name || `file${ext}`,
    mime,
    size: buffer.byteLength,
    kind,
    width: null,
    height: null,
  };
}
