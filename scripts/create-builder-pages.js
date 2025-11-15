/**
 * Script to generate builder page files for all artifact types
 */

const fs = require('fs');
const path = require('path');

const builders = [
  {
    name: 'persona',
    type: 'PERSONA',
    fields: [
      { name: 'name', label: 'Name *', type: 'text' },
      { name: 'role', label: 'Role', type: 'text' },
      { name: 'title', label: 'Title', type: 'text' },
      { name: 'industry', label: 'Industry', type: 'text' },
      { name: 'goals', label: 'Goals', type: 'textarea' },
      { name: 'painPoints', label: 'Pain Points', type: 'textarea' },
      { name: 'desiredOutcome', label: 'Desired Outcome', type: 'textarea' },
    ],
  },
  {
    name: 'template',
    type: 'OUTREACH_TEMPLATE',
    fields: [
      { name: 'name', label: 'Name *', type: 'text' },
      { name: 'subject', label: 'Subject', type: 'text' },
      { name: 'body', label: 'Body', type: 'textarea' },
      { name: 'type', label: 'Type', type: 'text', placeholder: 'email, sms, etc.' },
    ],
  },
  {
    name: 'event',
    type: 'EVENT_CLE_PLAN',
    fields: [
      { name: 'eventName', label: 'Event Name *', type: 'text' },
      { name: 'date', label: 'Date', type: 'datetime-local' },
      { name: 'location', label: 'Location', type: 'text' },
      { name: 'agenda', label: 'Agenda', type: 'textarea' },
      { name: 'description', label: 'Description', type: 'textarea' },
    ],
  },
  {
    name: 'cledeck',
    type: 'CLE_DECK',
    fields: [
      { name: 'title', label: 'Title *', type: 'text' },
      { name: 'presenter', label: 'Presenter', type: 'text' },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'slides', label: 'Slides (JSON)', type: 'textarea', placeholder: 'JSON array of slides' },
    ],
  },
  {
    name: 'landingpage',
    type: 'LANDING_PAGE',
    fields: [
      { name: 'title', label: 'Title *', type: 'text' },
      { name: 'url', label: 'URL', type: 'text' },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'content', label: 'Content (JSON)', type: 'textarea', placeholder: 'JSON content structure' },
    ],
  },
];

