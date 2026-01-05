// backend/services/geminiService.ts
import { GoogleGenAI, Type } from "@google/genai";
import { CADObject } from "../../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const CODING_SYSTEM_INSTRUCTION = `
You are an expert Computational Designer using a JavaScript-based CSG (Constructive Solid Geometry) library.
Your goal is to write a script that generates 3D objects based on the user's request.

### The API
You have access to the following functions:
- \`Box(width, height, depth)\`: Returns a Mesh.
- \`Sphere(radius)\`: Returns a Mesh.
- \`Cylinder(radiusTop, radiusBottom, height)\`: Returns a Mesh.
- \`Move(mesh, x, y, z)\`: Returns the transformed Mesh.
- \`Rotate(mesh, x, y, z)\`: Rotates mesh (in radians). Returns Mesh.
- \`Scale(mesh, x, y, z)\`: Scales mesh. Returns Mesh.
- \`Color(mesh, hexString)\`: Sets color (e.g. "#ff0000"). Returns Mesh.
- \`Union(a, b)\`: boolean Union. Returns Mesh.
- \`Subtract(a, b)\`: boolean Subtract (a - b). Returns Mesh.
- \`Intersect(a, b)\`: boolean Intersect. Returns Mesh.
- \`Add(mesh, name)\`: **CRITICAL**. You MUST call this to add the object to the scene. If you don't call Add, nothing appears.

### Rules
1. **Parametric Thinking**: Define variables for dimensions.
2. **Operations**: Create geometries -> Apply Transforms -> Apply Booleans -> Call Add().
3. **Clean Code**: Write valid JavaScript. No markdown blocks inside the JSON string property.
4. **Context**: You will be provided with the *Previous Script*. You should EDIT the previous script to accommodate the new request.
   - If user says "Change color to red", find the Color() call and update it.
   - If user says "Add a sphere", append the code for the sphere.
   - If user says "Make the box bigger", update the dimensions.

### Response Format
Return JSON:
{
  "code": "full javascript code string",
  "explanation": "brief description of changes"
}
`;

export class GeminiCADService {
  private modelName = "gemini-3-flash-preview";

  async generateScript(
    userPrompt: string, 
    currentCode: string
  ): Promise<{ code: string, explanation: string }> {
    
    // Safety: If current code is empty, provide a default starting point or treat as empty
    const context = `
    CURRENT SCRIPT:
    ${currentCode || "// No code yet"}

    USER REQUEST:
    "${userPrompt}"

    TASK:
    Rewrite the Current Script to fulfill the User Request.
    Maintain existing objects unless asked to delete them.
    `;

    try {
      const response = await ai.models.generateContent({
        model: this.modelName,
        contents: context,
        config: {
          systemInstruction: CODING_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          temperature: 0.1, // Low temp for code stability
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              code: { type: Type.STRING },
              explanation: { type: Type.STRING }
            }
          }
        }
      });

      if (!response.text) throw new Error("No response from AI");
      const parsed = JSON.parse(response.text);
      
      return {
        code: parsed.code,
        explanation: parsed.explanation
      };

    } catch (error: any) {
      console.error("Gemini Script Gen Error:", error);
      throw error;
    }
  }

  async fixScript(
      originalPrompt: string,
      currentCode: string,
      feedback: string
  ): Promise<{ code: string, explanation: string }> {
      const context = `
      CURRENT SCRIPT:
      ${currentCode}

      USER ORIGINAL REQUEST:
      "${originalPrompt}"

      VISUAL QA FEEDBACK:
      "${feedback}"

      TASK:
      The current script produced a result that failed the visual QA.
      Fix the script based on the feedback provided.
      `;

      try {
          const response = await ai.models.generateContent({
            model: this.modelName,
            contents: context,
            config: {
              systemInstruction: CODING_SYSTEM_INSTRUCTION,
              responseMimeType: "application/json",
              temperature: 0.1, 
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  code: { type: Type.STRING },
                  explanation: { type: Type.STRING }
                }
              }
            }
          });
    
          if (!response.text) throw new Error("No response from AI");
          const parsed = JSON.parse(response.text);
          
          return {
            code: parsed.code,
            explanation: "Auto-Fix: " + parsed.explanation
          };
    
        } catch (error: any) {
          console.error("Gemini Fix Script Error:", error);
          throw error;
        }
  }
}

export const geminiService = new GeminiCADService();
