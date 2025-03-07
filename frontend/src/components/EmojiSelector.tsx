import React, { useState, useEffect, useRef } from 'react';

interface EmojiSelectorProps {
  value: string;
  onChange: (emoji: string) => void;
  className?: string;
  defaultEmoji?: string;
}

// Emoji categories with common emojis
const emojiCategories = [
  {
    name: 'Storage',
    emojis: ['💾', '💿', '📀', '📁', '📂', '🗄️', '📦', '📚', '📋', '📝', '📒', '📔', '📕', '📗', '📘', '📙']
  },
  {
    name: 'Technology',
    emojis: ['💻', '🖥️', '🖨️', '⌨️', '🖱️', '🔌', '🔋', '📱', '☎️', '📞', '📟', '📠', '🔍', '🔎', '🧮', '📡']
  },
  {
    name: 'Security',
    emojis: ['🔒', '🔓', '🔏', '🔐', '🔑', '🗝️', '🛡️', '⚔️', '🔨', '🪓', '⛏️', '⚒️', '🛠️', '🗡️', '🔧', '🔩']
  },
  {
    name: 'Cloud',
    emojis: ['☁️', '⛅', '⛈️', '🌩️', '🌨️', '🌧️', '🌦️', '🌥️', '🌤️', '🌞', '🌈', '🌫️', '🌪️', '🌀', '🌊', '💧']
  },
  {
    name: 'Objects',
    emojis: ['🏠', '🏢', '🏣', '🏤', '🏥', '🏦', '🏨', '🏩', '🏪', '🏫', '🏬', '🏭', '🏯', '🏰', '💒', '🗼']
  }
];

// Default emojis for target types
const defaultEmojis = {
  'local': '💻',
  'sftp': '🔒',
  'smb': '🔌',
  'dropbox': '📦',
  'google_drive': '📁'
};

export default function EmojiSelector({ value, onChange, className = '', defaultEmoji }: EmojiSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredEmojis, setFilteredEmojis] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Set initial emoji if value is empty and defaultEmoji is provided
  useEffect(() => {
    if (!value && defaultEmoji && defaultEmoji in defaultEmojis) {
      onChange(defaultEmojis[defaultEmoji as keyof typeof defaultEmojis]);
    }
  }, [value, defaultEmoji, onChange]);
  
  // Handle click outside to close the dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Filter emojis based on search term
  useEffect(() => {
    if (searchTerm) {
      const allEmojis = emojiCategories.flatMap(category => category.emojis);
      setFilteredEmojis(allEmojis);
    } else {
      setFilteredEmojis([]);
    }
  }, [searchTerm]);
  
  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <label className="form-label mb-1">Target Emoji</label>
      <div 
        className="flex items-center space-x-2 p-2 border border-gray-300 dark:border-gray-700 rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-2xl">{value || '📄'}</span>
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {value ? 'Selected Emoji' : 'Select an emoji'}
        </span>
      </div>
      
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-80 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <input
              type="text"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
              placeholder="Search emojis..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          
          {searchTerm ? (
            <div className="p-2 overflow-y-auto max-h-60">
              <div className="grid grid-cols-8 gap-2">
                {filteredEmojis.map((emoji, index) => (
                  <div
                    key={`search-${index}`}
                    className={`flex items-center justify-center p-2 text-2xl rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      value === emoji ? 'bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-500' : ''
                    }`}
                    onClick={() => {
                      onChange(emoji);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                  >
                    {emoji}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Category tabs */}
              <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                {emojiCategories.map((category, index) => (
                  <button
                    key={category.name}
                    className={`px-3 py-2 text-sm font-medium ${
                      selectedCategory === index
                        ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCategory(index);
                    }}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
              
              {/* Emoji grid */}
              <div className="p-2 overflow-y-auto max-h-60">
                <div className="grid grid-cols-8 gap-2">
                  {emojiCategories[selectedCategory].emojis.map((emoji, index) => (
                    <div
                      key={`${emojiCategories[selectedCategory].name}-${index}`}
                      className={`flex items-center justify-center p-2 text-2xl rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${
                        value === emoji ? 'bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-500' : ''
                      }`}
                      onClick={() => {
                        onChange(emoji);
                        setIsOpen(false);
                      }}
                    >
                      {emoji}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
} 