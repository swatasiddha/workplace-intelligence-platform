import React from "react";
import { motion } from "framer-motion";
import {
  Users, Briefcase, Building2, LayoutGrid, Settings2,
  ChevronRight, Sparkles, Info
} from "lucide-react";
import clsx from "clsx";
import { useLayoutStore } from "../../store/layoutStore";
import { generateLayout, generateDemoLayout } from "../../services/api";
import type { WorkStyle, WorkstationDensity } from "../../types";

const INDUSTRIES = [
  "technology", "finance", "legal", "media", "creative",
  "healthcare", "education", "consulting", "retail", "other",
];

const WORK_STYLES: Array<{ value: WorkStyle; label: string; desc: string }> = [
  { value: "hybrid", label: "Hybrid", desc: "Mix of assigned & flexible desks" },
  { value: "activity_based", label: "Activity-Based (ABW)", desc: "No assigned desks, variety of settings" },
  { value: "traditional", label: "Traditional", desc: "Fully assigned workstations" },
  { value: "hot_desking", label: "Hot Desking", desc: "Pure hot-desk, no assignments" },
];

const DENSITIES: Array<{ value: WorkstationDensity; label: string; sqm: string }> = [
  { value: "dense", label: "Dense", sqm: "7 m²/person" },
  { value: "standard", label: "Standard", sqm: "10 m²/person" },
  { value: "spacious", label: "Spacious", sqm: "14 m²/person" },
  { value: "executive", label: "Executive", sqm: "18 m²/person" },
];

