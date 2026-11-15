import { NextRequest, NextResponse } from 'next/server';
import { db, TraineeRecord } from '@newsim/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const status = searchParams.get('status') || 'ALL';
    const centerId = searchParams.get('centerId') || 'ALL';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    let trainees = db.getTrainees();

    if (search) {
      trainees = trainees.filter(
        (t) =>
          t.firstName.toLowerCase().includes(search) ||
          t.lastName.toLowerCase().includes(search) ||
          t.email.toLowerCase().includes(search) ||
          t.srn.toLowerCase().includes(search) ||
          t.rank.toLowerCase().includes(search)
      );
    }

    if (status !== 'ALL') {
      trainees = trainees.filter((t) => t.status === status);
    }

    if (centerId !== 'ALL') {
      trainees = trainees.filter((t) => t.centerId === centerId);
    }

    const total = trainees.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const paginated = trainees.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      success: true,
      data: paginated,
      pagination: { total, page, limit, totalPages },
    });
  } catch (error) {
    console.error('Failed to load trainees:', error);
    return NextResponse.json({ success: false, error: 'Failed to load trainees' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firstName, lastName, email, phone, rank, vesselType, centerId } = body;

    if (!firstName || !lastName || !email) {
      return NextResponse.json({ success: false, error: 'First name, last name, and email are required' }, { status: 400 });
    }

    const center = db.getTrainingCenterById(centerId || 'tc-01');
    const newTrainee: TraineeRecord = {
      id: `trn-${Date.now()}`,
      firstName,
      lastName,
      email,
      phone: phone || '+63 917 000 0000',
      srn: `SRN-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
      rank: rank || 'Deck Cadet',
      vesselType: vesselType || 'Container Vessel',
      status: 'ACTIVE',
      centerId: center?.id || 'tc-01',
      centerName: center?.name || 'Manila Maritime Flagship',
      enrollmentsCount: 0,
      attendanceRate: '100%',
      certificatesCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.createTrainee(newTrainee);

    db.addAuditLog({
      actorEmail: 'admin@newsim.com',
      actorRole: 'ADMIN',
      action: 'TRAINEE_CREATED',
      targetType: 'TRAINEE',
      targetId: newTrainee.id,
      details: { name: `${firstName} ${lastName}`, srn: newTrainee.srn },
      ipAddress: '127.0.0.1',
      userAgent: 'NEWSIM Admin Portal',
      status: 'SUCCESS',
      severity: 'INFO',
    });

    return NextResponse.json({ success: true, trainee: newTrainee });
  } catch (error) {
    console.error('Failed to create trainee:', error);
    return NextResponse.json({ success: false, error: 'Failed to create trainee' }, { status: 500 });
  }
}
