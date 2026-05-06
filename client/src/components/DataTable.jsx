import { useState } from 'react';
import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';

const PAGE_SIZE = 25;

export default function DataTable({ headers, rows, columnTypes, filterCategory }) {
  const [page, setPage] = useState(1);
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);

  const filtered = rows.filter(row => {
    if (showOnlyErrors && !row.hasErrors) return false;
    if (filterCategory) return row.cells.some(c => !c.valid && c.category === filterCategory);
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="animate-fade-in">
      {/* Controls */}
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showOnlyErrors}
            onChange={e => { setShowOnlyErrors(e.target.checked); setPage(1); }}
            className="w-4 h-4 rounded accent-brand"
          />
          Solo filas con errores
          {showOnlyErrors && (
            <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">
              {filtered.length} fila{filtered.length !== 1 ? 's' : ''}
            </span>
          )}
        </label>
        <span className="text-xs text-slate-500">
          Mostrando {filtered.length} de {rows.length} filas
        </span>
      </div>

      {/* Table */}
      <div className="overflow-auto rounded-xl card" style={{ maxHeight: '60vh' }}>
        <table className="w-full text-xs border-collapse min-w-max">
          <thead className="sticky top-0 z-10">
            <tr style={{ background: '#0d1526' }}>
              <th className="px-3 py-2.5 text-left text-slate-500 font-semibold border-b border-navy-700 w-10">#</th>
              {headers.map((h, i) => (
                <th key={i}
                  className="px-3 py-2.5 text-left text-slate-400 font-semibold border-b border-navy-700 whitespace-nowrap"
                  style={{ maxWidth: 160 }}>
                  <div className="flex items-center gap-1">
                    {h || `Col ${i + 1}`}
                    {columnTypes[i] && (
                      <span className="text-[9px] text-brand-light opacity-60 font-normal uppercase">{columnTypes[i]}</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={headers.length + 1} className="text-center py-12 text-slate-500">
                  No hay filas que mostrar
                </td>
              </tr>
            ) : (
              pageRows.map((row, ri) => (
                <tr
                  key={row.index}
                  className={`border-b border-navy-800/60 transition-colors hover:bg-navy-800/30 ${
                    ri % 2 === 0 ? '' : 'bg-navy-900/30'
                  }`}
                >
                  <td className="px-3 py-2 text-slate-600 text-right w-10">{row.index + 1}</td>
                  {row.cells.map((cell, ci) => (
                    <CellView key={ci} cell={cell} />
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-30"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-sm text-slate-400">
            Página <span className="text-white font-semibold">{safePage}</span> de {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-30"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function CellView({ cell }) {
  const [showTip, setShowTip] = useState(false);

  if (!cell.valid) {
    return (
      <td
        className="px-3 py-2 relative cursor-help"
        style={{ maxWidth: 160 }}
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
      >
        <div className="cell-error rounded px-1.5 py-1">
          <span className="text-red-300 block truncate" style={{ maxWidth: 140 }}>
            {cell.value || <span className="italic text-red-500/60">vacío</span>}
          </span>
          {cell.suggestion && (
            <span className="cell-suggestion">→ {cell.suggestion}</span>
          )}
        </div>
        {showTip && (
          <div className="absolute z-50 left-0 top-full mt-1 px-2 py-1.5 rounded-lg text-xs text-white shadow-xl pointer-events-none whitespace-nowrap"
            style={{ background: '#0d1526', border: '1px solid rgba(99,102,241,0.4)', maxWidth: 280, whiteSpace: 'normal' }}>
            <div className="flex items-start gap-1.5">
              <AlertTriangle size={12} className="text-amber-400 mt-0.5 shrink-0" />
              <span>{cell.error}</span>
            </div>
            {cell.suggestion && (
              <div className="mt-1 text-emerald-400">Sugerido: {cell.suggestion}</div>
            )}
          </div>
        )}
      </td>
    );
  }

  return (
    <td className="px-3 py-2 text-slate-300" style={{ maxWidth: 160 }}>
      <span className="block truncate" style={{ maxWidth: 140 }}>{cell.value}</span>
    </td>
  );
}
