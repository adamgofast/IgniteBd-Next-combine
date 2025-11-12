/**
 * Quick test script for proposal approval with Firebase portal access generation
 * 
 * Usage:
 * 1. Get a proposal ID from your database
 * 2. Get your Firebase auth token (from browser localStorage.getItem('firebaseToken'))
 * 3. Update PROPOSAL_ID and FIREBASE_TOKEN below
 * 4. Run: node test-proposal-approve.js
 */

const PROPOSAL_ID = 'YOUR_PROPOSAL_ID_HERE';
const FIREBASE_TOKEN = 'YOUR_FIREBASE_TOKEN_HERE';
const API_URL = 'http://localhost:3000'; // or your deployed URL

async function testProposalApprove() {
  try {
    const response = await fetch(`${API_URL}/api/proposals/${PROPOSAL_ID}/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIREBASE_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    
    console.log('\n✅ Response Status:', response.status);
    console.log('\n📦 Response Data:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.portalAccess?.success) {
      console.log('\n🎉 SUCCESS! Portal access generated:');
      console.log('📧 Contact Email:', data.portalAccess.contactEmail);
      console.log('🔗 Password Reset Link:', data.portalAccess.passwordResetLink);
      console.log('🌐 Login URL:', data.portalAccess.loginUrl);
    } else if (data.portalAccess) {
      console.log('\n⚠️ Portal access generation failed:');
      console.log('❌ Error:', data.portalAccess.error);
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

testProposalApprove();

