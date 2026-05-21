'use client';

import { useState, useEffect, useMemo, Suspense, useCallback } from 'react';
import PageHeader from '@/components/PageHeader';
import CompanyKeyMissingError from '@/components/CompanyKeyMissingError';
import { useCompanyHQId } from '@/hooks/useCompanyHQId';
import {
  Inbox,
  Mail,
  Calendar,
  FileText,
  Trash2,
  Sparkles,
  Clock,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  History,
  User,
} from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';
import {
  NEXT_ENGAGEMENT_PURPOSE_LABELS,
  NEXT_ENGAGEMENT_PURPOSE_VALUES,
} from '@/lib/constants/nextEngagementPurpose';

const ACTIVITY_TYPE_CONFIG = {
  inbound_email:  { label: 'Inbound Email',  color: 'bg-blue-100 text-blue-800' },
  outbound_email: { label: 'Outbound Email', color: 'bg-emerald-100 text-emerald-800' },
  call_note:      { label: 'Call Note → Meeting', color: 'bg-purple-100 text-purple-800' },
  meeting_note:   { label: 'Meeting Note → Meeting', color: 'bg-purple-100 text-purple-800' },
  note:           { label: 'General Note',   color: 'bg-gray-100 text-gray-700' },
};

function ActivityTypeBadge({ type }) {
  const config = ACTIVITY_TYPE_CONFIG[type] || { label: type, color: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}

/**
 * Inbound Parse Page
 *
 * Route: /inbound-parse
 *
 * View all emails received via SendGrid Inbound Parse (InboundEmail model).
 * Flow: Parse runs interpret only → edit matcher steps → Save all → email_activities + contact + pipeline (backend).
 * Post-save: AI Reasoning stamps contact. contact_id can be null; email_activities.email is persisted for later link.
 */
function bulkRecordKindLabel(activityType, recordType) {
  if (typeof recordType === 'string' && recordType.includes('Meeting')) {
    return recordType.includes('Call') ? 'Call' : 'Meeting';
  }
  if (activityType === 'call_note') return 'Call';
  if (activityType === 'meeting_note') return 'Meeting';
  return 'Email';
}

function InboundParsePageContent() {
  const { companyHQId, missing } = useCompanyHQId();
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [showRaw, setShowRaw] = useState(false);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);
  const [parseResult, setParseResult] = useState(null);
  const [nextEngageOverride, setNextEngageOverride] = useState('');
  const [nextEngagementPurposeOverride, setNextEngagementPurposeOverride] = useState('');
  const [contactEmailOverride, setContactEmailOverride] = useState('');
  const [contactNameOverride, setContactNameOverride] = useState('');
  const [contactIdOverride, setContactIdOverride] = useState(null);
  const [subjectOverride, setSubjectOverride] = useState('');
  const [summaryOverride, setSummaryOverride] = useState('');
  const [recordedContactId, setRecordedContactId] = useState(null);
  const [createContactLoading, setCreateContactLoading] = useState(false);
  const [inboundTab, setInboundTab] = useState('inbox'); // inbox | recorded | failed | all
  const [selectedContactEmailHistory, setSelectedContactEmailHistory] = useState(null);
  const [selectedContactEmailHistoryLoading, setSelectedContactEmailHistoryLoading] = useState(false);
  const [lookupContactLoading, setLookupContactLoading] = useState(false);
  const [generatePipelineMatch, setGeneratePipelineMatch] = useState(true);
  const [applyPipelineMatch, setApplyPipelineMatch] = useState(false);
  const [inboundSaveComplete, setInboundSaveComplete] = useState(false);
  /** Operator override: Parse / Save on RECORDED rows (silent-failure recovery). */
  const [manualReparse, setManualReparse] = useState(false);
  /** View Thread panel: open before parse; auto-collapse after parse / after save; user can re-open. */
  const [threadOpen, setThreadOpen] = useState(true);
  /** After Save all: structured summary + next actions (matcher UI is cleared). */
  const [lastInboundSave, setLastInboundSave] = useState(null);
  /** User confirmed updating CRM email/company when domain differs from name-match contact. */
  const [confirmJobChange, setConfirmJobChange] = useState(false);

  // Inbound parse pipeline health
  const [inboundHealth, setInboundHealth] = useState(null);
  /** List window for GET /api/inbound-parse (7 | 30 | 90). */
  const [inboundDays, setInboundDays] = useState(90);

  /** Bulk POST /api/inbound-parse/process-pending from inbox toolbar */
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkProcessMessage, setBulkProcessMessage] = useState(null);
  const [bulkProcessResults, setBulkProcessResults] = useState(null);
  const [bulkResultsExpanded, setBulkResultsExpanded] = useState(false);

  // Meeting ingest (right panel)
  const [notes, setNotes] = useState([]);
  const [meetingLoading, setMeetingLoading] = useState(true);
  const [selectedNote, setSelectedNote] = useState(null);
  const [meetingParseResult, setMeetingParseResult] = useState(null);
  const [meetingContactIdOverride, setMeetingContactIdOverride] = useState(null);
  const [meetingContactEmailOverride, setMeetingContactEmailOverride] = useState('');
  const [meetingContactNameOverride, setMeetingContactNameOverride] = useState('');
  const [meetingDateOverride, setMeetingDateOverride] = useState('');
  const [meetingSummaryOverride, setMeetingSummaryOverride] = useState('');
  const [meetingNextEngageOverride, setMeetingNextEngageOverride] = useState('');
  const [meetingAnalyzeLoading, setMeetingAnalyzeLoading] = useState(false);
  const [meetingPushLoading, setMeetingPushLoading] = useState(false);
  const [meetingActionMessage, setMeetingActionMessage] = useState(null);

  const fetchInboundEmails = useCallback(
    async (tenantId, tab) => {
      if (!tenantId) return;
      const effectiveTab = tab ?? inboundTab;
      try {
        setLoading(true);
        const res = await api.get(
          `/api/inbound-parse?companyHQId=${tenantId}&tab=${effectiveTab}&days=${inboundDays}`,
        );
        if (res.data?.success) {
          setEmails(res.data.emails || []);
        }
      } catch (error) {
        console.error('Error fetching inbound parse emails:', error);
      } finally {
        setLoading(false);
      }
    },
    [inboundTab, inboundDays],
  );

  const fetchMeetingNotes = useCallback(async (tenantId) => {
    try {
      setMeetingLoading(true);
      const res = await api.get(`/api/meeting-ingest?companyHQId=${tenantId}`);
      if (res.data?.success) {
        setNotes(res.data.notes || []);
      }
    } catch (error) {
      console.error('Error fetching meeting notes:', error);
    } finally {
      setMeetingLoading(false);
    }
  }, []);

  useEffect(() => {
    api
      .get('/api/health/inbound-parse')
      .then((res) => {
        if (res.data?.success) setInboundHealth(res.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (missing || !companyHQId) {
      setMeetingLoading(false);
      return;
    }
    fetchMeetingNotes(companyHQId);
  }, [companyHQId, missing, fetchMeetingNotes]);

  useEffect(() => {
    if (missing || !companyHQId) {
      setLoading(false);
      setEmails([]);
      return;
    }
    fetchInboundEmails(companyHQId, inboundTab);
  }, [companyHQId, missing, inboundTab, inboundDays, fetchInboundEmails]);

  // When user selects a contact from name matches, fetch that contact's email history for Step 3
  useEffect(() => {
    if (!contactIdOverride) {
      setSelectedContactEmailHistory(null);
      return;
    }
    let cancelled = false;
    setSelectedContactEmailHistoryLoading(true);
    api
      .get(`/api/contacts/${contactIdOverride}/email-history`)
      .then((res) => {
        if (cancelled) return;
        if (res.data?.success && res.data.activities?.length) {
          const mapped = res.data.activities
            .filter((a) => !a.isDraft)
            .map((a) => ({
              id: a.id,
              date: a.date,
              subject: a.subject,
              body: a.notes || a.body || null,
              type: a.type === 'off-platform' ? 'off-platform' : 'platform',
              platform: a.platform,
              event: a.event,
              direction: a.sequenceOrder === 'CONTACT_SEND' ? 'inbound' : 'outbound',
              hasResponse: a.hasResponded,
            }));
          setSelectedContactEmailHistory(mapped);
        } else {
          setSelectedContactEmailHistory([]);
        }
      })
      .catch(() => {
        if (!cancelled) setSelectedContactEmailHistory([]);
      })
      .finally(() => {
        if (!cancelled) setSelectedContactEmailHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contactIdOverride]);

  useEffect(() => {
    if (parseResult) setThreadOpen(false);
  }, [parseResult]);

  useEffect(() => {
    if (inboundSaveComplete) setThreadOpen(false);
  }, [inboundSaveComplete]);

  useEffect(() => {
    if (selectedEmail?.id) setThreadOpen(true);
  }, [selectedEmail?.id]);

  // Group by date for section headers: Today, Yesterday, This week, Earlier
  const groupByDate = (list, dateKey = 'createdAt') => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    const groups = { today: [], yesterday: [], thisWeek: [], earlier: [] };
    list.forEach((item) => {
      const d = new Date(item[dateKey]);
      const t = d.getTime();
      if (t >= todayStart.getTime()) groups.today.push(item);
      else if (t >= yesterdayStart.getTime()) groups.yesterday.push(item);
      else if (t >= weekStart.getTime()) groups.thisWeek.push(item);
      else groups.earlier.push(item);
    });
    return [
      { key: 'today', label: 'Today', items: groups.today },
      { key: 'yesterday', label: 'Yesterday', items: groups.yesterday },
      { key: 'thisWeek', label: 'This week', items: groups.thisWeek },
      { key: 'earlier', label: 'Earlier', items: groups.earlier },
    ].filter((g) => g.items.length > 0);
  };

  const groupEmailsByDate = (list) =>
    groupByDate(list, 'createdAt').map((g) => ({ ...g, emails: g.items }));

  // Inbox must show only to-process (RECEIVED); safety net in case API returns RECORDED
  const displayEmails =
    inboundTab === 'inbox'
      ? emails.filter((e) => e.ingestionStatus !== 'RECORDED')
      : emails;

  const groupNotesByDate = (list) =>
    groupByDate(list, 'createdAt').map((g) => ({ ...g, notes: g.items }));

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const extractEmailAddress = (emailString) => {
    if (!emailString) return null;
    const match =
      emailString.match(/<([^>]+)>/) || emailString.match(/([^\s<>]+@[^\s<>]+)/);
    return match ? match[1] : emailString;
  };

  const extractName = (emailString) => {
    if (!emailString) return null;
    const match = emailString.match(/^([^<]+)</);
    return match ? match[1].trim() : null;
  };

  const emailDomainFromAddress = (addr) => {
    const e = extractEmailAddress(addr);
    if (!e || !e.includes('@')) return null;
    return e.split('@')[1].toLowerCase();
  };

  const jobChangeDetected = useMemo(() => {
    if (!parseResult?.nameMatches?.length || parseResult.contact || !contactIdOverride) {
      return false;
    }
    const selected = parseResult.nameMatches.find((m) => m.id === contactIdOverride);
    const incoming = (contactEmailOverride || parseResult.parsed?.contactEmail || '').trim();
    if (!selected?.email || !incoming) return false;
    const dNew = emailDomainFromAddress(incoming);
    const dOld = emailDomainFromAddress(selected.email);
    return Boolean(dNew && dOld && dNew !== dOld);
  }, [parseResult, contactIdOverride, contactEmailOverride]);

  useEffect(() => {
    if (!jobChangeDetected) setConfirmJobChange(false);
  }, [jobChangeDetected]);

  const resetDetailState = () => {
    setManualReparse(false);
    setParseResult(null);
    setContactEmailOverride('');
    setContactNameOverride('');
    setContactIdOverride(null);
    setNextEngageOverride('');
    setNextEngagementPurposeOverride('');
    setSubjectOverride('');
    setSummaryOverride('');
    setRecordedContactId(null);
    setActionMessage(null);
    setSelectedContactEmailHistory(null);
    setInboundSaveComplete(false);
    setThreadOpen(true);
    setApplyPipelineMatch(false);
    setLastInboundSave(null);
    setConfirmJobChange(false);
  };

  const handleProcessPending = async () => {
    if (!companyHQId || inboundTab !== 'inbox') return;
    if (displayEmails.length === 0) return;

    setBulkProcessing(true);
    setBulkProcessMessage(null);
    setBulkProcessResults(null);
    setBulkResultsExpanded(false);
    try {
      const limit = Math.max(displayEmails.length || 12, 1);
      const res = await api.post('/api/inbound-parse/process-pending', { limit });
      if (!res.data?.success) {
        setBulkProcessMessage({
          type: 'error',
          text: res.data?.error || 'Bulk process failed',
        });
        return;
      }
      const summary = res.data.summary || {};
      const processed = summary.processed ?? 0;
      const failed = summary.failed ?? 0;
      const attempted = summary.attempted ?? processed + failed;
      const results = Array.isArray(res.data.results) ? res.data.results : [];
      let linked = 0;
      let unmatched = 0;
      for (const r of results) {
        if (r.ok) {
          if (r.contactId) linked += 1;
          else unmatched += 1;
        }
      }
      const summaryText =
        processed > 0
          ? `Processed ${processed} (${linked} linked${unmatched > 0 ? `, ${unmatched} no contact match` : ''}); failed ${failed} (${attempted} attempted).`
          : `Processed ${processed}; failed ${failed} (${attempted} attempted).`;
      const hasIssues = failed > 0 || unmatched > 0;
      setBulkProcessMessage({
        type: hasIssues ? 'warn' : 'success',
        text: summaryText,
      });
      setBulkProcessResults(results);
      setSelectedEmail(null);
      resetDetailState();
      await fetchInboundEmails(companyHQId, 'inbox');
    } catch (err) {
      setBulkProcessMessage({
        type: 'error',
        text: err.response?.data?.error || err.message || 'Bulk process failed',
      });
    } finally {
      setBulkProcessing(false);
    }
  };

  const resetMeetingDetailState = () => {
    setMeetingParseResult(null);
    setMeetingContactEmailOverride('');
    setMeetingContactNameOverride('');
    setMeetingContactIdOverride(null);
    setMeetingDateOverride('');
    setMeetingSummaryOverride('');
    setMeetingNextEngageOverride('');
    setMeetingActionMessage(null);
  };

  const handleMeetingInterpret = async (e) => {
    e?.stopPropagation?.();
    if (!selectedNote) return;
    setMeetingActionMessage(null);
    setMeetingAnalyzeLoading(true);
    setMeetingParseResult(null);
    try {
      const res = await api.post('/api/meeting-ingest/interpret', {
        rawMeetingNotesId: selectedNote.id,
      });
      if (res.data?.success) {
        setMeetingParseResult(res.data);
        setMeetingContactEmailOverride(res.data.parsed?.contactEmail || '');
        setMeetingContactNameOverride(res.data.parsed?.contactName || '');
        setMeetingDateOverride(res.data.parsed?.activityDate || '');
        setMeetingSummaryOverride(res.data.parsed?.summary || '');
        setMeetingNextEngageOverride(res.data.parsed?.nextEngagementDate || '');
      } else {
        setMeetingActionMessage({ type: 'error', text: res.data?.error || 'Interpret failed' });
      }
    } catch (err) {
      setMeetingActionMessage({
        type: 'error',
        text: err.response?.data?.error || err.message || 'Interpret failed',
      });
    } finally {
      setMeetingAnalyzeLoading(false);
    }
  };

  const handleMeetingSave = async (e) => {
    e?.stopPropagation?.();
    if (!selectedNote) return;
    const contactId = meetingContactIdOverride || meetingParseResult?.contact?.id;
    if (!contactId) {
      setMeetingActionMessage({
        type: 'error',
        text: 'Select or match a contact to save this meeting.',
      });
      return;
    }
    setMeetingActionMessage(null);
    setMeetingPushLoading(true);
    try {
      const payload = {
        rawMeetingNotesId: selectedNote.id,
        contactId,
      };
      if (meetingDateOverride) payload.meetingDate = meetingDateOverride;
      if (meetingSummaryOverride) payload.summary = meetingSummaryOverride;
      if (meetingNextEngageOverride) payload.nextEngagementDate = meetingNextEngageOverride;
      const res = await api.post('/api/meeting-ingest/save', payload);
      if (res.data?.success) {
        setNotes((prev) => prev.filter((x) => x.id !== selectedNote.id));
        setSelectedNote(null);
        resetMeetingDetailState();
        setMeetingActionMessage({
          type: 'success',
          text: `Saved as Meeting. Contact linked.`,
        });
        setTimeout(() => setMeetingActionMessage(null), 5000);
      } else {
        setMeetingActionMessage({
          type: 'error',
          text: res.data?.error || 'Save failed',
        });
      }
    } catch (err) {
      setMeetingActionMessage({
        type: 'error',
        text: err.response?.data?.error || err.message || 'Save failed',
      });
    } finally {
      setMeetingPushLoading(false);
    }
  };

  const handleDelete = async (e) => {
    e?.stopPropagation?.();
    if (!selectedEmail) return;
    const alreadySaved = selectedEmail.ingestionStatus === 'RECORDED';
    const confirmMsg = alreadySaved
      ? 'This was already saved to the CRM. Deleting only removes the inbound copy; the saved activity stays. Continue?'
      : 'Delete this inbound email? This cannot be undone.';
    if (!confirm(confirmMsg)) return;
    setActionMessage(null);
    setDeleteLoading(true);
    try {
      await api.delete(`/api/inbound-parse/${selectedEmail.id}`);
      setEmails((prev) => prev.filter((x) => x.id !== selectedEmail.id));
      setSelectedEmail(null);
      resetDetailState();
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err.response?.data?.error || err.message || 'Delete failed',
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  // Parse & Save: run interpret to open Email activity matcher (contact name/email, subject, summary, date)
  const handleParseAndSave = async (e) => {
    e?.stopPropagation?.();
    if (!selectedEmail) return;
    setInboundSaveComplete(false);
    setRecordedContactId(null);
    setActionMessage(null);
    setAnalyzeLoading(true);
    setParseResult(null);
    setContactIdOverride(null);
    setConfirmJobChange(false);
    try {
      const res = await api.post('/api/inbound-parse/interpret', {
        inboundEmailId: selectedEmail.id,
        generatePipelineMatch,
        forceReparse: manualReparse || selectedEmail.ingestionStatus === 'RECORDED',
      });
      if (res.data?.success) {
        setParseResult(res.data);
        setContactEmailOverride(res.data.parsed?.contactEmail || '');
        setContactNameOverride(res.data.parsed?.contactName || '');
        setNextEngageOverride(res.data.nextEngage?.recommended || '');
        setSubjectOverride(res.data.parsed?.subject || '');
        setSummaryOverride(res.data.parsed?.summary || '');
        setNextEngagementPurposeOverride(
          res.data.parsed?.nextEngagementPurpose ||
            res.data.interpretation?.nextEngagementPurpose ||
            '',
        );
        if (res.data.alreadyIngested) {
          setActionMessage({
            type: 'error',
            text: 'This email may already be ingested. Check history below.',
          });
        }
      } else {
        setActionMessage({ type: 'error', text: res.data?.error || 'Parse failed' });
      }
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err.response?.data?.error || err.message || 'Parse failed',
      });
    } finally {
      setAnalyzeLoading(false);
    }
  };

  const handleSave = async (e) => {
    e?.stopPropagation?.();
    if (!selectedEmail || inboundSaveComplete) return;

    setActionMessage(null);
    setPushLoading(true);
    setRecordedContactId(null);
    try {
      const payload = {
        inboundEmailId: selectedEmail.id,
        manualOverride:
          manualReparse || selectedEmail.ingestionStatus === 'RECORDED',
      };
      if (nextEngageOverride) payload.nextEngagementDate = nextEngageOverride;
      if (nextEngagementPurposeOverride)
        payload.nextEngagementPurpose = nextEngagementPurposeOverride;
      if (contactEmailOverride) payload.contactEmail = contactEmailOverride;
      if (contactIdOverride) payload.contactIdOverride = contactIdOverride;
      if (parseResult?.interpretation) {
        const mergedPurpose =
          nextEngagementPurposeOverride !== ''
            ? nextEngagementPurposeOverride
            : parseResult.interpretation?.nextEngagementPurpose ??
              parseResult.parsed?.nextEngagementPurpose;
        payload.interpretation = {
          ...parseResult.interpretation,
          subject: subjectOverride || parseResult.parsed?.subject,
          summary: summaryOverride || parseResult.parsed?.summary,
          contactEmail: contactEmailOverride || parseResult.parsed?.contactEmail,
          contactName: contactNameOverride || parseResult.parsed?.contactName,
          contactCompany:
            parseResult.parsed?.contactCompany ?? parseResult.interpretation?.contactCompany ?? null,
          nextEngagementDate: nextEngageOverride || parseResult.nextEngage?.recommended,
          ...(mergedPurpose != null && mergedPurpose !== ''
            ? { nextEngagementPurpose: mergedPurpose }
            : {}),
        };
      }
      if (generatePipelineMatch) payload.generatePipelineMatch = true;
      if (applyPipelineMatch) payload.applyPipelineMatch = true;
      if (confirmJobChange && jobChangeDetected) {
        payload.updateContactProfile = true;
        const ne = (contactEmailOverride || parseResult?.parsed?.contactEmail || '').trim();
        if (ne) payload.newContactEmail = ne;
        const nc = (parseResult?.parsed?.contactCompany || '').trim();
        if (nc) payload.newCompanyName = nc;
      }
      const res = await api.post('/api/inbound-parse/push-to-ai', payload);
      const { parsed, contactId, recordType } = res.data;
      if (contactId) setRecordedContactId(contactId);
      setEmails((prev) => prev.filter((x) => x.id !== selectedEmail.id));
      setSelectedEmail((prev) =>
        prev ? { ...prev, ingestionStatus: 'RECORDED' } : null,
      );
      setInboundSaveComplete(true);
      if (companyHQId) fetchInboundEmails(companyHQId, inboundTab);

      const recordLabel = recordType || 'Activity';
      const purposeSnip =
        parsed?.nextEngagementPurpose &&
        (NEXT_ENGAGEMENT_PURPOSE_LABELS[parsed.nextEngagementPurpose] ||
          parsed.nextEngagementPurpose);

      setLastInboundSave({
        recordType: recordLabel,
        contactEmail: parsed?.contactEmail || null,
        nextEngagementDate: parsed?.nextEngagementDate || null,
        purposeLabel: purposeSnip || null,
        summarySnippet: parsed?.summary ? parsed.summary.slice(0, 240) : null,
        contactId: contactId || null,
        subject: selectedEmail?.subject || null,
      });

      setParseResult(null);
      setContactEmailOverride('');
      setContactNameOverride('');
      setContactIdOverride(null);
      setNextEngageOverride('');
      setNextEngagementPurposeOverride('');
      setSubjectOverride('');
      setSummaryOverride('');
      setSelectedContactEmailHistory(null);
      setApplyPipelineMatch(false);
      setThreadOpen(false);
      setConfirmJobChange(false);
      setActionMessage(null);
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err.response?.data?.error || err.message || 'Save failed',
      });
    } finally {
      setPushLoading(false);
    }
  };

  const handleLookupContact = async () => {
    const email = (contactEmailOverride || parseResult?.parsed?.contactEmail || '').trim();
    if (!email || !companyHQId) return;
    setLookupContactLoading(true);
    setActionMessage(null);
    try {
      const res = await api.get(
        `/api/contacts/lookup-by-email?email=${encodeURIComponent(email)}&crmId=${encodeURIComponent(companyHQId)}`
      );
      if (res.data?.success && res.data.contact) {
        setParseResult((prev) => (prev ? { ...prev, contact: res.data.contact } : prev));
        setContactIdOverride(null);
        setActionMessage({ type: 'success', text: 'Contact found by email.' });
        setTimeout(() => setActionMessage(null), 3000);
      }
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err.response?.data?.error || err.message || 'Lookup failed',
      });
    } finally {
      setLookupContactLoading(false);
    }
  };

  const handleCreateContact = async () => {
    const nameInput = (contactNameOverride || parseResult?.parsed?.contactName || '').trim();
    const email = (contactEmailOverride || parseResult?.parsed?.contactEmail || '').trim();
    const nameParts = nameInput ? nameInput.split(/\s+/).filter(Boolean) : [];
    let firstName = nameParts[0] || '';
    let lastName = nameParts.slice(1).join(' ') || '';
    if (!firstName && email) {
      const local = email.split('@')[0] || '';
      firstName = local.replace(/[._]/g, ' ') || 'Unknown';
      lastName = '';
    }
    if (!firstName) {
      setActionMessage({
        type: 'error',
        text: 'Enter a contact name in Step 1 or an email to create a contact.',
      });
      return;
    }

    // Email optional when we have a name; when creating from email-only we use it

    setCreateContactLoading(true);
    setActionMessage(null);
    try {
      const res = await api.post('/api/contacts/create', {
        crmId: companyHQId,
        firstName,
        lastName,
        email,
      });
      if (res.data?.success && res.data?.contact) {
        const newContactId = res.data.contact.id;
        const displayName = [firstName, lastName].filter(Boolean).join(' ') || email || 'Unknown';
        setContactIdOverride(newContactId);
        if (email) setContactEmailOverride(email);
        setParseResult((prev) =>
          prev
            ? {
                ...prev,
                contact: {
                  id: newContactId,
                  name: displayName,
                  email: email || null,
                  company: null,
                  title: null,
                  pipeline: null,
                  optedOut: false,
                },
              }
            : prev
        );
        const emailLabel = email ? ` (${email})` : ' (no email — can be enriched later)';
        setActionMessage({
          type: 'success',
          text: `Contact created: ${displayName}${emailLabel}`,
        });
        setTimeout(() => setActionMessage(null), 5000);
      } else {
        setActionMessage({
          type: 'error',
          text: res.data?.error || 'Failed to create contact',
        });
      }
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err.response?.data?.error || err.message || 'Create contact failed',
      });
    } finally {
      setCreateContactLoading(false);
    }
  };

  const hasContent = !!(selectedEmail?.text || selectedEmail?.html || selectedEmail?.email);
  const statusRecorded = selectedEmail?.ingestionStatus === 'RECORDED';
  const inboundAlreadyRecorded =
    inboundSaveComplete || (statusRecorded && !manualReparse);
  const showReparseAnyway = statusRecorded && !inboundSaveComplete && hasContent;

  if (missing) {
    return <CompanyKeyMissingError />;
  }

  if (loading && meetingLoading) {
    return (
      <div className="py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <PageHeader title="Inbound Parse" subtitle="Loading..." />
          <div className="flex items-center justify-center py-12">
            <div className="text-sm text-gray-500">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Inbound Parse"
          subtitle="Outreach updates (email) and meeting updates (notes) from SendGrid Inbound Parse"
        />

        {inboundHealth && inboundHealth.status !== 'ok' && (
          <div className={`mb-4 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
            inboundHealth.status === 'down'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              {inboundHealth.status === 'down' ? (
                <>
                  <span className="font-semibold">Inbound pipeline is down.</span>{' '}
                  MX record for <code className="text-xs bg-red-100 px-1 rounded">{inboundHealth.host}</code> is missing or not pointing to SendGrid.
                  Emails sent to your CRM address will not be received until it is restored.
                </>
              ) : (
                <>
                  <span className="font-semibold">Inbound ingest looks quiet.</span>{' '}
                  {inboundHealth.daysSinceLastReceived !== null ? (
                    <>
                      The newest <strong>stored</strong> raw email (any tenant) is{' '}
                      {inboundHealth.daysSinceLastReceived} day
                      {inboundHealth.daysSinceLastReceived === 1 ? '' : 's'} old
                      {inboundHealth.lastIngestionStatus
                        ? ` — status when saved: ${inboundHealth.lastIngestionStatus}`
                        : ''}
                      . That means nothing new has been written to{' '}
                      <code className="text-xs bg-amber-100 px-1 rounded">InboundEmail</code> since
                      then (webhook did not complete a save, or no mail arrived).
                    </>
                  ) : (
                    <>
                      No <code className="text-xs bg-amber-100 px-1 rounded">InboundEmail</code>{' '}
                      rows exist yet.
                    </>
                  )}
                  {inboundHealth.rollup30dTotal > 0 && (
                    <>
                      {' '}
                      Last {inboundHealth.rollup30dDays ?? 30} days (global):{' '}
                      {Object.entries(inboundHealth.rollup30dByStatus || {})
                        .map(([st, n]) => `${st}: ${n}`)
                        .join(' · ')}
                      . Failures <strong>after</strong> a row is saved show under the Failed tab and do
                      not mean “no email received.”
                    </>
                  )}
                  {' '}
                  MX for <code className="text-xs bg-amber-100 px-1 rounded">{inboundHealth.host}</code>{' '}
                  looks OK — if you expect traffic, confirm SendGrid Inbound Parse POST URL is{' '}
                  <code className="text-xs bg-amber-100 px-1 rounded">/api/inbound-email</code> and the
                  To address matches a company slug.
                </>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* ── Left: Outreach Updates (email) ── */}
          <div className="flex flex-col gap-4 border rounded-xl bg-white/80 p-4 shadow-sm">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-600" />
              Outreach Updates
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
                <button
                  type="button"
                  onClick={() => {
                    setInboundTab('inbox');
                  }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
                    inboundTab === 'inbox' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Inbox
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInboundTab('recorded');
                  }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
                    inboundTab === 'recorded' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Saved
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInboundTab('failed');
                  }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
                    inboundTab === 'failed' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Failed
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInboundTab('all');
                  }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
                    inboundTab === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  All
                </button>
              </div>
              <span className="text-sm text-gray-600">
                <label htmlFor="inbound-days" className="mr-1.5 text-gray-500">
                  List range
                </label>
                <select
                  id="inbound-days"
                  value={inboundDays}
                  onChange={(e) => setInboundDays(Number(e.target.value))}
                  className="rounded border border-gray-200 bg-white px-2 py-1 text-sm text-gray-800"
                >
                  <option value={7}>7 days</option>
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                </select>
              </span>
              <span className="text-sm text-gray-600">
                {inboundTab === 'inbox' && `To process (${displayEmails.length})`}
                {inboundTab === 'recorded' && `Saved (${displayEmails.length})`}
                {inboundTab === 'failed' && `Failed (${displayEmails.length})`}
                {inboundTab === 'all' && `All (${displayEmails.length})`}
              </span>
              <button
                type="button"
                onClick={() => fetchInboundEmails(companyHQId, inboundTab)}
                className="text-sm text-blue-600 hover:underline"
              >
                Refresh
              </button>
              {inboundTab === 'inbox' && displayEmails.length > 0 && (
                <button
                  type="button"
                  onClick={handleProcessPending}
                  disabled={bulkProcessing || !companyHQId}
                  className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-900 shadow-sm transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4 shrink-0" />
                  {bulkProcessing ? 'Processing…' : 'Auto-process pending'}
                </button>
              )}
            </div>
            {bulkProcessMessage && inboundTab === 'inbox' && (
              <div
                role="status"
                className={`mt-2 rounded-md border px-3 py-2 text-sm ${
                  bulkProcessMessage.type === 'success'
                    ? 'border-green-200 bg-green-50 text-green-900'
                    : bulkProcessMessage.type === 'warn'
                      ? 'border-amber-200 bg-amber-50 text-amber-900'
                      : 'border-red-200 bg-red-50 text-red-900'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p>{bulkProcessMessage.text}</p>
                    {bulkProcessResults?.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setBulkResultsExpanded((v) => !v)}
                        className="mt-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 hover:underline"
                      >
                        {bulkResultsExpanded ? 'Hide details' : 'Show details'}
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setBulkProcessMessage(null);
                      setBulkProcessResults(null);
                      setBulkResultsExpanded(false);
                    }}
                    className="shrink-0 rounded px-2 py-0.5 text-xs font-medium text-gray-600 hover:bg-black/5"
                  >
                    Dismiss
                  </button>
                </div>
                {bulkResultsExpanded && bulkProcessResults?.length > 0 && (
                  <ul className="mt-3 space-y-2 border-t border-black/10 pt-3 text-xs">
                    {bulkProcessResults.map((r) => (
                      <li
                        key={r.id}
                        className="rounded-md border border-gray-200 bg-white/80 px-2.5 py-2 text-gray-800"
                      >
                        {!r.ok ? (
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-900">
                                Failed
                              </span>
                              <span className="font-medium">{r.subject || 'No subject'}</span>
                            </div>
                            {r.fromPreview && (
                              <p className="text-[11px] text-gray-500 line-clamp-2">{r.fromPreview}</p>
                            )}
                            <p className="text-red-800 break-words">{r.error}</p>
                          </div>
                        ) : r.contactId ? (
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-green-900">
                                Linked
                              </span>
                              <span className="rounded bg-gray-100 px-1.5 py-0 text-[10px] font-medium text-gray-700">
                                {bulkRecordKindLabel(r.activityType, r.recordType)}
                              </span>
                              <Link
                                href={`/contacts/${r.contactId}?companyHQId=${encodeURIComponent(companyHQId || '')}`}
                                className="font-semibold text-blue-700 hover:underline"
                              >
                                {r.contactName || r.contactEmail || 'Open contact'}
                              </Link>
                              {r.contactEmail && r.contactName && (
                                <span className="text-gray-500">({r.contactEmail})</span>
                              )}
                            </div>
                            {r.summary && (
                              <p className="text-gray-600 line-clamp-2 italic">{r.summary}</p>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
                                No contact match
                              </span>
                              <span className="rounded bg-gray-100 px-1.5 py-0 text-[10px] font-medium text-gray-700">
                                {bulkRecordKindLabel(r.activityType, r.recordType)}
                              </span>
                              <span className="font-medium">
                                {r.contactName || r.contactEmail || 'Prospect email unknown'}
                              </span>
                            </div>
                            {r.summary && (
                              <p className="text-gray-600 line-clamp-2 italic">{r.summary}</p>
                            )}
                            <p className="text-[11px] text-gray-500">
                              Record may exist without a linked contact. Open this thread from Saved or All, pick the
                              contact, and save.
                            </p>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {displayEmails.length === 0 && !selectedEmail ? (
              <div className="py-8 text-center text-sm text-gray-500 rounded-lg bg-gray-50">
                {inboundTab === 'inbox' && (
                  <>
                    <Inbox className="h-10 w-10 mx-auto mb-2 text-gray-400" />
                    No inbound emails to process.
                  </>
                )}
                {inboundTab === 'recorded' && (
                  <>
                    <CheckCircle className="h-10 w-10 mx-auto mb-2 text-gray-400" />
                    No saved emails yet. Record an email from Inbox to see it here.
                  </>
                )}
                {inboundTab === 'failed' && (
                  <>
                    <AlertTriangle className="h-10 w-10 mx-auto mb-2 text-amber-500" />
                    No failed ingest rows in this period. Failed items drop out of Inbox but stay here and under All —
                    open one and use Push to AI / Record again after fixing the cause.
                  </>
                )}
                {inboundTab === 'all' && (
                  <>
                    <Mail className="h-10 w-10 mx-auto mb-2 text-gray-400" />
                    No inbound emails in this period.
                  </>
                )}
              </div>
            ) : selectedEmail ? (
              <div className="flex flex-wrap items-center gap-2 px-3 py-2 border border-blue-200 rounded-lg bg-blue-50/80">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedEmail(null);
                    resetDetailState();
                  }}
                  className="text-xs font-medium text-blue-700 hover:underline shrink-0"
                >
                  ← All emails
                </button>
                <span className="text-sm font-medium text-gray-900 truncate max-w-[140px]">
                  {extractName(selectedEmail.from) || extractEmailAddress(selectedEmail.from) || 'Unknown'}
                </span>
                <span className="text-xs text-gray-600 truncate flex-1 min-w-0">
                  {selectedEmail.subject || '(No subject)'}
                </span>
                <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                  {formatDate(selectedEmail.createdAt)}
                </span>
              </div>
            ) : (
              <div className="space-y-1 max-h-[280px] overflow-auto">
                {groupEmailsByDate(displayEmails).map((group) => (
                  <div key={group.key} className="space-y-1">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-1 pb-0.5">
                      {group.label}
                    </div>
                    {group.emails.map((email) => {
                      const fromEmail = extractEmailAddress(email.from);
                      const fromName = extractName(email.from);
                      return (
                        <div
                          key={email.id}
                          onClick={() => {
                            setSelectedEmail(email);
                            resetDetailState();
                          }}
                          className={`px-3 py-2 border rounded cursor-pointer hover:bg-gray-50 transition flex items-center gap-2 ${
                            selectedEmail?.id === email.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <span className="text-sm font-medium truncate">
                                {fromName || fromEmail || 'Unknown'}
                              </span>
                              <span className="text-xs text-gray-500 truncate flex-1 min-w-0">
                                {email.subject || '(No subject)'}
                              </span>
                              {email.ingestionStatus === 'FAILED' && (
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-red-800 bg-red-100 border border-red-200 px-1.5 py-0 rounded shrink-0">
                                  Failed
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-400 truncate mt-0.5">
                              {fromEmail || email.from || 'No sender'}
                            </div>
                            {email.parsedContactEmail && (
                              <div className="text-xs text-indigo-600 truncate mt-0.5 flex items-center gap-1">
                                <User className="w-3 h-3 shrink-0" />
                                {email.parsedContactName
                                  ? `${email.parsedContactName} · ${email.parsedContactEmail}`
                                  : email.parsedContactEmail}
                              </div>
                            )}
                            {email.processingError && (
                              <div className="text-[11px] text-red-800 mt-1 line-clamp-4 whitespace-pre-wrap break-words">
                                {email.processingError}
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                            {formatDate(email.createdAt)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
            {selectedEmail && (
              <div className="border rounded-lg p-6 bg-white">
                {/* Action bar — minimal after save (matcher hidden; use next steps below) */}
                <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold">Email Details</h3>
                    {inboundSaveComplete && (
                      <span className="text-xs font-semibold uppercase tracking-wide text-green-800 bg-green-100 border border-green-200 px-2 py-0.5 rounded">
                        Recorded
                      </span>
                    )}
                  </div>
                  {!inboundSaveComplete && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowRaw(!showRaw)}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          {showRaw ? 'Show Parsed' : 'Show Raw'}
                        </button>
                        <label className="inline-flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer border-l border-gray-200 pl-3">
                          <input
                            type="checkbox"
                            checked={generatePipelineMatch}
                            onChange={(e) => setGeneratePipelineMatch(e.target.checked)}
                            disabled={inboundAlreadyRecorded}
                          />
                          Pipeline match
                        </label>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 border-l border-gray-200 pl-3 ml-1">
                        {showReparseAnyway && !manualReparse && (
                          <button
                            type="button"
                            onClick={() => {
                              setManualReparse(true);
                              setParseResult(null);
                              setActionMessage(null);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md border border-amber-300 bg-white text-amber-900 hover:bg-amber-50"
                            title="Manual recovery — re-run AI even though this row is already marked Recorded."
                          >
                            <Sparkles className="h-4 w-4" />
                            Re-parse anyway
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleParseAndSave}
                          disabled={
                            analyzeLoading || !hasContent || inboundAlreadyRecorded
                          }
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md bg-amber-100 text-amber-800 hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={
                            manualReparse
                              ? 'Re-run AI on this saved row. Review steps below, then Save all.'
                              : 'AI-parse this email (no save yet). Review steps below, then Save all.'
                          }
                        >
                          <Sparkles className="h-4 w-4" />
                          {analyzeLoading
                            ? 'Parsing…'
                            : manualReparse
                              ? 'Re-parse'
                              : 'Parse'}
                        </button>
                        <button
                          type="button"
                          onClick={handleDelete}
                          disabled={deleteLoading}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
                          title="Permanently delete this inbound email record."
                        >
                          <Trash2 className="h-4 w-4" />
                          {deleteLoading ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  )}
                  {inboundSaveComplete && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleteLoading}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50 border border-red-100"
                      title="Remove this inbound copy from the queue (CRM activity stays saved)."
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {deleteLoading ? 'Deleting…' : 'Delete inbound copy'}
                    </button>
                  )}
                </div>

                {selectedEmail.ingestionStatus === 'FAILED' && selectedEmail.processingError && (
                  <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                    <p className="font-semibold">Last auto-process error</p>
                    <p className="mt-1 whitespace-pre-wrap break-words">{selectedEmail.processingError}</p>
                  </div>
                )}

                {/* Full email thread / MIME — always available to verify the AI summary (before & after parse, after save) */}
                <details
                  className="mb-4 rounded-lg border border-slate-200 bg-slate-50/80 group"
                  open={threadOpen}
                  onToggle={(e) => setThreadOpen(e.currentTarget.open)}
                >
                  <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-slate-800 flex items-center gap-2 hover:bg-slate-100/80 rounded-lg list-none [&::-webkit-details-marker]:hidden">
                    <Mail className="h-4 w-4 text-slate-600 shrink-0" />
                    View email thread
                    <span className="ml-auto text-xs font-normal text-slate-500 group-open:hidden">
                      expand
                    </span>
                    <span className="ml-auto text-xs font-normal text-slate-500 hidden group-open:inline">
                      collapse
                    </span>
                  </summary>
                  <div className="border-t border-slate-200 px-3 py-3 space-y-3 text-sm max-h-[min(80vh,32rem)] overflow-y-auto">
                    {showRaw ? (
                      <div className="space-y-4">
                        {selectedEmail.email && (
                          <div>
                            <label className="text-sm font-semibold text-gray-600 block mb-2">
                              Raw MIME (SendGrid &ldquo;email&rdquo; field - full MIME when
                              &ldquo;Include Raw&rdquo; enabled)
                            </label>
                            <pre className="p-3 bg-gray-100 rounded text-xs overflow-auto max-h-64 whitespace-pre-wrap">
                              {selectedEmail.email}
                            </pre>
                          </div>
                        )}
                        <div>
                          <label className="text-sm font-semibold text-gray-600 block mb-2">
                            Headers
                          </label>
                          <pre className="p-3 bg-gray-100 rounded text-xs overflow-auto max-h-48 whitespace-pre-wrap">
                            {selectedEmail.headers || '(No headers)'}
                          </pre>
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-gray-600 block mb-2">
                            Text body
                          </label>
                          <pre className="p-3 bg-gray-100 rounded text-xs overflow-auto max-h-48 whitespace-pre-wrap">
                            {selectedEmail.text || '(No text body)'}
                          </pre>
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-gray-600 block mb-2">
                            HTML body
                          </label>
                          <div className="p-3 bg-gray-100 rounded text-xs overflow-auto max-h-48">
                            {selectedEmail.html ? (
                              <div dangerouslySetInnerHTML={{ __html: selectedEmail.html }} />
                            ) : (
                              '(No HTML body)'
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-semibold text-gray-600 block mb-1 flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            From
                          </label>
                          <div>
                            {extractName(selectedEmail.from) && (
                              <div className="font-medium">{extractName(selectedEmail.from)}</div>
                            )}
                            <div className="text-sm text-gray-600">
                              {extractEmailAddress(selectedEmail.from) ||
                                selectedEmail.from ||
                                '(No sender)'}
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-gray-600 block mb-1 flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            To
                          </label>
                          <div className="text-sm text-gray-600">
                            {selectedEmail.to || '(No recipient)'}
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-gray-600 block mb-1 flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Subject
                          </label>
                          <div>{selectedEmail.subject || '(No subject)'}</div>
                        </div>
                        {selectedEmail.text && (
                          <div>
                            <label className="text-sm font-semibold text-gray-600 block mb-1">
                              Thread (text)
                            </label>
                            <pre className="p-3 bg-white rounded border text-xs whitespace-pre-wrap max-h-64 overflow-auto">
                              {selectedEmail.text}
                            </pre>
                          </div>
                        )}
                        {selectedEmail.html && (
                          <div>
                            <label className="text-sm font-semibold text-gray-600 block mb-1">
                              HTML body
                            </label>
                            <div className="p-3 bg-white rounded text-xs max-h-48 overflow-auto border">
                              <div dangerouslySetInnerHTML={{ __html: selectedEmail.html }} />
                            </div>
                          </div>
                        )}
                        {!selectedEmail.text && !selectedEmail.html && selectedEmail.email && (
                          <div>
                            <label className="text-sm font-semibold text-gray-600 block mb-1">
                              Content (raw MIME — forwarded / no text+html)
                            </label>
                            <div className="rounded border border-amber-200 bg-amber-50 p-2 mb-2">
                              <p className="text-xs text-amber-700">
                                No parsed text/html. Use <strong>Show Raw</strong> in the header
                                for full MIME.
                              </p>
                            </div>
                            <pre className="p-3 bg-white rounded text-xs overflow-auto max-h-48 whitespace-pre-wrap border">
                              {selectedEmail.email.substring(0, 2000)}
                              {selectedEmail.email.length > 2000
                                ? `\n\n... (${selectedEmail.email.length} chars — use Show Raw for all)`
                                : ''}
                            </pre>
                          </div>
                        )}
                        {selectedEmail.headers && (
                          <div>
                            <label className="text-sm font-semibold text-gray-600 block mb-1">
                              Headers
                            </label>
                            <pre className="p-3 bg-white rounded text-xs overflow-auto max-h-32 whitespace-pre-wrap border">
                              {selectedEmail.headers}
                            </pre>
                          </div>
                        )}
                        <div>
                          <label className="text-sm font-semibold text-gray-600 block mb-1 flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Received
                          </label>
                          <div className="text-sm text-gray-600">
                            {formatDate(selectedEmail.createdAt)}
                          </div>
                        </div>
                        {selectedEmail.ingestionStatus && (
                          <div>
                            <label className="text-sm font-semibold text-gray-600 block mb-1">
                              Status
                            </label>
                            <span
                              className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                selectedEmail.ingestionStatus === 'RECORDED'
                                  ? 'bg-indigo-100 text-indigo-700'
                                  : selectedEmail.ingestionStatus === 'RECEIVED'
                                    ? 'bg-green-100 text-green-700'
                                    : selectedEmail.ingestionStatus === 'FAILED'
                                      ? 'bg-red-100 text-red-700'
                                      : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {selectedEmail.ingestionStatus}
                            </span>
                            {selectedEmail.ingestionStatus === 'RECORDED' && (
                              <p className="text-xs text-gray-500 mt-1">
                                Marked Recorded in the ingest queue.
                                {manualReparse
                                  ? ' Use Re-parse, then Save all, to recover or redo CRM work.'
                                  : ' Use Re-parse anyway if auto-processing failed silently.'}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </details>

                {/* Transient errors / success (lookup, etc.) — not the main Save all success card */}
                {actionMessage && actionMessage.type === 'error' && (
                  <div className="mb-4 px-3 py-2 rounded text-sm border bg-red-50 text-red-800 border-red-100">
                    {actionMessage.text}
                  </div>
                )}
                {actionMessage &&
                  actionMessage.type === 'success' &&
                  !inboundSaveComplete && (
                    <div className="mb-4 px-3 py-2 rounded text-sm border bg-green-50 text-green-900 border-green-200">
                      {actionMessage.text}
                    </div>
                  )}

                {/* Post-save: collapsed summary + next steps (matcher cleared) */}
                {inboundSaveComplete && lastInboundSave && (
                  <div className="mb-4 rounded-xl border border-green-200 bg-gradient-to-b from-green-50 to-white p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-9 w-9 text-green-600 shrink-0" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-green-900">Saved to CRM</p>
                        <p className="text-sm text-gray-800 mt-0.5">
                          <span className="font-medium">{lastInboundSave.recordType}</span>
                          {lastInboundSave.subject && (
                            <span className="text-gray-600"> · {lastInboundSave.subject}</span>
                          )}
                        </p>
                        <ul className="mt-2 space-y-1 text-sm text-gray-700">
                          {lastInboundSave.contactEmail && (
                            <li>
                              <span className="text-gray-500">Contact</span>{' '}
                              {lastInboundSave.contactEmail}
                            </li>
                          )}
                          {(lastInboundSave.nextEngagementDate || lastInboundSave.purposeLabel) && (
                            <li>
                              <span className="text-gray-500">Next engage</span>{' '}
                              {lastInboundSave.nextEngagementDate || '—'}
                              {lastInboundSave.purposeLabel
                                ? ` (${lastInboundSave.purposeLabel})`
                                : ''}
                            </li>
                          )}
                          {lastInboundSave.summarySnippet && (
                            <li className="text-gray-600 line-clamp-3">{lastInboundSave.summarySnippet}</li>
                          )}
                        </ul>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedEmail(null);
                              resetDetailState();
                              if (companyHQId) fetchInboundEmails(companyHQId, 'inbox');
                            }}
                            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                          >
                            Process next email
                          </button>
                          {(recordedContactId || lastInboundSave.contactId) && (
                            <a
                              href={`/contacts/${recordedContactId || lastInboundSave.contactId}`}
                              className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
                            >
                              <ArrowRight className="h-4 w-4" />
                              View contact
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setInboundTab('recorded');
                              setSelectedEmail(null);
                              resetDetailState();
                            }}
                            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
                          >
                            Open Saved tab
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedEmail(null);
                              resetDetailState();
                            }}
                            className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:underline"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Email activity matcher — editable fields then Save */}
                {parseResult && (
                  <div className="mb-6 space-y-4">
                    <p className="text-xs text-gray-600">
                      Review each step, then use <strong>Save all</strong> at the bottom. Parse does not
                      write to the CRM. Use <strong>View email thread</strong> above to compare with the
                      summary.
                    </p>
                    <div className="p-4 rounded-lg border-2 border-indigo-200 bg-indigo-50/50">
                      <h4 className="text-sm font-semibold text-indigo-900 mb-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white text-xs font-bold">
                          1
                        </span>
                        What happened
                        {parseResult.parsed?.activityType && (
                          <ActivityTypeBadge type={parseResult.parsed.activityType} />
                        )}
                        {(parseResult.parsed?.priorMeetingDetected ||
                          parseResult.interpretation?.priorMeetingDetected) && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-violet-100 text-violet-800">
                            <History className="w-3 h-3" /> Prior meeting in thread
                            {(parseResult.parsed?.priorMeetingDate ||
                              parseResult.interpretation?.priorMeetingDate) &&
                              ` · ${parseResult.parsed?.priorMeetingDate || parseResult.interpretation?.priorMeetingDate}`}
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-indigo-800/90 mb-3">
                        Becomes the email activity and timeline summary when you save.
                      </p>
                      {parseResult.parsed?.activityType === 'outbound_email' && (
                        <p className="text-xs text-amber-950 bg-amber-50 border border-amber-200 rounded px-2 py-2 mb-3 leading-snug">
                          <span className="font-semibold">Outbound / proof-of-send:</span> This looks
                          like a forwarded copy of their outbound to a prospect (e.g. &ldquo;see I sent
                          this&rdquo;). We default the next touch to about{' '}
                          <strong>one week</strong> with purpose{' '}
                          <strong>Unresponsive</strong> — meaning assume the prospect may not have
                          replied yet; follow up then. Change the date or purpose if your process
                          differs.
                        </p>
                      )}
                      <div className="space-y-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="text-gray-600 font-medium w-28">Contact Name:</label>
                          <input
                            type="text"
                            value={contactNameOverride}
                            onChange={(e) => setContactNameOverride(e.target.value)}
                            className="px-2 py-1 rounded border border-gray-300 text-sm flex-1 min-w-[200px]"
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="text-gray-600 font-medium w-28">Contact Email:</label>
                          <input
                            type="email"
                            value={contactEmailOverride}
                            onChange={(e) => {
                              setContactEmailOverride(e.target.value);
                              // Typing an email clears any name-match selection
                              if (e.target.value) setContactIdOverride(null);
                            }}
                            className="px-2 py-1 rounded border border-gray-300 text-sm flex-1 min-w-[200px]"
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="text-gray-600 font-medium w-28">Subject:</label>
                          <input
                            type="text"
                            value={subjectOverride}
                            onChange={(e) => setSubjectOverride(e.target.value)}
                            className="px-2 py-1 rounded border border-gray-300 text-sm flex-1 min-w-[200px]"
                          />
                        </div>
                        {parseResult.parsed?.activityDate && (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-gray-600 font-medium w-28">Activity Date:</span>
                            <span className="text-sm font-medium text-purple-800">
                              {parseResult.parsed.activityDate}
                            </span>
                            <span className="text-xs text-gray-500">(extracted from content — not email received date)</span>
                          </div>
                        )}
                        {parseResult.parsed?.isResponse && (
                          <span className="inline-block px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-800">
                            Detected as response to outreach
                          </span>
                        )}
                        <div className="flex flex-wrap items-start gap-2">
                          <label className="text-gray-600 font-medium w-28 pt-1">Summary:</label>
                          <textarea
                            value={summaryOverride}
                            onChange={(e) => setSummaryOverride(e.target.value)}
                            rows={3}
                            className="px-2 py-1 rounded border border-gray-300 text-sm flex-1 min-w-[200px]"
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="text-gray-600 font-medium w-28">Next engagement:</label>
                          <input
                            type="date"
                            value={nextEngageOverride}
                            onChange={(e) => setNextEngageOverride(e.target.value)}
                            className="px-2 py-1 rounded border border-gray-300 text-sm"
                          />
                          <span className="text-xs text-gray-500">Updates contact when saved</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="text-gray-600 font-medium w-28">Next touch purpose:</label>
                          <select
                            value={nextEngagementPurposeOverride}
                            onChange={(e) => setNextEngagementPurposeOverride(e.target.value)}
                            className="px-2 py-1 rounded border border-gray-300 text-sm flex-1 min-w-[220px] max-w-md"
                          >
                            <option value="">— (AI / default)</option>
                            {NEXT_ENGAGEMENT_PURPOSE_VALUES.map((v) => (
                              <option key={v} value={v}>
                                {NEXT_ENGAGEMENT_PURPOSE_LABELS[v]}
                              </option>
                            ))}
                          </select>
                        </div>
                        {generatePipelineMatch && parseResult.pipelineMatch && (
                          <div className="rounded-lg border border-violet-200 bg-violet-50/80 p-3 text-xs space-y-2">
                            <p className="font-semibold text-violet-900">Pipeline match (preview)</p>
                            <p className="text-violet-800/90 leading-snug">
                              This pass only suggests a <strong>pipeline/stage change</strong> when the email
                              looks like a <strong>referral or connector handoff</strong> (introducing someone,
                              &ldquo;not the buyer,&rdquo; forward to X). Normal check-ins and buyer
                              conversations usually show <strong>no suggestion</strong> — that is expected.
                              Scheduled-meeting bumps use a separate rule on save.
                            </p>
                            <div className="text-violet-800 space-y-1">
                              <p>
                                Role: {parseResult.pipelineMatch.signals?.roleHint ?? '—'} · Referral:{' '}
                                {parseResult.pipelineMatch.signals?.referralIntroduced ? 'yes' : 'no'}
                              </p>
                              {parseResult.pipelineMatch.proposal ? (
                                <p>
                                  Suggested: {parseResult.pipelineMatch.proposal.targetPipeline} /{' '}
                                  {parseResult.pipelineMatch.proposal.targetStage} (
                                  {parseResult.pipelineMatch.proposal.confidence}%){' '}
                                  — {parseResult.pipelineMatch.proposal.rationale}
                                </p>
                              ) : (
                                <p className="text-gray-700">
                                  No connector/referral move suggested for this email — your pipeline row is
                                  unchanged unless you move it elsewhere in CRM.
                                </p>
                              )}
                            </div>
                            <label className="inline-flex items-center gap-2 cursor-pointer text-violet-900">
                              <input
                                type="checkbox"
                                checked={applyPipelineMatch}
                                onChange={(e) => setApplyPipelineMatch(e.target.checked)}
                                disabled={!parseResult.pipelineMatch.proposal}
                              />
                              Apply suggestion when saving (only when a suggestion appears above)
                            </label>
                          </div>
                        )}
                        {parseResult.parsed?.body && (
                          <div>
                            <span className="text-gray-600 font-medium">Body:</span>
                            <div className="mt-1 p-2 rounded bg-white/80 text-gray-700 max-h-20 overflow-auto text-xs whitespace-pre-wrap">
                              {parseResult.parsed.body.slice(0, 300)}
                              {parseResult.parsed.body.length > 300 ? '…' : ''}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ── Step 2: Contact Lookup ── */}
                    <div
                      className={`p-4 rounded-lg border-2 ${
                        parseResult.contact
                          ? 'border-green-200 bg-green-50/50'
                          : parseResult.nameMatches?.length > 0
                          ? 'border-amber-200 bg-amber-50/50'
                          : 'border-red-200 bg-red-50/50'
                      }`}
                    >
                      <h4
                        className={`text-sm font-semibold mb-3 flex items-center gap-2 ${
                          parseResult.contact
                            ? 'text-green-900'
                            : parseResult.nameMatches?.length > 0
                            ? 'text-amber-900'
                            : 'text-red-900'
                        }`}
                      >
                        <span
                          className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-xs font-bold ${
                            parseResult.contact
                              ? 'bg-green-600'
                              : parseResult.nameMatches?.length > 0
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                          }`}
                        >
                          2
                        </span>
                        Contact Lookup
                      </h4>

                      {parseResult.contact ? (
                        // Exact email match found
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="font-medium">
                              {parseResult.contact.name || parseResult.contact.email}
                            </span>
                            {parseResult.contact.title && (
                              <span className="text-gray-500">· {parseResult.contact.title}</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                            {parseResult.contact.company && (
                              <span>Company: {parseResult.contact.company}</span>
                            )}
                            {parseResult.contact.pipeline && (
                              <span>
                                Pipeline:{' '}
                                <span className="font-medium">{parseResult.contact.pipeline}</span>
                              </span>
                            )}
                            {parseResult.contact.optedOut && (
                              <span className="text-red-600 font-medium">OPTED OUT</span>
                            )}
                          </div>
                        </div>
                      ) : parseResult.nameMatches?.length > 0 ? (
                        // No email match but name-based candidates found
                        <div className="space-y-3 text-sm">
                          <div className="flex flex-wrap items-center gap-2 text-amber-800 text-xs">
                            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                            <span>
                              No exact email match. Select a contact below, look up by email, type
                              their email above to create a new contact, or record without linking.
                            </span>
                            {(contactEmailOverride || parseResult?.parsed?.contactEmail) && companyHQId && (
                              <button
                                type="button"
                                onClick={handleLookupContact}
                                disabled={lookupContactLoading}
                                className="ml-1 inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                              >
                                {lookupContactLoading ? 'Looking up…' : 'Look up contact'}
                              </button>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {parseResult.nameMatches.map((match) => (
                              <button
                                key={match.id}
                                onClick={() => {
                                  setContactIdOverride(
                                    contactIdOverride === match.id ? null : match.id
                                  );
                                  // Clear email override when picking by name
                                  setContactEmailOverride('');
                                  setConfirmJobChange(false);
                                }}
                                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                                  contactIdOverride === match.id
                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                                    : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300 hover:bg-indigo-50/50'
                                }`}
                              >
                                <div className="flex items-center gap-1.5">
                                  <User className="h-3 w-3" />
                                  <span>{match.name}</span>
                                </div>
                                {(match.company || match.email) && (
                                  <div className="text-gray-400 font-normal mt-0.5">
                                    {match.company || match.email}
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                          {contactIdOverride && (
                            <div className="flex items-center gap-1.5 text-xs text-indigo-700">
                              <CheckCircle className="h-3.5 w-3.5" />
                              Contact selected — will be linked on Record Activity
                            </div>
                          )}
                          {jobChangeDetected && contactIdOverride && (
                            <div className="rounded-lg border border-amber-300 bg-amber-50/90 p-3 text-xs text-amber-950 space-y-2">
                              <div className="flex gap-2">
                                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                <p>
                                  New email domain vs CRM record (
                                  <span className="font-mono">
                                    {emailDomainFromAddress(
                                      contactEmailOverride || parseResult.parsed?.contactEmail
                                    )}
                                  </span>{' '}
                                  vs{' '}
                                  <span className="font-mono">
                                    {emailDomainFromAddress(
                                      parseResult.nameMatches.find((m) => m.id === contactIdOverride)
                                        ?.email
                                    )}
                                  </span>
                                  ) — possible job change. Check below to update email, company, and
                                  domain on save, and use a &ldquo;new firm&rdquo; next-touch purpose.
                                </p>
                              </div>
                              <label className="flex items-start gap-2 cursor-pointer font-medium">
                                <input
                                  type="checkbox"
                                  className="mt-0.5 rounded border-amber-400"
                                  checked={confirmJobChange}
                                  onChange={(e) => {
                                    const on = e.target.checked;
                                    setConfirmJobChange(on);
                                    if (on) {
                                      setNextEngagementPurposeOverride('NEW_JOB_CHECK_IN');
                                    } else {
                                      setNextEngagementPurposeOverride(
                                        parseResult?.parsed?.nextEngagementPurpose ||
                                          parseResult?.interpretation?.nextEngagementPurpose ||
                                          ''
                                      );
                                    }
                                  }}
                                />
                                <span>
                                  Update contact email, company, and domain on save; stamp recent job
                                  change
                                </span>
                              </label>
                            </div>
                          )}
                        </div>
                      ) : (
                        // Nothing found
                        <div className="space-y-3 text-sm">
                          <div className="flex flex-wrap items-center gap-2 text-red-800">
                            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                            <span>
                              No contact found for &ldquo;
                              {contactEmailOverride ||
                                parseResult.parsed?.contactEmail ||
                                parseResult.parsed?.contactName ||
                                '(unknown)'}
                              &rdquo;.
                            </span>
                            {(contactEmailOverride || parseResult?.parsed?.contactEmail) && companyHQId && (
                              <button
                                type="button"
                                onClick={handleLookupContact}
                                disabled={lookupContactLoading}
                                className="ml-1 inline-flex items-center gap-1 rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
                              >
                                {lookupContactLoading ? 'Looking up…' : 'Look up contact'}
                              </button>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 items-center">
                            {(contactNameOverride || parseResult?.parsed?.contactName) || (contactEmailOverride || parseResult?.parsed?.contactEmail) ? (
                              <button
                                onClick={handleCreateContact}
                                disabled={createContactLoading}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <User className="h-3.5 w-3.5" />
                                {createContactLoading ? 'Creating…' : 'Create Contact'}
                              </button>
                            ) : (
                              <span className="text-xs text-gray-600">
                                Enter contact name or email in Step 1 to create a contact.
                              </span>
                            )}
                            {(!contactEmailOverride && !parseResult?.parsed?.contactEmail) &&
                              (contactNameOverride || parseResult?.parsed?.contactName) && (
                                <span className="text-xs text-gray-500">
                                  (Email optional — can be enriched later via Apollo/LinkedIn)
                                </span>
                              )}
                          </div>
                          <div className="text-xs text-gray-500">
                            Or you can record this activity without linking to a contact and link it
                            manually later.
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── Step 3: Email History ── */}
                    <div className="p-4 rounded-lg border-2 border-slate-200 bg-slate-50/50">
                      <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-600 text-white text-xs font-bold">
                          3
                        </span>
                        Email History
                        {parseResult.alreadyIngested && (
                          <span className="ml-2 px-2 py-0.5 rounded text-xs bg-red-100 text-red-700 font-medium">
                            Possible duplicate
                          </span>
                        )}
                      </h4>
                      {(() => {
                        const hasExactMatch = !!parseResult.contact;
                        const hasSelectedMatch = !!contactIdOverride;
                        const historyFromExact = parseResult.emailHistory;
                        const historyFromSelected = selectedContactEmailHistory;
                        const loadingSelected = selectedContactEmailHistoryLoading;
                        const emailHistoryToShow = hasExactMatch
                          ? historyFromExact
                          : hasSelectedMatch
                            ? historyFromSelected
                            : null;
                        if (loadingSelected) {
                          return (
                            <div className="text-sm text-gray-500 flex items-center gap-2">
                              <History className="h-4 w-4" />
                              Loading email history…
                            </div>
                          );
                        }
                        return emailHistoryToShow?.length > 0 ? (
                        <div className="space-y-2 max-h-48 overflow-auto">
                          {emailHistoryToShow.map((h) => (
                            <div
                              key={h.id}
                              className="flex items-start gap-2 text-xs p-2 rounded bg-white border border-slate-100"
                            >
                              <span
                                className={`mt-0.5 inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                                  h.direction === 'inbound' ? 'bg-blue-400' : 'bg-emerald-400'
                                }`}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center gap-2">
                                  <span className="font-medium truncate">
                                    {h.subject || '(No subject)'}
                                  </span>
                                  <span className="text-gray-400 whitespace-nowrap">
                                    {formatDate(h.date)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-gray-500">
                                  <span>{h.direction === 'inbound' ? '← Contact' : '→ Outbound'}</span>
                                  <span>·</span>
                                  <span>{h.type}</span>
                                  {h.platform && (
                                    <>
                                      <span>·</span>
                                      <span>{h.platform}</span>
                                    </>
                                  )}
                                  {h.hasResponse && (
                                    <span className="text-green-600 font-medium">Has response</span>
                                  )}
                                </div>
                                {h.body && (
                                  <div className="text-gray-500 mt-1 truncate">{h.body}</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 flex items-center gap-2">
                          <History className="h-4 w-4" />
                          {parseResult.contact || contactIdOverride
                            ? 'No email history for this contact yet'
                            : 'Select a contact above (or create one) to see their email history'}
                        </div>
                      );
                      })()}
                    </div>

                    {/* ── Step 4: Next Engagement ── */}
                    <div className="p-4 rounded-lg border-2 border-blue-200 bg-blue-50/50">
                      <h4 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold">
                          4
                        </span>
                        Next Engagement
                      </h4>
                      <div className="space-y-3 text-sm">
                        {parseResult.nextEngage?.currentOnContact && (
                          <div className="text-xs text-gray-600">
                            Currently on contact:{' '}
                            <span className="font-medium">
                              {parseResult.nextEngage.currentOnContact}
                            </span>
                            {parseResult.nextEngage.currentPurpose &&
                              ` (${parseResult.nextEngage.currentPurpose})`}
                          </div>
                        )}
                        {parseResult.nextEngage?.aiSuggested && (
                          <div className="text-xs text-indigo-700">
                            AI extracted:{' '}
                            <span className="font-medium">
                              {parseResult.nextEngage.aiSuggested}
                            </span>
                          </div>
                        )}
                        {parseResult.nextEngage?.aiSuggestedPurpose && (
                          <div className="text-xs text-indigo-700">
                            AI purpose:{' '}
                            <span className="font-medium">
                              {NEXT_ENGAGEMENT_PURPOSE_LABELS[
                                parseResult.nextEngage.aiSuggestedPurpose
                              ] || parseResult.nextEngage.aiSuggestedPurpose}
                            </span>
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="text-gray-600 font-medium">Set to:</label>
                          <input
                            type="date"
                            value={nextEngageOverride}
                            onChange={(e) => setNextEngageOverride(e.target.value)}
                            className="px-2 py-1 rounded border border-gray-300 text-sm"
                          />
                          <span className="text-xs text-gray-500">
                            Will update contact when saved
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="text-gray-600 font-medium">Purpose:</label>
                          <select
                            value={nextEngagementPurposeOverride}
                            onChange={(e) => setNextEngagementPurposeOverride(e.target.value)}
                            className="px-2 py-1 rounded border border-gray-300 text-sm flex-1 min-w-[220px] max-w-md"
                          >
                            <option value="">— (AI / default)</option>
                            {NEXT_ENGAGEMENT_PURPOSE_VALUES.map((v) => (
                              <option key={v} value={v}>
                                {NEXT_ENGAGEMENT_PURPOSE_LABELS[v]}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border-2 border-indigo-300 bg-indigo-50/90 p-4">
                      <p className="text-sm font-semibold text-indigo-950 mb-1">Save all</p>
                      <p className="text-xs text-indigo-900/90 mb-3">
                        One action saves the email summary activity, links the contact (if set), updates
                        next engagement on the contact when provided, and applies pipeline match if you
                        checked that option in step 1.
                      </p>
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={pushLoading || inboundSaveComplete}
                        className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Persist to CRM (email activity, contact fields, pipeline when enabled)."
                      >
                        {pushLoading
                          ? 'Saving…'
                          : inboundSaveComplete
                          ? 'Saved ✓'
                          : 'Save all'}
                      </button>
                      <p className="text-xs text-gray-600 mt-2">
                        Email summary · contact + next engagement · pipeline (when applied)
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Right: Meeting Updates (meeting notes → Meeting) ── */}
          <div className="flex flex-col gap-4 border rounded-xl bg-white/80 p-4 shadow-sm">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-600" />
              Meeting Updates
            </h2>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">To process ({notes.length})</span>
              <button
                onClick={() => fetchMeetingNotes(companyHQId)}
                className="text-sm text-blue-600 hover:underline"
              >
                Refresh
              </button>
            </div>
            {notes.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500 rounded-lg bg-gray-50">
                <FileText className="h-10 w-10 mx-auto mb-2 text-gray-400" />
                No meeting notes to process. Email slug.meeting@crm.yourdomain.com to add notes.
              </div>
            ) : (
              <div className="space-y-1 max-h-[280px] overflow-auto">
                {groupNotesByDate(notes).map((group) => (
                  <div key={group.key} className="space-y-1">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-1 pb-0.5">
                      {group.label}
                    </div>
                    {group.notes.map((note) => {
                      const fromEmail = extractEmailAddress(note.from);
                      const fromName = extractName(note.from);
                      return (
                        <div
                          key={note.id}
                          onClick={() => {
                            setSelectedNote(note);
                            resetMeetingDetailState();
                          }}
                          className={`px-3 py-2 border rounded cursor-pointer hover:bg-gray-50 transition flex items-center gap-2 ${
                            selectedNote?.id === note.id ? 'border-purple-500 bg-purple-50' : 'border-gray-200'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <span className="text-sm font-medium truncate">
                                {fromName || fromEmail || 'Unknown'}
                              </span>
                              <span className="text-xs text-gray-500 truncate flex-1 min-w-0">
                                {note.subject || '(Meeting notes)'}
                              </span>
                            </div>
                            <div className="text-xs text-gray-400 truncate mt-0.5">
                              {fromEmail || note.from || 'No sender'}
                            </div>
                          </div>
                          <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                            {formatDate(note.createdAt)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
            {selectedNote && (
              <div className="border rounded-lg p-6 bg-white">
                <div className="flex flex-wrap justify-between items-start gap-2 mb-4">
                  <h3 className="text-lg font-semibold">Meeting notes</h3>
                  <button
                    onClick={handleMeetingInterpret}
                    disabled={meetingAnalyzeLoading || !(selectedNote?.text || selectedNote?.html)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md bg-amber-100 text-amber-800 hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Extract contact, date, summary and open matcher to save to Meeting."
                  >
                    <Sparkles className="h-4 w-4" />
                    {meetingAnalyzeLoading ? 'Extracting…' : 'Parse & Save to Meeting'}
                  </button>
                </div>
                {meetingActionMessage && (
                  <div
                    className={`mb-4 px-3 py-2 rounded text-sm ${
                      meetingActionMessage.type === 'success'
                        ? 'bg-green-50 text-green-800'
                        : 'bg-red-50 text-red-800'
                    }`}
                  >
                    {meetingActionMessage.text}
                  </div>
                )}
                <div className="space-y-3 text-sm mb-4">
                  <div>
                    <span className="text-gray-600 font-medium">From:</span>{' '}
                    {selectedNote.from || '—'}
                  </div>
                  <div>
                    <span className="text-gray-600 font-medium">Subject:</span>{' '}
                    {selectedNote.subject || '—'}
                  </div>
                  <div>
                    <span className="text-gray-600 font-medium">Received:</span>{' '}
                    {formatDate(selectedNote.createdAt)}
                  </div>
                  {(selectedNote.text || selectedNote.html) && (
                    <div>
                      <span className="text-gray-600 font-medium block mb-1">Notes:</span>
                      <div className="p-3 bg-gray-50 rounded text-sm whitespace-pre-wrap max-h-48 overflow-auto">
                        {(selectedNote.text || '').trim() ||
                          (selectedNote.html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() ||
                          '—'}
                      </div>
                    </div>
                  )}
                </div>
                {meetingParseResult && (
                  <div className="space-y-4 p-4 rounded-lg border-2 border-purple-200 bg-purple-50/50">
                    <h4 className="text-sm font-semibold text-purple-900 flex items-center gap-2">
                      <span className="inline-flex justify-center w-5 h-5 rounded-full bg-purple-600 text-white text-xs font-bold">1</span>
                      What happened
                    </h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="text-gray-600 font-medium w-28">Contact Name:</label>
                        <input
                          type="text"
                          value={meetingContactNameOverride}
                          onChange={(e) => setMeetingContactNameOverride(e.target.value)}
                          className="px-2 py-1 rounded border border-gray-300 text-sm flex-1 min-w-[200px]"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="text-gray-600 font-medium w-28">Contact Email:</label>
                        <input
                          type="email"
                          value={meetingContactEmailOverride}
                          onChange={(e) => {
                            setMeetingContactEmailOverride(e.target.value);
                            if (e.target.value) setMeetingContactIdOverride(null);
                          }}
                          className="px-2 py-1 rounded border border-gray-300 text-sm flex-1 min-w-[200px]"
                        />
                      </div>
                      <div className="flex flex-wrap items-start gap-2">
                        <label className="text-gray-600 font-medium w-28 pt-1">Summary:</label>
                        <textarea
                          value={meetingSummaryOverride}
                          onChange={(e) => setMeetingSummaryOverride(e.target.value)}
                          rows={2}
                          className="px-2 py-1 rounded border border-gray-300 text-sm flex-1 min-w-[200px]"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="text-gray-600 font-medium w-28">When:</label>
                        <input
                          type="date"
                          value={meetingDateOverride}
                          onChange={(e) => setMeetingDateOverride(e.target.value)}
                          className="px-2 py-1 rounded border border-gray-300 text-sm"
                        />
                        <span className="text-xs text-gray-500">Meeting date</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="text-gray-600 font-medium w-28">Next engagement:</label>
                        <input
                          type="date"
                          value={meetingNextEngageOverride}
                          onChange={(e) => setMeetingNextEngageOverride(e.target.value)}
                          className="px-2 py-1 rounded border border-gray-300 text-sm"
                        />
                        <span className="text-xs text-gray-500">Updates contact when saved</span>
                      </div>
                    </div>
                    <div className="pt-3 border-t border-purple-200">
                      <h4 className="text-sm font-semibold text-purple-900 mb-2 flex items-center gap-2">
                        <span className="inline-flex justify-center w-5 h-5 rounded-full bg-purple-600 text-white text-xs font-bold">2</span>
                        Contact lookup
                      </h4>
                      {meetingParseResult.contact ? (
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="font-medium">
                            {meetingParseResult.contact.name || meetingParseResult.contact.email}
                          </span>
                          {meetingParseResult.contact.company && (
                            <span className="text-gray-500">· {meetingParseResult.contact.company}</span>
                          )}
                        </div>
                      ) : meetingParseResult.nameMatches?.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-xs text-amber-800">No exact email match. Select a contact:</p>
                          <div className="flex flex-wrap gap-2">
                            {meetingParseResult.nameMatches.map((match) => (
                              <button
                                key={match.id}
                                onClick={() => {
                                  setMeetingContactIdOverride(meetingContactIdOverride === match.id ? null : match.id);
                                  setMeetingContactEmailOverride('');
                                }}
                                className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${
                                  meetingContactIdOverride === match.id
                                    ? 'border-purple-500 bg-purple-50 text-purple-800'
                                    : 'border-gray-200 bg-white hover:border-purple-300'
                                }`}
                              >
                                {match.name}
                                {(match.company || match.email) && (
                                  <span className="block text-gray-400 font-normal">{match.company || match.email}</span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-amber-800">
                          No contact found. Add contact name/email above and create the contact first, or select another record.
                        </p>
                      )}
                    </div>
                    <div className="pt-3">
                      <button
                        onClick={handleMeetingSave}
                        disabled={meetingPushLoading || !(meetingContactIdOverride || meetingParseResult?.contact?.id)}
                        className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Save as meeting"
                      >
                        {meetingPushLoading ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InboundParsePage() {
  return (
    <Suspense
      fallback={
        <div className="py-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <PageHeader title="Inbound Parse" subtitle="Loading…" />
            <div className="flex items-center justify-center py-12">
              <div className="text-sm text-gray-500">Loading…</div>
            </div>
          </div>
        </div>
      }
    >
      <InboundParsePageContent />
    </Suspense>
  );
}
