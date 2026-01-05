// backend/services/plannerService.ts
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const PLANNER_INSTRUCTION = `
You are an expert 3D CAD Planning Agent.
Break down the request into atomic execution steps.

RULES:
1. **One Step Per Object**: "3 spheres" -> 3 steps.
2. **Spacing**: Calculate positions (e.g., [0,0,0], [2,0,0]).
3. **Brevity**: Keep steps short and precise.

Output JSON: { "steps": string[] }
`;

export class PlannerService {
  private modelName = "gemini-3-flash-preview";

  async getPlan(userPrompt: string): Promise<string[]> {
    try {
      const response = await ai.models.generateContent({
        model: this.modelName,
        contents: userPrompt,
        config: {
          systemInstruction: PLANNER_INSTRUCTION,
          responseMimeType: "application/json",
          maxOutputTokens: 2000,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              steps: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            }
          }
        }
      });
      
      if (!response.text) return [userPrompt];
      
      const parsed = JSON.parse(response.text);
      return parsed.steps || [userPrompt];
    } catch (e) {
      console.warn("Planner failed, falling back to raw prompt", e);
      return [userPrompt];
    }
  }
}

export const plannerService = new PlannerService();
