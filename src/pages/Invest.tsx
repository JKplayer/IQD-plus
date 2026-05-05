import { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, doc, updateDoc, increment, query, where, getDocs, getDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Zap, 
  ShieldCheck, 
  TrendingUp, 
  Wallet, 
  Info, 
  ArrowRight,
  CheckCircle2,
  Lock,
  Coins,
  CalendarDays,
  Calculator,
  Percent
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Package, Investment, UserProfile } from '../types';
import { motion } from 'motion/react';

export default function Invest() {
  const { profile } = useAuth();
  const [packages, setPackages] = useState<Package[]>([]);
  const [activeInvestments, setActiveInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  
  // Calculator State
  const [calcAmount, setCalcAmount] = useState<number>(10000000);
  const [selectedCalcPkg, setSelectedCalcPkg] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const idToken = await auth.currentUser?.getIdToken();
        const pkgRes = await fetch('/api/packages', {
          headers: {
            'Authorization': idToken ? `Bearer ${idToken}` : ''
          }
        });
        const pkgData = await pkgRes.json();
        setPackages(pkgData);

        if (profile?.uid) {
          const invQuery = query(
            collection(db, 'investments'),
            where('userId', '==', profile.uid)
          );
          const invSnap = await getDocs(invQuery);
          const invData = invSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Investment))
            .filter(inv => inv.status === 'active');
          setActiveInvestments(invData);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load investment packages or active investments. Please refresh.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [profile?.uid]);

  const handleInvest = async (pkg: Package) => {
    if (!profile) return;
    
    if (profile.balance < pkg.priceIQD) {
      toast.error("Insufficient balance. Please deposit IQD first.");
      return;
    }

    setPurchasingId(pkg.id);
    try {
      // 1. Create Transaction
      const txRef = await addDoc(collection(db, 'transactions'), {
        userId: profile.uid,
        type: 'investment',
        amountIQD: pkg.priceIQD,
        description: `Purchased ${pkg.name} package`,
        timestamp: new Date().toISOString(),
        status: 'completed'
      });

      // 2. Create Investment
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      const investmentData = {
        userId: profile.uid,
        packageId: pkg.id,
        packageName: pkg.name,
        amountIQD: pkg.priceIQD,
        purchaseDate: new Date().toISOString(),
        nextPayoutDate: nextMonth.toISOString(),
        status: 'active',
        autoReinvest: true
      };

      const invRef = await addDoc(collection(db, 'investments'), investmentData);
      
      // Update local state
      setActiveInvestments(prev => [...prev, { id: invRef.id, ...investmentData } as Investment]);

      // 3. Update User Balance
      const userRef = doc(db, 'users', profile.uid);
      await updateDoc(userRef, {
        balance: increment(-pkg.priceIQD),
        totalInvested: increment(pkg.priceIQD)
      });

      // 4. Handle Referral Commission (0.5% for direct referrer)
      if (profile.referredBy) {
        try {
          const commissionAmount = Math.floor(pkg.priceIQD * 0.005);
          if (commissionAmount > 0) {
            const referrerRef = doc(db, 'users', profile.referredBy);
            
            await updateDoc(referrerRef, {
              balance: increment(commissionAmount)
            });

            await addDoc(collection(db, 'transactions'), {
              userId: profile.referredBy,
              type: 'referral',
              amountIQD: commissionAmount,
              description: `Referral commission (0.5%) from ${profile.email}'s investment`,
              timestamp: new Date().toISOString(),
              status: 'completed'
            });

            await addDoc(collection(db, 'notifications'), {
              userId: profile.referredBy,
              title: 'Referral Commission!',
              message: `You earned ${commissionAmount.toLocaleString()} IQD (0.5%) from ${profile.email}'s investment in ${pkg.name}.`,
              type: 'referral',
              read: false,
              timestamp: new Date().toISOString()
            });
          }
        } catch (err) {
          console.error("Referral commission error:", err);
          toast.warning("Investment active, but referral commission calculation may be delayed.");
        }
      }

      toast.success(`Success! Your ${pkg.name} package is now active.`);
    } catch (error) {
      console.error(error);
      toast.error("Investment failed. Please contact support.");
    } finally {
      setPurchasingId(null);
    }
  };

  const monthlyReturn = calcAmount * 0.02;
  const yearlyReturn = monthlyReturn * 12;

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-10 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="max-w-2xl">
        <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tight leading-tight uppercase">
          Wealth <span className="text-emerald-600">Engines</span>
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-4 text-lg leading-relaxed font-medium">
          Choose from institutional-grade investment tiers. Every package offers a <span className="text-emerald-600 font-bold">fixed 2.0% monthly dividend</span> with capital preservation.
        </p>
      </header>

      {/* Dividend Calculator */}
      <Card className="bg-white dark:bg-slate-900 border-emerald-500/20 shadow-2xl shadow-emerald-500/5 rounded-[2.5rem] overflow-hidden border-b-4 border-b-emerald-500">
        <CardHeader className="p-8 pb-4 flex flex-row items-center justify-between border-b border-slate-50 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <Calculator className="w-5 h-5 text-emerald-600" />
              </div>
              <CardTitle className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Earnings Calculator</CardTitle>
            </div>
            <CardDescription className="text-slate-500 text-xs font-bold uppercase tracking-widest">Forecast your wealth progression with 2% monthly dividends.</CardDescription>
          </div>
          <Badge className="bg-emerald-600 text-white px-4 py-1 rounded-full font-black text-[10px] tracking-widest uppercase">Fixed API: 2.0%</Badge>
        </CardHeader>
        <CardContent className="p-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] block">Select Tier Reference</label>
                <div className="flex flex-wrap gap-2">
                  {packages.map(pkg => (
                    <button
                      key={pkg.id}
                      onClick={() => {
                        setSelectedCalcPkg(pkg.name);
                        setCalcAmount(pkg.priceIQD);
                      }}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                        selectedCalcPkg === pkg.name 
                          ? 'bg-slate-900 dark:bg-emerald-600 text-white border-transparent shadow-lg' 
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-100 dark:border-slate-700 hover:border-emerald-500/30'
                      }`}
                    >
                      {pkg.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Custom Amount (IQD)</label>
                  <span className="font-mono font-bold text-emerald-600 tabular-nums">{calcAmount.toLocaleString()}</span>
                </div>
                <input 
                  type="range"
                  min="100000"
                  max="100000000"
                  step="100000"
                  value={calcAmount}
                  onChange={(e) => {
                    setCalcAmount(parseInt(e.target.value));
                    setSelectedCalcPkg('');
                  }}
                  className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                />
                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <span>100K</span>
                  <span>50M</span>
                  <span>100M+</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-950 rounded-3xl p-8 border border-slate-800 relative overflow-hidden shadow-inner">
               <div className="absolute top-0 right-0 p-8 opacity-10">
                 <Percent className="w-40 h-40 text-emerald-500" />
               </div>
               
               <div className="relative space-y-8">
                  <div className="flex flex-col gap-2">
                     <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Estimated Monthly Payout</span>
                     <div className="flex items-baseline gap-2">
                        <h4 className="text-4xl font-black text-white tracking-tighter tabular-nums">{monthlyReturn.toLocaleString()}</h4>
                        <span className="text-emerald-500 font-black text-xs uppercase">IQD / MO</span>
                     </div>
                  </div>

                  <div className="h-px bg-slate-800 w-full" />

                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Annual Yield</p>
                        <p className="text-xl font-black text-slate-100 tracking-tighter tabular-nums">{yearlyReturn.toLocaleString()} IQD</p>
                     </div>
                     <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total After 12mo</p>
                        <p className="text-xl font-black text-emerald-500 tracking-tighter tabular-nums">{(calcAmount + yearlyReturn).toLocaleString()} IQD</p>
                     </div>
                  </div>

                  <p className="text-[10px] text-slate-500 italic leading-relaxed">
                    * Projections based on the fixed 2.0% monthly distribution protocol. Past performance of the IQDplus asset basket does not guarantee identical future results.
                  </p>
               </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {packages.map((pkg, idx) => {
          const activeInvestment = activeInvestments.find(inv => inv.packageId === pkg.id);
          
          return (
            <motion.div
              key={pkg.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Card className="relative bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-full group hover:border-emerald-500 transition-all duration-300 rounded-[2rem] border-b-4 border-b-slate-100 dark:border-b-slate-800 hover:border-b-emerald-500">
                <div className="absolute -right-4 -top-4 p-8 opacity-5 group-hover:opacity-10 transition-opacity rotate-12">
                   <Zap className="w-32 h-32 text-emerald-500" />
                </div>

                <CardHeader className="pb-4 relative">
                  <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-2xl transition-colors ${activeInvestment ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 text-slate-400 group-hover:text-emerald-600'}`}>
                      <Coins className="w-5 h-5" />
                    </div>
                    {activeInvestment && (
                      <Badge className="bg-emerald-500 text-white border-none text-[8px] px-2 py-0.5 uppercase font-black">Active Node</Badge>
                    )}
                  </div>
                  <CardTitle className="text-xl font-black text-slate-900 dark:text-slate-100 mb-1 uppercase tracking-tight">{pkg.name}</CardTitle>
                  <div className="flex items-baseline gap-1.5">
                     <h3 className="text-2xl font-mono font-bold text-slate-900 dark:text-slate-100 tracking-tighter">{(pkg.priceIQD).toLocaleString()}</h3>
                     <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">IQD</span>
                  </div>
                </CardHeader>
                
                <CardContent className="flex-1 pt-0 space-y-6">
                   <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850/50 border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monthly Return</span>
                        <span className="text-sm font-black text-emerald-600">{(pkg.monthlyReturn * 100).toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(pkg.monthlyReturn * 100) * 10}%` }} />
                      </div>
                   </div>

                   <div className="space-y-4">
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed italic">
                        "{pkg.description}"
                      </p>
                      
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center gap-3">
                           <div className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
                             <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                           </div>
                           <span className="text-[10px] text-slate-600 dark:text-slate-400 font-bold uppercase tracking-tight">Vault-Secured Principal</span>
                        </div>
                        <div className="flex items-center gap-3">
                           <div className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
                             <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                           </div>
                           <span className="text-[10px] text-slate-600 dark:text-slate-400 font-bold uppercase tracking-tight">Automated IQD Rails</span>
                        </div>
                      </div>
                   </div>

                   {activeInvestment && (
                      <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 rounded-xl">
                         <div className="flex items-center gap-2 mb-1">
                            <CalendarDays className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Next Distribution</span>
                         </div>
                         <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {new Date(activeInvestment.nextPayoutDate).toLocaleDateString('en-US', { 
                              month: 'long', 
                              day: 'numeric'
                            })}
                         </p>
                      </div>
                   )}
                </CardContent>
                
                <CardFooter className="pt-2">
                  <Button 
                     onClick={() => handleInvest(pkg)}
                     disabled={purchasingId === pkg.id}
                     className={`w-full h-12 font-bold rounded-xl transition-all group overflow-hidden uppercase tracking-widest text-[10px] ${
                       activeInvestment 
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-600 hover:text-white' 
                        : 'bg-slate-950 dark:bg-emerald-600 text-white hover:bg-slate-800 dark:hover:bg-emerald-500 shadow-xl'
                     }`}
                  >
                    {purchasingId === pkg.id ? (
                      <div className="flex items-center">
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-3" />
                        Validating...
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full px-2">
                        <span>{activeInvestment ? "Re-Invest" : "Invest Now"}</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <Card className="bg-slate-900 border-slate-800 p-10 lg:p-14 rounded-[2.5rem] relative overflow-hidden shadow-2xl">
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
         <div className="relative flex flex-col lg:flex-row items-center gap-10 justify-between">
            <div className="max-w-xl">
               <Badge className="bg-emerald-500 text-slate-950 font-bold mb-6">INSTITUTIONAL SECURITY</Badge>
               <h2 className="text-4xl font-black text-white mb-6 uppercase tracking-tight">Capital Protection Guarantee</h2>
               <p className="text-slate-400 text-lg leading-relaxed font-medium">
                 All investments at IQDplus are backed by physical liquid assets and insured against market volatility up to 250M IQD. Your dividends are calculated daily and distributed exactly 30 days after activation.
               </p>
            </div>
            <div className="flex gap-4">
               <div className="flex flex-col items-center p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm min-w-[140px]">
                  <Lock className="w-6 h-6 text-emerald-400 mb-3" />
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Encrypted</span>
               </div>
               <div className="flex flex-col items-center p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm min-w-[140px]">
                  <ShieldCheck className="w-6 h-6 text-emerald-400 mb-3" />
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Verified</span>
               </div>
            </div>
         </div>
      </Card>
    </div>
  );
}
