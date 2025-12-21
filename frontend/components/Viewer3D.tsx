
import React, { useRef, useImperativeHandle, forwardRef, useState, useEffect } from 'react';
import { Canvas, useThree, ThreeElements } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, ContactShadows, GizmoHelper, GizmoViewport } from '@react-three/drei';
import * as THREE from 'three';
import { CADObject, ShapeType } from '../../types';

interface ViewerProps {
  objects: CADObject[];
  onSelect: (id: string | null) => void;
  selectedId: string | null;
}

declare global {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

export interface Viewer3DHandle {
  captureScreenshot: () => string;
  focusObject: (id: string, position: [number, number, number]) => void;
}

// --- Icons ---
const HandIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>
);

const ZoomIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
);

const CameraIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
);

const GridIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
);


const RenderObject: React.FC<{ obj: CADObject; isSelected: boolean; onClick: () => void }> = ({ obj, isSelected, onClick }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  const position = new THREE.Vector3(...obj.position);
  const rotation = new THREE.Euler(...obj.rotation);
  const scale = new THREE.Vector3(...obj.scale);

  let geometry;
  switch (obj.type) {
    case ShapeType.BOX:
      geometry = <boxGeometry args={obj.args?.length ? obj.args as [number, number, number] : [1, 1, 1]} />;
      break;
    case ShapeType.SPHERE:
      geometry = <sphereGeometry args={obj.args?.length ? obj.args as [number, number, number] : [0.5, 32, 32]} />;
      break;
    case ShapeType.CYLINDER:
      geometry = <cylinderGeometry args={obj.args?.length ? obj.args as [number, number, number, number] : [0.5, 0.5, 1, 32]} />;
      break;
    case ShapeType.CONE:
      geometry = <coneGeometry args={obj.args?.length ? obj.args as [number, number, number] : [0.5, 1, 32]} />;
      break;
    case ShapeType.PLANE:
      geometry = <planeGeometry args={obj.args?.length ? obj.args as [number, number] : [10, 10]} />;
      break;
    default:
      geometry = <boxGeometry />;
  }

  return (
    <group>
        <mesh
        ref={meshRef}
        position={position}
        rotation={rotation}
        scale={scale}
        onClick={(e) => {
            e.stopPropagation();
            onClick();
        }}
        castShadow
        receiveShadow
        >
        {geometry}
        <meshStandardMaterial 
            color={isSelected ? "#3b82f6" : obj.color} 
            metalness={0.5} 
            roughness={0.5} 
        />
        </mesh>
        {isSelected && (
            <mesh position={position} rotation={rotation} scale={scale}>
                 <boxGeometry args={[1.05, 1.05, 1.05]} />
                 <meshBasicMaterial color="#60a5fa" wireframe transparent opacity={0.5} />
            </mesh>
        )}
    </group>
  );
};

// Controls wrapper to access orbit controls
interface ControlsHandlerProps {
    interactionMode: 'rotate' | 'pan';
}

