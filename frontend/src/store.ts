import { useState, useCallback, useEffect } from 'react';
import { isValidHttpsUrl } from './utils/validateUrl';
import { getElectronAPI, isElectron } from './electronApi';

// ============= Timeline View State =============

export interface TimelineViewState {
  dateRange: { from: string; to: string } | null; // ISO-строки
  zoomIndex: number;
  scrollLeft: number;
}

const TIMELINE_VIEW_KEY = 'timeline_view_state';

const getDefaultTimelineView = (): TimelineViewState => {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    dateRange: {
      from: from.toISOString(),
      to: to.toISOString(),
    },
    zoomIndex: 2,
    scrollLeft: 0,
  };
};

export const loadTimelineViewState = (): TimelineViewState => {
  try {
    const stored = localStorage.getItem(TIMELINE_VIEW_KEY);
    if (stored) return JSON.parse(stored) as TimelineViewState;
  } catch {
    // ignore
  }
  return getDefaultTimelineView();
};

export const saveTimelineViewState = (state: TimelineViewState): void => {
  const json = JSON.stringify(state);
  const api = getElectronAPI();
  if (api) {
    api.viewStateSave(json);
  } else {
    try {
      localStorage.setItem(TIMELINE_VIEW_KEY, json);
    } catch {
      // ignore
    }
  }
};

// ============= Типы данных =============

export interface CustomFieldType {
  id: string;
  name: string;
}

export interface Resource {
  id: string;
  name: string;
  role?: string;
}

export interface Project {
  id: string;
  name: string;
  color: string;
}

export interface Task {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  priority?: 'low' | 'medium' | 'blocker';
  status?: 'not_started' | 'in_progress' | 'done';
  description?: string;
  link?: string;
  projectId?: string;
  resourceIds?: string[];
  customFields?: Record<string, string[]>;
  color?: string; // HEX цвет для задачи
  fix?: boolean; // Закреплённая задача — нельзя двигать на timeline
  milestone?: boolean; // Веха — 1 день, отображается ромбом
}

// Параметр Timeline с фильтрами
export interface TimelineParameter {
  id: string;
  name: string;
  level: number;
  parentId?: string;
  filters: Record<string, string[]>;  // ← ФИЛЬТРЫ встроены
  capacity?: number;  // Вместимость: макс. кол-во одновременных задач (1–10, по умолчанию 1)
}

// Конфигурация Timeline
export interface TimelineConfig {
  id: string;
  name: string;
  description?: string;
  parameters: TimelineParameter[];
  collapsedIds?: string[];
}

// Конфигурация Dashboard
export interface DashboardConfig {
  id: string;
  name: string;
  type: 'treemap' | 'workload';
  groupByFieldId: string;        // кастомное поле для группировки/визуализации
  filters: Record<string, string[]>; // фильтры задач (пустой объект = все задачи)
  period: '30d' | '90d' | 'custom';
  dateFrom?: string;             // ISO, только когда period === 'custom'
  dateTo?: string;
}

export interface AppData {
  meta: {
    version: string;
    appName: string;
    created: string;
    lastModified: string;
  };
  customFieldTypes: CustomFieldType[];
  resources: Resource[];
  projects: Project[];
  tasks: Task[];
  timelineConfigs: TimelineConfig[];  // ← Конфигурации Timeline
  dashboards: DashboardConfig[];      // ← Дашборды
}

// ============= Начальные данные =============

// Пустая конфигурация Timeline - пользователь добавит параметры через UI
const createDefaultTimelineConfig = (): TimelineConfig => ({
  id: 'timeline_default',
  name: 'Новая Timeline',
  description: 'Добавьте параметры через UI',
  parameters: [],
});

const createInitialAppData = (): AppData => ({
  meta: {
    version: '1.0',
    appName: 'Timeline Planner',
    created: new Date().toISOString(),
    lastModified: new Date().toISOString(),
  },
  customFieldTypes: [],
  resources: [],
  projects: [],
  tasks: [],
  timelineConfigs: [createDefaultTimelineConfig()],
  dashboards: [],
});

// ============= Утилиты для группировки задач =============

/**
 * Проверяет, соответствует ли задача всем фильтрам параметра.
 * Логика: И по разным полям, И по значениям внутри одного поля.
 * Если фильтры пустые — возвращает false (параметр без фильтров не показывает задачи).
 */
