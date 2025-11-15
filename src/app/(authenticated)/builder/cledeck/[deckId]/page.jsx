'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Save, ArrowLeft } from 'lucide-react';
import api from '@/lib/api';

/**
 * Cledeck Builder Page
 */
export default function CledeckBuilderPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const cledeckId = params.deckId;
  const isNew = cledeckId === 'new';
  
  const workPackageId = searchParams.get('workPackageId');
  const itemId = searchParams.get('itemId');

  const [title, setTitle] = useState('');
  const [presenter, setPresenter] = useState('');
  const [description, setDescription] = useState('');
  const [slides, setSlides] = useState('');
  const [published, setPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);

  useEffect(() => {
    if (!isNew && cledeckId) {
      loadCledeck();
    }
  }, [cledeckId, isNew]);

  const loadCledeck = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/artifacts/cledecks/${cledeckId}`);
      if (response.data?.success) {
        const cledeck = response.data.cleDeck;
        setTitle(cledeck.title || '');
        setPresenter(cledeck.presenter || '');
        setDescription(cledeck.description || '');
        setSlides(cledeck.slides || '');
        setPublished(cledeck.published || false);
      }
    } catch (err) {
      console.error('Error loading cledeck:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Title is required');
      return;
    }

    try {
      setSaving(true);
      const companyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';

      const data = {
        companyHQId,
        title,
        presenter,
        description,
        slides,
        published,
      };

      let cledeck;
      if (isNew) {
        const response = await api.post('/api/artifacts/cledecks', data);
        cledeck = response.data.cleDeck;
      } else {
        const response = await api.patch(`/api/artifacts/cledecks/${cledeckId}`, data);
        cledeck = response.data.cleDeck;
      }

      // If created from work package, link it
      if (isNew && workPackageId && itemId) {
        await api.patch(`/api/workpackages/items/${itemId}/add-artifact`, {
          type: 'CLE_DECK',
          artifactId: cledeck.id,
        });
        router.push(`/workpackages/${workPackageId}/items/${itemId}`);
      } else {
        router.push(`/builder/cledeck/${cledeck.id}`);
      }
    } catch (err) {
      console.error('Error saving cledeck:', err);
      alert('Failed to save cledeck');
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
            {isNew ? 'Create Cledeck' : 'Edit Cledeck'}
          </h1>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <div className="space-y-4">
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Title *
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
                Presenter
              </label>
              <input
                type="text"
                value={presenter}
                onChange={(e) => setPresenter(e.target.value)}
                placeholder=""
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder=""
                rows={5}
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Slides (JSON)
              </label>
              <textarea
                value={slides}
                onChange={(e) => setSlides(e.target.value)}
                placeholder="JSON array of slides"
                rows={10}
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
