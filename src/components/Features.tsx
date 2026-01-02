import { forwardRef } from 'react';
import { Shield, Zap, Lock, Merge, FileKey, Cpu, LucideIcon } from 'lucide-react';

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
  colorClass: string;
  bgClass: string;
}

const features: Feature[] = [
  {
    icon: Shield,
    title: 'Make Debuggable',
    description: 'Patches AndroidManifest.xml to enable debugging mode',
    colorClass: 'text-terminal-green',
    bgClass: 'bg-terminal-green/10',
  },
  {
    icon: Merge,
    title: 'Merge Split APKs',
    description: 'Combines .apks bundles into a single installable APK',
    colorClass: 'text-terminal-cyan',
    bgClass: 'bg-terminal-cyan/10',
  },
  {
    icon: FileKey,
    title: 'Re-sign APK',
    description: 'Generates new signing keys and re-signs the package',
    colorClass: 'text-terminal-green',
    bgClass: 'bg-terminal-green/10',
  },
  {
    icon: Cpu,
    title: 'Local Processing',
    description: 'All processing happens in your browser, nothing uploaded',
    colorClass: 'text-terminal-cyan',
    bgClass: 'bg-terminal-cyan/10',
  },
  {
    icon: Zap,
    title: 'Fast & Efficient',
    description: 'Optimized for quick processing of large APK files',
    colorClass: 'text-terminal-green',
    bgClass: 'bg-terminal-green/10',
  },
  {
    icon: Lock,
    title: 'Privacy First',
    description: 'Your APK files never leave your device',
    colorClass: 'text-terminal-cyan',
    bgClass: 'bg-terminal-cyan/10',
  },
];

export const Features = forwardRef<HTMLDivElement>(function Features(props, ref) {
  return (
    <div ref={ref} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {features.map((feature, index) => {
        const Icon = feature.icon;
        return (
          <div
            key={feature.title}
            className="terminal-border rounded-lg p-4 group hover:border-terminal-cyan transition-all duration-300"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${feature.bgClass} group-hover:glow-cyan transition-all`}>
                <Icon className={`w-5 h-5 ${feature.colorClass}`} />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">{feature.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});
