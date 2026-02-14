import { useState } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { TimelinePage } from './pages/Timeline/TimelinePage';
import { TasksPage } from './pages/Tasks/TasksPage';
import { ResourcesPage } from './pages/Resources/ResourcesPage';

// 2. Главный компонент приложения
function App() {
  const [activePage, setActivePage] = useState('tasks');
 
  // Функция для отрисовки активной страницы
  const renderPage = () => {
    switch (activePage) {
      case 'tasks':
        return <TasksPage />;
      case 'timeline':
        return <TimelinePage />;
      case 'resources':
        return <ResourcesPage />;
      default:
        return <TasksPage />;
    }
  };

  // 4. Описываем структуру интерфейса
  return (
    // Главный контейнер на весь экран (flex-row)
    <div className="flex h-screen w-screen bg-app-surface font-sans overflow-hidden">
      
      {/* 1. Боковое меню */}
      <Sidebar activePage={activePage} onPageChange={setActivePage} />

      {/* 2. Основная контентная область */}
      <main className="flex-1 relative overflow-hidden">
        {renderPage()}
      </main>
    </div>
  );
}

// 11. Экспорт компонента
export default App