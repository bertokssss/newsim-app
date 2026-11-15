'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ScrollText, AlertCircle } from 'lucide-react';
import type { LegalPageViewProps } from './PrivacyPolicyView';

const EFFECTIVE_DATE = 'November 12, 2026';
const TERMS_VERSION = '2026-11-v1';

const TERMS_SECTIONS = [
  {
    id: 'account-responsibilities',
    title: '1. User Account Responsibilities',
    body: 'Users are responsible for providing accurate, truthful personal information (including legal name, active email address, contact number, and Seafarer Registration Number where applicable), safeguarding login credentials and Multi-Factor Authentication devices, and promptly reporting suspected unauthorized access.',
  },
  {
    id: 'registration-auth',
    title: '2. Account Registration & Authentication Policies',
    body: 'Trainee accounts require email verification, strong password compliance, valid SRN submission, and explicit acceptance of these Terms and Conditions and the NEWSIM Privacy Policy. Privileged portals (Instructor, Administrator, and Super Administrator) are provisioned by authorized personnel and protected by MFA and inactivity session timeouts.',
  },
  {
    id: 'acceptable-use',
    title: '3. Acceptable Use of the Learning Management System (LMS)',
    body: 'You agree to use NEWSIM strictly for lawful maritime training, instruction, and administrative duties. Harassment, uploading malicious payloads, sharing confidential exam answers, or disrupting platform availability for other learners or staff is strictly prohibited.',
  },
  {
    id: 'course-enrollment',
    title: '4. Course Enrollment Rules',
    body: 'Course enrollment is subject to seat availability, training batch schedules, prerequisite verification, and administrator confirmation. Submitting false trainee identity details or duplicate SRN records may result in enrollment cancellation.',
  },
  {
    id: 'payment-refund',
    title: '5. Payment & Refund Policies',
    body: 'Applicable course fees must be settled through NEWSIM-approved payment channels (including PayMongo checkout or verified branch settlement) before full training access or certification processing is finalized. Refund, rescheduling, or credit requests follow NEWSIM administrative review based on payment verification status and training start dates.',
  },
  {
    id: 'schedules-attendance',
    title: '6. Training Schedules & Attendance Requirements',
    body: 'Trainees must adhere to assigned training schedules, simulator or classroom check-in windows, and minimum attendance hours required for each course. Unexcused absences or tardiness beyond course thresholds may require re-scheduling or repeat attendance.',
  },
  {
    id: 'assessment-grading',
    title: '7. Assessment & Grading Policies',
    body: 'All quizzes, practical evaluations, and written submissions must represent the trainee’s own independent work. Instructors and authorized assessors grade submissions according to course standards, and passing scores are required for course completion.',
  },
  {
    id: 'certificates',
    title: '8. Certificate Eligibility & Claiming Procedures',
    body: 'Training certificates are issued only after fulfilling all course requirements: verified enrollment, complete fee settlement, required attendance, and passing assessment results. Certificates carry unique verification codes and may be claimed or downloaded through the NEWSIM portal according to administrative release guidelines.',
  },
  {
    id: 'suspension-termination',
    title: '9. Account Suspension & Termination',
    body: 'Repeated failed authentication attempts may trigger temporary automated lockouts. NEWSIM reserves the right to suspend or terminate accounts that violate these Terms, submit fraudulent documentation, bypass security controls, or engage in misconduct, with all security events subject to audit logging.',
  },
  {
    id: 'prohibited-activities',
    title: '10. Prohibited Activities & Unauthorized Access',
    body: 'Users must not attempt to access portals, APIs, or records outside their assigned role, bypass rate limits or CAPTCHA protections, scrape data, share accounts, reverse-engineer platform infrastructure, or tamper with certificates and official receipts.',
  },
  {
    id: 'intellectual-property',
    title: '11. Intellectual Property Rights',
    body: 'All NEWSIM trademarks, logos, maritime courseware, simulator modules, assessment materials, software code, and platform interfaces remain the exclusive property of NEWSIM and its licensors. Materials are licensed solely for personal enrolled training and may not be redistributed or resold.',
  },
  {
    id: 'liability',
    title: '12. Limitation of Liability',
    body: 'While NEWSIM maintains production security controls and service reliability safeguards, the platform is provided on an "as available" operational basis. To the maximum extent permitted by applicable Philippine law, NEWSIM is not liable for indirect or consequential damages arising from network outages, user credential negligence, or third-party payment or communications disruptions.',
  },
  {
    id: 'changes',
    title: '13. Changes to Terms and Conditions',
    body: 'NEWSIM may update these Terms and Conditions as regulatory, security, or operational requirements evolve. When material updates occur, users will be notified and asked to review and accept the revised Terms version before continuing protected portal workflows.',
  },
];

export function TermsConditionsView({
  portalName = 'NEWSIM Maritime Training Management System',
  backHref = '/',
  backLabel = 'Return to Portal',
  privacyHref = '/privacy',
}: LegalPageViewProps) {
  return (
    <div className="min-h-screen bg-[#07111C] text-slate-100 py-8 sm:py-12 px-4 sm:px-6 lg:px-8 overflow-x-hidden">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300 hover:text-[#D8C4A5] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {backLabel}
          </Link>
          <Link href={privacyHref} className="text-xs text-sky-400 hover:text-sky-300 font-medium underline underline-offset-4">
            Privacy Policy
          </Link>
        </div>

        <header className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0F1E31] to-[#081320] p-6 sm:p-10 shadow-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#D8C4A5]/30 bg-[#D8C4A5]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-[#D8C4A5] mb-4">
            <ScrollText className="w-3.5 h-3.5" />
            Maritime Training Portal Agreement
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-white">
            NEWSIM Terms and Conditions
          </h1>
          <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed max-w-3xl">
            These Terms and Conditions govern access to and use of the {portalName} across the Trainee, Instructor, Administrator, and Super Administrator portals. By creating an account or signing in, you acknowledge and agree to comply with these Terms.
          </p>
          <div className="mt-5 flex flex-wrap gap-4 text-xs text-slate-400">
            <span>Effective Date: <strong className="text-slate-200">{EFFECTIVE_DATE}</strong></span>
            <span>Terms Version: <strong className="text-slate-200">{TERMS_VERSION}</strong></span>
          </div>
        </header>

        <div className="rounded-xl border border-sky-400/20 bg-sky-500/10 p-4 flex items-start gap-3 text-xs sm:text-sm text-sky-100">
          <AlertCircle className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
          <p>
            Acceptance of Version <strong className="font-semibold">{TERMS_VERSION}</strong> is recorded securely during trainee registration or account onboarding together with your User ID and acceptance timestamp.
          </p>
        </div>

        <article className="space-y-6 rounded-2xl border border-white/10 bg-[#0D1A2B]/90 p-6 sm:p-10 text-sm text-slate-300 leading-relaxed shadow-xl">
          {TERMS_SECTIONS.map((section, idx) => (
            <React.Fragment key={section.id}>
              <section id={section.id} className="space-y-2 scroll-mt-6">
                <h2 className="text-base sm:text-lg font-bold text-white">{section.title}</h2>
                <p>{section.body}</p>
              </section>
              {idx < TERMS_SECTIONS.length - 1 && <hr className="border-white/10" />}
            </React.Fragment>
          ))}
        </article>
      </div>
    </div>
  );
}
