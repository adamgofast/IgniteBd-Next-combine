/**
 * Contacts Registry Service
 * Centralized contact management, search, and lookup
 */

class ContactsRegistry {
  constructor() {
    this.contacts = [];
    this.indexes = {
      byId: new Map(),
      byEmail: new Map(),
      byCompany: new Map(),
    };
    this.hydrated = false;
  }

  /**
   * Load contacts from localStorage
   */
  loadFromCache() {
    if (typeof window === 'undefined') return false;
    
    const cached = window.localStorage.getItem('contacts');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          this.hydrate(parsed);
          return true;
        }
      } catch (err) {
        console.warn('Failed to parse cached contacts', err);
      }
    }
    return false;
  }

  /**
   * Hydrate registry with contacts and build indexes
   */
  hydrate(contacts) {
    this.contacts = contacts || [];
    this.rebuildIndexes();
    this.hydrated = true;
  }

  /**
   * Rebuild all indexes for fast lookups
   */
  rebuildIndexes() {
    this.indexes.byId.clear();
    this.indexes.byEmail.clear();
    this.indexes.byCompany.clear();

    this.contacts.forEach((contact) => {
      // Index by ID
      if (contact.id) {
        this.indexes.byId.set(contact.id, contact);
      }

      // Index by email
      if (contact.email) {
        const emailLower = contact.email.toLowerCase();
        if (!this.indexes.byEmail.has(emailLower)) {
          this.indexes.byEmail.set(emailLower, contact);
        }
      }

      // Index by company
      const companyName = contact.contactCompany?.companyName || contact.companyName;
      if (companyName) {
        const companyLower = companyName.toLowerCase();
        if (!this.indexes.byCompany.has(companyLower)) {
          this.indexes.byCompany.set(companyLower, []);
        }
        this.indexes.byCompany.get(companyLower).push(contact);
      }
    });
  }

  /**
   * Get contact by ID
   */
  getById(contactId) {
    return this.indexes.byId.get(contactId) || null;
  }

  /**
   * Get contact by email
   */
  getByEmail(email) {
    if (!email) return null;
    return this.indexes.byEmail.get(email.toLowerCase()) || null;
  }

  /**
   * Get contacts by company name
   */
  getByCompany(companyName) {
    if (!companyName) return [];
    return this.indexes.byCompany.get(companyName.toLowerCase()) || [];
  }

  /**
   * Search contacts by query (name, email, company)
   */
  search(query) {
    if (!query || !query.trim()) {
      return this.contacts;
    }

    const queryLower = query.toLowerCase().trim();
    const results = new Set();

    this.contacts.forEach((contact) => {
      // Search by name
      const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.toLowerCase();
      if (fullName.includes(queryLower)) {
        results.add(contact);
      }

      // Search by email
      if (contact.email?.toLowerCase().includes(queryLower)) {
        results.add(contact);
      }

      // Search by company
      const companyName = contact.contactCompany?.companyName || contact.companyName;
      if (companyName?.toLowerCase().includes(queryLower)) {
        results.add(contact);
      }
    });

    return Array.from(results);
  }

  /**
   * Filter contacts with email addresses
   */
  getWithEmail() {
    return this.contacts.filter((contact) => contact.email && contact.email.trim() !== '');
  }

  /**
   * Filter contacts matching search and having email
   */
  searchWithEmail(query) {
    const searchResults = query ? this.search(query) : this.contacts;
    return searchResults.filter((contact) => contact.email && contact.email.trim() !== '');
  }

  /**
   * Get all contacts
   */
  getAll() {
    return this.contacts;
  }

  /**
   * Get count
   */
  getCount() {
    return this.contacts.length;
  }

  /**
   * Update a contact in the registry
   */
  updateContact(contactId, updates) {
    const contact = this.getById(contactId);
    if (!contact) return false;

    Object.assign(contact, updates);
    this.rebuildIndexes();
    this.saveToCache();
    return true;
  }

  /**
   * Add a contact to the registry
   */
  addContact(contact) {
    this.contacts.push(contact);
    this.rebuildIndexes();
    this.saveToCache();
  }

  /**
   * Remove a contact from the registry
   */
  removeContact(contactId) {
    const index = this.contacts.findIndex((c) => c.id === contactId);
    if (index === -1) return false;

    this.contacts.splice(index, 1);
    this.rebuildIndexes();
    this.saveToCache();
    return true;
  }

  /**
   * Save to localStorage
   */
  saveToCache() {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('contacts', JSON.stringify(this.contacts));
    }
  }

  /**
   * Clear registry
   */
  clear() {
    this.contacts = [];
    this.rebuildIndexes();
    this.hydrated = false;
  }
}

// Singleton instance
let registryInstance = null;

export function getContactsRegistry() {
  if (!registryInstance) {
    registryInstance = new ContactsRegistry();
    // Auto-load from cache on first access
    registryInstance.loadFromCache();
  }
  return registryInstance;
}

export default getContactsRegistry;

