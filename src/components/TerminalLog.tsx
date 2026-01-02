import { forwardRef, useEffect, useRef } from 'react';
import { ProcessingLog } from '@/lib/apk-processor';
import { CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';

interface TerminalLogProps {
  logs: ProcessingLog[];
}

export const TerminalLog = forwardRef<HTMLDivElement, TerminalLogProps>(
  function TerminalLog({ logs }, ref) {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, [logs]);

    const getIcon = (type: ProcessingLog['type']) => {
      switch (type) {
        case 'success':
          return <CheckCircle2 className="w-4 h-4 text-terminal-green" />;
        case 'error':
          return <AlertCircle className="w-4 h-4 text-destructive" />;
        case 'warning':
          return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
        default:
          return <Info className="w-4 h-4 text-terminal-cyan" />;
      }
    };

    const getTextColor = (type: ProcessingLog['type']) => {
      switch (type) {
        case 'success':
          return 'text-terminal-green';
        case 'error':
          return 'text-destructive';
        case 'warning':
          return 'text-yellow-500';
        default:
          return 'text-muted-foreground';
      }
    };

    return (
      <div ref={ref} className="terminal-border rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-secondary/50">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-destructive/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-terminal-green/80" />
          </div>
          <span className="font-mono text-sm text-muted-foreground ml-2">terminal</span>
        </div>
        
        <div
          ref={scrollRef}
          className="h-64 overflow-y-auto p-4 font-mono text-sm space-y-2 bg-background/50 scanline"
        >
          {logs.length === 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-terminal-green">$</span>
              <span>Waiting for APK upload...</span>
              <span className="animate-blink text-terminal-green">▌</span>
            </div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="flex items-start gap-2">
                <span className="text-muted-foreground text-xs mt-0.5">
                  {log.timestamp.toLocaleTimeString()}
                </span>
                {getIcon(log.type)}
                <span className={getTextColor(log.type)}>{log.message}</span>
              </div>
            ))
          )}
          
          {logs.length > 0 && (
            <div className="flex items-center gap-2 text-muted-foreground mt-2">
              <span className="text-terminal-green">$</span>
              <span className="animate-blink text-terminal-green">▌</span>
            </div>
          )}
        </div>
      </div>
    );
  }
);
