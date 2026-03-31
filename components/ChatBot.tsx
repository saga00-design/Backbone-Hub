
import React, { useState, useEffect, useRef } from 'react';
import { InventoryItem, Recipe } from '../types';
import { MessageCircle, X, Send, Bot, Loader2, Sparkles, TrendingDown, AlertCircle, ShoppingBag } from 'lucide-react';
import { getChatSession, handleAiError } from '../services/geminiService';
import { Chat } from "@google/genai";
import Markdown from 'react-markdown';

interface ChatBotProps {
  items: InventoryItem[];
  recipes?: Recipe[];
}

const SUGGESTED_QUESTIONS = [
  { text: "What's running low?", icon: AlertCircle, color: "text-amber-500" },
  { text: "Any expiring items?", icon: ShoppingBag, color: "text-red-500" },
  { text: "How's my margins?", icon: TrendingDown, color: "text-emerald-500" },
  { text: "Reorder suggestions", icon: Sparkles, color: "text-brand-500" },
];

export const ChatBot: React.FC<ChatBotProps> = ({ items, recipes = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const chatSessionRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Listen for external chat triggers
  useEffect(() => {
    const handleExternalChat = (event: any) => {
      const { message } = event.detail;
      if (message) {
        setIsOpen(true);
        if (chatSessionRef.current) {
            setInputValue(message);
            setTimeout(() => {
                const sendBtn = document.querySelector('button[title="Send"]') as HTMLButtonElement;
                if (sendBtn) sendBtn.click();
            }, 100);
        } else {
            setPendingMessage(message);
        }
      }
    };

    window.addEventListener('inventory-ai-chat', handleExternalChat);
    return () => window.removeEventListener('inventory-ai-chat', handleExternalChat);
  }, []);

  // Handle pending message after initialization
  useEffect(() => {
    if (chatSessionRef.current && pendingMessage) {
        setInputValue(pendingMessage);
        setPendingMessage(null);
        setTimeout(() => {
            const sendBtn = document.querySelector('button[title="Send"]') as HTMLButtonElement;
            if (sendBtn) sendBtn.click();
        }, 100);
    }
  }, [pendingMessage, chatSessionRef.current]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen, isLoading]);

  // Helper to calculate recipe costs for the prompt context
  const getRecipeContext = () => {
    return recipes.map(r => {
      const cost = r.ingredients.reduce((sum, ing) => {
        const item = items.find(i => i.id === ing.inventoryItemId);
        return sum + (item ? item.pricePerUnit * ing.quantity : 0);
      }, 0);
      const margin = r.sellingPrice - cost;
      const marginPercent = r.sellingPrice > 0 ? (margin / r.sellingPrice) * 100 : 0;
      return `- Recipe: ${r.name}. Sell Price: £${r.sellingPrice}. Cost: £${cost.toFixed(2)}. Margin: ${marginPercent.toFixed(1)}%.`;
    }).join('\n');
  };

  // Initialize chat when opened for the first time
  useEffect(() => {
    if (isOpen && !chatSessionRef.current) {
        const inventoryContext = items.map(item => 
            `- ${item.name}: ${item.quantity} ${item.unit} (${item.category}${item.subCategory ? ` / ${item.subCategory}` : ''}, £${item.pricePerUnit}/unit). ` +
            `Supplier: ${item.supplier || 'N/A'}. ` +
            `Expiry: ${item.expiryDate || 'N/A'}. ` +
            `MinStock: ${item.minStockLevel}. ` +
            `DailyUsage: ${item.dailyUsageRate || 0} ${item.unit}/day. ` +
            (item.totalOwned ? `TotalOwned(Par): ${item.totalOwned}. ` : '') +
            (item.brokenQuantity ? `Broken/Missing: ${item.brokenQuantity}.` : '')
        ).join('\n');

        const recipeContext = getRecipeContext();

        const systemInstruction = `You are "Chef AI", a friendly, proactive, and highly knowledgeable kitchen operations partner. 
        
        Personality:
        - Warm, professional, and slightly informal (like a trusted sous-chef).
        - Use phrases like "I noticed...", "You might want to check...", "Good news!", "Heads up!".
        - Don't just list data; interpret it. If stock is low, say why it matters (e.g., "You're low on basil, which might affect your Margherita Pizza prep tomorrow").
        - Be empathetic to the stress of running a kitchen.
        
        Current Inventory Data:
        ${inventoryContext}
        
        Current Menu Recipes:
        ${recipeContext}
        
        Today's Date: ${new Date().toISOString().split('T')[0]}

        Your core capabilities are:
        1. **Predict stock shortages**: Calculate when items will run out based on DailyUsage.
        2. **Reorder Recommendations**: Suggest exact reorder quantities.
        3. **Expiry Tracking**: Flag items expiring soon.
        4. **Menu Engineering**: Analyze recipe margins. Suggest price increases for low margin items (<65%). Identify the most profitable dishes.
        5. **Operational Advice**: Suggest better purchasing patterns.
        6. **Asset Tracking**: Report on missing or broken equipment.

        Example responses:
        - "Heads up! You're projected to run out of chicken in about 2 days. I'd suggest ordering at least 15kg to stay safe through the weekend."
        - "I've been looking at your margins. The Margherita Pizza is doing great at 72%, but the Steak Special is sitting at 55%. We might want to look at the portioning or a small price adjustment."
        - "Good news! Your inventory health is up 5% since yesterday."

        Keep responses concise but helpful. Use Markdown for formatting (bolding, lists).`;

        chatSessionRef.current = getChatSession(systemInstruction);
        
        setMessages([
            { role: 'model', text: 'Hey there! I\'m Chef AI, your operational partner. I\'ve been keeping an eye on the stock and margins—how can I help you today?' }
        ]);
    }
  }, [isOpen, items, recipes]);

  const handleSend = async (text?: string) => {
    const messageToSend = text || inputValue;
    if (!messageToSend.trim() || !chatSessionRef.current) return;

    const userMessage = messageToSend.trim();
    setInputValue('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const response = await chatSessionRef.current.sendMessage({ message: userMessage });
      setMessages(prev => [...prev, { role: 'model', text: response.text || "I'm not quite sure how to answer that. Could you rephrase?" }]);
    } catch (error) {
      const message = handleAiError(error);
      setMessages(prev => [...prev, { role: 'model', text: message }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="mb-4 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col h-[550px] transition-all transform origin-bottom-right overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-brand-600 text-white">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm">Chef AI</h3>
                <div className="flex items-center">
                  <span className="h-1.5 w-1.5 bg-green-400 rounded-full mr-1.5 animate-pulse"></span>
                  <span className="text-[10px] text-brand-100 font-medium uppercase tracking-wider">Online & Ready</span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-brand-600 text-white rounded-br-none shadow-md' 
                      : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none shadow-sm'
                  }`}
                >
                  {msg.role === 'model' ? (
                    <div className="markdown-body text-sm">
                      <Markdown>{msg.text}</Markdown>
                    </div>
                  ) : (
                    msg.text
                  )}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            
            {!isLoading && messages.length > 0 && (
              <div className="pt-2 flex flex-wrap gap-2">
                {SUGGESTED_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(q.text)}
                    className="flex items-center space-x-1.5 bg-white border border-gray-200 rounded-full px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-brand-300 hover:text-brand-600 transition-all shadow-sm"
                  >
                    <q.icon className={`h-3 w-3 ${q.color}`} />
                    <span>{q.text}</span>
                  </button>
                ))}
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 bg-white border-t">
            <div className="relative flex items-center">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask Chef AI anything..."
                className="w-full bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-brand-500 text-sm py-3 pl-4 pr-12 transition-all"
                disabled={isLoading}
              />
              <button
                onClick={() => handleSend()}
                disabled={isLoading || !inputValue.trim()}
                title="Send"
                className={`absolute right-2 p-2 rounded-lg transition-all ${
                  isLoading || !inputValue.trim() 
                    ? 'text-gray-300' 
                    : 'text-brand-600 hover:bg-brand-50'
                }`}
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-[10px] text-center text-gray-400 font-medium">
              Powered by Backbone Hub Intelligence
            </p>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-4 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-110 active:scale-95 ${
          isOpen ? 'bg-gray-100 text-gray-500 rotate-90' : 'bg-brand-600 text-white'
        }`}
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {!isOpen && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-brand-500 border-2 border-white"></span>
          </span>
        )}
      </button>
    </div>
  );
};
