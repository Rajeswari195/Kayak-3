/**
 * @file client/src/features/search/components/search-tabs.jsx
 * @description Tabbed interface for switching between search modes.
 * * Features:
 * - Switches between Flight, Hotel, and Car forms.
 * - Animated transitions.
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plane, Building, Car } from 'lucide-react';
import { cn } from '@/lib/utils';

import FlightSearchForm from './flight-search-form';
import HotelSearchForm from './hotel-search-form';
import CarSearchForm from './car-search-form';

const TABS = [
  { id: 'flight', label: 'Flights', icon: Plane },
  { id: 'hotel', label: 'Hotels', icon: Building },
  { id: 'car', label: 'Cars', icon: Car },
];

export default function SearchTabs() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('flight');

  // Sync tab with URL if present (e.g. ?type=hotel)
  useEffect(() => {
    const type = searchParams.get('type');
    if (type && TABS.some(t => t.id === type)) {
      setActiveTab(type);
    }
  }, [searchParams]);

  return (
    <div className="w-full max-w-4xl mx-auto bg-background/95 backdrop-blur-sm border rounded-xl shadow-lg overflow-hidden">
      {/* Tab Headers */}
      <div className="flex border-b">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-4 text-sm font-medium transition-colors relative",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {isActive && (
                <motion.div 
                  layoutId="activeTabIndicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="p-6 bg-card">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'flight' && <FlightSearchForm />}
            {activeTab === 'hotel' && <HotelSearchForm />}
            {activeTab === 'car' && <CarSearchForm />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}