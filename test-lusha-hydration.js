/**
 * Test script for Lusha Hydration Module
 * 
 * Usage:
 * 1. Set environment variables:
 *    - LUSHA_API_KEY=your_api_key
 *    - UPSTASH_REDIS_REST_URL=your_redis_url
 *    - UPSTASH_REDIS_REST_TOKEN=your_redis_token
 *    - DATABASE_URL=your_database_url
 * 
 * 2. Run: node test-lusha-hydration.js
 */

import { enqueueCandidate, processQueue } from './src/lib/services/enrichment/lushaService.js';
import { prisma } from './src/lib/prisma.js';

async function testEnqueueCandidate() {
  console.log('🧪 Testing enqueueCandidate...');
  
  const testCandidate = {
    id: `test-${Date.now()}`,
    userId: 'test-user-123',
    firstName: 'John',
    lastName: 'Doe',
    companyName: 'Acme Corp',
    domain: 'acme.com',
    crmId: 'test-crm-id',
    companyHQId: 'test-crm-id',
  };

  try {
    const jobId = await enqueueCandidate(testCandidate);
    console.log('✅ Candidate enqueued:', jobId);
    return true;
  } catch (error) {
    console.error('❌ Error enqueueing candidate:', error);
    return false;
  }
}

async function testProcessQueue() {
  console.log('\n🧪 Testing processQueue...');
  
  try {
    const results = await processQueue();
    console.log('✅ Queue processed:', results);
    return results;
  } catch (error) {
    console.error('❌ Error processing queue:', error);
    return null;
  }
}

async function testCSVParsing() {
  console.log('\n🧪 Testing CSV parsing...');
  
  const csvContent = `firstName,lastName,companyName
John,Doe,Acme Corp
Jane,Smith,Tech Inc
Bob,Johnson,Startup Co`;

  // Simple CSV parser (same as in route)
  function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const firstNameIdx = headers.findIndex((h) => h.includes('first') && h.includes('name'));
    const lastNameIdx = headers.findIndex((h) => h.includes('last') && h.includes('name'));
    const companyIdx = headers.findIndex((h) => h.includes('company'));
    
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim());
      rows.push({
        firstName: values[firstNameIdx],
        lastName: values[lastNameIdx],
        companyName: values[companyIdx],
      });
    }
    return rows;
  }

  const rows = parseCSV(csvContent);
  console.log('✅ Parsed CSV rows:', rows);
  return rows.length === 3;
}

async function main() {
  console.log('🚀 Starting Lusha Hydration Module Tests\n');
  
  // Check environment variables
  const requiredEnvVars = [
    'LUSHA_API_KEY',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    'DATABASE_URL',
  ];
  
  const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);
  if (missingVars.length > 0) {
    console.error('❌ Missing environment variables:', missingVars.join(', '));
    console.log('\nPlease set these in your .env file:');
    missingVars.forEach((varName) => {
      console.log(`  ${varName}=`);
    });
    process.exit(1);
  }

  // Run tests
  const test1 = await testCSVParsing();
  const test2 = await testEnqueueCandidate();
  const test3 = await testProcessQueue();

  console.log('\n📊 Test Results:');
  console.log(`  CSV Parsing: ${test1 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Enqueue Candidate: ${test2 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Process Queue: ${test3 ? '✅ PASS' : '❌ FAIL'}`);

  // Cleanup
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});


