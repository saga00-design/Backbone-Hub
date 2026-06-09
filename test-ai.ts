import { getAiClient } from "./services/geminiService";
import { Type } from "@google/genai";

const ALLERGIES_LIST = [
  'Celery', 'Gluten', 'Crustaceans', 'Eggs', 'Fish', 
  'Lupin', 'Milk', 'Molluscs', 'Mustard', 'Peanuts', 'Sesame', 
  'Soybeans', 'Sulphites', 'Tree nuts'
];

async function test() {
  const ai = getAiClient();
  const ingredientNames = ['Flour', 'Water', 'Salt', 'Yeast', 'Cheese', 'Tomato Sauce'];
  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite-preview",
    contents: `Given these ingredients: ${ingredientNames.join(', ')}. Which of the following allergies might be present? ${ALLERGIES_LIST.join(', ')}. Return a JSON object where the keys are the allergy names and the values are arrays of ingredient names that contain that allergy. Only include allergies that are present.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: ALLERGIES_LIST.reduce((acc, allergy) => {
          acc[allergy] = {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          };
          return acc;
        }, {} as Record<string, any>)
      }
    }
  });
  console.log(response.text);
}
test();
