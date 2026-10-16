import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MetadataEditor } from '../pages/MetadataEditor/MetadataEditor';
import * as metadataUtils from '../utils/metadata';

vi.mock('../utils/metadata', async () => {
  const actual = await vi.importActual<typeof metadataUtils>('../utils/metadata');
  return {
    ...actual,
    readAnyMetadata: vi.fn(),
    writeAnyMetadata: vi.fn(),
    stripAnyMetadata: vi.fn(),
    verifySavedMetadata: vi.fn(),
  };
});

describe('MetadataEditor Component Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders empty upload zone initially', () => {
    render(<MetadataEditor onGoHome={() => {}} onUploadSuccess={() => {}} />);
    expect(
      screen.getByText(/Upload media or image file to inspect & edit metadata/i)
    ).toBeInTheDocument();
  });

  it('handles read-only format correctly, disabling save and explaining write limitations', async () => {
    const pngFile = new File(['fake-png-data'], 'test.png', { type: 'image/png' });

    vi.mocked(metadataUtils.readAnyMetadata).mockResolvedValueOnce({
      formatCategory: 'image',
      containerFormat: 'png',
      entries: [
        {
          id: 'chunk:Title',
          rawKey: 'Title',
          label: 'Title',
          value: 'PNG Test Title',
          source: 'chunk',
          isEditable: false,
          readOnlyReason: 'PNG format metadata is read-only client-side',
          group: 'PNG CHUNKS',
        },
      ],
      friendlyValues: {
        imageDescription: 'PNG Test Title',
      },
      coverUrl: null,
      coverBlob: null,
      capabilities: metadataUtils.FORMAT_CAPABILITY_REGISTRY.png,
      hasMetadata: true,
    });

    render(<MetadataEditor onGoHome={() => {}} onUploadSuccess={() => {}} />);

    // Select file
    const uploaderInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(uploaderInput, { target: { files: [pngFile] } });

    await waitFor(() => {
      expect(screen.getAllByText('Read-Only Format').length).toBeGreaterThan(0);
    });

    // Check save button is disabled
    const saveButton = screen.getByRole('button', { name: /Save File/i });
    expect(saveButton).toBeDisabled();
    expect(screen.getByText(/Save disabled \(read-only format\)/i)).toBeInTheDocument();

    // Check read-only badge and notice
    expect(screen.getByText(/PNG metadata modification is not safely supported client-side/i)).toBeInTheDocument();
  });

  it('allows editing an editable format and disables Save when there are no changes', async () => {
    const mp3File = new File(['fake-mp3-data'], 'song.mp3', { type: 'audio/mpeg' });

    vi.mocked(metadataUtils.readAnyMetadata).mockResolvedValueOnce({
      formatCategory: 'audio',
      containerFormat: 'mp3',
      entries: [
        {
          id: 'title',
          rawKey: 'title',
          label: 'Title',
          value: 'Original Song',
          source: 'id3',
          isEditable: true,
          group: 'CONTAINER METADATA',
        },
      ],
      friendlyValues: {
        title: 'Original Song',
        artist: 'Original Artist',
      },
      coverUrl: null,
      coverBlob: null,
      capabilities: metadataUtils.FORMAT_CAPABILITY_REGISTRY.mp3,
      hasMetadata: true,
    });

    render(<MetadataEditor onGoHome={() => {}} onUploadSuccess={() => {}} />);

    const uploaderInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(uploaderInput, { target: { files: [mp3File] } });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Original Song')).toBeInTheDocument();
    });

    // No changes initially -> Save should be disabled
    const saveButton = screen.getByRole('button', { name: /Save File/i });
    expect(saveButton).toBeDisabled();
    expect(screen.getByText(/No changes to save/i)).toBeInTheDocument();

    // Make a change
    const titleInput = screen.getByDisplayValue('Original Song');
    fireEvent.change(titleInput, { target: { value: 'Updated Song' } });

    // Now Save should be enabled
    expect(saveButton).not.toBeDisabled();
  });

  it('validates year format and prevents saving when invalid', async () => {
    const mp3File = new File(['fake-mp3-data'], 'song.mp3', { type: 'audio/mpeg' });

    vi.mocked(metadataUtils.readAnyMetadata).mockResolvedValueOnce({
      formatCategory: 'audio',
      containerFormat: 'mp3',
      entries: [],
      friendlyValues: { title: 'Song' },
      coverUrl: null,
      coverBlob: null,
      capabilities: metadataUtils.FORMAT_CAPABILITY_REGISTRY.mp3,
      hasMetadata: false,
    });

    render(<MetadataEditor onGoHome={() => {}} onUploadSuccess={() => {}} />);

    const uploaderInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(uploaderInput, { target: { files: [mp3File] } });

    await waitFor(() => {
      expect(screen.getByText('File & Capabilities')).toBeInTheDocument();
    });

    const yearInput = screen.getByPlaceholderText(/e\.g\. 1808 or 2026/i);
    fireEvent.change(yearInput, { target: { value: 'invalid-year' } });

    // Validation warning should appear
    expect(
      screen.getByText(/Release Date \/ Year should be a 4-digit year/i)
    ).toBeInTheDocument();

    const saveButton = screen.getByRole('button', { name: /Save File/i });
    expect(saveButton).toBeDisabled();
  });

  it('switches between common form and searchable tag inventory', async () => {
    const mp3File = new File(['fake-mp3-data'], 'song.mp3', { type: 'audio/mpeg' });

    vi.mocked(metadataUtils.readAnyMetadata).mockResolvedValueOnce({
      formatCategory: 'audio',
      containerFormat: 'mp3',
      entries: [
        {
          id: 'title',
          rawKey: 'title',
          label: 'Title',
          value: 'Unique Track ABC',
          source: 'id3',
          isEditable: true,
          group: 'CONTAINER METADATA',
        },
        {
          id: 'stream:0:handler_name',
          rawKey: 'handler_name',
          label: 'Stream Handler (Audio #0)',
          value: 'SoundHandler',
          source: 'stream',
          streamIndex: 0,
          isEditable: false,
          group: 'AUDIO STREAM #0',
        },
      ],
      friendlyValues: { title: 'Unique Track ABC' },
      coverUrl: null,
      coverBlob: null,
      capabilities: metadataUtils.FORMAT_CAPABILITY_REGISTRY.mp3,
      hasMetadata: true,
    });

    render(<MetadataEditor onGoHome={() => {}} onUploadSuccess={() => {}} />);

    const uploaderInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(uploaderInput, { target: { files: [mp3File] } });

    await waitFor(() => {
      expect(screen.getByText(/All Tags Inventory \(2\)/i)).toBeInTheDocument();
    });

    // Switch to inventory tab
    const inventoryTab = screen.getByRole('button', { name: /All Tags Inventory/i });
    fireEvent.click(inventoryTab);

    expect(screen.getByText('Discovered Tag Inventory')).toBeInTheDocument();
    expect(screen.getByText('Unique Track ABC')).toBeInTheDocument();
    expect(screen.getByText('SoundHandler')).toBeInTheDocument();

    // Test search filter
    const searchInput = screen.getByPlaceholderText(/Search tags, keys, values\.\.\./i);
    fireEvent.change(searchInput, { target: { value: 'SoundHandler' } });

    expect(screen.queryByText('Unique Track ABC')).not.toBeInTheDocument();
    expect(screen.getByText('SoundHandler')).toBeInTheDocument();
  });

  it('runs metadata stripping workflow with confirmation modal and verified scope', async () => {
    const mp3File = new File(['fake-mp3-data'], 'song.mp3', { type: 'audio/mpeg' });

    vi.mocked(metadataUtils.readAnyMetadata).mockResolvedValueOnce({
      formatCategory: 'audio',
      containerFormat: 'mp3',
      entries: [
        {
          id: 'title',
          rawKey: 'title',
          label: 'Title',
          value: 'Song',
          source: 'id3',
          isEditable: true,
          group: 'CONTAINER METADATA',
        },
      ],
      friendlyValues: { title: 'Song' },
      coverUrl: null,
      coverBlob: null,
      capabilities: metadataUtils.FORMAT_CAPABILITY_REGISTRY.mp3,
      hasMetadata: true,
    });

    vi.mocked(metadataUtils.stripAnyMetadata).mockResolvedValueOnce({
      blob: new Blob(['stripped']),
      url: 'blob:stripped-url',
      name: 'song_clean.mp3',
    });

    render(<MetadataEditor onGoHome={() => {}} onUploadSuccess={() => {}} />);

    const uploaderInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(uploaderInput, { target: { files: [mp3File] } });

    await waitFor(() => {
      expect(screen.getByText(/Strip Identifying Metadata/i)).toBeInTheDocument();
    });

    // Open removal modal
    const stripButton = screen.getByRole('button', { name: /Strip Identifying Metadata/i });
    fireEvent.click(stripButton);

    expect(screen.getByText(/Verified Removal Scope for/i)).toBeInTheDocument();
    expect(screen.getByText(/Clears all ID3v2\/v1 tags/i)).toBeInTheDocument();

    // Confirm strip
    const confirmButton = screen.getByRole('button', { name: /Confirm & Strip/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText('Metadata Stripped!')).toBeInTheDocument();
    });

    expect(metadataUtils.stripAnyMetadata).toHaveBeenCalledTimes(1);
  });

  it('reports post-save verification details correctly on save completion', async () => {
    const mp3File = new File(['fake-mp3-data'], 'song.mp3', { type: 'audio/mpeg' });

    vi.mocked(metadataUtils.readAnyMetadata).mockResolvedValueOnce({
      formatCategory: 'audio',
      containerFormat: 'mp3',
      entries: [],
      friendlyValues: { title: 'Initial' },
      coverUrl: null,
      coverBlob: null,
      capabilities: metadataUtils.FORMAT_CAPABILITY_REGISTRY.mp3,
      hasMetadata: false,
    });

    vi.mocked(metadataUtils.writeAnyMetadata).mockResolvedValueOnce({
      blob: new Blob(['saved']),
      url: 'blob:saved-url',
      name: 'song_tagged.mp3',
    });

    vi.mocked(metadataUtils.verifySavedMetadata).mockResolvedValueOnce({
      verified: true,
      persistedCount: 2,
      droppedCount: 0,
      normalizedCount: 0,
      details: {
        retained: ['title', 'artist'],
        dropped: [],
        normalized: [],
      },
    });

    render(<MetadataEditor onGoHome={() => {}} onUploadSuccess={() => {}} />);

    const uploaderInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(uploaderInput, { target: { files: [mp3File] } });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Initial')).toBeInTheDocument();
    });

    // Change title
    const titleInput = screen.getByDisplayValue('Initial');
    fireEvent.change(titleInput, { target: { value: 'New Track Name' } });

    const saveButton = screen.getByRole('button', { name: /Save File/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Metadata Processed!')).toBeInTheDocument();
    });

    expect(screen.getByText('Round-Trip Verification Report')).toBeInTheDocument();
    expect(screen.getByText('All Changes Verified')).toBeInTheDocument();
    expect(screen.getByText(/Retained tags: title, artist/i)).toBeInTheDocument();
  });

  it('handles rapid file selection gracefully, ignoring superseded async reads', async () => {
    const file1 = new File(['data1'], 'file1.mp3', { type: 'audio/mpeg' });
    const file2 = new File(['data2'], 'file2.jpg', { type: 'image/jpeg' });

    // Mock readAnyMetadata: file1 takes a long delay, file2 finishes quickly
    vi.mocked(metadataUtils.readAnyMetadata).mockImplementation(async (f: File) => {
      if (f.name === 'file1.mp3') {
        await new Promise((res) => setTimeout(res, 100));
        return {
          formatCategory: 'audio',
          containerFormat: 'mp3',
          entries: [],
          friendlyValues: { title: 'File 1 Title' },
          coverUrl: null,
          coverBlob: null,
          capabilities: metadataUtils.FORMAT_CAPABILITY_REGISTRY.mp3,
          hasMetadata: true,
        };
      } else {
        return {
          formatCategory: 'image',
          containerFormat: 'jpg',
          entries: [],
          friendlyValues: { make: 'File 2 Make' },
          coverUrl: null,
          coverBlob: null,
          capabilities: metadataUtils.FORMAT_CAPABILITY_REGISTRY.jpg,
          hasMetadata: true,
        };
      }
    });

    render(<MetadataEditor onGoHome={() => {}} onUploadSuccess={() => {}} />);

    const uploaderInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    // Select file 1
    fireEvent.change(uploaderInput, { target: { files: [file1] } });

    await waitFor(() => {
      expect(screen.getByDisplayValue('File 1 Title')).toBeInTheDocument();
    });

    // Reset and select file 2
    const homeBtn = screen.getByTitle('Back to all tools');
    fireEvent.click(homeBtn);

    await waitFor(() => {
      expect(screen.getByText(/Upload media or image file/i)).toBeInTheDocument();
    });

    const secondUploaderInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(secondUploaderInput, { target: { files: [file2] } });

    await waitFor(() => {
      expect(screen.getByDisplayValue('File 2 Make')).toBeInTheDocument();
    });
    expect(screen.queryByDisplayValue('File 1 Title')).not.toBeInTheDocument();
  });
});
