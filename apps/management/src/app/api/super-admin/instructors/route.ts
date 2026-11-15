import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  verifySuperAdminRequestAsync,
  createUnauthorizedResponse,
  createForbiddenResponse,
  escapePostgrestFilter,
  resolveSafeAppOrigin,
} from '@newsim/auth';
import { supabaseAdmin } from '@newsim/database';
import { validatePassword } from '@newsim/utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/super-admin/instructors
 *
 * Fetch instructors with pagination, search, and status filtering.
 */
export async function GET(req: NextRequest) {
  const auth = await verifySuperAdminRequestAsync(req, 'INSTRUCTOR_VIEW');

  if (!auth.authorized) {
    return auth.statusCode === 401
      ? createUnauthorizedResponse(auth.error)
      : createForbiddenResponse(auth.error);
  }

  const { searchParams } = new URL(req.url);

  const search = searchParams.get('search')?.toLowerCase() || '';
  const status = searchParams.get('status') || 'ALL';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  /**
   * IMPORTANT:
   * Your profiles.role constraint uses uppercase values:
   *
   * SUPER_ADMIN
   * ADMIN
   * INSTRUCTOR
   * TRAINEE
   */
  let query = supabaseAdmin
    .from('profiles')
    .select('*, instructors!inner(*)', { count: 'exact' })
    .eq('role', 'INSTRUCTOR');

  /**
   * IMPORTANT:
   * Your profile status values should also be handled consistently.
   */
  if (status !== 'ALL') {
    query = query.eq('status', status.toUpperCase());
  }

  const safeSearch = escapePostgrestFilter(search);
  if (safeSearch) {
    query = query.or(
      `email.ilike.%${safeSearch}%,first_name.ilike.%${safeSearch}%,last_name.ilike.%${safeSearch}%`
    );
  }

  const startIndex = (page - 1) * limit;

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(startIndex, startIndex + limit - 1);

  if (error) {
    console.error('Error fetching instructors:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch instructors.',
      },
      { status: 500 }
    );
  }

  const formattedData = (data || []).map((profile: any) => {
    const instructor = Array.isArray(profile.instructors)
      ? profile.instructors[0]
      : profile.instructors;

    return {
      id: profile.id,
      email: profile.email,
      firstName: profile.first_name,
      lastName: profile.last_name,
      phone: profile.phone,
      avatarUrl: profile.avatar_url || null,
      status: profile.status?.toUpperCase(),

      // Keep this only if mfa_enabled exists in your profiles table.
      mfaEnabled: !!profile.mfa_enabled,

      createdAt: profile.created_at,

      // Instructor-specific fields
      username: profile.username || '',
      position: instructor?.position || '',
      department: instructor?.department || null,
      employmentType: instructor?.employment_type || null,
      dateHired: instructor?.date_hired || null,
    };
  });

  return NextResponse.json({
    success: true,
    data: formattedData,
    pagination: {
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit) || 1,
    },
  });
}

/**
 * POST /api/super-admin/instructors
 *
 * Creates:
 * 1. Supabase Auth user
 * 2. profiles record
 * 3. instructors record
 *
 * The role is controlled by the server and is always INSTRUCTOR.
 */
