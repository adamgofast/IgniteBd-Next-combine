'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Building2,
  Mail,
  Phone,
  Briefcase,
  FileText,
  Filter,
  CheckCircle,
  Upload,
  Users,
  Plus,
  X,
  TrendingUp,
} from 'lucide-react';
import api from '@/lib/api';
import {
  mapFormToCompany,
  mapFormToContact,
  mapFormToPipeline,
  validateContactForm,
} from '@/lib/services/contactFieldMapper';

const INITIAL_FORM = {
  firstName: '',
  lastName: '',
  goesBy: '',
  email: '',
  phone: '',
  title: '',
  companyName: '',
  companyURL: '',
  companyIndustry: '',
  pipeline: '',
  stage: '',
  notes: '',
  buyerDecision: '',
  howMet: '',
};

export default function ContactManualPage() {
  const router = useRouter();
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [companyHQId, setCompanyHQId] = useState('');
  const [saving, setSaving] = useState(false);
  const [pipelineStages, setPipelineStages] = useState([]);
  const [pipelineConfig, setPipelineConfig] = useState(null);
  const [buyerDecisionConfig, setBuyerDecisionConfig] = useState(null);
  const [howMetConfig, setHowMetConfig] = useState(null);
  const [errors, setErrors] = useState([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdContact, setCreatedContact] = useState(null);

  const formatLabel = (value) =>
    value
      ? value
          .split(/[-_]/)
          .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
          .join(' ')
      : '';

  const resetForm = (keepPipeline = true) => {
    setFormData((prev) => ({
      ...INITIAL_FORM,
      pipeline: keepPipeline ? prev.pipeline : '',
    }));
    setErrors([]);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedCompanyHQId =
      window.localStorage.getItem('companyHQId') ||
      window.localStorage.getItem('companyId') ||
      '';
    setCompanyHQId(storedCompanyHQId);
  }, []);

  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const response = await api.get('/api/pipelines/config');
        if (response.data?.success) {
          setPipelineConfig(response.data.pipelines ?? null);
          setBuyerDecisionConfig(response.data.buyerDecision ?? null);
          setHowMetConfig(response.data.howMet ?? null);
        }
      } catch (error) {
        console.warn('Failed to load pipeline config, using defaults.', error);
        setPipelineConfig({
          prospect: [
            'interest',
            'meeting',
            'proposal',
            'contract',
            'contract-signed',
          ],
          client: [
            'kickoff',
            'work-started',
            'work-delivered',
            'sustainment',
            'renewal',
            'terminated-contract',
          ],
          collaborator: ['interest', 'meeting', 'moa', 'agreement'],
          institution: ['interest', 'meeting', 'moa', 'agreement'],
        });
      }
    };

    fetchConfigs();
  }, []);

  useEffect(() => {
    if (formData.pipeline && pipelineConfig) {
      const stages = pipelineConfig[formData.pipeline] || [];
      setPipelineStages(stages);
      if (formData.stage && !stages.includes(formData.stage)) {
        setFormData((prev) => ({ ...prev, stage: '' }));
      }
    } else {
      setPipelineStages([]);
    }
  }, [formData.pipeline, formData.stage, pipelineConfig]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors.length > 0) setErrors([]);
    if (showSuccess) {
      setShowSuccess(false);
      setCreatedContact(null);
    }
  };

  const handleAddAnother = () => {
    resetForm(true);
    setShowSuccess(false);
    setCreatedContact(null);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleDismissSuccess = () => {
    setShowSuccess(false);
    setCreatedContact(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrors([]);

    const validation = validateContactForm(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    if (!companyHQId) {
      alert('Company not found. Please set up your company first.');
      router.push('/company/create-or-choose');
      return;
    }

    setSaving(true);

    try {
      const contactData = mapFormToContact(formData, companyHQId);
      const companyData = mapFormToCompany(formData, companyHQId);
      const pipelineData = mapFormToPipeline(formData);

      if (!contactData.crmId) {
        throw new Error('Company ID missing from contact data.');
      }

      const response = await api.post('/api/contacts/universal-create', {
        contact: contactData,
        company: companyData,
        pipeline: pipelineData,
      });

      const createdContactId = response.data?.contact?.id ?? null;

      try {
        const refreshResponse = await api.get(
          `/api/contacts?companyHQId=${companyHQId}`,
        );
        if (refreshResponse.data?.success && refreshResponse.data.contacts) {
          window.localStorage.setItem(
            'contacts',
            JSON.stringify(refreshResponse.data.contacts),
          );
        }
      } catch (refreshError) {
        console.warn('Unable to refresh contacts cache', refreshError);
      }

      setCreatedContact({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        companyName: formData.companyName,
        title: formData.title,
        pipeline: formData.pipeline,
        pipelineLabel: formatLabel(formData.pipeline),
        stage: formData.stage,
        stageLabel: formatLabel(formData.stage),
        contactId: createdContactId,
      });
      setShowSuccess(true);
      resetForm(true);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (error) {
      const message =
        error.response?.data?.error ||
        error.response?.data?.details ||
        error.message ||
        'Failed to create contact. Please try again.';
      alert(message);
      setErrors([message]);
    } finally {
      setSaving(false);
    }
  };

  const pipelineOptions = useMemo(
    () => (pipelineConfig ? Object.keys(pipelineConfig) : []),
    [pipelineConfig],
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/growth-dashboard')}
            className="flex items-center gap-2 text-gray-600 transition hover:text-gray-900"
          >
            <TrendingUp className="h-5 w-5" />
            Growth Dashboard
          </button>
          <span className="text-gray-400">|</span>
          <button
            type="button"
            onClick={() => router.push('/contacts')}
            className="flex items-center gap-2 text-gray-600 transition hover:text-gray-900"
          >
            <Users className="h-5 w-5" />
            People Hub
          </button>
          <span className="text-gray-400">|</span>
          <button
            type="button"
            onClick={() => router.push('/contacts/upload')}
            className="flex items-center gap-2 text-gray-600 transition hover:text-gray-900"
          >
            <Upload className="h-5 w-5" />
            Upload Options
          </button>
        </div>

        <h1 className="mb-2 text-3xl font-bold text-gray-900">
          ➕ Add Contact Manually
        </h1>
        <p className="text-gray-600">
          Enter contact information — all fields in one place.
        </p>
      </div>

      {showSuccess && createdContact && (
        <div className="mb-6 rounded-xl border-2 border-green-200 bg-green-50 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-green-600/10 text-green-700">
              <CheckCircle className="h-7 w-7" />
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-green-900">
                    Contact Created Successfully
                  </h3>
                  <p className="mt-2 space-x-1 text-sm text-green-800">
                    <span>
                      <strong>
                        {createdContact.firstName} {createdContact.lastName}
                      </strong>
                      {createdContact.email &&
                        ` (${createdContact.email})`}
                    </span>
                    {createdContact.companyName && (
                      <span>• {createdContact.companyName}</span>
                    )}
                    {createdContact.pipelineLabel && (
                      <span>• {createdContact.pipelineLabel} pipeline</span>
                    )}
                    {createdContact.stageLabel && (
                      <span>• Stage: {createdContact.stageLabel}</span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDismissSuccess}
                  className="text-green-600 transition hover:text-green-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                {createdContact.contactId && (
                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/contacts/${createdContact.contactId}`)
                    }
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700"
                  >
                    View Contact
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => router.push('/contacts/view')}
                  className="rounded-lg border border-green-200 bg-white px-4 py-2 text-sm font-medium text-green-700 transition hover:bg-green-100"
                >
                  View Contacts
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/contacts/deal-pipelines')}
                  className="rounded-lg border border-green-200 bg-white px-4 py-2 text-sm font-medium text-green-700 transition hover:bg-green-100"
                >
                  Pipeline Overview
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/contacts')}
                  className="rounded-lg border border-green-200 bg-white px-4 py-2 text-sm font-medium text-green-700 transition hover:bg-green-100"
                >
                  People Hub
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/growth-dashboard')}
                  className="rounded-lg border border-green-200 bg-white px-4 py-2 text-sm font-medium text-green-700 transition hover:bg-green-100"
                >
                  Growth Dashboard
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleAddAnother}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700"
                >
                  Add Another Contact
                </button>
                <button
                  type="button"
                  onClick={handleDismissSuccess}
                  className="rounded-lg bg-green-100 px-4 py-2 text-sm font-medium text-green-800 transition hover:bg-green-200"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <div className="mb-6 rounded-lg border-2 border-red-200 bg-red-50 p-4">
          <h3 className="mb-2 font-semibold text-red-900">
            Please fix the following errors:
          </h3>
          <ul className="list-inside list-disc text-sm text-red-800">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-xl bg-white p-8 shadow-lg"
      >
        <div className="space-y-8">
          <div>
            <h2 className="mb-4 border-b pb-2 text-xl font-semibold text-gray-900">
              Required Information
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="firstName"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  <User className="mr-1 inline h-4 w-4" />
                  First Name *
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="lastName"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Last Name *
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <h2 className="mb-4 border-b pb-2 text-xl font-semibold text-gray-900">
              Contact Information
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="goesBy"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Goes By / Preferred Name
                </label>
                <input
                  id="goesBy"
                  name="goesBy"
                  value={formData.goesBy}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  placeholder="Nickname or preferred name"
                />
              </div>
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  <Mail className="mr-1 inline h-4 w-4" />
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label
                  htmlFor="phone"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  <Phone className="mr-1 inline h-4 w-4" />
                  Phone
                </label>
                <input
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <label
                  htmlFor="title"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  <Briefcase className="mr-1 inline h-4 w-4" />
                  Job Title
                </label>
                <input
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  placeholder="Job title or role"
                />
              </div>
            </div>
          </div>

          <div>
            <h2 className="mb-4 border-b pb-2 text-xl font-semibold text-gray-900">
              Company Information
            </h2>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="companyName"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  <Building2 className="mr-1 inline h-4 w-4" />
                  Business Name
                </label>
                <input
                  id="companyName"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  placeholder="Company or organization name"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Company details will be enriched automatically.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="companyURL"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Company Website URL
                  </label>
                  <input
                    id="companyURL"
                    name="companyURL"
                    value={formData.companyURL}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    placeholder="https://example.com"
                  />
                </div>
                <div>
                  <label
                    htmlFor="companyIndustry"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Industry
                  </label>
                  <input
                    id="companyIndustry"
                    name="companyIndustry"
                    value={formData.companyIndustry}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    placeholder="Industry or sector (optional - can be inferred)"
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <h2 className="mb-4 border-b pb-2 text-xl font-semibold text-gray-900">
              Deal Pipeline
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="pipeline"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  <Filter className="mr-1 inline h-4 w-4" />
                  Pipeline Type
                </label>
                <select
                  id="pipeline"
                  name="pipeline"
                  value={formData.pipeline}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select pipeline...</option>
                  {pipelineOptions.map((pipeline) => (
                    <option key={pipeline} value={pipeline}>
                      {formatLabel(pipeline)}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Optional — can be set later.
                </p>
              </div>
              {formData.pipeline && pipelineStages.length > 0 && (
                <div>
                  <label
                    htmlFor="stage"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Pipeline Stage
                  </label>
                  <select
                    id="stage"
                    name="stage"
                    value={formData.stage}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select stage...</option>
                    {pipelineStages.map((stage) => (
                      <option key={stage} value={stage}>
                        {formatLabel(stage)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div>
            <h2 className="mb-4 border-b pb-2 text-xl font-semibold text-gray-900">
              Additional Information
            </h2>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="notes"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  <FileText className="mr-1 inline h-4 w-4" />
                  Notes
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  placeholder="Relationship context, deal details, or anything important."
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="howMet"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    How We Met
                  </label>
                  <select
                    id="howMet"
                    name="howMet"
                    value={formData.howMet}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select how you met...</option>
                    {howMetConfig &&
                      Object.entries(howMetConfig.labels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="buyerDecision"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Buyer Decision Type
                  </label>
                  <select
                    id="buyerDecision"
                    name="buyerDecision"
                    value={formData.buyerDecision}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select buyer type...</option>
                    {buyerDecisionConfig &&
                      Object.entries(buyerDecisionConfig.labels).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex gap-3 border-t pt-6">
          <button
            type="button"
            onClick={() => router.push('/contacts')}
            className="flex-1 rounded-lg bg-gray-100 px-6 py-3 font-medium text-gray-700 transition hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Contact'}
          </button>
        </div>
      </form>

      <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm text-blue-800">
          <strong>💡 Tip:</strong> Only First Name and Last Name are required.
          All other fields are optional and can be added or updated later.
        </p>
      </div>
    </div>
  );
}

