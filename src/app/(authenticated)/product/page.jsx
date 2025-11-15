'use client';

import { useState, useEffect } from 'react';
import { Package, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import api from '@/lib/api';

export default function ProductCreatePage() {
  const [form, setForm] = useState({
    name: '',
    description: '',
    valueProp: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [companyHQId, setCompanyHQId] = useState('');

  // Get companyHQId from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedCompanyHQId =
        window.localStorage.getItem('companyHQId') ||
        window.localStorage.getItem('companyHQId') ||
        '';
      setCompanyHQId(storedCompanyHQId);
    }
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear success/error when user types
    if (success) setSuccess(false);
    if (error) setError(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setSuccess(false);
    setError(null);

    try {
      const response = await api.post('/api/products', {
        name: form.name,
        description: form.description || null,
        valueProp: form.valueProp || null,
        companyHQId: companyHQId || undefined,
      });

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      const newProduct = response.data?.product;
      
      // Immediately save to localStorage (hydration pattern)
      if (newProduct && typeof window !== 'undefined') {
        const cached = window.localStorage.getItem('products');
        const existing = cached ? JSON.parse(cached) : [];
        const updated = [...existing, newProduct];
        window.localStorage.setItem('products', JSON.stringify(updated));
      }

      setSuccess(true);
      setForm({
        name: '',
        description: '',
        valueProp: '',
      });
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to create product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Create Product</h1>
          </div>
          <p className="text-sm text-gray-600">
            Define your product's value proposition to power BD Intelligence scoring and alignment.
          </p>
        </div>

        {!companyHQId && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <p className="text-sm text-amber-800">
                Company context is required. Please set companyHQId in localStorage.
              </p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="text-sm font-medium text-green-800">
                Product created successfully!
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Product Name <span className="text-red-500">*</span>
              </label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g., Ignite CRM Automation"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                required
                disabled={loading}
              />
              <p className="mt-1 text-xs text-gray-500">
                A clear, concise name for your product or service
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Value Proposition
              </label>
              <textarea
                name="valueProp"
                value={form.valueProp}
                onChange={handleChange}
                placeholder="What specific outcome or benefit does this product deliver? e.g., Turn follow-ups into closed deals automatically."
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                disabled={loading}
              />
              <p className="mt-1 text-xs text-gray-500">
                This is used by BD Intelligence to calculate fit scores with contacts
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Description
              </label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Optional: Additional details about the product experience, features, or use cases."
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                disabled={loading}
              />
            </div>

            <div className="flex justify-end gap-4 border-t border-gray-100 pt-6">
              <button
                type="button"
                onClick={() => {
                  setForm({ name: '', description: '', valueProp: '' });
                  setError(null);
                  setSuccess(false);
                }}
                className="rounded-lg bg-gray-100 px-6 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-200 disabled:opacity-60"
                disabled={loading}
              >
                Clear
              </button>
              <button
                type="submit"
                disabled={loading || !form.name}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Package className="h-4 w-4" />
                    Create Product
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