export const matchesTaskFilters = (task: Task, filters: Record<string, string[]>): boolean => {
  if (Object.keys(filters).length === 0) return false;

  return Object.entries(filters).every(([key, filterValues]) => {
    if (!filterValues || filterValues.length === 0) return true;
    if (key === 'id') return filterValues.includes(task.id);
    const taskValues = task.customFields?.[key] ?? [];
    // AND: задача должна иметь ВСЕ значения из фильтра
    return filterValues.every(fv => taskValues.includes(fv));
  });
};

/**
 * Группирует задачи по параметрам согласно их фильтрам
 * Результат: Map параметра → массив задач
 */
export const groupTasksByFilters = (
  tasks: Task[],
  parameters: TimelineParameter[]
): Map<string, Task[]> => {
  const result = new Map<string, Task[]>();

  // Для каждого параметра проверяем, какие задачи подходят
  parameters.forEach((param) => {
    const matchingTasks = tasks.filter((task) =>
      matchesTaskFilters(task, param.filters)
    );
    if (matchingTasks.length > 0) {
      result.set(param.id, matchingTasks);
    }
  });

  return result;
};

// ============= Функции работы с хранилищем =============

const STORAGE_KEY = 'timeline_app_data';

// Нормализует одиночное значение или массив в string[]
const toStringArray = (v: unknown): string[] => {
  if (Array.isArray(v)) return (v as string[]).filter(s => typeof s === 'string' && s.trim());
  if (typeof v === 'string' && v.trim()) return [v];
  return [];
};

// Shared JSON → AppData converter (used by both sync and async loaders)
const parseStoredAppData = (json: string): AppData => {
  const parsed = JSON.parse(json) as AppData;
  const customFieldIds = new Set((parsed.customFieldTypes ?? []).map(t => t.id));
  return {
    ...parsed,
    tasks: parsed.tasks?.map((task) => ({
      ...task,
      startDate: new Date(task.startDate),
      endDate: new Date(task.endDate),
      customFields: task.customFields
        ? Object.fromEntries(
            Object.entries(task.customFields)
              .map(([k, v]) => [k, toStringArray(v)])
              .filter(([, arr]) => (arr as string[]).length > 0)
          )
        : undefined,
    })) ?? [],
    timelineConfigs: (parsed.timelineConfigs ?? [createDefaultTimelineConfig()]).map(cfg => ({
      ...cfg,
      parameters: cfg.parameters
        .filter(p => Object.keys(p.filters ?? {}).every(k => k === 'id' || customFieldIds.has(k)))
        .map(p => ({
          ...p,
          filters: Object.fromEntries(
            Object.entries(p.filters ?? {}).map(([k, v]) => [k, toStringArray(v)])
          ),
        })),
    })),
    dashboards: parsed.dashboards ?? [],
  };
};

export const loadAppData = (): AppData => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return parseStoredAppData(stored);
  } catch (error) {
    console.error('Failed to load app data:', error);
  }
  return createInitialAppData();
};

export const saveAppData = (data: AppData): void => {
  const api = getElectronAPI();
  if (api) {
    // Electron: no persistence — session-only, data lives in memory
    return;
  }
  try {
    const toStore = {
      ...data,
      meta: { ...data.meta, lastModified: new Date().toISOString() },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch (error) {
    console.error('Failed to save app data:', error);
  }
};

// Async initialiser — called by main.tsx before createRoot()
export const initGlobalAppData = async (): Promise<void> => {
  const api = getElectronAPI();
  if (api) {
    // Electron: always start empty — user imports data manually each session
    api.dataClear();
    globalAppData = createInitialAppData();
  } else {
    globalAppData = loadAppData();
  }
};

// ============= Глобальное состояние (Singleton) =============

let globalAppData: AppData = createInitialAppData(); // populated by initGlobalAppData()
const subscribers = new Set<(data: AppData) => void>();

// ============= Undo Stack =============

const MAX_UNDO = 50;
const undoStack: string[] = []; // JSON-снапшоты состояния

const pushUndo = () => {
  undoStack.push(JSON.stringify(globalAppData));
  if (undoStack.length > MAX_UNDO) undoStack.shift();
};

export const undoAppData = (): boolean => {
  if (undoStack.length === 0) return false;
  const snapshot = undoStack.pop()!;
  const parsed = JSON.parse(snapshot) as AppData;
  globalAppData = {
    ...parsed,
    tasks: (parsed.tasks ?? []).map((task) => ({
      ...task,
      startDate: new Date(task.startDate),
      endDate: new Date(task.endDate),
    })),
  };
  notifySubscribers();
  return true;
};

// Функция для уведомления всех подписчиков
const notifySubscribers = () => {
  saveAppData(globalAppData);
  subscribers.forEach(callback => callback({ ...globalAppData }));
};

// Функция для подписки на изменения
const subscribe = (callback: (data: AppData) => void): (() => void) => {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
};

// Синхронизация между вкладками через storage event (только в браузере, не в Electron)
if (typeof window !== 'undefined' && !isElectron()) {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue) as AppData;
        globalAppData = {
          ...parsed,
          tasks: parsed.tasks?.map((task) => ({
            ...task,
            startDate: new Date(task.startDate),
            endDate: new Date(task.endDate),
          })) ?? [],
        };
        notifySubscribers();
      } catch (error) {
        console.error('Failed to sync data from another tab:', error);
      }
    }
  });
}

