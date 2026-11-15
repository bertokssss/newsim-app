import { supabaseAdmin } from './supabase';

export const LEARNING_MATERIALS_BUCKET = 'learning-materials';
export const MAX_MATERIAL_FILE_BYTES = 50 * 1024 * 1024; // 50MB

const ALLOWED_EXTENSION_MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.txt': 'text/plain',
};

export function validateMaterialUploadMeta(
  fileName: string,
  fileSize: number,
  declaredMime?: string
): { valid: true; contentType: string; safeBaseName: string; ext: string } | { valid: false; error: string } {
  const safeBaseName = (fileName || 'material').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  const dotIdx = safeBaseName.lastIndexOf('.');
  const ext = dotIdx >= 0 ? safeBaseName.slice(dotIdx).toLowerCase() : '';
  const mappedMime = ALLOWED_EXTENSION_MIME_MAP[ext];

  if (!mappedMime) {
    return {
      valid: false,
      error: `Unsupported file type "${ext || 'unknown'}". Allowed formats: PDF, PPT/PPTX, DOC/DOCX, MP4/WEBM/MOV, PNG/JPG/WEBP, TXT.`,
    };
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    return { valid: false, error: 'Uploaded file is empty.' };
  }
  if (fileSize > MAX_MATERIAL_FILE_BYTES) {
    return {
      valid: false,
      error: `File "${fileName}" exceeds the 50MB maximum upload limit.`,
    };
  }
  if (declaredMime && (declaredMime.includes('html') || declaredMime.includes('javascript') || declaredMime.includes('svg'))) {
    return { valid: false, error: 'Executable or active web content MIME types are not permitted.' };
  }
  return { valid: true, contentType: mappedMime, safeBaseName, ext };
}

/**
 * Strips PostgREST syntax metacharacters from user search strings before
 * interpolating into `.or(...)` filter expressions.
 */
export function escapePostgrestFilter(value: unknown, maxLength = 120): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[\\(),."*'%]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/**
 * Validates URLs stored for learning materials / external resources.
 * Allows safe http(s) URLs, internal storage:// URIs, or safe single-slash relative paths.
 */
export function sanitizeMaterialUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('storage://')) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) {
    return trimmed.startsWith('//') ? '' : trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    return '';
  }
  return '';
}

export function toStorageUri(objectPath: string): string {
  const clean = objectPath.replace(/^\/+/, '');
  return `storage://${LEARNING_MATERIALS_BUCKET}/${clean}`;
}

export function extractStorageObjectPath(urlOrPath: string | null | undefined): string | null {
  if (!urlOrPath) return null;
  const trimmed = urlOrPath.trim();
  const prefix = `storage://${LEARNING_MATERIALS_BUCKET}/`;
  if (trimmed.startsWith(prefix)) {
    return trimmed.slice(prefix.length).replace(/^\/+/, '');
  }
  if (trimmed.startsWith('/uploads/')) {
    return trimmed.slice('/uploads/'.length).replace(/^\/+/, '');
  }
  return null;
}

export async function uploadToLearningMaterialsStorage(
  objectPath: string,
  data: Buffer | Uint8Array | ArrayBuffer,
  contentType = 'application/octet-stream'
): Promise<{ storageUri: string; signedUrl: string }> {
  const cleanPath = objectPath.replace(/^\/+/, '');
  const payload = data instanceof ArrayBuffer ? Buffer.from(data) : Buffer.from(data);

  const { error: uploadError } = await supabaseAdmin.storage
    .from(LEARNING_MATERIALS_BUCKET)
    .upload(cleanPath, payload, {
      contentType: contentType || 'application/octet-stream',
      upsert: true,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data: signedData } = await supabaseAdmin.storage
    .from(LEARNING_MATERIALS_BUCKET)
    .createSignedUrl(cleanPath, 3600);

  return {
    storageUri: toStorageUri(cleanPath),
    signedUrl: signedData?.signedUrl || toStorageUri(cleanPath),
  };
}

export async function resolveMaterialAccessUrl(
  urlOrPath: string | null | undefined,
  expiresInSeconds = 3600
): Promise<string> {
  if (!urlOrPath) return '';
  const storagePath = extractStorageObjectPath(urlOrPath);
  if (!storagePath) {
    return sanitizeMaterialUrl(urlOrPath);
  }
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(LEARNING_MATERIALS_BUCKET)
      .createSignedUrl(storagePath, expiresInSeconds);
    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }
  } catch {
    // fallback safely below
  }
  return urlOrPath.startsWith('/') ? urlOrPath : '';
}

export async function readStorageJson<T>(objectPath: string): Promise<T | null> {
  const cleanPath = objectPath.replace(/^\/+/, '');
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(LEARNING_MATERIALS_BUCKET)
      .download(cleanPath);
    if (error || !data) return null;
    const text = await data.text();
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function writeStorageJson(objectPath: string, payload: unknown): Promise<void> {
  const cleanPath = objectPath.replace(/^\/+/, '');
  const body = Buffer.from(JSON.stringify(payload, null, 2), 'utf-8');
  const { error } = await supabaseAdmin.storage
    .from(LEARNING_MATERIALS_BUCKET)
    .upload(cleanPath, body, {
      contentType: 'application/json',
      upsert: true,
    });
  if (error) {
    throw error;
  }
}

export async function deleteFromLearningMaterialsStorage(urlOrPath: string | null | undefined): Promise<void> {
  const storagePath = extractStorageObjectPath(urlOrPath);
  if (!storagePath) return;
  try {
    await supabaseAdmin.storage.from(LEARNING_MATERIALS_BUCKET).remove([storagePath]);
  } catch {
    // non-fatal cleanup
  }
}
