export interface Project {
  id: string;
  name: string;
  description: string | null;
  label_config: LabelConfig;
  created_by: string;
  created_at: string;
  task_count?: number;
  annotation_count?: number;
}

export interface LabelConfig {
  type: "bbox" | "polygon" | "classification";
  labels: LabelOption[];
  instructions?: string;
}

export interface LabelOption {
  name: string;
  color: string;
}

export interface Task {
  id: string;
  project_id: string;
  data: TaskData;
  is_labeled: boolean;
  created_at: string;
  annotations?: Annotation[];
}

export interface TaskData {
  image?: string;
  [key: string]: unknown;
}

export interface Annotation {
  id: string;
  task_id: string;
  result: AnnotationResult[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AnnotationResult {
  type: "rectanglelabels" | "polygonlabels" | "choices";
  value: BBoxValue | PolygonValue | ChoiceValue;
  from_name: string;
  to_name: string;
}

export interface BBoxValue {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  rectanglelabels: string[];
}

export interface PolygonValue {
  points: [number, number][];
  polygonlabels: string[];
}

export interface ChoiceValue {
  choices: string[];
}
