import React, { useState, useEffect } from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { X, ChevronRight, ChevronDown, Plus } from 'lucide-react';
import { DateRangePicker } from '../../components/ui/DateRangePicker';
import type { Task } from '../../store';

interface CustomFieldTypeDef {
  id: string;
  name: string;
}

interface TaskModalProps {
  mode: 'add' | 'edit';
  task?: Task;
  paramId?: string;
  initialDate?: Date;
  customFieldTypes: CustomFieldTypeDef[];
  onAddCustomFieldType: (name: string) => CustomFieldTypeDef;
  onSave: (data: Omit<Task, 'id'> & { id?: string }) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  mode,
  task,
  // paramId больше не используется, но оставляем в props для совместимости
  paramId,
  initialDate,
  customFieldTypes,
  onAddCustomFieldType,
  onSave,
  onDelete,
  onClose,
}) => {
  void paramId; // paramId больше не используется в функции
  const initRange: DateRange | undefined = task
    ? { from: task.startDate, to: task.endDate }
    : initialDate
    ? { from: initialDate, to: initialDate }
    : undefined;

  const [name, setName] = useState(task?.name ?? '');
  const [link, setLink] = useState(task?.link ?? '');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(initRange);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>(task?.priority ?? 'medium');
  const [status, setStatus] = useState<'not_started' | 'in_progress' | 'done'>(task?.status ?? 'not_started');
  const [description, setDescription] = useState(task?.description ?? '');
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>(task?.customFields ?? {});
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);
  const [addingNewType, setAddingNewType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const duration =
    dateRange?.from && dateRange?.to
      ? differenceInCalendarDays(dateRange.to, dateRange.from) + 1
      : '';

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Обязательное поле';
    if (!dateRange?.from) errs.dateRange = 'Выберите даты';
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

  const handleCustomFieldChange = (id: string, value: string) => {
    setCustomFieldValues(prev => ({ ...prev, [id]: value }));
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSave({
      id: task?.id,
      name: name.trim(),
      startDate: dateRange!.from!,
      endDate: dateRange!.to ?? dateRange!.from!,
      link: link.trim() || undefined,
      priority,
      status,
      description: description.trim() || undefined,
      customFields: Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined,
    });
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

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      <div className="relative z-10 bg-white border border-app-border rounded-xl w-[340px] max-h-[90vh] overflow-y-auto flex flex-col">

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
              className={inputCls()}
            />
          </div>

          {/* Date Range + Duration + Fix */}
          <div className="flex flex-col gap-1">
            <label className={labelCls}>
              Period <span className="text-app-error">*</span>
            </label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <DateRangePicker
                  range={dateRange}
                  onRangeChange={setDateRange}
                  fixedDropdown
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-app-text-head whitespace-nowrap font-semibold">
                  {duration && `${duration} дн`}
                </span>
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input type="checkbox" className="accent-app-primary w-3.5 h-3.5 cursor-pointer" />
                  <span className="text-xs text-app-text-head">Fix</span>
                </label>
              </div>
            </div>
            {errors.dateRange && (
              <p className="text-[10px] text-app-error">{errors.dateRange}</p>
            )}
          </div>

          {/* Priority + Status */}
          <div className="flex gap-3">
            <div className="flex flex-col gap-1 flex-1">
              <label className={labelCls}>Priority</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as 'low' | 'medium' | 'high')}
                className="w-full h-8 px-2 text-xs rounded border border-app-border bg-white text-app-text-head outline-none focus:border-app-primary transition-colors cursor-pointer"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className={labelCls}>Status</label>
              <select
                value={status}
                onChange={e =>
                  setStatus(e.target.value as 'not_started' | 'in_progress' | 'done')
                }
                className="w-full h-8 px-2 text-xs rounded border border-app-border bg-white text-app-text-head outline-none focus:border-app-primary transition-colors cursor-pointer"
              >
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
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
              {customFieldTypes.map(({ id, name }) => (
                <div key={id} className="flex flex-col gap-1">
                  <label className={`${labelCls} text-[10px]`}>{name}</label>
                  <input
                    type="text"
                    value={customFieldValues[id] ?? ''}
                    onChange={e => handleCustomFieldChange(id, e.target.value)}
                    placeholder={`Enter ${name}`}
                    className={inputCls()}
                  />
                </div>
              ))}

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
  );
};
