'use client';

import { ReactNode } from 'react';

interface StatsCardProps {
  title: string;
  value: number;
  icon: ReactNode;
  color: 'blue' | 'orange' | 'green' | 'red';
}

const colorStyles = {
  blue: 'bg-blue-500',
  orange: 'bg-orange-500',
  green: 'bg-green-500',
  red: 'bg-red-500',
};

export function StatsCard({ title, value, icon, color }: StatsCardProps) {
  return (
    <div className="bg-white border border-[var(--border)] rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-[var(--foreground-tertiary)]">{title}</p>
          <p className="text-2xl font-bold text-[var(--foreground)] mt-1">{value}</p>
        </div>
        <div className={`w-14 h-14 ${colorStyles[color]} rounded-xl flex items-center justify-center text-white shadow-lg`}>
          <div className="scale-125">
            {icon}
          </div>
        </div>
      </div>
    </div>
  );
}
