// ─── File formats ────────────────────────────────────────────────────────────

export type SupportedMime =
  | 'image/jpeg'
  | 'image/png'
  | 'image/tiff'
  | 'image/heic'
  | 'application/pdf'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  | 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

export const SUPPORTED_EXTENSIONS: Record<string, SupportedMime> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  heic: 'image/heic',
  heif: 'image/heic',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

// ─── File lifecycle ───────────────────────────────────────────────────────────

export type FileStatus = 'queued' | 'processing' | 'done' | 'error' | 'cancelled';

export interface ScrubJob {
  id: string;
  filename: string;
  mime: SupportedMime;
  originalSize: number;
  status: FileStatus;
}

import type { MetadataReport } from './metadata';

export type {
  MetadataCategory,
  MetadataField,
  MetadataSnapshot,
  MetadataReport,
  ScrubProfile,
} from './metadata';

// ─── Worker message protocol ──────────────────────────────────────────────────

// CANCEL is not sent over the wire — the dispatcher terminates the Worker instead.
export type WorkerInbound = { type: 'SCRUB'; id: string; buffer: ArrayBuffer; mime: SupportedMime };

export type WorkerOutbound =
  | { type: 'PROGRESS'; id: string; percent: number }
  | { type: 'DONE'; id: string; cleanBuffer: ArrayBuffer; report: MetadataReport }
  | { type: 'ERROR'; id: string; code: string; message: string };

// ─── Plan tiers ───────────────────────────────────────────────────────────────

export type Plan = 'free' | 'pro';

export const PLAN_LIMITS: Record<Plan, number> = {
  free: 25,
  pro: Infinity,
};
