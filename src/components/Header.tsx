import { Bug, Github, Terminal } from 'lucide-react';

export function Header() {
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-terminal-green/20 to-terminal-cyan/20 glow-green">
                <Bug className="w-6 h-6 text-terminal-green" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-terminal-green animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                <span className="text-terminal-green text-glow">APK</span>
                <span className="text-foreground"> Debugger</span>
              </h1>
              <p className="text-xs text-muted-foreground font-mono">make any app debuggable</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 border border-border">
              <Terminal className="w-4 h-4 text-terminal-cyan" />
              <span className="text-xs font-mono text-muted-foreground">100% Browser-Based</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
