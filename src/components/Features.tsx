import { Shield, Zap, Lock, Merge, FileKey, Cpu } from 'lucide-react';

const features = [
  {
    icon: Shield,
    title: 'Make Debuggable',
    description: 'Patches AndroidManifest.xml to enable debugging mode',
    color: 'terminal-green',
  },
  {
    icon: Merge,
    title: 'Merge Split APKs',
    description: 'Combines .apks bundles into a single installable APK',
    color: 'terminal-cyan',
  },
  {
    icon: FileKey,
    title: 'Re-sign APK',
    description: 'Generates new signing keys and re-signs the package',
    color: 'terminal-green',
  },
  {
    icon: Cpu,
    title: 'Local Processing',
    description: 'All processing happens in your browser, nothing uploaded',
    color: 'terminal-cyan',
  },
  {
    icon: Zap,
    title: 'Fast & Efficient',
    description: 'Optimized for quick processing of large APK files',
    color: 'terminal-green',
  },
  {
    icon: Lock,
    title: 'Privacy First',
    description: 'Your APK files never leave your device',
    color: 'terminal-cyan',
  },
];

export function Features() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {features.map((feature, index) => (
        <div
          key={feature.title}
          className="terminal-border rounded-lg p-4 group hover:border-terminal-cyan transition-all duration-300"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg bg-${feature.color}/10 group-hover:glow-cyan transition-all`}>
              <feature.icon className={`w-5 h-5 text-${feature.color}`} />
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-1">{feature.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
