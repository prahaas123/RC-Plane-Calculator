import React, { useState } from 'react';
import { OverallSetup } from './pages/OverallSetup';
import { PropCalculator } from './pages/PropCalculator';
import { CGCalculator } from './pages/CGCalculator';
import { Page } from './types';
import { Icons } from './constants';

const App: React.FC = () => {
  const [activePage, setActivePage] = useState<Page>(Page.PROP);

  const renderContent = () => {
    switch (activePage) {
      case Page.OVERALL: return <OverallSetup />;
      case Page.PROP: return <PropCalculator />;
      case Page.CG: return <CGCalculator />;
      default: return <PropCalculator />;
    }
  };

  const NavButton = ({ page, label, icon: Icon }: { page: Page; label: string; icon: React.FC<React.SVGProps<SVGSVGElement>> }) => (
    <button
      onClick={() => setActivePage(page)}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 ${
        activePage === page 
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
          : 'text-slate-400 hover:text-white hover:bg-slate-800'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium text-sm md:text-base">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Header / Nav */}
      <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white font-bold text-xl">A</div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 hidden sm:block">
                AeroCalc - Made by Prahaas
              </h1>
            </div>
            
            <nav className="flex space-x-1 bg-slate-900/50 p-1 rounded-xl">
              <NavButton page={Page.PROP} label="Prop" icon={Icons.Propeller} />
              <NavButton page={Page.CG} label="CG" icon={Icons.Scale} />
              <NavButton page={Page.OVERALL} label="Setup" icon={Icons.Plane} />
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {renderContent()}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-auto py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-500 text-sm">
          <p>© {new Date().getFullYear()} AeroCalc Pro. MAde by Prahaas Kotni. Estimations only - always verify physically.</p>
        </div>
      </footer>
    </div>
  );
};

export default App;