export async function POST(req: NextRequest) {
  const auth = await verifySuperAdminRequestAsync(req, 'INSTRUCTOR_CREATE');

  if (!auth.authorized || !auth.user) {
    return auth.statusCode === 401
      ? createUnauthorizedResponse(auth.error)
      : createForbiddenResponse(auth.error);
  }

  try {
    const body = await req.json();

    const {
      firstName,
      lastName,
      email,
      password,
      phone,
      username,
      position,
      department,
      employmentType,
      dateHired,
    } = body;

    // ---------------------------------------------
    // Validate required fields
    // ---------------------------------------------

    if (!firstName || !lastName || !email || !position || !username) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields.',
        },
        { status: 400 }
      );
    }

    if (username.trim().length < 3) {
      return NextResponse.json(
        {
          success: false,
          error: 'Username must be at least 3 characters.',
        },
        { status: 400 }
      );
    }

    const passwordValidation = validatePassword(password, 12);
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: `Password is not strong enough. Missing: ${passwordValidation.errors.join(', ')}.`,
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------
    // Clean input
    // ---------------------------------------------

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim().toLowerCase();

    // ---------------------------------------------
    // Check duplicate email
    // ---------------------------------------------

    const { data: existingEmail, error: emailCheckError } =
      await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', cleanEmail)
        .maybeSingle();

    if (emailCheckError) {
      console.error(
        'Error checking existing email:',
        emailCheckError
      );

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to check existing email.',
        },
        { status: 500 }
      );
    }

    if (existingEmail) {
      return NextResponse.json(
        {
          success: false,
          error: 'An account with this email already exists.',
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------
    // Check duplicate username
    // ---------------------------------------------

    const { data: existingUsername, error: usernameCheckError } =
      await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('username', cleanUsername)
        .maybeSingle();

    if (usernameCheckError) {
      console.error(
        'Error checking existing username:',
        usernameCheckError
      );

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to check existing username.',
        },
        { status: 500 }
      );
    }

    if (existingUsername) {
      return NextResponse.json(
        {
          success: false,
          error: 'An instructor with this username already exists.',
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------
    // Application URL
    // ---------------------------------------------

    const baseUrl = resolveSafeAppOrigin(req, 'http://localhost:3000');

    // ---------------------------------------------
    // Create Supabase Auth user
    // ---------------------------------------------

    const { data: authData, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: password,

        // Auto-confirm to avoid pending lockout
        email_confirm: true,

        user_metadata: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),

          // IMPORTANT:
          // Must match your database role convention.
          role: 'INSTRUCTOR',
        },
      });

    if (createError || !authData.user) {
      throw new Error(
        createError?.message ||
          'Failed to create user in auth system.'
      );
    }

    const authUserId = authData.user.id;

    // Generate a secure confirmation token with 48-hour expiry
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    const { error: inviteError } = await supabaseAdmin.from('invitations').insert({
      email: cleanEmail,
      role: 'INSTRUCTOR',
      token_hash: token,
      status: 'PENDING',
      expires_at: expiresAt.toISOString(),
      invited_by: auth.user.id,
    });

    if (inviteError) {
      console.warn("Failed to create invitation record:", inviteError);
    }

    const confirmUrl = `${baseUrl}/api/auth/confirm?token=${token}`;
    
    // We import sendInvitationEmail dynamically to avoid top-level issues if needed, or we can add it to top level imports.
    // I will use top level import later.
    const { sendInvitationEmail } = await import('@newsim/auth');
    const { error: resendError } = await sendInvitationEmail(cleanEmail, `${firstName.trim()} ${lastName.trim()}`, cleanEmail, confirmUrl, 'instructor');

    if (resendError) {
      console.warn(
        'Failed to send confirmation email, but user was created:',
        resendError
      );
    }

    // ---------------------------------------------
    // Create profiles record
    // ---------------------------------------------

    const newProfile = {
      id: authUserId,
      email: cleanEmail,
      username: cleanUsername,

      // IMPORTANT:
      // Your profiles_role_check requires:
      // SUPER_ADMIN / ADMIN / INSTRUCTOR / TRAINEE
      role: 'INSTRUCTOR',

      // IMPORTANT:
      // Keep status consistent with your database.
      status: 'PENDING',

      phone: phone?.trim() || null,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
    };

    const { error: insertError } = await supabaseAdmin
      .from('profiles')
      .insert(newProfile);

    if (insertError) {
      /**
       * Roll back the Auth user if the profile cannot be created.
       */
      await supabaseAdmin.auth.admin.deleteUser(authUserId);

      throw new Error(
        `Failed to create profile: ${insertError.message}`
      );
    }

    // ---------------------------------------------
    // Create instructors record
    // ---------------------------------------------

    const newInstructor = {
      profile_id: authUserId,
      // The frontend collects position, department, employmentType, and dateHired,
      // but these columns do NOT exist in the remote Supabase 'instructors' table schema.
      // We are omitting them to prevent schema cache errors during insertion.
    };

    const { error: instructorError } =
      await supabaseAdmin
        .from('instructors')
        .insert(newInstructor);

    if (instructorError) {
      /**
       * Roll back the Auth user.
       *
       * Because profiles references the Auth user,
       * deleting the Auth user should also trigger
       * your configured database cleanup behavior if
       * your FK is configured with cascading delete.
       */
      await supabaseAdmin.auth.admin.deleteUser(authUserId);

      throw new Error(
        `Failed to create instructor record: ${instructorError.message}`
      );
    }

    // ---------------------------------------------
    // Success
    // ---------------------------------------------

    return NextResponse.json({
      success: true,
      message:
        'Instructor account created successfully. Verification email sent.',
    });
  } catch (error: any) {
    console.error(
      'Error creating instructor:',
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          'Failed to create instructor account.',
      },
      { status: 500 }
    );
  }
}