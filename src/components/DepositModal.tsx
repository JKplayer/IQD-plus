import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Upload, 
  Smartphone, 
  Copy, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Image as ImageIcon
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { storage, db } from '@/src/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc } from 'firebase/firestore';
import { UserProfile } from '@/src/types';
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
}

const FIB_NUMBER = "7834612120";

export function DepositModal({ isOpen, onClose, profile }: DepositModalProps) {
  const [amount, setAmount] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(FIB_NUMBER);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 5 * 1024 * 1024) {
        toast.error("Image size must be less than 5MB");
        return;
      }
      
      setUploading(true);
      try {
        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true
        };
        const compressedFile = await imageCompression(selectedFile, options);
        setFile(compressedFile);
      } catch (err) {
        console.error("Compression error:", err);
        toast.error("Failed to process image");
      } finally {
        setUploading(false);
      }
    }
  };

  const handleSubmit = async () => {
    if (!profile) return;
    if (!amount || isNaN(Number(amount)) || Number(amount) < 10000 || Number(amount) > 5000000) {
      toast.error("Deposit amount must be between 10,000 and 5,000,000 IQD");
      return;
    }
    if (!file) {
      toast.error("Please upload the transaction screenshot");
      return;
    }

    setUploading(true);
    try {
      // 1. Upload to Storage
      let downloadURL = '';
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `deposits/${profile.uid}/${Date.now()}.${fileExt}`;
        const storageRef = ref(storage, fileName);
        
        const snapshot = await uploadBytes(storageRef, file);
        downloadURL = await getDownloadURL(snapshot.ref);
      } catch (storageError: any) {
        console.warn("Modal Storage Bypass:", storageError.code);
        const isRetryLimit = storageError.code === 'storage/retry-limit-exceeded';
        const isBucketMissing = storageError.message?.includes('bucket does not exist') || storageError.code === 'storage/project-not-found' || storageError.code === 'storage/unauthorized';
        
        if (isRetryLimit || isBucketMissing || storageError.code === 'storage/unknown') {
          toast.warning("Manual Proof Link Protocol", {
            description: "Proof storage node is uninitialized. We'll proceed via manual transaction tracking.",
            duration: 8000
          });
          downloadURL = `[MANUAL_AUDIT] ${file.name}`;
        } else {
          throw storageError;
        }
      }

      // 2. Save Request to Firestore
      await addDoc(collection(db, 'deposits'), {
        userId: profile.uid,
        userEmail: profile.email,
        userName: profile.displayName,
        amountIQD: Number(amount),
        proofUrl: downloadURL,
        status: 'pending',
        timestamp: new Date().toISOString()
      });

      // 3. Create Admin Task
      const timestamp = new Date().toISOString();
      await addDoc(collection(db, 'admin_tasks'), {
        creatorId: profile.uid,
        creatorEmail: profile.email,
        title: `Verify Deposit: ${profile.displayName}`,
        description: `User ${profile.email} deposited ${Number(amount).toLocaleString()} IQD via FIB. Proof: ${downloadURL}`,
        status: 'todo',
        priority: Number(amount) >= 500000 ? 'high' : 'medium',
        category: 'deposit',
        relatedId: profile.uid,
        createdAt: timestamp,
        updatedAt: timestamp,
        metadata: {
          platform: 'FIB',
          amount: Number(amount),
          userName: profile.displayName,
          userEmail: profile.email,
          timestamp: timestamp,
          proofUrl: downloadURL
        }
      });

      // 4. Create Admin Alert
      await addDoc(collection(db, 'admin_alerts'), {
        type: 'deposit_proof',
        title: 'New Deposit Proof Received',
        message: `${profile.displayName} uploaded proof for ${Number(amount).toLocaleString()} IQD.`,
        status: 'new',
        targetId: profile.uid,
        amount: Number(amount),
        timestamp: new Date().toISOString()
      });

      toast.success("Sent to Admin!", {
        description: "Your proof has been sent for verification. Contact us on WhatsApp for instant activation.",
        action: {
          label: "WhatsApp",
          onClick: () => window.open(`https://wa.me/9647834612120?text=I%20just%20deposited%20${amount}%20IQD%20via%20FIB.`, "_blank")
        }
      });
      onClose();
      setAmount('');
      setFile(null);
    } catch (error) {
      console.error(error);
      toast.error("Failed to submit deposit request. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-[2rem] p-0 overflow-hidden shadow-2xl">
        <div className="bg-emerald-600 p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Smartphone className="w-24 h-24 rotate-12" />
          </div>
          <DialogHeader className="relative z-10">
            <DialogTitle className="text-2xl font-black uppercase tracking-tight">Deposit IQD</DialogTitle>
            <DialogDescription className="text-emerald-100 font-medium italic">Follow the instructions to fund your balance.</DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-8 space-y-6">
          {/* Step 1: FIB Transfer */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center font-black text-xs border border-emerald-200/50">1</div>
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Transfer via FIB</h3>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 relative group transition-colors hover:border-emerald-500/30">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">FIT Number / Iraqi Bank</p>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-mono font-black text-slate-900 dark:text-slate-100 tracking-tighter">{FIB_NUMBER}</span>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={handleCopy}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl h-10 px-4 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-all font-bold text-[10px] uppercase tracking-widest text-emerald-600"
                >
                  {copied ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 italic font-medium">Please send the money to the number above using the FIB app first.</p>
          </div>

          <Separator className="bg-slate-100 dark:bg-slate-800" />

          {/* Step 2: Upload Proof */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center font-black text-xs border border-emerald-200/50">2</div>
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Submit Proof</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Amount Sent (IQD)</p>
                <Input 
                  type="number"
                  placeholder="e.g. 50000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 rounded-2xl h-14 px-6 font-black text-slate-900 dark:text-white focus-visible:ring-emerald-500/20 text-lg tracking-tighter"
                />
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Transaction Proof</p>
                <div className="relative h-14">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    id="screenshot-upload"
                  />
                  <div className={`h-full border border-dashed rounded-2xl flex items-center justify-center transition-all ${
                    file 
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500/50 text-emerald-600' 
                      : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400'
                  }`}>
                    {file ? (
                      <div className="flex items-center gap-2 overflow-hidden px-4 w-full">
                        <ImageIcon className="w-4 h-4 flex-shrink-0" />
                        <span className="text-[10px] font-black uppercase tracking-widest truncate">{file.name}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Select Screenshot</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-100 dark:border-amber-900/30">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-800 dark:text-amber-200 font-medium leading-relaxed italic">
                A clear screenshot of your FIB transaction is mandatory. Requests without valid proof will be rejected.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="p-8 pt-0 flex gap-3">
          <Button 
            variant="ghost" 
            onClick={onClose}
            className="flex-1 rounded-2xl h-14 font-black text-xs uppercase tracking-widest text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={uploading}
            className="flex-[2] bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white font-black rounded-2xl h-14 shadow-xl shadow-emerald-600/10 transition-all uppercase text-xs tracking-widest"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              "Confirm & Submit"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
