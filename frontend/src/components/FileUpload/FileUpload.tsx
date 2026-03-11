import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileCheck, AlertCircle, Building2, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { uploadFloorPlan } from "../../services/api";
import { useLayoutStore } from "../../store/layoutStore";
import clsx from "clsx";

export function FileUpload() {
  const { setFloorPlan, setPlanId, setStep, setError } = useLayoutStore();
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const onDrop = useCallback(async (accepted: File[], rejected: File[]) => {
    if (rejected.length > 0) {
      setStatus("error");
      setMessage("Only .DWG and .DXF files are accepted.");
      return;
    }
    if (accepted.length === 0) return;

    const file = accepted[0];
    setStatus("uploading");
    setMessage(`Parsing ${file.name}…`);

    try {
      const result = await uploadFloorPlan(file);
      setFloorPlan(result.floor_plan);
      setPlanId(result.plan_id);
      setStatus("success");
      setMessage(`Parsed successfully — ${result.floor_plan.total_area.toLocaleString()} m² floor plate detected`);
      setTimeout(() => setStep("requirements"), 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setStatus("error");
      setMessage(msg);
      setError(msg);
    }
  }, [setFloorPlan, setPlanId, setStep, setError]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/octet-stream": [".dwg", ".dxf"], "image/vnd.dxf": [".dxf"] },
    maxFiles: 1,
    disabled: status === "uploading",
  });

  const handleDemo = async () => {
    setStatus("uploading");
    setMessage("Loading demo floor plan…");
    // Use a fake plan_id for demo — the backend /demo-layout endpoint handles it
    setPlanId("demo");
    setStatus("success");
    setMessage("Demo floor plan loaded — 2,000 m² office floor plate");
    setTimeout(() => setStep("requirements"), 800);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10 max-w-2xl"
      >
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Workplace Intelligence Platform</h1>
            <p className="text-sm text-slate-500">AI-powered office interior design</p>
          </div>
        </div>
        <p className="text-slate-600 text-lg leading-relaxed">
          Upload your empty floor plan (.DWG or .DXF) and let AI automatically detect walls,
          columns and core elements, then generate an optimised workplace layout — customised
          to your team's exact requirements.
        </p>
      </motion.div>

      {/* Upload Zone */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-xl"
      >
        <div
          {...getRootProps()}
          className={clsx(
            "relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200",
            isDragActive ? "border-blue-500 bg-blue-50 scale-[1.01]" : "border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50/30",
            status === "uploading" && "pointer-events-none opacity-70",
          )}
        >
          <input {...getInputProps()} />
          <AnimatePresence mode="wait">
            {status === "idle" || status === "error" ? (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-8 h-8 text-blue-600" />
                </div>
                <p className="text-lg font-semibold text-slate-800 mb-1">
                  {isDragActive ? "Drop your floor plan here" : "Drop your floor plan here"}
                </p>
                <p className="text-slate-500 mb-4">or click to browse — .DWG or .DXF files</p>
                <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
                  <span>AutoCAD 2000–2024</span>
                  <span>·</span>
                  <span>DXF R12–R2018</span>
                  <span>·</span>
                  <span>Max 50 MB</span>
                </div>
              </motion.div>
            ) : status === "uploading" ? (
              <motion.div key="uploading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-slate-700 font-medium">{message}</p>
                <p className="text-slate-400 text-sm mt-1">Analysing geometry…</p>
              </motion.div>
            ) : status === "success" ? (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FileCheck className="w-8 h-8 text-emerald-600" />
                </div>
                <p className="text-emerald-700 font-semibold">{message}</p>
                <p className="text-slate-400 text-sm mt-1">Proceeding to requirements…</p>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {status === "error" && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-4 py-2 text-sm"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{message}</span>
            </motion.div>
          )}
        </div>

        {/* Demo mode */}
        <div className="mt-4 text-center">
          <button
            onClick={handleDemo}
            disabled={status === "uploading"}
            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            <Zap className="w-4 h-4" />
            Try with demo floor plan (2,000 m² office)
          </button>
        </div>
      </motion.div>

      {/* Feature pills */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex flex-wrap gap-3 justify-center mt-10 max-w-2xl"
      >
        {[
          "🏗️ Auto-detects walls & columns",
          "🧠 Claude AI layout generation",
          "📐 BCO/WELL compliant",
          "🎨 Fully customisable",
          "📊 Space utilisation analytics",
          "🌿 Biophilic design options",
        ].map((feat) => (
          <span
            key={feat}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-full text-sm text-slate-600 shadow-sm"
          >
            {feat}
          </span>
        ))}
      </motion.div>
    </div>
  );
}
