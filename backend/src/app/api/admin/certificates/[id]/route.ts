import { NextResponse } from 'next/server';
import { db } from '@newsim/database';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, action } = body;

    const existing = db.getCertificateById(id);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Certificate not found' }, { status: 404 });
    }

    let updates: any = {};
    if (status) updates.status = status;
    if (action === 'REISSUE') {
      updates.reissuedCount = (existing.reissuedCount || 0) + 1;
      updates.status = 'ISSUED';
      updates.issuedAt = new Date().toISOString();
    }

    const updated = db.updateCertificate(id, updates);

    db.addAuditLog({
      actorEmail: 'admin@newsim.com',
      actorRole: 'ADMIN',
      action: action === 'REISSUE' ? 'CERTIFICATE_REISSUED' : 'CERTIFICATE_STATUS_CHANGED',
      targetType: 'CERTIFICATE',
      targetId: id,
      details: { certificateNo: existing.certificateNo, ...updates },
      ipAddress: '127.0.0.1',
      userAgent: 'NEWSIM Admin Portal',
      status: 'SUCCESS',
      severity: 'INFO',
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update certificate' }, { status: 500 });
  }
}
