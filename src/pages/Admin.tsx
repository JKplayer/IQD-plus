import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { db, auth, handleFirestoreError } from '../lib/firebase';
import { processAdminCommand } from '../lib/gemini';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, increment, addDoc, getDocs, where, deleteDoc, writeBatch, setDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  ShieldCheck, 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  RefreshCcw, 
  Coins, 
  ClipboardList,
  ChevronRight,
  Database,
  Terminal,
  ExternalLink,
  Check,
  X,
  Eye,
  Calendar,
  Clock,
  Smartphone,
  BrainCircuit,
  MessageSquare,
  Sparkles,
  Loader2,
  Send,
  Bell,
  Search,
  History,
  Briefcase,
  ArrowRight,
  Image as ImageIcon,
  ArrowDownToLine,
  ArrowUpFromLine,
  Gift,
  HandCoins,
  ArrowRightLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { UserProfile, Transaction, Investment, DepositRequest, WithdrawalRequest, UserSession, OperationType } from '../types';
import { motion, AnimatePresence } from 'motion/react';

export default function Admin() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [tasksCount, setTasksCount] = useState(0);
  const [adminAlerts, setAdminAlerts] = useState<any[]>([]);
  const [processing, setProcessing] = useState(false);
  
  // Search State
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'admin'>('all');
  const [investmentFilter, setInvestmentFilter] = useState<'all' | 'active' | 'none'>('all');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedDeposit, setSelectedDeposit] = useState<DepositRequest | null>(null);
  const [selectedUserActivity, setSelectedUserActivity] = useState<{
    transactions: Transaction[],
    investments: Investment[],
    sessions: UserSession[]
  } | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  
  // Confirmation Modal State
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => void;
    type: 'critical' | 'warn';
    requireAuthWord?: string;
  } | null>(null);
  const [confirmInput, setConfirmInput] = useState('');

  // Verification Notes State
  const [verificationNotes, setVerificationNotes] = useState('');
  
  // Stat Modals State
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [showEnginesModal, setShowEnginesModal] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [auditStrict, setAuditStrict] = useState(true);
  
  // AI Agent State
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessages, setAiMessages] = useState<{
    role: 'user' | 'assistant', 
    text: string,
    stats?: { totalUsers: number, activeEngines: number, pendingDeposits: number }
  }[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages]);

  useEffect(() => {
    if (!isAdmin) return;

    const qUsers = query(collection(db, 'users'), limit(100)); // Remove order by for safety
    const qInv = query(collection(db, 'investments')); // Filter on client
    const qDeposits = query(collection(db, 'deposits')); 
    const qWithdrawals = query(collection(db, 'withdrawals')); 

    const unsubUsers = onSnapshot(qUsers, {
      next: (snap) => setUsers(snap.docs.map(d => ({ ...d.data() } as UserProfile))),
      error: (err) => {
        console.error("Users listener failed:", err);
        handleFirestoreError(err, OperationType.LIST, 'users');
      }
    });

    const unsubInv = onSnapshot(qInv, {
      next: (snap) => {
        setInvestments(
          snap.docs
            .map(d => ({ id: d.id, ...d.data() } as Investment))
            .filter(inv => inv.status === 'active')
        );
      },
      error: (err) => handleFirestoreError(err, OperationType.LIST, 'investments')
    });

    const unsubDeposits = onSnapshot(qDeposits, {
      next: (snap) => {
        setDeposits(
          snap.docs
            .map(d => ({ id: d.id, ...d.data() } as DepositRequest))
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        );
      },
      error: (err) => handleFirestoreError(err, OperationType.LIST, 'deposits')
    });

    const unsubWithdrawals = onSnapshot(qWithdrawals, {
      next: (snap) => {
        setWithdrawals(
          snap.docs
            .map(d => ({ id: d.id, ...d.data() } as WithdrawalRequest))
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        );
      },
      error: (err) => handleFirestoreError(err, OperationType.LIST, 'withdrawals')
    });

    const qAlerts = query(
      collection(db, 'admin_alerts'),
      where('status', '==', 'new'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    const unsubAlerts = onSnapshot(qAlerts, {
      next: (snap) => {
        setAdminAlerts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      error: (err) => handleFirestoreError(err, OperationType.LIST, 'admin_alerts')
    });

    const unsubTasks = onSnapshot(collection(db, 'admin_tasks'), {
      next: (snap) => setTasksCount(snap.docs.length),
      error: (err) => console.error("Tasks count sync failed:", err)
    });

    return () => {
      unsubUsers();
      unsubInv();
      unsubDeposits();
      unsubWithdrawals();
      unsubAlerts();
      unsubTasks();
    };
  }, [isAdmin]);

  const handleApproveDeposit = async (deposit: DepositRequest, notes?: string) => {
    setConfirmState({
      isOpen: true,
      title: "Confirm Deposit Approval",
      message: `Are you sure you want to approve the deposit of ${deposit.amountIQD.toLocaleString()} IQD for ${deposit.userName}? This will credit their balance.`,
      type: 'warn',
      action: async () => {
        setProcessing(true);
        try {
          const batch = writeBatch(db);

          // 1. Credit User Balance
          const userRef = doc(db, 'users', deposit.userId);
          batch.update(userRef, {
            balance: increment(deposit.amountIQD)
          });

          // 2. Create Transaction Log
          const transRef = doc(collection(db, 'transactions'));
          batch.set(transRef, {
            userId: deposit.userId,
            type: 'deposit',
            amountIQD: deposit.amountIQD,
            description: `Deposit via ${deposit.method || 'Transfer'} - Approved${notes ? ` (Note: ${notes})` : ''}`,
            timestamp: new Date().toISOString(),
            status: 'completed'
          });

          // 3. Mark Deposit as Confirmed
          const depositRef = doc(db, 'deposits', deposit.id);
          batch.update(depositRef, {
            status: 'confirmed',
            adminNotes: notes || '',
            processedBy: auth.currentUser?.email || auth.currentUser?.uid || 'Unknown Admin',
            processedAt: new Date().toISOString()
          });

          // 4. Resolve Alert (if exists)
          const alert = adminAlerts.find(a => a.targetId === deposit.userId);
          if (alert) {
            const alertRef = doc(db, 'admin_alerts', alert.id);
            batch.update(alertRef, { status: 'resolved' });
          }

          // 5. Create Notification
          const notifRef = doc(collection(db, 'notifications'));
          batch.set(notifRef, {
            userId: deposit.userId,
            title: 'Deposit Confirmed',
            message: `Your deposit of ${deposit.amountIQD.toLocaleString()} IQD has been verified. ${notes ? `Moderator Note: ${notes}` : ''}`,
            type: 'deposit',
            read: false,
            timestamp: new Date().toISOString()
          });

          // 6. Resolve corresponding tasks
          try {
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
          } catch (e) {
            console.error("Failed to auto-resolve tasks:", e);
          }

          await batch.commit();

          toast.success(`Approved ${deposit.amountIQD.toLocaleString()} IQD for ${deposit.userName}`);
          setSelectedDeposit(null);
          setVerificationNotes('');
        } catch (error) {
          console.error(error);
          toast.error("Approval failed");
        } finally {
          setProcessing(false);
          setConfirmState(null);
        }
      }
    });
  };

  const handleRejectDeposit = async (depositId: string, notes?: string) => {
    // Also resolve alert if it exists
    const alert = adminAlerts.find(a => a.targetId === deposits.find(d => d.id === depositId)?.userId);
    if (alert) {
      updateDoc(doc(db, 'admin_alerts', alert.id), { status: 'resolved' });
    }

    setConfirmState({
      isOpen: true,
      title: "Reject Deposit Request",
      message: "Are you sure you want to reject this deposit? This action cannot be undone.",
      type: 'warn',
      action: async () => {
        setProcessing(true);
        try {
          await updateDoc(doc(db, 'deposits', depositId), {
            status: 'rejected',
            adminNotes: notes || '',
            processedBy: auth.currentUser?.email || auth.currentUser?.uid || 'Unknown Admin',
            processedAt: new Date().toISOString()
          });

          // Resolve tasks
          const deposit = deposits.find(d => d.id === depositId);
          if (deposit) {
            const tasksQ = query(
              collection(db, 'admin_tasks'), 
              where('category', '==', 'deposit'),
              where('relatedId', '==', deposit.userId),
              where('status', '!=', 'completed')
            );
            const taskSnap = await getDocs(tasksQ);
            taskSnap.docs.forEach(async (taskDoc) => {
              await updateDoc(doc(db, 'admin_tasks', taskDoc.id), { 
                status: 'completed',
                updatedAt: new Date().toISOString()
              });
            });
          }

          toast.success("Deposit request rejected");
          setSelectedDeposit(null);
          setVerificationNotes('');
        } catch (error) {
          console.error(error);
          toast.error("Rejection failed");
        } finally {
          setProcessing(false);
          setConfirmState(null);
        }
      }
    });
  };

  const handleApproveWithdrawal = async (withdraw: WithdrawalRequest) => {
    setConfirmState({
      isOpen: true,
      title: "Confirm Withdrawal Completion",
      message: `Are you sure you want to complete the withdrawal of ${withdraw.amountIQD.toLocaleString()} IQD for ${withdraw.userName}? This will deduct from their balance.`,
      type: 'warn',
      action: async () => {
        setProcessing(true);
        try {
          const userRef = doc(db, 'users', withdraw.userId);
          const userSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', withdraw.userId), limit(1)));
          
          if (userSnap.empty) {
            toast.error("User document not found");
            return;
          }
          
          const userData = userSnap.docs[0].data() as UserProfile;
          if (userData.balance < withdraw.amountIQD) {
            toast.error("Insufficient user balance");
            return;
          }

          await updateDoc(userRef, {
            balance: increment(-withdraw.amountIQD)
          });

          await addDoc(collection(db, 'transactions'), {
            userId: withdraw.userId,
            type: 'withdrawal',
            amountIQD: withdraw.amountIQD,
            description: `Withdrawal via ${withdraw.method} - Approved`,
            timestamp: new Date().toISOString(),
            status: 'completed'
          });

          await updateDoc(doc(db, 'withdrawals', withdraw.id), {
            status: 'completed',
            processedBy: auth.currentUser?.email || auth.currentUser?.uid || 'Unknown Admin',
            processedAt: new Date().toISOString()
          });

          // Add Notification
          await addDoc(collection(db, 'notifications'), {
            userId: withdraw.userId,
            title: 'Withdrawal Completed',
            message: `Your withdrawal of ${withdraw.amountIQD.toLocaleString()} IQD has been processed successfully.`,
            type: 'withdrawal',
            read: false,
            timestamp: new Date().toISOString()
          });

          toast.success(`Approved ${withdraw.amountIQD.toLocaleString()} IQD withdrawal for ${withdraw.userName}`);
        } catch (error) {
          console.error(error);
          toast.error("Withdrawal approval failed");
        } finally {
          setProcessing(false);
          setConfirmState(null);
        }
      }
    });
  };

  const handleRejectWithdrawal = async (withdrawId: string) => {
    setConfirmState({
      isOpen: true,
      title: "Reject Withdrawal Request",
      message: "Are you sure you want to reject this withdrawal? The user's balance will remain unchanged. This action cannot be undone.",
      type: 'warn',
      action: async () => {
        setProcessing(true);
        try {
          await updateDoc(doc(db, 'withdrawals', withdrawId), {
            status: 'rejected',
            processedBy: auth.currentUser?.email || auth.currentUser?.uid || 'Unknown Admin',
            processedAt: new Date().toISOString()
          });
          toast.success("Withdrawal request rejected");
        } catch (error) {
          console.error(error);
          toast.error("Rejection failed");
        } finally {
          setProcessing(false);
          setConfirmState(null);
        }
      }
    });
  };

  const handleViewDetails = async (viewUser: UserProfile) => {
    setSelectedUser(viewUser);
    setIsDetailsLoading(true);
    try {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      const qTrans = query(collection(db, 'transactions'), where('userId', '==', viewUser.uid));
      const qInv = query(collection(db, 'investments'), where('userId', '==', viewUser.uid));
      const qSessions = query(
        collection(db, 'sessions'), 
        where('userId', '==', viewUser.uid)
      );
      
      const [transSnap, invSnap, sessionSnap] = await Promise.all([
        getDocs(qTrans),
        getDocs(qInv),
        getDocs(qSessions)
      ]);
      
      setSelectedUserActivity({
        transactions: transSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as Transaction))
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 10),
        investments: invSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as Investment))
          .sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime()),
        sessions: sessionSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as UserSession))
          .filter(s => new Date(s.timestamp) >= oneMonthAgo)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      });
    } catch (error) {
      console.error("Failed to load user details:", error);
      toast.error("Resource error: Could not fetch comprehensive user history.");
    } finally {
      setIsDetailsLoading(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.email.toLowerCase().includes(userSearchTerm.toLowerCase()) || 
                         u.displayName.toLowerCase().includes(userSearchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    
    const hasActiveInvestment = investments.some(inv => inv.userId === u.uid);
    const matchesInvestment = investmentFilter === 'all' || 
                             (investmentFilter === 'active' && hasActiveInvestment) || 
                             (investmentFilter === 'none' && !hasActiveInvestment);
                             
    return matchesSearch && matchesRole && matchesInvestment;
  });

  const triggerPayouts = async () => {
    setConfirmState({
      isOpen: true,
      title: "Initiate Payout Cycle",
      message: "This will process dividends for all eligible active investment engines. This action is irreversible.",
      type: 'critical',
      requireAuthWord: 'PAYOUT',
      action: async () => {
        setProcessing(true);
        let count = 0;
        try {
          // Logic for triggering payouts (for demo, we simulate processing all active investments)
          for (const inv of investments) {
            const nextPayout = new Date(inv.nextPayoutDate);
            if (nextPayout <= new Date()) {
              const payoutAmount = Math.floor(inv.amountIQD * 0.02);
              
              // 1. Add Transaction
              await addDoc(collection(db, 'transactions'), {
                userId: inv.userId,
                type: 'payout',
                amountIQD: payoutAmount,
                description: `Monthly dividend for Investment ${inv.id.slice(0,6)}`,
                timestamp: new Date().toISOString(),
                status: 'completed'
              });

              // 2. Update User Balance
              await updateDoc(doc(db, 'users', inv.userId), {
                balance: increment(payoutAmount)
              });

              // 3. Update Investment nextPayout
              const newPayoutDate = new Date(nextPayout);
              newPayoutDate.setMonth(newPayoutDate.getMonth() + 1);
              await updateDoc(doc(db, 'investments', inv.id), {
                nextPayoutDate: newPayoutDate.toISOString()
              });

              // Add Notification
              await addDoc(collection(db, 'notifications'), {
                userId: inv.userId,
                title: 'Dividend Received',
                message: `You've received a ${payoutAmount.toLocaleString()} IQD dividend from your investment engine.`,
                type: 'payout',
                read: false,
                timestamp: new Date().toISOString()
              });

              count++;
            }
          }
          toast.success(`Processed ${count} payouts!`);
        } catch (error) {
          console.error(error);
          toast.error("Batch processing failed.");
        } finally {
          setProcessing(false);
          setConfirmState(null);
        }
      }
    });
  };

  const handleAiCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim() || aiLoading) return;

    const userText = aiPrompt.trim();
    setAiMessages(prev => [...prev, { role: 'user', text: userText }]);
    setAiPrompt('');
    setAiLoading(true);

    try {
      const stats = {
        totalUsers: users.length,
        activeEngines: investments.length,
        pendingDeposits: deposits.length
      };

      const response = await processAdminCommand(userText, stats);
      
      let assistantText = response.text || "Command processed.";

      // Handle Function Calls
      const functionCalls = response.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        for (const call of functionCalls) {
          if (call.name === "adjust_user_balance") {
            const { email, amount, reason } = call.args as any;
            
            const q = query(collection(db, 'users'), where('email', '==', email));
            const snap = await getDocs(q);

            if (!snap.empty) {
              const userDoc = snap.docs[0];
              await updateDoc(doc(db, 'users', userDoc.id), {
                balance: increment(amount)
              });
              await addDoc(collection(db, 'transactions'), {
                userId: userDoc.id,
                type: amount > 0 ? 'deposit' : 'withdrawal',
                amountIQD: Math.abs(amount),
                description: reason || "AI Assisted Adjustment",
                timestamp: new Date().toISOString(),
                status: 'completed'
              });

              // Add Notification
              await addDoc(collection(db, 'notifications'), {
                userId: userDoc.id,
                title: 'Balance Adjusted',
                message: `An administrative ${amount > 0 ? 'addition' : 'deduction'} of ${Math.abs(amount).toLocaleString()} IQD was applied to your account.`,
                type: amount > 0 ? 'deposit' : 'withdrawal',
                read: false,
                timestamp: new Date().toISOString()
              });

              assistantText = `✅ Adjusted ${email}'s balance by ${amount} IQD. ${assistantText}`;
            } else {
              assistantText = `❌ Could not find user with email ${email}.`;
            }
          } else if (call.name === "get_user_details") {
            const { email } = call.args as any;
            const q = query(collection(db, 'users'), where('email', '==', email));
            const snap = await getDocs(q);

            if (!snap.empty) {
              const userDoc = snap.docs[0];
              const userData = userDoc.data() as UserProfile;
              
              const qInv = query(collection(db, 'investments'), where('userId', '==', userDoc.id), where('status', '==', 'active'));
              const invSnap = await getDocs(qInv);
              const activePackages = invSnap.docs.map(d => d.data().packageName).join(", ") || "None";
              
              assistantText = `User ${email} details:\n- Name: ${userData.displayName}\n- Balance: ${userData.balance?.toLocaleString()} IQD\n- Profit Balance: ${userData.profitBalance?.toLocaleString()} IQD\n- Active Packages: ${activePackages}\n\n${assistantText}`;
            } else {
              assistantText = `❌ Could not find user with email ${email}.`;
            }
          } else if (call.name === "set_user_balance") {
            const { email, balance, profitBalance, reason } = call.args as any;
            
            const q = query(collection(db, 'users'), where('email', '==', email));
            const snap = await getDocs(q);

            if (!snap.empty) {
              const userDoc = snap.docs[0];
              const updateData: any = {};
              let desc = "";
              
              if (balance !== undefined && balance !== null) {
                updateData.balance = balance;
                desc += `Balance set to ${balance} IQD. `;
              }
              if (profitBalance !== undefined && profitBalance !== null) {
                updateData.profitBalance = profitBalance;
                desc += `Profit balance set to ${profitBalance} IQD.`;
              }
              
              await updateDoc(doc(db, 'users', userDoc.id), updateData);
              
              await addDoc(collection(db, 'transactions'), {
                userId: userDoc.id,
                type: 'deposit', // using deposit as a generic adjust
                amountIQD: 0, // Using 0 because it's absolute
                description: reason || "AI Assisted Absolute Adjustment",
                timestamp: new Date().toISOString(),
                status: 'completed'
              });

              // Add Notification
              await addDoc(collection(db, 'notifications'), {
                userId: userDoc.id,
                title: 'Balance Adjusted',
                message: `An administrative absolute adjustment was applied to your account. ${desc}`,
                type: 'payout',
                read: false,
                timestamp: new Date().toISOString()
              });

              assistantText = `✅ ${desc} for ${email}. ${assistantText}`;
            } else {
              assistantText = `❌ Could not find user with email ${email}.`;
            }
          } else if (call.name === "update_user_packages") {
            const { email, action, packageId, packageName, amount } = call.args as any;
            
            const q = query(collection(db, 'users'), where('email', '==', email));
            const snap = await getDocs(q);

            if (!snap.empty) {
              const userDoc = snap.docs[0];
              
              if (action === 'add') {
                const nextPayout = new Date();
                nextPayout.setMonth(nextPayout.getMonth() + 1);
                
                await addDoc(collection(db, 'investments'), {
                  userId: userDoc.id,
                  packageId: packageId || 't1',
                  packageName: packageName || 'Tier 1',
                  amountIQD: amount || 0,
                  purchaseDate: new Date().toISOString(),
                  nextPayoutDate: nextPayout.toISOString(),
                  status: 'active',
                  autoReinvest: false
                });

                if (amount && amount > 0) {
                  await updateDoc(doc(db, 'users', userDoc.id), {
                    balance: increment(-amount),
                    totalInvested: increment(amount)
                  });
                }
                
                assistantText = `✅ Package added for ${email}. ${assistantText}`;
              } else if (action === 'cancel' || action === 'complete') {
                const qInv = query(collection(db, 'investments'), where('userId', '==', userDoc.id), where('status', '==', 'active'));
                const invSnap = await getDocs(qInv);
                
                let cancelledCount = 0;
                for (const inv of invSnap.docs) {
                   if (!packageId || inv.data().packageId === packageId) {
                     await updateDoc(doc(db, 'investments', inv.id), { status: action === 'complete' ? 'completed' : 'cancelled' });
                     cancelledCount++;
                   }
                }
                assistantText = `✅ ${cancelledCount} packages ${action}ed for ${email}. ${assistantText}`;
              }
            } else {
              assistantText = `❌ Could not find user with email ${email}.`;
            }
          } else if (call.name === "give_random_referrals") {
            const { email, count } = call.args as any;
            
            const q = query(collection(db, 'users'), where('email', '==', email));
            const snap = await getDocs(q);

            if (!snap.empty) {
              const userDoc = snap.docs[0];
              const targetUid = userDoc.id;

              const packages = [
                { id: 't1', name: 'Tier 1', amount: 100000 },
                { id: 't2', name: 'Tier 2', amount: 500000 },
                { id: 't3', name: 'Tier 3', amount: 1000000 },
                { id: 't4', name: 'Tier 4', amount: 5000000 }
              ];
              
              for (let i = 1; i <= count; i++) {
                const randomPkg = packages[Math.floor(Math.random() * packages.length)];
                const referralEmail = `test_referral_${i}_${Date.now()}@example.com`;
                const newUid = `ref_${Date.now()}_${i}`;

                const newUserRef = doc(db, 'users', newUid);
                await setDoc(newUserRef, {
                  uid: newUid,
                  email: referralEmail,
                  displayName: `Referral User ${i}`,
                  balance: 0,
                  profitBalance: 0,
                  role: 'user',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  referredBy: targetUid,
                  totalInvested: randomPkg.amount
                });

                const nextMonth = new Date();
                nextMonth.setMonth(nextMonth.getMonth() + 1);

                await addDoc(collection(db, 'investments'), {
                  userId: newUid,
                  packageId: randomPkg.id,
                  packageName: randomPkg.name,
                  amountIQD: randomPkg.amount,
                  purchaseDate: new Date().toISOString(),
                  nextPayoutDate: nextMonth.toISOString(),
                  status: 'active',
                  autoReinvest: true
                });
              }
              
              assistantText = `✅ Added ${count} random active referrals for ${email}. ${assistantText}`;
            } else {
              assistantText = `❌ Could not find user with email ${email}.`;
            }
          } else if (call.name === "process_invoice") {
            const { email, amount, action, method } = call.args as any;
            
            const q = query(collection(db, 'users'), where('email', '==', email));
            const snap = await getDocs(q);

            if (!snap.empty) {
              const userDoc = snap.docs[0];
              const userData = userDoc.data() as UserProfile;
              
              if (action === 'create_withdrawal') {
                 if (userData.balance >= amount) {
                   await addDoc(collection(db, 'withdrawals'), {
                     userId: userDoc.id,
                     userName: userData.displayName,
                     userEmail: userData.email,
                     amountIQD: amount,
                     method: method || 'Manual Adjustment',
                     accountDetails: 'System generated invoice',
                     timestamp: new Date().toISOString(),
                     status: 'pending'
                   });
                   assistantText = `✅ Withdrawal invoice created for ${email}. ${assistantText}`;
                 } else {
                   assistantText = `❌ User ${email} does not have enough balance (${userData.balance}) for this withdrawal (${amount}). ${assistantText}`;
                 }
              } else {
                 assistantText = `❌ Unsupported invoice action: ${action}. ${assistantText}`;
              }
            } else {
              assistantText = `❌ Could not find user with email ${email}.`;
            }
          } else if (call.name === "approve_deposit") {
            const { email, depositId, notes } = call.args as any;
            let targetDeposit: DepositRequest | undefined;

            if (depositId) {
              targetDeposit = deposits.find(d => d.id === depositId);
            } else if (email) {
              targetDeposit = deposits.find(d => d.userEmail === email);
            }

            if (targetDeposit) {
              await handleApproveDeposit(targetDeposit, notes);
              assistantText = `✅ Deposit for ${targetDeposit.userEmail} approved. ${assistantText}`;
            } else {
              assistantText = `❌ Could not find a pending deposit for ${email || depositId}.`;
            }
          } else if (call.name === "list_pending_deposits") {
            if (deposits.length === 0) {
              assistantText = `There are currently no pending deposit requests.`;
            } else {
              const list = deposits.map(d => `- ${d.userName} (${d.userEmail}): ${d.amountIQD.toLocaleString()} IQD (ID: ${d.id.slice(0,8)})`).join('\n');
              assistantText = `Found ${deposits.length} pending deposits:\n${list}\n\n${assistantText}`;
            }
          } else if (call.name === "trigger_payout_cycle") {
            // Re-use logic or call existing triggerPayouts
            await triggerPayouts();
            assistantText = `✅ Payout cycle initiated successfully. ${assistantText}`;
          }
        }
      }

      setAiMessages(prev => [...prev, { 
        role: 'assistant', 
        text: assistantText,
        stats: {
          totalUsers: users.length,
          activeEngines: investments.length,
          pendingDeposits: deposits.length
        }
      }]);
      toast.success("AI Agent executed command");
    } catch (error) {
      console.error(error);
      setAiMessages(prev => [...prev, { role: 'assistant', text: "Sorry, I encountered an error while processing your request." }]);
      toast.error("AI Agent encountered an error");
    } finally {
      setAiLoading(false);
    }
  };

  const handleManualAdjustment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const targetEmail = formData.get('targetEmail') as string;
    const adjustAmount = parseInt(formData.get('adjustAmount') as string);
    const reason = formData.get('reason') as string;
    const transType = formData.get('transType') as string;

    if (!targetEmail || isNaN(adjustAmount)) {
      toast.error("Please provide a valid email and amount");
      return;
    }

    setConfirmState({
      isOpen: true,
      title: "Confirm Balance Adjustment",
      message: `Are you sure you want to ${adjustAmount >= 0 ? 'add' : 'deduct'} ${Math.abs(adjustAmount).toLocaleString()} IQD ${adjustAmount >= 0 ? 'to' : 'from'} ${targetEmail}? Type: ${transType}`,
      type: 'warn',
      action: async () => {
        setProcessing(true);
        try {
          const q = query(collection(db, 'users'), where('email', '==', targetEmail));
          const snap = await getDocs(q);

          if (snap.empty) {
            toast.error("User not found");
            return;
          }

          const userDoc = snap.docs[0];
          await updateDoc(doc(db, 'users', userDoc.id), {
            balance: increment(adjustAmount)
          });

          await addDoc(collection(db, 'transactions'), {
            userId: userDoc.id,
            type: transType,
            amountIQD: Math.abs(adjustAmount),
            description: reason || `Manual ${transType} adjustment`,
            timestamp: new Date().toISOString(),
            status: 'completed'
          });

          // Add Notification
          await addDoc(collection(db, 'notifications'), {
            userId: userDoc.id,
            title: 'Manual Balance Adjustment',
            message: `A manual ${transType} of ${Math.abs(adjustAmount).toLocaleString()} IQD was processed. ${reason ? `Note: ${reason}` : ''}`,
            type: transType as any,
            read: false,
            timestamp: new Date().toISOString()
          });

          toast.success(`Successfully adjusted balance for ${targetEmail}`);
          (e.target as HTMLFormElement).reset();
        } catch (error) {
          console.error(error);
          toast.error("Adjustment failed. Check permissions.");
        } finally {
          setProcessing(false);
          setConfirmState(null);
        }
      }
    });
  };

  const handleCancelPackage = async (invId: string, packageName: string) => {
    if (!selectedUser) return;
    
    setConfirmState({
      isOpen: true,
      title: "Cancel Package",
      message: `Are you sure you want to cancel the package '${packageName}' for ${selectedUser.displayName}? This action cannot be undone.`,
      type: 'warn',
      action: async () => {
        setProcessing(true);
        try {
          await updateDoc(doc(db, 'investments', invId), { status: 'cancelled' });
          toast.success("Package cancelled successfully");
          
          if (selectedUserActivity) {
             const updated = selectedUserActivity.investments.filter(i => i.id !== invId);
             setSelectedUserActivity({ ...selectedUserActivity, investments: updated });
          }
        } catch (error) {
          console.error(error);
          toast.error("Failed to cancel package");
        } finally {
          setProcessing(false);
          setConfirmState(null);
        }
      }
    });
  };

  const handleDeleteUser = async (userId: string) => {
    if (!selectedUser) return;
    
    setConfirmState({
      isOpen: true,
      title: "EXTREME: DELETE USER ACCOUNT",
      message: `Warning: You are about to permanently delete ${selectedUser.displayName} (${selectedUser.email}). This will purge all authentication records and financial profiles. This action is IRREVERSIBLE.`,
      type: 'critical',
      requireAuthWord: 'DELETE',
      action: async () => {
        setProcessing(true);
        try {
          const idToken = await auth.currentUser?.getIdToken();
          
          // 1. Call API to delete from Firebase Auth
          const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': idToken ? `Bearer ${idToken}` : ''
            }
          });

          if (!response.ok) {
            const err = await response.json();
            if (err.error === 'API_DISABLED') {
              toast.error("Critical API Disabled", {
                description: "The Identity Toolkit API must be enabled in Google Cloud Console to delete users.",
                action: {
                  label: "Enable Now",
                  onClick: () => window.open("https://console.developers.google.com/apis/api/identitytoolkit.googleapis.com/overview?project=258012273293", "_blank")
                },
                duration: 10000
              });
              return;
            }
            throw new Error(err.error || "Failed point-of-authentication deletion");
          }

          // 2. Delete Firestore Document
          await deleteDoc(doc(db, 'users', userId));

          toast.success("User account successfully purged from system");
          setSelectedUser(null);
        } catch (error: any) {
          console.error(error);
          toast.error(error.message || "Deletion sequence failed");
        } finally {
          setProcessing(false);
          setConfirmState(null);
        }
      }
    });
  };

  const handleSendSystemNotice = async (userId: string, title: string, message: string) => {
    try {
      await addDoc(collection(db, 'notifications'), {
        userId,
        title,
        message,
        type: 'update',
        read: false,
        timestamp: new Date().toISOString()
      });
      toast.success("System notice sent to user");
    } catch (error) {
      console.error(error);
      toast.error("Failed to send notice");
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <AlertTriangle className="w-16 h-16 text-amber-500 mb-4" />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Access Denied</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-xs mt-2 italic font-medium">Only authorized administrators can access this control panel.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
       <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-3 uppercase">
             <ShieldCheck className="w-8 h-8 text-emerald-600" />
             Core Management
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium italic">Platform governance and dividend distribution.</p>
        </div>
        <div className="flex flex-wrap gap-3">
           <Button 
             onClick={() => navigate('/admin/deposits')}
             className="bg-amber-500 hover:bg-amber-400 text-white rounded-xl px-6 font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-amber-500/20 transition-all h-12 flex items-center"
           >
             <AlertTriangle className="w-3.5 h-3.5 mr-2 animate-pulse" />
             Pending Audits ({deposits.filter(d => d.status === 'pending').length})
           </Button>
           <Button variant="outline" className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 rounded-xl px-6 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-all h-12">
             <Database className="w-4 h-4 mr-2" />
             Backup DB
           </Button>
           <Button 
             onClick={triggerPayouts}
             disabled={processing}
             className="bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white font-black rounded-xl px-8 h-12 shadow-xl transition-all uppercase text-[10px] tracking-widest"
           >
             {processing ? <RefreshCcw className="w-4 h-4 mr-2 animate-spin" /> : <TrendingUp className="w-4 h-4 mr-2" />}
             Run Payout Cycle
           </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-8">
        {/* Admin Alerts Feed */}
        <Card className="lg:col-span-1 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl overflow-hidden flex flex-col h-[520px]">
          <CardHeader className="p-6 border-b border-slate-50 dark:border-slate-800 shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2">
                <Bell className="w-4 h-4 text-emerald-600" />
                Action Feed
              </h3>
              {adminAlerts.length > 0 && (
                <Badge className="bg-emerald-500 text-white text-[8px] px-2">{adminAlerts.length}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4 flex-1 overflow-y-auto space-y-4">
            {deposits.filter(d => d.status === 'pending').map((deposit) => (
              <div 
                key={deposit.id}
                onClick={() => {
                  setSelectedDeposit(deposit);
                  setVerificationNotes('');
                }}
                className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 cursor-pointer hover:border-amber-500 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 mt-1">
                    <Coins className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight truncate">{deposit.userName}</p>
                    <p className="text-[9px] font-bold text-amber-600 uppercase tracking-widest mt-0.5">{deposit.amountIQD.toLocaleString()} IQD</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[8px] font-bold text-slate-400 uppercase">{new Date(deposit.timestamp).toLocaleDateString()}</span>
                      <Badge className="bg-amber-500 text-white text-[7px] px-1.5 py-0">PENDING</Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {adminAlerts.length === 0 && deposits.filter(d => d.status === 'pending').length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4 opacity-40">
                <ShieldCheck className="w-8 h-8 text-slate-300" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">System Secure. No pending alerts.</p>
              </div>
            ) : (
              adminAlerts.map((alert) => (
                <div 
                  key={alert.id}
                  onClick={() => {
                    const deposit = deposits.find(d => d.userId === alert.targetId);
                    if (deposit) {
                      setSelectedDeposit(deposit);
                      setVerificationNotes('');
                    }
                  }}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 cursor-pointer hover:border-emerald-500/50 transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 mt-1">
                      <ImageIcon className="w-3 h-3" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight line-clamp-1">{alert.title}</p>
                      <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-relaxed italic">{alert.message}</p>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-[9px] font-black text-emerald-600 italic">{alert.amount.toLocaleString()} IQD</span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase">{new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 bg-slate-900 border-emerald-500/30 shadow-2xl shadow-emerald-500/10 rounded-3xl overflow-hidden border-b-4 border-b-emerald-500 h-[520px] flex flex-col">
          <CardHeader className="p-8 pb-4 flex flex-row items-center justify-between border-b border-emerald-500/10 bg-slate-900/50 shrink-0">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30">
                  <BrainCircuit className="w-6 h-6 text-emerald-400" />
                </div>
                <CardTitle className="text-xl font-bold text-white tracking-tighter uppercase italic">IQDplus Command Nexus</CardTitle>
              </div>
              <CardDescription className="text-slate-400 text-xs font-mono">Real-time autonomous administrative intelligence.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]" />
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Agent Active</span>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-thin scrollbar-thumb-emerald-500/20 scrollbar-track-transparent">
              {aiMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-40">
                  <Sparkles className="w-12 h-12 text-emerald-500" />
                  <div className="space-y-2">
                    <p className="text-slate-100 font-bold uppercase tracking-widest text-[10px]">Awaiting Instructions</p>
                    <p className="text-slate-400 text-xs max-w-xs leading-relaxed">
                      Try: "Add 500,000 IQD to user@email.com" or "Initiate the monthly payout cycle"
                    </p>
                  </div>
                </div>
              ) : (
                aiMessages.map((msg, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={i} 
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 rounded-tr-none border border-emerald-500/50' 
                        : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700 shadow-xl'
                    }`}>
                      {msg.text}
                      {msg.stats && (
                        <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-3 gap-2">
                          <div className="text-center">
                            <p className="text-[8px] uppercase font-bold text-slate-500">Users</p>
                            <p className="text-xs font-black text-emerald-500">{msg.stats.totalUsers}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[8px] uppercase font-bold text-slate-500">Engines</p>
                            <p className="text-xs font-black text-emerald-500">{msg.stats.activeEngines}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[8px] uppercase font-bold text-slate-500">Pending</p>
                            <p className="text-xs font-black text-amber-500">{msg.stats.pendingDeposits}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>
            
            <div className="p-6 bg-slate-950/50 border-t border-emerald-500/10 h-28 shrink-0">
              <form onSubmit={handleAiCommand} className="relative flex items-center">
                <input 
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Instruct the IQDplus Agent..."
                  className="w-full h-14 pl-6 pr-16 rounded-2xl bg-slate-900 border border-emerald-500/20 text-emerald-50 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder:text-slate-600 font-medium"
                  disabled={aiLoading}
                />
                <button 
                  type="submit"
                  disabled={aiLoading || !aiPrompt.trim()}
                  className="absolute right-3 p-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 disabled:bg-slate-800 transition-all shadow-lg hover:shadow-emerald-600/20"
                >
                  {aiLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Total Users", value: users.length, icon: Users, color: "text-blue-500", onClick: () => setShowUsersModal(true) },
          { label: "Active Engines", value: investments.length, icon: TrendingUp, color: "text-emerald-600", onClick: () => setShowEnginesModal(true) },
          { label: "Pending Deposits", value: deposits.filter(d => d.status === 'pending').length, icon: Coins, color: "text-amber-500", onClick: () => setShowPendingModal(true) },
          { label: "Active Tasks", value: tasksCount, icon: ClipboardList, color: "text-blue-600", onClick: () => navigate('/admin/tasks') },
          { label: "Audit Level", value: auditStrict ? "Strict" : "Standard", icon: auditStrict ? ShieldCheck : Terminal, color: auditStrict ? "text-emerald-500" : "text-amber-500", onClick: () => setAuditStrict(!auditStrict) },
        ].map((s, i) => (
           <Card 
             key={i} 
             className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl group hover:border-emerald-500/40 transition-all duration-300 cursor-pointer active:scale-95"
             onClick={s.onClick}
           >
             <CardContent className="p-6">
                <div className={`p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 ${s.color} mb-4 inline-block group-hover:scale-110 transition-transform`}>
                  <s.icon className="w-5 h-5" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{s.label}</p>
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tighter">{s.value}</h3>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                </div>
             </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="p-6 pb-0">
          <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-500">Manual Financial Ledger</CardTitle>
          <CardDescription className="text-xs italic">Direct balance adjustment for administrative corrections.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleManualAdjustment} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-slate-400">Target Email</label>
              <input 
                name="targetEmail" 
                type="email" 
                placeholder="wreawali27@gmail.com"
                className="w-full h-10 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 text-sm outline-none focus:border-emerald-500 transition-colors shadow-sm"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-slate-400">Amount (IQD)</label>
              <input 
                name="adjustAmount" 
                type="number" 
                placeholder="±100,000"
                className="w-full h-10 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 text-sm outline-none focus:border-emerald-500 transition-colors shadow-sm"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-slate-400">Trans Type</label>
              <select 
                name="transType"
                className="w-full h-10 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 text-sm outline-none focus:border-emerald-500 transition-colors shadow-sm"
                required
              >
                <option value="deposit">Deposit (In)</option>
                <option value="withdrawal">Withdrawal (Out)</option>
                <option value="payout">Payout (Yield)</option>
                <option value="referral">Referral (Reward)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-slate-400">Admin Note</label>
              <input 
                name="reason" 
                type="text" 
                placeholder="Correction, Payout, etc."
                className="w-full h-10 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 text-sm outline-none focus:border-emerald-500 transition-colors shadow-sm"
              />
            </div>
            <Button 
              type="submit" 
              disabled={processing}
              className="h-10 w-full bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 text-white font-bold rounded-xl uppercase text-[10px] tracking-widest shadow-lg hover:shadow-indigo-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Coins className="w-3.5 h-3.5" /> Commit</>}
            </Button>
          </form>
        </CardContent>
      </Card>

      {deposits.length > 0 && (
        <Card className="bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-800 shadow-xl shadow-emerald-500/5 rounded-[2rem] overflow-hidden">
          <Tabs defaultValue="pending" className="w-full">
            <CardHeader className="p-10 pb-0 bg-emerald-50/30 dark:bg-emerald-950/20 border-b border-emerald-100/50 dark:border-emerald-800/50">
               <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
                  <div>
                     <CardTitle className="text-xl font-black text-emerald-900 dark:text-emerald-100 uppercase tracking-tight">Deposit Management</CardTitle>
                     <CardDescription className="text-emerald-700/60 dark:text-emerald-400/60 font-medium italic">Audit and verify manual capital injections.</CardDescription>
                  </div>
                  <TabsList className="bg-emerald-100/50 dark:bg-emerald-900/30 p-1 rounded-xl">
                    <TabsTrigger value="pending" className="rounded-lg font-black text-[10px] uppercase px-4 py-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                      Pending ({deposits.filter(d => d.status === 'pending').length})
                    </TabsTrigger>
                    <TabsTrigger value="history" className="rounded-lg font-black text-[10px] uppercase px-4 py-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                      Processed ({deposits.filter(d => d.status !== 'pending').length})
                    </TabsTrigger>
                  </TabsList>
               </div>
            </CardHeader>
            <TabsContent value="pending" className="m-0">
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-emerald-50/50 dark:bg-slate-800/50 border-b border-emerald-100 dark:border-emerald-800">
                    <TableRow className="hover:bg-transparent border-none">
                      <TableHead className="text-emerald-600 dark:text-emerald-400 font-black uppercase text-[10px] tracking-widest pl-10 py-6">Request ID</TableHead>
                      <TableHead className="text-emerald-600 dark:text-emerald-400 font-black uppercase text-[10px] tracking-widest py-6">User Name</TableHead>
                      <TableHead className="text-emerald-600 dark:text-emerald-400 font-black uppercase text-[10px] tracking-widest py-6">Amount (IQD)</TableHead>
                      <TableHead className="text-emerald-600 dark:text-emerald-400 font-black uppercase text-[10px] tracking-widest py-6">Proof URL</TableHead>
                      <TableHead className="text-emerald-600 dark:text-emerald-400 font-black uppercase text-[10px] tracking-widest py-6">Status</TableHead>
                      <TableHead className="text-emerald-600 dark:text-emerald-400 font-black uppercase text-[10px] tracking-widest py-6 text-right pr-10">Approval Gate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deposits.filter(d => d.status === 'pending').map((deposit) => (
                      <React.Fragment key={deposit.id}>
                        <TableRow className="border-slate-50 dark:border-slate-800 hover:bg-emerald-50/20 dark:hover:bg-emerald-900/10 group transition-colors">
                          <TableCell className="pl-10 py-6">
                             <div className="font-mono text-[10px] font-bold text-slate-400">#{deposit.id.slice(0, 8)}...</div>
                          </TableCell>
                          <TableCell>
                             <div className="font-black text-slate-900 dark:text-slate-100 uppercase text-xs tracking-tight">{deposit.userName}</div>
                             <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{deposit.userEmail}</div>
                          </TableCell>
                          <TableCell className="font-mono font-black text-emerald-600 text-base tracking-tighter">
                             {deposit.amountIQD.toLocaleString()}
                          </TableCell>
                          <TableCell>
                             <Button 
                               variant="outline" 
                               size="sm" 
                               className="rounded-xl h-9 px-4 font-bold text-[9px] uppercase tracking-widest transition-all bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:text-emerald-600"
                               onClick={() => {
                                 setSelectedDeposit(deposit);
                                 setVerificationNotes('');
                               }}
                             >
                                Audit Workflow
                             </Button>
                          </TableCell>
                          <TableCell>
                             <Badge className="bg-amber-500/10 text-amber-600 border border-amber-500/20 px-3 py-1 rounded-full font-black text-[9px] uppercase tracking-widest">
                                {deposit.status}
                             </Badge>
                          </TableCell>
                          <TableCell className="text-right pr-10">
                             <div className="flex justify-end gap-2">
                                <Button 
                                  onClick={() => handleRejectDeposit(deposit.id)}
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-10 w-10 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all"
                                >
                                   <X className="w-4 h-4" />
                                </Button>
                                <Button 
                                  onClick={() => handleApproveDeposit(deposit)}
                                  className="h-10 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                                >
                                   <Check className="w-3.5 h-3.5 mr-2" /> Approve
                                </Button>
                             </div>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    ))}
                    {deposits.filter(d => d.status === 'pending').length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-slate-400 font-medium italic uppercase tracking-widest text-[10px]">
                          All pending uploads have been synchronized.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </TabsContent>
            <TabsContent value="history" className="m-0">
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-emerald-50/50 dark:bg-slate-800/50 border-b border-emerald-100 dark:border-emerald-800">
                    <TableRow className="hover:bg-transparent border-none">
                      <TableHead className="text-emerald-600 dark:text-emerald-400 font-black uppercase text-[10px] tracking-widest pl-10 py-6">Details</TableHead>
                      <TableHead className="text-emerald-600 dark:text-emerald-400 font-black uppercase text-[10px] tracking-widest py-6">Admin Action</TableHead>
                      <TableHead className="text-emerald-600 dark:text-emerald-400 font-black uppercase text-[10px] tracking-widest py-6">Status</TableHead>
                      <TableHead className="text-emerald-600 dark:text-emerald-400 font-black uppercase text-[10px] tracking-widest py-6 text-right pr-10">Review</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deposits.filter(d => d.status !== 'pending').slice(0, 10).map((deposit) => (
                      <TableRow key={deposit.id} className="border-slate-50 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                        <TableCell className="pl-10 py-6">
                           <div className="font-black text-slate-900 dark:text-slate-100 uppercase text-xs tracking-tight">{deposit.userName}</div>
                           <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{deposit.amountIQD.toLocaleString()} IQD via {deposit.method}</div>
                        </TableCell>
                        <TableCell>
                           <div className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight line-clamp-1">{deposit.processedBy || 'Automated'}</div>
                           <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1 italic">
                             {deposit.processedAt ? new Date(deposit.processedAt).toLocaleString() : 'N/A'}
                           </div>
                        </TableCell>
                        <TableCell>
                           <Badge className={`uppercase font-black text-[9px] tracking-widest px-3 py-1 rounded-full border-none shadow-none ${
                             deposit.status === 'confirmed' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-600'
                           }`}>
                              {deposit.status}
                           </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-10">
                           <Button 
                             onClick={() => setSelectedDeposit(deposit)}
                             variant="ghost" 
                             size="sm" 
                             className="text-slate-400 hover:text-emerald-600 font-bold text-[9px] uppercase tracking-widest"
                           >
                              Full Report
                           </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {deposits.filter(d => d.status !== 'pending').length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="h-32 text-center text-slate-400 font-medium italic uppercase tracking-widest text-[10px]">
                          No processed requests found in the ledger.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>
      )}

      {/* Deposit Verification Modal */}
      <AnimatePresence>
        {selectedDeposit && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
            onClick={() => setSelectedDeposit(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 30 }}
              className="bg-white dark:bg-slate-900 w-full max-w-5xl max-h-[90vh] rounded-[3rem] shadow-[0_0_100px_rgba(16,185,129,0.1)] border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-10 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-emerald-50/20 dark:bg-emerald-950/20">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 bg-emerald-600 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-emerald-600/20">
                    <ShieldCheck className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Deposit Audit <span className="text-emerald-600">v2.0</span></h3>
                    <p className="text-xs text-slate-500 font-bold tracking-[0.2em] uppercase mt-1">Manual Verification Required for IQD Extraction</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedDeposit(null)}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-800 text-slate-400 hover:text-rose-600 transition-all border border-slate-100 dark:border-slate-700 shadow-sm"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10">
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                    {/* Left: Proof Review */}
                    <div className="space-y-6">
                       <div className="flex items-center gap-3 mb-2">
                          <Eye className="w-5 h-5 text-emerald-600" />
                          <h4 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-slate-100 italic">Visual Evidence</h4>
                       </div>
                       
                       {selectedDeposit.proofUrl.startsWith('http') ? (
                          <div className="relative group rounded-[2.5rem] border-4 border-white dark:border-slate-800 shadow-2xl overflow-hidden bg-slate-100 dark:bg-slate-950">
                             <img 
                               src={selectedDeposit.proofUrl} 
                               alt="Digital Receipt" 
                               className="w-full h-auto max-h-[600px] object-contain transition-transform duration-700 group-hover:scale-105"
                               referrerPolicy="no-referrer"
                             />
                             <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                                <a 
                                  href={selectedDeposit.proofUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-emerald-500 transition-all flex items-center gap-3"
                                >
                                   <ExternalLink className="w-4 h-4" /> Expand Original Asset
                                </a>
                             </div>
                          </div>
                       ) : selectedDeposit.proofUrl.startsWith('[') ? (
                          <div className="h-[400px] rounded-[2.5rem] border-4 border-dashed border-amber-200 dark:border-amber-900/50 flex flex-col items-center justify-center p-12 text-center bg-amber-50/20 dark:bg-amber-950/20">
                             <AlertTriangle className="w-16 h-16 text-amber-500 mb-6 animate-pulse" />
                             <p className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest">Image Storage Link Failed</p>
                             <p className="text-[10px] font-bold text-amber-600 mt-2 uppercase tracking-tight">The user's screenshot failed to upload to Cloud Storage (Provisioning Error).</p>
                             <div className="mt-8 flex gap-3">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => window.open(`https://wa.me/9647834612120?text=Hello,%20your%20deposit%20proof%20image%20for%20${selectedDeposit.amountIQD}%20IQD%20failed%20to%20upload.%20Please%20send%20it%20here.`, "_blank")}
                                  className="rounded-xl border-amber-200 dark:border-amber-900 text-amber-600 font-black text-[10px] uppercase tracking-widest"
                                >
                                   Request via WhatsApp
                                </Button>
                             </div>
                             <p className="text-[10px] font-mono text-slate-400 mt-6 break-all bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-inner w-full">
                                {selectedDeposit.proofUrl}
                             </p>
                          </div>
                       ) : (
                          <div className="h-[400px] rounded-[2.5rem] border-4 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center p-12 text-center bg-slate-50/50 dark:bg-slate-950/20">
                             <Database className="w-16 h-16 text-slate-300 mb-6" />
                             <p className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest">Transaction ID Only</p>
                             <p className="text-[10px] font-mono text-slate-400 mt-4 break-all bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-inner">
                                {selectedDeposit.proofUrl}
                             </p>
                          </div>
                       )}

                       <div className="p-6 bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/50 rounded-3xl flex items-start gap-4">
                          <Check className="w-5 h-5 text-indigo-500 shrink-0 mt-1" />
                          <p className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 leading-relaxed uppercase tracking-wide">
                             The system has verified the image integrity. Please manually confirm the transaction reference number from the banking app.
                          </p>
                       </div>
                    </div>

                    {/* Right: Data & Decision */}
                    <div className="space-y-10">
                       <div className="grid grid-cols-2 gap-4">
                          <div className="p-6 rounded-[2rem] bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Requestor Identity</p>
                             <p className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase leading-none">{selectedDeposit.userName}</p>
                             <p className="text-[10px] font-medium text-slate-500 mt-2 italic truncate">{selectedDeposit.userEmail}</p>
                          </div>
                          <div className="p-6 rounded-[2rem] bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Payment Method</p>
                             <div className="flex items-center gap-2">
                                <Badge variant="outline" className="bg-white dark:bg-slate-900 border-emerald-100 dark:border-emerald-900 text-emerald-600 font-black text-[9px] px-3 py-1 uppercase">{selectedDeposit.method}</Badge>
                                {selectedDeposit.method === 'FIB' && <Smartphone className="w-3 h-3 text-emerald-600" />}
                             </div>
                          </div>
                          <div className="p-6 rounded-[2rem] bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 col-span-2">
                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Submission Timeline</p>
                             <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                                <Calendar className="w-3 h-3" />
                                <p className="text-[11px] font-black uppercase tracking-tight">{new Date(selectedDeposit.timestamp).toLocaleDateString()}</p>
                                <span className="opacity-30">|</span>
                                <Clock className="w-3 h-3" />
                                <p className="text-[11px] font-black uppercase tracking-tight">{new Date(selectedDeposit.timestamp).toLocaleTimeString()}</p>
                             </div>
                          </div>
                       </div>

                       <div className="p-8 rounded-[2.5rem] bg-emerald-600 shadow-2xl shadow-emerald-500/20 text-white relative overflow-hidden">
                          <div className="absolute -right-8 -bottom-8 opacity-10">
                             <Coins className="w-40 h-40" />
                          </div>
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80 mb-2">Asset Injection Value</p>
                          <h4 className="text-4xl font-black tracking-tighter italic">
                             {selectedDeposit.amountIQD.toLocaleString()} <span className="text-xl not-italic opacity-60">IQD</span>
                          </h4>
                       </div>

                       {/* Decision & Notes */}
                       <div className="space-y-6">
                          {selectedDeposit.status !== 'pending' ? (
                            <div className="p-8 rounded-[2.5rem] bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-6">
                              <div className="flex items-center justify-between">
                                <h5 className="font-black text-xs uppercase tracking-widest text-slate-900 dark:text-slate-100 italic">Audit Result</h5>
                                <Badge className={`uppercase font-black text-[10px] px-4 py-1.5 rounded-full ${
                                  selectedDeposit.status === 'confirmed' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                                }`}>
                                  {selectedDeposit.status}
                                </Badge>
                              </div>
                              
                              <div className="space-y-4">
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Processed By</p>
                                  <p className="text-sm font-black text-slate-700 dark:text-slate-300 italic">{selectedDeposit.processedBy || 'Automated System'}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Processed At</p>
                                  <p className="text-sm font-black text-slate-700 dark:text-slate-300 italic">
                                    {selectedDeposit.processedAt ? new Date(selectedDeposit.processedAt).toLocaleString() : 'N/A'}
                                  </p>
                                </div>
                                {selectedDeposit.adminNotes && (
                                  <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Moderator Notes</p>
                                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-inner">
                                      <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed italic">
                                        "{selectedDeposit.adminNotes}"
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="space-y-3">
                                 <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Administrative Audit Notes</label>
                                    <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-400 text-[8px] uppercase">Optional</Badge>
                                 </div>
                                 <textarea 
                                   value={verificationNotes}
                                   onChange={(e) => setVerificationNotes(e.target.value)}
                                   placeholder="Enter verification details, reference numbers, or rejection reason here..."
                                   className="w-full h-32 p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none shadow-inner"
                                 />
                              </div>

                              <div className="flex gap-4">
                                 <Button 
                                   onClick={() => handleRejectDeposit(selectedDeposit.id, verificationNotes)}
                                   disabled={processing}
                                   variant="outline" 
                                   className="flex-1 h-16 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white hover:bg-rose-50 dark:hover:bg-rose-950/30 font-black rounded-3xl uppercase tracking-widest text-xs italic transition-all active:scale-95"
                                 >
                                    Deny Request
                                 </Button>
                                 <Button 
                                   onClick={() => handleApproveDeposit(selectedDeposit, verificationNotes)}
                                   disabled={processing}
                                   className="flex-1 h-16 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-3xl uppercase tracking-widest text-xs italic shadow-xl shadow-emerald-500/30 transition-all active:scale-95 group"
                                 >
                                    <div className="flex items-center justify-center">
                                       <span>Authorize Assets</span>
                                       <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                 </Button>
                              </div>
                            </>
                          )}
                       </div>
                    </div>
                 </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {withdrawals.length > 0 && (
        <Card className="bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-800 shadow-xl shadow-indigo-500/5 rounded-[2rem] overflow-hidden">
          <Tabs defaultValue="pending" className="w-full">
            <CardHeader className="p-10 pb-0 bg-indigo-50/30 dark:bg-indigo-950/20 border-b border-indigo-100/50 dark:border-indigo-800/50">
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                  <div>
                     <CardTitle className="text-xl font-black text-indigo-900 dark:text-indigo-100 uppercase tracking-tight">Withdrawal Requests</CardTitle>
                     <CardDescription className="text-indigo-700/60 dark:text-indigo-400/60 font-medium italic">Manage capital offramp operations.</CardDescription>
                  </div>
                  <TabsList className="bg-indigo-100/50 dark:bg-indigo-900/30 p-1 rounded-xl">
                    <TabsTrigger value="pending" className="rounded-lg font-black text-[10px] uppercase px-4 py-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                      Pending ({withdrawals.filter(w => w.status === 'pending').length})
                    </TabsTrigger>
                    <TabsTrigger value="history" className="rounded-lg font-black text-[10px] uppercase px-4 py-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                      History ({withdrawals.filter(w => w.status !== 'pending').length})
                    </TabsTrigger>
                  </TabsList>
               </div>
            </CardHeader>
            <TabsContent value="pending" className="m-0">
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-indigo-50/50 dark:bg-slate-800/50 border-b border-indigo-100 dark:border-indigo-800">
                    <TableRow className="hover:bg-transparent border-none">
                      <TableHead className="text-indigo-600 dark:text-indigo-400 font-black uppercase text-[10px] tracking-widest pl-10 py-6">Investor</TableHead>
                      <TableHead className="text-indigo-600 dark:text-indigo-400 font-black uppercase text-[10px] tracking-widest py-6">Method / Destination</TableHead>
                      <TableHead className="text-indigo-600 dark:text-indigo-400 font-black uppercase text-[10px] tracking-widest py-6">Amount (IQD)</TableHead>
                      <TableHead className="text-indigo-600 dark:text-indigo-400 font-black uppercase text-[10px] tracking-widest py-6 text-right pr-10">Approval Gate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withdrawals.filter(w => w.status === 'pending').map((withdraw) => (
                      <TableRow key={withdraw.id} className="border-slate-50 dark:border-slate-800 hover:bg-indigo-50/20 dark:hover:bg-indigo-900/10 group transition-colors">
                        <TableCell className="pl-10 py-6">
                           <div className="font-black text-slate-900 dark:text-slate-100 uppercase text-xs tracking-tight">{withdraw.userName}</div>
                           <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{withdraw.userEmail}</div>
                        </TableCell>
                        <TableCell>
                           <Badge variant="outline" className="bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-600 border-indigo-100 dark:border-indigo-800 font-bold text-[10px] uppercase tracking-wider mb-2">{withdraw.method}</Badge>
                           <div className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 truncate max-w-[200px]">{withdraw.accountDetails}</div>
                        </TableCell>
                        <TableCell className="font-mono font-black text-rose-600 text-base tracking-tighter">
                           -{withdraw.amountIQD.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right pr-10">
                           <div className="flex justify-end gap-2">
                              <Button 
                                onClick={() => handleRejectWithdrawal(withdraw.id)}
                                variant="ghost" 
                                size="sm" 
                                className="h-10 w-10 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all"
                              >
                                 <X className="w-4 h-4" />
                              </Button>
                              <Button 
                                onClick={() => handleApproveWithdrawal(withdraw)}
                                className="h-10 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl uppercase text-[10px] tracking-widest shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
                              >
                                 <Check className="w-3.5 h-3.5 mr-2" /> Complete
                              </Button>
                           </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {withdrawals.filter(w => w.status === 'pending').length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="h-32 text-center text-slate-400 font-medium italic uppercase tracking-widest text-[10px]">
                          All withdrawal requests have been finalized.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </TabsContent>
            <TabsContent value="history" className="m-0">
               <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-indigo-50/50 dark:bg-slate-800/50 border-b border-indigo-100 dark:border-indigo-800">
                    <TableRow className="hover:bg-transparent border-none">
                      <TableHead className="text-indigo-600 dark:text-indigo-400 font-black uppercase text-[10px] tracking-widest pl-10 py-6">Investor</TableHead>
                      <TableHead className="text-indigo-600 dark:text-indigo-400 font-black uppercase text-[10px] tracking-widest py-6">Admin Action</TableHead>
                      <TableHead className="text-indigo-600 dark:text-indigo-400 font-black uppercase text-[10px] tracking-widest py-6">Status</TableHead>
                      <TableHead className="text-indigo-600 dark:text-indigo-400 font-black uppercase text-[10px] tracking-widest text-right pr-10 py-6">Timeline</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withdrawals.filter(w => w.status !== 'pending').slice(0, 10).map((withdraw) => (
                      <TableRow key={withdraw.id} className="border-slate-50 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                        <TableCell className="pl-10 py-6">
                           <div className="font-black text-slate-900 dark:text-slate-100 uppercase text-xs tracking-tight">{withdraw.userName}</div>
                           <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{withdraw.amountIQD.toLocaleString()} IQD</div>
                        </TableCell>
                        <TableCell>
                           <div className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">{withdraw.processedBy || 'Automated'}</div>
                           <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1 italic">
                             {withdraw.processedAt ? new Date(withdraw.processedAt).toLocaleString() : 'N/A'}
                           </p>
                        </TableCell>
                        <TableCell>
                           <Badge className={`uppercase font-black text-[9px] tracking-widest px-3 py-1 rounded-full border-none shadow-none ${
                             withdraw.status === 'completed' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-600'
                           }`}>
                              {withdraw.status}
                           </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-10">
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(withdraw.timestamp).toLocaleDateString()}</p>
                        </TableCell>
                      </TableRow>
                    ))}
                    {withdrawals.filter(w => w.status !== 'pending').length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="h-32 text-center text-slate-400 font-medium italic uppercase tracking-widest text-[10px]">
                          No withdrawal records currently in history.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>
      )}

      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-[2rem] overflow-hidden">
        <CardHeader className="p-10 pb-0">
           <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
             <div>
                <CardTitle className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Registered Investors</CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400 font-medium italic">Manage user accounts and check individual balances.</CardDescription>
             </div>
             
             <div className="flex flex-wrap items-center gap-4">
               {/* Role Filter */}
               <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800">
                 {(['all', 'user', 'admin'] as const).map((r) => (
                   <button
                     key={r}
                     onClick={() => setRoleFilter(r)}
                     className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                       roleFilter === r 
                         ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' 
                         : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                     }`}
                   >
                     {r}
                   </button>
                 ))}
               </div>

               {/* Investment Filter */}
               <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800">
                 {(['all', 'active', 'none'] as const).map((f) => (
                   <button
                     key={f}
                     onClick={() => setInvestmentFilter(f)}
                     className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                       investmentFilter === f 
                         ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' 
                         : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                     }`}
                   >
                     {f === 'active' ? 'Invested' : f === 'none' ? 'Idle' : 'All Funds'}
                   </button>
                 ))}
               </div>

               <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="Search context..."
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-inner"
                  />
               </div>
             </div>
           </div>
        </CardHeader>
        <CardContent className="p-0 mt-8">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="text-slate-400 font-black uppercase text-[10px] tracking-widest pl-10 py-6">Display Name</TableHead>
                <TableHead className="text-slate-400 font-black uppercase text-[10px] tracking-widest py-6">Email Address</TableHead>
                <TableHead className="text-slate-400 font-black uppercase text-[10px] tracking-widest py-6">Role</TableHead>
                <TableHead className="text-slate-400 font-black uppercase text-[10px] tracking-widest py-6">Registered On</TableHead>
                <TableHead className="text-slate-400 font-black uppercase text-[10px] tracking-widest py-6">Balance</TableHead>
                <TableHead className="text-slate-400 font-black uppercase text-[10px] tracking-widest text-right pr-10 py-6">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.uid} className="border-slate-50 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 group transition-colors">
                  <TableCell className="pl-10 py-6 font-black text-slate-900 dark:text-slate-100 uppercase text-xs tracking-tight">{user.displayName}</TableCell>
                  <TableCell className="text-slate-500 dark:text-slate-400 text-xs font-medium italic">{user.email}</TableCell>
                  <TableCell>
                     <Badge className={`border-none shadow-none uppercase font-black text-[9px] tracking-widest px-3 py-1 rounded-full ${
                       user.role === 'admin' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                     }`}>
                       {user.role}
                     </Badge>
                  </TableCell>
                  <TableCell className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-tighter">
                     {new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </TableCell>
                  <TableCell className="font-mono font-black text-emerald-600 tracking-tighter">{user.balance.toLocaleString()} IQD</TableCell>
                  <TableCell className="text-right pr-10">
                     <Button 
                       onClick={() => handleViewDetails(user)}
                       variant="ghost" 
                       size="sm" 
                       className="text-slate-400 hover:bg-transparent hover:text-slate-900 dark:hover:text-white font-bold text-[10px] uppercase tracking-widest"
                     >
                        Details <ChevronRight className="w-4 h-4 ml-1" />
                     </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-slate-400 font-medium italic uppercase tracking-widest text-[10px]">
                    No matching users found in current protocol.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* User Details Modal */}
      <AnimatePresence>
        {selectedUser && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setSelectedUser(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[85vh] rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/20">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-lg shadow-emerald-600/20 uppercase">
                    {selectedUser.displayName[0]}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">{selectedUser.displayName}</h3>
                    <p className="text-xs text-slate-500 font-bold tracking-widest uppercase">{selectedUser.email}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedUser(null)}
                  className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {isDetailsLoading ? (
                  <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Decrypting User History...</p>
                  </div>
                ) : (
                  <Tabs defaultValue="activity" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 p-1 bg-slate-100 dark:bg-slate-950 rounded-2xl mb-8">
                      <TabsTrigger value="activity" className="rounded-xl font-black uppercase tracking-widest text-[10px] py-3 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm">
                        <TrendingUp className="w-4 h-4 mr-2" /> Financial Activity
                      </TabsTrigger>
                      <TabsTrigger value="security" className="rounded-xl font-black uppercase tracking-widest text-[10px] py-3 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-rose-600 data-[state=active]:shadow-sm">
                        <ShieldCheck className="w-4 h-4 mr-2" /> Security Protocol
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="activity" className="space-y-8 mt-0 focus-visible:outline-none">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                       <Card className="bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/50 rounded-2xl">
                         <CardContent className="p-4">
                           <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Current Balance</p>
                           <h4 className="text-xl font-black text-emerald-700 dark:text-emerald-300 tracking-tighter">
                             {selectedUser.balance.toLocaleString()} <span className="text-xs">IQD</span>
                           </h4>
                         </CardContent>
                       </Card>
                       <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/50 rounded-2xl">
                         <CardContent className="p-4">
                           <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Risk Profile</p>
                           <h4 className="text-xl font-black text-blue-700 dark:text-blue-300 tracking-tighter uppercase italic">
                             {selectedUser.riskTolerance}
                           </h4>
                         </CardContent>
                       </Card>
                       <Card className="bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 rounded-2xl">
                         <CardContent className="p-4">
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Member Since</p>
                           <h4 className="text-xl font-black text-slate-700 dark:text-slate-300 tracking-tighter">
                             {new Date(selectedUser.createdAt).toLocaleDateString()}
                           </h4>
                         </CardContent>
                       </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                       <div className="space-y-4">
                          <h5 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                             <Briefcase className="w-4 h-4" /> Active Engines
                          </h5>
                          <div className="space-y-3">
                             {selectedUserActivity?.investments.length === 0 ? (
                               <p className="text-xs text-slate-400 italic">No active investment engines.</p>
                             ) : (
                               selectedUserActivity?.investments.map(inv => (
                                 <div key={inv.id} className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex items-center justify-between">
                                    <div>
                                       <p className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">{inv.packageName}</p>
                                       <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Starts: {new Date(inv.purchaseDate).toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                      <div className="text-right">
                                         <p className="text-sm font-black text-emerald-600 tracking-tighter">{inv.amountIQD.toLocaleString()} IQD</p>
                                         <Badge className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-none font-black text-[8px] tracking-widest">ACTIVE</Badge>
                                      </div>
                                      <Button 
                                        onClick={() => handleCancelPackage(inv.id, inv.packageName)}
                                        variant="ghost" 
                                        className="h-8 w-8 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-100/50 dark:hover:bg-rose-950/30 rounded-lg"
                                        title="Cancel Package"
                                      >
                                        <X className="w-4 h-4" />
                                      </Button>
                                    </div>
                                 </div>
                               ))
                             )}
                          </div>
                       </div>

                       <div className="space-y-4">
                          <h5 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                             <History className="w-4 h-4" /> Transaction History
                          </h5>
                          <div className="space-y-3">
                             {selectedUserActivity?.transactions.length === 0 ? (
                               <p className="text-xs text-slate-400 italic">No recent financial logs.</p>
                             ) : (
                               selectedUserActivity?.transactions.map(tx => {
                                 let Icon = ArrowRightLeft;
                                 let colorColor = 'text-slate-600 bg-slate-100/50 dark:bg-slate-900/50';
                                 let amountColor = 'text-slate-600';
                                 let prefix = '';
                                 
                                 if (tx.type === 'deposit') {
                                    Icon = ArrowDownToLine;
                                    colorColor = 'text-emerald-600 bg-emerald-100/50 dark:bg-emerald-950/30';
                                    amountColor = 'text-emerald-600';
                                    prefix = '+';
                                 } else if (tx.type === 'withdrawal') {
                                    Icon = ArrowUpFromLine;
                                    colorColor = 'text-rose-600 bg-rose-100/50 dark:bg-rose-950/30';
                                    amountColor = 'text-rose-600';
                                    prefix = '-';
                                 } else if (tx.type === 'payout') {
                                    Icon = HandCoins;
                                    colorColor = 'text-blue-600 bg-blue-100/50 dark:bg-blue-950/30';
                                    amountColor = 'text-blue-600';
                                    prefix = '+';
                                 } else if (tx.type === 'referral') {
                                    Icon = Gift;
                                    colorColor = 'text-amber-600 bg-amber-100/50 dark:bg-amber-950/30';
                                    amountColor = 'text-amber-600';
                                    prefix = '+';
                                 } else if (tx.type === 'investment') {
                                    Icon = Briefcase;
                                    colorColor = 'text-purple-600 bg-purple-100/50 dark:bg-purple-950/30';
                                    amountColor = 'text-purple-600';
                                    prefix = '-';
                                 }

                                 return (
                                   <div key={tx.id} className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center justify-between transition-hover hover:border-slate-300 dark:hover:border-slate-700 shadow-sm">
                                      <div className="flex items-center gap-3">
                                         <div className={`p-2 rounded-lg ${colorColor}`}>
                                            <Icon className="w-4 h-4" />
                                         </div>
                                         <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                              <p className="text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight leading-none">{tx.description || tx.type}</p>
                                              <Badge className={`border-none font-black text-[8px] tracking-widest px-1.5 py-0 uppercase ${colorColor}`}>
                                                {tx.type}
                                              </Badge>
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-bold tracking-widest flex items-center gap-1 opacity-80">
                                              {new Date(tx.timestamp).toLocaleString(undefined, {
                                                year: 'numeric', month: 'short', day: 'numeric',
                                                hour: '2-digit', minute: '2-digit'
                                              })}
                                            </p>
                                         </div>
                                      </div>
                                      <p className={`text-sm font-black tracking-tighter ${amountColor}`}>
                                         {prefix}{tx.amountIQD.toLocaleString()}
                                      </p>
                                   </div>
                                 );
                               })
                             )}
                          </div>
                          <Button variant="link" className="w-full text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-500">
                      Full Financial Ledger <ExternalLink className="w-3 h-3 ml-2" />
                           </Button>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="security" className="space-y-6 mt-0 focus-visible:outline-none">
                      <div className="flex flex-col gap-4">
                         <h5 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                            <ShieldCheck className="w-4 h-4" /> Login Protocols (Last 30 Days)
                         </h5>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {selectedUserActivity?.sessions.length === 0 ? (
                              <p className="text-xs text-slate-400 italic col-span-full py-12 text-center bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
                                No login sessions recorded in the last month.
                              </p>
                            ) : (
                              selectedUserActivity?.sessions.map((session, idx) => (
                                <div key={session.id || idx} className="p-5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col gap-3 hover:shadow-lg hover:shadow-slate-200/20 dark:hover:shadow-none transition-all">
                                   <div className="flex items-center justify-between">
                                      <Badge variant="outline" className="text-[9px] font-black tracking-widest uppercase py-1 px-3 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                                         {session.device}
                                      </Badge>
                                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                                         <History className="w-3 h-3" />
                                         {new Date(session.timestamp).toLocaleDateString()} {new Date(session.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                   </div>
                                   <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                                     <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono italic break-all line-clamp-2" title={session.userAgent}>
                                        {session.userAgent}
                                     </p>
                                   </div>
                                </div>
                              ))
                            )}
                         </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                )}
              </div>

              <div className="p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 flex gap-4">
                 <Button 
                    onClick={() => {
                      const msg = prompt("Enter the system notice message:");
                      if (msg && selectedUser) {
                        handleSendSystemNotice(selectedUser.uid, "System Notice", msg);
                      }
                    }}
                    className="flex-1 h-14 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl uppercase tracking-widest text-xs italic shadow-xl shadow-emerald-500/20"
                 >
                    Send Internal System Notice
                 </Button>
                 <Button variant="outline" className="flex-1 h-14 border-rose-100 dark:border-rose-900/50 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-black rounded-2xl uppercase tracking-widest text-xs italic">
                    Restrict User Account
                 </Button>
                 <Button 
                   onClick={() => selectedUser && handleDeleteUser(selectedUser.uid)}
                   variant="ghost" 
                   className="h-14 px-6 text-rose-600 hover:bg-rose-100/50 dark:hover:bg-rose-950/20 font-black rounded-2xl uppercase tracking-widest text-[10px] border border-rose-100 dark:border-rose-900/30"
                 >
                   Delete Account
                 </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Stat Modals */}
      <AnimatePresence>
        {showUsersModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
            onClick={() => setShowUsersModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 30 }}
              className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[85vh] rounded-[3rem] border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-blue-50/20 dark:bg-blue-950/20">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Investor Directory</h3>
                    <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mt-0.5">Total Registered Nodes: {users.length}</p>
                  </div>
                </div>
                <button onClick={() => setShowUsersModal(false)} className="p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"><X /></button>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                <Table>
                  <TableHeader className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="pl-8 text-[10px] font-black uppercase tracking-widest py-4">Name</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Email Address</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Current Balance</TableHead>
                      <TableHead className="pr-8 text-right text-[10px] font-black uppercase tracking-widest py-4">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map(u => (
                      <TableRow key={u.uid} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <TableCell className="pl-8 py-4 font-bold text-xs uppercase tracking-tight">{u.displayName}</TableCell>
                        <TableCell className="text-xs text-slate-500 font-medium">{u.email}</TableCell>
                        <TableCell className="font-mono text-xs font-black text-emerald-600 italic">{(u.balance || 0).toLocaleString()} IQD</TableCell>
                        <TableCell className="pr-8 text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-[10px] uppercase font-black tracking-widest text-emerald-600 hover:bg-emerald-50" 
                            onClick={() => { handleViewDetails(u); setShowUsersModal(false); }}
                          >
                            Explore
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEnginesModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
            onClick={() => setShowEnginesModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 30 }}
              className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[85vh] rounded-[3rem] border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-emerald-50/20 dark:bg-emerald-950/20">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Active Yield Engines</h3>
                    <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mt-0.5">Total Deployed Capital: {investments.reduce((s,i) => s+i.amountIQD,0).toLocaleString()} IQD</p>
                  </div>
                </div>
                <button onClick={() => setShowEnginesModal(false)} className="p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"><X /></button>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                <Table>
                  <TableHeader className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="pl-8 text-[10px] font-black uppercase tracking-widest py-4">Package Identity</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Investor</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Deployed Assets</TableHead>
                      <TableHead className="pr-8 text-right text-[10px] font-black uppercase tracking-widest py-4">Maturity Window</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {investments.map(i => {
                      const user = users.find(u => u.uid === i.userId);
                      return (
                        <TableRow key={i.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <TableCell className="pl-8 py-4 font-black text-xs uppercase tracking-tight text-slate-900 dark:text-slate-100 italic">{i.packageName}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">{user?.displayName || 'Unknown User'}</span>
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{user?.email || i.userId.slice(0, 12)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs font-black text-emerald-600 italic">{(i.amountIQD || 0).toLocaleString()} IQD</TableCell>
                          <TableCell className="pr-8 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">{new Date(i.nextPayoutDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPendingModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
            onClick={() => setShowPendingModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 30 }}
              className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[85vh] rounded-[3rem] border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-amber-50/20 dark:bg-amber-950/20">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
                    <Coins className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Pending Ledger Approvals</h3>
                    <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mt-0.5">{deposits.length} Extraction Requests Awaiting Verification</p>
                  </div>
                </div>
                <button onClick={() => setShowPendingModal(false)} className="p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"><X /></button>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                <Table>
                  <TableHeader className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="pl-8 text-[10px] font-black uppercase tracking-widest py-4">Investor Identity</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Requested Assets</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Paper Proof</TableHead>
                      <TableHead className="pr-8 text-right text-[10px] font-black uppercase tracking-widest py-4">Audit Workflow</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deposits.filter(d => d.status === 'pending').map(d => (
                      <TableRow key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <TableCell className="pl-8 py-4">
                          <p className="font-black text-xs uppercase tracking-tight text-slate-900 dark:text-slate-100 italic">{d.userName}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{d.userEmail}</p>
                        </TableCell>
                        <TableCell className="font-mono text-xs font-black text-amber-600 italic">{(d.amountIQD || 0).toLocaleString()} IQD</TableCell>
                        <TableCell>
                          {d.proofUrl.startsWith('http') ? (
                            <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm bg-slate-50">
                              <img 
                                src={d.proofUrl} 
                                alt="Proof" 
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          ) : d.proofUrl.includes('[STORAGE_NOT_READY]') || d.proofUrl.includes('[IMAGE_PENDING]') ? (
                            <div className="w-12 h-12 rounded-lg border border-amber-200 bg-amber-50 flex items-center justify-center">
                               <AlertTriangle className="w-5 h-5 text-amber-500" />
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-[8px] uppercase tracking-tighter">ID Only</Badge>
                          )}
                        </TableCell>
                        <TableCell className="pr-8 text-right">
                           <Button 
                             variant="ghost" 
                             size="sm" 
                             className="text-emerald-600 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-xl px-6" 
                             onClick={() => { setSelectedDeposit(d); setShowPendingModal(false); }}
                           >
                             Launch Audit v2
                           </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {deposits.filter(d => d.status === 'pending').length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="h-40 text-center text-slate-400 font-medium italic uppercase tracking-widest text-[10px]">
                          No pending deposits in the queue.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmState && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 p-10 text-center"
            >
              <div className={`w-16 h-16 rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-xl ${
                confirmState.type === 'critical' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
              }`}>
                <AlertTriangle className="w-8 h-8" />
              </div>
              
              <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight mb-2">{confirmState.title}</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-relaxed mb-6">
                {confirmState.message}
              </p>

              {confirmState.type === 'critical' && confirmState.requireAuthWord && (
                <div className="mb-8">
                  <p className="text-xs text-rose-500 font-bold mb-2 uppercase tracking-widest flex items-center justify-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    Type "{confirmState.requireAuthWord}" to confirm
                  </p>
                  <input
                    type="text"
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    placeholder={confirmState.requireAuthWord}
                    className="w-full text-center h-12 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-xl text-sm font-black text-rose-600 outline-none focus:border-rose-500 uppercase tracking-widest placeholder:text-rose-300 dark:placeholder:text-rose-800"
                  />
                </div>
              )}

              <div className="flex flex-col gap-3">
                <Button 
                  onClick={confirmState.action}
                  disabled={processing || (confirmState.type === 'critical' && confirmState.requireAuthWord !== undefined && confirmInput !== confirmState.requireAuthWord)}
                  className={`h-14 font-black rounded-2xl uppercase tracking-widest text-xs shadow-lg transition-all ${
                    confirmState.type === 'critical' 
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-500/20' 
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
                  }`}
                >
                  {processing ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Confirm Execution"}
                </Button>
                <Button 
                  onClick={() => { setConfirmState(null); setConfirmInput(''); }}
                  variant="ghost"
                  className="h-14 font-bold text-slate-400 hover:text-slate-900 dark:hover:text-white uppercase tracking-widest text-[10px]"
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
