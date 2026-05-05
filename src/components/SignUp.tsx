import React, { useState } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, ArrowRight, Loader2, Mail, Lock, User, Calendar, MapPin, ArrowLeft, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { auth, db } from '../lib/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, query, collection, where, getDocs, limit } from 'firebase/firestore';
import { toast } from 'sonner';
import { UserProfile } from '../types';

// Local UI Components since shadcn/ui isn't fully set up with Input/Label
const Input = ({ className, ...props }: any) => (
  <input 
    className={`flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus-visible:ring-emerald-300 ${className}`}
    {...props}
  />
);

const Label = ({ children, className, ...props }: any) => (
  <label 
    className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`}
    {...props}
  >
    {children}
  </label>
);

interface SignUpProps {
  onBack: () => void;
}

export default function SignUp({ onBack }: SignUpProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
    firstName: '',
    surname: '',
    birthDate: '',
    phoneNumber: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      return toast.error("Passwords do not match");
    }

    if (formData.password.length < 6) {
      return toast.error("Password must be at least 6 characters");
    }

    if (!formData.phoneNumber.startsWith('+')) {
      return toast.error("Phone number must include country code (e.g., +964...)");
    }

    setLoading(true);
    try {
      // 1. Create Auth User
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;

      // 2. Update Auth Profile
      await updateProfile(user, {
        displayName: `${formData.firstName} ${formData.surname}`
      });

      // 3. Create Firestore Profile
      const userRef = doc(db, 'users', user.uid);
      
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
        email: formData.email,
        displayName: `${formData.firstName} ${formData.surname}`,
        firstName: formData.firstName,
        surname: formData.surname,
        username: formData.username,
        birthDate: formData.birthDate,
        phoneNumber: formData.phoneNumber,
        photoURL: '',
        role: 'user',
        referralCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
        referredBy: referredBy || "",
        balance: 0,
        profitBalance: 0,
        totalInvested: 0,
        riskTolerance: 'moderate',
        createdAt: new Date().toISOString()
      };

      await setDoc(userRef, newProfile);
      localStorage.removeItem('iqd_ref_code'); // Clean up
      toast.success("Account created successfully! Welcome to IQDplus.");
    } catch (error: any) {
      console.error("SignUp error:", error);
      toast.error(error.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 selection:bg-emerald-500/20 transition-colors duration-300 py-12">
      <div className="max-w-md w-full relative">
        <div className="absolute -top-24 -left-24 w-80 h-80 bg-emerald-200/40 dark:bg-emerald-900/20 rounded-full blur-[100px]" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-[2.5rem] border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl p-8 lg:p-10 shadow-2xl shadow-slate-200/50 dark:shadow-none"
        >
          <button 
            onClick={onBack}
            className="flex items-center text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors mb-6 text-sm font-bold uppercase tracking-widest group"
          >
            <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Login
          </button>

          <div className="flex items-center space-x-4 mb-8">
            <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-600/20">
              <TrendingUp className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white font-sans uppercase leading-none">Register</h1>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">Join the Iraqi Investment Frontier</p>
            </div>
          </div>

          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">First Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    name="firstName"
                    placeholder="Ali" 
                    value={formData.firstName}
                    onChange={handleChange}
                    required
                    className="pl-10 h-12 rounded-xl bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Surname</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    name="surname"
                    placeholder="Hassan" 
                    value={formData.surname}
                    onChange={handleChange}
                    required
                    className="pl-10 h-12 rounded-xl bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Username</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  name="username"
                  placeholder="ali_investor" 
                  value={formData.username}
                  onChange={handleChange}
                  required
                  className="pl-10 h-12 rounded-xl bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  name="phoneNumber"
                  placeholder="+964 770 123 4567" 
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  required
                  className="pl-10 h-12 rounded-xl bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Birth Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  name="birthDate"
                  type="date"
                  value={formData.birthDate}
                  onChange={handleChange}
                  required
                  className="pl-10 h-12 rounded-xl bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  name="email"
                  type="email"
                  placeholder="ali@example.com" 
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="pl-10 h-12 rounded-xl bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Create Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  name="password"
                  type="password"
                  placeholder="••••••••" 
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="pl-10 h-12 rounded-xl bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  name="confirmPassword"
                  type="password"
                  placeholder="••••••••" 
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  className="pl-10 h-12 rounded-xl bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800"
                />
              </div>
            </div>

            <Button 
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-md shadow-xl hover:shadow-2xl transition-all group overflow-hidden mt-6 uppercase tracking-widest italic"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <div className="flex items-center justify-center w-full">
                  <span>Confirm Registration</span>
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              )}
            </Button>
          </form>

          <p className="mt-8 text-[10px] text-slate-400 leading-relaxed font-bold uppercase tracking-widest text-center">
            By registering, you agree to our <br />
            <span className="text-emerald-500 cursor-pointer">Terms of Service</span> & <span className="text-emerald-500 cursor-pointer">Security Protocol</span>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
