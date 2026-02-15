import React from 'react';
import { ChevronDown, ChevronRight, Pin } from 'lucide-react';

interface Parameter {
  id: number;
  name: string;
  parentId: number | null;
  level: number;
  children?: Parameter[];
}

interface ParameterRowProps {
  parameter: Parameter;
  isExpanded: boolean;
  isFrozen: boolean;
  onToggleExpand: (id: number) => void;
  onToggleFreeze: (id: number) => void;
  showContextMenu: (e: React.MouseEvent, id: number) => void;
}

export const ParameterRow: React.FC<ParameterRowProps> = ({
  parameter,
  isExpanded,
  isFrozen,
  onToggleExpand,
  onToggleFreeze,
  showContextMenu,
}) => {
  const hasChildren = parameter.children && parameter.children.length > 0;
  const paddingLeft = parameter.level * 16;

  return (
    <div
      className="h-[28px] min-h-[28px] py-0 pr-1 shadow-[0_1px_0_0_var(--color-app-border)] flex items-center text-xs font-semibold text-app-text-main hover:bg-app-bg/10 group relative select-none"
      style={{ paddingLeft: `${paddingLeft + 4}px` }}
      onContextMenu={(e) => showContextMenu(e, parameter.id)}
    >
      {/* Expand/Collapse иконка */}
      {hasChildren && (
        <button
          onClick={() => onToggleExpand(parameter.id)}
          className="p-0.5 hover:bg-app-primary/20 rounded transition-colors flex-shrink-0 mr-1"
          title={isExpanded ? 'Свернуть' : 'Развернуть'}
        >
          {isExpanded ? (
            <ChevronDown size={16} className="text-app-primary" />
          ) : (
            <ChevronRight size={16} className="text-app-text-muted" />
          )}
        </button>
      )}

      {/* Пустое место, если нет иконки expand */}
      {!hasChildren && <div className="w-6 flex-shrink-0" />}

      {/* Название параметра */}
      <span className="flex-1 truncate">{parameter.name}</span>

      {/* Иконка булавки - видна при hover */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFreeze(parameter.id);
        }}
        className={`p-1 rounded transition-colors flex-shrink-0 ${
          isFrozen
            ? 'bg-app-primary/20 text-app-primary opacity-100'
            : 'opacity-0 group-hover:opacity-100 text-app-text-muted hover:text-app-primary hover:bg-app-primary/10'
        }`}
        title={isFrozen ? 'Открепить (ПКМ)' : 'Закрепить (ПКМ)'}
      >
        <Pin size={14} />
      </button>
    </div>
  );
};
