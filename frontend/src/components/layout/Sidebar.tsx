import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
// Импорт иконок из библиотеки Lucide (LucideIcon — тип для компонентов иконок)
import {
  ListTodo,
  GanttChart,
  Users,
  ChevronLeft,
  ChevronRight,
  CalendarRange,
  Download,
  Upload,
  RefreshCw,
  SquarePen,
  Copy,
  Trash2,
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
  { icon: Users, label: 'Resources', id: 'resources' },
];

// Типизация пропсов для Sidebar
interface SidebarProps {
  activePage: string;
  onPageChange: (id: string) => void;
  activeTimelineId?: string;
  onTimelineSelect: (id: string) => void;
}

// Типизация компонента как React.FC (Functional Component)
export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onPageChange,
  activeTimelineId,
  onTimelineSelect,
}) => {
  // Состояние для управления шириной панели
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [timelinePopupOpen, setTimelinePopupOpen] = useState(false);
  const [isDrawerCollapsed, setIsDrawerCollapsed] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; cfgId: string } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const store = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [contextMenu]);

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
    const confirmed = window.confirm('Удалить Timeline?');
    if (!confirmed) { setContextMenu(null); return; }
    const remaining = store.appData.timelineConfigs.filter(c => c.id !== cfgId);
    store.timelines.deleteConfig(cfgId);
    if (activeTimelineId === cfgId) {
      onTimelineSelect(remaining.length > 0 ? remaining[0].id : '');
    }
    setContextMenu(null);
  };

  // Функция экспорта данных
  const handleExport = () => {
    const jsonData = store.export();
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `timeline-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Функция создания нового проекта
  const handleNewProject = () => {
    const wantSave = window.confirm('Сохранить текущий проект?');
    if (wantSave) {
      const confirmed = window.confirm('Вы точно уверены?');
      if (!confirmed) return;
      handleExport();
      store.reset();
      window.location.reload();
    } else {
      store.reset();
      window.location.reload();
    }
  };

  // Функция импорта данных
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const success = store.import(content);
        if (success) {
          alert('✅ Данные успешно импортированы! Страница перезагрузится.');
          window.location.reload();
        } else {
          alert('❌ Ошибка: некорректный формат файла');
        }
      } catch (error) {
        alert('❌ Ошибка при импорте: ' + (error instanceof Error ? error.message : 'неизвестная ошибка'));
      }
    };
    reader.readAsText(file);
    event.target.value = '';
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
                } else {
                  setTimelinePopupOpen(false);
                  onPageChange(item.id);
                }
              }}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center p-2' : 'p-3'} rounded-xl transition-all group relative ${
                isActive
                  ? 'bg-app-primary/10 text-app-primary'
                  : 'text-app-text-main hover:bg-app-bg'
              }`}
              title={isCollapsed ? item.label : ''}
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
              {isCollapsed && (
                <div className="absolute left-full ml-4 px-2 py-1 bg-app-text-head text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                  {item.label}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* --- Секция Data Import/Export (видна всегда) --- */}
      <div className="p-3 space-y-2 border-t border-app-border">
        {/* Кнопка Импорт */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center p-2' : 'p-3'} rounded-xl transition-all group relative text-app-text-main hover:bg-app-bg`}
          title={isCollapsed ? 'Импорт' : ''}
        >
          <Upload
            size={20}
            className="min-w-[20px] transition-colors group-hover:text-app-primary"
          />
          {!isCollapsed && (
            <span className="ml-3 font-semibold text-sm">Импорт</span>
          )}

          {/* Кастомный Tooltip в свернутом виде */}
          {isCollapsed && (
            <div className="absolute left-full ml-4 px-2 py-1 bg-app-text-head text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
              Импорт
            </div>
          )}
        </button>

        {/* Скрытый input для выбора файла */}
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
          title={isCollapsed ? 'Экспорт' : ''}
        >
          <Download
            size={20}
            className="min-w-[20px] transition-colors group-hover:text-app-primary"
          />
          {!isCollapsed && (
            <span className="ml-3 font-semibold text-sm">Экспорт</span>
          )}

          {/* Кастомный Tooltip в свернутом виде */}
          {isCollapsed && (
            <div className="absolute left-full ml-4 px-2 py-1 bg-app-text-head text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
              Экспорт
            </div>
          )}
        </button>

        {/* Кнопка Новый проект */}
        <button
          onClick={handleNewProject}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center p-2' : 'p-3'} rounded-xl transition-all group relative text-app-text-main hover:bg-app-bg`}
          title={isCollapsed ? 'Новый проект' : ''}
        >
          <RefreshCw
            size={20}
            className="min-w-[20px] transition-colors group-hover:text-app-primary"
          />
          {!isCollapsed && (
            <span className="ml-3 font-semibold text-sm">Новый</span>
          )}

          {/* Кастомный Tooltip в свернутом виде */}
          {isCollapsed && (
            <div className="absolute left-full ml-4 px-2 py-1 bg-app-text-head text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
              Новый проект
            </div>
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
                      setTimelinePopupOpen(false);
                      onTimelineSelect(cfg.id);
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
                setTimelinePopupOpen(false);
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

  return <>{aside}{portal}</>;
};