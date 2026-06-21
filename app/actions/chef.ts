'use server'

import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateRecipeWithAI(query: string, dietType: string, chef: string, cuisine: string) {
  try {
    const prompt = `Create a real, authentic recipe based on this user request: "${query}". 
    Cuisine style: ${cuisine}. 
    Dietary restriction: ${dietType}.
    Chef Style: Create this recipe in the cooking style of ${chef !== 'Any' ? chef : 'a standard authentic chef'}.
    
    Provide the exact ingredients with quantities. Include prep instructions, and full step-by-step cooking instructions.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: "You are an expert chef. You must output the response EXACTLY matching the JSON schema provided.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Name of the dish" },
            ingredients: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "List of ingredients with measurements" 
            },
            prep_instructions: { type: Type.STRING, description: "Short prep instructions. Leave empty if none." },
            instructions_to_cook: { type: Type.STRING, description: "Detailed, step-by-step cooking instructions." },
            category: { type: Type.STRING, description: "E.g., North Indian, Mexican, etc." }
          },
          required: ["name", "ingredients", "prep_instructions", "instructions_to_cook", "category"],
        },
      },
    });

    if (response.text) {
      return { success: true, data: JSON.parse(response.text) };
    }
    return { success: false, error: "No recipe generated." };
  } catch (error) {
    console.error("AI Generation Error:", error);
    return { success: false, error: "Failed to connect to AI Chef." };
  }
}