export function RequirementsForm() {
  const {
    requirements, setRequirements, floorPlan, planId,
    setLayout, setLayoutId, setStep, setIsGenerating,
    setGeneratingProgress, setError, setFloorPlan,
  } = useLayoutStore();

  const handleGenerate = async () => {
    setIsGenerating(true);
    setStep("generating");
    setGeneratingProgress(0);
    setError(null);

    // Simulate progress while AI generates
    const timer = setInterval(() => {
      setGeneratingProgress((prev: number) => Math.min(prev + Math.random() * 8, 90));
    }, 800);

    try {
      let result;
      if (planId === "demo" || !planId) {
        result = await generateDemoLayout(requirements);
        if (result.floor_plan) setFloorPlan(result.floor_plan);
      } else {
        result = await generateLayout(planId, requirements);
      }
      setLayoutId(result.layout_id);
      setLayout(result.layout);
      setGeneratingProgress(100);
      setTimeout(() => {
        setIsGenerating(false);
        setStep("review");
      }, 500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      setError(msg);
      setIsGenerating(false);
      setStep("requirements");
    } finally {
      clearInterval(timer);
    }
  };

  const r = requirements;
  const fp = floorPlan;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-semibold text-slate-800">Workplace Intelligence Platform</span>
            {fp && (
              <span className="ml-3 text-sm text-slate-400">
                {fp.file_name} · {fp.total_area.toLocaleString()} m²
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">1</span>
          <span className="text-emerald-600 font-medium">Upload</span>
          <ChevronRight className="w-4 h-4" />
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">2</span>
          <span className="text-blue-700 font-medium">Requirements</span>
          <ChevronRight className="w-4 h-4" />
          <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xs font-bold">3</span>
          <span className="text-slate-400">Generate</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-1">Configure Your Workplace</h2>
            <p className="text-slate-500 text-sm">Tell us about your team and requirements — AI will generate the optimal layout.</p>
          </div>

          {/* Floor plan summary */}
          {fp && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-wrap gap-6 text-sm">
              <Stat label="Gross Area" value={`${fp.total_area.toLocaleString()} m²`} />
              <Stat label="Net Usable" value={`${fp.usable_area.toLocaleString()} m²`} />
              <Stat label="Core Area" value={`${fp.core_area} m²`} />
              <Stat label="Rooms Detected" value={`${fp.rooms.length}`} />
              {fp.warnings.length > 0 && (
                <div className="w-full flex items-start gap-2 text-amber-700 bg-amber-50 rounded-lg p-2">
                  <Info className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{fp.warnings[0]}</span>
                </div>
              )}
            </div>
          )}

          {/* Section 1: Headcount */}
          <Section icon={<Users className="w-4 h-4" />} title="People & Capacity">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Total Headcount" hint="People using this floor">
                <input
                  type="number"
                  min={1} max={2000}
                  value={r.headcount}
                  onChange={(e) => setRequirements({ headcount: parseInt(e.target.value) || 1 })}
                  className="input"
                />
              </Field>
              <Field label="Desk Sharing Ratio" hint="Desks per person (0.8 = 80%)">
                <div className="flex items-center gap-2">
                  <input
                    type="range" min={0.3} max={1.0} step={0.05}
                    value={r.desk_sharing_ratio}
                    onChange={(e) => setRequirements({ desk_sharing_ratio: parseFloat(e.target.value) })}
                    className="flex-1"
                  />
                  <span className="text-sm font-medium text-slate-700 w-10">
                    {Math.round(r.desk_sharing_ratio * 100)}%
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  = {Math.round(r.headcount * r.desk_sharing_ratio)} desks
                </p>
              </Field>
            </div>
          </Section>

          {/* Section 2: Work Style */}
          <Section icon={<Briefcase className="w-4 h-4" />} title="Work Style">
            <div className="grid grid-cols-2 gap-3">
              {WORK_STYLES.map((ws) => (
                <button
                  key={ws.value}
                  onClick={() => setRequirements({ work_style: ws.value })}
                  className={clsx(
                    "text-left p-3 rounded-xl border-2 transition-all",
                    r.work_style === ws.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:border-blue-200",
                  )}
                >
                  <div className="font-medium text-sm text-slate-800">{ws.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{ws.desc}</div>
                </button>
              ))}
            </div>
          </Section>

          {/* Section 3: Density */}
          <Section icon={<LayoutGrid className="w-4 h-4" />} title="Workstation Density">
            <div className="grid grid-cols-4 gap-3">
              {DENSITIES.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setRequirements({ density: d.value })}
                  className={clsx(
                    "text-center p-3 rounded-xl border-2 transition-all",
                    r.density === d.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:border-blue-200",
                  )}
                >
                  <div className="font-semibold text-sm text-slate-800">{d.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{d.sqm}</div>
                </button>
              ))}
            </div>
          </Section>

          {/* Section 4: Spaces */}
          <Section icon={<Building2 className="w-4 h-4" />} title="Space Mix">
            <div className="grid grid-cols-2 gap-4">
              <PercentField
                label="Meeting Rooms"
                value={r.meeting_room_percent}
                onChange={(v) => setRequirements({ meeting_room_percent: v })}
              />
              <PercentField
                label="Collaboration"
                value={r.collaboration_percent}
                onChange={(v) => setRequirements({ collaboration_percent: v })}
              />
              <PercentField
                label="Focus Spaces"
                value={r.focus_percent}
                onChange={(v) => setRequirements({ focus_percent: v })}
              />
              <PercentField
                label="Amenities (pantry/lounge)"
                value={r.amenity_percent}
                onChange={(v) => setRequirements({ amenity_percent: v })}
              />
            </div>
          </Section>

          {/* Section 5: Special Spaces */}
          <Section icon={<Settings2 className="w-4 h-4" />} title="Special Spaces">
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: "has_reception", label: "Reception" },
                { key: "has_boardroom", label: "Boardroom" },
                { key: "has_wellness_room", label: "Wellness Room" },
                { key: "has_mothers_room", label: "Mother's Room" },
                { key: "has_server_room", label: "Server Room" },
              ].map(({ key, label }) => (
                <label
                  key={key}
                  className={clsx(
                    "flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all",
                    r[key as keyof typeof r]
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:border-blue-200",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(r[key as keyof typeof r])}
                    onChange={(e) => setRequirements({ [key]: e.target.checked } as any)}
                    className="sr-only"
                  />
                  <div className={clsx(
                    "w-4 h-4 rounded border-2 flex items-center justify-center",
                    r[key as keyof typeof r] ? "bg-blue-600 border-blue-600" : "border-slate-400",
                  )}>
                    {r[key as keyof typeof r] && <span className="text-white text-xs">✓</span>}
                  </div>
                  <span className="text-sm font-medium text-slate-700">{label}</span>
                </label>
              ))}
            </div>
          </Section>

          {/* Section 6: Industry & Style */}
          <Section icon={<Briefcase className="w-4 h-4" />} title="Industry & Design Style">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Industry">
                <select
                  value={r.industry}
                  onChange={(e) => setRequirements({ industry: e.target.value })}
                  className="input"
                >
                  {INDUSTRIES.map((i) => (
                    <option key={i} value={i}>{i.charAt(0).toUpperCase() + i.slice(1)}</option>
                  ))}
                </select>
              </Field>
              <Field label="Design Style">
                <select
                  value={r.design_style}
                  onChange={(e) => setRequirements({ design_style: e.target.value })}
                  className="input"
                >
                  {["modern", "biophilic", "traditional", "creative", "minimal", "industrial"].map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </Field>
            </div>
          </Section>

          {/* Special requirements */}
          <Section icon={<Sparkles className="w-4 h-4" />} title="Special Requirements (optional)">
            <textarea
              rows={3}
              placeholder="e.g. 'Executive floor needs private offices along north facade' or 'Engineering team needs 4 adjacent bays of 20 desks each'…"
              value={r.special_requirements}
              onChange={(e) => setRequirements({ special_requirements: e.target.value })}
              className="input resize-none"
            />
          </Section>

          {/* Generate button */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={handleGenerate}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-2xl shadow-lg shadow-blue-200 hover:shadow-xl transition-all flex items-center justify-center gap-3 text-lg"
          >
            <Sparkles className="w-5 h-5" />
            Generate AI Layout with Claude
          </motion.button>
          <p className="text-center text-xs text-slate-400">
            Powered by Claude Opus 4.6 with adaptive thinking · BCO &amp; WELL aligned
          </p>
        </motion.div>
      </div>
    </div>
  );
}

function Section({
  icon, title, children
}: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4 text-slate-700 font-semibold">
        <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center">{icon}</div>
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({
  label, hint, children
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
        {hint && <span className="ml-1.5 text-xs text-slate-400">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

function PercentField({
  label, value, onChange
}: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <span className="text-sm font-semibold text-blue-600">{value}%</span>
      </div>
      <input
        type="range" min={0} max={35} step={1}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-blue-600 font-medium">{label}</div>
      <div className="text-base font-semibold text-slate-800">{value}</div>
    </div>
  );
}
