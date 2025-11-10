'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2, Mail, Plug2, ArrowRight, User, Building2, Save, ChevronRight } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';
import { useOwner } from '@/hooks/useOwner';

export default function SettingsPage() {
  const router = useRouter();
  const { owner, ownerId, companyHQ, companyHQId, refresh: refreshOwner } = useOwner();
  const [microsoftAuth, setMicrosoftAuth] = useState(null);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState(null); // 'profile' | 'company' | 'integrations' | null
  
  // Profile form state
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
  });
  
  // Company form state
  const [companyLoading, setCompanyLoading] = useState(false);
  const [companyData, setCompanyData] = useState({
    companyName: 'GoFast',
    whatYouDo: '',
    companyStreet: '2614 N. George Mason Dr.',
    companyCity: 'Arlington',
    companyState: 'VA',
    companyWebsite: 'gofastcrushgoals.com',
    companyIndustry: '',
    companyAnnualRev: '',
    yearsInBusiness: '',
    teamSize: '',
  });

  // Load data from owner hook (uses localStorage + hydration)
  useEffect(() => {
    // Load profile data from owner
    if (owner) {
      setProfileData({
        name: owner.name || '',
        email: owner.email || '',
      });
    }
    
    // Load company data from companyHQ object
    if (companyHQ) {
      setCompanyData({
        companyName: companyHQ.companyName || '',
        whatYouDo: companyHQ.whatYouDo || '',
        companyStreet: companyHQ.companyStreet || '',
        companyCity: companyHQ.companyCity || '',
        companyState: companyHQ.companyState || '',
        companyWebsite: companyHQ.companyWebsite || '',
        companyIndustry: companyHQ.companyIndustry || '',
        companyAnnualRev: companyHQ.companyAnnualRev?.toString() || '',
        yearsInBusiness: companyHQ.yearsInBusiness?.toString() || '',
        teamSize: companyHQ.teamSize || '',
      });
    }
    
    // Fetch Microsoft integration status (checks by ownerId via API)
    if (ownerId) {
      fetchConnectionStatus();
    }
  }, [owner, companyHQ, ownerId]);

  // Fetch Microsoft connection status (non-blocking)
  const fetchConnectionStatus = async () => {
    try {
      const response = await api.get('/api/microsoft/status');
      if (response.data.success) {
        setMicrosoftAuth(response.data.microsoftAuth);
      }
    } catch (err) {
      // Not an error if not connected
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
        // Refresh owner data to update localStorage
        await refreshOwner();
        alert('Profile updated successfully!');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setProfileLoading(false);
    }
  };

  // Handle company upsert (create or update)
  const handleCompanyUpdate = async (e) => {
    e.preventDefault();
    if (companyLoading) return;

    try {
      setCompanyLoading(true);
      setError(null);
      
      const response = await api.put('/api/company/upsert', {
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
        // Refresh owner data to update localStorage with new company
        await refreshOwner();
        const action = response.data.created ? 'created' : 'updated';
        alert(`Company ${action} successfully!`);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save company');
    } finally {
      setCompanyLoading(false);
    }
  };

  // Check if token is expired
  const isTokenExpired = microsoftAuth?.expiresAt
    ? new Date(microsoftAuth.expiresAt) < new Date()
    : false;

  const isConnected = microsoftAuth && !isTokenExpired;

  // If a section is active, show the form
  if (activeSection) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <button
              onClick={() => setActiveSection(null)}
              className="text-sm text-gray-600 hover:text-gray-900 mb-4 inline-flex items-center"
            >
              <ArrowRight className="h-4 w-4 mr-1 rotate-180" />
              Back to Settings
            </button>
            <PageHeader
              title={activeSection === 'profile' ? 'Update Profile' : activeSection === 'company' ? 'Update Company' : 'Integrations'}
              subtitle={activeSection === 'profile' ? 'Update your personal information' : activeSection === 'company' ? 'Manage your company profile' : 'Connect your accounts'}
            />
          </div>

          {error && (
            <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4">
              <div className="flex items-center">
                <XCircle className="h-5 w-5 text-red-600 mr-2" />
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            </div>
          )}

          {/* Profile Form */}
          {activeSection === 'profile' && (
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
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
                      disabled={profileLoading || !ownerId}
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
          )}

          {/* Company Form */}
          {activeSection === 'company' && (
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
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

          {/* Integrations View */}
          {activeSection === 'integrations' && (
            <div className="space-y-6">
              {/* Microsoft Outlook Integration */}
              <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="p-6">
                  <div className="flex items-start space-x-6">
                    {/* Microsoft Logo */}
                    <div className="flex-shrink-0">
                      <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-gray-50 border border-gray-200">
                        <svg className="h-12 w-12" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect x="0" y="0" width="10.5" height="10.5" fill="#F25022"/>
                          <rect x="12.5" y="0" width="10.5" height="10.5" fill="#7FBA00"/>
                          <rect x="0" y="12.5" width="10.5" height="10.5" fill="#00A4EF"/>
                          <rect x="12.5" y="12.5" width="10.5" height="10.5" fill="#FFB900"/>
                        </svg>
                      </div>
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        Microsoft Outlook
                      </h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Connect your Microsoft account to send outreach emails directly from IgniteGrowth.
                      </p>
                      
                      {isConnected ? (
                        <div className="space-y-4">
                          <div className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-green-900">
                                Connected
                              </p>
                              <p className="text-xs text-green-700">
                                {microsoftAuth.displayName || microsoftAuth.email || 'Microsoft account connected'}
                              </p>
                            </div>
                          </div>
                          <div className="flex space-x-3">
                            <button
                              onClick={() => router.push('/settings/integrations')}
                              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            >
                              Manage Connection
                            </button>
                            <button
                              onClick={handleConnectMicrosoft}
                              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            >
                              Reauthorize
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <button
                            onClick={handleConnectMicrosoft}
                            className="w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors shadow-sm"
                          >
                            <svg className="h-5 w-5 mr-2" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <rect x="0" y="0" width="10.5" height="10.5" fill="#F25022"/>
                              <rect x="12.5" y="0" width="10.5" height="10.5" fill="#7FBA00"/>
                              <rect x="0" y="12.5" width="10.5" height="10.5" fill="#00A4EF"/>
                              <rect x="12.5" y="12.5" width="10.5" height="10.5" fill="#FFB900"/>
                            </svg>
                            Connect with Microsoft
                            <ArrowRight className="h-5 w-5 ml-2" />
                          </button>
                          <p className="text-xs text-gray-500 text-center">
                            You'll be redirected to Microsoft to authorize the connection
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Future integrations */}
              <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                <Plug2 className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-600 mb-1">More integrations coming soon</p>
                <p className="text-xs text-gray-500">We're working on adding more integrations to enhance your workflow</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Main settings dashboard view
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Settings"
          subtitle="Welcome to your settings. What would you like to change?"
          backTo="/growth-dashboard"
          backLabel="Back to Growth Dashboard"
        />

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Profile Card */}
          <button
            onClick={() => setActiveSection('profile')}
            className="group relative rounded-lg border-2 border-gray-200 bg-white p-6 shadow-sm hover:border-red-300 hover:shadow-md transition-all text-left"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-50 group-hover:bg-red-100 transition-colors mb-4">
                  <User className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Profile
                </h3>
                <p className="text-sm text-gray-500">
                  Update your name and email address
                </p>
                {profileData.name && (
                  <p className="text-xs text-gray-400 mt-2">
                    Current: {profileData.name}
                  </p>
                )}
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-red-600 transition-colors" />
            </div>
          </button>

          {/* Company Card */}
          <button
            onClick={() => setActiveSection('company')}
            className="group relative rounded-lg border-2 border-gray-200 bg-white p-6 shadow-sm hover:border-blue-300 hover:shadow-md transition-all text-left"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 group-hover:bg-blue-100 transition-colors mb-4">
                  <Building2 className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Company
                </h3>
                <p className="text-sm text-gray-500">
                  {companyHQ ? 'Update your company information' : 'Create your company profile'}
                </p>
                {companyHQ && companyData.companyName && (
                  <p className="text-xs text-gray-400 mt-2">
                    Current: {companyData.companyName}
                  </p>
                )}
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
            </div>
          </button>

          {/* Integrations Card */}
          <button
            onClick={() => setActiveSection('integrations')}
            className="group relative rounded-lg border-2 border-gray-200 bg-white p-6 shadow-sm hover:border-purple-300 hover:shadow-md transition-all text-left md:col-span-2"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-50 group-hover:bg-purple-100 transition-colors mb-4">
                  <Plug2 className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Integrations
                </h3>
                <p className="text-sm text-gray-500">
                  Connect your accounts to enhance your workflow
                </p>
                {isConnected && (
                  <div className="flex items-center mt-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mr-1" />
                    <p className="text-xs text-gray-400">
                      Microsoft Outlook connected
                    </p>
                  </div>
                )}
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-purple-600 transition-colors" />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
