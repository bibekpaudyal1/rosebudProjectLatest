// apps/web/src/app/api/payments/initiate/route.ts
// Proxies payment initiation requests to the payment microservice
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

const PAYMENT_SERVICE_URL =
  process.env.PAYMENT_SERVICE_URL ?? 'http://localhost:4006/api/v1';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    const body = await req.json();

    const res = await fetch(`${PAYMENT_SERVICE_URL}/payments/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session && (session as any).accessToken
          ? { Authorization: `Bearer ${(session as any).accessToken}` }
          : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error?.message ?? 'Payment initiation failed' },
        { status: res.status },
      );
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? 'Internal server error' },
      { status: 500 },
    );
  }
}
