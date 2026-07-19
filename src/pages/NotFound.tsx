import { ArrowLeft } from 'lucide-react';
import { BrandMark } from '../components/Common/BrandMark';

export function NotFound({ onGoHome }: { onGoHome: () => void }) {
  return <section className="not-found">
    <BrandMark className="not-found__mark" />
    <span>404</span>
    <h1>This page went missing.</h1>
    <p>That tool is not here, but the rest of Compactor is ready when you are.</p>
    <button className="button" onClick={onGoHome}><ArrowLeft size={15} /> Back to all tools</button>
  </section>;
}
