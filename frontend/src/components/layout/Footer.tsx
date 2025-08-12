import type { BuildInfo } from '@/types';

const Footer = () => {
  const buildInfo: BuildInfo = {
    timestamp: import.meta.env.VITE_BUILD_TIME || new Date().toISOString(),
    commit: import.meta.env.VITE_BUILD_COMMIT || 'dev',
    branch: import.meta.env.VITE_BUILD_BRANCH || 'main',
    version: import.meta.env.VITE_APP_VERSION || '1.0.0',
  };

  const formatBuildTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

  return (
    <footer className="border-t border-slate-200 bg-white/70 backdrop-blur-xl px-6 py-4">
      <div className="flex flex-col sm:flex-row justify-between items-center text-xs text-slate-600">
        <div className="flex items-center gap-3">
          <span>© 2024 {import.meta.env.VITE_APP_NAME || 'Eternalgy ERP'}</span>
          <span className="text-slate-500">v{buildInfo.version}</span>
        </div>
        <div className="flex items-center gap-3 mt-2 sm:mt-0">
          <span>Built: {formatBuildTime(buildInfo.timestamp)}</span>
          <span>Branch: <span className="font-medium text-slate-700">{buildInfo.branch}</span></span>
          <span className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded text-slate-700">
            {buildInfo.commit.substring(0, 7)}
          </span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;