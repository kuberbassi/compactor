import type { CompressionPreset } from '../../utils/batch';

interface CompressionPresetSelectorProps {
  value: CompressionPreset;
  onChange: (preset: CompressionPreset) => void;
}

const PRESETS: Array<{ value: CompressionPreset; label: string; description: string }> = [
  { value: 'light', label: 'Light', description: 'Best quality, smaller reduction' },
  { value: 'balanced', label: 'Balanced', description: 'Recommended for everyday use' },
  { value: 'maximum', label: 'Maximum', description: 'Smallest file, reduced quality' },
];

export const CompressionPresetSelector = ({ value, onChange }: CompressionPresetSelectorProps) => (
  <fieldset className="compression-presets">
    <legend>Compression strength</legend>
    <div className="compression-presets__grid">
      {PRESETS.map(preset => (
        <button
          key={preset.value}
          type="button"
          aria-pressed={value === preset.value}
          onClick={() => onChange(preset.value)}
          className={`compression-presets__item ${value === preset.value ? 'compression-presets__item--active' : ''}`}
        >
          <span>{preset.label}{preset.value === 'balanced' ? ' · Recommended' : ''}</span>
          <small>{preset.description}</small>
        </button>
      ))}
    </div>
  </fieldset>
);
