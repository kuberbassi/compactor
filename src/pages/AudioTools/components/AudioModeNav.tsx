import { Disc, Layers, Music, Sliders } from 'lucide-react';
import { WorkspaceToolNav } from '../../../components/Workspace/WorkspaceControls';
import type { WorkspaceToolItem } from '../../../components/Workspace/WorkspaceControls';

export type AudioModeId = 'audio-optimizer' | 'audio-joiner' | 'audio-bpm-finder' | 'audio-pitch-speed';

const AUDIO_MODE_ITEMS: WorkspaceToolItem<AudioModeId>[] = [
  { id: 'audio-optimizer', label: 'Compress', Icon: Music },
  { id: 'audio-joiner', label: 'Join', Icon: Layers },
  { id: 'audio-bpm-finder', label: 'Key & BPM', Icon: Disc },
  { id: 'audio-pitch-speed', label: 'Pitch & Speed', Icon: Sliders },
];

interface AudioModeNavProps {
  activeId: string;
  onChange: (id: string) => void;
}

/** The same shared control navigation used by the other editor workspaces. */
export function AudioModeNav({ activeId, onChange }: AudioModeNavProps) {
  return (
    <WorkspaceToolNav
      items={AUDIO_MODE_ITEMS}
      activeId={activeId as AudioModeId}
      onChange={onChange}
      label="Audio controls"
    />
  );
}

export function AudioModeRail({ activeId, onChange }: AudioModeNavProps) {
  return AUDIO_MODE_ITEMS.map(({ id, label, Icon }) => (
    <button
      key={id}
      type="button"
      onClick={() => onChange(id)}
      title={label}
      aria-label={label}
      className={id === activeId ? 'audio-sidebar-rail__tool is-active' : 'audio-sidebar-rail__tool'}
    >
      <Icon aria-hidden="true" />
    </button>
  ));
}
