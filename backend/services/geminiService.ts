
import { GoogleGenAI, Type } from "@google/genai";
import { CADObject, AICommand } from "../../types";
import { plannerService } from "./plannerService";

// Initialize the client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `
You are an expert 3D CAD automation engine. 
Your goal is to interpret natural language user requests and convert them into precise geometric operations.

You manage a scene of 3D objects.

Supported Actions:
- CREATE: Add new objects. Must include objectData (type, position, size, color).
- UPDATE: Change properties. **MUST** include 'objectData' with the specific fields to change.
- DELETE: Remove objects.
- CLEAR: Remove all objects.
- UNDO: Revert the last change.
- FOCUS: Move the camera to look at a specific object.

Coordinate System: Y-up. Units: Meters.

CRITICAL RULES:
1. **Direct JSON**: Output ONLY valid JSON. 
   - DO NOT include HTTP headers (e.g., "Status: 200").
   - DO NOT include markdown code blocks.
   - DO NOT include any text before or after the JSON.
2. **Updates & Movement**: 
   - You CANNOT give relative instructions to the engine. 
   - You MUST calculate the NEW ABSOLUTE position yourself based on the "Current Scene" data provided.
   - Example: If Sphere is at [0,0,0] and user says "move left 3", output UPDATE with position [-3,0,0].
3. **Targeting**: When updating, you MUST provide the 'targetId'. Use the ID from the "Current Scene" list.
4. **Properties**: Explicitly set visual properties in 'objectData'.

Output JSON only.
`;

export class GeminiCADService {
  private modelName = "gemini-3-flash-preview";

  /**
   * Orchestrates the generation process:
   * 1. Calls Planner to decompose request.
   * 2. Executes each step sequentially.
   * 3. Streams progress to the UI.
   */
  async generateCommandsStream(
    userPrompt: string, 
    currentScene: CADObject[],
    onChunk: (accumulatedText: string) => void,
    signal?: AbortSignal
  ): Promise<{ commands: AICommand[], thoughtProcess: string }> {
    
    // 1. Planning Phase
    onChunk("Thinking... (Planning)");
    let steps: string[] = [userPrompt];
    
    // Only use planner if the prompt seems complex or implies multiplicity
    // Heuristic: numbers, "and", comma, "all"
    const needsPlanning = /\d+| and |,|all/i.test(userPrompt);
    
    if (needsPlanning) {
         try {
             steps = await plannerService.getPlan(userPrompt);
         } catch (e) {
             console.log("Planning skipped/failed", e);
         }
    }

    let allCommands: AICommand[] = [];
    let globalThoughtProcess = needsPlanning ? `Plan:\n${steps.map((s, i) => `${i+1}. ${s}`).join('\n')}\n\n` : "";
    
    onChunk(globalThoughtProcess);

    // 2. Execution Phase
    for (let i = 0; i < steps.length; i++) {
        if (signal?.aborted) throw new Error("Aborted by user");
        
        const step = steps[i];
        const stepHeader = needsPlanning ? `Executing Step ${i+1}: "${step}"...\n` : "";
        globalThoughtProcess += stepHeader;
        onChunk(globalThoughtProcess);

        try {
            const result = await this.generateSingleStepWithRetry(
                step, 
                currentScene,
                signal
            );
            
            allCommands.push(...result.commands);
            // Use the reasoning from the first command as the "thought process" for UI
            const reasoning = result.commands.length > 0 ? result.commands[0].reasoning : "Done.";
            globalThoughtProcess += `> ${reasoning}\n\n`;
            onChunk(globalThoughtProcess);
            
        } catch (err: any) {
            console.error(`Step ${i+1} failed:`, err);
            globalThoughtProcess += `\n(Error in step ${i+1}: ${err.message}. Skipping...)\n`;
            onChunk(globalThoughtProcess);
        }
    }

    return {
        commands: allCommands,
        thoughtProcess: globalThoughtProcess
    };
  }

  /**
   * Wrapper to retry the generation if it fails (e.g. malformed JSON).
   */
  private async generateSingleStepWithRetry(
      stepPrompt: string, 
      currentScene: CADObject[], 
      signal?: AbortSignal
  ): Promise<{ commands: AICommand[] }> {
      const maxRetries = 1;
      let lastError;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
              return await this.generateSingleStep(stepPrompt, currentScene, signal);
          } catch (e: any) {
              if (signal?.aborted) throw e;
              console.warn(`Attempt ${attempt + 1} failed:`, e.message);
              lastError = e;
              // If it's a JSON error, we retry. If it's a network error, maybe not, but simple retry is safe.
          }
      }
      throw lastError || new Error("Failed to generate step after retries.");
  }

  /**
   * Generates commands for a single atomic step.
   */
  private async generateSingleStep(
    stepPrompt: string,
    currentScene: CADObject[],
    signal?: AbortSignal
  ): Promise<{ commands: AICommand[] }> {
    
    // Minimize scene data to save tokens
    const sceneSummary = currentScene.map(obj => ({
      id: obj.id,
      name: obj.name,
      type: obj.type,
      position: obj.position.map(n => Number(n.toFixed(2))), // Truncate precision
      color: obj.color
    }));

    const context = `
    Current Scene: ${JSON.stringify(sceneSummary)}
    Action: "${stepPrompt}"
    `;

    try {
      const response = await ai.models.generateContent({
        model: this.modelName,
        contents: context,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          maxOutputTokens: 4000,
          temperature: 0.1,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              commands: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    action: { type: Type.STRING, enum: ["CREATE", "UPDATE", "DELETE", "CLEAR", "UNDO", "REDO", "FOCUS"] },
                    targetId: { type: Type.STRING },
                    reasoning: { type: Type.STRING },
                    objectData: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        name: { type: Type.STRING },
                        type: { type: Type.STRING, enum: ["BOX", "SPHERE", "CYLINDER", "CONE", "PLANE"] },
                        position: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                        rotation: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                        scale: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                        color: { type: Type.STRING },
                        args: { type: Type.ARRAY, items: { type: Type.NUMBER } }
                      }
                    }
                  },
                  required: ["action", "reasoning"]
                }
              }
            }
          }
        }
      });

      const fullText = response.text || "";
      const cleanJson = this.cleanJsonOutput(fullText);
      
      try {
        const parsed = JSON.parse(cleanJson);
        return {
          commands: parsed.commands || []
        };
      } catch (parseError) {
        console.error("JSON Parse Error. Raw Text:", fullText);
        throw new Error("Model response was malformed JSON.");
      }

    } catch (error: any) {
      if (error.message === "Aborted by user") throw error;
      console.error("Gemini Step Error Data:", error);
      throw error;
    }
  }

  private cleanJsonOutput(text: string): string {
      let clean = text;
      // Remove markdown code blocks
      clean = clean.replace(/```json/g, '').replace(/```/g, '');
      
      // Aggressively remove known HTTP header hallucinations from Gemini
      // Matches "Status: 200..." lines and subsequent headers
      clean = clean.replace(/(Status:\s*200|HTTP\/1\.1\s*200|Content-Type:|Transfer-Encoding:|Date:|Server:|X-).*/gi, '');
      
      clean = clean.trim();
      
      // If the string got corrupted inside a JSON value (e.g. "key": "valueStatus: 200..."), 
      // the above regex might strip the status but leave the quote unclosed or the structure broken.
      // Basic repair: Find the first '{' and last '}'
      const firstBrace = clean.indexOf('{');
      const lastBrace = clean.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1) {
          clean = clean.substring(firstBrace, lastBrace + 1);
      }
      
      return clean;
  }
}

export const geminiService = new GeminiCADService();
