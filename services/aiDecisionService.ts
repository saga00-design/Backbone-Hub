import { GoogleGenAI, Type } from "@google/genai";
import {
  DailyClosure, POSOrder, InventoryItem,
  Liability, Forecast, LabourShift
} from "../types";
import { db, LOCATION_ID } from "../firebase";
import { collection, addDoc } from "firebase/firestore";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

// Grounding context computed by services/pnlEngine.ts — passed in so recommendations are based
// on the same correctly-scoped, deduplicated figures shown on screen, not the model's own
// (unscoped) read of raw arrays.
export interface PnlContext {
  grossSales: number;
  netRevenue: number;
  netProfit: number;
  cogs: number;
  cogsPercent: number;
  labour: number;
  labourPercent: number;
  operatingExpenses: number;
  waste: number;
  stockVariance: number;
  safeCash: number;
  pendingLiabilitiesTotal: number;
}

// Strategic recommendations only. This is the AI Decision Center's sole content source — it is
// ONLY ever called from the "Run AI Diagnostic" button (on-demand, never automatically). Live
// Alerts are a separate, deterministic, zero-cost feature computed locally in
// FinancialCommandCenter.tsx and no longer written here.
export const generateFinancialInsights = async (
  date: string,
  closures: DailyClosure[],
  orders: POSOrder[],
  inventory: InventoryItem[],
  liabilities: Liability[],
  forecasts: Forecast[],
  labourShifts: LabourShift[] = [],
  pnl?: PnlContext
) => {
  try {
    // Prepare data context for AI
    const context = {
      date,
      pnl, // the real, correctly-scoped figures currently on screen
      pendingLiabilities: liabilities.filter(l => l.status === 'Pending'),
      activeForecast: forecasts.find(f => f.periodStart.startsWith(date) || f.periodEnd.startsWith(date)),
      inventoryHealth: inventory.filter(i => i.quantity <= i.minStockLevel).map(i => ({ name: i.name, stock: i.quantity, min: i.minStockLevel }))
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: `Analyze the provided financial and operational data for ${date}: ${JSON.stringify(context)}. Generate concrete, actionable recommendations grounded strictly in the numbers given — do not invent figures not present in the context.`,
      config: {
        systemInstruction: `You are the AI Financial Director for a high-end restaurant group.
        Your goal is to optimize profitability, cashflow, and operational efficiency.

        Focus areas:
        1. Profitability: Net Revenue and Net Profit trend.
        2. Cashflow: Verify if Safe Cash can cover upcoming liabilities.
        3. Labour & COGS: Flag if percentages are above industry standards (Labour > 30%, COGS > 35%).
        4. Inventory: Identify items below minimum stock levels.
        5. Stock Variance: Flag meaningful shrinkage if present in the data.

        Every recommendation must reference the actual numbers supplied in the context — never
        invent figures. Return exactly one array: 'actions'.
        Actions must be specific, actionable, and include a clear reason and expected impact.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            actions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, enum: ['Marketing', 'Labour', 'Stock', 'Finance', 'Menu'] },
                  recommendation: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  priority: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] },
                  expectedImpact: { type: Type.STRING }
                },
                required: ['type', 'recommendation', 'reason', 'priority', 'expectedImpact']
              }
            }
          },
          required: ['actions']
        }
      }
    });

    const result = JSON.parse(response.text || '{"actions":[]}');

    // Save to Firestore — cached there until the next "Run AI Diagnostic" click adds more.
    if (result.actions) {
      for (const action of result.actions) {
        await addDoc(collection(db, 'aiActions'), {
          ...action,
          locationId: LOCATION_ID,
          status: 'Draft',
          timestamp: new Date().toISOString()
        });
      }
    }

    return result;
  } catch (error) {
    console.error("AI Insight Error:", error);
    return null;
  }
};
