'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Save, ArrowLeft } from 'lucide-react';
import api from '@/lib/api';

/**
 * Event Builder Page
 */
export default function EventBuilderPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const eventId = params.eventPlanId;
  const isNew = eventId === 'new';
  
  const workPackageId = searchParams.get('workPackageId');
  const itemId = searchParams.get('itemId');

  const [eventName, setEventName] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [agenda, setAgenda] = useState('');
  const [description, setDescription] = useState('');
  const [published, setPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);

  useEffect(() => {
    if (!isNew && eventId) {
      loadEvent();
    }
  }, [eventId, isNew]);

  const loadEvent = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/artifacts/eventplans/${eventId}`);
      if (response.data?.success) {
        const event = response.data.eventPlan;
        setEventName(event.eventName || '');
        setDate(event.date || '');
        setLocation(event.location || '');
        setAgenda(event.agenda || '');
        setDescription(event.description || '');
        setPublished(event.published || false);
      }
    } catch (err) {
      console.error('Error loading event:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!eventName.trim()) {
      alert('Event Name is required');
      return;
    }

    try {
      setSaving(true);
      const companyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';

      const data = {
        companyHQId,
        eventName,
        date,
        location,
        agenda,
        description,
        published,
      };

      let event;
      if (isNew) {
        const response = await api.post('/api/artifacts/eventplans', data);
        event = response.data.eventPlan;
      } else {
        const response = await api.patch(`/api/artifacts/eventplans/${eventId}`, data);
        event = response.data.eventPlan;
      }

      // If created from work package, link it
      if (isNew && workPackageId && itemId) {
        await api.patch(`/api/workpackages/items/${itemId}/add-artifact`, {
          type: 'EVENT_CLE_PLAN',
          artifactId: event.id,
        });
        router.push(`/workpackages/${workPackageId}/items/${itemId}`);
      } else {
        router.push(`/builder/event/${event.id}`);
      }
    } catch (err) {
      console.error('Error saving event:', err);
      alert('Failed to save event');
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
            {isNew ? 'Create Event' : 'Edit Event'}
          </h1>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <div className="space-y-4">
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Event Name *
              </label>
              <input
                type="text"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder=""
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Date
              </label>
              <input
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder=""
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder=""
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Agenda
              </label>
              <textarea
                value={agenda}
                onChange={(e) => setAgenda(e.target.value)}
                placeholder=""
                rows={5}
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
