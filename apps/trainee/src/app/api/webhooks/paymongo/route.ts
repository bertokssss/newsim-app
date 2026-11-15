import { NextRequest, NextResponse } from 'next/server';
import { handlePaymongoWebhookRequest } from '@newsim/database';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const sigHeader = req.headers.get('paymongo-signature');
    const result = await handlePaymongoWebhookRequest(rawBody, sigHeader);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error('[PayMongo Webhook] Processing error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
