import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdminRequestAsync, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';
import { supabaseAdmin, db } from '@newsim/database';
import { logAuditEvent } from '@newsim/auth';

const DEFAULT_SETTINGS = [
  { key: 'SEC_SESSION_TIMEOUT_MINUTES', value: '480', category: 'AUTHENTICATION', description: 'Privileged session lifetime before automatic logout' },
  { key: 'SEC_MFA_POLICY', value: 'MANDATORY_SUPER_AND_ADMIN', category: 'AUTHENTICATION', description: 'Multi-factor authentication requirement enforcement' },
  { key: 'SEC_MAX_LOGIN_ATTEMPTS', value: '5', category: 'SECURITY', description: 'Maximum failed consecutive login attempts before lockout' },
  { key: 'SEC_LOCKOUT_DURATION_MINUTES', value: '30', category: 'SECURITY', description: 'Account lockout duration following brute force detection' },
  { key: 'SEC_PASSWORD_MIN_LENGTH', value: '12', category: 'SECURITY', description: 'Minimum acceptable password length for staff accounts' },
  { key: 'SYSTEM_NAME', value: 'NEWSIM Maritime Training Management System', category: 'GENERAL', description: 'Official institution LMS branding name' },
  { key: 'NOTIF_EMAIL_ENABLED', value: 'true', category: 'NOTIFICATIONS', description: 'Global dispatch toggle for outgoing email alerts' },
];

export async function GET(req: NextRequest) {
  const auth = await verifySuperAdminRequestAsync(req, 'SYSTEM_SETTINGS_VIEW');
  if (!auth.authorized) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  try {
    // Read live persisted settings from Supabase
    const { data: dbSettings, error } = await supabaseAdmin
      .from('system_settings')
      .select('*');

    if (error) throw error;

    const settingMap = new Map<string, any>();
    (dbSettings || []).forEach((row: any) => {
      let val = row.value;
      if (typeof val === 'string') {
        try {
          val = JSON.parse(val);
        } catch {
          // keep as string
        }
      }
      settingMap.set(row.key, {
        id: row.id,
        key: row.key,
        value: typeof val === 'object' && val !== null ? (val.raw ?? JSON.stringify(val)) : String(val),
        category: (row.description?.toUpperCase().includes('AUTH') ? 'AUTHENTICATION' : row.description?.toUpperCase().includes('SEC') ? 'SECURITY' : 'GENERAL'),
        description: row.description || '',
        updatedAt: row.updated_at,
        updatedBy: row.updated_by,
      });
    });

    // Merge default settings if not yet stored in DB
    const result = DEFAULT_SETTINGS.map((def) => {
      if (settingMap.has(def.key)) {
        return {
          ...def,
          ...settingMap.get(def.key),
        };
      }
      return {
        id: `def-${def.key}`,
        key: def.key,
        value: def.value,
        category: def.category,
        description: def.description,
        updatedAt: new Date().toISOString(),
      };
    });

    // Append any additional database keys
    settingMap.forEach((val, k) => {
      if (!DEFAULT_SETTINGS.some((d) => d.key === k)) {
        result.push(val);
      }
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Failed to load system settings from Supabase:', error);
    // Graceful fallback to memory defaults if database error
    return NextResponse.json({
      success: true,
      data: db.getSettings(),
    });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await verifySuperAdminRequestAsync(req, 'SYSTEM_SETTINGS_UPDATE');
  if (!auth.authorized || !auth.user) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  try {
    const body = await req.json();
    const { settings } = body; // Array of { key, value }

    if (!Array.isArray(settings)) {
      return NextResponse.json(
        { success: false, error: 'Settings array is required.' },
        { status: 400 }
      );
    }

    // Security check: Block attempts to write server secrets into public settings table
    const FORBIDDEN_SECRET_KEYS = [
      'PAYMONGO_SECRET_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'DATABASE_URL',
      'CRON_SECRET',
      'JWT_SECRET',
    ];

    const updatedKeys: string[] = [];
    for (const item of settings) {
      if (!item.key || item.value === undefined) continue;
      const upperKey = String(item.key).toUpperCase();

      if (FORBIDDEN_SECRET_KEYS.some((fk) => upperKey.includes(fk))) {
        return NextResponse.json(
          { success: false, error: `Prohibited: Server-side secret "${item.key}" cannot be stored in application settings table.` },
          { status: 400 }
        );
      }

      // Format jsonb value
      const valToStore = typeof item.value === 'object' ? item.value : JSON.stringify(item.value);

      // Persist to Supabase system_settings table
      await supabaseAdmin.from('system_settings').upsert(
        {
          key: item.key,
          value: valToStore,
          description: item.description || `Configuration parameter for ${item.key}`,
          updated_by: auth.user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );

      // Keep memory cache synced
      db.updateSetting(item.key, String(item.value), auth.user.email);
      updatedKeys.push(item.key);
    }

    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Browser';

    // Record in Supabase audit_logs
    try {
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: auth.user.id,
        action: 'SYSTEM_SETTINGS_UPDATED',
        entity_type: 'SYSTEM_SETTINGS',
        entity_id: 'GLOBAL_CONFIG',
        new_values: { updatedKeys, count: updatedKeys.length },
        created_at: new Date().toISOString(),
      });
    } catch (auditErr) {
      console.warn('Could not record audit log:', auditErr);
    }

    logAuditEvent({
      actorId: auth.user.id,
      actorEmail: auth.user.email,
      actorRole: auth.user.role,
      action: 'SYSTEM_SETTINGS_CHANGED',
      targetType: 'SYSTEM_SETTINGS',
      targetId: 'GLOBAL_CONFIG',
      details: { updatedKeysCount: updatedKeys.length, updatedKeys },
      ipAddress: ip,
      userAgent,
      severity: 'WARNING',
    });

    return NextResponse.json({
      success: true,
      message: 'System settings persisted successfully.',
      data: db.getSettings(),
    });
  } catch (error: any) {
    console.error('Failed to update system settings in Supabase:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to update system settings.' },
      { status: 500 }
    );
  }
}
