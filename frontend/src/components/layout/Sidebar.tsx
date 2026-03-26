import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getElectronAPI } from '../../electronApi';
import ReactDOM from 'react-dom';
import { ConfirmDialog } from '../ui/ConfirmDialog';
// Импорт иконок из библиотеки Lucide (LucideIcon — тип для компонентов иконок)
import {
  ListTodo,
  GanttChart,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  CalendarRange,
  Download,
  Upload,
  RefreshCw,
  SquarePen,
  Copy,
  Trash2,
  DatabaseZap,
  LucideIcon
} from 'lucide-react';
import { useAppStore } from '../../store';

// Интерфейс для строгой типизации объекта пункта меню
interface MenuItem {
  id: string;      // Уникальный идентификатор (используется для логики activeId и key)
  label: string;   // Текст, отображаемый в меню или тултипе
  icon: LucideIcon; // Компонент иконки
}

// Константный массив элементов меню (вынесен за компонент для чистоты кода)
const MENU_ITEMS: MenuItem[] = [
  { icon: ListTodo, label: 'All Tasks', id: 'tasks' },
  { icon: GanttChart , label: 'Timeline', id: 'timeline' },
  { icon: LayoutDashboard, label: 'Дашборды', id: 'resources' },
];

// Типизация пропсов для Sidebar
interface SidebarProps {
  activePage: string;
  onPageChange: (id: string) => void;
  activeTimelineId?: string;
  onTimelineSelect: (id: string) => void;
  activeDashboardId?: string;
  onDashboardSelect: (id: string) => void;
  onDashboardCreate: () => void;
}

