import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus } from 'lucide-react';
import type { TimelineParameter, Task, CustomFieldType } from '../../store';
import { Autocomplete } from '../../components/ui/Autocomplete';

interface ParameterModalProps {
  isOpen: boolean;
  mode?: 'add' | 'edit';
  editingParameter?: TimelineParameter;
  defaultParentId?: string;
  existingParameters: TimelineParameter[];
  availableTasks?: Task[];
  customFieldTypes?: CustomFieldType[];
  onSave: (parameter: Omit<TimelineParameter, 'id'>) => void;
  onClose: () => void;
}


export const ParameterModal: React.FC<ParameterModalProps> = ({
  isOpen,
  mode = 'add',
  editingParameter,
  defaultParentId,
  existingParameters,
  availableTasks = [],
  customFieldTypes = [],
  onSave,
  onClose,
}) => {
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState<number>(1);
  const [parentId, setParentId] = useState<string | undefined>(undefined);
  const [filterFields, setFilterFields] = useState<Record<string, string[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  // Заполняем форму при открытии в режиме edit
  useEffect(() => {
    if (isOpen && mode === 'edit' && editingParameter) {
      setName(editingParameter.name);
      setCapacity(editingParameter.capacity ?? 1);
      setParentId(editingParameter.parentId);
      setFilterFields(
        Object.fromEntries(
          Object.entries(editingParameter.filters ?? {}).map(([k, v]) => [
            k, Array.isArray(v) ? v : [v as string],
          ])
        )
      );
      setErrors({});
    } else if (isOpen && mode === 'add') {
      setName('');
      setCapacity(1);
      setParentId(defaultParentId);
      setFilterFields({});
      setErrors({});
    }
  }, [isOpen, mode, editingParameter, defaultParentId]);

  // Имена полей для автозаполнения (отображаемые)
  const fieldNameOptions = useMemo(
    () => customFieldTypes.map(t => t.name),
    [customFieldTypes]
  );

  // Хелпер: id → name и name → id
  const fieldIdToName = useMemo(() => {
    const m: Record<string, string> = {};
    customFieldTypes.forEach(t => { m[t.id] = t.name; });
    return m;
  }, [customFieldTypes]);

  const fieldNameToId = useMemo(() => {
    const m: Record<string, string> = {};
    customFieldTypes.forEach(t => { m[t.name] = t.id; });
    return m;
  }, [customFieldTypes]);

  // Уникальные значения для каждого field id из задач
  const valueOptionsByFieldId = useMemo(() => {
    const map: Record<string, string[]> = {};
    (availableTasks ?? []).forEach(task => {
      Object.entries(task.customFields ?? {}).forEach(([fieldId, vals]) => {
        if (!map[fieldId]) map[fieldId] = [];
        (Array.isArray(vals) ? vals : [vals as string]).forEach(val => {
          if (val && !map[fieldId].includes(val)) map[fieldId].push(val);
        });
      });
    });
    return map;
  }, [availableTasks]);

  if (!isOpen) {
    return null;
  }

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Обязательное поле';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAddFilterField = () => {
    const placeholder = `__new_${Date.now()}`;
    setFilterFields(prev => ({ ...prev, [placeholder]: [''] }));
  };

  // Обновить ключ фильтра (поле) — пользователь выбрал name, конвертируем в id
  const handleFilterFieldNameChange = (oldKey: string, newFieldName: string) => {
    const newId = fieldNameToId[newFieldName] ?? oldKey;
    setFilterFields(prev => {
      const next: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(prev)) {
        next[k === oldKey ? newId : k] = v;
      }
      return next;
    });
  };

  // Обновить конкретное значение фильтра по индексу
  const handleFilterValueChange = (key: string, index: number, value: string) => {
    setFilterFields(prev => ({
      ...prev,
      [key]: (prev[key] ?? ['']).map((v, i) => i === index ? value : v),
    }));
  };

  // Добавить ещё одно значение к существующему полю фильтра
  const handleAddFilterValue = (key: string) => {
    setFilterFields(prev => ({
      ...prev,
      [key]: [...(prev[key] ?? ['']), ''],
    }));
  };

  // Удалить конкретное значение; если последнее — удалить весь фильтр
  const handleRemoveFilterValue = (key: string, index: number) => {
    setFilterFields(prev => {
      const next = (prev[key] ?? []).filter((_, i) => i !== index);
      if (next.length === 0) {
        const result = { ...prev };
        delete result[key];
        return result;
      }
      return { ...prev, [key]: next };
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
    if (!validate()) return;

    const newLevel = parentId ? (existingParameters.find(p => p.id === parentId)?.level ?? 0) + 1 : 0;

    const parameterData = {
      name: name.trim(),
      level: newLevel,
      parentId: parentId || undefined,
      capacity,
      // Исключаем незаполненные строки (временные ключи-заглушки и пустые значения)
      filters: Object.fromEntries(
        Object.entries(filterFields)
          .filter(([k, vals]) => !k.startsWith('__new_') && k && vals.some(v => v.trim()))
          .map(([k, vals]) => [k, vals.filter(v => v.trim())])
      ),
    };

    onSave(parameterData);

    setName('');
    setParentId(undefined);
    setFilterFields({});
  };

  const inputCls = (field?: string) =>
    `w-full h-8 px-3 text-xs rounded border bg-white text-app-text-head placeholder:text-gray-300 outline-none focus:border-app-primary transition-colors ${
      field && errors[field] ? 'border-app-error' : 'border-app-border'
    }`;

  const labelCls = 'text-[11px] font-semibold text-app-text-head';

  const isEdit = mode === 'edit';

  // В режиме edit исключаем самого себя из списка родителей
  const parentOptions = isEdit
    ? existingParameters.filter(p => p.id !== editingParameter?.id)
    : existingParameters;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/20"
        onClick={onClose}
      />

      <div
        className="relative z-10 bg-white border border-app-border rounded-xl w-[380px] max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-app-border flex-shrink-0">
          <h2 className="text-sm font-bold text-app-text-head">
            {isEdit ? 'Редактировать параметр' : 'Добавить параметр'}
          </h2>
          <button
            onClick={onClose}
            className="text-app-text-muted hover:text-app-text-main transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-3 overflow-y-auto">
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
              {parentOptions.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} (уровень {p.level})
                </option>
              ))}
            </select>
          </div>

          {/* Capacity */}
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Допустимое количество наложений</label>
            <select
              value={capacity}
              onChange={e => setCapacity(Number(e.target.value))}
              className="w-full h-8 px-2 text-xs rounded border border-app-border bg-white text-app-text-head outline-none focus:border-app-primary transition-colors cursor-pointer"
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          {/* Filters Section */}
          <div className="flex flex-col gap-1">
            <label className={labelCls}>
              Фильтры параметра (опционально)
            </label>
            <div className="flex flex-col gap-2 border border-app-border rounded p-3">
              {Object.entries(filterFields).length === 0 ? (
                <p className="text-[10px] text-app-text-muted italic">
                  Нажмите кнопку ниже, чтобы добавить фильтр
                </p>
              ) : (
                Object.entries(filterFields).map(([fieldKey, fieldValues]) => {
                  // Специальный случай: фильтр по ID задачи (Ганта)
                  if (fieldKey === 'id') {
                    return (
                      <div key={fieldKey} className="flex gap-2 items-center">
                        <div className="flex-1 h-7 px-2 text-xs flex items-center border border-app-border rounded bg-white text-app-text-head select-none font-medium">
                          ID задачи
                        </div>
                        <div className="flex-1 h-7 px-2 text-xs flex items-center border border-app-border rounded bg-white text-app-text-head truncate font-mono" title={fieldValues[0]}>
                          {fieldValues[0]}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFilter(fieldKey)}
                          className="flex-shrink-0 px-2 h-7 text-xs font-semibold text-app-error rounded border border-app-error/30 hover:bg-app-error/10 transition-colors"
                        >
                          −
                        </button>
                      </div>
                    );
                  }

                  const fieldName = fieldIdToName[fieldKey] ?? '';
                  const valueOptions = valueOptionsByFieldId[fieldKey] ?? [];
                  const isValidField = fieldKey in fieldIdToName;

                  return (
                    <div key={fieldKey} className="flex flex-col gap-1">
                      {/* Строка выбора поля + кнопки */}
                      <div className="flex gap-2 items-center">
                        <Autocomplete
                          options={fieldNameOptions}
                          value={fieldName}
                          onChange={newName => handleFilterFieldNameChange(fieldKey, newName)}
                          placeholder="Поле..."
                          className="flex-1 min-w-0"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddFilterValue(fieldKey)}
                          className="flex-shrink-0 px-2 h-7 text-xs font-semibold text-app-primary rounded border border-app-primary/30 hover:bg-app-primary/10 transition-colors"
                          title="Добавить значение"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveFilter(fieldKey)}
                          className="flex-shrink-0 px-2 h-7 text-xs font-semibold text-app-error rounded border border-app-error/30 hover:bg-app-error/10 transition-colors"
                          title="Удалить фильтр"
                        >
                          −
                        </button>
                      </div>
                      {/* Строки значений */}
                      {fieldValues.map((val, idx) => (
                        <div key={idx} className="flex gap-2 items-center pl-2">
                          <Autocomplete
                            options={valueOptions}
                            value={val}
                            onChange={v => handleFilterValueChange(fieldKey, idx, v)}
                            placeholder={isValidField ? 'Значение...' : 'Сначала поле'}
                            disabled={!isValidField}
                            className="flex-1 min-w-0"
                          />
                          {fieldValues.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveFilterValue(fieldKey, idx)}
                              className="flex-shrink-0 px-2 h-7 text-xs font-semibold text-app-text-muted rounded border border-app-border hover:bg-app-bg/50 transition-colors"
                            >
                              −
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })
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
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-app-border flex-shrink-0">
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
            {isEdit ? 'Сохранить изменения' : 'Создать параметр'}
          </button>
        </div>
      </div>
    </div>
  );
};
