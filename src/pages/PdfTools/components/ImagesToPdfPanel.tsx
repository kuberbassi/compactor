import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, FileImage, Images, PanelLeft, PanelLeftClose, Palette, Plus, RotateCw, Trash2, ZoomIn } from 'lucide-react';
import { FileUploader } from '../../../components/Common/FileUploader';
import { EditorCommandBar, EditorSidebar, EditorSidebarHeader } from '../../../components/Workspace/EditorChrome';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { formatBytes } from '../../../utils/image';
import { applyDocumentScanFilter } from '../../../utils/pdf';
import type { PdfFileInfo } from './LivePdfPreview';

export interface ImagesToPdfPanelProps {
  multipleFiles: PdfFileInfo[];
  imgFilter: 'original' | 'bw' | 'smart-scan' | 'camscanner' | 'whiteboard' | 'vibrant';
  setImgFilter: (filter: 'original' | 'bw' | 'smart-scan' | 'camscanner' | 'whiteboard' | 'vibrant') => void;
  imgOrientation: 'portrait' | 'landscape' | 'auto';
  setImgOrientation: (orientation: 'portrait' | 'landscape' | 'auto') => void;
  imgPageSize: 'fit' | 'a4' | 'letter';
  setImgPageSize: (size: 'fit' | 'a4' | 'letter') => void;
  imgMargin: 'none' | 'small' | 'big';
  setImgMargin: (margin: 'none' | 'small' | 'big') => void;
  onMoveItem: (from: number, to: number) => void;
  onRemoveItem: (index: number) => void;
  onPeekImage: (index: number) => void;
  onAddFiles: (files: File[]) => void;
  onClearAll: () => void;
  onRunConvert: () => void;
  rotations: number[];
  onRotateItem: (index: number) => void;
  toolSelector?: React.ReactNode;
}

const ImageQueueThumbnail: React.FC<{ file: File; filter: ImagesToPdfPanelProps['imgFilter']; rotation: number; onOpen: () => void }> = ({ file, filter, rotation, onOpen }) => {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let active = true;
    let generatedUrl = '';
    const sourceUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      if (!active) return;
      const sourceWidth = image.naturalWidth || image.width || 800;
      const sourceHeight = image.naturalHeight || image.height || 600;
      const isQuarterTurn = rotation % 180 !== 0;
      const maxDimension = 1200;
      const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
      const drawWidth = Math.max(1, Math.round(sourceWidth * scale));
      const drawHeight = Math.max(1, Math.round(sourceHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = isQuarterTurn ? drawHeight : drawWidth;
      canvas.height = isQuarterTurn ? drawWidth : drawHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      applyDocumentScanFilter(ctx, canvas.width, canvas.height, filter);
      generatedUrl = canvas.toDataURL('image/jpeg', 0.92);
      if (active) setUrl(generatedUrl);
    };
    image.src = sourceUrl;
    return () => { active = false; URL.revokeObjectURL(sourceUrl); };
  }, [file, filter, rotation]);
  return (
    <button type="button" onClick={onOpen} className="pdf-image-card__preview" aria-label={`Preview ${file.name}`}>
      {url && <img src={url} alt="" />}
      <span><ZoomIn aria-hidden="true" /> Preview</span>
    </button>
  );
};

