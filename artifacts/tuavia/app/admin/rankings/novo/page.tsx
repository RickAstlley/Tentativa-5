'use client';

import React from 'react';
import AdminHeader from '@/components/admin/AdminHeader';
import RankingForm from '@/components/admin/RankingForm';

export default function NovoRankingPage() {
  return (
    <div className="min-h-screen bg-[#FDFBF7] text-stone-900 pb-20">
      <AdminHeader />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <RankingForm />
      </main>
    </div>
  );
}
