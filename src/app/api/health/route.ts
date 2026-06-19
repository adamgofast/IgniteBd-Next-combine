import { NextResponse } from 'next/server';
import { promises as dns } from 'dns';
import { prisma } from '@/lib/prisma';

const INBOUND_PARSE_HOST = 'crm.ignitestrategies.co';
const EXPECTED_MX = 'mx.sendgrid.net';
const STALE_DAYS = 1;
const ROLLUP_DAYS = 30;

type StatusAgg = Record<string, number>;

/**
 * GET /api/health/inbound-parse
 *
 * Aggregate pipeline health (no auth):
 * - MX for ingest host → SendGrid
 * - Newest InboundEmail row (any tenant) + its ingestion status
 * - Last-30d counts by ingestionStatus (ingest succeeded but AI may have failed later)
 *
 * "Stale" = nothing new has been **written** to InboundEmail recently. That is different
 * from SendGrid accepting mail: webhook 5xx / wrong URL / no matching company = no row.
 */
export async function GET() {
  let mxOk = false;
  let mxRecords: string[] = [];
  try {
    const records = await dns.resolveMx(INBOUND_PARSE_HOST);
    mxRecords = records.map((r) => r.exchange.toLowerCase().replace(/\.$/, ''));
    mxOk = mxRecords.some((r) => r.includes('sendgrid'));
  } catch {
    mxOk = false;
    mxRecords = [];
  }

  let lastReceivedAt: string | null = null;
  let daysSinceLastReceived: number | null = null;
  let lastIngestionStatus: string | null = null;
  let lastInboundType: string | null = null;

  let rollup30dTotal = 0;
  let rollup30dByStatus: StatusAgg = {};

  try {
    const latest = await prisma.inboundEmail.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, ingestionStatus: true, inboundType: true },
    });
    if (latest) {
      lastReceivedAt = latest.createdAt.toISOString();
      const msAgo = Date.now() - latest.createdAt.getTime();
      daysSinceLastReceived = Math.floor(msAgo / (1000 * 60 * 60 * 24));
      lastIngestionStatus = latest.ingestionStatus;
      lastInboundType = latest.inboundType;
    }

    const sinceRollup = new Date();
    sinceRollup.setDate(sinceRollup.getDate() - ROLLUP_DAYS);
    const groups = await prisma.inboundEmail.groupBy({
      by: ['ingestionStatus'],
      where: { createdAt: { gte: sinceRollup } },
      _count: { id: true },
    });
    rollup30dByStatus = Object.fromEntries(
      groups.map((g) => [g.ingestionStatus, g._count.id]),
    );
    rollup30dTotal = groups.reduce((s, g) => s + g._count.id, 0);
  } catch (err) {
    console.warn('Inbound parse health DB rollup skipped:', err);
  }

  const isStale =
    daysSinceLastReceived !== null && daysSinceLastReceived >= STALE_DAYS;

  const status: 'ok' | 'stale' | 'down' = !mxOk
    ? 'down'
    : isStale || lastReceivedAt === null
      ? 'stale'
      : 'ok';

  console.log('Inbound parse health check:', {
    mxOk,
    mxRecords,
    lastReceivedAt,
    daysSinceLastReceived,
    lastIngestionStatus,
    status,
    rollup30dTotal,
    rollup30dByStatus,
  });

  return NextResponse.json({
    success: true,
    mxOk,
    mxRecords,
    host: INBOUND_PARSE_HOST,
    expectedMx: EXPECTED_MX,
    lastReceivedAt,
    daysSinceLastReceived,
    lastIngestionStatus,
    lastInboundType,
    rollup30dDays: ROLLUP_DAYS,
    rollup30dTotal,
    rollup30dByStatus,
    status,
  });
}
