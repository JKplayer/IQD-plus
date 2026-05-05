import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App';
import { db, handleFirestoreError } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot,
  getDocs
} from 'firebase/firestore';
import { OperationType } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight, 
  Zap, 
  Timer, 
  MessageSquare,
  PieChart as PieChartIcon,
  Loader2,
  Copy,
  Check,
  Users,
  Share2,
  Gift,
  ShieldCheck,
  Award,
  ChevronRight,
  User
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Investment, Transaction } from '../types';

const data = [
  { name: 'Mon', value: 4000 },
  { name: 'Tue', value: 3000 },
  { name: 'Wed', value: 2000 },
  { name: 'Thu', value: 2780 },
  { name: 'Fri', value: 1890 },
  { name: 'Sat', value: 2390 },
  { name: 'Sun', value: 3490 },
];

const COLORS = ['#278E43', '#FFD200', '#ED2024', '#334155'];

export default function Dashboard() {
  const { profile } = useAuth();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [liveAccrued, setLiveAccrued] = useState(0);
  const [historicalEarnings, setHistoricalEarnings] = useState(0);
  const [pendingDeposits, setPendingDeposits] = useState(0);
  const [directRefCount, setDirectRefCount] = useState(0);
  const [tier2RefCount, setTier2RefCount] = useState(0);
  const [referralTree, setReferralTree] = useState<any[]>([]);
  const [referralEarnings, setReferralEarnings] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);
  const [erbilTime, setErbilTime] = useState<string>('');

  useEffect(() => {
    const updateErbilTime = () => {
      setErbilTime(new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Baghdad', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateErbilTime();
    const timeInterval = setInterval(updateErbilTime, 1000);
    return () => clearInterval(timeInterval);
  }, []);

  useEffect(() => {
    if (investments.length === 0) {
      setLiveAccrued(0);
      return;
    }

    const calculateAccrued = () => {
      const now = new Date();
      return investments.reduce((sum, inv) => {
        const startStr = inv.lastDailyPayoutAt || inv.purchaseDate;
        const start = new Date(startStr).getTime();
        const elapsed = (now.getTime() - start) / 1000;
        // 2% per month (approx 30 days)
        const yieldPerSecond = (inv.amountIQD * 0.02) / (30 * 24 * 3600);
        return sum + Math.max(0, elapsed * yieldPerSecond);
      }, 0);
    };

    setLiveAccrued(calculateAccrued());
    const interval = setInterval(() => {
      setLiveAccrued(calculateAccrued());
    }, 1000);

    return () => clearInterval(interval);
  }, [investments]);

  useEffect(() => {
    if (!profile) return;

    const qInvest = query(
      collection(db, 'investments'),
      where('userId', '==', profile.uid)
    );
    const qTrans = query(
      collection(db, 'transactions'),
      where('userId', '==', profile.uid)
    );
    const qPendingDeposits = query(
      collection(db, 'deposits'),
      where('userId', '==', profile.uid),
      where('status', '==', 'pending')
    );
    const qRefs = query(
      collection(db, 'users'),
      where('referredBy', '==', profile.uid)
    );

    const unsubInvest = onSnapshot(qInvest, {
      next: (snap) => {
        const docs = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Investment))
          .filter(inv => inv.status === 'active');
        setInvestments(docs);
      },
      error: (err) => handleFirestoreError(err, OperationType.LIST, 'investments')
    });

    const unsubTrans = onSnapshot(qTrans, {
      next: (snap) => {
        const docs = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Transaction))
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        setTransactions(docs.slice(0, 10));

        const earnings = docs
          .filter(t => t.type === 'payout' && t.status === 'completed')
          .reduce((sum, t) => sum + t.amountIQD, 0);
        setHistoricalEarnings(earnings);

        const refRewards = docs
          .filter(t => t.type === 'referral' && t.status === 'completed')
          .reduce((sum, t) => sum + t.amountIQD, 0);
        setReferralEarnings(refRewards);
      },
      error: (err) => handleFirestoreError(err, OperationType.LIST, 'transactions')
    });

    const unsubPending = onSnapshot(qPendingDeposits, {
      next: (snap) => {
        const total = snap.docs.reduce((sum, d) => sum + (d.data().amountIQD || 0), 0);
        setPendingDeposits(total);
      },
      error: (err) => handleFirestoreError(err, OperationType.LIST, 'deposits')
    });

    const unsubRefs = onSnapshot(qRefs, {
      next: async (snap) => {
        const t1Docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        setDirectRefCount(snap.size);

        if (t1Docs.length > 0) {
          const t1Ids = t1Docs.map(d => d.uid);
          const qT2 = query(
            collection(db, 'users'),
            where('referredBy', 'in', t1Ids.slice(0, 10)),
            limit(100)
          );
          
          try {
            const t2Snap = await getDocs(qT2);
            const t2Docs = t2Snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
            setTier2RefCount(t2Docs.length);

            // Build Tree
            const tree = t1Docs.map(u => ({
              ...u,
              children: t2Docs.filter(child => child.referredBy === u.uid)
            }));
            setReferralTree(tree);
          } catch (e) {
            console.error("T2 Fetch error:", e);
            toast.error("Failed to synchronize secondary network nodes.");
          }
        } else {
          setTier2RefCount(0);
          setReferralTree([]);
        }
      },
      error: (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    });

    return () => {
      unsubInvest();
      unsubTrans();
      unsubPending();
      unsubRefs();
    };
  }, [profile]);

  const totalEarned = historicalEarnings + (profile?.profitBalance || 0) + liveAccrued + referralEarnings;
  const referralLink = `${window.location.origin}?ref=${profile?.referralCode}`;

  const copyRefLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopiedLink(true);
      toast.success("Referral link copied to clipboard!");
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      toast.error("Failed to copy link. Please manually copy the code.");
    }
  };

  const stats = [
    { 
      label: "Total Balance", 
      value: profile ? profile.balance.toLocaleString() : "---", 
      unit: "IQD", 
      icon: Wallet, 
      color: "text-emerald-600",
      description: "Available for withdrawal" 
    },
    { 
      label: "Live Accrued Yield", 
      value: liveAccrued > 0 ? liveAccrued.toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 6 }) : "0.000000", 
      unit: "IQD", 
      icon: Zap, 
      color: "text-blue-500",
      description: `Updates real-time (${erbilTime})`
    },
    { 
      label: "Total Earned Money", 
      value: totalEarned > 0 ? totalEarned.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : "0.0000", 
      unit: "IQD", 
      icon: TrendingUp, 
      color: "text-emerald-500",
      description: "Static payouts + live accrued" 
    },
    { 
      label: "Funds on Hold", 
      value: pendingDeposits.toLocaleString(), 
      unit: "IQD", 
      icon: ShieldCheck, 
      color: "text-amber-500",
      description: "Deposits pending audit"
    },
    { 
      label: "Capital Deployed", 
      value: investments.length > 0 
        ? investments.reduce((sum, inv) => sum + inv.amountIQD, 0).toLocaleString() 
        : (profile?.totalInvested || 0).toLocaleString(), 
      unit: "IQD", 
      icon: Timer, 
      color: "text-blue-600",
      description: "Funds in yield engines"
    },
    { 
      label: "Network Nodes", 
      value: (directRefCount + tier2RefCount).toString(), 
      unit: "NODES", 
      icon: Zap, 
      color: "text-indigo-600",
      description: "Total referral network size"
    },
  ];

  // Generate dynamic chart data based on transactions
  const chartData = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    
    // Find sum of transactions up to this day (simplified historical approximation)
    const dayEnd = new Date(d);
    dayEnd.setHours(23, 59, 59, 999);
    
    // This is a simplified "balance over time" logic
    // For a real app, you'd store daily snapshots, but we approximate here
    const totalByThisDay = profile?.balance || 0;
    // (In a real scenario we'd subtract subsequent transactions to go backwards)
    
    // For visual accuracy without a full snapshot table, we use some randomness for the "curve" 
    // but grounded by the current balance if data is sparse
    const mockVariance = 0.95 + (Math.random() * 0.1); 
    return { name: dayName, value: Math.floor(totalByThisDay * mockVariance) };
  });

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-4" />
        <p className="text-slate-400 font-medium">Synchronizing Portfolio...</p>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tighter uppercase italic">
            Overview <span className="text-emerald-600">Protocol</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium italic">Performance metrics for your capital deployment.</p>
        </div>
        <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-6 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
           <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
           <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Network Feed</span>
        </div>
      </header>

      {/* Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <Card className="bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800 shadow-sm group hover:border-emerald-500/30 transition-all duration-300 rounded-3xl overflow-hidden h-full">
              <CardContent className="p-7">
                <div className="flex items-center justify-between mb-6">
                  <div className={`p-4 rounded-[1.25rem] bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800 ${stat.color} group-hover:scale-110 transition-transform shadow-sm`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2">{stat.label}</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-2xl font-mono font-black text-slate-900 dark:text-slate-100 tracking-tighter italic italic-none">{stat.value}</h3>
                  <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest">{stat.unit}</span>
                </div>
                <p className="mt-4 text-[10px] font-medium text-slate-500 dark:text-slate-500 italic uppercase tracking-wide">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-6 gap-8">
        {/* Referral Card */}
        <Card className="lg:col-span-3 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm p-10 rounded-[2.5rem] relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
            <Share2 className="w-64 h-64 text-slate-900 dark:text-slate-100" />
          </div>
          
          <div className="relative">
            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 mb-8 uppercase tracking-tight">Growth Network</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 mb-3">
                  <Users className="w-4 h-4 text-blue-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Direct Referrals</span>
                </div>
                <p className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tighter">{directRefCount}</p>
                <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-tight">Active Nodes in Tier 1</p>
              </div>

              <div className="p-5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-800/20">
                <div className="flex items-center gap-3 mb-3">
                  <Gift className="w-4 h-4 text-emerald-600" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Total Rewards</span>
                </div>
                <p className="text-3xl font-black text-emerald-600 tracking-tighter">{referralEarnings.toLocaleString()}</p>
                <p className="text-[10px] text-emerald-500/60 mt-1 uppercase font-bold tracking-tight">IQD Accumulated</p>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Your Referral Code</h4>
              <div className="px-6 py-5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="font-mono text-xl font-black text-slate-900 dark:text-slate-100 tracking-[0.2em]">{profile?.referralCode}</span>
                <Button 
                  onClick={copyRefLink} 
                  variant="ghost" 
                  size="sm"
                  className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                >
                  {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span className="ml-2 font-bold uppercase tracking-widest text-[10px]">{copiedLink ? 'Copied' : 'Copy Link'}</span>
                </Button>
              </div>
            </div>
            
            <div className="flex gap-4 mt-8">
              <Button 
                onClick={() => window.location.href = '/invest'} 
                className="flex-1 bg-slate-900 dark:bg-emerald-600 text-white font-black rounded-2xl h-14 uppercase tracking-widest text-[10px] shadow-xl"
              >
                Launch Engine
              </Button>
              <Button 
                onClick={() => window.location.href = '/deposit'} 
                variant="outline"
                className="flex-1 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-black rounded-2xl h-14 uppercase tracking-widest text-[10px]"
              >
                Deposit Proof
              </Button>
            </div>
            
            <p className="mt-8 text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
              Earn 0.5% from every investment your partners make. Commissions are credited instantly upon package activation.
            </p>
          </div>
        </Card>

        {/* Referral Tree Visualization */}
        <Card className="lg:col-span-3 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-50 dark:border-slate-800 pb-4 shrink-0">
             <div>
               <CardTitle className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight flex items-center gap-2">
                 <Gift className="w-5 h-5 text-emerald-600" />
                 Growth Network Tree
               </CardTitle>
               <CardDescription className="text-slate-400 font-medium text-[10px] uppercase tracking-widest italic">Visualization of your primary and secondary yields nodes.</CardDescription>
             </div>
             <div className="flex items-center gap-4">
               <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Active</span>
               </div>
               <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-200 dark:bg-slate-800" />
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Idle</span>
               </div>
             </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-scroll p-10 bg-slate-50/30 dark:bg-slate-950/20">
             {referralTree.length === 0 ? (
               <div className="h-64 flex flex-col items-center justify-center text-center space-y-6 opacity-30">
                 <div className="p-6 rounded-full bg-slate-100 dark:bg-slate-800">
                    <Users className="w-10 h-10 text-slate-400" />
                 </div>
                 <div className="space-y-2">
                   <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Root Node Detected</p>
                   <p className="text-[10px] text-slate-400 max-w-xs leading-relaxed font-medium italic">Share your referral code to begin expanding your neural growth network.</p>
                 </div>
               </div>
             ) : (
               <div className="space-y-8 relative">
                 {/* Visual Connecting Line for Root */}
                 <div className="absolute left-6 top-10 bottom-0 w-px bg-slate-100 dark:bg-slate-800/60" />
                 
                 <div className="flex items-center gap-4 relative z-10">
                   <div className="w-12 h-12 rounded-2xl bg-slate-900 border-2 border-emerald-500/50 flex items-center justify-center text-emerald-500 shadow-xl shadow-emerald-500/10 active:scale-95 transition-all">
                      <User className="w-6 h-6" />
                   </div>
                   <div>
                     <p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-600">You (Root Node)</p>
                     <p className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">{profile?.displayName}</p>
                   </div>
                 </div>

                 <div className="ml-14 space-y-10">
                    {referralTree.map((node, i) => (
                      <div key={node.uid} className="relative">
                        {/* Connection line to child */}
                        <div className="absolute -left-8 top-6 w-8 h-px bg-slate-100 dark:bg-slate-800/60" />
                        
                        <div className="flex items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm relative z-10 hover:border-emerald-500/50 transition-all group">
                           <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner ${
                             node.balance > 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                           }`}>
                             <Users className="w-5 h-5" />
                           </div>
                           <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tier 1 Node</p>
                                {node.balance > 0 && <Badge className="bg-emerald-500 text-white text-[8px] h-4">ACTIVE</Badge>}
                              </div>
                              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{node.displayName}</p>
                           </div>
                        </div>

                        {/* Tier 2 children */}
                        {node.children && node.children.length > 0 && (
                          <div className="ml-10 mt-6 space-y-4 relative">
                            {/* Vertical connecting line for Tier 2 */}
                             <div className="absolute -left-4 top-0 bottom-0 w-px bg-slate-100 dark:bg-slate-800/60" />
                             
                             {node.children.map((child: any) => (
                               <div key={child.uid} className="flex items-center gap-3 relative pl-6">
                                  <div className="absolute left-0 top-1/2 w-6 h-px bg-slate-100 dark:bg-slate-800/60" />
                                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] shadow-sm ${
                                    child.balance > 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                  }`}>
                                    <User className="w-3.5 h-3.5" />
                                  </div>
                                  <div>
                                    <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">Tier 2</p>
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate tracking-tight">{child.displayName}</p>
                                  </div>
                               </div>
                             ))}
                          </div>
                        )}
                      </div>
                    ))}
                 </div>
               </div>
             )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Transactions */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 py-4 px-6">
             <div>
               <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100">Recent Activity</CardTitle>
               <CardDescription className="text-slate-400 text-xs font-medium">Your historical financial movements.</CardDescription>
             </div>
             <Link to="/history">
               <Button variant="ghost" size="sm" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 font-bold text-xs uppercase tracking-widest">View All</Button>
             </Link>
          </CardHeader>
          <CardContent className="p-0">
             <div className="divide-y divide-slate-50 dark:divide-slate-800">
               {transactions.length > 0 ? transactions.map((tx) => (
                 <div key={tx.id} className="flex items-center px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className={`p-2.5 rounded-xl mr-4 ${
                      tx.type === 'deposit' || tx.type === 'payout' || tx.type === 'referral' 
                        ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' 
                        : 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
                    }`}>
                      {tx.type === 'deposit' || tx.type === 'payout' || tx.type === 'referral' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100 capitalize leading-tight mb-0.5">{tx.type}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{new Date(tx.timestamp).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-mono font-bold ${
                        tx.type === 'deposit' || tx.type === 'payout' || tx.type === 'referral' ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {tx.type === 'deposit' || tx.type === 'payout' || tx.type === 'referral' ? '+' : '-'}
                        {tx.amountIQD.toLocaleString()} <span className="text-[10px] ml-0.5">IQD</span>
                      </p>
                      <Badge variant="outline" className={`text-[10px] border-none p-0 mt-0.5 uppercase font-bold tracking-widest ${tx.status === 'completed' ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {tx.status}
                      </Badge>
                    </div>
                 </div>
               )) : (
                 <div className="p-12 text-center text-slate-400 italic text-sm">No transactions recorded yet.</div>
               )}
             </div>
          </CardContent>
        </Card>

        {/* Portfolio Distribution */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 py-4 px-6">
             <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
               <PieChartIcon className="w-5 h-5 text-indigo-600" />
               Portfolio Mix
             </CardTitle>
             <CardDescription className="text-slate-400 text-xs font-medium">Allocation across different package tiers.</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px] p-6">
             {investments.length > 0 ? (
               <div className="h-full flex flex-col md:flex-row items-center gap-6">
                 <div className="w-full md:w-1/2 h-[240px] relative">
                   <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                       <Pie
                         data={investments.reduce((acc: any[], inv) => {
                           const existing = acc.find(a => a.name === inv.packageName);
                           if (existing) existing.value += inv.amountIQD;
                           else acc.push({ name: inv.packageName, value: inv.amountIQD });
                           return acc;
                         }, [])}
                         innerRadius={70}
                         outerRadius={100}
                         paddingAngle={8}
                         dataKey="value"
                         stroke="none"
                       >
                         {investments.reduce((acc: any[], inv) => {
                           if (!acc.find(a => a === inv.packageName)) acc.push(inv.packageName);
                           return acc;
                         }, []).map((_, index) => (
                           <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} cornerRadius={4} />
                         ))}
                       </Pie>
                       <Tooltip 
                         contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderRadius: '16px', border: 'none', color: '#fff' }}
                         itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                         formatter={(value: number) => [`${value.toLocaleString()} IQD`, 'Assets']}
                       />
                     </PieChart>
                   </ResponsiveContainer>
                   <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Total Assets</p>
                     <p className="text-sm font-mono font-black text-slate-900 dark:text-slate-100 leading-none">
                       {investments.reduce((sum, inv) => sum + inv.amountIQD, 0).toLocaleString()}
                     </p>
                   </div>
                 </div>
                 
                 <div className="w-full md:w-1/2 space-y-3">
                    {investments.reduce((acc: any[], inv) => {
                      const existing = acc.find(a => a.name === inv.packageName);
                      if (existing) existing.value += inv.amountIQD;
                      else acc.push({ name: inv.packageName, value: inv.amountIQD });
                      return acc;
                    }, []).map((entry, index) => (
                      <div key={entry.name} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight">{entry.name}</span>
                        </div>
                        <span className="text-xs font-mono font-black text-slate-900 dark:text-slate-100 italic">
                          {((entry.value / investments.reduce((sum, inv) => sum + inv.amountIQD, 0)) * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                 </div>
               </div>
             ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-40">
                  <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-full flex items-center justify-center mb-4 text-emerald-500">
                    <TrendingUp className="w-8 h-8" />
                  </div>
                  <p className="text-slate-400 text-sm font-medium italic">Deploy capital to activate your portfolio analytics.</p>
                </div>
             )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
