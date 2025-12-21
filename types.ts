
// 3D Engine Types
export type Vector3 = [number, number, number];
export type Euler = [number, number, number];
export type Color = string;

export enum ShapeType {
  BOX = 'BOX',
  SPHERE = 'SPHERE',
  CYLINDER = 'CYLINDER',
  CONE = 'CONE',
  PLANE = 'PLANE'
}

export interface CADObject {
  id: string;
  name: string;
  type: ShapeType;
  position: Vector3;
  rotation: Euler;
  scale: Vector3;
  color: Color;
  args?: number[]; // Specific args for geometry (e.g., radius, width)
  selected?: boolean;
}

// AI Interaction Types
export enum AIActionType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  CLEAR = 'CLEAR',
  FOCUS = 'FOCUS', // New: Move camera to object
  UNDO = 'UNDO',   // New: Revert last change
  REDO = 'REDO'    // New: Re-apply change
}

export interface AICommand {
  action: AIActionType;
  targetId?: string; // For updates/deletes/focus
  objectData?: Partial<CADObject>;
  reasoning: string; // Why the AI did this
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  thoughtProcess?: string;
  commands?: AICommand[];
  timestamp: number;
}
