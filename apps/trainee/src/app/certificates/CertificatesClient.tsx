'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  CheckCircle2,
  Building2,
  QrCode,
  X,
  Search,
  MapPin,
  Printer,
  Scissors,
  CheckSquare,
  FileCheck2,
  BadgeCheck,
  Calendar,
  UserCheck,
  Ban,
  AlertTriangle,
} from 'lucide-react';
import { CardGridSkeleton, UserAvatar } from '@newsim/ui';

function buildClaimSlipPrintHtml(cert: any): string {
  const isRevoked = Boolean(cert.isRevoked) || (cert.status || '').toUpperCase() === 'REVOKED' || (cert.status || '').toUpperCase().includes('REVOKED');
  const voucherCode = `CS-${String(cert.certificateNo || '').replace('NEWSIM-CERT-', '')}`;
  const traineeName = cert.traineeName || 'Trainee Seafarer';
  const srn = cert.traineeSrn || 'Not Set';
  const courseTitle = cert.courseTitle || 'Maritime Training Course';
  const courseCode = cert.courseCode || 'STCW-MOD';
  const certNo = cert.certificateNo || 'N/A';
  const issueDate = cert.issueDate || 'N/A';
  const expiryDate = cert.expiryDate || 'N/A';
  const instructor = cert.instructorName || 'Assigned Instructor';
  const qrCode = cert.qrVerificationCode || `V-${certNo.slice(-8)}`;

  const barcodeBars = [3, 1, 2, 1, 3, 4, 1, 2, 3, 1, 4, 2, 1, 3, 2, 1, 2, 4, 1, 3, 2, 1, 3, 1, 4, 2, 1, 3, 2, 1, 4, 2, 3, 1];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Official Maritime Certificate Claim Slip - ${voucherCode}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 12mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
    body {
      background: #ffffff !important;
      color: #0f172a !important;
      padding: 6px;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .slip-container {
      width: 100%;
      max-width: 760px;
      margin: 0 auto;
      border: 2px solid #0B3D91;
      padding: 14px 18px;
      background: #ffffff;
      border-radius: 4px;
    }
    .top-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0B3D91;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .agency-sub {
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.8px;
      color: #475569;
      text-transform: uppercase;
    }
    .institution-name {
      font-size: 15px;
      font-weight: 900;
      color: #0B3D91;
      letter-spacing: 0.5px;
      margin-top: 1px;
    }
    .office-dept {
      font-size: 9.5px;
      color: #334155;
      margin-top: 1px;
      font-weight: 600;
    }
    .iso-tag {
      font-size: 8px;
      color: #64748b;
      margin-top: 1px;
    }
    .status-box {
      text-align: right;
    }
    .status-badge {
      display: inline-block;
      font-size: 8.5px;
      font-weight: 800;
      color: #065f46;
      background: #ecfdf5;
      border: 1px solid #10b981;
      padding: 2px 8px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .doc-ref {
      font-size: 8px;
      font-family: monospace;
      color: #64748b;
      margin-top: 2px;
    }
    .banner-title {
      background: #0B3D91;
      color: #ffffff;
      text-align: center;
      padding: 4px 8px;
      border-radius: 3px;
      margin-bottom: 10px;
    }
    .banner-title h1 {
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 1.5px;
      text-transform: uppercase;
    }
    .banner-title p {
      font-size: 8px;
      letter-spacing: 0.5px;
      opacity: 0.9;
      font-family: monospace;
    }

    /* PART 1: SEAFARER STUB */
    .part-box {
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 8px 10px;
      background: #f8fafc;
      margin-bottom: 10px;
    }
    .part-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 3px;
      margin-bottom: 6px;
    }
    .part-title {
      font-size: 9.5px;
      font-weight: 800;
      color: #0B3D91;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .part-hint {
      font-size: 8px;
      color: #64748b;
      font-style: italic;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      font-size: 9px;
    }
    .field-label {
      font-size: 7.5px;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 700;
      display: block;
      margin-bottom: 1px;
    }
    .field-value {
      font-size: 9.5px;
      font-weight: 700;
      color: #0f172a;
    }
    .pickup-info {
      font-size: 8px;
      color: #334155;
      margin-top: 5px;
      padding-top: 5px;
      border-top: 1px dashed #cbd5e1;
      line-height: 1.3;
    }

    /* PERFORATION LINE */
    .perforation {
      border-top: 1.5px dashed #64748b;
      position: relative;
      margin: 12px 0 10px 0;
      text-align: center;
    }
    .perforation-label {
      position: relative;
      top: -7px;
      display: inline-block;
      background: #ffffff;
      padding: 0 8px;
      font-size: 7.5px;
      font-weight: 800;
      color: #475569;
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    /* PART 2: REGISTRAR STUB */
    .barcode-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 1px solid #cbd5e1;
    }
    .barcode-bars {
      display: flex;
      align-items: flex-end;
      height: 24px;
      gap: 1.5px;
    }
    .bar {
      background: #0f172a;
    }
    .checklist-box {
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 6px 8px;
      background: #ffffff;
      margin-top: 6px;
    }
    .checklist-title {
      font-size: 8px;
      font-weight: 800;
      color: #0B3D91;
      text-transform: uppercase;
      margin-bottom: 3px;
    }
    .check-item {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 8px;
      color: #334155;
      margin-bottom: 2.5px;
    }
    .checkbox-box {
      width: 9px;
      height: 9px;
      border: 1px solid #475569;
      display: inline-block;
      flex-shrink: 0;
    }

    /* SIGNATURES & SEAL */
    .bottom-signatures {
      display: grid;
      grid-template-columns: 1fr 1fr 130px;
      gap: 10px;
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px solid #cbd5e1;
      align-items: flex-end;
    }
    .sig-block {
      text-align: center;
    }
    .sig-line {
      border-bottom: 1px solid #0f172a;
      height: 20px;
      margin-bottom: 2px;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      font-style: italic;
      font-size: 9px;
      color: #334155;
    }
    .sig-name {
      font-size: 8.5px;
      font-weight: 700;
      color: #0f172a;
    }
    .sig-title {
      font-size: 7px;
      color: #64748b;
      text-transform: uppercase;
    }
    .dry-seal-box {
      border: 1.5px dashed #0B3D91;
      height: 58px;
      border-radius: 4px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 4px;
      background: #f8fafc;
    }
    .seal-text {
      font-size: 7px;
      font-weight: 800;
      color: #0B3D91;
      text-transform: uppercase;
      line-height: 1.1;
    }
    .seal-sub {
      font-size: 6px;
      color: #64748b;
      margin-top: 1px;
    }
    .legal-notice {
      font-size: 7px;
      color: #64748b;
      text-align: center;
      margin-top: 8px;
      padding-top: 5px;
      border-top: 1px solid #e2e8f0;
      font-style: italic;
      line-height: 1.2;
    }
  </style>
</head>
<body>
  <div class="slip-container">
    <!-- Top Header -->
    <div class="top-header">
      <div>
        <div class="agency-sub">REPUBLIC OF THE PHILIPPINES • DEPARTMENT OF TRANSPORTATION</div>
        <div class="institution-name">NEWSIM MARITIME TRAINING ACADEMY</div>
        <div class="office-dept">OFFICE OF THE REGISTRAR &amp; CREDENTIALS ISSUANCE • TALISAY</div>
        <div class="iso-tag">MARINA Accreditation No: MARINA-2024-STCW-042 • ISO 9001:2015 Certified Provider</div>
      </div>
      <div class="status-box">
        <span class="status-badge" style="${isRevoked ? 'background:#fee2e2 !important;color:#991b1b !important;border:1px solid #ef4444 !important;' : ''}">${isRevoked ? '✖ REVOKED — VOID' : '★ READY FOR PHYSICAL CLAIM'}</span>
        <div class="doc-ref">DOC: NEWSIM-REG-FORM-04 (REV. 2026)</div>
        <div class="doc-ref">DATE: <strong>${issueDate}</strong></div>
      </div>
    </div>

    ${isRevoked ? `
    <div style="background:#fee2e2; border:2px dashed #dc2626; color:#991b1b; padding:10px 14px; margin-bottom:12px; border-radius:6px; text-align:center; font-weight:800; font-size:12px; letter-spacing:0.5px;">
      ⚠️ VOID: THIS MARITIME CERTIFICATE HAS BEEN REVOKED BY ADMINISTRATION. CLAIM SLIP RELEASE IS VOID &amp; PROHIBITED.
    </div>
    ` : ''}

    <!-- Banner -->
    <div class="banner-title">
      <h1>Official Certificate Claim Slip &amp; Release Stub</h1>
      <p>CLAIM VOUCHER SERIAL: ${voucherCode} • VERIFICATION CODE: ${qrCode}</p>
    </div>

    <!-- PART 1: SEAFARER CLAIMANT STUB -->
    <div class="part-box">
      <div class="part-header">
        <span class="part-title">PART I: SEAFARER CLAIMANT STUB (RETAIN THIS COPY)</span>
        <span class="part-hint">Present this stub along with your valid photo ID at the releasing counter</span>
      </div>
      <div class="grid-2">
        <div>
          <span class="field-label">Trainee / Seafarer Full Name:</span>
          <div class="field-value">${traineeName}</div>
        </div>
        <div>
          <span class="field-label">MARINA Seafarer Reg No (SRN):</span>
          <div class="field-value">${srn}</div>
        </div>
        <div>
          <span class="field-label">Training Program Completed:</span>
          <div class="field-value">${courseTitle}</div>
        </div>
        <div>
          <span class="field-label">Certificate Serial Number:</span>
          <div class="field-value">${certNo} (Valid: ${issueDate} - ${expiryDate})</div>
        </div>
      </div>
      <div class="pickup-info">
        <strong>Pick-up Releasing Counter:</strong> Registrar Office, NEWSIM Talisay Training Center, Talisay City.<br />
        <strong>Service Hours:</strong> Monday – Friday: 08:00 AM – 05:00 PM | Saturday: 08:00 AM – 12:00 NN (Philippine Standard Time).
      </div>
    </div>

    <!-- PERFORATION LINE -->
    <div class="perforation">
      <span class="perforation-label">✂ DETACH HERE — SURRENDER THIS PORTION TO REGISTRAR RELEASING WINDOW ✂</span>
    </div>

    <!-- PART 2: REGISTRAR RELEASING COPY -->
    <div class="part-box" style="background:#ffffff;border:1.5px solid #0B3D91;">
      <div class="part-header" style="border-bottom:1.5px solid #0B3D91;">
        <span class="part-title" style="color:#0B3D91;">PART II: REGISTRAR &amp; RELEASING SECTION COPY (OFFICE AUDIT RECORD)</span>
        <span class="doc-ref">SECURITY HASH: ${qrCode}</span>
      </div>

      <div class="barcode-row">
        <div>
          <div class="barcode-bars">
            ${barcodeBars.map((w, idx) => `<div class="bar" style="width:${w}px;height:${idx % 2 === 0 ? '100%' : '80%'};"></div>`).join('')}
          </div>
          <span style="font-family:monospace;font-size:7.5px;color:#334155;letter-spacing:1px;display:block;margin-top:2px;">*${voucherCode}*</span>
        </div>
        <div style="text-align:right;">
          <span class="field-label">Assigned Instructor / Assessor:</span>
          <div style="font-size:9.5px;font-weight:700;color:#0B3D91;">${instructor}</div>
          <span style="font-size:7.5px;color:#64748b;">STCW Code: <strong>${courseCode}</strong></span>
        </div>
      </div>

      <div class="grid-2">
        <div style="border:1px solid #e2e8f0;padding:6px;border-radius:3px;background:#f8fafc;">
          <span class="field-label">Seafarer Identification:</span>
          <div style="font-weight:700;font-size:10px;">${traineeName}</div>
          <div style="font-size:8px;color:#334155;margin-top:2px;">SRN: <strong>${srn}</strong></div>
          <div style="font-size:7.5px;color:#64748b;margin-top:2px;">Contact: ${cert.traineeEmail || 'Registered Seafarer Profile'}</div>
        </div>
        <div style="border:1px solid #e2e8f0;padding:6px;border-radius:3px;background:#f8fafc;">
          <span class="field-label">Certificate Particulars:</span>
          <div style="font-weight:700;font-size:10px;color:#0B3D91;">${certNo}</div>
          <div style="font-size:8px;color:#334155;margin-top:2px;">Course: ${courseTitle}</div>
          <div style="font-size:7.5px;color:#64748b;margin-top:2px;">Issued: ${issueDate} | Validity: 5 Years</div>
        </div>
      </div>

      <!-- Checklist -->
      <div class="checklist-box">
        <div class="checklist-title">Mandatory Requirements Verification Checklist (Releasing Officer use):</div>
        <div class="check-item">
          <div class="checkbox-box"></div>
          <span>Original Seaman's Book (SIRB) or Government Photo ID (PRC / Passport / UMID) presented and verified</span>
        </div>
        <div class="check-item">
          <div class="checkbox-box"></div>
          <span>MARINA Seafarer Registration Number (SRN) Verification Document / QR confirmed</span>
        </div>
        <div class="check-item">
          <div class="checkbox-box"></div>
          <span>Completed Training Attendance, Theoretical Modules &amp; Simulator Assessment Clearance logged</span>
        </div>
        <div class="check-item">
          <div class="checkbox-box"></div>
          <span>Official Tuition / Assessment Fee Payment recorded as Settled (Official Receipt verified)</span>
        </div>
        <div class="check-item">
          <div class="checkbox-box"></div>
          <span>Special Power of Attorney (SPA) / Authorization Letter &amp; Representative Valid ID (if proxy claim)</span>
        </div>
      </div>

      <!-- Signatures -->
      <div class="bottom-signatures">
        <div class="sig-block">
          <div class="sig-line">${traineeName}</div>
          <div class="sig-name">Trainee Claimant Signature &amp; Date</div>
          <div class="sig-title">Acknowledged receipt of original certificate</div>
        </div>

        <div class="sig-block">
          <div class="sig-line"></div>
          <div class="sig-name">Authorized Releasing Officer</div>
          <div class="sig-title">Office of the Registrar / Credentials Division</div>
        </div>

        <div class="dry-seal-box">
          <div class="seal-text">AFFIX REGISTRAR DRY EMBOSSED SEAL HERE</div>
          <div class="seal-sub">(Invalid Without Official Seal)</div>
        </div>
      </div>
    </div>

    <!-- Statutory Notice -->
    <div class="legal-notice">
      IMPORTANT NOTICE: This certificate claim stub is an official document issued under MARINA STCW regulations. Physical certificate issuance requires in-person verification and an authentic dry embossed seal. Tampering with or forging this document constitutes a punishable offense under Republic Act No. 10635.
    </div>
  </div>
</body>
</html>`;
}

export default function CertificatesClient() {
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCert, setSelectedCert] = useState<any | null>(null);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyResult, setVerifyResult] = useState<any | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const fetchCertificates = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/trainee/certificates');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setCertificates(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCertificates();
  }, []);

  const handleMarkClaimed = async (certId: string) => {
    if (!confirm('Mark this certificate as claimed? This will officially record the certificate as claimed and received.')) return;
    try {
      setClaimingId(certId);
      const res = await fetch('/api/trainee/certificates/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ certificateId: certId }),
      });
      const json = await res.json();
      if (json.success) {
        setCertificates((prev) =>
          prev.map((c) =>
            c.id === certId
              ? {
                  ...c,
                  status: 'CLAIMED',
                  isClaimed: true,
                  isReadyForClaim: false,
                  claimed_at: new Date().toISOString(),
                }
              : c
          )
        );
        if (selectedCert?.id === certId) {
          setSelectedCert((prev: any) =>
            prev
              ? {
                  ...prev,
                  status: 'CLAIMED',
                  isClaimed: true,
                  isReadyForClaim: false,
                  claimed_at: new Date().toISOString(),
                }
              : null
          );
        }
      } else {
        alert(json.error || 'Failed to mark certificate as claimed.');
      }
    } catch (err) {
      console.error('Error claiming certificate:', err);
      alert('Network error while claiming certificate.');
    } finally {
      setClaimingId(null);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyCode.trim()) return;

    try {
      setVerifying(true);
      const res = await fetch(`/api/trainee/certificates/verify?code=${encodeURIComponent(verifyCode)}`);
      const json = await res.json();
      if (json.success) {
        setVerifyResult(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setVerifying(false);
    }
  };

  const handlePrintSlip = () => {
    if (!selectedCert) return;
    if (selectedCert.isRevoked || (selectedCert.status || '').toUpperCase().includes('REVOKED')) {
      alert('This certificate is revoked. Claim slip issuance is void.');
      return;
    }

    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow?.document;
    if (!frameDoc) {
      window.print();
      return;
    }

    frameDoc.open();
    frameDoc.write(buildClaimSlipPrintHtml(selectedCert));
    frameDoc.close();

    setTimeout(() => {
      try {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
      } catch (err) {
        console.error('Frame print failed, falling back to window.print', err);
        window.print();
      } finally {
        setTimeout(() => {
          printFrame.remove();
        }, 1500);
      }
    }, 250);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-slate-200/80 dark:border-slate-800">
              STCW Credentials &amp; Credentials Vault
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-heading">
            Earned Certificates &amp; Credentials
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-[#CBD5E1] font-sans mt-0.5">
            Official maritime certification issued in compliance with STCW 2010 Manila Amendments.
          </p>
        </div>

        <button
          onClick={() => {
            setVerifyCode('');
            setVerifyResult(null);
            setVerifyModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 hover:border-sky-500/40 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-all self-start sm:self-auto shadow-xs"
        >
          <Search className="w-4 h-4 text-sky-500" />
          <span>Verify Certificate ID</span>
        </button>
      </div>

      {/* Qualification Notice */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex items-center gap-3 text-xs">
        <ShieldCheck className="w-5 h-5 text-sky-500 shrink-0" />
        <p className="text-slate-600 dark:text-[#CBD5E1] font-sans leading-relaxed">
          <strong>NEWSIM Certification Standard:</strong> Complete all required online modules and assessments within your 3-day modular window. <strong>Modular / In-House</strong> courses issue certificates once academic records are validated; <strong>Modular + Practical</strong> courses also require practical evaluation competency before certificate release.
        </p>
      </div>

      {/* Certificates Grid */}
      {loading ? (
        <CardGridSkeleton numCards={3} showHeader={false} />
      ) : certificates.length === 0 ? (
        <div className="py-16 text-center rounded-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 p-8 space-y-3">
          <ShieldCheck className="w-8 h-8 text-sky-500 mx-auto" />
          <p className="text-sm font-bold text-slate-800 dark:text-[#CBD5E1]">No certificates earned yet.</p>
          <p className="text-xs text-slate-600 dark:text-[#94A3B8] font-mono">Complete all required modules, pass assessments, and finish any required practical evaluation to earn certification.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {certificates.map((cert) => {
            const isRevoked = Boolean(cert.isRevoked) || (cert.status || '').toUpperCase() === 'REVOKED' || (cert.status || '').toUpperCase().includes('REVOKED');
            const isPendingPractical = !isRevoked && (cert.status?.includes('PENDING PRACTICAL') || cert.isPracticalCompetent === false);
            const isWithheld = !isRevoked && (cert.isWithheld || cert.status?.includes('WITHHELD'));
            const isClaimed = !isRevoked && (cert.status === 'CLAIMED' || cert.status?.includes('CLAIMED'));

            return (
            <div
              key={cert.id}
              className={`relative rounded-3xl bg-white dark:bg-[#0c1a2c] shadow-sm flex flex-col justify-between overflow-hidden group transition-all ${
                isRevoked
                  ? 'border-2 border-red-500/80 dark:border-red-600/80 bg-red-500/[0.03] dark:bg-red-950/20 shadow-red-500/10'
                  : 'border border-slate-200/80 dark:border-slate-800 hover:border-sky-500/40'
              }`}
            >
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className={`font-mono font-bold text-xs ${isRevoked ? 'text-red-500 dark:text-red-400' : 'text-sky-500 dark:text-sky-400'}`}>
                    {cert.certificateNo}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                      isRevoked
                        ? 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30 font-extrabold'
                        : isPendingPractical
                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
                        : isWithheld
                        ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30'
                        : isClaimed
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                        : 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20'
                    }`}
                  >
                    {isRevoked ? 'REVOKED' : cert.status}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
                    {cert.courseTitle}
                  </h3>
                  <span className="text-[11px] font-mono text-slate-400 block mt-1">
                    STCW Code: {cert.courseCode}
                  </span>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-200/80 dark:border-slate-800 text-[11px] font-mono text-slate-600 dark:text-[#CBD5E1]">
                  <div className="flex justify-between">
                    <span>Issued Date:</span>
                    <span className="font-bold text-slate-900 dark:text-[#F8FAFC]">{cert.issueDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Expiry Date:</span>
                    <span>{cert.expiryDate} (5 Years)</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span>Instructor:</span>
                    <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
                      <UserAvatar
                        src={cert.instructorAvatarUrl}
                        name={cert.instructorName}
                        alt={cert.instructorName || 'Instructor'}
                        className="w-5 h-5 rounded-md"
                        fallbackClassName="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold"
                      />
                      <span>{cert.instructorName}</span>
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Practical Status:</span>
                    <span className={cert.isPracticalCompetent ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-amber-500 font-bold'}>
                      {cert.isPracticalCompetent ? '✓ Competent' : 'Pending Evaluation'}
                    </span>
                  </div>
                </div>

                {isRevoked && (
                  <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-[11px] font-mono text-red-700 dark:text-red-300 flex items-start gap-2">
                    <Ban className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">Certificate Revoked</strong>
                      <span>Official credentials revoked. Claim slip issuance is void and physical release is suspended.</span>
                    </div>
                  </div>
                )}

                {isPendingPractical && (
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-[11px] font-mono text-amber-700 dark:text-amber-300">
                    ★ Undergo scheduled practical simulator drill to qualify for claim release.
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    setVerifyCode(cert.certificateNo || '');
                    setVerifyResult(null);
                    setVerifyModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-800 dark:text-[#CBD5E1] hover:bg-sky-500/10 dark:hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5 text-sky-500" />
                  <span>Verify ID</span>
                </button>

                {isClaimed ? (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 text-xs font-bold font-mono">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Claimed</span>
                    </span>
                    <button
                      onClick={() => setSelectedCert(cert)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold transition-all cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Slip</span>
                    </button>
                  </div>
                ) : isRevoked ? (
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    title="Certificate is revoked. Claim slip is void and cannot be issued."
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-600 dark:bg-red-600 text-white font-bold text-xs shadow-sm cursor-not-allowed select-none opacity-90 disabled:opacity-90"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Claim Slip</span>
                    <span className="text-[10px] font-mono font-normal opacity-90">(Revoked)</span>
                  </button>
                ) : isPendingPractical ? (
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-[10px] font-mono font-bold"
                    title="Undergo practical simulator evaluation to qualify for claim slip issuance"
                  >
                    <span>Practical Evaluation Required</span>
                  </span>
                ) : isWithheld ? (
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 text-[10px] font-mono font-bold"
                    title="Certificate withheld due to academic or attendance requirements"
                  >
                    <span>Withheld: Requirements Pending</span>
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleMarkClaimed(cert.id)}
                      disabled={claimingId === cert.id}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer disabled:opacity-50"
                      title="Mark certificate as claimed"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{claimingId === cert.id ? 'Claiming...' : 'Mark Claimed'}</span>
                    </button>
                    <button
                      onClick={() => setSelectedCert(cert)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 hover:opacity-95 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Claim Slip</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Official Printable Maritime Certificate Claim Slip Modal */}
      <AnimatePresence>
        {selectedCert && (() => {
          const isSelectedCertRevoked = Boolean(selectedCert.isRevoked) || (selectedCert.status || '').toUpperCase().includes('REVOKED');
          const isSelectedCertClaimed = !isSelectedCertRevoked && (Boolean(selectedCert.isClaimed) || (selectedCert.status || '').toUpperCase().includes('CLAIMED'));
          return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCert(null)}
              className="fixed inset-0 bg-black/75 backdrop-blur-sm print:hidden"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-3xl bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[94vh] print:max-h-none print:shadow-none print:border-none print:static print:w-full print:p-0"
            >
              {/* Top Accent Bar */}
              <div className={`h-1.5 w-full shrink-0 print:hidden ${isSelectedCertRevoked ? 'bg-red-600' : isSelectedCertClaimed ? 'bg-emerald-500' : 'bg-sky-500'}`} />

              {/* Action Toolbar Header (Single Close Button - Duplicate Print Button Removed) */}
              <div className="px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/90 dark:bg-slate-900/60 print:hidden">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-sky-500" />
                  <span className="font-mono text-xs font-bold text-slate-800 dark:text-[#CBD5E1]">
                    Official Maritime Certificate Claim &amp; Release Slip
                  </span>
                  {isSelectedCertRevoked ? (
                    <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-mono bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30 font-extrabold">
                      REVOKED — VOID
                    </span>
                  ) : isSelectedCertClaimed ? (
                    <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-bold">
                      CLAIMED &amp; RELEASED
                    </span>
                  ) : (
                    <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold">
                      READY FOR CLAIM
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setSelectedCert(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer transition-colors"
                  title="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Authentic Physical Claim Slip Document Body */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-4 bg-slate-100/70 dark:bg-slate-900/60 text-slate-900 print:p-0 print:bg-white">
                <div
                  id="printable-claim-slip"
                  className="bg-white border-2 border-[#0B3D91] rounded-2xl shadow-sm p-6 sm:p-8 space-y-5 text-slate-900 print:border-2 print:border-[#0B3D91] print:shadow-none print:rounded-none"
                >
                  {/* Top Accreditation & Institutional Header */}
                  <div className="border-b-2 border-[#0B3D91] pb-3 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="font-mono text-[9px] tracking-wider text-slate-500 uppercase font-bold block">
                        REPUBLIC OF THE PHILIPPINES • DEPARTMENT OF TRANSPORTATION
                      </span>
                      <h2 className="text-lg sm:text-xl font-serif font-black text-[#0B3D91] tracking-tight">
                        NEWSIM MARITIME TRAINING ACADEMY
                      </h2>
                      <p className="text-[11px] font-mono font-medium text-slate-700">
                        OFFICE OF THE REGISTRAR &amp; CREDENTIALS ISSUANCE • TALISAY CAMPUS
                      </p>
                      <p className="text-[9px] font-mono text-slate-500">
                        MARINA Accreditation No: MARINA-2024-STCW-042 • ISO 9001:2015 Certified
                      </p>
                    </div>
                    <div className="text-left sm:text-right shrink-0">
                      {isSelectedCertRevoked ? (
                        <span className="inline-block px-2.5 py-1 rounded border border-red-600 bg-red-50 text-red-800 text-[11px] font-mono font-bold">
                          ✖ REVOKED / CLAIM VOID
                        </span>
                      ) : (
                        <span className="inline-block px-2.5 py-1 rounded border border-emerald-600 bg-emerald-50 text-emerald-800 text-[11px] font-mono font-bold">
                          ★ READY FOR PHYSICAL CLAIM
                        </span>
                      )}
                      <div className="text-[10px] font-mono text-slate-500 mt-1">
                        Form: <strong className="text-slate-700">NEWSIM-REG-FORM-04</strong>
                      </div>
                      <div className="text-[10px] font-mono text-slate-500">
                        Date: <strong className="text-slate-900">{selectedCert.issueDate}</strong>
                      </div>
                    </div>
                  </div>

                  {isSelectedCertRevoked && (
                    <div className="p-3 rounded-xl bg-red-50 border-2 border-dashed border-red-500 text-red-800 text-xs font-mono font-bold text-center">
                      ⚠️ WARNING: THIS MARITIME CERTIFICATE HAS BEEN REVOKED BY ADMINISTRATION. CLAIM SLIP RELEASE IS VOID &amp; PROHIBITED.
                    </div>
                  )}

                  {/* Banner Ribbon */}
                  <div className="text-center py-2 bg-[#0B3D91] text-white rounded-lg shadow-xs">
                    <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest font-heading">
                      OFFICIAL CERTIFICATE CLAIM SLIP &amp; RELEASE STUB
                    </h3>
                    <p className="text-[10px] font-mono text-blue-100 mt-0.5">
                      VOUCHER SERIAL: <span className="font-bold text-white">CS-{String(selectedCert.certificateNo || '').replace('NEWSIM-CERT-', '')}</span> • VERIFICATION: <span className="font-bold text-white">{selectedCert.qrVerificationCode}</span>
                    </p>
                  </div>

                  {/* SECTION 1: SEAFARER CLAIMANT COPY */}
                  <div className="p-4 rounded-xl border border-slate-300 bg-slate-50 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                      <span className="font-mono font-bold text-[11px] text-[#0B3D91] uppercase tracking-wider flex items-center gap-1.5">
                        <FileCheck2 className="w-3.5 h-3.5" />
                        <span>PART I: SEAFARER CLAIMANT STUB (RETAIN THIS COPY)</span>
                      </span>
                      <span className="text-[10px] italic text-slate-500 font-sans">
                        Present this stub &amp; valid photo ID at releasing counter
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar
                          src={selectedCert.traineeAvatarUrl}
                          name={selectedCert.traineeName || 'Trainee Seafarer'}
                          alt={selectedCert.traineeName || 'Trainee Seafarer'}
                          className="w-8 h-8 rounded-lg border border-slate-200"
                          fallbackClassName="bg-[#0B3D91]/10 text-[#0B3D91] text-[10px] font-bold"
                        />
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase font-mono font-bold">Trainee / Seafarer Name:</span>
                          <strong className="text-slate-900 text-sm font-heading">{selectedCert.traineeName || 'Trainee Seafarer'}</strong>
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-mono font-bold">MARINA Seafarer Reg No (SRN):</span>
                        <strong className="text-slate-900 font-mono text-xs">{selectedCert.traineeSrn || 'Not Set'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-mono font-bold">Course Completed:</span>
                        <strong className="text-slate-900 font-heading text-xs">{selectedCert.courseTitle}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-mono font-bold">Certificate Number:</span>
                        <span className="font-mono font-bold text-blue-900 text-xs">{selectedCert.certificateNo} (Valid: {selectedCert.issueDate} - {selectedCert.expiryDate})</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-dashed border-slate-300 text-[10px] text-slate-600 font-mono flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#0B3D91] shrink-0 mt-0.5" />
                      <span>
                        <strong>Releasing Station:</strong> Registrar Office, NEWSIM Talisay Training Center, Talisay City | <strong>Hours:</strong> Mon-Fri 8:00 AM - 5:00 PM, Sat 8:00 AM - 12:00 NN
                      </span>
                    </div>
                  </div>

                  {/* PERFORATION DIVIDER LINE */}
                  <div className="relative py-2 text-center">
                    <div className="border-t-2 border-dashed border-slate-400 absolute top-1/2 left-0 right-0 -translate-y-1/2" />
                    <span className="relative z-10 bg-white px-3 text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest inline-flex items-center gap-1.5">
                      <Scissors className="w-3.5 h-3.5 text-slate-400" />
                      <span>DETACH HERE • SURRENDER TO REGISTRAR RELEASING WINDOW • DETACH HERE</span>
                    </span>
                  </div>

                  {/* SECTION 2: REGISTRAR RELEASING & AUDIT COPY */}
                  <div className="p-4 sm:p-5 rounded-xl border-2 border-[#0B3D91] bg-white space-y-3">
                    <div className="flex items-center justify-between border-b-2 border-[#0B3D91] pb-2">
                      <span className="font-mono font-bold text-[11px] text-[#0B3D91] uppercase tracking-wider">
                        PART II: REGISTRAR &amp; RELEASING SECTION COPY (OFFICIAL AUDIT RECORD)
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">
                        SECURITY HASH: <strong className="text-slate-900">{selectedCert.qrVerificationCode}</strong>
                      </span>
                    </div>

                    {/* Barcode representation & Assessor */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-slate-200">
                      <div className="flex flex-col items-center sm:items-start">
                        <div className="flex items-end h-7 gap-[2px]">
                          {[3, 1, 2, 1, 3, 4, 1, 2, 3, 1, 4, 2, 1, 3, 2, 1, 2, 4, 1, 3, 2, 1, 3, 1, 4, 2, 1, 3, 2, 1, 4, 2, 3, 1].map((w, i) => (
                            <div key={i} className="bg-slate-900" style={{ width: `${w}px`, height: i % 2 === 0 ? '100%' : '80%' }} />
                          ))}
                        </div>
                        <span className="font-mono text-[9px] font-bold text-slate-700 tracking-widest mt-0.5">
                          *CS-{String(selectedCert.certificateNo || '').replace('NEWSIM-CERT-', '')}*
                        </span>
                      </div>

                      <div className="text-center sm:text-right text-xs">
                        <span className="text-slate-500 block text-[10px] font-mono">Assigned Instructor / Assessor:</span>
                        <div className="inline-flex items-center justify-center sm:justify-end gap-1.5 mt-0.5">
                          <UserAvatar
                            src={selectedCert.instructorAvatarUrl}
                            name={selectedCert.instructorName}
                            alt={selectedCert.instructorName || 'Instructor'}
                            className="w-5 h-5 rounded-md border border-slate-200"
                            fallbackClassName="bg-[#0B3D91]/10 text-[#0B3D91] text-[9px] font-bold"
                          />
                          <strong className="text-[#0B3D91] font-mono text-xs">{selectedCert.instructorName}</strong>
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">STCW Code: <strong>{selectedCert.courseCode}</strong></div>
                      </div>
                    </div>

                    {/* Trainee Particulars */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1">
                        <div className="text-[10px] font-mono font-bold text-slate-400 uppercase">Seafarer Identification</div>
                        <div className="flex items-center gap-2">
                          <UserAvatar
                            src={selectedCert.traineeAvatarUrl}
                            name={selectedCert.traineeName || 'Trainee Seafarer'}
                            alt={selectedCert.traineeName || 'Trainee Seafarer'}
                            className="w-7 h-7 rounded-lg border border-slate-200"
                            fallbackClassName="bg-[#0B3D91]/10 text-[#0B3D91] text-[10px] font-bold"
                          />
                          <div className="font-bold text-slate-900 text-sm font-heading">{selectedCert.traineeName || 'Trainee Seafarer'}</div>
                        </div>
                        <div className="text-[11px] font-mono text-slate-700">SRN: <strong>{selectedCert.traineeSrn || 'Not Set'}</strong></div>
                        <div className="text-[10px] font-mono text-slate-500">Email: {selectedCert.traineeEmail || 'Registered Seafarer Profile'}</div>
                      </div>

                      <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1">
                        <div className="text-[10px] font-mono font-bold text-slate-400 uppercase">Certificate Particulars</div>
                        <div className="font-bold text-[#0B3D91] font-mono text-xs">{selectedCert.certificateNo}</div>
                        <div className="text-[11px] font-sans text-slate-800">{selectedCert.courseTitle}</div>
                        <div className="text-[10px] font-mono text-slate-500">Issued: {selectedCert.issueDate} • Validity: 5 Years</div>
                      </div>
                    </div>

                    {/* Checklist */}
                    <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1.5 text-xs">
                      <div className="font-mono font-bold text-[10px] text-[#0B3D91] uppercase">
                        Mandatory Requirements Verification Checklist (Releasing Officer use):
                      </div>
                      <div className="space-y-1 font-sans text-[11px] text-slate-700">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 border border-slate-500 rounded-[2px]" />
                          <span>Original Seaman&apos;s Book (SIRB) or Government Photo ID (PRC / Passport / UMID) presented and verified</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 border border-slate-500 rounded-[2px]" />
                          <span>MARINA Seafarer Registration Number (SRN) Verification Document / QR confirmed</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 border border-slate-500 rounded-[2px]" />
                          <span>Completed Training Attendance, Theoretical Modules &amp; Simulator Assessment Clearance logged</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 border border-slate-500 rounded-[2px]" />
                          <span>Official Tuition / Assessment Fee Payment recorded as Settled (Official Receipt verified)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 border border-slate-500 rounded-[2px]" />
                          <span>Special Power of Attorney (SPA) / Authorization Letter &amp; Representative Valid ID (if proxy claim)</span>
                        </div>
                      </div>
                    </div>

                    {/* Signatures & Seal Grid */}
                    <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                      <div className="space-y-1 text-center">
                        <div className="h-10 border-b border-slate-800 flex items-end justify-center pb-1">
                          <span className="font-serif italic text-xs text-slate-800">{selectedCert.traineeName || 'Trainee Seafarer'}</span>
                        </div>
                        <div className="text-[10px] font-bold text-slate-800">Trainee Claimant Signature &amp; Date</div>
                        <div className="text-[9px] font-mono text-slate-400">Acknowledged receipt of original certificate</div>
                      </div>

                      <div className="space-y-1 text-center">
                        <div className="h-10 border-b border-slate-800 flex items-end justify-center pb-1">
                          <span className="font-mono text-[10px] text-slate-400 italic">Signature over printed name</span>
                        </div>
                        <div className="text-[10px] font-bold text-slate-800">Authorized Releasing Officer</div>
                        <div className="text-[9px] font-mono text-slate-400">Office of the Registrar / Credentials Division</div>
                      </div>

                      <div className="p-2 border-2 border-dashed border-[#0B3D91] rounded-lg bg-slate-50 text-center flex flex-col items-center justify-center min-h-[58px]">
                        <span className="font-mono font-bold text-[8px] text-[#0B3D91] uppercase leading-tight">
                          AFFIX REGISTRAR DRY EMBOSSED SEAL HERE
                        </span>
                        <span className="text-[7px] font-mono text-slate-400 mt-0.5">(Invalid Without Official Seal)</span>
                      </div>
                    </div>
                  </div>

                  {/* Statutory Notice */}
                  <div className="text-center pt-2 border-t border-slate-200">
                    <p className="text-[9px] font-mono text-slate-400 leading-relaxed">
                      IMPORTANT NOTICE: This certificate claim stub is an official document issued under MARINA STCW regulations. Physical certificate issuance requires in-person verification and an authentic dry embossed seal. Tampering with or forging this document constitutes a punishable offense under Republic Act No. 10635.
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom Footer Actions (Single Print Claim Slip Button - Clean & Non-redundant) */}
              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 print:hidden">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300">
                    {selectedCert.certificateNo}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {isSelectedCertRevoked ? '• Claim Slip Void (Revoked)' : isSelectedCertClaimed ? '• Claimed & Released' : '• Ready for In-Person Releasing'}
                  </span>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  <button
                    onClick={() => setSelectedCert(null)}
                    className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                  {isSelectedCertRevoked ? (
                    <button
                      type="button"
                      disabled
                      aria-disabled="true"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 text-white font-bold text-xs shadow-none cursor-not-allowed opacity-90 select-none"
                    >
                      <Ban className="w-4 h-4" />
                      <span>Claim Slip Revoked</span>
                    </button>
                  ) : (
                    <>
                      {!isSelectedCertClaimed && (
                        <button
                          onClick={() => handleMarkClaimed(selectedCert.id)}
                          disabled={claimingId === selectedCert.id}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{claimingId === selectedCert.id ? 'Claiming...' : 'Mark Certificate Claimed'}</span>
                        </button>
                      )}
                      {isSelectedCertClaimed && (
                        <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold font-mono">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          <span>✓ Certificate Claimed</span>
                        </span>
                      )}
                      <button
                        onClick={handlePrintSlip}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 hover:opacity-95 text-white font-bold text-xs shadow-md shadow-sky-500/20 transition-all cursor-pointer"
                      >
                        <Printer className="w-4 h-4" />
                        <span>Print Claim Slip</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
          );
        })()}
      </AnimatePresence>

      {/* Verify Certificate ID Modal */}
      <AnimatePresence>
        {verifyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setVerifyModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md bg-white dark:bg-[#0c1a2c] border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden z-10"
            >
              <div className="h-1 bg-sky-500 w-full" />

              <form onSubmit={handleVerify}>
                <div className="p-6 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-[#F8FAFC] font-heading">
                    Verify Certificate Authenticity
                  </h3>
                  <button
                    type="button"
                    onClick={() => setVerifyModalOpen(false)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-4 text-xs">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-900 dark:text-[#F8FAFC] font-heading uppercase text-[10px]">
                      Certificate Number or QR Code
                    </label>
                    <input
                      type="text"
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value)}
                      placeholder="e.g. NEWSIM-CERT-2026-000124"
                      required
                      className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-black dark:text-[#F8FAFC] font-mono placeholder:text-slate-400 outline-none focus:border-sky-500"
                    />
                  </div>

                  {verifyResult && (
                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 space-y-2 animate-in zoom-in-95 duration-150">
                      <div className="flex items-center gap-2 font-bold font-mono">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span>AUTHENTIC IMO CREDENTIAL</span>
                      </div>
                      <div className="text-xs font-sans text-slate-800 dark:text-slate-200">
                        <div><strong>Bearer:</strong> {verifyResult.certificate?.traineeName}</div>
                        <div><strong>Course:</strong> {verifyResult.certificate?.courseTitle}</div>
                        <div><strong>Status:</strong> {verifyResult.certificate?.status} (Valid)</div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setVerifyModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 dark:text-[#CBD5E1] text-xs font-semibold cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={verifying || !verifyCode.trim()}
                    className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 hover:opacity-95 text-white font-bold text-xs shadow-md shadow-sky-500/20 disabled:opacity-40 cursor-pointer"
                  >
                    {verifying ? 'Verifying...' : 'Validate Code'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
