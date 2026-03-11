export interface Point {
  x: number;
  y: number;
}

export interface BoundingBox {
  min_x: number;
  min_y: number;
  max_x: number;
  max_y: number;
}

export interface WallSegment {
  start: Point;
  end: Point;
  thickness: number;
  layer: string;
}

export interface Room {
  id: string;
  vertices: Point[];
  area: number;
  perimeter: number;
  centroid: Point;
  label: string;
  room_type: string;
  aspect_ratio: number;
}

export interface CoreElement {
  id: string;
  element_type: string;
  vertices: Point[];
  area: number;
  centroid: Point;
  label: string;
}

export interface FloorPlanData {
  file_name: string;
  file_format: string;
  bounding_box: BoundingBox;
  scale_factor: number;
  total_area: number;
  usable_area: number;
  core_area: number;
  walls: WallSegment[];
  rooms: Room[];
  core_elements: CoreElement[];
  columns: Point[];
  floor_outline: Point[];
  layers: string[];
  unit: string;
  warnings: string[];
}

export type SpaceType =
  | "workstation"
  | "private_office"
  | "meeting_room_small"
  | "meeting_room_medium"
  | "meeting_room_large"
  | "boardroom"
  | "collaboration"
  | "focus_pod"
  | "breakout"
  | "lounge"
  | "reception"
  | "pantry"
  | "phone_booth"
  | "copy_print"
  | "storage"
  | "wellness_room"
  | "circulation";

export type WorkStyle = "activity_based" | "hybrid" | "traditional" | "hot_desking";
export type WorkstationDensity = "dense" | "standard" | "spacious" | "executive";

export interface ClientRequirements {
  headcount: number;
  desk_sharing_ratio: number;
  work_style: WorkStyle;
  density: WorkstationDensity;
  meeting_room_percent: number;
  collaboration_percent: number;
  focus_percent: number;
  amenity_percent: number;
  small_meeting_rooms: number;
  medium_meeting_rooms: number;
  large_meeting_rooms: number;
  phone_booths: number;
  focus_pods: number;
  has_reception: boolean;
  has_boardroom: boolean;
  has_wellness_room: boolean;
  has_mothers_room: boolean;
  has_server_room: boolean;
  industry: string;
  design_style: string;
  primary_color: string;
  accent_color: string;
  departments: Array<{ name: string; headcount: number }>;
  special_requirements: string;
}

export interface FurnitureItem {
  id: string;
  space_type: SpaceType;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: string;
  capacity: number;
  zone: string;
}

export interface SpaceAllocation {
  id: string;
  space_type: SpaceType;
  label: string;
  vertices: Point[];
  area: number;
  capacity: number;
  color: string;
  zone: string;
  furniture: FurnitureItem[];
}

export interface LayoutZone {
  id: string;
  name: string;
  color: string;
  department?: string;
  area: number;
  headcount: number;
}

export interface LayoutStatistics {
  total_desks: number;
  total_meeting_capacity: number;
  meeting_rooms: Record<string, number>;
  collaboration_sqm: number;
  focus_sqm: number;
  amenity_sqm: number;
  desk_sqm: number;
  circulation_sqm: number;
  usable_sqm: number;
  sqm_per_person: number;
  desk_ratio: number;
  meeting_rooms_per_100_people: number;
  phone_booths_per_100_people: number;
  wellness_score: number;
  efficiency_score: number;
  collaboration_score: number;
}

export interface GeneratedLayout {
  layout_id: string;
  floor_plan_id: string;
  requirements: ClientRequirements;
  spaces: SpaceAllocation[];
  zones: LayoutZone[];
  furniture: FurnitureItem[];
  statistics: LayoutStatistics | null;
  ai_rationale: string;
  ai_recommendations: string[];
  design_principles: string[];
  warnings: string[];
  version: number;
}

export type AppStep = "upload" | "requirements" | "generating" | "review";
