'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2, Mail, Settings as SettingsIcon, Plug2, ArrowRight, User, Building2, Save } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';
import { useCompanyHQ } from '@/hooks/useCompanyHQ';

export default function SettingsPage() {
  const router = useRouter();
  const { companyHQ, refresh: refreshCompany } = useCompanyHQ();
  const [loading, setLoading] = useState(true);
  const [microsoftAuth, setMicrosoftAuth] = useState(null);
  const [error, setError] = useState(null);
  
  // Profile form state
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
  });
  const [ownerId, setOwnerId] = useState(null);
  
  // Company form state
  const [companyLoading, setCompanyLoading] = useState(false);
  const [companyData, setCompanyData] = useState({
    companyName: '',
    whatYouDo: '',
    companyStreet: '',
    companyCity: '',
    companyState: '',
    companyWebsite: '',
    companyIndustry: '',
    companyAnnualRev: '',
    yearsInBusiness: '',
    teamSize: '',
  });

  // Fetch owner and company data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // Fetch owner data
        const ownerResponse = await api.get('/api/owner/hydrate');
        if (ownerResponse.data.success) {
          const owner = ownerResponse.data.owner;
          setOwnerId(owner.id);
          setProfileData({
            name: owner.name || '',
            email: owner.email || '',
          });
          
          // Set company data if available
          if (owner.companyHQ) {
            setCompanyData({
              companyName: owner.companyHQ.companyName || '',
              whatYouDo: owner.companyHQ.whatYouDo || '',
              companyStreet: owner.companyHQ.companyStreet || '',
              companyCity: owner.companyHQ.companyCity || '',
              companyState: owner.companyHQ.companyState || '',
              companyWebsite: owner.companyHQ.companyWebsite || '',
              companyIndustry: owner.companyHQ.companyIndustry || '',
              companyAnnualRev: owner.companyHQ.companyAnnualRev?.toString() || '',
              yearsInBusiness: owner.companyHQ.yearsInBusiness?.toString() || '',
              teamSize: owner.companyHQ.teamSize || '',
            });
          }
        }
        
        // Fetch Microsoft connection status
        await fetchConnectionStatus();
      } catch (err) {
        console.error('Failed to load settings data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Fetch Microsoft connection status
  const fetchConnectionStatus = async () => {
    try {
      const response = await api.get('/api/microsoft/status');
      if (response.data.success) {
        setMicrosoftAuth(response.data.microsoftAuth);
      }
    } catch (err) {
      console.error('Failed to fetch Microsoft connection status:', err);
      setMicrosoftAuth(null);
    }
  };

  // Handle Microsoft connection
  const handleConnectMicrosoft = () => {
    window.location.href = '/api/microsoft/login';
  };

  // Handle profile update
  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    if (!ownerId || profileLoading) return;

    try {
      setProfileLoading(true);
      setError(null);
      
      const response = await api.put(`/api/owner/${ownerId}/profile`, {
        name: profileData.name,
        email: profileData.email,
      });

      if (response.data.success) {
        // Refresh owner data
        const ownerResponse = await api.get('/api/owner/hydrate');
        if (ownerResponse.data.success) {
          const owner = ownerResponse.data.owner;
          if (typeof window !== 'undefined') {
            localStorage.setItem('owner', JSON.stringify(owner));
          }
        }
        alert('Profile updated successfully!');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile');
      console.error('Profile update error:', err);
    } finally {
      setProfileLoading(false);
    }
  };

  // Handle company update
  const handleCompanyUpdate = async (e) => {
    e.preventDefault();
    if (!companyHQ?.id || companyLoading) return;

    try {
      setCompanyLoading(true);
      setError(null);
      
      const response = await api.put(`/api/company/${companyHQ.id}`, {
        companyName: companyData.companyName,
        whatYouDo: companyData.whatYouDo,
        companyStreet: companyData.companyStreet,
        companyCity: companyData.companyCity,
        companyState: companyData.companyState,
        companyWebsite: companyData.companyWebsite,
        companyIndustry: companyData.companyIndustry,
        companyAnnualRev: companyData.companyAnnualRev ? parseFloat(companyData.companyAnnualRev) : null,
        yearsInBusiness: companyData.yearsInBusiness ? parseInt(companyData.yearsInBusiness) : null,
        teamSize: companyData.teamSize || null,
      });

      if (response.data.success) {
        // Refresh company data
        await refreshCompany();
        if (typeof window !== 'undefined') {
          localStorage.setItem('companyHQ', JSON.stringify(response.data.companyHQ));
        }
        alert('Company updated successfully!');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update company');
      console.error('Company update error:', err);
    } finally {
      setCompanyLoading(false);
    }
  };

  // Check if token is expired
  const isTokenExpired = microsoftAuth?.expiresAt
    ? new Date(microsoftAuth.expiresAt) < new Date()
    : false;

  const isConnected = microsoftAuth && !isTokenExpired;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Workspace Settings"
          subtitle="Manage company profile, billing, integrations, and preferences."
          backTo="/growth-dashboard"
          backLabel="Back to Growth Dashboard"
        />

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4">
            <div className="flex items-center">
              <XCircle className="h-5 w-5 text-red-600 mr-2" />
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          </div>
        )}

        <div className="mt-8 space-y-6">
          {/* Profile Section */}
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center">
                <User className="h-5 w-5 text-gray-600 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
              </div>
            </div>
            <div className="p-6">
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                    placeholder="your@email.com"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={profileLoading}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {profileLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Profile
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Company Section */}
          {companyHQ && (
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center">
                  <Building2 className="h-5 w-5 text-gray-600 mr-2" />
                  <h2 className="text-lg font-semibold text-gray-900">Company</h2>
                </div>
              </div>
              <div className="p-6">
                <form onSubmit={handleCompanyUpdate} className="space-y-4">
                  <div>
                    <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
                      Company Name *
                    </label>
                    <input
                      type="text"
                      id="companyName"
                      required
                      value={companyData.companyName}
                      onChange={(e) => setCompanyData({ ...companyData, companyName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="whatYouDo" className="block text-sm font-medium text-gray-700 mb-1">
                      What You Do
                    </label>
                    <textarea
                      id="whatYouDo"
                      rows={3}
                      value={companyData.whatYouDo}
                      onChange={(e) => setCompanyData({ ...companyData, whatYouDo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                      placeholder="Describe what your company does"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="companyStreet" className="block text-sm font-medium text-gray-700 mb-1">
                        Street Address
                      </label>
                      <input
                        type="text"
                        id="companyStreet"
                        value={companyData.companyStreet}
                        onChange={(e) => setCompanyData({ ...companyData, companyStreet: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="companyCity" className="block text-sm font-medium text-gray-700 mb-1">
                        City
                      </label>
                      <input
                        type="text"
                        id="companyCity"
                        value={companyData.companyCity}
                        onChange={(e) => setCompanyData({ ...companyData, companyCity: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="companyState" className="block text-sm font-medium text-gray-700 mb-1">
                        State
                      </label>
                      <input
                        type="text"
                        id="companyState"
                        value={companyData.companyState}
                        onChange={(e) => setCompanyData({ ...companyData, companyState: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="companyWebsite" className="block text-sm font-medium text-gray-700 mb-1">
                        Website
                      </label>
                      <input
                        type="url"
                        id="companyWebsite"
                        value={companyData.companyWebsite}
                        onChange={(e) => setCompanyData({ ...companyData, companyWebsite: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                        placeholder="https://example.com"
                      />
                    </div>
                    <div>
                      <label htmlFor="companyIndustry" className="block text-sm font-medium text-gray-700 mb-1">
                        Industry
                      </label>
                      <input
                        type="text"
                        id="companyIndustry"
                        value={companyData.companyIndustry}
                        onChange={(e) => setCompanyData({ ...companyData, companyIndustry: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="companyAnnualRev" className="block text-sm font-medium text-gray-700 mb-1">
                        Annual Revenue
                      </label>
                      <input
                        type="number"
                        id="companyAnnualRev"
                        value={companyData.companyAnnualRev}
                        onChange={(e) => setCompanyData({ ...companyData, companyAnnualRev: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label htmlFor="yearsInBusiness" className="block text-sm font-medium text-gray-700 mb-1">
                        Years in Business
                      </label>
                      <input
                        type="number"
                        id="yearsInBusiness"
                        value={companyData.yearsInBusiness}
                        onChange={(e) => setCompanyData({ ...companyData, yearsInBusiness: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label htmlFor="teamSize" className="block text-sm font-medium text-gray-700 mb-1">
                        Team Size
                      </label>
                      <select
                        id="teamSize"
                        value={companyData.teamSize}
                        onChange={(e) => setCompanyData({ ...companyData, teamSize: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                      >
                        <option value="">Select team size</option>
                        <option value="just-me">Just me</option>
                        <option value="2-10">2-10</option>
                        <option value="11-50">11-50</option>
                        <option value="51-200">51-200</option>
                        <option value="200+">200+</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={companyLoading}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {companyLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Company
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Integrations Section */}
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center">
                <Plug2 className="h-5 w-5 text-gray-600 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900">Integrations</h2>
              </div>
            </div>
            
            <div className="p-6">
              {/* Microsoft Integration */}
              <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                <div className="flex items-center space-x-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                    <Mail className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">
                      Microsoft Outlook
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {isConnected 
                        ? `Connected as ${microsoftAuth.email || 'Microsoft account'}`
                        : 'Connect your Microsoft account to send outreach emails'
                      }
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  {isConnected ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <button
                        onClick={() => router.push('/settings/integrations')}
                        className="text-sm text-gray-600 hover:text-gray-900 font-medium"
                      >
                        Manage
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleConnectMicrosoft}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                    >
                      Connect with Microsoft
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
