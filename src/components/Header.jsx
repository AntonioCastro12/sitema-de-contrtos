import React from 'react';
import { Wifi, WifiOff, CloudUpload, RefreshCw, Settings } from 'lucide-react';
import { RCM_LOGO_BASE64 } from '../assets/logoBase64';

export default function Header({
  isOnline,
  pendientesCount,
  isSyncing,
  onSyncNow,
  onOpenSettings
}) {
  return (
    <header className="sticky top-0 z-30 bg-[#1E3A5F] text-white shadow-sm">
      <div className="max-w-md mx-auto px-4 h-15 flex items-center justify-between gap-2">
        {/* Identidad Corporativa Limpia */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-white p-0.5 shadow-xs flex-shrink-0 overflow-hidden">
            <img
              src={RCM_LOGO_BASE64}
              alt="RCM CodeDev"
              className="w-full h-full object-contain rounded-lg"
            />
          </div>
          <div className="truncate">
            <span className="font-bold text-sm tracking-tight text-white block leading-tight">
              RCM CodeDev
            </span>
            <span className="text-[11px] text-[#5DADE2] font-medium block leading-tight">
              Ventas en Campo
            </span>
          </div>
        </div>

        {/* Controles derechos minimalistas */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Contador de Cola Local */}
          <button
            type="button"
            onClick={onSyncNow}
            disabled={isSyncing}
            title="Cierres pendientes de sincronizar"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold transition active:scale-95 ${
              pendientesCount > 0
                ? 'bg-[#65174E] text-white shadow-xs'
                : 'bg-white/10 text-slate-200 hover:bg-white/15'
            }`}
          >
            {isSyncing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#5DADE2]" />
            ) : (
              <CloudUpload className="w-3.5 h-3.5 text-[#5DADE2]" />
            )}
            <span>{pendientesCount}</span>
          </button>

          {/* Badge de Conectividad: Verde "En línea" / Ámbar "Modo Offline" */}
          {isOnline ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <Wifi className="w-3.5 h-3.5" />
              <span className="text-[11px]">En línea</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-amber-500/25 text-amber-200 text-xs font-semibold">
              <WifiOff className="w-3.5 h-3.5 text-amber-300" />
              <span className="text-[11px]">Modo Offline</span>
            </div>
          )}

          {/* Configuración */}
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Configurar correo receptor"
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 active:scale-95 transition"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
