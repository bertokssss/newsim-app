'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield, Lock, Database, FileCheck, UserCheck, Mail, Phone, Cookie } from 'lucide-react';
import { openCookiePreferences } from '../analytics-consent';

export interface LegalPageViewProps {
  portalName?: string;
  backHref?: string;
  backLabel?: string;
  termsHref?: string;
  privacyHref?: string;
}

const EFFECTIVE_DATE = 'November 12, 2026';
const PRIVACY_VERSION = '2026-11-v1';

export function PrivacyPolicyView({
  portalName = 'NEWSIM Maritime Training Management System',
  backHref = '/',
  backLabel = 'Return to Portal',
  termsHref = '/terms',
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
          <div className="flex items-center gap-3 text-xs">
            <Link href={termsHref} className="text-sky-400 hover:text-sky-300 font-medium underline underline-offset-4">
              Terms and Conditions
            </Link>
            <button
              type="button"
              onClick={openCookiePreferences}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-slate-200 hover:border-[#D8C4A5]/50 hover:text-[#D8C4A5] transition-colors cursor-pointer"
            >
              <Cookie className="w-3.5 h-3.5" />
              Cookie Settings
            </button>
          </div>
        </div>

        <header className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0F1E31] to-[#081320] p-6 sm:p-10 shadow-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#D8C4A5]/30 bg-[#D8C4A5]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-[#D8C4A5] mb-4">
            <Shield className="w-3.5 h-3.5" />
            Philippine Data Privacy Act (RA 10173) Notice
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-white">
            NEWSIM Privacy Policy
          </h1>
          <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed max-w-3xl">
            This Privacy Policy explains how {portalName} (&ldquo;NEWSIM&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) collects, processes, stores, and safeguards personal information in accordance with Republic Act No. 10173, the Data Privacy Act of 2012 of the Philippines, and its Implementing Rules and Regulations.
          </p>
          <div className="mt-5 flex flex-wrap gap-4 text-xs text-slate-400">
            <span>Effective Date: <strong className="text-slate-200">{EFFECTIVE_DATE}</strong></span>
            <span>Policy Version: <strong className="text-slate-200">{PRIVACY_VERSION}</strong></span>
          </div>
        </header>

        <nav aria-label="Privacy policy sections" className="rounded-xl border border-white/10 bg-[#0D1A2B]/80 p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Quick Navigation</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
            {[
              ['#collection', '1. Information We Collect'],
              ['#processing', '2. Role-Based Processing'],
              ['#storage', '3. Supabase Storage & Security'],
              ['#cookies', '4. Cookies & Consent Policy'],
              ['#rights', '5. Data Subject Rights'],
              ['#retention', '6. Retention & Account Deletion'],
              ['#contact', '7. Privacy Contact Details'],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-slate-300 hover:border-sky-400/40 hover:text-white transition-colors"
              >
                {label}
              </a>
            ))}
          </div>
        </nav>

        <article className="space-y-6 rounded-2xl border border-white/10 bg-[#0D1A2B]/90 p-6 sm:p-10 text-sm text-slate-300 leading-relaxed shadow-xl">
          <section id="collection" className="space-y-3 scroll-mt-6">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-sky-400 shrink-0" />
              1. Personal Information NEWSIM Collects
            </h2>
            <p>
              To operate maritime training administration, learning management, scheduling, assessments, and certification workflows, NEWSIM collects and processes the following categories of personal data:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-white">Account &amp; Identity Details:</strong> Full name, email address, username, mobile phone number, Seafarer Registration Number (SRN), assigned portal role (Trainee, Instructor, Administrator, or Super Administrator), profile status, and hashed authentication credentials.
              </li>
              <li>
                <strong className="text-white">Enrollment &amp; Training Records:</strong> Course applications, training batch assignments, branch preferences, schedule allocations, attendance logs, and leave or rescheduling requests.
              </li>
              <li>
                <strong className="text-white">Academic &amp; Assessment Records:</strong> Learning module progress, uploaded assignments, assessment submissions, instructor grading remarks, pass/fail status, and issued certificate verification codes.
              </li>
              <li>
                <strong className="text-white">Payment &amp; Billing Records:</strong> Training fee amounts, payment methods, reference numbers, PayMongo checkout session identifiers, official receipt metadata, and payment verification timestamps. NEWSIM does not directly store raw credit/debit card numbers or CVV codes on application servers.
              </li>
              <li>
                <strong className="text-white">Security &amp; Audit Telemetry:</strong> IP addresses, user-agent strings, session identifiers, Multi-Factor Authentication (MFA) configuration status, failed login attempt counters, terms acceptance logs, and administrative audit logs.
              </li>
            </ul>
          </section>

          <hr className="border-white/10" />

          <section id="processing" className="space-y-3 scroll-mt-6">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-sky-400 shrink-0" />
              2. How Trainee, Instructor, and Administrator Data Is Processed
            </h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-white">Trainees:</strong> Processed to verify SRN eligibility, manage course enrollments and payments, deliver maritime LMS modules and schedules, grade assessments, record attendance, and generate verifiable training certificates.
              </li>
              <li>
                <strong className="text-white">Instructors:</strong> Processed to assign training courses and schedules, verify attendance, review trainee submissions, record evaluation scores, and manage leave availability.
              </li>
              <li>
                <strong className="text-white">Administrators &amp; Super Administrators:</strong> Processed to coordinate training operations, verify enrollments and billing (limited to personnel with financial permissions), manage user lifecycle, and maintain platform security and audit accountability. Technical Super Administrators are restricted from accessing routine trainee payment records.
              </li>
            </ul>
          </section>

          <hr className="border-white/10" />

          <section id="storage" className="space-y-3 scroll-mt-6">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-sky-400 shrink-0" />
              3. Supabase Infrastructure, Data Security &amp; Access Restrictions
            </h2>
            <p>
              NEWSIM stores structured application data and authentication records using <strong className="text-white">Supabase (PostgreSQL database, Supabase Auth, and Supabase Storage)</strong> with encrypted transport (HTTPS/TLS in production).
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-white">Strict Portal &amp; Role-Based Access Control (RBAC):</strong> Only authorized personnel authenticated with the required portal role and permissions may view or modify restricted trainee, financial, or administrative records.
              </li>
              <li>
                <strong className="text-white">Database Row-Level Security &amp; Session Controls:</strong> Sensitive tables are protected by Supabase Row-Level Security policies, HTTP-only session cookies, inactivity timeouts, TOTP Multi-Factor Authentication for privileged accounts, password strength policies, account lockout rules, and Google reCAPTCHA / rate limiting protections.
              </li>
              <li>
                <strong className="text-white">Third-Party Processors:</strong> Payment processing is facilitated via PayMongo, and email notifications (such as OTP verification and password recovery links) are delivered over authenticated SMTP transport.
              </li>
            </ul>
          </section>

          <hr className="border-white/10" />

          <section id="cookies" className="space-y-3 scroll-mt-6">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <Cookie className="w-5 h-5 text-[#D8C4A5] shrink-0" />
              4. Cookie &amp; Analytics Policy
            </h2>
            <p>
              NEWSIM uses strictly necessary cookies and optional preference/analytics storage:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-white">Essential Cookies (Always Active):</strong> HttpOnly authentication tokens (`session_token`, role-specific session cookies, and `user_role`) required to keep you signed in, enforce portal security boundaries, and protect against unauthorized access.
              </li>
              <li>
                <strong className="text-white">Analytics Cookies (Consent Required):</strong> Optional Google Analytics 4 measurements used to understand overall page traffic, navigation flows, and enrollment completion rates. Analytics scripts are disabled until you explicitly grant consent, and NEWSIM strips passwords, SRNs, emails, payment details, and assessment answers from analytics payloads.
              </li>
              <li>
                <strong className="text-white">Preference Storage (Consent Required):</strong> Optional UI display and navigation convenience settings.
              </li>
            </ul>
            <p>
              You can review or withdraw non-essential cookie consent at any time using the{' '}
              <button
                type="button"
                onClick={openCookiePreferences}
                className="text-sky-400 hover:text-sky-300 underline underline-offset-4 font-semibold cursor-pointer"
              >
                Cookie Settings
              </button>{' '}
              control.
            </p>
          </section>

          <hr className="border-white/10" />

          <section id="rights" className="space-y-3 scroll-mt-6">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-sky-400 shrink-0" />
              5. Your Rights Under the Data Privacy Act of 2012 (RA 10173)
            </h2>
            <p>As a data subject under Philippine law, you have the right to:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong className="text-white">Be Informed</strong> about how your personal data is collected and processed.</li>
              <li><strong className="text-white">Access</strong> personal records held about you within the NEWSIM system.</li>
              <li><strong className="text-white">Rectify or Correct</strong> inaccurate profile information (such as name, contact number, or SRN corrections upon verification).</li>
              <li><strong className="text-white">Object, Block, or Request Erasure</strong> of personal information where processing is no longer necessary or lawful, subject to statutory training/certification record requirements.</li>
              <li><strong className="text-white">Data Portability &amp; Redress</strong>, including filing a complaint before the National Privacy Commission (NPC) of the Philippines if your rights are violated.</li>
            </ul>
          </section>

          <hr className="border-white/10" />

          <section id="retention" className="space-y-3 scroll-mt-6">
            <h2 className="text-lg sm:text-xl font-bold text-white">6. Data Retention &amp; Account Deletion Procedures</h2>
            <p>
              NEWSIM retains training, attendance, assessment, payment, and terms acceptance records only for as long as necessary to deliver maritime training services, verify issued certificates, satisfy accounting or audit obligations, and resolve disputes.
            </p>
            <p>
              To request correction, export, or deletion of your account and associated personal data, contact NEWSIM using your registered email address and SRN via the official contact channels below. Certain verification, billing, or statutory certification records may be retained or anonymized rather than purged immediately where required for credential authenticity or legal audit trails.
            </p>
          </section>

          <hr className="border-white/10" />

          <section id="contact" className="space-y-3 scroll-mt-6">
            <h2 className="text-lg sm:text-xl font-bold text-white">7. Privacy Inquiries &amp; Official Contact</h2>
            <p>
              For privacy questions, RA 10173 data subject requests, or account deletion inquiries, contact the NEWSIM administration through our official support channels:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <a
                href="mailto:newsim.superadmin@gmail.com"
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:border-[#D8C4A5]/50 transition-colors"
              >
                <Mail className="w-5 h-5 text-[#D8C4A5] shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-400">Official Email</p>
                  <p className="text-sm font-semibold text-white truncate">newsim.superadmin@gmail.com</p>
                </div>
              </a>
              <a
                href="tel:+639398005951"
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:border-[#D8C4A5]/50 transition-colors"
              >
                <Phone className="w-5 h-5 text-[#D8C4A5] shrink-0" />
                <div>
                  <p className="text-xs text-slate-400">Official Telephone</p>
                  <p className="text-sm font-semibold text-white">+63 939 800 5951</p>
                </div>
              </a>
            </div>
          </section>
        </article>
      </div>
    </div>
  );
}
