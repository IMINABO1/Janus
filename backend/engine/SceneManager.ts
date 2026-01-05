//backend/SceneManager.tsx
import { CADObject, AICommand, AIActionType } from "../../types";

export class SceneManager {
  private objects: Map<string, CADObject>;
  private history: string[] = [];
  private redoStack: string[] = [];
  private maxHistory = 20;

  constructor() {
    this.objects = new Map();
  }

  public getObjects(): CADObject[] {
    return Array.from(this.objects.values());
  }

  public getObject(id: string): CADObject | undefined {
    return this.objects.get(id);
  }

  private saveState() {
    const state = this.exportScene();
    this.history.push(state);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
    // Clear redo stack on new action
    this.redoStack = [];
  }

  /**
   * Generates a unique name by appending a counter if the name already exists.
   * e.g. "Cube" -> "Cube1" -> "Cube2"
   */
  private getUniqueName(baseName: string, excludeId?: string): string {
    const taken = new Set<string>();
    for (const obj of this.objects.values()) {
        if (obj.id !== excludeId) taken.add(obj.name);
    }
    
    if (!taken.has(baseName)) return baseName;

    let counter = 1;
    let candidate = `${baseName}${counter}`;
    while (taken.has(candidate)) {
        counter++;
        candidate = `${baseName}${counter}`;
    }
    return candidate;
  }

  public renameObject(id: string, newName: string): void {
      const obj = this.objects.get(id);
      if (!obj) return;
      if (obj.name === newName) return;

      this.saveState();
      const uniqueName = this.getUniqueName(newName, id);
      this.objects.set(id, { ...obj, name: uniqueName });
  }

  public duplicateObject(id: string): void {
      const obj = this.objects.get(id);
      if (!obj) return;

      this.saveState();
      
      // Offset slightly so it's visible
      const newPos: [number, number, number] = [
          obj.position[0] + 1.5, 
          obj.position[1], 
          obj.position[2]
      ];
      
      const newId = `obj_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const newName = this.getUniqueName(obj.name);

      const newObj: CADObject = {
          ...obj,
          id: newId,
          name: newName,
          position: newPos,
          selected: false
      };
      
      this.objects.set(newId, newObj);
  }

  public processCommands(commands: AICommand[]): void {
    // Save state before processing if the commands modify the scene
    const modifiesScene = commands.some(c => 
      ['CREATE', 'UPDATE', 'DELETE', 'CLEAR'].includes(c.action)
    );

    if (modifiesScene) {
      this.saveState();
    }

    commands.forEach(cmd => {
      // Robustness: Sometimes AI puts the ID in objectData but forgets targetId
      // And sometimes it puts it in targetId for CREATE as well.
      const targetId = cmd.targetId || cmd.objectData?.id;

      switch (cmd.action) {
        case AIActionType.CREATE:
          if (cmd.objectData) {
            // Priority: objectData.id -> cmd.targetId -> random
            const id = cmd.objectData.id || targetId || `obj_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            
            // Ensure unique name
            const rawName = cmd.objectData.name || 'Object';
            const uniqueName = this.getUniqueName(rawName);

            // Merge defaults carefully to ensure visibility
            const newObj: CADObject = {
              id: id,
              name: uniqueName,
              type: cmd.objectData.type || 'BOX' as any,
              position: (cmd.objectData.position as any) || [0, 0, 0],
              rotation: (cmd.objectData.rotation as any) || [0, 0, 0],
              scale: (cmd.objectData.scale as any) || [1, 1, 1],
              color: cmd.objectData.color || '#3b82f6', // Default to a visible blue if missing
              visible: cmd.objectData.visible !== false,
              args: cmd.objectData.args || [],
              selected: false
            };
            this.objects.set(newObj.id, newObj);
          }
          break;

        case AIActionType.UPDATE:
          if (targetId && this.objects.has(targetId)) {
            const existing = this.objects.get(targetId)!;
            // Clean up incoming data to remove undefineds
            const cleanUpdates = Object.fromEntries(
                Object.entries(cmd.objectData || {}).filter(([_, v]) => v !== undefined && v !== null)
            );
            
            // If updating name, ensure uniqueness
            if (cleanUpdates.name && typeof cleanUpdates.name === 'string') {
                cleanUpdates.name = this.getUniqueName(cleanUpdates.name, targetId);
            }

            this.objects.set(targetId, {
              ...existing,
              ...cleanUpdates,
            });
          }
          break;

        case AIActionType.DELETE:
          if (targetId) {
            this.objects.delete(targetId);
          }
          break;
        
        case AIActionType.CLEAR:
          this.objects.clear();
          break;

        case AIActionType.UNDO:
          this.undo();
          break;

        case AIActionType.REDO:
          this.redo();
          break;
          
        case AIActionType.FOCUS:
          // Handled by Frontend, but valid command
          break;
      }
    });
  }

  public undo(): void {
    if (this.history.length === 0) return;
    
    // Save current state to redo stack
    this.redoStack.push(this.exportScene());
    
    const previousState = this.history.pop();
    if (previousState) {
      this.loadScene(previousState);
    }
  }

  public redo(): void {
    if (this.redoStack.length === 0) return;

    // Save current to history
    this.history.push(this.exportScene());

    const nextState = this.redoStack.pop();
    if (nextState) {
      this.loadScene(nextState);
    }
  }

  public exportScene(): string {
    return JSON.stringify(Array.from(this.objects.values()));
  }
  
  public loadScene(json: string): void {
      try {
          const loaded = JSON.parse(json);
          if(Array.isArray(loaded)) {
              this.objects.clear();
              loaded.forEach((obj: CADObject) => this.objects.set(obj.id, obj));
          }
      } catch (e) {
          console.error("Failed to load scene", e);
      }
  }
}
