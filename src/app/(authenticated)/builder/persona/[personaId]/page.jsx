'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Save, ArrowLeft } from 'lucide-react';
import api from '@/lib/api';

/**
 * Persona Builder Page
 */
export default function PersonaBuilderPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const personaId = params.personaId;
  const isNew = personaId === 'new';
  
  const workPackageId = searchParams.get('workPackageId');
  const itemId = searchParams.get('itemId');

  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [title, setTitle] = useState('');
  const [industry, setIndustry] = useState('');
  const [goals, setGoals] = useState('');
  const [painPoints, setPainPoints] = useState('');
  const [desiredOutcome, setDesiredOutcome] = useState('');
  const [published, setPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);

  useEffect(() => {
    if (!isNew && personaId) {
      loadPersona();
    }
  }, [personaId, isNew]);

  const loadPersona = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/artifacts/personas/${personaId}`);
      if (response.data?.success) {
        const persona = response.data.persona;
        setName(persona.name || '');
        setRole(persona.role || '');
        setTitle(persona.title || '');
        setIndustry(persona.industry || '');
        setGoals(persona.goals || '');
        setPainPoints(persona.painPoints || '');
        setDesiredOutcome(persona.desiredOutcome || '');
        setPublished(persona.published || false);
      }
    } catch (err) {
      console.error('Error loading persona:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Name is required');
      return;
    }

    try {
      setSaving(true);
      const companyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';

      const data = {
        companyHQId,
        name,
        role,
        title,
        industry,
        goals,
        painPoints,
        desiredOutcome,
        published,
      };

      let persona;
      if (isNew) {
        const response = await api.post('/api/artifacts/personas', data);
        persona = response.data.persona;
      } else {
        const response = await api.patch(`/api/artifacts/personas/${personaId}`, data);
        persona = response.data.persona;
      }

      // If created from work package, link it
      if (isNew && workPackageId && itemId) {
        await api.patch(`/api/workpackages/items/${itemId}/add-artifact`, {
          type: 'PERSONA',
          artifactId: persona.id,
        });
        router.push(`/workpackages/${workPackageId}/items/${itemId}`);
      } else {
        router.push(`/builder/persona/${persona.id}`);
      }
    } catch (err) {
      console.error('Error saving persona:', err);
      alert('Failed to save persona');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4">
          <div className="rounded-2xl bg-white p-8 text-center shadow">
            <p className="text-sm font-semibold text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-3xl font-bold text-gray-900">
            {isNew ? 'Create Persona' : 'Edit Persona'}
          </h1>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <div className="space-y-4">
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder=""
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Role
              </label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder=""
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder=""
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Industry
              </label>
              <input
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder=""
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Goals
              </label>
              <textarea
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                placeholder=""
                rows={5}
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Pain Points
              </label>
              <textarea
                value={painPoints}
                onChange={(e) => setPainPoints(e.target.value)}
                placeholder=""
                rows={5}
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Desired Outcome
              </label>
              <textarea
                value={desiredOutcome}
                onChange={(e) => setDesiredOutcome(e.target.value)}
                placeholder=""
                rows={5}
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="published"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
                className="rounded border-gray-300"
              />
              <label htmlFor="published" className="text-sm text-gray-700">
                Published (visible to client)
              </label>
            </div>

            <div className="flex justify-end gap-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded bg-red-600 px-6 py-2 text-white hover:bg-red-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
