import React from 'react';
import { Globe } from 'lucide-react';
import type { Task } from '../../store';
import { isValidHttpsUrl } from '../../utils/validateUrl';

interface TaskBarProps {
  task: Task;
  position: { left: number; width: number };
  topOffset: number;
  barHeight?: number;
  isDragging: boolean;
  isResizing: boolean;
  isEditing: boolean;
  isSelected: boolean;
  isOverloaded: boolean;
  editingTaskName: string;
  getTaskBarColor: (task: Task) => string;
  getTaskBarStyle: (task: Task) => React.CSSProperties;
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>, task: Task) => void;
  onClick: (e: React.MouseEvent<HTMLDivElement>, task: Task) => void;
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
  barHeight = 20,
  isDragging,
  isResizing,
  isEditing,
  isSelected,
  isOverloaded,
  editingTaskName,
  getTaskBarColor,
  getTaskBarStyle,
  onMouseDown,
  onClick,
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
        onClick={(e) => onClick(e, task)}
        onMouseDown={(e) => onMouseDown(e, task)}
        onDoubleClick={(e) => onDoubleClick(e, task)}
        onContextMenu={(e) => onContextMenu(e, task)}
        onMouseEnter={(e) => onMouseEnter(e, task)}
        onMouseLeave={onMouseLeave}
        className={`absolute flex items-center select-none transition-all duration-150 ${
          isDragging ? 'opacity-75 cursor-grabbing' : 'cursor-grab hover:opacity-80'
        }`}
        style={{
          left: `${cx - size / 2}px`,
          top: `${topOffset}px`,
          height: `${barHeight}px`,
        }}
      >
        <div
          style={{
            width: `${size}px`,
            height: `${size}px`,
            flexShrink: 0,
            backgroundColor: isSelected ? '#4f80f0' : '#1a1a1a',
            transform: 'rotate(45deg)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
            transition: 'background-color 0.15s',
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
      onClick={(e) => onClick(e, task)}
      onMouseDown={(e) => onMouseDown(e, task)}
      onDoubleClick={(e) => onDoubleClick(e, task)}
      onContextMenu={(e) => onContextMenu(e, task)}
      onMouseEnter={(e) => onMouseEnter(e, task)}
      onMouseLeave={onMouseLeave}
      className={`absolute rounded-sm shadow-md text-[10px] flex items-center font-medium select-none overflow-hidden transition-all duration-150 ${getTaskBarColor(task)} ${
        isEditing ? 'cursor-text' :
        isDragging ? 'shadow-2xl opacity-75 scale-105 cursor-grabbing' :
        isResizing ? 'shadow-2xl opacity-75 cursor-ew-resize' :
        'hover:shadow-lg cursor-grab'
      }`}
      style={{
        left: `${position.left}px`,
        width: `${position.width}px`,
        top: `${topOffset}px`,
        height: `${barHeight}px`,
        ...getTaskBarStyle(task),
        ...(isOverloaded ? { backgroundColor: '#ef4444', outline: '2px solid #b91c1c', color: '#ffffff' } : {}),
        boxShadow: isSelected ? '0 0 0 1px rgba(120,180,160,0.75), 0 0 10px 3px rgba(100,160,140,0.3), 0 0 22px 6px rgba(100,160,140,0.12)' : undefined,
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
      {task.link && isValidHttpsUrl(task.link) && (
        <a
          href={task.link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="flex-shrink-0 flex items-center justify-center w-5 h-full mr-1 opacity-70 hover:opacity-100 transition-opacity"
        >
          <Globe size={11} />
        </a>
      )}
      <div
        className="absolute right-0 top-0 h-full w-[5px] z-10 cursor-ew-resize hover:bg-white/30"
        onMouseDown={(e) => onResizeMouseDown(e, task, 'right')}
      />
    </div>
  );
};
