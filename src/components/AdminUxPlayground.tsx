import React, { useState, useEffect } from "react";
import { Sparkles, Loader2, Play, Eye, RotateCcw, Layout, Layers, ShieldCheck, Check } from "lucide-react";

interface AdminUxPlaygroundProps {
  lang: "en" | "bn";
}

export const AdminUxPlayground: React.FC<AdminUxPlaygroundProps> = ({ lang }) => {
  // Option 1: Single Button Loading states
  const [btn1Loading, setBtn1Loading] = useState(false);
  const [btn2Loading, setBtn2Loading] = useState(false);
  const [btn3Loading, setBtn3Loading] = useState(false);

  // Option 2: Full Section Loading overlay simulation
  const [sectionLoading, setSectionLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");

  const runSectionSimulation = () => {
    if (sectionLoading) return;
    setSectionLoading(true);
    setProgress(0);
    setStatusMessage(lang === "en" ? "Initializing cluster sync..." : "ক্লাস্টার সিঙ্ক শুরু হচ্ছে...");

    const steps = [
      { prg: 20, msg: lang === "en" ? "Checking inventory stocks..." : "ইনভেনটরি স্টক যাচাই করা হচ্ছে..." },
      { prg: 50, msg: lang === "en" ? "Compiling cash memos & databases..." : "ক্যাশ মেমো এবং ডাটাবেজ কম্পাইল করা হচ্ছে..." },
      { prg: 80, msg: lang === "en" ? "Broadcasting Webhook alerts..." : "ওয়েবহুক অ্যালার্ট ব্রডকাস্ট করা হচ্ছে..." },
      { prg: 100, msg: lang === "en" ? "Synchronization complete!" : "সিঙ্ক্রোনাইজেশন সম্পন্ন হয়েছে!" }
    ];

    let currentStepIndex = 0;
    const interval = setInterval(() => {
      if (currentStepIndex < steps.length) {
        setProgress(steps[currentStepIndex].prg);
        setStatusMessage(steps[currentStepIndex].msg);
        currentStepIndex++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setSectionLoading(false);
          setProgress(0);
        }, 1500); // Hold success state for 1.5 seconds
      }
    }, 1000);
  };

  const triggerSimulatedLoad = (setter: React.Dispatch<React.SetStateAction<boolean>>, duration: number = 2000) => {
    setter(true);
    setTimeout(() => setter(false), duration);
  };

  return (
    <div className="bg-white border border-stone-200 rounded-sm shadow-sm p-6 space-y-6 animate-studio-reveal" id="admin-ux-playground">
      {/* Header */}
      <div className="border-b border-stone-100 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
          <h3 className="font-display font-medium text-stone-950 uppercase tracking-widest text-sm">
            {lang === "en" ? "UX Performance Dashboard" : "ইউজার এক্সপেরিয়েন্স ল্যাব ও প্লেগ্রাউন্ড"}
          </h3>
        </div>
        <span className="text-[9px] bg-amber-100 text-amber-800 font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">
          {lang === "en" ? "Interactive Demo" : "ইন্টারেক্টিভ ডেমো"}
        </span>
      </div>

      <p className="text-[11px] text-stone-500 leading-relaxed font-sans">
        {lang === "en"
          ? "Ensure an flawless enterprise-grade administration flow. Below are ready-to-use UX configurations for implementing real-time loading spinners, automatic button disablers, and full-section responsive overlays."
          : "অ্যাডমিন প্যানেলের পারফরম্যান্স দ্বিগুণ করতে এবং কাজের গতি বাড়াতে নতুন ইউজার ইন্টারেকশন লাইভ টেস্ট করুন। যেকোনো বাটনে বা পুরো সেকশনে কীভাবে প্রসেসিং স্পিনার এবং ওভারলে যুক্ত করতে হবে তা নিচে সাজানো হয়েছে।"}
      </p>

      {/* Grid: Buttons vs Section Overlay */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Left Column: Single Button Loading states */}
        <div className="border border-stone-150 rounded p-4 space-y-4 bg-stone-50/40">
          <h4 className="font-mono text-[10px] text-stone-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3 h-3 text-stone-500" />
            <span>{lang === "en" ? "Single Button Loading States" : "সিঙ্গেল বাটন লোডিং স্টেটসমূহ"}</span>
          </h4>

          <div className="space-y-3">
            {/* Button 1: Save standard */}
            <div className="space-y-1.5">
              <span className="block text-[9px] text-stone-400 font-mono">1. STANDARD SAVE ACTION</span>
              <button
                type="button"
                disabled={btn1Loading}
                onClick={() => triggerSimulatedLoad(setBtn1Loading, 1500)}
                className="w-full bg-stone-900 hover:bg-stone-950 text-white font-mono text-xs font-bold py-2.5 px-4 uppercase tracking-wider rounded-sm shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
              >
                {btn1Loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    <span>{lang === "en" ? "Saving..." : "সংরক্ষণ হচ্ছে..."}</span>
                  </>
                ) : (
                  <>
                    <span>{lang === "en" ? "Save Product Changes" : "পণ্য পরিবর্তন সেভ করুন"}</span>
                  </>
                )}
              </button>
            </div>

            {/* Button 2: Upload Action */}
            <div className="space-y-1.5">
              <span className="block text-[9px] text-stone-400 font-mono">2. MEDIA UPLOAD & SYNC</span>
              <button
                type="button"
                disabled={btn2Loading}
                onClick={() => triggerSimulatedLoad(setBtn2Loading, 2500)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs font-bold py-2.5 px-4 uppercase tracking-wider rounded-sm shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
              >
                {btn2Loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="animate-pulse">{lang === "en" ? "Uploading to Drive..." : "ড্রাইভে আপলোড হচ্ছে..."}</span>
                  </>
                ) : (
                  <>
                    <span>{lang === "en" ? "Upload Stock Images" : "স্টক ইমেজ আপলোড করুন"}</span>
                  </>
                )}
              </button>
            </div>

            {/* Button 3: System Compilation */}
            <div className="space-y-1.5">
              <span className="block text-[9px] text-stone-400 font-mono">3. PROCESSING ORDER CYCLE</span>
              <button
                type="button"
                disabled={btn3Loading}
                onClick={() => triggerSimulatedLoad(setBtn3Loading, 3000)}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-mono text-xs font-bold py-2.5 px-4 uppercase tracking-wider rounded-sm shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
              >
                {btn3Loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{lang === "en" ? "Processing Invoice..." : "মেমো তৈরি হচ্ছে..."}</span>
                  </>
                ) : (
                  <>
                    <span>{lang === "en" ? "Generate Digital Invoice" : "ডিজিটাল মেমো তৈরি করুন"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Section Loading overlay simulation */}
        <div className="border border-stone-150 rounded p-4 space-y-4 bg-stone-50/40 relative overflow-hidden flex flex-col justify-between">
          
          <h4 className="font-mono text-[10px] text-stone-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Layout className="w-3 h-3 text-stone-500" />
            <span>{lang === "en" ? "Full-Section Loading Overlay" : "পূর্ণ-সেকশন লোডিং ওভারলে"}</span>
          </h4>

          {/* Section Representation Box (with simulated list items) */}
          <div className="relative border border-stone-200 rounded p-3 bg-white space-y-2 select-none min-h-[140px] flex flex-col justify-center">
            {/* Live Glassmorphic overlay absolute div toggled on state */}
            {sectionLoading && (
              <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-4 transition-all animate-studio-reveal">
                <div className="bg-white/95 border border-stone-200 p-4 rounded shadow-xl max-w-[240px] w-full text-center space-y-3">
                  <div className="flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-mono text-stone-900 font-bold truncate">{statusMessage}</p>
                    <div className="w-full bg-stone-200 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-amber-500 h-1.5 transition-all duration-500 rounded-full" 
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="text-[8px] font-mono text-stone-400 font-bold">{progress}% COMPLETED</span>
                  </div>
                </div>
              </div>
            )}

            {/* Simulated Section Content (Visible on top-level) */}
            <div className="space-y-1.5 opacity-80">
              <div className="flex items-center justify-between text-[9px] font-mono text-stone-400 font-bold border-b border-stone-100 pb-1">
                <span>DATABASE CLUSTER CODE: RM-DRV-09</span>
                <span className="text-emerald-600">ONLINE</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-sans">
                  <span className="text-stone-600">Total Synchronized Memorandums</span>
                  <span className="font-mono font-black text-stone-900">4,812 Items</span>
                </div>
                <div className="flex justify-between text-[10px] font-sans">
                  <span className="text-stone-600">Active Google Drive Backup Node</span>
                  <span className="font-mono font-medium text-blue-600 underline">Riemart Root Cloud</span>
                </div>
              </div>
            </div>
          </div>

          {/* Trigger button for Section Loading compilation */}
          <button
            type="button"
            onClick={runSectionSimulation}
            disabled={sectionLoading}
            className="w-full bg-amber-600 hover:bg-amber-700 hover:shadow text-white font-mono text-xs font-bold py-2.5 px-4 uppercase tracking-wider rounded-sm shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{lang === "en" ? "Trigger Live Full Sync Test" : "লাইভ লোডিং ওভারলে টেস্ট রান"}</span>
          </button>
        </div>
      </div>

      <div className="bg-amber-50/50 border border-amber-200/40 rounded p-4 text-[11px] text-stone-700 leading-relaxed space-y-1">
        <h5 className="font-mono font-bold text-stone-900 uppercase flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>{lang === "en" ? "Dynamic Implementation Reference" : "বাস্তবায়ন নির্দেশিকা (কোডিং প্যাটর্ন)"}</span>
        </h5>
        <p className="font-sans">
          {lang === "en"
            ? "To add loading states or section overlays to any button/div inside your customized components, use the following React pattern:"
            : "প্রজেক্টের যেকোনো বাটন বা সেকশনে এই লোডিং অ্যানিমেশন ও নিঁখুত ব্যাকড্রপ ওভারলে যোগ করতে নিচের রিয়্যাক্ট প্যাটর্নটি ব্যবহার করুন:"}
        </p>
        <pre className="mt-2 bg-stone-950 text-emerald-400 p-3 rounded text-[10px] font-mono overflow-x-auto select-all shadow-inner leading-relaxed border border-stone-900">
{`// 1. Define active processing state
const [isSaving, setIsSaving] = useState(false);

// 2. Wrap your submission/click handler
const handleSave = async () => {
  setIsSaving(true);
  try {
    await saveToDatabase(); // Your asynchronous write operation
  } finally {
    setIsSaving(false); // Instantly returns back to default state
  }
};`}
        </pre>
      </div>
    </div>
  );
};
