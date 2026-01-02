import { useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { UploadZone } from '@/components/UploadZone';
import { TerminalLog } from '@/components/TerminalLog';
import { ApkInfoCard } from '@/components/ApkInfo';
import { DownloadButton } from '@/components/DownloadButton';
import { Features } from '@/components/Features';
import { processApk, ProcessingLog, ApkInfo } from '@/lib/apk-processor';
import { toast } from 'sonner';

const Index = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<ProcessingLog[]>([]);
  const [result, setResult] = useState<{ blob: Blob; info: ApkInfo; filename: string } | null>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    setIsProcessing(true);
    setLogs([]);
    setResult(null);

    const handleLog = (log: ProcessingLog) => {
      setLogs(prev => [...prev, log]);
    };

    try {
      const processResult = await processApk(file, handleLog);

      if (processResult.success && processResult.apkBlob && processResult.apkInfo) {
        const newFilename = file.name.replace(/\.(apk|apks)$/i, '-debug.apk');
        setResult({
          blob: processResult.apkBlob,
          info: processResult.apkInfo,
          filename: newFilename,
        });
        toast.success('APK processed successfully!');
      } else {
        toast.error('Failed to process APK');
      }
    } catch (error) {
      toast.error('An error occurred while processing the APK');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleReset = () => {
    setLogs([]);
    setResult(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Hero Section */}
        <section className="text-center space-y-4 py-8">
          <h2 className="text-3xl md:text-4xl font-bold">
            Make Any Android App{' '}
            <span className="text-terminal-green text-glow">Debuggable</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Upload your APK or APKS file and get a debuggable version in seconds.
            All processing happens locally in your browser — your files never leave your device.
          </p>
        </section>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Upload & Terminal */}
          <div className="space-y-6">
            <UploadZone onFileSelect={handleFileSelect} isProcessing={isProcessing} />
            <TerminalLog logs={logs} />
          </div>

          {/* Right Column - Results */}
          <div className="space-y-6">
            {result ? (
              <>
                <ApkInfoCard info={result.info} />
                <DownloadButton blob={result.blob} filename={result.filename} />
                <button
                  onClick={handleReset}
                  className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors font-mono"
                >
                  Process another APK →
                </button>
              </>
            ) : (
              <div className="terminal-border rounded-xl p-8 text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-secondary/50 flex items-center justify-center">
                  <span className="text-3xl opacity-50">📦</span>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">No APK Selected</h3>
                  <p className="text-sm text-muted-foreground">
                    Drop an APK or APKS file to get started
                  </p>
                </div>
                <div className="pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground font-mono">
                    Supported formats: <span className="text-terminal-cyan">.apk</span> <span className="text-terminal-green">.apks</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Features Section */}
        <section className="pt-8">
          <h3 className="text-xl font-semibold mb-6 text-center">
            <span className="text-terminal-cyan">Features</span>
          </h3>
          <Features />
        </section>

        {/* How it Works */}
        <section className="py-8">
          <h3 className="text-xl font-semibold mb-6 text-center">
            <span className="text-terminal-green">How it Works</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { step: '01', title: 'Upload', desc: 'Drop your APK or APKS file' },
              { step: '02', title: 'Extract', desc: 'Unpack and analyze contents' },
              { step: '03', title: 'Patch', desc: 'Enable debugging in manifest' },
              { step: '04', title: 'Download', desc: 'Get your debuggable APK' },
            ].map((item, index) => (
              <div key={item.step} className="text-center space-y-2">
                <div className="w-12 h-12 mx-auto rounded-xl bg-terminal-green/10 flex items-center justify-center font-mono text-terminal-green font-bold">
                  {item.step}
                </div>
                <h4 className="font-semibold">{item.title}</h4>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
                {index < 3 && (
                  <div className="hidden md:block absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 text-muted-foreground">
                    →
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Disclaimer */}
        <section className="terminal-border rounded-lg p-4 text-center">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">⚠️ Disclaimer:</strong> This tool is intended for developers to debug their own applications.
            Only use on apps you have permission to modify. The modified APK uses a debug signature and requires{' '}
            <code className="px-1 py-0.5 rounded bg-secondary font-mono">adb install -t</code> to install.
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 mt-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground font-mono">
            Built with <span className="text-terminal-green">♥</span> for Android developers
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
