
import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { db, auth, handleFirestoreError } from '../lib/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc, 
  where,
  getDocs
} from 'firebase/firestore';
import { AdminTask, OperationType, UserProfile } from '../types';
import { 
  ClipboardList, 
  Plus, 
  CheckCircle2, 
  Circle, 
  Clock, 
  AlertCircle, 
  UserPlus, 
  Trash2,
  Filter,
  Search,
  MoreVertical,
  Calendar,
  Tag
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription,
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

const statusColors = {
  'todo': 'bg-slate-500',
  'in-progress': 'bg-blue-500',
  'completed': 'bg-emerald-500',
  'on-hold': 'bg-amber-500'
};

const priorityColors = {
  'low': 'bg-slate-400',
  'medium': 'bg-blue-400',
  'high': 'bg-orange-500',
  'critical': 'bg-rose-600'
};

export default function AdminTasks() {
  const { isAdmin, user } = useAuth();
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [admins, setAdmins] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // New Task Form
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as AdminTask['priority'],
    category: 'support' as AdminTask['category'],
    assigneeId: ''
  });

  useEffect(() => {
    if (!isAdmin) return;

    // Fetch Tasks
    const qTasks = query(collection(db, 'admin_tasks'), orderBy('createdAt', 'desc'));
    const unsubTasks = onSnapshot(qTasks, {
      next: (snap) => {
        setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdminTask)));
        setLoading(false);
      },
      error: (err) => handleFirestoreError(err, OperationType.LIST, 'admin_tasks')
    });

    // Fetch Other Admins
    const qAdmins = query(collection(db, 'users'), where('role', '==', 'admin'));
    getDocs(qAdmins).then(snap => {
      setAdmins(snap.docs.map(d => ({ ...d.data() } as UserProfile)));
    });

    return () => unsubTasks();
  }, [isAdmin]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;

    try {
      const assignee = admins.find(a => a.uid === newTask.assigneeId);
      
      const taskData: Omit<AdminTask, 'id'> = {
        creatorId: user?.uid || '',
        creatorEmail: user?.email || '',
        assigneeId: newTask.assigneeId || undefined,
        assigneeEmail: assignee?.email || undefined,
        title: newTask.title,
        description: newTask.description,
        status: 'todo',
        priority: newTask.priority,
        category: newTask.category,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'admin_tasks'), taskData);
      toast.success("Operational task created and indexed.");
      setIsCreateOpen(false);
      setNewTask({ title: '', description: '', priority: 'medium', category: 'support', assigneeId: '' });
    } catch (err) {
      console.error(err);
      toast.error("Failed to commit task to ledger.");
    }
  };

  const handleUpdateStatus = async (taskId: string, status: AdminTask['status']) => {
    try {
      await updateDoc(doc(db, 'admin_tasks', taskId), {
        status,
        updatedAt: new Date().toISOString()
      });
      toast.success(`Task status updated to ${status.toUpperCase()}`);
    } catch (err) {
      toast.error("Status update protocol failed.");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Permanent deletion of this operational task?")) return;
    try {
      await deleteDoc(doc(db, 'admin_tasks', taskId));
      toast.success("Task purged from records.");
    } catch (err) {
      toast.error("Purge operation failed.");
    }
  };

  const filteredTasks = tasks.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         t.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <AlertCircle className="w-16 h-16 text-rose-500 mb-4" />
        <h2 className="text-2xl font-bold uppercase tracking-tighter">Security Violation</h2>
        <p className="text-slate-500 mt-2 italic">Protocol 403: Admin clearance required for task oversight.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-3 uppercase">
             <ClipboardList className="w-8 h-8 text-blue-600" />
             Admin Operations
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium italic">Task orchestration and internal workflow management.</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger render={
            <Button className="bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl px-8 h-12 shadow-xl shadow-blue-500/20 transition-all uppercase text-[10px] tracking-widest">
              <Plus className="w-4 h-4 mr-2" />
              Initialize Task
            </Button>
          } />
          <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase tracking-tight">New Operational Task</DialogTitle>
              <DialogDescription>Define a new objective for the administration node.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateTask} className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Objective Title</label>
                <Input 
                  value={newTask.title}
                  onChange={e => setNewTask({...newTask, title: e.target.value})}
                  placeholder="e.g. Verify High-Volume Deposit"
                  className="rounded-xl border-slate-200 dark:border-slate-800"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Intelligence Details</label>
                <Textarea 
                  value={newTask.description}
                  onChange={e => setNewTask({...newTask, description: e.target.value})}
                  placeholder="Extended task parameters..."
                  className="rounded-xl border-slate-200 dark:border-slate-800 min-h-[100px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Priority Tier</label>
                  <select 
                    value={newTask.priority}
                    onChange={e => setNewTask({...newTask, priority: e.target.value as any})}
                    className="w-full h-10 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-sm"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Category</label>
                  <select 
                    value={newTask.category}
                    onChange={e => setNewTask({...newTask, category: e.target.value as any})}
                    className="w-full h-10 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-sm"
                  >
                    <option value="deposit">Deposit Verification</option>
                    <option value="withdrawal">Withdrawal Ops</option>
                    <option value="support">User Support</option>
                    <option value="maintenance">Sys Maintenance</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Assign Node (Optional)</label>
                <select 
                  value={newTask.assigneeId}
                  onChange={e => setNewTask({...newTask, assigneeId: e.target.value})}
                  className="w-full h-10 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-sm"
                >
                  <option value="">Unassigned (Open Queue)</option>
                  {admins.map(admin => (
                    <option key={admin.uid} value={admin.uid}>{admin.displayName} ({admin.email})</option>
                  ))}
                </select>
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl h-12 uppercase text-xs tracking-widest">
                  Deploy Objective
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Search tasks..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10 rounded-xl border-slate-200 dark:border-slate-800 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400 hidden md:block" />
          <div className="grid grid-cols-2 lg:flex gap-2 flex-1">
            {['all', 'todo', 'in-progress', 'completed', 'on-hold'].map(status => (
              <Button
                key={status}
                variant={filterStatus === status ? 'default' : 'outline'}
                onClick={() => setFilterStatus(status)}
                className={`text-[10px] font-black uppercase tracking-widest h-9 rounded-lg px-4 ${
                  filterStatus === status && status !== 'all' ? statusColors[status as keyof typeof statusColors] : ''
                }`}
              >
                {status}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Clock className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center p-12 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
          <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs italic">No operational objectives currently active.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredTasks.map((task) => (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="group"
              >
                <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl overflow-hidden hover:shadow-xl hover:border-blue-500/20 transition-all">
                  <CardHeader className="p-5 pb-2">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge className={`${priorityColors[task.priority]} text-white text-[8px] uppercase font-black tracking-widest px-1.5 py-0`}>
                            {task.priority}
                          </Badge>
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                            <Tag className="w-2.5 h-2.5" />
                            {task.category}
                          </span>
                        </div>
                        <CardTitle className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100 group-hover:text-blue-600 transition-colors">
                          {task.title}
                        </CardTitle>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={
                          <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        } />
                        <DropdownMenuContent align="end" className="rounded-xl border-slate-200 dark:border-slate-800">
                          <DropdownMenuItem onClick={() => handleUpdateStatus(task.id, 'todo')} className="text-xs font-bold uppercase tracking-widest">Mark Todo</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleUpdateStatus(task.id, 'in-progress')} className="text-xs font-bold uppercase tracking-widest">Mark In-Progress</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleUpdateStatus(task.id, 'completed')} className="text-xs font-bold uppercase tracking-widest">Mark Completed</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleUpdateStatus(task.id, 'on-hold')} className="text-xs font-bold uppercase tracking-widest">Mark On-Hold</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteTask(task.id)} className="text-xs font-bold uppercase tracking-widest text-rose-500">Delete Permanently</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="p-5 pt-0">
                    <p className="text-xs text-slate-500 leading-relaxed italic mb-4 line-clamp-3 min-h-[3rem]">
                      {task.description || "No specific details provided."}
                    </p>
                    
                    <div className="flex flex-col gap-3 pt-4 border-t border-slate-50 dark:border-slate-800">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          {new Date(task.createdAt).toLocaleDateString()}
                        </span>
                        <Badge className={`${statusColors[task.status]} text-white text-[8px] uppercase font-black tracking-tighter px-2 py-0.5 rounded-full`}>
                          {task.status.replace('-', ' ')}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl">
                        <div className="p-1.5 rounded-lg bg-white dark:bg-slate-700 shadow-sm">
                          <UserPlus className="w-3 h-3 text-slate-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1">Assignee</p>
                          <p className="text-[10px] font-black text-slate-700 dark:text-slate-300 truncate">
                            {task.assigneeEmail || "Unassigned Queue"}
                          </p>
                        </div>
                        {task.status !== 'completed' && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 hover:bg-emerald-500/10 hover:text-emerald-500"
                            onClick={() => handleUpdateStatus(task.id, 'completed')}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
