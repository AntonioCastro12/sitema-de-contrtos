import React from 'react';
import {
  Wifi,
  WifiOff,
  CloudUpload,
  RefreshCw,
  Settings,
  FilePlus2,
  FolderKanban,
  BarChart3,
  Lock
} from 'lucide-react';
import { RCM_LOGO_BASE64 } from '../assets/logoBase64';

export default function Header({
  isOnline,
  pendientesCount,
  totalContratos = 0,
  activeTab,
  onChangeTab,
  isSyncing,
  onSyncNow,
  onOpenSettings
}) {
  return (
    <header className="sticky top-0 z-30 bg-gradient-to-r from-[#1E3A5F] via-[#1A5276] to-[#1E3A5F] text-white shadow-md border-b border-white/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Identidad Corporativa RCM CodeDev */}
        <div
          onClick={() => onChangeTab && onChangeTab('nuevo')}
          className="flex items-center gap-3 min-w-0 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-white p-0.5 shadow-sm shrink-0 overflow-hidden ring-2 ring-white/15 group-hover:ring-[#5DADE2] transition">
            <img
              src={RCM_LOGO_BASE64}
              alt="RCM CodeDev"
              className="w-full h-full object-contain rounded-lg"
            />
          </div>
          <div className="truncate">
            <span className="font-extrabold text-sm sm:text-base tracking-tight text-white block leading-tight">
              RCM CodeDev
            </span>
            <span className="text-[11px] text-[#5DADE2] font-medium block leading-tight">
              Suite de Cierres y Ventas
            </span>
          </div>
        </div>

        {/* Navegación Central integrada para Laptop / Desktop (md y superior) */}
        {onChangeTab && (
          <nav
            aria-label="Navegación de escritorio"
            className="hidden md:flex items-center gap-1.5 bg-slate-900/25 p-1.5 rounded-2xl border border-white/10"
          >
            <button
              type="button"
              onClick={() => onChangeTab('nuevo')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'nuevo'
                  ? 'bg-white text-[#1E3A5F] shadow-sm'
                  : 'text-slate-200 hover:bg-white/10 hover:text-white'
              }`}
            >
              <FilePlus2
                className={`w-4 h-4 ${
                  activeTab === 'nuevo' ? 'text-[#1A5276]' : 'text-[#5DADE2]'
                }`}
              />
              <span>Nuevo Cierre</span>
            </button>

            <button
              type="button"
              onClick={() => onChangeTab('lista')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'lista'
                  ? 'bg-white text-[#1E3A5F] shadow-sm'
                  : 'text-slate-200 hover:bg-white/10 hover:text-white'
              }`}
            >
              <FolderKanban
                className={`w-4 h-4 ${
                  activeTab === 'lista' ? 'text-[#1A5276]' : 'text-[#5DADE2]'
                }`}
              />
              <span>Mis Cierres</span>
              {pendientesCount > 0 ? (
                <span className="px-1.5 min-w-[20px] h-5 rounded-full bg-amber-500 text-white text-[10px] font-extrabold flex items-center justify-center">
                  {pendientesCount}
                </span>
              ) : (
                totalContratos > 0 && (
                  <span
                    className={`px-1.5 min-w-[20px] h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                      activeTab === 'lista'
                        ? 'bg-[#1E3A5F]/10 text-[#1E3A5F]'
                        : 'bg-white/15 text-white'
                    }`}
                  >
                    {totalContratos}
                  </span>
                )
              )}
            </button>

            <button
              type="button"
              onClick={() => onChangeTab('timeline')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'timeline'
                  ? 'bg-[#65174E] text-white shadow-sm ring-1 ring-pink-300/40'
                  : 'text-slate-200 hover:bg-white/10 hover:text-white'
              }`}
            >
              <BarChart3
                className={`w-4 h-4 ${
                  activeTab === 'timeline' ? 'text-amber-300' : 'text-[#5DADE2]'
                }`}
              />
              <span>Panel Admin</span>
              <Lock className="w-3 h-3 opacity-80" />
            </button>
          </nav>
        )}

        {/* Controles derechos */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Botón Sincronizar Cola */}
          <button
            type="button"
            onClick={onSyncNow}
            disabled={isSyncing}
            title="Sincronizar cierres"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition active:scale-95 ${
              pendientesCount > 0
                ? 'bg-[#65174E] text-white shadow-sm ring-1 ring-pink-400/30'
                : 'bg-white/10 text-slate-200 hover:bg-white/20'
            }`}
          >
            {isSyncing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#5DADE2]" />
            ) : (
              <CloudUpload className="w-3.5 h-3.5 text-[#5DADE2]" />
            )}
            <span className="hidden sm:inline">
              {pendientesCount > 0 ? `Sincronizar (${pendientesCount})` : 'Sincronizado'}
            </span>
            <span className="sm:hidden">{pendientesCount}</span>
          </button>

          {/* Badge de Conectividad */}
          {isOnline ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <Wifi className="w-3.5 h-3.5 hidden sm:inline" />
              <span className="text-[11px]">En línea</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/25 border border-amber-400/30 text-amber-200 text-xs font-semibold">
              <WifiOff className="w-3.5 h-3.5 text-amber-300" />
              <span className="text-[11px]">Offline</span>
            </div>
          )}

          {/* Preferencias */}
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Preferencias de sincronización"
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 active:scale-95 transition"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
