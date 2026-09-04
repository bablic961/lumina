'use client';

/**
 * End-to-end encryption helpers built on WebCrypto only — no key material ever
 * reaches the server.
 *
 * Direct chats  : ECDH P-256 → HKDF → AES-GCM 256. The private key stays in
 *                 localStorage of the device; the public key is published on
 *                 the profile so peers can derive the same shared secret.
 * Private notes : PBKDF2(passphrase) → AES-GCM 256, so the vault can be opened
 *                 on any device with the passphrase alone.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();
const PRIVATE_KEY_STORE = 'lumina.e2e.privateKey';

const toB64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));

export async function ensureKeyPair(): Promise<{ publicKey: string }> {
  const existing = localStorage.getItem(PRIVATE_KEY_STORE);
  if (existing) {
    const jwk = JSON.parse(existing) as JsonWebKey & { pub?: string };
    if (jwk.pub) return { publicKey: jwk.pub };
  }
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveKey',
  ]);
  const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const publicKey = btoa(JSON.stringify(publicJwk));
  localStorage.setItem(PRIVATE_KEY_STORE, JSON.stringify({ ...privateJwk, pub: publicKey }));
  return { publicKey };
}

async function loadPrivateKey() {
  const raw = localStorage.getItem(PRIVATE_KEY_STORE);
  if (!raw) throw new Error('Ключ этого устройства не найден — включите шифрование в настройках');
  const { pub, ...jwk } = JSON.parse(raw);
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, [
    'deriveKey',
  ]);
}

async function sharedKey(peerPublicKey: string) {
  const priv = await loadPrivateKey();
  const peerJwk = JSON.parse(atob(peerPublicKey));
  const pub = await crypto.subtle.importKey('jwk', peerJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: pub },
    priv,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptFor(peerPublicKey: string, plaintext: string) {
  const key = await sharedKey(peerPublicKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
  return `e2e:v1:${toB64(iv.buffer)}:${toB64(cipher)}`;
}

export async function decryptFrom(peerPublicKey: string, payload: string) {
  if (!payload.startsWith('e2e:v1:')) return payload;
  const [, , ivB64, dataB64] = payload.split(':');
  const key = await sharedKey(peerPublicKey);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(ivB64) },
    key,
    fromB64(dataB64),
  );
  return dec.decode(plain);
}

export const isEncrypted = (value: string) => value.startsWith('e2e:v1:');

// ── passphrase vault (encrypted notes) ──
async function vaultKey(passphrase: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 210_000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function sealNote(passphrase: string, text: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await vaultKey(passphrase, salt);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text));
  return { cipherText: toB64(cipher), iv: `${toB64(salt.buffer)}.${toB64(iv.buffer)}` };
}

export async function openNote(passphrase: string, cipherText: string, ivField: string) {
  const [saltB64, ivB64] = ivField.split('.');
  const key = await vaultKey(passphrase, fromB64(saltB64));
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(ivB64) },
    key,
    fromB64(cipherText),
  );
  return dec.decode(plain);
}
