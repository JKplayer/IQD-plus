import React from 'react';
import { motion } from 'motion/react';
import { TrendingUp, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface LandingProps {
  onStart: () => void;
}

export default function Landing({ onStart }: LandingProps) {
  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-emerald-500/30 selection:text-white flex flex-col relative overflow-hidden">
      
      {/* Background Orbs */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] bg-emerald-600/10 rounded-full blur-[150px] animate-pulse" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 lg:px-12 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-600/20">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black tracking-tighter uppercase italic leading-none">IQDplus</span>
            <span className="text-[8px] font-bold uppercase tracking-[0.3em] text-emerald-500 leading-none mt-1">Kurdistan</span>
          </div>
        </div>
        <Button 
          onClick={onStart}
          variant="ghost"
          className="text-white hover:bg-white/10 px-6 h-10 rounded-full font-bold text-xs uppercase tracking-widest transition-all"
        >
          Sign In
        </Button>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex items-center justify-center relative z-10 px-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-3xl mx-auto flex flex-col items-center"
        >
          <Badge className="bg-emerald-500/10 text-emerald-400 border-none px-5 py-2 rounded-full font-bold text-[10px] uppercase tracking-[0.3em] mb-8 inline-block backdrop-blur-md">
            The Future of Wealth
          </Badge>
          
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.9] uppercase italic mb-8">
            Growth Built <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-600">On Heritage</span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-400 max-w-xl mx-auto mb-10 font-medium leading-relaxed">
            Unlocking institutional-grade investment opportunities in the heart of Kurdistan. Your stable wealth portal.
          </p>
          
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button 
              onClick={onStart}
              className="h-16 px-10 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-black text-sm uppercase tracking-widest shadow-[0_0_40px_rgba(16,185,129,0.3)] group transition-all"
            >
              Enter Portal <ArrowRight className="ml-3 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </motion.div>
        </motion.div>
      </main>

      {/* Minimal Footer */}
      <footer className="relative z-10 py-6 text-center text-slate-600">
        <p className="text-[10px] font-bold uppercase tracking-widest">© 2026 Al-Karam Financial Group.</p>
      </footer>
    </div>
  );
}

