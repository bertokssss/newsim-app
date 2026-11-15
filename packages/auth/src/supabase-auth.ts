import { supabaseAdmin } from '@newsim/database';
import type { Provider } from '@supabase/supabase-js';

/**
 * Sign in with email and password (Super Admin, Admin, Instructor, Trainee).
 * Uses Supabase Auth — no manual password hashing needed.
 */
export async function signInWithPassword(email: string, password: string) {
  const { createClient } = await import('@supabase/supabase-js');
  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data, error } = await authClient.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

/**
 * Sign in with OAuth provider (Trainee only: Google, Facebook, Microsoft, Apple).
 * Returns the URL to redirect the user to for OAuth flow.
 */
export async function signInWithOAuth(
  provider: Provider,
  redirectTo: string
) {
  const { data, error } = await supabaseAdmin.auth.signInWithOAuth({
    provider,
    options: { redirectTo },
  });
  if (error) throw error;
  return data;
}

/**
 * Sign up a new user with email and password.
 * Used for Trainee self-registration.
 */
export async function signUp(
  email: string,
  password: string,
  metadata?: {
    first_name?: string;
    last_name?: string;
    role?: string;
  }
) {
  const { data, error } = await supabaseAdmin.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: metadata?.first_name || '',
        last_name: metadata?.last_name || '',
        role: metadata?.role || 'TRAINEE',
      },
    },
  });
  if (error) throw error;
  return data;
}

/**
 * Create a user account via admin API (for Super Admin creating Admin/Instructor).
 * Bypasses email confirmation.
 */
export async function adminCreateUser(
  email: string,
  password: string,
  metadata?: {
    first_name?: string;
    last_name?: string;
    role?: string;
  }
) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: metadata?.first_name || '',
      last_name: metadata?.last_name || '',
      role: metadata?.role || 'ADMIN',
    },
  });
  if (error) throw error;
  return data;
}

/**
 * Sign out the current user.
 */
export async function signOut(accessToken: string) {
  const { error } = await supabaseAdmin.auth.admin.signOut(accessToken);
  if (error) throw error;
}

/**
 * Send a password reset email.
 */
export async function resetPassword(email: string, redirectTo?: string) {
  const { data, error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (error) throw error;
  return data;
}

/**
 * Update a user's password (after reset or forced change).
 */
export async function updatePassword(accessToken: string, newPassword: string) {
  // Create a client scoped to the user's token
  const { createClient } = await import('@supabase/supabase-js');
  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    }
  );
  const { data, error } = await userClient.auth.updateUser({
    password: newPassword,
  });
  if (error) throw error;
  return data;
}

/**
 * Get user from Supabase Auth by access token.
 */
export async function getUserFromToken(accessToken: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error) return null;
  return data.user;
}

/**
 * Get user by ID from Supabase Auth (admin).
 */
export async function getAuthUserById(userId: string) {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error) return null;
  return data.user;
}

/**
 * Delete a user from Supabase Auth (admin).
 */
export async function deleteAuthUser(userId: string) {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) throw error;
}

/**
 * Get user profile from Supabase profiles table.
 */
export async function getProfileByAuthId(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return data;
}

/**
 * Ensure seed management accounts exist in Supabase Auth & profiles table (dev helper).
 */
export async function ensureSeedManagementUser(email: string, password: string, role: 'super_admin' | 'admin', firstName: string, lastName: string) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    // 1. Try signing in
    const { data: signData, error: signError } = await authClient.auth.signInWithPassword({
      email,
      password,
    });

    if (!signError && signData.user) {
      // Ensure profile exists
      let profile = await getProfileByAuthId(signData.user.id);
      if (!profile) {
        const { error: insertErr } = await supabaseAdmin.from('profiles').insert({
          id: signData.user.id,
          email,
          role,
          first_name: firstName,
          last_name: lastName,
          status: 'active',
        });

      }
      return signData;
    }

    // 2. If sign in fails, create user via admin API
    const { data: newUser } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        role,
      },
    });

    if (newUser?.user) {
      // Create profile
      const { error: insertErr } = await supabaseAdmin.from('profiles').insert({
        id: newUser.user.id,
        email,
        role,
        first_name: firstName,
        last_name: lastName,
        status: 'active',
      });

      // Sign in with new credentials
      const { data: newSignData } = await authClient.auth.signInWithPassword({
        email,
        password,
      });
      return newSignData;
    }
  } catch (err) {
    console.error('Seed management user provision error:', err);
  }
  return null;
}

/**
 * Ensure seed trainee account exists in Supabase Auth & profiles table (dev helper).
 */
export async function ensureSeedTraineeUser(
  email: string,
  password: string,
  firstName: string,
  lastName: string
) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    // 1. Try signing in
    const { data: signData, error: signError } = await authClient.auth.signInWithPassword({
      email,
      password,
    });

    if (!signError && signData.user) {
      let profile = await getProfileByAuthId(signData.user.id);
      if (!profile) {
        await supabaseAdmin.from('profiles').insert({
          id: signData.user.id,
          email,
          username: email.split('@')[0],
          role: 'TRAINEE',
          first_name: firstName,
          last_name: lastName,
          status: 'ACTIVE',
        });
      }
      return signData;
    }

    // 2. If sign in fails, create user via admin API
    const { data: newUser } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        role: 'TRAINEE',
      },
    });

    if (newUser?.user) {
      await supabaseAdmin.from('profiles').insert({
        id: newUser.user.id,
        email,
        username: email.split('@')[0],
        role: 'TRAINEE',
        first_name: firstName,
        last_name: lastName,
        status: 'ACTIVE',
      });

      const { data: newSignData } = await authClient.auth.signInWithPassword({
        email,
        password,
      });
      return newSignData;
    }
  } catch (err) {
    console.error('Seed trainee user provision error:', err);
  }
  return null;
}

/**
 * Sign in and return both auth data and profile.
 * Profile must already exist in the profiles table (created by Super Admin).
 */
export async function signInAndGetProfile(email: string, password: string) {
  const authData = await signInWithPassword(email, password);
  
  if (!authData.user) {
    throw new Error('Authentication failed');
  }

  const profile = await getProfileByAuthId(authData.user.id);

  return { authData, profile };
}

/**
 * Update user profile in Supabase profiles table.
 */
export async function updateProfile(userId: string, updates: any) {
  let { data, error } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating profile in Supabase:', error);
    return null;
  }
  return data;
}

/**
 * Generate a password reset link via Supabase Admin API.
 */
export async function generatePasswordResetLink(email: string, redirectTo: string) {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo },
  });
  if (error) throw error;
  return data;
}

/**
 * Update user password directly using Admin API by user ID.
 */
export async function resetUserPasswordByAdmin(userId: string, newPassword: string) {
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });
  if (error) throw error;
  return data;
}

/**
 * Verify a recovery access token and update user password.
 */
export async function verifyRecoveryTokenAndReset(token: string, newPassword: string) {
  const { createClient } = await import('@supabase/supabase-js');
  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData?.user) {
    throw new Error('Invalid or expired reset token. Please request a new password reset link.');
  }

  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userData.user.id, {
    password: newPassword,
  });
  if (error) throw error;
  return { user: userData.user, data };
}
