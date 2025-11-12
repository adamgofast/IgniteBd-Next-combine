import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { processQueue } from '@/lib/services/enrichment/lushaService';

/**
 * POST /api/hydration/run
 * Process the enrichment queue
 * Can be called manually or via cron job
 */
export async function POST(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    console.log('🚀 Starting hydration queue processing...');
    const results = await processQueue();
    
    console.log('✅ Hydration queue processing complete:', results);

    return NextResponse.json({
      success: true,
      message: 'Hydration queue processed',
      results,
    });
  } catch (error) {
    console.error('❌ Hydration run error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process hydration queue',
        details: String(error),
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/hydration/run
 * Get queue status (for monitoring)
 * 
 * TEMPORARILY DISABLED: Redis is commented out
 */
export async function GET(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  // TEMPORARILY DISABLED: Redis functionality
  // try {
  //   const { Redis } = await import('@upstash/redis');
  //   
  //   const url = process.env.UPSTASH_REDIS_REST_URL;
  //   const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  //   if (!url || !token) {
  //     return NextResponse.json(
  //       { 
  //         success: false, 
  //         error: 'Redis configuration is missing. Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.',
  //       },
  //       { status: 500 },
  //     );
  //   }

  //   const redis = new Redis({
  //     url,
  //     token,
  //   });

  //   const keys = await redis.keys('lusha:job:*');
  //   const stats = {
  //     total: keys.length,
  //     pending: 0,
  //     done: 0,
  //     failed: 0,
  //     error: 0,
  //   };

  //   for (const key of keys) {
  //     const job = await redis.hgetall(key);
  //     if (job.status) {
  //       stats[job.status] = (stats[job.status] || 0) + 1;
  //     }
  //   }

  //   return NextResponse.json({
  //     success: true,
  //     stats,
  //   });
  // } catch (error) {
  //   console.error('❌ Get queue status error:', error);
  //   return NextResponse.json(
  //     { 
  //       success: false, 
  //       error: 'Failed to get queue status',
  //       details: String(error),
  //     },
  //     { status: 500 },
  //   );
  // }

  // Return empty stats since Redis is disabled
  return NextResponse.json({
    success: true,
    stats: {
      total: 0,
      pending: 0,
      done: 0,
      failed: 0,
      error: 0,
    },
    message: 'Redis is temporarily disabled',
  });
}

