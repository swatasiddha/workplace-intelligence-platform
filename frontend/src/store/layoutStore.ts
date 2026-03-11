import { create } from "zustand";
import type {
  FloorPlanData, ClientRequirements, GeneratedLayout, AppStep
} from "../types";

const defaultRequirements: ClientRequirements = {
  headcount: 80,
  desk_sharing_ratio: 0.8,
  work_style: "hybrid",
  density: "standard",
  meeting_room_percent: 15,
  collaboration_percent: 10,
  focus_percent: 5,
  amenity_percent: 8,
  small_meeting_rooms: 0,
  medium_meeting_rooms: 0,
  large_meeting_rooms: 0,
  phone_booths: 0,
  focus_pods: 0,
  has_reception: true,
  has_boardroom: true,
  has_wellness_room: false,
  has_mothers_room: false,
  has_server_room: false,
  industry: "technology",
  design_style: "modern",
  primary_color: "#2563EB",
  accent_color: "#10B981",
  departments: [],
  special_requirements: "",
};

interface LayoutStore {
  // State
  step: AppStep;
  planId: string | null;
  layoutId: string | null;
  floorPlan: FloorPlanData | null;
  layout: GeneratedLayout | null;
  requirements: ClientRequirements;
  isGenerating: boolean;
  generatingProgress: number;
  error: string | null;

  // Active layers for floor plan viewer
  showWalls: boolean;
  showRooms: boolean;
  showFurniture: boolean;
  showZones: boolean;
  showGrid: boolean;
  selectedSpaceId: string | null;

  // Actions
  setStep: (step: AppStep) => void;
  setPlanId: (id: string) => void;
  setFloorPlan: (fp: FloorPlanData) => void;
  setLayout: (layout: GeneratedLayout) => void;
  setLayoutId: (id: string) => void;
  setRequirements: (req: Partial<ClientRequirements>) => void;
  setIsGenerating: (v: boolean) => void;
  setGeneratingProgress: (v: number) => void;
  setError: (msg: string | null) => void;
  toggleLayer: (layer: "walls" | "rooms" | "furniture" | "zones" | "grid") => void;
  selectSpace: (id: string | null) => void;
  reset: () => void;
}

export const useLayoutStore = create<LayoutStore>((set) => ({
  step: "upload",
  planId: null,
  layoutId: null,
  floorPlan: null,
  layout: null,
  requirements: defaultRequirements,
  isGenerating: false,
  generatingProgress: 0,
  error: null,
  showWalls: true,
  showRooms: true,
  showFurniture: true,
  showZones: true,
  showGrid: false,
  selectedSpaceId: null,

  setStep: (step) => set({ step }),
  setPlanId: (planId) => set({ planId }),
  setFloorPlan: (floorPlan) => set({ floorPlan }),
  setLayout: (layout) => set({ layout }),
  setLayoutId: (layoutId) => set({ layoutId }),
  setRequirements: (req) =>
    set((s) => ({ requirements: { ...s.requirements, ...req } })),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  setGeneratingProgress: (generatingProgress) => set({ generatingProgress }),
  setError: (error) => set({ error }),
  toggleLayer: (layer) =>
    set((s) => {
      switch (layer) {
        case "walls": return { showWalls: !s.showWalls };
        case "rooms": return { showRooms: !s.showRooms };
        case "furniture": return { showFurniture: !s.showFurniture };
        case "zones": return { showZones: !s.showZones };
        case "grid": return { showGrid: !s.showGrid };
      }
    }),
  selectSpace: (selectedSpaceId) => set({ selectedSpaceId }),
  reset: () => set({
    step: "upload", planId: null, layoutId: null,
    floorPlan: null, layout: null,
    isGenerating: false, generatingProgress: 0, error: null,
  }),
}));
