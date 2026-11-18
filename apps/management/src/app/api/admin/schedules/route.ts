import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, processScheduleAutomaticTransitions, createNotificationRecord } from '@newsim/database';
import {
  applyCenterFilter,
  computeEndDate,
  formatSchedule,
  isAdminContext,
  isFullModularCourseRow,
  parseClockToIso,
  requestMeta,
  requireAdmin,
  SCHEDULE_SELECT,
  writeAdminAudit,
} from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request, { permission: 'SCHEDULE_VIEW' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    // Automatically transition past schedules to COMPLETED before querying
    await processScheduleAutomaticTransitions().catch((e) => console.warn('Schedule auto transition error:', e));

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || '';
    const status = searchParams.get('status') || 'ALL';
    const instructorId = searchParams.get('instructorId') || 'ALL';

    let query = supabaseAdmin.from('schedules').select(SCHEDULE_SELECT);
    query = applyCenterFilter(query, ctx.centerId);
    if (instructorId !== 'ALL') query = query.eq('instructor_id', instructorId);
    if (status !== 'ALL') query = query.eq('status', status.toUpperCase());

    const [
      { data, error },
      { data: enrollments },
      { data: approvedLeaves },
      { data: modularAssignments },
    ] = await Promise.all([
      query.order('start_at', { ascending: true }),
      supabaseAdmin
        .from('enrollments')
        .select('course_id')
        .not('status', 'in', '("CANCELLED","REJECTED")'),
      supabaseAdmin
        .from('instructor_leaves')
        .select('instructor_id, start_date, end_date, leave_type, reason')
        .eq('status', 'APPROVED'),
      supabaseAdmin
        .from('course_instructors')
        .select(
          'course_id, instructor_id, assigned_at, courses(id, code, name, category, duration_hours, theory_days, practical_days, capacity, training_center_id, training_centers(id, name)), instructors(profile_id, profiles(first_name, last_name, avatar_url))'
        )
        .order('assigned_at', { ascending: false }),
    ]);

    if (error) throw error;

    const countMap = new Map<string, number>();
    (enrollments || []).forEach((e: any) => {
      if (e.course_id) {
        countMap.set(e.course_id, (countMap.get(e.course_id) || 0) + 1);
      }
    });

    // Query substitute profiles
    const subIds = Array.from(new Set((data || []).map((r: any) => r.substitute_instructor_id).filter(Boolean)));
    const subMap = new Map<string, { name: string; avatarUrl: string | null }>();
    if (subIds.length > 0) {
      const { data: subProfs } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .in('id', subIds);
      (subProfs || []).forEach((p: any) => {
        subMap.set(p.id, {
          name: `Capt. ${p.first_name || ''} ${p.last_name || ''}`.trim(),
          avatarUrl: p.avatar_url || null,
        });
      });
    }

    let schedules = (data || [])
      .filter((row: any) => !isFullModularCourseRow(row.courses))
      .map((row: any) => {
      const actualCount = countMap.get(row.course_id) || 0;
      const effectiveCap = Math.min(row.capacity || 24, 24);

      // Check if instructor is on approved leave
      const sStart = row.start_at ? row.start_at.split('T')[0] : '';
      const sEnd = row.end_at ? row.end_at.split('T')[0] : sStart;
      const activeLeave = (approvedLeaves || []).find((l: any) =>
        l.instructor_id === row.instructor_id &&
        l.start_date <= sEnd &&
        l.end_date >= sStart
      );

      const subInfo = row.substitute_instructor_id ? subMap.get(row.substitute_instructor_id) : undefined;
      return formatSchedule({
        ...row,
        substituteInstructorName: row.substitute_instructor_id ? subInfo?.name || 'Substitute Assigned' : '',
        substituteInstructorAvatarUrl: subInfo?.avatarUrl || null,
        instructorOnLeave: Boolean(activeLeave),
        leaveDetails: activeLeave ? {
          startDate: activeLeave.start_date,
          endDate: activeLeave.end_date,
          leaveType: activeLeave.leave_type,
          reason: activeLeave.reason
        } : null,
        capacity: effectiveCap,
        enrolledCount: Math.min(actualCount, effectiveCap),
      });
    });

    // Include assigned Full Modular / In-House courses (Academic Record Review — no practical training date)
    const statusUpper = status.toUpperCase();
    if (!date && (statusUpper === 'ALL' || statusUpper === 'SCHEDULED' || statusUpper === 'ONGOING')) {
      const seenModularCourseIds = new Set<string>();
      for (const ci of modularAssignments || []) {
        const cObj = Array.isArray(ci.courses) ? ci.courses[0] : ci.courses;
        if (!cObj || !isFullModularCourseRow(cObj)) continue;
        if (ctx.centerId && cObj.training_center_id && cObj.training_center_id !== ctx.centerId) continue;
        if (instructorId !== 'ALL' && ci.instructor_id !== instructorId) continue;
        if (seenModularCourseIds.has(ci.course_id)) continue;
        seenModularCourseIds.add(ci.course_id);

        const insRel = Array.isArray(ci.instructors) ? ci.instructors[0] : ci.instructors;
        const profRel = Array.isArray(insRel?.profiles) ? insRel.profiles[0] : insRel?.profiles;
        const insName = profRel
          ? `Capt. ${profRel.first_name || ''} ${profRel.last_name || ''}`.trim()
          : 'Assigned Reviewer';
        const centerRel = Array.isArray(cObj.training_centers)
          ? cObj.training_centers[0]
          : cObj.training_centers;

        const actualCount = countMap.get(ci.course_id) || 0;
        const effectiveCap = Math.min(cObj.capacity || 24, 24);
        const theoryDays = Math.min(3, Math.max(1, Number(cObj.theory_days || 3)));

        schedules.unshift({
          id: `modular:${ci.course_id}:${ci.instructor_id}`,
          sessionCode: `${cObj.code || 'MOD'}-MODULAR`,
          courseId: ci.course_id,
          courseCode: cObj.code || 'MOD',
          courseTitle: cObj.name || 'Full Modular Course',
          category: cObj.category || 'In-House Courses',
          isFullModular: true,
          deliveryMode: 'FULL_MODULAR',
          instructorId: ci.instructor_id,
          instructorName: insName,
          instructorAvatarUrl: profRel?.avatar_url || null,
          substituteInstructorId: null,
          substituteInstructorName: '',
          substituteInstructorAvatarUrl: null,
          instructorOnLeave: false,
          leaveDetails: null,
          centerId: cObj.training_center_id || ctx.centerId || null,
          centerName: centerRel?.name || 'NEWSIM Online Modular LMS',
          room: 'Online Modular Portal (No Physical Room)',
          date: '',
          startDate: '',
          endDate: '',
          startTime: 'Self-Paced (Max 3 Days)',
          endTime: 'No Practical Date',
          startAt: ci.assigned_at || null,
          endAt: null,
          durationHours: Number(cObj.duration_hours || 24),
          theoryDays,
          practicalDays: 0,
          totalDays: theoryDays,
          capacity: effectiveCap,
          enrolledCount: Math.min(actualCount, effectiveCap),
          status: statusUpper === 'ONGOING' ? 'ONGOING' : 'SCHEDULED',
          isCompleted: false,
        } as any);
      }
    }

    if (date) {
      schedules = schedules.filter((s: any) => s.date === date);
    }

    return NextResponse.json({ success: true, data: schedules });
  } catch (error) {
    console.error('Failed to load schedules:', error);
    return NextResponse.json({ success: false, error: 'Failed to load schedules' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = await requireAdmin(request, { permission: 'SCHEDULE_MANAGE' });
  if (!isAdminContext(ctx)) return ctx;

  try {
    const body = await request.json();
    const { courseId, instructorId, room, date, startTime, endTime, capacity } = body;
    const { ip, userAgent } = requestMeta(request);

    if (!courseId) {
      return NextResponse.json(
        { success: false, error: 'Course is required' },
        { status: 400 }
      );
    }

    const { data: course } = await supabaseAdmin
      .from('courses')
      .select('id, code, name, category, training_center_id, capacity, duration_hours, theory_days, practical_days')
      .eq('id', courseId)
      .maybeSingle();

    if (!course) {
      return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 });
    }

    const isFullModular = isFullModularCourseRow(course);
    const cleanInstructorId = instructorId ? String(instructorId).trim() : null;

    // For Full Modular / In-House courses: assign instructor for Academic Record Review only
    // and activate enrolled trainees WITHOUT creating a practical training date/schedule.
    if (isFullModular) {
      if (cleanInstructorId) {
        try {
          await supabaseAdmin
            .from('course_instructors')
            .delete()
            .eq('course_id', courseId);

          await supabaseAdmin
            .from('course_instructors')
            .upsert(
              {
                course_id: courseId,
                instructor_id: cleanInstructorId,
                assigned_at: new Date().toISOString(),
              },
              { onConflict: 'course_id,instructor_id' }
            );

          await supabaseAdmin
            .from('batches')
            .update({
              instructor_id: cleanInstructorId,
              updated_at: new Date().toISOString(),
            })
            .eq('course_id', courseId);

          await createNotificationRecord({
            recipient_id: cleanInstructorId,
            type: 'INSTRUCTOR_ASSIGNED',
            category: 'SCHEDULE',
            title: 'Assigned as Academic Record Reviewer',
            message: `You have been assigned to review academic records and grades for ${course.name || 'Full Modular course'} (Full Modular / In-House — No Practical Date).`,
            priority: 'MEDIUM',
            entity_type: 'COURSE',
            entity_id: courseId,
            action_url: '/grades',
          });
        } catch (ciErr) {
          console.warn('Notice: full modular course_instructors mapping:', ciErr);
        }
      }

      let activatedTraineesCount = 0;
      try {
        const { data: targetEnrollments } = await supabaseAdmin
          .from('enrollments')
          .select('id, trainee_id, status')
          .eq('course_id', courseId)
          .in('status', ['APPROVED', 'ENROLLED']);

        if (targetEnrollments && targetEnrollments.length > 0) {
          const enrollmentIds = targetEnrollments.map((e: any) => e.id);
          const traineeIds = Array.from(
            new Set<string>(
              targetEnrollments.map((e: any) => String(e.trainee_id || '')).filter(Boolean)
            )
          );

          const { error: enrUpdateErr } = await supabaseAdmin
            .from('enrollments')
            .update({
              status: 'ACTIVE',
              enrolled_at: new Date().toISOString(),
            })
            .in('id', enrollmentIds);

          if (!enrUpdateErr) {
            activatedTraineesCount = targetEnrollments.length;
          }

          await supabaseAdmin
            .from('trainees')
            .update({ enrollment_status: 'ACTIVE' })
            .in('profile_id', traineeIds);

          await Promise.allSettled(
            traineeIds.map((tId) =>
              createNotificationRecord({
                recipient_id: tId,
                type: 'ENROLLMENT_ACTIVATED',
                category: 'ENROLLMENT',
                title: 'Full Modular Course Activated',
                message: `Your Full Modular course (${course.name}) is now active! Complete your online modules and assessments within 3 days (no practical training date required).`,
                priority: 'MEDIUM',
                entity_type: 'COURSE',
                entity_id: courseId,
                action_url: '/learning',
              })
            )
          );
        }
      } catch (actErr) {
        console.warn('Notice: full modular trainee activation:', actErr);
      }

      await writeAdminAudit({
        actorId: ctx.user.id,
        action: 'MODULAR_REVIEWER_ASSIGNED',
        entityType: 'COURSE',
        entityId: courseId,
        details: {
          courseId,
          instructorId: cleanInstructorId,
          deliveryMode: 'FULL_MODULAR',
          practicalDays: 0,
          activatedTraineesCount,
        },
        ip,
        userAgent,
      });

      return NextResponse.json({
        success: true,
        isFullModular: true,
        activatedTraineesCount,
        message: `Full Modular course assigned for Academic Record Review (no practical training date). ${activatedTraineesCount} trainee enrollment(s) activated.`,
      });
    }

    if (!date || !startTime || !endTime) {
      return NextResponse.json(
        { success: false, error: 'Course, practical date, and session times are required' },
        { status: 400 }
      );
    }

    const startAt = parseClockToIso(date, startTime);
    const endAt = parseClockToIso(date, endTime);

    const startAtMs = new Date(startAt).getTime();
    const endAtMs = new Date(endAt).getTime();

    if (isNaN(startAtMs) || isNaN(endAtMs) || endAtMs <= startAtMs) {
      return NextResponse.json(
        { success: false, error: 'Invalid session duration: End time must be later than start time.' },
        { status: 400 }
      );
    }

    const centerId = course.training_center_id || ctx.centerId;
    const roomName = (room || 'Main Hall').trim();

    // Calculate dates first
    const durationHours = Number(course.duration_hours || 40);
    const durationDays = Math.max(1, Math.ceil(durationHours / 8));
    const theoryDays = Number(course.theory_days ?? (durationDays === 1 ? 1 : Math.max(1, Math.round(durationDays * 0.4))));
    const practicalDays = Number(course.practical_days ?? (durationDays === 1 ? 0 : Math.max(0, durationDays - theoryDays)));
    const totalDays = Math.max(1, theoryDays + practicalDays);
    const calculatedEndDateStr = computeEndDate(date, totalDays);
    const calculatedEndAt = parseClockToIso(calculatedEndDateStr, endTime);

    // 0. Instructor Approved Leave Check: Block assignment if instructor has approved leave during period
    if (cleanInstructorId) {
      const { data: approvedLeaves } = await supabaseAdmin
        .from('instructor_leaves')
        .select('id, start_date, end_date, leave_type')
        .eq('instructor_id', cleanInstructorId)
        .eq('status', 'APPROVED')
        .lte('start_date', calculatedEndDateStr)
        .gte('end_date', date);

      if (approvedLeaves && approvedLeaves.length > 0) {
        const l = approvedLeaves[0];
        return NextResponse.json(
          {
            success: false,
            error: `Cannot assign instructor: Selected instructor is on approved leave from ${l.start_date} to ${l.end_date} (${l.leave_type}). Cannot schedule because instructor is on leave.`,
          },
          { status: 409 }
        );
      }
    }

    // Course Ongoing Constraint: The second/next batch cannot be assigned a schedule if the course is currently ONGOING
    const nowMs = Date.now();
    const { data: courseSchedules } = await supabaseAdmin
      .from('schedules')
      .select('id, room, start_at, end_at, status')
      .eq('course_id', courseId)
      .neq('status', 'CANCELLED')
      .neq('status', 'COMPLETED');

    const hasOngoingSchedule = (courseSchedules || []).some((s: any) => {
      if (s.status === 'ONGOING') return true;
      if (s.start_at && s.end_at) {
        const sStart = new Date(s.start_at).getTime();
        const sEnd = new Date(s.end_at).getTime();
        if (nowMs >= sStart && nowMs <= sEnd) return true;
      }
      return false;
    });

    const { data: ongoingBatches } = await supabaseAdmin
      .from('batches')
      .select('id, batch_code, status')
      .eq('course_id', courseId)
      .in('status', ['IN_PROGRESS', 'ONGOING']);

    if (hasOngoingSchedule || (ongoingBatches && ongoingBatches.length > 0)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot assign schedule for next batch: A training session/batch for this course is currently ONGOING. The ongoing batch must complete before the next batch can be scheduled.',
        },
        { status: 409 }
      );
    }

    const { data: existingSchedules, error: schedError } = await supabaseAdmin
      .from('schedules')
      .select('id, room, start_at, end_at, instructor_id, status, courses(code, name), instructors:instructors(profiles(first_name, last_name))')
      .neq('status', 'CANCELLED');

    if (schedError) throw schedError;

    for (const existing of (existingSchedules || [])) {
      if (!existing.start_at || !existing.end_at) continue;
      const exStartMs = new Date(existing.start_at).getTime();
      const exEndMs = new Date(existing.end_at).getTime();

      // Interval overlap condition: (StartA < EndB) and (EndA > StartB) across full multi-day course span
      const effectiveEndAtMs = new Date(calculatedEndAt).getTime() || endAtMs;
      const overlaps = startAtMs < exEndMs && effectiveEndAtMs > exStartMs;
      if (!overlaps) continue;

      const courseRel = Array.isArray(existing.courses) ? existing.courses[0] : existing.courses;
      const courseLabel = courseRel?.code ? `${courseRel.code} - ${courseRel.name || ''}` : courseRel?.name || 'Session';
      const timeLabel = `${new Date(existing.start_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })} to ${new Date(existing.end_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;

      // 1. Room Conflict Detection
      if (existing.room && existing.room.toLowerCase().trim() === roomName.toLowerCase()) {
        return NextResponse.json(
          {
            success: false,
            error: `Classroom Conflict: "${roomName}" is already booked for ${courseLabel} from ${timeLabel}. Please choose another room or timeframe.`,
          },
          { status: 409 }
        );
      }

      // 2. Instructor Conflict Detection
      if (cleanInstructorId && existing.instructor_id && existing.instructor_id === cleanInstructorId) {
        const insRel = Array.isArray(existing.instructors) ? existing.instructors[0] : existing.instructors;
        const insProf = Array.isArray(insRel?.profiles) ? insRel.profiles[0] : insRel?.profiles;
        const insName = insProf ? `${insProf.first_name} ${insProf.last_name}`.trim() : 'Selected instructor';

        return NextResponse.json(
          {
            success: false,
            error: `Instructor Overlap Conflict: ${insName} is already assigned to ${courseLabel} in ${existing.room || 'another room'} from ${timeLabel}.`,
          },
          { status: 409 }
        );
      }
    }

    const { data, error } = await supabaseAdmin
      .from('schedules')
      .insert({
        course_id: courseId,
        instructor_id: instructorId || null,
        training_center_id: centerId,
        room: roomName,
        start_at: startAt,
        end_at: calculatedEndAt,
        capacity: Math.min(Math.max(1, parseInt(capacity, 10) || course.capacity || 24), 24),
        status: 'SCHEDULED',
      })
      .select(SCHEDULE_SELECT)
      .single();

    if (error) throw error;

    // 1. Link course to instructor in course_instructors mapping and batches
    if (cleanInstructorId) {
      try {
        await supabaseAdmin
          .from('course_instructors')
          .delete()
          .eq('course_id', courseId);

        await supabaseAdmin
          .from('course_instructors')
          .upsert(
            {
              course_id: courseId,
              instructor_id: cleanInstructorId,
              assigned_at: new Date().toISOString(),
            },
            { onConflict: 'course_id,instructor_id' }
          );

        await supabaseAdmin
          .from('batches')
          .update({
            instructor_id: cleanInstructorId,
            updated_at: new Date().toISOString(),
          })
          .eq('course_id', courseId);
      } catch (ciErr) {
        console.warn('Notice: course_instructors / batches mapping:', ciErr);
      }

      // Notify the assigned Instructor cleanly with verified /schedules route
      try {
        await createNotificationRecord({
          recipient_id: cleanInstructorId,
          type: 'INSTRUCTOR_ASSIGNED',
          category: 'SCHEDULE',
          title: 'Course Assigned',
          message: `You have been assigned to lead ${course.name || 'your assigned course'} in ${roomName} on ${date}.`,
          priority: 'MEDIUM',
          entity_type: 'SCHEDULE',
          entity_id: data.id,
          action_url: '/schedules',
        });
      } catch (notifErr) {
        console.warn('Notice: instructor notification:', notifErr);
      }
    }

    // 2. Activate enrolled trainees so their progress starts immediately
    let activatedTraineesCount = 0;
    try {
      const { data: targetEnrollments } = await supabaseAdmin
        .from('enrollments')
        .select('id, trainee_id, status')
        .eq('course_id', courseId)
        .in('status', ['APPROVED', 'ENROLLED']);

      if (targetEnrollments && targetEnrollments.length > 0) {
        const enrollmentIds = targetEnrollments.map((e: any) => e.id);
        const traineeIds = Array.from(
          new Set<string>(
            targetEnrollments.map((e: any) => String(e.trainee_id || '')).filter(Boolean)
          )
        );

        // Update enrollments to ACTIVE status
        const { error: enrUpdateErr } = await supabaseAdmin
          .from('enrollments')
          .update({
            status: 'ACTIVE',
            enrolled_at: new Date().toISOString(),
          })
          .in('id', enrollmentIds);

        if (!enrUpdateErr) {
          activatedTraineesCount = targetEnrollments.length;
        }

        // Update trainee profile enrollment status to ACTIVE
        await supabaseAdmin
          .from('trainees')
          .update({
            enrollment_status: 'ACTIVE',
          })
          .in('profile_id', traineeIds);

        // Send activation notification to all enrolled trainees with verified /my-courses route
        await Promise.allSettled(
          traineeIds.map((tId) =>
            createNotificationRecord({
              recipient_id: tId,
              type: 'ENROLLMENT_ACTIVATED',
              category: 'ENROLLMENT',
              title: 'Course Activated & Timetable Ready',
              message: `Your course has been assigned and scheduled! Classroom: ${roomName}. You can now begin your learning materials and track your course progress.`,
              priority: 'MEDIUM',
              entity_type: 'SCHEDULE',
              entity_id: data.id,
              action_url: '/my-courses',
            })
          )
        );
      }
    } catch (actErr) {
      console.warn('Notice: trainee progress activation:', actErr);
    }

    await writeAdminAudit({
      actorId: ctx.user.id,
      action: 'COURSE_ASSIGNED_SCHEDULED',
      entityType: 'SCHEDULE',
      entityId: data.id,
      details: {
        courseId,
        instructorId: cleanInstructorId,
        room: roomName,
        date,
        startTime,
        activatedTraineesCount,
      },
      ip,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      schedule: formatSchedule(data),
      activatedTraineesCount,
      message: `Course assigned successfully. ${activatedTraineesCount} trainee enrollment(s) activated to start progress.`,
    });
  } catch (error) {
    console.error('Failed to create schedule:', error);
    return NextResponse.json({ success: false, error: 'Failed to create schedule' }, { status: 500 });
  }
}
