// ─── ExportButton ───
// Reusable CSV download trigger. Accepts either (a) a raw array of rows +
// column definitions, or (b) a lazy callback that returns rows. We keep it
// deliberately framework-light (no xlsx dependency) — CSV with UTF-8 BOM
// opens cleanly in Excel/Google Sheets for pt-BR users.

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface ExportColumn<T> {
  key: string;
  header: string;
  /** Return the raw value (string | number | boolean | null) for a row. */
  value: (row: T) => string | number | boolean | null | undefined;
}

export interface ExportButtonProps<T> {
  /** File name without extension. Date suffix will be appended automatically. */
  filename: string;
  columns: ExportColumn<T>[];
  /** Either an array or a lazy resolver (called at click time). */
  rows: T[] | (() => T[] | Promise<T[]>);
  label?: string;
  size?: 'sm' | 'default' | 'lg' | 'icon';
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'link' | 'destructive';
  className?: string;
  disabled?: boolean;
}

function escapeCell(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'string' ? v : String(v);
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes(';')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function downloadCsv<T>(rows: T[], columns: ExportColumn<T>[], filename: string) {
  const header = columns.map((c) => escapeCell(c.header)).join(',');
  const body = rows
    .map((r) => columns.map((c) => escapeCell(c.value(r))).join(','))
    .join('\n');
  const csv = header + '\n' + body;
  // UTF-8 BOM so Excel picks up special characters.
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const datestamp = new Date().toISOString().slice(0, 10);
  a.download = `${filename}_${datestamp}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ExportButton<T>({
  filename,
  columns,
  rows,
  label = 'Exportar CSV',
  size = 'sm',
  variant = 'outline',
  className,
  disabled,
}: ExportButtonProps<T>) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading || disabled) return;
    setLoading(true);
    try {
      const resolved = typeof rows === 'function' ? await (rows as () => T[] | Promise<T[]>)() : rows;
      if (!resolved || resolved.length === 0) {
        toast.error('Nada para exportar.');
        return;
      }
      downloadCsv(resolved, columns, filename);
      toast.success(`Exportado ${resolved.length} linhas.`);
    } catch (err) {
      console.error('ExportButton error', err);
      toast.error('Falha ao exportar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={cn('gap-2', className)}
      onClick={handleClick}
      disabled={loading || disabled}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      {label}
    </Button>
  );
}
