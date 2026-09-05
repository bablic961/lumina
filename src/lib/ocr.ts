'use client';

/**
 * Text recognition for outgoing images, so a screenshot becomes searchable by
 * what is written on it rather than only by its file name.
 *
 * Tesseract is loaded on demand and never blocks a send: the language data is
 * around 20 MB, so it cannot sit in the main bundle, and a slow or failed
 * recognition just leaves `ocrText` empty instead of holding the message back.
 * Call `warmOcr()` the moment a file is staged — by the time the user actually
 * presses send, the worker is usually ready and the wait is invisible.
 */

import type { Worker } from 'tesseract.js';

/** Larger screenshots exist, but past this the recognition costs more than it returns. */
const MAX_BYTES = 8 * 1024 * 1024;
/** Budget for one image. Whatever misses it is dropped, not waited for. */
const TIMEOUT_MS = 7_000;
/** Below this Tesseract is mostly reporting noise from textures and gradients. */
const MIN_CONFIDENCE = 55;
const MIN_LENGTH = 3;
const MAX_LENGTH = 4_000;

let worker: Promise<Worker> | null = null;

function getWorker() {
  if (!worker) {
    worker = import('tesseract.js')
      .then(({ createWorker }) => createWorker('rus+eng'))
      .catch((err) => {
        // A failed CDN fetch must not poison every image that follows.
        worker = null;
        throw err;
      });
  }
  return worker;
}

/** Starts the download early. Safe to call repeatedly; failures are ignored. */
export function warmOcr(files: File[]) {
  if (files.some(canRecognize)) void getWorker().catch(() => null);
}

function canRecognize(file: File) {
  return file.type.startsWith('image/') && !file.type.includes('svg') && file.size <= MAX_BYTES;
}

function withTimeout<T>(task: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    task
      .then(resolve)
      .catch(() => resolve(null))
      .finally(() => clearTimeout(timer));
  });
}

/** Recognised text, or null when there is none, the image is too big, or OCR misbehaves. */
export async function recognizeImageText(file: File): Promise<string | null> {
  if (!canRecognize(file)) return null;

  const result = await withTimeout(getWorker().then((w) => w.recognize(file)), TIMEOUT_MS);
  if (!result || result.data.confidence < MIN_CONFIDENCE) return null;

  // Tesseract pads its output with blank lines and stray single characters.
  const cleaned = result.data.text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 1)
    .join('\n')
    .trim();

  return cleaned.length >= MIN_LENGTH ? cleaned.slice(0, MAX_LENGTH) : null;
}
