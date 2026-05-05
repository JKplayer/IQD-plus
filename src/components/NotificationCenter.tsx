import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, orderBy, limit } from 'firebase/firestore';
import { Bell, Check, Trash2, X, Info, Coins, TrendingUp, Wallet, Gift } from 'lucide-react';
import { AppNotification, OperationType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

interface NotificationCenterProps {
  userId: string;
}

export default function NotificationCenter({ userId }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(20)
    );
    
    const unsubscribe = onSnapshot(q, {
      next: (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification));
        setNotifications(docs);
        setLoading(false);
      },
      error: (err) => {
        console.error("Notifications fetch error:", err);
        handleFirestoreError(err, OperationType.LIST, 'notifications');
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [userId]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id: string) => {
    await updateDoc(doc(db, 'notifications', id), { read: true });
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    await Promise.all(unread.map(n => markAsRead(n.id)));
  };

  const deleteNotification = async (id: string) => {
    await deleteDoc(doc(db, 'notifications', id));
  };

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'payout': return <TrendingUp className="w-4 h-4 text-emerald-500" />;
      case 'deposit': return <Wallet className="w-4 h-4 text-blue-500" />;
      case 'withdrawal': return <Coins className="w-4 h-4 text-rose-500" />;
      case 'referral': return <Gift className="w-4 h-4 text-amber-500" />;
      default: return <Info className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="relative hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"
      >
        <Bell className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 w-4 h-4 bg-rose-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white dark:border-slate-900 animate-pulse">
            {unreadCount}
          </span>
        )}
      </Button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40 bg-black/5 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-4 w-[350px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] shadow-2xl z-50 overflow-hidden"
            >
              <div className="p-6 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Activity</h3>
                  {unreadCount > 0 && (
                    <Badge className="bg-emerald-500 text-white border-none text-[9px] font-black uppercase px-2 py-0.5">
                      {unreadCount} New
                    </Badge>
                  )}
                </div>
                <div className="flex gap-1">
                  {unreadCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-8 px-3 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-emerald-600">
                      Read All
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="h-8 w-8 rounded-full">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="max-h-[400px] overflow-y-auto custom-scrollbar p-2">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Syncing...</span>
                  </div>
                ) : notifications.length > 0 ? (
                  <div className="space-y-1">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`group relative p-4 rounded-2xl transition-all ${
                          !n.read 
                            ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100/50 dark:border-emerald-500/10' 
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent'
                        }`}
                      >
                        <div className="flex gap-4">
                          <div className={`mt-1 h-10 w-10 shrink-0 rounded-xl flex items-center justify-center ${
                            !n.read ? 'bg-white dark:bg-slate-800 shadow-sm' : 'bg-slate-100 dark:bg-slate-800/50'
                          }`}>
                            {getIcon(n.type)}
                          </div>
                          <div className="space-y-1 pr-6">
                            <p className="text-xs font-black text-slate-900 dark:text-slate-100 leading-tight uppercase tracking-tight">
                              {n.title}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                              {n.message}
                            </p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2">
                              {formatDistanceToNow(new Date(n.timestamp), { addSuffix: true })}
                            </p>
                          </div>
                        </div>

                        <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!n.read && (
                            <button
                              onClick={() => markAsRead(n.id)}
                              className="h-7 w-7 flex items-center justify-center bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors shadow-sm"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteNotification(n.id)}
                            className="h-7 w-7 flex items-center justify-center bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-rose-500 hover:text-white transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 gap-4 text-center px-8">
                    <div className="h-16 w-16 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                      <Bell className="w-8 h-8 text-slate-300" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Silence is Gold</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">No new alerts to process.</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
