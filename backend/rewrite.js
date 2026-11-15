const fs = require('fs');
const path = require('path');

const files = [
  "assessments",
  "attendance",
  "dashboard",
  "grades",
  "learning-materials",
  "my-courses",
  "notifications",
  "profile",
  "progress",
  "schedules",
  "trainees"
];

const basePath = "c:/Users/Mine/source/repos/Capstone_Final/newsim-app/backend/src/app/api/instructor";

const authCode = `  const auth = await verifyInstructorRequest(req);
  if (!auth.authorized || !auth.user) {
    return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
  }
  const instructorId = auth.user.id;`;

const contents = {
  "assessments": `import { NextRequest, NextResponse } from 'next/server';
import { listAssessments, supabaseAdmin } from '@newsim/database';
import { verifyInstructorRequest, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';

export async function GET(req: NextRequest) {
  try {
${authCode}

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const type = searchParams.get('type') || 'ALL';

    const { data, error } = await supabaseAdmin.from('assessments').select('*');
    if (error) throw error;
    
    let assessments = data || [];

    if (search) {
      assessments = assessments.filter(
        (a: any) =>
          a.code?.toLowerCase().includes(search) ||
          a.title?.toLowerCase().includes(search)
      );
    }

    if (type !== 'ALL') {
      assessments = assessments.filter((a: any) => a.type === type);
    }

    return NextResponse.json({ success: true, data: assessments });
  } catch (error) {
    console.error('Failed to load assessments:', error);
    return NextResponse.json({ success: false, error: 'Failed to load assessments' }, { status: 500 });
  }
}
`,
  "attendance": `import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@newsim/database';
import { verifyInstructorRequest, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';

export async function GET(req: NextRequest) {
  try {
${authCode}

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');

    const { data, error } = await supabaseAdmin.from('attendance_records').select('*');
    if (error) throw error;

    let records = data || [];
    if (date) {
      records = records.filter((r: any) => r.date === date);
    }

    return NextResponse.json({ success: true, data: records });
  } catch (error) {
    console.error('Failed to load attendance:', error);
    return NextResponse.json({ success: false, error: 'Failed to load attendance' }, { status: 500 });
  }
}
`,
  "dashboard": `import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@newsim/database';
import { verifyInstructorRequest, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';

export async function GET(req: NextRequest) {
  try {
${authCode}

    const { data: schedules } = await supabaseAdmin.from('schedules').select('*').eq('instructor_id', instructorId);
    
    const data = {
      activeCourses: schedules?.length || 0,
      totalTrainees: 0,
      upcomingClasses: 0,
      pendingAssessments: 0
    };

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Failed to load dashboard data:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error loading dashboard metrics' },
      { status: 500 }
    );
  }
}
`,
  "grades": `import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@newsim/database';
import { verifyInstructorRequest, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';

export async function GET(req: NextRequest) {
  try {
${authCode}

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase() || '';

    const { data, error } = await supabaseAdmin.from('grades').select('*');
    if (error) throw error;
    
    let grades = data || [];

    return NextResponse.json({ success: true, data: grades });
  } catch (error) {
    console.error('Failed to load grades:', error);
    return NextResponse.json({ success: false, error: 'Failed to load grades' }, { status: 500 });
  }
}
`,
  "learning-materials": `import { NextRequest, NextResponse } from 'next/server';
import { listLearningMaterials, supabaseAdmin } from '@newsim/database';
import { verifyInstructorRequest, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';

export async function GET(req: NextRequest) {
  try {
${authCode}

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const type = searchParams.get('type') || 'ALL';

    const { data, error } = await supabaseAdmin.from('learning_materials').select('*');
    if (error) throw error;

    let materials = data || [];

    if (search) {
      materials = materials.filter(
        (m: any) =>
          m.title?.toLowerCase().includes(search) ||
          m.description?.toLowerCase().includes(search)
      );
    }

    if (type !== 'ALL') {
      materials = materials.filter((m: any) => m.type === type);
    }

    return NextResponse.json({ success: true, data: materials });
  } catch (error) {
    console.error('Failed to load materials:', error);
    return NextResponse.json({ success: false, error: 'Failed to load materials' }, { status: 500 });
  }
}
`,
  "my-courses": `import { NextRequest, NextResponse } from 'next/server';
import { listCourses, supabaseAdmin } from '@newsim/database';
import { verifyInstructorRequest, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';

export async function GET(req: NextRequest) {
  try {
${authCode}

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const status = searchParams.get('status') || 'ALL';

    // Get schedules for this instructor to find their courses
    const { data: schedules } = await supabaseAdmin.from('schedules').select('course_id').eq('instructor_id', instructorId);
    const courseIds = [...new Set((schedules || []).map((s: any) => s.course_id).filter(Boolean))];

    const { data, error } = await supabaseAdmin.from('courses').select('*').in('id', courseIds.length ? courseIds : ['dummy-id']);
    if (error) throw error;

    let courses = data || [];

    if (search) {
      courses = courses.filter(
        (c: any) =>
          c.code?.toLowerCase().includes(search) ||
          c.title?.toLowerCase().includes(search) ||
          c.category?.toLowerCase().includes(search)
      );
    }

    if (status !== 'ALL') {
      courses = courses.filter((c: any) => c.status === status);
    }

    return NextResponse.json({ success: true, data: courses });
  } catch (error) {
    console.error('Failed to load courses:', error);
    return NextResponse.json({ success: false, error: 'Failed to load courses' }, { status: 500 });
  }
}
`,
  "notifications": `import { NextRequest, NextResponse } from 'next/server';
import { listNotifications, supabaseAdmin } from '@newsim/database';
import { verifyInstructorRequest, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';

export async function GET(req: NextRequest) {
  try {
${authCode}

    const { data, error } = await supabaseAdmin.from('notifications').select('*').eq('profile_id', instructorId).order('created_at', { ascending: false });
    if (error) throw error;

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Failed to load notifications:', error);
    return NextResponse.json({ success: false, error: 'Failed to load notifications' }, { status: 500 });
  }
}
`,
  "profile": `import { NextRequest, NextResponse } from 'next/server';
import { getInstructorByProfileId } from '@newsim/database';
import { verifyInstructorRequest, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';

export async function GET(req: NextRequest) {
  try {
${authCode}

    const data = await getInstructorByProfileId(instructorId);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Failed to load profile:', error);
    return NextResponse.json({ success: false, error: 'Failed to load profile' }, { status: 500 });
  }
}
`,
  "progress": `import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@newsim/database';
import { verifyInstructorRequest, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';

export async function GET(req: NextRequest) {
  try {
${authCode}

    const { data, error } = await supabaseAdmin.from('enrollments').select('*');
    if (error) throw error;

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Failed to load progress:', error);
    return NextResponse.json({ success: false, error: 'Failed to load progress' }, { status: 500 });
  }
}
`,
  "schedules": `import { NextRequest, NextResponse } from 'next/server';
import { listSchedules } from '@newsim/database';
import { verifyInstructorRequest, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';

export async function GET(req: NextRequest) {
  try {
${authCode}

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const view = searchParams.get('view') || 'month';

    const schedules = await listSchedules({ instructor_id: instructorId });

    return NextResponse.json({ success: true, data: schedules });
  } catch (error) {
    console.error('Failed to load schedules:', error);
    return NextResponse.json({ success: false, error: 'Failed to load schedules' }, { status: 500 });
  }
}
`,
  "trainees": `import { NextRequest, NextResponse } from 'next/server';
import { listTrainees, supabaseAdmin } from '@newsim/database';
import { verifyInstructorRequest, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';

export async function GET(req: NextRequest) {
  try {
${authCode}

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const status = searchParams.get('status') || 'ALL';

    const { data, error } = await supabaseAdmin.from('trainees').select('*, profiles!inner(*)');
    if (error) throw error;
    
    let trainees = data || [];

    if (search) {
      trainees = trainees.filter(
        (t: any) =>
          t.profiles?.first_name?.toLowerCase().includes(search) ||
          t.profiles?.last_name?.toLowerCase().includes(search) ||
          t.profiles?.email?.toLowerCase().includes(search) ||
          t.srn?.toLowerCase().includes(search) ||
          t.rank?.toLowerCase().includes(search)
      );
    }

    if (status !== 'ALL') {
      trainees = trainees.filter((t: any) => t.enrollment_status === status || t.status === status);
    }

    return NextResponse.json({ success: true, data: trainees });
  } catch (error) {
    console.error('Failed to load trainees:', error);
    return NextResponse.json({ success: false, error: 'Failed to load trainees' }, { status: 500 });
  }
}
`
};

for (const file of files) {
  const filePath = path.join(basePath, file, 'route.ts');
  fs.writeFileSync(filePath, contents[file], 'utf8');
  console.log('Wrote', filePath);
}
