import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { db, supabaseAdmin, dispatchNotificationEvent, NOTIFICATION_EVENTS } from '@newsim/database';
import {
  validateStrongPassword,
  sendRegistrationOtpEmail,
  sendGoogleNumberMatchEmail,
  verifyRecaptchaToken,
  getJwtSecret,
  checkRateLimit,
  getClientIp,
  createRateLimitResponse,
  isHoneypotTriggered,
  acquireSubmissionLock,
  sanitizeText,
  sanitizeEmail,
  escapeIlikePattern,
  isValidEmail,
  isValidSrn,
  isValidMobile,
  recordTermsAcceptance,
  TERMS_VERSION,
  PRIVACY_VERSION,
  logAuditEvent,
  getRolePermissionsFromDb,
  resolveEffectivePermissionsForUser,
  createSessionToken,
  setSessionCookies,
} from '@newsim/auth';

async function findExistingProfileByEmail(normalizedEmail: string) {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .ilike('email', escapeIlikePattern(normalizedEmail))
    .limit(1)
    .maybeSingle();
  return data;
}

function generateShuffledMatchOptions(targetNumber: number): number[] {
  const choices = new Set<number>([targetNumber]);
  while (choices.size < 3) {
    choices.add(crypto.randomInt(10, 100));
  }
  const arr = Array.from(choices);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildGoogleMatchChallenge(payload: {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  provider: string;
  termsAgreed: boolean;
}) {
  const targetNumber = crypto.randomInt(10, 100);
  const options = generateShuffledMatchOptions(targetNumber);
  const jti = crypto.randomUUID();
  const targetHmac = crypto
    .createHmac('sha256', getJwtSecret())
    .update(`${jti}:${targetNumber}`)
    .digest('hex');

  const matchToken = jwt.sign(
    {
      purpose: 'GOOGLE_REGISTRATION_MATCH',
      jti,
      userId: payload.userId,
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      avatarUrl: payload.avatarUrl,
      provider: payload.provider,
      termsAgreed: payload.termsAgreed,
      options,
      targetHmac,
    },
    getJwtSecret(),
    { expiresIn: '10m' }
  );

  return { targetNumber, options, matchToken };
}

function getRegistrationCipherKey(): Buffer {
  return crypto.createHash('sha256').update(`newsim-reg:${getJwtSecret()}`).digest();
}

function encryptRegistrationSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getRegistrationCipherKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}.${tag.toString('hex')}.${encrypted.toString('hex')}`;
}

function decryptRegistrationSecret(payload: string): string | null {
  const parts = (payload || '').split('.');
  if (parts.length !== 3) return null;
  try {
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = Buffer.from(parts[2], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getRegistrationCipherKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

async function isSrnTaken(cleanSrn: string, excludeUserId?: string): Promise<boolean> {
  const [{ data: tBySrn }, { data: tByNum }, { data: pBySrn }] = await Promise.all([
    supabaseAdmin.from('trainees').select('profile_id').eq('srn', cleanSrn).maybeSingle(),
    supabaseAdmin.from('trainees').select('profile_id').eq('trainee_number', cleanSrn).maybeSingle(),
    supabaseAdmin.from('profiles').select('id').eq('srn', cleanSrn).maybeSingle(),
  ]);
  const takenByOther =
    (tBySrn && (!excludeUserId || tBySrn.profile_id !== excludeUserId)) ||
    (tByNum && (!excludeUserId || tByNum.profile_id !== excludeUserId)) ||
    (pBySrn && (!excludeUserId || pBySrn.id !== excludeUserId));
  return Boolean(takenByOther);
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers.get('user-agent') || 'Browser';
    const rl = checkRateLimit(`trainee-register:${ip}`, { limit: 15, windowMs: 15 * 60 * 1000 });
    if (!rl.allowed) {
      return createRateLimitResponse(rl.retryAfterSeconds);
    }

    const body = await req.json();
    if (isHoneypotTriggered(body)) {
      logAuditEvent({
        actorEmail: sanitizeEmail(body?.email) || 'bot',
        actorRole: 'TRAINEE',
        action: 'SPAM_HONEYPOT_TRIGGERED',
        details: { endpoint: '/api/auth/register' },
        ipAddress: ip,
        userAgent,
        status: 'FAILED',
        severity: 'WARNING',
      });
      return NextResponse.json({ success: false, error: 'Invalid registration payload.' }, { status: 400 });
    }

    const { action, registrationToken, otp } = body;

    // ==========================================
    // ACTION 1: SEND_OTP (Manual Registration Step 1)
    // ==========================================
    if (action === 'SEND_OTP') {
      const { firstName, lastName, email, mobile, password, srn, recaptchaToken, agreedToTerms } = body;

      const cleanFirstName = sanitizeText(firstName, 80);
      const cleanLastName = sanitizeText(lastName, 80);
      const normalizedEmail = sanitizeEmail(email);
      const cleanSrn = sanitizeText(srn, 32).replace(/[,()]/g, '');
      const cleanMobile = sanitizeText(mobile || '', 24);

      if (!cleanFirstName || !cleanLastName || !normalizedEmail || !password || !cleanSrn) {
        return NextResponse.json(
          { success: false, error: 'All required fields including Seafarer Registration Number (SRN) must be provided.' },
          { status: 400 }
        );
      }

      if (!agreedToTerms) {
        return NextResponse.json(
          { success: false, error: 'You must read and agree to the NEWSIM Terms and Conditions and Privacy Policy to register.' },
          { status: 400 }
        );
      }

      if (!isValidEmail(normalizedEmail)) {
        return NextResponse.json({ success: false, error: 'Please enter a valid email address.' }, { status: 400 });
      }

      if (!isValidSrn(cleanSrn)) {
        return NextResponse.json(
          { success: false, error: 'Please enter a valid Seafarer Registration Number (4-32 alphanumeric characters or hyphens).' },
          { status: 400 }
        );
      }

      if (cleanMobile && !isValidMobile(cleanMobile)) {
        return NextResponse.json({ success: false, error: 'Please enter a valid mobile number.' }, { status: 400 });
      }

      if (!acquireSubmissionLock(`reg-otp:${ip}:${normalizedEmail}`, 3000)) {
        return NextResponse.json(
          { success: false, error: 'Your registration request is already being processed. Please wait a moment.' },
          { status: 429 }
        );
      }

      // 1. Enforce 12-character strong password policy
      const passValidation = validateStrongPassword(password);
      if (!passValidation.valid) {
        return NextResponse.json(
          { success: false, error: passValidation.error },
          { status: 400 }
        );
      }

      // 2. Always verify reCAPTCHA token server-side
      const recaptchaCheck = await verifyRecaptchaToken(recaptchaToken, {
        remoteIp: ip,
        actorEmail: normalizedEmail,
      });
      if (!recaptchaCheck.success) {
        return NextResponse.json(
          { success: false, error: recaptchaCheck.error || 'reCAPTCHA verification failed. Please try again.' },
          { status: 400 }
        );
      }

      // 3. Check if SRN already exists in public.trainees or public.profiles
      if (await isSrnTaken(cleanSrn)) {
        return NextResponse.json(
          { success: false, error: 'This SRN is already associated with another trainee account.', code: 'DUPLICATE_SRN' },
          { status: 409 }
        );
      }

      // 4. Check if email already exists in public.profiles
      const existingProfile = await findExistingProfileByEmail(normalizedEmail);

      if (existingProfile) {
        return NextResponse.json(
          { success: false, error: 'An account with this email already exists. Please sign in.' },
          { status: 409 }
        );
      }

      // 5. Generate cryptographically random 6-digit numeric OTP code
      const generatedOtp = crypto.randomInt(100000, 1000000).toString();
      const otpHash = crypto.createHash('sha256').update(generatedOtp).digest('hex');

      // 6. Send OTP to user's registered email address via SMTP
      const fullName = `${cleanFirstName} ${cleanLastName}`;
      const emailResult = await sendRegistrationOtpEmail(normalizedEmail, fullName, generatedOtp);
      if (!emailResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: 'Unable to send the verification code email right now. Please verify your email address and try again.',
          },
          { status: 500 }
        );
      }

      // 7. Generate signed JWT registration verification token with encrypted secret (valid for 10 minutes)
      const token = jwt.sign(
        {
          purpose: 'TRAINEE_REGISTRATION_OTP',
          jti: crypto.randomUUID(),
          email: normalizedEmail,
          firstName: cleanFirstName,
          lastName: cleanLastName,
          mobile: cleanMobile,
          srn: cleanSrn,
          encryptedPassword: encryptRegistrationSecret(password),
          otpHash,
          agreedToTerms: true,
          termsVersion: TERMS_VERSION,
          privacyVersion: PRIVACY_VERSION,
        },
        getJwtSecret(),
        { expiresIn: '10m' }
      );

      return NextResponse.json({
        success: true,
        message: `A 6-digit verification code has been dispatched to ${normalizedEmail}. Please enter it to complete your registration.`,
        registrationToken: token,
      });
    }

    // ==========================================
    // ACTION 2: VERIFY_OTP (Manual Registration Step 2)
    // ==========================================
    if (action === 'VERIFY_OTP') {
      if (!registrationToken || !otp) {
        return NextResponse.json(
          { success: false, error: 'Registration token and 6-digit verification code are required.' },
          { status: 400 }
        );
      }

      let decoded: any;
      try {
        decoded = jwt.verify(registrationToken, getJwtSecret());
      } catch {
        return NextResponse.json(
          { success: false, error: 'Verification session has expired or is invalid. Please request a new code.' },
          { status: 400 }
        );
      }

      if (decoded.purpose !== 'TRAINEE_REGISTRATION_OTP') {
        return NextResponse.json(
          { success: false, error: 'Invalid verification token purpose.' },
          { status: 400 }
        );
      }

      const otpRl = checkRateLimit(`trainee-otp-verify:${decoded.email}:${decoded.jti || 'legacy'}`, {
        limit: 5,
        windowMs: 10 * 60 * 1000,
      });
      if (!otpRl.allowed) {
        return createRateLimitResponse(otpRl.retryAfterSeconds);
      }

      const inputOtpHash = crypto.createHash('sha256').update(otp.toString().trim()).digest('hex');
      const expectedOtpHash = typeof decoded.otpHash === 'string' ? decoded.otpHash : '';
      const otpValid =
        inputOtpHash.length === 64 &&
        expectedOtpHash.length === 64 &&
        crypto.timingSafeEqual(Buffer.from(inputOtpHash, 'hex'), Buffer.from(expectedOtpHash, 'hex'));

      if (!otpValid) {
        return NextResponse.json(
          { success: false, error: 'Incorrect verification code. Please check your email and try again.' },
          { status: 400 }
        );
      }

      // OTP Verified -> Decrypt secret and enforce SRN / Email uniqueness before provisioning
      const { email: normalizedEmail, firstName, lastName, mobile, srn: cleanSrn } = decoded;
      const password = decoded.encryptedPassword
        ? decryptRegistrationSecret(decoded.encryptedPassword)
        : null;

      if (!password) {
        return NextResponse.json(
          { success: false, error: 'Verification payload could not be decrypted. Please restart registration.' },
          { status: 400 }
        );
      }

      if (await isSrnTaken(cleanSrn)) {
        return NextResponse.json(
          { success: false, error: 'This SRN is already associated with another trainee account.', code: 'DUPLICATE_SRN' },
          { status: 409 }
        );
      }

      const existingProfileAtVerify = await findExistingProfileByEmail(normalizedEmail);

      if (existingProfileAtVerify) {
        return NextResponse.json(
          { success: false, error: 'An account with this email already exists. Please sign in.' },
          { status: 409 }
        );
      }

      // 1. Create confirmed user in Supabase Auth (or recover orphaned auth.users entry if profile was deleted)
      let userId: string | undefined;
      let createdNewAuthUser = false;
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          role: 'TRAINEE',
        },
      });

      if (authError) {
        const errMsg = authError.message.toLowerCase();
        if (errMsg.includes('already registered') || errMsg.includes('already exists') || errMsg.includes('user already exists')) {
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const orphanedAuthUser = listData?.users?.find(
            (u: { id: string; email?: string }) => (u.email || '').toLowerCase() === normalizedEmail.toLowerCase()
          );
          if (orphanedAuthUser) {
            await supabaseAdmin.auth.admin.updateUserById(orphanedAuthUser.id, {
              password,
              email_confirm: true,
              user_metadata: {
                first_name: firstName,
                last_name: lastName,
                role: 'TRAINEE',
              },
            });
            userId = orphanedAuthUser.id;
          } else {
            return NextResponse.json(
              { success: false, error: 'An account with this email already exists. Please sign in.' },
              { status: 409 }
            );
          }
        } else {
          return NextResponse.json(
            { success: false, error: authError.message },
            { status: 400 }
          );
        }
      } else {
        userId = authData.user?.id;
        createdNewAuthUser = true;
      }

      const rollbackNewlyCreatedUser = async () => {
        if (!userId) return;
        await supabaseAdmin.from('trainees').delete().eq('profile_id', userId).then(() => {}, () => {});
        await supabaseAdmin.from('profiles').delete().eq('id', userId).then(() => {}, () => {});
        if (createdNewAuthUser) {
          await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
        }
      };

      const baseUsername = normalizedEmail.split('@')[0];
      let finalUsername = baseUsername;

      // 2. Create in Supabase Profiles & Trainees with provided SRN
      if (userId) {
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .upsert(
            {
              id: userId,
              email: normalizedEmail,
              username: baseUsername,
              role: 'TRAINEE',
              first_name: firstName,
              last_name: lastName,
              phone: mobile,
              srn: cleanSrn,
              status: 'ACTIVE',
            },
            { onConflict: 'id' }
          );

        if (profileError) {
          if (profileError.message?.includes('username') || profileError.code === '23505') {
            finalUsername = `${baseUsername}_${userId.substring(0, 4)}`;
            const { error: retryError } = await supabaseAdmin
              .from('profiles')
              .upsert(
                {
                  id: userId,
                  email: normalizedEmail,
                  username: finalUsername,
                  role: 'TRAINEE',
                  first_name: firstName,
                  last_name: lastName,
                  phone: mobile,
                  srn: cleanSrn,
                  status: 'ACTIVE',
                },
                { onConflict: 'id' }
              );
            if (retryError) {
              console.error('Supabase profile creation retry error:', retryError);
              await rollbackNewlyCreatedUser();
              return NextResponse.json(
                { success: false, error: 'An account with this email or SRN already exists. Please sign in.' },
                { status: 409 }
              );
            }
          } else {
            console.error('Supabase profile creation error:', profileError);
            await rollbackNewlyCreatedUser();
            return NextResponse.json(
              { success: false, error: 'Unable to save trainee profile. Please try again.' },
              { status: 500 }
            );
          }
        }

        const { error: traineeInsertError } = await supabaseAdmin.from('trainees').upsert(
          {
            profile_id: userId,
            srn: cleanSrn,
            trainee_number: cleanSrn,
            enrollment_status: 'ACTIVE',
          },
          { onConflict: 'profile_id' }
        );
        if (traineeInsertError) {
          console.error('Trainees record insert error:', traineeInsertError);
          await rollbackNewlyCreatedUser();
          return NextResponse.json(
            { success: false, error: 'Unable to create trainee record (email or SRN may already be registered).' },
            { status: traineeInsertError.code === '23505' ? 409 : 500 }
          );
        }

        await recordTermsAcceptance({
          userId,
          termsVersion: decoded.termsVersion || TERMS_VERSION,
          privacyVersion: decoded.privacyVersion || PRIVACY_VERSION,
          ipAddress: ip,
          userAgent,
          acceptanceContext: 'REGISTRATION',
          actorEmail: normalizedEmail,
          actorRole: 'TRAINEE',
        });

        try {
          await dispatchNotificationEvent({
            event: NOTIFICATION_EVENTS.NEW_TRAINEE_REGISTRATION,
            traineeId: userId,
            title: 'Trainee Registration Completed',
            message: `Welcome to NEWSIM! Your account with SRN ${cleanSrn} has been registered and verified successfully.`,
            entityType: 'trainee',
            entityId: userId,
          });
        } catch (nErr) {
          console.warn('Registration notification dispatch notice:', nErr);
        }
      }

      // 3. Keep in-memory mock DB in sync
      const passwordHash = await bcrypt.hash(password, 10);
      const resolvedTraineePerms = await getRolePermissionsFromDb('TRAINEE');
      const newUser = {
        id: userId || `usr-trn-${Date.now()}`,
        email: normalizedEmail,
        username: finalUsername,
        passwordHash,
        role: 'TRAINEE' as const,
        status: 'ACTIVE' as const,
        phone: mobile,
        mfaEnabled: false,
        failedLoginAttempts: 0,
        mustChangePassword: false,
        firstName,
        lastName,
        permissions: resolvedTraineePerms,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const existingInMem = db.getUserByEmailOrUsername(normalizedEmail);
      if (existingInMem) {
        db.updateUser(existingInMem.id, newUser);
      } else {
        db.createUser(newUser);
      }

      return NextResponse.json({
        success: true,
        message: 'Your email has been verified and your trainee account is now active. You may now sign in.',
        user: {
          id: newUser.id,
          email: newUser.email,
          name: `${newUser.firstName} ${newUser.lastName}`,
        },
      });
    }

    // ==========================================
    // ACTION 3: INIT_GOOGLE_MATCH (Load Google Security Number Match Challenge)
    // ==========================================
    if (action === 'INIT_GOOGLE_MATCH') {
      const { matchToken } = body;
      if (!matchToken) {
        return NextResponse.json(
          { success: false, error: 'Google security confirmation token is required.' },
          { status: 400 }
        );
      }

      let decoded: any;
      try {
        decoded = jwt.verify(matchToken, getJwtSecret());
      } catch {
        return NextResponse.json(
          { success: false, error: 'Google security confirmation session has expired. Please click Continue with Google again.' },
          { status: 400 }
        );
      }

      if (decoded.purpose !== 'GOOGLE_REGISTRATION_MATCH') {
        return NextResponse.json(
          { success: false, error: 'Invalid security challenge token.' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        email: decoded.email,
        name: `${decoded.firstName || ''} ${decoded.lastName || ''}`.trim() || decoded.email,
        options: Array.isArray(decoded.options) ? decoded.options : [],
      });
    }

    // ==========================================
    // ACTION 4: RESEND_GOOGLE_MATCH (Issue a fresh 2-digit security match number)
    // ==========================================
    if (action === 'RESEND_GOOGLE_MATCH') {
      const { matchToken } = body;
      if (!matchToken) {
        return NextResponse.json(
          { success: false, error: 'Google security confirmation token is required.' },
          { status: 400 }
        );
      }

      let decoded: any;
      try {
        decoded = jwt.verify(matchToken, getJwtSecret());
      } catch {
        return NextResponse.json(
          { success: false, error: 'Google security confirmation session has expired. Please click Continue with Google again.' },
          { status: 400 }
        );
      }

      if (decoded.purpose !== 'GOOGLE_REGISTRATION_MATCH') {
        return NextResponse.json(
          { success: false, error: 'Invalid security challenge token.' },
          { status: 400 }
        );
      }

      const nextChallenge = buildGoogleMatchChallenge({
        userId: decoded.userId,
        email: decoded.email,
        firstName: decoded.firstName || 'Trainee',
        lastName: decoded.lastName || 'Account',
        avatarUrl: decoded.avatarUrl || null,
        provider: decoded.provider || 'google',
        termsAgreed: Boolean(decoded.termsAgreed),
      });

      const fullName = `${decoded.firstName || ''} ${decoded.lastName || ''}`.trim() || decoded.email;
      const resendMailRes = await sendGoogleNumberMatchEmail(decoded.email, fullName, nextChallenge.targetNumber);
      if (!resendMailRes.success) {
        return NextResponse.json(
          { success: false, error: 'Unable to send the security match email right now. Please try again.' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        matchToken: nextChallenge.matchToken,
        options: nextChallenge.options,
        message: `A new 2-digit security match number has been sent to ${decoded.email}.`,
      });
    }

    // ==========================================
    // ACTION 5: VERIFY_GOOGLE_MATCH (Complete Google Number-Matching Confirmation)
    // ==========================================
    if (action === 'VERIFY_GOOGLE_MATCH') {
      const { matchToken, selectedNumber } = body;
      if (!matchToken || selectedNumber === undefined || selectedNumber === null) {
        return NextResponse.json(
          { success: false, error: 'Please select the matching 2-digit security number.' },
          { status: 400 }
        );
      }

      let decoded: any;
      try {
        decoded = jwt.verify(matchToken, getJwtSecret());
      } catch {
        return NextResponse.json(
          { success: false, error: 'Google security confirmation session has expired. Please click Continue with Google again.' },
          { status: 400 }
        );
      }

      if (decoded.purpose !== 'GOOGLE_REGISTRATION_MATCH') {
        return NextResponse.json(
          { success: false, error: 'Invalid security challenge token.' },
          { status: 400 }
        );
      }

      const matchRl = checkRateLimit(`trainee-google-match:${decoded.email}`, {
        limit: 8,
        windowMs: 10 * 60 * 1000,
      });
      if (!matchRl.allowed) {
        return createRateLimitResponse(matchRl.retryAfterSeconds);
      }

      const candidateHmac = crypto
        .createHmac('sha256', getJwtSecret())
        .update(`${decoded.jti}:${Number(selectedNumber)}`)
        .digest('hex');
      const expectedHmac = typeof decoded.targetHmac === 'string' ? decoded.targetHmac : '';
      const isMatch =
        candidateHmac.length === 64 &&
        expectedHmac.length === 64 &&
        crypto.timingSafeEqual(Buffer.from(candidateHmac, 'hex'), Buffer.from(expectedHmac, 'hex'));

      if (!isMatch) {
        // Rotate challenge on wrong selection so user cannot brute-force the 3 options
        const rotated = buildGoogleMatchChallenge({
          userId: decoded.userId,
          email: decoded.email,
          firstName: decoded.firstName || 'Trainee',
          lastName: decoded.lastName || 'Account',
          avatarUrl: decoded.avatarUrl || null,
          provider: decoded.provider || 'google',
          termsAgreed: Boolean(decoded.termsAgreed),
        });
        const fullName = `${decoded.firstName || ''} ${decoded.lastName || ''}`.trim() || decoded.email;
        const rotatedMailRes = await sendGoogleNumberMatchEmail(decoded.email, fullName, rotated.targetNumber);
        if (!rotatedMailRes.success) {
          return NextResponse.json(
            { success: false, error: 'Incorrect number selected, and the replacement email could not be sent. Please try again.' },
            { status: 500 }
          );
        }

        logAuditEvent({
          actorEmail: decoded.email,
          actorRole: 'TRAINEE',
          action: 'GOOGLE_NUMBER_MATCH_FAILED',
          targetType: 'USER',
          details: { authUserId: decoded.userId, selectedNumber: Number(selectedNumber), rotated: true },
          ipAddress: ip,
          userAgent,
          status: 'FAILED',
          severity: 'WARNING',
        });

        return NextResponse.json(
          {
            success: false,
            rotated: true,
            matchToken: rotated.matchToken,
            options: rotated.options,
            error: 'Incorrect number selected. For your security, a new 2-digit number has been sent to your Google email.',
          },
          { status: 400 }
        );
      }

      // Number Match Verified -> Provision or activate the Google Trainee account
      const userId: string = decoded.userId;
      const authEmail: string = decoded.email;
      const firstName: string = decoded.firstName || 'Trainee';
      const lastName: string = decoded.lastName || 'Account';
      const avatarUrl: string | null = decoded.avatarUrl || null;
      const provider: string = decoded.provider || 'google';

      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!existingProfile && authEmail) {
        const existingByEmail = await findExistingProfileByEmail(authEmail);
        if (existingByEmail && existingByEmail.id !== userId) {
          return NextResponse.json(
            { success: false, error: 'An account with this email already exists. Please sign in.' },
            { status: 409 }
          );
        }
      }

      const baseUsername =
        existingProfile?.username ||
        (authEmail ? authEmail.split('@')[0] : `trainee_${userId.substring(0, 8)}`);
      const preservedSrn = existingProfile?.srn ?? null;

      let profile = existingProfile;
      const { data: upsertedProfile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert(
          {
            id: userId,
            email: authEmail,
            username: baseUsername,
            first_name: existingProfile?.first_name || firstName,
            last_name: existingProfile?.last_name || lastName,
            avatar_url: avatarUrl || existingProfile?.avatar_url || null,
            srn: preservedSrn,
            role: 'TRAINEE',
            status: 'ACTIVE',
          },
          { onConflict: 'id' }
        )
        .select()
        .maybeSingle();

      if (profileError) {
        if (profileError.message?.includes('username') || profileError.code === '23505') {
          const uniqueUsername = `${baseUsername}_${userId.substring(0, 4)}`;
          const { data: retryProfile, error: retryError } = await supabaseAdmin
            .from('profiles')
            .upsert(
              {
                id: userId,
                email: authEmail,
                username: uniqueUsername,
                first_name: existingProfile?.first_name || firstName,
                last_name: existingProfile?.last_name || lastName,
                avatar_url: avatarUrl || existingProfile?.avatar_url || null,
                srn: preservedSrn,
                role: 'TRAINEE',
                status: 'ACTIVE',
              },
              { onConflict: 'id' }
            )
            .select()
            .maybeSingle();
          if (retryError || !retryProfile) {
            console.error('Google registration profile retry error:', retryError);
            return NextResponse.json(
              { success: false, error: 'Unable to save Google trainee profile. Please sign in if you already have an account.' },
              { status: 409 }
            );
          }
          profile = retryProfile;
        } else {
          console.error('Google registration profile error:', profileError);
          return NextResponse.json(
            { success: false, error: 'Unable to save Google trainee profile. Please try again.' },
            { status: 500 }
          );
        }
      } else {
        profile = upsertedProfile;
      }

      // Ensure corresponding record exists in public.trainees (SRN remains NULL for new Google trainees; preserved if existing)
      const { data: existingTrainee } = await supabaseAdmin
        .from('trainees')
        .select('profile_id, srn, trainee_number')
        .eq('profile_id', userId)
        .maybeSingle();

      if (!existingTrainee) {
        const { error: googleTraineeErr } = await supabaseAdmin.from('trainees').insert({
          profile_id: userId,
          srn: null,
          trainee_number: null,
          enrollment_status: 'ACTIVE',
        });
        if (googleTraineeErr && googleTraineeErr.code !== '23505') {
          console.error('Google registration trainees insert error:', googleTraineeErr);
          return NextResponse.json(
            { success: false, error: 'Unable to finalize Google trainee record. Please try again.' },
            { status: 500 }
          );
        }
      }

      if (decoded.termsAgreed) {
        await recordTermsAcceptance({
          userId,
          termsVersion: TERMS_VERSION,
          privacyVersion: PRIVACY_VERSION,
          ipAddress: ip,
          userAgent,
          acceptanceContext: 'REGISTRATION',
          actorEmail: authEmail,
          actorRole: 'TRAINEE',
        });
      }

      try {
        await dispatchNotificationEvent({
          event: NOTIFICATION_EVENTS.GOOGLE_REGISTRATION,
          traineeId: userId,
          metadata: {
            traineeName: `${profile?.first_name || firstName} ${profile?.last_name || lastName}`.trim() || authEmail,
            traineeEmail: authEmail,
          },
        });
      } catch (notifErr) {
        console.warn('Google registration notification dispatch notice:', notifErr);
      }

      logAuditEvent({
        actorId: userId,
        actorEmail: authEmail,
        actorRole: 'TRAINEE',
        action: 'GOOGLE_NUMBER_MATCH_VERIFIED',
        targetType: 'USER',
        details: { provider, method: 'NUMBER_MATCH_2DIGIT' },
        ipAddress: ip,
        userAgent,
        severity: 'INFO',
      });

      logAuditEvent({
        actorId: userId,
        actorEmail: authEmail,
        actorRole: 'TRAINEE',
        action: 'OAUTH_REGISTRATION_SUCCESS',
        targetType: 'USER',
        details: { method: `${provider.toUpperCase()}_OAUTH`, provider },
        ipAddress: ip,
        userAgent,
        severity: 'INFO',
      });

      // Sync in-memory store, issue NEWSIM Trainee session cookies, and send user directly to /dashboard
      const resolvedTraineePerms = await resolveEffectivePermissionsForUser(userId, 'TRAINEE');
      const userRecord = {
        id: userId,
        email: authEmail,
        username: profile?.username || baseUsername,
        passwordHash: '',
        role: 'TRAINEE' as const,
        status: 'ACTIVE' as const,
        firstName: profile?.first_name || firstName,
        lastName: profile?.last_name || lastName,
        department: profile?.department || '',
        permissions: resolvedTraineePerms,
        mfaEnabled: false,
        failedLoginAttempts: 0,
        mustChangePassword: false,
        createdAt: profile?.created_at || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      try {
        if (db.getUserById(userId)) {
          db.updateUser(userId, userRecord);
        } else {
          db.createUser(userRecord);
        }
      } catch {
        // non-blocking
      }

      const { token } = createSessionToken(userRecord, ip, userAgent);

      try {
        await supabaseAdmin
          .from('profiles')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', userId);
      } catch {
        // non-blocking
      }

      logAuditEvent({
        actorId: userId,
        actorEmail: authEmail,
        actorRole: 'TRAINEE',
        action: 'LOGIN_SUCCESS',
        targetType: 'SESSION',
        details: { method: `${provider.toUpperCase()}_OAUTH_REGISTER`, provider },
        ipAddress: ip,
        userAgent,
        severity: 'INFO',
      });

      const response = NextResponse.json({
        success: true,
        redirectTo: '/dashboard',
        message: 'Google security verification complete! Signing you in to your trainee dashboard...',
      });
      setSessionCookies(response, token, 'TRAINEE');
      response.cookies.delete('newsim_oauth_flow');
      response.cookies.delete('newsim_oauth_terms');
      return response;
    }

    return NextResponse.json(
      { success: false, error: 'Email OTP or Google security verification is required to register. Invalid registration action.' },
      { status: 400 }
    );
  } catch (error: unknown) {
    console.error('Registration API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Registration service encountered an unexpected error.' },
      { status: 500 }
    );
  }
}
