import React from 'react';
import { Globe } from 'lucide-react';
import type { Task } from '../../store';

interface TaskBarProps {
  task: Task;
  position: { left: number; width: number };
  topOffset: number;
  isDragging: boolean;
  isResizing: boolean;
  isEditing: boolean;
  editingTaskName: string;
  getTaskBarColor: (task: Task) => string;
  getTaskBarStyle: (task: Task) => React.CSSProperties;
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>, task: Task) => void;
  onDoubleClick: (e: React.MouseEvent<HTMLDivElement>, task: Task) => void;
  onContextMenu: (e: React.MouseEvent<HTMLDivElement>, task: Task) => void;
  onMouseEnter: (e: React.MouseEvent<HTMLDivElement>, task: Task) => void;
  onMouseLeave: () => void;
  onResizeMouseDown: (e: React.MouseEvent<HTMLDivElement>, task: Task, side: 'left' | 'right') => void;
  onEditingNameChange: (name: string) => void;
  onEditingConfirm: (task: Task) => void;
  onEditingCancel: () => void;
}

export const TaskBar: React.FC<TaskBarProps> = ({
  task,
  position,
  topOffset,
  isDragging,
  isResizing,
  isEditing,
  editingTaskName,
  getTaskBarColor,
  getTaskBarStyle,
  onMouseDown,
  onDoubleClick,
  onContextMenu,
  onMouseEnter,
  onMouseLeave,
  onResizeMouseDown,
  onEditingNameChange,
  onEditingConfirm,
  onEditingCancel,
}) => {
  if (task.milestone) {
    const cx = position.left + position.width / 2;
    const size = 14;
    return (
      <div
        key={task.id}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => onMouseDown(e, task)}
        onContextMenu={(e) => onContextMenu(e, task)}
        onMouseEnter={(e) => onMouseEnter(e, task)}
        onMouseLeave={onMouseLeave}
        className={`absolute flex items-center select-none transition-all ${isDragging ? 'opacity-75 cursor-grabbing' : 'cursor-grab hover:opacity-80'}`}
        style={{
          left: `${cx - size / 2}px`,
          top: `${topOffset}px`,
          height: '20px',
        }}
      >
        <div
          style={{
            width: `${size}px`,
            height: `${size}px`,
            flexShrink: 0,
            backgroundColor: '#1a1a1a',
            transform: 'rotate(45deg)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
          }}
        />
        <span className="ml-2 text-[10px] font-medium text-app-text-head whitespace-nowrap">
          {task.name}
        </span>
      </div>
    );
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => onMouseDown(e, task)}
      onDoubleClick={(e) => onDoubleClick(e, task)}
      onContextMenu={(e) => onContextMenu(e, task)}
      onMouseEnter={(e) => onMouseEnter(e, task)}
      onMouseLeave={onMouseLeave}
      className={`absolute h-[20px] rounded-sm shadow-md text-[10px] flex items-center font-medium transition-all select-none overflow-hidden ${getTaskBarColor(task)} ${
        isEditing ? 'cursor-text' :
        isDragging ? 'shadow-2xl opacity-75 scale-105 cursor-grabbing' :
        isResizing ? 'shadow-2xl opacity-75 cursor-ew-resize' :
        'hover:shadow-lg cursor-grab'
      }`}
      style={{
        left: `${position.left}px`,
        width: `${position.width}px`,
        top: `${topOffset}px`,
        ...getTaskBarStyle(task),
      }}
    >
      <div
        className="absolute left-0 top-0 h-full w-[5px] z-10 cursor-ew-resize hover:bg-white/30"
        onMouseDown={(e) => onResizeMouseDown(e, task, 'left')}
      />
      {isEditing ? (
        <input
          autoFocus
          type="text"
          value={editingTaskName}
          onChange={(e) => onEditingNameChange(e.target.value)}
          onBlur={() => onEditingConfirm(task)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); onEditingConfirm(task); }
            if (e.key === 'Escape') { e.preventDefault(); onEditingCancel(); }
            e.stopPropagation();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="px-2 flex-1 min-w-0 h-full bg-transparent outline-none text-[10px] font-medium"
        />
      ) : (
        <span className="px-2 truncate flex-1 min-w-0">{task.name}</span>
      )}
      {task.link && (
        <a
          href={task.link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex-shrink-0 mr-2 opacity-70 hover:opacity-100 transition-opacity"
        >
          <Globe size={10} />
        </a>
      )}
      <div
        className="absolute right-0 top-0 h-full w-[5px] z-10 cursor-ew-resize hover:bg-white/30"
        onMouseDown={(e) => onResizeMouseDown(e, task, 'right')}
      />
    </div>
  );
};
