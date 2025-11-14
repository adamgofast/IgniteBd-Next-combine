'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Users, ChevronDown, X } from 'lucide-react';
import { useContacts } from '@/app/(authenticated)/contacts/layout';

/**
 * ContactSelector Component
 * 
 * Reusable contact selector for client delivery section.
 * - Shows dropdown/autocomplete of contacts
 * - Persists selection in localStorage and URL params
 * - Displays current selection with change option
 */
export default function ContactSelector({ 
  contactId, 
  onContactChange,
  showLabel = true,
  className = '',
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { contacts } = useContacts();
  const [selectedContactId, setSelectedContactId] = useState(contactId || null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Initialize from URL param or localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Check URL param first
    const urlContactId = searchParams.get('contactId');
    if (urlContactId) {
      setSelectedContactId(urlContactId);
      // Persist to localStorage
      localStorage.setItem('currentClientContactId', urlContactId);
      return;
    }
    
    // Fallback to localStorage
    const storedContactId = localStorage.getItem('currentClientContactId');
    if (storedContactId) {
      setSelectedContactId(storedContactId);
    }
  }, [searchParams]);

  // Update when contactId prop changes
  useEffect(() => {
    if (contactId) {
      setSelectedContactId(contactId);
    }
  }, [contactId]);

  // Filter contacts based on search query
  const filteredContacts = useMemo(() => {
    if (!searchQuery) return contacts;
    
    const query = searchQuery.toLowerCase();
    return contacts.filter((contact) => {
      const name = `${contact.firstName || ''} ${contact.lastName || ''}`.toLowerCase();
      const email = (contact.email || '').toLowerCase();
      const company = (contact.contactCompany?.companyName || '').toLowerCase();
      
      return name.includes(query) || email.includes(query) || company.includes(query);
    });
  }, [contacts, searchQuery]);

  // Get selected contact object
  const selectedContact = useMemo(() => {
    if (!selectedContactId) return null;
    return contacts.find((c) => c.id === selectedContactId);
  }, [contacts, selectedContactId]);

  // Handle contact selection
  const handleSelectContact = (contact) => {
    setSelectedContactId(contact.id);
    setIsOpen(false);
    setSearchQuery('');
    
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('currentClientContactId', contact.id);
    }
    
    // Update URL param
    const params = new URLSearchParams(searchParams.toString());
    params.set('contactId', contact.id);
    router.push(`?${params.toString()}`, { scroll: false });
    
    // Call callback if provided
    if (onContactChange) {
      onContactChange(contact);
    }
  };

  // Handle clear selection
  const handleClear = () => {
    setSelectedContactId(null);
    setIsOpen(false);
    setSearchQuery('');
    
    // Remove from localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('currentClientContactId');
    }
    
    // Remove from URL
    const params = new URLSearchParams(searchParams.toString());
    params.delete('contactId');
    router.push(`?${params.toString()}`, { scroll: false });
    
    // Call callback if provided
    if (onContactChange) {
      onContactChange(null);
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
        {/* Selected Contact Display */}
        {selectedContact ? (
          <div className="flex items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2 shadow-sm">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-gray-400" />
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  {selectedContact.firstName} {selectedContact.lastName}
                </div>
                {selectedContact.contactCompany?.companyName && (
                  <div className="text-xs text-gray-500">
                    {selectedContact.contactCompany.companyName}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClear}
                className="rounded p-1 text-gray-400 hover:text-gray-600"
                title="Clear selection"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="rounded p-1 text-gray-400 hover:text-gray-600"
                title="Change contact"
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2 text-left shadow-sm hover:border-gray-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
          >
            <span className="text-sm text-gray-500">Select a contact...</span>
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        )}

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute z-50 mt-2 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
            {/* Search Input */}
            <div className="border-b border-gray-200 p-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search contacts..."
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                autoFocus
              />
            </div>

            {/* Contact List */}
            <div className="max-h-60 overflow-y-auto">
              {filteredContacts.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-500">
                  {searchQuery ? 'No contacts found' : 'No contacts available'}
                </div>
              ) : (
                filteredContacts.map((contact) => (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => handleSelectContact(contact)}
                    className={`w-full px-4 py-3 text-left hover:bg-gray-50 ${
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
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

