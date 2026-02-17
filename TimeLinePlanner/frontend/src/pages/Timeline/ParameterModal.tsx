import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus } from 'lucide-react';
import type { TimelineParameter, Task, CustomFieldType } from '../../store';

interface ParameterModalProps {
  isOpen: boolean;
  existingParameters: TimelineParameter[];
  availableTasks?: Task[];
  customFieldTypes?: CustomFieldType[];
  onSave: (parameter: Omit<TimelineParameter, 'id'>) => void;
  onClose: () => void;
}

// Стандартные поля задачи для фильтрации
const STATIC_FILTER_OPTIONS = [
  { key: 'priority', label: 'Приоритет' },
  { key: 'status', label: 'Статус' },
];

export const ParameterModal: React.FC<ParameterModalProps> = ({
  isOpen,
  existingParameters,
  availableTasks = [],
  customFieldTypes = [],
  onSave,
  onClose,
}) => {
  console.log('🔧 ParameterModal rendering, isOpen:', isOpen);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string | undefined>(undefined);
  const [filterFields, setFilterFields] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);

  // Все hooks ДОЛЖНЫ быть вызваны ДО условного return!
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }
  }, [onClose, isOpen]);

  // Динамические опции фильтрации: статичные + кастомные типы пользователя
  const filterFieldOptions = useMemo(() => {
    const custom = customFieldTypes.map(t => ({ key: t.id, label: t.name }));
    return [...STATIC_FILTER_OPTIONS, ...custom];
  }, [customFieldTypes]);

  // Вычисляем уникальные значения для каждого поля фильтра
  const filterValueOptions = useMemo(() => {
    const options: Record<string, string[]> = {};
    filterFieldOptions.forEach((field) => {
      const values = new Set<string>();
      availableTasks.forEach((task) => {
        // Проверяем стандартные поля и customFields
        const value = task[field.key as keyof Task] ?? task.customFields?.[field.key];
        if (value) {
          values.add(String(value));
        }
      });
      options[field.key] = Array.from(values).sort();
    });
    return options;
  }, [availableTasks, filterFieldOptions]);

  if (!isOpen) {
    console.log('🔧 ParameterModal isOpen is false, returning null');
    return null;
  }

  console.log('✅ ParameterModal rendering modal content');

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Обязательное поле';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAddFilterField = () => {
    const availableField = filterFieldOptions.find(opt => !(opt.key in filterFields));
    if (availableField) {
      setFilterFields(prev => ({ ...prev, [availableField.key]: '' }));
    }
  };

  const handleFilterChange = (oldKey: string, newKey: string, value: string) => {
    setFilterFields(prev => {
      const next = { ...prev };
      if (oldKey !== newKey && oldKey in next) {
        delete next[oldKey];
      }
      next[newKey] = value;
      return next;
    });
  };

  const handleRemoveFilter = (key: string) => {
    setFilterFields(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSubmit = () => {
    console.log('🔘 ParameterModal handleSubmit called');
    console.log('📝 Current form state:', { name, parentId, filterFields });
    if (!validate()) {
      console.log('❌ Validation failed');
      return;
    }

    const newLevel = parentId ? (existingParameters.find(p => p.id === parentId)?.level ?? 0) + 1 : 0;

    const parameterData = {
      name: name.trim(),
      level: newLevel,
      parentId: parentId || undefined,
      filters: Object.keys(filterFields).length > 0 ? filterFields : {},
    };
    console.log('✅ Calling onSave with:', parameterData);

    onSave(parameterData);
    console.log('✅ onSave called successfully');

    setName('');
    setParentId(undefined);
    setFilterFields({});
    console.log('🔄 Form reset completed');
  };

  const inputCls = (field?: string) =>
    `w-full h-8 px-3 text-xs rounded border bg-white text-app-text-head placeholder:text-gray-300 outline-none focus:border-app-primary transition-colors ${
      field && errors[field] ? 'border-app-error' : 'border-app-border'
    }`;

  const labelCls = 'text-[11px] font-semibold text-app-text-head';

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/20"
        onClick={() => {
          console.log('🖱️ Backdrop clicked');
          onClose();
        }}
      />

      <div
        className="relative z-10 bg-white border border-app-border rounded-xl w-[380px] max-h-[90vh] overflow-y-auto flex flex-col"
        onClick={(e) => {
          console.log('🖱️ Modal content clicked');
          e.stopPropagation();
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-app-border">
          <h2 className="text-sm font-bold text-app-text-head">Добавить параметр</h2>
          <button
            onClick={onClose}
            className="text-app-text-muted hover:text-app-text-main transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-3">
          {/* Parameter Name */}
          <div className="flex flex-col gap-1">
            <label className={labelCls}>
              Название параметра <span className="text-app-error">*</span>
            </label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Велосипед, Сборка, Иван"
              className={inputCls('name')}
            />
            {errors.name && <p className="text-[10px] text-app-error">{errors.name}</p>}
          </div>

          {/* Parent Parameter (optional, for hierarchy) */}
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Родительский параметр (опционально)</label>
            <select
              value={parentId ?? ''}
              onChange={e => setParentId(e.target.value || undefined)}
              className="w-full h-8 px-2 text-xs rounded border border-app-border bg-white text-app-text-head outline-none focus:border-app-primary transition-colors cursor-pointer"
            >
              <option value="">— Нет (верхний уровень)</option>
              {existingParameters.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} (уровень {p.level})
                </option>
              ))}
            </select>
          </div>

          {/* Filters Section - REQUIRED */}
          <div className="flex flex-col gap-1">
            <label className={labelCls}>
              Фильтры параметра <span className="text-app-error">*</span>
            </label>
            <div className="flex flex-col gap-2 border border-app-border rounded p-3">
              {Object.entries(filterFields).length === 0 ? (
                <p className="text-[10px] text-app-text-muted italic">
                  Нажмите кнопку ниже, чтобы добавить фильтр
                </p>
              ) : (
                Object.entries(filterFields).map(([fieldKey, fieldValue]) => (
                  <div key={fieldKey} className="flex gap-2 items-end">
                    {/* Field selector dropdown */}
                    <select
                      value={fieldKey}
                      onChange={e => {
                        const newKey = e.target.value;
                        handleFilterChange(fieldKey, newKey, fieldValue);
                      }}
                      className="flex-1 h-7 px-2 text-xs rounded border border-app-border bg-white text-app-text-head outline-none focus:border-app-primary transition-colors cursor-pointer"
                    >
                      <option value="">— Выберите поле</option>
                      {filterFieldOptions.map(opt => (
                        <option key={opt.key} value={opt.key}>
                          {opt.label}
                        </option>
                      ))}
                    </select>

                    {/* Value text input */}
                    {fieldKey && (
                      <input
                        type="text"
                        value={fieldValue}
                        onChange={e => handleFilterChange(fieldKey, fieldKey, e.target.value)}
                        placeholder="Значение..."
                        className="flex-1 h-7 px-2 text-xs rounded border border-app-border bg-white text-app-text-head placeholder:text-gray-300 outline-none focus:border-app-primary transition-colors"
                      />
                    )}

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveFilter(fieldKey)}
                      className="px-2 h-7 text-xs font-semibold text-app-error rounded border border-app-error/30 hover:bg-app-error/10 transition-colors flex-shrink-0"
                    >
                      −
                    </button>
                  </div>
                ))
              )}

              <button
                type="button"
                onClick={handleAddFilterField}
                className="flex items-center justify-center gap-1.5 w-full text-[11px] font-semibold text-app-text-head border border-dashed border-app-border rounded px-3 py-1.5 hover:border-app-primary hover:text-app-primary transition-colors"
              >
                <Plus size={10} />
                Добавить фильтр
              </button>
            </div>
            {errors.filters && <p className="text-[10px] text-app-error">{errors.filters}</p>}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-app-border">
          <button
            onClick={onClose}
            className="h-7 px-3 text-xs font-semibold rounded border border-app-border text-app-text-head hover:border-app-primary hover:text-app-primary transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            className="h-7 px-4 text-xs font-semibold rounded bg-app-primary text-white hover:bg-app-primary-hover transition-colors"
          >
            Создать параметр
          </button>
        </div>
      </div>
    </div>
  );
};
