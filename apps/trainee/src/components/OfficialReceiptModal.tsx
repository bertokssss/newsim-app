'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Printer,
  ShieldCheck,
  Clock,
  Building2,
  User,
  CreditCard,
  Calendar,
  CheckCircle2,
  FileText,
  Receipt,
  Award,
} from 'lucide-react';

export interface OfficialReceiptData {
  receiptNo: string;
  referenceNumber?: string;
  paymongoCheckoutId?: string;
  paymongoPaymentId?: string;
  amount: number;
  paymentMethod: string;
  environment?: string;
  status: string;
  paidAt?: string;
  verifiedAt?: string;
  isApproved?: boolean;
  trainee: {
    fullName: string;
    email?: string;
    phone?: string;
    srn: string;
    traineeNumber?: string;
    address?: string;
    nationality?: string;
  };
  course: {
    title: string;
    code: string;
    batchCode: string;
    startDate?: string;
    endDate?: string;
    centerName?: string;
  };
  notice?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  receipt: OfficialReceiptData | null;
}

function amountInWords(num: number): string {
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(n: number): string {
    if (n === 0) return 'Zero';
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + inWords(n % 100) : '');
    if (n < 1000000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + inWords(n % 1000) : '');
    if (n < 1000000000) return inWords(Math.floor(n / 1000000)) + ' Million' + (n % 1000000 !== 0 ? ' ' + inWords(n % 1000000) : '');
    return String(n);
  }

  const whole = Math.floor(num);
  const cents = Math.round((num - whole) * 100);
  let res = inWords(whole) + ' Pesos';
  if (cents > 0) {
    res += ' and ' + inWords(cents) + ' Centavos';
  } else {
    res += ' Only';
  }
  return res.toUpperCase();
}

