'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { FileSpreadsheet, Upload, RefreshCw, Sparkles, X, Check } from 'lucide-react';

export default function CSVEnrich() {
  const [file, setFile] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [enriching, setEnriching] = useState(false);

  function handleFileSelect(e) {
    const f = e.target.files?.[0];
    if (!f) return;

    if (!f.name.toLowerCase().endsWith('.csv')) {
      alert('Please select a CSV file');
      return;
    }

    setFile(f);
    parseCSV(f);
  }

  async function parseCSV(f) {
    const text = await f.text();
    const lines = text.trim().split('\n');
    if (lines.length < 2) {
      alert('CSV must have at least a header and one row');
      return;
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const emailIdx = headers.findIndex((h) => h.includes('email'));

    if (emailIdx === -1) {
      alert('CSV must contain an email column');
      return;
    }

    const parsed = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim());
      const email = values[emailIdx];
      if (email && email.includes('@')) {
        parsed.push({ email, id: null }); // Will be found by email during enrichment
      }
    }

    setContacts(parsed);
  }

  function toggleSelect(email) {
    setSelected((prev) => {
      const updated = new Set(prev);
      if (updated.has(email)) {
        updated.delete(email);
      } else {
        updated.add(email);
      }
      return updated;
    });
  }

  async function handleEnrich() {
    if (selected.size === 0) {
      alert('Please select at least one contact');
      return;
    }

    setEnriching(true);
    // TODO: Implement CSV enrichment (will need to find contacts by email first)
    alert('CSV enrichment coming soon');
    setEnriching(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="mx-auto max-w-4xl px-6">
        <h1 className="text-3xl font-bold mb-6">📊 CSV Bulk Enrichment</h1>

        {/* File Upload */}
        <div className="bg-white p-6 rounded-lg shadow border mb-6">
          <label className="block mb-2 font-semibold">Upload CSV File</label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
          />
          {file && (
            <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
              <FileSpreadsheet className="h-4 w-4" />
              {file.name} ({contacts.length} contacts found)
            </div>
          )}
        </div>

        {/* Contact List */}
        {contacts.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow border mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-lg">
                Select Contacts ({selected.size} of {contacts.length})
              </h2>
              <button
                onClick={() => {
                  if (selected.size === contacts.length) {
                    setSelected(new Set());
                  } else {
                    setSelected(new Set(contacts.map((c) => c.email)));
                  }
                }}
                className="text-sm text-blue-600 hover:underline"
              >
                {selected.size === contacts.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-2">
              {contacts.map((contact, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(contact.email)}
                    onChange={() => toggleSelect(contact.email)}
                    className="h-4 w-4"
                  />
                  <span className="flex-1 text-sm">{contact.email}</span>
                </div>
              ))}
            </div>

            <button
              onClick={handleEnrich}
              disabled={enriching || selected.size === 0}
              className="mt-4 bg-green-600 text-white px-6 py-2 rounded flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {enriching ? (
                <>
                  <RefreshCw className="animate-spin h-4 w-4" />
                  Enriching...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Enrich Selected ({selected.size})
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

