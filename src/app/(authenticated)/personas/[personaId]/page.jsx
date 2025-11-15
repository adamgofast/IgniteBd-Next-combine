'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Target, UserCircle } from 'lucide-react';
import api from '@/lib/api';
import PageHeader from '@/components/PageHeader.jsx';

export default function PersonaDetailPage({ params }) {
  const router = useRouter();
  const [persona, setPersona] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const hydrate = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/api/personas/${params.personaId}`);
        if (!isMounted) return;
        // API returns persona directly, not wrapped in data.persona
        if (response.data) {
          setPersona(response.data);
        } else {
          setError('Persona not found.');
        }
      } catch (err) {
        if (!isMounted) return;
        setError('Failed to load persona details.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    hydrate();
    return () => {
      isMounted = false;
    };
  }, [params.personaId]);

  const displayName = useMemo(() => {
    if (!persona) return 'Persona';
    return persona.personName || persona.name || persona.title || 'Persona';
  }, [persona]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-16">
        <div className="mx-auto max-w-3xl px-4">
          <div className="rounded-2xl bg-white p-8 text-center shadow">
            <RefreshCw className="mx-auto h-6 w-6 animate-spin text-gray-500" />
            <p className="mt-3 text-sm font-medium text-gray-700">Loading persona…</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !persona) {
    return (
      <div className="min-h-screen bg-gray-50 py-16">
        <div className="mx-auto max-w-3xl px-4">
          <div className="rounded-2xl bg-white p-8 text-center shadow">
            <p className="text-lg font-semibold text-red-600">
              {error || 'Persona not found.'}
            </p>
            <button
              type="button"
              onClick={() => router.push('/personas')}
              className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Back to Personas
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title={displayName}
          subtitle={persona.title || 'Buyer persona overview'}
          backTo="/personas"
          backLabel="Back to Personas"
          actions={
            <button
              type="button"
              onClick={() => router.push(`/personas/builder?personaId=${persona.id}`)}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Edit Persona
            </button>
          }
        />

        <div className="space-y-6">
          <section className="rounded-2xl bg-white p-6 shadow">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
              <UserCircle className="h-5 w-5 text-gray-500" />
              Profile Summary
            </h3>
            <dl className="space-y-3 text-sm text-gray-600">
              <div>
                <dt className="font-semibold text-gray-700">Title</dt>
                <dd>{persona.title || 'Not captured yet'}</dd>
              </div>
              {persona.headline && (
                <div>
                  <dt className="font-semibold text-gray-700">Headline</dt>
                  <dd>{persona.headline}</dd>
                </div>
              )}
              {persona.seniority && (
                <div>
                  <dt className="font-semibold text-gray-700">Seniority</dt>
                  <dd>{persona.seniority}</dd>
                </div>
              )}
              {persona.industry && (
                <div>
                  <dt className="font-semibold text-gray-700">Industry</dt>
                  <dd>{persona.industry}</dd>
                </div>
              )}
              {persona.company && (
                <div>
                  <dt className="font-semibold text-gray-700">Company</dt>
                  <dd>{persona.company}</dd>
                </div>
              )}
              {persona.companySize && (
                <div>
                  <dt className="font-semibold text-gray-700">Company Size</dt>
                  <dd>{persona.companySize}</dd>
                </div>
              )}
              {persona.location && (
                <div>
                  <dt className="font-semibold text-gray-700">Location</dt>
                  <dd>{persona.location}</dd>
                </div>
              )}
              <div>
                <dt className="font-semibold text-gray-700">Company Context</dt>
                <dd>{persona.companyHQ?.companyName || 'Linked to company HQ'}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
              <Target className="h-5 w-5 text-gray-500" />
              Persona Narrative
            </h3>
            <div className="space-y-4 text-sm text-gray-700">
              {persona.description && (
                <FieldBlock label="Description" value={persona.description} />
              )}
              <FieldBlock label="What They Want" value={persona.whatTheyWant} />
              {persona.painPoints && (
                <div>
                  <p className="font-semibold text-gray-800">Pain Points</p>
                  <div className="mt-1 text-sm text-gray-600">
                    {Array.isArray(persona.painPoints) ? (
                      <ul className="list-disc list-inside space-y-1">
                        {persona.painPoints.map((point, idx) => (
                          <li key={idx}>{point}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>{persona.painPoints || 'Fill this in to strengthen targeting.'}</p>
                    )}
                  </div>
                </div>
              )}
              {persona.productFit && (
                <div>
                  <p className="font-semibold text-gray-800">Product Fit</p>
                  <div className="mt-1 text-sm text-gray-600">
                    <p><strong>Product:</strong> {persona.productFit.product?.name || 'N/A'}</p>
                    <p className="mt-2"><strong>Value Prop to Them:</strong></p>
                    <p className="mt-1">{persona.productFit.valuePropToThem || 'N/A'}</p>
                    {persona.productFit.alignmentReasoning && (
                      <>
                        <p className="mt-2"><strong>Alignment Reasoning:</strong></p>
                        <p className="mt-1">{persona.productFit.alignmentReasoning}</p>
                      </>
                    )}
                  </div>
                </div>
              )}
              {persona.buyerTriggers && persona.buyerTriggers.length > 0 && (
                <div>
                  <p className="font-semibold text-gray-800">Buyer Triggers</p>
                  <div className="mt-1 text-sm text-gray-600">
                    <ul className="list-disc list-inside space-y-1">
                      {persona.buyerTriggers.map((trigger, idx) => (
                        <li key={idx}>{trigger}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              {persona.bdIntel && (
                <div>
                  <p className="font-semibold text-gray-800">BD Intelligence</p>
                  <div className="mt-1 text-sm text-gray-600 space-y-2">
                    <p><strong>Fit Score:</strong> {persona.bdIntel.fitScore}/100</p>
                    <p><strong>Pain Alignment:</strong> {persona.bdIntel.painAlignmentScore}/100</p>
                    <p><strong>Workflow Fit:</strong> {persona.bdIntel.workflowFitScore}/100</p>
                    {persona.bdIntel.recommendedTalkTrack && (
                      <>
                        <p className="mt-2"><strong>Recommended Talk Track:</strong></p>
                        <p className="mt-1">{persona.bdIntel.recommendedTalkTrack}</p>
                      </>
                    )}
                    {persona.bdIntel.finalSummary && (
                      <>
                        <p className="mt-2"><strong>Summary:</strong></p>
                        <p className="mt-1">{persona.bdIntel.finalSummary}</p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function FieldBlock({ label, value }) {
  return (
    <div>
      <p className="font-semibold text-gray-800">{label}</p>
      <p className="mt-1 text-sm text-gray-600">
        {value?.trim() ? value : 'Fill this in to strengthen targeting.'}
      </p>
    </div>
  );
}
