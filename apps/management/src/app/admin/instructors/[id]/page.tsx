import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { supabaseAdmin } from '@newsim/database';
import { UserAvatar } from '@newsim/ui';
import { formatInstructor, INSTRUCTOR_SELECT } from '@/lib/admin-api';

export default async function InstructorDetailsPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const resolvedParams = await params;
  const id = resolvedParams.id;

  // NOTE: the `instructors` table is keyed by `profile_id` (there is no `id` column),
  // so filtering on `id` makes PostgREST error out with 42703.
  const { data: instructorData, error } = await supabaseAdmin
    .from('instructors')
    .select(INSTRUCTOR_SELECT)
    .eq('profile_id', id)
    .maybeSingle();

  if (error) {
    console.error('Failed to load instructor details:', error);
  }

  if (error || !instructorData) {
    return <div className="p-8 text-center text-red-500">Instructor not found</div>;
  }

  const instructor = formatInstructor(instructorData);

  // Include sessions where this instructor is the assigned or the substitute instructor
  const { data: schedulesData } = await supabaseAdmin
    .from('schedules')
    .select('*, courses(*)')
    .or(`instructor_id.eq.${id},substitute_instructor_id.eq.${id}`)
    .order('start_at', { ascending: false });

  const schedules = schedulesData || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/admin/instructors" className="p-2 rounded-xl bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-emerald-500 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-[#F8FAFC]">
          Instructor Details
        </h1>
      </div>

      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <UserAvatar
              src={instructor.avatarUrl}
              firstName={instructor.firstName}
              lastName={instructor.lastName}
              className="w-16 h-16 rounded-2xl text-lg shadow-md border border-slate-200 dark:border-slate-700"
              fallbackClassName="bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 text-white font-bold font-mono"
            />
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {instructor.firstName} {instructor.lastName}
              </h2>
              <p className="text-sm text-slate-500 font-mono mt-1">{instructor.email}</p>
              <p className="text-sm text-slate-500 font-mono mt-1">ID: {instructor.employeeId}</p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 shrink-0">
            {instructor.status}
          </span>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
            <h3 className="text-xs font-mono text-slate-400 uppercase">Specialization</h3>
            <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">{instructor.specialization}</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
            <h3 className="text-xs font-mono text-slate-400 uppercase">Total Load</h3>
            <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">{schedules.length} Sessions Total</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-[#F8FAFC]">Schedule & Load</h2>
        
        {schedules.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-[#0c1a2c] rounded-3xl border border-slate-200 dark:border-slate-800 text-sm text-slate-500">
            No schedules assigned to this instructor.
          </div>
        ) : (
          <div className="space-y-3">
            {schedules.map((schedule: any) => (
              <div key={schedule.id} className="p-4 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white text-sm">
                    {schedule.courses?.name || schedule.courses?.title || 'Unknown Course'}
                  </div>
                  <div className="text-xs text-slate-500 font-mono mt-1">
                    {schedule.start_at ? new Date(schedule.start_at).toLocaleDateString() : 'TBD'}
                    {schedule.end_at ? ` - ${new Date(schedule.end_at).toLocaleDateString()}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {schedule.substitute_instructor_id === id && schedule.instructor_id !== id && (
                    <span className="px-2 py-1 rounded-lg text-[10px] font-mono font-bold bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30">
                      SUBSTITUTE
                    </span>
                  )}
                  <span className="px-2 py-1 rounded-lg text-[10px] font-mono font-bold bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400">
                    {schedule.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
