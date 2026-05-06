import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileSpreadsheet, AlertCircle, Loader2, CheckCircle2, ChevronRight } from 'lucide-react';

export default function UploadPage() {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const handleFile = useCallback((f) => {
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'xlsm'].includes(ext)) {
      setError('Solo se aceptan archivos .xlsx, .xls o .xlsm');
      return;
    }
    setError(null);
    setFile(f);
  }, []);

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const onDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      const form = new FormData();
      form.append('file', file);

      const res = await fetch('/api/process', { method: 'POST', body: form });

      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error('No se pudo conectar con el servidor. Asegúrate de que el backend esté corriendo (Terminal: cd excel-validator/server → node server.js)');
      }

      if (!res.ok) throw new Error(data.error || 'Error al procesar el archivo');

      // Store results in sessionStorage to pass to ResultsPage
      sessionStorage.setItem('validationResult', JSON.stringify(data));
      navigate('/results');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-xl animate-slide-up">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, #6366f1, #3b82f6)', boxShadow: '0 8px 32px rgba(99,102,241,0.4)' }}>
            <FileSpreadsheet size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Excel Validator</h1>
          <p className="text-slate-400 text-sm">
            Valida y corrige datos de fichas de caracterización automáticamente
          </p>
        </div>

        {/* Drop zone */}
        <div
          className={`card p-8 text-center cursor-pointer transition-all duration-200 ${
            dragging
              ? 'border-brand shadow-lg scale-[1.01]'
              : file
              ? 'border-emerald-500/50'
              : 'hover:border-navy-400'
          }`}
          style={dragging ? { borderColor: '#6366f1', boxShadow: '0 0 0 3px rgba(99,102,241,0.2)' } : {}}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => !file && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.xlsm"
            className="hidden"
            onChange={e => handleFile(e.target.files[0])}
          />

          {file ? (
            <div className="animate-fade-in">
              <CheckCircle2 size={40} className="mx-auto mb-3 text-emerald-400" />
              <p className="font-semibold text-white text-lg">{file.name}</p>
              <p className="text-slate-400 text-sm mt-1">{formatSize(file.size)}</p>
              <button
                className="mt-4 text-xs text-slate-500 hover:text-slate-300 transition-colors underline"
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
              >
                Cambiar archivo
              </button>
            </div>
          ) : (
            <div>
              <Upload size={40} className="mx-auto mb-3 text-slate-500" />
              <p className="text-white font-medium mb-1">Arrastra tu archivo Excel aquí</p>
              <p className="text-slate-500 text-sm">o haz clic para seleccionarlo</p>
              <p className="text-slate-600 text-xs mt-3">.xlsx · .xls · .xlsm · máximo 20MB</p>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 rounded-xl flex items-start gap-2 text-sm text-red-300"
            style={{ background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.3)' }}>
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          className="btn-primary w-full mt-5 justify-center py-3 text-base"
          onClick={handleSubmit}
          disabled={!file || loading}
        >
          {loading ? (
            <><Loader2 size={18} className="animate-spin" /> Procesando...</>
          ) : (
            <><span>Validar Excel</span><ChevronRight size={18} /></>
          )}
        </button>

        {/* What it checks */}
        <div className="mt-6 card p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">¿Qué valida?</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              ['👤', 'Nombres (Title Case)'],
              ['🪪', 'Cédulas / IDs'],
              ['📅', 'Fechas'],
              ['📧', 'Correos'],
              ['📞', 'Teléfonos'],
              ['📍', 'Barrios'],
              ['🏙️', 'Ciudades'],
              ['📊', 'Escalas 1-5'],
              ['❓', 'Resp. vacías'],
            ].map(([icon, label]) => (
              <div key={label} className="flex items-center gap-1.5 text-xs text-slate-400">
                <span>{icon}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
