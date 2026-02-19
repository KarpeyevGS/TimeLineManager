import React from 'react';

export const ResourcesPage: React.FC = () => {
  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-app-bg">
      {/* STICKY HEADER согласно стандартам TATO */}
      <header className="px-6 py-4 bg-app-surface border-b border-app-border z-50 flex-shrink-0 flex justify-between items-center">
        <h1 className="text-xl font-bold text-app-text-head">Ресурсы</h1>
      </header>

      {/* Основная область контента */}
      <main className="flex-1 overflow-hidden flex flex-col items-center justify-center text-app-text-muted">
        <div className="text-center">
          <h2 className="text-2xl font-bold uppercase tracking-widest opacity-20 mb-2">Resources Page</h2>
          <p className="text-sm">Контент страницы ресурсов будет добавлен позже</p>
        </div>
      </main>
    </div>
  );
};
