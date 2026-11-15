import nodemailer from 'nodemailer';

// Configure this transporter with your SMTP details in .env.local
// For Gmail, use an App Password.
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendMfaEmail = async (to: string, code: string) => {
  // If SMTP credentials are not set, mock the email (useful for local development)
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('\n=============================================');
    console.log(`[MOCK EMAIL] To: ${to}`);
    console.log(`[MOCK EMAIL] Subject: Your NEWSIM Security Code`);
    console.log(`[MOCK EMAIL] Code: ${code}`);
    console.log('=============================================\n');
    return { success: true, mocked: true };
  }

  try {
    await transporter.sendMail({
      from: `"NEWSIM Security" <${process.env.SMTP_USER}>`,
      to,
      subject: 'Your NEWSIM Security Code',
      text: `Your security code is: ${code}\nThis code will expire in 10 minutes.`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #0f172a;">NEWSIM Security</h2>
          <p>You requested an email verification code to log in to the Management Portal.</p>
          <div style="background-color: #f1f5f9; padding: 15px; text-align: center; font-size: 24px; letter-spacing: 4px; font-weight: bold; border-radius: 4px; margin: 20px 0;">
            ${code}
          </div>
          <p style="color: #64748b; font-size: 14px;">This code will expire in 10 minutes.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="color: #94a3b8; font-size: 12px;">If you didn't request this code, please contact administration immediately.</p>
        </div>
      `,
    });
    return { success: true };
  } catch (error) {
    console.error('Failed to send MFA email:', error);
    return { success: false, error };
  }
};

export const sendInvitationEmail = async (to: string, name: string, email: string, confirmUrl: string, roleLabel: string = 'administrator') => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('\n=============================================');
    console.log(`[MOCK EMAIL] To: ${to}`);
    console.log(`[MOCK EMAIL] Subject: Welcome to NEWSIM Management Portal`);
    console.log(`[MOCK EMAIL] Name: ${name}`);
    console.log(`[MOCK EMAIL] Email: ${email}`);
    console.log(`[MOCK EMAIL] Role: ${roleLabel}`);
    console.log(`[MOCK EMAIL] Confirm URL: ${confirmUrl}`);
    console.log('=============================================\n');
    return { success: true, mocked: true };
  }

  try {
    await transporter.sendMail({
      from: `"NEWSIM Security" <${process.env.SMTP_USER}>`,
      to,
      subject: 'Welcome to NEWSIM Management Portal - Action Required',
      text: `Hello ${name},\n\nA ${roleLabel} account has been created for you.\n\nEmail: ${email}\n\nPlease confirm your account by clicking the link below:\n${confirmUrl}\n\nAfter confirmation, you can log in to the portal.`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #0f172a;">NEWSIM Management Portal</h2>
          <p>Hello <strong>${name}</strong>,</p>
          <p>A ${roleLabel} account has been created for you. You can use your email address to access the portal:</p>
          
          <div style="background-color: #f1f5f9; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Email:</strong> ${email}</p>
          </div>
          
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 30px 0;">
            <tr>
              <td align="center">
                <table border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="center" style="border-radius: 4px;" bgcolor="#0f172a">
                      <a href="${confirmUrl}" target="_blank" style="font-size: 16px; font-family: sans-serif; color: #ffffff; text-decoration: none; border-radius: 4px; padding: 12px 24px; border: 1px solid #0f172a; display: inline-block; font-weight: bold;">Confirm Account</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          
          <p style="color: #64748b; font-size: 14px;">Once confirmed, you can log in to the portal.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="color: #94a3b8; font-size: 12px;">This is an automated message. Please do not reply directly to this email.</p>
        </div>
      `,
    });
    return { success: true };
  } catch (error) {
    console.error('Failed to send invitation email:', error);
    return { success: false, error };
  }
};

