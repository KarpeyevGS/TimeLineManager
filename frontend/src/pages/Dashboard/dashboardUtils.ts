import type { Task, DashboardConfig } from '../../store';

export const filterTasksForDashboard = (tasks: Task[], dashboard: DashboardConfig): Task[] => {
  // 1. Date filter
  const now = new Date();
  let dateFrom: Date;
  let dateTo: Date;

  if (dashboard.period === '30d') {
    dateTo = now;
    dateFrom = new Date(now);
    dateFrom.setDate(dateFrom.getDate() - 30);
  } else if (dashboard.period === '90d') {
    dateTo = now;
    dateFrom = new Date(now);
    dateFrom.setDate(dateFrom.getDate() - 90);
  } else {
    dateFrom = dashboard.dateFrom ? new Date(dashboard.dateFrom) : new Date(0);
    dateTo = dashboard.dateTo ? new Date(dashboard.dateTo) : new Date(8640000000000000);
  }

  let result = tasks.filter(t => t.startDate <= dateTo && t.endDate >= dateFrom);

  // 2. Custom field filters (if any)
  const filterEntries = Object.entries(dashboard.filters ?? {}).filter(
    ([, vals]) => vals && vals.length > 0
  );

  if (filterEntries.length > 0) {
    result = result.filter(task =>
      filterEntries.every(([fieldId, filterVals]) => {
        const taskVals = task.customFields?.[fieldId] ?? [];
        return filterVals.every(fv => taskVals.includes(fv));
      })
    );
  }

  return result;
};
