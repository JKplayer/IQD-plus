import { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { db, handleFirestoreError } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { OperationType } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  History as HistoryIcon, 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock, 
  CheckCircle2, 
  XCircle,
  FileText,
  Filter,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { Transaction, Investment, DepositRequest, WithdrawalRequest } from '../types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function HistoryPage() {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtering state
  const [showFilters, setShowFilters] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    if (!profile) return;

    const qTrans = query(
      collection(db, 'transactions'),
      where('userId', '==', profile.uid)
    );
    const qInvest = query(
      collection(db, 'investments'),
      where('userId', '==', profile.uid)
    );

    const unsubTrans = onSnapshot(qTrans, {
      next: (snap) => {
        setTransactions(
          snap.docs
            .map(d => ({ id: d.id, ...d.data() } as Transaction))
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        );
      },
      error: (err) => handleFirestoreError(err, OperationType.LIST, 'transactions')
    });

    const unsubInvest = onSnapshot(qInvest, {
      next: (snap) => {
        setInvestments(
          snap.docs
            .map(d => ({ id: d.id, ...d.data() } as Investment))
            .sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime())
        );
      },
      error: (err) => handleFirestoreError(err, OperationType.LIST, 'investments')
    });

    const qDep = query(collection(db, 'deposits'), where('userId', '==', profile.uid));
    const qWith = query(collection(db, 'withdrawals'), where('userId', '==', profile.uid));

    const unsubDep = onSnapshot(qDep, {
      next: (snap) => {
        setDeposits(snap.docs.map(d => ({ id: d.id, ...d.data() } as DepositRequest))
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      },
      error: (err) => handleFirestoreError(err, OperationType.LIST, 'deposits')
    });

    const unsubWith = onSnapshot(qWith, {
      next: (snap) => {
        setWithdrawals(snap.docs.map(d => ({ id: d.id, ...d.data() } as WithdrawalRequest))
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        setLoading(false);
      },
      error: (err) => {
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, 'withdrawals');
      }
    });

    return () => {
      unsubTrans();
      unsubInvest();
      unsubDep();
      unsubWith();
    };
  }, [profile]);

  const filteredTransactions = transactions.filter(tx => {
    const matchesType = filterType === 'all' || tx.type === filterType;
    const txDate = new Date(tx.timestamp);
    const matchesStart = !startDate || txDate >= new Date(startDate);
    const matchesEnd = !endDate || txDate <= new Date(endDate + 'T23:59:59');
    return matchesType && matchesStart && matchesEnd;
  });

  if (loading) return null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight uppercase">
             Activity Logs
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium italic">Verification of your financial footprint and investment maturity.</p>
        </div>
        <div className="flex gap-2">
           <Button 
             variant="outline" 
             onClick={() => setShowFilters(!showFilters)}
             className={`border-slate-200 dark:border-slate-800 rounded-xl px-6 font-bold text-xs uppercase tracking-widest shadow-sm transition-all ${showFilters ? 'bg-slate-900 text-white dark:bg-emerald-600' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
           >
             <Filter className="w-4 h-4 mr-2" />
             {showFilters ? 'Hide Filters' : 'Sort & Filter'}
           </Button>
           <Button variant="outline" className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 rounded-xl px-6 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-all">
             <FileText className="w-4 h-4 mr-2" />
             Statement
           </Button>
        </div>
      </header>

      {showFilters && (
        <Card className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 rounded-2xl animate-in slide-in-from-top-2 duration-300">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-1">Legacy Type</label>
                <select 
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full h-11 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                >
                  <option value="all">All Operations</option>
                  <option value="deposit">Deposits</option>
                  <option value="withdrawal">Withdrawals</option>
                  <option value="payout">Yield Payouts</option>
                  <option value="investment">Vault Activations</option>
                  <option value="referral">Network Rewards</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-1">Start Horizon</label>
                <input 
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full h-11 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-1">End Horizon</label>
                <input 
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full h-11 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                />
              </div>
            </div>
            {(filterType !== 'all' || startDate || endDate) && (
              <div className="mt-6 flex justify-end">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setFilterType('all');
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20 text-[10px] font-black uppercase tracking-widest"
                >
                  Clear All Vectors
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="transactions" className="w-full">
        <TabsList className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 h-12 rounded-2xl mb-8">
          <TabsTrigger value="transactions" className="rounded-xl px-8 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-slate-950 dark:data-[state=active]:text-slate-100 data-[state=active]:shadow-sm font-bold text-xs uppercase tracking-widest transition-all">Operations</TabsTrigger>
          <TabsTrigger value="investments" className="rounded-xl px-8 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-slate-950 dark:data-[state=active]:text-slate-100 data-[state=active]:shadow-sm font-bold text-xs uppercase tracking-widest transition-all">Vault Engines</TabsTrigger>
          <TabsTrigger value="requests" className="rounded-xl px-8 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-slate-950 dark:data-[state=active]:text-slate-100 data-[state=active]:shadow-sm font-bold text-xs uppercase tracking-widest transition-all">Pending Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-[2rem] overflow-hidden">
              <CardHeader className="p-10 pb-0">
                 <CardTitle className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Deposit Audit Trail</CardTitle>
                 <CardDescription className="text-slate-500 dark:text-slate-400 font-medium italic">Status of your manual capital injections.</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {deposits.length === 0 ? (
                    <p className="text-sm text-slate-400 italic text-center py-12">No deposit requests documented.</p>
                  ) : (
                    deposits.map((dep) => (
                      <div key={dep.id} className="p-6 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge className={`uppercase font-black text-[9px] tracking-widest px-3 py-1 rounded-full border-none ${
                              dep.status === 'confirmed' ? 'bg-emerald-500 text-white' : dep.status === 'pending' ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white'
                            }`}>
                              {dep.status === 'pending' ? 'Sent to Admin' : dep.status}
                            </Badge>
                            <span className="text-[10px] font-black text-slate-400 uppercase">#{dep.id.slice(0, 8)}</span>
                          </div>
                          <p className="text-sm font-black text-slate-900 dark:text-slate-100 tracking-tighter">{dep.amountIQD.toLocaleString()} IQD</p>
                        </div>
                        
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          <span>{dep.method}</span>
                          <span>{new Date(dep.timestamp).toLocaleDateString()}</span>
                        </div>

                        {dep.status !== 'pending' && (
                          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="text-[9px] font-black uppercase text-slate-400">Processed At</p>
                              <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 italic">{dep.processedAt ? new Date(dep.processedAt).toLocaleString() : 'N/A'}</p>
                            </div>
                            {dep.adminNotes && (
                              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 italic text-[10px] text-slate-500 leading-relaxed shadow-inner">
                                "{dep.adminNotes}"
                              </div>
                            )}
                          </div>
                        )}

                        <Dialog>
                          <DialogTrigger render={
                            <Button variant="ghost" size="sm" className="w-full h-10 text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-xl">
                              View Original Proof
                            </Button>
                          } />
                          <DialogContent className="max-w-2xl bg-white dark:bg-slate-900 rounded-[2rem] border-slate-200 dark:border-slate-800">
                            <DialogHeader>
                              <DialogTitle className="text-xl font-black uppercase tracking-tight">Audit Evidence</DialogTitle>
                            </DialogHeader>
                            <div className="rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 shadow-2xl bg-slate-50 dark:bg-slate-950 flex items-center justify-center min-h-[300px]">
                              {dep.proofUrl.startsWith('http') ? (
                                <img src={dep.proofUrl} alt="Deposit Proof" className="w-full h-auto max-h-[70vh] object-contain" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="p-12 text-center space-y-4">
                                  <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                                    <FileText className="w-8 h-8" />
                                  </div>
                                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-slate-100">Manual Evidence Reference</h3>
                                  <p className="text-xs text-slate-500 font-mono italic max-w-md break-all border border-slate-200 dark:border-slate-800 p-4 rounded-xl">
                                    {dep.proofUrl}
                                  </p>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                                    This transaction was processed without a direct receipt image due to storage initialization status.
                                  </p>
                                </div>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-[2rem] overflow-hidden">
              <CardHeader className="p-10 pb-0">
                 <CardTitle className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Withdrawal Offramp Logs</CardTitle>
                 <CardDescription className="text-slate-500 dark:text-slate-400 font-medium italic">History of your capital extraction requests.</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                 <div className="space-y-4">
                  {withdrawals.length === 0 ? (
                    <p className="text-sm text-slate-400 italic text-center py-12">No withdrawal requests charted.</p>
                  ) : (
                    withdrawals.map((withd) => (
                      <div key={withd.id} className="p-6 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge className={`uppercase font-black text-[9px] tracking-widest px-3 py-1 rounded-full border-none ${
                              withd.status === 'completed' ? 'bg-emerald-500 text-white' : withd.status === 'pending' ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white'
                            }`}>
                              {withd.status}
                            </Badge>
                            <span className="text-[10px] font-black text-slate-400 uppercase">#{withd.id.slice(0, 8)}</span>
                          </div>
                          <p className="text-sm font-black text-slate-900 dark:text-slate-100 tracking-tighter">-{withd.amountIQD.toLocaleString()} IQD</p>
                        </div>
                        
                        <div className="flex flex-col gap-2">
                           <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                             <span>{withd.method}</span>
                             <span>{new Date(withd.timestamp).toLocaleDateString()}</span>
                           </div>
                           <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 font-mono text-[9px] text-slate-500 break-all select-all">
                              {withd.accountDetails}
                           </div>
                        </div>

                        {withd.status !== 'pending' && (
                          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="text-[9px] font-black uppercase text-slate-400">Processed At</p>
                              <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 italic">{withd.processedAt ? new Date(withd.processedAt).toLocaleString() : 'N/A'}</p>
                            </div>
                            {withd.adminNotes && (
                              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 italic text-[10px] text-slate-500 leading-relaxed shadow-inner">
                                "{withd.adminNotes}"
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="transactions">
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-[2rem] overflow-hidden">
            <CardHeader className="p-10 pb-0">
               <CardTitle className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Ledger Operations</CardTitle>
               <CardDescription className="text-slate-500 dark:text-slate-400 font-medium italic">Immutable record of all financial movements.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="text-slate-400 font-black uppercase text-[10px] tracking-widest pl-10 py-6">Operation</TableHead>
                    <TableHead className="text-slate-400 font-black uppercase text-[10px] tracking-widest py-6">Value (IQD)</TableHead>
                    <TableHead className="text-slate-400 font-black uppercase text-[10px] tracking-widest py-6">Timeline</TableHead>
                    <TableHead className="text-slate-400 font-black uppercase text-[10px] tracking-widest text-right pr-10 py-6">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((tx) => (
                    <TableRow key={tx.id} className="border-slate-50 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 group transition-colors">
                      <TableCell className="pl-10 py-6">
                        <div className="flex items-center gap-5">
                          <div className={`p-3.5 rounded-2xl border transition-all shadow-sm ${
                            tx.type === 'deposit' || tx.type === 'payout' || tx.type === 'referral' 
                              ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                              : 'bg-rose-50 dark:bg-rose-900/30 border-rose-100 dark:border-rose-500/20 text-rose-500 dark:text-rose-400'
                          }`}>
                            {tx.type === 'deposit' || tx.type === 'payout' || tx.type === 'referral' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">{tx.type}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Reference: {tx.id.slice(0, 8)}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`text-base font-black tracking-tighter ${
                          tx.type === 'deposit' || tx.type === 'payout' || tx.type === 'referral' ? 'text-emerald-600' : 'text-slate-900 dark:text-slate-100'
                        }`}>
                          {tx.type === 'deposit' || tx.type === 'payout' || tx.type === 'referral' ? '+' : '-'}
                          {tx.amountIQD.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <p className="text-xs text-slate-900 dark:text-slate-100 font-bold italic">{new Date(tx.timestamp).toLocaleDateString()}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </TableCell>
                      <TableCell className="text-right pr-10">
                        {tx.status === 'completed' ? (
                          <Badge className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-none shadow-none uppercase font-black text-[9px] tracking-widest px-3 py-1 rounded-full">
                            <CheckCircle2 className="w-3 h-3 mr-2" />
                            Executed
                          </Badge>
                        ) : tx.status === 'pending' ? (
                          <Badge className="bg-amber-50 dark:bg-amber-900/30 text-amber-500 dark:text-amber-400 border-none shadow-none uppercase font-black text-[9px] tracking-widest px-3 py-1 rounded-full">
                            <Clock className="w-3 h-3 mr-2" />
                            Pending
                          </Badge>
                        ) : (
                          <Badge className="bg-rose-50 dark:bg-rose-900/30 text-rose-500 dark:text-rose-400 border-none shadow-none uppercase font-black text-[9px] tracking-widest px-3 py-1 rounded-full">
                            <XCircle className="w-3 h-3 mr-2" />
                            Failed
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredTransactions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="h-48 text-center p-10">
                        <div className="flex flex-col items-center gap-3">
                           <FileText className="w-10 h-10 text-slate-100" />
                           <p className="text-slate-400 font-medium italic">No ledger activity captured yet.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="investments">
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-[2rem] overflow-hidden">
             <CardHeader className="p-10 pb-0">
               <CardTitle className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Yield Architecture</CardTitle>
               <CardDescription className="text-slate-500 dark:text-slate-400 font-medium italic">Active capital engines currently deploying yield protocols.</CardDescription>
             </CardHeader>
             <CardContent className="p-0">
               <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="text-slate-400 font-black uppercase text-[10px] tracking-widest pl-10 py-6">Protocol Engine</TableHead>
                    <TableHead className="text-slate-400 font-black uppercase text-[10px] tracking-widest py-6">Capital Intake</TableHead>
                    <TableHead className="text-slate-400 font-black uppercase text-[10px] tracking-widest py-6">Maturity Date</TableHead>
                    <TableHead className="text-slate-400 font-black uppercase text-[10px] tracking-widest text-right pr-10 py-6">Management</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {investments.map((inv) => (
                    <TableRow key={inv.id} className="border-slate-50 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 group transition-colors">
                       <TableCell className="pl-10 py-8">
                         <div className="flex items-center gap-5">
                           <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform shadow-sm">
                             <TrendingUp className="w-6 h-6" />
                           </div>
                           <div>
                             <p className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Active Growth Logic v1</p>
                             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Engine ID: {inv.id.slice(0, 8)}</p>
                           </div>
                         </div>
                       </TableCell>
                       <TableCell>
                         <div className="space-y-1">
                           <p className="text-base font-black text-slate-900 dark:text-slate-100 tracking-tighter">{inv.amountIQD.toLocaleString()} IQD</p>
                           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Reinvest: <span className={inv.autoReinvest ? 'text-emerald-600' : 'text-slate-400'}>{inv.autoReinvest ? 'ACTIVE' : 'LOCKED'}</span></p>
                         </div>
                       </TableCell>
                       <TableCell>
                         <div className="space-y-1">
                           <p className="text-sm font-bold text-slate-900 dark:text-slate-100 italic">{new Date(inv.nextPayoutDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</p>
                           <div className="flex items-center gap-2">
                             <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                             <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">2% Standard Yield</span>
                           </div>
                         </div>
                       </TableCell>
                       <TableCell className="text-right pr-10">
                         <Button variant="outline" size="sm" className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 rounded-xl h-10 px-6 font-black text-[10px] uppercase tracking-widest shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Configure</Button>
                       </TableCell>
                    </TableRow>
                  ))}
                  {investments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="h-64 text-center p-10">
                        <div className="flex flex-col items-center gap-3">
                           <Zap className="w-10 h-10 text-slate-100" />
                           <p className="text-slate-400 font-medium italic">No active yield engines detected.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
               </Table>
             </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
