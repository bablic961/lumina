import { z } from 'zod';
import { ACCENTS } from '@/types';

export const registerSchema = z.object({
  name: z.string().min(2, 'Минимум 2 символа').max(48),
  username: z
    .string()
    .min(3, 'Минимум 3 символа')
    .max(24)
    .regex(/^[a-zA-Z0-9_]+$/, 'Только латиница, цифры и _'),
  email: z.string().email('Некорректный email'),
  password: z.string().min(8, 'Минимум 8 символов').max(128),
});

export const loginSchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(1),
});

export const profileSchema = z.object({
  name: z.string().min(2).max(48).optional(),
  bio: z.string().max(280).optional().nullable(),
  avatarUrl: z.string().url().or(z.literal('')).optional().nullable(),
  statusEmoji: z.string().max(8).optional().nullable(),
  statusText: z.string().max(64).optional().nullable(),
  presence: z.enum(['ONLINE', 'AWAY', 'DND', 'OFFLINE']).optional(),
  birthday: z.string().datetime().optional().nullable(),
});

export const preferencesSchema = z.object({
  locale: z.enum(['ru', 'en', 'es', 'de', 'fr', 'zh', 'ja', 'ko', 'ar', 'he']).optional(),
  theme: z.enum(['light', 'dark', 'amoled', 'auto']).optional(),
  accent: z.enum(ACCENTS).optional(),
  density: z.enum(['compact', 'cozy', 'roomy']).optional(),
  fontScale: z.number().min(0.8).max(1.4).optional(),
  whoCanMessage: z.enum(['EVERYONE', 'CONTACTS', 'NOBODY']).optional(),
  showPresence: z.boolean().optional(),
  showReadState: z.boolean().optional(),
});

export const createChatSchema = z.object({
  type: z.enum(['DM', 'GROUP', 'CHANNEL']),
  title: z.string().min(1).max(64).optional(),
  description: z.string().max(280).optional(),
  avatarUrl: z.string().optional().nullable(),
  memberIds: z.array(z.string()).max(2000).default([]),
  e2eEnabled: z.boolean().default(false),
  onlyAdminsCanPost: z.boolean().default(false),
});

export const messageSchema = z.object({
  content: z.string().max(8000).default(''),
  contentType: z
    .enum(['TEXT', 'CODE', 'LOCATION', 'VOICE', 'FILE', 'STICKER', 'SYSTEM', 'CALL', 'POLL'])
    .default('TEXT'),
  codeLanguage: z.string().max(24).optional().nullable(),
  replyToId: z.string().optional().nullable(),
  forwardedFromId: z.string().optional().nullable(),
  stickerId: z.string().optional().nullable(),
  selfDestructSec: z.number().int().min(5).max(604800).optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  locationName: z.string().max(120).optional().nullable(),
  attachments: z
    .array(
      z.object({
        kind: z.enum(['IMAGE', 'VIDEO', 'AUDIO', 'VOICE', 'DOC']),
        url: z.string(),
        thumbUrl: z.string().optional().nullable(),
        name: z.string(),
        mime: z.string(),
        size: z.number(),
        width: z.number().optional().nullable(),
        height: z.number().optional().nullable(),
        duration: z.number().optional().nullable(),
        waveform: z.array(z.number()).optional().nullable(),
        ocrText: z.string().optional().nullable(),
      }),
    )
    .max(10)
    .default([]),
});

export const pollSchema = z.object({
  question: z.string().min(1).max(240),
  options: z.array(z.string().min(1).max(100)).min(2).max(10),
  multiple: z.boolean().default(false),
  anonymous: z.boolean().default(true),
  closesInHours: z.number().min(1).max(720).optional().nullable(),
});

export const inviteSchema = z.object({
  expiresInHours: z.number().min(1).max(8760).optional().nullable(),
  maxUses: z.number().int().min(1).max(10000).optional().nullable(),
});

export const reportSchema = z.object({
  targetUserId: z.string().optional().nullable(),
  targetMessageId: z.string().optional().nullable(),
  reason: z.enum(['SPAM', 'ABUSE', 'ILLEGAL', 'SCAM', 'OTHER']),
  details: z.string().max(1000).optional().nullable(),
});

export const noteSchema = z.object({
  title: z.string().min(1).max(120),
  cipherText: z.string().min(1),
  iv: z.string().min(1),
});
