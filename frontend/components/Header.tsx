// frontend/components/Header.tsx
import React from 'react';

interface HeaderProps {
  onDownload: () => void;
  objectCount: number;
}

const Header: React.FC<HeaderProps> = ({ onDownload, objectCount }) => {
  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-900/50 border border-blue-700/50 rounded-lg flex items-center justify-center">
            <span className="text-blue-200 font-bold text-lg font-serif">I</span>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-white font-serif tracking-widest">IANVS</h1>
        <span className="px-2 py-0.5 bg-slate-800 text-[10px] text-slate-400 rounded-full border border-slate-700 uppercase tracking-wide">Alpha</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-sm text-slate-400 font-medium">
            {objectCount} Object{objectCount !== 1 ? 's' : ''} in Scene
        </div>
        <div className="h-4 w-[1px] bg-slate-700"></div>
        <button 
          onClick={onDownload}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sm text-white rounded-md border border-slate-700 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Export JSON
        </button>
      </div>
    </header>
  );
};

export default Header;
