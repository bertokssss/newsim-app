import {
  sendDailyLessonReadyEmail,
  sendModuleFailedEmail,
  sendPracticalSessionReminderEmail,
} from '@newsim/auth';

/**
 * Trainee Portal Email Dispatcher Callback
 * Called by syncTraineeDailyModules during daily curriculum synchronization.
 */
export async function dispatchDailyEmailNotification(params: {
  type: 'READY_TODAY' | 'MODULE_FAILED' | 'PRACTICAL_SCHEDULED';
  traineeEmail: string;
  traineeName: string;
  courseTitle: string;
  moduleTitle: string;
  dayNumber: number;
  scheduledDate: string;
  reason?: string;
  practicalDetails?: {
    dateStr: string;
    timeStr: string;
    room: string;
    instructor: string;
  };
}) {
  if (!params.traineeEmail) return;

  try {
    if (params.type === 'READY_TODAY') {
      await sendDailyLessonReadyEmail(
        params.traineeEmail,
        params.traineeName,
        params.courseTitle,
        params.moduleTitle,
        params.dayNumber,
        params.scheduledDate,
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002/learning'
      );
    } else if (params.type === 'MODULE_FAILED') {
      await sendModuleFailedEmail(
        params.traineeEmail,
        params.traineeName,
        params.courseTitle,
        params.moduleTitle,
        params.dayNumber,
        params.reason || 'Modular completion deadline notice'
      );
    } else if (params.type === 'PRACTICAL_SCHEDULED' && params.practicalDetails) {
      await sendPracticalSessionReminderEmail(
        params.traineeEmail,
        params.traineeName,
        params.courseTitle,
        params.practicalDetails.dateStr,
        params.practicalDetails.timeStr,
        params.practicalDetails.room,
        params.practicalDetails.instructor
      );
    }
  } catch (err) {
    console.error('Failed to dispatch trainee email notification:', err);
  }
}
