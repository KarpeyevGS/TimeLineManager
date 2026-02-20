import { useState, useCallback, useEffect } from 'react';

// ============= Timeline View State =============

export interface TimelineViewState {
  dateRange: { from: string; to: string } | null; // ISO-строки
  zoomIndex: number;
  scrollLeft: number;
}

const TIMELINE_VIEW_KEY = 'timeline_view_state';

const DEFAULT_TIMELINE_VIEW: TimelineViewState = {
  dateRange: {
    from: new Date(2026, 0, 1).toISOString(),
    to: new Date(2026, 0, 31).toISOString(),
  },
  zoomIndex: 2,
  scrollLeft: 0,
};

export const loadTimelineViewState = (): TimelineViewState => {
  try {
    const stored = localStorage.getItem(TIMELINE_VIEW_KEY);
    if (stored) return JSON.parse(stored) as TimelineViewState;
  } catch {
    // ignore
  }
  return DEFAULT_TIMELINE_VIEW;
};

export const saveTimelineViewState = (state: TimelineViewState): void => {
  try {
    localStorage.setItem(TIMELINE_VIEW_KEY, JSON.stringify(state));
  } catch {
    // ignore
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
  customFields?: Record<string, string>;
  color?: string; // HEX цвет для задачи
}

// Параметр Timeline с фильтрами
export interface TimelineParameter {
  id: string;
  name: string;
  level: number;
  parentId?: string;
  filters: Record<string, string>;  // ← ФИЛЬТРЫ встроены
}

// Конфигурация Timeline
export interface TimelineConfig {
  id: string;
  name: string;
  description?: string;
  parameters: TimelineParameter[];
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
  customFieldTypes: [] as CustomFieldType[],
  resources: [
    { id: 'res_1', name: 'Иван Иванов', role: 'Developer' },
    { id: 'res_2', name: 'Мария Петрова', role: 'Designer' },
  ],
  projects: [
    { id: 'proj_1', name: 'Project A', color: '#4a7a85' },
    { id: 'proj_2', name: 'Project B', color: '#3b82f6' },
  ],
  tasks: [],
  timelineConfigs: [createDefaultTimelineConfig()],  // ← С примерами параметров
});

// ============= Утилиты для группировки задач =============

/**
 * Проверяет, соответствует ли задача всем фильтрам параметра
 * Если фильтры пустые — возвращает false (параметр без фильтров не показывает задачи)
 */
export const matchesTaskFilters = (task: Task, filters: Record<string, string>): boolean => {
  // Если фильтры пустые, ни одна задача не совпадает с параметром
  if (Object.keys(filters).length === 0) {
    return false;
  }

  return Object.entries(filters).every(([key, value]) => {
    const taskValue = task.customFields?.[key];
    return taskValue === value;
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

// ============= Функции работы с localStorage =============

const STORAGE_KEY = 'timeline_app_data';

export const loadAppData = (): AppData => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as AppData;
      // Конвертируем строки обратно в Date
      const customFieldIds = new Set((parsed.customFieldTypes ?? []).map(t => t.id));

      const loaded: AppData = {
        ...parsed,
        tasks: parsed.tasks?.map((task) => ({
          ...task,
          startDate: new Date(task.startDate),
          endDate: new Date(task.endDate),
        })) ?? [],
        // Гарантируем наличие timelineConfigs
        // Параметры с фильтрами по неизвестным полям (не кастомным) — удаляем
        timelineConfigs: (parsed.timelineConfigs ?? [createDefaultTimelineConfig()]).map(cfg => ({
          ...cfg,
          parameters: cfg.parameters.filter(p =>
            Object.keys(p.filters ?? {}).every(k => customFieldIds.has(k))
          ),
        })),
      };
      return loaded;
    }
  } catch (error) {
    console.error('Failed to load app data:', error);
  }
  return createInitialAppData();
};

export const saveAppData = (data: AppData): void => {
  try {
    const toStore = {
      ...data,
      meta: {
        ...data.meta,
        lastModified: new Date().toISOString(),
      },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch (error) {
    console.error('Failed to save app data:', error);
  }
};

// ============= Глобальное состояние (Singleton) =============

let globalAppData: AppData = loadAppData();
const subscribers = new Set<(data: AppData) => void>();

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

// Синхронизация между вкладками через storage event
if (typeof window !== 'undefined') {
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
        console.log('📡 Data synced from another tab');
      } catch (error) {
        console.error('Failed to sync data from another tab:', error);
      }
    }
  });
}

// ============= Хук useAppStore =============

