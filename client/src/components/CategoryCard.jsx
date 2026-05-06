import { User, CreditCard, Calendar, Mail, Phone, MapPin, Building2, BarChart3, AlertCircle, AlertTriangle } from 'lucide-react';

const ICONS = {
  name: User,
  id: CreditCard,
  date: Calendar,
  email: Mail,
  phone: Phone,
  barrio: MapPin,
  city: Building2,
  scale: BarChart3,
  noinfo: AlertCircle,
};

const COLORS = {
  name: '#818cf8',
  id: '#f59e0b',
  date: '#34d399',
  email: '#60a5fa',
  phone: '#a78bfa',
  barrio: '#f87171',
  city: '#fb923c',
  scale: '#2dd4bf',
  noinfo: '#94a3b8',
};

export default function CategoryCard({ category, label, count, total, onClick, active }) {
  const Icon = ICONS[category] || AlertTriangle;
  const color = COLORS[category] || '#94a3b8';
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <button
      onClick={onClick}
      className={`card p-4 text-left w-full transition-all hover:scale-[1.02] active:scale-[0.98] ${
        active ? 'ring-1' : ''
      }`}
      style={active ? { ringColor: color, borderColor: color + '80' } : {}}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: color + '20' }}>
          <Icon size={18} style={{ color }} />
        </div>
        <span className="text-2xl font-bold text-white">{count}</span>
      </div>
      <p className="text-xs font-medium text-slate-300 leading-tight">{label}</p>
      <div className="mt-2 h-1 rounded-full bg-navy-700 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }} />
      </div>
      <p className="text-xs text-slate-600 mt-1">{pct}% del total de errores</p>
    </button>
  );
}
