/** Shared union types. The DB stores these as strings (Postgres-portable schema). */

export type Presence = 'ONLINE' | 'AWAY' | 'DND' | 'OFFLINE';
export type ChatType = 'DM' | 'GROUP' | 'CHANNEL';
export type MemberRole = 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER';
export type ContentType =
  | 'TEXT'
  | 'CODE'
  | 'LOCATION'
  | 'VOICE'
  | 'FILE'
  | 'STICKER'
  | 'SYSTEM'
  | 'CALL'
  | 'POLL';
export type AttachmentKind = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'VOICE' | 'DOC';
export type ThemeName = 'light' | 'dark' | 'amoled' | 'auto';
export type Density = 'compact' | 'cozy' | 'roomy';
export type Importance = 'LOW' | 'NORMAL' | 'HIGH';
export type CallKind = 'AUDIO' | 'VIDEO';

export const ACCENTS = [
  'amber',
  'rose',
  'teal',
  'violet',
  'lime',
  'sky',
  'fuchsia',
  'emerald',
  'orange',
  'indigo',
  'pink',
  'gold',
] as const;
export type Accent = (typeof ACCENTS)[number];

export const PERMISSIONS = [
  'send_messages',
  'send_media',
  'delete_messages',
  'pin_messages',
  'manage_members',
  'manage_roles',
  'manage_chat',
  'start_calls',
  'create_polls',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export interface PublicUser {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  verified: boolean;
  presence?: Presence;
  statusEmoji?: string | null;
  statusText?: string | null;
  lastSeenAt?: string | Date | null;
  bio?: string | null;
}

export interface AttachmentDTO {
  id: string;
  kind: AttachmentKind;
  url: string;
  thumbUrl: string | null;
  name: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  waveform: string | null;
  ocrText: string | null;
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  userIds: string[];
}

export interface PollDTO {
  id: string;
  question: string;
  multiple: boolean;
  anonymous: boolean;
  closesAt: string | null;
  options: { id: string; text: string; order: number; votes: { userId: string }[] }[];
}

export interface MessageDTO {
  id: string;
  chatId: string;
  senderId: string | null;
  content: string;
  contentType: ContentType;
  codeLanguage: string | null;
  lat: number | null;
  lng: number | null;
  locationName: string | null;
  replyToId: string | null;
  forwardedFromId: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  deletedForAll: boolean;
  isPinned: boolean;
  selfDestructSec: number | null;
  expiresAt: string | null;
  createdAt: string;
  sender: PublicUser | null;
  attachments: AttachmentDTO[];
  reactionSummary: ReactionSummary[];
  replyTo?: { id: string; content: string; contentType: ContentType; sender: PublicUser | null } | null;
  forwardedFrom?: { id: string; content: string; sender: PublicUser | null } | null;
  sticker?: { id: string; url: string; emoji: string } | null;
  poll?: PollDTO | null;
  reads?: { userId: string; readAt: string }[];
  /** optimistic-send bookkeeping (client only) */
  clientId?: string;
  pending?: boolean;
  failed?: boolean;
}

export interface ChatListItemDTO {
  id: string;
  type: ChatType;
  title: string;
  avatarUrl: string | null;
  description: string | null;
  wallpaper: string | null;
  e2eEnabled: boolean;
  onlyAdminsCanPost: boolean;
  memberCount: number;
  role: MemberRole;
  isPinned: boolean;
  isArchived: boolean;
  folderId: string | null;
  notificationsEnabled: boolean;
  muteUntil: string | null;
  draft: string | null;
  unreadCount: number;
  lastMessageAt: string;
  lastMessage: {
    id: string;
    content: string;
    contentType: ContentType;
    createdAt: string;
    senderId: string | null;
    senderName: string | null;
    deletedForAll: boolean;
  } | null;
  peer: PublicUser | null;
}

export interface TypingState {
  chatId: string;
  userId: string;
  name: string;
  isTyping: boolean;
}

export interface ChatMemberDTO {
  id: string;
  chatId: string;
  userId: string;
  role: MemberRole;
  joinedAt: string;
  customRoleId: string | null;
  customRole: { id: string; name: string; color: string; permissions: string } | null;
  user: PublicUser & { e2ePublicKey?: string | null; birthday?: string | null };
}

export interface InviteDTO {
  id: string;
  code: string;
  maxUses: number | null;
  uses: number;
  expiresAt: string | null;
  createdAt: string;
}

export interface ChatDetailDTO {
  id: string;
  type: ChatType;
  title: string | null;
  description: string | null;
  avatarUrl: string | null;
  wallpaper: string | null;
  e2eEnabled: boolean;
  onlyAdminsCanPost: boolean;
  slowModeSec: number;
  isPublic: boolean;
  createdAt: string;
  lastMessageAt: string;
  members: ChatMemberDTO[];
  customRoles: { id: string; name: string; color: string; permissions: string }[];
  invites: InviteDTO[];
  _count: { members: number; messages: number };
}

export interface MyMembershipDTO {
  role: MemberRole;
  notificationsEnabled: boolean;
  muteUntil: string | null;
  isArchived: boolean;
  isPinned: boolean;
  folderId: string | null;
  draft: string | null;
}

export interface ChatDetailResponse {
  chat: ChatDetailDTO;
  pinned: MessageDTO[];
  me: MyMembershipDTO;
}
