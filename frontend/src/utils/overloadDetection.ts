import type { Task } from '../store';

/**
 * Returns the set of task IDs that participate in an overload situation within
 * the given row. A task is "overloaded" if it is active at any moment when more
 * than `capacity` tasks are simultaneously occupying the row.
 *
 * Overlap rule: two tasks share "significant" overlap only when their overlap
 * exceeds 1 calendar day. This is modelled by using each task's occupancy
 * window as [startDate + 1 day, endDate]. Tasks with a zero or negative window
 * (e.g. milestones, single-day tasks) are excluded from overload analysis.
 */
export function getOverloadedTaskIds(tasks: Task[], capacity: number): Set<string> {
  if (tasks.length <= capacity) return new Set();

  type Window = { taskId: string; start: number; end: number };
  const windows: Window[] = [];

  for (const task of tasks) {
    const windowStart = task.startDate.getTime() + 86_400_000; // +1 day
    const windowEnd = task.endDate.getTime();
    if (windowStart <= windowEnd) {
      windows.push({ taskId: task.id, start: windowStart, end: windowEnd });
    }
  }

  if (windows.length <= capacity) return new Set();

  // Collect all interval breakpoints from occupancy windows
  const points = new Set<number>();
  for (const w of windows) {
    points.add(w.start);
    points.add(w.end + 1); // exclusive endpoint
  }
  const sorted = Array.from(points).sort((a, b) => a - b);

  const overloadedIds = new Set<string>();

  for (let i = 0; i < sorted.length - 1; i++) {
    const intervalStart = sorted[i];
    const intervalMid = sorted[i]; // any point inside [sorted[i], sorted[i+1])

    const active = windows.filter(w => w.start <= intervalMid && w.end >= intervalStart);
    if (active.length > capacity) {
      for (const w of active) overloadedIds.add(w.taskId);
    }
  }

  return overloadedIds;
}
