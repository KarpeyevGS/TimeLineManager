import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, LabelList,
} from 'recharts';
import type { DashboardConfig, Task, CustomFieldType } from '../../store';
import { filterTasksForDashboard } from './dashboardUtils';

interface WorkloadChartProps {
  dashboard: DashboardConfig;
  tasks: Task[];
  customFieldTypes: CustomFieldType[];
}

interface BarItem {
  name: string;
  count: number;
}

export const WorkloadChart: React.FC<WorkloadChartProps> = ({ dashboard, tasks, customFieldTypes }) => {
  const fieldName = customFieldTypes.find(t => t.id === dashboard.groupByFieldId)?.name ?? dashboard.groupByFieldId;

  const data = useMemo((): BarItem[] => {
    const filtered = filterTasksForDashboard(tasks, dashboard);
    if (filtered.length === 0) return [];

    const countMap = new Map<string, number>();
    filtered.forEach(task => {
      const vals = task.customFields?.[dashboard.groupByFieldId];
      if (vals && vals.length > 0) {
        vals.forEach(v => {
          if (v) countMap.set(v, (countMap.get(v) ?? 0) + 1);
        });
      } else {
        countMap.set('Без значения', (countMap.get('Без значения') ?? 0) + 1);
      }
    });

    return Array.from(countMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [tasks, dashboard]);

  if (!dashboard.groupByFieldId) {
    return (
      <div className="flex items-center justify-center h-full text-app-text-muted text-sm">
        Настройте поле группировки в параметрах дашборда
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-app-text-muted text-sm">
        Нет задач за выбранный период
      </div>
    );
  }

  // Динамическая высота баров
  const barHeight = Math.max(36, Math.min(64, 400 / data.length));
  const chartHeight = Math.max(200, data.length * barHeight + 60);
  const maxCount = Math.max(...data.map(d => d.count));

  return (
    <div className="flex flex-col h-full gap-3 p-2">
      <div className="text-xs text-app-text-muted font-medium">
        Загрузка по: <span className="text-app-text-head font-semibold">{fieldName}</span>
        <span className="ml-3 text-app-text-muted">
          {data.reduce((s, d) => s + d.count, 0)} задач · {data.length} значений
        </span>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        <div style={{ height: chartHeight, minHeight: 200, pointerEvents: 'none' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={data}
              margin={{ top: 5, right: 60, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-app-border, #e2e8f0)" />
              <XAxis
                type="number"
                domain={[0, maxCount + 1]}
                allowDecimals={false}
                tick={{ fontSize: 11, fill: 'var(--color-app-text-muted, #94a3b8)' }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={140}
                tick={{ fontSize: 12, fill: 'var(--color-app-text-head, #1e293b)', fontWeight: 600 }}
                tickLine={false}
              />
              <Bar dataKey="count" fill="var(--color-app-primary, #3b82f6)" radius={[0, 4, 4, 0]} maxBarSize={52} isAnimationActive={false} activeBar={false} style={{ pointerEvents: 'none' }}>
                <LabelList
                  dataKey="count"
                  position="right"
                  style={{ fontSize: 11, fontWeight: 700, fill: 'var(--color-app-text-head, #1e293b)' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
