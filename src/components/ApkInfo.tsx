import { ApkInfo as ApkInfoType } from '@/lib/apk-processor';
import { Package, Hash, Shield, Smartphone, Bug } from 'lucide-react';

interface ApkInfoProps {
  info: ApkInfoType;
}

export function ApkInfoCard({ info }: ApkInfoProps) {
  return (
    <div className="terminal-border rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-terminal-green/10">
          <Package className="w-5 h-5 text-terminal-green" />
        </div>
        <h3 className="text-lg font-semibold">APK Information</h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <InfoItem
          icon={<Package className="w-4 h-4" />}
          label="Package"
          value={info.packageName}
        />
        <InfoItem
          icon={<Hash className="w-4 h-4" />}
          label="Version"
          value={`${info.versionName} (${info.versionCode})`}
        />
        <InfoItem
          icon={<Smartphone className="w-4 h-4" />}
          label="Min SDK"
          value={info.minSdk}
        />
        <InfoItem
          icon={<Shield className="w-4 h-4" />}
          label="Target SDK"
          value={info.targetSdk}
        />
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-border">
        <Bug className="w-4 h-4 text-terminal-green" />
        <span className="text-sm font-mono">
          Debuggable: 
          <span className={`ml-2 ${info.isDebuggable ? 'text-terminal-green' : 'text-destructive'}`}>
            {info.isDebuggable ? 'YES' : 'NO'}
          </span>
        </span>
      </div>
    </div>
  );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
        {icon}
        <span>{label}</span>
      </div>
      <p className="font-mono text-sm truncate" title={value}>{value}</p>
    </div>
  );
}
