'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import api from '@/lib/api';

const DEFAULT_VALUES = {
  personaName: '',
  role: '',
  painPoints: '',
  goals: '',
  whatTheyWant: '',
  companyId: '',
};

export default function PersonaBuilderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const personaId = searchParams?.get('personaId') || null;

  const [isHydrating, setIsHydrating] = useState(Boolean(personaId));
  const [fetchError, setFetchError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const toastTimerRef = useRef(null);

  const derivedCompanyId = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return (
      window.localStorage.getItem('companyId') ||
      window.localStorage.getItem('companyHQId') ||
      ''
    );
  }, []);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    defaultValues: DEFAULT_VALUES,
    mode: 'onBlur',
  });

  useEffect(() => () => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (derivedCompanyId) {
      setValue('companyId', derivedCompanyId);
    }
  }, [derivedCompanyId, setValue]);

  useEffect(() => {
    if (!personaId) {
      setIsHydrating(false);
      return;
    }

    let isMounted = true;
    setIsHydrating(true);
    setFetchError(null);

    (async () => {
      try {
        const response = await api.get(`/api/personas/${personaId}`);
        const persona = response.data?.persona ?? null;

        if (!isMounted) return;

        if (!persona) {
          setFetchError('Persona not found.');
          return;
        }

        reset({
          personaName: persona.name ?? '',
          role: persona.role ?? '',
          painPoints: persona.painPoints ?? '',
          goals: persona.goals ?? '',
          whatTheyWant: persona.valuePropToPersona ?? '',
          companyId: persona.companyHQId ?? derivedCompanyId ?? '',
        });
      } catch (error) {
        if (!isMounted) return;
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to load persona.';
        setFetchError(message);
      } finally {
        if (isMounted) {
          setIsHydrating(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [personaId, reset, derivedCompanyId]);

  const handleShowToast = (message, callback) => {
    setToastMessage(message);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      if (callback) callback();
    }, 1200);
  };

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);

    if (!values.companyId) {
      setSubmitError('Company context is required to save a persona.');
      return;
    }

    try {
      const response = await api.post('/api/personas', {
        id: personaId,
        name: values.personaName,
        role: values.role,
        painPoints: values.painPoints,
        goals: values.goals,
        valuePropToPersona: values.whatTheyWant,
        companyHQId: values.companyId,
      });

      const savedPersona = response.data?.persona;
      if (!savedPersona) {
        throw new Error('Persona save response was missing data.');
      }

      handleShowToast('Persona saved.', () => {
        router.push('/persona');
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'We could not save the persona. Please try again.';
      setSubmitError(message);
    }
  });

  const isBusy = isHydrating || isSubmitting;

  return (
    <div className="relative mx-auto max-w-3xl space-y-6 p-6">
      {toastMessage && (
        <div className="fixed inset-x-0 top-6 z-50 flex justify-center px-4">
          <div className="rounded-lg bg-green-600 px-4 py-2 text-white shadow-lg">
            {toastMessage}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            {personaId ? 'Edit Persona' : 'Create Persona'}
          </h1>
          <p className="text-sm text-gray-600">
            Keep the details aligned with your activation strategy and
            messaging.
          </p>
        </div>

        {fetchError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {fetchError}
          </div>
        )}

        {submitError && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {submitError}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-6">
          <input
            type="hidden"
            defaultValue={derivedCompanyId}
            {...register('companyId', { required: true })}
          />

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Persona Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., Sarah the Scaling COO"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-200"
                disabled={isBusy}
                {...register('personaName', {
                  required: 'Persona name is required.',
                })}
              />
              {errors.personaName && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.personaName.message}
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Role
              </label>
              <input
                type="text"
                placeholder="e.g., COO, Head of Growth"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-200"
                disabled={isBusy}
                {...register('role')}
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">
              Pain Points
            </label>
            <textarea
              rows={4}
              placeholder="Where are they feeling friction? What slows them down?"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-200"
              disabled={isBusy}
              {...register('painPoints')}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">
              Goals
            </label>
            <textarea
              rows={4}
              placeholder="What outcomes do they care about most?"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-200"
              disabled={isBusy}
              {...register('goals')}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">
              What They Want From Us
            </label>
            <textarea
              rows={4}
              placeholder="What are they hoping Ignite will help them achieve or solve?"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-200"
              disabled={isBusy}
              {...register('whatTheyWant')}
            />
          </div>

          <div className="flex justify-end gap-4 border-t border-gray-100 pt-6">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg bg-gray-100 px-6 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-200 disabled:opacity-60"
              disabled={isBusy}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-green-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-70"
              disabled={isBusy || (!isDirty && !personaId)}
            >
              {isSubmitting ? 'Saving…' : 'Save Persona'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

