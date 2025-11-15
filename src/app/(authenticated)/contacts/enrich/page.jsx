'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload,
  Search,
  Mail,
  Sparkles,
  X,
  Check,
  ArrowRight,
  FileSpreadsheet,
  RefreshCw,
  Linkedin,
  User,
  CheckCircle,
} from 'lucide-react';
import api from '@/lib/api';

export default function EnrichPage() {
  const router = useRouter();
  const [companyHQId, setCompanyHQId] = useState('');
  const [mode, setMode] = useState('search'); // 'search', 'csv', 'microsoft', 'existing'
  const [searchLinkedInUrl, setSearchLinkedInUrl] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundContact, setFoundContact] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [enrichedProfile, setEnrichedProfile] = useState(null);
  const [rawApolloResponse, setRawApolloResponse] = useState(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [redisKey, setRedisKey] = useState(null); // Redis key where data is stored
  const [csvFile, setCsvFile] = useState(null);
  const [csvContacts, setCsvContacts] = useState([]);
  const [microsoftContacts, setMicrosoftContacts] = useState([]);
  const [loadingMicrosoft, setLoadingMicrosoft] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState(new Set());
  const [searchEmail, setSearchEmail] = useState(''); // For "existing" mode only

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedCompanyHQId =
      window.localStorage.getItem('companyHQId') ||
      window.localStorage.getItem('companyId') ||
      '';
    setCompanyHQId(storedCompanyHQId);
  }, []);


  // Search for LinkedIn profile (external only - NO DB lookup)
  // This function is ONLY for LinkedIn search mode (mode === 'search')
  // It NEVER calls /api/contacts/by-email or any internal CRM lookups
  const handleSearchContact = useCallback(async () => {
    // Ensure we're in LinkedIn search mode
    if (mode !== 'search') {
      console.error('handleSearchContact should only be called in search mode');
      return;
    }

    if (!searchLinkedInUrl || !searchLinkedInUrl.includes('linkedin.com')) {
      alert('Please enter a valid LinkedIn URL');
      return;
    }

    setSearching(true);
    setPreviewData(null);
    setEnrichedProfile(null);
    setRawApolloResponse(null);
    setShowRawJson(false);
    setFoundContact(null);

    try {
      // Use EXTERNAL preview endpoint ONLY (NO DB lookup, NO internal CRM search)
      // This person does NOT exist in CRM yet - they are external
      // We do NOT call /api/contacts/by-email here - this is purely external
      const previewResponse = await api.post('/api/enrich/preview', {
        linkedinUrl: searchLinkedInUrl,
        // DO NOT pass companyHQId or email - this is external lookup only
      });

      if (previewResponse.data?.success && previewResponse.data.preview) {
        setPreviewData(previewResponse.data.preview);
        // Use preview data to populate foundContact (external person, no contactId)
        // IMPORTANT: id is ALWAYS null for LinkedIn search (external lookup only)
        setFoundContact({
          email: previewResponse.data.preview.email || null, // May be null from MATCH endpoint
          linkedinUrl: searchLinkedInUrl,
          firstName: previewResponse.data.preview.firstName,
          lastName: previewResponse.data.preview.lastName,
          title: previewResponse.data.preview.title,
          companyName: previewResponse.data.preview.companyName,
          id: null, // ALWAYS null - does NOT exist in CRM - user must choose to save
        });
      } else {
        // No preview data, just use placeholder
        setFoundContact({
          email: null,
          linkedinUrl: searchLinkedInUrl,
          id: null, // ALWAYS null for external lookup
        });
      }
    } catch (previewError) {
      console.error('Preview fetch error:', previewError);
      // Preview failed, continue with placeholder
      setFoundContact({
        email: null,
        linkedinUrl: searchLinkedInUrl,
        id: null, // ALWAYS null for external lookup
      });
      // Show error to user
      if (previewError.response?.data?.details) {
        alert(`Preview failed: ${previewError.response.data.details}`);
      } else if (previewError.message) {
        alert(`Preview failed: ${previewError.message}`);
      }
    } finally {
      setSearching(false);
    }
  }, [searchLinkedInUrl, mode]); // NO companyHQId needed for external preview

  // Handle CSV file upload
  const handleCsvFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (
      file.type !== 'text/csv' &&
      !file.name.toLowerCase().endsWith('.csv')
    ) {
      alert('Please select a CSV file.');
      return;
    }

    setCsvFile(file);
    parseCSV(file);
  };

  const parseCSV = async (file) => {
    const text = await file.text();
    const lines = text.trim().split('\n');
    if (lines.length < 2) {
      alert('CSV file must contain at least a header row and one data row');
      return;
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const emailIdx = headers.findIndex((h) => h.includes('email'));

    if (emailIdx === -1) {
      alert('CSV must contain an email column');
      return;
    }

    const contacts = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim());
      const email = values[emailIdx];
      if (email && email.includes('@')) {
        contacts.push({
          email,
          id: null, // Will be found or created during enrichment
        });
      }
    }

    setCsvContacts(contacts);
  };

  // Get contacts from Microsoft Graph
  const handleGetMicrosoftContacts = useCallback(async () => {
    setLoadingMicrosoft(true);
    try {
      // Check if user is authenticated with Microsoft
      const statusResponse = await api.get('/api/microsoft/status');
      
      if (!statusResponse.data?.isAuthenticated) {
        // Redirect to Microsoft login
        window.location.href = '/api/microsoft/login';
        return;
      }

      // Fetch contacts from Microsoft Graph
      const contactsResponse = await api.get('/api/microsoft-graph/contacts');
      
      if (contactsResponse.data?.success) {
        const contacts = (contactsResponse.data.contacts || []).map((contact) => {
          // Extract email from Microsoft Graph contact format
          const emailAddress = contact.emailAddresses?.[0]?.address || 
                               contact.mail || 
                               contact.userPrincipalName;
          
          if (!emailAddress) return null;

          return {
            email: emailAddress,
            firstName: contact.givenName || contact.firstName,
            lastName: contact.surname || contact.lastName,
            company: contact.companyName,
            title: contact.jobTitle,
            id: null, // Will be found or created during enrichment
          };
        }).filter(Boolean);

        setMicrosoftContacts(contacts);
        setMode('microsoft');
      }
    } catch (error) {
      console.error('Error fetching Microsoft contacts:', error);
      alert('Failed to fetch Microsoft contacts. Please try again.');
    } finally {
      setLoadingMicrosoft(false);
    }
  }, []);

  // Toggle contact selection
  const handleToggleContact = (email) => {
    setSelectedContacts((prev) => {
      const updated = new Set(prev);
      if (updated.has(email)) {
        updated.delete(email);
      } else {
        updated.add(email);
      }
      return updated;
    });
  };

  // Search for existing contact in CRM (ONLY for "existing" mode - NOT for LinkedIn search)
  // This DOES call /api/contacts/by-email because we're searching our internal CRM
  const handleSearchExistingContact = useCallback(async () => {
    if (!searchEmail || !searchEmail.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }

    if (!companyHQId) {
      alert('Company context is required to search for contacts');
      return;
    }

    setSearching(true);
    setFoundContact(null);
    setEnrichedProfile(null);
    setRawApolloResponse(null);
    setShowRawJson(false);

    try {
      // Search for existing contact in CRM by email
      // This IS an internal lookup - this is the "existing" mode purpose
      const searchResponse = await api.get(
        `/api/contacts/by-email?email=${encodeURIComponent(searchEmail)}&companyHQId=${companyHQId}`
      );

      if (searchResponse.data?.success && searchResponse.data.contact) {
        setFoundContact(searchResponse.data.contact);
      } else {
        alert('Contact not found in CRM. Please check the email address.');
        setFoundContact(null);
      }
    } catch (error) {
      console.error('Search existing contact error:', error);
      alert(error.response?.data?.details || error.message || 'Failed to search for contact');
      setFoundContact(null);
    } finally {
      setSearching(false);
    }
  }, [searchEmail, companyHQId]);

  // Step 2: Enrich contact (deep enrichment, no DB write)
  // This function is ONLY for LinkedIn search mode (mode === 'search')
  // It NEVER calls /api/contacts/by-email or any internal CRM lookups
  const handleEnrichContact = useCallback(async () => {
    // Ensure we're in LinkedIn search mode
    if (mode !== 'search') {
      console.error('handleEnrichContact should only be called in search mode');
      return;
    }

    if (!foundContact) return;

    const linkedinUrl = foundContact.linkedinUrl;

    if (!linkedinUrl) {
      alert('LinkedIn URL is required');
      return;
    }

    // Ensure foundContact.id is null (external lookup only)
    if (foundContact.id) {
      console.error('LinkedIn search mode should not have foundContact.id');
      // Reset to null to prevent internal lookups
      setFoundContact({ ...foundContact, id: null });
    }

    setEnriching(true);
    try {
      // Call EXTERNAL enrichment endpoint ONLY (NO DB lookup, NO internal CRM search)
      // We do NOT call /api/contacts/by-email here - this is purely external
      const enrichResponse = await api.post('/api/enrich/enrich', {
        linkedinUrl,
        // DO NOT pass companyHQId or email - this is external enrichment only
      });

      if (enrichResponse.data?.success && enrichResponse.data.enrichedProfile) {
        const enriched = enrichResponse.data.enrichedProfile;
        setEnrichedProfile(enriched);
        // Store raw Apollo response
        if (enrichResponse.data.rawApolloResponse) {
          setRawApolloResponse(enrichResponse.data.rawApolloResponse);
        }
        // Store Redis key if available
        if (enrichResponse.data.redisKey) {
          setRedisKey(enrichResponse.data.redisKey);
        }
        // Update foundContact with enriched data (merge with existing)
        // IMPORTANT: id must ALWAYS remain null (external lookup only)
        setFoundContact({
          ...foundContact,
          ...enriched,
          // Keep linkedinUrl from original
          linkedinUrl: foundContact?.linkedinUrl || enriched.linkedinUrl,
          id: null, // ALWAYS null - does NOT exist in CRM - data is in Redis only
        });
        console.log('✅ Enrichment complete:', enriched);
        console.log('📦 Raw Apollo response:', enrichResponse.data.rawApolloResponse);
        console.log('🗄️ Redis key:', enrichResponse.data.redisKey);
      } else {
        console.error('❌ Enrichment failed:', enrichResponse.data);
        alert(enrichResponse.data?.error || enrichResponse.data?.details || 'Enrichment failed. Please try again.');
      }
    } catch (error) {
      console.error('❌ Enrichment error:', error);
      const errorMessage = error.response?.data?.details || error.response?.data?.error || error.message || 'Failed to enrich contact';
      alert(errorMessage);
    } finally {
      setEnriching(false);
    }
  }, [foundContact, mode]); // Added mode to dependencies

  // Handle enrich action (ONLY for CSV, Microsoft, and Existing modes - NOT for LinkedIn search)
  // LinkedIn search uses: handleSearchContact -> handleEnrichContact (NO contact creation)
  // NO CONTACT CREATION - Data is stored in Redis only
  // Apollo doesn't care what we do with the data - just let it chill in Redis
  const handleEnrich = useCallback(async () => {
      // NEVER handle LinkedIn search mode here - it has its own workflow
      if (mode === 'search') {
        console.error('LinkedIn search mode should NOT use handleEnrich');
        return;
      }

      const contactsToEnrich = [];
      
      if (mode === 'existing' && foundContact) {
        // Existing CRM contact - MUST have contactId (from search)
        if (!foundContact.id) {
          alert('Contact ID is required for existing contact enrichment');
          return;
        }
        contactsToEnrich.push({ 
          email: foundContact.email, 
          linkedinUrl: foundContact.linkedinUrl,
          contactId: foundContact.id 
        });
      } else if (mode === 'csv') {
        csvContacts
          .filter((c) => selectedContacts.has(c.email))
          .forEach((c) => contactsToEnrich.push({ email: c.email, contactId: c.id }));
      } else if (mode === 'microsoft') {
        microsoftContacts
          .filter((c) => selectedContacts.has(c.email))
          .forEach((c) => contactsToEnrich.push({ email: c.email, contactId: c.id }));
      }

      if (contactsToEnrich.length === 0) {
        alert('Please select at least one contact to enrich');
        return;
      }

      setEnriching(true);
      const enrichmentResults = [];

      try {
        // For each contact, enrich using internal CRM enrichment endpoint
        // NO internal lookups - contactId is REQUIRED for these modes
        for (const { email, linkedinUrl, contactId } of contactsToEnrich) {
          try {
            if (!contactId) {
              // These modes (CSV, Microsoft, Existing) MUST have contactId
              // If no contactId, skip (should not happen)
              enrichmentResults.push({
                email: email || linkedinUrl || null,
                linkedinUrl: linkedinUrl || null,
                success: false,
                error: 'Contact ID is required for enrichment',
              });
              continue;
            }

            // Enrich the EXISTING contact using internal CRM enrichment endpoint
            // NO internal lookups - we already have the contactId
            const enrichResponse = await api.post('/api/contacts/enrich', {
              contactId,
              email: email || undefined,
              linkedinUrl: linkedinUrl || undefined,
            });

            if (enrichResponse.data?.success) {
              enrichmentResults.push({
                email,
                linkedinUrl,
                success: true,
                contact: enrichResponse.data.contact,
                enrichedData: enrichResponse.data.enrichedData,
              });
            } else {
              enrichmentResults.push({
                email,
                linkedinUrl,
                success: false,
                error: enrichResponse.data?.error || 'Enrichment failed',
              });
            }
          } catch (error) {
            const contactIdentifier = email || linkedinUrl || 'contact';
            console.error(`Error enriching ${contactIdentifier}:`, error);
            enrichmentResults.push({
              email: email || linkedinUrl || null,
              linkedinUrl: linkedinUrl || null,
              success: false,
              error: error.response?.data?.error || error.response?.data?.details || error.message || 'Enrichment failed',
            });
          }
        }

        // Navigate to success page with results
        const successData = {
          total: contactsToEnrich.length,
          successful: enrichmentResults.filter((r) => r.success).length,
          failed: enrichmentResults.filter((r) => !r.success).length,
          results: enrichmentResults,
        };

        // Store results in sessionStorage for success page
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('enrichmentResults', JSON.stringify(successData));
        }

        router.push('/contacts/enrich/success');
      } catch (error) {
        console.error('Enrichment error:', error);
        alert('Failed to enrich contacts. Please try again.');
      } finally {
        setEnriching(false);
      }
  }, [mode, foundContact, csvContacts, microsoftContacts, selectedContacts, router]);

  const allContacts = mode === 'csv' ? csvContacts : mode === 'microsoft' ? microsoftContacts : [];
  const allSelected = allContacts.length > 0 && allContacts.every((c) => selectedContacts.has(c.email));

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <button
            type="button"
            onClick={() => router.push('/contacts')}
            className="mb-4 flex items-center text-gray-600 transition hover:text-gray-900"
          >
            <ArrowRight className="mr-2 h-5 w-5 rotate-180" />
            Back to People Hub
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="mb-2 text-4xl font-bold text-gray-900">
                ✨ Enrich Contacts
              </h1>
              <p className="text-lg text-gray-600">
                Get more details on your contacts with Apollo enrichment
              </p>
            </div>
          </div>
        </div>

        {/* Mode Selection */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => {
              setMode('search');
              setFoundContact(null);
              setSearchLinkedInUrl('');
              setPreviewData(null);
              setEnrichedProfile(null);
            }}
            className={`rounded-xl border-2 p-6 text-left transition ${
              mode === 'search'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <Search className={`mb-3 h-8 w-8 ${mode === 'search' ? 'text-blue-600' : 'text-gray-400'}`} />
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              Lookup & Enrich
            </h3>
            <p className="text-sm text-gray-600">
              Find contact by email or lookup LinkedIn profile
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('csv');
              setCsvFile(null);
              setCsvContacts([]);
              setSelectedContacts(new Set());
            }}
            className={`rounded-xl border-2 p-6 text-left transition ${
              mode === 'csv'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <FileSpreadsheet className={`mb-3 h-8 w-8 ${mode === 'csv' ? 'text-green-600' : 'text-gray-400'}`} />
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              Upload CSV
            </h3>
            <p className="text-sm text-gray-600">
              Upload a CSV file with emails
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('microsoft');
              setMicrosoftContacts([]);
              setSelectedContacts(new Set());
            }}
            className={`rounded-xl border-2 p-6 text-left transition ${
              mode === 'microsoft'
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <Mail className={`mb-3 h-8 w-8 ${mode === 'microsoft' ? 'text-purple-600' : 'text-gray-400'}`} />
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              Microsoft Email
            </h3>
            <p className="text-sm text-gray-600">
              Get contacts from Microsoft email
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('existing');
              setFoundContact(null);
            }}
            className={`rounded-xl border-2 p-6 text-left transition ${
              mode === 'existing'
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <User className={`mb-3 h-8 w-8 ${mode === 'existing' ? 'text-orange-600' : 'text-gray-400'}`} />
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              Individual You Want to Enrich
            </h3>
            <p className="text-sm text-gray-600">
              Search for existing contact in your CRM
            </p>
          </button>
        </div>

        {/* Search Mode */}
        {mode === 'search' && (
          <div className="mb-8 rounded-xl bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">
              Lookup & Enrich LinkedIn Profile
            </h2>
            
            <div className="flex flex-col gap-3">
              <p className="text-sm text-gray-600 italic">
                Let's help you find your next lead
              </p>
              <div className="flex gap-4">
                <input
                  type="url"
                  autoComplete="off"
                  placeholder="Enter LinkedIn URL (e.g., https://linkedin.com/in/john-doe)"
                  value={searchLinkedInUrl}
                  onChange={(e) => setSearchLinkedInUrl(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearchContact()}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              <button
                type="button"
                onClick={handleSearchContact}
                disabled={searching || !searchLinkedInUrl}
                className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {searching ? (
                  <>
                    <RefreshCw className="mr-2 inline h-4 w-4 animate-spin" />
                    Looking up...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 inline h-4 w-4" />
                    Lookup & Preview
                  </>
                )}
              </button>
              </div>
            </div>

            {foundContact && (
              <div className="mt-6 rounded-lg border-2 border-blue-200 bg-blue-50 p-6">
                <div className="mb-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Verify This Contact</h3>
                    <button
                      type="button"
                      onClick={() => setFoundContact(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  
                  {foundContact.linkedinUrl && (
                    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <Linkedin className="h-5 w-5 text-blue-600" />
                        <span className="text-sm font-semibold text-gray-700">LinkedIn Profile</span>
                      </div>
                      <a
                        href={foundContact.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-sm text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {foundContact.linkedinUrl}
                      </a>
                      <p className="mt-2 text-xs text-gray-500">
                        👆 Click to open LinkedIn profile in a new tab and verify this is the correct person
                      </p>
                    </div>
                  )}

                  {foundContact.email && (
                    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <Mail className="h-5 w-5 text-gray-400" />
                        <span className="text-sm font-semibold text-gray-700">Email</span>
                      </div>
                      <div className="text-sm text-gray-600">{foundContact.email}</div>
                    </div>
                  )}

                  {(foundContact.firstName || foundContact.lastName || foundContact.fullName || foundContact.title || foundContact.companyName) && (
                    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
                      {(foundContact.firstName || foundContact.lastName || foundContact.fullName) && (
                        <div className="mb-3">
                          <div className="mb-2 flex items-center gap-2">
                            <User className="h-5 w-5 text-gray-400" />
                            <span className="text-sm font-semibold text-gray-700">Name</span>
                          </div>
                          <div className="text-base font-semibold text-gray-900">
                            {foundContact.fullName || `${foundContact.firstName || ''} ${foundContact.lastName || ''}`.trim()}
                          </div>
                        </div>
                      )}
                      {foundContact.title && (
                        <div className="mb-2">
                          <div className="text-sm font-semibold text-gray-700">Title</div>
                          <div className="text-sm text-gray-600">{foundContact.title}</div>
                        </div>
                      )}
                      {foundContact.companyName && (
                        <div className="mb-2">
                          <div className="text-sm font-semibold text-gray-700">Company</div>
                          <div className="text-sm text-gray-600">{foundContact.companyName}</div>
                        </div>
                      )}
                      {enrichedProfile && (
                        <>
                          {foundContact.phone && (
                            <div className="mb-2">
                              <div className="text-sm font-semibold text-gray-700">Phone</div>
                              <div className="text-sm text-gray-600">{foundContact.phone}</div>
                            </div>
                          )}
                          {(foundContact.city || foundContact.state || foundContact.country) && (
                            <div className="mb-2">
                              <div className="text-sm font-semibold text-gray-700">Location</div>
                              <div className="text-sm text-gray-600">
                                {[foundContact.city, foundContact.state, foundContact.country].filter(Boolean).join(', ')}
                              </div>
                            </div>
                          )}
                          {foundContact.companyDomain && (
                            <div>
                              <div className="text-sm font-semibold text-gray-700">Company Domain</div>
                              <div className="text-sm text-gray-600">{foundContact.companyDomain}</div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* LinkedIn search mode: foundContact.id should ALWAYS be null (external lookup only) */}
                  {mode === 'search' && !enrichedProfile && (
                    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <div className="flex items-center gap-2 text-sm text-amber-700">
                        <Sparkles className="h-4 w-4" />
                        <span>Preview only - external lookup, not saved to CRM yet</span>
                      </div>
                    </div>
                  )}

                  {/* Existing mode: foundContact.id exists (internal CRM lookup) */}
                  {mode === 'existing' && foundContact.id && (
                    <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3">
                      <div className="flex items-center gap-2 text-sm text-green-700">
                        <CheckCircle className="h-4 w-4" />
                        <span>Existing contact in your CRM - will be enriched</span>
                      </div>
                    </div>
                  )}

                  {enrichedProfile && (
                    <>
                      <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3">
                        <div className="flex items-center gap-2 text-sm text-green-700">
                          <CheckCircle className="h-4 w-4" />
                          <span>Enrichment complete - data stored in Redis</span>
                        </div>
                        {redisKey && (
                          <div className="mt-2 text-xs text-green-600">
                            Redis key: <code className="bg-green-100 px-1 py-0.5 rounded">{redisKey}</code>
                          </div>
                        )}
                      </div>

                      {/* Raw Apollo JSON Response */}
                      {rawApolloResponse && (
                        <div className="mb-4 rounded-lg border border-gray-300 bg-gray-50">
                          <button
                            type="button"
                            onClick={() => setShowRawJson(!showRawJson)}
                            className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-gray-100 rounded-t-lg"
                          >
                            <div className="flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-gray-600" />
                              <span className="text-sm font-semibold text-gray-700">
                                Full Apollo Response JSON
                              </span>
                            </div>
                            <span className="text-xs text-gray-500 font-medium">
                              {showRawJson ? '▼ Hide' : '▶ Show'}
                            </span>
                          </button>
                          {showRawJson && (
                            <div className="border-t border-gray-200 p-4 bg-gray-900 rounded-b-lg">
                              <pre className="max-h-[600px] overflow-auto text-xs text-green-400 font-mono leading-relaxed">
                                {JSON.stringify(rawApolloResponse, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-blue-200 pt-4">
                  {!enrichedProfile ? (
                    <>
                      {/* Step 1: After preview, show "Enrich Contact" button */}
                      <button
                        type="button"
                        onClick={() => {
                          setFoundContact(null);
                          setPreviewData(null);
                          setEnrichedProfile(null);
                          setRawApolloResponse(null);
                          setShowRawJson(false);
                        }}
                        className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleEnrichContact}
                        disabled={enriching}
                        className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {enriching ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Enriching...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4" />
                            Enrich Contact
                          </>
                        )}
                      </button>
                    </>
                  ) : (
                    <>
                      {/* After enrichment - data is stored in Redis, no contact creation */}
                      <button
                        type="button"
                        onClick={() => {
                          setEnrichedProfile(null);
                          setRawApolloResponse(null);
                          setShowRawJson(false);
                          setRedisKey(null);
                          setFoundContact(null);
                          setPreviewData(null);
                          setSearchLinkedInUrl('');
                        }}
                        className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                      >
                        Clear & Search Again
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* CSV Mode */}
        {mode === 'csv' && (
          <div className="mb-8 rounded-xl bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">
              Upload CSV File
            </h2>
            <div className="mb-6 rounded-lg border-2 border-dashed border-gray-300 p-12 text-center transition-colors hover:border-gray-400">
              {!csvFile ? (
                <>
                  <Upload className="mx-auto mb-4 h-16 w-16 text-gray-400" />
                  <p className="mb-2 text-gray-600">Click to upload or drag and drop</p>
                  <p className="mb-4 text-xs text-gray-500">CSV files only (must contain email column)</p>
                  <label className="inline-block cursor-pointer rounded-lg bg-green-600 px-6 py-3 font-semibold text-white transition hover:bg-green-700">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleCsvFileSelect}
                      className="hidden"
                    />
                    Select CSV File
                  </label>
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-8 w-8 text-green-600" />
                    <div>
                      <div className="font-semibold text-gray-900">{csvFile.name}</div>
                      <div className="text-sm text-gray-600">
                        {csvContacts.length} contact{csvContacts.length !== 1 ? 's' : ''} found
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCsvFile(null);
                      setCsvContacts([]);
                      setSelectedContacts(new Set());
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>

            {csvContacts.length > 0 && (
              <div className="rounded-lg border border-gray-200">
                <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 p-4">
                  <span className="font-semibold text-gray-900">
                    Select contacts to enrich
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (allSelected) {
                        setSelectedContacts(new Set());
                      } else {
                        setSelectedContacts(new Set(csvContacts.map((c) => c.email)));
                      }
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {csvContacts.map((contact, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between border-b border-gray-100 p-4 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedContacts.has(contact.email)}
                          onChange={() => handleToggleContact(contact.email)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="text-sm text-gray-900">{contact.email}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Microsoft Mode */}
        {mode === 'microsoft' && (
          <div className="mb-8 rounded-xl bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">
              Get Contacts from Microsoft Email
            </h2>
            <button
              type="button"
              onClick={handleGetMicrosoftContacts}
              disabled={loadingMicrosoft}
              className="mb-6 rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingMicrosoft ? (
                <>
                  <RefreshCw className="mr-2 inline h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Mail className="mr-2 inline h-4 w-4" />
                  Get Contacts from Microsoft
                </>
              )}
            </button>

            {microsoftContacts.length > 0 && (
              <div className="rounded-lg border border-gray-200">
                <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 p-4">
                  <span className="font-semibold text-gray-900">
                    Select contacts to enrich ({microsoftContacts.length} found)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (allSelected) {
                        setSelectedContacts(new Set());
                      } else {
                        setSelectedContacts(new Set(microsoftContacts.map((c) => c.email)));
                      }
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {microsoftContacts.map((contact, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between border-b border-gray-100 p-4 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedContacts.has(contact.email)}
                          onChange={() => handleToggleContact(contact.email)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {contact.firstName} {contact.lastName}
                          </div>
                          <div className="text-xs text-gray-600">{contact.email}</div>
                          {contact.company && (
                            <div className="text-xs text-gray-500">{contact.company}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 🚫 NEVER show bulk enrich bar during LinkedIn search mode */}
        {/* LinkedIn search uses handleEnrichContact (external only) - this bar is for CSV/Microsoft/Existing modes */}
        {mode !== 'search' &&
          (foundContact || (allContacts.length > 0 && selectedContacts.size > 0)) && (
          <div className="rounded-xl bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Ready to Enrich</h3>
                <p className="text-sm text-gray-600">
                  {mode === 'existing'
                    ? '1 contact selected'
                    : `${selectedContacts.size} contact${selectedContacts.size !== 1 ? 's' : ''} selected`}
                </p>
              </div>
              <button
                type="button"
                onClick={handleEnrich}
                disabled={enriching}
                className="flex items-center gap-2 rounded-lg bg-cyan-600 px-6 py-3 font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {enriching ? (
                  <>
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    Enriching...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    Enrich
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Existing Contact Mode */}
        {mode === 'existing' && (
          <div className="mb-8 rounded-xl bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">
              Individual You Want to Enrich
            </h2>
            <p className="mb-6 text-sm text-gray-600">
              Search for an existing contact in your CRM by email address
            </p>

            <div className="mb-6 flex gap-4">
              <input
                type="email"
                placeholder="Enter email address..."
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && searchEmail && searchEmail.includes('@')) {
                    handleSearchExistingContact();
                  }
                }}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleSearchExistingContact}
                disabled={searching || !searchEmail || !searchEmail.includes('@')}
                className="rounded-lg bg-orange-600 px-6 py-3 font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {searching ? (
                  <>
                    <RefreshCw className="mr-2 inline h-4 w-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 inline h-4 w-4" />
                    Search CRM
                  </>
                )}
              </button>
            </div>

            {foundContact && (
              <div className="mt-6 rounded-lg border-2 border-orange-200 bg-orange-50 p-6">
                <div className="mb-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Contact Found</h3>
                    <button
                      type="button"
                      onClick={() => setFoundContact(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <User className="h-5 w-5 text-gray-400" />
                      <span className="text-sm font-semibold text-gray-700">Name</span>
                    </div>
                    <div className="text-base font-semibold text-gray-900">
                      {foundContact.firstName} {foundContact.lastName}
                    </div>
                  </div>

                  {foundContact.email && (
                    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <Mail className="h-5 w-5 text-gray-400" />
                        <span className="text-sm font-semibold text-gray-700">Email</span>
                      </div>
                      <div className="text-sm text-gray-600">{foundContact.email}</div>
                    </div>
                  )}

                  {foundContact.title && (
                    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
                      <div className="text-sm font-semibold text-gray-700">Title</div>
                      <div className="text-sm text-gray-600">{foundContact.title}</div>
                    </div>
                  )}

                  <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3">
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <CheckCircle className="h-4 w-4" />
                      <span>Existing contact in your CRM - will be enriched</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-orange-200 pt-4">
                  <button
                    type="button"
                    onClick={() => setFoundContact(null)}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleEnrich}
                    disabled={enriching}
                    className="flex items-center gap-2 rounded-lg bg-orange-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {enriching ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Enriching...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Enrich This Contact
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
