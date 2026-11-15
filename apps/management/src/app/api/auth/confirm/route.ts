import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@newsim/database';
import { resolveSafeAppOrigin } from '@newsim/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  const baseUrl = resolveSafeAppOrigin(req, 'http://localhost:3000');

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/login?error=invalid_token`);
  }

  try {
    // Find invitation
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from('invitations')
      .select('*')
      .eq('token_hash', token)
      .single();

    if (inviteError || !invitation) {
      return NextResponse.redirect(`${baseUrl}/login?error=invalid_token`);
    }

    let targetUrl = baseUrl;
    if (invitation.role?.toUpperCase() === 'INSTRUCTOR') {
      targetUrl = process.env.NEXT_PUBLIC_INSTRUCTOR_URL || 'http://localhost:3001';
    } else if (invitation.role?.toUpperCase() === 'TRAINEE') {
      targetUrl = process.env.NEXT_PUBLIC_TRAINEE_URL || 'http://localhost:3002';
    }

    if (invitation.status === 'ACCEPTED' || invitation.status === 'accepted') {
      return NextResponse.redirect(`${targetUrl}/login?message=already_confirmed`);
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.redirect(`${targetUrl}/login?error=expired_token`);
    }

    // Update profile status to ACTIVE
    const { data: updatedProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ status: 'ACTIVE' })
      .eq('email', invitation.email)
      .select('id')
      .maybeSingle();

    if (profileError) {
      console.error('Error activating profile:', profileError);
      return NextResponse.redirect(`${targetUrl}/login?error=activation_failed`);
    }

    if (invitation.role?.toUpperCase() === 'TRAINEE' && updatedProfile) {
      await supabaseAdmin
        .from('trainees')
        .update({ enrollment_status: 'ACTIVE' })
        .eq('profile_id', updatedProfile.id);
    }

    // Update invitation status to ACCEPTED
    await supabaseAdmin
      .from('invitations')
      .update({ status: 'ACCEPTED', accepted_at: new Date().toISOString() })
      .eq('id', invitation.id);

    return NextResponse.redirect(`${targetUrl}/login?message=account_confirmed`);
  } catch (error) {
    console.error('Confirmation error:', error);
    return NextResponse.redirect(`${baseUrl}/login?error=activation_failed`);
  }
}
