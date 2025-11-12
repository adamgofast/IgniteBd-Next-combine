'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle2, TrendingUp, ArrowLeft, Sparkles } from 'lucide-react';
import api from '@/lib/api';
import PageHeader from '@/components/PageHeader.jsx';

function AssessmentResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const assessmentId = searchParams.get('id');
  
  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!assessmentId) {
      // Try to get latest assessment
      const fetchLatestAssessment = async () => {
        try {
          setLoading(true);
          const response = await api.get('/api/assessment');
          if (response.data.success && response.data.assessments?.length > 0) {
            setAssessment(response.data.assessments[0]);
          } else {
            setError('No assessment found');
          }
        } catch (err) {
          console.error('Failed to fetch assessment:', err);
          setError('Failed to load assessment results');
        } finally {
          setLoading(false);
        }
      };
      fetchLatestAssessment();
    } else {
      // Fetch specific assessment by ID (would need a new API endpoint)
      // For now, fetch all and find the one with matching ID
      const fetchAssessment = async () => {
        try {
          setLoading(true);
          const response = await api.get('/api/assessment');
          if (response.data.success) {
            const found = response.data.assessments?.find(a => a.id === assessmentId);
            if (found) {
              setAssessment(found);
            } else {
              setError('Assessment not found');
            }
          } else {
            setError('Failed to load assessment');
          }
        } catch (err) {
          console.error('Failed to fetch assessment:', err);
          setError('Failed to load assessment results');
        } finally {
          setLoading(false);
        }
      };
      fetchAssessment();
    }
  }, [assessmentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || !assessment) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="Assessment Results" />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <p className="text-gray-600 mb-4">{error || 'Assessment not found'}</p>
            <button
              onClick={() => router.push('/assessment')}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Take Assessment
            </button>
          </div>
        </div>
      </div>
    );
  }

  const scoreColor = assessment.scoreInterpretation?.color || 'gray';
  const colorClasses = {
    green: 'bg-green-100 text-green-800 border-green-200',
    yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    orange: 'bg-orange-100 text-orange-800 border-orange-200',
    red: 'bg-red-100 text-red-800 border-red-200',
    gray: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Assessment Results"
        description="Your growth potential analysis"
      />

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <button
            onClick={() => router.push('/assessment')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Assessment
          </button>
        </div>

        {/* Score Card */}
        {assessment.score !== null && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Your Growth Score</h2>
                <p className="text-gray-600">Based on your responses</p>
              </div>
              <div className={`px-6 py-4 rounded-lg border-2 ${colorClasses[scoreColor]}`}>
                <div className="text-4xl font-bold">{assessment.score}</div>
                <div className="text-sm font-medium mt-1">/ 100</div>
              </div>
            </div>
            
            {assessment.scoreInterpretation && (
              <div className={`mt-4 p-4 rounded-lg border ${colorClasses[scoreColor]}`}>
                <h3 className="font-semibold mb-1">{assessment.scoreInterpretation.level}</h3>
                <p className="text-sm">{assessment.scoreInterpretation.description}</p>
              </div>
            )}
          </div>
        )}

        {/* Insights */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-6">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="h-6 w-6 text-indigo-600" />
            <h2 className="text-2xl font-bold text-gray-900">Your Growth Insights</h2>
          </div>

          {assessment.relateWithUser && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Understanding Your Situation</h3>
              <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                {assessment.relateWithUser}
              </p>
            </div>
          )}

          {assessment.growthNeeds && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">What You Need to Grow</h3>
              <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                {assessment.growthNeeds}
              </p>
            </div>
          )}
        </div>

        {/* Assessment Details */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Assessment Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">Name</p>
              <p className="font-medium text-gray-900">{assessment.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Company</p>
              <p className="font-medium text-gray-900">{assessment.company}</p>
            </div>
            {assessment.industry && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Industry</p>
                <p className="font-medium text-gray-900">{assessment.industry}</p>
              </div>
            )}
            {assessment.revenueGrowthPercent !== null && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Revenue Growth Target</p>
                <p className="font-medium text-gray-900">{assessment.revenueGrowthPercent}%</p>
              </div>
            )}
            {assessment.totalVolume !== null && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Total Volume</p>
                <p className="font-medium text-gray-900">
                  ${assessment.totalVolume.toLocaleString()}
                </p>
              </div>
            )}
            {assessment.bdSpend !== null && (
              <div>
                <p className="text-sm text-gray-500 mb-1">BD Spend</p>
                <p className="font-medium text-gray-900">
                  ${assessment.bdSpend.toLocaleString()}
                </p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-500 mb-1">Completed</p>
              <p className="font-medium text-gray-900">
                {new Date(assessment.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-4">
          <button
            onClick={() => router.push('/assessment')}
            className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 flex items-center gap-2"
          >
            <TrendingUp className="h-5 w-5" />
            Update Assessment
          </button>
          <button
            onClick={() => router.push('/growth-dashboard')}
            className="px-6 py-3 bg-gray-200 text-gray-900 font-semibold rounded-lg hover:bg-gray-300"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AssessmentResultsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    }>
      <AssessmentResultsContent />
    </Suspense>
  );
}

