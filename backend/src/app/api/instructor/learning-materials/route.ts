import { NextRequest, NextResponse } from 'next/server';
import { db, LearningMaterialRecord } from '@newsim/database';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get('courseId') || 'ALL';
    const search = searchParams.get('search')?.toLowerCase() || '';

    let materials = db.getInstructorMaterials(courseId, 'usr-ins-01');

    if (search) {
      materials = materials.filter(
        (m) =>
          m.title.toLowerCase().includes(search) ||
          m.moduleName.toLowerCase().includes(search) ||
          m.courseTitle.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({ success: true, data: materials });
  } catch (error) {
    console.error('Failed to load learning materials:', error);
    return NextResponse.json({ success: false, error: 'Failed to load learning materials' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { courseId, moduleName, title, description, fileType, fileSize } = body;

    if (!courseId || !title || !moduleName) {
      return NextResponse.json({ success: false, error: 'Course, module name, and title are required' }, { status: 400 });
    }

    const course = db.getCourseById(courseId);
    const newMaterial: LearningMaterialRecord = {
      id: `mat-${Date.now()}`,
      courseId,
      courseCode: course?.code || 'BST-01',
      courseTitle: course?.title || 'STCW Basic Safety Training',
      moduleName,
      title,
      description: description || '',
      fileType: fileType || 'PDF',
      fileSize: fileSize || '5.4 MB',
      url: `/materials/uploads/${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      instructorId: 'usr-ins-01',
      instructorName: 'Capt. Arthur Bautista',
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.createLearningMaterial(newMaterial);
    return NextResponse.json({ success: true, data: newMaterial });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to upload material' }, { status: 500 });
  }
}
