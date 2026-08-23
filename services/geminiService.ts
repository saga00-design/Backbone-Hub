
import { GoogleGenAI, Type } from "@google/genai";
import { callGemini } from '../firebase';
import { AiInsight, InventoryItem } from '../types';

export const getAiClient = () => {
  // The API key must be obtained exclusively from the environment variable process.env.GEMINI_API_KEY.
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
};

export const getAiModel = (modelName: string = 'gemini-3.1-flash-lite-preview') => {
  const ai = getAiClient();
  return ai.models.get({ model: modelName });
};

export const handleAiError = (error: any) => {
  console.error("AI Error:", error);
  
  // Extract message from various possible error formats
  let errorMessage = "";
  let errorCode: number | string | undefined = undefined;

  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else if (error?.message) {
    errorMessage = error.message;
  } else if (error?.error?.message) {
    errorMessage = error.error.message;
  } else {
    errorMessage = JSON.stringify(error);
  }

  // Try to parse if it's a stringified JSON error (common in some proxy responses)
  try {
    const parsed = JSON.parse(errorMessage);
    errorMessage = parsed?.ERROR?.MESSAGE || parsed?.error?.message || parsed?.message || errorMessage;
    errorCode = parsed?.ERROR?.CODE || parsed?.error?.code || parsed?.code || error?.status;
  } catch {
    // Not a JSON string, keep original message
  }

  // Handle specific error codes
  if (errorCode === 502 || errorMessage.includes('502 Bad Gateway')) {
    return "The AI service is temporarily unavailable (Bad Gateway). This is usually a temporary issue. Please try again in a moment.";
  }
  if (errorCode === 503 || errorMessage.includes('503 Service Unavailable')) {
    return "The AI service is currently overloaded or down for maintenance. Please try again in a few minutes.";
  }
  if (errorCode === 504 || errorMessage.includes('504 Gateway Timeout')) {
    return "The AI service took too long to respond. The image might be too large or the service is slow. Please try again.";
  }

  const isSpendingCap = errorMessage.toLowerCase().includes('spending cap') || 
                        errorMessage.toLowerCase().includes('spending_cap');
  
  if (isSpendingCap) {
    return "The AI service has reached its spending limit. Please check your Google Cloud billing settings or increase your spending cap in the Google Cloud Console.";
  }

  const isQuotaExceeded = errorMessage.includes('429') || 
                          errorCode === 429 || 
                          errorMessage.includes('RESOURCE_EXHAUSTED') ||
                          errorMessage.toLowerCase().includes('quota');

  if (isQuotaExceeded) {
    return "The AI service is currently at its limit (Quota Exceeded). Please try again in a few minutes or check your API quota limits.";
  }
  
  // If the message already starts with "AI Service Error:", don't add it again
  if (errorMessage.startsWith("AI Service Error:")) {
    return errorMessage;
  }
  
  return `AI Service Error: ${errorMessage || "An unexpected error occurred. Please try again."}`;
};

export const parseInvoiceImage = async (base64Image: string, mimeType: string, retries = 2) => {
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

  let lastError: any;
  for (let i = 0; i <= retries; i++) {
    try {
      // Routed through the callGemini Cloud Function (functions/index.js) so the
      // Gemini API key stays server-side instead of exposed in the browser bundle.
      const result = await callGemini({
        model: 'gemini-3.1-flash-lite-preview',
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

      const data = result.data as { text: string; images: any[] };
      return JSON.parse(data.text || '{}');
    } catch (error) {
      lastError = error;
      console.warn(`AI analysis attempt ${i + 1} failed:`, error);
      
      // Only retry on potential transient errors (500s, 429s)
      const errorStr = JSON.stringify(error).toLowerCase();
      const isTransient = errorStr.includes('502') || 
                          errorStr.includes('503') || 
                          errorStr.includes('504') || 
                          errorStr.includes('429') ||
                          errorStr.includes('timeout') ||
                          errorStr.includes('bad gateway');
      
      if (!isTransient || i === retries) break;
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }

  throw new Error(handleAiError(lastError));
};
export const analyzeDiscrepancies = async (items: {name: string, expected: number, actual: number, unit: string}[]) => {
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
    // Routed through the callGemini Cloud Function (functions/index.js) so the
    // Gemini API key stays server-side instead of exposed in the browser bundle.
    const result = await callGemini({
      model: 'gemini-3.1-flash-lite-preview',
      contents: prompt,
    });
    const data = result.data as { text: string; images: any[] };
    return data.text || "No analysis generated.";
  } catch (error) {
    return handleAiError(error);
  }
};
export const getChatSession = (systemInstruction: string) => {
  const ai = getAiClient();
  return ai.chats.create({
    model: 'gemini-3.1-flash-lite-preview',
    config: {
      systemInstruction,
    }
  });
};

export const generateInventoryInsights = async (items: InventoryItem[]): Promise<AiInsight[]> => {
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
    // Routed through the callGemini Cloud Function (functions/index.js) so the
    // Gemini API key stays server-side instead of exposed in the browser bundle.
    const result = await callGemini({
      model: 'gemini-3.1-flash-lite-preview',
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

    const data = result.data as { text: string; images: any[] };
    return JSON.parse(data.text || '[]');
  } catch (error) {
    console.error("Error generating insights:", handleAiError(error));
    return [];
  }
};
export const editInventoryImage = async (base64Image: string, mimeType: string, prompt: string): Promise<string | null> => {
  try {
    // Routed through the callGemini Cloud Function (functions/index.js) so the
    // Gemini API key stays server-side instead of exposed in the browser bundle.
    const result = await callGemini({
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

    const data = result.data as { text: string; images: { data: string; mimeType: string }[] };
    if (data.images && data.images.length > 0) {
      const img = data.images[0];
      return `data:${img.mimeType};base64,${img.data}`;
    }
    return null;
  } catch (error) {
    throw new Error(handleAiError(error));
  }
};