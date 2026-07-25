import React from 'react';
import { ToolHeader } from '../components/Common/ToolHeader';
import { FileText, CheckCircle2, AlertCircle, Scale } from 'lucide-react';
import { Card } from '../components/ui/card';

interface TermsConditionsProps {
  onGoHome: () => void;
}

export const TermsConditions: React.FC<TermsConditionsProps> = ({ onGoHome }) => {
  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-4 py-2 sm:py-8 space-y-4 sm:space-y-8">
      <ToolHeader 
        title="Terms & Conditions" 
        description="Simple, transparent terms for using Compactor's 100% client-side web application." 
        icon={FileText} 
        onGoHome={onGoHome} 
      />

      <div className="space-y-6">
        <Card className="border-[var(--border-color)] bg-[var(--surface-color)] p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3 border-b border-[var(--border-color)] pb-4">
            <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--text-primary)]">Terms of Service</h3>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">Effective date: January 2026</p>
            </div>
          </div>

          <div className="space-y-5 text-xs text-[var(--text-secondary)] leading-relaxed">
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> 1. Acceptance of Terms
              </h4>
              <p>
                By accessing or using <strong className="text-[var(--text-primary)]">Compactor</strong>, you agree to be bound by these simple Terms & Conditions. Compactor is provided free of charge as a client-side media processing and format conversion utility.
              </p>
            </div>

            <div className="space-y-2 pt-3 border-t border-[var(--border-color)]">
              <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> 2. Client-Side Software License
              </h4>
              <p>
                Compactor executes open-source client-side WebAssembly modules (FFmpeg, pdf-lib) within your browser environment. You are granted a personal, non-exclusive, non-transferable license to use the application for personal or commercial file processing.
              </p>
            </div>

            <div className="space-y-2 pt-3 border-t border-[var(--border-color)]">
              <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400" /> 3. Disclaimer of Warranty
              </h4>
              <p>
                Compactor is provided "AS IS" and "AS AVAILABLE" without warranties of any kind. While all tools are designed for maximum precision, you are encouraged to maintain backups of your original files prior to compression or conversion.
              </p>
            </div>

            <div className="space-y-2 pt-3 border-t border-[var(--border-color)]">
              <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> 4. Intellectual Property & Author
              </h4>
              <p>
                Compactor is created and maintained by <strong className="text-[var(--text-primary)]">Kuber Bassi</strong>. For more information or custom inquiries, please visit{' '}
                <a href="https://kuberbassi.com" target="_blank" rel="noopener noreferrer" className="text-[var(--text-primary)] hover:underline font-bold">
                  kuberbassi.com
                </a>.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
