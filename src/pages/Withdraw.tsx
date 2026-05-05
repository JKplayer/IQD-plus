import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  MessageCircle, 
  Send, 
  ShieldCheck,
  Zap
} from 'lucide-react';

export default function Withdraw() {
  const WHATSAPP_URL = "https://wa.me/9647834612120"; 
  const TELEGRAM_URL = "https://t.me/+9647834612120"; 

  return (
    <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header>
        <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tight leading-tight uppercase">
          Liquidity <span className="text-emerald-600">Access</span>
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg font-medium italic">
          Convert your digital gains into physical wealth.
        </p>
      </header>

      <div className="max-w-3xl">
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm rounded-[2rem] overflow-hidden">
          <CardHeader className="p-8 pb-4">
            <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl flex items-center justify-center mb-6 text-emerald-600 border border-emerald-100 dark:border-emerald-900/50">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <CardTitle className="text-3xl font-black tracking-tight">Secure Withdrawal</CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400 mt-2 text-base max-w-lg">
              To ensure the highest level of security and provide personalized assistance, all withdrawals are handled directly by our official support team.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 pt-4 space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* WhatsApp Option */}
              <a 
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group p-6 rounded-[1.5rem] bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 hover:shadow-lg hover:shadow-emerald-500/5 transition-all flex flex-col items-start gap-4"
              >
                <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                  <MessageCircle className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-slate-100 text-xl tracking-tight">WhatsApp</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium leading-relaxed">Fastest response during business hours</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mt-2">+964 783 461 2120</p>
                </div>
              </a>

              {/* Telegram Option */}
              <a 
                href={TELEGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group p-6 rounded-[1.5rem] bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-blue-500/50 hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:shadow-lg hover:shadow-blue-500/5 transition-all flex flex-col items-start gap-4"
              >
                <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/50 text-blue-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                  <Send className="w-7 h-7 ml-1" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-slate-100 text-xl tracking-tight">Telegram</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium leading-relaxed">Secure and direct communication</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mt-2">+964 783 461 2120</p>
                </div>
              </a>
            </div>

            <div className="p-6 rounded-[1.5rem] bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 flex flex-col sm:flex-row gap-6 items-center">
               <div className="shrink-0 w-12 h-12 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-200 dark:border-emerald-800/50">
                 <Zap className="w-6 h-6" />
               </div>
               <div className="flex-1 text-center sm:text-left">
                 <h4 className="text-base font-black text-emerald-900 dark:text-emerald-100 tracking-tight mb-1">Fast Processing</h4>
                 <p className="text-sm text-emerald-800/80 dark:text-emerald-300/80 font-medium leading-relaxed max-w-sm mx-auto sm:mx-0">
                   Once your withdrawal request is verified by our admins via chat, funds are sent to your designated account promptly.
                 </p>
               </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
