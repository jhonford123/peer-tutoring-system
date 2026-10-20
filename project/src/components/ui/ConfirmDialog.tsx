import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { ReactNode } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'success' | 'info';
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'info',
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const icons = {
    danger: <AlertTriangle className="h-6 w-6 text-rose-500" />,
    success: <CheckCircle2 className="h-6 w-6 text-emerald-500" />,
    info: <Info className="h-6 w-6 text-sky-500" />,
  };

  const confirmColors = {
    danger: 'bg-rose-500 hover:bg-rose-600',
    success: 'bg-emerald-500 hover:bg-emerald-600',
    info: 'bg-sky-600 hover:bg-sky-700',
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 mt-0.5">{icons[variant]}</div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-slate-900">{title}</h3>
              <div className="mt-1.5 text-sm text-slate-600 leading-relaxed">{message}</div>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors ${confirmColors[variant]}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
