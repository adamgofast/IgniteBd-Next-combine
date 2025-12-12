'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';

export default function AIPresentationBuilderPage() {
  const router = useRouter();
  const [presentationIdea, setPresentationIdea] = useState('');
  const [slideCount, setSlideCount] = useState(6);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!presentationIdea.trim()) {
      setError('Please enter a presentation idea');
      return;
    }

    setError('');
    setGenerating(true);

    try {
      const companyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';
      
      if (!companyHQId) {
        setError('Missing company context. Please complete onboarding first.');
        return;
      }

      // Call AI API to generate outline
      const response = await api.post('/api/content/presentations/generate-outline', {
        presentationIdea,
        slideCount,
      });

      if (!response.data?.success || !response.data?.outline) {
        throw new Error(response.data?.error || 'Failed to generate outline');
      }

      const outline = response.data.outline;

      // Create presentation with AI-generated outline
      const createResponse = await api.post('/api/content/presentations', {
        companyHQId,
        title: outline.title,
        description: outline.description,
        slides: outline.slides,
        published: false,
      });

      if (createResponse.data?.success && createResponse.data?.presentation) {
        router.push(`/content/presentations/${createResponse.data.presentation.id}`);
      } else {
        throw new Error('Failed to create presentation');
      }
    } catch (err) {
      console.error('Error generating outline:', err);
      setError(err.response?.data?.error || err.message || 'Failed to generate outline. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="AI Presentation Builder"
          subtitle="Generate a presentation outline from your idea"
          backTo="/content/presentations"
          backLabel="Back to Presentations"
        />

        <div className="mt-8 rounded-2xl bg-white p-6 shadow">
          <div className="space-y-6">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                What is your presentation idea?
              </label>
              <textarea
                value={presentationIdea}
                onChange={(e) => setPresentationIdea(e.target.value)}
                placeholder="Describe your presentation idea..."
                rows={6}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                How many slides?
              </label>
              <input
                type="number"
                value={slideCount}
                onChange={(e) => {
                  const value = e.target.value;
                  // Allow typing (including empty for deletion)
                  if (value === '') {
                    setSlideCount(6); // Default if cleared
                  } else {
                    const numValue = parseInt(value, 10);
                    if (!isNaN(numValue) && numValue >= 1 && numValue <= 100) {
                      setSlideCount(numValue);
                    }
                  }
                }}
                onBlur={(e) => {
                  // Ensure valid value on blur
                  const value = parseInt(e.target.value, 10);
                  if (isNaN(value) || value < 1) {
                    setSlideCount(6);
                  } else if (value > 100) {
                    setSlideCount(100);
                  }
                }}
                min={1}
                max={100}
                step={1}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleGenerate}
                disabled={generating || !presentationIdea.trim()}
                className="rounded bg-red-600 px-6 py-3 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? 'Generating...' : 'Generate Outline with AI'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