export default function OfficialReceiptModal({ isOpen, onClose, receipt }: Props) {
  if (!isOpen || !receipt) return null;

  const isApproved = Boolean(
    receipt.isApproved ||
    receipt.verifiedAt ||
    (receipt.status || '').toUpperCase() === 'VERIFIED'
  );
  const isTestMode = (receipt.environment || 'TEST').toUpperCase() === 'TEST';
  const formattedDate = receipt.paidAt
    ? new Date(receipt.paidAt).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

  const formattedDateOnly = receipt.paidAt
    ? new Date(receipt.paidAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const wordsAmount = amountInWords(receipt.amount);

  const handlePrint = () => {
    // Generate clean printable document in an isolated frame to ensure 100% layout perfection
    const printArea = document.getElementById('official-receipt-print-area');
    if (!printArea) {
      window.print();
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
    frameDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Official Receipt - ${receipt.receiptNo}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm 15mm;
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
              padding: 10px;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .receipt-sheet {
              width: 100%;
              max-width: 800px;
              margin: 0 auto;
              border: 3px double #0B3D91;
              padding: 24px;
              border-radius: 8px;
              background: #ffffff;
            }
            .header-table {
              width: 100%;
              border-bottom: 2px solid #0B3D91;
              padding-bottom: 14px;
              margin-bottom: 14px;
            }
            .institution-title {
              font-size: 16px;
              font-weight: 900;
              color: #0B3D91;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .institution-sub {
              font-size: 10px;
              color: #475569;
              margin-top: 2px;
            }
            .receipt-no-box {
              text-align: right;
            }
            .receipt-badge {
              display: inline-block;
              font-size: 11px;
              font-weight: 800;
              color: #0B3D91;
              background: #E8F6FF;
              border: 1px solid #3BA7F2;
              padding: 2px 10px;
              border-radius: 4px;
              text-transform: uppercase;
            }
            .receipt-number {
              font-size: 16px;
              font-weight: 800;
              color: #0B3D91;
              font-family: monospace;
              margin-top: 4px;
            }
            .status-banner {
              background: #FFFBEB;
              border: 1px solid #F59E0B;
              border-left: 4px solid #D97706;
              padding: 8px 12px;
              border-radius: 6px;
              margin-bottom: 14px;
              font-size: 11px;
            }
            .status-banner strong {
              color: #92400E;
              display: block;
              margin-bottom: 2px;
            }
            .status-banner span {
              color: #78350F;
            }
            .section-grid {
              display: flex;
              gap: 12px;
              margin-bottom: 14px;
            }
            .section-col {
              flex: 1;
              border: 1px solid #cbd5e1;
              border-radius: 6px;
              padding: 10px;
              background: #f8fafc;
            }
            .col-title {
              font-size: 10px;
              font-weight: 800;
              color: #0B3D91;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 4px;
              margin-bottom: 6px;
            }
            .data-row {
              display: flex;
              justify-content: space-between;
              font-size: 10px;
              margin-bottom: 4px;
            }
            .data-label {
              color: #64748b;
            }
            .data-value {
              font-weight: 700;
              color: #0f172a;
              text-align: right;
            }
            .srn-highlight {
              background: #ecfdf5;
              border: 1px solid #10b981;
              color: #047857;
              padding: 2px 6px;
              border-radius: 4px;
              font-weight: 900;
              font-family: monospace;
            }
            .billing-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 14px;
              font-size: 10px;
            }
            .billing-table th {
              background: #0B3D91;
              color: #ffffff;
              padding: 6px 8px;
              text-align: left;
              font-weight: 700;
              text-transform: uppercase;
            }
            .billing-table td {
              padding: 8px;
              border: 1px solid #e2e8f0;
              color: #1e293b;
            }
            .total-row {
              background: #f8fafc;
              font-weight: 800;
              font-size: 11px;
            }
            .words-box {
              border: 1px solid #e2e8f0;
              background: #f8fafc;
              padding: 8px 12px;
              border-radius: 6px;
              margin-bottom: 14px;
              font-size: 10px;
            }
            .words-label {
              color: #64748b;
              text-transform: uppercase;
              font-size: 9px;
              font-weight: 700;
              margin-bottom: 2px;
            }
            .words-value {
              font-weight: 800;
              color: #0B3D91;
              font-style: italic;
            }
            .footer-signatures {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              margin-top: 20px;
              padding-top: 12px;
              border-top: 1px dashed #cbd5e1;
            }
            .cert-notice {
              font-size: 9px;
              color: #64748b;
              max-width: 320px;
              line-height: 1.3;
            }
            .stamp-box {
              border: 2px dashed #059669;
              padding: 6px 12px;
              border-radius: 6px;
              text-align: center;
              color: #059669;
              font-size: 9px;
              font-weight: 800;
              letter-spacing: 0.5px;
            }
            .signature-box {
              text-align: right;
              width: 220px;
            }
            .signature-line {
              border-bottom: 1px solid #0f172a;
              margin-bottom: 4px;
            }
            .signature-name {
              font-size: 10px;
              font-weight: 800;
              color: #0B3D91;
            }
            .signature-sub {
              font-size: 8px;
              color: #64748b;
            }
          </style>
        </head>
        <body>
          <div class="receipt-sheet">
            <!-- Header Table -->
            <table class="header-table" cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align: top;">
                  <div class="institution-title">NEW SIMULATOR TRAINING CENTER OF THE PHILIPPINES, INC.</div>
                  <div class="institution-sub"><strong>NEWSIM Maritime Training Center</strong> • MARINA Accredited Maritime Academy</div>
                  <div class="institution-sub">STCW 1978 as Amended (Manila 2010) Standard of Training, Certification &amp; Watchkeeping</div>
                  <div class="institution-sub">NEWSIM Talisay Training Center, Talisay City, Philippines • Tel: 09398005951</div>
                  <div class="institution-sub">Non-VAT Reg. TIN: 204-589-112-000</div>
                </td>
                <td style="vertical-align: top; width: 220px;" class="receipt-no-box">
                  <div class="receipt-badge">Official Receipt</div>
                  <div class="receipt-number">${receipt.receiptNo}</div>
                  <div class="institution-sub">Date: <strong>${formattedDateOnly}</strong></div>
                  <div class="institution-sub">Ref: <strong>${receipt.referenceNumber || receipt.receiptNo}</strong></div>
                </td>
              </tr>
            </table>

            <!-- Prominent Approval Status Notice -->
            ${isApproved ? `
            <div class="status-banner" style="background: #ECFDF5; border: 1px solid #10B981; border-left: 4px solid #059669;">
              <strong style="color: #065F46;">STATUS: PAYMENT VERIFIED &amp; APPROVED BY REGISTRAR</strong>
              <span style="color: #047857;">Tuition settlement verified and approved by the training center administrator. Enrollment is officially confirmed under MARINA &amp; STCW training regulations. Course modules and training schedule are fully active.</span>
            </div>
            ` : `
            <div class="status-banner">
              <strong>STATUS: PAYMENT RECEIVED — QUEUED FOR REGISTRAR APPROVAL</strong>
              <span>Tuition settlement received via PayMongo (${(receipt.paymentMethod || 'GCASH').toUpperCase()}). In accordance with maritime training regulations, this enrollment is undergoing registrar verification. Course modules and training schedule will unlock automatically upon admin confirmation.</span>
            </div>
            `}

            <!-- Two-Column Particulars Section -->
            <div class="section-grid">
              <!-- Seafarer Particulars -->
              <div class="section-col">
                <div class="col-title">Seafarer Identification Details</div>
                <div class="data-row">
                  <span class="data-label">Trainee Full Name:</span>
                  <span class="data-value">${receipt.trainee.fullName}</span>
                </div>
                <div class="data-row" style="margin: 6px 0;">
                  <span class="data-label" style="font-weight: 700; color: #0B3D91;">Seafarer Reg. No. (SRN):</span>
                  <span class="srn-highlight">${receipt.trainee.srn}</span>
                </div>
                <div class="data-row">
                  <span class="data-label">Trainee ID Number:</span>
                  <span class="data-value">${receipt.trainee.traineeNumber || 'TRN-2026-ACTIVE'}</span>
                </div>
                <div class="data-row">
                  <span class="data-label">Contact Phone:</span>
                  <span class="data-value">${receipt.trainee.phone || 'N/A'}</span>
                </div>
                <div class="data-row">
                  <span class="data-label">Email Address:</span>
                  <span class="data-value">${receipt.trainee.email || 'N/A'}</span>
                </div>
                <div class="data-row">
                  <span class="data-label">Nationality / Residence:</span>
                  <span class="data-value">${receipt.trainee.nationality || 'Filipino'} • ${receipt.trainee.address || 'Philippines'}</span>
                </div>
              </div>

              <!-- Program & Batch Particulars -->
              <div class="section-col">
                <div class="col-title">Enrolled Program &amp; Batch Assignment</div>
                <div class="data-row">
                  <span class="data-label">Course Code:</span>
                  <span class="data-value" style="color: #0B3D91;">${receipt.course.code}</span>
                </div>
                <div class="data-row">
                  <span class="data-label">Course Title:</span>
                  <span class="data-value">${receipt.course.title}</span>
                </div>
                <div class="data-row">
                  <span class="data-label">Assigned Batch:</span>
                  <span class="data-value" style="color: #047857; font-weight: 800;">${receipt.course.batchCode}</span>
                </div>
                <div class="data-row">
                  <span class="data-label">Training Period:</span>
                  <span class="data-value">${receipt.course.startDate ? `${receipt.course.startDate} ${receipt.course.endDate ? 'to ' + receipt.course.endDate : ''}` : 'Scheduled Cohort'}</span>
                </div>
                <div class="data-row">
                  <span class="data-label">Training Campus:</span>
                  <span class="data-value">${receipt.course.centerName || 'NEWSIM Maritime Training Center - Main Campus'}</span>
                </div>
                <div class="data-row">
                  <span class="data-label">Payment Channel:</span>
                  <span class="data-value">PayMongo (${(receipt.paymentMethod || 'GCASH').toUpperCase()})</span>
                </div>
              </div>
            </div>

            <!-- Itemized Billing Table -->
            <table class="billing-table">
              <thead>
                <tr>
                  <th style="width: 40px; text-align: center;">Item</th>
                  <th>Description of Maritime Training Service</th>
                  <th style="width: 110px;">Batch / Cohort</th>
                  <th style="width: 140px;">Transaction Ref</th>
                  <th style="width: 110px; text-align: right;">Amount (PHP)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="text-align: center; font-weight: 700;">01</td>
                  <td>
                    <strong>${receipt.course.code} — ${receipt.course.title}</strong>
                    <div style="font-size: 9px; color: #64748b; margin-top: 2px;">Comprehensive STCW Theoretical, Practical Simulator, and Assessment Fees</div>
                  </td>
                  <td>${receipt.course.batchCode}</td>
                  <td>${receipt.referenceNumber || receipt.receiptNo}</td>
                  <td style="text-align: right; font-weight: 700;">₱${receipt.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td colspan="4" style="text-align: right; font-weight: 700;">Subtotal:</td>
                  <td style="text-align: right; font-weight: 700;">₱${receipt.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td colspan="4" style="text-align: right; color: #64748b;">Discount / Bursary:</td>
                  <td style="text-align: right; color: #64748b;">₱0.00</td>
                </tr>
                <tr class="total-row">
                  <td colspan="4" style="text-align: right; font-size: 12px; font-weight: 900; color: #0B3D91;">TOTAL TUITION PAID:</td>
                  <td style="text-align: right; font-size: 13px; font-weight: 900; color: #047857;">₱${receipt.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>

            <!-- Amount in Words -->
            <div class="words-box">
              <div class="words-label">Amount in Words:</div>
              <div class="words-value">${wordsAmount}</div>
            </div>

            <!-- Signatures and Security Verification -->
            <div class="footer-signatures">
              <div class="cert-notice">
                <strong>SYSTEM AUTHENTICATED ELECTRONIC RECEIPT</strong>
                <p>This is a valid, system-generated official receipt issued by the NEWSIM Maritime Training Management System. An embossed dry seal will be affixed to the physical document upon in-person claiming of the Certificate of Competency at the Registrar's Office.</p>
              </div>

              <div class="stamp-box">
                <div>★ NEWSIM MARITIME ★</div>
                <div>VERIFIED &amp; PAID</div>
                <div style="font-size: 8px; margin-top: 2px;">ELECTRONIC SETTLEMENT</div>
              </div>

              <div class="signature-box">
                <div class="signature-line"></div>
                <div class="signature-name">OFFICE OF THE REGISTRAR / CASHIER</div>
                <div class="signature-sub">NEWSIM Admissions &amp; Finance Department</div>
                <div class="signature-sub">Issued: ${formattedDate}</div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
    frameDoc.close();

    setTimeout(() => {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(printFrame);
      }, 2000);
    }, 350);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto print:p-0 print:static print:block">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm print:hidden"
        />

        {/* Modal Window / Printable Area */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-3xl bg-white dark:bg-[#0B2447] text-slate-800 dark:text-slate-100 rounded-3xl shadow-2xl border border-[#3BA7F2]/30 overflow-hidden z-10 my-8 print:border-none print:shadow-none print:rounded-none print:m-0 print:p-0 print:max-w-none print:bg-white print:text-black"
        >
          {/* Top Decorative Header */}
          <div className="h-2 bg-gradient-to-r from-[#0B3D91] via-[#3BA7F2] to-emerald-400 w-full print:hidden" />

          {/* Action Bar (Print / Close) */}
          <div className="p-4 sm:p-6 pb-0 flex items-center justify-between print:hidden">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#3BA7F2]/15 text-[#0B3D91] dark:text-[#3BA7F2] border border-[#3BA7F2]/30 flex items-center gap-1">
                <Receipt className="w-3 h-3 text-[#3BA7F2]" />
                <span>OFFICIAL ELECTRONIC RECEIPT</span>
              </span>
              {isTestMode && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  PayMongo TEST MODE
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#0B3D91] to-[#3BA7F2] hover:opacity-95 text-xs font-mono font-bold text-white shadow-sm transition-opacity cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Official Receipt</span>
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Printable Receipt Body */}
          <div id="official-receipt-print-area" className="p-6 sm:p-8 space-y-5 print:p-0">
            {/* Outer Border for Official Look */}
            <div className="border-2 sm:border-3 border-double border-[#0B3D91]/40 dark:border-[#3BA7F2]/40 rounded-2xl p-5 sm:p-6 space-y-5 bg-white dark:bg-[#071E3D] print:border-3 print:border-double print:border-black print:bg-white print:p-6">
              
              {/* Institution Brand & Header */}
              <div className="border-b-2 border-[#0B3D91]/20 dark:border-white/10 pb-4 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-4 print:border-b-2 print:border-black">
                <div className="space-y-1">
                  <div className="flex items-center justify-center sm:justify-start gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0B3D91] to-[#3BA7F2] text-white flex items-center justify-center font-black text-lg shadow-sm print:bg-[#0B3D91]">
                      N
                    </div>
                    <div>
                      <h2 className="font-heading font-black text-lg sm:text-xl text-[#0B3D91] dark:text-white tracking-tight leading-none print:text-black">
                        NEW SIMULATOR TRAINING CENTER OF THE PHILS., INC.
                      </h2>
                      <span className="text-[11px] font-mono font-bold text-[#3BA7F2] tracking-wider uppercase block mt-0.5 print:text-slate-700">
                        NEWSIM Maritime Training Center • MARINA Accredited
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono print:text-slate-600">
                    STCW 1978 as Amended (Manila 2010) • Non-VAT Reg. TIN: 204-589-112-000
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono print:text-slate-600">
                    NEWSIM Talisay Training Center, Talisay City, Philippines • Tel: 09398005951
                  </p>
                </div>

                <div className="text-center sm:text-right font-mono space-y-1 bg-[#E8F6FF]/70 dark:bg-white/5 print:bg-slate-50 p-3 rounded-xl border border-[#3BA7F2]/30 print:border-slate-300 min-w-[200px]">
                  <div className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Official Receipt No.</div>
                  <div className="text-lg font-extrabold text-[#0B3D91] dark:text-[#3BA7F2] print:text-black">
                    {receipt.receiptNo}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    Date: <strong className="text-slate-800 dark:text-slate-200 print:text-black">{formattedDateOnly}</strong>
                  </div>
                  <div className="text-[9px] text-slate-400 font-mono">
                    Ref: {receipt.referenceNumber || receipt.receiptNo}
                  </div>
                </div>
              </div>

              {/* Status Banner */}
              {isApproved ? (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 print:border-emerald-500 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 text-left">
                    <div className="font-heading font-extrabold text-xs text-emerald-800 dark:text-emerald-300 print:text-emerald-900">
                      STATUS: PAYMENT VERIFIED &amp; APPROVED BY REGISTRAR
                    </div>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-200/90 leading-relaxed font-sans">
                      Tuition settlement verified and officially confirmed by administration. Enrollment is active under MARINA and STCW standards.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 print:border-amber-500 flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 text-left">
                    <div className="font-heading font-extrabold text-xs text-amber-800 dark:text-amber-300 print:text-amber-900">
                      STATUS: PAYMENT RECEIVED — QUEUED FOR REGISTRAR APPROVAL
                    </div>
                    <p className="text-[11px] text-amber-700 dark:text-amber-200/90 leading-relaxed font-sans">
                      Tuition settled via PayMongo ({(receipt.paymentMethod || 'GCASH').toUpperCase()}). In accordance with maritime training regulations, this registration is queued for registrar verification and batch placement confirmation. Your course modules and schedule timetable will unlock automatically once approved.
                    </p>
                  </div>
                </div>
              )}

              {/* Two-Column Information Details Box */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                {/* Seafarer Details */}
                <div className="rounded-xl border border-slate-200 dark:border-white/10 p-3.5 space-y-2.5 bg-slate-50/60 dark:bg-white/2 print:bg-transparent print:border-slate-300">
                  <div className="flex items-center gap-1.5 font-bold text-[#0B3D91] dark:text-[#3BA7F2] uppercase border-b border-slate-200 dark:border-white/10 pb-1.5 print:text-black">
                    <User className="w-3.5 h-3.5 text-[#3BA7F2]" />
                    <span>Seafarer Particulars</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Full Name:</span>
                      <span className="font-bold text-slate-800 dark:text-white print:text-black">{receipt.trainee.fullName}</span>
                    </div>

                    {/* PROMINENT SRN NUMBER */}
                    <div className="flex justify-between items-center p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-500/30">
                      <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300">SRN:</span>
                      <span className="font-extrabold text-xs text-emerald-700 dark:text-[#7FE7D6] print:text-black font-mono">
                        {receipt.trainee.srn}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-400">Trainee ID:</span>
                      <span className="text-slate-700 dark:text-slate-300 print:text-black">{receipt.trainee.traineeNumber || 'TRN-2026-ACTIVE'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Contact:</span>
                      <span className="text-slate-700 dark:text-slate-300 print:text-black">{receipt.trainee.phone || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Email:</span>
                      <span className="text-slate-700 dark:text-slate-300 print:text-black truncate max-w-[180px]">{receipt.trainee.email || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Training Program & Batch Details */}
                <div className="rounded-xl border border-slate-200 dark:border-white/10 p-3.5 space-y-2.5 bg-slate-50/60 dark:bg-white/2 print:bg-transparent print:border-slate-300">
                  <div className="flex items-center gap-1.5 font-bold text-[#0B3D91] dark:text-[#3BA7F2] uppercase border-b border-slate-200 dark:border-white/10 pb-1.5 print:text-black">
                    <Calendar className="w-3.5 h-3.5 text-[#3BA7F2]" />
                    <span>Enrolled Program &amp; Batch</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Program Code:</span>
                      <span className="font-bold text-[#0B3D91] dark:text-[#3BA7F2] print:text-black">{receipt.course.code}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Course Title:</span>
                      <span className="font-bold text-slate-800 dark:text-white print:text-black truncate max-w-[180px]">{receipt.course.title}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Assigned Batch:</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#3BA7F2]/10 text-[#0B3D91] dark:text-[#3BA7F2] border border-[#3BA7F2]/20 print:border-slate-400">
                        {receipt.course.batchCode}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Training Period:</span>
                      <span className="text-slate-700 dark:text-slate-300 print:text-black">
                        {receipt.course.startDate ? `${receipt.course.startDate} ${receipt.course.endDate ? 'to ' + receipt.course.endDate : ''}` : 'Scheduled Cohort'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Campus:</span>
                      <span className="text-slate-700 dark:text-slate-300 print:text-black truncate max-w-[180px]">{receipt.course.centerName || 'NEWSIM Talisay Training Center'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Itemized Financial Settlement Table */}
              <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-x-auto font-mono text-xs print:border-slate-300">
                <table className="w-full min-w-[460px] text-left">
                  <thead className="bg-[#E8F6FF]/60 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-[10px] uppercase text-slate-500 font-bold print:bg-slate-100">
                    <tr>
                      <th className="p-3">Description of Training Service</th>
                      <th className="p-3">Batch</th>
                      <th className="p-3">Channel / Gateway</th>
                      <th className="p-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    <tr>
                      <td className="p-3">
                        <div className="font-bold text-slate-800 dark:text-white print:text-black">{receipt.course.code} — {receipt.course.title}</div>
                        <div className="text-[10px] text-slate-400 font-sans">Theoretical modules, simulator practical training, and assessment fees</div>
                      </td>
                      <td className="p-3 font-bold text-emerald-600 dark:text-emerald-400 print:text-black">{receipt.course.batchCode}</td>
                      <td className="p-3">PayMongo ({(receipt.paymentMethod || 'GCASH').toUpperCase()})</td>
                      <td className="p-3 text-right font-bold text-slate-900 dark:text-white print:text-black">
                        ₱{receipt.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                    <tr className="bg-slate-50/50 dark:bg-white/2 print:bg-transparent">
                      <td colSpan={3} className="p-3 text-right font-bold uppercase text-slate-500 text-[11px]">Total Tuition Settled:</td>
                      <td className="p-3 text-right font-extrabold text-base text-emerald-600 dark:text-emerald-400 print:text-black">
                        ₱{receipt.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Amount in Words */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-mono print:bg-slate-50 print:border-slate-300">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Amount in Words:</span>
                <span className="font-extrabold text-[#0B3D91] dark:text-[#3BA7F2] print:text-black italic">
                  {wordsAmount}
                </span>
              </div>

              {/* Official Certification Footer & Signatures */}
              <div className="pt-3 border-t-2 border-dashed border-slate-200 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] font-mono text-slate-400 print:border-t-2 print:border-dashed print:border-slate-400">
                <div className="space-y-0.5 text-center sm:text-left max-w-xs">
                  <div className="font-bold text-slate-700 dark:text-slate-300 uppercase print:text-black">ELECTRONIC OFFICIAL RECEIPT</div>
                  <p className="text-[9px] leading-relaxed">
                    This document is system-authenticated by the NEWSIM Training Management System. An embossed dry seal will be affixed to the physical release slip upon in-person claiming of the Certificate of Competency.
                  </p>
                </div>

                <div className="px-3 py-1.5 rounded-lg border-2 border-dashed border-emerald-500 text-emerald-600 dark:text-emerald-400 text-center font-bold tracking-wider text-[9px] print:border-black print:text-black">
                  <div>★ NEWSIM CASHIER ★</div>
                  <div>PAID &amp; RECORDED</div>
                  <div className="text-[8px] text-slate-400 print:text-slate-600">ELECTRONIC SETTLEMENT</div>
                </div>

                <div className="text-center sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 w-44">
                  <div className="border-b border-slate-700 dark:border-white/30 mb-1 print:border-black" />
                  <div className="font-bold text-slate-700 dark:text-slate-200 print:text-black">OFFICE OF THE REGISTRAR</div>
                  <div className="text-[9px]">NEWSIM Admissions &amp; Finance</div>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer Controls (Print / Done) */}
          <div className="p-4 bg-slate-50 dark:bg-white/5 border-t border-slate-200 dark:border-white/10 flex items-center justify-end gap-3 print:hidden">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#0B3D91] to-[#3BA7F2] text-white font-bold text-xs shadow-md shadow-[#0B3D91]/25 hover:opacity-95 transition-opacity cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Official Receipt</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 text-xs font-semibold cursor-pointer transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
