import React, { useState } from 'react';
import {
  FolderIcon, ServerIcon, CloudIcon, GlobeAltIcon, 
  DocumentIcon, ArchiveBoxIcon, ShieldCheckIcon, 
  CpuChipIcon, DevicePhoneMobileIcon, HomeIcon,
  ComputerDesktopIcon, CameraIcon, VideoCameraIcon,
  MusicalNoteIcon, PhotoIcon, FilmIcon, CodeBracketIcon
} from '@heroicons/react/24/outline';

interface IconSelectorProps {
  value: string;
  onChange: (icon: string) => void;
  className?: string;
}

const iconOptions = [
  { id: 'folder', icon: FolderIcon, label: 'Folder' },
  { id: 'server', icon: ServerIcon, label: 'Server' },
  { id: 'cloud', icon: CloudIcon, label: 'Cloud' },
  { id: 'globe', icon: GlobeAltIcon, label: 'Web' },
  { id: 'document', icon: DocumentIcon, label: 'Document' },
  { id: 'archive', icon: ArchiveBoxIcon, label: 'Archive' },
  { id: 'shield', icon: ShieldCheckIcon, label: 'Security' },
  { id: 'chip', icon: CpuChipIcon, label: 'Hardware' },
  { id: 'mobile', icon: DevicePhoneMobileIcon, label: 'Mobile' },
  { id: 'home', icon: HomeIcon, label: 'Home' },
  { id: 'desktop', icon: ComputerDesktopIcon, label: 'Desktop' },
  { id: 'camera', icon: CameraIcon, label: 'Camera' },
  { id: 'video', icon: VideoCameraIcon, label: 'Video' },
  { id: 'music', icon: MusicalNoteIcon, label: 'Music' },
  { id: 'photo', icon: PhotoIcon, label: 'Photo' },
  { id: 'film', icon: FilmIcon, label: 'Film' },
  { id: 'code', icon: CodeBracketIcon, label: 'Code' },
];

export default function IconSelector({ value, onChange, className = '' }: IconSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const selectedIcon = iconOptions.find(option => option.id === value) || iconOptions[0];
  const SelectedIconComponent = selectedIcon.icon;
  
  return (
    <div className={`relative ${className}`}>
      <label className="form-label mb-1">Target Icon</label>
      <div 
        className="flex items-center space-x-2 p-2 border border-gray-300 dark:border-gray-700 rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
        onClick={() => setIsOpen(!isOpen)}
      >
        <SelectedIconComponent className="h-6 w-6 text-gray-500 dark:text-gray-400" />
        <span className="text-sm text-gray-700 dark:text-gray-300">{selectedIcon.label}</span>
      </div>
      
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto">
          <div className="grid grid-cols-3 gap-2 p-2">
            {iconOptions.map((option) => {
              const IconComponent = option.icon;
              return (
                <div
                  key={option.id}
                  className={`flex flex-col items-center justify-center p-2 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    value === option.id ? 'bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-500' : ''
                  }`}
                  onClick={() => {
                    onChange(option.id);
                    setIsOpen(false);
                  }}
                >
                  <IconComponent className="h-6 w-6 text-gray-500 dark:text-gray-400" />
                  <span className="text-xs mt-1 text-gray-700 dark:text-gray-300">{option.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
} 