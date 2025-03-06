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
      setCurrentTime(now.toLocaleTimeString());
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
      
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
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
            {/* Titel entfernt */}
          </div>

          {/* Aktuelle Systemzeit */}
          <div className="text-gray-700 dark:text-gray-300 font-medium">
            {mounted && currentTime}
          </div>
        </div>
      </header>

      {/* Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex space-x-4 py-4" aria-label="Tabs">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`
                  group flex items-center px-3 py-2 text-sm font-medium rounded-md
                  ${isActive
                    ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-200'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }
                `}
              >
                <item.icon 
                  className={`
                    mr-3 h-5 w-5
                    ${isActive
                      ? 'text-primary-500 dark:text-primary-400'
                      : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-400'
                    }
                  `}
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
} 