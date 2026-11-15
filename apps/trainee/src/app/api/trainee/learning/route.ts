import { NextRequest, NextResponse } from 'next/server';
import { getTraineeLearningMaterials, recordTraineeLessonCompletion, resetTraineeCourseProgress } from '@newsim/database';
import { verifyTraineeRequestAsync, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';
import { dispatchDailyEmailNotification } from '@/lib/daily-sync';

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyTraineeRequestAsync(req, 'COURSE_VIEW');
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }
    const traineeId = auth.user.id;

    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get('courseId') || '';
    const search = searchParams.get('search')?.toLowerCase() || '';

    try {
      let lessons = await getTraineeLearningMaterials(courseId, traineeId, dispatchDailyEmailNotification);
      const postTest = (lessons as any)?.postTest || null;
      const dailyModules = (lessons as any)?.dailyModules || [];
      const isPracticalCompetent = Boolean((lessons as any)?.isPracticalCompetent);
      const practicalEvaluation = (lessons as any)?.practicalEvaluation || null;
      const schedulePartition = (lessons as any)?.schedulePartition || null;
      const courseCategory = (lessons as any)?.courseCategory || 'Safety and Other STCW Courses';
      const courseCode = (lessons as any)?.courseCode || 'STCW';
      const courseName = (lessons as any)?.courseName || 'Course';
      const requiresPractical = (lessons as any)?.requiresPractical !== false;
      const deliveryMode = (lessons as any)?.deliveryMode || (requiresPractical ? 'MODULAR_AND_PRACTICAL' : 'FULL_MODULAR');
      const practicalRubric = (lessons as any)?.practicalRubric || null;
      const practicalSchedule = (lessons as any)?.practicalSchedule || null;

      if (search) {
        lessons = lessons.filter(
          (l) =>
            l.title?.toLowerCase().includes(search) ||
            l.moduleName?.toLowerCase().includes(search) ||
            l.content?.toLowerCase().includes(search)
        );
      }

      return NextResponse.json({
        success: true,
        data: lessons,
        postTest,
        dailyModules,
        isPracticalCompetent,
        practicalEvaluation,
        schedulePartition,
        courseCategory,
        courseCode,
        courseName,
        requiresPractical,
        deliveryMode,
        practicalRubric,
        practicalSchedule,
      });
    } catch (subErr: any) {
      if (subErr?.code === 'WAITING_FOR_INSTRUCTOR' || subErr?.message === 'WAITING_FOR_INSTRUCTOR') {
        return NextResponse.json({ success: true, data: [], waitingForInstructor: true });
      }
      throw subErr;
    }
  } catch (error) {
    console.error('Failed to load learning materials from Supabase:', error);
    return NextResponse.json({ success: false, error: 'Failed to load lessons' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyTraineeRequestAsync(req, 'COURSE_VIEW');
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }
    const traineeId = auth.user.id;

    const body = await req.json();
    const { courseId, lessonId, moduleId, moduleName, lessonTitle } = body;

    if (!lessonId) {
      return NextResponse.json({ success: false, error: 'Lesson ID is required' }, { status: 400 });
    }

    const data = await recordTraineeLessonCompletion(traineeId, courseId || '', lessonId, moduleId || moduleName, lessonTitle);
    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Failed to complete lesson:', error);
    return NextResponse.json({ success: false, error: 'Failed to complete lesson' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  // STCW Maritime Compliance & Data Integrity: Trainees are strictly prohibited from resetting
  // or erasing course progression and assessment attempts. Historical attempts are immutable audit records.
  return NextResponse.json(
    {
      success: false,
      error: 'Prohibited: Maritime assessment attempts and course progress records are immutable official records and cannot be reset.',
    },
    { status: 403 }
  );
}
