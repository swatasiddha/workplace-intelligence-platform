import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLayoutStore } from "./store/layoutStore";
import { FileUpload } from "./components/FileUpload/FileUpload";
import { RequirementsForm } from "./components/LayoutCustomizer/RequirementsForm";
import { FloorPlanViewer } from "./components/FloorPlanViewer/FloorPlanViewer";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { Sparkles, ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";

function GeneratingScreen() {
  const { generatingProgress } = useLayoutStore();

  const steps = [
    { label: "Analysing floor plate geometry", threshold: 15 },
    { label: "Computing space programme", threshold: 30 },
    { label: "Claude is thinking about your layout…", threshold: 50 },
    { label: "Optimising zone placement", threshold: 70 },
    { label: "Placing furniture and fixtures", threshold: 85 },
    { label: "Finalising design recommendations", threshold: 95 },
  ];

  const currentStep = steps.filter((s) => generatingProgress >= s.threshold).pop();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-lg w-full text-center"
      >
        {/* Animated icon */}
        <div className="relative w-24 h-24 mx-auto mb-8">
          <div className="absolute inset-0 rounded-full bg-blue-100 animate-ping opacity-40" />
          <div className="absolute inset-2 rounded-full bg-blue-200 animate-ping opacity-30 animation-delay-150" />
          <div className="relative w-24 h-24 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center shadow-xl shadow-blue-300">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          AI is designing your workplace
        </h2>
        <p className="text-slate-500 mb-8">
          Claude Opus 4.6 is analysing your floor plan and generating an
          optimised layout based on your requirements.
        </p>

        {/* Progress bar */}
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden mb-4">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
            animate={{ width: `${generatingProgress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <p className="text-sm text-slate-500 mb-8">
          {currentStep?.label ?? "Initialising…"}
        </p>

        {/* Step indicators */}
        <div className="text-left space-y-2">
          {steps.map((step, i) => {
            const done = generatingProgress >= step.threshold;
            const active = currentStep?.label === step.label;
            return (
              <div key={i} className={`flex items-center gap-2.5 text-sm ${done ? "text-slate-700" : "text-slate-400"}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-all ${
                  done ? "bg-blue-600 text-white" : active ? "border-2 border-blue-400 bg-blue-50" : "bg-slate-200"
                }`}>
                  {done ? "✓" : i + 1}
                </div>
                <span className={active ? "font-medium text-blue-700" : ""}>{step.label}</span>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}

function WorkspaceLayout() {
  const { step, floorPlan } = useLayoutStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-100">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarCollapsed((c) => !c)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500"
            title={sidebarCollapsed ? "Open sidebar" : "Close sidebar"}
          >
            {sidebarCollapsed
              ? <PanelLeftOpen className="w-4 h-4" />
              : <PanelLeftClose className="w-4 h-4" />
            }
          </button>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="font-bold text-slate-800">Workplace Intelligence Platform</span>
            {floorPlan && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-500 truncate max-w-[180px]">{floorPlan.file_name}</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-500">{floorPlan.total_area.toLocaleString()} m²</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full font-medium">
            Claude Opus 4.6
          </span>
          <span>AI Office Design</span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((c) => !c)}
        />

        {/* Floor plan viewer */}
        <div className="flex-1 overflow-hidden">
          <FloorPlanViewer />
        </div>

        {/* Right panel — requirements (only in review mode for adjustments) */}
        {step === "review" && (
          <div className="w-80 min-w-[320px] border-l border-slate-200 overflow-y-auto scrollbar-thin bg-white hidden xl:block">
            <div className="p-4 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700">Adjust Requirements</h3>
            </div>
            <RequirementsForm />
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const { step } = useLayoutStore();

  return (
    <AnimatePresence mode="wait">
      {step === "upload" ? (
        <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <FileUpload />
        </motion.div>
      ) : step === "requirements" ? (
        <motion.div key="requirements" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
          <RequirementsForm />
        </motion.div>
      ) : step === "generating" ? (
        <motion.div key="generating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <GeneratingScreen />
        </motion.div>
      ) : (
        <motion.div key="review" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-screen">
          <WorkspaceLayout />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
