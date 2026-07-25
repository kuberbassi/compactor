import React from 'react';
import { ToolHeader } from '../components/Common/ToolHeader';
import { Shield, Lock, EyeOff, Server } from 'lucide-react';
import { Card } from '../components/ui/card';

interface PrivacyPolicyProps {
  onGoHome: () => void;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onGoHome }) => {
  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-4 py-2 sm:py-8 space-y-4 sm:space-y-8">
      <ToolHeader 
        title="Privacy Policy" 
        description="Compactor is engineered with 100% client-side privacy. Your files never leave your device." 
        icon={Shield} 
        onGoHome={onGoHome} 
      />

      <div className="space-y-6">
        <Card className="border-[var(--border-color)] bg-[var(--surface-color)] p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3 border-b border-[var(--border-color)] pb-4">
            <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--text-primary)]">Zero Server Uploads</h3>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">Your files stay on your hardware at all times.</p>
            </div>
          </div>

          <div className="space-y-4 text-xs text-[var(--text-secondary)] leading-relaxed">
            <p>
              At <strong className="text-[var(--text-primary)]">Compactor</strong>, privacy is not an afterthought — it is the fundamental core of our architecture. Every video compression, PDF edit, image optimization, audio transcode, and format conversion is executed <strong className="text-[var(--text-primary)]">100% inside your web browser</strong> using client-side WebAssembly and HTML5 technologies.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-zinc-950/60 border border-[var(--border-color)] space-y-2">
                <div className="flex items-center gap-2 text-white font-bold text-xs">
                  <Server className="w-4 h-4 text-rose-400" />
                  <span>No Backend Servers</span>
                </div>
                <p className="text-[11px]">We do not operate file upload servers. Your documents, photos, and videos are never sent over the internet.</p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950/60 border border-[var(--border-color)] space-y-2">
                <div className="flex items-center gap-2 text-white font-bold text-xs">
                  <EyeOff className="w-4 h-4 text-emerald-400" />
                  <span>No Tracking & No Storage</span>
                </div>
                <p className="text-[11px]">We do not log file contents, filenames, or personal identifiers. Your data remains strictly confidential.</p>
              </div>
            </div>

            <div className="pt-4 border-t border-[var(--border-color)] space-y-2">
              <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Local Storage Usage</h4>
              <p>
                Compactor uses standard browser features (`localStorage` and `IndexedDB`) solely to persist non-sensitive user preferences and an aggregate file completion metric on your local device.
              </p>
            </div>

            <div className="pt-2 border-t border-[var(--border-color)] space-y-1">
              <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Contact & Inquiries</h4>
              <p>
                If you have any questions regarding this Privacy Policy, please visit{' '}
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
