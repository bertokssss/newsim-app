'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import AdminSettingsSkeleton from './loading';
import {
  Settings,
  User,
  KeyRound,
  ShieldCheck,
  Bell,
  CheckCircle2,
  AlertCircle,
  Save,
  Lock,
  Sparkles,
  Building,
  Hash,
  Camera,
  Loader2,
} from 'lucide-react';
import { TwoFactorAuthCard } from '@newsim/ui';
import QRCode from 'react-qr-code';

const easeCurve: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function SettingsClient() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications'>('profile');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [srn, setSrn] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Notification states
  const [notifications, setNotifications] = useState({
    newRegistrations: true,
    paymentAlerts: true,
    certificateReadiness: true,
    scheduleConflicts: true,
  });
  const [savingNotifs, setSavingNotifs] = useState(false);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/settings');
      const json = await res.json();
      if (json.success) {
        setProfile(json.data);
        setFirstName(json.data.firstName || '');
        setLastName(json.data.lastName || '');
        setPhone(json.data.phone || '');
        setDepartment(json.data.department || '');
        setSrn(json.data.srn || json.data.employeeId || '');
        setAvatarUrl(json.data.avatarUrl || null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFeedback({ type: 'error', message: 'Please select an image file (JPG, PNG, WebP).' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFeedback({ type: 'error', message: 'Image must be under 5MB.' });
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
          setAvatarUrl(dataUrl);

          try {
            const res = await fetch('/api/admin/settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'UPDATE_AVATAR',
                avatarUrl: dataUrl,
              }),
            });
            const resJson = await res.json();
            if (resJson.success) {
              setFeedback({ type: 'success', message: 'Admin profile photo updated successfully.' });
              window.dispatchEvent(new Event('profile-updated'));
            } else {
              setFeedback({ type: 'error', message: resJson.error || 'Failed to update photo.' });
            }
          } catch {
            setFeedback({ type: 'error', message: 'Failed to upload photo.' });
          }
        }
        setAvatarLoading(false);
      };
      img.onerror = () => {
        setFeedback({ type: 'error', message: 'Failed to process image file.' });
        setAvatarLoading(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_PROFILE',
          firstName,
          lastName,
          phone,
          department,
          srn,
          avatarUrl,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setFeedback({ type: 'success', message: 'Profile and institutional details updated successfully.' });
        window.dispatchEvent(new Event('profile-updated'));
        fetchSettings();
      } else {
        setFeedback({ type: 'error', message: json.error || 'Failed to update profile.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Network error updating profile.' });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (newPassword !== confirmPassword) {
      setFeedback({ type: 'error', message: 'New passwords do not match.' });
      return;
    }
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CHANGE_PASSWORD',
          currentPassword,
          newPassword,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setFeedback({ type: 'success', message: 'Password changed successfully.' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setFeedback({ type: 'error', message: json.error || 'Password update failed.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Network error changing password.' });
    }
  };

  const handleSaveNotifications = async () => {
    setFeedback(null);
    try {
      setSavingNotifs(true);
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_NOTIFICATIONS',
          preferences: notifications,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setFeedback({ type: 'success', message: 'Notification preferences saved successfully.' });
      } else {
        setFeedback({ type: 'error', message: json.error || 'Failed to save notifications.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Network error saving preferences.' });
    } finally {
      setSavingNotifs(false);
    }
  };

  if (loading && !profile) {
    return <AdminSettingsSkeleton />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
      {/* Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: easeCurve }}
        className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm"
      >
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-gradient-to-r from-emerald-500/15 to-teal-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-400/30">
              Account & Credentials
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-heading">
            Admin Account Settings
          </h1>
          <p className="text-sm text-slate-600 dark:text-[#CBD5E1]">
            Manage your administrator profile, department, maritime SRN, update password credentials, configure multi-factor authentication (MFA), and customize notifications.
          </p>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="p-1.5 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-2">
        {[
          { id: 'profile', label: 'My Profile', icon: User },
          { id: 'security', label: 'Security & MFA', icon: ShieldCheck },
          { id: 'notifications', label: 'Preferences', icon: Bell },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setFeedback(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-mono font-bold transition-all ${
                activeTab === tab.id
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-[#CBD5E1] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-2xl border text-xs font-mono flex items-center gap-2.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-500/30 text-rose-700 dark:text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          )}
          <span>{feedback.message}</span>
        </motion.div>
      )}

      {/* Tab 1: Profile */}
      {activeTab === 'profile' && (
        <motion.form
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleUpdateProfile}
          className="p-6 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4 text-xs"
        >
          <div className="flex flex-col sm:flex-row items-center gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div className="relative group shrink-0">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-mono font-bold text-lg flex items-center justify-center shadow-md overflow-hidden">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Admin Avatar" className="w-full h-full object-cover" />
                ) : profile ? (
                  `${profile.firstName?.charAt(0) || 'A'}${profile.lastName?.charAt(0) || 'D'}`
                ) : (
                  'AD'
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
            <div className="text-center sm:text-left space-y-1">
              <div className="font-extrabold text-sm text-slate-900 dark:text-[#F8FAFC] font-heading">
                {firstName || lastName ? `${firstName} ${lastName}`.trim() : 'Administrator'}
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                {profile?.email} • {profile?.employeeId || profile?.srn}
              </div>
              <div className="flex items-center gap-2 pt-1 justify-center sm:justify-start">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[10px] font-mono hover:bg-emerald-100 transition-colors cursor-pointer"
                >
                  Change Photo
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={async () => {
                      setAvatarUrl(null);
                      await fetch('/api/admin/settings', {
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1">
                First Name
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none font-sans"
              />
            </div>
            <div>
              <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1">
                Last Name
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none font-sans"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1">
                Phone Contact
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+63 9XX XXX XXXX"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1">
                Department
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Operations & Enrollment"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none font-sans"
              />
            </div>
            <div>
              <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1">
                SRN Number / Employee ID
              </label>
              <input
                type="text"
                value={srn}
                onChange={(e) => setSrn(e.target.value)}
                placeholder="SRN-ADM-001"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none font-mono"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold shadow-md shadow-emerald-500/25 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>Save Profile</span>
            </button>
          </div>
        </motion.form>
      )}

      {/* Tab 2: Security & MFA */}
      {activeTab === 'security' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 text-xs"
        >
          {/* Password Form */}
          <form
            onSubmit={handleChangePassword}
            className="p-6 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4"
          >
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <KeyRound className="w-4 h-4 text-emerald-500" />
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-[#F8FAFC] font-heading">
                Change Password
              </h3>
            </div>

            <div>
              <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1">
                Current Password
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none font-mono"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold shadow-md shadow-emerald-500/25"
              >
                <Lock className="w-4 h-4" />
                <span>Update Password</span>
              </button>
            </div>
          </form>

          {/* MFA Management */}
          <TwoFactorAuthCard
            roleLabel="Admin"
            mfaEnabled={Boolean(profile?.mfaEnabled)}
            endpoint="/api/admin/settings"
            renderQr={(uri) => (
              <QRCode value={uri} size={152} style={{ height: 'auto', maxWidth: '100%', width: '100%' }} />
            )}
            onMfaUpdated={() => {
              setFeedback({ type: 'success', message: 'Two-Factor Authentication credentials updated successfully.' });
              fetchSettings();
            }}
            className="rounded-3xl shadow-sm"
          />
        </motion.div>
      )}

      {/* Tab 3: Notifications */}
      {activeTab === 'notifications' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4 text-xs"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-emerald-500" />
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-[#F8FAFC] font-heading">
                Operational Notification Preferences
              </h3>
            </div>
            <button
              onClick={handleSaveNotifications}
              disabled={savingNotifs}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold text-xs shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingNotifs ? 'Saving...' : 'Save Preferences'}</span>
            </button>
          </div>

          <div className="space-y-3">
            {[
              {
                key: 'newRegistrations',
                title: 'New Trainee Cohort Registrations',
                desc: 'Receive instant push alert when seafarers apply online.',
              },
              {
                key: 'paymentAlerts',
                title: 'Payment Verification Alerts',
                desc: 'Alert when QR Ph / GCash transactions await administrative clearance.',
              },
              {
                key: 'certificateReadiness',
                title: 'Certificate Readiness Notifications',
                desc: 'Notify when trainees satisfy course and exam requirements.',
              },
              {
                key: 'scheduleConflicts',
                title: 'Schedule Conflict Notices',
                desc: 'Trigger warnings when classrooms or instructors have timetable collisions.',
              },
            ].map((item) => (
              <div
                key={item.key}
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800 flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-slate-900 dark:text-[#F8FAFC]">{item.title}</div>
                  <div className="text-[11px] text-slate-400 font-sans">{item.desc}</div>
                </div>
                <input
                  type="checkbox"
                  checked={(notifications as any)[item.key]}
                  onChange={(e) =>
                    setNotifications((prev) => ({ ...prev, [item.key]: e.target.checked }))
                  }
                  className="accent-emerald-500 w-4 h-4 cursor-pointer"
                />
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
