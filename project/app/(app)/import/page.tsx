'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { TopNav } from '@/components/top-nav';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X, Loader2 } from 'lucide-react';

interface ImportRow {
  mfr: string;
  model: string;
  cloudModDate: string | null;
  templateVersion: string;
  hasPdf: boolean;
}

interface ImportResult {
  added: number;
  updated: number;
  failed: number;
  errors: string[];
}

export default function ImportPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [parsing, setParsing] = useState(false);

  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      router.replace('/dashboard');
    }
  }, [profile, router]);

  const parseFile = async (f: File) => {
    setParsing(true);
    setPreview([]);
    setResult(null);

    try {
      const XLSX = await import('xlsx');
      const buffer = await f.arrayBuffer();
      let rows: ImportRow[] = [];

      if (f.name.endsWith('.csv')) {
        const text = new TextDecoder().decode(buffer);
        const lines = text.split('\n').filter(l => l.trim());
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
          if (cols.length < 2) continue;

          const mfr = cols[headers.indexOf('MFR')] || '';
          const model = cols[headers.indexOf('Relay Model')] || '';
          const date = cols[headers.indexOf('Cloud Mod Date')] || '';
          const version = cols[headers.indexOf('Cloud Min RTMS')] || '';
          const pdfStr = cols[headers.indexOf('Cloud PDF?')] || 'No';

          if (!model.trim()) continue;
          rows.push({
            mfr: mfr.trim(),
            model: model.trim(),
            cloudModDate: date.trim() || null,
            templateVersion: version.trim(),
            hasPdf: pdfStr.trim().toLowerCase() === 'yes',
          });
        }
      } else {
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });

        for (const row of data) {
          const model = row['Relay Model'] || row['model_name'] || '';
          if (!model.trim()) continue;
          rows.push({
            mfr: (row['MFR'] || row['manufacturer'] || '').trim(),
            model: model.trim(),
            cloudModDate: row['Cloud Mod Date'] || null,
            templateVersion: (row['Cloud Min RTMS'] || row['template_version'] || '').trim(),
            hasPdf: (row['Cloud PDF?'] || '').toLowerCase() === 'yes',
          });
        }
      }

      setPreview(rows);
      toast.success(`Parsed ${rows.length} rows`);
    } catch (err: any) {
      toast.error('Failed to parse file: ' + (err.message || 'Unknown error'));
    } finally {
      setParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    parseFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.csv'))) {
      setFile(f);
      parseFile(f);
    } else {
      toast.error('Please upload an XLSX or CSV file');
    }
  };

  const handleImport = async () => {
    if (preview.length === 0) return;
    setImporting(true);

    const result: ImportResult = { added: 0, updated: 0, failed: 0, errors: [] };

    const { data: existing } = await supabase
      .from('relay_models')
      .select('id, model_name');

    const existingMap = new Map(
      (existing || [] as Array<{ id: string; model_name: string }>).map((m: { id: string; model_name: string }) => [m.model_name.toLowerCase(), m.id])
    );

    for (const row of preview) {
      try {
        const existingId = existingMap.get(row.model.toLowerCase());

        let cloudModDate: string | null = null;
        if (row.cloudModDate) {
          const parsed = new Date(row.cloudModDate);
          if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900) {
            cloudModDate = parsed.toISOString();
          }
        }

        if (existingId) {
          const { error } = await supabase
            .from('relay_models')
            .update({
              manufacturer: row.mfr,
              template_version: row.templateVersion,
              has_pdf: row.hasPdf,
              ...(cloudModDate ? { cloud_mod_date: cloudModDate } : {}),
            })
            .eq('id', existingId);

          if (error) throw error;
          result.updated++;
        } else {
          const { error } = await supabase.from('relay_models').insert({
            model_name: row.model,
            manufacturer: row.mfr,
            template_version: row.templateVersion,
            has_pdf: row.hasPdf,
            status: 'active',
            ...(cloudModDate ? { cloud_mod_date: cloudModDate } : {}),
          });

          if (error) throw error;
          result.added++;
        }
      } catch (err: any) {
        result.failed++;
        result.errors.push(`${row.model}: ${err.message}`);
      }
    }

    setResult(result);
    setImporting(false);
    toast.success(`Import complete: ${result.added} added, ${result.updated} updated, ${result.failed} failed`);
  };

  const reset = () => {
    setFile(null);
    setPreview([]);
    setResult(null);
  };

  if (profile?.role !== 'admin') return null;

  return (
    <div>
      <TopNav title="Import Relay Models" description="Upload XLSX or CSV to bulk import relay model data" />

      <div className="p-6 space-y-5 max-w-4xl">
        {/* Upload area */}
        {!file && !result && (
          <div
            className="bg-card border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <FileSpreadsheet className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-foreground mb-1">Drop your file here</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Supports XLSX and CSV files with columns: MFR, Relay Model, Cloud Mod Date, Cloud Min RTMS, Cloud PDF?
            </p>
            <label
              htmlFor="file-input"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium cursor-pointer hover:bg-primary/90 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Choose File
            </label>
            <input
              id="file-input"
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        )}

        {/* File selected + parsing */}
        {file && parsing && (
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Parsing {file.name}...</p>
          </div>
        )}

        {/* Preview */}
        {file && !parsing && preview.length > 0 && !result && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground">{file.name}</h3>
                <p className="text-sm text-muted-foreground">{preview.length} rows ready to import</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={reset}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-accent transition-colors"
                >
                  <X className="w-3.5 h-3.5" /> Clear
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors"
                >
                  {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {importing ? 'Importing...' : `Import ${preview.length} Models`}
                </button>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                    <tr>
                      {['Manufacturer', 'Model Name', 'Template Version', 'Cloud Modified', 'PDF'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-t border-border/50 hover:bg-muted/20">
                        <td className="px-4 py-2 text-muted-foreground">{row.mfr}</td>
                        <td className="px-4 py-2 font-medium text-foreground">{row.model}</td>
                        <td className="px-4 py-2">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{row.templateVersion || '—'}</code>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground text-xs">
                          {row.cloudModDate ? new Date(row.cloudModDate).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-2">
                          <span className={`text-xs font-medium ${row.hasPdf ? 'text-green-600' : 'text-muted-foreground'}`}>
                            {row.hasPdf ? 'Yes' : 'No'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-semibold text-foreground mb-4">Import Complete</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                  <div className="text-3xl font-bold text-green-600">{result.added}</div>
                  <div className="text-sm text-green-700 dark:text-green-400 mt-1">Added</div>
                </div>
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                  <div className="text-3xl font-bold text-blue-600">{result.updated}</div>
                  <div className="text-sm text-blue-700 dark:text-blue-400 mt-1">Updated</div>
                </div>
                <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
                  <div className="text-3xl font-bold text-red-600">{result.failed}</div>
                  <div className="text-sm text-red-700 dark:text-red-400 mt-1">Failed</div>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-foreground mb-2">Errors:</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {result.errors.map((e, i) => (
                      <p key={i} className="text-xs text-destructive bg-destructive/10 px-3 py-1.5 rounded-lg">{e}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={reset}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent transition-colors"
              >
                Import Another File
              </button>
              <a
                href="/relay-models"
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                View Relay Models
              </a>
            </div>
          </div>
        )}

        {/* Format guide */}
        <div className="bg-muted/50 border border-border rounded-xl p-4">
          <h4 className="text-sm font-medium text-foreground mb-2">Expected CSV/XLSX columns</h4>
          <div className="flex flex-wrap gap-2">
            {['MFR', 'Relay Model', 'Cloud Mod Date', 'Cloud Min RTMS', 'Cloud PDF?'].map(col => (
              <code key={col} className="text-xs bg-background border border-border px-2 py-0.5 rounded">{col}</code>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
