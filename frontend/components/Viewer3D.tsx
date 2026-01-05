// frontend/components/Viewer3D.tsx
import React, { useRef, useImperativeHandle, forwardRef, useState, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, ContactShadows, GizmoHelper, GizmoViewport } from '@react-three/drei';
import * as THREE from 'three';
import { CADObject, ShapeType } from '../../types';

// Augment JSX namespace to recognize React Three Fiber elements
// declare global {
//   namespace JSX {
//     interface IntrinsicElements {
//       ambientLight: any;
//       spotLight: any;
//       group: any;
//       mesh: any;
//       meshStandardMaterial: any;
//       meshBasicMaterial: any;
//       boxGeometry: any;
//     }
//   }
// }

interface ViewerProps {
  objects: CADObject[];
  onSelect: (id: string | null) => void;
  selectedId: string | null;
}

export interface Viewer3DHandle {
  captureScreenshot: () => string;
  captureViews: () => { view: string; base64: string }[];
  focusObject: (id: string, position: [number, number, number]) => void;
}

// --- Icons ---
const HandIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>
);

const GridIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
);


const RenderObject: React.FC<{ obj: CADObject; isSelected: boolean; onClick: () => void }> = ({ obj, isSelected, onClick }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  if (obj.visible === false) return null;

  // If it's a MESH type, we rely on the geometryData being present.
  // The geometryData is a valid THREE.Geometry (cloned from engine).
  const geometry = useMemo(() => {
     if (obj.type === ShapeType.MESH && obj.geometryData) {
         return obj.geometryData;
     }
     
     // Fallback for legacy types (though engine produces MESH primarily now)
     switch (obj.type) {
        case ShapeType.BOX: return new THREE.BoxGeometry(1, 1, 1);
        case ShapeType.SPHERE: return new THREE.SphereGeometry(0.5, 32, 32);
        default: return new THREE.BoxGeometry(1, 1, 1);
     }
  }, [obj.type, obj.geometryData]);

  return (
    <group>
        <mesh
        ref={meshRef}
        geometry={geometry}
        position={obj.position}
        rotation={obj.rotation}
        scale={obj.scale}
        onClick={(e) => {
            e.stopPropagation();
            onClick();
        }}
        castShadow
        receiveShadow
        >
        <meshStandardMaterial 
            color={isSelected ? "#3b82f6" : obj.color} 
            metalness={0.5} 
            roughness={0.5} 
        />
        </mesh>
        {isSelected && (
             <mesh position={obj.position} rotation={obj.rotation} scale={obj.scale}>
                 <boxGeometry args={[1.2, 1.2, 1.2]} />{/* Bounding box visualizer approximation */}
                 <meshBasicMaterial color="#60a5fa" wireframe transparent opacity={0.5} />
            </mesh>
        )}
    </group>
  );
};

const ControlsHandler = forwardRef<any, { interactionMode: 'rotate' | 'pan' }>(({ interactionMode }, ref) => {
  const controlsRef = useRef<any>(null);
  useImperativeHandle(ref, () => controlsRef.current);

  return (
    <OrbitControls 
        ref={controlsRef} 
        makeDefault 
        mouseButtons={{
            LEFT: interactionMode === 'pan' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN
        }}
    />
  );
});

