import React, { useState, useMemo, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Pencil, Plus, Copy, Trash2 } from 'lucide-react';
import { useAppStore, type Task } from '../../store';
import { TaskModal } from '../Timeline/TaskModal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

interface TaskModalState {
  mode: 'add' | 'edit';
  task?: Task;
  initialDate?: Date;
}

interface TaskContextMenu {
  task: Task;
  x: number;
  y: number;
}

export const TasksPage: React.FC = () => {
  const store = useAppStore();
  const [taskModal, setTaskModal] = useState<TaskModalState | null>(null);
  const [taskContextMenu, setTaskContextMenu] = useState<TaskContextMenu | null>(null);
  const [confirmDeleteTask, setConfirmDeleteTask] = useState<Task | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Получаем все задачи и вспомогательные данные
  const allTasks = useMemo(() => store.tasks.getAll(), [store.appData.tasks]);
  const allProjects = useMemo(() => store.projects.getAll(), [store.appData.projects]);
  const allResources = useMemo(() => store.resources.getAll(), [store.appData.resources]);
  const customFieldTypes = useMemo(() => store.customFieldTypes.getAll(), [store.appData.customFieldTypes]);

  // Карты для быстрого поиска
  const projectMap = useMemo(
    () => new Map(allProjects.map(p => [p.id, p])),
    [allProjects]
  );

  const resourceMap = useMemo(
    () => new Map(allResources.map(r => [r.id, r])),
    [allResources]
  );

  // Обработчики
  const handleSaveTask = (data: Omit<Task, 'id'> & { id?: string }) => {
    if (taskModal?.mode === 'edit' && data.id) {
      store.tasks.update(data.id, data);
    } else {
      store.tasks.add(data);
    }
    setTaskModal(null);
  };

  const handleDeleteTask = () => {
    if (taskModal?.task) {
      store.tasks.delete(taskModal.task.id);
    }
    setTaskModal(null);
  };

  const handleEditTask = (task: Task) => {
    setTaskModal({ mode: 'edit', task });
  };

  const handleAddTask = () => {
    setTaskModal({ mode: 'add' });
  };

  const handleCopyTask = (task: Task) => {
    const { id: _id, ...taskData } = task;
    store.tasks.add({ ...taskData, name: `${task.name} (копия)` });
    setTaskContextMenu(null);
  };

  const handleDeleteTaskFromMenu = (task: Task) => {
    setTaskContextMenu(null);
    setConfirmDeleteTask(task);
  };

  const handleRowContextMenu = (e: React.MouseEvent, task: Task) => {
    e.preventDefault();
    setTaskContextMenu({ task, x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    if (!taskContextMenu) return;
    const handleClick = () => setTaskContextMenu(null);
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [taskContextMenu]);

  const handleAddCustomFieldType = (name: string) => {
    return store.customFieldTypes.add(name);
  };

  // Форматирование дат
  const formatDate = (date: Date) => {
    return format(date, 'd MMM yyyy', { locale: ru });
  };

  // Получение имён исполнителей
  const getResourceNames = (resourceIds?: string[]) => {
    if (!resourceIds || resourceIds.length === 0) return '—';
    return resourceIds
      .map(id => resourceMap.get(id)?.name || 'Unknown')
      .join(', ');
  };

  // Получение имени проекта
  const getProjectName = (projectId?: string) => {
    if (!projectId) return '—';
    return projectMap.get(projectId)?.name || 'Unknown';
  };

  // Статусы и приоритеты для визуализации
  const statusLabels: Record<string, string> = {
    'not_started': 'Не начато',
    'in_progress': 'В процессе',
    'done': 'Завершено',
  };

  const priorityLabels: Record<string, string> = {
    'low': 'Низкий',
    'medium': 'Средний',
    'blocker': 'Блокер',
  };

  const statusColors: Record<string, string> = {
    'not_started': 'bg-slate-100 text-slate-700',
    'in_progress': 'bg-blue-100 text-blue-700',
    'done': 'bg-green-100 text-green-700',
  };

  const priorityColors: Record<string, string> = {
    'low': 'bg-gray-100 text-gray-700',
    'medium': 'bg-yellow-100 text-yellow-700',
    'blocker': 'bg-red-200 text-red-800',
  };

  // Получить цвет тега: если done, применить цвет done, иначе цвет приоритета
  const getTagColor = (task: Task): string => {
    if (task.status === 'done') {
      return statusColors['done'];
    }
    return priorityColors[task.priority || 'medium'];
  };

  // Вычисляем динамическую ширину для скроллаемой таблицы
  const baseColumnWidth = 150; // базовая ширина колонки
  const numFixedColumns = 2; // Название + Даты (частично фиксированные)
  const numDynamicColumns = 2 + 2 + customFieldTypes.length; // Проект + Исполнители + Статус + Приоритет + кастомные
  const tableWidth = Math.max(
    1200,
    (numDynamicColumns + numFixedColumns) * baseColumnWidth
  );

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-app-bg">
      {/* STICKY HEADER согласно стандартам TATO */}
      <header className="px-6 py-4 bg-app-surface border-b border-app-border z-50 flex-shrink-0 flex justify-between items-center">
        <h1 className="text-xl font-bold text-app-text-head">Все задачи</h1>
        <button
          onClick={handleAddTask}
          className="flex items-center gap-2 px-4 py-2 bg-app-primary text-white rounded hover:bg-app-primary-hover transition-colors"
        >
          <Plus size={18} />
          Новая задача
        </button>
      </header>

      {/* Основная область контента с таблицей */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {allTasks.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-app-text-muted">
            <div className="text-center">
              <p className="text-lg mb-4">Нет задач</p>
              <button
                onClick={handleAddTask}
                className="px-4 py-2 bg-app-primary text-white rounded hover:bg-app-primary-hover transition-colors"
              >
                Создать первую задачу
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="w-full border-collapse" style={{ minWidth: `${tableWidth}px` }}>
              {/* ТАБЛИЦА HEADER - STICKY */}
              <thead>
                <tr className="sticky top-0 z-20 bg-app-surface border-b border-app-border">
                  <th className="px-4 py-3 text-left font-semibold text-app-text-head text-sm w-32 min-w-32">
                    Название
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-app-text-head text-sm w-24 min-w-24">
                    Начало
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-app-text-head text-sm w-24 min-w-24">
                    Окончание
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-app-text-head text-sm w-28 min-w-28">
                    Проект
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-app-text-head text-sm w-40 min-w-40">
                    Исполнители
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-app-text-head text-sm w-28 min-w-28">
                    Статус
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-app-text-head text-sm w-28 min-w-28">
                    Приоритет
                  </th>
                  {customFieldTypes.map(field => (
                    <th
                      key={field.id}
                      className="px-4 py-3 text-left font-semibold text-app-text-head text-sm w-32 min-w-32"
                    >
                      {field.name}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left font-semibold text-app-text-head text-sm w-20 min-w-20">
                    Действия
                  </th>
                </tr>
              </thead>

              {/* ТАБЛИЦА BODY */}
              <tbody>
                {allTasks.map((task, idx) => (
                  <tr
                    key={task.id}
                    className={`border-b border-app-border hover:bg-blue-50 transition-colors cursor-pointer ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                    }`}
                    onClick={() => handleEditTask(task)}
                    onContextMenu={(e) => handleRowContextMenu(e, task)}
                  >
                    <td className="px-4 py-3 text-app-text-main text-sm font-medium">
                      {task.name}
                    </td>
                    <td className="px-4 py-3 text-app-text-main text-sm">
                      {formatDate(task.startDate)}
                    </td>
                    <td className="px-4 py-3 text-app-text-main text-sm">
                      {formatDate(task.endDate)}
                    </td>
                    <td className="px-4 py-3 text-app-text-main text-sm">
                      {getProjectName(task.projectId)}
                    </td>
                    <td className="px-4 py-3 text-app-text-main text-sm">
                      {getResourceNames(task.resourceIds)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          statusColors[task.status || 'not_started']
                        }`}
                      >
                        {statusLabels[task.status || 'not_started']}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          getTagColor(task)
                        }`}
                      >
                        {priorityLabels[task.priority || 'medium']}
                      </span>
                    </td>
                    {customFieldTypes.map(field => (
                      <td key={field.id} className="px-4 py-3 text-app-text-main text-sm">
                        {task.customFields?.[field.id] || '—'}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditTask(task);
                        }}
                        className="p-1 hover:bg-app-border rounded transition-colors"
                        title="Редактировать"
                      >
                        <Pencil size={16} className="text-app-primary" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* КОНТЕКСТНОЕ МЕНЮ ЗАДАЧИ */}
      {taskContextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-[200] bg-app-surface border border-app-border rounded-xl shadow-2xl py-1 min-w-[160px]"
          style={{ top: taskContextMenu.y, left: taskContextMenu.x }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => { setTaskModal({ mode: 'edit', task: taskContextMenu.task }); setTaskContextMenu(null); }}
            className="w-full text-left px-4 py-2 text-xs font-semibold text-app-text-main hover:bg-app-bg/50 transition-colors flex items-center gap-2"
          >
            <Pencil size={12} />
            Изменить
          </button>
          <button
            onClick={() => handleCopyTask(taskContextMenu.task)}
            className="w-full text-left px-4 py-2 text-xs font-semibold text-app-text-main hover:bg-app-bg/50 transition-colors flex items-center gap-2"
          >
            <Copy size={12} />
            Копировать
          </button>
          <button
            onClick={() => handleDeleteTaskFromMenu(taskContextMenu.task)}
            className="w-full text-left px-4 py-2 text-xs font-semibold text-app-error hover:bg-app-error/10 transition-colors flex items-center gap-2"
          >
            <Trash2 size={12} />
            Удалить
          </button>
        </div>
      )}

      {/* МОДАЛЬНОЕ ОКНО ADD / EDIT TASK */}
      {taskModal && (
        <TaskModal
          mode={taskModal.mode}
          task={taskModal.task}
          initialDate={taskModal.initialDate}
          customFieldTypes={customFieldTypes}
          onAddCustomFieldType={handleAddCustomFieldType}
          onSave={handleSaveTask}
          onDelete={taskModal.mode === 'edit' ? handleDeleteTask : undefined}
          onClose={() => setTaskModal(null)}
        />
      )}

      {confirmDeleteTask && (
        <ConfirmDialog
          title={`Удалить задачу «${confirmDeleteTask.name}»?`}
          message="Задача будет безвозвратно удалена."
          confirmLabel="Удалить"
          confirmVariant="danger"
          onConfirm={() => {
            store.tasks.delete(confirmDeleteTask.id);
            setConfirmDeleteTask(null);
          }}
          onCancel={() => setConfirmDeleteTask(null)}
        />
      )}
    </div>
  );
};
