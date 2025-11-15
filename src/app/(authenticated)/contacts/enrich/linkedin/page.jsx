'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { Search, RefreshCw, Sparkles, Linkedin, User, X } from 'lucide-react';

export default function LinkedInEnrich() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [enriching, setEnriching] = useState(false);
  const [enriched, setEnriched] = useState(null);
  const [rawApolloResponse, setRawApolloResponse] = useState(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [redisKey, setRedisKey] = useState(null);

  async function handlePreview() {
    setLoading(true);
    setPreview(null);
    setEnriched(null);
    setRawApolloResponse(null);
    setShowRawJson(false);
    setRedisKey(null);

    try {
      const r = await api.post('/api/enrich/preview', { linkedinUrl: url });
      setPreview(r.data.preview || null);
    } catch (err) {
      alert(err.response?.data?.details || err.message || 'Preview failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleEnrich() {
    setEnriching(true);
    setEnriched(null);
    setRawApolloResponse(null);
    setShowRawJson(false);
    setRedisKey(null);

    try {
      const r = await api.post('/api/enrich/enrich', { linkedinUrl: url });
      setEnriched(r.data.enrichedProfile || null);
      setRawApolloResponse(r.data.rawApolloResponse || null);
      setRedisKey(r.data.redisKey || null);
    } catch (err) {
      alert(err.response?.data?.details || err.message || 'Enrichment failed');
    } finally {
      setEnriching(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="mx-auto max-w-2xl px-6">
        <h1 className="text-3xl font-bold mb-6">🔍 LinkedIn Lookup & Enrich</h1>

        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-xs text-blue-700">
            ⚠️ <strong>External lookup only</strong> - No CRM lookups, no contact creation. Data stored in Redis.
          </p>
        </div>

        {/* URL Input */}
        <div className="flex gap-3 mb-6">
          <input
            type="url"
            placeholder="https://linkedin.com/in/username"
            className="flex-1 border px-4 py-2 rounded"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && url && !loading) {
                handlePreview();
              }
            }}
          />
          <button
            onClick={handlePreview}
            disabled={loading || !url}
            className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <RefreshCw className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}
            Preview
          </button>
        </div>

        {/* Preview Card */}
        {preview && (
          <div className="bg-white p-5 rounded-lg shadow border mb-6">
            <div className="flex justify-between">
              <h2 className="font-semibold text-lg">Preview Found</h2>
              <button onClick={() => setPreview(null)}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <div className="mt-3">
              {preview.firstName || preview.lastName ? (
                <p className="font-semibold text-gray-900">
                  {preview.firstName} {preview.lastName}
                </p>
              ) : null}

              {preview.title && <p className="text-gray-700 text-sm">{preview.title}</p>}
              {preview.companyName && (
                <p className="text-gray-700 text-sm">Company: {preview.companyName}</p>
              )}

              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 text-sm underline flex items-center gap-1 mt-2"
              >
                <Linkedin className="h-4 w-4" /> View LinkedIn
              </a>
            </div>

            {/* Enrich Button */}
            <button
              onClick={handleEnrich}
              disabled={enriching}
              className="mt-4 bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {enriching ? <RefreshCw className="animate-spin h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              Enrich
            </button>
          </div>
        )}

        {/* Enriched Card */}
        {enriched && (
          <div className="bg-green-50 border border-green-200 p-5 rounded-lg shadow mb-6">
            <h2 className="font-semibold text-lg text-green-700 mb-2">✅ Enrichment Complete</h2>
            
            {redisKey && (
              <div className="mb-3 text-xs text-green-600">
                Redis key: <code className="bg-green-100 px-1 py-0.5 rounded">{redisKey}</code>
              </div>
            )}

            <div className="mb-3">
              {enriched.firstName || enriched.lastName ? (
                <p className="font-semibold text-gray-900">
                  {enriched.firstName} {enriched.lastName}
                </p>
              ) : null}
              {enriched.email && <p className="text-sm text-gray-700">Email: {enriched.email}</p>}
              {enriched.title && <p className="text-sm text-gray-700">Title: {enriched.title}</p>}
              {enriched.companyName && <p className="text-sm text-gray-700">Company: {enriched.companyName}</p>}
              {enriched.phone && <p className="text-sm text-gray-700">Phone: {enriched.phone}</p>}
            </div>

            {/* Raw Apollo JSON */}
            {rawApolloResponse && (
              <div className="mt-4">
                <button
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="text-xs text-gray-600 hover:text-gray-800 flex items-center gap-1"
                >
                  {showRawJson ? '▼ Hide' : '▶ Show'} Full Apollo JSON
                </button>
                {showRawJson && (
                  <pre className="mt-2 text-xs bg-gray-900 text-green-300 p-4 rounded max-h-[400px] overflow-y-auto">
                    {JSON.stringify(rawApolloResponse, null, 2)}
                  </pre>
                )}
              </div>
            )}

            <button
              onClick={() => {
                setEnriched(null);
                setPreview(null);
                setRawApolloResponse(null);
                setShowRawJson(false);
                setRedisKey(null);
                setUrl('');
              }}
              className="mt-4 bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm"
            >
              Clear & Search Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

