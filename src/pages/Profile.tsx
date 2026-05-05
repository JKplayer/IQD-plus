import { useState } from 'react';
import { useAuth } from '../App';
import { db, logout, handleFirestoreError } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { OperationType } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { 
  ShieldCheck, 
  Bell, 
  LogOut, 
  Fingerprint, 
  Smartphone,
  ExternalLink,
  Mail,
  Camera,
  Activity,
  Globe,
  Lock,
  Moon,
  Info,
  Loader2,
  ChevronDown,
  Copy
} from 'lucide-react';
import { toast } from 'sonner';

export default function Profile() {
  const { profile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [riskTolerance, setRiskTolerance] = useState(profile?.riskTolerance || 'moderate');
  const [notificationSettings, setNotificationSettings] = useState(profile?.notificationSettings || {
    payouts: true,
    referrals: true,
    marketing: false
  });
  const [saving, setSaving] = useState(false);

  const handleUpdate = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const userRef = doc(db, 'users', profile.uid);
      await updateDoc(userRef, { 
        displayName,
        riskTolerance,
        notificationSettings
      });
      toast.success("Identity and Protocol settings updated.");
    } catch (error) {
      console.error(error);
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleNotification = (key: keyof typeof notificationSettings) => {
    setNotificationSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-4">
        <div>
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-none rounded-lg px-3 py-1 text-[10px] uppercase font-black tracking-[0.2em] mb-3">
            Secure Node
          </Badge>
          <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tight uppercase">Protocol Settings</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium italic max-w-xl">
             Manage your encrypted identity, network notification vectors, and capital deployment risk parameters.
          </p>
        </div>
        <div className="flex gap-4">
           <Button variant="outline" className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 rounded-2xl h-12 px-6 font-bold text-xs uppercase tracking-widest shadow-sm">
             <Globe className="w-4 h-4 mr-2" /> English (IQ)
           </Button>
           <Button onClick={logout} variant="outline" className="border-rose-100 dark:border-rose-900/50 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/40 rounded-2xl h-12 px-6 font-black text-xs uppercase tracking-widest shadow-sm">
              <LogOut className="w-4 h-4 mr-2" /> Disconnect
           </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Profile Sidebar */}
        <div className="lg:col-span-4 space-y-8">
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-[2.5rem] p-10 flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-indigo-500 to-rose-500" />
            
            <div className="relative group cursor-pointer mb-6">
              <Avatar className="h-32 w-32 ring-offset-8 ring-4 ring-slate-50 dark:ring-slate-800 shadow-2xl transition-all group-hover:scale-[1.02]">
                <AvatarImage src={profile?.photoURL} />
                <AvatarFallback className="bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 text-4xl font-black">
                  {profile?.displayName?.[0] || profile?.email?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-2 -right-2 bg-slate-900 dark:bg-emerald-600 border-4 border-white dark:border-slate-900 rounded-full p-3 shadow-xl hover:scale-110 transition-transform">
                 <Camera className="w-5 h-5 text-white" />
              </div>
            </div>
            
            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{profile?.displayName || 'Authorized User'}</h2>
            <div className="flex items-center gap-2 mt-2 mb-8">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Connection: Encrypted</p>
            </div>
            
            <div className="w-full grid grid-cols-2 gap-3">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Account</p>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase">{profile?.role}</p>
              </div>
            </div>
          </Card>

          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl p-8 overflow-hidden relative">
            <div className="relative z-10">
              <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-[0.2em] flex items-center gap-3 mb-8">
                <Bell className="w-4 h-4 text-emerald-500" />
                Notification Vectors
              </h3>
              <div className="space-y-6">
                 {[
                   { label: "Capital Dividends", key: "payouts", desc: "Alerts for daily yield generation." },
                   { label: "Network Rewards", key: "referrals", desc: "Notification when your nodes activate." },
                   { label: "System Intelligence", key: "marketing", desc: "Optional platform updates and alpha." }
                 ].map((n, i) => (
                   <div key={i} className="flex items-center justify-between group">
                      <div>
                        <p className="text-xs text-slate-900 dark:text-slate-100 font-black uppercase tracking-tight">{n.label}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium italic mt-0.5">{n.desc}</p>
                      </div>
                      <div 
                        onClick={() => toggleNotification(n.key as keyof typeof notificationSettings)}
                        className={`w-12 h-6 rounded-full p-1 transition-all duration-300 cursor-pointer relative shadow-inner ${notificationSettings[n.key as keyof typeof notificationSettings] ? 'bg-emerald-500' : 'bg-slate-100 dark:bg-slate-800'}`}
                      >
                         <div className={`w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-md ${notificationSettings[n.key as keyof typeof notificationSettings] ? 'translate-x-6' : 'translate-x-0'}`} />
                      </div>
                   </div>
                 ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Main Settings Body */}
        <div className="lg:col-span-8 space-y-8">
           <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-[2.5rem] overflow-hidden">
             <CardHeader className="p-10 pb-0">
               <CardTitle className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Identity & Deployment</CardTitle>
               <CardDescription className="text-slate-500 dark:text-slate-400 font-medium italic">Adjust the fundamental parameters of your investor profile.</CardDescription>
             </CardHeader>
             <CardContent className="p-10 space-y-10">
                <div className="grid grid-cols-1 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Full Entity Name</label>
                    <Input 
                       value={displayName || ''} 
                       onChange={(e) => setDisplayName(e.target.value)}
                       placeholder="Enter legal name"
                       className="bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-800 rounded-2xl h-14 px-6 font-bold text-slate-900 dark:text-white focus-visible:ring-emerald-500/20"
                    />
                  </div>
                </div>
               
               <Separator className="bg-slate-50 dark:bg-slate-800" />
               
               <div className="space-y-6">
                 <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight flex items-center gap-2">
                   <Info className="w-4 h-4 text-emerald-500" />
                   Protocol Information
                 </h4>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div 
                      onClick={() => {
                        if (profile?.email) {
                          navigator.clipboard.writeText(profile.email);
                          toast.success("Email copied to clipboard");
                        }
                      }}
                      className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 cursor-pointer hover:border-emerald-500/30 transition-colors group relative"
                    >
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Encrypted Mail</p>
                       <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate pr-6">{profile?.email}</p>
                       <Copy className="w-3 h-3 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div 
                      onClick={() => {
                        if (profile?.uid) {
                          navigator.clipboard.writeText(profile.uid);
                          toast.success("Entity ID copied to clipboard");
                        }
                      }}
                      className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 cursor-pointer hover:border-emerald-500/30 transition-colors group relative"
                    >
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Entity ID</p>
                       <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate pr-6">#{profile?.uid.slice(0, 12)}</p>
                       <Copy className="w-3 h-3 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Created</p>
                       <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{new Date(profile?.createdAt || '').toLocaleDateString()}</p>
                    </div>
                 </div>
               </div>

               <div className="flex justify-end pt-4">
                  <Button 
                    onClick={handleUpdate} 
                    disabled={saving}
                    className="bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white font-black rounded-2xl px-12 h-16 shadow-2xl hover:scale-[1.02] transition-all uppercase tracking-widest text-xs"
                  >
                    {saving ? "Synchronizing Nodes..." : "Save Protocol Settings"}
                  </Button>
               </div>
             </CardContent>
           </Card>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="bg-slate-900 text-white rounded-[2.5rem] p-10 relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Lock className="w-32 h-32" />
                 </div>
                 <div className="relative">
                    <h3 className="text-lg font-black uppercase tracking-tight mb-4">Security Layer</h3>
                    <p className="text-slate-400 text-sm font-medium italic mb-8">Manage authentication methods and cryptographic keys.</p>
                    <div className="space-y-4">
                       <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">2FA Status</span>
                          <span className="text-[10px] font-bold uppercase text-white">Active</span>
                       </div>
                       <Button variant="ghost" className="w-full justify-start text-slate-400 hover:text-white hover:bg-white/5 font-bold text-xs uppercase tracking-widest p-0">
                          Configure Keys <ExternalLink className="w-3 h-3 ml-2" />
                       </Button>
                    </div>
                 </div>
              </Card>

              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-[2.5rem] p-10 group hover:border-emerald-500/30 transition-colors">
                 <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight mb-4">Preference Nodes</h3>
                 <div className="space-y-6">
                    <div className="flex items-center justify-between group/pref">
                       <div>
                          <p className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase">Currency Vector</p>
                          <p className="text-[10px] font-medium text-slate-400 italic">Preferred display unit.</p>
                       </div>
                       <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-none rounded-lg font-bold">IQD</Badge>
                    </div>
                    <div className="flex items-center justify-between group/pref">
                       <div>
                          <p className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase">Interface Mode</p>
                          <p className="text-[10px] font-medium text-slate-400 italic">Toggle visual spectrum.</p>
                       </div>
                       <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer transition-colors shadow-inner border border-slate-100 dark:border-slate-800">
                          <Moon className="w-4 h-4" />
                       </div>
                    </div>
                 </div>
              </Card>
           </div>
        </div>
      </div>
    </div>
  );
}
