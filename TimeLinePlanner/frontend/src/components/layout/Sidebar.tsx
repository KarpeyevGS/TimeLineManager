import React, { useState } from 'react';
// Импорт иконок из библиотеки Lucide (LucideIcon — тип для компонентов иконок)
import { 
  ListTodo, 
  GanttChart, 
  Users, 
  ChevronLeft, 
  ChevronRight, 
  CalendarRange,
  LucideIcon 
} from 'lucide-react';

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

// Типизация компонента как React.FC (Functional Component)
export const Sidebar: React.FC = () => {
  // Состояние для управления шириной панели 
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  // Состояние для отслеживания выбранного в данный момент пункта
  const [activeId, setActiveId] = useState<string>('tasks');

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
          const isActive = activeId === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => setActiveId(item.id)} // Установка активного ID по клику
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