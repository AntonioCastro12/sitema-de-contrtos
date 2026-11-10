import React from 'react';
import { FilePlus2, FolderKanban, BarChart3, Lock } from 'lucide-react';

export default function BottomNav({ activeTab, onChangeTab, totalContratos, pendientesCount }) {
  return (
    <nav
      aria-label="Navegación principal móvil"
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-nav"
    >
      <div className="max-w-md mx-auto grid grid-cols-3 h-16 px-2.5 py-1.5 gap-1.5">
        {/* Pestaña 1: Nuevo Cierre */}
        <button
          type="button"
          onClick={() => onChangeTab('nuevo')}
          className={`flex items-center justify-center gap-1.5 rounded-xl transition-all ${
            activeTab === 'nuevo'
              ? 'bg-[#1E3A5F] text-white font-bold shadow-xs'
              : 'text-slate-500 font-medium hover:bg-slate-100'
          }`}
        >
          <FilePlus2
            className={`w-4 h-4 ${
              activeTab === 'nuevo' ? 'text-[#5DADE2]' : 'text-slate-400'
            }`}
          />
          <span className="text-[11px]">Nuevo Cierre</span>
        </button>

        {/* Pestaña 2: Mis Cierres */}
        <button
          type="button"
          onClick={() => onChangeTab('lista')}
          className={`flex items-center justify-center gap-1.5 rounded-xl transition-all relative ${
            activeTab === 'lista'
              ? 'bg-[#1E3A5F] text-white font-bold shadow-xs'
              : 'text-slate-500 font-medium hover:bg-slate-100'
          }`}
        >
          <FolderKanban
            className={`w-4 h-4 ${
              activeTab === 'lista' ? 'text-[#5DADE2]' : 'text-slate-400'
            }`}
          />
          <span className="text-[11px]">Mis Cierres</span>

          {pendientesCount > 0 ? (
            <span className="px-1.5 min-w-[18px] h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">
              {pendientesCount}
            </span>
          ) : (
            totalContratos > 0 && (
              <span
                className={`px-1.5 min-w-[18px] h-4 rounded-full text-[9px] font-bold flex items-center justify-center ${
                  activeTab === 'lista'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {totalContratos}
              </span>
            )
          )}
        </button>

        {/* Pestaña 3: Panel de Administrador (Ventas 25% + Línea de Tiempo con PIN) */}
        <button
          type="button"
          onClick={() => onChangeTab('timeline')}
          className={`flex items-center justify-center gap-1.5 rounded-xl transition-all relative ${
            activeTab === 'timeline'
              ? 'bg-[#65174E] text-white font-bold shadow-xs'
              : 'text-slate-500 font-medium hover:bg-slate-100'
          }`}
        >
          <BarChart3
            className={`w-4 h-4 ${
              activeTab === 'timeline' ? 'text-amber-300' : 'text-slate-400'
            }`}
          />
          <span className="text-[11px]">Admin</span>
          <Lock
            className={`w-3 h-3 ${
              activeTab === 'timeline' ? 'text-white/80' : 'text-slate-400'
            }`}
          />
        </button>
      </div>
    </nav>
  );
}