const ControlsHandler = forwardRef<any, ControlsHandlerProps>(({ interactionMode }, ref) => {
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

interface SceneContentProps extends ViewerProps {
    showGrid: boolean;
    interactionMode: 'rotate' | 'pan';
}

// Scene Content to handle internal state
const SceneContent = forwardRef<Viewer3DHandle, SceneContentProps>(({ objects, onSelect, selectedId, showGrid, interactionMode }, ref) => {
    const { gl, scene, camera } = useThree();
    const controlsRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
        captureScreenshot: () => {
            gl.render(scene, camera);
            return gl.domElement.toDataURL('image/png');
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
        resetView: () => {
            if (controlsRef.current) {
                controlsRef.current.target.set(0, 0, 0);
                camera.position.set(5, 5, 5);
                camera.lookAt(0, 0, 0);
                controlsRef.current.update();
            }
        },
        zoomIn: () => {
            // Simple dolly in step
            const direction = new THREE.Vector3();
            camera.getWorldDirection(direction);
            camera.position.addScaledVector(direction, 2);
            controlsRef.current?.update();
        }
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

            {/* Shadows */}
            <ContactShadows 
                position={[0, -0.01, 0]} 
                opacity={0.4} 
                scale={20} 
                blur={1.5} 
                far={2} 
                resolution={256} 
                color="#000000"
            />
            
            {showGrid && <Grid infiniteGrid fadeDistance={30} sectionColor="#475569" cellColor="#1e293b" />}
            
            <ControlsHandler ref={controlsRef} interactionMode={interactionMode} />
            
            {/* View Gizmo (Blender-style) */}
            <GizmoHelper alignment="top-right" margin={[80, 80]}>
                <GizmoViewport 
                    axisColors={['#ef4444', '#22c55e', '#3b82f6']} 
                    labelColor="white"
                />
            </GizmoHelper>
        </>
    );
});

const Viewer3D = forwardRef<Viewer3DHandle, ViewerProps>((props, ref) => {
  const [interactionMode, setInteractionMode] = useState<'rotate' | 'pan'>('rotate');
  const [showGrid, setShowGrid] = useState(true);
  
  // Internal ref to access SceneContent methods (reset, zoom) from toolbar
  const sceneRef = useRef<any>(null);

  // Expose methods to parent via forwarded ref
  useImperativeHandle(ref, () => ({
      captureScreenshot: () => sceneRef.current?.captureScreenshot(),
      focusObject: (id, pos) => sceneRef.current?.focusObject(id, pos)
  }));

  const handleReset = () => sceneRef.current?.resetView();
  const handleZoom = () => sceneRef.current?.zoomIn();

  return (
    <div className="w-full h-full bg-slate-900 relative">
      <Canvas 
        shadows 
        camera={{ position: [5, 5, 5], fov: 50 }}
        gl={{ preserveDrawingBuffer: true }}
      >
        <SceneContent 
            ref={sceneRef} 
            {...props} 
            showGrid={showGrid}
            interactionMode={interactionMode}
        />
      </Canvas>
      
      {/* Navigation Toolbar (Blender-style) */}
      <div className="absolute top-28 right-5 flex flex-col gap-3 pointer-events-auto">
        <button 
            onClick={() => setInteractionMode(m => m === 'rotate' ? 'pan' : 'rotate')}
            className={`w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md border transition-all shadow-lg ${
                interactionMode === 'pan' 
                ? 'bg-blue-600 border-blue-400 text-white' 
                : 'bg-slate-800/80 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
            title="Pan Tool (Hand)"
        >
            <HandIcon />
        </button>

        <button 
            onClick={handleZoom}
            className="w-10 h-10 rounded-full bg-slate-800/80 backdrop-blur-md border border-slate-600 text-slate-300 flex items-center justify-center hover:bg-slate-700 hover:text-white transition-all shadow-lg"
            title="Zoom In"
        >
            <ZoomIcon />
        </button>

        <button 
            onClick={handleReset}
            className="w-10 h-10 rounded-full bg-slate-800/80 backdrop-blur-md border border-slate-600 text-slate-300 flex items-center justify-center hover:bg-slate-700 hover:text-white transition-all shadow-lg"
            title="Reset View"
        >
            <CameraIcon />
        </button>
        
        <button 
            onClick={() => setShowGrid(!showGrid)}
            className={`w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md border transition-all shadow-lg ${
                showGrid
                ? 'bg-slate-800/80 border-slate-600 text-blue-400 hover:text-blue-300' 
                : 'bg-slate-800/80 border-slate-600 text-slate-500 hover:text-slate-400'
            }`}
            title="Toggle Grid"
        >
            <GridIcon />
        </button>
      </div>

      <div className="absolute top-4 left-4 pointer-events-none">
        <div className="bg-slate-800/80 backdrop-blur text-xs text-slate-300 p-2 rounded border border-slate-700">
           <p className="font-bold text-white mb-1">Mode: {interactionMode === 'pan' ? 'PAN (Hand)' : 'ROTATE'}</p>
           <p>Left Click: {interactionMode === 'pan' ? 'Pan' : 'Rotate'}</p>
           <p>Right Click: Pan</p>
           <p>Scroll: Zoom</p>
        </div>
      </div>
    </div>
  );
});

export default Viewer3D;
