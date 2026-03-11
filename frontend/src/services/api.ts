import axios from "axios";
import type { ClientRequirements, FloorPlanData, GeneratedLayout } from "../types";

const api = axios.create({ baseURL: "/api" });

export async function uploadFloorPlan(file: File): Promise<{ plan_id: string; floor_plan: FloorPlanData }> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post("/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function analyzeFloorPlan(planId: string, requirements: ClientRequirements) {
  const { data } = await api.post(`/analyze/${planId}`, requirements);
  return data;
}

export async function generateLayout(
  planId: string,
  requirements: ClientRequirements
): Promise<{ layout_id: string; layout: GeneratedLayout }> {
  const { data } = await api.post(`/generate-layout/${planId}`, requirements);
  return data;
}

export async function generateDemoLayout(
  requirements: ClientRequirements
): Promise<{ layout_id: string; floor_plan: FloorPlanData; layout: GeneratedLayout }> {
  const { data } = await api.post("/demo-layout", requirements);
  return data;
}

export async function getSpaceTypes(): Promise<Array<{ value: string; label: string; color: string }>> {
  const { data } = await api.get("/space-types");
  return data;
}

export async function updateLayout(
  layoutId: string,
  updates: Partial<GeneratedLayout>
): Promise<{ layout: GeneratedLayout }> {
  const { data } = await api.put(`/layout/${layoutId}`, updates);
  return data;
}
