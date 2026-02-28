import { useCallback, useState } from 'react';
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { parseFile, upsertRecords, buildHierarchyMaps, enrichRecords } from '@/lib/parser';
import { useAppState } from '@/lib/store';
import { toast } from 'sonner';

export default function FileUpload() {
  const { state, dispatch } = useAppState();
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setProcessing(true);
    try {
      for (const file of Array.from(files)) {
        const { records, log, crossMonthWarning } = await parseFile(file);
        
        if (crossMonthWarning) {
          toast.warning(crossMonthWarning);
        }

        const maps = buildHierarchyMaps([...state.records, ...records]);
        const enriched = enrichRecords(records, maps);
        const merged = upsertRecords(state.records, enriched);

        dispatch({ type: 'SET_RECORDS', records: merged, log, maps });
        toast.success(`${file.name}: ${log.records_count} registros importados (${log.month_key})`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao processar arquivo');
    } finally {
      setProcessing(false);
    }
  }, [state.records, dispatch]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer
        ${dragging ? 'border-primary bg-primary/5 glow-primary' : 'border-border hover:border-muted-foreground'}
        ${processing ? 'opacity-60 pointer-events-none' : ''}`}
      onClick={() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = '.csv,.xlsx,.xls';
        input.onchange = (e) => {
          const files = (e.target as HTMLInputElement).files;
          if (files) handleFiles(files);
        };
        input.click();
      }}
    >
      <div className="flex flex-col items-center gap-3">
        {processing ? (
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        ) : (
          <Upload className="h-10 w-10 text-muted-foreground" />
        )}
        <div>
          <p className="text-foreground font-medium">
            {processing ? 'Processando...' : 'Arraste arquivos CSV/XLSX aqui'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            ou clique para selecionar • Relatórios do Meta Ads
          </p>
        </div>
      </div>

      {state.importLogs.length > 0 && (
        <div className="mt-6 space-y-2 text-left max-h-32 overflow-y-auto">
          {state.importLogs.slice(-5).reverse().map(log => (
            <div key={log.id} className="flex items-center gap-2 text-sm">
              {log.status === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-positive flex-shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
              )}
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground truncate">{log.filename}</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-foreground">{log.month_key}</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">{log.records_count} registros</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
