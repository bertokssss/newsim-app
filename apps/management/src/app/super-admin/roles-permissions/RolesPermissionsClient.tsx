'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldAlert,
  CheckCircle2,
  Lock,
  Save,
  RotateCcw,
  CheckSquare,
  AlertTriangle,
} from 'lucide-react';
import {
  getDefaultPermissionsForRole,
  getPermissionsCatalogForRole,
  RbacRole,
} from '@newsim/utils';
import { StepUpAuthModal } from '@/components/super-admin/StepUpAuthModal';

const easeCurve: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function RolesPermissionsClient() {
  const [roles, setRoles] = useState<any[]>([]);
  const [availablePermissionsByRole, setAvailablePermissionsByRole] = useState<Record<string, any[]>>({});
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({});
  const [selectedRole, setSelectedRole] = useState<RbacRole>('ADMIN');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Step-Up Auth
  const [stepUpOpen, setStepUpOpen] = useState(false);

  const fetchRolesData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/super-admin/roles-permissions');
      const json = await res.json();
      if (json.success && json.data) {
        setRoles(json.data.roles || []);
        setAvailablePermissionsByRole(json.data.availablePermissionsByRole || {});
        setRolePermissions(json.data.rolePermissions || {});
      }
    } catch (err) {
      console.error('Failed to load roles and permissions', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRolesData();
  }, []);

  const catalogForRole =
    availablePermissionsByRole[selectedRole] && availablePermissionsByRole[selectedRole].length > 0
      ? availablePermissionsByRole[selectedRole]
      : getPermissionsCatalogForRole(selectedRole);

  const handleTogglePermission = (permId: string, isMandatory: boolean) => {
    if (isMandatory) return;
    setSaveError(null);
    const currentList = rolePermissions[selectedRole] || [];
    const updated = currentList.includes(permId)
      ? currentList.filter((p) => p !== permId)
      : [...currentList, permId];

    setRolePermissions({
      ...rolePermissions,
      [selectedRole]: updated,
    });
  };

  const handleSelectAllForRole = () => {
    setSaveError(null);
    const allIds = catalogForRole.map((p: any) => p.id);
    setRolePermissions({
      ...rolePermissions,
      [selectedRole]: allIds,
    });
  };

  const handleResetRoleDefaults = () => {
    setSaveError(null);
    setRolePermissions({
      ...rolePermissions,
      [selectedRole]: getDefaultPermissionsForRole(selectedRole),
    });
  };

  const handleSaveTrigger = () => {
    setSaveError(null);
    setStepUpOpen(true);
  };

  const handleSaveConfirmed = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      const res = await fetch('/api/super-admin/roles-permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: selectedRole,
          permissions: rolePermissions[selectedRole] || [],
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.rolePermissions) {
          setRolePermissions(data.rolePermissions);
        }
        setSaveSuccess(true);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('newsim:permissions-updated'));
        }
        setTimeout(() => setSaveSuccess(false), 3500);
      } else {
        setSaveError(data?.error || 'Failed to update role permissions.');
      }
    } catch (err) {
      console.error('Failed to save role permissions', err);
      setSaveError('Network error while saving role permissions.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading && roles.length === 0) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="p-6 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-7 w-72 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            <div className="h-4 w-96 max-w-full bg-slate-100 dark:bg-slate-800/60 rounded" />
          </div>
          <div className="h-9 w-36 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 space-y-2">
                <div className="h-5 w-40 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-3 w-56 bg-slate-100 dark:bg-slate-800/60 rounded" />
              </div>
            ))}
          </div>
          <div className="lg:col-span-8 p-6 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 space-y-4">
            <div className="h-6 w-52 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            {[1, 2, 3, 4, 5].map((j) => (
              <div key={j} className="h-12 w-full bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const selectedRoleObj = roles.find((r) => r.id === selectedRole);
  const allowedIds = new Set(catalogForRole.map((p: any) => p.id));
  const currentPerms = (rolePermissions[selectedRole] || []).filter((id) => allowedIds.has(id));
  const categories = Array.from(new Set(catalogForRole.map((p: any) => p.category)));

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
            <span>Role-Based Access Control (RBAC)</span>
            <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/80">
              MODULE SCOPED
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
            Configure only the module privileges that belong to each portal role. Changes immediately control portal navigation, direct route access, and backend APIs.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleSelectAllForRole}
            className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <CheckSquare className="w-3.5 h-3.5 text-sky-500" />
            <span>Enable All</span>
          </button>
          <button
            type="button"
            onClick={handleResetRoleDefaults}
            className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Defaults</span>
          </button>
          <button
            type="button"
            onClick={handleSaveTrigger}
            disabled={isSaving}
            className="h-9 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save Matrix (Step-Up)'}</span>
          </button>
        </div>
      </motion.div>

      {saveSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/80 text-xs flex items-center gap-2 font-medium"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Role permissions updated and enforced across active portal sessions.</span>
        </motion.div>
      )}

      {saveError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3.5 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/80 text-xs flex items-center gap-2 font-medium"
        >
          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>{saveError}</span>
        </motion.div>
      )}

      {/* Role Selector Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {roles.map((r, idx) => {
          const isSelected = selectedRole === r.id;
          return (
            <motion.button
              key={r.id}
              type="button"
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: idx * 0.05, ease: easeCurve }}
              whileHover={{ y: -2, transition: { duration: 0.2 } }}
              onClick={() => {
                setSaveError(null);
                setSelectedRole(r.id as RbacRole);
              }}
              className={`relative p-5 rounded-2xl text-left border transition-all overflow-hidden cursor-pointer ${
                isSelected
                  ? 'bg-sky-50/60 dark:bg-sky-950/30 border-sky-500 shadow-xs ring-1 ring-sky-500/30'
                  : 'bg-white dark:bg-[#0c1a2c] border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
              }`}
            >
              <div className="flex justify-between items-start">
                <span className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400">{r.id}</span>
                {r.isProtected && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/80 text-[10px] font-mono font-semibold flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> PROTECTED
                  </span>
                )}
              </div>

              <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-2 font-heading">{r.name}</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">{r.description}</p>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-3">
                {(rolePermissions[r.id] || []).length} / {(availablePermissionsByRole[r.id] || getPermissionsCatalogForRole(r.id)).length} privileges active • {r.userCount} accounts
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Permission Matrix Grid for Selected Role */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-20px' }}
        transition={{ duration: 0.5, ease: easeCurve }}
        className="p-6 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6 transition-colors duration-200"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">
              Portal Module Privileges for <span className="text-sky-600 dark:text-sky-400">{selectedRoleObj?.name}</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Showing only the {catalogForRole.length} module permissions applicable to the {selectedRoleObj?.name || selectedRole} portal.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold">
            {currentPerms.length} of {catalogForRole.length} active
          </span>
        </div>

        {selectedRole === 'SUPER_ADMIN' && (
          <div className="p-3.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/80 text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong>Super Admin Governance & Financial Isolation:</strong> Core governance privileges (Roles, Security, Audit Logs, Settings View) cannot be stripped. Payment & billing modules are permanently excluded from Super Admin.
            </div>
          </div>
        )}

        {selectedRole === 'ADMIN' && (
          <div className="p-3.5 rounded-xl bg-sky-50 text-sky-900 border border-sky-200 dark:bg-sky-950/30 dark:text-sky-200 dark:border-sky-800/70 text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
            <div>
              <strong>Role Policy & Per-Admin Least Privilege:</strong> Role-level switches gate which modules are enabled across the Admin portal. Individual Administrators only gain Financial / Payment access when explicitly granted in <em>Admin Accounts</em>.
            </div>
          </div>
        )}

        {/* Categories of Permissions scoped strictly to selectedRole */}
        <div className="space-y-6">
          {categories.map((cat) => {
            const permsInCat = catalogForRole.filter((p: any) => p.category === cat);
            return (
              <div key={cat} className="space-y-2.5">
                <div className="text-xs font-mono font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                  {cat} ({permsInCat.length})
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {permsInCat.map((perm: any) => {
                    const isMandatory = !!perm.mandatory;
                    const isGranted = isMandatory || currentPerms.includes(perm.id);
                    return (
                      <label
                        key={perm.id}
                        className={`p-3.5 rounded-xl border flex items-start gap-3 transition-all ${
                          isMandatory ? 'cursor-not-allowed' : 'cursor-pointer'
                        } ${
                          isGranted
                            ? 'bg-sky-50/50 dark:bg-sky-950/20 border-sky-400/60 dark:border-sky-800/60 shadow-xs'
                            : 'bg-slate-50/50 dark:bg-slate-900/30 border-slate-200/80 dark:border-slate-800/80 opacity-80 hover:opacity-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isGranted}
                          disabled={isMandatory}
                          onChange={() => handleTogglePermission(perm.id, isMandatory)}
                          className="rounded border-slate-300 dark:border-slate-700 text-sky-600 focus:ring-sky-500 focus:ring-offset-0 mt-0.5 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-slate-900 dark:text-white font-mono">{perm.id}</span>
                            {isMandatory && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[9px] font-mono uppercase">
                                <Lock className="w-2.5 h-2.5" /> Mandatory
                              </span>
                            )}
                            {perm.isFinancial && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[9px] font-mono uppercase">
                                Billing Only
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold mt-0.5">{perm.name}</div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-tight">{perm.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Step-Up Auth Modal */}
      <StepUpAuthModal
        isOpen={stepUpOpen}
        onClose={() => setStepUpOpen(false)}
        onSuccess={handleSaveConfirmed}
        title="Authorize Role Permission Modification"
        description={`Updating module privileges for role '${selectedRole}' requires password & MFA verification.`}
        actionName={`ROLE_PERMS_UPDATE_${selectedRole}`}
      />
    </div>
  );
}
