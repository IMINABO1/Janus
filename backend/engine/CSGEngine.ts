// backend/engine/CSGEngine.ts
import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION, ADDITION, INTERSECTION } from 'three-bvh-csg';
import { CADObject, ShapeType } from '../../types';

// Defensive check to ensure library loaded correctly
if (typeof Brush === 'undefined' || typeof Evaluator === 'undefined') {
    throw new Error("Critical Dependency Error: 'three-bvh-csg' failed to load. The exported symbols Brush/Evaluator are undefined. Check import map versions.");
}

// Define the DSL available to the AI
class CADContext {
  private objects: CADObject[] = [];
  private material: THREE.MeshStandardMaterial;
  private evaluator: Evaluator;

  constructor() {
      this.material = new THREE.MeshStandardMaterial({ 
        color: 0xcccccc,
        roughness: 0.5,
        metalness: 0.5
      });
      
      this.evaluator = new Evaluator();
      this.evaluator.useGroups = true; 
  }

  // --- Primitives ---

  Box = (width = 1, height = 1, depth = 1) => {
    const geo = new THREE.BoxGeometry(width, height, depth);
    const brush = new Brush(geo, this.material.clone());
    brush.userData.type = 'BOX';
    brush.updateMatrixWorld();
    return brush;
  }

  Sphere = (radius = 0.5) => {
    const geo = new THREE.SphereGeometry(radius, 32, 32);
    const brush = new Brush(geo, this.material.clone());
    brush.userData.type = 'SPHERE';
    brush.updateMatrixWorld();
    return brush;
  }

  Cylinder = (radiusTop = 0.5, radiusBottom = 0.5, height = 1) => {
    const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 32);
    const brush = new Brush(geo, this.material.clone());
    brush.userData.type = 'CYLINDER';
    brush.updateMatrixWorld();
    return brush;
  }

  // --- Transformations ---
  
  Move = (mesh: Brush, x: number, y: number, z: number) => {
    if (!mesh) return mesh;
    mesh.position.set(x, y, z);
    mesh.updateMatrixWorld(); 
    return mesh;
  }

  Rotate = (mesh: Brush, x: number, y: number, z: number) => {
    if (!mesh) return mesh;
    mesh.rotation.set(x, y, z);
    mesh.updateMatrixWorld();
    return mesh;
  }

  Scale = (mesh: Brush, x: number, y: number, z: number) => {
    if (!mesh) return mesh;
    mesh.scale.set(x, y, z);
    mesh.updateMatrixWorld();
    return mesh;
  }

  Color = (mesh: Brush, hex: string) => {
    if (!mesh) return mesh;
    // Clone material/update it
    if (Array.isArray(mesh.material)) {
        mesh.material.forEach(m => (m as THREE.MeshStandardMaterial).color.set(hex));
    } else {
        const newMat = (mesh.material as THREE.MeshStandardMaterial).clone();
        newMat.color.set(hex);
        mesh.material = newMat;
    }
    return mesh;
  }

  // --- CSG Operations ---

  Union = (a: Brush, b: Brush) => {
    if (!a || !b) return a || b;
    a.updateMatrixWorld();
    b.updateMatrixWorld();
    const result = this.evaluator.evaluate(a, b, ADDITION);
    result.userData.type = 'MESH';
    // Ensure material is preserved/set
    result.material = a.material;
    return result;
  }

  Subtract = (a: Brush, b: Brush) => {
    if (!a || !b) return a || b;
    a.updateMatrixWorld();
    b.updateMatrixWorld();
    const result = this.evaluator.evaluate(a, b, SUBTRACTION);
    result.userData.type = 'MESH';
    result.material = a.material;
    return result;
  }

  Intersect = (a: Brush, b: Brush) => {
    if (!a || !b) return a || b;
    a.updateMatrixWorld();
    b.updateMatrixWorld();
    const result = this.evaluator.evaluate(a, b, INTERSECTION);
    result.userData.type = 'MESH';
    result.material = a.material;
    return result;
  }

  // --- Final Output ---
  Add = (mesh: Brush | THREE.Mesh, name: string) => {
    if (!mesh) return;
    
    // We clone geometry to detach it from the CSG processing chain
    const finalGeom = mesh.geometry.clone();
    
    // Extract color
    let color = '#cccccc';
    if (!Array.isArray(mesh.material)) {
        color = '#' + (mesh.material as THREE.MeshStandardMaterial).color.getHexString();
    }

    this.objects.push({
      id: `obj_${this.objects.length}_${Date.now()}`,
      name: name,
      type: ShapeType.MESH,
      position: [mesh.position.x, mesh.position.y, mesh.position.z],
      rotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z],
      scale: [mesh.scale.x, mesh.scale.y, mesh.scale.z],
      color: color,
      visible: true,
      selected: false,
      geometryData: finalGeom
    });
  }
  
  getResults = () => {
      return this.objects;
  }
}

export class CSGEngine {
    
  execute(code: string): CADObject[] {
    const context = new CADContext();
    
    // Create the function body.
    const functionBody = `
      const { Box, Sphere, Cylinder, Move, Rotate, Scale, Color, Union, Subtract, Intersect, Add } = ctx;
      try {
        ${code}
      } catch (e) {
        throw new Error("Line " + (e.lineNumber || '?') + ": " + e.message);
      }
    `;

    try {
      const func = new Function('ctx', functionBody);
      func(context);
      return context.getResults();
    } catch (e: any) {
      console.error("CSG Execution Error:", e);
      throw e;
    }
  }
}

export const csgEngine = new CSGEngine();
