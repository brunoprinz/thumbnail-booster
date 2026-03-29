export interface VideoEdit {
  id: string;
  type: 'text' | 'image';
  startTime: number;
  endTime: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  content?: string; // For text
  description?: string; // For image placeholder
  imageUrl?: string; // For uploaded image
  style?: {
    fontSize?: number;
    color?: string;
    fontFamily?: string;
    borderColor?: string;
    borderWidth?: number;
  };
}

export interface VideoAdjustments {
  brightness: number;
  contrast: number;
  saturation: number;
}

export interface ProjectState {
  videoFile: File | null;
  videoUrl: string | null;
  edits: VideoEdit[];
  adjustments: VideoAdjustments;
  duration: number;
}
