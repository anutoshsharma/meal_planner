'use server'

import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateRecipeWithAI(query: string, dietType: string, chef: string, cuisine: string) {
  try {
    const prompt = `Generate exactly 3 distinct recipe options based on this user request: "${query}". 
    Cuisine style: ${cuisine}. 
    Dietary restriction: ${dietType}.
    Chef Style: Create these recipes in the cooking style of ${chef !== 'Any' ? chef : 'a standard authentic chef'}.
    
    CRITICAL INSTRUCTIONS:
    - 'core_ingredients': 2 to 3 main ingredients ONLY (e.g. ["Potato", "Wheat Flour"]).
    - 'ingredients': The full list of ingredients including spices.
    - 'prep_instructions': VERY SHORT. ONLY actions needed PRE-COOKING (e.g., "Boil potatoes in advance", "Soak chana dal overnight"). If NO advance prep is needed, leave it completely empty (""). DO NOT put active cooking steps here.
    - 'instructions_to_cook': Detailed step-by-step cooking instructions.

    Examples to follow for prep & core:
    - Jeera Aloo & Roti -> core: ["Potato", "Wheat Flour"], prep: "Boil potatoes in advance"
    - Vada Pav -> core: ["Potato", "Pav", "Besan"], prep: "Boil potatoes for the vada"
    - Tinda Masala & Roti -> core: ["Apple Gourd", "Wheat Flour"], prep: ""
    - Handvo -> core: ["Rice", "Mixed Dal", "Bottle Gourd"], prep: "Soak rice and dal; ferment overnight"`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: "You are an expert chef. You must output an ARRAY of EXACTLY 3 recipes matching the JSON schema provided.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "List of 3 recipe options",
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Name of the dish" },
              core_ingredients: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "List of 2-3 main ingredients" 
              },
              ingredients: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "Full list of ingredients with measurements" 
              },
              prep_instructions: { type: Type.STRING, description: "Only pre-cooking tasks. Leave empty if none." },
              instructions_to_cook: { type: Type.STRING, description: "Detailed, step-by-step cooking instructions." },
              category: { type: Type.STRING, description: "E.g., North Indian, Mexican, etc." }
            },
            required: ["name", "core_ingredients", "ingredients", "prep_instructions", "instructions_to_cook", "category"],
          }
        },
      },
    });

    if (response.text) {
      // Because we used Type.ARRAY, the response is now an array of recipes
      return { success: true, data: JSON.parse(response.text) };
    }
    return { success: false, error: "No recipes generated." };
  } catch (error) {
    console.error("AI Generation Error:", error);
    return { success: false, error: "Failed to connect to AI Chef." };
  }
}