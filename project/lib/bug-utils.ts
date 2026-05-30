import type { BugStatus, BugPriority, BugSeverity } from './database.types';

export const BUG_STATUSES: BugStatus[] = ['New', 'Open', 'In Progress', 'Testing', 'Resolved', 'Closed', 'Deferred', 'Duplicate', 'Rejected'];
export const BUG_PRIORITIES: BugPriority[] = ['Low', 'Medium', 'High', 'Urgent'];
export const BUG_SEVERITIES: BugSeverity[] = ['Minor', 'Major', 'Critical', 'Blocker'];
export const BUG_REPRODUCIBILITIES = ['Always', 'Often', 'Sometimes', 'Rarely', 'Unable', 'N/A'] as const;

export function statusColor(status: BugStatus): string {
  switch (status) {
    case 'New': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'Open': return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400';
    case 'In Progress': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    case 'Testing': return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400';
    case 'Resolved': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'Closed': return 'bg-muted text-muted-foreground';
    case 'Deferred': return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
    case 'Duplicate': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    case 'Rejected': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    default: return 'bg-muted text-muted-foreground';
  }
}

export function priorityColor(priority: BugPriority): string {
  switch (priority) {
    case 'Low': return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
    case 'Medium': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'High': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    case 'Urgent': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    default: return 'bg-muted text-muted-foreground';
  }
}

export function severityColor(severity: BugSeverity): string {
  switch (severity) {
    case 'Minor': return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
    case 'Major': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    case 'Critical': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    case 'Blocker': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-semibold';
    default: return 'bg-muted text-muted-foreground';
  }
}

export function formatBugId(bugNumber: number): string {
  return `BUG-${String(bugNumber).padStart(4, '0')}`;
}

export function fileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'excel';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'word';
  if (mimeType.includes('zip') || mimeType.includes('7z')) return 'archive';
  return 'file';
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