// Типизация компонента как React.FC (Functional Component)
export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onPageChange,
  activeTimelineId,
  onTimelineSelect,
  activeDashboardId,
  onDashboardSelect,
  onDashboardCreate,
}) => {
  // Состояние для управления шириной панели
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true);
  const [timelinePopupOpen, setTimelinePopupOpen] = useState(false);
  const [isDrawerCollapsed, setIsDrawerCollapsed] = useState(false);
  const [dashboardPopupOpen, setDashboardPopupOpen] = useState(false);
  const [isDashboardDrawerCollapsed, setIsDashboardDrawerCollapsed] = useState(false);
  const [dashboardRenamingId, setDashboardRenamingId] = useState<string | null>(null);
  const [dashboardRenameValue, setDashboardRenameValue] = useState('');
  const [dashboardContextMenu, setDashboardContextMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const [confirmDeleteDashboardId, setConfirmDeleteDashboardId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; cfgId: string } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const store = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tooltip, setTooltip] = useState<{ label: string; x: number; y: number } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmNewProject, setConfirmNewProject] = useState(false);
  const [importAlert, setImportAlert] = useState<{ message: string; onClose: () => void } | null>(null);
  const [confirmImport, setConfirmImport] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const hasDataRef = useRef(false);
  hasDataRef.current = store.appData.tasks.length > 0;

  const showTooltip = (e: React.MouseEvent<HTMLElement>, label: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ label, x: rect.right + 8, y: rect.top + rect.height / 2 });
  };
  const hideTooltip = () => setTooltip(null);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [contextMenu]);

  useEffect(() => {
    if (!dashboardContextMenu) return;
    const close = () => setDashboardContextMenu(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [dashboardContextMenu]);

  const commitDashboardRename = (id: string) => {
    const trimmed = dashboardRenameValue.trim();
    const d = store.appData.dashboards?.find(x => x.id === id);
    if (trimmed && d && trimmed !== d.name) {
      store.dashboards.update(id, { name: trimmed });
    }
    setDashboardRenamingId(null);
  };

  const confirmDeleteDashboard = () => {
    if (!confirmDeleteDashboardId) return;
    store.dashboards.delete(confirmDeleteDashboardId);
    if (activeDashboardId === confirmDeleteDashboardId) {
      const remaining = (store.appData.dashboards ?? []).filter(d => d.id !== confirmDeleteDashboardId);
      onDashboardSelect(remaining.length > 0 ? remaining[0].id : '');
    }
    setConfirmDeleteDashboardId(null);
  };

  useEffect(() => {
    const api = getElectronAPI();
    if (!api) return;
    const unsubscribe = api.onWindowClosing(() => {
      if (!hasDataRef.current) {
        api.closeConfirmed();
      } else {
        setConfirmClose(true);
      }
    });
    return unsubscribe;
  }, []);

  const handleRenameConfig = (cfgId: string) => {
    const cfg = store.appData.timelineConfigs.find(c => c.id === cfgId);
    if (!cfg) return;
    setRenameValue(cfg.name);
    setRenamingId(cfgId);
    setContextMenu(null);
  };

  const commitRename = (cfgId: string) => {
    const trimmed = renameValue.trim();
    const cfg = store.appData.timelineConfigs.find(c => c.id === cfgId);
    if (trimmed && cfg && trimmed !== cfg.name) {
      store.timelines.updateConfig(cfgId, { name: trimmed });
    }
    setRenamingId(null);
  };

  const handleDuplicateConfig = (cfgId: string) => {
    store.timelines.duplicateConfig(cfgId);
    setContextMenu(null);
  };

  const handleDeleteConfig = (cfgId: string) => {
    setContextMenu(null);
    setConfirmDeleteId(cfgId);
  };

  const confirmDelete = () => {
    if (!confirmDeleteId) return;
    const remaining = store.appData.timelineConfigs.filter(c => c.id !== confirmDeleteId);
    store.timelines.deleteConfig(confirmDeleteId);
    if (activeTimelineId === confirmDeleteId) {
      onTimelineSelect(remaining.length > 0 ? remaining[0].id : '');
    }
    setConfirmDeleteId(null);
  };

  // Функция экспорта данных
  const handleExport = () => {
    void store.export();
  };

  // Функция создания нового проекта
  const handleNewProject = () => {
    setConfirmNewProject(true);
  };

  // Вспомогательная функция выполнения импорта
  const doImport = useCallback((content: string) => {
    const success = store.import(content);
    if (success) {
      setImportAlert({ message: 'Данные успешно импортированы.', onClose: () => setImportAlert(null) });
    } else {
      setImportAlert({ message: 'Ошибка: некорректный формат файла.', onClose: () => setImportAlert(null) });
    }
  }, [store]);

  // Открыть файловый менеджер и выполнить импорт (вызывается ПОСЛЕ подтверждения)
  const openFilePicker = () => {
    const api = getElectronAPI();
    if (api) {
      void (async () => {
        try {
          const content = await api.importJson();
          if (content) doImport(content);
        } catch (error) {
          setImportAlert({ message: 'Ошибка при импорте: ' + (error instanceof Error ? error.message : 'неизвестная ошибка'), onClose: () => setImportAlert(null) });
        }
      })();
    } else {
      fileInputRef.current?.click();
    }
  };

  // Браузер: файл выбран — просто импортировать (диалог уже был показан до этого)
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setImportAlert({ message: 'Файл слишком большой (макс. 5 МБ).', onClose: () => setImportAlert(null) });
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        doImport(e.target?.result as string);
      } catch (error) {
        setImportAlert({ message: 'Ошибка при импорте: ' + (error instanceof Error ? error.message : 'неизвестная ошибка'), onClose: () => setImportAlert(null) });
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // Клик по кнопке Импорт: если есть данные — сначала диалог, иначе сразу файловый менеджер
  const handleImportClick = () => {
    if (hasDataRef.current) {
      setConfirmImport(true);
    } else {
      openFilePicker();
    }
  };

  const aside = (
    <aside
      // Динамические классы: меняем ширину w-16/w-64 и фиксируем панель по высоте экрана
      className={`bg-app-surface border-r border-app-border transition-all duration-300 flex flex-col h-screen sticky top-0 ${
        isCollapsed ? 'w-16' : 'w-48'
      }`}
      aria-label="Main Navigation" // Описание для скринридеров
    >
      {/* --- Секция Header (Логотип и кнопка) --- */}
      <div className="p-4 border-b border-app-border flex justify-between items-center h-16 relative">
      {/* Логотип */}
        <div className={`flex items-center gap-2 font-bold text-app-text-head transition-all duration-300 ${isCollapsed ? 'opacity-0 invisible' : 'opacity-100 visible'}`}>
        <CalendarRange className="text-app-primary" size={24} />
        <span className={`tracking-tight text-xl whitespace-nowrap transition-opacity duration-300 ${isCollapsed ? 'opacity-0' : 'opacity-100 delay-150'}`}>Time Line</span>
        </div>
{/* Кнопка — теперь прижата к правому краю через right-4 */}
  <button 
    onClick={() => setIsCollapsed(!isCollapsed)} 
    className="p-1.5 hover:bg-app-bg rounded-lg text-app-text-muted transition-colors absolute right-4 top-1/2 -translate-y-1/2"
    aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
  >
    {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
  </button>
</div>
      {/* --- Секция Навигации --- */}
      <nav className="flex-1 p-3 space-y-2">
        {MENU_ITEMS.map((item) => {
          const isActive = activePage === item.id;
          const isTimeline = item.id === 'timeline';

          const isDashboard = item.id === 'resources';

          return (
            <button
              key={item.id}
              onClick={() => {
                if (isTimeline) {
                  const isEffectivelyHidden = !timelinePopupOpen || isDrawerCollapsed;
                  if (isEffectivelyHidden) {
                    setTimelinePopupOpen(true);
                    setIsDrawerCollapsed(false);
                  } else {
                    setTimelinePopupOpen(false);
                  }
                  setDashboardPopupOpen(false);
                } else if (isDashboard) {
                  const isEffectivelyHidden = !dashboardPopupOpen || isDashboardDrawerCollapsed;
                  if (isEffectivelyHidden) {
                    setDashboardPopupOpen(true);
                    setIsDashboardDrawerCollapsed(false);
                  } else {
                    setDashboardPopupOpen(false);
                  }
                  setTimelinePopupOpen(false);
                  onPageChange('resources');
                } else {
                  setTimelinePopupOpen(false);
                  setDashboardPopupOpen(false);
                  onPageChange(item.id);
                }
              }}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center p-2' : 'p-3'} rounded-xl transition-all group relative ${
                isActive
                  ? 'bg-app-primary/10 text-app-primary'
                  : 'text-app-text-main hover:bg-app-bg'
              }`}
              onMouseEnter={isCollapsed ? (e) => showTooltip(e, item.label) : undefined}
              onMouseLeave={isCollapsed ? hideTooltip : undefined}
            >
              <item.icon
                size={24}
                className={`min-w-[24px] transition-colors ${
                  isActive ? 'text-app-primary' : 'group-hover:text-app-primary'
                }`}
              />
              {!isCollapsed && (
                <span className="ml-3 font-semibold text-sm">{item.label}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* --- Секция Data Import/Export (видна всегда) --- */}
      <div className="p-3 space-y-2 border-t border-app-border">
        {/* Кнопка Импорт */}
        <button
          onClick={handleImportClick}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center p-2' : 'p-3'} rounded-xl transition-all group relative text-app-text-main hover:bg-app-bg`}
          onMouseEnter={isCollapsed ? (e) => showTooltip(e, 'Импорт') : undefined}
          onMouseLeave={isCollapsed ? hideTooltip : undefined}
        >
          <Upload
            size={20}
            className="min-w-[20px] transition-colors group-hover:text-app-primary"
          />
          {!isCollapsed && (
            <span className="ml-3 font-semibold text-sm">Импорт</span>
          )}
        </button>

        {/* Скрытый input для выбора файла (только в браузере) */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
        />

        {/* Кнопка Экспорт */}
        <button
          onClick={handleExport}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center p-2' : 'p-3'} rounded-xl transition-all group relative text-app-text-main hover:bg-app-bg`}
          onMouseEnter={isCollapsed ? (e) => showTooltip(e, 'Экспорт') : undefined}
          onMouseLeave={isCollapsed ? hideTooltip : undefined}
        >
          <Download
            size={20}
            className="min-w-[20px] transition-colors group-hover:text-app-primary"
          />
          {!isCollapsed && (
            <span className="ml-3 font-semibold text-sm">Экспорт</span>
          )}
        </button>

        {/* Кнопка Новый проект */}
        <button
          onClick={handleNewProject}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center p-2' : 'p-3'} rounded-xl transition-all group relative text-app-text-main hover:bg-app-bg`}
          onMouseEnter={isCollapsed ? (e) => showTooltip(e, 'Новый проект') : undefined}
          onMouseLeave={isCollapsed ? hideTooltip : undefined}
        >
          <RefreshCw
            size={20}
            className="min-w-[20px] transition-colors group-hover:text-app-primary"
          />
          {!isCollapsed && (
            <span className="ml-3 font-semibold text-sm">Новый</span>
          )}
        </button>

        {/* Кнопка миграции данных (разовая сервисная операция) */}
        <button
          onClick={() => store.customFieldTypes.migrate()}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center p-2' : 'p-3'} rounded-xl transition-all group relative text-orange-500 hover:bg-orange-50`}
          onMouseEnter={isCollapsed ? (e) => showTooltip(e, 'Мигрировать данные') : undefined}
          onMouseLeave={isCollapsed ? hideTooltip : undefined}
          title="Мигрировать старые данные (разово)"
        >
          <DatabaseZap
            size={20}
            className="min-w-[20px] transition-colors group-hover:text-orange-600"
          />
          {!isCollapsed && (
            <span className="ml-3 font-semibold text-sm">Мигрировать</span>
          )}
        </button>
      </div>

      {/* --- Секция Footer (Версия) --- */}
      {!isCollapsed && (
        <div className="p-4 border-t border-app-border">
          <p className="text-[10px] text-app-text-muted text-center uppercase tracking-widest font-bold">
            v 0.1.0 Alpha
          </p>
        </div>
      )}

    </aside>
  );

  const sidebarWidth = isCollapsed ? '4rem' : '12rem';

  const portal = ReactDOM.createPortal(
    <>
      {/* Backdrop — только правее сайдбара, не накрывает его */}
      <div
        onClick={() => setTimelinePopupOpen(false)}
        style={{ left: sidebarWidth }}
        className={`fixed top-0 bottom-0 right-0 z-40 transition-opacity duration-200 ${
          timelinePopupOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Timeline Drawer */}
      <div
        style={{ left: sidebarWidth }}
        className={`fixed top-0 h-screen w-56 bg-app-surface border-r border-app-border z-50 flex flex-col shadow-xl transition-all duration-200 ease-out ${
          timelinePopupOpen && !isDrawerCollapsed
            ? 'opacity-100 translate-x-0 pointer-events-auto'
            : 'opacity-0 -translate-x-3 pointer-events-none'
        }`}
      >
        {/* Заголовок drawer */}
        <div className="h-16 flex items-center justify-between px-3 border-b border-app-border flex-shrink-0">
          {!isDrawerCollapsed && (
            <span className="font-bold text-app-text-head text-base">Мои Timeline</span>
          )}
          <button
            onClick={() => setIsDrawerCollapsed(prev => !prev)}
            className={`p-1.5 hover:bg-app-bg rounded-lg text-app-text-muted transition-colors ${isDrawerCollapsed ? 'mx-auto' : ''}`}
            aria-label={isDrawerCollapsed ? 'Развернуть' : 'Свернуть'}
          >
            {isDrawerCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* Список конфигураций */}
        {!isDrawerCollapsed && (
          <div className="flex-1 overflow-y-auto py-2">
            {store.appData.timelineConfigs.map(cfg => (
              <div key={cfg.id}>
                {renamingId === cfg.id ? (
                  <div className={`w-full px-2 py-1.5 ${activeTimelineId === cfg.id ? 'bg-app-primary/10' : ''}`}>
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onBlur={() => commitRename(cfg.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); commitRename(cfg.id); }
                        if (e.key === 'Escape') { setRenamingId(null); }
                      }}
                      className="w-full text-sm font-medium bg-app-bg border border-app-primary rounded px-1 py-0.5 text-app-text-main outline-none focus:ring-1 focus:ring-app-primary"
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      if (clickTimerRef.current) return;
                      clickTimerRef.current = setTimeout(() => {
                        clickTimerRef.current = null;
                        onTimelineSelect(cfg.id);
                      }, 220);
                    }}
                    onDoubleClick={() => {
                      if (clickTimerRef.current) {
                        clearTimeout(clickTimerRef.current);
                        clickTimerRef.current = null;
                      }
                      handleRenameConfig(cfg.id);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({ x: e.clientX, y: e.clientY, cfgId: cfg.id });
                    }}
                    className={`w-full text-left px-2 py-2 text-sm font-medium transition-colors ${
                      activeTimelineId === cfg.id
                        ? 'text-app-primary bg-app-primary/10'
                        : 'text-app-text-main hover:bg-app-bg'
                    }`}
                  >
                    {cfg.name}
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => {
                const newCfg = store.timelines.addConfig('Новая Timeline');
                onTimelineSelect(newCfg.id);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-app-text-main hover:text-app-primary transition-colors sticky bottom-0 bg-app-surface"
            >
              +
              Добавить Timeline
            </button>
          </div>
        )}
      </div>
      {/* Dashboard Backdrop */}
      <div
        onClick={() => setDashboardPopupOpen(false)}
        style={{ left: sidebarWidth }}
        className={`fixed top-0 bottom-0 right-0 z-40 transition-opacity duration-200 ${
          dashboardPopupOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Dashboard Drawer */}
      <div
        style={{ left: sidebarWidth }}
        className={`fixed top-0 h-screen w-56 bg-app-surface border-r border-app-border z-50 flex flex-col shadow-xl transition-all duration-200 ease-out ${
          dashboardPopupOpen && !isDashboardDrawerCollapsed
            ? 'opacity-100 translate-x-0 pointer-events-auto'
            : 'opacity-0 -translate-x-3 pointer-events-none'
        }`}
      >
        <div className="h-16 flex items-center justify-between px-3 border-b border-app-border flex-shrink-0">
          {!isDashboardDrawerCollapsed && (
            <span className="font-bold text-app-text-head text-base">Мои дашборды</span>
          )}
          <button
            onClick={() => setIsDashboardDrawerCollapsed(prev => !prev)}
            className={`p-1.5 hover:bg-app-bg rounded-lg text-app-text-muted transition-colors ${isDashboardDrawerCollapsed ? 'mx-auto' : ''}`}
          >
            {isDashboardDrawerCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {!isDashboardDrawerCollapsed && (
          <div className="flex-1 overflow-y-auto py-2">
            {(store.appData.dashboards ?? []).map(d => (
              <div key={d.id}>
                {dashboardRenamingId === d.id ? (
                  <div className={`w-full px-2 py-1.5 ${activeDashboardId === d.id ? 'bg-app-primary/10' : ''}`}>
                    <input
                      autoFocus
                      value={dashboardRenameValue}
                      onChange={e => setDashboardRenameValue(e.target.value)}
                      onBlur={() => commitDashboardRename(d.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); commitDashboardRename(d.id); }
                        if (e.key === 'Escape') setDashboardRenamingId(null);
                      }}
                      className="w-full text-sm font-medium bg-app-bg border border-app-primary rounded px-1 py-0.5 text-app-text-main outline-none focus:ring-1 focus:ring-app-primary"
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      onDashboardSelect(d.id);
                      onPageChange('resources');
                    }}
                    onDoubleClick={() => {
                      setDashboardRenameValue(d.name);
                      setDashboardRenamingId(d.id);
                    }}
                    onContextMenu={e => {
                      e.preventDefault();
                      setDashboardContextMenu({ x: e.clientX, y: e.clientY, id: d.id });
                    }}
                    className={`w-full text-left px-3 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
                      activeDashboardId === d.id
                        ? 'text-app-primary bg-app-primary/10'
                        : 'text-app-text-main hover:bg-app-bg'
                    }`}
                  >
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-app-bg border border-app-border text-app-text-muted uppercase font-bold flex-shrink-0">
                      {d.type === 'treemap' ? 'TM' : 'WL'}
                    </span>
                    <span className="truncate">{d.name}</span>
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => {
                onPageChange('resources');
                onDashboardCreate();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-app-text-main hover:text-app-primary transition-colors sticky bottom-0 bg-app-surface"
            >
              + Добавить дашборд
            </button>
          </div>
        )}
      </div>

      {/* Dashboard Context Menu */}
      {dashboardContextMenu && (
        <div
          onMouseDown={e => e.stopPropagation()}
          style={{ top: dashboardContextMenu.y, left: dashboardContextMenu.x }}
          className="fixed z-[200] bg-app-surface border border-app-border rounded-xl shadow-2xl py-1 min-w-[160px]"
        >
          <button
            onClick={() => {
              const d = (store.appData.dashboards ?? []).find(x => x.id === dashboardContextMenu.id);
              if (d) { setDashboardRenameValue(d.name); setDashboardRenamingId(d.id); }
              setDashboardContextMenu(null);
            }}
            className="w-full text-left flex items-center gap-2 px-4 py-2 text-xs font-semibold text-app-text-main hover:bg-app-bg transition-colors"
          >
            <SquarePen size={12} />
            Переименовать
          </button>
          <div className="border-t border-app-border my-1" />
          <button
            onClick={() => {
              setConfirmDeleteDashboardId(dashboardContextMenu.id);
              setDashboardContextMenu(null);
            }}
            className="w-full text-left flex items-center gap-2 px-4 py-2 text-xs font-semibold text-app-error hover:bg-app-error/10 transition-colors"
          >
            <Trash2 size={12} />
            Удалить
          </button>
        </div>
      )}

      {/* Контекстное меню */}
      {contextMenu && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-[200] bg-app-surface border border-app-border rounded-xl shadow-2xl py-1 min-w-[160px]"
        >
          <button
            onClick={() => handleRenameConfig(contextMenu.cfgId)}
            className="w-full text-left flex items-center gap-2 px-4 py-2 text-xs font-semibold text-app-text-main hover:bg-app-bg transition-colors"
          >
            <SquarePen size={12} />
            Переименовать
          </button>
          <button
            onClick={() => handleDuplicateConfig(contextMenu.cfgId)}
            className="w-full text-left flex items-center gap-2 px-4 py-2 text-xs font-semibold text-app-text-main hover:bg-app-bg transition-colors"
          >
            <Copy size={12} />
            Копировать
          </button>
          <div className="border-t border-app-border my-1" />
          <button
            onClick={() => handleDeleteConfig(contextMenu.cfgId)}
            className="w-full text-left flex items-center gap-2 px-4 py-2 text-xs font-semibold text-app-error hover:bg-app-error/10 transition-colors"
          >
            <Trash2 size={12} />
            Удалить
          </button>
        </div>
      )}
    </>,
    document.body
  );

  const tooltipPortal = tooltip && ReactDOM.createPortal(
    <div
      style={{ position: 'fixed', left: tooltip.x, top: tooltip.y, transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 9999 }}
      className="px-3 py-2 bg-app-text-head text-white text-[11px] font-bold leading-tight rounded-lg shadow-xl whitespace-nowrap"
    >
      {tooltip.label}
    </div>,
    document.body
  );

  const deleteTimelineName = confirmDeleteId
    ? store.appData.timelineConfigs.find(c => c.id === confirmDeleteId)?.name
    : undefined;

  return (
    <>
      {aside}
      {portal}
      {tooltipPortal}
      {confirmDeleteId && (
        <ConfirmDialog
          title={`Удалить Timeline «${deleteTimelineName}»?`}
          message="Это действие нельзя отменить. Все параметры и настройки будут удалены."
          confirmLabel="Удалить"
          confirmVariant="danger"
          onConfirm={confirmDelete}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
      {importAlert && (
        <ConfirmDialog
          title="Импорт данных"
          message={importAlert.message}
          confirmLabel="OK"
          confirmVariant="primary"
          onConfirm={importAlert.onClose}
        />
      )}
      {confirmNewProject && (
        <ConfirmDialog
          title="Создать новый проект"
          message="Все текущие данные будут удалены. Хотите сохранить резервную копию перед сбросом?"
          confirmLabel="Сохранить и сбросить"
          confirmVariant="primary"
          secondaryLabel="Сбросить без сохранения"
          onSecondary={() => {
            setConfirmNewProject(false);
            store.reset();
            if (!getElectronAPI()) window.location.reload();
          }}
          onConfirm={() => {
            setConfirmNewProject(false);
            void (async () => {
              const saved = await store.export();
              if (saved) {
                store.reset();
                if (!getElectronAPI()) window.location.reload();
              }
            })();
          }}
          onCancel={() => setConfirmNewProject(false)}
        />
      )}
      {confirmImport && (
        <ConfirmDialog
          title="Импорт данных"
          message="Текущие данные будут заменены. Хотите сохранить резервную копию перед импортом?"
          confirmLabel="Сохранить и импортировать"
          confirmVariant="primary"
          secondaryLabel="Импортировать без сохранения"
          onSecondary={() => {
            setConfirmImport(false);
            openFilePicker();
          }}
          onConfirm={() => {
            setConfirmImport(false);
            void (async () => {
              const saved = await store.export();
              if (saved) openFilePicker();
            })();
          }}
          onCancel={() => setConfirmImport(false)}
        />
      )}
      {confirmDeleteDashboardId && (
        <ConfirmDialog
          title={`Удалить дашборд «${(store.appData.dashboards ?? []).find(d => d.id === confirmDeleteDashboardId)?.name}»?`}
          message="Это действие нельзя отменить."
          confirmLabel="Удалить"
          confirmVariant="danger"
          onConfirm={confirmDeleteDashboard}
          onCancel={() => setConfirmDeleteDashboardId(null)}
        />
      )}
      {confirmClose && (
        <ConfirmDialog
          title="Закрыть приложение"
          message="Данные текущей сессии не сохраняются автоматически. Хотите экспортировать резервную копию перед выходом?"
          confirmLabel="Сохранить и закрыть"
          confirmVariant="primary"
          secondaryLabel="Закрыть без сохранения"
          onSecondary={() => {
            setConfirmClose(false);
            getElectronAPI()?.closeConfirmed();
          }}
          onConfirm={() => {
            setConfirmClose(false);
            void (async () => {
              const saved = await store.export();
              if (saved) getElectronAPI()?.closeConfirmed();
              else setConfirmClose(false); // export cancelled, keep app open
            })();
          }}
          onCancel={() => setConfirmClose(false)}
        />
      )}
    </>
  );
};