export const ImagesToPdfPanel: React.FC<ImagesToPdfPanelProps> = ({
  multipleFiles, imgFilter, setImgFilter, imgOrientation, setImgOrientation,
  imgPageSize, setImgPageSize, imgMargin, setImgMargin, onMoveItem,
  onRemoveItem, onPeekImage, onAddFiles, onClearAll, onRunConvert, rotations, onRotateItem, toolSelector,
}) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const totalBytes = multipleFiles.reduce((sum, item) => sum + item.file.size, 0);
  const firstFile = multipleFiles[0]?.file;
  const addInputFiles = (input: HTMLInputElement) => {
    if (input.files?.length) onAddFiles(Array.from(input.files));
    input.value = '';
  };

  return (
    <section className={`pdf-organizer pdf-images-workspace ${isSidebarCollapsed ? 'is-page-panel-collapsed' : ''}`} aria-label="Images to PDF">
      <EditorCommandBar className="pdf-organizer__commandbar">
        <div className="pdf-organizer__file">
          <FileImage aria-hidden="true" />
          <div>
            <strong title={firstFile?.name || 'Images to PDF'}>{firstFile?.name || 'Images to PDF'}</strong>
            <span>{multipleFiles.length} {multipleFiles.length === 1 ? 'image' : 'images'} · {formatBytes(totalBytes)}</span>
          </div>
        </div>
        <div className="pdf-organizer__header-actions">
          {toolSelector}
          <div className="pdf-organizer__commands" aria-label="Image conversion commands">
            <span className="pdf-organizer__separator" />
            {multipleFiles.length > 0 && <button type="button" className="pdf-organizer__change" onClick={onClearAll}>Change files</button>}
            <button type="button" className="pdf-organizer__export" onClick={onRunConvert} disabled={!multipleFiles.length}>
              <FileImage aria-hidden="true" /><span>Convert to PDF</span>
            </button>
          </div>
        </div>
      </EditorCommandBar>

      <div className="pdf-organizer__workspace">
        <EditorSidebar className="pdf-organizer__pages" aria-label="Image to PDF controls">
          <EditorSidebarHeader className="pdf-organizer__pages-heading">
            <div className="pdf-sidebar-heading-row"><strong>PDF setup</strong><small className="pdf-sidebar-page-badge">{multipleFiles.length} {multipleFiles.length === 1 ? 'image' : 'images'}</small></div>
            <button type="button" onClick={() => setIsSidebarCollapsed(value => !value)} title={isSidebarCollapsed ? 'Expand controls' : 'Collapse controls'}>
              {isSidebarCollapsed ? <PanelLeft aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
            </button>
          </EditorSidebarHeader>

          {isSidebarCollapsed ? (
            <div className="pdf-sidebar-rail pdf-image-sidebar-rail">
              <button type="button" onClick={() => setIsSidebarCollapsed(false)} title="Open PDF setup" aria-label="Open PDF setup">
                <Palette aria-hidden="true" />
                <span>Setup</span>
              </button>
              <span className="pdf-image-sidebar-rail__divider" />
              <label title="Add more images" aria-label="Add more images">
                <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" onChange={event => addInputFiles(event.currentTarget)} />
                <Plus aria-hidden="true" />
                <span>Add</span>
              </label>
              {multipleFiles.length > 0 && <small aria-label={`${multipleFiles.length} images in sequence`}>{multipleFiles.length}</small>}
            </div>
          ) : (
            <div className="pdf-image-settings workbench-scroll-region">
              <div className="pdf-control-group">
                <label><Palette aria-hidden="true" /> Document filter</label>
                <Select
                  value={imgFilter === 'camscanner' ? 'smart-scan' : imgFilter}
                  onValueChange={value => value && setImgFilter(value as 'original' | 'bw' | 'smart-scan' | 'whiteboard' | 'vibrant')}
                >
                  <SelectTrigger><SelectValue>{imgFilter === 'bw' ? 'Black & white' : imgFilter === 'whiteboard' ? 'Whiteboard clean' : imgFilter === 'vibrant' ? 'Vibrant' : imgFilter === 'original' ? 'Original' : 'High contrast'}</SelectValue></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="smart-scan">High contrast</SelectItem><SelectItem value="whiteboard">Whiteboard clean</SelectItem>
                    <SelectItem value="bw">Black &amp; white</SelectItem><SelectItem value="vibrant">Vibrant</SelectItem><SelectItem value="original">Original</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="pdf-control-group">
                <label>Orientation</label>
                <div className="pdf-segmented-control is-three">
                  {(['auto', 'portrait', 'landscape'] as const).map(option => <button key={option} type="button" className={imgOrientation === option ? 'is-active' : ''} onClick={() => setImgOrientation(option)}>{option}</button>)}
                </div>
              </div>
              <div className="pdf-control-group">
                <label>Page size</label>
                <Select value={imgPageSize} onValueChange={value => setImgPageSize(value as 'fit' | 'a4' | 'letter')}>
                  <SelectTrigger><SelectValue>{imgPageSize === 'fit' ? 'Fit image' : imgPageSize === 'a4' ? 'A4' : 'US Letter'}</SelectValue></SelectTrigger><SelectContent><SelectItem value="fit">Fit image</SelectItem><SelectItem value="a4">A4</SelectItem><SelectItem value="letter">US Letter</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="pdf-control-group">
                <label>Page margin</label>
                <Select value={imgMargin} onValueChange={value => setImgMargin(value as 'none' | 'small' | 'big')}>
                  <SelectTrigger><SelectValue>{imgMargin === 'none' ? 'None' : imgMargin === 'small' ? 'Small' : 'Large'}</SelectValue></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="small">Small</SelectItem><SelectItem value="big">Large</SelectItem></SelectContent>
                </Select>
              </div>
              <label className="pdf-add-files"><input type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" onChange={event => addInputFiles(event.currentTarget)} /><Plus aria-hidden="true" /> Add images</label>
            </div>
          )}
        </EditorSidebar>

        <main className="pdf-organizer__stage pdf-organizer__stage--clean">
          <section className={`pdf-image-stage ${multipleFiles.length === 0 ? 'is-empty' : ''}`}>
            {multipleFiles.length > 0 && (
              <div className="audio-preview-heading pdf-preview-heading">
                <div><span>Page sequence</span><h2>{multipleFiles.length === 1 ? '1 image ready' : `${multipleFiles.length} images ready`}</h2></div>
                <Images aria-hidden="true" />
              </div>
            )}
            {multipleFiles.length > 0 ? (
              <div className="pdf-image-grid workbench-scroll-region">
                {multipleFiles.map((info, index) => (
                  <article className="pdf-image-card" key={`${info.file.name}:${info.file.size}:${info.file.lastModified}:${index}`}>
                    <div className="pdf-image-card__header"><b>{index + 1}</b><button type="button" onClick={() => onRemoveItem(index)} title="Remove image"><Trash2 aria-hidden="true" /></button></div>
                    <ImageQueueThumbnail file={info.file} filter={imgFilter} rotation={rotations[index] || 0} onOpen={() => onPeekImage(index)} />
                    <strong title={info.file.name}>{info.file.name}</strong>
                    <nav aria-label={`Arrange ${info.file.name}`}>
                      <button type="button" disabled={index === 0} onClick={() => onMoveItem(index, index - 1)} title="Move earlier"><ArrowUp aria-hidden="true" /></button>
                      <button type="button" disabled={index === multipleFiles.length - 1} onClick={() => onMoveItem(index, index + 1)} title="Move later"><ArrowDown aria-hidden="true" /></button>
                      <button type="button" onClick={() => onRotateItem(index)} title="Rotate image clockwise" aria-label={`Rotate ${info.file.name} clockwise`}><RotateCw aria-hidden="true" /></button>
                    </nav>
                  </article>
                ))}
              </div>
            ) : (
              <div className="pdf-image-workspace-empty pdf-join-preview">
                <div>
                  <span>Build a PDF</span>
                  <h3>Add your images</h3>
                  <p>Choose PNG, JPG, or WebP files, then arrange, rotate, and preview every page.</p>
                </div>
                <FileUploader
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  compact
                  label="Choose images"
                  subLabel="Choose files or drop them here"
                  onFilesSelected={onAddFiles}
                  maxSizeMB={150}
                />
              </div>
            )}
          </section>
        </main>
      </div>
    </section>
  );
};
