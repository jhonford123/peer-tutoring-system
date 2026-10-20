interface StatusBadgeProps {
  status: string;
}

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  active: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  inactive: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
  scheduled: { bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-500' },
  completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  cancelled: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
  pending: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  pending_review: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  approved: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  released: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  rejected: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
  published: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  unpublished: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
  confirmed: { bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-500' },
  paid: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  new: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  good: { bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-500' },
  fair: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  damaged: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${config.bg} ${config.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {status}
    </span>
  );
}
