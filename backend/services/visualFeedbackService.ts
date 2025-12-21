import { GoogleGenAI, Type } from "@google/genai";
import { AICommand } from "../../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const FEEDBACK_SYSTEM_INSTRUCTION = `
You are a Visual QA agent for a 3D CAD tool. Your job is to look at a screenshot of a 3D scene and the user's original request.
You must determine if the scene matches the request.

If the scene looks correct:
- Return an empty list of commands.

If the scene looks wrong (e.g., wrong color, wrong position, missing parts, floating objects):
- Return a list of 'commands' (UPDATE, DELETE, CREATE) to fix the issues.
- You should be highly critical of alignment and colors.

Coordinate System: Y-up.
The image provided is a 2D render from an isometric-like perspective.
`;

export class VisualFeedbackService {
  private modelName = "gemini-3-pro-preview";

  /**
   * Analyzes a screenshot to check if it matches the user's prompt.
   * Returns a list of corrective commands if necessary.
   */
  async verifyRender(
    originalPrompt: string,
    screenshotBase64: string
  ): Promise<{ commands: AICommand[]; feedback: string; thoughtProcess: string }> {
    
    // Clean base64 string if it contains the data url prefix
    const base64Data = screenshotBase64.replace(/^data:image\/\w+;base64,/, "");

    const context = `
    User Original Request: "${originalPrompt}"
    
    Attached is the screenshot of the current 3D render.
    Does this render correctly fulfill the request? 
    If not, generate JSON commands to fix it.
    `;

    try {
      const response = await ai.models.generateContent({
        model: this.modelName,
        contents: {
            parts: [
                { text: context },
                {
                    inlineData: {
                        mimeType: "image/png",
                        data: base64Data
                    }
                }
            ]
        },
        config: {
          systemInstruction: FEEDBACK_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              thoughtProcess: { type: Type.STRING, description: "Your visual analysis step-by-step reasoning." },
              feedback: { type: Type.STRING, description: "Summary of what is right or wrong in the image." },
              commands: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    action: { type: Type.STRING, enum: ["CREATE", "UPDATE", "DELETE", "CLEAR"] },
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

      if (!response.text) return { commands: [], feedback: "No response from AI", thoughtProcess: "" };

      const parsed = JSON.parse(response.text);
      return {
          commands: parsed.commands || [],
          feedback: parsed.feedback || "Verified.",
          thoughtProcess: parsed.thoughtProcess || ""
      };

    } catch (error) {
      console.error("Visual Feedback API Error:", error);
      return { commands: [], feedback: "Error verifying visual output.", thoughtProcess: "Error during visual analysis." };
    }
  }
}

export const visualFeedbackService = new VisualFeedbackService();
