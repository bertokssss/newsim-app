import { db, supabaseAdmin, AuditLogRecord } from '@newsim/database';

const SENSITIVE_KEYS = [
  'password',
  'passwordhash',
  'newpassword',
  'oldpassword',
  'currentpassword',
  'secret',
  'mfasecret',
  'recoverycode',
  'recoverycodes',
  'token',
  'authorization',
  'jwt',
  'sessiontoken',
];

export function sanitizeDetails(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeDetails);
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some((sk) => lowerKey.includes(sk))) {
      sanitized[key] = '[REDACTED_SECRET]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeDetails(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export function logAuditEvent(params: {
  actorId?: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  status?: 'SUCCESS' | 'FAILED';
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
}): AuditLogRecord {
  const sanitizedDetails = params.details ? sanitizeDetails(params.details) : undefined;

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const validEntityId = params.targetId && isUUID.test(params.targetId) ? params.targetId : null;
  const validActorId = params.actorId && isUUID.test(params.actorId) ? params.actorId : null;

  // Fire and forget to Supabase
  supabaseAdmin.from('audit_logs').insert({
    actor_id: validActorId,
    action: params.action,
    entity_type: params.targetType || 'SYSTEM',
    entity_id: validEntityId,
    new_values: sanitizedDetails || {},
    ip_address: params.ipAddress || '127.0.0.1',
    user_agent: params.userAgent || 'NEWSIM Core'
  }).then(({ error }: { error: any }) => {
    if (error) console.error('Failed to write audit log to Supabase:', error);
  });

  // Keep returning a mock record if needed by sync callers, or just return undefined
  return {
    id: 'mock',
    timestamp: new Date().toISOString(),
    ...params,
    actorEmail: params.actorEmail,
    actorRole: params.actorRole,
    ipAddress: params.ipAddress || '127.0.0.1',
    userAgent: params.userAgent || 'NEWSIM Core',
    status: params.status || 'SUCCESS',
    severity: params.severity || 'INFO',
    details: sanitizedDetails
  } as any;
}
