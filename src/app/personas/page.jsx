'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';

export default function PersonasPage() {
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [companyHQId, setCompanyHQId] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedCompanyHQId =
      window.localStorage.getItem('companyHQId') ||
      window.localStorage.getItem('companyId') ||
      '';
    setCompanyHQId(storedCompanyHQId);
  }, []);

  const fetchPersonas = useMemo(
    () => async (tenantId, showLoading = true) => {
      if (!tenantId) {
        setLoading(false);
        return;
      }

      try {
        if (showLoading) setLoading(true);
        const response = await fetch(`/api/personas?companyHQId=${tenantId}`, {
          cache: 'no-store',
        });
        if (!response.ok) {
          throw new Error('Failed to load personas');
        }
        const data = await response.json();
        setPersonas(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error fetching personas:', err);
        setError(err.message);
        setPersonas([]);
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchPersonas(companyHQId);
  }, [companyHQId, fetchPersonas]);

  const handleRefresh = async () => {
    await fetchPersonas(companyHQId);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-2 text-2xl font-bold text-gray-900">
            Loading Personas…
          </div>
          <div className="text-gray-600">
            Fetching persona profiles for your company.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-gray-900">
              🧠 Personas
            </h1>
            <p className="text-gray-600">
              Define and manage your ideal buyers for tailored activation.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleRefresh}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <Link
              href="/personas/builder"
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              <Plus className="h-4 w-4" />
              Add Persona
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {personas.length === 0 ? (
          <div className="rounded-xl bg-white p-12 text-center shadow">
            <h2 className="mb-2 text-xl font-semibold text-gray-900">
              No personas yet
            </h2>
            <p className="mb-6 text-gray-600">
              Capture your first persona to align messaging and outreach.
            </p>
            <Link
              href="/personas/builder"
              className="rounded-lg bg-red-600 px-6 py-3 text-white transition hover:bg-red-700"
            >
              Create Persona
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {personas.map((persona) => (
              <div
                key={persona.id}
                className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-red-300 hover:shadow-md"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {persona.name || 'Persona'}
                    </h3>
                    {persona.role && (
                      <p className="text-sm text-gray-500">{persona.role}</p>
                    )}
                  </div>
                  <Link
                    href={`/personas/builder?personaId=${persona.id}`}
                    className="text-sm font-semibold text-red-600 transition hover:text-red-700"
                  >
                    Edit
                  </Link>
                </div>

                <div className="space-y-2 text-sm text-gray-600">
                  {persona.industry && (
                    <p>
                      <span className="font-semibold text-gray-800">
                        Industry:
                      </span>{' '}
                      {persona.industry}
                    </p>
                  )}
                  {persona.goals && (
                    <p>
                      <span className="font-semibold text-gray-800">Goals:</span>{' '}
                      {persona.goals}
                    </p>
                  )}
                  {persona.painPoints && (
                    <p>
                      <span className="font-semibold text-gray-800">
                        Pain Points:
                      </span>{' '}
                      {persona.painPoints}
                    </p>
                  )}
                  {persona.desiredOutcome && (
                    <p>
                      <span className="font-semibold text-gray-800">
                        Desired Outcome:
                      </span>{' '}
                      {persona.desiredOutcome}
                    </p>
                  )}
                  {persona.alignmentScore !== null &&
                    persona.alignmentScore !== undefined && (
                      <p>
                        <span className="font-semibold text-gray-800">
                          Alignment Score:
                        </span>{' '}
                        {persona.alignmentScore}/100
                      </p>
                    )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

