import { NextRequest, NextResponse } from 'next/server';
import { getTraineeLearningMaterials } from '@newsim/database';
import { verifyTraineeRequest, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = verifyTraineeRequest(req);
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }
    const traineeId = auth.user.id;

    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get('courseId') || '';
    const search = searchParams.get('search')?.toLowerCase() || '';

    let lessons = await getTraineeLearningMaterials(courseId, traineeId);

    if (search) {
      lessons = lessons.filter(
        (l) =>
          l.title?.toLowerCase().includes(search) ||
          l.moduleName?.toLowerCase().includes(search) ||
          l.content?.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({ success: true, data: lessons });
  } catch (error) {
    console.error('Failed to load learning materials from Supabase:', error);
    return NextResponse.json({ success: false, error: 'Failed to load lessons' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = verifyTraineeRequest(req);
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }

    const body = await req.json();
    const { lessonId } = body;

    if (!lessonId) {
      return NextResponse.json({ success: false, error: 'Lesson ID is required' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: lessonId,
        isCompleted: true,
        completedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to complete lesson:', error);
    return NextResponse.json({ success: false, error: 'Failed to complete lesson' }, { status: 500 });
  }
}