export const useAppStore = () => {
  console.log('🔧 useAppStore hook initializing');
  const [appData, setAppData] = useState<AppData>(globalAppData);
  console.log('📦 AppData loaded:', appData);

  // Подписка на изменения глобального состояния
  useEffect(() => {
    const unsubscribe = subscribe((newData) => {
      console.log('📢 Store updated, notifying component');
      setAppData(newData);
    });
    return unsubscribe;
  }, []);

  // ===== Операции с задачами =====
  const addTask = useCallback((task: Omit<Task, 'id'>): Task => {
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
    globalAppData = {
      ...globalAppData,
      tasks: globalAppData.tasks.map(task =>
        task.id === taskId ? { ...task, ...updates } : task
      ),
    };
    notifySubscribers();
  }, []);

  const deleteTask = useCallback((taskId: string): void => {
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
    globalAppData = {
      ...globalAppData,
      customFieldTypes: globalAppData.customFieldTypes.filter(t => t.id !== id),
    };
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

  // ===== Экспорт/Импорт =====
  const exportData = useCallback((): string => {
    return JSON.stringify(globalAppData, null, 2);
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
            ...task,
            startDate: new Date(task.startDate),
            endDate: new Date(task.endDate),
          })),
          timelineConfigs: parsed.timelineConfigs ?? [createDefaultTimelineConfig()],
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
      console.log('🔧 addParameterToTimeline called:', { configId, parameter });
      const newParameter: TimelineParameter = {
        ...parameter,
        id: `param_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      };
      console.log('✅ Created new parameter:', newParameter);

      globalAppData = {
        ...globalAppData,
        timelineConfigs: globalAppData.timelineConfigs.map(cfg => {
          if (cfg.id === configId) {
            console.log('✅ Found matching config, adding parameter');
            return { ...cfg, parameters: [...cfg.parameters, newParameter] };
          }
          return cfg;
        }),
      };
      console.log('📝 Updated timelineConfigs:', globalAppData.timelineConfigs);
      notifySubscribers();

      return newParameter;
    },
    []
  );

  const deleteParameterFromTimeline = useCallback(
    (configId: string, paramId: string): void => {
      globalAppData = {
        ...globalAppData,
        timelineConfigs: globalAppData.timelineConfigs.map(cfg =>
          cfg.id === configId
            ? { ...cfg, parameters: cfg.parameters.filter(p => p.id !== paramId) }
            : cfg
        ),
      };
      notifySubscribers();
    },
    []
  );

  const updateParameterInTimeline = useCallback(
    (configId: string, paramId: string, updates: Partial<Omit<TimelineParameter, 'id'>>): void => {
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
      const config = globalAppData.timelineConfigs.find(c => c.id === configId);
      if (!config) return;
      const params = [...config.parameters];
      const activeIdx = params.findIndex(p => p.id === activeId);
      const overIdx = params.findIndex(p => p.id === overId);
      if (activeIdx === -1 || overIdx === -1) return;

      const activeParam = params[activeIdx];
      const levelDelta = newLevel - activeParam.level;

      // Собираем активный узел + всех потомков
      const getDescendantIds = (pid: string): string[] => {
        const result: string[] = [];
        params.forEach(p => {
          if (p.parentId === pid) {
            result.push(p.id);
            result.push(...getDescendantIds(p.id));
          }
        });
        return result;
      };
      const movedIds = new Set([activeId, ...getDescendantIds(activeId)]);

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
      const config = globalAppData.timelineConfigs.find(c => c.id === configId);
      if (!config) return;
      const params = [...config.parameters];
      const activeIdx = params.findIndex(p => p.id === activeId);
      const overIdx = params.findIndex(p => p.id === overId);
      if (activeIdx === -1 || overIdx === -1) return;

      const activeParam = params[activeIdx];
      const levelDelta = newLevel - activeParam.level;

      const getDescendantIds = (pid: string): string[] => {
        const result: string[] = [];
        params.forEach(p => {
          if (p.parentId === pid) {
            result.push(p.id);
            result.push(...getDescendantIds(p.id));
          }
        });
        return result;
      };
      const movedIds = new Set([activeId, ...getDescendantIds(activeId)]);

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
    localStorage.removeItem(STORAGE_KEY);
    globalAppData = createInitialAppData();
    notifySubscribers();
  }, []);

  return {
    appData,
    tasks: {
      add: addTask,
      update: updateTask,
      delete: deleteTask,
      getAll: getTasks,
    },
    customFieldTypes: {
      add: addCustomFieldType,
      getAll: getCustomFieldTypes,
      delete: deleteCustomFieldType,
    },
    resources: {
      getAll: getResources,
    },
    projects: {
      getAll: getProjects,
    },
    timelines: {
      getConfigs: getTimelineConfigs,
      getConfig: getTimelineConfig,
      groupTasksForTimeline,
      addParameter: addParameterToTimeline,
      deleteParameter: deleteParameterFromTimeline,
      updateParameter: updateParameterInTimeline,
      reorderParameters,
      reorderAndReparent: reorderAndReparentParameter,
      insertAfter: insertAfterParameter,
      liftAboveParent: liftAboveParentParameter,
      reparentUnder: reparentUnderParameter,
    },
    export: exportData,
    import: importData,
    reset: clearAppData,
  };
};

// ============= Хук useTimelineViewState =============

export const useTimelineViewState = () => {
  const [viewState, setViewState] = useState<TimelineViewState>(loadTimelineViewState);

  const updateViewState = useCallback((updates: Partial<TimelineViewState>) => {
    setViewState(prev => {
      const next = { ...prev, ...updates };
      saveTimelineViewState(next);
      return next;
    });
  }, []);

  return { viewState, updateViewState };
};
