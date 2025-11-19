'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

/**
 * useWorkPackageHydration Hook
 * 
 * Fetches and hydrates WorkPackage data for Owner App
 * Returns the same hydrated data structure as Client Portal but with timeline calculations
 * 
 * @param {string} workPackageId - WorkPackage ID to hydrate
 * @returns {Object} { workPackage, loading, error, refresh }
 */
export function useWorkPackageHydration(workPackageId) {
  const [workPackage, setWorkPackage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchWorkPackage = useCallback(async () => {
    if (!workPackageId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await api.get(`/api/workpackages/owner/${workPackageId}/hydrate`);
      
      if (response.data?.success && response.data.workPackage) {
        setWorkPackage(response.data.workPackage);
      } else {
        setError(response.data?.error || 'Failed to load work package');
        setWorkPackage(null);
      }
    } catch (err) {
      console.error('Error fetching work package:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load work package');
      setWorkPackage(null);
    } finally {
      setLoading(false);
    }
  }, [workPackageId]);

  useEffect(() => {
    fetchWorkPackage();
  }, [fetchWorkPackage]);

  const refresh = useCallback(() => {
    return fetchWorkPackage();
  }, [fetchWorkPackage]);

  return {
    workPackage,
    loading,
    error,
    refresh,
  };
}

