import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Download } from 'lucide-react';
import { downloadResult, type DownloadableResult } from '../../utils/batch';

interface ResultDownloadButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  result: DownloadableResult;
  children?: ReactNode;
  onDownloadError?: (error: Error) => void;
}

export function ResultDownloadButton({
  result,
  children = 'Download',
  onDownloadError,
  type = 'button',
  className,
  ...props
}: ResultDownloadButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={`result-download-action${className ? ` ${className}` : ''}`}
      onClick={() => {
        try {
          downloadResult(result);
        } catch (error) {
          onDownloadError?.(error instanceof Error ? error : new Error(String(error)));
        }
      }}
    >
      <Download className="w-4 h-4" aria-hidden="true" />
      {children}
    </button>
  );
}
