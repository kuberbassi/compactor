import { Download, FilePlus2, RotateCcw } from 'lucide-react';
import { CompactShell } from './CompactShell';
import { downloadAsZip, downloadResult, type DownloadableResult } from '../../utils/batch';
import { formatBytes } from '../../utils/image';

interface CompactResultScreenProps {
  title: string;
  results: DownloadableResult[];
  originalSize?: number;
  outputSize?: number;
  failed?: number;
  zipName: string;
  onNewBatch: () => void;
  onGoHome: () => void;
}

export function CompactResultScreen({ title, results, originalSize, outputSize, failed = 0, zipName, onNewBatch, onGoHome }: CompactResultScreenProps) {
  const single = results.length === 1 ? results[0] : null;
  return <CompactShell title="Results" eyebrow={title} onBack={onNewBatch}>
    <section className="compact-result-page" aria-labelledby="compact-result-title">
      <span className="compact-result-page__icon"><Download aria-hidden="true" /></span>
      <p className="compact-kicker">Processing complete</p>
      <h1 id="compact-result-title">{results.length} {results.length === 1 ? 'file is' : 'files are'} ready.</h1>
      <p>{failed ? `${failed} ${failed === 1 ? 'file could' : 'files could'} not be processed. Your successful results are still ready.` : 'Your files were processed locally and are ready to save.'}</p>
    </section>
    {originalSize !== undefined && outputSize !== undefined ? <section className="compact-results__sizes" aria-label="Result sizes"><span>Before <b>{formatBytes(originalSize)}</b></span><span>After <b>{formatBytes(outputSize)}</b></span></section> : null}
    {originalSize !== undefined && outputSize === originalSize ? <p className="compact-result-note">The source already met the selected size limit, so Compactor preserved it without unnecessary quality loss.</p> : null}
    <section className="compact-result-downloads" aria-label="Downloads">
      {single ? <button type="button" className="compact-primary-action compact-primary-action--inline compact-download-action" onClick={() => downloadResult(single)}><Download /><span><b>Download</b><small>{single.name}</small></span></button> : <button type="button" className="compact-primary-action compact-primary-action--inline" onClick={() => void downloadAsZip(results, zipName)}><Download /> Download {results.length} files as ZIP</button>}
      {results.length > 1 ? <div className="compact-result-downloads__list">{results.map(result => <button type="button" key={result.name} onClick={() => downloadResult(result)}><span>{result.name}</span><Download aria-hidden="true" /></button>)}</div> : null}
    </section>
    <div className="compact-result-actions"><button type="button" className="compact-secondary-action" onClick={onNewBatch}><FilePlus2 /> Process more files</button><button type="button" className="compact-link-action" onClick={onGoHome}><RotateCcw /> Choose another tool</button></div>
  </CompactShell>;
}
