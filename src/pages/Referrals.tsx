import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { db, handleFirestoreError } from '../lib/firebase';
import { collection, query, where, getDocs, onSnapshot, limit } from 'firebase/firestore';
import { OperationType } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Share2, 
  Gift, 
  TrendingUp, 
  Copy, 
  Check, 
  Award,
  Zap,
  ArrowRight,
  Info,
  ChevronDown,
  ChevronUp,
  RefreshCcw
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { Transaction, UserProfile } from '../types';

interface ReferralNode {
  uid: string;
  displayName: string;
  email: string;
  isActive: boolean;
  tier2: ReferralNode[];
}

const OrgTreeNode: React.FC<{ node: any, isRoot?: boolean }> = ({ node, isRoot = false }) => {
  return (
    <li>
      <div className="inline-block relative">
        <div className={`p-4 rounded-2xl border min-w-[200px] shadow-sm flex flex-col items-center transition-all ${
           isRoot ? 'bg-slate-900 border-slate-900 text-white dark:bg-slate-100 dark:border-slate-100 dark:text-slate-900 hover:scale-105' :
           node.isActive ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-500/30 hover:-translate-y-1' :
           'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 hover:-translate-y-1'
        }`}>
           <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 shadow-inner ${
               isRoot ? 'bg-emerald-500 text-white shadow-emerald-500/20' :
               node.isActive ? 'bg-emerald-500 text-white shadow-emerald-500/20' :
               'bg-slate-100 text-slate-400 dark:bg-slate-800'
           }`}>
              {isRoot ? <Award className="w-6 h-6" /> : (node.isActive ? <Zap className="w-6 h-6" /> : <Users className="w-6 h-6" />)}
           </div>
           
           <p className="text-sm font-black uppercase tracking-tight">{node.displayName}</p>
           <p className={`text-[10px] mt-1 tracking-widest uppercase truncate max-w-[150px] ${
             isRoot ? 'text-slate-400' : 'text-slate-500'
           }`}>
             {node.email}
           </p>

           {!isRoot && (
             <Badge variant="outline" className={`mt-3 text-[9px] uppercase tracking-widest px-2 py-0.5 border-none font-bold ${
               node.isActive 
                 ? 'bg-emerald-200 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400' 
                 : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
             }`}>
               {node.isActive ? 'Active Investment' : 'Pending'}
             </Badge>
           )}
        </div>
      </div>
      
      {node.tier2 && node.tier2.length > 0 && (
         <ul>
            {node.tier2.map((child: any) => (
              <OrgTreeNode key={child.uid} node={child} />
            ))}
         </ul>
      )}
    </li>
  );
};

export default function Referrals() {
  const { profile } = useAuth();
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [directRefCount, setDirectRefCount] = useState(0);
  const [tier2RefCount, setTier2RefCount] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [referralTree, setReferralTree] = useState<ReferralNode[]>([]);
  const [loadingTree, setLoadingTree] = useState(true);

  useEffect(() => {
    if (!profile?.uid) return;

    const buildTree = async () => {
      setLoadingTree(true);
      try {
        // 1. Fetch Tier 1
        const q1 = query(collection(db, 'users'), where('referredBy', '==', profile.uid));
        const snap1 = await getDocs(q1);
        const tier1Users = snap1.docs.map(d => d.data() as UserProfile);

        const tree: ReferralNode[] = await Promise.all(tier1Users.map(async (u) => {
          // Check activity for T1
          const qInv1 = query(collection(db, 'investments'), where('userId', '==', u.uid), where('status', '==', 'active'));
          const invSnap1 = await getDocs(qInv1);
          
          // Fetch Tier 2
          const q2 = query(collection(db, 'users'), where('referredBy', '==', u.uid), limit(100));
          const snap2 = await getDocs(q2);
          const tier2Users = snap2.docs.map(d => d.data() as UserProfile);

          const tier2Nodes = await Promise.all(tier2Users.map(async (u2) => {
             const qInv2 = query(collection(db, 'investments'), where('userId', '==', u2.uid), where('status', '==', 'active'));
             const invSnap2 = await getDocs(qInv2);
             return {
               uid: u2.uid,
               displayName: u2.displayName,
               email: u2.email,
               isActive: !invSnap2.empty,
               tier2: []
             };
          }));

          return {
            uid: u.uid,
            displayName: u.displayName,
            email: u.email,
            isActive: !invSnap1.empty,
            tier2: tier2Nodes
          };
        }));

        setReferralTree(tree);
        setDirectRefCount(tree.length);
        setTier2RefCount(tree.reduce((acc, node) => acc + node.tier2.length, 0));
      } catch (error) {
        console.error("Error building referral tree:", error);
        handleFirestoreError(error, OperationType.LIST, 'users/investments');
      } finally {
        setLoadingTree(false);
      }
    };

    buildTree();

    // Still use onSnapshot for earnings to keep it real-time
    const qEarnings = query(
      collection(db, 'transactions'), 
      where('userId', '==', profile.uid),
      where('type', '==', 'referral')
    );
    const unsubEarnings = onSnapshot(qEarnings, {
      next: (snap) => {
        const total = snap.docs.reduce((sum, doc) => sum + (doc.data().amountIQD || 0), 0);
        setTotalEarnings(total);
      },
      error: (err) => handleFirestoreError(err, OperationType.LIST, 'transactions')
    });

    return () => {
      unsubEarnings();
    };
  }, [profile?.uid]);

  const referralLink = `${window.location.origin}?ref=${profile?.referralCode}`;

  const copyRefCode = () => {
    navigator.clipboard.writeText(profile?.referralCode || '');
    setCopiedCode(true);
    toast.success("Referral code copied!");
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyRefLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopiedLink(true);
    toast.success("Referral link copied!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const referralStats = [
    { label: "Direct Referrals", value: directRefCount.toString(), icon: Users, color: "text-blue-400" },
    { label: "Tier 2 Referrals", value: tier2RefCount.toString(), icon: Share2, color: "text-purple-400" },
    { label: "Total Earnings", value: `${totalEarnings.toLocaleString()} IQD`, icon: Gift, color: "text-amber-400" },
    { label: "Reward Status", value: directRefCount >= 5 ? "Elite" : "Standard", icon: Award, color: "text-emerald-400" },
  ];

  return (
    <div className="space-y-10 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="max-w-2xl">
         <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tight leading-tight uppercase">
           Growth <span className="text-emerald-600">Network</span>
         </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-4 text-lg leading-relaxed font-medium">
            Our high-performance community network rewards collective growth. Earn <span className="text-emerald-600 font-bold">0.5% commission on every investment</span> made by your direct referrals.
          </p>

         <div className="mt-6">
           <button 
             onClick={() => setShowDetails(!showDetails)}
             className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700 transition-colors"
           >
             <Info className="w-4 h-4" />
             {showDetails ? 'Hide Protocol Details' : 'View Commission Rules'}
             {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
           </button>
           
           <motion.div
             initial={false}
             animate={{ height: showDetails ? 'auto' : 0, opacity: showDetails ? 1 : 0 }}
             transition={{ duration: 0.3, ease: "easeInOut" }}
             className="overflow-hidden"
           >
             <div className="mt-4 p-6 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-500/20 space-y-4">
               <div>
                  <h4 className="text-[10px] font-black uppercase tracking-tighter text-emerald-700 dark:text-emerald-400 mb-2">Referral Commission</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                    Receive a <span className="font-bold text-slate-900 dark:text-slate-100 underline decoration-emerald-500/40">0.5% Commission</span> for every investment package your partner activates.
                  </p>
               </div>
               <div>
                  <h4 className="text-[10px] font-black uppercase tracking-tighter text-emerald-700 dark:text-emerald-400 mb-2">Instant Payouts</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                    Standard commissions apply instantly to your balance upon partner package activation.
                  </p>
               </div>
             </div>
           </motion.div>
         </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {referralStats.map((stat, i) => (
          <Card key={i} className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl group hover:border-emerald-500/40 transition-all duration-300">
             <CardContent className="p-6">
                <div className={`p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 ${stat.color} mb-4 inline-block group-hover:scale-110 transition-transform`}>
                  <stat.icon className="w-5 h-5 opacity-80" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{stat.label}</p>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tighter">{stat.value}</h3>
             </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-6 gap-8">
        <Card className="lg:col-span-3 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm p-10 rounded-[2.5rem] relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
              <Share2 className="w-64 h-64 text-slate-900 dark:text-slate-100" />
           </div>
           
           <div className="relative">
              <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 mb-8 uppercase tracking-tight">Referral Protocol</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {/* Referral Code */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Unique Access Code</h4>
                  <div className="px-8 py-5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 flex items-center justify-between group/code transition-all hover:bg-slate-100 dark:hover:bg-slate-800/80">
                    <span className="font-mono text-2xl font-black text-slate-900 dark:text-slate-100 tracking-[0.25em]">{profile?.referralCode}</span>
                    <button onClick={copyRefCode} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
                        {copiedCode ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Referral Link */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Full Referral Link</h4>
                  <div className="px-6 py-5 rounded-2xl bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/20 flex items-center justify-between group/link transition-all hover:bg-emerald-100 dark:hover:bg-emerald-500/10">
                    <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 truncate mr-4">{referralLink}</span>
                    <button onClick={copyRefLink} className="p-2 text-emerald-500 hover:text-emerald-600 transition-colors shrink-0">
                        {copiedLink ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-10 flex flex-wrap gap-4">
                 <Button className="h-16 px-10 bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white font-bold rounded-2xl shadow-xl hover:scale-[1.02] transition-all uppercase tracking-widest text-xs">
                    Network Invitations
                 </Button>
                 <Button variant="outline" onClick={copyRefLink} className="h-16 px-10 rounded-2xl border-slate-200 dark:border-slate-800 font-bold uppercase tracking-widest text-xs hover:bg-slate-50 dark:hover:bg-slate-900 transition-all">
                    Copy Link
                 </Button>
              </div>
              
              <p className="mt-8 text-[10px] text-slate-400 font-bold uppercase tracking-widest">Global reward protocol v3.2 enabled. Tier 2 unlocked automatically.</p>
           </div>
        </Card>

        <Card className="lg:col-span-3 bg-slate-900 text-white rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden">
           <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-emerald-500/20 rounded-full blur-3xl opacity-50" />
           <CardTitle className="text-sm font-bold text-white flex items-center gap-2 mb-8 uppercase tracking-widest opacity-60">
              <Zap className="w-4 h-4 text-emerald-500" />
              Direct Rewards
           </CardTitle>
           <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-emerald-500/30 transition-colors">
                 <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-2">Alpha Link</p>
                 <p className="text-sm text-slate-300 font-medium">Activate your first direct node and receive a <span className="text-white">5,000 IQD</span> bonus.</p>
              </div>
              <div className="p-5 rounded-2xl bg-white/5 border border-white/10 opacity-30">
                 <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Deca Node</p>
                 <p className="text-sm text-slate-500 font-medium italic">Reach 10 direct network nodes to unlock Priority Yield status.</p>
              </div>
              <Button variant="ghost" className="w-full text-slate-400 hover:text-white hover:bg-white/5 group font-bold text-[10px] uppercase tracking-widest h-12">
                 View Catalogs
                 <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
           </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-[2rem] p-10">
           <h3 className="text-xl font-black text-slate-950 dark:text-slate-100 mb-8 uppercase tracking-tight">How it works</h3>
           <div className="space-y-8">
              <div className="flex gap-5">
                 <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-900 dark:text-slate-100 shadow-inner">1</div>
                 <div>
                    <p className="font-bold text-slate-900 dark:text-slate-100 uppercase text-xs tracking-widest mb-1">Share Access</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium italic">Distribute your unique protocol code to authorized partners.</p>
                 </div>
              </div>
              <div className="flex gap-5">
                 <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-900 dark:text-slate-100 shadow-inner">2</div>
                 <div>
                    <p className="font-bold text-slate-900 dark:text-slate-100 uppercase text-xs tracking-widest mb-1">Activation</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium italic">When they activate any yield engine, you receive instant credit.</p>
                 </div>
              </div>
              <div className="flex gap-5">
                 <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-900 dark:text-slate-100 shadow-inner">3</div>
                 <div>
                    <p className="font-bold text-slate-900 dark:text-slate-100 uppercase text-xs tracking-widest mb-1">Multi-Tier</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium italic">Earnings stack across your primary and secondary network nodes.</p>
                 </div>
              </div>
           </div>
        </Card>

        <Card className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 rounded-[2rem] p-10 flex flex-col justify-center items-center text-center group border-dashed">
           <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-sm border border-slate-100 dark:border-slate-800 group-hover:scale-110 transition-transform">
             <Award className="w-10 h-10 text-indigo-600" />
           </div>
           <h3 className="text-xl font-black text-slate-950 dark:text-slate-100 mb-3 uppercase tracking-tight">Ambassador Program</h3>
           <p className="text-slate-500 dark:text-slate-400 text-sm font-medium italic max-w-xs mb-8">
             Manage over 100M IQD in total network volume to unlock regional bonuses and direct support.
           </p>
           <Button variant="outline" className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 rounded-xl px-8 h-12 font-bold text-xs uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-slate-800 shadow-sm">Learn More</Button>
        </Card>
      </div>

      {/* Network Topology Visualization */}
      <section className="space-y-6">
        <style dangerouslySetInnerHTML={{__html: `
          .org-tree ul {
            padding-top: 20px; position: relative;
            display: flex; justify-content: center;
            transition: all 0.5s;
          }
          .org-tree li {
            float: left; text-align: center;
            list-style-type: none;
            position: relative;
            padding: 20px 10px 0 10px;
            transition: all 0.5s;
          }
          .org-tree li::before, .org-tree li::after{
            content: '';
            position: absolute; top: 0; right: 50%;
            border-top: 2px solid #e2e8f0;
            width: 50%; height: 20px;
          }
          .org-tree li::after{
            right: auto; left: 50%;
            border-left: 2px solid #e2e8f0;
          }
          .dark .org-tree li::before, .dark .org-tree li::after {
            border-color: #334155;
          }
          .dark .org-tree li::after {
            border-color: #334155;
          }
          .org-tree li:only-child::after, .org-tree li:only-child::before {
            display: none;
          }
          .org-tree li:only-child{ padding-top: 0; }
          .org-tree li:first-child::before, .org-tree li:last-child::after{
            border: 0 none;
          }
          .org-tree li:last-child::before{
            border-right: 2px solid #e2e8f0;
            border-radius: 0 12px 0 0;
          }
          .dark .org-tree li:last-child::before { border-color: #334155; }
          .org-tree li:first-child::after{
            border-radius: 12px 0 0 0;
          }
          .org-tree ul::before{
            content: '';
            position: absolute; top: 0; left: 50%;
            border-left: 2px solid #e2e8f0;
            width: 0; height: 20px;
            transform: translateX(-50%);
          }
          .dark .org-tree ul::before { border-color: #334155; }
          .org-tree > ul > li > ul::before {
            display: block;
          }
          .org-tree > ul::before {
            display: none;
          }
        `}} />

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Network <span className="text-emerald-600">Topology</span></h2>
            <p className="text-xs text-slate-500 font-bold tracking-widest uppercase mt-1">Hierarchical visualization of your network nodes</p>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => window.location.reload()} 
            className="text-[10px] uppercase font-black tracking-widest text-slate-400 hover:text-emerald-600"
          >
            <RefreshCcw className="w-4 h-4 mr-2" />
            Sync Ledger
          </Button>
        </div>

        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-[2.5rem] p-10 relative overflow-hidden">
          {loadingTree ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-4">
               <motion.div
                 animate={{ rotate: 360 }}
                 transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                 className="w-12 h-12 rounded-2xl border-4 border-emerald-500 border-t-transparent"
               />
               <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 animate-pulse">Scanning Global Nodes...</p>
            </div>
          ) : referralTree.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-6">
               <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center border border-slate-100 dark:border-slate-800">
                  <Users className="w-8 h-8 text-slate-300" />
               </div>
               <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">No Network Nodes Detected</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium italic mt-2">Your network is currently isolated. Share your protocol code to begin expansion.</p>
               </div>
               <Button onClick={copyRefLink} className="h-12 px-8 bg-slate-950 dark:bg-emerald-600 hover:bg-slate-900 dark:hover:bg-emerald-500 text-white font-bold rounded-xl uppercase tracking-widest text-[10px] transition-all active:scale-95">
                  Distribute Access Code
               </Button>
            </div>
          ) : (
            <div className="org-tree overflow-x-auto pb-10 w-full cursor-grab active:cursor-grabbing flex justify-center">
               <ul className="min-w-max">
                  <OrgTreeNode 
                    node={{
                      uid: profile?.uid,
                      displayName: profile?.displayName || 'Me',
                      email: profile?.email || '',
                      isActive: true,
                      tier2: referralTree
                    }} 
                    isRoot={true} 
                  />
               </ul>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
