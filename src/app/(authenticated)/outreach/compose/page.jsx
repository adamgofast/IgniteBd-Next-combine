'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Mail, Loader2, CheckCircle2, Clock, Eye, MousePointerClick } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';
import { useOwner } from '@/hooks/useOwner';

export default function ComposePage() {
  const router = useRouter();
  const { ownerId } = useOwner();
  
  // Form state
  const [to, setTo] = useState('');
  const [toName, setToName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [contactId, setContactId] = useState('');
  const [tenantId, setTenantId] = useState('');
  
  // UI state
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [recentSends, setRecentSends] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  
  // Sender info (read-only, prefilled)
  const senderEmail = process.env.NEXT_PUBLIC_SENDGRID_FROM_EMAIL || 'adam@ignitestrategies.co';
  const senderName = process.env.NEXT_PUBLIC_SENDGRID_FROM_NAME || 'Adam - Ignite Strategies';

  // Load recent sends
  useEffect(() => {
    if (ownerId) {
      loadRecentSends();
    }
  }, [ownerId]);

  const loadRecentSends = async () => {
    try {
      setLoadingRecent(true);
      const response = await api.get(`/api/outreach/recent?limit=5`);
      if (response.data.success) {
        setRecentSends(response.data.emailActivities || []);
      }
    } catch (err) {
      console.error('Failed to load recent sends:', err);
    } finally {
      setLoadingRecent(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    
    if (!to || !subject || !body) {
      setError('Please fill in all required fields');
      return;
    }

    if (!ownerId) {
      setError('Owner ID not found. Please refresh the page.');
      return;
    }

    setSending(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await api.post('/api/outreach/send', {
        to,
        toName: toName || undefined,
        subject,
        body,
        contactId: contactId || undefined,
        tenantId: tenantId || undefined,
      });

      if (response.data.success) {
        setSuccess(true);
        // Clear form
        setTo('');
        setToName('');
        setSubject('');
        setBody('');
        setContactId('');
        setTenantId('');
        
        // Reload recent sends
        await loadRecentSends();
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(response.data.error || 'Failed to send email');
      }
    } catch (err) {
      console.error('Send error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  const getEventIcon = (event) => {
    switch (event) {
      case 'delivered':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'opened':
        return <Eye className="h-4 w-4 text-blue-600" />;
      case 'clicked':
        return <MousePointerClick className="h-4 w-4 text-purple-600" />;
      case 'bounce':
      case 'dropped':
        return <Mail className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getEventLabel = (event) => {
    switch (event) {
      case 'sent':
        return 'Sent';
      case 'delivered':
        return 'Delivered';
      case 'opened':
        return 'Opened';
      case 'clicked':
        return 'Clicked';
      case 'bounce':
        return 'Bounced';
      case 'dropped':
        return 'Dropped';
      default:
        return event || 'Pending';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Compose Outreach Email"
          subtitle="Send 1-to-1 personalized emails via SendGrid"
          backTo="/outreach"
          backLabel="Back to Outreach"
        />

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left Column: Compose Form */}
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Compose Email</h2>
              
              {success && (
                <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-3 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <p className="text-sm font-medium text-green-900">✅ Email sent successfully!</p>
                </div>
              )}

              {error && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3">
                  <p className="text-sm font-medium text-red-900">{error}</p>
                </div>
              )}

              <form onSubmit={handleSend} className="space-y-4">
                {/* Sender (Read-only) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    From
                  </label>
                  <div className="rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                    {senderName} &lt;{senderEmail}&gt;
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Verified sender identity (read-only)
                  </p>
                </div>

                {/* To */}
                <div>
                  <label htmlFor="to" className="block text-sm font-medium text-gray-700 mb-1">
                    To <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="to"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    required
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    placeholder="prospect@example.com"
                  />
                </div>

                {/* To Name (Optional) */}
                <div>
                  <label htmlFor="toName" className="block text-sm font-medium text-gray-700 mb-1">
                    Recipient Name (Optional)
                  </label>
                  <input
                    type="text"
                    id="toName"
                    value={toName}
                    onChange={(e) => setToName(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    placeholder="John Doe"
                  />
                </div>

                {/* Subject */}
                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
                    Subject <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    placeholder="Quick intro"
                  />
                </div>

                {/* Body */}
                <div>
                  <label htmlFor="body" className="block text-sm font-medium text-gray-700 mb-1">
                    Message <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    required
                    rows={10}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    placeholder="Hey, saw your work on..."
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    HTML is supported. Plain text will be auto-formatted.
                  </p>
                </div>

                {/* Optional Fields */}
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-medium text-gray-700 mb-3">Optional Tracking Fields</p>
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="contactId" className="block text-xs font-medium text-gray-600 mb-1">
                        Contact ID
                      </label>
                      <input
                        type="text"
                        id="contactId"
                        value={contactId}
                        onChange={(e) => setContactId(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                        placeholder="c_123"
                      />
                    </div>
                    <div>
                      <label htmlFor="tenantId" className="block text-xs font-medium text-gray-600 mb-1">
                        Tenant ID
                      </label>
                      <input
                        type="text"
                        id="tenantId"
                        value={tenantId}
                        onChange={(e) => setTenantId(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                        placeholder="t_001"
                      />
                    </div>
                  </div>
                </div>

                {/* Send Button */}
                <div className="flex justify-end pt-4">
                  <button
                    type="submit"
                    disabled={sending || !ownerId}
                    className="inline-flex items-center gap-2 rounded-md bg-red-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Send Email
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right Column: Recent Sends */}
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Recent Sends</h2>
              
              {loadingRecent ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : recentSends.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center">
                  <Mail className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No emails sent yet</p>
                  <p className="text-xs text-gray-400 mt-1">Your sent emails will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentSends.map((activity) => (
                    <div
                      key={activity.id}
                      className="rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{activity.email}</p>
                          <p className="text-xs text-gray-600 mt-1">{activity.subject}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getEventIcon(activity.event)}
                          <span className="text-xs font-medium text-gray-600">
                            {getEventLabel(activity.event)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>
                          {new Date(activity.createdAt).toLocaleDateString()} at{' '}
                          {new Date(activity.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {activity.contactId && (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
                            Contact: {activity.contactId}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

