import type { CompressionPreset } from '../../utils/batch';

interface CompressionPresetSelectorProps {
  value: CompressionPreset;
  onChange: (preset: CompressionPreset) => void;
  compact?: boolean;
}

const PRESETS: Array<{ value: CompressionPreset; label: string; hint: string }> = [
  { value: 'light', label: 'Light', hint: 'High quality' },
  { value: 'balanced', label: 'Balanced', hint: 'Recommended' },
  { value: 'maximum', label: 'Max', hint: 'Smallest file' },
];

export const CompressionPresetSelector = ({ value, onChange, compact = false }: CompressionPresetSelectorProps) => (
  <div className={`space-y-1.5 ${compact ? 'compression-presets--compact' : ''}`}>
    <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400">
      <span>Compression strength</span>
      <span className="text-zinc-500 text-[10px]">
        {PRESETS.find(p => p.value === value)?.hint || 'Balanced'}
      </span>
    </div>
    <div className="grid grid-cols-3 gap-1 p-1 bg-zinc-900/90 border border-zinc-800 rounded-xl">
      {PRESETS.map(preset => (
        <button
          key={preset.value}
          type="button"
          aria-pressed={value === preset.value}
          onClick={() => onChange(preset.value)}
          className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all text-center cursor-pointer select-none ${
            value === preset.value
              ? 'bg-zinc-100 text-zinc-950 shadow-sm font-bold'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
          }`}
        >
          {preset.label}
        </button>
      ))}
    </div>
  </div>
);