// ============= Хук useAppStore =============

export const useAppStore = () => {
  const [appData, setAppData] = useState<AppData>(globalAppData);

  // Подписка на изменения глобального состояния
  useEffect(() => {
    const unsubscribe = subscribe((newData) => {
      setAppData(newData);
    });
    return unsubscribe;
  }, []);

  // ===== Операции с задачами =====
  const addTask = useCallback((task: Omit<Task, 'id'>): Task => {
    pushUndo();
    const newTask: Task = {
      ...task,
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    };
    globalAppData = {
      ...globalAppData,
      tasks: [...globalAppData.tasks, newTask],
    };
    notifySubscribers();
    return newTask;
  }, []);

  const updateTask = useCallback((taskId: string, updates: Partial<Task>): void => {
    pushUndo();
    globalAppData = {
      ...globalAppData,
      tasks: globalAppData.tasks.map(task =>
        task.id === taskId ? { ...task, ...updates } : task
      ),
    };
    notifySubscribers();
  }, []);

  const batchUpdateTasks = useCallback((updates: { taskId: string; updates: Partial<Task> }[]): void => {
    pushUndo();
    const updatesMap = new Map(updates.map(u => [u.taskId, u.updates]));
    globalAppData = {
      ...globalAppData,
      tasks: globalAppData.tasks.map(task =>
        updatesMap.has(task.id) ? { ...task, ...updatesMap.get(task.id) } : task
      ),
    };
    notifySubscribers();
  }, []);

  const deleteTask = useCallback((taskId: string): void => {
    pushUndo();
    globalAppData = {
      ...globalAppData,
      tasks: globalAppData.tasks.filter(task => task.id !== taskId),
    };
    notifySubscribers();
  }, []);

  const getTasks = useCallback((): Task[] => {
    return globalAppData.tasks;
  }, []);

  // ===== Операции с типами полей =====
  const addCustomFieldType = useCallback((name: string): CustomFieldType => {
    pushUndo();
    const newType: CustomFieldType = {
      id: `cft_${Date.now()}`,
      name,
    };
    globalAppData = {
      ...globalAppData,
      customFieldTypes: [...globalAppData.customFieldTypes, newType],
    };
    notifySubscribers();
    return newType;
  }, []);

  const getCustomFieldTypes = useCallback((): CustomFieldType[] => {
    return globalAppData.customFieldTypes;
  }, []);

  const deleteCustomFieldType = useCallback((id: string): void => {
    pushUndo();
    globalAppData = {
      ...globalAppData,
      customFieldTypes: globalAppData.customFieldTypes.filter(t => t.id !== id),
    };
    notifySubscribers();
  }, []);

  const renameCustomFieldType = useCallback((id: string, name: string): void => {
    pushUndo();
    globalAppData = {
      ...globalAppData,
      customFieldTypes: globalAppData.customFieldTypes.map(t =>
        t.id === id ? { ...t, name } : t
      ),
    };
    notifySubscribers();
  }, []);

  const reorderCustomFieldTypes = useCallback((orderedIds: string[]): void => {
    pushUndo();
    const map = new Map(globalAppData.customFieldTypes.map(t => [t.id, t]));
    const reordered = orderedIds.map(id => map.get(id)).filter(Boolean) as CustomFieldType[];
    globalAppData = { ...globalAppData, customFieldTypes: reordered };
    notifySubscribers();
  }, []);

  const migrateCustomFieldsToArrays = useCallback((): void => {
    pushUndo();
    const migratedTasks = globalAppData.tasks.map(task => ({
      ...task,
      customFields: task.customFields
        ? Object.fromEntries(
            Object.entries(task.customFields).map(([k, v]) => [
              k, Array.isArray(v) ? v : [v as unknown as string],
            ])
          )
        : undefined,
    }));
    const migratedConfigs = globalAppData.timelineConfigs.map(cfg => ({
      ...cfg,
      parameters: cfg.parameters.map(p => ({
        ...p,
        filters: Object.fromEntries(
          Object.entries(p.filters).map(([k, v]) => [
            k, Array.isArray(v) ? v : [v as unknown as string],
          ])
        ),
      })),
    }));
    globalAppData = { ...globalAppData, tasks: migratedTasks, timelineConfigs: migratedConfigs };
    notifySubscribers();
  }, []);

  // ===== Операции с ресурсами =====
  const getResources = useCallback((): Resource[] => {
    return globalAppData.resources;
  }, []);

  // ===== Операции с проектами =====
  const getProjects = useCallback((): Project[] => {
    return globalAppData.projects;
  }, []);

  // ===== Операции с дашбордами =====
  const getDashboards = useCallback((): DashboardConfig[] => {
    return globalAppData.dashboards ?? [];
  }, []);

  const addDashboard = useCallback((dashboard: Omit<DashboardConfig, 'id'>): DashboardConfig => {
    pushUndo();
    const newDashboard: DashboardConfig = {
      ...dashboard,
      id: `dc_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    };
    globalAppData = {
      ...globalAppData,
      dashboards: [...(globalAppData.dashboards ?? []), newDashboard],
    };
    notifySubscribers();
    return newDashboard;
  }, []);

  const updateDashboard = useCallback((id: string, updates: Partial<Omit<DashboardConfig, 'id'>>): void => {
    pushUndo();
    globalAppData = {
      ...globalAppData,
      dashboards: (globalAppData.dashboards ?? []).map(d => d.id === id ? { ...d, ...updates } : d),
    };
    notifySubscribers();
  }, []);

  const deleteDashboard = useCallback((id: string): void => {
    pushUndo();
    globalAppData = {
      ...globalAppData,
      dashboards: (globalAppData.dashboards ?? []).filter(d => d.id !== id),
    };
    notifySubscribers();
  }, []);

  // ===== Экспорт/Импорт =====
  const exportData = useCallback(async (): Promise<boolean> => {
    const json = JSON.stringify(globalAppData, null, 2);
    const api = getElectronAPI();
    if (api) {
      return await api.exportJson(json);
    } else {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'timeline_export.json';
      a.click();
      URL.revokeObjectURL(url);
      return true;
    }
  }, []);

  const importData = useCallback((jsonString: string): boolean => {
    try {
      const parsed = JSON.parse(jsonString) as AppData;
      // Валидация базовой структуры
      if (parsed.meta && parsed.customFieldTypes !== undefined && parsed.tasks !== undefined) {
        const converted: AppData = {
          meta: {
            version: parsed.meta.version,
            appName: parsed.meta.appName,
            created: parsed.meta.created,
            lastModified: new Date().toISOString(),
          },
          customFieldTypes: parsed.customFieldTypes ?? [],
          resources: parsed.resources ?? [],
          projects: parsed.projects ?? [],
          tasks: (parsed.tasks ?? []).map((task) => ({
            id:           typeof task.id === 'string' ? task.id : String(task.id ?? ''),
            name:         String(task.name ?? '').slice(0, 500),
            startDate:    new Date(task.startDate),
            endDate:      new Date(task.endDate),
            priority:     ((['low', 'medium', 'blocker'] as string[]).includes(task.priority ?? '') ? task.priority : 'medium') as 'low' | 'medium' | 'blocker',
            status:       ((['not_started', 'in_progress', 'done'] as string[]).includes(task.status ?? '') ? task.status : 'not_started') as 'not_started' | 'in_progress' | 'done',
            description:  task.description ? String(task.description).slice(0, 2000) : undefined,
            link:         task.link && isValidHttpsUrl(String(task.link)) ? String(task.link) : undefined,
            color:        typeof task.color === 'string' ? task.color : undefined,
            fix:          typeof task.fix === 'boolean' ? task.fix : undefined,
            milestone:    typeof task.milestone === 'boolean' ? task.milestone : undefined,
            projectId:    task.projectId ? String(task.projectId) : undefined,
            resourceIds:  Array.isArray(task.resourceIds)
                            ? (task.resourceIds as unknown[]).filter((r): r is string => typeof r === 'string')
                            : undefined,
            customFields: task.customFields && typeof task.customFields === 'object' && !Array.isArray(task.customFields)
                            ? Object.fromEntries(
                                Object.entries(task.customFields as Record<string, unknown>).map(([k, v]) => [k, toStringArray(v)])
                              )
                            : undefined,
          })),
          timelineConfigs: (() => {
            const cfIds = new Set((parsed.customFieldTypes ?? []).map(t => t.id));
            return (parsed.timelineConfigs ?? [createDefaultTimelineConfig()]).map(cfg => ({
              ...cfg,
              parameters: (cfg.parameters ?? [])
                .filter(p => Object.keys(p.filters ?? {}).every(k => k === 'id' || cfIds.has(k)))
                .map(p => ({
                  ...p,
                  filters: Object.fromEntries(
                    Object.entries(p.filters ?? {}).map(([k, v]) => [k, toStringArray(v as unknown)])
                  ) as Record<string, string[]>,
                })),
            }));
          })(),
          dashboards: parsed.dashboards ?? [],
        };
        globalAppData = converted;
        notifySubscribers();
        return true;
      }
    } catch (error) {
      console.error('Failed to import data:', error);
    }
    return false;
  }, []);

  // ===== Операции с Timeline конфигурациями =====
  const getTimelineConfigs = useCallback((): TimelineConfig[] => {
    return globalAppData.timelineConfigs;
  }, []);

  const getTimelineConfig = useCallback(
    (configId: string): TimelineConfig | undefined => {
      return globalAppData.timelineConfigs?.find((cfg) => cfg.id === configId);
    },
    []
  );

  /**
   * Группирует задачи по параметрам конфигурации
   * Возвращает Map: параметр ID → массив задач
   */
  const groupTasksForTimeline = useCallback(
    (configId: string): Map<string, Task[]> => {
      const config = getTimelineConfig(configId);
      if (!config) return new Map();
      return groupTasksByFilters(globalAppData.tasks, config.parameters);
    },
    [getTimelineConfig]
  );

  // ===== Операции с параметрами Timeline =====
  const addParameterToTimeline = useCallback(
    (configId: string, parameter: Omit<TimelineParameter, 'id'>): TimelineParameter => {
      pushUndo();
      const newParameter: TimelineParameter = {
        ...parameter,
        id: `param_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      };

      globalAppData = {
        ...globalAppData,
        timelineConfigs: globalAppData.timelineConfigs.map(cfg => {
          if (cfg.id === configId) {
            return { ...cfg, parameters: [...cfg.parameters, newParameter] };
          }
          return cfg;
        }),
      };
      notifySubscribers();

      return newParameter;
    },
    []
  );

  const deleteParameterFromTimeline = useCallback(
    (configId: string, paramId: string): void => {
      pushUndo();
      globalAppData = {
        ...globalAppData,
        timelineConfigs: globalAppData.timelineConfigs.map(cfg => {
          if (cfg.id !== configId) return cfg;
          // Собираем все id потомков рекурсивно
          const toDelete = new Set<string>();
          const collectDescendants = (pid: string) => {
            toDelete.add(pid);
            cfg.parameters.forEach(p => {
              if (p.parentId === pid) collectDescendants(p.id);
            });
          };
          collectDescendants(paramId);
          return { ...cfg, parameters: cfg.parameters.filter(p => !toDelete.has(p.id)) };
        }),
      };
      notifySubscribers();
    },
    []
  );

  const updateParameterInTimeline = useCallback(
    (configId: string, paramId: string, updates: Partial<Omit<TimelineParameter, 'id'>>): void => {
      pushUndo();
      globalAppData = {
        ...globalAppData,
        timelineConfigs: globalAppData.timelineConfigs.map(cfg =>
          cfg.id === configId
            ? { ...cfg, parameters: cfg.parameters.map(p => p.id === paramId ? { ...p, ...updates } : p) }
            : cfg
        ),
      };
      notifySubscribers();
    },
    []
  );

  const reorderParameters = useCallback(
    (configId: string, activeId: string, overId: string): void => {
      pushUndo();
      const config = globalAppData.timelineConfigs.find(c => c.id === configId);
      if (!config) return;
      const params = [...config.parameters];
      const activeIdx = params.findIndex(p => p.id === activeId);
      const overIdx = params.findIndex(p => p.id === overId);
      if (activeIdx === -1 || overIdx === -1) return;
      const [moved] = params.splice(activeIdx, 1);
      params.splice(overIdx, 0, moved);
      globalAppData = {
        ...globalAppData,
        timelineConfigs: globalAppData.timelineConfigs.map(cfg =>
          cfg.id === configId ? { ...cfg, parameters: params } : cfg
        ),
      };
      notifySubscribers();
    },
    []
  );

  const reorderAndReparentParameter = useCallback(
    (configId: string, activeId: string, overId: string, newLevel: number, newParentId: string | undefined): void => {
      pushUndo();
      const config = globalAppData.timelineConfigs.find(c => c.id === configId);
      if (!config) return;
      const params = [...config.parameters];
      const activeIdx = params.findIndex(p => p.id === activeId);
      const overIdx = params.findIndex(p => p.id === overId);
      if (activeIdx === -1 || overIdx === -1) return;

      const activeParam = params[activeIdx];
      const levelDelta = newLevel - activeParam.level;

      // Собираем активный узел + всех потомков
      const movedIds = new Set([activeId, ...getDescendantIds(params, activeId)]);

      const movedBlock = params.filter(p => movedIds.has(p.id));
      const remaining = params.filter(p => !movedIds.has(p.id));

      const updatedBlock = movedBlock.map(p => ({
        ...p,
        level: p.id === activeId ? newLevel : p.level + levelDelta,
        parentId: p.id === activeId ? newParentId : p.parentId,
      }));

      const insertIdx = remaining.findIndex(p => p.id === overId);
      const finalIdx = insertIdx === -1 ? remaining.length : insertIdx;

      const result = [
        ...remaining.slice(0, finalIdx),
        ...updatedBlock,
        ...remaining.slice(finalIdx),
      ];

      globalAppData = {
        ...globalAppData,
        timelineConfigs: globalAppData.timelineConfigs.map(cfg =>
          cfg.id === configId ? { ...cfg, parameters: result } : cfg
        ),
      };
      notifySubscribers();
    },
    []
  );

  // Вспомогательная: получить id всех потомков узла
  const getDescendantIds = (params: TimelineParameter[], pid: string): string[] => {
    const result: string[] = [];
    params.forEach(p => {
      if (p.parentId === pid) {
        result.push(p.id);
        result.push(...getDescendantIds(params, p.id));
      }
    });
    return result;
  };

  // Сценарий 1: поднять узел выше его родителя (стать sibling родителя)
  const liftAboveParentParameter = useCallback(
    (configId: string, nodeId: string): void => {
      pushUndo();
      const config = globalAppData.timelineConfigs.find(c => c.id === configId);
      if (!config) return;
      const params = [...config.parameters];

      const node = params.find(p => p.id === nodeId);
      if (!node || !node.parentId) return;
      const parent = params.find(p => p.id === node.parentId);
      if (!parent) return;

      const levelDelta = parent.level - node.level; // всегда -1
      const descendantIds = getDescendantIds(params, nodeId);
      const movedIds = new Set([nodeId, ...descendantIds]);

      const movedBlock = params.filter(p => movedIds.has(p.id)).map(p => ({
        ...p,
        level: p.level + levelDelta,
        parentId: p.id === nodeId ? parent.parentId : p.parentId,
      }));
      const remaining = params.filter(p => !movedIds.has(p.id));

      // Вставить перед родителем
      const parentPosInRemaining = remaining.findIndex(p => p.id === parent.id);
      const insertAt = parentPosInRemaining === -1 ? 0 : parentPosInRemaining;

      const result = [
        ...remaining.slice(0, insertAt),
        ...movedBlock,
        ...remaining.slice(insertAt),
      ];

      globalAppData = {
        ...globalAppData,
        timelineConfigs: globalAppData.timelineConfigs.map(cfg =>
          cfg.id === configId ? { ...cfg, parameters: result } : cfg
        ),
      };
      notifySubscribers();
    },
    []
  );

  // Сценарий 2: сделать узел дочерним другого узла
  const reparentUnderParameter = useCallback(
    (configId: string, nodeId: string, newParentId: string): void => {
      pushUndo();
      const config = globalAppData.timelineConfigs.find(c => c.id === configId);
      if (!config) return;
      const params = [...config.parameters];

      const node = params.find(p => p.id === nodeId);
      const newParent = params.find(p => p.id === newParentId);
      if (!node || !newParent) return;

      const descendantIds = getDescendantIds(params, nodeId);
      // Нельзя сделать родителем собственного потомка
      if (descendantIds.includes(newParentId) || nodeId === newParentId) return;

      const levelDelta = (newParent.level + 1) - node.level;
      const movedIds = new Set([nodeId, ...descendantIds]);

      const movedBlock = params.filter(p => movedIds.has(p.id)).map(p => ({
        ...p,
        level: Math.min(5, p.level + levelDelta),
        parentId: p.id === nodeId ? newParentId : p.parentId,
      }));
      const remaining = params.filter(p => !movedIds.has(p.id));

      // Вставить в конец детей newParent
      const newParentPos = remaining.findIndex(p => p.id === newParentId);
      let insertAt = newParentPos + 1;
      while (insertAt < remaining.length) {
        const cur = remaining[insertAt];
        if (cur.level <= newParent.level) break;
        insertAt++;
      }

      const result = [
        ...remaining.slice(0, insertAt),
        ...movedBlock,
        ...remaining.slice(insertAt),
      ];

      globalAppData = {
        ...globalAppData,
        timelineConfigs: globalAppData.timelineConfigs.map(cfg =>
          cfg.id === configId ? { ...cfg, parameters: result } : cfg
        ),
      };
      notifySubscribers();
    },
    []
  );

  // Вставить активный параметр сразу после целевого (на том же уровне)
  const insertAfterParameter = useCallback(
    (configId: string, activeId: string, overId: string, newLevel: number, newParentId: string | undefined): void => {
      pushUndo();
      const config = globalAppData.timelineConfigs.find(c => c.id === configId);
      if (!config) return;
      const params = [...config.parameters];
      const activeIdx = params.findIndex(p => p.id === activeId);
      const overIdx = params.findIndex(p => p.id === overId);
      if (activeIdx === -1 || overIdx === -1) return;

      const activeParam = params[activeIdx];
      const levelDelta = newLevel - activeParam.level;

      const movedIds = new Set([activeId, ...getDescendantIds(params, activeId)]);

      const movedBlock = params.filter(p => movedIds.has(p.id));
      const remaining = params.filter(p => !movedIds.has(p.id));

      const updatedBlock = movedBlock.map(p => ({
        ...p,
        level: p.id === activeId ? newLevel : p.level + levelDelta,
        parentId: p.id === activeId ? newParentId : p.parentId,
      }));

      // Вставляем ПОСЛЕ цели (+1), а не перед
      const insertIdx = remaining.findIndex(p => p.id === overId);
      const finalIdx = insertIdx === -1 ? remaining.length : insertIdx + 1;

      const result = [
        ...remaining.slice(0, finalIdx),
        ...updatedBlock,
        ...remaining.slice(finalIdx),
      ];

      globalAppData = {
        ...globalAppData,
        timelineConfigs: globalAppData.timelineConfigs.map(cfg =>
          cfg.id === configId ? { ...cfg, parameters: result } : cfg
        ),
      };
      notifySubscribers();
    },
    []
  );

  // ===== Сброс данных =====
  const clearAppData = useCallback((): void => {
    pushUndo();
    const api = getElectronAPI();
    if (api) { api.dataClear(); }
    else { localStorage.removeItem(STORAGE_KEY); }
    globalAppData = createInitialAppData();
    notifySubscribers();
  }, []);

  // Создать новую конфигурацию Timeline
  const addTimelineConfig = useCallback((name: string): TimelineConfig => {
    pushUndo();
    const newConfig: TimelineConfig = {
      id: `timeline_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      name,
      parameters: [],
    };
    globalAppData = {
      ...globalAppData,
      timelineConfigs: [...globalAppData.timelineConfigs, newConfig],
    };
    notifySubscribers();
    return newConfig;
  }, []);

  const deleteTimelineConfig = useCallback((id: string): void => {
    pushUndo();
    globalAppData = {
      ...globalAppData,
      timelineConfigs: globalAppData.timelineConfigs.filter(cfg => cfg.id !== id),
    };
    notifySubscribers();
  }, []);

  const updateTimelineConfig = useCallback((id: string, updates: Partial<TimelineConfig>): void => {
    pushUndo();
    globalAppData = {
      ...globalAppData,
      timelineConfigs: globalAppData.timelineConfigs.map(cfg =>
        cfg.id === id ? { ...cfg, ...updates } : cfg
      ),
    };
    notifySubscribers();
  }, []);

  const updateTimelineCollapsedIds = useCallback((configId: string, collapsedIds: string[]): void => {
    globalAppData = {
      ...globalAppData,
      timelineConfigs: globalAppData.timelineConfigs.map(cfg =>
        cfg.id === configId ? { ...cfg, collapsedIds } : cfg
      ),
    };
    notifySubscribers();
  }, []);

  const duplicateTimelineConfig = useCallback((id: string): TimelineConfig | undefined => {
    pushUndo();
    const original = globalAppData.timelineConfigs.find(cfg => cfg.id === id);
    if (!original) return undefined;
    const newConfig: TimelineConfig = {
      ...original,
      id: `timeline_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      name: `${original.name} (копия)`,
      parameters: original.parameters.map(p => ({ ...p })),
    };
    globalAppData = {
      ...globalAppData,
      timelineConfigs: [...globalAppData.timelineConfigs, newConfig],
    };
    notifySubscribers();
    return newConfig;
  }, []);

  return {
    appData,
    tasks: {
      add: addTask,
      update: updateTask,
      batchUpdate: batchUpdateTasks,
      delete: deleteTask,
      getAll: getTasks,
    },
    customFieldTypes: {
      add: addCustomFieldType,
      getAll: getCustomFieldTypes,
      delete: deleteCustomFieldType,
      rename: renameCustomFieldType,
      reorder: reorderCustomFieldTypes,
      migrate: migrateCustomFieldsToArrays,
    },
    resources: {
      getAll: getResources,
    },

    projects: {
      getAll: getProjects,
    },

    dashboards: {
      getAll: getDashboards,
      add: addDashboard,
      update: updateDashboard,
      delete: deleteDashboard,
    },
    timelines: {
      getConfigs: getTimelineConfigs,
      getConfig: getTimelineConfig,
      addConfig: addTimelineConfig,
      deleteConfig: deleteTimelineConfig,
      updateConfig: updateTimelineConfig,
      duplicateConfig: duplicateTimelineConfig,
      groupTasksForTimeline,
      addParameter: addParameterToTimeline,
      deleteParameter: deleteParameterFromTimeline,
      updateParameter: updateParameterInTimeline,
      reorderParameters,
      reorderAndReparent: reorderAndReparentParameter,
      insertAfter: insertAfterParameter,
      liftAboveParent: liftAboveParentParameter,
      reparentUnder: reparentUnderParameter,
      updateCollapsedIds: updateTimelineCollapsedIds,
    },
    export: exportData,
    import: importData,
    reset: clearAppData,
    undo: undoAppData,
  };
};

// ============= Хук useTimelineViewState =============

export const useTimelineViewState = () => {
  const [viewState, setViewState] = useState<TimelineViewState>(loadTimelineViewState);

  // In Electron, load view state asynchronously from the main process on mount
  useEffect(() => {
    const api = getElectronAPI();
    if (!api) return;
    api.viewStateLoad().then((json) => {
      if (json) {
        try {
          setViewState(JSON.parse(json) as TimelineViewState);
        } catch {
          // ignore malformed state
        }
      }
    });
  }, []);

  const updateViewState = useCallback((updates: Partial<TimelineViewState>) => {
    setViewState(prev => {
      const next = { ...prev, ...updates };
      saveTimelineViewState(next);
      return next;
    });
  }, []);

  return { viewState, updateViewState };
};
