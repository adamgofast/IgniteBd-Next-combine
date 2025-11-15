'use client';

import Link from 'next/link';
import { Search, FileSpreadsheet, Mail, User } from 'lucide-react';

export default function EnrichHome() {
  const cards = [
    {
      title: 'Lookup LinkedIn',
      desc: 'Preview and enrich external LinkedIn profiles',
      icon: <Search className="h-6 w-6" />,
      href: '/contacts/enrich/linkedin',
      iconColor: 'text-blue-600',
    },
    {
      title: 'Upload CSV',
      desc: 'Bulk enrich existing CRM contacts',
      icon: <FileSpreadsheet className="h-6 w-6" />,
      href: '/contacts/enrich/csv',
      iconColor: 'text-green-600',
    },
    {
      title: 'Microsoft Email',
      desc: 'Import contacts from Outlook and enrich',
      icon: <Mail className="h-6 w-6" />,
      href: '/contacts/enrich/microsoft',
      iconColor: 'text-purple-600',
    },
    {
      title: 'Existing CRM Contact',
      desc: 'Search your CRM and enrich a known contact',
      icon: <User className="h-6 w-6" />,
      href: '/contacts/enrich/existing',
      iconColor: 'text-orange-600',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="mx-auto max-w-4xl px-6">
        <h1 className="text-4xl font-bold mb-8">✨ Enrich Contacts</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {cards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="p-6 rounded-xl shadow bg-white border hover:border-gray-300 transition group"
            >
              <div className={`${card.iconColor} mb-3`}>{card.icon}</div>
              <h3 className="font-semibold text-lg">{card.title}</h3>
              <p className="text-gray-600 text-sm">{card.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
