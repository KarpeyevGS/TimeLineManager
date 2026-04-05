import { useState, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { TimelinePage } from './pages/Timeline/TimelinePage';
import { TasksPage } from './pages/Tasks/TasksPage';
import { ResourcesPage } from './pages/Resources/ResourcesPage';
import { undoAppData } from './store';
import { isElectron } from './electronApi';

// 2. Главный компонент приложения
function App() {
  console.log('🚀 App component rendering');
  const [activePage, setActivePage] = useState('tasks');
  const [activeTimelineId, setActiveTimelineId] = useState<string | undefined>(undefined);
  const [timelineParameterModalOpen, setTimelineParameterModalOpen] = useState(false);
  const [activeDashboardId, setActiveDashboardId] = useState<string | undefined>(undefined);
  const [dashboardModalOpen, setDashboardModalOpen] = useState(false);
  console.log('📄 Current page:', activePage);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        const target = e.target as HTMLElement;
        // Не перехватываем Ctrl+Z внутри текстовых полей
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
        e.preventDefault();
        undoAppData();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isElectron()) return;
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      window.electronAPI!.zoomDelta(delta);
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  // Функция для отрисовки активной страницы
  const renderPage = () => {
    switch (activePage) {
      case 'tasks':
        return <TasksPage />;
      case 'timeline':
        return <TimelinePage
          activeTimelineId={activeTimelineId}
          timelineParameterModalOpen={timelineParameterModalOpen}
          onTimelineParameterModalChange={setTimelineParameterModalOpen}
        />;
      case 'resources':
        return (
          <ResourcesPage
            activeDashboardId={activeDashboardId}
            createModalOpen={dashboardModalOpen}
            onCreateModalClose={() => setDashboardModalOpen(false)}
            onDashboardCreated={(id) => setActiveDashboardId(id)}
          />
        );
      default:
        return <TasksPage />;
    }
  };

  // 4. Описываем структуру интерфейса
  return (
    // Главный контейнер на весь экран (flex-row)
    <div className="flex h-screen w-screen bg-app-surface font-sans overflow-hidden">

      {/* 1. Боковое меню */}
      <Sidebar
        activePage={activePage}
        onPageChange={setActivePage}
        activeTimelineId={activeTimelineId}
        onTimelineSelect={(id) => { setActiveTimelineId(id); setActivePage('timeline'); }}
        activeDashboardId={activeDashboardId}
        onDashboardSelect={(id) => { setActiveDashboardId(id); setActivePage('resources'); }}
        onDashboardCreate={() => { setActivePage('resources'); setDashboardModalOpen(true); }}
      />

      {/* 2. Основная контентная область */}
      <main className="flex-1 relative overflow-hidden">
        {renderPage()}
      </main>
    </div>
  );
}

// 11. Экспорт компонента
export default App