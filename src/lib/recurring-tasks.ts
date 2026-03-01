'use client';

import type { RecurrencePattern, Task } from '@/types';
import { addDays, addWeeks, addMonths, format, parseISO, startOfWeek, getDay } from 'date-fns';

export interface RecurringTaskConfig {
  is_recurring: boolean;
  recurrence_pattern: RecurrencePattern;
  recurrence_start_date: string;
  recurrence_end_date?: string;
  recurrence_day_of_week?: number;
}

/**
 * Generate recurring task instances based on the parent task configuration
 */
export function generateRecurringTaskInstances(
  parentTask: Task,
  config: RecurringTaskConfig,
  daysToGenerate: number = 30
): Omit<Task, 'id' | 'created_at' | 'updated_at'>[] {
  if (!config.is_recurring) return [];

  const instances: Omit<Task, 'id' | 'created_at' | 'updated_at'>[] = [];
  const startDate = parseISO(config.recurrence_start_date);
  const endDate = config.recurrence_end_date ? parseISO(config.recurrence_end_date) : null;
  const today = new Date();
  const maxDate = addDays(today, daysToGenerate);

  let currentDate = startDate;

  while (currentDate <= maxDate && (!endDate || currentDate <= endDate)) {
    // Check if this day matches the recurrence pattern
    if (shouldCreateInstance(currentDate, config)) {
      instances.push({
        title: parentTask.title,
        description: parentTask.description,
        priority: parentTask.priority,
        status: 'todo',
        due_date: format(currentDate, 'yyyy-MM-dd'),
        assigned_to: parentTask.assigned_to,
        assigned_to_name: parentTask.assigned_to_name,
        created_by: parentTask.created_by,
        created_by_name: parentTask.created_by_name,
        updated_by: parentTask.updated_by,
        is_recurring: false, // Instances are not recurring
        parent_task_id: parentTask.id,
      });
    }

    // Move to next date based on pattern
    currentDate = getNextDate(currentDate, config.recurrence_pattern);
  }

  return instances;
}

/**
 * Check if an instance should be created for a given date
 */
function shouldCreateInstance(date: Date, config: RecurringTaskConfig): boolean {
  if (config.recurrence_pattern === 'daily') {
    return true;
  }

  if (config.recurrence_pattern === 'weekly') {
    const dayOfWeek = getDay(date); // 0 = Sunday, 6 = Saturday
    return config.recurrence_day_of_week === undefined || config.recurrence_day_of_week === dayOfWeek;
  }

  if (config.recurrence_pattern === 'monthly') {
    // For monthly, we create on the same day of the month as the start date
    return true;
  }

  return false;
}

/**
 * Get the next date based on recurrence pattern
 */
function getNextDate(currentDate: Date, pattern: RecurrencePattern): Date {
  switch (pattern) {
    case 'daily':
      return addDays(currentDate, 1);
    case 'weekly':
      return addWeeks(currentDate, 1);
    case 'monthly':
      return addMonths(currentDate, 1);
    default:
      return addDays(currentDate, 1);
  }
}

/**
 * Check if a recurring task should generate new instances today
 */
export function shouldGenerateToday(task: Task): boolean {
  if (!task.is_recurring || task.parent_task_id) return false;

  const today = format(new Date(), 'yyyy-MM-dd');
  const startDate = task.recurrence_start_date;
  const endDate = task.recurrence_end_date;

  if (startDate && startDate > today) return false;
  if (endDate && endDate < today) return false;

  return true;
}

/**
 * Format recurrence pattern for display
 */
export function formatRecurrencePattern(pattern: RecurrencePattern, dayOfWeek?: number): string {
  switch (pattern) {
    case 'daily':
      return 'Daily';
    case 'weekly':
      if (dayOfWeek !== undefined) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return `Weekly on ${days[dayOfWeek]}`;
      }
      return 'Weekly';
    case 'monthly':
      return 'Monthly';
    default:
      return pattern;
  }
}
