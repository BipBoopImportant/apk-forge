import { useCallback, useState } from 'react';
import { Upload, FileArchive, Loader2 } from 'lucide-react';

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
}

export function UploadZone({ onFileSelect, isProcessing }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.apk') || file.name.endsWith('.apks')) {
        onFileSelect(file);
      }
    }
  }, [onFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
  }, [onFileSelect]);

  return (
    <div
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className={`
        relative group cursor-pointer
        terminal-border rounded-xl p-8
        transition-all duration-300 ease-out
        ${isDragging ? 'glow-green border-terminal-green scale-[1.02]' : 'hover:border-terminal-cyan hover:glow-cyan'}
        ${isProcessing ? 'pointer-events-none opacity-50' : ''}
      `}
    >
      <input
        type="file"
        accept=".apk,.apks"
        onChange={handleFileInput}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        disabled={isProcessing}
      />
      
      <div className="flex flex-col items-center gap-6 text-center">
        <div className={`
          relative p-6 rounded-2xl
          bg-gradient-to-br from-terminal-green/10 to-terminal-cyan/10
          ${isDragging ? 'animate-pulse-glow' : 'group-hover:animate-pulse-glow'}
        `}>
          {isProcessing ? (
            <Loader2 className="w-12 h-12 text-terminal-green animate-spin" />
          ) : isDragging ? (
            <FileArchive className="w-12 h-12 text-terminal-green" />
          ) : (
            <Upload className="w-12 h-12 text-terminal-cyan group-hover:text-terminal-green transition-colors" />
          )}
          
          {/* Animated ring */}
          <div className={`
            absolute inset-0 rounded-2xl border-2 border-terminal-green/30
            ${isDragging || isProcessing ? 'animate-ping' : 'group-hover:animate-ping'}
          `} />
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-foreground">
            {isProcessing ? 'Processing...' : 'Drop your APK here'}
          </h3>
          <p className="text-muted-foreground font-mono text-sm">
            {isProcessing 
              ? 'Making your app debuggable...' 
              : 'Supports .apk and .apks files'
            }
          </p>
        </div>

        {!isProcessing && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="px-3 py-1 rounded-full bg-secondary font-mono">.apk</span>
            <span className="text-terminal-cyan">or</span>
            <span className="px-3 py-1 rounded-full bg-secondary font-mono">.apks</span>
          </div>
        )}
      </div>

      {/* Scan line effect when dragging */}
      {isDragging && (
        <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
          <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-terminal-green to-transparent animate-scan" />
        </div>
      )}
    </div>
  );
}
