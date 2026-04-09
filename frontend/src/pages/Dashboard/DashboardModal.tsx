import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus } from 'lucide-react';
import type { DashboardConfig, CustomFieldType, Task } from '../../store';
import { Autocomplete } from '../../components/ui/Autocomplete';
import { DateRangePicker } from '../../components/ui/DateRangePicker';
import type { DateRange } from 'react-day-picker';

interface DashboardModalProps {
  isOpen: boolean;
  mode: 'add' | 'edit';
  editingDashboard?: DashboardConfig;
  customFieldTypes: CustomFieldType[];
  availableTasks: Task[];
  onSave: (d: Omit<DashboardConfig, 'id'>) => void;
  onClose: () => void;
}

export const DashboardModal: React.FC<DashboardModalProps> = ({
  isOpen,
  mode,
  editingDashboard,
  customFieldTypes,
  availableTasks,
  onSave,
  onClose,
}) => {
  const [name, setName] = useState('');
  const [type] = useState<'treemap'>('treemap');
  const [groupByFieldId, setGroupByFieldId] = useState('');
  const [period, setPeriod] = useState<'30d' | '90d' | 'custom'>('30d');
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);
  const [filterFields, setFilterFields] = useState<Record<string, string[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) {
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }
  }, [onClose, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (mode === 'edit' && editingDashboard) {
      setName(editingDashboard.name);
      setGroupByFieldId(editingDashboard.groupByFieldId);
      setPeriod(editingDashboard.period);
      setCustomRange(
        editingDashboard.dateFrom && editingDashboard.dateTo
          ? { from: new Date(editingDashboard.dateFrom), to: new Date(editingDashboard.dateTo) }
          : undefined
      );
      setFilterFields(
        Object.fromEntries(
          Object.entries(editingDashboard.filters ?? {}).map(([k, v]) => [k, Array.isArray(v) ? v : [v]])
        )
      );
      setErrors({});
    } else {
      setName('');
      setGroupByFieldId('');
      setPeriod('30d');
      setCustomRange(undefined);
      setFilterFields({});
      setErrors({});
    }
  }, [isOpen, mode, editingDashboard]);

  const fieldNameOptions = useMemo(() => customFieldTypes.map(t => t.name), [customFieldTypes]);

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

  const valueOptionsByFieldId = useMemo(() => {
    const map: Record<string, string[]> = {};
    availableTasks.forEach(task => {
      Object.entries(task.customFields ?? {}).forEach(([fieldId, vals]) => {
        if (!map[fieldId]) map[fieldId] = [];
        (Array.isArray(vals) ? vals : [vals as string]).forEach(val => {
          if (val && !map[fieldId].includes(val)) map[fieldId].push(val);
        });
      });
    });
    return map;
  }, [availableTasks]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Обязательное поле';
    if (!groupByFieldId) errs.groupBy = 'Выберите поле для группировки';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAddFilterField = () => {
    const placeholder = `__new_${Date.now()}`;
    setFilterFields(prev => ({ ...prev, [placeholder]: [''] }));
  };

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

  const handleFilterValueChange = (key: string, index: number, value: string) => {
    setFilterFields(prev => ({
      ...prev,
      [key]: (prev[key] ?? ['']).map((v, i) => i === index ? value : v),
    }));
  };

  const handleAddFilterValue = (key: string) => {
    setFilterFields(prev => ({ ...prev, [key]: [...(prev[key] ?? ['']), ''] }));
  };

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

    const cleanFilters = Object.fromEntries(
      Object.entries(filterFields)
        .filter(([k, vals]) => !k.startsWith('__new_') && k && vals.some(v => v.trim()))
        .map(([k, vals]) => [k, vals.filter(v => v.trim())])
    );

    onSave({
      name: name.trim(),
      type,
      groupByFieldId,
      filters: cleanFilters,
      period,
      dateFrom: period === 'custom' && customRange?.from ? customRange.from.toISOString() : undefined,
      dateTo: period === 'custom' && customRange?.to ? customRange.to.toISOString() : undefined,
    });
  };

  const inputCls = (field?: string) =>
    `w-full h-8 px-3 text-xs rounded border bg-white text-app-text-head placeholder:text-gray-300 outline-none focus:border-app-primary transition-colors ${
      field && errors[field] ? 'border-app-error' : 'border-app-border'
    }`;

  const labelCls = 'text-[11px] font-semibold text-app-text-head';

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div
        className="relative z-10 bg-white border border-app-border rounded-xl w-[400px] max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-app-border flex-shrink-0">
          <h2 className="text-sm font-bold text-app-text-head">
            {mode === 'edit' ? 'Редактировать дашборд' : 'Новый дашборд'}
          </h2>
          <button onClick={onClose} className="text-app-text-muted hover:text-app-text-main transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-3 overflow-y-auto">
          {/* Name */}
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Название <span className="text-app-error">*</span></label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Разбивка по типам"
              className={inputCls('name')}
            />
            {errors.name && <p className="text-[10px] text-app-error">{errors.name}</p>}
          </div>

          {/* GroupBy */}
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Группировать по <span className="text-app-error">*</span></label>
            <select
              value={groupByFieldId}
              onChange={e => setGroupByFieldId(e.target.value)}
              className={`w-full h-8 px-2 text-xs rounded border bg-white text-app-text-head outline-none focus:border-app-primary transition-colors cursor-pointer ${
                errors.groupBy ? 'border-app-error' : 'border-app-border'
              }`}
            >
              <option value="">— Выберите поле</option>
              {customFieldTypes.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {errors.groupBy && <p className="text-[10px] text-app-error">{errors.groupBy}</p>}
          </div>

          {/* Period */}
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Период</label>
            <div className="flex gap-2 items-center">
              {(['30d', '90d', 'custom'] as const).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`h-7 px-3 text-xs font-semibold rounded border transition-colors ${
                    period === p
                      ? 'bg-app-primary text-white border-app-primary'
                      : 'border-app-border text-app-text-head hover:border-app-primary hover:text-app-primary'
                  }`}
                >
                  {p === '30d' ? '30 дней' : p === '90d' ? '90 дней' : 'Период'}
                </button>
              ))}
              {period === 'custom' && (
                <div className="flex-1">
                  <DateRangePicker
                    range={customRange}
                    onRangeChange={setCustomRange}
                    fixedDropdown
                  />
                </div>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Фильтры задач (опционально)</label>
            <div className="flex flex-col gap-2 border border-app-border rounded p-3">
              {Object.entries(filterFields).length === 0 ? (
                <p className="text-[10px] text-app-text-muted italic">
                  Без фильтров — показываются все задачи
                </p>
              ) : (
                Object.entries(filterFields).map(([fieldKey, fieldValues]) => {
                  const fieldName = fieldIdToName[fieldKey] ?? '';
                  const valueOptions = valueOptionsByFieldId[fieldKey] ?? [];
                  const isValidField = fieldKey in fieldIdToName;

                  return (
                    <div key={fieldKey} className="flex flex-col gap-1">
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
                        >+</button>
                        <button
                          type="button"
                          onClick={() => handleRemoveFilter(fieldKey)}
                          className="flex-shrink-0 px-2 h-7 text-xs font-semibold text-app-error rounded border border-app-error/30 hover:bg-app-error/10 transition-colors"
                        >−</button>
                      </div>
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
                            >−</button>
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
            {mode === 'edit' ? 'Сохранить' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  );
};
