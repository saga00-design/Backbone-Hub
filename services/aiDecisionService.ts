import { GoogleGenAI, Type } from "@google/genai";
import { 
  DailyClosure, POSOrder, InventoryItem, MonthlyTarget, 
  Liability, AIAction, SystemAlert, Forecast, LabourShift 
} from "../types";
import { db, LOCATION_ID } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

export const generateFinancialInsights = async (
  date: string,
  closures: DailyClosure[],
  orders: POSOrder[],
  inventory: InventoryItem[],
  targets: MonthlyTarget[],
  liabilities: Liability[],
  forecasts: Forecast[],
  labourShifts: LabourShift[] = []
) => {
  try {
    // Prepare data context for AI
    const context = {
      date,
      recentClosures: closures.slice(0, 7),
      recentLabour: labourShifts.slice(0, 14),
      currentMonthTargets: targets.find(t => t.month === new Date().getMonth() && t.year === new Date().getFullYear()),
      pendingLiabilities: liabilities.filter(l => l.status === 'Pending'),
      activeForecast: forecasts.find(f => f.periodStart.startsWith(date) || f.periodEnd.startsWith(date)),
      inventoryHealth: inventory.filter(i => i.quantity <= i.minStockLevel).map(i => ({ name: i.name, stock: i.quantity, min: i.minStockLevel }))
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: `Analyze the provided financial and operational data: ${JSON.stringify(context)}. Generate concrete AI Actions and System Alerts for ${date}.`,
      config: {
        systemInstruction: `You are the AI Financial Director for a high-end restaurant group. 
        Your goal is to optimize profitability, cashflow, and operational efficiency.
        
        Focus areas:
        1. Profitability: Compare Net Revenue vs Monthly Targets.
        2. Cashflow: Verify if Safe Cash can cover upcoming liabilities.
        3. Labour & COGS: Flag if percentages are above industry standards (Labour > 30%, COGS > 35%).
        4. Inventory: Identify items below minimum stock levels.
        
        Return exactly two arrays: 'actions' and 'alerts'.
        Actions must be specific, actionable, and include a clear reason and expected impact.
        Alerts must classify severity (Critical, Warning, Info).`,
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
            },
            alerts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  severity: { type: Type.STRING, enum: ['Critical', 'Warning', 'Info'] },
                  message: { type: Type.STRING },
                  description: { type: Type.STRING }
                },
                required: ['severity', 'message', 'description']
              }
            }
          },
          required: ['actions', 'alerts']
        }
      }
    });

    const result = JSON.parse(response.text || '{"actions":[], "alerts":[]}');

    // Save to Firestore
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

    if (result.alerts) {
      for (const alert of result.alerts) {
        await addDoc(collection(db, 'alerts'), {
          ...alert,
          locationId: LOCATION_ID,
          isRead: false,
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
