/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, where, orderBy, increment, getDocs, limit, addDoc } from 'firebase/firestore';
import { auth, db, loginWithGoogle, logout, handleFirestoreError } from './lib/firebase';
import { UserProfile, Transaction, Investment, OperationType } from './types';
import { Toaster } from '@/components/ui/sonner';
import { 
  Loader2, 
  LayoutDashboard, 
  Wallet, 
  TrendingUp, 
  Users, 
  History, 
  User as UserIcon, 
  ShieldCheck, 
  LogOut,
  Menu,
  X,
  Plus,
  ArrowDownLeft,
  Coins,
  BrainCircuit,
  MessageSquare,
  Bell,
  ArrowRight,
  ClipboardList,
  ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { ThemeProvider } from './components/theme-provider';
import { ThemeToggle } from './components/ThemeToggle';
import { Starfield } from './components/ui/starfield';

import Dashboard from './pages/Dashboard';
import Invest from './pages/Invest';
import HistoryPage from './pages/History';
import Referrals from './pages/Referrals';
import Profile from './pages/Profile';
import Deposit from './pages/Deposit';
import Withdraw from './pages/Withdraw';
import Admin from './pages/Admin';
import AdminTasks from './pages/AdminTasks';
import AdminDeposits from './pages/AdminDeposits';
import Landing from './pages/Landing';
import NotificationCenter from './components/NotificationCenter';
import SignUp from './components/SignUp';

// --- Contexts ---

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true, isAdmin: false });

export const useAuth = () => useContext(AuthContext);

// --- Components ---

function LoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white kurdish-grid">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
        className="sun-icon relative"
      >
        <TrendingUp className="w-16 h-16 text-emerald-500" />
      </motion.div>
      <div className="mt-8 text-center">
        <h1 className="text-3xl font-black tracking-tighter text-white">IQD<span className="text-emerald-500">plus</span></h1>
        <p className="mt-2 text-slate-400 font-medium animate-pulse tracking-widest uppercase text-[10px]">Initializing Kurdistan's Premier Portal</p>
      </div>
    </div>
  );
}

interface SidebarLinkProps {
  to: string;
  icon: any;
  label: string;
  active: boolean;
  key?: string;
}

