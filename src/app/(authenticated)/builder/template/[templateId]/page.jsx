'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Save, ArrowLeft } from 'lucide-react';
import api from '@/lib/api';

/**
 * Template Builder Page
 */
export default function TemplateBuilderPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const templateId = params.templateId;
  const isNew = templateId === 'new';
  
  const workPackageId = searchParams.get('workPackageId');
  const itemId = searchParams.get('itemId');

  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState('');
  const [published, setPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);

  useEffect(() => {
    if (!isNew && templateId) {
      loadTemplate();
    }
  }, [templateId, isNew]);

  const loadTemplate = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/artifacts/templates/${templateId}`);
      if (response.data?.success) {
        const template = response.data.template;
        setName(template.name || '');
        setSubject(template.subject || '');
        setBody(template.body || '');
        setType(template.type || '');
        setPublished(template.published || false);
      }
    } catch (err) {
      console.error('Error loading template:', err);
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
        subject,
        body,
        type,
        published,
      };

      let template;
      if (isNew) {
        const response = await api.post('/api/artifacts/templates', data);
        template = response.data.template;
      } else {
        const response = await api.patch(`/api/artifacts/templates/${templateId}`, data);
        template = response.data.template;
      }

      // If created from work package, link it
      if (isNew && workPackageId && itemId) {
        await api.patch(`/api/workpackages/items/${itemId}/add-artifact`, {
          type: 'OUTREACH_TEMPLATE',
          artifactId: template.id,
        });
        router.push(`/workpackages/${workPackageId}/items/${itemId}`);
      } else {
        router.push(`/builder/template/${template.id}`);
      }
    } catch (err) {
      console.error('Error saving template:', err);
      alert('Failed to save template');
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
            {isNew ? 'Create Template' : 'Edit Template'}
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
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder=""
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Body
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder=""
                rows={5}
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Type
              </label>
              <input
                type="text"
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder="email, sms, etc."
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
