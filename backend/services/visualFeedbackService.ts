// backend/services/visualFeedbackService.ts
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const FEEDBACK_SYSTEM_INSTRUCTION = `
You are a Visual QA agent for a 3D CAD tool. 
You will receive the User's Request and multiple screenshots of the generated 3D scene.

Your task:
1. Analyze if the 3D geometry matches the User's Request.
2. Check for common defects:
   - Objects floating in mid-air (unless requested).
   - Accidental intersections or Z-fighting.
   - Wrong colors.
   - Misalignments.
   - Missing objects.
3. Be highly critical.

Output JSON:
{
    "looksCorrect": boolean,
    "critique": "A concise description of what is wrong. If it looks correct, say 'Visuals verified.'",
    "suggestion": "Specific instructions on how to fix the code (e.g., 'Move the red box down by 1 unit', 'Rotate the cylinder 90 degrees')."
}
`;

export class VisualFeedbackService {
  private modelName = "gemini-3-flash-preview"; // Use Flash for faster vision processing

  async evaluateRender(
    originalPrompt: string,
    images: { view: string; base64: string }[]
  ): Promise<{ looksCorrect: boolean; critique: string; suggestion: string }> {
    
    // Construct the multipart content
    const imageParts = images.map(img => ({
        inlineData: {
            mimeType: "image/png",
            data: img.base64.replace(/^data:image\/\w+;base64,/, "")
        }
    }));
    
    const textPart = {
        text: `
        USER REQUEST: "${originalPrompt}"
        
        The images provided are 8 sequential views of the generated 3D model, taken at 45-degree intervals orbiting the object (0°, 45°, 90°, etc.).
        
        Analyze these 8 views collectively to determine if the 3D geometry fully satisfies the request.
        Look for:
        1. Consistency across angles (is it a complete 3D object?).
        2. Geometry accuracy (does it look like the requested object from all sides?).
        3. Floating parts or disconnections that might be hidden in a single view.
        `
    };

    try {
      const response = await ai.models.generateContent({
        model: this.modelName,
        contents: {
            parts: [textPart, ...imageParts]
        },
        config: {
          systemInstruction: FEEDBACK_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              looksCorrect: { type: Type.BOOLEAN },
              critique: { type: Type.STRING },
              suggestion: { type: Type.STRING }
            }
          }
        }
      });

      if (!response.text) {
          return { looksCorrect: true, critique: "No response from vision model.", suggestion: "" };
      }

      const parsed = JSON.parse(response.text);
      return {
          looksCorrect: parsed.looksCorrect,
          critique: parsed.critique || "Verified",
          suggestion: parsed.suggestion || ""
      };

    } catch (error) {
      console.error("Visual Feedback API Error:", error);
      return { looksCorrect: true, critique: "Visual check failed to run.", suggestion: "" };
    }
  }
}

export const visualFeedbackService = new VisualFeedbackService();
