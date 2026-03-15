import React from 'react';
import ReactDOM from 'react-dom';

interface ConfirmDialogProps {
  title: string;
  message?: string;
  confirmLabel: string;
  confirmVariant?: 'danger' | 'primary';
  secondaryLabel?: string;
  onSecondary?: () => void;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  confirmLabel,
  confirmVariant = 'danger',
  secondaryLabel,
  onSecondary,
  cancelLabel = 'Отмена',
  onConfirm,
  onCancel,
}) => {
  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[500] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative z-10 bg-white border border-app-border rounded-xl min-w-[360px] max-w-[90vw] w-fit shadow-2xl">
        <div className="px-5 py-4 border-b border-app-border">
          <h3 className="text-sm font-bold text-app-text-head">{title}</h3>
        </div>

        {message && (
          <div className="px-5 py-4">
            <p className="text-xs text-app-text-main leading-relaxed">{message}</p>
          </div>
        )}

        <div className="flex items-center justify-center gap-2 px-5 py-3 border-t border-app-border">
          {onCancel && (
            <button
              onClick={onCancel}
              className="py-1.5 px-3 text-xs font-semibold rounded border border-app-border text-app-text-head hover:border-app-primary hover:text-app-primary transition-colors whitespace-nowrap"
            >
              {cancelLabel}
            </button>
          )}
          {secondaryLabel && onSecondary && (
            <button
              onClick={onSecondary}
              className="py-1.5 px-3 text-xs font-semibold rounded border border-app-border text-app-text-head hover:border-app-primary hover:text-app-primary transition-colors whitespace-nowrap"
            >
              {secondaryLabel}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`py-1.5 px-4 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
              confirmVariant === 'danger'
                ? 'bg-app-error text-white hover:opacity-90'
                : 'bg-app-primary text-white hover:bg-app-primary-hover'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
