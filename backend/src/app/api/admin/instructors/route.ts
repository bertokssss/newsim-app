import { NextResponse } from 'next/server';
import { db } from '@newsim/database';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const centerId = searchParams.get('centerId') || 'ALL';

    const users = db.getUsers().filter((u) => u.role === 'INSTRUCTOR');

    let instructors = users.map((u) => {
      const center = db.getTrainingCenterById(u.assignedCenterId || 'tc-01');
      const assignedCourses = db.getCourses().filter((c) => c.instructorId === u.id);
      const upcomingSessions = db.getSchedules().filter((s) => s.instructorId === u.id);

      return {
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        phone: u.phone,
        specialization: u.specialization || 'Maritime Instruction & Simulator',
        employeeId: u.employeeId || 'INS-000',
        status: u.status,
        assignedCenterId: u.assignedCenterId,
        assignedCenterName: center?.name || 'Manila Maritime Flagship',
        activeCoursesCount: assignedCourses.length,
        upcomingSessionsCount: upcomingSessions.length,
        createdAt: u.createdAt,
      };
    });

    if (search) {
      instructors = instructors.filter(
        (i) =>
          i.firstName.toLowerCase().includes(search) ||
          i.lastName.toLowerCase().includes(search) ||
          i.email.toLowerCase().includes(search) ||
          i.specialization.toLowerCase().includes(search)
      );
    }

    if (centerId !== 'ALL') {
      instructors = instructors.filter((i) => i.assignedCenterId === centerId);
    }

    return NextResponse.json({ success: true, data: instructors });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to load instructors' }, { status: 500 });
  }
}
