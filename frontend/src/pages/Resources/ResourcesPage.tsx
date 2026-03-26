import React, { useState, useMemo } from 'react';
import { Settings2, LayoutDashboard } from 'lucide-react';
import { useAppStore } from '../../store';
import type { DashboardConfig } from '../../store';
import { DashboardModal } from '../Dashboard/DashboardModal';
import { TreemapChart } from '../Dashboard/TreemapChart';
import { WorkloadChart } from '../Dashboard/WorkloadChart';

interface DashboardPageProps {
  activeDashboardId?: string;
  createModalOpen?: boolean;
  onCreateModalClose?: () => void;
  onDashboardCreated?: (id: string) => void;
}

export const ResourcesPage: React.FC<DashboardPageProps> = ({
  activeDashboardId,
  createModalOpen,
  onCreateModalClose,
  onDashboardCreated,
}) => {
  const store = useAppStore();
  const [editModalOpen, setEditModalOpen] = useState(false);

  const tasks = store.appData.tasks;
  const customFieldTypes = store.appData.customFieldTypes;

  const dashboard = useMemo(
    () => store.appData.dashboards?.find(d => d.id === activeDashboardId),
    [store.appData.dashboards, activeDashboardId]
  );

  const handleCreateSave = (data: Omit<DashboardConfig, 'id'>) => {
    const created = store.dashboards.add(data);
    onCreateModalClose?.();
    onDashboardCreated?.(created.id);
  };

  const handleEditSave = (data: Omit<DashboardConfig, 'id'>) => {
    if (dashboard) {
      store.dashboards.update(dashboard.id, data);
    }
    setEditModalOpen(false);
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-app-bg">
      {/* STICKY HEADER */}
      <header className="px-6 py-4 bg-app-surface border-b border-app-border z-50 flex-shrink-0 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-app-text-head">
            {dashboard ? dashboard.name : 'Дашборды'}
          </h1>
          {dashboard && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-app-bg text-app-text-muted border border-app-border">
              {dashboard.type === 'treemap' ? 'Treemap' : 'Загрузка'}
            </span>
          )}
        </div>
        {dashboard && (
          <button
            onClick={() => setEditModalOpen(true)}
            className="flex items-center gap-1.5 h-8 px-3 text-xs font-semibold rounded-lg border border-app-border text-app-text-head hover:border-app-primary hover:text-app-primary transition-colors"
          >
            <Settings2 size={13} />
            Настройки
          </button>
        )}
      </header>

      {/* CONTENT */}
      <main className="flex-1 overflow-hidden">
        {dashboard ? (
          <div className="h-full p-4">
            {dashboard.type === 'treemap' ? (
              <TreemapChart
                dashboard={dashboard}
                tasks={tasks}
                customFieldTypes={customFieldTypes}
              />
            ) : (
              <WorkloadChart
                dashboard={dashboard}
                tasks={tasks}
                customFieldTypes={customFieldTypes}
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-app-text-muted gap-3">
            <LayoutDashboard size={48} className="opacity-20" />
            <p className="text-sm font-medium">Выберите дашборд из панели слева или создайте новый</p>
          </div>
        )}
      </main>

      {/* Create Modal */}
      {createModalOpen && (
        <DashboardModal
          isOpen={createModalOpen}
          mode="add"
          customFieldTypes={customFieldTypes}
          availableTasks={tasks}
          onSave={handleCreateSave}
          onClose={() => onCreateModalClose?.()}
        />
      )}

      {/* Edit Modal */}
      {editModalOpen && dashboard && (
        <DashboardModal
          isOpen={editModalOpen}
          mode="edit"
          editingDashboard={dashboard}
          customFieldTypes={customFieldTypes}
          availableTasks={tasks}
          onSave={handleEditSave}
          onClose={() => setEditModalOpen(false)}
        />
      )}
    </div>
  );
};
