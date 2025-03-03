"use client";

import { useState } from 'react';
import TargetList from '@/components/TargetList';
import CreateTargetButton from '@/components/CreateTargetButton';

export default function TargetsPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  
  const handleTargetCreated = () => {
    // Increment the key to force a re-render of the TargetList
    setRefreshKey(prevKey => prevKey + 1);
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Backup Targets</h1>
        <CreateTargetButton onTargetCreated={handleTargetCreated} />
      </div>
      <TargetList key={refreshKey} />
    </div>
  );
} 