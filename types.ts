// types.ts

// 3D Engine Types
export type Vector3 = [number, number, number];
export type Euler = [number, number, number];
export type Color = string;

export enum ShapeType {
  BOX = 'BOX',
  SPHERE = 'SPHERE',
  CYLINDER = 'CYLINDER',
  CONE = 'CONE',
  PLANE = 'PLANE',
  MESH = 'MESH' // New: for CSG results
}

export interface CADObject {
  id: string;
  name: string;
  type: ShapeType;
  position: Vector3;
  rotation: Euler;
  scale: Vector3;
  color: Color;
  args?: number[]; 
  selected?: boolean;
  visible?: boolean;
  geometryData?: any; // To store the Three.js geometry for MESH types
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  thoughtProcess?: string;
  code?: string; // New: store the generated code
  timestamp: number;
}

export enum AIActionType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  CLEAR = 'CLEAR',
  UNDO = 'UNDO',
  REDO = 'REDO',
  FOCUS = 'FOCUS'
}

export interface AICommand {
  action: AIActionType;
  targetId?: string;
  reasoning?: string;
  objectData?: Partial<CADObject>;
}