const pageTemplate = (builder) => `'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Save, ArrowLeft } from 'lucide-react';
import api from '@/lib/api';

/**
 * ${builder.name.charAt(0).toUpperCase() + builder.name.slice(1)} Builder Page
 */
export default function ${builder.name.charAt(0).toUpperCase() + builder.name.slice(1)}BuilderPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const ${builder.name}Id = params.${builder.name === 'event' ? 'eventPlanId' : builder.name === 'cledeck' ? 'deckId' : builder.name === 'landingpage' ? 'landingPageId' : builder.name + 'Id'};
  const isNew = ${builder.name}Id === 'new';
  
  const workPackageId = searchParams.get('workPackageId');
  const itemId = searchParams.get('itemId');

  ${builder.fields.map(f => `const [${f.name}, set${f.name.charAt(0).toUpperCase() + f.name.slice(1)}] = useState('');`).join('\n  ')}
  const [published, setPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);

  useEffect(() => {
    if (!isNew && ${builder.name}Id) {
      load${builder.name.charAt(0).toUpperCase() + builder.name.slice(1)}();
    }
  }, [${builder.name}Id, isNew]);

  const load${builder.name.charAt(0).toUpperCase() + builder.name.slice(1)} = async () => {
    try {
      setLoading(true);
      const response = await api.get(\`/api/artifacts/${builder.name === 'event' ? 'eventplans' : builder.name === 'cledeck' ? 'cledecks' : builder.name === 'landingpage' ? 'landingpages' : builder.name + 's'}/\${${builder.name}Id}\`);
      if (response.data?.success) {
        const ${builder.name} = response.data.${builder.name === 'event' ? 'eventPlan' : builder.name === 'cledeck' ? 'cleDeck' : builder.name === 'landingpage' ? 'landingPage' : builder.name};
        ${builder.fields.map(f => `set${f.name.charAt(0).toUpperCase() + f.name.slice(1)}(${builder.name}.${f.name} || '');`).join('\n        ')}
        setPublished(${builder.name}.published || false);
      }
    } catch (err) {
      console.error('Error loading ${builder.name}:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!${builder.fields[0].name}.trim()) {
      alert('${builder.fields[0].label.replace(' *', '')} is required');
      return;
    }

    try {
      setSaving(true);
      const companyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';

      const data = {
        companyHQId,
        ${builder.fields.map(f => `${f.name},`).join('\n        ')}
        published,
      };

      let ${builder.name};
      if (isNew) {
        const response = await api.post('/api/artifacts/${builder.name === 'event' ? 'eventplans' : builder.name === 'cledeck' ? 'cledecks' : builder.name === 'landingpage' ? 'landingpages' : builder.name + 's'}', data);
        ${builder.name} = response.data.${builder.name === 'event' ? 'eventPlan' : builder.name === 'cledeck' ? 'cleDeck' : builder.name === 'landingpage' ? 'landingPage' : builder.name};
      } else {
        const response = await api.patch(\`/api/artifacts/${builder.name === 'event' ? 'eventplans' : builder.name === 'cledeck' ? 'cledecks' : builder.name === 'landingpage' ? 'landingpages' : builder.name + 's'}/\${${builder.name}Id}\`, data);
        ${builder.name} = response.data.${builder.name === 'event' ? 'eventPlan' : builder.name === 'cledeck' ? 'cleDeck' : builder.name === 'landingpage' ? 'landingPage' : builder.name};
      }

      // If created from work package, link it
      if (isNew && workPackageId && itemId) {
        await api.patch(\`/api/workpackages/items/\${itemId}/add-artifact\`, {
          type: '${builder.type}',
          artifactId: ${builder.name}.id,
        });
        router.push(\`/workpackages/\${workPackageId}/items/\${itemId}\`);
      } else {
        router.push(\`/builder/${builder.name === 'event' ? 'event' : builder.name === 'cledeck' ? 'cledeck' : builder.name === 'landingpage' ? 'landingpage' : builder.name}/\${${builder.name}.id}\`);
      }
    } catch (err) {
      console.error('Error saving ${builder.name}:', err);
      alert('Failed to save ${builder.name}');
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
            {isNew ? 'Create ${builder.name.charAt(0).toUpperCase() + builder.name.slice(1)}' : 'Edit ${builder.name.charAt(0).toUpperCase() + builder.name.slice(1)}'}
          </h1>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <div className="space-y-4">
            ${builder.fields.map(f => `
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                ${f.label}
              </label>
              ${f.type === 'textarea' ? `<textarea
                value={${f.name}}
                onChange={(e) => set${f.name.charAt(0).toUpperCase() + f.name.slice(1)}(e.target.value)}
                placeholder="${f.placeholder || ''}"
                rows={${f.name.includes('content') || f.name.includes('slides') ? 10 : 5}}
                className="w-full rounded border border-gray-300 px-3 py-2"
              />` : `<input
                type="${f.type}"
                value={${f.name}}
                onChange={(e) => set${f.name.charAt(0).toUpperCase() + f.name.slice(1)}(e.target.value)}
                placeholder="${f.placeholder || ''}"
                className="w-full rounded border border-gray-300 px-3 py-2"
              />`}
            </div>`).join('')}

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
`;

builders.forEach((builder) => {
  const dirName = builder.name === 'event' ? 'event' : builder.name === 'cledeck' ? 'cledeck' : builder.name === 'landingpage' ? 'landingpage' : builder.name;
  const paramName = builder.name === 'event' ? '[eventPlanId]' : builder.name === 'cledeck' ? '[deckId]' : builder.name === 'landingpage' ? '[landingPageId]' : `[${builder.name}Id]`;
  const baseDir = path.join(__dirname, '..', 'src', 'app', '(authenticated)', 'builder', dirName, paramName);
  const pageFile = path.join(baseDir, 'page.jsx');

  // Create directory
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  // Write page file
  fs.writeFileSync(pageFile, pageTemplate(builder));

  console.log(`✅ Created builder page for ${builder.name}`);
});

console.log('✅ All builder pages created!');

