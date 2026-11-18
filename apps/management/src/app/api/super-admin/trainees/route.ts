import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  verifyAdminRequestAsync,
  verifySuperAdminRequestAsync,
  createUnauthorizedResponse,
  createForbiddenResponse,
  resolveSafeAppOrigin,
  resolveSiblingPortalOrigin,
} from '@newsim/auth';
import { supabaseAdmin } from '@newsim/database';
import { validatePassword } from '@newsim/utils';

import {
  formatTrainee,
  matchesSearch,
  requestMeta,
  writeAdminAudit,
} from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

/**
 * Shape returned by formatTrainee().
 *
 * This explicit type prevents TypeScript from treating
 * the `trainee` parameter inside filter() as implicit `any`.
 */
type FormattedTrainee = {
  id: string;
  profileId?: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  srn?: string | null;
  rank?: string | null;
  status?: string | null;
  centerId?: string | null;
  centerName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

/**
 * GET /api/super-admin/trainees
 *
 * Returns trainee records with:
 * - Profile information
 * - Training center
 * - Search
 * - Status filtering
 * - Center filtering
 * - Pagination
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdminRequestAsync(request, 'TRAINEE_VIEW');

  if (!auth.authorized) {
    return auth.statusCode === 401
      ? createUnauthorizedResponse(auth.error)
      : createForbiddenResponse(auth.error);
  }

  try {
    const { searchParams } = new URL(request.url);

    const search =
      searchParams.get('search')?.trim().toLowerCase() || '';

    const status =
      searchParams.get('status')?.trim().toUpperCase() || 'ALL';

    const centerId =
      searchParams.get('centerId')?.trim() || 'ALL';

    const pageParam = parseInt(
      searchParams.get('page') || '1',
      10
    );

    const limitParam = parseInt(
      searchParams.get('limit') || '10',
      10
    );

    const page =
      Number.isFinite(pageParam) && pageParam > 0
        ? pageParam
        : 1;

    const limit =
      Number.isFinite(limitParam) && limitParam > 0
        ? Math.min(limitParam, 100)
        : 10;

    /*
     * Trainee records are stored in the `trainees` table.
     *
     * The related account/person information is stored
     * in `profiles`.
     */
    let query = supabaseAdmin
      .from('trainees')
      .select(`
        *,
        profiles!inner(*),
        training_centers(name)
      `);

    /*
     * Apply training-center restriction if requested.
     */
    if (centerId !== 'ALL') {
      query = query.eq('training_center_id', centerId);
    }

    const {
      data,
      error,
    } = await query.order(
      'created_at',
      {
        ascending: false,
      }
    );

    if (error) {
      console.error(
        '[ADMIN TRAINEES GET] Supabase error:',
        error
      );

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to load trainees.',
          details: error.message,
        },
        {
          status: 500,
        }
      );
    }

    const { data: pendingInvitations } = await supabaseAdmin
      .from('invitations')
      .select('email')
      .eq('status', 'PENDING');

    const pendingEmailSet = new Set(
      (pendingInvitations || []).map((inv: { email?: string }) => (inv.email || '').toLowerCase().trim())
    );

    /*
     * Convert database records into the format
     * expected by the frontend.
     *
     * Explicitly typing this array fixes TS7006
     * errors caused by implicit `any`.
     */
    const traineeRows = (data || []) as Array<Record<string, unknown>>;

    let trainees: FormattedTrainee[] = traineeRows.map(
      (row: Record<string, unknown>) => {
        const formatted = formatTrainee(row) as FormattedTrainee;
        if (formatted.email && pendingEmailSet.has(formatted.email.toLowerCase().trim())) {
          formatted.status = 'PENDING';
        }
        return formatted;
      }
    );

    /*
     * SEARCH
     */
    if (search) {
      trainees = trainees.filter(
        (trainee: FormattedTrainee) =>
          matchesSearch(
            [
              trainee.firstName,
              trainee.lastName,
              trainee.email,
              trainee.srn,
              trainee.rank,
            ],
            search
          )
      );
    }

    /*
     * STATUS FILTER
     */
    if (status !== 'ALL') {
      trainees = trainees.filter(
        (trainee: FormattedTrainee) =>
          String(
            trainee.status || ''
          ).toUpperCase() === status
      );
    }

    /*
     * PAGINATION
     */
    const total = trainees.length;

    const totalPages =
      Math.max(
        1,
        Math.ceil(total / limit)
      );

    const safePage =
      Math.min(page, totalPages);

    const start =
      (safePage - 1) * limit;

    const end =
      start + limit;

    const paginated =
      trainees.slice(start, end);

    return NextResponse.json({
      success: true,
      data: paginated,
      pagination: {
        total,
        page: safePage,
        limit,
        totalPages,
      },
    });
  } catch (error) {
    console.error(
      '[ADMIN TRAINEES GET] Unexpected error:',
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load trainees.',
        details:
          error instanceof Error
            ? error.message
            : 'Unknown server error',
      },
      {
        status: 500,
      }
    );
  }
}

