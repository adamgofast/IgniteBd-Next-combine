'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import api from '@/lib/api';
import { inferCompanyNameFromEmail, inferWebsiteFromEmail } from '@/lib/services/CompanyEnrichmentService';
import { useOwner } from '@/hooks/useOwner';

export default function ProfileSetupPage() {
  const router = useRouter();
  const { owner, companyHQId, refresh } = useOwner();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
  });
  const [loading, setLoading] = useState(false);

  // Pre-fill form if owner data is available
  useEffect(() => {
    if (owner?.name) {
      const nameParts = owner.name.split(' ');
      if (nameParts.length >= 2) {
        setFormData({
          firstName: nameParts[0],
          lastName: nameParts.slice(1).join(' '),
        });
      } else if (nameParts.length === 1) {
        setFormData({
          firstName: nameParts[0],
          lastName: '',
        });
      }
    }
  }, [owner]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);

    try {
      const ownerId =
        localStorage.getItem('ownerId') || localStorage.getItem('adminId');

      if (!ownerId) {
        alert('No owner ID found. Please sign up again.');
        router.replace('/signup');
        return;
      }

      const name = `${formData.firstName} ${formData.lastName}`.trim();

      // Update profile
      await api.put(`/api/owner/${ownerId}/profile`, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        name,
      });

      // Refresh owner data
      await refresh();

      // Check if company exists (check localStorage after refresh)
      const existingCompanyId = localStorage.getItem('companyHQId');
      
      if (!existingCompanyId) {
        const firebaseUser = getAuth().currentUser;
        // Get fresh owner data from localStorage after refresh
        const storedOwner = localStorage.getItem('owner');
        const currentOwner = storedOwner ? JSON.parse(storedOwner) : owner;
        const ownerEmail = currentOwner?.email || firebaseUser?.email;
        const ownerName = name || currentOwner?.name || '';

        // Infer company name from email if available
        let inferredCompanyName = 'My Company';
        if (ownerEmail) {
          inferredCompanyName = inferCompanyNameFromEmail(ownerEmail) || 'My Company';
        }
        if (inferredCompanyName === 'My Company' && ownerName) {
          inferredCompanyName = `${ownerName}'s Company`;
        }

        // Infer website from email
        const inferredWebsite = ownerEmail ? inferWebsiteFromEmail(ownerEmail) : null;

        // Create company using upsert endpoint
        const companyData = {
          companyName: inferredCompanyName,
          whatYouDo: 'Business development and growth services',
          companyWebsite: inferredWebsite || null,
          teamSize: 'just-me',
        };

        const companyResponse = await api.put('/api/company/upsert', companyData);
        
        if (companyResponse.data?.success && companyResponse.data?.companyHQ) {
          const companyHQ = companyResponse.data.companyHQ;
          localStorage.setItem('companyHQId', companyHQ.id);
          localStorage.setItem('companyHQ', JSON.stringify(companyHQ));
        }
      }

      // Refresh owner data one more time
      await refresh();

      // Redirect to dashboard
      router.push('/growth-dashboard');
    } catch (error) {
      console.error('Profile setup error:', error);
      alert('Profile setup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <Image
            src="/logo.png"
            alt="Ignite Strategies"
            width={64}
            height={64}
            className="mx-auto mb-6 h-16 w-16 object-contain"
            priority
          />
          <h1 className="text-4xl font-bold text-white mb-4">
            Let&apos;s Set Up Your Profile
          </h1>
          <p className="text-white/80 text-lg">We need your name to get started</p>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl p-8 border border-white/20">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="firstName"
                  className="block text-sm font-medium text-white mb-2"
                >
                  First Name *
                </label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Enter your first name"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="lastName"
                  className="block text-sm font-medium text-white mb-2"
                >
                  Last Name *
                </label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Enter your last name"
                  required
                />
              </div>
            </div>

            <div className="flex gap-4 pt-6">
              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white font-bold rounded-xl hover:shadow-lg transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Setting up…' : 'Continue →'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

