'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Save,
  Camera,
  Loader2,
  FileBadge,
  Compass,
} from 'lucide-react';
import { TwoFactorAuthCard } from '@newsim/ui';
import QRCode from 'react-qr-code';

const easeCurve: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function ProfileClient() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Avatar upload
  const [avatarLoading, setAvatarLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/instructor/profile');
      const json = await res.json();
      if (json.success && json.data) {
        setProfile(json.data);
        setFirstName(json.data.firstName || '');
        setLastName(json.data.lastName || '');
        setPhone(json.data.phone || '');
        setSpecialization(json.data.specialization || '');
        setLicenseNumber(json.data.licenseNumber || '');
        setBio(json.data.bio || '');
        setAvatarUrl(json.data.avatarUrl || null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
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
            const res = await fetch('/api/instructor/profile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'UPDATE_AVATAR',
                avatarUrl: dataUrl,
              }),
            });
            const resJson = await res.json();
            if (resJson.success) {
              setFeedback({ type: 'success', message: 'Profile photo updated successfully.' });
              window.dispatchEvent(new Event('profile-updated'));
            } else {
              setFeedback({ type: 'error', message: resJson.error || 'Failed to update avatar photo.' });
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
    setSavingProfile(true);
    try {
      const res = await fetch('/api/instructor/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_PROFILE',
          firstName,
          lastName,
          phone,
          specialization,
          licenseNumber,
          bio,
          avatarUrl,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setFeedback({ type: 'success', message: 'Instructor profile updated successfully.' });
        window.dispatchEvent(new Event('profile-updated'));
        fetchProfile();
      } else {
        setFeedback({ type: 'error', message: json.error || 'Failed to update profile.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Network error updating profile.' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (newPassword !== confirmPassword) {
      setFeedback({ type: 'error', message: 'New passwords do not match.' });
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch('/api/instructor/profile', {
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
    } finally {
      setSavingPassword(false);
    }
  };

  const displayInitials = firstName
    ? `${firstName[0]}${lastName ? lastName[0] : ''}`.toUpperCase()
    : 'IN';

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
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20">
              Instructor Identity & Security
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-heading">
            Instructor Profile & Credentials
          </h1>
          <p className="text-sm text-slate-600 dark:text-[#CBD5E1] leading-relaxed font-sans">
            Manage your personal profile, maritime licenses and certifications, password security, and two-factor authentication (TOTP).
          </p>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="p-1.5 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-2">
        {[
          { id: 'profile', label: 'My Credentials', icon: User },
          { id: 'security', label: 'Password & MFA', icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setFeedback(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
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
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
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
          className="p-6 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6 text-xs"
        >
          {/* Avatar Upload Banner */}
          <div className="flex flex-col sm:flex-row items-center gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div className="relative group shrink-0">
              <div className="w-20 h-20 rounded-2xl bg-sky-100 dark:bg-sky-950/60 border border-sky-300 dark:border-sky-700/60 flex items-center justify-center overflow-hidden shadow-md text-sky-700 dark:text-sky-300 font-mono font-extrabold text-2xl">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Instructor Avatar" className="w-full h-full object-cover" />
                ) : (
                  displayInitials
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
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Camera className="w-5 h-5" />
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
              <div className="font-extrabold text-base text-slate-900 dark:text-[#F8FAFC] font-heading">
                {firstName || lastName ? `${firstName} ${lastName}`.trim() : 'Instructor Account'}
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                {profile?.email || 'instructor@newsim.com'} {profile?.employeeId ? `• ID: ${profile.employeeId}` : ''}
              </div>
              <div className="flex items-center gap-2 pt-1 justify-center sm:justify-start">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800 text-[11px] font-mono hover:bg-sky-100 transition-colors cursor-pointer"
                >
                  Change Profile Photo
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={async () => {
                      setAvatarUrl(null);
                      await fetch('/api/instructor/profile', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'UPDATE_AVATAR', avatarUrl: null }),
                      });
                      window.dispatchEvent(new Event('profile-updated'));
                    }}
                    className="text-[11px] text-slate-400 hover:text-rose-500 font-mono transition-colors cursor-pointer"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1">
                First Name *
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1">
                Last Name *
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1">
                Phone Contact Number
              </label>
              <input
                type="text"
                value={phone}
                placeholder="e.g. 09171234567"
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1">
                Teaching Specialization
              </label>
              <input
                type="text"
                value={specialization}
                placeholder="e.g. Bridge Simulator, ECDIS, BRM"
                onChange={(e) => setSpecialization(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none font-sans"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1">
                Maritime License / Certification Number
              </label>
              <input
                type="text"
                value={licenseNumber}
                placeholder="e.g. MARINA-COC-2024-987"
                onChange={(e) => setLicenseNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1">
                Official Employee ID
              </label>
              <input
                type="text"
                disabled
                value={profile?.employeeId || 'INS-ACTIVE'}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-400 outline-none font-mono cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1">
              Professional Biography / Teaching Background
            </label>
            <textarea
              rows={3}
              value={bio}
              placeholder="Share your seafaring background, vessel rank, and simulator teaching experience..."
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none font-sans resize-none"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              type="submit"
              disabled={savingProfile}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold shadow-md shadow-sky-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Profile Changes</span>
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
              <KeyRound className="w-4 h-4 text-sky-500" />
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
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-600 dark:text-[#CBD5E1] font-mono uppercase text-[10px] mb-1">
                  New Password (min. 8 characters)
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none"
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
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-[#F8FAFC] outline-none"
                />
              </div>
            </div>

            <div className="pt-3 flex justify-end">
              <button
                type="submit"
                disabled={savingPassword}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Update Password</span>
              </button>
            </div>
          </form>

          {/* Two-Factor Authentication (TOTP) Card */}
          <TwoFactorAuthCard
            roleLabel="Instructor"
            mfaEnabled={Boolean(profile?.mfaEnabled)}
            endpoint="/api/instructor/profile"
            renderQr={(uri) => (
              <QRCode value={uri} size={152} style={{ height: 'auto', maxWidth: '100%', width: '100%' }} />
            )}
            onMfaUpdated={() => {
              setFeedback({ type: 'success', message: 'Two-Factor Authentication credentials updated successfully.' });
              fetchProfile();
            }}
            className="rounded-3xl shadow-sm"
          />
        </motion.div>
      )}
    </div>
  );
}
