import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";

// Initialize AI
// NOTE: GEMINI_API_KEY is expected to be in the environment.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const adminTools: FunctionDeclaration[] = [
  {
    name: "adjust_user_balance",
    description: "Adjust the balance of a user by email. Use positive numbers to add and negative to subtract.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        email: { type: Type.STRING, description: "The email address of the user." },
        amount: { type: Type.NUMBER, description: "The amount of IQD to add or subtract." },
        reason: { type: Type.STRING, description: "The reason for the adjustment." }
      },
      required: ["email", "amount", "reason"]
    }
  },
  {
    name: "update_user_packages",
    description: "Add, update, or cancel an investment package for a user.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        email: { type: Type.STRING, description: "The user's email address." },
        action: { type: Type.STRING, description: "The action to perform: 'add', 'cancel', or 'complete'." },
        packageId: { type: Type.STRING, description: "The ID of the package (e.g., 't1', 't2', 't3')." },
        packageName: { type: Type.STRING, description: "The name of the package." },
        amount: { type: Type.NUMBER, description: "The investment amount in IQD (required for 'add')." }
      },
      required: ["email", "action"]
    }
  },
  {
    name: "give_random_referrals",
    description: "Give a user a specific number of random active referrals with random packages.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        email: { type: Type.STRING, description: "The user's email address." },
        count: { type: Type.NUMBER, description: "The number of referrals to add." }
      },
      required: ["email", "count"]
    }
  },
  {
    name: "process_invoice",
    description: "Create or process an invoice/withdrawal for a user.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        email: { type: Type.STRING, description: "The user's email." },
        amount: { type: Type.NUMBER, description: "The invoice/withdrawal amount." },
        action: { type: Type.STRING, description: "The action: 'create_withdrawal', 'approve_withdrawal', 'reject_withdrawal'." },
        method: { type: Type.STRING, description: "The payout method (e.g., 'ZainCash')." }
      },
      required: ["email", "amount", "action"]
    }
  },
  {
    name: "view_user_info",
    description: "View the current profile details, balance, profit balance, and packages of a user by email.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        email: { type: Type.STRING, description: "The user's email address." }
      },
      required: ["email"]
    }
  },
  {
    name: "get_user_details",
    description: "Get the current information for a specific user, including balance and active packages. Use this when you need to know a user's state or when the user asks you to view it.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        email: { type: Type.STRING, description: "The email address of the user." }
      },
      required: ["email"]
    }
  },
  {
    name: "set_user_balance",
    description: "Set the absolute balance and/or profit balance of a user by email.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        email: { type: Type.STRING, description: "The email address of the user." },
        balance: { type: Type.NUMBER, description: "The new absolute balance amount in IQD." },
        profitBalance: { type: Type.NUMBER, description: "The new absolute profit balance amount in IQD." },
        reason: { type: Type.STRING, description: "The reason for the setting the balance." }
      },
      required: ["email", "reason"]
    }
  },
  {
    name: "trigger_payout_cycle",
    description: "Triggers the monthly payout cycle for all active investments that are due.",
    parameters: {
      type: Type.OBJECT,
      properties: {}
    }
  },
  {
    name: "approve_deposit",
    description: "Approve a pending deposit request by user email or deposit ID.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        email: { type: Type.STRING, description: "The email address of the user who made the deposit." },
        depositId: { type: Type.STRING, description: "The ID of the deposit request (optional if email is provided)." },
        notes: { type: Type.STRING, description: "Optional administrative notes for the approval." }
      },
      required: ["notes"]
    }
  },
  {
    name: "list_pending_deposits",
    description: "Get a list of all pending deposit requests for manual verification.",
    parameters: {
      type: Type.OBJECT,
      properties: {}
    }
  },
  {
    name: "get_platform_stats",
    description: "Get current platform statistics like total users, active engines, and pending deposits.",
    parameters: {
      type: Type.OBJECT,
      properties: {}
    }
  }
];

export async function processAdminCommand(prompt: string, stats: any) {
  const systemInstruction = `
    You are the IQDplus Autonomous AI Agent. 
    You help the platform administrator manage the IQDplus investment platform.
    
    Current Platform Context:
    - Total Users: ${stats.totalUsers}
    - Active Engines: ${stats.activeEngines}
    - Pending Deposits: ${stats.pendingDeposits}
    
    You have access to tools that can modify the database. 
    Only perform actions that the user explicitly asks for.
    If a user asks to "add 100M to x@y.com", call the adjust_user_balance tool.
    If a user asks to "set the balance of x@y.com to 0", call set_user_balance.
    If a user asks for user details or asks to check balance before setting it, use view_user_info.
    If a user asks to "give x@y.com a new T1 package", or "cancel package for x@y.com", use update_user_packages.
    If a user asks to "give x@y.com 10 random referrals", use give_random_referrals.
    If a user asks to "run payouts", call trigger_payout_cycle.
    Always confirm what you did in your response.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: adminTools }],
      }
    });

    return response;
  } catch (error) {
    console.error("AI Command Error:", error);
    throw error;
  }
}
