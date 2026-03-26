import React, { useMemo } from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import type { DashboardConfig, Task, CustomFieldType } from '../../store';
import { filterTasksForDashboard } from './dashboardUtils';

interface TreemapChartProps {
  dashboard: DashboardConfig;
  tasks: Task[];
  customFieldTypes: CustomFieldType[];
}

interface TreemapItem {
  name: string;
  size: number;
  count: number;
  percent: number;
  [key: string]: unknown;
}

const COLORS = [
  '#6C8EBF', '#82B366', '#D6A520', '#AE4132', '#7A6EAA',
  '#4DAAB0', '#E07A3E', '#5B8C5A', '#8B5E8B', '#3E7DAE',
];

interface CustomContentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  count?: number;
  percent?: number;
  index?: number;
}

const CustomContent: React.FC<CustomContentProps> = ({ x = 0, y = 0, width = 0, height = 0, name = '', count = 0, percent = 0, index = 0 }) => {
  const color = COLORS[index % COLORS.length];
  const showText = width > 40 && height > 30;
  const showPercent = width > 60 && height > 50;

  return (
    <g>
      <rect
        x={x + 1}
        y={y + 1}
        width={width - 2}
        height={height - 2}
        style={{ fill: color, fillOpacity: 0.85, stroke: '#fff', strokeWidth: 2 }}
        rx={4}
      />
      {showText && (
        <text
          x={x + width / 2}
          y={y + height / 2 - (showPercent ? 8 : 0)}
          textAnchor="middle"
          dominantBaseline="central"
          style={{ fill: '#fff', fontSize: Math.min(13, Math.max(9, width / 8)), fontWeight: 700 }}
        >
          {name.length > 18 ? name.slice(0, 16) + '…' : name}
        </text>
      )}
      {showPercent && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 12}
          textAnchor="middle"
          dominantBaseline="central"
          style={{ fill: 'rgba(255,255,255,0.85)', fontSize: Math.min(11, Math.max(8, width / 10)) }}
        >
          {count} · {percent.toFixed(1)}%
        </text>
      )}
    </g>
  );
};

export const TreemapChart: React.FC<TreemapChartProps> = ({ dashboard, tasks, customFieldTypes }) => {
  const fieldName = customFieldTypes.find(t => t.id === dashboard.groupByFieldId)?.name ?? dashboard.groupByFieldId;

  const data = useMemo((): TreemapItem[] => {
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

    const total = Array.from(countMap.values()).reduce((a, b) => a + b, 0);
    return Array.from(countMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        name,
        size: count,
        count,
        percent: total > 0 ? (count / total) * 100 : 0,
      }));
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

  return (
    <div className="flex flex-col h-full gap-3 p-2">
      <div className="text-xs text-app-text-muted font-medium">
        Группировка по: <span className="text-app-text-head font-semibold">{fieldName}</span>
        <span className="ml-3 text-app-text-muted">
          {data.reduce((s, d) => s + d.count, 0)} задач · {data.length} значений
        </span>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={data}
            dataKey="size"
            aspectRatio={4 / 3}
            content={<CustomContent />}
            isAnimationActive={false}
          >
            <Tooltip content={() => null} />
          </Treemap>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
