/**
 * Redis Helper for Enrichment Data
 * Stores enriched contact data in Redis - just let it chill there
 */

import { Redis } from '@upstash/redis';

let redis: Redis | null = null;

function getRedis(): Redis {
  if (redis) {
    return redis;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      'Redis configuration is missing. Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.'
    );
  }

  redis = new Redis({
    url,
    token,
  });

  return redis;
}

/**
 * Store enriched contact data in Redis
 * Just let it chill there - no database writes
 * 
 * @param linkedinUrl - LinkedIn URL (used as key)
 * @param enrichedData - Enriched contact data from Apollo
 * @param ttl - Time to live in seconds (default: 7 days)
 * @returns Promise<string> - Redis key
 */
export async function storeEnrichedContact(
  linkedinUrl: string,
  enrichedData: any,
  ttl: number = 7 * 24 * 60 * 60 // 7 days
): Promise<string> {
  try {
    const redisClient = getRedis();
    const key = `apollo:enriched:${linkedinUrl}`;
    
    // Store enriched data with TTL
    await redisClient.setex(key, ttl, JSON.stringify({
      linkedinUrl,
      enrichedData,
      enrichedAt: new Date().toISOString(),
    }));
    
    console.log(`✅ Enriched data stored in Redis: ${key}`);
    return key;
  } catch (error: any) {
    console.error('❌ Redis store error:', error);
    // Don't throw - just log, we don't want to break the flow
    return '';
  }
}

/**
 * Get enriched contact data from Redis
 * 
 * @param linkedinUrl - LinkedIn URL (used as key)
 * @returns Promise<any | null> - Enriched data or null
 */
export async function getEnrichedContact(linkedinUrl: string): Promise<any | null> {
  try {
    const redisClient = getRedis();
    const key = `apollo:enriched:${linkedinUrl}`;
    const data = await redisClient.get(key);
    
    if (!data) {
      return null;
    }
    
    return typeof data === 'string' ? JSON.parse(data) : data;
  } catch (error: any) {
    console.error('❌ Redis get error:', error);
    return null;
  }
}

/**
 * List all enriched contacts in Redis
 * 
 * @returns Promise<string[]> - Array of Redis keys
 */
export async function listEnrichedContacts(): Promise<string[]> {
  try {
    const redisClient = getRedis();
    const keys = await redisClient.keys('apollo:enriched:*');
    return keys;
  } catch (error: any) {
    console.error('❌ Redis list error:', error);
    return [];
  }
}

/**
 * Delete enriched contact from Redis
 * 
 * @param linkedinUrl - LinkedIn URL (used as key)
 * @returns Promise<boolean> - Success status
 */
export async function deleteEnrichedContact(linkedinUrl: string): Promise<boolean> {
  try {
    const redisClient = getRedis();
    const key = `apollo:enriched:${linkedinUrl}`;
    await redisClient.del(key);
    return true;
  } catch (error: any) {
    console.error('❌ Redis delete error:', error);
    return false;
  }
}

