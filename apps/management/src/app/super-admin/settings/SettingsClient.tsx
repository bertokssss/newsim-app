'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  Shield,
  KeyRound,
  Lock,
  Mail,
  Building2,
  Bell,
  CheckCircle2,
  RefreshCw,
  Save,
  Laptop,
  Camera,
  Loader2,
  User,
} from 'lucide-react';
import { Button, AppInput, TwoFactorAuthCard } from '@newsim/ui';
import QRCode from 'react-qr-code';

const easeCurve: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function SettingsClient() {
  const [activeTab, setActiveTab] = useState<'ACCOUNT' | 'AUTH' | 'SECURITY' | 'NOTIF' | 'CONFIG'>('ACCOUNT');
  const [settings, setSettings] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Profile Form States
  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    department: 'Executive Governance',
    avatarUrl: null as string | null,
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Account Password Form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    mfaCode: '',
  });
  const [passwordLoading, setPasswordLoading] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [setRes, meRes] = await Promise.all([
        fetch('/api/super-admin/settings'),
        fetch('/api/auth/me?portal=super-admin'),
      ]);

      const setData = await setRes.json();
      const meData = await meRes.json();

      if (setData.success) setSettings(setData.data);
      if (meData.success && meData.user) {
        setUserProfile(meData.user);
        setProfileForm({
          firstName: meData.user.firstName || '',
          lastName: meData.user.lastName || '',
          phone: meData.user.phone || '',
          department: meData.user.department || 'Executive Governance',
          avatarUrl: meData.user.avatarUrl || null,
        });
      }
    } catch (err) {
      console.error('Failed to load settings', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setStatusMessage({ type: 'error', message: 'Please select an image file (JPG, PNG, WebP).' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setStatusMessage({ type: 'error', message: 'Image must be under 5MB.' });
      return;
    }

    setAvatarLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const maxDim = 320;
        const width = img.width;
        const height = img.height;
        const minSide = Math.min(width, height);
        const startX = (width - minSide) / 2;
        const startY = (height - minSide) / 2;

        canvas.width = maxDim;
        canvas.height = maxDim;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, startX, startY, minSide, minSide, 0, 0, maxDim, maxDim);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setProfileForm((prev) => ({ ...prev, avatarUrl: dataUrl }));

          try {
            const res = await fetch('/api/super-admin/settings/account', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'UPDATE_AVATAR',
                avatarUrl: dataUrl,
              }),
            });
            const resJson = await res.json();
            if (resJson.success) {
              setStatusMessage({ type: 'success', message: 'Super Admin profile photo updated successfully.' });
              window.dispatchEvent(new Event('profile-updated'));
            } else {
              setStatusMessage({ type: 'error', message: resJson.error || 'Failed to update avatar photo.' });
            }
          } catch {
            setStatusMessage({ type: 'error', message: 'Failed to upload photo.' });
          }
        }
        setAvatarLoading(false);
      };
      img.onerror = () => {
        setStatusMessage({ type: 'error', message: 'Failed to process image file.' });
        setAvatarLoading(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/super-admin/settings/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_PROFILE',
          firstName: profileForm.firstName,
          lastName: profileForm.lastName,
          phone: profileForm.phone,
          department: profileForm.department,
          avatarUrl: profileForm.avatarUrl,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setStatusMessage({ type: 'success', message: 'Super Admin profile updated successfully.' });
        window.dispatchEvent(new Event('profile-updated'));
        fetchData();
      } else {
        setStatusMessage({ type: 'error', message: json.error || 'Failed to update profile.' });
      }
    } catch {
      setStatusMessage({ type: 'error', message: 'Network error updating profile.' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdateSettingValue = (key: string, value: string) => {
    setSettings((prev) =>
      prev.map((s) => (s.key === key ? { ...s, value } : s))
    );
  };

  const handleSaveSystemSettings = async () => {
    setStatusMessage(null);
    try {
      const res = await fetch('/api/super-admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      const json = await res.json();
      if (json.success) {
        setStatusMessage({ type: 'success', message: 'System settings saved and applied successfully.' });
      } else {
        setStatusMessage({ type: 'error', message: json.error || 'Failed to save settings.' });
      }
    } catch {
      setStatusMessage({ type: 'error', message: 'Network error saving settings.' });
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setStatusMessage({ type: 'error', message: 'New passwords do not match.' });
      return;
    }

    if (passwordForm.newPassword.length < 12) {
      setStatusMessage({ type: 'error', message: 'Password must be at least 12 characters.' });
      return;
    }

    setPasswordLoading(true);

    try {
      const res = await fetch('/api/super-admin/settings/account', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CHANGE_PASSWORD',
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
          mfaCode: passwordForm.mfaCode.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setStatusMessage({ type: 'success', message: json.message });
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '', mfaCode: '' });
      } else {
        setStatusMessage({ type: 'error', message: json.error || 'Failed to change password.' });
      }
    } catch {
      setStatusMessage({ type: 'error', message: 'Failed to communicate with authentication service.' });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleRevokeOtherSessions = async () => {
    setStatusMessage(null);
    try {
      const res = await fetch('/api/super-admin/settings/account', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REVOKE_OTHER_SESSIONS' }),
      });
      const json = await res.json();
      if (json.success) {
        setStatusMessage({ type: 'success', message: json.message });
      }
    } catch {
      setStatusMessage({ type: 'error', message: 'Failed to revoke other sessions.' });
    }
  };

  if (isLoading && settings.length === 0) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="p-6 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-7 w-64 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            <div className="h-4 w-96 max-w-full bg-slate-100 dark:bg-slate-800/60 rounded" />
          </div>
          <div className="h-9 w-32 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-3 space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-11 w-full bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 rounded-xl" />
            ))}
          </div>
          <div className="lg:col-span-9 p-6 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 space-y-4">
            <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="h-16 w-full bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const getSettingValue = (key: string, defaultValue = '') => {
    const s = settings.find((item) => item.key === key);
    return s ? s.value : defaultValue;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-20px' }}
        transition={{ duration: 0.5, ease: easeCurve }}
        className="p-6 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-200"
      >
        <div className="relative z-10">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-heading flex items-center gap-2">
            <span>Settings & Security Policies</span>
            <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/80">
              CONFIG
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
            Configure application parameters, privileged credential protection, session timeouts, and enterprise policies.
          </p>
        </div>

        {activeTab !== 'ACCOUNT' && (
          <div className="relative z-10">
            <button
              onClick={handleSaveSystemSettings}
              className="h-9 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save System Configuration</span>
            </button>
          </div>
        )}
      </motion.div>

      {statusMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between font-medium ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/80'
              : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/80'
          }`}
        >
          <span>{statusMessage.message}</span>
          <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer">✕</button>
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-2">
        {[
          { id: 'ACCOUNT', label: 'Super Admin Account & MFA', icon: Shield },
          { id: 'AUTH', label: 'Authentication & Session Policy', icon: KeyRound },
          { id: 'SECURITY', label: 'Security & Lockout Policy', icon: Lock },
          { id: 'NOTIF', label: 'Notification Triggers', icon: Bell },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/80 font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. SUPER ADMIN ACCOUNT & MFA */}
      {activeTab === 'ACCOUNT' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, ease: easeCurve }}
              className="p-6 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4 transition-colors duration-200"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-sky-500" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">Super Admin Profile Information</h3>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/80 font-mono font-semibold text-[10px]">
                  MASTER PRIVILEGE
                </span>
              </div>

              {/* Avatar Upload Banner */}
              <div className="flex items-center gap-4 py-2">
                <div className="relative group shrink-0">
                  <div className="w-16 h-16 rounded-2xl bg-sky-100 dark:bg-sky-950/60 border border-sky-300 dark:border-sky-700/60 flex items-center justify-center overflow-hidden shadow-sm text-sky-700 dark:text-sky-300 font-mono font-extrabold text-xl">
                    {profileForm.avatarUrl ? (
                      <img src={profileForm.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      `${(profileForm.firstName?.[0] || 'S').toUpperCase()}${(profileForm.lastName?.[0] || 'A').toUpperCase()}`
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={avatarLoading}
                    aria-label="Upload photo"
                    className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex flex-col items-center justify-center text-white text-[10px] font-mono gap-1 cursor-pointer"
                  >
                    {avatarLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Camera className="w-4 h-4" />
                        <span>Upload</span>
                      </>
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarFile}
                    className="hidden"
                  />
                </div>
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {userProfile?.email}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Official Master Executive Account
                  </div>
                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2 py-0.5 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800 text-[10px] font-mono hover:bg-sky-100 transition-colors cursor-pointer"
                    >
                      Change Photo
                    </button>
                    {profileForm.avatarUrl && (
                      <button
                        type="button"
                        onClick={async () => {
                          setProfileForm((prev) => ({ ...prev, avatarUrl: null }));
                          await fetch('/api/super-admin/settings/account', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'UPDATE_AVATAR', avatarUrl: null }),
                          });
                          window.dispatchEvent(new Event('profile-updated'));
                        }}
                        className="text-[10px] text-slate-400 hover:text-rose-500 font-mono transition-colors cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-500 dark:text-slate-400 font-mono text-[10px] uppercase mb-1">First Name *</label>
                    <input
                      type="text"
                      required
                      value={profileForm.firstName}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, firstName: e.target.value }))}
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 dark:text-slate-400 font-mono text-[10px] uppercase mb-1">Last Name *</label>
                    <input
                      type="text"
                      required
                      value={profileForm.lastName}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, lastName: e.target.value }))}
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-500 dark:text-slate-400 font-mono text-[10px] uppercase mb-1">Phone Contact</label>
                    <input
                      type="text"
                      value={profileForm.phone}
                      placeholder="e.g. 09171234567"
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 dark:text-slate-400 font-mono text-[10px] uppercase mb-1">Department</label>
                    <input
                      type="text"
                      value={profileForm.department}
                      placeholder="e.g. Executive Governance"
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, department: e.target.value }))}
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={savingProfile}
                    className="cursor-pointer"
                  >
                    {savingProfile ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                    <span>Save Profile Changes</span>
                  </Button>
                </div>
              </form>
            </motion.div>

            {/* MFA Security Posture */}
            <TwoFactorAuthCard
              roleLabel="Super Admin"
              mfaEnabled={userProfile ? Boolean(userProfile.mfaEnabled) : true}
              endpoint="/api/super-admin/settings/account"
              method="PUT"
              renderQr={(uri) => (
                <QRCode value={uri} size={152} style={{ height: 'auto', maxWidth: '100%', width: '100%' }} />
              )}
              onMfaUpdated={() => fetchData()}
            />
          </div>

          {/* Password Change Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-20px' }}
            transition={{ duration: 0.45, ease: easeCurve }}
            className="p-6 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4 transition-colors duration-200"
          >
            <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">Change Super Admin Password</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Updating your credentials requires entering your current password and 6-digit TOTP code. Changing password will automatically terminate all other active sessions for security.
            </p>

            <form onSubmit={handlePasswordChange} className="space-y-4 max-w-xl">
              <AppInput
                label="Current Password"
                type="password"
                placeholder="••••••••••••"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <AppInput
                  label="New Password (Min 12 Chars)"
                  type="password"
                  placeholder="••••••••••••"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  required
                />
                <AppInput
                  label="Confirm New Password"
                  type="password"
                  placeholder="••••••••••••"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  required
                />
              </div>

              <AppInput
                label="6-Digit Authenticator Security Code"
                type="text"
                maxLength={6}
                placeholder="123456"
                value={passwordForm.mfaCode}
                onChange={(e) => setPasswordForm({ ...passwordForm, mfaCode: e.target.value })}
                required
              />

              <Button type="submit" variant="primary" isLoading={passwordLoading} className="cursor-pointer">
                {passwordLoading ? 'Updating Credentials...' : 'Update Password & Invalidate Other Sessions'}
              </Button>
            </form>
          </motion.div>

          {/* Session Termination Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-20px' }}
            transition={{ duration: 0.45, ease: easeCurve }}
            className="p-6 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors duration-200"
          >
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">Active Privileged Sessions</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Sign out of all other web browsers and mobile devices currently authenticated under your Super Admin credentials.
              </p>
            </div>

            <Button variant="danger" size="sm" onClick={handleRevokeOtherSessions} className="cursor-pointer">
              SIGN OUT OTHER SESSIONS
            </Button>
          </motion.div>
        </div>
      )}

      {/* 2. AUTHENTICATION & SESSION POLICY */}
      {activeTab === 'AUTH' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, ease: easeCurve }}
          className="p-6 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6 transition-colors duration-200"
        >
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">Authentication & Session Lifetime Policies</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Configure global token expiration and credential parameters.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase font-mono">
                Privileged Session Lifetime (Minutes)
              </label>
              <input
                type="number"
                value={getSettingValue('SEC_SESSION_TIMEOUT_MINUTES', '480')}
                onChange={(e) => handleUpdateSettingValue('SEC_SESSION_TIMEOUT_MINUTES', e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500 font-mono"
              />
              <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">Default: 480 min (8 hours)</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase font-mono">
                MFA Requirement Enforcement Policy
              </label>
              <select
                value={getSettingValue('SEC_MFA_POLICY', 'MANDATORY_SUPER_AND_ADMIN')}
                onChange={(e) => handleUpdateSettingValue('SEC_MFA_POLICY', e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500 font-mono cursor-pointer"
              >
                <option value="MANDATORY_SUPER_AND_ADMIN">Mandatory for Super Admin & Admin</option>
                <option value="MANDATORY_ALL_STAFF">Mandatory for All Staff (Incl. Instructors)</option>
                <option value="OPTIONAL">Optional (Not Recommended)</option>
              </select>
            </div>
          </div>
        </motion.div>
      )}

      {/* 3. SECURITY & LOCKOUT POLICY */}
      {activeTab === 'SECURITY' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, ease: easeCurve }}
          className="p-6 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6 transition-colors duration-200"
        >
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">Brute-Force Defense & Account Lockout Policies</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Configure thresholds for automated lockout defense against credential stuffing.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase font-mono">
                Max Failed Login Attempts
              </label>
              <input
                type="number"
                value={getSettingValue('SEC_MAX_LOGIN_ATTEMPTS', '5')}
                onChange={(e) => handleUpdateSettingValue('SEC_MAX_LOGIN_ATTEMPTS', e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500 font-mono"
              />
              <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">Account temporarily locked after this count</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase font-mono">
                Lockout Duration (Minutes)
              </label>
              <input
                type="number"
                value={getSettingValue('SEC_LOCKOUT_DURATION_MINUTES', '30')}
                onChange={(e) => handleUpdateSettingValue('SEC_LOCKOUT_DURATION_MINUTES', e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500 font-mono"
              />
              <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">Auto-unlocks after elapsed duration</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase font-mono">
                Min Password Length (Characters)
              </label>
              <input
                type="number"
                value={getSettingValue('SEC_PASSWORD_MIN_LENGTH', '12')}
                onChange={(e) => handleUpdateSettingValue('SEC_PASSWORD_MIN_LENGTH', e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500 font-mono"
              />
              <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">Minimum allowed length for passwords</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* 4. NOTIFICATION TRIGGERS */}
      {activeTab === 'NOTIF' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, ease: easeCurve }}
          className="p-6 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6 transition-colors duration-200"
        >
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">Security & Digest Notification Triggers</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Configure automated notification behavior for executive personnel.</p>
          </div>

          <div className="space-y-3">
            {[
              { key: 'NOTIF_SECURITY_EMAIL_ALERTS', label: 'Real-Time Email Dispatch for Critical Threat Events' },
              { key: 'NOTIF_ADMIN_PROVISIONING_ALERT', label: 'Notify Super Admin when New Administrator is Provisioned' },
              { key: 'NOTIF_DAILY_HEALTH_DIGEST', label: 'Daily 06:00 UTC System Health & Infrastructure Digest' },
            ].map((n) => (
              <label key={n.key} className="flex items-center justify-between p-4 rounded-xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 cursor-pointer shadow-xs">
                <span className="text-xs text-slate-800 dark:text-slate-200 font-medium">{n.label}</span>
                <input
                  type="checkbox"
                  checked={getSettingValue(n.key, 'ENABLED') === 'ENABLED'}
                  onChange={(e) => handleUpdateSettingValue(n.key, e.target.checked ? 'ENABLED' : 'DISABLED')}
                  className="rounded border-slate-300 dark:border-slate-700 text-sky-600 focus:ring-sky-500 focus:ring-offset-0"
                />
              </label>
            ))}
          </div>
        </motion.div>
      )}



    </div>
  );
}

