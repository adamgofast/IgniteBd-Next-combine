'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2, Mail, RefreshCw } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';

export default function IntegrationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [microsoftAuth, setMicrosoftAuth] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Check URL params for success/error
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('success') === '1') {
        setSuccess(true);
        // Clear URL params
        window.history.replaceState({}, '', '/settings/integrations');
        // Refresh connection status
        fetchConnectionStatus();
      }
      if (params.get('error')) {
        setError(params.get('error'));
        // Clear URL params
        window.history.replaceState({}, '', '/settings/integrations');
      }
    }
  }, []);

  // Fetch Microsoft connection status
  const fetchConnectionStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/microsoft/status');
      if (response.data.success) {
        setMicrosoftAuth(response.data.microsoftAuth);
      }
    } catch (err) {
      console.error('Failed to fetch Microsoft connection status:', err);
      // Not an error if not connected
      setMicrosoftAuth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnectionStatus();
  }, []);

  // Handle Microsoft connection
  const handleConnectMicrosoft = async () => {
    try {
      setConnecting(true);
      setError(null);
      // Redirect to OAuth login endpoint
      window.location.href = '/api/microsoft/login';
    } catch (err) {
      setError(err.message || 'Failed to initiate Microsoft connection');
      setConnecting(false);
    }
  };

  // Handle disconnect
  const handleDisconnect = async () => {
    try {
      setLoading(true);
      const response = await api.delete('/api/microsoft/disconnect');
      if (response.data.success) {
        setMicrosoftAuth(null);
        setSuccess(false);
      }
    } catch (err) {
      setError(err.message || 'Failed to disconnect Microsoft account');
    } finally {
      setLoading(false);
    }
  };

  // Check if token is expired
  const isTokenExpired = microsoftAuth?.expiresAt
    ? new Date(microsoftAuth.expiresAt) < new Date()
    : false;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Integrations"
          subtitle="Connect your accounts to enhance your workflow"
          backTo="/settings"
          backLabel="Back to Settings"
        />

        {/* Success Message */}
        {success && (
          <div className="mb-6 rounded-lg bg-green-50 border border-green-200 p-4">
            <div className="flex items-center">
              <CheckCircle2 className="h-5 w-5 text-green-600 mr-2" />
              <p className="text-sm font-medium text-green-800">
                Successfully connected to Microsoft!
              </p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4">
            <div className="flex items-center">
              <XCircle className="h-5 w-5 text-red-600 mr-2" />
              <div>
                <p className="text-sm font-medium text-red-800">
                  {error === 'missing_code' && 'Authorization was cancelled or incomplete'}
                  {error === 'invalid_state' && 'Security validation failed. Please try again.'}
                  {error === 'oauth_failed' && 'Failed to complete Microsoft authentication'}
                  {!['missing_code', 'invalid_state', 'oauth_failed'].includes(error) && `Error: ${error}`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Microsoft Integration Card */}
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50">
                  <Mail className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Microsoft Outlook
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Connect your Microsoft account to send outreach emails and sync contacts
                  </p>
                  {microsoftAuth && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center text-sm">
                        {isTokenExpired ? (
                          <>
                            <XCircle className="h-4 w-4 text-red-500 mr-2" />
                            <span className="text-red-600 font-medium">
                              Connection expired - Please reauthorize
                            </span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-green-500 mr-2" />
                            <span className="text-gray-700">
                              Connected as {microsoftAuth.email || 'Microsoft account'}
                            </span>
                          </>
                        )}
                      </div>
                      {microsoftAuth.expiresAt && (
                        <p className="text-xs text-gray-500">
                          Expires: {new Date(microsoftAuth.expiresAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="ml-4">
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                ) : microsoftAuth ? (
                  <div className="flex space-x-2">
                    {isTokenExpired && (
                      <button
                        onClick={handleConnectMicrosoft}
                        disabled={connecting}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {connecting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Connecting...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Reauthorize
                          </>
                        )}
                      </button>
                    )}
                    <button
                      onClick={handleDisconnect}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleConnectMicrosoft}
                    disabled={connecting}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {connecting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Connecting...
                      </>
                    ) : (
                      'Connect Microsoft Account'
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Additional integrations can be added here */}
      </div>
    </div>
  );
}

