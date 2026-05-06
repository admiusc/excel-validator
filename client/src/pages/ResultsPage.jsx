import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, ArrowLeft, CheckCircle2, XCircle, FileSpreadsheet, AlertTriangle, RefreshCw } from 'lucide-react';
import CategoryCard from '../components/CategoryCard.jsx';
import DataTable from '../components/DataTable.jsx';

export default function ResultsPage() {
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('validationResult');
    if (!stored) { navigate('/'); return; }
    setResult(JSON.parse(stored));
  }, [navigate]);

  if (!result) return null;

  const { stats, headers, columnTypes, categorySummary, rows, correctedExcel, filename } = result;

  const handleDownload = () => {
    const bytes = Uint8Array.from(atob(correctedExcel), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.replace(/\.(xlsx|xls)$/i, '') + '_corregido.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const errorRate = stats.totalRows > 0
    ? Math.round((stats.rowsWithErrors / stats.totalRows) * 100)
    : 0;

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 animate-fade-in">
      <div className="max-w-7xl mx-auto">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="btn-secondary px-3 py-2">
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <FileSpreadsheet size={20} className="text-brand" />
                {filename}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">Análisis completado</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/')} className="btn-secondary text-xs px-4 py-2">
              <RefreshCw size={14} /> Nuevo archivo
            </button>
            <button onClick={handleDownload} className="btn-primary text-xs px-4 py-2">
              <Download size={14} /> Descargar corregido
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatBox label="Total filas" value={stats.totalRows} icon="📋" />
          <StatBox label="Filas válidas" value={stats.validRows} icon="✅" color="text-emerald-400" />
          <StatBox label="Filas con errores" value={stats.rowsWithErrors} icon="⚠️" color="text-red-400" />
          <StatBox label="Total errores" value={stats.totalErrors} icon="🔍" color="text-amber-400" />
        </div>

        {/* Error rate banner */}
        {stats.totalErrors === 0 ? (
          <div className="card p-4 mb-6 flex items-center gap-3"
            style={{ borderColor: '#34d39950', background: 'rgba(52,211,153,0.08)' }}>
            <CheckCircle2 size={22} className="text-emerald-400" />
            <div>
              <p className="font-semibold text-emerald-300">¡Sin errores detectados!</p>
              <p className="text-sm text-slate-400">Los datos cumplen con todos los criterios de validación.</p>
            </div>
          </div>
        ) : (
          <div className="card p-4 mb-6 flex items-center gap-3"
            style={{ borderColor: '#f5950050', background: 'rgba(245,149,0,0.06)' }}>
            <AlertTriangle size={22} className="text-amber-400" />
            <div className="flex-1">
              <p className="font-semibold text-amber-300">
                {stats.rowsWithErrors} fila{stats.rowsWithErrors !== 1 ? 's' : ''} con errores ({errorRate}%)
              </p>
              <p className="text-sm text-slate-400">
                Se encontraron {stats.totalErrors} errores en total. El archivo corregido aplica sugerencias automáticas donde es posible.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* Category cards sidebar */}
          {categorySummary.length > 0 && (
            <div className="lg:col-span-1">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Errores por categoría
              </h2>
              <div className="flex flex-col gap-2">
                {categorySummary.map(cat => (
                  <CategoryCard
                    key={cat.category}
                    {...cat}
                    total={stats.totalErrors}
                    active={activeCategory === cat.category}
                    onClick={() => setActiveCategory(prev => prev === cat.category ? null : cat.category)}
                  />
                ))}
                {activeCategory && (
                  <button
                    onClick={() => setActiveCategory(null)}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors text-left pl-1 mt-1"
                  >
                    × Quitar filtro
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Data table */}
          <div className={categorySummary.length > 0 ? 'lg:col-span-3' : 'lg:col-span-4'}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Tabla de datos
                {activeCategory && (
                  <span className="ml-2 text-brand-light font-normal capitalize">
                    — filtrando: {categorySummary.find(c => c.category === activeCategory)?.label}
                  </span>
                )}
              </h2>
            </div>
            <DataTable
              headers={headers}
              rows={rows}
              columnTypes={columnTypes}
              filterCategory={activeCategory}
            />
          </div>
        </div>

      </div>
    </div>
  );
}

function StatBox({ label, value, icon, color = 'text-white' }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-lg">{icon}</span>
        <span className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</span>
      </div>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
