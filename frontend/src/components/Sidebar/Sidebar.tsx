import React from "react";
import { Building2, Settings, LayoutDashboard, ChevronLeft } from "lucide-react";
import { useLayoutStore } from "../../store/layoutStore";
import { AIResults } from "../AIResults/AIResults";
import clsx from "clsx";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { layout, floorPlan, step } = useLayoutStore();

  return (
    <div
      className={clsx(
        "relative flex flex-col bg-white border-r border-slate-200 transition-all duration-300 h-full shadow-sm",
        collapsed ? "w-0 overflow-hidden" : "w-80 min-w-[320px]",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-slate-800 text-sm">WIP</span>
          <span className="text-xs text-slate-400 truncate max-w-[120px]">
            {floorPlan?.file_name ?? ""}
          </span>
        </div>
        <button
          onClick={onToggle}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-400"
          title="Collapse sidebar"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Nav tabs */}
      <div className="flex border-b border-slate-200 shrink-0">
        <NavTab icon={<LayoutDashboard className="w-4 h-4" />} label="Results" active />
        <NavTab icon={<Settings className="w-4 h-4" />} label="Layers" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {step === "review" && layout ? (
          <AIResults />
        ) : (
          <div className="flex items-center justify-center h-full p-6 text-center">
            <div className="text-slate-400">
              <LayoutDashboard className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Generate a layout to see AI results here</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NavTab({
  icon, label, active = false
}: { icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <button
      className={clsx(
        "flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors flex-1 justify-center border-b-2",
        active
          ? "border-blue-600 text-blue-700 bg-blue-50/50"
          : "border-transparent text-slate-500 hover:text-slate-700",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
