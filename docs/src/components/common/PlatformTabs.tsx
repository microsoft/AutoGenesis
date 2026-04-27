import { motion, LayoutGroup } from 'framer-motion';
import { useState, useId, type ReactNode, type ComponentType } from 'react';
import { Monitor, Laptop, Smartphone } from 'lucide-react';

export type Platform = 'windows' | 'macos' | 'mobile';

interface PlatformTabsProps {
  children: (platform: Platform) => ReactNode;
  defaultPlatform?: Platform;
  className?: string;
}

interface IconProps {
  size?: number;
  className?: string;
}

const platformLabels: Record<Platform, { label: string; Icon: ComponentType<IconProps>; color: string }> = {
  windows: { label: 'Windows', Icon: Monitor, color: 'text-blue-600' },
  macos: { label: 'macOS', Icon: Laptop, color: 'text-slate-700' },
  mobile: { label: 'Mobile', Icon: Smartphone, color: 'text-green-600' },
};

export const PlatformTabs = ({
  children,
  defaultPlatform = 'windows',
  className = '',
}: PlatformTabsProps) => {
  const [activePlatform, setActivePlatform] = useState<Platform>(defaultPlatform);
  const tabGroupId = useId();

  return (
    <div className={className}>
      {/* Tab buttons */}
      <LayoutGroup id={tabGroupId}>
        <div className="flex gap-2 mb-4 p-1 bg-slate-100 rounded-lg w-fit">
          {(Object.keys(platformLabels) as Platform[]).map((platform) => {
            const { Icon, label, color } = platformLabels[platform];
            const isActive = activePlatform === platform;
            return (
              <button
                key={platform}
                onClick={() => setActivePlatform(platform)}
                className={`relative px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTabBg"
                    className="absolute inset-0 bg-purple-primary rounded-md"
                    initial={false}
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <Icon size={18} className={isActive ? 'text-white' : color} />
                  <span>{label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </LayoutGroup>

      {/* Tab content */}
      <motion.div
        key={activePlatform}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {children(activePlatform)}
      </motion.div>
    </div>
  );
};

// Convenience component for defining platform-specific content
interface PlatformContentProps {
  platform: Platform;
  windows?: ReactNode;
  macos?: ReactNode;
  mobile?: ReactNode;
}

export const PlatformContent = ({
  platform,
  windows,
  macos,
  mobile,
}: PlatformContentProps) => {
  const content = {
    windows,
    macos,
    mobile,
  };

  return <>{content[platform]}</>;
};
