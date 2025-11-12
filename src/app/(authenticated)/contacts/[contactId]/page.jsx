'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Phone, Building2, ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
import PageHeader from '@/components/PageHeader.jsx';
import { useContactsContext } from '../layout.jsx';

export default function ContactDetailPage({ params }) {
  const router = useRouter();
  const { contacts, refreshContacts } = useContactsContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [contact, setContact] = useState(null);
  const [contactId, setContactId] = useState(null);

  // Handle params (may be sync or async in Next.js)
  useEffect(() => {
    const resolveParams = async () => {
      if (params && typeof params.then === 'function') {
        // Params is a Promise (Next.js 15+)
        const resolvedParams = await params;
        setContactId(resolvedParams?.contactId);
      } else if (params?.contactId) {
        // Params is an object
        setContactId(params.contactId);
      }
    };
    resolveParams();
  }, [params]);

  useEffect(() => {
    if (!contactId) return;

    let isMounted = true;
    const loadContact = async () => {
      try {
        setLoading(true);
        setError('');
        
        // Try to find in cached contacts first (fast initial render)
        const cachedContact = contacts.find((item) => item.id === contactId);
        if (cachedContact && isMounted) {
          setContact(cachedContact);
          setLoading(false); // Show cached data immediately
        }

        // Fetch fresh data from API
        try {
          const response = await api.get(`/api/contacts/${contactId}`);
          if (!isMounted) return;
          
          if (response.data?.success && response.data.contact) {
            setContact(response.data.contact);
            setLoading(false);
            // Update the contact in the contacts list cache
            if (refreshContacts) {
              refreshContacts();
            }
          } else {
            if (!cachedContact && isMounted) {
              setError(response.data?.error || 'Contact not found.');
              setLoading(false);
            }
          }
        } catch (apiErr) {
          console.error('Error fetching contact from API:', apiErr);
          // If we have cached contact, keep showing it even if API fails
          if (!cachedContact && isMounted) {
            setError('Unable to load contact details.');
            setLoading(false);
          } else if (isMounted) {
            setLoading(false); // We have cached data, just stop loading
          }
        }
      } catch (err) {
        console.error('Error loading contact:', err);
        if (!isMounted) return;
        const cachedContact = contacts.find((item) => item.id === contactId);
        if (!cachedContact) {
          setError('Unable to load contact details.');
          setLoading(false);
        }
      }
    };

    loadContact();
    return () => {
      isMounted = false;
    };
  }, [contactId, contacts, refreshContacts]);

  const [generatingPortal, setGeneratingPortal] = useState(false);
  const [portalLink, setPortalLink] = useState(null);

  const displayName = useMemo(() => {
    if (!contact) return 'Contact';
    return (
      contact.goesBy ||
      [contact.firstName, contact.lastName].filter(Boolean).join(' ') ||
      'Contact'
    );
  }, [contact]);

  const handleGeneratePortalAccess = async () => {
    if (!contact?.id || !contact?.email) {
      alert('Contact must have an email address to generate portal access.');
      return;
    }

    setGeneratingPortal(true);
    try {
      // Let the API interceptor handle the Firebase token automatically
      const response = await api.post(
        `/api/contacts/${contact.id}/generate-portal-access`,
        {}
      );

      if (response.data?.success && response.data.invite) {
        const activationLink = response.data.invite.activationLink || response.data.invite.passwordResetLink;
        setPortalLink(activationLink);
        // Copy to clipboard
        navigator.clipboard.writeText(activationLink);
        alert(`Portal access generated! Activation link copied to clipboard. Send it to ${contact.email}`);
      } else {
        alert(response.data?.error || 'Failed to generate portal access');
      }
    } catch (error) {
      console.error('Error generating portal access:', error);
      alert(error.response?.data?.error || 'Failed to generate portal access');
    } finally {
      setGeneratingPortal(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-16">
        <div className="mx-auto max-w-4xl px-4">
          <div className="rounded-2xl bg-white p-8 text-center shadow">
            <p className="text-lg font-semibold text-gray-800">Loading contact…</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div className="min-h-screen bg-gray-50 py-16">
        <div className="mx-auto max-w-4xl px-4">
          <div className="rounded-2xl bg-white p-8 text-center shadow">
            <p className="text-lg font-semibold text-red-600">
              {error || 'Contact not found.'}
            </p>
            <button
              type="button"
              onClick={() => router.push('/contacts')}
              className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Back to People Hub
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title={displayName}
          subtitle="Full profile, pipeline status, and relationship notes."
          backTo="/contacts/view"
          backLabel="Back to Contacts"
        />

        <div className="mb-6 flex flex-wrap items-center gap-4 text-sm text-gray-500">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-gray-600 shadow hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <span className="rounded-full bg-indigo-50 px-3 py-1 font-semibold text-indigo-600">
            {contact.pipeline?.pipeline || 'Prospect'}
          </span>
          <span className="rounded-full bg-gray-100 px-3 py-1 font-semibold text-gray-600">
            {contact.pipeline?.stage || 'Unassigned Stage'}
          </span>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl bg-white p-6 shadow">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Contact Information
            </h3>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-semibold text-gray-500">Preferred Name</dt>
                <dd className="mt-1 text-base text-gray-900">
                  {contact.goesBy || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-gray-500">Full Name</dt>
                <dd className="mt-1 text-base text-gray-900">
                  {[contact.firstName, contact.lastName].filter(Boolean).join(' ') || '—'}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-gray-400" />
                <div>
                  <dt className="text-sm font-semibold text-gray-500">Email</dt>
                  <dd className="mt-1 text-base text-gray-900">
                    {contact.email || '—'}
                  </dd>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-gray-400" />
                <div>
                  <dt className="text-sm font-semibold text-gray-500">Phone</dt>
                  <dd className="mt-1 text-base text-gray-900">
                    {contact.phone || '—'}
                  </dd>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-gray-400" />
                <div>
                  <dt className="text-sm font-semibold text-gray-500">Company</dt>
                  <dd className="mt-1 text-base text-gray-900">
                    {contact.contactCompany?.companyName || '—'}
                  </dd>
                </div>
              </div>
              <div>
                <dt className="text-sm font-semibold text-gray-500">Title</dt>
                <dd className="mt-1 text-base text-gray-900">
                  {contact.title || '—'}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Notes</h3>
            <p className="text-sm text-gray-600">
              {contact.notes || 'Add notes from meetings, emails, and relationship updates.'}
            </p>
          </section>

          {/* Client Portal Access */}
          {contact.email && (
            <section className="rounded-2xl bg-white p-6 shadow">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">Client Portal Access</h3>
              <p className="mb-4 text-sm text-gray-600">
                Generate portal access for this contact. They'll receive a password reset link to set up their account and access proposals and deliverables.
              </p>
              {portalLink ? (
                <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                  <p className="text-sm font-semibold text-green-800 mb-2">Portal access generated!</p>
                  <p className="text-xs text-green-700 mb-3">Password reset link copied to clipboard. Send it to {contact.email}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(portalLink);
                        alert('Link copied to clipboard!');
                      }}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
                    >
                      Copy Link Again
                    </button>
                    <a
                      href={`mailto:${contact.email}?subject=Client Portal Access&body=Click this link to set up your client portal password: ${portalLink}`}
                      className="rounded-lg bg-white border border-green-600 px-4 py-2 text-sm font-semibold text-green-600 transition hover:bg-green-50"
                    >
                      Email Link
                    </a>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleGeneratePortalAccess}
                  disabled={generatingPortal}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generatingPortal ? 'Generating...' : 'Generate Portal Access'}
                </button>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
