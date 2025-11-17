'use client';

import { useState, useEffect, useMemo } from 'react';
import { Users } from 'lucide-react';
import api from '@/lib/api';

/**
 * ContactSelector Component - SEARCH FIRST
 * Simple search input that shows dropdown results when typing
 * No auto-select, no localStorage persistence - pure search
 */
export default function ContactSelector({ 
  contactId, 
  onContactSelect,
  onContactChange, // Legacy support
  selectedContact,
  showLabel = true,
  className = '',
}) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContactId, setSelectedContactId] = useState(contactId || null);

  // Fetch contacts from API
  useEffect(() => {
    const fetchContacts = async () => {
      if (typeof window === 'undefined') return;
      
      const companyHQId = 
        window.localStorage.getItem('companyHQId') ||
        window.localStorage.getItem('companyId') ||
        '';
      
      if (!companyHQId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Try localStorage first
        const cached = window.localStorage.getItem('contacts');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) {
              setContacts(parsed);
              setLoading(false);
            }
          } catch (err) {
            console.warn('Failed to parse cached contacts', err);
          }
        }
        
        // Fetch from API
        const response = await api.get(`/api/contacts?companyHQId=${companyHQId}`);
        if (response.data?.success && response.data.contacts) {
          const fetched = response.data.contacts;
          setContacts(fetched);
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('contacts', JSON.stringify(fetched));
          }
        }
      } catch (err) {
        console.error('Error fetching contacts:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchContacts();
  }, []);

  // Initialize from props only
  useEffect(() => {
    if (contactId) {
      setSelectedContactId(contactId);
      // Set search value to selected contact name if available
      const contact = contacts.find(c => c.id === contactId);
      if (contact) {
        setContactSearch(`${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || '');
      }
      return;
    }
    
    if (selectedContact?.id) {
      setSelectedContactId(selectedContact.id);
      setContactSearch(`${selectedContact.firstName || ''} ${selectedContact.lastName || ''}`.trim() || selectedContact.email || '');
      return;
    }
    
    // NO auto-select - search-first
    setSelectedContactId(null);
    setContactSearch('');
  }, [contactId, selectedContact, contacts]);

  // Filter contacts based on search query
  const availableContacts = useMemo(() => {
    if (!contactSearch || !contactSearch.trim()) {
      return [];
    }
    
    const searchLower = contactSearch.toLowerCase();
    return contacts.filter((contact) => {
      const name = `${contact.firstName || ''} ${contact.lastName || ''}`.toLowerCase();
      const email = (contact.email || '').toLowerCase();
      const company = (contact.contactCompany?.companyName || '').toLowerCase();
      
      return name.includes(searchLower) || email.includes(searchLower) || company.includes(searchLower);
    }).slice(0, 20);
  }, [contacts, contactSearch]);

  // Get selected contact object (computed from selectedContactId)
  const selectedContactObj = useMemo(() => {
    if (!selectedContactId) return null;
    return contacts.find((c) => c.id === selectedContactId);
  }, [contacts, selectedContactId]);

  // Handle contact selection
  const handleSelectContact = (contact) => {
    setSelectedContactId(contact.id);
    const displayName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || '';
    setContactSearch(displayName);
    
    // Clear search to close dropdown
    setTimeout(() => {
      setContactSearch(displayName);
    }, 0);
    
    // Call callback - support both onContactSelect and onContactChange
    if (onContactSelect) {
      const company = contact.contactCompany || null;
      onContactSelect(contact, company);
    }
    if (onContactChange) {
      onContactChange(contact);
    }
  };

  return (
    <div className={`relative ${className}`}>
      {showLabel && (
        <label className="mb-2 block text-sm font-semibold text-gray-700">
          Select Contact
        </label>
      )}
      
      <div className="relative">
        {/* Search Input - Simple search bar like Manage Contacts page */}
        <div className="relative">
          <input
            type="text"
            value={contactSearch}
            onChange={(e) => setContactSearch(e.target.value)}
            placeholder="Search contacts by name, email, or company..."
            className="w-full rounded-lg border border-gray-300 px-4 py-2 pl-10 focus:border-red-500 focus:ring-2 focus:ring-red-200"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <Users className="h-5 w-5 text-gray-400" />
          </div>
          {selectedContactObj && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-2 w-2 rounded-full bg-green-500"></div>
            </div>
          )}
        </div>

        {/* Dropdown Results - Only shows when searching AND not already selected (like Manage Contacts) */}
        {contactSearch && availableContacts.length > 0 && !selectedContactObj && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-60 overflow-y-auto">
            {availableContacts.map((contact) => (
              <button
                key={contact.id}
                type="button"
                onClick={() => handleSelectContact(contact)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                  selectedContactId === contact.id ? 'bg-red-50' : ''
                }`}
              >
                <div className="text-sm font-semibold text-gray-900">
                  {contact.firstName} {contact.lastName}
                </div>
                {contact.email && (
                  <div className="text-xs text-gray-500">{contact.email}</div>
                )}
                {contact.contactCompany?.companyName && (
                  <div className="text-xs text-gray-400">
                    {contact.contactCompany.companyName}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Show selected contact info below input */}
        {selectedContactObj && (
          <div className="mt-2 rounded-lg border border-green-200 bg-green-50 p-2">
            <p className="text-xs text-green-800">
              <strong>Selected:</strong> {selectedContactObj.firstName} {selectedContactObj.lastName}
              {selectedContactObj.contactCompany?.companyName && (
                <span> • {selectedContactObj.contactCompany.companyName}</span>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
