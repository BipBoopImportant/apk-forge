import { Download, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DownloadButtonProps {
  blob: Blob;
  filename: string;
}

export function DownloadButton({ blob, filename }: DownloadButtonProps) {
  const handleDownload = () => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="terminal-border rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-terminal-green/20 glow-green">
          <CheckCircle2 className="w-6 h-6 text-terminal-green" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-terminal-green text-glow">Ready to Download</h3>
          <p className="text-sm text-muted-foreground font-mono">{filename}</p>
        </div>
      </div>

      <Button
        onClick={handleDownload}
        className="w-full h-12 bg-terminal-green hover:bg-terminal-green/90 text-primary-foreground font-semibold glow-green transition-all hover:scale-[1.02]"
      >
        <Download className="w-5 h-5 mr-2" />
        Download Debuggable APK
      </Button>

      <div className="p-3 rounded-lg bg-secondary/50 border border-border">
        <p className="text-xs text-muted-foreground font-mono leading-relaxed">
          <span className="text-terminal-cyan">$</span> adb install -t {filename}
        </p>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Use the <code className="px-1 py-0.5 rounded bg-secondary font-mono">-t</code> flag to allow test/debug APKs
      </p>
    </div>
  );
}
