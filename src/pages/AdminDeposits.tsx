import React, { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, increment, addDoc, getDocs, where, writeBatch, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ShieldCheck, 
  Coins, 
  Check, 
  X, 
  Eye, 
  Calendar, 
  Clock, 
  ExternalLink,
  Loader2,
  AlertTriangle,
  ArrowRight,
  Smartphone,
  ChevronLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { DepositRequest, OperationType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export default function AdminDeposits() {
  const navigate = useNavigate();
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [selectedDeposit, setSelectedDeposit] = useState<DepositRequest | null>(null);
  const [processing, setProcessing] = useState(false);
  const [verificationNotes, setVerificationNotes] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'deposits'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, {
      next: (snap) => {
        setDeposits(snap.docs.map(d => ({ id: d.id, ...d.data() } as DepositRequest)));
      },
      error: (err) => handleFirestoreError(err, OperationType.LIST, 'deposits')
    });
    return () => unsubscribe();
  }, []);

  const handleApprove = async (deposit: DepositRequest) => {
    setProcessing(true);
    try {
      const batch = writeBatch(db);

      // 1. Credit User Balance
      batch.update(doc(db, 'users', deposit.userId), {
        balance: increment(deposit.amountIQD)
      });

      // 2. Create Transaction Log
      batch.set(doc(collection(db, 'transactions')), {
        userId: deposit.userId,
        type: 'deposit',
        amountIQD: deposit.amountIQD,
        description: `Deposit via ${deposit.method} - Approved${verificationNotes ? ` (${verificationNotes})` : ''}`,
        timestamp: new Date().toISOString(),
        status: 'completed'
      });

      // 3. Mark Deposit as Confirmed
      batch.update(doc(db, 'deposits', deposit.id), {
        status: 'confirmed',
        adminNotes: verificationNotes,
        processedBy: auth.currentUser?.email || 'Admin',
        processedAt: new Date().toISOString()
      });

      // 4. Resolve Alert (if exists)
      const qAlerts = query(
        collection(db, 'admin_alerts'),
        where('targetId', '==', deposit.userId),
        where('status', '==', 'new'),
        limit(1)
      );
      const alertSnap = await getDocs(qAlerts);
      alertSnap.forEach(alertDoc => {
        batch.update(doc(db, 'admin_alerts', alertDoc.id), { status: 'resolved' });
      });

      // 5. Create Notification
      batch.set(doc(collection(db, 'notifications')), {
        userId: deposit.userId,
        title: 'Deposit Confirmed',
        message: `Your deposit of ${deposit.amountIQD.toLocaleString()} IQD has been verified.`,
        type: 'deposit',
        read: false,
        timestamp: new Date().toISOString()
      });

      // 6. Resolve Tasks
      const tasksQ = query(
        collection(db, 'admin_tasks'), 
        where('category', '==', 'deposit'),
        where('relatedId', '==', deposit.userId),
        where('status', '!=', 'completed')
      );
      const taskSnap = await getDocs(tasksQ);
      taskSnap.docs.forEach(taskDoc => {
        batch.update(doc(db, 'admin_tasks', taskDoc.id), { 
          status: 'completed',
          updatedAt: new Date().toISOString()
        });
      });

      await batch.commit();
      toast.success("Deposit approved successfully!");
      setSelectedDeposit(null);
      setVerificationNotes('');
    } catch (error) {
      console.error(error);
      toast.error("Failed to approve deposit");
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (depositId: string, depositUserId: string) => {
    if (!verificationNotes) {
      toast.error("Please provide a reason for rejection in the notes.");
      return;
    }
    setProcessing(true);
    try {
      const batch = writeBatch(db);

      batch.update(doc(db, 'deposits', depositId), {
        status: 'rejected',
        adminNotes: verificationNotes,
        processedBy: auth.currentUser?.email || 'Admin',
        processedAt: new Date().toISOString()
      });

      // Resolve Alert
      const qAlerts = query(
        collection(db, 'admin_alerts'),
        where('targetId', '==', depositUserId),
        where('status', '==', 'new'),
        limit(1)
      );
      const alertSnap = await getDocs(qAlerts);
      alertSnap.forEach(alertDoc => {
        batch.update(doc(db, 'admin_alerts', alertDoc.id), { status: 'resolved' });
      });

      await batch.commit();
      toast.success("Deposit rejected");
      setSelectedDeposit(null);
      setVerificationNotes('');
    } catch (error) {
      console.error(error);
      toast.error("Failed to reject deposit");
    } finally {
      setProcessing(false);
    }
  };

  const pendingDeposits = deposits.filter(d => d.status === 'pending');

  return (
    <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700 kurdish-gradient min-h-screen -mx-4 lg:-mx-10 -mt-10 p-4 lg:p-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <Button 
            onClick={() => navigate('/admin')}
            variant="ghost" 
            className="mb-4 -ml-2 text-slate-400 hover:text-emerald-600 font-bold text-[10px] uppercase tracking-widest"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Back to Dashboard
          </Button>
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-amber-500/20 kurdish-grid">
               <ShieldCheck className="w-6 h-6" />
             </div>
             <div>
                <h1 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-4 leading-none">
                  Deposit <span className="text-emerald-600 italic">Audit Queue</span>
                </h1>
                <p className="text-slate-500 dark:text-slate-400 font-medium italic mt-1 uppercase tracking-widest text-[10px]">
                  {pendingDeposits.length} manual extraction proofs awaiting node verification.
                </p>
             </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl rounded-[2.5rem] overflow-hidden kurdish-grid">
          <CardHeader className="p-8 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500">Pending Requests</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-100/50 dark:bg-slate-800/50">
                <TableRow>
                  <TableHead className="pl-10 py-5 text-[10px] font-black uppercase tracking-widest">Investor</TableHead>
                  <TableHead className="py-5 text-[10px] font-black uppercase tracking-widest">Assets</TableHead>
                  <TableHead className="py-5 text-[10px] font-black uppercase tracking-widest text-right pr-10">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingDeposits.map((d) => (
                  <TableRow 
                    key={d.id} 
                    className={`hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 cursor-pointer transition-colors ${selectedDeposit?.id === d.id ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}
                    onClick={() => {
                      setSelectedDeposit(d);
                      setVerificationNotes('');
                    }}
                  >
                    <TableCell className="pl-10 py-6">
                      <p className="font-black text-xs uppercase tracking-tight text-slate-900 dark:text-slate-100">{d.userName}</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none mt-1">{d.userEmail}</p>
                    </TableCell>
                    <TableCell>
                      <p className="font-mono text-base font-black text-emerald-600 tracking-tighter">{d.amountIQD.toLocaleString()} IQD</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 italic">{new Date(d.timestamp).toLocaleDateString()}</p>
                    </TableCell>
                    <TableCell className="text-right pr-10">
                      <Button variant="ghost" size="sm" className="text-emerald-600 font-black text-[10px] uppercase tracking-widest">
                        View Proof <Eye className="w-4 h-4 ml-2" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {pendingDeposits.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="h-48 text-center text-slate-400 font-medium italic uppercase tracking-widest text-[10px]">
                      Queue Clear. All assets verified.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-8">
          <AnimatePresence mode="wait">
            {selectedDeposit ? (
              <motion.div
                key={selectedDeposit.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <Card className="bg-white dark:bg-slate-900 border-emerald-500/30 shadow-2xl rounded-[2.5rem] overflow-hidden">
                  <CardHeader className="p-8 pb-4 bg-emerald-600 text-white relative">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                       <ShieldCheck className="w-20 h-20 rotate-12" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80 mb-2">Audit Target</p>
                    <h3 className="text-xl font-black italic">{selectedDeposit.userName}</h3>
                  </CardHeader>
                  <CardContent className="p-8 space-y-8">
                    {/* Proof Image */}
                    <div className="space-y-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Transaction Evidence</p>
                      {selectedDeposit.proofUrl.startsWith('http') ? (
                        <div className="relative group rounded-3xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-800">
                          <img 
                            src={selectedDeposit.proofUrl} 
                            alt="Proof" 
                            className="w-full h-auto max-h-[300px] object-cover transition-transform group-hover:scale-105"
                            referrerPolicy="no-referrer"
                          />
                          <a 
                            href={selectedDeposit.proofUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]"
                          >
                            <ExternalLink className="text-white w-8 h-8" />
                          </a>
                        </div>
                      ) : (
                        <div className="h-40 rounded-3xl bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center p-6 text-center">
                          <AlertTriangle className="w-8 h-8 text-amber-500 mb-2" />
                          <p className="text-[10px] font-black uppercase text-slate-500 leading-tight">Proof Link Broken or Manual Transaction ID Provided</p>
                          <p className="text-[9px] font-mono text-slate-400 mt-2 break-all opacity-60">{selectedDeposit.proofUrl}</p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Value</p>
                        <p className="font-mono font-black text-emerald-600 tracking-tighter">{selectedDeposit.amountIQD.toLocaleString()} IQD</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Method</p>
                        <Badge variant="outline" className="bg-white dark:bg-slate-950 font-black text-[9px] uppercase px-2 py-0 border-emerald-500/30 text-emerald-600">{selectedDeposit.method}</Badge>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Audit Notes / Rejection Reason</label>
                      <textarea 
                        value={verificationNotes}
                        onChange={(e) => setVerificationNotes(e.target.value)}
                        placeholder="Add verification notes here..."
                        className="w-full h-24 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-medium focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none shadow-inner"
                      />
                    </div>

                    <div className="flex gap-3">
                      <Button 
                        onClick={() => handleReject(selectedDeposit.id, selectedDeposit.userId)}
                        disabled={processing}
                        variant="outline" 
                        className="flex-1 h-14 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white hover:bg-rose-50 dark:hover:bg-rose-950/30 font-black rounded-2xl uppercase tracking-widest text-[10px] italic transition-all"
                      >
                        Reject
                      </Button>
                      <Button 
                        onClick={() => handleApprove(selectedDeposit)}
                        disabled={processing}
                        className="flex-[2] h-14 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl uppercase tracking-widest text-[10px] italic shadow-xl shadow-emerald-500/30"
                      >
                        {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Approve Assets"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="h-[500px] rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center p-12 text-center text-slate-400 bg-white/50 dark:bg-slate-900/50"
              >
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-6">
                  <ShieldCheck className="w-8 h-8 opacity-50" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest mb-2">Awaiting Selection</h3>
                <p className="text-xs font-medium italic leading-relaxed">Select a pending request from the queue to initiate visual audit and capital verification.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
