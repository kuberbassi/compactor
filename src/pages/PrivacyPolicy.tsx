import React from 'react';
import { BarChart3, Database, ExternalLink, FileLock2, HardDrive, Shield } from 'lucide-react';
import { ToolHeader } from '../components/Common/ToolHeader';

interface PrivacyPolicyProps { onGoHome: () => void }

const sections = [
  { icon: FileLock2, title: 'Your files', body: 'Supported editing and conversion tools process the files you select in your browser. We do not send those file contents or filenames to a Compactor file-processing server.' },
  { icon: Database, title: 'Browser storage', body: 'The app may store your theme, recent tools, editor settings, pending jobs, and local completion counts in localStorage or IndexedDB. You can remove this data through your browser settings.' },
  { icon: BarChart3, title: 'Site analytics and counters', body: 'We use Vercel Analytics to understand general site usage. The app also contacts a Compactor endpoint to read or update an aggregate processed-file count. These requests do not include your selected files.' },
  { icon: ExternalLink, title: 'External resources', body: 'A feature may contact another URL when you provide a remote image or when the app loads a required browser module or font. That provider receives ordinary network information such as your IP address.' },
];

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onGoHome }) => (
  <div className="legal-page">
    <ToolHeader title="Privacy Policy" description="What Compactor processes locally, what it stores, and when it uses the network." icon={Shield} onGoHome={onGoHome} />
    <article className="legal-document" aria-labelledby="privacy-title">
      <header className="legal-document__hero">
        <span className="legal-document__eyebrow"><Shield /> Privacy at a glance</span>
        <h1 id="privacy-title">Your file contents stay in your browser.</h1>
        <p>Compactor is designed to process selected files on your device. Limited network requests support site analytics, an aggregate usage counter, and features you explicitly ask to load from another URL.</p>
        <div className="legal-document__meta"><span>Effective September 14, 2026</span><span>No account required</span></div>
      </header>
      <div className="legal-document__grid">
        {sections.map(({ icon: Icon, title, body }) => <section key={title} className="legal-document__summary"><Icon /><div><h2>{title}</h2><p>{body}</p></div></section>)}
      </div>
      <section className="legal-document__section"><h2><span>01</span> Information we handle</h2><p>Compactor handles files you choose, along with settings needed to perform the requested operation. We do not require a profile, email address, or account. Basic technical and usage data may be collected by the hosting analytics service, and the aggregate counter records completion events without attaching file contents.</p></section>
      <section className="legal-document__section"><h2><span>02</span> Retention and control</h2><p>Selected files and generated results remain in the current browser session unless you download them or a tool keeps a local pending job. Closing or refreshing the page may discard active work. Browser preferences remain until you clear site data. Analytics retention is controlled by the analytics provider.</p></section>
      <section className="legal-document__section"><h2><span>03</span> Security and changes</h2><p>Local processing reduces file-transfer exposure, but no browser application can promise absolute security. Keep an original copy of important files and use an up-to-date browser. We may update this notice when the app’s features or data practices change; the effective date above identifies the latest version.</p></section>
      <aside className="legal-document__contact"><HardDrive /><div><strong>Questions about privacy?</strong><p>Contact the maintainer through <a href="https://kuberbassi.com" target="_blank" rel="noopener noreferrer">kuberbassi.com <ExternalLink /></a>.</p></div></aside>
    </article>
  </div>
);
