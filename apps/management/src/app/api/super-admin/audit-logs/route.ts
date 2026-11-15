import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdminRequestAsync, createUnauthorizedResponse, createForbiddenResponse, escapePostgrestFilter } from '@newsim/auth';
import { supabaseAdmin } from '@newsim/database';

export async function GET(req: NextRequest) {
  const auth = await verifySuperAdminRequestAsync(req, 'AUDIT_LOG_VIEW');
  if (!auth.authorized) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search')?.toLowerCase() || '';
  const role = searchParams.get('role') || 'ALL';
  const action = searchParams.get('action') || 'ALL';
  const severity = searchParams.get('severity') || 'ALL';
  const status = searchParams.get('status') || 'ALL';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '15', 10);

  try {
    let query = supabaseAdmin.from('audit_logs').select('*, profiles(email, role, first_name, last_name, avatar_url)', { count: 'exact' });

    if (action !== 'ALL') {
      query = query.ilike('action', `%${action}%`);
    }

    if (status !== 'ALL') {
      // If status exists as a column. If not, maybe we skip or map it.
      // Usually status is 'SUCCESS' or 'FAILED' and might be derived from action.
      if (status === 'FAILED') {
         query = query.ilike('action', '%FAILED%');
      }
    }

    const safeSearch = escapePostgrestFilter(search);
    if (safeSearch) {
      query = query.or(`action.ilike.%${safeSearch}%,entity_type.ilike.%${safeSearch}%,ip_address.ilike.%${safeSearch}%`);
    }

    // Pagination
    const startIndex = (page - 1) * limit;
    query = query.order('created_at', { ascending: false }).range(startIndex, startIndex + limit - 1);

    const [{ data, count, error }, { data: allProfiles }] = await Promise.all([
      query,
      supabaseAdmin.from('profiles').select('id, email, role, first_name, last_name, avatar_url'),
    ]);

    if (error) {
      throw error;
    }

    const profileById = new Map<string, any>();
    const profileByEmail = new Map<string, any>();
    for (const prof of allProfiles || []) {
      if (prof.id) profileById.set(prof.id, prof);
      if (prof.email) profileByEmail.set(String(prof.email).toLowerCase(), prof);
    }

    const paginated = (data || []).map((l: any) => {
      const joined = Array.isArray(l.profiles) ? l.profiles[0] : l.profiles;
      const details = l.new_values && typeof l.new_values === 'object' ? l.new_values : {};
      const fallbackEmail = String(details.actorEmail || details.email || details.targetEmail || '').toLowerCase();
      const p =
        joined ||
        (l.actor_id ? profileById.get(l.actor_id) : null) ||
        (l.entity_id ? profileById.get(l.entity_id) : null) ||
        (fallbackEmail ? profileByEmail.get(fallbackEmail) : null);
      const actorName = p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : '';
      return {
        id: l.id,
        timestamp: l.created_at,
        actorEmail: p?.email || fallbackEmail || l.actor_id || 'Unknown',
        actorName: actorName || p?.email || fallbackEmail || 'System',
        actorAvatarUrl: p?.avatar_url || null,
        actorRole: p?.role || details.actorRole || 'SYSTEM',
        action: l.action,
        targetType: l.entity_type,
        targetId: l.entity_id,
        result: l.action.includes('FAILED') || l.action.includes('REJECTED') ? 'FAILED' : 'SUCCESS',
        severity: l.action.includes('FAILED') || l.action.includes('REJECTED') || l.action.includes('LOCK') ? 'WARNING' : 'INFO',
        ipAddress: l.ip_address,
        userAgent: l.user_agent,
        details: l.new_values || l.old_values || {},
      };
    });
    
    // Manual filtering for role if needed since it's joined
    let finalData = paginated;
    if (role !== 'ALL') {
      finalData = finalData.filter((d: any) => d.actorRole === role);
    }
    
    if (severity !== 'ALL') {
       // We mock severity to INFO currently, but UI allows filter
       finalData = finalData.filter((d: any) => d.severity === severity);
    }

    const total = count || 0;

    return NextResponse.json({
      success: true,
      data: finalData,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Failed to load audit logs' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifySuperAdminRequestAsync(req, 'REPORT_EXPORT');
  if (!auth.authorized || !auth.user) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { format } = body;
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Browser';

    // Insert into Supabase directly instead of local DB
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: auth.user.id,
      action: 'SUPER_ADMIN_EXPORTED_REPORT',
      entity_type: 'AUDIT_LOGS',
      entity_id: auth.user.id,
      new_values: { format: format || 'CSV', scope: 'ALL_LOGS' },
      ip_address: ip,
      user_agent: userAgent
    });

    const { data } = await supabaseAdmin.from('audit_logs').select('*, profiles(email, role)').order('created_at', { ascending: false });

    return NextResponse.json({
      success: true,
      message: 'Audit log exported. Export action recorded.',
      data: data || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Failed to export audit logs.' },
      { status: 500 }
    );
  }
}
