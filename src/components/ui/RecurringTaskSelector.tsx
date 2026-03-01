'use client';

import { useState } from 'react';
import type { RecurrencePattern } from '@/types';
import { formatRecurrencePattern } from '@/lib/recurring-tasks';
import { Repeat, Calendar, X } from 'lucide-react';

interface RecurringTaskSelectorProps {
  isRecurring: boolean;
  pattern: RecurrencePattern;
  startDate: string;
  endDate?: string;
  dayOfWeek?: number;
  onChange: (config: {
    isRecurring: boolean;
    pattern: RecurrencePattern;
    startDate: string;
    endDate?: string;
    dayOfWeek?: number;
  }) => void;
}

const patterns: RecurrencePattern[] = ['daily', 'weekly', 'monthly'];

const daysOfWeek = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

export function RecurringTaskSelector({
  isRecurring,
  pattern,
  startDate,
  endDate,
  dayOfWeek,
  onChange,
}: RecurringTaskSelectorProps) {
  const [showOptions, setShowOptions] = useState(isRecurring);

  const handleToggleRecurring = () => {
    const newValue = !isRecurring;
    setShowOptions(newValue);
    if (!newValue) {
      onChange({
        isRecurring: false,
        pattern: 'daily',
        startDate: startDate || new Date().toISOString().split('T')[0],
      });
    } else {
      onChange({
        isRecurring: true,
        pattern,
        startDate: startDate || new Date().toISOString().split('T')[0],
        endDate,
        dayOfWeek,
      });
    }
  };

  return (
    <div className="space-y-3">
      {/* Toggle Button */}
      <button
        type="button"
        onClick={handleToggleRecurring}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
          isRecurring
            ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300'
            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300'
        }`}
      >
        <Repeat className="w-4 h-4" />
        <span className="text-sm font-medium">
          {isRecurring ? 'Recurring Task' : 'Make Recurring'}
        </span>
        {isRecurring && (
          <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 px-2 py-0.5 rounded-full">
            {formatRecurrencePattern(pattern, dayOfWeek)}
          </span>
        )}
      </button>

      {/* Options Panel */}
      {showOptions && isRecurring && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
          {/* Pattern Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Repeat
            </label>
            <div className="flex gap-2 flex-wrap">
              {patterns.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() =>
                    onChange({
                      isRecurring: true,
                      pattern: p,
                      startDate,
                      endDate,
                      dayOfWeek,
                    })
                  }
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    pattern === p
                      ? 'bg-blue-500 text-white'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Day of Week (for weekly pattern) */}
          {pattern === 'weekly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                On day
              </label>
              <div className="flex gap-1 flex-wrap">
                {daysOfWeek.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() =>
                      onChange({
                        isRecurring: true,
                        pattern,
                        startDate,
                        endDate,
                        dayOfWeek: day.value,
                      })
                    }
                    className={`w-10 h-10 rounded-md text-xs font-medium transition-colors ${
                      dayOfWeek === day.value
                        ? 'bg-blue-500 text-white'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) =>
                onChange({
                  isRecurring: true,
                  pattern,
                  startDate: e.target.value,
                  endDate,
                  dayOfWeek,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
            />
          </div>

          {/* End Date (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              End Date (optional)
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={endDate || ''}
                onChange={(e) =>
                  onChange({
                    isRecurring: true,
                    pattern,
                    startDate,
                    endDate: e.target.value || undefined,
                    dayOfWeek,
                  })
                }
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
              />
              {endDate && (
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      isRecurring: true,
                      pattern,
                      startDate,
                      dayOfWeek,
                    })
                  }
                  className="px-3 py-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Leave empty to repeat indefinitely
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
