'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { validateAdminUser } from '@/lib/adminAuth';
import AdminHeader from '@/components/admin/AdminHeader';
import ArticleForm from '@/components/admin/ArticleForm';
import { RefreshCw } from 'lucide-react';

export default function AdminNewArticlePage() {
  return (
    <div className="min-h-screen bg-[#FDFBF7] text-stone-900">
      <AdminHeader />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ArticleForm />
      </main>
    </div>
  );
}
