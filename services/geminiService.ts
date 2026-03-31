
import { GoogleGenAI, Type } from "@google/genai";
import { AiInsight, InventoryItem } from '../types';

const getAiClient = () => {
  // The API key must be obtained exclusively from the environment variable process.env.GEMINI_API_KEY.
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
};

export const handleAiError = (error: any) => {
  console.error("AI Error:", error);
  if (error?.message?.includes('429') || error?.status === 429 || error?.message?.includes('RESOURCE_EXHAUSTED')) {
    return "The AI service is currently at its limit (Quota Exceeded). Please try again in a few minutes or check your API quota.";
  }
  return "An unexpected error occurred with the AI service. Please try again.";
};

export const parseInvoiceImage = async (base64Image: string, mimeType: string) => {
  const ai = getAiClient();
  
  const prompt = `
    Analyze this invoice image and extract the line items.
    Return a JSON object with a list of items. 
    Each item should have:
    - name (string)
    - quantity (number)
    - unit (guess the unit like kg, g, L, ml, pcs, box from context, default to pcs if unknown)
    - price (number, total price for this line item)
    - vendor (string, the name of the supplier)
    - date (string, YYYY-MM-DD format)
    
    Ensure strict JSON format.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: base64Image, mimeType } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            vendor: { type: Type.STRING },
            date: { type: Type.STRING },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  unit: { type: Type.STRING },
                  price: { type: Type.NUMBER }
                }
              }
            }
          }
        }
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    throw new Error(handleAiError(error));
  }
};

export const analyzeDiscrepancies = async (items: {name: string, expected: number, actual: number, unit: string}[]) => {
  const ai = getAiClient();
  
  const prompt = `
    Analyze the following stock discrepancies and write a conversational, human-like summary. 
    Imagine you are an experienced, helpful operations manager talking directly to your team. 
    Avoid formal corporate jargon and formal headers like "Executive Summary" or "Actionable Recommendations". 
    Instead, use a direct, practical, and slightly informal tone.
    
    Start with a friendly opening (e.g., "Hi team, I've looked over the latest stock count and here's what I'm seeing...").
    Explain what the data suggests in plain English (e.g., "It looks like we're losing a lot of [Item] which might point to unrecorded waste" or "The surplus in [Item] is so high it's likely just a typo during the count").
    
    Provide 3 down-to-earth, actionable suggestions to help the team improve. 
    Keep the formatting clean with Markdown, but make it feel like a personal briefing note or a quick email rather than an audit report.
    
    Data:
    ${JSON.stringify(items)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "No analysis generated.";
  } catch (error) {
    return handleAiError(error);
  }
};

export const getChatSession = (systemInstruction: string) => {
  const ai = getAiClient();
  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction,
    }
  });
};

export const generateInventoryInsights = async (items: InventoryItem[]): Promise<AiInsight[]> => {
  const ai = getAiClient();
  
  const prompt = `
    Analyze this inventory data to optimize stock levels and ordering.
    
    Current Date: ${new Date().toISOString().split('T')[0]}
    
    Data Context:
    - 'qty': Current stock quantity.
    - 'dailyUsage': Estimated daily consumption (Sales Velocity).
    - 'min': Minimum stock level trigger.
    
    Inventory Items:
    ${JSON.stringify(items.map(i => ({
      name: i.name,
      qty: i.quantity,
      unit: i.unit,
      min: i.minStockLevel,
      dailyUsage: i.dailyUsageRate,
      expiry: i.expiryDate,
      supplier: i.supplier
    })))}

    Tasks:
    1. **Stock Run-out Prediction**: 
       - Calculate 'Days Remaining' = qty / dailyUsage.
       - If 'Days Remaining' < 5, flag as 'reorder'.
       - Priority: 'high' if < 3 days, else 'medium'.
       - Message format: "Projected to run out in [Days Remaining] days (Usage: [dailyUsage] [unit]/day)."
    
    2. **Optimal Reorder Calculation**: 
       - If flagged in step 1 or qty < min:
       - Calculate 'Order Qty' = (dailyUsage * 14) - qty. (Aiming for 14 days coverage).
       - If dailyUsage is 0 or undefined, default to (min * 2) - qty.
       - Action format: "Order [Order Qty] [Unit] from [Supplier]".

    3. **Slow Moving**: 
       - If qty > (dailyUsage * 45) AND dailyUsage > 0, flag as 'slow_moving'.
       - Message: "Overstocked. >45 days supply based on daily usage."

    4. **Expiry**: Items expiring within 7 days.

    Return JSON array.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, enum: ['reorder', 'expiry', 'slow_moving', 'anomaly'] },
              item: { type: Type.STRING },
              message: { type: Type.STRING },
              action: { type: Type.STRING },
              priority: { type: Type.STRING, enum: ['high', 'medium', 'low'] }
            }
          }
        }
      }
    });
    
    return JSON.parse(response.text || '[]');
  } catch (error) {
    console.error("Error generating insights:", handleAiError(error));
    return [];
  }
};

export const editInventoryImage = async (base64Image: string, mimeType: string, prompt: string): Promise<string | null> => {
  const ai = getAiClient();

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    return null;
  } catch (error) {
    throw new Error(handleAiError(error));
  }
};
