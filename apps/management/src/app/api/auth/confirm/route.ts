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

    const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
    const fallbackOriginFor = (portal: 'instructor' | 'trainee') =>
      normalizedBaseUrl.includes('newsim-management.vercel.app')
        ? normalizedBaseUrl.replace('newsim-management.vercel.app', `newsim-${portal}.vercel.app`)
        : portal === 'instructor'
          ? 'http://localhost:3001'
          : 'http://localhost:3002';

    let targetUrl = normalizedBaseUrl;
    if (invitation.role?.toUpperCase() === 'INSTRUCTOR') {
      targetUrl = (process.env.NEXT_PUBLIC_INSTRUCTOR_URL || fallbackOriginFor('instructor')).replace(/\/+$/, '');
    } else if (invitation.role?.toUpperCase() === 'TRAINEE') {
      targetUrl = (process.env.NEXT_PUBLIC_TRAINEE_URL || fallbackOriginFor('trainee')).replace(/\/+$/, '');
    }

    if (invitation.status === 'ACCEPTED' || invitation.status === 'accepted') {
      return NextResponse.redirect(`${targetUrl}/login?message=already_confirmed`);
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.redirect(`${targetUrl}/login?error=expired_token`);
    }

    const escapedEmail = invitation.email.trim().replace(/[\\%_]/g, '\\$&');

    // Update profile status to ACTIVE (case-insensitive match, never mark ACCEPTED if profile is missing)
    const { data: updatedProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ status: 'ACTIVE' })
      .ilike('email', escapedEmail)
      .select('id')
      .maybeSingle();

    if (profileError || !updatedProfile) {
      console.error(
        'Error activating profile:',
        profileError || `No profile found for invitation email ${invitation.email}`
      );
      return NextResponse.redirect(`${targetUrl}/login?error=activation_failed`);
    }

    if (invitation.role?.toUpperCase() === 'TRAINEE') {
      const { error: traineeUpdateError } = await supabaseAdmin
        .from('trainees')
        .update({ enrollment_status: 'ACTIVE' })
        .eq('profile_id', updatedProfile.id);
      if (traineeUpdateError) {
        console.error('Error activating trainee enrollment status:', traineeUpdateError);
      }
    }

    // Update invitation status to ACCEPTED
    const { error: inviteAcceptError } = await supabaseAdmin
      .from('invitations')
      .update({ status: 'ACCEPTED', accepted_at: new Date().toISOString() })
      .eq('id', invitation.id);

    if (inviteAcceptError) {
      console.error('Error updating invitation status:', inviteAcceptError);
      return NextResponse.redirect(`${targetUrl}/login?error=activation_failed`);
    }

    // Confirm email in auth.users
    try {
      await supabaseAdmin.auth.admin.updateUserById(updatedProfile.id, {
        email_confirm: true,
      });
    } catch (authConfirmErr) {
      console.warn('Notice: Failed to set email_confirm on auth user:', authConfirmErr);
    }

    return NextResponse.redirect(`${targetUrl}/login?message=account_confirmed`);
  } catch (error) {
    console.error('Confirmation error:', error);
    return NextResponse.redirect(`${baseUrl}/login?error=activation_failed`);
  }
}
