import { NextRequest, NextResponse } from 'next/server';
import { processScheduleAutomaticTransitions } from '@newsim/database';

export const dynamic = 'force-dynamic';

function isAuthorizedCron(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET || 'newsim_secure_cron_task_secret_2026';
  const authHeader = req.headers.get('authorization');
  const customHeader = req.headers.get('x-cron-secret');
  const querySecret = new URL(req.url).searchParams.get('secret');

  if (authHeader && authHeader.replace(/^Bearer\s+/i, '') === cronSecret) return true;
  if (customHeader === cronSecret) return true;
  if (querySecret === cronSecret) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized: Invalid cron secret' }, { status: 401 });
  }

  try {
    const result = await processScheduleAutomaticTransitions();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Schedule cron transition error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
