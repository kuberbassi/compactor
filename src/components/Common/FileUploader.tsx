import React, { useRef, useState } from 'react';
import { PiCloudArrowUpLight as UploadCloud, PiWarningCircleLight as AlertCircle } from 'react-icons/pi';

interface FileUploaderProps {
  accept: string;
  multiple?: boolean;
  onFilesSelected: (files: File[]) => void;
  label: string;
  subLabel?: string;
  maxSizeMB?: number;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  accept,
  multiple = false,
  onFilesSelected,
  label,
  subLabel = "Select or drag files here",
  maxSizeMB = 500
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFiles = (fileList: FileList | File[] | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    const filesArray = Array.from(fileList);

    const validFiles: File[] = [];
    const allowedTokens = accept.split(',').map(ext => ext.trim().toLowerCase());

    for (const file of filesArray) {
      const fileSizeMB = file.size / (1024 * 1024);
      if (fileSizeMB > maxSizeMB) {
        setError(`File "${file.name}" exceeds the ${maxSizeMB}MB limit for client-side processing.`);
        return;
      }

      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      const fileMime = (file.type || '').toLowerCase();

      // Check MIME type or extension flexibly
      const isAllowed = allowedTokens.some(allowed => {
        if (allowed === '*' || allowed === '*/*') return true;
        if (allowed.startsWith('.')) return fileExtension === allowed;
        if (allowed.includes('/*')) {
          const typeGroup = allowed.split('/')[0];
          return typeGroup === '*' || fileMime.startsWith(typeGroup + '/');
        }
        if (allowed.includes('/')) {
          return fileMime === allowed || fileMime.startsWith(allowed.split('/')[0] + '/');
        }
        return fileExtension === '.' + allowed;
      }) 
      || (accept.includes('video') && (fileMime.startsWith('video/') || fileExtension.match(/\.(mp4|webm|mov|mkv|avi|flv|wmv|3gp|mpeg|m4v|ts|ogv)$/i)))
      || (accept.includes('image') && (fileMime.startsWith('image/') || fileExtension.match(/\.(jpg|jpeg|png|webp|gif|bmp|tiff|svg|heic|avif)$/i)))
      || (accept.includes('audio') && (fileMime.startsWith('audio/') || fileExtension.match(/\.(mp3|wav|ogg|aac|m4a|flac|opus|wma|aiff)$/i)))
      || (accept.includes('pdf') && fileExtension === '.pdf');

      if (!isAllowed && accept !== '*' && accept !== '*/*') {
        setError(`File "${file.name}" is not supported. Please upload: ${accept}`);
        return;
      }

      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      // Reset input value so re-selecting the same file always triggers onChange
      e.target.value = '';
    }
  };

  const onButtonClick = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full">
      {error && (
        <div className="upload-error">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <div>{error}</div>
        </div>
      )}
      
      <div 
        className={`upload-dropzone ${
          dragActive 
            ? 'upload-dropzone--active' : ''
        }`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={onButtonClick}
      >
        <input 
          ref={fileInputRef}
          type="file" 
          className="hidden"
          accept={accept}
          multiple={multiple}
          onChange={handleChange}
          onClick={(e) => e.stopPropagation()}
        />
        
        <div className="upload-dropzone__icon">
          <UploadCloud className="w-9 h-9" />
        </div>
        
        <div className="space-y-1.5">
          <h3>{label}</h3>
          <p>{subLabel}</p>
        </div>
        
        <button type="button" className="button" onClick={onButtonClick}>
          Browse Files
        </button>
      </div>
    </div>
  );
};
