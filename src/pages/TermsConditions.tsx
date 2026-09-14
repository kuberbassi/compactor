import React from 'react';
import { AlertTriangle, ExternalLink, FileCheck2, FileText, Scale } from 'lucide-react';
import { ToolHeader } from '../components/Common/ToolHeader';

interface TermsConditionsProps { onGoHome: () => void }

const terms = [
  ['01', 'Using Compactor', 'You may use Compactor for lawful personal or commercial file work. You are responsible for the files you use, the instructions you provide, and ensuring you have the rights and permissions required to process that material.'],
  ['02', 'Your files and output', 'You retain your rights in your files and generated output. Compactor does not claim ownership of them. Processing occurs in your browser for supported operations, and you are responsible for reviewing every result before relying on or distributing it.'],
  ['03', 'Acceptable use', 'Do not use the service to violate law, infringe intellectual property or privacy rights, distribute malware, evade security controls, or interfere with the app or its hosting infrastructure.'],
  ['04', 'Availability and changes', 'The service is provided without a guaranteed uptime or support commitment. Features, supported formats, limits, and these terms may change as the product develops. Continued use after an update means you accept the revised terms.'],
  ['05', 'No warranties', 'Compactor is provided “as is” and “as available.” File conversion can alter formatting, metadata, quality, or compatibility. Keep backups of important originals and verify exported files before deleting source material.'],
  ['06', 'Limitation of responsibility', 'To the extent permitted by applicable law, the maintainer is not responsible for indirect, incidental, special, consequential, or data-loss damages arising from your use of, or inability to use, Compactor.'],
] as const;

export const TermsConditions: React.FC<TermsConditionsProps> = ({ onGoHome }) => (
  <div className="legal-page">
    <ToolHeader title="Terms of Use" description="Clear conditions for using Compactor and handling your files responsibly." icon={FileText} onGoHome={onGoHome} />
    <article className="legal-document" aria-labelledby="terms-title">
      <header className="legal-document__hero legal-document__hero--terms">
        <span className="legal-document__eyebrow"><Scale /> Terms at a glance</span>
        <h1 id="terms-title">Use the tools responsibly. Check every result.</h1>
        <p>These terms apply when you access or use Compactor. By using the service, you agree to them.</p>
        <div className="legal-document__meta"><span>Effective September 14, 2026</span><span>Free browser utility</span></div>
      </header>
      <div className="legal-document__notice"><AlertTriangle /><div><strong>Keep your originals</strong><p>Conversions and edits can be irreversible after download. Review output before replacing an important source file.</p></div></div>
      <div className="legal-document__terms">
        {terms.map(([number, title, body]) => <section key={number} className="legal-document__section"><h2><span>{number}</span>{title}</h2><p>{body}</p></section>)}
      </div>
      <aside className="legal-document__contact"><FileCheck2 /><div><strong>Questions about these terms?</strong><p>Contact the maintainer through <a href="https://kuberbassi.com" target="_blank" rel="noopener noreferrer">kuberbassi.com <ExternalLink /></a>.</p></div></aside>
    </article>
  </div>
);