/**
 * POST /api/admin/trainees
 *
 * Creates a trainee account using:
 *
 * auth.users
 *     ↓
 * profiles
 *     ↓
 * trainees
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdminRequestAsync(request, 'TRAINEE_CREATE');

  if (!auth.authorized) {
    return auth.statusCode === 401
      ? createUnauthorizedResponse(auth.error)
      : createForbiddenResponse(auth.error);
  }

  /*
   * Keep track of the Auth user so we can roll it back
   * if profile/trainee creation fails.
   */
  let createdUserId: string | null = null;

  try {
    const body = await request.json();

    const {
      firstName,
      lastName,
      srn,
      email,
      password,
      phone,
      centerId,
      gender,
      nationality,
    } = body;

    const {
      ip,
      userAgent,
    } = requestMeta(request);

    /*
     * Validate required fields.
     */
    if (
      !firstName ||
      !lastName ||
      !srn ||
      !email ||
      !password
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'First name, last name, SRN, email, and password are required.',
        },
        {
          status: 400,
        }
      );
    }

    const passwordValidation = validatePassword(password, 12);
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: `Password is not strong enough. Missing: ${passwordValidation.errors.join(', ')}.`,
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Clean incoming values.
     */
    const cleanFirstName =
      String(firstName).trim();

    const cleanLastName =
      String(lastName).trim();

    const cleanSrn =
      String(srn).trim();

    const cleanEmail =
      String(email)
        .trim()
        .toLowerCase();

    if (
      !cleanFirstName ||
      !cleanLastName ||
      !cleanSrn ||
      !cleanEmail
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'First name, last name, SRN, and email cannot be empty.',
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Determine the training center.
     *
     * Explicit centerId takes priority.
     */
    const assignedCenterId =
      centerId || null;

    /*
     * Check whether the email or SRN already exists
     * in the profiles or trainees tables.
     */
    const [
      { data: existingByEmail, error: emailCheckErr },
      { data: existingBySrnProfile },
      { data: existingBySrnTrainee },
      { data: existingByTraineeNum }
    ] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('id')
        .ilike('email', cleanEmail)
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from('profiles')
        .select('id')
        .or(`srn.eq.${cleanSrn},username.eq.${cleanSrn}`)
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from('trainees')
        .select('profile_id')
        .eq('srn', cleanSrn)
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from('trainees')
        .select('profile_id')
        .eq('trainee_number', cleanSrn)
        .limit(1)
        .maybeSingle(),
    ]);

    const existingProfile = existingByEmail || existingBySrnProfile || existingBySrnTrainee || existingByTraineeNum;
    const existingProfileError = emailCheckErr;

    if (existingProfileError) {
      console.error(
        '[SUPER_ADMIN TRAINEES POST] Existing profile check failed:',
        existingProfileError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            'Failed to check whether the email/SRN already exists.',
          details:
            existingProfileError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (existingProfile) {
      return NextResponse.json(
        {
          success: false,
          error:
            'An account with this email or SRN already exists.',
        },
        {
          status: 400,
        }
      );
    }

    // Clean up any stale/orphaned auth.users record if profile was previously deleted
    try {
      const { data: userList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const orphanAuthUser = userList?.users?.find(
        (u: any) => u.email?.toLowerCase() === cleanEmail
      );
      if (orphanAuthUser) {
        console.log(`[TRAINEE CREATE] Cleaning orphaned auth user ${orphanAuthUser.id} for ${cleanEmail}`);
        await supabaseAdmin.auth.admin.deleteUser(orphanAuthUser.id);
      }
    } catch (orphanErr) {
      console.warn('[TRAINEE CREATE] Warning checking orphan auth user:', orphanErr);
    }

    /*
     * Create the Supabase Auth user.
     */
    const {
      data: authData,
      error: createError,
    } =
      await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: password,
        email_confirm: false,
        user_metadata: {
          first_name: cleanFirstName,
          last_name: cleanLastName,
          role: 'TRAINEE',
        },
      });

    if (
      createError ||
      !authData?.user
    ) {
      console.error(
        '[SUPER_ADMIN TRAINEES POST] Auth user creation failed:',
        createError
      );

      throw new Error(
        createError?.message ||
          'Failed to create trainee account.'
      );
    }

    createdUserId =
      authData.user.id;

    /*
     * Create the profile record.
     *
     * profiles.id must match auth.users.id.
     */
    const {
      error: profileError,
    } =
      await supabaseAdmin
        .from('profiles')
        .insert({
          id: createdUserId,
          email: cleanEmail,
          username: cleanSrn,
          srn: cleanSrn,
          role: 'TRAINEE',
          status: 'PENDING',
          first_name: cleanFirstName,
          last_name: cleanLastName,
          phone:
            phone &&
            String(phone).trim()
              ? String(phone).trim()
              : null,
        });

    if (profileError) {
      console.error(
        '[SUPER_ADMIN TRAINEES POST] Profile creation failed:',
        profileError
      );

      throw new Error(
        `Failed to create profile: ${profileError.message}`
      );
    }

    /*
     * Build the trainee record.
     * Use the provided SRN as the trainee_number and srn.
     */
    const traineeInsert: Record<
      string,
      unknown
    > = {
      profile_id: createdUserId,
      srn: cleanSrn,
      trainee_number: cleanSrn,
      training_center_id:
        assignedCenterId,
      enrollment_status: 'PENDING',
    };

    /*
     * Store gender only when supplied.
     */
    if (
      gender !== undefined &&
      gender !== null &&
      String(gender).trim()
    ) {
      traineeInsert.gender =
        String(gender).trim();
    }

    /*
     * Store nationality only when supplied.
     */
    if (
      nationality !== undefined &&
      nationality !== null &&
      String(nationality).trim()
    ) {
      traineeInsert.nationality =
        String(nationality).trim();
    }

    /*
     * Create the trainee record.
     */
    const {
      data: trainee,
      error: traineeError,
    } =
      await supabaseAdmin
        .from('trainees')
        .insert(traineeInsert)
        .select(`
          *,
          profiles!inner(*),
          training_centers(name)
        `)
        .single();

    if (
      traineeError ||
      !trainee
    ) {
      console.error(
        '[SUPER_ADMIN TRAINEES POST] Trainee creation failed:',
        traineeError
      );

      throw new Error(
        `Failed to create trainee record: ${
          traineeError?.message ||
          'No trainee record was returned.'
        }`
      );
    }

    // Generate secure confirmation token (48h expiry) and create invitation
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    try {
      const { error: inviteError } = await supabaseAdmin.from('invitations').insert({
        email: cleanEmail,
        role: 'TRAINEE',
        token_hash: token,
        status: 'PENDING',
        expires_at: expiresAt.toISOString(),
        invited_by: auth.user?.id || createdUserId,
      });

      if (inviteError) {
        console.warn('[SUPER_ADMIN TRAINEES POST] Notice: Failed to insert invitation record:', inviteError.message);
      }
    } catch (invErr) {
      console.warn('[SUPER_ADMIN TRAINEES POST] Invitation table notice:', invErr);
    }

    const baseUrl = resolveSafeAppOrigin(request, 'http://localhost:3000');
    const confirmUrl = `${baseUrl}/api/auth/confirm?token=${token}`;

    try {
      const { sendInvitationEmail } = await import('@newsim/auth');
      await sendInvitationEmail(
        cleanEmail,
        `${cleanFirstName} ${cleanLastName}`,
        cleanEmail,
        confirmUrl,
        'trainee'
      );
    } catch (emailErr) {
      console.warn('[SUPER_ADMIN TRAINEES POST] Notice: Failed to dispatch invitation email:', emailErr);
    }

    /*
     * Write audit log.
     *
     * Audit failure should not invalidate an
     * otherwise successful trainee creation.
     */
    try {
      await writeAdminAudit({
        actorId: auth.user?.id || 'unknown',
        action: 'TRAINEE_CREATED',
        entityType: 'TRAINEE',
        entityId: createdUserId,
        details: {
          name:
            `${cleanFirstName} ${cleanLastName}`,
          email: cleanEmail,
          srn: cleanSrn,
        },
        ip,
        userAgent,
      });
    } catch (auditError) {
      console.error(
        '[SUPER_ADMIN TRAINEES POST] Audit log failed:',
        auditError
      );
    }

    /*
     * Return the newly created trainee.
     */
    return NextResponse.json(
      {
        success: true,
        message:
          'Trainee account created successfully.',
        trainee:
          formatTrainee(trainee),
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      '[ADMIN TRAINEES POST] Unexpected error:',
      error
    );

    /*
     * ROLLBACK
     *
     * If Auth user was created but a later operation
     * failed, clean up the profile/Auth user.
     */
    if (createdUserId) {
      try {
        /*
         * Delete profile first.
         *
         * trainees.profile_id references profiles.id
         * with ON DELETE CASCADE.
         */
        await supabaseAdmin
          .from('profiles')
          .delete()
          .eq(
            'id',
            createdUserId
          );
      } catch (rollbackProfileError) {
        console.error(
          '[ADMIN TRAINEES POST] Profile rollback failed:',
          rollbackProfileError
        );
      }

      try {
        /*
         * Delete the Supabase Auth user.
         */
        await supabaseAdmin.auth.admin.deleteUser(
          createdUserId
        );
      } catch (rollbackAuthError) {
        console.error(
          '[ADMIN TRAINEES POST] Auth rollback failed:',
          rollbackAuthError
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error:
          'Failed to create trainee.',
        details:
          error instanceof Error
            ? error.message
            : 'Unknown server error',
      },
      {
        status: 500,
      }
    );
  }
}