function SidebarLink({ to, icon: Icon, label, active }: SidebarLinkProps) {
  return (
    <Link to={to} className="block group">
      <div className={`flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${
        active 
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
          : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900 border border-transparent'
      }`}>
        <Icon className={`w-5 h-5 mr-3 transition-transform duration-200 group-hover:scale-110 ${active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
        <span className="font-medium tracking-tight whitespace-nowrap">{label}</span>
      </div>
    </Link>
  );
}

function MainLayout({ children }: { children: ReactNode }) {
  const { user, profile, isAdmin } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const links = [
    { to: "/", icon: LayoutDashboard, label: "Overview" },
    { to: "/deposit", icon: Wallet, label: "Deposit" },
    { to: "/withdraw", icon: ArrowDownLeft, label: "Withdraw" },
    { to: "/invest", icon: Plus, label: "Invest Now" },
    { to: "/history", icon: History, label: "History" },
    { to: "/referrals", icon: Users, label: "Referrals" },
    { to: "/profile", icon: UserIcon, label: "Profile" },
  ];

  if (isAdmin) {
    links.push({ to: "/admin", icon: ShieldCheck, label: "Admin Panel" });
    links.push({ to: "/admin/tasks", icon: ClipboardList, label: "Operations" });
    links.push({ to: "/admin/deposits", icon: Coins, label: "Deposit Audit" });
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[rgb(5,8,15)] text-slate-900 dark:text-slate-100 selection:bg-emerald-500/30 font-sans transition-colors duration-300">
      <Starfield />
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-slate-200 dark:border-slate-800/30 bg-transparent sticky top-0 h-screen overflow-hidden shadow-sm relative z-10">
        <div className="px-6 py-8">
          <div className="flex items-center space-x-3 mb-10">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-600/20 sun-icon">
              <TrendingUp className="text-white w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tighter text-slate-800 dark:text-slate-100">IQDplus</span>
              <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-emerald-600 leading-none">Kurdistan</span>
            </div>
          </div>

          <nav className="space-y-1">
            {links.map(link => (
              <SidebarLink 
                key={link.to} 
                to={link.to} 
                icon={link.icon} 
                label={link.label} 
                active={location.pathname === link.to} 
              />
            ))}
          </nav>
        </div>

        <div className="mt-auto px-6 py-8 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800">
            <Avatar className="h-10 w-10 border border-slate-200 dark:border-slate-800 group-hover:border-emerald-500/50 transition-colors">
              <AvatarImage src={profile?.photoURL} />
              <AvatarFallback className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase">
                {profile?.displayName?.[0] || profile?.email?.[0]}
              </AvatarFallback>
            </Avatar>
            <div className="ml-3 overflow-hidden">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{profile?.displayName || 'User'}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate font-bold uppercase tracking-wider">
                {user?.email === 'wreawali27@gmail.com' ? 'Project Owner & Founder' : 
                 user?.email === 'sadakamal951@gmail.com' ? 'System Administrator' :
                 profile?.role}
              </p>
            </div>
            <button 
              onClick={logout}
              className="ml-auto p-2 text-slate-400 hover:text-rose-500 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-transparent overflow-hidden kurdish-gradient relative z-10">
        {/* Header */}
        <header className="h-20 shrink-0 flex items-center px-4 lg:px-8 bg-transparent sticky top-0 z-40 transition-colors duration-300">
          <button 
            className="lg:hidden p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white mr-2"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <div className="hidden lg:block">
            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-emerald-600 animate-pulse" />
              Node <span className="text-emerald-600">Central Portal</span>
            </h2>
          </div>

          <div className="ml-auto flex items-center space-x-6">
             <div className="hidden sm:flex items-center px-5 py-2 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 gap-3 group hover:border-emerald-500/40 transition-all cursor-default">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 group-hover:bg-emerald-500/20 transition-all">
                  <Wallet className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <p className="text-[8px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-[0.2em] leading-none mb-1.5">Portfolio Balance</p>
                  <p className="text-sm font-mono font-black leading-none text-slate-900 dark:text-slate-100 italic">
                    {profile?.balance.toLocaleString()} <span className="text-[10px] text-emerald-600 font-bold not-italic">IQD</span>
                  </p>
                </div>
             </div>
             
             <ThemeToggle />
             
             {profile && <NotificationCenter userId={profile.uid} />}
          </div>
        </header>

        <section className="flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-10 custom-scrollbar scroll-smooth">
          <div className="max-w-7xl mx-auto min-h-full">
            {children}
          </div>
        </section>
      </main>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 lg:hidden bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-72 h-full bg-white border-r border-slate-200 p-6 flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="text-emerald-600 w-6 h-6" />
                  <span className="text-xl font-bold text-slate-900 tracking-tighter uppercase">IQD+</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-400 hover:text-slate-900">
                   <X className="w-6 h-6" />
                </button>
              </div>

              <nav className="space-y-1">
                {links.map(link => (
                  <SidebarLink 
                    key={link.to} 
                    to={link.to} 
                    icon={link.icon} 
                    label={link.label} 
                    active={location.pathname === link.to} 
                  />
                ))}
              </nav>

              <div className="mt-auto pt-8 border-t border-slate-100">
                <button 
                  onClick={logout}
                  className="flex items-center w-full px-4 py-3 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                >
                  <LogOut className="w-5 h-5 mr-3" />
                  <span className="font-medium">Sign Out</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Pages ---

function AuthPage({ onBackLanding }: { onBackLanding: () => void }) {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  const handleLogin = async () => {
    setLoading(true);
    try {
      await loginWithGoogle();
      toast.success("Welcome back to IQDplus!");
    } catch (error: any) {
      console.error("Login detail:", error);
      
      if (error.code === 'auth/network-request-failed') {
        toast.error("Network error: This usually happens when third-party cookies are blocked or you're in a restricted iframe. Try opening the app in a new tab.", {
          duration: 8000,
        });
      } else if (error.code === 'auth/user-cancelled' || error.code === 'auth/popup-closed-by-user') {
        toast.info("Login cancelled. Please complete the sign-in process to continue.");
      } else if (error.code === 'auth/popup-blocked') {
        toast.error("Popup blocked! Please allow popups for this site to sign in.");
      } else {
        toast.error("Login failed: " + (error.message || "Unknown error"));
      }
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'signup') {
    return <SignUp onBack={() => setMode('login')} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 selection:bg-emerald-500/20 transition-colors duration-300">
      <div className="max-w-md w-full relative">
        <div className="absolute -top-24 -left-24 w-80 h-80 bg-emerald-200/40 dark:bg-emerald-900/20 rounded-full blur-[100px]" />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-indigo-200/30 dark:bg-indigo-900/10 rounded-full blur-[100px]" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-[2.5rem] border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl p-10 lg:p-14 text-center shadow-2xl shadow-slate-200/50 dark:shadow-none"
        >
          <div className="flex justify-between items-center mb-4 -mt-4">
             <Button
               variant="ghost"
               size="icon"
               onClick={onBackLanding}
               className="text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-full"
             >
               <ArrowLeft className="w-5 h-5" />
             </Button>
             <ThemeToggle />
          </div>
          <div className="w-20 h-20 bg-emerald-600 rounded-3xl mx-auto flex items-center justify-center mb-8 shadow-xl shadow-emerald-600/20">
             <TrendingUp className="text-white w-10 h-10" />
          </div>
          
          <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white mb-4 font-sans uppercase">IQDplus</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-10 leading-relaxed text-lg">
            Invest in Iraq's rapid growth. Secure, transparent, and high-yield returns since 2026.
          </p>

          <div className="space-y-4">
            <Button 
              onClick={handleLogin}
              disabled={loading}
              className="w-full h-16 bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white font-bold rounded-2xl text-lg shadow-xl hover:shadow-2xl transition-all group overflow-hidden"
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <div className="flex items-center justify-center w-full">
                  <span>Access Dashboard</span>
                  <ArrowRight className="w-5 h-5 ml-3 group-hover:translate-x-1 transition-transform" />
                </div>
              )}
            </Button>

            <Button 
              onClick={() => setMode('signup')}
              variant="outline"
              className="w-full h-16 border-2 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-900 dark:text-white font-black rounded-2xl text-lg transition-all uppercase tracking-widest italic"
            >
              Register Account
            </Button>
          </div>

          <p className="mt-10 text-[10px] text-slate-400 leading-relaxed font-bold uppercase tracking-widest">
            Institutional Grade Security • 256-Bit Encrypted
          </p>
        </motion.div>
      </div>
    </div>
  );
}

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLanding, setShowLanding] = useState(true);

  useEffect(() => {
    // Capture referral code from URL
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get('ref');
    if (refCode) {
      localStorage.setItem('iqd_ref_code', refCode);
    }

    const unsubscribeAuth = onAuthStateChanged(auth, (authUser) => {
      setUser(authUser);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const userRef = doc(db, 'users', user.uid);
    const unsubscribeProfile = onSnapshot(userRef, {
      next: async (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as UserProfile;
          
          // Combined Patch for legacy data migration
          const patches: any = {};
          if (!data.uid) patches.uid = user.uid;
          if (data.profitBalance === undefined) patches.profitBalance = 0;
          if (data.phoneNumber === undefined) {
            patches.phoneNumber = '';
          }

          if (Object.keys(patches).length > 0) {
            // updateDoc(userRef, patches).catch(err => console.error("Legacy migration failed:", err));
            // Optimistically update local data object
            Object.assign(data, patches);
          }
          
          setProfile(data);
          
          // Auto-promote privileged emails to admin role if not already
          const adminEmails = ['wreawali27@gmail.com', 'sadakamal951@gmail.com'];
          if (adminEmails.includes(user.email!) && data.role !== 'admin') {
            updateDoc(userRef, { role: 'admin' }).catch(err => {
              console.error("Auto-promotion failed:", err);
            });
          }
        } else {
          // New User Creation
          const role = (user.email === 'wreawali27@gmail.com' || user.email === 'sadakamal951@gmail.com') ? 'admin' : 'user';
          
          // Check for stored referral code
          let referredBy = '';
          const storedRefCode = localStorage.getItem('iqd_ref_code');
          if (storedRefCode) {
            try {
              const q = query(collection(db, 'users'), where('referralCode', '==', storedRefCode), limit(1));
              const refSnap = await getDocs(q);
              if (!refSnap.empty) {
                referredBy = refSnap.docs[0].id;
              }
            } catch (e) {
              console.error("Referral lookup failed:", e);
            }
          }

          const newProfile: UserProfile = {
            uid: user.uid,
            email: user.email!,
            displayName: user.displayName || 'Iraqi Investor',
            photoURL: user.photoURL || '',
            phoneNumber: '',
            role: role as any,
            referralCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
            referredBy: referredBy || "",
            balance: 0,
            profitBalance: 0,
            totalInvested: 0,
            riskTolerance: 'moderate',
            createdAt: new Date().toISOString()
          };
          await setDoc(userRef, newProfile).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`));
          localStorage.removeItem('iqd_ref_code'); // Clean up
        }

        // Record Session (once per app load while logged in)
        const sessionRecorded = sessionStorage.getItem(`session_recorded_${user.uid}`);
        if (!sessionRecorded) {
          const ua = window.navigator.userAgent;
          let device = "Desktop / Browser";
          if (/mobile/i.test(ua)) device = "Mobile Device";
          else if (/tablet/i.test(ua)) device = "Tablet";
          
          addDoc(collection(db, 'sessions'), {
            userId: user.uid,
            timestamp: new Date().toISOString(),
            userAgent: ua,
            device: device
          }).catch(err => handleFirestoreError(err, OperationType.CREATE, 'sessions'));
          sessionStorage.setItem(`session_recorded_${user.uid}`, 'true');
        }

        setLoading(false);
      },
      error: (err) => {
        // If we are currently logged in, this is a real error
        if (auth.currentUser) {
          console.error("Profile sync failure:", err);
          handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
        }
        setLoading(false);
      }
    });

    return () => unsubscribeProfile();
  }, [user]);

  if (loading) return <LoadingScreen />;

  if (!user && showLanding) {
    return (
      <ThemeProvider defaultTheme="light" storageKey="iqd-plus-theme">
        <Landing onStart={() => setShowLanding(false)} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider defaultTheme="light" storageKey="iqd-plus-theme">
      <AuthContext.Provider value={{ user, profile, loading, isAdmin: profile?.role === 'admin' || user?.email === 'wreawali27@gmail.com' || user?.email === 'sadakamal951@gmail.com' }}>
        <BrowserRouter>
          <AnimatePresence mode="wait">
            {!user ? (
              <AuthPage onBackLanding={() => setShowLanding(true)} />
            ) : (
              <MainLayout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/invest" element={<Invest />} />
                  <Route path="/deposit" element={<Deposit />} />
                  <Route path="/withdraw" element={<Withdraw />} />
                  <Route path="/history" element={<HistoryPage />} />
                  <Route path="/referrals" element={<Referrals />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="/admin/tasks" element={<AdminTasks />} />
                  <Route path="/admin/deposits" element={<AdminDeposits />} />
                  <Route path="*" element={<Navigate to="/" />} />
                </Routes>
              </MainLayout>
            )}
          </AnimatePresence>
          <Toaster position="top-right" theme="dark" closeButton richColors />
        </BrowserRouter>
      </AuthContext.Provider>
    </ThemeProvider>
  );
}
