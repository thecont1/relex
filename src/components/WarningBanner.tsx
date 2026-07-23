import type { WorkbookIssue } from '../lib/types';

interface Props {
  issues: WorkbookIssue[];
}

export function WarningBanner({ issues }: Props) {
  const warnings = issues.filter(i => i.severity === 'warning');
  if (warnings.length === 0) return null;
  return (
    <aside className="banner banner-warning" role="status" aria-live="polite">
      <span className="banner-icon" aria-hidden="true">!</span>
      <div>
        <strong>Data quality warnings ({warnings.length})</strong>
        <ul>
          {warnings.slice(0, 8).map((w, i) => (
            <li key={i}>
              <em>{w.sheet}{w.rowIndex ? `, row ${w.rowIndex}` : ''}:</em> {w.message}
            </li>
          ))}
          {warnings.length > 8 && <li>…and {warnings.length - 8} more</li>}
        </ul>
      </div>
    </aside>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="banner banner-error" role="alert">
      <span className="banner-icon" aria-hidden="true">×</span>
      <div>
        <strong>Workbook could not be loaded.</strong>
        <p style={{ marginTop: 4 }}>{message}</p>
        <p style={{ marginTop: 4, fontSize: 'var(--fs-xs)' }}>
          Verify that the workbook exists at the configured data source path and contains the required sheets and columns.
        </p>
      </div>
    </div>
  );
}