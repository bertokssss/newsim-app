import { NextRequest, NextResponse } from 'next/server';
import { getTraineeSchedulesList, getTraineeProfileData } from '@newsim/database';
import { verifyTraineeRequestAsync, createUnauthorizedResponse, createForbiddenResponse, sendDailyLessonReadyEmail, sendPracticalSessionReminderEmail } from '@newsim/auth';

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyTraineeRequestAsync(req, 'SCHEDULE_VIEW');
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }
    const traineeId = auth.user.id;

    const [profile, schedules] = await Promise.all([
      getTraineeProfileData(traineeId),
      getTraineeSchedulesList(traineeId),
    ]);

    const dailyModules = (schedules as any)?.dailyModules || [];
    const practicalSessions = (schedules as any)?.practicalSessions || [];
    const traineeEmail = profile.email;
    const traineeName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Maritime Trainee';

    let emailsSent = 0;

    // 1. Notify about today's module or next available module
    const todayModule = dailyModules.find((m: any) => m.isDueToday) || dailyModules.find((m: any) => m.status === 'AVAILABLE');
    if (todayModule && traineeEmail) {
      await sendDailyLessonReadyEmail(
        traineeEmail,
        traineeName,
        todayModule.courseTitle,
        todayModule.moduleTitle,
        todayModule.dayNumber,
        todayModule.formattedDate,
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002/learning'
      );
      emailsSent++;
    }

    // 2. Notify about upcoming practical session
    const upcomingPractical = practicalSessions[0];
    if (upcomingPractical && traineeEmail) {
      await sendPracticalSessionReminderEmail(
        traineeEmail,
        traineeName,
        upcomingPractical.courseTitle,
        upcomingPractical.formattedDate || upcomingPractical.date,
        upcomingPractical.time,
        upcomingPractical.room,
        upcomingPractical.instructorName
      );
      emailsSent++;
    }

    return NextResponse.json({
      success: true,
      message: `Schedule notification email sent successfully to ${traineeEmail}.`,
      emailsSent,
    });
  } catch (error: any) {
    console.error('Failed to send schedule email notification:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to send notification' }, { status: 500 });
  }
}
