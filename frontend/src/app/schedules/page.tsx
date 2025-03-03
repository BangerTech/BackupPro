"use client";

import { useState } from 'react';
import ScheduleList from '@/components/ScheduleList';
import CreateScheduleButton from '@/components/CreateScheduleButton';

export default function SchedulesPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  
  const handleScheduleCreated = () => {
    // Trigger a refresh of the schedule list
    setRefreshKey(prevKey => prevKey + 1);
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Backup Schedules</h1>
        <CreateScheduleButton onScheduleCreated={handleScheduleCreated} />
      </div>
      <ScheduleList key={refreshKey} />
    </div>
  );
} 