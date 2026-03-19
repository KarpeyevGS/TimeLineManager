import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { eachDayOfInterval, isWeekend } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { X, ChevronRight, ChevronDown, Plus, Minus, GripVertical, Trash2 } from 'lucide-react';
import {
  DndContext, closestCenter, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { DateRangePicker } from '../../components/ui/DateRangePicker';
import { Autocomplete } from '../../components/ui/Autocomplete';
import type { Task } from '../../store';
import { isValidHttpsUrl } from '../../utils/validateUrl';

interface CustomFieldTypeDef {
  id: string;
  name: string;
}

interface TaskModalProps {
  mode: 'add' | 'edit';
  task?: Task;
  paramId?: string;
  initialDate?: Date;
  hasEmptyFilters?: boolean;
  initialFilters?: Record<string, string[]>;  // ← предзаполнение customFields из фильтров строки
  customFieldOptions?: Record<string, string[]>;  // ← варианты автодополнения: fieldTypeId → []string
  ganttMode?: boolean;
  customFieldTypes: CustomFieldTypeDef[];
  onAddCustomFieldType: (name: string) => CustomFieldTypeDef;
  onDeleteCustomFieldType?: (id: string) => void;
  onRenameCustomFieldType?: (id: string, name: string) => void;
  onReorderCustomFieldTypes?: (orderedIds: string[]) => void;
  onSave: (data: Omit<Task, 'id'> & { id?: string }) => void;
  onDelete?: () => void;
  onEditParameter?: (pendingTask: Omit<Task, 'id'> & { id?: string }) => void;
  onClose: () => void;
}

// Sortable row для одного типа кастомного поля
interface SortableFieldRowProps {
  id: string;
  name: string;
  values: string[];
  options: string[];
  isEditing: boolean;
  editingName: string;
  inputCls: () => string;
  labelCls: string;
  onStartRename: () => void;
  onEditNameChange: (v: string) => void;
  onConfirmRename: () => void;
  onCancelRename: () => void;
  onAddValue: () => void;
  onDeleteType: () => void;
  onChangeValue: (idx: number, val: string) => void;
  onRemoveValue: (idx: number) => void;
}

const SortableFieldRow: React.FC<SortableFieldRowProps> = ({
  id, name, values, options, isEditing, editingName,
  inputCls, labelCls, onStartRename, onEditNameChange, onConfirmRename,
  onCancelRename, onAddValue, onDeleteType, onChangeValue, onRemoveValue,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="flex flex-col gap-1">
      {/* Header: drag + name + add-value button */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex-shrink-0 cursor-grab text-app-text-muted hover:text-app-primary transition-colors"
          tabIndex={-1}
        >
          <GripVertical size={12} />
        </button>
        {isEditing ? (
          <input
            autoFocus
            value={editingName}
            onChange={e => onEditNameChange(e.target.value)}
            onBlur={onConfirmRename}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); onConfirmRename(); }
              if (e.key === 'Escape') { e.preventDefault(); onCancelRename(); }
              e.stopPropagation();
            }}
            onMouseDown={e => e.stopPropagation()}
            className="flex-1 text-[10px] font-semibold border border-app-primary rounded px-1 h-5 outline-none bg-white"
          />
        ) : (
          <span
            className={`${labelCls} text-[10px] flex-1 cursor-text hover:text-app-primary transition-colors select-none`}
            onClick={onStartRename}
          >
            {name}
          </span>
        )}
        <button
          type="button"
          onClick={onDeleteType}
          className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-app-text-muted hover:text-app-error transition-colors"
          title="Удалить параметр"
        >
          <Trash2 size={10} />
        </button>
        <button
          type="button"
          onClick={onAddValue}
          className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-app-text-muted hover:text-app-primary transition-colors"
          title="Добавить значение"
        >
          <Plus size={10} />
        </button>
      </div>
      {/* Value inputs */}
      {values.map((val, idx) => (
        <div key={idx} className="flex items-center gap-1 pl-4">
          <Autocomplete
            options={options}
            value={val}
            onChange={v => onChangeValue(idx, v)}
            placeholder={`Enter ${name}`}
            inputClassName={inputCls()}
            className="flex-1"
          />
          {values.length > 1 && (
            <button
              type="button"
              onClick={() => onRemoveValue(idx)}
              className="flex-shrink-0 w-5 h-8 flex items-center justify-center text-app-text-muted hover:text-app-error transition-colors"
              title="Удалить значение"
            >
              <Minus size={10} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

export const TaskModal: React.FC<TaskModalProps> = ({
  mode,
  task,
  paramId,
  initialDate,
  hasEmptyFilters,
  initialFilters,
  customFieldOptions,
  ganttMode,
  customFieldTypes,
  onAddCustomFieldType,
  onDeleteCustomFieldType,
  onRenameCustomFieldType,
  onReorderCustomFieldTypes,
  onSave,
  onDelete,
  onEditParameter,
  onClose,
}) => {
  void paramId; // paramId используется в onEditParameter callback
  const initRange: DateRange | undefined = task
    ? { from: task.startDate, to: task.endDate }
    : initialDate
    ? { from: initialDate, to: initialDate }
    : undefined;

  const [name, setName] = useState(task?.name ?? '');
  const [link, setLink] = useState(task?.link ?? '');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(initRange);
  const [priority, setPriority] = useState<'low' | 'medium' | 'blocker'>(task?.priority ?? 'medium');
  const [status, setStatus] = useState<'not_started' | 'in_progress' | 'done'>(task?.status ?? 'not_started');
  const [description, setDescription] = useState(task?.description ?? '');
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string[]>>(() => {
    const source = task?.customFields ?? initialFilters ?? {};
    const result: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(source)) {
      result[k] = Array.isArray(v) ? v : [v as string];
    }
    return result;
  });
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editingTypeName, setEditingTypeName] = useState('');
  const [color, setColor] = useState(task?.color ?? '#B0BEC5');
  const [customFieldsOpen, setCustomFieldsOpen] = useState(
    mode === 'add' && (
      (!!initialFilters && Object.keys(initialFilters).length > 0) ||
      (!!task?.customFields && Object.keys(task.customFields).length > 0)
    )
  );
  const [addingNewType, setAddingNewType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showEmptyFiltersDialog, setShowEmptyFiltersDialog] = useState(false);
  const [showSimpleAddConfirm, setShowSimpleAddConfirm] = useState(false);
  const [fix, setFix] = useState(task?.fix ?? false);
  const [milestone, setMilestone] = useState(task?.milestone ?? false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [pickerPosition, setPickerPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const colorButtonRef = useRef<HTMLButtonElement>(null);
  const [pendingTaskData, setPendingTaskData] = useState<Omit<Task, 'id'> & { id?: string } | null>(null);

  const duration =
    !milestone && dateRange?.from && dateRange?.to
      ? eachDayOfInterval({ start: dateRange.from, end: dateRange.to }).filter(d => !isWeekend(d)).length
      : '';

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Обязательное поле';
    if (!dateRange?.from) errs.dateRange = 'Выберите даты';
    if (link.trim() && !isValidHttpsUrl(link.trim())) errs.link = 'Ссылка должна начинаться с https://';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAddNewType = () => {
    const trimmed = newTypeName.trim();
    if (trimmed && !customFieldTypes.some(t => t.name === trimmed)) {
      onAddCustomFieldType(trimmed);
      setNewTypeName('');
      setAddingNewType(false);
    }
  };

  const handleCustomFieldChange = (id: string, index: number, value: string) => {
    setCustomFieldValues(prev => ({
      ...prev,
      [id]: (prev[id] ?? ['']).map((v, i) => i === index ? value : v),
    }));
  };

  const handleAddFieldValue = (id: string) => {
    setCustomFieldValues(prev => ({
      ...prev,
      [id]: [...(prev[id] ?? []), ''],
    }));
  };

  const handleRemoveFieldValue = (id: string, index: number) => {
    setCustomFieldValues(prev => {
      const next = (prev[id] ?? []).filter((_, i) => i !== index);
      return { ...prev, [id]: next.length > 0 ? next : [''] };
    });
  };

  const handleFieldDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = customFieldTypes.map(t => t.id);
    const oldIdx = ids.indexOf(active.id as string);
    const newIdx = ids.indexOf(over.id as string);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = [...ids];
    reordered.splice(oldIdx, 1);
    reordered.splice(newIdx, 0, active.id as string);
    onReorderCustomFieldTypes?.(reordered);
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const taskData = {
      id: task?.id,
      name: name.trim(),
      startDate: dateRange!.from!,
      endDate: dateRange!.to ?? dateRange!.from!,
      link: link.trim() || undefined,
      priority,
      status,
      description: description.trim() || undefined,
      customFields: (() => {
        const clean: Record<string, string[]> = {};
        for (const [k, vals] of Object.entries(customFieldValues)) {
          const nonEmpty = vals.filter(v => v.trim());
          if (nonEmpty.length > 0) clean[k] = nonEmpty;
        }
        return Object.keys(clean).length > 0 ? clean : undefined;
      })(),
      color,
      fix,
      milestone,
    };

    // Если параметр не имеет фильтров и это режим добавления, показать dialog
    if (hasEmptyFilters && mode === 'add') {
      setPendingTaskData(taskData);
      setShowEmptyFiltersDialog(true);
    } else {
      onSave(taskData);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const inputCls = (field?: string) =>
    `w-full h-8 px-3 text-xs rounded border bg-white text-app-text-head placeholder:text-gray-300 outline-none focus:border-app-primary transition-colors ${
      field && errors[field] ? 'border-app-error' : 'border-app-border'
    }`;

  const labelCls = 'text-[11px] font-semibold text-app-text-head';

  // Палитра цветов (12 насыщенных, не сливаются с Done и Blocker)
  const COLORS = [
    { name: 'Голубой', hex: '#90CAF9' },
    { name: 'Лавандовый', hex: '#D1C4E9' },
    { name: 'Песочный', hex: '#FFE082' },
    { name: 'Персиковый', hex: '#FFCC80' },
    { name: 'Стальной', hex: '#90A4AE' },
    { name: 'Индиго', hex: '#9FA8DA' },
    { name: 'Серо-голубой', hex: '#B0BEC5' },
    { name: 'Бирюзовый', hex: '#80DEEA' },
    { name: 'Тёмная бирюза', hex: '#26A69A' },
    { name: 'Горчичный', hex: '#F57F17' },
    { name: 'Фиолетовый', hex: '#CE93D8' },
    { name: 'Коричневый', hex: '#BCAAA4' },
  ];

  // Dialog для параметра без фильтров
  const EmptyFiltersDialog = () => (
    <div className="fixed inset-0 z-[400] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative z-10 bg-white border border-app-border rounded-xl w-[420px] shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-app-border">
          <h3 className="text-sm font-bold text-app-text-head">
            ⚠️ Параметр без фильтров
          </h3>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <p className="text-xs text-app-text-main leading-relaxed">
            Для данного параметра фильтры не настроены. Вы можете создать новые параметры и назначить их позже.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-3 border-t border-app-border">
          <button
            onClick={() => {
              setShowEmptyFiltersDialog(false);
              setPendingTaskData(null);
            }}
            className="mr-auto h-7 px-3 text-xs font-semibold whitespace-nowrap rounded border border-app-border text-app-text-head hover:border-app-primary hover:text-app-primary transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={() => {
              if (pendingTaskData) {
                setShowSimpleAddConfirm(true);
              }
            }}
            className="h-7 px-3 text-xs font-semibold whitespace-nowrap rounded border border-app-border text-app-text-head hover:border-app-primary hover:text-app-primary transition-colors"
          >
            Просто добавить
          </button>
          <button
            onClick={() => {
              if (pendingTaskData && onEditParameter) {
                onEditParameter(pendingTaskData);
              }
            }}
            className="h-7 px-3 text-xs font-semibold whitespace-nowrap rounded bg-app-primary text-white hover:bg-app-primary-hover transition-colors"
          >
            Добавить фильтры
          </button>
        </div>
      </div>
    </div>
  );

  const SimpleAddConfirmDialog = () => (
    <div className="fixed inset-0 z-[450] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative z-10 bg-white border border-app-border rounded-xl w-[340px] shadow-2xl">
        <div className="px-5 py-4 border-b border-app-border">
          <h3 className="text-sm font-bold text-app-text-head">Подтвердите действие</h3>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-app-text-main leading-relaxed">
            Задача не будет отражена в данной строке, так как её фильтры не настроены.
          </p>
        </div>
        <div className="flex items-center gap-2 px-5 py-3 border-t border-app-border">
          <button
            onClick={() => setShowSimpleAddConfirm(false)}
            className="mr-auto h-7 px-3 text-xs font-semibold whitespace-nowrap rounded border border-app-border text-app-text-head hover:border-app-primary hover:text-app-primary transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={() => {
              if (pendingTaskData) {
                onSave(pendingTaskData);
                setShowSimpleAddConfirm(false);
                setShowEmptyFiltersDialog(false);
                setPendingTaskData(null);
                onClose();
              }
            }}
            className="h-7 px-3 text-xs font-semibold whitespace-nowrap rounded bg-app-primary text-white hover:bg-app-primary-hover transition-colors"
          >
            Всё равно создать
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {showEmptyFiltersDialog && <EmptyFiltersDialog />}
      {showSimpleAddConfirm && <SimpleAddConfirmDialog />}
      <div className="fixed inset-0 z-[300] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      <div className="relative z-10 bg-white border border-app-border rounded-xl w-[290px] max-h-[90vh] overflow-y-auto flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-app-border">
          <h2 className="text-sm font-bold text-app-text-head">
            {mode === 'add' ? 'Create New Task' : 'Edit Task'}
          </h2>
          <button
            onClick={onClose}
            className="text-app-text-muted hover:text-app-text-main transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-3">

          {/* Warning: Gantt mode */}
          {!!ganttMode && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-900 leading-relaxed">
                <span className="font-semibold">Режим диаграммы Ганта:</span> Задача создана в режиме диаграммы Ганта. Чтобы переключиться на Timeline, измените фильтр строки.
              </p>
            </div>
          )}

          {/* Warning: Empty Filters */}
          {hasEmptyFilters && mode === 'add' && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs text-yellow-900 leading-relaxed">
                <span className="font-semibold">⚠️ Примечание:</span> Данная строка не имеет фильтров для отображения задач. Вам будет предложено добавить фильтр позже.
              </p>
            </div>
          )}

          {/* Task Name */}
          <div className="flex flex-col gap-1">
            <label className={labelCls}>
              Task Name <span className="text-app-error">*</span>
            </label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter task name"
              className={inputCls('name')}
            />
            {errors.name && <p className="text-[10px] text-app-error">{errors.name}</p>}
          </div>

          {/* Link */}
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Link</label>
            <input
              type="text"
              value={link}
              onChange={e => setLink(e.target.value)}
              placeholder="https://..."
              className={inputCls('link')}
            />
            {errors.link && <p className="text-[10px] text-app-error">{errors.link}</p>}
          </div>

          {/* Date Range + Duration + Fix */}
          <div className="flex flex-col gap-1">
            <label className={labelCls}>
              Period <span className="text-app-error">*</span>
            </label>
            <div className="flex items-center gap-1.5">
              <div className="flex-1">
                <DateRangePicker
                  range={dateRange}
                  onRangeChange={setDateRange}
                  fixedDropdown
                  singleDay={milestone}
                />
              </div>
              <div className="flex items-center gap-1.5">
                {duration ? (
                  <span className="text-xs text-app-text-head whitespace-nowrap font-semibold">
                    {`${duration} дн`}
                  </span>
                ) : null}
                <label className="flex items-center gap-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={fix}
                    onChange={e => setFix(e.target.checked)}
                    className="accent-app-primary w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className="text-xs text-app-text-head">Fix</span>
                </label>
              </div>
            </div>
            {errors.dateRange && (
              <p className="text-[10px] text-app-error">{errors.dateRange}</p>
            )}
          </div>

          {/* Веха · Цвет */}
          <div className="flex items-center">
            {/* Веха */}
            <div className="flex-1 flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={milestone}
                onChange={e => {
                  const val = e.target.checked;
                  setMilestone(val);
                  if (val && dateRange?.from) {
                    setDateRange({ from: dateRange.from, to: dateRange.from });
                  }
                }}
                className="accent-app-primary w-3.5 h-3.5 cursor-pointer"
              />
              <span className={labelCls}>Веха</span>
            </div>
            {/* Цвет */}
            <div className={`flex-1 flex items-center gap-1.5 ${milestone ? 'opacity-40 pointer-events-none' : ''}`}>
              <span className={labelCls}>Цвет</span>
              <div>
                <button
                  ref={colorButtonRef}
                  type="button"
                  onClick={() => {
                    if (status === 'done' || priority === 'blocker') return;
                    if (!colorPickerOpen && colorButtonRef.current) {
                      const rect = colorButtonRef.current.getBoundingClientRect();
                      const popoverWidth = 256;
                      const spaceRight = window.innerWidth - rect.right;
                      const left = spaceRight >= popoverWidth + 8
                        ? rect.right + 8
                        : rect.left - popoverWidth - 8;
                      setPickerPosition({ top: rect.top, left });
                    }
                    setColorPickerOpen(!colorPickerOpen);
                  }}
                  className="w-5 h-5 rounded-full border border-app-border transition-all"
                  style={{
                    backgroundColor: status === 'done' ? '#86efac' : priority === 'blocker' ? '#fca5a5' : color,
                    opacity: status === 'done' || priority === 'blocker' ? 0.5 : 1,
                    cursor: status === 'done' || priority === 'blocker' ? 'not-allowed' : 'pointer',
                  }}
                  title={
                    status === 'done' ? 'Цвет переопределён: Завершено'
                    : priority === 'blocker' ? 'Цвет переопределён: Блокер'
                    : 'Выбрать цвет'
                  }
                />
                {colorPickerOpen && createPortal(
                  <>
                    <div
                      className="fixed inset-0 z-[350]"
                      onClick={() => setColorPickerOpen(false)}
                    />
                    <div
                      className="fixed z-[360] bg-white border border-app-border rounded-lg shadow-2xl p-3 w-64"
                      style={{ top: pickerPosition.top, left: pickerPosition.left }}
                    >
                      <div className="grid grid-cols-4 gap-2">
                        {COLORS.map((col) => (
                          <button
                            key={col.hex}
                            type="button"
                            onClick={() => {
                              setColor(col.hex);
                              setColorPickerOpen(false);
                            }}
                            className="w-full h-10 rounded border-2 hover:shadow-md transition-all"
                            style={{
                              backgroundColor: col.hex,
                              borderColor: color === col.hex ? '#000' : '#ccc',
                            }}
                            title={col.name}
                          />
                        ))}
                      </div>
                    </div>
                  </>,
                  document.body
                )}
              </div>
            </div>
          </div>

          {/* Блокер · Закрыта */}
          <div className={`flex items-center ${milestone ? 'opacity-40 pointer-events-none' : ''}`}>
            {/* Блокер */}
            <div className="flex-1 flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={priority === 'blocker'}
                onChange={e => setPriority(e.target.checked ? 'blocker' : 'medium')}
                className="accent-app-error w-3.5 h-3.5 cursor-pointer"
              />
              <span className="text-[11px] font-semibold text-app-error">Блокер</span>
            </div>
            {/* Закрыта */}
            <div className="flex-1 flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={status === 'done'}
                onChange={e => setStatus(e.target.checked ? 'done' : 'not_started')}
                className="accent-app-primary w-3.5 h-3.5 cursor-pointer"
              />
              <span className={labelCls}>Закрыта</span>
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Type here..."
              rows={3}
              className="w-full px-3 py-2 text-xs rounded border border-app-border bg-white text-app-text-head placeholder:text-gray-300 outline-none focus:border-app-primary transition-colors resize-none"
            />
          </div>

          {/* Custom Fields */}
          <button
            type="button"
            onClick={() => setCustomFieldsOpen(v => !v)}
            className="flex items-center gap-1.5 w-full text-[11px] font-semibold text-app-text-head border border-app-border rounded px-3 py-1.5 hover:border-app-primary hover:text-app-primary transition-colors bg-white"
          >
            {customFieldsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Custom Fields
          </button>

          {customFieldsOpen && (
            <div className="flex flex-col gap-2 border border-app-border rounded p-3 -mt-1">
              <DndContext
                modifiers={[restrictToVerticalAxis]}
                collisionDetection={closestCenter}
                onDragEnd={handleFieldDragEnd}
              >
                <SortableContext
                  items={customFieldTypes.map(t => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {customFieldTypes.map(({ id, name }) => (
                    <SortableFieldRow
                      key={id}
                      id={id}
                      name={name}
                      values={customFieldValues[id] ?? ['']}
                      options={customFieldOptions?.[id] ?? []}
                      isEditing={editingTypeId === id}
                      editingName={editingTypeName}
                      inputCls={inputCls}
                      labelCls={labelCls}
                      onStartRename={() => { setEditingTypeId(id); setEditingTypeName(name); }}
                      onEditNameChange={setEditingTypeName}
                      onConfirmRename={() => {
                        if (editingTypeName.trim()) onRenameCustomFieldType?.(id, editingTypeName.trim());
                        setEditingTypeId(null);
                      }}
                      onCancelRename={() => setEditingTypeId(null)}
                      onDeleteType={() => onDeleteCustomFieldType?.(id)}
                      onAddValue={() => handleAddFieldValue(id)}
                      onChangeValue={(idx, val) => handleCustomFieldChange(id, idx, val)}
                      onRemoveValue={(idx) => handleRemoveFieldValue(id, idx)}
                    />
                  ))}
                </SortableContext>
              </DndContext>

              {/* Add New Type Button / Input */}
              {!addingNewType ? (
                <button
                  type="button"
                  onClick={() => setAddingNewType(true)}
                  className="flex items-center justify-center gap-1.5 w-full text-[11px] font-semibold text-app-text-head border border-dashed border-app-border rounded px-3 py-1.5 hover:border-app-primary hover:text-app-primary transition-colors mt-1"
                >
                  <Plus size={10} />
                  Add New Type
                </button>
              ) : (
                <div className="flex gap-2 mt-1">
                  <input
                    type="text"
                    value={newTypeName}
                    onChange={e => setNewTypeName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddNewType();
                      if (e.key === 'Escape') {
                        setAddingNewType(false);
                        setNewTypeName('');
                      }
                    }}
                    placeholder="Type name..."
                    className={inputCls()}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleAddNewType}
                    className="px-3 h-8 text-[11px] font-semibold text-white bg-app-primary rounded border border-app-primary hover:bg-app-primary-hover transition-colors whitespace-nowrap"
                  >
                    Add
                  </button>
                </div>
              )}

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-app-border">
          {mode === 'edit' && (
            <button
              onClick={onDelete}
              className="mr-auto h-7 px-3 text-xs font-semibold rounded border border-app-error/30 text-app-error hover:bg-app-error/10 transition-colors"
            >
              Delete
            </button>
          )}
          <button
            onClick={onClose}
            className="h-7 px-3 text-xs font-semibold rounded border border-app-border text-app-text-head hover:border-app-primary hover:text-app-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="h-7 px-4 text-xs font-semibold rounded bg-app-primary text-white hover:bg-app-primary-hover transition-colors"
          >
            {mode === 'add' ? 'Create Task' : 'Save'}
          </button>
        </div>
      </div>
    </div>
    </>
  );
};