export const sendPasswordResetEmail = async (
  to: string,
  name: string,
  resetUrl: string,
  portalName: string = 'NEWSIM Portal'
) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('\n=============================================');
    console.log(`[MOCK EMAIL] To: ${to}`);
    console.log(`[MOCK EMAIL] Subject: Reset Your ${portalName} Password`);
    console.log(`[MOCK EMAIL] Name: ${name}`);
    console.log(`[MOCK EMAIL] Reset URL: ${resetUrl}`);
    console.log('=============================================\n');
    return { success: true, mocked: true };
  }

  try {
    await transporter.sendMail({
      from: `"NEWSIM Security" <${process.env.SMTP_USER}>`,
      to,
      subject: `Reset Your ${portalName} Password`,
      text: `Hello ${name},\n\nYou requested a password reset for your ${portalName} account.\n\nPlease reset your password by clicking the link below:\n${resetUrl}\n\nThis link will expire in 1 hour. If you did not request this, please ignore this email.`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #0f172a; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">NEWSIM Maritime Training System</h1>
            <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Security & Account Services</p>
          </div>
          
          <div style="padding: 20px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #edf2f7; margin-bottom: 24px;">
            <h2 style="color: #1e293b; font-size: 16px; margin-top: 0; margin-bottom: 8px;">Password Reset Request</h2>
            <p style="color: #475569; font-size: 14px; line-height: 1.5; margin: 0;">
              Hello <strong>${name}</strong>,<br/>
              We received a request to reset the password for your <strong>${portalName}</strong> account associated with <code>${to}</code>.
            </p>
          </div>

          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetUrl}" target="_blank" style="display: inline-block; background-color: #0284c7; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(2, 132, 199, 0.2);">
              Reset Account Password
            </a>
          </div>

          <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
            Or copy and paste this link into your browser:<br/>
            <a href="${resetUrl}" style="color: #0284c7; word-break: break-all; font-size: 12px;">${resetUrl}</a>
          </p>

          <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px; line-height: 1.4;">
            <p style="margin: 0 0 8px 0;">This password reset link will expire in 1 hour.</p>
            <p style="margin: 0;">If you did not make this request, you can safely ignore this email. Your current password will remain unchanged.</p>
          </div>
        </div>
      `,
    });
    return { success: true };
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return { success: false, error };
  }
};

export const sendRegistrationOtpEmail = async (
  to: string,
  name: string,
  otp: string
) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DEV OTP] Trainee Registration OTP for ${to}: ${otp}`);
  }

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('\n=============================================');
    console.log(`[MOCK EMAIL] To: ${to}`);
    console.log(`[MOCK EMAIL] Subject: Your NEWSIM Trainee Verification Code`);
    console.log(`[MOCK EMAIL] Name: ${name}`);
    console.log(`[MOCK EMAIL] OTP: ${otp}`);
    console.log('=============================================\n');
    return { success: true, mocked: true };
  }

  try {
    await transporter.sendMail({
      from: `"NEWSIM Security" <${process.env.SMTP_USER}>`,
      to,
      subject: 'Your NEWSIM Trainee Verification Code',
      text: `Hello ${name},\n\nYour 6-digit verification code to complete your NEWSIM Trainee registration is: ${otp}\n\nThis code will expire in 10 minutes. If you did not request this, please ignore this email.`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #0f172a; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">NEWSIM Maritime Training System</h1>
            <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Trainee Account Registration</p>
          </div>
          
          <div style="padding: 20px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #edf2f7; margin-bottom: 24px;">
            <p style="color: #475569; font-size: 14px; line-height: 1.5; margin: 0;">
              Hello <strong>${name}</strong>,<br/>
              Thank you for registering with NEWSIM Maritime Training System. Please enter the following 6-digit verification code to verify your email address and activate your account:
            </p>
            <div style="background-color: #0B3D91; color: #ffffff; padding: 18px; text-align: center; font-size: 32px; letter-spacing: 8px; font-weight: 900; border-radius: 8px; margin: 24px 0; font-family: monospace;">
              ${otp}
            </div>
            <p style="color: #64748b; font-size: 13px; text-align: center; margin: 0;">
              This verification code will expire in 10 minutes.
            </p>
          </div>

          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px; line-height: 1.4;">
            <p style="margin: 0;">If you did not initiate this registration request, please disregard this email.</p>
          </div>
        </div>
      `,
    });
    return { success: true };
  } catch (error) {
    console.error('Failed to send registration OTP email:', error);
    return { success: false, error };
  }
};

export const sendGoogleNumberMatchEmail = async (
  to: string,
  name: string,
  matchNumber: number | string
) => {
  const numStr = String(matchNumber).trim();
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DEV GOOGLE MATCH] Security Match Number for ${to}: ${numStr}`);
  }

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('\n=============================================');
    console.log(`[MOCK EMAIL] To: ${to}`);
    console.log(`[MOCK EMAIL] Subject: NEWSIM Google Registration - Security Match Number: ${numStr}`);
    console.log(`[MOCK EMAIL] Name: ${name}`);
    console.log(`[MOCK EMAIL] Match Number: ${numStr}`);
    console.log('=============================================\n');
    return { success: true, mocked: true };
  }

  try {
    await transporter.sendMail({
      from: `"NEWSIM Security" <${process.env.SMTP_USER}>`,
      to,
      subject: `NEWSIM Security Check: Tap ${numStr} to confirm your Google registration`,
      text: `Hello ${name},\n\nTo complete your NEWSIM Trainee registration with Google (${to}), tap the matching number on your verification screen:\n\n${numStr}\n\nThis security prompt will expire in 10 minutes. If you did not attempt to register with Google, please ignore this email.`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #0f172a; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">NEWSIM Maritime Training System</h1>
            <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Google Account Security Verification (Number Match)</p>
          </div>
          
          <div style="padding: 20px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #edf2f7; margin-bottom: 24px; text-align: center;">
            <p style="color: #475569; font-size: 14px; line-height: 1.5; margin: 0;">
              Hello <strong>${name}</strong>,<br/>
              We received a request to register a NEWSIM Trainee account using your Google account (<strong>${to}</strong>).<br/>
              Tap the matching number below on your NEWSIM verification screen to confirm it's you:
            </p>
            <div style="display: inline-block; min-width: 110px; background-color: #0B3D91; color: #ffffff; padding: 20px 32px; text-align: center; font-size: 42px; font-weight: 900; border-radius: 16px; margin: 24px auto; font-family: monospace; box-shadow: 0 8px 20px rgba(11, 61, 145, 0.25);">
              ${numStr}
            </div>
            <p style="color: #64748b; font-size: 13px; text-align: center; margin: 0;">
              This security challenge will expire in 10 minutes.
            </p>
          </div>

          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px; line-height: 1.4;">
            <p style="margin: 0;">If you did not initiate this Google registration request, do not tap any number and disregard this email.</p>
          </div>
        </div>
      `,
    });
    return { success: true };
  } catch (error) {
    console.error('Failed to send Google number match email:', error);
    return { success: false, error };
  }
};

export const sendDailyLessonReadyEmail = async (
  to: string,
  name: string,
  courseTitle: string,
  moduleTitle: string,
  dayNumber: number,
  scheduledDate: string,
  actionUrl: string = `${(process.env.NEXT_PUBLIC_TRAINEE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002').replace(/\/+$/, '')}/learning`
) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('\n=============================================');
    console.log(`[MOCK EMAIL] To: ${to}`);
    console.log(`[MOCK EMAIL] Subject: Your Maritime Lesson Today is Ready - Don't Miss Out!`);
    console.log(`[MOCK EMAIL] Module: Day ${dayNumber} - ${moduleTitle} (${courseTitle})`);
    console.log('=============================================\n');
    return { success: true, mocked: true };
  }

  try {
    await transporter.sendMail({
      from: `"NEWSIM Training Dispatch" <${process.env.SMTP_USER}>`,
      to,
      subject: `Your Maritime Lesson Today is Ready - Don't Miss Out! (Day ${dayNumber})`,
      text: `Hello ${name},\n\nYour lesson for today, Day ${dayNumber}: ${moduleTitle} (${courseTitle}), is now ready in your NEWSIM Trainee Portal!\n\nPlease complete today's module and assessment before 11:59 PM today (${scheduledDate}). Under STCW daily progression guidelines, uncompleted daily modules are automatically marked as failed.\n\nAccess your lesson now:\n${actionUrl}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #0B3D91; padding-bottom: 16px;">
            <div style="display: inline-block; background-color: #0B3D91; color: #ffffff; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase;">
              NEWSIM Maritime Training System
            </div>
            <h1 style="color: #0B3D91; margin: 12px 0 4px 0; font-size: 22px; font-weight: 900; letter-spacing: -0.5px;">
              Your Lesson Today is Ready! ⚓
            </h1>
            <p style="color: #64748b; font-size: 13px; margin: 0; font-weight: 500;">
              Daily Curriculum Progression Notice • <strong>Don't Miss Out!</strong>
            </p>
          </div>

          <div style="padding: 20px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; margin-bottom: 20px;">
            <p style="color: #166534; font-size: 14px; line-height: 1.5; margin: 0 0 12px 0;">
              Hello <strong>${name}</strong>,<br/>
              Your assigned training module for today is now unlocked and available in the learning player:
            </p>
            <div style="background-color: #ffffff; border: 1px solid #dcfce7; border-radius: 8px; padding: 14px; margin-bottom: 12px;">
              <div style="color: #0B3D91; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
                Day ${dayNumber} Curriculum • ${courseTitle}
              </div>
              <div style="color: #0f172a; font-size: 16px; font-weight: 800; margin-top: 4px;">
                ${moduleTitle}
              </div>
              <div style="color: #64748b; font-size: 12px; margin-top: 4px;">
                Scheduled Date: <strong>${scheduledDate}</strong> (Today)
              </div>
            </div>
            <p style="color: #b45309; font-size: 12px; font-weight: 600; margin: 0; line-height: 1.4;">
              ⚠️ <strong>Mandatory Daily Requirement:</strong> You must complete today's module reading and corresponding assessment before midnight (11:59 PM). If uncompleted today, this specific module will automatically be marked as <strong>FAILED</strong>.
            </p>
          </div>

          <div style="text-align: center; margin: 28px 0;">
            <a href="${actionUrl}" target="_blank" style="display: inline-block; background-color: #0B3D91; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 800; font-size: 14px; box-shadow: 0 4px 10px rgba(11, 61, 145, 0.25);">
              Open Today's Lesson &amp; Assessment →
            </a>
          </div>

          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-top: 24px; font-size: 12px; color: #475569; line-height: 1.5;">
            <strong>Training Progression Roadmap:</strong>
            <ul style="margin: 6px 0 0 0; padding-left: 20px;">
              <li>Complete 1 module per day and its corresponding quiz.</li>
              <li>Once all daily modules are finished, undergo the practical simulator session to qualify for your official certificate.</li>
            </ul>
          </div>

          <div style="margin-top: 24px; padding-top: 14px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 11px; text-align: center;">
            <p style="margin: 0;">This is an automated dispatch from the NEWSIM Maritime Training Operations Center. Please do not reply directly.</p>
          </div>
        </div>
      `,
    });
    return { success: true };
  } catch (error) {
    console.error('Failed to send daily lesson ready email:', error);
    return { success: false, error };
  }
};

export const sendModuleFailedEmail = async (
  to: string,
  name: string,
  courseTitle: string,
  moduleTitle: string,
  dayNumber: number,
  reason: string = 'Missed daily completion deadline'
) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`[MOCK EMAIL] To: ${to} | Module FAILED: ${moduleTitle} (Reason: ${reason})`);
    return { success: true, mocked: true };
  }

  try {
    await transporter.sendMail({
      from: `"NEWSIM Training Dispatch" <${process.env.SMTP_USER}>`,
      to,
      subject: `Notice: Module Marked as FAILED - ${moduleTitle} (${courseTitle})`,
      text: `Hello ${name},\n\nYou did not complete Day ${dayNumber}: ${moduleTitle} (${courseTitle}) on its scheduled date.\n\nIn accordance with maritime training policy, this specific module has been automatically marked as FAILED (${reason}).\n\nPlease continue completing your remaining daily modules and prepare for your practical session.`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #fecaca; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #dc2626; padding-bottom: 16px;">
            <h1 style="color: #dc2626; margin: 0; font-size: 20px; font-weight: 900;">
              Notice of Module Failure
            </h1>
            <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">
              NEWSIM Maritime Academic Operations
            </p>
          </div>

          <div style="padding: 18px; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; margin-bottom: 20px;">
            <p style="color: #991b1b; font-size: 14px; margin: 0 0 10px 0;">
              Hello <strong>${name}</strong>,<br/>
              The scheduled completion window for Day ${dayNumber}: <strong>${moduleTitle}</strong> (${courseTitle}) has closed.
            </p>
            <div style="background-color: #ffffff; border: 1px solid #f87171; border-radius: 6px; padding: 12px; color: #b91c1c; font-size: 13px;">
              <strong>Status:</strong> AUTOMATICALLY FAILED<br/>
              <strong>Reason:</strong> ${reason}
            </div>
            <p style="color: #7f1d1d; font-size: 12px; margin: 10px 0 0 0; line-height: 1.4;">
              Under maritime training regulations, daily modules must be completed on their scheduled day. Please ensure you complete your remaining modules on time.
            </p>
          </div>

          <p style="color: #475569; font-size: 13px; text-align: center;">
            Log in to the Trainee Portal to check your remaining syllabus and upcoming practical simulator schedule.
          </p>
        </div>
      `,
    });
    return { success: true };
  } catch (error) {
    console.error('Failed to send module failed email:', error);
    return { success: false, error };
  }
};

export const sendPracticalSessionReminderEmail = async (
  to: string,
  name: string,
  courseTitle: string,
  dateStr: string,
  timeStr: string,
  room: string,
  instructor: string
) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`[MOCK EMAIL] To: ${to} | Practical Session Reminder: ${dateStr} at ${timeStr}`);
    return { success: true, mocked: true };
  }

  try {
    await transporter.sendMail({
      from: `"NEWSIM Training Dispatch" <${process.env.SMTP_USER}>`,
      to,
      subject: `Practical Simulator & Assessment Session Scheduled: ${courseTitle}`,
      text: `Hello ${name},\n\nYour in-person Practical Training Session for ${courseTitle} is scheduled on ${dateStr} at ${timeStr}.\n\nLocation: ${room}\nAssigned Instructor: ${instructor}\n\nNote: The set time (${timeStr}) is specifically for the hands-on practical session. You must undergo and pass this practical evaluation to be qualified for certificate issuance.`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #bfdbfe; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #0B3D91; padding-bottom: 16px;">
            <h1 style="color: #0B3D91; margin: 0; font-size: 20px; font-weight: 900;">
              In-Person Practical Simulator Session
            </h1>
            <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">
              Official Qualification Assessment Notice
            </p>
          </div>

          <div style="padding: 18px; background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; margin-bottom: 20px;">
            <p style="color: #1e40af; font-size: 14px; margin: 0 0 10px 0;">
              Hello <strong>${name}</strong>,<br/>
              Following your daily theory modules, your in-person practical evaluation has been confirmed:
            </p>
            <div style="background-color: #ffffff; border: 1px solid #93c5fd; border-radius: 6px; padding: 14px; font-size: 13px; color: #1e3a8a;">
              <p style="margin: 0 0 6px 0;"><strong>Program:</strong> ${courseTitle}</p>
              <p style="margin: 0 0 6px 0;"><strong>Date:</strong> ${dateStr}</p>
              <p style="margin: 0 0 6px 0;"><strong>Practical Set Time:</strong> ${timeStr}</p>
              <p style="margin: 0 0 6px 0;"><strong>Simulation Facility:</strong> ${room}</p>
              <p style="margin: 0;"><strong>Assessor / Instructor:</strong> ${instructor}</p>
            </div>
            <p style="color: #1e40af; font-size: 12px; margin: 12px 0 0 0; line-height: 1.4;">
              ⚓ <strong>Certificate Qualification Rule:</strong> Passing this practical simulator drill is mandatory to be qualified for official MARINA certificate issuance.
            </p>
          </div>
        </div>
      `,
    });
    return { success: true };
  } catch (error) {
    console.error('Failed to send practical session email:', error);
    return { success: false, error };
  }
};

