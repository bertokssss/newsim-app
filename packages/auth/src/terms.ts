import { supabaseAdmin } from '@newsim/database';
import { logAuditEvent } from './audit';

export const TERMS_VERSION = '2026-11-v1';
export const PRIVACY_VERSION = '2026-11-v1';

export interface RecordTermsAcceptanceParams {
  userId: string;
  termsVersion?: string;
  privacyVersion?: string;
  ipAddress?: string;
  userAgent?: string;
  acceptanceContext: 'REGISTRATION' | 'OAUTH_ONBOARDING' | 'PORTAL_UPDATE' | 'SETTINGS';
  actorEmail?: string;
  actorRole?: string;
}

/**
 * Records legally auditable acceptance of NEWSIM Terms and Conditions and Privacy Policy.
 */
export async function recordTermsAcceptance(
  params: RecordTermsAcceptanceParams
): Promise<{ success: boolean; acceptedAt?: string; error?: string }> {
  const acceptedAt = new Date().toISOString();
  const termsVersion = params.termsVersion || TERMS_VERSION;
  const privacyVersion = params.privacyVersion || PRIVACY_VERSION;

  try {
    const { error: insertError } = await supabaseAdmin.from('terms_acceptances').insert({
      user_id: params.userId,
      terms_version: termsVersion,
      privacy_version: privacyVersion,
      accepted_at: acceptedAt,
      ip_address: params.ipAddress || null,
      user_agent: (params.userAgent || '').slice(0, 512) || null,
      acceptance_context: params.acceptanceContext,
    });

    if (insertError) {
      console.error('[Terms] Failed inserting terms_acceptances:', insertError);
      return { success: false, error: insertError.message };
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        terms_accepted_version: termsVersion,
        terms_accepted_at: acceptedAt,
      })
      .eq('id', params.userId);

    if (profileError) {
      console.error('[Terms] Failed updating profiles.terms_accepted_version:', profileError);
    }

    logAuditEvent({
      actorId: params.userId,
      actorEmail: params.actorEmail || params.userId,
      actorRole: params.actorRole || 'TRAINEE',
      action: 'TERMS_AND_PRIVACY_ACCEPTED',
      targetType: 'USER',
      targetId: params.userId,
      details: {
        termsVersion,
        privacyVersion,
        acceptanceContext: params.acceptanceContext,
      },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      status: 'SUCCESS',
      severity: 'INFO',
    });

    return { success: true, acceptedAt };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to record terms acceptance';
    return { success: false, error: message };
  }
}

/**
 * Checks whether the given user has accepted the active TERMS_VERSION.
 */
export async function hasAcceptedCurrentTerms(userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('terms_accepted_version')
      .eq('id', userId)
      .maybeSingle();

    if (profile?.terms_accepted_version === TERMS_VERSION) {
      return true;
    }

    const { data: acceptance } = await supabaseAdmin
      .from('terms_acceptances')
      .select('id')
      .eq('user_id', userId)
      .eq('terms_version', TERMS_VERSION)
      .limit(1)
      .maybeSingle();

    return Boolean(acceptance?.id);
  } catch {
    return false;
  }
}