const SceneContent = forwardRef<Viewer3DHandle, ViewerProps & { showGrid: boolean; interactionMode: 'rotate' | 'pan' }>(({ objects, onSelect, selectedId, showGrid, interactionMode }, ref) => {
    const { gl, scene, camera } = useThree();
    const controlsRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
        captureScreenshot: () => {
            gl.render(scene, camera);
            return gl.domElement.toDataURL('image/png');
        },
        captureViews: () => {
            const views: { view: string; base64: string }[] = [];
            
            // Store original camera state
            const originalPos = camera.position.clone();
            const originalRot = camera.rotation.clone();
            const originalUp = camera.up.clone();
            const controlsTarget = controlsRef.current ? controlsRef.current.target.clone() : new THREE.Vector3(0,0,0);

            // Calculate scene center (naive) or use (0,0,0)
            const target = new THREE.Vector3(0, 0, 0);
            const dist = 8;
            const elevation = 4; // Slight elevation to see 3D structure better

            // Capture 8 views at 45 degree intervals
            for (let i = 0; i < 8; i++) {
                const angle = (i * 45) * (Math.PI / 180);
                // Orbit around Y axis
                const x = dist * Math.sin(angle);
                const z = dist * Math.cos(angle);
                
                camera.position.set(x, elevation, z);
                camera.up.set(0, 1, 0);
                camera.lookAt(target);
                
                if(controlsRef.current) {
                    controlsRef.current.target.copy(target);
                    controlsRef.current.update();
                }
                
                // Force render
                gl.render(scene, camera);
                views.push({ 
                    view: `Orbit_Angle_${i * 45}`, 
                    base64: gl.domElement.toDataURL('image/png') 
                });
            }

            // Restore original state
            camera.position.copy(originalPos);
            camera.rotation.copy(originalRot);
            camera.up.copy(originalUp);
            if(controlsRef.current) {
                controlsRef.current.target.copy(controlsTarget);
                controlsRef.current.update();
            }

            return views;
        },
        focusObject: (id: string, position: [number, number, number]) => {
            if (controlsRef.current) {
                const target = new THREE.Vector3(...position);
                controlsRef.current.target.copy(target);
                camera.position.set(target.x + 3, target.y + 3, target.z + 3);
                camera.lookAt(target);
                controlsRef.current.update();
            }
        },
        resetView: () => { /* ... */ },
        zoomIn: () => { /* ... */ }
    }));

    return (
        <>
            <ambientLight intensity={0.5} />
            <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} castShadow intensity={1} />
            <Environment preset="city" />
            
            <group>
            {objects.map((obj) => (
                <RenderObject
                key={obj.id}
                obj={obj}
                isSelected={selectedId === obj.id}
                onClick={() => onSelect(obj.id)}
                />
            ))}
            </group>

            <ContactShadows position={[0, -0.01, 0]} opacity={0.4} scale={20} blur={1.5} far={2} resolution={256} color="#000000"/>
            {showGrid && <Grid infiniteGrid fadeDistance={30} sectionColor="#475569" cellColor="#1e293b" />}
            <ControlsHandler ref={controlsRef} interactionMode={interactionMode} />
            <GizmoHelper alignment="top-right" margin={[80, 80]}>
                <GizmoViewport axisColors={['#ef4444', '#22c55e', '#3b82f6']} labelColor="white"/>
            </GizmoHelper>
        </>
    );
});

const Viewer3D = forwardRef<Viewer3DHandle, ViewerProps>((props, ref) => {
  const [interactionMode, setInteractionMode] = useState<'rotate' | 'pan'>('rotate');
  const [showGrid, setShowGrid] = useState(true);
  const sceneRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
      captureScreenshot: () => sceneRef.current?.captureScreenshot(),
      captureViews: () => sceneRef.current?.captureViews(),
      focusObject: (id, pos) => sceneRef.current?.focusObject(id, pos)
  }));

  return (
    <div className="w-full h-full bg-slate-900 relative">
      <Canvas shadows camera={{ position: [5, 5, 5], fov: 50 }} gl={{ preserveDrawingBuffer: true }}>
        <SceneContent ref={sceneRef} {...props} showGrid={showGrid} interactionMode={interactionMode} />
      </Canvas>
      <div className="absolute top-28 right-5 flex flex-col gap-3 pointer-events-auto">
        {/* Simple Toolbar */}
        <button onClick={() => setInteractionMode(m => m === 'rotate' ? 'pan' : 'rotate')} className="w-10 h-10 rounded-full bg-slate-800/80 border border-slate-600 text-slate-300 flex items-center justify-center hover:bg-slate-700 transition-all"><HandIcon /></button>
        <button onClick={() => setShowGrid(!showGrid)} className="w-10 h-10 rounded-full bg-slate-800/80 border border-slate-600 text-slate-300 flex items-center justify-center hover:bg-slate-700 transition-all"><GridIcon /></button>
      </div>
    </div>
  );
});

export default Viewer3D;