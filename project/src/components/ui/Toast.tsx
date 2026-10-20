import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onRemove: (id: number) => void;
}

export default function ToastContainer({ toasts, onRemove }: ToastProps) {
  return (
    <div className="fixed bottom-6 right-6 z-[70] flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: ToastMessage; onRemove: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const icons = {
    success: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
    error: <AlertCircle className="h-5 w-5 text-rose-500" />,
    info: <Info className="h-5 w-5 text-sky-500" />,
  };

  const borders = {
    success: 'border-l-emerald-500',
    error: 'border-l-rose-500',
    info: 'border-l-sky-500',
  };

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-slate-200 border-l-4 ${borders[toast.type]} bg-white px-4 py-3 shadow-lg animate-slide-in`}
    >
      {icons[toast.type]}
      <p className="text-sm font-medium text-slate-700 flex-1">{toast.message}</p>
      <button onClick={() => onRemove(toast.id)} className="text-slate-400 hover:text-slate-600">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
