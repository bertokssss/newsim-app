import { NextRequest, NextResponse } from 'next/server';
import { checkAccountLockout } from '@newsim/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { identifier } = body;
    if (!identifier) {
      return NextResponse.json({ isLocked: false });
    }

    const lockout = await checkAccountLockout(identifier);
    return NextResponse.json({
      isLocked: lockout.isLocked,
      isPermanent: lockout.isPermanent,
      offenseLevel: lockout.offenseLevel,
      remainingSeconds: lockout.remainingSeconds,
      remainingMinutes: lockout.remainingMinutes,
      lockoutUntil: lockout.lockoutUntil,
      message: lockout.message || lockout.error,
    });
  } catch (err: any) {
    return NextResponse.json({ isLocked: false, error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const identifier = searchParams.get('identifier');
    if (!identifier) {
      return NextResponse.json({ isLocked: false });
    }

    const lockout = await checkAccountLockout(identifier);
    return NextResponse.json({
      isLocked: lockout.isLocked,
      isPermanent: lockout.isPermanent,
      offenseLevel: lockout.offenseLevel,
      remainingSeconds: lockout.remainingSeconds,
      remainingMinutes: lockout.remainingMinutes,
      lockoutUntil: lockout.lockoutUntil,
      message: lockout.message || lockout.error,
    });
  } catch (err: any) {
    return NextResponse.json({ isLocked: false, error: err.message }, { status: 500 });
  }
}
