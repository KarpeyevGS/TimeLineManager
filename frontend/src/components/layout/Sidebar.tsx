import React, { useState, useRef } from 'react';
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
}

// Типизация компонента как React.FC (Functional Component)
export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onPageChange
}) => {
  // Состояние для управления шириной панели
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const store = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  return (
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
          // Вычисляем, является ли данный пункт активным прямо при рендере
          const isActive = activePage === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)} // Установка активного ID через пропс
              // Условные стили: подсветка фона и текста для активного состояния
              className={`w-full flex items-center ${isCollapsed ? 'justify-center p-2' : 'p-3'} rounded-xl transition-all group relative ${
                isActive 
                  ? 'bg-app-primary/10 text-app-primary' 
                  : 'text-app-text-main hover:bg-app-bg'
              }`}
              title={isCollapsed ? item.label : ''} // Нативная подсказка при сворачивании
            >
              {/* Рендеринг иконки (динамический цвет при активности или наведении) */}
              <item.icon 
                size={24} 
                className={`min-w-[24px] transition-colors ${
                  isActive ? 'text-app-primary' : 'group-hover:text-app-primary'
                }`} 
              />
              {/* Текст отображается только в развернутом виде */}
              {!isCollapsed && (
                <span className="ml-3 font-semibold text-sm">{item.label}</span>
              )}
              
              {/* Кастомный Tooltip: появляется только в свернутом виде при hover */}
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
};