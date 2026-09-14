import { CheckCircle, X } from 'lucide-react';
import { createPortal } from 'react-dom';

interface ExportNoticeProps { fileName: string; onDismiss: () => void; }

export const ExportNotice: React.FC<ExportNoticeProps> = ({ fileName, onDismiss }) => {
  const notice = (
    <div className="export-notice" role="status" aria-live="polite">
      <CheckCircle aria-hidden="true" />
      <div><strong>Export complete</strong><span title={fileName}>{fileName}</span></div>
      <button type="button" onClick={onDismiss} aria-label="Dismiss export message"><X aria-hidden="true" /></button>
    </div>
  );

  return typeof document === 'undefined' ? notice : createPortal(notice, document.body);
};
