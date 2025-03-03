"use client";

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { 
  Squares2X2Icon, 
  ClockIcon, 
  FolderIcon,
  SunIcon,
  MoonIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

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

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center">
            {/* Logo */}
            <div className="flex-shrink-0">
              <div className="h-8 w-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">BS</span>
              </div>
            </div>
            <div className="ml-4">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Backup Scheduler
              </h1>
            </div>
          </div>

          {/* Theme Switcher */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            {mounted && (
              theme === 'dark' ? (
                <SunIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
              ) : (
                <MoonIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
              )
            )}
          </button>
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