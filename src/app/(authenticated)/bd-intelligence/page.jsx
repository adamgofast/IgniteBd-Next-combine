'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Brain, AlertCircle, Loader2, ArrowRight, Target, UserCircle, TrendingUp } from 'lucide-react';
import api from '@/lib/api';

export default function BDIntelligencePage() {
  const router = useRouter();
  const [contacts, setContacts] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [scoreResult, setScoreResult] = useState(null);
  const [error, setError] = useState(null);
  const [companyHQId, setCompanyHQId] = useState('');

  // Get companyHQId from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedCompanyHQId =
        window.localStorage.getItem('companyHQId') ||
        window.localStorage.getItem('companyHQId') ||
        '';
      setCompanyHQId(storedCompanyHQId);
    }
  }, []);

  // Fetch contacts and products
  useEffect(() => {
    if (!companyHQId) {
      setLoadingData(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoadingData(true);
        const [contactsResponse, productsResponse] = await Promise.all([
          api.get(`/api/contacts?companyHQId=${companyHQId}`),
          api.get(`/api/products?companyHQId=${companyHQId}`),
        ]);

        if (contactsResponse.data?.success) {
          setContacts(contactsResponse.data.contacts || []);
        } else {
          setContacts(contactsResponse.data || []);
        }

        setProducts(Array.isArray(productsResponse.data) ? productsResponse.data : []);
      } catch (err) {
        console.error('Failed to fetch data:', err);
        setError('Failed to load contacts and products');
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, [companyHQId]);

  const handleCalculateScore = async () => {
    if (!selectedContactId || !selectedProductId) {
      setError('Please select both a person and a product');
      return;
    }

    setLoading(true);
    setError(null);
    setScoreResult(null);

    try {
      const response = await api.post('/api/business-intelligence/fit-score', {
        contactId: selectedContactId,
        productId: selectedProductId,
      });

      if (response.data?.success) {
        setScoreResult(response.data);
      } else {
        throw new Error(response.data?.error || 'Failed to calculate score');
      }
    } catch (err) {
      console.error('Score calculation error:', err);
      setError(
        err.response?.data?.error ||
          err.message ||
          'Failed to calculate business intelligence score',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoTarget = () => {
    // Navigate to outreach with contact and product context
    const params = new URLSearchParams();
    if (selectedContactId) params.set('contactId', selectedContactId);
    if (selectedProductId) params.set('productId', selectedProductId);
    router.push(`/outreach?${params.toString()}`);
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score) => {
    if (score >= 80) return 'bg-green-50 border-green-200';
    if (score >= 60) return 'bg-yellow-50 border-yellow-200';
    if (score >= 40) return 'bg-orange-50 border-orange-200';
    return 'bg-red-50 border-red-200';
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">BD Intelligence</h1>
          <p className="mt-2 text-sm text-gray-600">
            Calculate how well your product matches a person using AI-powered scoring
          </p>
        </div>

        {!companyHQId && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <p className="text-sm text-amber-800">
                Company context is required. Please set companyHQId in localStorage.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Selection Form */}
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                What Product?
              </label>
              {loadingData ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : (
                <select
                  value={selectedProductId}
                  onChange={(e) => {
                    setSelectedProductId(e.target.value);
                    setScoreResult(null); // Clear result when selection changes
                  }}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  disabled={loading || products.length === 0}
                >
                  <option value="">
                    {products.length === 0
                      ? 'No products available'
                      : 'Select a product...'}
                  </option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                What Person?
              </label>
              {loadingData ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : (
                <select
                  value={selectedContactId}
                  onChange={(e) => {
                    setSelectedContactId(e.target.value);
                    setScoreResult(null); // Clear result when selection changes
                  }}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  disabled={loading || contacts.length === 0}
                >
                  <option value="">
                    {contacts.length === 0
                      ? 'No contacts available'
                      : 'Select a person...'}
                  </option>
                  {contacts.map((contact) => {
                    const displayName =
                      contact.goesBy ||
                      [contact.firstName, contact.lastName]
                        .filter(Boolean)
                        .join(' ') ||
                      contact.email ||
                      'Unknown';
                    return (
                      <option key={contact.id} value={contact.id}>
                        {displayName}
                        {contact.title ? ` - ${contact.title}` : ''}
                        {contact.contactCompany?.companyName
                          ? ` (${contact.contactCompany.companyName})`
                          : ''}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>

            <button
              onClick={handleCalculateScore}
              disabled={
                loading ||
                !selectedContactId ||
                !selectedProductId ||
                loadingData
              }
              className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Calculating Score...
                </span>
              ) : (
                'Calculate Score'
              )}
            </button>
          </div>
        </div>

        {/* Results */}
        {scoreResult && (
          <div className="space-y-6">
            {/* Persona Match Info */}
            {scoreResult.personaMatch && scoreResult.personaMatch.bestMatch && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-6 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="rounded-full bg-blue-100 p-3">
                    <UserCircle className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">Matched Persona</h3>
                        <p className="mt-1 text-lg font-bold text-blue-700">
                          {scoreResult.personaMatch.bestMatch.name}
                        </p>
                        {scoreResult.personaMatch.bestMatch.role && (
                          <p className="mt-1 text-sm text-gray-600">
                            {scoreResult.personaMatch.bestMatch.role}
                            {scoreResult.personaMatch.bestMatch.industry && 
                              ` • ${scoreResult.personaMatch.bestMatch.industry}`
                            }
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium text-gray-600">Confidence</span>
                        </div>
                        <p className="mt-1 text-2xl font-bold text-blue-600">
                          {scoreResult.personaMatch.confidence}%
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-gray-500">
                      This persona was automatically matched based on role, industry, and contact details.
                      {scoreResult.personaId && (
                        <span className="ml-1">Persona ID: {scoreResult.personaId}</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Score Display */}
            <div
              className={`rounded-xl border-2 p-8 shadow-sm ${getScoreBgColor(
                scoreResult.scores.totalScore,
              )}`}
            >
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Fit Score</p>
                <p
                  className={`mt-2 text-6xl font-bold ${getScoreColor(
                    scoreResult.scores.totalScore,
                  )}`}
                >
                  {scoreResult.scores.totalScore}
                </p>
                <p className="mt-1 text-sm text-gray-500">/ 100</p>
                {scoreResult.summary && (
                  <p className="mt-4 text-sm text-gray-700">{scoreResult.summary}</p>
                )}
              </div>
            </div>

            {/* Go Target CTA */}
            <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Ready to target this person?
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Start your outreach campaign with hunter.io integration
                  </p>
                </div>
                <button
                  onClick={handleGoTarget}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  <Target className="h-5 w-5" />
                  Go Target
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!scoreResult && !loading && (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
            <Brain className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-4 text-sm text-gray-500">
              Select a product and person to calculate the fit score
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

