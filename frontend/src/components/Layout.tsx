"use client";

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { 
  Squares2X2Icon, 
  ClockIcon, 
  FolderIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import Head from 'next/head';

interface NavItem {
  name: string;
  href: string;
  icon: typeof Squares2X2Icon;
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: Squares2X2Icon },
  { name: 'Schedules', href: '/schedules', icon: ClockIcon },
  { name: 'Targets', href: '/targets', icon: FolderIcon },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    setMounted(true);
    
    // Aktualisiere die Zeit jede Sekunde
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    
    // Initialisiere die Zeit sofort
    updateTime();
    
    // Setze ein Intervall, um die Zeit jede Sekunde zu aktualisieren
    const interval = setInterval(updateTime, 1000);
    
    // Bereinige das Intervall beim Unmount der Komponente
    return () => clearInterval(interval);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Head>
        <title>BackupPro</title>
      </Head>
      
      {/* Header - iOS-Style */}
      <header className="bg-white dark:bg-gray-800 shadow-sm backdrop-blur-lg bg-opacity-90 dark:bg-opacity-90 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center">
            {/* Logo - jetzt klickbar für Theme Toggle */}
            <div className="flex-shrink-0 cursor-pointer" onClick={toggleTheme}>
              {mounted && (
                <div className="h-10">
                  {theme === 'dark' ? (
                    <img 
                      src="/BackupPro-white.png" 
                      alt="BackupPro Logo" 
                      className="h-10 w-auto"
                    />
                  ) : (
                    <img 
                      src="/BackupPro.png" 
                      alt="BackupPro Logo" 
                      className="h-10 w-auto"
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Aktuelle Systemzeit - iOS-Style */}
          <div className="text-lg font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 px-4 py-1 rounded-full">
            {mounted && currentTime}
          </div>
        </div>
      </header>

      {/* Navigation - Zentriert und iOS-Style */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <nav className="flex justify-center" aria-label="Tabs">
          <div className="inline-flex p-1 space-x-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200
                    ${isActive
                      ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-300 shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-700/50'
                    }
                  `}
                >
                  <item.icon 
                    className={`
                      mr-2 h-5 w-5
                      ${isActive
                        ? 'text-primary-500 dark:text-primary-300'
                        : 'text-gray-500 dark:text-gray-400'
                      }
                    `}
                  />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Main Content - iOS-Style */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl p-6">
          {children}
        </div>
      </main>
    </div>
  );
} 