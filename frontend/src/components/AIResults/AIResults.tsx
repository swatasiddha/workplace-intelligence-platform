import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Sparkles, BarChart3, CheckCircle, AlertTriangle,
  Download, RefreshCw, ChevronDown, ChevronUp,
  Users, Building2, Zap, Heart
} from "lucide-react";
import { useLayoutStore } from "../../store/layoutStore";
import clsx from "clsx";

const SCORE_COLOURS: Record<string, string> = {
  excellent: "text-emerald-600",
  good: "text-blue-600",
  fair: "text-amber-600",
  poor: "text-red-600",
};

function scoreLabel(score: number) {
  if (score >= 80) return "excellent";
  if (score >= 60) return "good";
  if (score >= 40) return "fair";
  return "poor";
}

function ScoreCard({
  icon, title, score, desc
}: { icon: React.ReactNode; title: string; score: number; desc: string }) {
  const level = scoreLabel(score);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3 text-slate-600">
        {icon}
        <span className="text-sm font-medium">{title}</span>
      </div>
      <div className={clsx("text-3xl font-bold", SCORE_COLOURS[level])}>
        {score}<span className="text-base font-normal text-slate-400">/100</span>
      </div>
      <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={clsx("h-full rounded-full transition-all duration-700", {
            "bg-emerald-500": level === "excellent",
            "bg-blue-500": level === "good",
            "bg-amber-500": level === "fair",
            "bg-red-500": level === "poor",
          })}
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="text-xs text-slate-500 mt-1.5">{desc}</p>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}

export function AIResults() {
  const { layout, floorPlan, setStep, setIsGenerating } = useLayoutStore();
  const [rationaleOpen, setRationaleOpen] = useState(true);

  if (!layout) return null;

  const stats = layout.statistics;
  const mr = stats?.meeting_rooms ?? {};

  const handleExportSVG = () => {
    const svg = document.querySelector(".fp-viewer svg");
    if (!svg) return;
    const blob = new Blob([svg.outerHTML], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workplace-layout-${layout.layout_id}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(layout, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workplace-layout-${layout.layout_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full overflow-y-auto scrollbar-thin p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">AI Layout Generated</h3>
            <p className="text-xs text-slate-400">Layout #{layout.layout_id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportSVG}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            SVG
          </button>
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            JSON
          </button>
        </div>
      </div>

      {/* Warnings */}
      {layout.warnings.length > 0 && (
        <div className="space-y-1.5">
          {layout.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              {w}
            </div>
          ))}
        </div>
      )}

      {/* Score Cards */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <ScoreCard
            icon={<Heart className="w-4 h-4" />}
            title="Wellness"
            score={stats.wellness_score}
            desc="Amenity balance"
          />
          <ScoreCard
            icon={<Zap className="w-4 h-4" />}
            title="Efficiency"
            score={stats.efficiency_score}
            desc="Space utilisation"
          />
          <ScoreCard
            icon={<Users className="w-4 h-4" />}
            title="Collaboration"
            score={stats.collaboration_score}
            desc="Collaborative area %"
          />
        </div>
      )}

      {/* Key Statistics */}
      {stats && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-slate-500" />
            <h4 className="text-sm font-semibold text-slate-800">Space Statistics</h4>
          </div>
          <StatRow label="Total Desks" value={stats.total_desks} />
          <StatRow label="m² per Person" value={`${stats.sqm_per_person} m²`} />
          <StatRow label="Desk Ratio" value={`${Math.round(stats.desk_ratio * 100)}%`} />
          <StatRow label="Meeting Rooms (small)" value={mr.small ?? 0} />
          <StatRow label="Meeting Rooms (medium)" value={mr.medium ?? 0} />
          <StatRow label="Boardroom" value={mr.boardroom ?? 0} />
          <StatRow label="Phone Booths" value={mr.phone_booth ?? 0} />
          <StatRow label="Meeting Rooms / 100 ppl" value={stats.meeting_rooms_per_100_people} />
          <StatRow label="Collaboration Area" value={`${stats.collaboration_sqm} m²`} />
          <StatRow label="Focus Area" value={`${stats.focus_sqm} m²`} />
        </div>
      )}

      {/* Zones */}
      {layout.zones.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-4 h-4 text-slate-500" />
            <h4 className="text-sm font-semibold text-slate-800">Zones</h4>
          </div>
          {layout.zones.map((z) => (
            <div key={z.id} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
              <div
                className="w-4 h-4 rounded-md shrink-0"
                style={{ backgroundColor: z.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">{z.name}</div>
                {z.area > 0 && (
                  <div className="text-xs text-slate-400">{z.area.toFixed(0)} m²{z.headcount > 0 ? ` · ${z.headcount} people` : ""}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI Rationale */}
      {layout.ai_rationale && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-4">
          <button
            onClick={() => setRationaleOpen((o) => !o)}
            className="flex items-center justify-between w-full"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <h4 className="text-sm font-semibold text-blue-900">AI Design Rationale</h4>
            </div>
            {rationaleOpen ? (
              <ChevronUp className="w-4 h-4 text-blue-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-blue-500" />
            )}
          </button>
          {rationaleOpen && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="text-sm text-blue-800 mt-3 leading-relaxed"
            >
              {layout.ai_rationale}
            </motion.p>
          )}
        </div>
      )}

      {/* Recommendations */}
      {layout.ai_recommendations.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <h4 className="text-sm font-semibold text-slate-800">AI Recommendations</h4>
          </div>
          <ul className="space-y-2.5">
            {layout.ai_recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                <span className="w-5 h-5 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Design Principles */}
      {layout.design_principles.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <h4 className="text-sm font-semibold text-slate-800 mb-3">Design Principles Applied</h4>
          <ul className="space-y-1.5">
            {layout.design_principles.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                <span className="text-blue-500 mt-0.5">•</span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Regenerate */}
      <button
        onClick={() => {
          setIsGenerating(false);
          setStep("requirements");
        }}
        className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-colors shadow-sm"
      >
        <RefreshCw className="w-4 h-4" />
        Adjust Requirements & Regenerate
      </button>
    </div>
  );
}
