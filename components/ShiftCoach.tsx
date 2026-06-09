import React from 'react';
import { ShiftInsight } from '../types';
import { 
  Lightbulb, 
  AlertCircle, 
  TrendingUp, 
  Clock, 
  UserPlus, 
  ArrowRight,
  Sparkles,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ShiftCoachProps {
  insights: ShiftInsight[];
  onAction?: (insight: ShiftInsight) => void;
}

export const ShiftCoach: React.FC<ShiftCoachProps> = ({ insights, onAction }) => {
  if (insights.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-border-grey dark:border-white/5 rounded-3xl p-8 text-center">
        <Sparkles className="h-12 w-12 text-accent/20 mx-auto mb-4" />
        <h3 className="text-xs font-black text-text-navy dark:text-white uppercase tracking-widest">Shift Coach</h3>
        <p className="text-sm text-text-muted mt-2">All operational metrics are within target. No coaching actions identified.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-border-grey dark:border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-black text-text-navy dark:text-white flex items-center tracking-tighter uppercase">
            <Lightbulb className="mr-3 h-6 w-6 text-warning" />
            Shift Coach
          </h2>
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mt-1">
            Real-time recommendations to boost operation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-success/10 text-success text-[8px] font-black rounded-full uppercase tracking-widest">Live Engine</span>
        </div>
      </div>

      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {insights.map((insight, idx) => (
            <InsightItem key={insight.id} insight={insight} index={idx} onAction={onAction} />
          ))}
        </AnimatePresence>
      </div>

      <div className="mt-8 pt-6 border-t border-border-grey dark:border-white/5 flex items-center justify-between">
        <div className="flex gap-4">
          <LegendItem label="High" color="bg-cta" />
          <LegendItem label="Med" color="bg-warning" />
          <LegendItem label="Low" color="bg-accent" />
        </div>
        <p className="text-[10px] text-text-muted font-bold uppercase italic">Refreshes every 2 minutes</p>
      </div>
    </div>
  );
};

const InsightItem = React.forwardRef<HTMLDivElement, { 
  insight: ShiftInsight; 
  index: number; 
  onAction?: (i: ShiftInsight) => void 
}>(({ insight, index, onAction }, ref) => {
  const Icon = {
    sales: TrendingUp,
    timing: Clock,
    staff: UserPlus,
    menu: Sparkles,
    inventory: AlertCircle
  }[insight.type] || Info;

  const priorityColors = {
    high: 'border-l-cta bg-cta/5',
    medium: 'border-l-warning bg-warning/5',
    low: 'border-l-accent bg-accent/5'
  }[insight.priority];

  const dotColors = {
    high: 'bg-cta',
    medium: 'bg-warning',
    low: 'bg-accent'
  }[insight.priority];

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.1 }}
      className={`relative group p-5 border-l-4 rounded-r-2xl transition-all hover:scale-[1.01] ${priorityColors}`}
    >
      <div className="flex gap-4">
        <div className={`mt-1 p-2 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-border-grey dark:border-white/10 ${dotColors.replace('bg-', 'text-')}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-start mb-1">
            <h4 className="text-xs font-black text-text-navy dark:text-white uppercase tracking-wider">{insight.message}</h4>
            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${dotColors} text-white shadow-sm`}>
              {insight.priority}
            </span>
          </div>
          <p className="text-[11px] text-text-muted font-medium mb-3 leading-relaxed">
            {insight.reason}
          </p>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => onAction?.(insight)}
              className="flex-1 bg-white dark:bg-slate-800 p-2 rounded-lg border border-border-grey dark:border-white/10 flex items-center justify-between group/action hover:border-accent transition-all"
            >
              <span className="text-[10px] font-bold text-text-navy dark:text-white">Action: {insight.action}</span>
              <ArrowRight className="h-3 w-3 text-accent group-hover/action:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

InsightItem.displayName = 'InsightItem';

const LegendItem = ({ label, color }: { label: string; color: string }) => (
  <div className="flex items-center gap-1.5">
    <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
    <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">{label}</span>
  </div>
);
