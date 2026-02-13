// ... существующий код ...
// 1. Импорт хука для управления состоянием
import { Sidebar } from './components/layout/Sidebar';
import { TimelinePage } from './pages/Timeline/TimelinePage';

// 2. Главный компонент приложения
function App() {
 
  // 4. Описываем структуру интерфейса
  return (
    // Главный контейнер на весь экран (flex-row)
    <div className="flex h-screen w-screen bg-app-surface font-sans overflow-hidden">
      
      {/* 1. Боковое меню */}
      <Sidebar />

      {/* 2. Основная контентная область */}
      <main className="flex-1 relative overflow-hidden">
        <TimelinePage />
      </main>
    </div>
  );
}

// 11. Экспорт компонента
export default App