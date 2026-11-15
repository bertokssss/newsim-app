import { NextResponse } from 'next/server';
import { db, CertificateRecord } from '@newsim/database';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const status = searchParams.get('status') || 'ALL';

    let certificates = db.getCertificates();

    if (search) {
      certificates = certificates.filter(
        (c) =>
          c.certificateNo.toLowerCase().includes(search) ||
          c.traineeName.toLowerCase().includes(search) ||
          c.courseTitle.toLowerCase().includes(search) ||
          c.qrVerificationCode.toLowerCase().includes(search)
      );
    }

    if (status !== 'ALL') {
      certificates = certificates.filter((c) => c.status === status);
    }

    return NextResponse.json({ success: true, data: certificates });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to load certificates' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { traineeId, courseId } = body;

    const trainee = db.getTraineeById(traineeId);
    const course = db.getCourseById(courseId);

    if (!trainee || !course) {
      return NextResponse.json({ success: false, error: 'Trainee and Course are required' }, { status: 400 });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 5);
    const expiryStr = expiryDate.toISOString().split('T')[0];

    const certSeq = Math.floor(100000 + Math.random() * 900000);
    const newCert: CertificateRecord = {
      id: `crt-${Date.now()}`,
      certificateNo: `NEWSIM-CERT-${new Date().getFullYear()}-${certSeq}`,
      traineeId: trainee.id,
      traineeName: `${trainee.firstName} ${trainee.lastName}`,
      traineeEmail: trainee.email,
      courseId: course.id,
      courseCode: course.code,
      courseTitle: course.title,
      issueDate: todayStr,
      expiryDate: expiryStr,
      completionDate: todayStr,
      status: 'ISSUED',
      qrVerificationCode: `V-${course.code}-${new Date().getFullYear()}-${certSeq}-PH`,
      instructorName: course.instructorName,
      centerName: course.centerName,
      issuedBy: 'admin@newsim.com',
      issuedAt: new Date().toISOString(),
      reissuedCount: 0,
    };

    db.createCertificate(newCert);

    db.addAuditLog({
      actorEmail: 'admin@newsim.com',
      actorRole: 'ADMIN',
      action: 'CERTIFICATE_ISSUED',
      targetType: 'CERTIFICATE',
      targetId: newCert.id,
      details: { certificateNo: newCert.certificateNo, trainee: newCert.traineeName, course: newCert.courseTitle },
      ipAddress: '127.0.0.1',
      userAgent: 'NEWSIM Admin Portal',
      status: 'SUCCESS',
      severity: 'INFO',
    });

    return NextResponse.json({ success: true, certificate: newCert });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to issue certificate' }, { status: 500 });
  }
}
