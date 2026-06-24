/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { safeLocalStorage as localStorage, safeSessionStorage as sessionStorage } from "./utils/safeStorage";
import { motion, AnimatePresence } from "motion/react";
import {
  ShoppingBag,
  ShoppingCart,
  Search,
  Lock,
  Unlock,
  X,
  Plus,
  Minus,
  Globe,
  Sparkles,
  Trash2,
  Settings,
  Activity,
  TrendingUp,
  RefreshCw,
  Sliders,
  FileText,
  CheckCircle,
  PlusCircle,
  Edit2,
  ChevronRight,
  ChevronLeft,
  Image,
  Eye,
  EyeOff,
  AlertTriangle,
  Compass,
  ArrowRight,
  Printer,
  Heart,
  ChevronDown,
  Bell,
  BellRing,
  Check,
  ClipboardList,
  User,
  Camera,
  QrCode,
  Cloud,
  Download,
  FileSpreadsheet,
  Upload,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CreditCard,
  MessageCircle,
  Facebook,
  Instagram,
  Truck,
  LogOut,
  Volume2,
  VolumeX,
  Loader2
} from "lucide-react";
import jsQR from "jsqr";
import QRCode from "qrcode";
import { generateInvoicePdfBlob } from "./utils/pdfGenerator";
import { Product, Category, StoreSettings, SystemLog, Order, Language, StarIconSvg } from "./types";
import { INITIAL_PRODUCTS, INITIAL_SETTINGS, INITIAL_LOGS, CATEGORIES, DICTIONARY, CATEGORY_TRANSLATIONS } from "./data";
import { AtelierQrStickerSpace } from "./components/AtelierQrStickerSpace";
import { AdminInventoryReportPanel, getProductMeasurement } from "./components/AdminInventoryReportPanel";
import { GoogleDrivePanel } from "./components/GoogleDrivePanel";
import { AdminDeliverySettingsPanel } from "./components/AdminDeliverySettingsPanel";
import { getStoredDriveToken, uploadInvoiceToFolder, googleDriveSignIn } from "./utils/googleDriveHelper";
import { ProductFormEditor } from "./components/ProductFormEditor";
import { PromoSettingsPanel } from "./components/PromoSettingsPanel";
import { AdminUxPlayground } from "./components/AdminUxPlayground";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie
} from "recharts";

const checkIfInsideIframe = (): boolean => {
  try {
    if (typeof window === "undefined" || !window.location) {
      return false;
    }
    // 1. Check window.location.ancestorOrigins (Standard in Chrome/Safari/Edge/WebKit/Blink)
    // This is 100% safe and never touches window.top/parent, completely avoiding security exception console warnings!
    if (window.location.ancestorOrigins) {
      return window.location.ancestorOrigins.length > 0;
    }
    // 2. Safe check with window.parent
    if (window.parent) {
      return window.parent !== window.self;
    }
    // 3. Fallback to window.top comparison
    return window.self !== window.top;
  } catch (err) {
    // If accessing parent/top throws a SecurityError/DOMException, we are definitely inside a cross-origin iframe!
    return true;
  }
};

const getSafeSpeechSynthesis = (): SpeechSynthesis | null => {
  try {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      return window.speechSynthesis;
    }
  } catch (err) {
    console.warn("[SafeStorage] SpeechSynthesis is blocked or restricted:", err);
  }
  return null;
};

function stripHugeBase64(value: any): any {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string") {
    if (value.length > 25000 && (value.startsWith("data:") || value.includes(";base64,"))) {
      return "data:image/svg+xml;charset=utf8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20/%3E";
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(item => stripHugeBase64(item));
  }
  if (typeof value === "object") {
    const cleaned: any = {};
    for (const key of Object.keys(value)) {
      cleaned[key] = stripHugeBase64(value[key]);
    }
    return cleaned;
  }
  return value;
}

function compressAndConvertAvatar(file: File, callback: (base64: string) => void): void {
  const reader = new FileReader();
  reader.onload = (event) => {
    const rawBase64 = event.target?.result as string;
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Force a perfect thumbnail dimension (max 120px)
        const MAX_DIM = 120;
        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          
          // Output high-quality, ultra-compact jpeg format (0.7 quality)
          const compressed = canvas.toDataURL("image/jpeg", 0.7);
          callback(compressed);
        } else {
          callback(rawBase64);
        }
      } catch (e) {
        console.warn("Canvas compression failed, falling back to raw reader URL:", e);
        callback(rawBase64);
      }
    };
    img.onerror = () => {
      callback(rawBase64);
    };
    img.src = rawBase64;
  };
  reader.readAsDataURL(file);
}

// ==========================================
// OPTIMIZED ULTRA-FAST FORM COMPONENTS to prevent keystroke lag on large trees
// ==========================================
interface UltraFastInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string;
  onChange: (val: string) => void;
  debounceMs?: number;
}

const UltraFastInput: React.FC<UltraFastInputProps> = ({ value, onChange, debounceMs = 150, ...props }) => {
  const [localVal, setLocalVal] = React.useState(value);
  const isFocusedRef = React.useRef(false);

  React.useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalVal(value);
    }
  }, [value]);

  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalVal(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onChange(val);
    }, debounceMs);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocusedRef.current = true;
    if (props.onFocus) props.onFocus(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocusedRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    onChange(localVal);
    if (props.onBlur) props.onBlur(e);
  };

  return (
    <input
      {...props}
      onFocus={handleFocus}
      onBlur={handleBlur}
      value={localVal}
      onChange={handleChange}
    />
  );
};

interface UltraFastTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> {
  value: string;
  onChange: (val: string) => void;
  debounceMs?: number;
}

const UltraFastTextarea: React.FC<UltraFastTextareaProps> = ({ value, onChange, debounceMs = 150, ...props }) => {
  const [localVal, setLocalVal] = React.useState(value);
  const isFocusedRef = React.useRef(false);

  React.useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalVal(value);
    }
  }, [value]);

  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLocalVal(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onChange(val);
    }, debounceMs);
  };

  const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    isFocusedRef.current = true;
    if (props.onFocus) props.onFocus(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    isFocusedRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    onChange(localVal);
    if (props.onBlur) props.onBlur(e);
  };

  return (
    <textarea
      {...props}
      onFocus={handleFocus}
      onBlur={handleBlur}
      value={localVal}
      onChange={handleChange}
    />
  );
};

interface UltraFastSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'> {
  value: string;
  onChange: (val: string) => void;
}

const UltraFastSelect: React.FC<UltraFastSelectProps> = ({ value, onChange, ...props }) => {
  const [localVal, setLocalVal] = React.useState(value);

  React.useEffect(() => {
    setLocalVal(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setLocalVal(val);
    onChange(val);
  };

  return (
    <select
      {...props}
      value={localVal}
      onChange={handleChange}
    />
  );
};

function safeSaveToLocalStorage(key: string, value: any): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error: any) {
    console.warn(`[Local Storage Quota Check] Failed to save "${key}" to localStorage:`, error.message || error);
    if (key !== "riemart_logs") {
      try {
        localStorage.removeItem("riemart_logs");
        localStorage.setItem(key, JSON.stringify(value));
      } catch (err: any) {
        console.warn(`[Local Storage Quota Check Retry] Failed to save "${key}" after clearing logs:`, err.message || err);
        try {
          // If still fails, save with stripped data for localStorage ONLY so the app doesn't crash, but do NOT contaminate the in-memory react state
          const cleaned = stripHugeBase64(value);
          localStorage.setItem(key, JSON.stringify(cleaned));
        } catch (finalErr: any) {
          console.error(`[Local Storage Quota Fatal] Complete failure to save "${key}":`, finalErr.message || finalErr);
        }
      }
    }
  }
}

function safeGetLocalStorageItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeRemoveLocalStorageItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {}
}

function convertDriveUrl(url: string): string {
  if (!url) return "";
  // Check if it's already an optimized/lh3 googleusercontent link
  if (url.includes("lh3.googleusercontent.com/d/")) {
    return url;
  }
  // Match Google Drive file ID format and convert to viewable URL
  const reg1 = /\/file\/d\/([a-zA-Z0-9_-]+)/;
  const reg2 = /id=([a-zA-Z0-9_-]+)/;
  const match1 = url.match(reg1);
  const match2 = url.match(reg2);
  const fileId = (match1 && match1[1]) || (match2 && match2[1]);
  if (fileId) {
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }
  return url;
}

function getOptimizedPrintImageUrl(url: string, size: number = 80): string {
  if (!url) return "";
  const direct = convertDriveUrl(url);
  if (direct.includes("lh3.googleusercontent.com/d/")) {
    if (direct.includes("=")) {
      return direct.split("=")[0] + `=s${size}`;
    }
    return `${direct}=s${size}`;
  }
  if (url.includes("images.unsplash.com")) {
    if (url.includes("?")) {
      return url.replace(/w=\d+/, `w=${size}`).replace(/q=\d+/, "q=60");
    }
    return `${url}?w=${size}&q=60&fit=crop`;
  }
  return direct;
}

const LazyAdminImage = ({ src, name }: { src?: string; name: string }) => {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const initial = name ? name.trim().charAt(0).toUpperCase() : "?";

  if (!src) {
    return (
      <div className="w-10 h-10 rounded bg-stone-100 border border-stone-200/60 flex items-center justify-center font-mono text-xs font-bold text-stone-500 shrink-0 select-none">
        {initial}
      </div>
    );
  }

  const optimizedSrc = getOptimizedPrintImageUrl(src, 120);

  return (
    <div className="w-10 h-10 rounded border border-stone-200 bg-stone-50 overflow-hidden shrink-0 relative flex items-center justify-center select-none">
      {!loaded && !error && (
        <div className="absolute inset-0 bg-stone-100 flex items-center justify-center font-mono text-xs font-bold text-stone-400 animate-pulse">
          {initial}
        </div>
      )}
      {error ? (
        <div className="w-full h-full bg-stone-100 flex items-center justify-center font-mono text-xs font-bold text-stone-405">
          {initial}
        </div>
      ) : (
        <img
          src={optimizedSrc}
          alt={name}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={`w-full h-full object-cover transition-opacity duration-200 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </div>
  );
};

const OptimizedInput = React.memo(({
  type = "text",
  value,
  onChange,
  className,
  placeholder,
  required,
  id,
  min,
  max,
  onFocus,
  onBlur,
}: {
  type?: string;
  value: string | number;
  onChange: (val: string) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
  id?: string;
  min?: string | number;
  max?: string | number;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
}) => {
  const [localValue, setLocalValue] = useState(value);
  const lastPropRef = useRef(value);
  const lastSentRef = useRef(value);

  // Sync with external state changes only (e.g. initial load or profile switch)
  useEffect(() => {
    if (value !== lastPropRef.current && value !== lastSentRef.current) {
      setLocalValue(value);
    }
    lastPropRef.current = value;
  }, [value]);

  // Debounced parent value propagation to isolate typing re-renders
  useEffect(() => {
    if (localValue === value) return;

    const timer = setTimeout(() => {
      lastSentRef.current = localValue;
      onChange(String(localValue));
    }, 300);

    return () => clearTimeout(timer);
  }, [localValue, value, onChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (localValue !== value) {
      lastSentRef.current = localValue;
      onChange(String(localValue));
    }
    if (onBlur) {
      onBlur(e);
    }
  };

  return (
    <input
      type={type}
      value={localValue === undefined || localValue === null ? "" : localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={onFocus}
      className={className}
      placeholder={placeholder}
      required={required}
      id={id}
      min={min}
      max={max}
    />
  );
});

const OptimizedTextarea = React.memo(({
  value,
  onChange,
  className,
  id,
  placeholder,
  required,
  onFocus,
  onBlur,
}: {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  id?: string;
  placeholder?: string;
  required?: boolean;
  onFocus?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
}) => {
  const [localValue, setLocalValue] = useState(value);
  const lastPropRef = useRef(value);
  const lastSentRef = useRef(value);

  useEffect(() => {
    if (value !== lastPropRef.current && value !== lastSentRef.current) {
      setLocalValue(value);
    }
    lastPropRef.current = value;
  }, [value]);

  useEffect(() => {
    if (localValue === value) return;

    const timer = setTimeout(() => {
      lastSentRef.current = localValue;
      onChange(localValue);
    }, 300);

    return () => clearTimeout(timer);
  }, [localValue, value, onChange]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalValue(e.target.value);
  };

  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    if (localValue !== value) {
      lastSentRef.current = localValue;
      onChange(localValue);
    }
    if (onBlur) {
      onBlur(e);
    }
  };

  return (
    <textarea
      value={localValue === undefined || localValue === null ? "" : localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={onFocus}
      className={className}
      id={id}
      placeholder={placeholder}
      required={required}
    />
  );
});


const PERFUME_SUBCATEGORIES = [
  { value: "Men Perfume", labelEn: "Men Perfume", labelBn: "Men Perfume" },
  { value: "Women Perfume", labelEn: "Women Perfume", labelBn: "Women Perfume" },
  { value: "Men & Women Body Spray", labelEn: "Men & Women Body Spray", labelBn: "Men & Women Body Spray" },
  { value: "Attar", labelEn: "Attar", labelBn: "Attar" }
];

const FOOD_BEVERAGE_SUBCATEGORIES = [
  { value: "Chocolate's", labelEn: "Chocolate's", labelBn: "চকলেট" },
  { value: "Honey", labelEn: "Honey", labelBn: "মধু" },
  { value: "Cheese", labelEn: "Cheese", labelBn: "পনির" },
  { value: "Oats", labelEn: "Oats", labelBn: "ওটস" },
  { value: "Drinks", labelEn: "Drinks", labelBn: "পানীয়" },
  { value: "Noodles", labelEn: "Noodles", labelBn: "নুডলস" },
  { value: "Pasta", labelEn: "Pasta", labelBn: "পাস্তা" },
  { value: "Milk", labelEn: "Milk", labelBn: "দুধ" },
  { value: "Biscuits", labelEn: "Biscuits", labelBn: "বিস্কুট" },
  { value: "Restaurant Products", labelEn: "Restaurant Products", labelBn: "রেস্টুরেন্ট" },
  { value: "Bakery Products", labelEn: "Bakery Products", labelBn: "বেকারি" }
];

const CLOTHING_SUBCATEGORIES = [
  // Men's Clothing
  { value: "Men's Shirt", labelEn: "Shirt", labelBn: "শার্ট", gender: "men" },
  { value: "Men's T-shirt", labelEn: "T-shirt", labelBn: "টি-শার্ট", gender: "men" },
  { value: "Men's Pant", labelEn: "Pant", labelBn: "প্যান্ট", gender: "men" },
  { value: "Men's Panjabi", labelEn: "Panjabi", labelBn: "পাঞ্জাবি", gender: "men" },
  { value: "Men's Under garments", labelEn: "Under garments", labelBn: "আন্ডারগার্মেন্টস (পুরুষ)", gender: "men" },
  // Women's Clothing
  { value: "Women's Sharie", labelEn: "Sharie", labelBn: "শাড়ি", gender: "women" },
  { value: "Women's Three piece", labelEn: "Three piece", labelBn: "থ্রি-পিস", gender: "women" },
  { value: "Women's Borka", labelEn: "Borka", labelBn: "বোরকা", gender: "women" },
  { value: "Women's Under garments", labelEn: "Under garments", labelBn: "আন্ডারগার্মেন্টস (নারী)", gender: "women" },
  { value: "Women's Nighty", labelEn: "Nighty", labelBn: "নাইটি", gender: "women" },
  { value: "Women's Fantasy clothes", labelEn: "Fantasy clothes", labelBn: "ফ্যান্টাসি পোশাক", gender: "women" },
  { value: "Women's Socks", labelEn: "Socks", labelBn: "মোজা", gender: "women" }
];

const COSMETICS_SUBCATEGORIES = [
  { value: "Colour cosmetics", labelEn: "Colour cosmetics", labelBn: "কালার কসমেটিকস" },
  { value: "body care", labelEn: "Body Care", labelBn: "বডি কেয়ার" },
  { value: "skin care", labelEn: "Skin Care", labelBn: "স্কিন কেয়ার" },
  { value: "hair care", labelEn: "Hair Care", labelBn: "হেয়ার কেয়ার" }
];

const BABY_CARE_SUBCATEGORIES = [
  { value: "Baby milk", labelEn: "Baby milk", labelBn: "বেবি মিল্ক" },
  { value: "Baby food", labelEn: "Baby food", labelBn: "বেবি ফুড" },
  { value: "Pampers and diaper", labelEn: "Pampers and diaper", labelBn: "প্যাম্পার্স ও ডায়াপার" },
  { value: "Baby skin care", labelEn: "Baby skin care", labelBn: "বেবি স্কিন কেয়ার" },
  { value: "Baby essential product", labelEn: "Baby essential product", labelBn: "বেবি এসেনশিয়াল প্রোডাক্ট" }
];

// Elegant audio bell / chime generator using Web Audio API - Softer, smoother, and smudged
const playTingSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    
    // Create oscillator, filter, and gain stages for a velvet-soft atmospheric bell
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gainNode = ctx.createGain();

    // Soothing, warm natural harmonic frequencies (E5 and B5)
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now); // Warm E5 major fundamental

    osc2.type = "sine";
    osc2.frequency.setValueAtTime(987.77, now); // Rounded B5 perfect fifth

    // Apply a low-pass filter with low resonance to cut out any sharp clicks or metallic whistling
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1200, now);
    filter.Q.setValueAtTime(1.0, now);

    // Smooth envelope attack (fade-in) and organic, smudged exponential release to feel luxurious and non-jarring
    gainNode.gain.setValueAtTime(0.0, now);
    gainNode.gain.linearRampToValueAtTime(0.18, now + 0.15); // Smooth 150ms fade-in attack (prevents sudden clicks)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 1.8); // Soothing, smudged 1.8-second decay

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    
    osc1.stop(now + 2.0);
    osc2.stop(now + 2.0);
  } catch (e) {
    console.error("Notification chime failed:", e);
  }
};

interface AdminLoginAreaProps {
  lang: Language;
  correctPassphraseHash: string;
  onSuccess: () => void;
  onFailure: (msg: string) => void;
  adminError: string | null;
  DICTIONARY: any;
}

const AdminLoginArea: React.FC<AdminLoginAreaProps> = ({
  lang,
  correctPassphraseHash,
  onSuccess,
  onFailure,
  adminError,
  DICTIONARY,
}) => {
  const [inputVal, setInputVal] = useState("");
  const [showPass, setShowPass] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus immediately on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 120);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputVal === correctPassphraseHash) {
      onSuccess();
    } else {
      onFailure(DICTIONARY[lang].adminIncorrect);
    }
  };

  const handleClear = () => {
    setInputVal("");
    inputRef.current?.focus();
  };

  return (
    <div className="max-w-md mx-auto my-2 sm:my-12 bg-white border border-stone-200 p-4 sm:p-8 shadow-sm rounded-sm">
      <div className="text-center mb-3 sm:mb-5">
        <div className="w-10 h-10 bg-stone-900 text-white rounded-full flex items-center justify-center mx-auto mb-2.5">
          <Lock className="w-5 h-5 text-amber-400" />
        </div>
        <h2 className="font-display font-semibold text-base text-stone-950 uppercase tracking-widest">
          {DICTIONARY[lang].adminPortal}
        </h2>
        <p className="text-[10px] text-stone-400 mt-1 uppercase font-mono tracking-widest">
          ATELIER RIEMARTBD.COM SECURITY UNIT
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" id="admin-auth-form">
        <div>
          <label className="block text-xs font-mono text-stone-650 uppercase tracking-wider mb-2">
            {DICTIONARY[lang].adminPassphrase}
          </label>
          <div className="relative">
            <input
              ref={inputRef}
              type={showPass ? "text" : "password"}
              placeholder={DICTIONARY[lang].adminPlaceholder}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-sm pl-3.5 pr-16 py-2.5 text-sm font-mono focus:outline-none focus:border-stone-900 focus:bg-white text-stone-950 transition-all duration-75 placeholder-stone-300 shadow-xs focus:shadow-sm"
              required
              id="admin-passphrase-input"
              autoComplete="new-password"
            />
            {inputVal && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-10 top-1/2 -translate-y-1/2 text-stone-400 hover:text-rose-600 transition-all duration-75 active:scale-90 cursor-pointer p-1.5 flex items-center justify-center rounded-full hover:bg-stone-100"
                title={lang === "en" ? "Clear input" : "মুছে ফেলুন"}
                id="clear-admin-passphrase-btn"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-900 transition-all duration-75 active:scale-95 cursor-pointer p-1 flex items-center justify-center rounded-full hover:bg-stone-100"
              title={lang === "en" ? "Show/Hide Passphrase" : "পাসওয়ার্ড দেখুন/লুকান"}
            >
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[10px] text-stone-500 font-sans mt-2 bg-stone-50 px-2 py-1.5 rounded-sm border border-stone-100 leading-normal">
            💡 {lang === "en" 
              ? "Tip: Tap the eye icon to view your password as you type to prevent spelling mistakes." 
              : "টিপস: টাইপ করার সময়ে ভুল এড়াতে পাশের চোখের আইকনটিতে ট্যাপ করে পাসওয়ার্ডটি দেখে নিন।"}
          </p>
        </div>

        {adminError && (
          <div className="bg-red-50 text-red-700 text-xs py-2 px-3 border border-red-100 font-mono rounded-sm animate-pulse" id="admin-auth-error">
            ⚠ {adminError}
          </div>
        )}

        <button
          type="submit"
          className="w-full bg-stone-950 hover:bg-stone-900 hover:shadow-lg focus:shadow-lg border border-stone-850 active:scale-[0.985] active:translate-y-[1px] text-white text-xs font-mono font-bold uppercase py-3.5 tracking-widest transition-all duration-75 rounded-sm cursor-pointer shadow-md flex items-center justify-center gap-2"
          id="admin-auth-submit"
        >
          <Unlock className="w-3.5 h-3.5 text-amber-400" />
          {DICTIONARY[lang].adminUnlock}
        </button>
      </form>

      <div className="mt-6 border-t border-stone-100 pt-4 text-center">
        <span className="text-[10px] text-stone-400 font-mono">
          SECURED PORTAL DIRECT ATELIER CONTROL PANEL
        </span>
      </div>
    </div>
  );
};

const normalizePhone = (p: string | undefined | null): string => {
  if (!p) return "";
  let clean = p.replace(/\s+/g, "").replace(/\-/g, "");
  if (clean.startsWith("+88")) {
    clean = clean.substring(3);
  } else if (clean.startsWith("88")) {
    clean = clean.substring(2);
  }
  return clean;
};

const getPaymentMethodDisplay = (method: string | undefined, language: "en" | "bn") => {
  const m = (method || "COD").trim().toUpperCase();
  if (m === "COD") {
    return language === "en" ? "Cash On Delivery (COD)" : "ক্যাশ অন ডেলিভারি (COD)";
  }
  if (m === "BKASH") {
    return language === "en" ? "bKash" : "বিকাশ";
  }
  if (m === "NAGAD") {
    return language === "en" ? "Nagad" : "নগদ";
  }
  if (m === "UPAY") {
    return language === "en" ? "Upay" : "উপায়";
  }
  if (m === "ROCKET") {
    return language === "en" ? "Rocket" : "রকেট";
  }
  if (m === "BANK" || m === "BANK_TRANSFER" || m === "BANK TRANSFER") {
    return language === "en" ? "Bank Transfer" : "ব্যাংক ট্রান্সফার";
  }
  return method || "COD";
};

interface MinimalInvoicePrintProps {
  order: Order;
  settings: StoreSettings;
  products: Product[];
  lang: Language;
  formatPrice: (amount: number) => string;
}

const MinimalInvoicePrintView: React.FC<MinimalInvoicePrintProps> = ({
  order,
  settings,
  products,
  lang,
  formatPrice
}) => {
  const [qrUrl, setQrUrl] = useState<string>("");

  useEffect(() => {
    if (order) {
      QRCode.toDataURL(order.id, {
        width: 180,
        margin: 1,
        color: {
          dark: "#0f172a",
          light: "#ffffff"
        }
      })
      .then((url) => {
        setQrUrl(url);
      })
      .catch((err) => {
        console.error("Order QR Code Generation failed:", err);
      });
    }
  }, [order]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        window.focus();
        window.print();
      } catch (err) {
        console.error("Automated window.print() failed:", err);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [qrUrl]);

  return (
    <div className="min-h-screen bg-white text-stone-950 p-4 sm:p-8 font-sans antialiased flex justify-center items-start">
      <div 
        className="bg-white border-0 max-w-2xl w-full p-4 print:p-0 print:m-0" 
        id="invoice-printed-card"
      >
        <div className="space-y-6 text-stone-955" id="receipt-printable-area">
          {/* Header */}
          <div className="flex justify-between items-center border-b border-stone-900 pb-5">
            <div className="flex items-center gap-3 text-left">
              <div 
                className="w-10 h-10 text-stone-955 shrink-0" 
                dangerouslySetInnerHTML={{ __html: StarIconSvg() }} 
              />
              <div>
                <h2 className="font-display font-bold text-2xl tracking-tight text-stone-950 leading-none">
                  {lang === "en" ? "RIEMART.com" : "রিয়ামার্ট.কম"}
                </h2>
                <p className="text-[10px] tracking-[0.2em] text-stone-500 font-mono uppercase mt-1">
                  {lang === "en" ? "Premium Studio Atelier" : "প্রিমিয়াম স্টুডিও অ্যাটেলিয়ার"}
                </p>
                <p className="text-[10px] font-mono text-stone-400 mt-0.5 uppercase">
                  Dhaka, Bangladesh | riemart.com
                </p>
              </div>
            </div>

            {qrUrl && (
              <div className="flex items-center gap-2 border border-stone-250 p-1 bg-stone-50 rounded-sm shadow-xs shrink-0 select-none">
                <div className="text-right flex flex-col justify-center">
                  <span className="text-[10px] font-bold text-stone-850 font-mono uppercase leading-none tracking-tight">
                    {lang === "en" ? "Order scan" : "অর্ডার স্ক্যান"}
                  </span>
                  <span className="text-[7.5px] text-stone-400 font-mono uppercase mt-0.5 tracking-wider leading-none font-bold">
                    {lang === "en" ? "Staff only" : "স্টাফ ওয়ার্কফ্লো"}
                  </span>
                </div>
                <img src={qrUrl} alt="Order QR" className="w-11 h-11 object-contain bg-white border border-stone-200 p-0.5 rounded-sm" />
              </div>
            )}

            <div className="text-right">
              <h1 className="font-mono text-sm font-bold text-amber-600 uppercase tracking-wider m-0">
                {lang === "en" ? "Official Cash Memo" : "অফিসিয়াল ক্যাশ মেমো"}
              </h1>
              <p className="text-[11px] font-mono text-stone-600 mt-1">
                <span className="text-stone-400">{lang === "en" ? "Invoice ID:" : "মেমো নম্বর:"}</span> {order.id}
              </p>
              <p className="text-[11px] font-mono text-stone-600">
                <span className="text-stone-400">{lang === "en" ? "Date:" : "তারিখ:"}</span> {new Date(order.date).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Shipping Coordinates Block */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="border border-stone-200 p-3 bg-stone-50/50 rounded-sm text-left">
              <h4 className="font-mono text-[9px] text-stone-400 uppercase tracking-wider mb-2 font-bold">
                {lang === "en" ? "SHIPPING COORDINATES" : "ডেলিভারি বিবরণ"}
              </h4>
              <table className="w-full text-[11px] font-mono text-stone-800 table-fixed">
                <tbody>
                  <tr>
                    <td className="w-16 py-0.5 text-stone-400 align-top">{lang === "en" ? "Name:" : "নাম:"}</td>
                    <td className="font-sans font-semibold py-0.5 break-words text-stone-955">{order.customerName}</td>
                  </tr>
                  <tr>
                    <td className="py-0.5 text-stone-400 align-top">{lang === "en" ? "Phone:" : "ফোন:"}</td>
                    <td className="py-0.5 font-sans break-words text-stone-955">{order.customerPhone}</td>
                  </tr>
                  <tr>
                    <td className="py-0.5 text-stone-400 align-top">{lang === "en" ? "Address:" : "ঠিকানা:"}</td>
                    <td className="py-0.5 font-sans leading-relaxed break-words text-stone-955">{order.customerAddress}</td>
                  </tr>
                  {order.orderNotes && (
                    <tr>
                      <td className="py-0.5 text-stone-400 align-top">{lang === "en" ? "Notes:" : "মন্তব্য:"}</td>
                      <td className="py-0.5 font-sans leading-relaxed text-amber-700 font-semibold break-words text-left">{order.orderNotes}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="border border-stone-200 p-3 bg-stone-50/50 rounded-sm text-right flex flex-col justify-between">
              <div>
                <h4 className="font-mono text-[9px] text-stone-400 uppercase tracking-wider mb-2 font-bold text-right">
                  {lang === "en" ? "CARRIER STATUS" : "সরবরাহ অবস্থা"}
                </h4>
                <span className={`inline-block text-[10px] uppercase tracking-widest font-mono font-bold px-2 py-0.5 rounded-sm ${
                  order.status === "Completed" ? "bg-emerald-100 text-emerald-800" :
                  order.status === "Shipped" ? "bg-blue-100 text-blue-800" :
                  order.status === "Processing" ? "bg-amber-100 text-amber-800" :
                  "bg-stone-200 text-stone-700"
                }`}>
                  {order.status}
                </span>
              </div>
              <div className="text-[10px] text-stone-500 font-mono mt-2 uppercase text-right space-y-0.5">
                <p>
                  {lang === "en" ? "Payment Mode: " : "পেমেন্ট মাধ্যম: "}
                  <span className="font-bold text-emerald-955 border border-emerald-600/35 bg-emerald-50/75 px-1.5 py-0.5 rounded-sm normal-case inline-block">
                    {getPaymentMethodDisplay(order.paymentMethod, lang)}
                  </span>
                </p>
                {order.paymentSender && (
                  <p>
                    {lang === "en" ? "Acc No: " : "অ্যাকাউন্ট নং: "}
                    <span className="font-sans text-stone-900">{order.paymentSender}</span>
                  </p>
                )}
                {order.paymentTrxId && (
                  <p>
                    {lang === "en" ? "TrxID: " : "ট্রানজেকশন আইডি: "}
                    <span className="font-mono font-bold bg-amber-50 text-stone-900 px-1 py-0.5 rounded text-[11px] inline-block">{order.paymentTrxId}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          <div>
            <table id="print-items-table" className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-stone-900 text-[10px] font-mono text-stone-400 uppercase tracking-wider">
                  <th className="pb-2 font-normal">{lang === "en" ? "ITEM DESCRIPTION" : "পণ্যের বিবরণ"}</th>
                  <th className="pb-2 font-normal text-center w-16">{lang === "en" ? "QTY" : "পরিমাণ"}</th>
                  <th className="pb-2 font-normal text-right w-24">{lang === "en" ? "UNIT" : "একক মূল্য"}</th>
                  <th className="pb-2 font-normal text-right w-28">{lang === "en" ? "TOTAL" : "মোট মূল্য"}</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-stone-150">
                {order.items.map((it, idx) => {
                  return (
                    <tr key={idx} className="font-mono text-stone-800 text-left">
                      <td className="py-2.5 font-sans font-medium text-stone-955 break-words">
                        {lang === "en" ? it.productNameEn : it.productNameBn}
                      </td>
                      <td className="py-2.5 text-center align-middle">{it.quantity}</td>
                      <td className="py-2.5 text-right align-middle">{formatPrice(it.priceAtPurchase)}</td>
                      <td className="py-2.5 text-right align-middle font-bold text-stone-950">{formatPrice(it.priceAtPurchase * it.quantity)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Calculations */}
          <div className="flex justify-end pt-2">
            <div className="w-64 font-mono text-xs space-y-1.5 border-t border-stone-900 pt-3">
              {order.discountApplied > 0 && (
                <div className="flex justify-between text-stone-500">
                  <span>{lang === "en" ? "Discount Applied:" : "ছাড় (ডিসকাউন্ট):"}</span>
                  <span>-{formatPrice(order.discountApplied)}</span>
                </div>
              )}
              <div className="flex justify-between text-stone-550 border-b border-stone-150 pb-1.5">
                <span>{lang === "en" ? "Delivery Charge:" : "ডেলিভারি চার্জ:"}</span>
                <span className="text-stone-700 font-bold">
                  {order.deliveryCharge && order.deliveryCharge > 0 
                    ? formatPrice(order.deliveryCharge) 
                    : (lang === "en" ? "Complimentary" : "ফ্রি")}
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold text-stone-955 pt-1">
                <span>{lang === "en" ? "TOTAL COLLECTABLE:" : "সর্বমোট প্রদেয়:"}</span>
                <span className="text-stone-955">{formatPrice(order.totalPrice)}</span>
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="border-t-2 border-stone-150 mt-10 pt-8 space-y-10" id="invoice-footer-container">
            <div className="flex justify-between items-end" id="invoice-printed-signatures-row">
              <div className="text-left w-52 font-mono space-y-1">
                {settings.storeSignatureImage && (
                  <div className="flex justify-start pb-0.5 h-12">
                    <img 
                      src={settings.storeSignatureImage} 
                      alt="Store Signature" 
                      className="max-h-12 max-w-[160px] object-contain object-left"
                    />
                  </div>
                )}
                {!settings.storeSignatureImage && <div className="h-12" />}
                <div className="border-t border-stone-300 pt-1.5 text-[11px] text-stone-700 tracking-wide font-bold uppercase">
                  {settings.storeSignatureText || (lang === "en" ? "Authorized Signature" : "অনুমোদিত স্বাক্ষর")}
                </div>
              </div>

              <div className="text-right w-48 font-mono">
                <div className="h-12" />
                <div className="border-t border-stone-300 pt-1.5 text-[11px] text-stone-700 tracking-wide font-bold uppercase">
                  {lang === "en" ? "Receiver Signature" : "গ্রাহকের স্বাক্ষর"}
                </div>
              </div>
            </div>

            <div className="border-t border-stone-150 pt-4 text-center">
              <p className="text-[10px] text-stone-400 font-sans tracking-wide leading-relaxed">
                {lang === "en" 
                  ? "Thank you for shopping at RIEMART. If you have any inquiries regarding your purchase, contact us at riemart.bd@gmail.com." 
                  : "রিয়ামার্টে কেনাকাটা করার জন্য ধন্যবাদ। ডেলিভারি সংক্রান্ত যেকোনো তথ্যের জন্য আমাদের মেইল করুন: riemart.bd@gmail.com।"}
              </p>
              <div className="mt-2 text-[9px] font-mono text-stone-300 uppercase tracking-widest font-bold">
                ★ SUPPORTING GENERATIONAL BANGLADESHI ARTISANAL CRAFTS ★
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

interface MinimalCustomerReportPrintProps {
  customerPhone: string;
  registeredUsers: any[];
  orders: Order[];
  settings: StoreSettings;
  lang: Language;
  formatPrice: (amount: number) => string;
}

const MinimalCustomerReportPrintView: React.FC<MinimalCustomerReportPrintProps> = ({
  customerPhone,
  registeredUsers,
  orders,
  settings,
  lang,
  formatPrice
}) => {
  const customer = registeredUsers.find(
    (u) => u && normalizePhone(u.phone) === normalizePhone(customerPhone)
  ) || {
    name: "Guest Customer",
    phone: customerPhone,
    email: "N/A",
    gender: "N/A",
    birthDate: "N/A",
    category: "Regular",
    address: "N/A",
    bkash: "",
    nagad: "",
    upay: ""
  };

  const customerOrders = orders.filter(
    (or) => or && or.customerPhone && normalizePhone(or.customerPhone) === normalizePhone(customerPhone)
  );
  const completedOrders = customerOrders.filter((or) => or.status === "Completed");
  const totalSpent = completedOrders.reduce((sum, or) => sum + or.totalPrice, 0);
  const totalPending = customerOrders.filter(or => ["Pending", "Processing", "Shipped"].includes(or.status)).reduce((sum, or) => sum + or.totalPrice, 0);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        window.focus();
        window.print();
      } catch (err) {
        console.error("Automated window.print() failed:", err);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-white text-stone-900 p-4 sm:p-8 font-sans antialiased flex justify-center items-start">
      <div 
        className="bg-white border-0 max-w-3xl w-full p-4 print:p-0 print:m-0" 
        id="customer-report-printed-card"
      >
        <div className="space-y-6 text-stone-900 text-left">
          {/* Brand Header Section */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-2 border-stone-900 pb-5 gap-4">
            <div className="space-y-1 text-left">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 text-stone-955" dangerouslySetInnerHTML={{ __html: StarIconSvg() }} />
                <span className="font-display font-black text-xl tracking-wider text-stone-950 uppercase">RIEMART.com</span>
              </div>
              <p className="text-xs font-mono text-stone-500">
                Luxe Premium Store & Atelier BD
              </p>
            </div>
            <div className="text-right sm:text-right text-xs font-mono space-y-1 text-stone-700 w-full sm:w-auto">
              <p className="font-bold text-stone-955 text-sm uppercase">
                {lang === "en" ? "Customer Statement Report" : "গ্রাহক লেজার স্টেটমেন্ট"}
              </p>
              <p>{lang === "en" ? "Date Generated:" : "তৈরির তারিখ:"} {new Date().toLocaleString()}</p>
              <p>Dhaka, Bangladesh | riemart.com</p>
            </div>
          </div>

          {/* Profile Demographics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-stone-50 p-4 border border-stone-200/80 rounded">
            <div className="space-y-1.5 text-xs font-mono text-left">
              <h4 className="text-[10px] text-stone-400 uppercase tracking-widest font-bold border-b border-stone-200 pb-1 mb-2">
                {lang === "en" ? "Customer Profile Dossier" : "প্রোফাইল বিবরণী"}
              </h4>
              <p className="text-sm font-sans font-bold text-stone-955 leading-none">{customer.name}</p>
              <p><span className="text-stone-400 font-bold">Phone:</span> {customer.phone}</p>
              <p><span className="text-stone-400 font-bold">Email:</span> {customer.email || "N/A"}</p>
              <p><span className="text-stone-400 font-bold">Gender / DOB:</span> {customer.gender || "N/A"} / {customer.birthDate || "N/A"}</p>
              <p><span className="text-stone-400 font-bold">Tier / Segment:</span> <span className="font-bold uppercase text-amber-700">{customer.category || "Regular"}</span></p>
            </div>

            <div className="space-y-1.5 text-xs font-mono text-left">
              <h4 className="text-[10px] text-stone-400 uppercase tracking-widest font-bold border-b border-stone-200 pb-1 mb-2">
                {lang === "en" ? "Verified Logistics & Wallets" : "লজিস্টিকস ও মোবাইল ওয়ালেটস"}
              </h4>
              <p className="leading-relaxed text-stone-955"><span className="text-stone-400 font-bold">Delivery Route:</span> {customer.address || "N/A"}</p>
              <div className="grid grid-cols-3 gap-2 pt-1 font-mono">
                <div className="bg-white p-1.5 rounded border border-stone-200 text-center text-[10px]">
                  <span className="text-[8px] font-bold text-pink-600 uppercase block leading-none mb-0.5">bKash</span>
                  <span className="font-bold break-all">{customer.bkash || customer.savedBkash || "—"}</span>
                </div>
                <div className="bg-white p-1.5 rounded border border-stone-200 text-center text-[10px]">
                  <span className="text-[8px] font-bold text-orange-600 uppercase block leading-none mb-0.5">Nagad</span>
                  <span className="font-bold break-all">{customer.nagad || customer.savedNagad || "—"}</span>
                </div>
                <div className="bg-white p-1.5 rounded border border-stone-200 text-center text-[10px]">
                  <span className="text-[8px] font-bold text-sky-600 uppercase block leading-none mb-0.5">Upay</span>
                  <span className="font-bold break-all">{customer.upay || customer.savedUpay || "—"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Aggregations */}
          <div className="grid grid-cols-3 gap-4 border border-stone-250 p-4 rounded bg-stone-950 text-stone-100 font-mono text-center">
            <div>
              <span className="text-stone-450 text-[9px] uppercase tracking-wider block mb-1">
                {lang === "en" ? "TOTAL PLACED" : "মোট অর্ডারের সংখ্যা"}
              </span>
              <span className="text-xs sm:text-sm font-bold text-white leading-none">
                {customerOrders.length} {lang === "en" ? "Orders" : "টি অর্ডার"}
              </span>
            </div>
            <div className="border-l border-stone-800">
              <span className="text-stone-450 text-[9px] uppercase tracking-wider block mb-1">
                {lang === "en" ? "SETTLED AMOUNT" : "পরিশোধিত তহবিল"}
              </span>
              <span className="text-xs sm:text-sm font-bold text-emerald-400 font-sans leading-none">
                {formatPrice(totalSpent)}
              </span>
            </div>
            <div className="border-l border-stone-800">
              <span className="text-stone-450 text-[9px] uppercase tracking-wider block mb-1">
                {lang === "en" ? "PENDING PROCESS" : "প্রক্রিয়াধীন পেমেন্ট"}
              </span>
              <span className="text-xs sm:text-sm font-bold text-amber-500 font-sans leading-none">
                {formatPrice(totalPending)}
              </span>
            </div>
          </div>

          {/* Orders Journal */}
          <div className="space-y-3 font-mono">
            <h4 className="text-xs uppercase font-extrabold text-stone-900 border-b border-stone-400 pb-1 text-left">
              {lang === "en" ? "Chronological Order Journal Items" : "অর্ডারের বিবরণী তালিকা"}
            </h4>

            {customerOrders.length === 0 ? (
              <div className="text-center py-8 text-stone-400 text-xs italic">
                {lang === "en" ? "No order ledger entries recorded." : "কোনো অর্ডারের বিবরণ পাওয়া যায়নি।"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table id="print-ledger-table" className="w-full text-[11px] text-stone-800 border-collapse">
                  <thead>
                    <tr className="border-b border-stone-400 font-bold uppercase text-stone-500 text-[10px]">
                      <th className="py-2 text-left font-mono">{lang === "en" ? "Order ID / Date" : "অর্ডার আইডি / তারিখ"}</th>
                      <th className="py-2 text-left font-sans">{lang === "en" ? "Purchased Items" : "ক্রয়কৃত প্রোডাক্ট আইটেমসমূহ"}</th>
                      <th className="py-2 text-left font-mono">{lang === "en" ? "Payment / Route" : "পেমেন্ট পদ্ধতি ও কুরিয়ার রুট"}</th>
                      <th className="py-2 text-center font-mono">{lang === "en" ? "Status" : "অবস্থা"}</th>
                      <th className="py-2 text-right font-sans">{lang === "en" ? "Net Paid" : "প্রدهয় মূল্য"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerOrders.map((or) => (
                      <tr key={or.id} className="border-b border-stone-250 text-left">
                        <td className="py-2.5 font-mono text-left align-top leading-relaxed pr-2">
                          <span className="font-bold text-stone-955 block">#{or.id}</span>
                          <span className="text-stone-450 text-[9.5px] block">{new Date(or.date).toLocaleString()}</span>
                        </td>
                        <td className="py-2.5 font-sans text-left align-top leading-relaxed pr-2">
                          <div className="space-y-1">
                            {or.items.map((item: any, keyIdx: number) => (
                              <div key={keyIdx} className="text-stone-750 text-[10.5px]">
                                <span>{item.quantity} × {lang === "en" ? item.productNameEn : item.productNameBn}</span>
                                <span className="text-stone-400 text-[9.5px] font-mono ml-1.5">(@{formatPrice(item.priceAtPurchase)})</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="py-2.5 font-mono text-left align-top leading-relaxed pr-2">
                          <div className="space-y-0.5 animate-studio-reveal">
                            <span className="text-stone-900 block font-sans text-[10.5px]">
                              {or.customerAddress}
                            </span>
                            <span className="text-[9.5px] bg-stone-100 border border-stone-200 rounded px-1 text-stone-600 inline-block uppercase">
                              {or.paymentMethod || "COD"} {or.paymentTrxId ? `[Trx: ${or.paymentTrxId}]` : ""}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 text-center align-top pr-2">
                          <span className={`text-[9.5px] font-mono font-black border rounded px-1.5 py-0.5 inline-block uppercase ${
                            or.status === "Completed" ? "bg-emerald-50 text-emerald-700 border-emerald-150" :
                            or.status === "Cancelled" ? "bg-red-50 text-red-600 border-red-150 line-through text-stone-400" :
                            or.status === "Shipped" ? "bg-blue-50 text-blue-700 border-blue-150" :
                            or.status === "Processing" ? "bg-amber-50 text-amber-700 border-amber-150" :
                            "bg-rose-50 text-rose-700 border-rose-150"
                          }`}>
                            {or.status}
                          </span>
                        </td>
                        <td className="py-2.5 font-sans font-bold text-stone-955 text-right align-top">
                          {formatPrice(or.totalPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface MinimalInventoryPrintProps {
  category: string;
  subCategory: string;
  products: Product[];
  lang: Language;
}

const MinimalInventoryPrintView: React.FC<MinimalInventoryPrintProps> = ({
  category,
  subCategory,
  products,
  lang
}) => {
  useEffect(() => {
    // Blazing-fast auto print trigger after DOM and optimized thumbnails are fully available
    const timer = setTimeout(() => {
      try {
        window.focus();
        window.print();
      } catch (err) {
        console.error("Automated window.print() failed:", err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const filteredList = useMemo(() => {
    let list = products;
    if (category && category !== "All") {
      list = list.filter(p => p.category === category);
    }
    if (subCategory && subCategory !== "All") {
      list = list.filter(p => p.subCategory && p.subCategory.trim() === subCategory);
    }
    return list;
  }, [category, subCategory, products]);

  // CSS for enterprise A4 print processing stability with repeating headers and non-splitting rows
  const printOverrideCSS = `
    @media print {
      @page {
        size: A4 portrait;
        margin: 12mm 12mm 12mm 12mm !important;
      }
      body, html {
        background-color: #ffffff !important;
        color: #000000 !important;
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      thead {
        display: table-header-group !important;
      }
      tr {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      img {
        max-width: 100% !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
    }
  `;

  return (
    <div className="min-h-screen bg-white text-stone-900 p-4 sm:p-8 font-sans antialiased flex justify-center items-start">
      <style dangerouslySetInnerHTML={{ __html: printOverrideCSS }} />
      <div 
        className="bg-white border-0 max-w-4xl w-full p-4 print:p-0 print:m-0" 
        id="inventory-report-printed-card"
      >
        <div className="space-y-6 text-stone-900 text-left">
          {/* Brand Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-2 border-stone-900 pb-5 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 text-stone-955 shrink-0" dangerouslySetInnerHTML={{ __html: StarIconSvg() }} />
                <span className="text-xl font-display font-black tracking-widest text-stone-900">RIEMART</span>
              </div>
              <p className="text-[10px] uppercase font-mono tracking-widest text-stone-500 font-bold">
                {lang === "en" ? "Atelier High-Premium Segment Stores" : "প্রিমিয়াম ক্যাটালগ ও পণ্য ইনভেন্টরি"}
              </p>
            </div>
            <div className="text-left sm:text-right font-mono text-xs text-stone-600">
              <p className="font-bold underline text-stone-900 text-sm uppercase">
                {lang === "en" ? "Product Inventory List" : "প্রোডাক্ট ইনভেন্টরি তালিকা"}
              </p>
              <p className="mt-1">
                <span className="text-stone-450 font-bold">Date:</span> {new Date().toLocaleString()}
              </p>
              <p>
                <span className="text-stone-450 font-bold">Category:</span> {category}
              </p>
              {subCategory && subCategory !== "All" && (
                <p>
                  <span className="text-stone-450 font-bold">Sub-Category:</span> {subCategory}
                </p>
              )}
            </div>
          </div>

          {/* Core Info Row */}
          <div className="grid grid-cols-3 gap-4 border border-stone-200 p-4 bg-stone-50 rounded-sm">
            <div className="text-center p-2 border-r border-stone-200">
              <p className="text-[10px] font-mono text-stone-500 uppercase font-bold tracking-wider leading-none">
                {lang === "en" ? "Filter Category" : "বাছাইকৃত ক্যাটাগরি"}
              </p>
              <p className="text-xs sm:text-sm font-black text-stone-900 mt-1.5 uppercase tracking-wide">
                {category === "All" 
                  ? (lang === "en" ? "All Categories" : "সব ক্যাটাগরি") 
                  : (CATEGORY_TRANSLATIONS[category as Category]?.[lang] || category)
                }
              </p>
            </div>
            <div className="text-center p-2 border-r border-stone-200">
              <p className="text-[10px] font-mono text-stone-500 uppercase font-bold tracking-wider leading-none">
                {lang === "en" ? "Total Items Included" : "অন্তর্ভুক্ত মোট পণ্য"}
              </p>
              <p className="text-xs sm:text-sm font-black text-stone-900 mt-1.5 font-mono">
                {filteredList.length} {lang === "en" ? "Products" : "টি পণ্য"}
              </p>
            </div>
            <div className="text-center p-2">
              <p className="text-[10px] font-mono text-stone-500 uppercase font-bold tracking-wider leading-none">
                {lang === "en" ? "Total Stock Count" : "মোট মজুদ পরিমাণ"}
              </p>
              <p className="text-xs sm:text-sm font-black text-stone-900 mt-1.5 font-mono font-bold text-stone-955">
                {filteredList.reduce((sum, p) => sum + p.inventory, 0).toLocaleString()} Qty
              </p>
            </div>
          </div>

          {/* Products List Table */}
          <div className="border border-stone-300 rounded-sm overflow-hidden mt-4">
            <table className="w-full text-left border-collapse text-stone-900">
              <thead>
                <tr className="bg-stone-100 border-b border-stone-300 font-mono text-[10px] font-bold text-stone-700 uppercase">
                  <th className="py-2.5 px-3 text-center border-r border-stone-200" style={{ width: "40px" }}>SL</th>
                  <th className="py-2.5 px-2 text-center border-r border-stone-200" style={{ width: "55px" }}>Preview / ছবি</th>
                  <th className="py-2.5 px-3 border-r border-stone-200" style={{ width: "100px" }}>Code / SKU</th>
                  <th className="py-2.5 px-3 border-r border-stone-200">Product Name / পণ্যের নাম</th>
                  <th className="py-2.5 px-3 border-r border-stone-200" style={{ width: "100px" }}>Category</th>
                  <th className="py-2.5 px-3 border-r border-stone-200" style={{ width: "100px" }}>Sub-category</th>
                  <th className="py-2.5 px-3 text-center border-r border-stone-200" style={{ width: "85px" }}>Measurement</th>
                  <th className="py-2.5 px-3 text-right border-r border-stone-200" style={{ width: "85px" }}>Price (BDT)</th>
                  <th className="py-2.5 px-3 text-center" style={{ width: "65px" }}>Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 text-[11px] leading-tight">
                {filteredList.map((p, index) => (
                  <tr key={p.id} className="align-middle">
                    <td className="py-2 px-3 text-center font-mono font-bold text-stone-500 border-r border-stone-200 bg-stone-50/40">
                      {index + 1}
                    </td>
                    <td className="p-1 border-r border-stone-200 text-center align-middle">
                      <div className="w-9 h-9 mx-auto rounded border border-stone-200 bg-stone-50 overflow-hidden flex items-center justify-center select-none shrink-0">
                        {p.image ? (
                          <img
                            src={getOptimizedPrintImageUrl(p.image, 60)}
                            alt={p.nameEn}
                            loading="eager"
                            decoding="sync"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="text-[10px] text-stone-300 font-bold font-mono">
                            {p.nameEn ? p.nameEn.trim().charAt(0).toUpperCase() : "?"}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3 font-mono font-bold text-stone-900 break-all select-all border-r border-stone-200 text-[10px]">
                      {p.sku || p.id}
                    </td>
                    <td className="py-2 px-3 border-r border-stone-200 leading-snug">
                      <div className="font-bold text-stone-955">
                        {p.nameEn}
                      </div>
                      <div className="text-[10px] font-medium text-stone-500 mt-1 leading-snug">
                        {p.nameBn}
                      </div>
                    </td>
                    <td className="py-2 px-3 border-r border-stone-200 font-medium">
                      {p.category}
                    </td>
                    <td className="py-2 px-3 border-r border-stone-200 italic text-stone-500 font-mono text-[10px]">
                      {p.subCategory || "—"}
                    </td>
                    <td className="py-2 px-3 text-center border-r border-stone-200">
                      <span className="inline-block px-1.5 py-0.5 bg-stone-100 border border-stone-200 rounded font-mono text-[9px] font-bold">
                        {getProductMeasurement(p)}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold border-r border-stone-200">
                      ৳{p.price.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-center font-mono font-bold">
                      {p.inventory === 0 ? (
                        <span className="text-red-650 uppercase text-[9px] font-black tracking-wide">
                          {lang === "en" ? "Out" : "মজুদ নাই"}
                        </span>
                      ) : (
                        <span className={p.inventory <= 5 ? "text-amber-750 font-black" : "text-stone-850"}>
                          {p.inventory}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-10 border-t border-dashed border-stone-300 grid grid-cols-2 gap-4 text-center font-mono text-[10px]">
            <div>
              <div className="border-t border-stone-400 w-36 mx-auto pt-1 mt-6">
                {lang === "en" ? "Verified Auditor Signature" : "যাচাইকারী কর্মকর্তা স্বাক্ষর"}
              </div>
            </div>
            <div>
              <div className="border-t border-stone-400 w-36 mx-auto pt-1 mt-6">
                {lang === "en" ? "Warehouse Manager Signature" : "গুদামজাত ব্যবস্থাপক স্বাক্ষর"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ensureProductsHaveSkus = (list: Product[]): Product[] => {
  if (!list || !Array.isArray(list)) return [];
  return list
    .filter((p) => p && typeof p === "object" && p.id)
    .map((p) => {
      if (!p.sku) {
        const catClean = (p.category || "General").toUpperCase().replace(/[^A-Z0-9]/g, "");
        const idClean = String(p.id).toUpperCase().replace(/[^A-Z0-9]/g, "");
        return {
          ...p,
          sku: `RM-${catClean}-${idClean}`
        };
      }
      return p;
    });
};

export default function App() {
  // Real-time synchronization state-tracking refs
  const isUpdatingFromServer = useRef(false);
  const lastStatesRef = useRef<any>(null);
  const syncInitializedRef = useRef(false);

  // Direct Client-to-Firestore Push Tracking Refs
  const lastSyncedProducts = useRef<Product[]>([]);
  const lastSyncedOrders = useRef<Order[]>([]);
  const lastSyncedLogs = useRef<SystemLog[]>([]);
  const hasPopulatedRefs = useRef<boolean>(false);

  // Global App States
  const [lang, setLang] = useState<Language>("en");
  const [isInitialLoading, setIsInitialLoading] = useState(() => {
    try {
      const saved = localStorage.getItem("riemart_products");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return false; // Instant load since we already have cached products!
        }
      }
    } catch (e) {}
    return true; // Fall back to showing loading screen if fresh visit
  });

  // Highly Optimized Admin-Wide Action Spinner State & Interceptor
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [adminLoadingMessage, setAdminLoadingMessage] = useState("");

  const triggerAdminLoadingSpinner = (message: string, duration: number = 650) => {
    setAdminLoadingMessage(message);
    setIsAdminLoading(true);
    setTimeout(() => {
      setIsAdminLoading(false);
    }, duration);
  };

  const handleAdminPanelClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (!target || typeof target.closest !== "function") return;
    const button = target.closest("button");
    if (button) {
      if (button.disabled) return;

      const buttonText = (button.innerText || button.getAttribute("title") || button.getAttribute("aria-label") || "").trim();
      const cleanText = buttonText.split("\n")[0];
      
      const isLogout = button.id === "control-room-seal-btn" || cleanText.toLowerCase().includes("logout") || cleanText.includes("লগআউট");
      const isExit = button.id === "control-room-exit-btn" || cleanText.toLowerCase().includes("storefront") || cleanText.includes("স্টোরফ্রেম");
      
      if (!isLogout && !isExit) {
        let bnMsg = "অনুরোধটি প্রক্রিয়াকরণ করা হচ্ছে...";
        let enMsg = `Processing Administrative Request...`;

        // Check for child SVG classes or icons to support pure icon buttons
        let iconType = "";
        const svgs = button.querySelectorAll("svg");
        svgs.forEach((svg) => {
          const cls = (svg.getAttribute("class") || "").toLowerCase();
          if (cls.includes("edit") || cls.includes("pencil")) iconType = "edit";
          else if (cls.includes("trash") || cls.includes("delete") || cls.includes("trash2")) iconType = "delete";
          else if (cls.includes("plus") || cls.includes("circle")) iconType = "create";
          else if (cls.includes("printer") || cls.includes("spreadsheet")) iconType = "print";
          else if (cls.includes("cloud") || cls.includes("refresh") || cls.includes("cw")) iconType = "sync";
        });
        
        const textLower = cleanText.toLowerCase();
        if (textLower.includes("dashboard") || button.id === "control-room-dashboard-btn") {
          enMsg = "Loading Administrative Dashboard...";
          bnMsg = "অ্যাডমিন ড্যাশবোর্ড লোড হচ্ছে...";
        } else if (textLower.includes("customer") || button.id === "control-room-customers-btn") {
          enMsg = "Retrieving Customer Profiles...";
          bnMsg = "গ্রাহক প্রোফাইল লোড হচ্ছে...";
        } else if (textLower.includes("qr") || button.id === "control-room-qr-generator-btn") {
          enMsg = "Generating Studio QR stamps...";
          bnMsg = "কিউআর স্ট্যাম্প তৈরি করা হচ্ছে...";
        } else if (textLower.includes("inventory") || button.id === "control-room-inventory-report-btn" || iconType === "print") {
          enMsg = "Compiling Ledger & Stocks...";
          bnMsg = "ইনভেন্টরি রিপোর্ট ও লেজার সংকলন হচ্ছে...";
        } else if (textLower.includes("delivery") || button.id === "control-room-delivery-settings-btn") {
          enMsg = "Loading Logistical Outlets...";
          bnMsg = "ডেলিভারি কনফিগারেশন খোলা হচ্ছে...";
        } else if (textLower.includes("google") || button.id === "control-room-gdrive-sync-btn") {
          enMsg = "Synchronizing with Google Workspace...";
          bnMsg = "গুগল ড্রাইভ কানেক্ট করা হচ্ছে...";
        } else if (textLower.includes("save") || textLower.includes("সংরক্ষণ") || textLower.includes("সংরক্ষণ করুন") || textLower.includes("update") || textLower.includes("আপডেট")) {
          enMsg = "Saving updates to cloud database...";
          bnMsg = "ডাটাবেজে তথ্য সংরক্ষণ করা হচ্ছে...";
        } else if (textLower.includes("create") || textLower.includes("যোগ") || textLower.includes("নতুন প্রোডাক্ট") || iconType === "create") {
          enMsg = "Opening Product Creator...";
          bnMsg = "প্রোডাক্ট ক্রিয়েটর চালু করা হচ্ছে...";
        } else if (textLower.includes("edit") || textLower.includes("এডিট") || iconType === "edit") {
          enMsg = "Loading Product Editor...";
          bnMsg = "প্রোডাক্ট এডিটর চালু করা হচ্ছে...";
        } else if (textLower.includes("delete") || textLower.includes("মুছে") || iconType === "delete") {
          enMsg = "Removing record from database...";
          bnMsg = "ডাটাবেজ থেকে তথ্য মুছে ফেলা হচ্ছে...";
        } else if (iconType === "sync") {
          enMsg = "Synchronizing records...";
          bnMsg = "তথ্য সমলয় করা হচ্ছে...";
        } else if (cleanText) {
          enMsg = `Executing "${cleanText}"...`;
          bnMsg = `"${cleanText}" সম্পন্ন করা হচ্ছে...`;
        }

        triggerAdminLoadingSpinner(lang === "en" ? enMsg : bnMsg, 700);
      }
    }
  };

  const [safeConfirmDialog, setSafeConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const showSafeConfirm = (title: string, message: string, onConfirm: () => void) => {
    setSafeConfirmDialog({ title, message, onConfirm });
  };

  // Helper to resolve clean, active shared URL across sandbox, production, and custom domain systems
  const getDynamicShareUrl = (utm?: string) => {
    // If the administrator has configured a custom public domain name, prioritize it as the active link baseline!
    let activeOrigin = settings.publicStoreDomain ? settings.publicStoreDomain.trim() : "";
    
    if (activeOrigin) {
      // Robustly sanitize domain input (remove trailing slash and prepend protocol if missing)
      if (!/^https?:\/\//i.test(activeOrigin)) {
        activeOrigin = `https://${activeOrigin}`;
      }
      if (activeOrigin.endsWith("/")) {
        activeOrigin = activeOrigin.slice(0, -1);
      }
    } else {
      // If no custom domain is entered, dynamically fall back to the window location origin (or default production fallback)
      activeOrigin = typeof window !== "undefined" && window.location 
        ? (window.location.hostname.includes("riemart.com") || window.location.hostname.includes("riemartbd.com") ? "https://riemart.com" : window.location.origin)
        : "https://ais-pre-lal6k3zqlq7ej7axfsl5gi-252555841806.asia-southeast1.run.app";

      // If we are inside the Google AI Studio private developer environment, rewrite to pristine public shared server
      if (activeOrigin.includes("ais-dev-") || activeOrigin.includes("aistudio.google.com") || activeOrigin.includes("localhost") || activeOrigin.includes("0.0.0.0")) {
        activeOrigin = "https://ais-pre-lal6k3zqlq7ej7axfsl5gi-252555841806.asia-southeast1.run.app";
      }
    }

    return utm ? `${activeOrigin}?src=${utm}` : activeOrigin;
  };

  // Resilient clipboard copier that falls back to layout textareas in constrained sandbox/iframe contexts
  const safeCopyToClipboard = (text: string): boolean => {
    let success = false;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
        success = true;
      }
    } catch (err) {
      console.warn("navigator.clipboard api is restricted or undefined inside sandbox, attempting textarea fallback", err);
    }

    if (!success) {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "-9999px";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        success = document.execCommand("copy");
        document.body.removeChild(textArea);
      } catch (err) {
        console.error("Critical: Formatted fallback copy-to-clipboard routine failed", err);
      }
    }
    return success;
  };

  const [settings, setSettings] = useState<StoreSettings>(() => {
    try {
      const saved = localStorage.getItem("riemart_settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") {
          return { ...INITIAL_SETTINGS, ...parsed };
        }
      }
    } catch (e) {
      console.error("Failed to parse riemart_settings from localStorage:", e);
    }
    return INITIAL_SETTINGS;
  });

  // Footer QR Code generation state
  const [footerQrImgUrl, setFooterQrImgUrl] = useState<string>("");

  useEffect(() => {
    const finalUrl = getDynamicShareUrl("footer_qr");
    QRCode.toDataURL(finalUrl, {
      width: 500,
      margin: 1,
      color: {
        dark: "#000000",
        light: "#FFFFFF"
      }
    })
    .then((url) => {
      setFooterQrImgUrl(url);
    })
    .catch((err) => {
      console.error("Footer QR Generation failed:", err);
    });
  }, [settings.publicStoreDomain]);

  const [currency, setCurrency] = useState<"USD" | "BDT">("BDT");
  const [pulsingInventoryProductId, setPulsingInventoryProductId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem("riemart_products");
      const list = saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
      return ensureProductsHaveSkus(list);
    } catch (e) {
      console.error("Failed to parse riemart_products from localStorage:", e);
    }
    return ensureProductsHaveSkus(INITIAL_PRODUCTS);
  });
  const [logs, setLogs] = useState<SystemLog[]>(() => {
    try {
      const saved = localStorage.getItem("riemart_logs");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error("Failed to parse riemart_logs from localStorage:", e);
    }
    return INITIAL_LOGS;
  });
  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem("riemart_orders");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error("Failed to parse riemart_orders from localStorage:", e);
    }
    return [];
  });
  const [userOrders, setUserOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem("riemart_user_orders");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error("Failed to parse riemart_user_orders from localStorage:", e);
    }
    return [];
  });
  const [cartDrawerTab, setCartDrawerTab] = useState<"cart" | "orders">("cart");
  const [wishlist, setWishlist] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem("riemart_wishlist");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error("Failed to parse riemart_wishlist from localStorage:", e);
    }
    return [];
  });
  const [subscriptions, setSubscriptions] = useState<{ id: string; productId: string; productNameEn: string; productNameBn: string; contact: string; originalPrice: number; date: string }[]>(() => {
    try {
      const saved = localStorage.getItem("riemart_subscriptions");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error("Failed to parse riemart_subscriptions from localStorage:", e);
    }
    return [];
  });
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [scannerSuccessMsg, setScannerSuccessMsg] = useState<string | null>(null);
  const [adminOrderStatusFilter, setAdminOrderStatusFilter] = useState<string>("All");
  const [adminOrderStartDate, setAdminOrderStartDate] = useState<string>("");
  const [adminOrderEndDate, setAdminOrderEndDate] = useState<string>("");
  const [adminOrderSearchTerm, setAdminOrderSearchTerm] = useState<string>("");
  const [customerOrderStartDate, setCustomerOrderStartDate] = useState<string>("");
  const [customerOrderEndDate, setCustomerOrderEndDate] = useState<string>("");
  const [customerOrderSort, setCustomerOrderSort] = useState<string>("date-desc");

  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const lastQRDecodeTimeRef = React.useRef<number>(0);

  // Navigation & Filter States
  const [showAdminPortal, setShowAdminPortal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | "All">("All");
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);
  const [mobileFbAccordion, setMobileFbAccordion] = useState<string | null>(null);
  const [mobilePerfumeAccordion, setMobilePerfumeAccordion] = useState<string | null>(null);
  const [mobileClothingAccordion, setMobileClothingAccordion] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isNarrativeExpanded, setIsNarrativeExpanded] = useState<boolean>(false);
  const [narrativeActiveLang, setNarrativeActiveLang] = useState<"en" | "bn">("en");
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const stopSpeaking = () => {
    const synth = getSafeSpeechSynthesis();
    if (synth) {
      synth.cancel();
    }
    setIsSpeaking(false);
  };

  const stripHtmlTags = (html: string): string => {
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  };

  const findMaleVoice = (langCode: string): SpeechSynthesisVoice | null => {
    const synth = getSafeSpeechSynthesis();
    if (!synth) return null;
    const voices = synth.getVoices();
    // Normalize language codes (e.g. en-US vs en_US)
    const normalizedTarget = langCode.toLowerCase().replace("_", "-");
    const langVoices = voices.filter(v => 
      v.lang.toLowerCase().replace("_", "-").startsWith(normalizedTarget) ||
      normalizedTarget.startsWith(v.lang.toLowerCase().replace("_", "-"))
    );
    if (langVoices.length === 0) return null;
    
    // Prioritize natural sounding high-quality speech engines (containing "natural", "neural", "google", etc.)
    const sortedVoices = [...langVoices].sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      const aScore = (aName.includes("natural") ? 10 : 0) + (aName.includes("neural") ? 10 : 0) + (aName.includes("google") ? 5 : 0) + (aName.includes("premium") ? 4 : 0);
      const bScore = (bName.includes("natural") ? 10 : 0) + (bName.includes("neural") ? 10 : 0) + (bName.includes("google") ? 5 : 0) + (bName.includes("premium") ? 4 : 0);
      return bScore - aScore;
    });

    const maleKeywords = ["male", "guy", "david", "mark", "ravi", "george", "men", "microsoft david", "google us english", "en-us-x-sfg", "en-us-x-tpd"];
    const maleMatch = sortedVoices.find(v => 
      maleKeywords.some(keyword => v.name.toLowerCase().includes(keyword))
    );
    
    return maleMatch || sortedVoices[0];
  };

  const handleNarrativeSpeech = (product: Product, narrativeLang: "en" | "bn") => {
    const synth = getSafeSpeechSynthesis();
    if (!synth) {
      alert(lang === "en" ? "Web Speech API is not supported in this browser." : "আপনার ব্রাউজারটি ভয়েস রিডার সমর্থন করে না।");
      return;
    }

    if (isSpeaking) {
      stopSpeaking();
      return;
    }

    // Cancel any ongoing speaking immediately
    synth.cancel();

    const rawHtml = product.descriptionEn && product.descriptionBn
      ? (narrativeLang === "en" ? product.descriptionEn : product.descriptionBn)
      : (product.descriptionEn || product.descriptionBn || "");
      
    // Strip HTML to get clean text for clear reading
    const cleanText = stripHtmlTags(rawHtml);
    if (!cleanText.trim()) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const targetLangCode = product.descriptionEn && product.descriptionBn
      ? narrativeLang
      : (product.descriptionEn ? "en" : "bn");

    utterance.lang = targetLangCode === "en" ? "en-US" : "bn-BD";
    
    const voice = findMaleVoice(utterance.lang);
    let isExplicitMale = false;
    if (voice) {
      utterance.voice = voice;
      const voiceName = voice.name.toLowerCase();
      const maleKeywords = ["male", "guy", "david", "mark", "ravi", "george", "men"];
      isExplicitMale = maleKeywords.some(keyword => voiceName.includes(keyword));
    }
    
    // Set max clear volume and optimized voice properties
    utterance.volume = 1.0; // Loudest output level possible
    utterance.rate = 0.90;  // Slightly paced for absolute clear pronunciation and diction stability
    
    // Adjust pitch: If browser natively has a male voice choice, we keep it standard.
    // If not, we lower the pitch of alternative gender-neutral/female voices to formulate a deep, wealthy male tone.
    utterance.pitch = isExplicitMale ? 1.0 : 0.82;

    utterance.onend = () => {
      setIsSpeaking(false);
    };
    
    utterance.onerror = () => {
      setIsSpeaking(false);
    };

    utteranceRef.current = utterance;
    setIsSpeaking(true);
    synth.speak(utterance);
  };

  useEffect(() => {
    // Trigger lazy-loading of Web Speech synthesis voices on mount/update so .getVoices() is ready
    const synth = getSafeSpeechSynthesis();
    if (synth && synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = () => {
        const s = getSafeSpeechSynthesis();
        if (s) s.getVoices();
      };
      synth.getVoices();
    }
    
    stopSpeaking();
    return () => {
      stopSpeaking();
    };
  }, [selectedProduct, narrativeActiveLang, lang]);

  // Pagination State (12 products per page, 2-column mobile, 3-column tablet, 4-column desktop)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Active input/text typing state to clear layout clutter on virtual mobile keyboards
  const [isInputActive, setIsInputActive] = useState(false);

  // Prevent mobile document scrolling up (shifting the absolute/fixed modals and showing black spaces) when input keyboard is open
  useEffect(() => {
    if (isInputActive && !showAdminPortal) {
      const handleWindowScrollLock = () => {
        if (window.scrollY !== 0) {
          window.scrollTo(0, 0);
        }
      };
      // For some browsers, checking/setting body scroll top also helps
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      window.addEventListener("scroll", handleWindowScrollLock, { passive: true });
      return () => {
        window.removeEventListener("scroll", handleWindowScrollLock);
      };
    }
  }, [isInputActive, showAdminPortal]);

  // Auto-scroll input into view on focus (helpful for mobile viewports under virtual keyboard) and manage focus state
  useEffect(() => {
    const handleGlobalFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA") &&
        (target as HTMLInputElement).type !== "checkbox" &&
        (target as HTMLInputElement).type !== "radio"
      ) {
        setIsInputActive(true);
        
        // Find nearest scrollable container with highest precision (matching our explicitly designed scroll bodies first)
        setTimeout(() => {
          let scrollParent = target.closest("#cart-drawer-scroll-body, #account-drawer-scroll-body, [id$='scroll-body']") as HTMLElement | null;
          
          if (!scrollParent) {
            let el = target.parentElement;
            while (el) {
              const overflow = window.getComputedStyle(el).overflowY;
              const isYScrollable = (overflow === "auto" || overflow === "scroll") && el.scrollHeight > el.clientHeight;
              if (isYScrollable) {
                scrollParent = el;
                break;
              }
              el = el.parentElement;
            }
          }

          if (scrollParent) {
            const parentRect = scrollParent.getBoundingClientRect();
            const targetRect = target.getBoundingClientRect();
            const relativeTop = targetRect.top - parentRect.top + scrollParent.scrollTop;
            
            // Bring target into safe visible view zone within the scroll wrapper (offsetting header height and padding)
            scrollParent.scrollTo({
              top: Math.max(0, relativeTop - 35),
              behavior: "smooth"
            });
          } else {
            target.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
          
          // Re-assert zero coordinates on parent document to completely prevent shift/black space on visual keyboard opens only when NOT in Admin Panel
          if (!showAdminPortal) {
            window.scrollTo(0, 0);
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
          }
        }, 80);
      }
    };

    const handleGlobalBlur = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      ) {
        setTimeout(() => {
          const activeEl = document.activeElement;
          if (
            !activeEl ||
            (activeEl.tagName !== "INPUT" && activeEl.tagName !== "TEXTAREA")
          ) {
            setIsInputActive(false);
          }
        }, 120);
      }
    };

    window.addEventListener("focusin", handleGlobalFocus);
    window.addEventListener("focusout", handleGlobalBlur);
    return () => {
      window.removeEventListener("focusin", handleGlobalFocus);
      window.removeEventListener("focusout", handleGlobalBlur);
    };
  }, [showAdminPortal]);

  // Reset pagination to first page upon category change or search input query updates
  useEffect(() => {
    setCurrentPage(1);
    if (selectedCategory !== "Perfume" && selectedCategory !== "Food & Beverage" && selectedCategory !== "Clothing") {
      setSelectedSubCategory(null);
    }
  }, [selectedCategory, searchQuery]);

  // Whenever selectedProduct changes, reset active image index to 0 and set up auto-slideshow for upload gallery
  useEffect(() => {
    setActiveImageIndex(0);
    setNotifyContactInput("");
    setNotifySuccess(false);
    setNotifyError(null);
    setIsNarrativeExpanded(false);
    setNarrativeActiveLang(lang);
    if (!selectedProduct) return;

    const availableImages = (selectedProduct.images && selectedProduct.images.filter(img => img.trim() !== "")) || [];
    const finalImages = availableImages.length > 0 ? availableImages : [selectedProduct.image];

    if (finalImages.length <= 1) return;

    const interval = setInterval(() => {
      setActiveImageIndex((prev) => (prev === finalImages.length - 1 ? 0 : prev + 1));
    }, 2500); // Cycles image every 2.5 seconds

    return () => clearInterval(interval);
  }, [selectedProduct, lang]);

  // Cart Management States
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [showCheckoutForm, setShowCheckoutForm] = useState(false);
  
  // Checkout Form States
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState<"inside" | "outside">("inside");
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "bKash" | "Nagad" | "Upay" | "Bank" | "Rocket">("COD");
  const [paymentSender, setPaymentSender] = useState("");
  const [paymentTrxId, setPaymentTrxId] = useState("");
  const [checkoutNotification, setCheckoutNotification] = useState<string | null>(null);
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);
  const [adminSelectedOrder, setAdminSelectedOrder] = useState<Order | null>(null);
  const [printingOrderQrUrl, setPrintingOrderQrUrl] = useState<string>("");
  const [printingCustomerReport, setPrintingCustomerReport] = useState<any | null>(null);
  const [printingInventoryCategory, setPrintingInventoryCategory] = useState<string | null>(null);
  const [printingInventorySubCategory, setPrintingInventorySubCategory] = useState<string | null>(null);
  const [printingInventoryProducts, setPrintingInventoryProducts] = useState<Product[] | null>(null);

  // Direct Purchase / Buy Now States to address user requests for product option, quanti, billing address, payment method and confirmation wizard
  const [directCheckoutProduct, setDirectCheckoutProduct] = useState<Product | null>(null);
  const [directQty, setDirectQty] = useState<number>(1);
  const [directOption, setDirectOption] = useState<string>("M"); // standard sizing option
  const [directNotes, setDirectNotes] = useState<string>("");
  const [directStep, setDirectStep] = useState<"checkout" | "success">("checkout");
  const [directOrderRef, setDirectOrderRef] = useState<string>("");

  const isInsideIframe = checkIfInsideIframe();

  const getPrintUrl = (orderId: string) => {
    return `${window.location.protocol}//${window.location.host}${window.location.pathname}?invoiceId=${orderId}&print=true`;
  };

  useEffect(() => {
    if (printingOrder) {
      QRCode.toDataURL(printingOrder.id, {
        width: 180,
        margin: 1,
        color: {
          dark: "#0f172a",
          light: "#ffffff"
        }
      })
      .then((url) => {
        setPrintingOrderQrUrl(url);
      })
      .catch((err) => {
        console.error("Order QR Code Generation failed:", err);
      });
    } else {
      setPrintingOrderQrUrl("");
    }
  }, [printingOrder]);

  const [lastPlacedOrder, setLastPlacedOrder] = useState<Order | null>(null);
  
  // Try-catch safe print action handler with automatic new-tab routing and fail-safes
  const handlePrintAction = (e?: React.MouseEvent) => {
    if (e) {
      if (typeof e.preventDefault === "function") e.preventDefault();
      if (typeof e.stopPropagation === "function") e.stopPropagation();
    }

    const isInsideIframe = checkIfInsideIframe();
    if (isInsideIframe) {
      if (printingOrder) {
        const printUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?invoiceId=${printingOrder.id}&print=true`;
        window.open(printUrl, "_blank");
      } else {
        alert(
          lang === "en"
            ? "Browsers block printer triggers from inside sandbox preview screens. Please open this app in a new tab first to print."
            : "ব্রাউজার সিকিউরিটি ফ্রেম থেকে সরাসরি প্রিন্ট করা ব্লক করেছে। অনুগ্রহ করে অ্যাপটি নতুন ট্যাবে ওপেন করে ট্রাই করুন।"
        );
      }
      return;
    }

    try {
      window.print();
    } catch (err) {
      console.warn("Direct window.print() failed:", err);
      alert(
        lang === "en" 
          ? "Standard printer window could not be displayed automatically. Press Ctrl+P or Cmd+P to print." 
          : "সরাসরি প্রিন্ট করা যায়নি। অনুগ্রহ করে Ctrl+P বা Cmd+P চেপে মেমোটি প্রিন্ট করুন!"
      );
    }
  };

  // Safe client-side local PDF download handler
  const downloadInvoicePdf = (order: Order) => {
    try {
      const pdfBlob = generateInvoicePdfBlob(order, lang, settings);
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `RIEMART_Invoice_${order.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("PDF generation or download failed:", err);
      alert(
        lang === "en"
          ? "Failed to generate local PDF download. Please use the Print button instead."
          : "অফলাইন পিডিএফ তৈরি করতে ব্যর্থ হয়েছে। দয়া করে সরাসরি প্রিন্ট করুন!"
      );
    }
  };

  const handleCustomerPrintAction = (customer: any) => {
    const isInsideIframe = checkIfInsideIframe();
    if (isInsideIframe) {
      const printUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?customerReportPhone=${customer.phone}&print=true`;
      window.open(printUrl, "_blank");
    } else {
      try {
        window.print();
      } catch (err) {
        console.warn("Direct window.print() failed:", err);
        alert(
          lang === "en" 
            ? "Standard printer window could not be displayed automatically. Press Ctrl+P or Cmd+P to print." 
            : "সরাসরি প্রিন্ট করা যায়নি। অনুগ্রহ করে Ctrl+P বা Cmd+P চেপে মেমোটি প্রিন্ট করুন!"
        );
      }
    }
  };

  // Check URL query parameters on initial mount or state updates for automatic print view load
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const invoiceId = params.get("invoiceId") || params.get("printOrder") || params.get("orderId");
      if (invoiceId) {
        // Fallback search of localStorage directly in case state is not fully injected yet
        const savedOrdersStr = localStorage.getItem("riemart_orders");
        const savedUserOrdersStr = localStorage.getItem("riemart_user_orders");
        const savedOrders = savedOrdersStr ? JSON.parse(savedOrdersStr) : [];
        const savedUserOrders = savedUserOrdersStr ? JSON.parse(savedUserOrdersStr) : [];
        const allOrders = [...orders, ...userOrders, ...savedOrders, ...savedUserOrders];
        
        // Find matching order
        const match = allOrders.find((o) => String(o.id) === String(invoiceId));
        if (match) {
          setPrintingOrder(match);
        }
      }
    } catch (err) {
      console.error("Failed to parse invoiceId from query parameters on load:", err);
    }
  }, [orders, userOrders]);

  // Lightning-fast automatic print trigger on load for external new tab print flows
  useEffect(() => {
    if (printingOrder || printingCustomerReport) {
      const params = new URLSearchParams(window.location.search);
      const shouldAutoPrint = params.get("print") === "true";
      const isInsideIframe = checkIfInsideIframe();
      
      if (shouldAutoPrint && !isInsideIframe) {
        // Run with a minimal 200ms delay to guarantee full render & font paint
        const timer = setTimeout(() => {
          try {
            window.print();
          } catch (err) {
            console.error("Automated window.print() failed:", err);
          }
        }, 200);
        return () => clearTimeout(timer);
      }
    }
  }, [printingOrder, printingCustomerReport]);
  
  // Active Invoice Append-on Mode States
  const [activeAppendOrderId, setActiveAppendOrderId] = useState<string | null>(null);
  const [invoiceConfirmedNotification, setInvoiceConfirmedNotification] = useState<boolean>(false);

  // Google Drive Integration States
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem("riemart_gdrive_token") || null;
    } catch {
      return null;
    }
  });

  const [googleClientId, setGoogleClientId] = useState<string>(() => {
    const envId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
    if (envId) return envId;
    try {
      return localStorage.getItem("riemart_gdrive_client_id") || "";
    } catch {
      return "";
    }
  });

  const [customClientIdInput, setCustomClientIdInput] = useState("");
  const [showDriveConfigModal, setShowDriveConfigModal] = useState(false);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState<boolean>(false);
  const [gdriveResult, setGdriveResult] = useState<{ id: string; name: string; webViewLink: string } | null>(null);
  const [gdriveError, setGdriveError] = useState<string | null>(null);
  const [autoUploadOrderId, setAutoUploadOrderId] = useState<string | null>(null);

  // Google Sheets Integration States
  const [googleSheetsAutoSync, setGoogleSheetsAutoSync] = useState<boolean>(() => {
    try {
      return localStorage.getItem("riemart_sheets_autosync") === "true";
    } catch {
      return false;
    }
  });
  const [googleSheetId, setGoogleSheetId] = useState<string>(() => {
    try {
      return localStorage.getItem("riemart_google_sheet_id") || "";
    } catch {
      return "";
    }
  });
  const [isSyncingSheets, setIsSyncingSheets] = useState<boolean>(false);
  const [sheetsError, setSheetsError] = useState<string | null>(null);
  const [sheetsSuccessMsg, setSheetsSuccessMsg] = useState<string | null>(null);
  const [autoSheetsExport, setAutoSheetsExport] = useState<boolean>(false);

  // Synchronize Google Client ID, Folder ID, and Sheets list IDs from globally-synced settings (Firestore database)
  useEffect(() => {
    if (settings) {
      if (settings.googleClientId && settings.googleClientId !== googleClientId) {
        setGoogleClientId(settings.googleClientId);
        try {
          localStorage.setItem("riemart_gdrive_client_id", settings.googleClientId);
        } catch (e) {}
      }
      if (settings.googleFolderId) {
        try {
          localStorage.setItem("riemart_gdrive_folder_id", settings.googleFolderId);
        } catch (e) {}
      }
      if (settings.googleSheetId && settings.googleSheetId !== googleSheetId) {
        setGoogleSheetId(settings.googleSheetId);
        try {
          localStorage.setItem("riemart_google_sheet_id", settings.googleSheetId);
        } catch (e) {}
      }
    }
  }, [settings, googleClientId, googleSheetId]);


  // Capture Google OAuth redirect hash parameters
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.location.hash) {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get("access_token");
        const stateStr = params.get("state");

        if (accessToken) {
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem("riemart_gdrive_token", accessToken);
            } catch {}
            if (window.opener) {
              try {
                window.opener.postMessage({ type: "OAUTH_ACCESS_TOKEN", accessToken }, "*");
                window.close();
                return;
              } catch (err) {
                console.warn("Failed to message opener window:", err);
              }
            }
          }

          try {
            window.history.replaceState(null, "", window.location.pathname + window.location.search);
          } catch (e) {
            window.location.hash = "";
          }

          setGoogleAccessToken(accessToken);
          try {
            sessionStorage.setItem("riemart_gdrive_token", accessToken);
            localStorage.setItem("riemart_gdrive_token", accessToken);
          } catch {}

          if (stateStr) {
            try {
              const decodedState = decodeURIComponent(stateStr);
              const stateObj = JSON.parse(decodedState);
              if (stateObj && stateObj.action === "save_gdrive" && stateObj.orderId) {
                setAutoUploadOrderId(String(stateObj.orderId));
              } else if (stateObj && stateObj.action === "save_sheets") {
                setAutoSheetsExport(true);
              }
            } catch (err) {
              console.error("Failed to decode OAuth state:", err);
            }
          }
        }
      }
    } catch (err) {
      console.error("OAuth hash checking error:", err);
    }
  }, []);

  // Real-time automatic Google Drive upload trigger for new orders
  useEffect(() => {
    let autoSync = false;
    try {
      autoSync = localStorage.getItem("riemart_gdrive_autosync") === "true";
    } catch {}
    if (!autoSync) return;

    const token = getStoredDriveToken();
    let folderId = null;
    try {
      folderId = localStorage.getItem("riemart_gdrive_folder_id");
    } catch {}
    if (!token || !folderId) return;

    if (orders.length > 0) {
      const newestOrder = orders[0];
      let lastSyncedId = null;
      try {
        lastSyncedId = sessionStorage.getItem("riemart_gdrive_last_autosynced_id");
      } catch {}
      if (lastSyncedId !== String(newestOrder.id)) {
        try {
          sessionStorage.setItem("riemart_gdrive_last_autosynced_id", String(newestOrder.id));
        } catch {}
        
        const runAutoSync = async () => {
          try {
            const pdfBlob = generateInvoicePdfBlob(newestOrder, lang, settings);
            const fileName = `RIEMART_CashMemo_${newestOrder.id}.pdf`;
            const description = `Auto-synced: RIEMART Invoice #${newestOrder.id} for ${newestOrder.customerName}`;
            
            await uploadInvoiceToFolder(token, folderId, fileName, pdfBlob, description);
            
            addSystemLog(
              "success",
              `[Auto-Sync] Saved Customer Invoice #${newestOrder.id} to Google Drive folder successfully.`,
              `[অটো-সিঙ্ক] গ্রাহকের মেমো #${newestOrder.id} সফলভাবে গুগল ড্রাইভে সেভ করা হয়েছে।`
            );
          } catch (err) {
            console.error("Auto Google Drive sync failed:", err);
          }
        };
        runAutoSync();
      }
    }
  }, [orders, settings, lang]);

  // Auto-upload hook after redirect
  useEffect(() => {
    if (autoUploadOrderId) {
      const allOrders = [...orders, ...userOrders];
      const match = allOrders.find((o) => String(o.id) === String(autoUploadOrderId));
      if (match) {
        setPrintingOrder(match);
        // Trigger save to Google Drive immediately!
        saveInvoiceToGoogleDrive(match);
        setAutoUploadOrderId(null);
      }
    }
  }, [autoUploadOrderId, orders, userOrders]);

  // Auto Sheets export hook after redirect
  useEffect(() => {
    if (autoSheetsExport) {
      exportOrdersToGoogleSheets(orders, true);
      setAutoSheetsExport(false);
    }
  }, [autoSheetsExport]);

  // Local Bookkeeping CSV Export Handler
  const exportToCSV = (filteredOrders: Order[]) => {
    const headers = [
      "Order ID",
      "Date & Time",
      "Customer Name",
      "Customer Phone",
      "Customer Address",
      "Order Notes",
      "Items Bought",
      "Discount Applied (BDT)",
      "Total Price (BDT)",
      "Payment Method",
      "Sender Phone",
      "TrxID",
      "Carriage Status"
    ];

    const escapeCSV = (str: any) => {
      if (str === null || str === undefined) return '""';
      const escaped = str.toString().replace(/"/g, '""');
      return `"${escaped}"`;
    };

    const rows = filteredOrders.map((or) => {
      const itemsStr = or.items
        .map((it) => `${it.productNameEn || it.productNameBn} (x${it.quantity})`)
        .join(", ");
      return [
        escapeCSV(or.id),
        escapeCSV(new Date(or.date).toLocaleString()),
        escapeCSV(or.customerName),
        escapeCSV(or.customerPhone),
        escapeCSV(or.customerAddress),
        escapeCSV(or.orderNotes || ""),
        escapeCSV(itemsStr),
        or.discountApplied || 0,
        or.totalPrice || 0,
        escapeCSV(or.paymentMethod || "COD"),
        escapeCSV(or.paymentSender || ""),
        escapeCSV(or.paymentTrxId || ""),
        escapeCSV(or.status)
      ];
    });

    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `RIEMART_Orders_Bookkeeping_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Local Inventory CSV Export Handler
  const exportInventoryToCSV = () => {
    const headers = [
      "SKU",
      "Name (English)",
      "Name (Bangla)",
      "Price",
      "Inventory",
      "Category",
      "Subcategory",
      "Eligible for Custom Offers",
      "Description (English)",
      "Description (Bangla)"
    ];

    const escapeCSV = (str: any) => {
      if (str === null || str === undefined) return '""';
      const escaped = str.toString().replace(/"/g, '""');
      return `"${escaped}"`;
    };

    const rows = products.map((p) => {
      return [
        escapeCSV(p.sku || p.id),
        escapeCSV(p.nameEn),
        escapeCSV(p.nameBn),
        p.price || 0,
        p.inventory || 0,
        escapeCSV(p.category),
        escapeCSV(p.subCategory || "N/A"),
        p.offers ? "YES" : "NO",
        escapeCSV(p.descriptionEn || ""),
        escapeCSV(p.descriptionBn || "")
      ];
    });

    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `RIEMART_Product_Catalog_Export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Emit live system audit log
    addSystemLog(
      "info",
      `📥 Exported product catalog inventory (${products.length} products) as optimized CSV file.`,
      `📥 প্রোডাক্ট ক্যাটালগ ইনভেন্টরি (${products.length} টি প্রোডাক্ট) এক্সেল/গুগল শিট ফ্রেন্ডলি CSV ফাইলে ডাউনলোড করা হয়েছে।`
    );
  };

  // Google Sheets Export Handler
  const exportOrdersToGoogleSheets = async (ordersToExport: Order[], isManual: boolean) => {
    if (!googleAccessToken) {
      if (!isManual) {
        console.warn("Google Sheets background auto-sync skipped: access token was missing or expired.");
        return;
      }
      if (!googleClientId) {
        setCustomClientIdInput("");
        setShowDriveConfigModal(true);
        return;
      }
      
      try {
        setSheetsError(null);
        setIsSyncingSheets(true);
        const result = await googleDriveSignIn(googleClientId);
        if (result && result.token) {
          setGoogleAccessToken(result.token);
          // Try exporting again using the obtained token
          setTimeout(() => {
            exportOrdersToGoogleSheets(ordersToExport, isManual);
          }, 100);
        }
      } catch (err: any) {
        console.error("Failed to authenticate for Google Sheets:", err);
        setSheetsError(lang === "en" ? "Google Sheets connection failed or popup was blocked." : "গুগল শিট কানেকশন বা পপআপ ব্লক ব্যর্থ হয়েছে।");
      } finally {
        setIsSyncingSheets(false);
      }
      return;
    }

    setIsSyncingSheets(true);
    setSheetsError(null);
    setSheetsSuccessMsg(null);

    try {
      let sheetId = localStorage.getItem("riemart_google_sheet_id") || "";
      
      // 1. Create a spreadsheet if not already present
      if (!sheetId) {
        const createResponse = await fetch("https://sheets.googleapis.com/v1/spreadsheets", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${googleAccessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            properties: {
              title: "RIEMART Orders Log & Bookkeeping"
            },
            sheets: [
              {
                properties: {
                  title: "Orders"
                }
              }
            ]
          })
        });

        if (!createResponse.ok) {
          if (createResponse.status === 401) {
            setGoogleAccessToken(null);
            sessionStorage.removeItem("riemart_gdrive_token");
            throw new Error("Authentication token has expired. Please log in again.");
          }
          const errText = await createResponse.text();
          throw new Error(`Failed to create spreadsheet: ${errText}`);
        }

        const createData = await createResponse.json();
        sheetId = createData.spreadsheetId;
        localStorage.setItem("riemart_google_sheet_id", sheetId);
        setGoogleSheetId(sheetId);

        // Append header row immediately
        const headers = [
          ["Order ID", "Date & Time", "Customer Name", "Customer Phone", "Customer Address", "Order Notes", "Items", "Discount (BDT)", "Total Price (BDT)", "Payment Method", "Sender Phone", "Trx ID", "Carriage Status"]
        ];

        const headerResponse = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Orders!A1:append?valueInputOption=USER_ENTERED`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${googleAccessToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              values: headers
            })
          }
        );
        if (!headerResponse.ok) {
          console.error("Failed to write headers to Google Sheet:", await headerResponse.text());
        }
      }

      // 2. Format row values to append
      const valuesToAppend = ordersToExport.map((or) => {
        const itemsStr = or.items
          .map((it) => `${it.productNameEn || it.productNameBn} (x${it.quantity})`)
          .join(", ");
        return [
          or.id,
          new Date(or.date).toLocaleString(),
          or.customerName,
          or.customerPhone,
          or.customerAddress,
          or.orderNotes || "",
          itemsStr,
          or.discountApplied || 0,
          or.totalPrice || 0,
          or.paymentMethod || "COD",
          or.paymentSender || "",
          or.paymentTrxId || "",
          or.status
        ];
      });

      if (valuesToAppend.length === 0) {
        setIsSyncingSheets(false);
        return;
      }

      const appendResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Orders!A1:append?valueInputOption=USER_ENTERED`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${googleAccessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            values: valuesToAppend
          })
        }
      );

      if (!appendResponse.ok) {
        const errText = await appendResponse.text();
        throw new Error(`Failed to append rows to Google sheet: ${errText}`);
      }

      setSheetsSuccessMsg(
        lang === "en"
          ? `Successfully synchronized ${valuesToAppend.length} order(s) to Google Sheets!`
          : `সাফল্যের সাথে ${valuesToAppend.length} টি অর্ডার গুগল শিটে সিঙ্ক করা হয়েছে!`
      );

      addSystemLog(
        "success",
        `Synchronized ${valuesToAppend.length} orders to Google Sheets Spreadsheet ID: ${sheetId}`,
        `গুগল শিটে ${valuesToAppend.length} টি অডার তথ্য রেকর্ড সংযোজন করা হয়েছে (আইডি: ${sheetId})`
      );

    } catch (err: any) {
      console.error("Google Sheets sync error:", err);
      setSheetsError(err.message || "Failed to sync with Google Sheets. Please check your config Client ID.");
    } finally {
      setIsSyncingSheets(false);
    }
  };

  const saveInvoiceToGoogleDrive = async (order: Order, isManual: boolean = true) => {
    if (!googleAccessToken) {
      if (!isManual) {
        console.warn("Google Drive background auto-upload skipped: access token was missing or expired.");
        return;
      }
      if (!googleClientId) {
        setCustomClientIdInput("");
        setShowDriveConfigModal(true);
        return;
      }
      
      try {
        setIsUploadingToDrive(true);
        setGdriveError(null);
        setGdriveResult(null);
        const result = await googleDriveSignIn(googleClientId);
        if (result && result.token) {
          setGoogleAccessToken(result.token);
          setTimeout(() => {
            saveInvoiceToGoogleDrive(order, isManual);
          }, 100);
        }
      } catch (err: any) {
        console.error("Failed to authenticate for Google Drive:", err);
        setGdriveError(lang === "en" ? "Google Drive connection failed or popup was blocked." : "গুগল ড্রাইভ কানেকশন বা পপআপ ব্লক ব্যর্থ হয়েছে।");
        setIsUploadingToDrive(false);
      }
      return;
    }

    setIsUploadingToDrive(true);
    setGdriveError(null);
    setGdriveResult(null);

    try {
      const pdfBlob = generateInvoicePdfBlob(order, lang, settings);
      const fileName = `RIEMART_CashMemo_${order.id}.pdf`;

      const metadata = {
        name: fileName,
        mimeType: "application/pdf",
        description: `Official RIEMART Customer Billing Memo Invoice for Order #${order.id} purchased on ${new Date(order.date).toLocaleDateString()}`,
      };

      const formData = new FormData();
      formData.append(
        "metadata",
        new Blob([JSON.stringify(metadata)], { type: "application/json" })
      );
      formData.append("file", pdfBlob);

      const response = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${googleAccessToken}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          setGoogleAccessToken(null);
          try {
            sessionStorage.removeItem("riemart_gdrive_token");
          } catch {}
          throw new Error("Google access token has expired. Please try again to authenticate.");
        }
        if (response.status === 403) {
          throw new Error(
            lang === "en"
              ? "Google Drive API Access Denied (403 Forbidden). This usually means your custom Google Client ID is unverified, lacks necessary drive scopes, or your logged-in Google Account email is not registered as a 'Test User' in your Google Cloud Console OAuth consent screen page. Please use our safe offline 'Save PDF' button instead to save directly on your local device instantly!"
              : "গুগল ড্রাইভ এপিআই অ্যাক্সেস ডিনাইড (৪০৩ ফরবিডেন)। এর মানে হলো আপনার সেট করা গুগল ক্লায়েন্ট আইডি-তে ড্রাইভ ফাইল সেভ করার পারমিশন নেই অথবা গুগল কনসোল প্রজেক্টে আপনার ইমেইলটি 'টেস্ট ইউজার' হিসেবে অ্যাড করা নেই। অনুগ্রহ করে আমাদের নিরাপদ অফলাইন 'পিডিএফ সেভ' বাটনটি ব্যবহার করে ক্যাশ মেমোটি সরাসরি ডাউনলোড করে নিন!"
          );
        }
        const errTxt = await response.text();
        throw new Error(`Google Upload API Error: ${response.statusText} (${errTxt})`);
      }

      const result = await response.json();
      setGdriveResult(result);
    } catch (err: any) {
      console.error("Google Drive copy upload failure:", err);
      setGdriveError(err.message || String(err));
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  // Customer Account, Save Banking & Live Notifications States
  const [loggedInUser, setLoggedInUser] = useState<{
    name: string;
    phone: string;
    birthDate: string;
    gender: "Male" | "Female" | "Other" | "";
    address: string;
    email?: string;
    socialType?: "google" | "facebook" | "standard";
    savedBkash?: string;
    savedNagad?: string;
    savedUpay?: string;
    profilePicture?: string;
    wishlistProductIds?: string[];
    category?: string;
  } | null>(() => {
    try {
      const saved = localStorage.getItem("riemart_user_account");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editProfileName, setEditProfileName] = useState("");
  const [editProfileBirthDate, setEditProfileBirthDate] = useState("");
  const [editProfileGender, setEditProfileGender] = useState<"Male" | "Female" | "Other" | "">("");
  const [editProfileEmail, setEditProfileEmail] = useState("");
  const [editProfileAddress, setEditProfileAddress] = useState("");

  const [registeredUsers, setRegisteredUsers] = useState<{
    name: string;
    phone: string;
    birthDate: string;
    gender: "Male" | "Female" | "Other" | "";
    address: string;
    email?: string;
    socialType?: "google" | "facebook" | "standard";
    savedBkash?: string;
    savedNagad?: string;
    savedUpay?: string;
    profilePicture?: string;
    wishlistProductIds?: string[];
    category?: string;
  }[]>(() => {
    try {
      const saved = localStorage.getItem("riemart_registered_users");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        name: "Gentleman Buyer",
        phone: "01711223344",
        birthDate: "1995-12-01",
        gender: "Male",
        address: "Dhaka, Bangladesh",
        email: "buyer@riemart.app",
        savedBkash: "01711223344",
        savedNagad: "",
        savedUpay: "",
        category: "VIP",
        wishlistProductIds: ["p1", "p2", "p_perfume_women"]
      },
      {
        name: "Anisur Rahman",
        phone: "01788223344",
        birthDate: "1993-04-15",
        gender: "Male",
        address: "Mirpur DOHS, Dhaka",
        email: "anisur.google@gmail.com",
        savedBkash: "01788223344",
        savedNagad: "01788223344",
        savedUpay: "",
        category: "Gold",
        wishlistProductIds: ["p3", "p4"]
      },
      {
        name: "Farhana Jasmin",
        phone: "01855443322",
        birthDate: "1996-08-25",
        gender: "Female",
        address: "Dhanmondi Rd 27, Dhaka",
        email: "farhana.jasmin@fb-node.com",
        savedBkash: "",
        savedNagad: "01855443322",
        savedUpay: "01855443322",
        category: "Silver",
        wishlistProductIds: ["p2"]
      }
    ];
  });

  // Safe lazy check of customerReportPhone query param to trigger printable dossier view after registeredUsers is loaded
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const customerReportPhone = params.get("customerReportPhone");
      if (customerReportPhone) {
        const savedUsersStr = localStorage.getItem("riemart_registered_users");
        const savedUsers = savedUsersStr ? JSON.parse(savedUsersStr) : [];
        const allUsers = [...registeredUsers, ...savedUsers];
        const match = allUsers.find((u: any) => String(u.phone).trim() === String(customerReportPhone).trim());
        if (match) {
          setPrintingCustomerReport(match);
        }
      }
    } catch (err) {
      console.error("Failed to parse customerReportPhone query parameter:", err);
    }
  }, [registeredUsers]);

  // Safe lazy check of inventoryPrintCategory query param to trigger printable inventory list after products loaded
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const inventoryPrintCategory = params.get("inventoryPrintCategory");
      const inventoryPrintSubCategory = params.get("inventoryPrintSubCategory") || "All";
      if (inventoryPrintCategory) {
        // filter products of category
        let list = products;
        if (inventoryPrintCategory !== "All") {
          list = list.filter(p => p.category === inventoryPrintCategory);
        }
        if (inventoryPrintSubCategory && inventoryPrintSubCategory !== "All") {
          list = list.filter(p => p.subCategory && p.subCategory.trim() === inventoryPrintSubCategory);
        }
        setPrintingInventoryCategory(inventoryPrintCategory);
        setPrintingInventorySubCategory(inventoryPrintSubCategory);
        setPrintingInventoryProducts(list);
      }
    } catch (err) {
      console.error("Failed to parse inventoryPrintCategory query parameter:", err);
    }
  }, [products]);

  const [accountActiveTab, setAccountActiveTab] = useState<"profile" | "orders" | "wishlist" | "notifications" | "login" | "register">("login");
  const [authName, setAuthName] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authBirthDate, setAuthBirthDate] = useState("");
  const [authGender, setAuthGender] = useState<"Male" | "Female" | "Other" | "">("");
  const [authAddress, setAuthAddress] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authProfilePicture, setAuthProfilePicture] = useState("");
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [socialAuthType, setSocialAuthType] = useState<"google" | "facebook" | null>(null);

  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [customerNotifications, setCustomerNotifications] = useState<{
    id: string;
    titleEn: string;
    titleBn: string;
    messageEn: string;
    messageBn: string;
    date: string;
    isRead: boolean;
    type: "offer" | "order_confirmed" | "order_rejected" | "wishlist_update";
    customerPhone?: string;
  }[]>(() => {
    try {
      const saved = localStorage.getItem("riemart_user_notifications");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: "notif-1",
        titleEn: "Welcome to Riemart!",
        titleBn: "রিমার্ট-এ আপনাকে স্বাগতম!",
        messageEn: "Create your personal account today to dispatch fast-track orders, save your mobile numbers, and view wishlist items.",
        messageBn: "আপনার নিজস্ব কাস্টমার অ্যাকাউন্ট তৈরি করুন এবং দ্রুত অর্ডার ট্র্যাকিং, বিকাশ/নগদ নাম্বার সেভ করা ও সহজে উইশলিস্ট দেখার সুবিধা উপভোগ করুন।",
        date: new Date(Date.now() - 3600000).toISOString(),
        isRead: false,
        type: "offer"
      },
      {
        id: "notif-2",
        titleEn: "Watches Festive Bumper: Free Premium Gifts!",
        titleBn: "উৎসবের আমেজ: ঘড়ির সাথে আকর্ষণীয় গিফট বুঝে নিন!",
        messageEn: "Add any elite watches to your cart and enjoy custom matching brand boxes.",
        messageBn: "আপনার পছন্দের ঘড়ি অর্ডার করলেই উপহার হিসেবে উন্নতমানের গিফট বক্স পাঠানো হবে।",
        date: new Date(Date.now() - 7200000).toISOString(),
        isRead: false,
        type: "offer"
      }
    ];
  });

  const getFilteredNotifications = () => {
    return customerNotifications.filter((n) => {
      if (!n.customerPhone) return true;
      if (loggedInUser && n.customerPhone === loggedInUser.phone) return true;
      return false;
    });
  };

  const markFilteredNotificationsAsRead = () => {
    const filteredIds = new Set(getFilteredNotifications().map((n) => n.id));
    setCustomerNotifications((prev) =>
      prev.map((n) => (filteredIds.has(n.id) ? { ...n, isRead: true } : n))
    );
  };

  const displayedUserOrders = (() => {
    if (loggedInUser) {
      const phoneClean = loggedInUser.phone?.trim();
      if (!phoneClean) return [];
      return orders.filter(
        (o) => o && o.customerPhone && (o.customerPhone.trim() === phoneClean || normalizePhone(o.customerPhone) === normalizePhone(phoneClean))
      );
    } else {
      // Guest: filter orders that are placed locally in this browser/session
      try {
        const savedIds = localStorage.getItem("riemart_local_placed_order_ids");
        const localIds = savedIds ? JSON.parse(savedIds) : [];
        if (Array.isArray(localIds) && localIds.length > 0) {
          return orders.filter((o) => o && localIds.includes(o.id));
        }
      } catch (e) {
        console.error(e);
      }
      return [];
    }
  })();

  // Admin Security States
  const [isAdminAuthorized, setIsAdminAuthorized] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminTriggerClicks, setAdminTriggerClicks] = useState(0);
  const [adminSubView, setAdminSubView] = useState<"dashboard" | "customers" | "qr_generator" | "inventory_report" | "gdrive" | "delivery_settings">("dashboard");
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [expandedCustomerPanel, setExpandedCustomerPanel] = useState<Record<string, "wishlist" | "orders" | "statement" | null>>({});

  // Atelier Control Room Operations
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [adminSuccessNotification, setAdminSuccessNotification] = useState<{messageEn: string, messageBn: string} | null>(null);

  // Catalog Manager Search, Category Filtering, & Lightweight Pagination States
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogCategory, setCatalogCategory] = useState("All");
  const [catalogPage, setCatalogPage] = useState(1);
  const CATALOG_ITEMS_PER_PAGE = 8;

  // Ultra-Optimized Limits for Smooth Scroll and Render
  const [adminOrdersLimit, setAdminOrdersLimit] = useState<number>(10);
  const [adminCustomersLimit, setAdminCustomersLimit] = useState<number>(8);

  useEffect(() => {
    setAdminOrdersLimit(10);
  }, [adminOrderStatusFilter, adminOrderStartDate, adminOrderEndDate, adminOrderSearchTerm]);

  useEffect(() => {
    setAdminCustomersLimit(8);
  }, [customerSearchQuery]);

  // Memoized lists of filtered and paginated products inside catalog for extremely fast rendering
  const filteredProductsForCatalog = useMemo(() => {
    const searchVal = catalogSearch.trim().toLowerCase();
    return products.filter((p) => {
      if (p.isDeleted || p.status === "deleted") return false;
      const nameEn = (p.nameEn || "").toLowerCase();
      const nameBn = (p.nameBn || "").toLowerCase();
      const sku = (p.sku || "").toLowerCase();
      const matchesSearch = 
        !searchVal || 
        nameEn.includes(searchVal) || 
        nameBn.includes(searchVal) || 
        sku.includes(searchVal);
      const matchesCategory = 
        catalogCategory === "All" || 
        p.category === catalogCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, catalogSearch, catalogCategory]);

  const totalCatalogPages = useMemo(() => {
    return Math.ceil(filteredProductsForCatalog.length / CATALOG_ITEMS_PER_PAGE) || 1;
  }, [filteredProductsForCatalog.length]);

  const paginatedProductsForCatalog = useMemo(() => {
    // Correct potential out-of-bounds page values immediately
    const validPage = Math.min(Math.max(1, catalogPage), totalCatalogPages);
    const startIndex = (validPage - 1) * CATALOG_ITEMS_PER_PAGE;
    return filteredProductsForCatalog.slice(startIndex, startIndex + CATALOG_ITEMS_PER_PAGE);
  }, [filteredProductsForCatalog, catalogPage, totalCatalogPages]);

  // Buffer state for writing/modifying products
  const [productBuffer, setProductBuffer] = useState<Partial<Product>>({
    sku: "",
    nameEn: "",
    nameBn: "",
    category: "Perfume",
    price: 50,
    regularPrice: undefined,
    image: "",
    images: ["", "", "", "", "", ""],
    descriptionEn: "",
    descriptionBn: "",
    inventory: 20,
    offers: false,
    specificationsEn: [""],
    specificationsBn: [""]
  });

  // Gemini Assistance buffer states
  const [geminiPromptInput, setGeminiPromptInput] = useState("");
  const [geminiGenerating, setGeminiGenerating] = useState(false);
  const [geminiError, setGeminiError] = useState<string | null>(null);

  // AI Image generation states
  const [aiImagePrompt, setAiImagePrompt] = useState("");
  const [isGeneratingAiImage, setIsGeneratingAiImage] = useState(false);
  const [aiImageError, setAiImageError] = useState<string | null>(null);
  const [showAiImageGenerator, setShowAiImageGenerator] = useState(false);

  // Notify Me on Price Drop states
  const [notifyContactInput, setNotifyContactInput] = useState("");
  const [notifySuccess, setNotifySuccess] = useState(false);
  const [notifyError, setNotifyError] = useState<string | null>(null);

  // ==================== HTML5 HISTORY API SEQUENTIAL BACK NAVIGATION FOR MOBILE ====================
  const isHistoryInitializedRef = useRef(false);
  const isPopping = useRef(false);
  const lastPushedState = useRef<any>(null);

  // Initialize baseline stack entry on mount
  useEffect(() => {
    if (!isHistoryInitializedRef.current) {
      const initialAppState = {
        selectedCategory,
        selectedSubCategory,
        selectedProduct,
        isCartOpen,
        showCheckoutForm,
        isAccountOpen,
        showAdminPortal,
        directCheckoutProduct,
        showAiImageGenerator,
        printingOrder,
        printingCustomerReport,
        printingInventoryCategory,
        printingInventorySubCategory,
        printingInventoryProducts,
        adminSubView,
      };
      window.history.replaceState(initialAppState, "");
      lastPushedState.current = initialAppState;
      isHistoryInitializedRef.current = true;
    }
  }, []);

  // Monitor app state alterations to dynamically record physical history checkpoints
  useEffect(() => {
    if (!isHistoryInitializedRef.current) return;
    if (isPopping.current) return;

    const currentAppState = {
      selectedCategory,
      selectedSubCategory,
      selectedProduct,
      isCartOpen,
      showCheckoutForm,
      isAccountOpen,
      showAdminPortal,
      directCheckoutProduct,
      showAiImageGenerator,
      printingOrder,
      printingCustomerReport,
      printingInventoryCategory,
      printingInventorySubCategory,
      printingInventoryProducts,
      adminSubView,
    };

    const currentStr = JSON.stringify(currentAppState);
    const lastStr = lastPushedState.current ? JSON.stringify(lastPushedState.current) : "";

    if (currentStr !== lastStr) {
      window.history.pushState(currentAppState, "");
      lastPushedState.current = currentAppState;
    }
  }, [
    selectedCategory,
    selectedSubCategory,
    selectedProduct,
    isCartOpen,
    showCheckoutForm,
    isAccountOpen,
    showAdminPortal,
    directCheckoutProduct,
    showAiImageGenerator,
    printingOrder,
    printingCustomerReport,
    printingInventoryCategory,
    printingInventorySubCategory,
    printingInventoryProducts,
    adminSubView,
  ]);

  // Intercept browser and hardware back navigation commands natively
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const poppedState = event.state;
      isPopping.current = true;

      if (poppedState) {
        lastPushedState.current = poppedState;
        
        // Sequentially unwind overlay views, active screens, or dialog states matching the popped state
        if (poppedState.selectedCategory !== undefined) setSelectedCategory(poppedState.selectedCategory);
        if (poppedState.selectedSubCategory !== undefined) setSelectedSubCategory(poppedState.selectedSubCategory);
        setSelectedProduct(poppedState.selectedProduct || null);
        setIsCartOpen(!!poppedState.isCartOpen);
        setShowCheckoutForm(!!poppedState.showCheckoutForm);
        setIsAccountOpen(!!poppedState.isAccountOpen);
        setShowAdminPortal(!!poppedState.showAdminPortal);
        setDirectCheckoutProduct(poppedState.directCheckoutProduct || null);
        setShowAiImageGenerator(!!poppedState.showAiImageGenerator);
        setPrintingOrder(poppedState.printingOrder || null);
        setPrintingCustomerReport(poppedState.printingCustomerReport || null);
        setPrintingInventoryCategory(poppedState.printingInventoryCategory || null);
        setPrintingInventorySubCategory(poppedState.printingInventorySubCategory || null);
        setPrintingInventoryProducts(poppedState.printingInventoryProducts || null);
        if (poppedState.adminSubView) {
          setAdminSubView(poppedState.adminSubView);
        }
      } else {
        // Fall back to baseline home state if no history state resides in the transaction queue
        setSelectedCategory("All");
        setSelectedSubCategory(null);
        setSelectedProduct(null);
        setIsCartOpen(false);
        setShowCheckoutForm(false);
        setIsAccountOpen(false);
        setShowAdminPortal(false);
        setDirectCheckoutProduct(null);
        setShowAiImageGenerator(false);
        setPrintingOrder(null);
        setPrintingCustomerReport(null);
        setPrintingInventoryCategory(null);
        setPrintingInventorySubCategory(null);
        setPrintingInventoryProducts(null);
      }

      // Reset popping flag asynchronously after React has batched state renders
      setTimeout(() => {
        isPopping.current = false;
      }, 0);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  // Live Sync Log Entry Type for UI feedback
  interface SyncLogEntry {
    id: string;
    time: string;
    key: string;
    action: "upload" | "save";
    status: "pending" | "success" | "failure";
    retryCount: number;
    message: string;
  }

  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([]);
  const syncQueueRef = useRef<Record<string, { data: any; pending: boolean; retryCount: number; id: string }>>({});

  const processSyncQueue = async (key: string) => {
    const queueItem = syncQueueRef.current[key];
    if (!queueItem || queueItem.pending) return;

    queueItem.pending = true;
    const logId = queueItem.id;

    const attemptSync = async (retry: number): Promise<boolean> => {
      try {
        const response = await fetch("/api/sync/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, data: queueItem.data })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} - ${response.statusText}`);
        }

        setSyncLogs((prev) =>
          prev.map((log) =>
            log.id === logId
              ? {
                  ...log,
                  status: "success" as const,
                  message: `✓ Standardized ${key} catalog sequence synchronized cleanly to Cloud storage.`
                }
              : log
          )
        );
        return true;
      } catch (err: any) {
        console.warn(`Sync retry check for ${key} (Attempt ${retry}/5):`, err.message || err);
        
        if (retry < 5) {
          const nextWaitMs = Math.pow(2, retry) * 1000;
          setSyncLogs((prev) =>
            prev.map((log) =>
              log.id === logId
                ? {
                    ...log,
                    retryCount: retry + 1,
                    message: `⏳ Timeout/interruption. Auto-retrying in ${nextWaitMs / 1000}s... (Attempt ${retry + 1}/5)`
                  }
                : log
            )
          );
          await new Promise((resolve) => setTimeout(resolve, nextWaitMs));
          return attemptSync(retry + 1);
        } else {
          setSyncLogs((prev) =>
            prev.map((log) =>
              log.id === logId
                ? {
                    ...log,
                    status: "failure" as const,
                    message: `✖ Failed to sync ${key} after 5 attempts. Manual retry scheduled on next modification. Error: ${err.message || err}`
                  }
                : log
            )
          );
          return false;
        }
      }
    };

    const success = await attemptSync(0);
    queueItem.pending = false;

    // Trigger again if new changes landed while this process was executing
    if (syncQueueRef.current[key] && syncQueueRef.current[key].data !== queueItem.data) {
      processSyncQueue(key);
    }
  };

  const queueSync = (key: string, data: any) => {
    const logId = "slog-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
    syncQueueRef.current[key] = {
      data,
      pending: false,
      retryCount: 0,
      id: logId
    };

    setSyncLogs((prev) => [
      {
        id: logId,
        time: new Date().toLocaleTimeString(),
        key,
        action: "upload" as const,
        status: "pending" as const,
        retryCount: 0,
        message: `⏳ Enqueueing consecutive state for database bulk synchronization...`
      },
      ...prev.slice(0, 39)
    ]);

    processSyncQueue(key);
  };

  // Helper to handle server-side sync state errors elegantly.
  // Warnings are logged for transient network failures (e.g. during server cold start or reboot), while other fatal errors stay logged as errors.
  const handleSyncError = (key: string, err: any) => {
    if (err && (err.name === "TypeError" || err.message === "Failed to fetch")) {
      console.warn(`[Sync Coherence] Port or endpoint busy, temporary connection failure while syncing ${key}. Retrying in next cycle.`);
    } else {
      console.error(`Error syncing ${key} to server:`, err);
    }
  };

  // Server-mediated sync endpoints handle client-to-Firestore syncing robustly.
  // We have retired direct background sync loops to protect catalog list integrity from accidental bulk deletions.

  // Save changes to localStorage helper safely with try-catch blocks and update server-side database dynamically
  useEffect(() => {
    try {
      safeSaveToLocalStorage("riemart_products", products);
      if (syncInitializedRef.current && !isUpdatingFromServer.current) {
        queueSync("products", products);
      }
    } catch (e) {
      console.error("Failed to save products to localStorage:", e);
    }
  }, [products]);

  useEffect(() => {
    try {
      safeSaveToLocalStorage("riemart_settings", settings);
      if (syncInitializedRef.current && !isUpdatingFromServer.current) {
        queueSync("settings", settings);
      }
    } catch (e) {
      console.error("Failed to save settings to localStorage:", e);
    }
  }, [settings]);

  useEffect(() => {
    try {
      safeSaveToLocalStorage("riemart_logs", logs);
      if (syncInitializedRef.current && !isUpdatingFromServer.current) {
        queueSync("logs", logs);
      }
    } catch (e) {
      console.error("Failed to save logs to localStorage:", e);
    }
  }, [logs]);

  useEffect(() => {
    try {
      safeSaveToLocalStorage("riemart_orders", orders);
      if (syncInitializedRef.current && !isUpdatingFromServer.current) {
        queueSync("orders", orders);
      }
    } catch (e) {
      console.error("Failed to save orders to localStorage:", e);
    }
  }, [orders]);

  useEffect(() => {
    try {
      safeSaveToLocalStorage("riemart_user_orders", userOrders);
      if (syncInitializedRef.current && !isUpdatingFromServer.current) {
        queueSync("userOrders", userOrders);
      }
    } catch (e) {
      console.error("Failed to save user orders to localStorage:", e);
    }
  }, [userOrders]);

  const lastUserPhoneRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      safeSaveToLocalStorage("riemart_wishlist", wishlist);
      
      // Update loggedInUser's wishlist and db if active
      if (loggedInUser) {
        const currentWishIds = wishlist.map(p => p.id);
        const userWishIds = loggedInUser.wishlistProductIds || [];
        
        if (JSON.stringify([...currentWishIds].sort()) !== JSON.stringify([...userWishIds].sort())) {
          const updatedUser = {
            ...loggedInUser,
            wishlistProductIds: currentWishIds
          };
          setLoggedInUser(updatedUser);
          setRegisteredUsers((prev) =>
            prev.map((u) => u.phone === loggedInUser.phone ? updatedUser : u)
          );
        }
      }
    } catch (e) {
      console.error("Failed to save wishlist to localStorage & sync profile:", e);
    }
  }, [wishlist, loggedInUser?.phone]);

  useEffect(() => {
    const currentPhone = loggedInUser?.phone || null;
    if (currentPhone !== lastUserPhoneRef.current) {
      lastUserPhoneRef.current = currentPhone;
      
      if (loggedInUser) {
        const userWishIds = loggedInUser.wishlistProductIds || [];
        const userWishlistProducts = products.filter(p => userWishIds.includes(p.id));
        setWishlist(userWishlistProducts);
      } else {
        try {
          const saved = localStorage.getItem("riemart_wishlist");
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              setWishlist(parsed);
              return;
            }
          }
        } catch (e) {
          console.error(e);
        }
        setWishlist([]);
      }
    } else if (loggedInUser) {
      // In case products load later, update wishlist if there are changes
      const userWishIds = loggedInUser.wishlistProductIds || [];
      const userWishlistProducts = products.filter(p => userWishIds.includes(p.id));
      
      const curIdsStr = JSON.stringify(wishlist.map(p => p.id).sort());
      const targetIdsStr = JSON.stringify(userWishlistProducts.map(p => p.id).sort());
      if (curIdsStr !== targetIdsStr) {
        setWishlist(userWishlistProducts);
      }
    }
  }, [loggedInUser?.phone, products]);

  useEffect(() => {
    try {
      safeSaveToLocalStorage("riemart_subscriptions", subscriptions);
      if (syncInitializedRef.current && !isUpdatingFromServer.current) {
        queueSync("subscriptions", subscriptions);
      }
    } catch (e) {
      console.error("Failed to save subscriptions to localStorage:", e);
    }
  }, [subscriptions]);

  useEffect(() => {
    try {
      safeSaveToLocalStorage("riemart_registered_users", registeredUsers);
      if (syncInitializedRef.current && !isUpdatingFromServer.current) {
        queueSync("registeredUsers", registeredUsers);
      }
    } catch (e) {
      console.error("Failed to save registered users to localStorage:", e);
    }
  }, [registeredUsers]);

  useEffect(() => {
    try {
      if (loggedInUser) {
        safeSaveToLocalStorage("riemart_user_account", loggedInUser);
        setRegisteredUsers((prev) => {
          const exists = prev.some((u) => u.phone === loggedInUser.phone);
          if (exists) {
            return prev.map((u) => u.phone === loggedInUser.phone ? loggedInUser : u);
          } else {
            return [...prev, loggedInUser];
          }
        });
      } else {
        localStorage.removeItem("riemart_user_account");
      }
    } catch (e) {
      console.error("Failed to save user account to localStorage:", e);
    }
  }, [loggedInUser]);

  useEffect(() => {
    try {
      safeSaveToLocalStorage("riemart_user_notifications", customerNotifications);
      if (syncInitializedRef.current && !isUpdatingFromServer.current) {
        queueSync("customerNotifications", customerNotifications);
      }
    } catch (e) {
      console.error("Failed to save notifications to localStorage:", e);
    }
  }, [customerNotifications]);

  // Keep references to current states up to date for stable mount synchronization interval checks
  useEffect(() => {
    lastStatesRef.current = {
      products,
      settings,
      orders,
      userOrders,
      logs,
      registeredUsers,
      subscriptions,
      customerNotifications
    };
  }, [products, settings, orders, userOrders, logs, registeredUsers, subscriptions, customerNotifications]);

  // Stable mounting polling effect to keep mobile list & laptop PC state perfectly synchronized
  useEffect(() => {
    // Fail-safe timeout to ensure user is never stuck on an infinite loading screen under any circumstance
    const failSafeTimer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 3500);

    const runSync = async () => {
      try {
        const res = await fetch("/api/sync/get");
        if (!res.ok) {
          throw new Error(`Server responded with status ${res.status}`);
        }

        // Ensure returning type is JSON to prevent "Unexpected token '<', ...is not valid JSON" errors
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error("Received non-JSON response from server, likely HTML fallback during server start.");
        }

        const db = await res.json();
        if (!db) return;

        const current = lastStatesRef.current;
        if (!current) return;

        isUpdatingFromServer.current = true;

        if (db.products) {
          const normalizedProducts = ensureProductsHaveSkus(db.products);
          if (JSON.stringify(normalizedProducts) !== JSON.stringify(current.products)) {
            setProducts(normalizedProducts);
          }
        }
        if (db.settings && JSON.stringify(db.settings) !== JSON.stringify(current.settings)) {
          setSettings(db.settings);
        }
        if (db.orders) {
          // Merge client-local orders and server orders by unique ID to preserve newly placed orders on mobile devices
          const mergedOrders = [...db.orders];
          const dbOrderIds = new Set(db.orders.map((o: any) => o.id));
          for (const localOrder of current.orders || []) {
            if (localOrder && localOrder.id && !dbOrderIds.has(localOrder.id)) {
              mergedOrders.push(localOrder);
            }
          }
          mergedOrders.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

          if (JSON.stringify(mergedOrders) !== JSON.stringify(current.orders)) {
            setOrders(mergedOrders);
          }
        }
        if (db.userOrders) {
          // Merge client-local user orders and server user orders by unique ID to preserve newly placed orders on mobile devices
          const mergedUserOrders = [...db.userOrders];
          const dbUserOrderIds = new Set(db.userOrders.map((o: any) => o.id));
          for (const localOrder of current.userOrders || []) {
            if (localOrder && localOrder.id && !dbUserOrderIds.has(localOrder.id)) {
              mergedUserOrders.push(localOrder);
            }
          }
          mergedUserOrders.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

          if (JSON.stringify(mergedUserOrders) !== JSON.stringify(current.userOrders)) {
            setUserOrders(mergedUserOrders);
          }
        }
        if (db.logs && JSON.stringify(db.logs) !== JSON.stringify(current.logs)) {
          setLogs(db.logs);
        }
        if (db.registeredUsers && JSON.stringify(db.registeredUsers) !== JSON.stringify(current.registeredUsers)) {
          setRegisteredUsers(db.registeredUsers);
        }
        if (db.subscriptions && JSON.stringify(db.subscriptions) !== JSON.stringify(current.subscriptions)) {
          setSubscriptions(db.subscriptions);
        }
        if (db.customerNotifications && JSON.stringify(db.customerNotifications) !== JSON.stringify(current.customerNotifications)) {
          setCustomerNotifications(db.customerNotifications);
        }

        // If server database is uninitialized (fresh boot), send active local data to seed the server db
        const payloadToInitialize: Record<string, any> = {};
        if (!db.products || db.products.length === 0) payloadToInitialize.products = current.products;
        if (!db.settings) payloadToInitialize.settings = current.settings;
        if (!db.orders || db.orders.length === 0) payloadToInitialize.orders = current.orders;
        if (!db.userOrders || db.userOrders.length === 0) payloadToInitialize.userOrders = current.userOrders;
        if (!db.logs || db.logs.length === 0) payloadToInitialize.logs = current.logs;
        if (!db.registeredUsers || db.registeredUsers.length === 0) payloadToInitialize.registeredUsers = current.registeredUsers;
        if (!db.subscriptions || db.subscriptions.length === 0) payloadToInitialize.subscriptions = current.subscriptions;
        if (!db.customerNotifications || db.customerNotifications.length === 0) payloadToInitialize.customerNotifications = current.customerNotifications;

        const keysToInit = Object.keys(payloadToInitialize);
        for (const k of keysToInit) {
          fetch("/api/sync/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: k, data: payloadToInitialize[k] })
          }).catch((err) => handleSyncError(`seeding-${k}`, err));
        }

        setTimeout(() => {
          isUpdatingFromServer.current = false;
          syncInitializedRef.current = true;
          setIsInitialLoading(false);
        }, 120);
      } catch (err: any) {
        // Log transient fetch failures and json parsing errors from HTML responses as warnings to avoid triggering automated logs during server restart
        const isTransient = err && (
          err.message === "Failed to fetch" || 
          err.name === "TypeError" || 
          err.message?.includes("Unexpected token") ||
          err.message?.includes("not valid JSON")
        );
        if (isTransient) {
          console.warn("Polled sync: Server unreachable, restarting, or returned non-JSON. Retrying in next cycle...", err.message);
        } else {
          console.error("Polled sync error:", err);
        }
        isUpdatingFromServer.current = false;
        syncInitializedRef.current = true;
        setIsInitialLoading(false);
      }
    };

    // Hydrate immediately
    runSync();

    const timer = setInterval(runSync, 4000); // syncing loop every 4 seconds handles phone & laptop beautifully
    return () => {
      clearInterval(timer);
      clearTimeout(failSafeTimer);
    };
  }, []);

  // Autofill checkout from logged-in user details to make checkouts instant & elegant
  useEffect(() => {
    if (loggedInUser) {
      setCustomerName(loggedInUser.name || "");
      setCustomerPhone(loggedInUser.phone || "");
      setCustomerAddress(loggedInUser.address || "");
    }
  }, [loggedInUser]);

  // Autofill sender number in checkout when choosing Mobile Banking if saved
  useEffect(() => {
    if (loggedInUser) {
      if (paymentMethod === "bKash" && loggedInUser.savedBkash) {
        setPaymentSender(loggedInUser.savedBkash);
      } else if (paymentMethod === "Nagad" && loggedInUser.savedNagad) {
        setPaymentSender(loggedInUser.savedNagad);
      } else if (paymentMethod === "Upay" && loggedInUser.savedUpay) {
        setPaymentSender(loggedInUser.savedUpay);
      } else {
        setPaymentSender("");
      }
    } else {
      setPaymentSender("");
    }
  }, [paymentMethod, loggedInUser]);

  // Manage body scroll locking to completely fix the scrolling blockage when drawers/panels are open
  useEffect(() => {
    if (isCartOpen || isAccountOpen || selectedProduct || isScannerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isCartOpen, isAccountOpen, selectedProduct, isScannerOpen]);

  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      console.warn("Audio Context beep blocked:", e);
    }
  };

  const handleScannedCode = (value: string) => {
    const matchVal = value.trim();
    
    // Check if it is an Order ID QR (direct ID, e.g. RM-XXXX-2026, or starts with 'riemart-order:')
    let scannedOrderId = "";
    if (matchVal.toLowerCase().startsWith("riemart-order:")) {
      scannedOrderId = matchVal.substring("riemart-order:".length).trim();
    } else if (/^RM-\d{4}-\d{4}$/i.test(matchVal)) {
      scannedOrderId = matchVal;
    } else if (orders.some(o => o.id.toLowerCase() === matchVal.toLowerCase())) {
      scannedOrderId = matchVal;
    }

    if (scannedOrderId) {
      const matchOrder = orders.find(o => o.id.toLowerCase() === scannedOrderId.toLowerCase());
      if (matchOrder) {
        playBeep();
        setScannerSuccessMsg(
          lang === "en"
            ? `SUCCESS! Scanned Invoice Order ID: [${matchOrder.id}]`
            : `সফল হয়েছে! চিহ্নিত মোমো নম্বর: [${matchOrder.id}]`
        );
        setTimeout(() => {
          setIsScannerOpen(false);
          setScannerSuccessMsg(null);
          setIsAdminAuthorized(true);
          setShowAdminPortal(true);
          setPrintingOrder(matchOrder);
          addSystemLog(
            "success",
            `Scanned Invoice QR for Order ID: [${matchOrder.id}] -> loaded Customer Cash Memo details`,
            `ক্যাশ মেমোর কিউআর কোড স্ক্যান করে অর্ডার নম্বর [${matchOrder.id}] সম্পর্কিত ম্যানেজমেন্ট উইন্ডো খোলা হয়েছে।`
          );
        }, 950);
        return;
      }
    }

    let foundProduct = products.find(p => p.id.toLowerCase() === matchVal.toLowerCase());
    
    if (!foundProduct) {
      foundProduct = products.find(p => matchVal.toLowerCase().endsWith(p.id.toLowerCase()));
    }
    
    if (foundProduct) {
      playBeep();
      setScannerSuccessMsg(
        lang === "en" 
          ? `SUCCESS! Product matched: [${foundProduct.nameEn}]` 
          : `সফল হয়েছে! চিহ্নিত প্রোডাক্ট: [${foundProduct.nameBn}]`
      );
      
      const prod = foundProduct;
      setTimeout(() => {
        setSelectedProduct(prod);
        setIsScannerOpen(false);
        setScannerSuccessMsg(null);
        addSystemLog(
          "success",
          `Scanned Packaging QR for ID: [${prod.id}] -> opened Details Modally`,
          `কিউআর কোড স্ক্যান করে [${prod.nameBn}] পণ্যের বিস্তারিত বিবরণ খোলা হয়েছে।`
        );
      }, 950);
    } else {
      setScannerError(
        lang === "en" 
          ? `QR code '${value}' did not match any products or orders in active database.` 
          : `কিউআর কোড '${value}' দিয়ে ডাটাবেজে কোনো পণ্য বা মেমো নম্বর খুঁজে পাওয়া যায়নি।`
      );
      setTimeout(() => setScannerError(null), 3500);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code) {
            handleScannedCode(code.data);
          } else {
            setScannerError(
              lang === "en" 
                ? "No QR code detected in this image. Make sure it is sharp and clear." 
                : "এই ছবিটিতে কোনো পরিষ্কার কিউআর কোড পাওয়া যায়নি।"
            );
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Camera stream effects
  useEffect(() => {
    if (!isScannerOpen) return;
    let stream: MediaStream | null = null;
    let active = true;
    
    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (videoRef.current && active) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "true");
          videoRef.current.play().catch(e => console.warn("Video play error:", e));
        }
      } catch (err: any) {
        console.error("Camera access failed:", err);
        setScannerError(
          lang === "en" 
            ? `Camera access failed (${err.name || err.message || 'Restricted'}). Use simulator or select image below.` 
            : `ক্যামেরা অ্যাক্সেস ব্যর্থ হয়েছে। নিচে থাকা সিমুলেটর বা ফাইল আপলোড সিস্টেম ব্যবহার করুন।`
        );
      }
    }
    
    startCamera();
    
    return () => {
      active = false;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isScannerOpen, lang]);

  // Frame by frame analysis using requestAnimationFrame
  useEffect(() => {
    if (!isScannerOpen || scannerError) return;
    
    let animationFrameId: number;
    
    const scanFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          const now = Date.now();
          if (now - lastQRDecodeTimeRef.current > 250) {
            lastQRDecodeTimeRef.current = now;
            try {
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "dontInvert",
              });
              
              if (code) {
                handleScannedCode(code.data);
                return; // stop requesting frames after success
              }
            } catch (e) {
              // ignore canvas security errors
            }
          }
        }
      }
      animationFrameId = requestAnimationFrame(scanFrame);
    };
    
    animationFrameId = requestAnimationFrame(scanFrame);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isScannerOpen, scannerError, lang]);

  const toggleWishlist = (product: Product) => {
    const isExist = wishlist.some((item) => item.id === product.id);
    if (isExist) {
      setWishlist((prev) => prev.filter((item) => item.id !== product.id));
      addSystemLog(
        "info",
        `Removed [${product.nameEn}] from wishlist`,
        `উইশলিস্ট থেকে সরানো হয়েছে [${product.nameBn ?? product.nameEn}]`
      );
    } else {
      setWishlist((prev) => [...prev, product]);
      addSystemLog(
        "info",
        `Added [${product.nameEn}] to wishlist`,
        `উইশলিস্টে যুক্ত করা হয়েছে [${product.nameBn ?? product.nameEn}]`
      );
    }
  };

  // Helper log function
  const addSystemLog = (type: "info" | "success" | "warning" | "security", msgEn: string, msgBn: string) => {
    const newLog: SystemLog = {
      id: "log-" + Date.now(),
      timestamp: new Date().toISOString(),
      type,
      messageEn: msgEn,
      messageBn: msgBn,
      operator: isAdminAuthorized ? "Atelier Chief Operator" : "Guest Sandbox"
    };
    setLogs((prev) => [newLog, ...prev]);
  };

  // Track system landing triggers (QR code scans, UTM source codes)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const src = params.get("src");
      if (src) {
        // Prevent duplicate logs in the same session tab reload
        const sessionKey = `riemart_qr_scanned_logged_${src}`;
        if (!sessionStorage.getItem(sessionKey)) {
          sessionStorage.setItem(sessionKey, "true");

          let labelEn = `Product landing path loaded from [${src}] source`;
          let labelBn = `[${src}] সোর্স থেকে প্রোডাক্ট ল্যান্ডিং লিংক ওপেন করা হয়েছে`;

          if (src === "qr_sticker") {
            labelEn = "QR Code Scanned: Customer landed via premium Store QR Sticker";
            labelBn = "কিউআর কোড স্ক্যান: কাস্টমার প্রিমিয়াম স্টোর কিউআর স্টিকার দিয়ে প্রবেশ করেছেন";
          } else if (src === "footer_qr") {
            labelEn = "QR Code Scanned: Customer scanned the Store Footer QR Code";
            labelBn = "কিউআর কোড স্ক্যান: কাস্টমার স্টোরের ফুটার কিউআর কোড স্ক্যান করেছেন";
          } else if (src === "footer_share") {
            labelEn = "Customer entered via multi-channel Shared Link";
            labelBn = "কাস্টমার মাল্টি-চ্যানেল শেয়ার্ড লিংকের মাধ্যমে প্রবেশ করেছেন";
          }

          addSystemLog("success", labelEn, labelBn);
        }
      }
    } catch (err) {
      console.error("Failed to parse and log UTM tracking source:", err);
    }
  }, []);

  // Price Drop Subscription handler
  const handlePriceDropSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    setNotifyError(null);
    setNotifySuccess(false);

    if (!selectedProduct) return;

    const trimmed = notifyContactInput.trim();
    if (!trimmed) {
      setNotifyError(DICTIONARY[lang].notifyErrorMsg);
      return;
    }

    // Basic email / tel phone structure confirmation
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    const isPhone = /^[+]?[0-9\s-]{7,22}$/.test(trimmed);

    if (!isEmail && !isPhone) {
      setNotifyError(DICTIONARY[lang].notifyErrorMsg);
      return;
    }

    // Match if duplicates are present
    const alreadySubscribed = subscriptions.some(
      (sub) => sub.productId === selectedProduct.id && sub.contact.toLowerCase() === trimmed.toLowerCase()
    );

    if (alreadySubscribed) {
      setNotifyError(DICTIONARY[lang].notifyAlreadySubscribed);
      return;
    }

    const newSub = {
      id: "sub-" + Date.now(),
      productId: selectedProduct.id,
      productNameEn: selectedProduct.nameEn,
      productNameBn: selectedProduct.nameBn,
      contact: trimmed,
      originalPrice: selectedProduct.price,
      date: new Date().toISOString()
    };

    setSubscriptions((prev) => [newSub, ...prev]);
    setNotifySuccess(true);
    setNotifyContactInput("");

    // Emit live system audit log
    addSystemLog(
      "success",
      `🔔 New price drop subscription from ${trimmed} for [${selectedProduct.nameEn}] (Current: $${selectedProduct.price})`,
      `🔔 নতুন প্রাইস ড্রপ অ্যালার্ট সাবস্ক্রিপশন: ${trimmed} [${selectedProduct.nameBn ?? selectedProduct.nameEn}] পণ্যের জন্য (মূল্য: $${selectedProduct.price})`
    );
  };

  // Format Price cleanly as BDT Taka directly without scaling
  const formatPrice = (amount: number) => {
    return `৳${Math.round(amount || 0).toLocaleString()}`;
  };

  // Filter products by selectedCategory and searchQuery
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (!p || p.isDeleted || p.status === "deleted") return false;
      const pCategory = (p.category || "").trim();
      const pSubCategory = (p.subCategory || "").trim();
      const selCategory = (selectedCategory || "").trim();
      const selSubCategory = (selectedSubCategory || "").trim();

      let matchesCategory = selCategory === "All" || pCategory.toLowerCase() === selCategory.toLowerCase();
      
      if (selCategory.toLowerCase() === "perfume" && selSubCategory) {
        matchesCategory = pCategory.toLowerCase() === "perfume" && pSubCategory.toLowerCase() === selSubCategory.toLowerCase();
      } else if (selCategory.toLowerCase() === "food & beverage" && selSubCategory) {
        matchesCategory = pCategory.toLowerCase() === "food & beverage" && pSubCategory.toLowerCase() === selSubCategory.toLowerCase();
      } else if (selCategory.toLowerCase() === "clothing" && selSubCategory) {
        matchesCategory = pCategory.toLowerCase() === "clothing" && pSubCategory.toLowerCase() === selSubCategory.toLowerCase();
      } else if (selCategory.toLowerCase() === "cosmetics" && selSubCategory) {
        matchesCategory = pCategory.toLowerCase() === "cosmetics" && pSubCategory.toLowerCase() === selSubCategory.toLowerCase();
      } else if (selCategory.toLowerCase() === "baby care" && selSubCategory) {
        matchesCategory = pCategory.toLowerCase() === "baby care" && pSubCategory.toLowerCase() === selSubCategory.toLowerCase();
      }

      const query = (searchQuery || "").toLowerCase();
      const nameEn = (p.nameEn || "").toLowerCase();
      const nameBn = (p.nameBn || "").toLowerCase();
      const descEn = (p.descriptionEn || "").toLowerCase();
      const descBn = (p.descriptionBn || "").toLowerCase();
      const catVal = pCategory.toLowerCase();

      const matchesSearch =
        nameEn.includes(query) ||
        nameBn.includes(query) ||
        descEn.includes(query) ||
        descBn.includes(query) ||
        catVal.includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, selectedSubCategory, searchQuery]);

  // Paginated subset of filtered products (20 items per page)
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  // Bulk Discount calculation matrix (Buy More, Save More)
  const getDeliveryCharge = (location: "inside" | "outside", items: Product[]): number => {
    const globalEnabled = settings.deliveryChargeEnabled !== false;
    if (!globalEnabled) return 0;
    
    const hasFreeDelivery = items.some(p => p.deliveryOption === "free");
    if (hasFreeDelivery) return 0;

    const customItem = items.find(p => p.deliveryOption === "custom");
    if (customItem && typeof customItem.customDeliveryCharge === "number") {
      return customItem.customDeliveryCharge;
    }

    if (location === "inside") {
      return settings.deliveryChargeInsideDhaka !== undefined ? Number(settings.deliveryChargeInsideDhaka) : 80;
    } else {
      return settings.deliveryChargeOutsideDhaka !== undefined ? Number(settings.deliveryChargeOutsideDhaka) : 120;
    }
  };

  const calculateCartTotals = () => {
    let subtotal = 0;
    let totalItemsCount = 0;

    cart.forEach((item) => {
      const masterProduct = products.find((p) => p.id === item.product.id);
      const livePrice = masterProduct ? masterProduct.price : item.product.price;
      subtotal += livePrice * item.quantity;
      totalItemsCount += item.quantity;
    });

    const isBulkActive = settings.bulkPriceEnabled && totalItemsCount >= settings.bulkMinQty;
    if (isBulkActive) {
      subtotal = totalItemsCount * settings.bulkFlatPrice;
    }

    let discountPercentage = 0;
    if (settings.buyMoreSaveMoreEnabled && totalItemsCount >= 1 && !isBulkActive) {
      if (totalItemsCount >= (settings.tier4Qty ?? 5)) {
        discountPercentage = settings.tier4Discount ?? 20;
      } else if (totalItemsCount >= settings.tier3Qty) {
        discountPercentage = settings.tier3Discount;
      } else if (totalItemsCount >= settings.tier2Qty) {
        discountPercentage = settings.tier2Discount;
      }
    }

    const discountAmount = subtotal * (discountPercentage / 100);
    const deliveryChargeUsd = totalItemsCount > 0 
      ? getDeliveryCharge(deliveryLocation, cart.map(item => item.product)) 
      : 0;
    const finalTotal = subtotal - discountAmount + deliveryChargeUsd;
    const requiredAdvance = isBulkActive
      ? Math.round((subtotal - discountAmount) * ((settings.bulkAdvancePercent ?? 30) / 100))
      : 0;

    return {
      subtotal,
      totalItemsCount,
      discountPercentage,
      discountAmount,
      deliveryChargeUsd,
      finalTotal,
      isBulkActive,
      requiredAdvance,
    };
  };

  const { subtotal, totalItemsCount, discountPercentage, discountAmount, deliveryChargeUsd, finalTotal } = calculateCartTotals();

  // Cart operations
  const handleAppendToActiveOrder = (product: Product, qtyToAdd: number = 1) => {
    if (!activeAppendOrderId) return;
    
    if (qtyToAdd > product.inventory) {
      alert(lang === "en" ? "Selected volume exceeds active studio reserve." : "নির্বাচিত পরিমাণ সচল স্টুডিও স্টক অতিক্রম করেছে।");
      return;
    }

    let modifiedOrder: Order | null = null;

    // Find and update inside orders state
    setOrders((prevOrders) => {
      const mapped = prevOrders.map((order) => {
        if (order.id !== activeAppendOrderId) return order;

        const existingItemIdx = order.items.findIndex((item) => item.productId === product.id);
        const updatedItems = [...order.items];

        if (existingItemIdx > -1) {
          updatedItems[existingItemIdx] = {
            ...updatedItems[existingItemIdx],
            quantity: updatedItems[existingItemIdx].quantity + qtyToAdd,
          };
        } else {
          updatedItems.push({
            productId: product.id,
            productNameEn: product.nameEn,
            productNameBn: product.nameBn,
            quantity: qtyToAdd,
            priceAtPurchase: product.price,
          });
        }

        // Recalculate totals
        let subtotal = 0;
        let totalItemsCount = 0;
        updatedItems.forEach((item) => {
          subtotal += item.priceAtPurchase * item.quantity;
          totalItemsCount += item.quantity;
        });

        const isBulkActive = settings.bulkPriceEnabled && totalItemsCount >= settings.bulkMinQty;
        if (isBulkActive) {
          subtotal = totalItemsCount * settings.bulkFlatPrice;
        }

        let discountPercentage = 0;
        if (settings.buyMoreSaveMoreEnabled && totalItemsCount >= 1 && !isBulkActive) {
          if (totalItemsCount >= (settings.tier4Qty ?? 5)) {
            discountPercentage = settings.tier4Discount ?? 20;
          } else if (totalItemsCount >= settings.tier3Qty) {
            discountPercentage = settings.tier3Discount;
          } else if (totalItemsCount >= settings.tier2Qty) {
            discountPercentage = settings.tier2Discount;
          }
        }

        const discountApplied = subtotal * (discountPercentage / 100);
        const totalPrice = subtotal - discountApplied + (order.deliveryCharge || 0);

        modifiedOrder = {
          ...order,
          items: updatedItems,
          totalPrice,
          discountApplied,
        };

        return modifiedOrder;
      });

      // Synchronize orders to localStorage safely
      const ordersToSave = mapped;
      try {
        safeSaveToLocalStorage("riemart_orders", ordersToSave);
      } catch (e) {
        console.error("Failed to save orders to localStorage:", e);
      }
      return mapped;
    });

    // Mirror to userOrders (Customer Account screen)
    setUserOrders((prevUserOrders) => {
      const mapped = prevUserOrders.map((order) => {
        if (order.id !== activeAppendOrderId) return order;

        const existingItemIdx = order.items.findIndex((item) => item.productId === product.id);
        const updatedItems = [...order.items];

        if (existingItemIdx > -1) {
          updatedItems[existingItemIdx] = {
            ...updatedItems[existingItemIdx],
            quantity: updatedItems[existingItemIdx].quantity + qtyToAdd,
          };
        } else {
          updatedItems.push({
            productId: product.id,
            productNameEn: product.nameEn,
            productNameBn: product.nameBn,
            quantity: qtyToAdd,
            priceAtPurchase: product.price,
          });
        }

        let subtotal = 0;
        let totalItemsCount = 0;
        updatedItems.forEach((item) => {
          subtotal += item.priceAtPurchase * item.quantity;
          totalItemsCount += item.quantity;
        });

        const isBulkActive = settings.bulkPriceEnabled && totalItemsCount >= settings.bulkMinQty;
        if (isBulkActive) {
          subtotal = totalItemsCount * settings.bulkFlatPrice;
        }

        let discountPercentage = 0;
        if (settings.buyMoreSaveMoreEnabled && totalItemsCount >= 1 && !isBulkActive) {
          if (totalItemsCount >= (settings.tier4Qty ?? 5)) {
            discountPercentage = settings.tier4Discount ?? 20;
          } else if (totalItemsCount >= settings.tier3Qty) {
            discountPercentage = settings.tier3Discount;
          } else if (totalItemsCount >= settings.tier2Qty) {
            discountPercentage = settings.tier2Discount;
          }
        }

        const discountApplied = subtotal * (discountPercentage / 100);
        const totalPrice = subtotal - discountApplied + (order.deliveryCharge || 0);

        return {
          ...order,
          items: updatedItems,
          totalPrice,
          discountApplied,
        };
      });

      try {
        safeSaveToLocalStorage("riemart_user_orders", mapped);
      } catch (e) {
        console.error("Failed to save user orders to localStorage:", e);
      }
      return mapped;
    });

    // Deduct stock from products state
    setProducts((prevProducts) => {
      const updatedProducts = prevProducts.map((p) => {
        if (p.id === product.id) {
          return { ...p, inventory: Math.max(0, p.inventory - qtyToAdd) };
        }
        return p;
      });
      try {
        safeSaveToLocalStorage("riemart_products", updatedProducts);
      } catch (e) {
        console.error("Failed to save products to localStorage:", e);
      }
      return updatedProducts;
    });

    // Dismiss active modals so invoice can render cleanly
    setSelectedProduct(null);
    setIsCartOpen(false);
    setShowCheckoutForm(false);

    // Play ting bell sound
    playTingSound();

    // Trigger visual notification on invoice modal
    setInvoiceConfirmedNotification(true);
    setTimeout(() => {
      setInvoiceConfirmedNotification(false);
    }, 3000);

    // Reactively open invoice with updated totals
    setTimeout(() => {
      if (modifiedOrder) {
        setPrintingOrder(modifiedOrder);
        setLastPlacedOrder(modifiedOrder);
      }
    }, 50);

    addSystemLog(
      "success",
      `Appended ${qtyToAdd}x [${product.nameEn}] directly into Order: ${activeAppendOrderId}`,
      `${qtyToAdd}টি [${product.nameBn ?? product.nameEn}] অর্ডারে যোগ হয়েছে: ${activeAppendOrderId}`
    );

    // Background Google Sheets auto-sync if configured and enabled
    if (safeGetLocalStorageItem("riemart_sheets_autosync") === "true" && modifiedOrder) {
      exportOrdersToGoogleSheets([modifiedOrder], false);
    }
  };

  const addToCart = (product: Product, qtyToAdd: number = 1) => {
    if (activeAppendOrderId) {
      handleAppendToActiveOrder(product, qtyToAdd);
      return;
    }
    const existing = cart.find((item) => item.product.id === product.id);
    if (existing) {
      const updatedQty = existing.quantity + qtyToAdd;
      if (updatedQty > product.inventory) {
        alert(lang === "en" ? "Selected volume exceeds active studio reserve." : "নির্বাচিত পরিমাণ সচল স্টুডিও স্টক অতিক্রম করেছে।");
        return;
      }
      setCart((prev) =>
        prev.map((item) => (item.product.id === product.id ? { ...item, quantity: updatedQty } : item))
      );
    } else {
      if (qtyToAdd > product.inventory) {
        alert(lang === "en" ? "Selected volume exceeds active studio reserve." : "নির্বাচিত পরিমাণ সচল স্টুডিও স্টক অতিক্রম করেছে।");
        return;
      }
      setCart((prev) => [...prev, { product, quantity: qtyToAdd }]);
    }
    addSystemLog(
      "info",
      `Added [${product.nameEn}] x${qtyToAdd} to checkout draft`,
      `কার্টে যুক্ত করা হয়েছে [${product.nameBn ?? product.nameEn}] x${qtyToAdd}`
    );
  };

  const handleReorder = (order: Order) => {
    let addedCount = 0;
    let outOfStockCount = 0;

    order.items.forEach((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (product) {
        if (product.inventory > 0) {
          const qtyToAdd = Math.min(item.quantity, product.inventory);
          addToCart(product, qtyToAdd);
          addedCount++;
        } else {
          outOfStockCount++;
        }
      } else {
        outOfStockCount++;
      }
    });

    if (addedCount > 0) {
      if (outOfStockCount > 0) {
        alert(lang === "en"
          ? `Added ${addedCount} items back to your bag. ${outOfStockCount} items were out of stock.`
          : `${addedCount} টি পণ্য কার্টে যোগ করা হয়েছে। ${outOfStockCount} টি পণ্য বর্তমানে অবৈধ্য বা স্টক আউট।`);
      } else {
        alert(lang === "en"
          ? "All items from this past order have been added back to your active shopping bag!"
          : "এই অর্ডারের সব পণ্য আপনার কার্টে সফলভাবে আবার যোগ করা হয়েছে!");
      }
      setIsCartOpen(true);
      setCartDrawerTab("cart");
    } else {
      alert(lang === "en"
        ? "Sorry, all items in this order are currently out of stock or unavailable."
        : "দুঃখিত, এই অর্ডারের সব পণ্য বর্তমানে অবৈধ্য বা স্টক আউট।");
    }
  };

  const updateCartQuantity = (productId: string, delta: number) => {
    const item = cart.find((i) => i.product.id === productId);
    if (!item) return;

    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      setCart((prev) => prev.filter((i) => i.product.id !== productId));
      addSystemLog("info", `Removed product from checkout draft`, `কার্ট থেকে পণ্য সরানো হয়েছে`);
    } else {
      // Check stock limits
      if (newQty > item.product.inventory) {
        alert(lang === "en" ? "Target quantity exceeds available studio stock." : "স্টকে পর্যাপ্ত পণ্য নেই।");
        return;
      }
      setCart((prev) =>
        prev.map((i) => (i.product.id === productId ? { ...i, quantity: newQty } : i))
      );
    }
  };

  const clearCart = () => {
    setCart([]);
    addSystemLog("info", "Draft cart cleared by client action", "গ্রাহক সেশনে কার্ট খালি করা হয়েছে");
  };

  const handleAdminLogout = () => {
    setIsAdminAuthorized(false);
    addSystemLog(
      "security",
      "Administrative system portal sealed and session variables destroyed.",
      "প্রশাসনিক পোর্টাল সেশন বন্ধ করা হয়েছে"
    );
  };

  const handleBulkSKUGenerate = () => {
    let generatedCount = 0;
    const updatedProducts = products.map((p) => {
      const currentSku = (p.sku || "").trim();
      if (!currentSku) {
        const catClean = (p.category || "General").toUpperCase().replace(/[^A-Z0-9]/g, "");
        const idClean = String(p.id).toUpperCase().replace(/[^A-Z0-9]/g, "");
        const newSku = `RM-${catClean}-${idClean}`;
        generatedCount++;
        return { ...p, sku: newSku };
      }
      return p;
    });

    if (generatedCount === 0) {
      alert(
        lang === "en"
          ? "No products are missing SKU codes. All products are already fully configured!"
          : "কোনো পণ্যের SKU কোড বাদ নেই। সব পণ্য ইতিমধ্যে সম্পূর্ণরূপে কনফিগার করা হয়েছে!"
      );
      return;
    }

    setProducts(updatedProducts);
    try {
      safeSaveToLocalStorage("riemart_products", updatedProducts);
    } catch (e) {
      console.error("Failed to save updated products with bulk SKUs:", e);
    }

    addSystemLog(
      "success",
      `Bulk SKU Generator: Generated ${generatedCount} standardized SKUs for products.`,
      `বাল্ক SKU জেনারেটর: ${generatedCount}টি পণ্যের জন্য স্ট্যান্ডার্ড SKU কোড তৈরি করা হয়েছে।`
    );

    setAdminSuccessNotification({
      messageEn: `✓ Successfully generated ${generatedCount} standardized SKU codes (RM-CATEGORY-ID format) for products missing them!`,
      messageBn: `✓ SKU কোডবিহীন ${generatedCount}টি পণ্যের জন্য সফলভাবে মানসম্মত SKU কোড (RM-CATEGORY-ID ফরম্যাট) তৈরি করা হয়েছে!`,
    });

    // Scroll smoothly to success notice
    setTimeout(() => {
      const el = document.getElementById("admin-success-banner-alert");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 150);
  };
  const handleSaveProduct = (finalBuffer: Partial<Product>) => {
    if (!finalBuffer.price) {
      alert(lang === "en" ? "Please populate all mandatory fields (Price)." : "দয়া করে সমস্ত বাধ্যতামূলক ক্ষেত্রগুলো পূরণ করুন (मूल्य)।");
      return;
    }

    const freshId = "p-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
    const targetProductId = editingProductId || freshId;

    let codeSku = (finalBuffer.sku || "").trim();
    if (!codeSku) {
      const catClean = (finalBuffer.category || "General").toUpperCase().replace(/[^A-Z0-9]/g, "");
      const idClean = String(targetProductId).toUpperCase().replace(/[^A-Z0-9]/g, "");
      codeSku = `RM-${catClean}-${idClean}`;
    }

    // Auto-resolve duplicate SKU conflicts to allow rapid uploading of identical products & clones
    let finalCodeSku = codeSku;
    let isDuplicate = products.some((p) => p.sku && p.sku.toLowerCase() === finalCodeSku.toLowerCase() && p.id !== editingProductId);
    if (isDuplicate) {
      let suffix = 1;
      while (products.some((p) => p.sku && p.sku.toLowerCase() === `${codeSku}-${suffix}`.toLowerCase() && p.id !== editingProductId)) {
        suffix++;
      }
      finalCodeSku = `${codeSku}-${suffix}`;
    }

    const parsedPrice = Number(finalBuffer.price);
    const finalProductPrice = isNaN(parsedPrice) || parsedPrice <= 0 ? 50 : parsedPrice;
    
    const parsedInventory = Number(finalBuffer.inventory);
    const finalProductInventory = isNaN(parsedInventory) || parsedInventory < 0 ? 10 : parsedInventory;
    
    const oldProduct = editingProductId ? products.find((p) => p.id === editingProductId) : null;
    const isQuantityUpdated = !oldProduct || oldProduct.inventory !== finalProductInventory;

    // Filter out blank slots from our 6-image slot array
    const cleanImages = (finalBuffer.images || [])
      .map(img => img.trim())
      .filter(img => img !== "");

    const finalNameEn = (finalBuffer.nameEn || "").trim() || `Product-${finalCodeSku}`;
    const finalNameBn = (finalBuffer.nameBn || "").trim() || finalNameEn;

    if (editingProductId) {
      // Update
      setProducts((prev) => {
        const nextList = prev.map((p) =>
          p.id === editingProductId
            ? {
                ...p,
                sku: finalCodeSku,
                nameEn: finalNameEn,
                nameBn: finalNameBn,
                category: (finalBuffer.category as Category) || p.category,
                subCategory: finalBuffer.subCategory,
                price: finalProductPrice,
                regularPrice: finalBuffer.regularPrice ? Number(finalBuffer.regularPrice) : undefined,
                image: finalBuffer.image || p.image || "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&q=80&w=600",
                images: cleanImages.length > 0 ? cleanImages : [finalBuffer.image || p.image || "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&q=80&w=600"],
                descriptionEn: finalBuffer.descriptionEn || p.descriptionEn,
                descriptionBn: finalBuffer.descriptionBn || p.descriptionBn,
                inventory: finalProductInventory,
                offers: finalBuffer.regularPrice && (Number(finalBuffer.regularPrice) > finalProductPrice) ? true : !!finalBuffer.offers,
                specificationsEn: finalBuffer.specificationsEn || p.specificationsEn,
                specificationsBn: finalBuffer.specificationsBn || p.specificationsBn,
                deliveryOption: finalBuffer.deliveryOption,
                customDeliveryCharge: finalBuffer.customDeliveryCharge
              }
            : p
        );

        // Instant detail view sync
        if (selectedProduct && selectedProduct.id === editingProductId) {
          const matched = nextList.find(p => p.id === editingProductId);
          if (matched) {
            setSelectedProduct(matched);
          }
        }

        return nextList;
      });

      // Synchronize cart item snapshots
      setCart((prevCart) =>
        prevCart.map((item) =>
          item.product.id === editingProductId
            ? {
                ...item,
                product: {
                  ...item.product,
                  sku: finalCodeSku,
                  nameEn: finalNameEn,
                  nameBn: finalNameBn,
                  price: finalProductPrice,
                  regularPrice: finalBuffer.regularPrice ? Number(finalBuffer.regularPrice) : undefined,
                  image: finalBuffer.image || item.product.image || "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&q=80&w=600",
                  offers: finalBuffer.regularPrice && (Number(finalBuffer.regularPrice) > finalProductPrice) ? true : !!finalBuffer.offers,
                }
              }
            : item
        )
      );

      // If the edited product is in the wishlist, trigger a real-time notification
      const isInWishlist = wishlist.some((item) => item.id === editingProductId);
      if (isInWishlist) {
        const prodNameEn = finalNameEn;
        const prodNameBn = finalNameBn;
        const newNotif = {
          id: "notif-wishlist-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
          titleEn: "Wishlist Alert: Item Updated!",
          titleBn: "উইশলিস্ট অ্যালার্ট: পণ্য আপডেট করা হয়েছে!",
          messageEn: `The specifications of your saved product [${prodNameEn}] has been modified. Check it out now!`,
          messageBn: `আপনার উইশলিস্টে থাকা পণ্য [${prodNameBn}]-এর বিবরণ বা প্রাইজ কার্ট এডিট করা হয়েছে। এখনই দেখে নিন!`,
          date: new Date().toISOString(),
          isRead: false,
          type: "wishlist_update" as const
        };
        setCustomerNotifications((prev) => [newNotif, ...prev]);

        // Auto-synchronize internal prices with newest state to prevent outdated data
        setWishlist((prevWishlist) =>
          prevWishlist.map((item) =>
            item.id === editingProductId
              ? {
                  ...item,
                  sku: finalCodeSku,
                  nameEn: finalNameEn,
                  nameBn: finalNameBn,
                  price: finalProductPrice,
                  regularPrice: finalBuffer.regularPrice ? Number(finalBuffer.regularPrice) : undefined,
                  image: finalBuffer.image || item.image,
                  offers: finalBuffer.regularPrice && (Number(finalBuffer.regularPrice) > finalProductPrice) ? true : !!finalBuffer.offers
                }
              : item
          )
        );
      }

      addSystemLog(
        "success",
        `Catalog item upgraded: [${finalNameEn}]`,
        `ক্যাটালগ পণ্য আপডেট করা হয়েছে: [${finalNameBn}]`
      );
      setAdminSuccessNotification({
        messageEn: `✓ Product specs for "${finalNameEn}" successfully updated in catalog! You can edit it again anytime.`,
        messageBn: `✓ "${finalNameBn}" পণ্যটির বিবরণ সফলভাবে স্টোরে আপডেট করা হয়েছে! আপনি যেকোনো সময় এটি পুনরায় পরিবর্তন করতে পারেন।`
      });
    } else {
      // Create new
      const defaultImg = finalBuffer.image || "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&q=80&w=600";
      const finalImgList = cleanImages.length > 0 ? cleanImages : [defaultImg];
      
      const newProduct: Product = {
        id: targetProductId,
        sku: finalCodeSku,
        nameEn: finalNameEn,
        nameBn: finalNameBn,
        category: (finalBuffer.category as Category) || "Clothing",
        subCategory: finalBuffer.subCategory,
        price: finalProductPrice,
        regularPrice: finalBuffer.regularPrice ? Number(finalBuffer.regularPrice) : undefined,
        image: defaultImg,
        images: finalImgList,
        descriptionEn: finalBuffer.descriptionEn || "Premium newly debuted studio artifact.",
        descriptionBn: finalBuffer.descriptionBn || "স্টুডিওতে সদ্য অভিষিক্ত প্রিমিয়াম পণ্যসম্ভার।",
        inventory: finalProductInventory,
        offers: finalBuffer.regularPrice && (Number(finalBuffer.regularPrice) > finalProductPrice) ? true : !!finalBuffer.offers,
        specificationsEn: finalBuffer.specificationsEn || ["Guaranteed studio craftsmanship"],
        specificationsBn: finalBuffer.specificationsBn || ["নিখুঁত স্টুডিও কারুশিল্পের নিশ্চয়তা"],
        deliveryOption: finalBuffer.deliveryOption || "default",
        customDeliveryCharge: finalBuffer.customDeliveryCharge
      };
      setProducts((prev) => [newProduct, ...prev]);
      addSystemLog(
        "success",
        `New studio artifact deployed to market catalog: [${newProduct.nameEn}]`,
        `ক্যাটালগে নতুন স্টুডিও পণ্য যুক্ত করা হয়েছে: [${newProduct.nameBn || newProduct.nameEn}]`
      );
      setAdminSuccessNotification({
        messageEn: `✓ New product "${newProduct.nameEn}" has been published successfully! To modify it later, find it in the Product List below and click the Edit (✏️) icon, or click Edit directly on the storefront product card.`,
        messageBn: `✓ নতুন পণ্য "${newProduct.nameBn || newProduct.nameEn}" সফলভাবে পাবলিশ হয়েছে! পরবর্তীতে এটি পরিবর্তন করতে চাইলে নিচের প্রোডাক্ট তালিকার এডিট (✏️) আইকনে ক্লিক করুন, অথবা সরাসরি স্টোরফ্রন্টের প্রোডাক্ট কার্ড থেকে এডিট করুন।`
      });
    }

    if (isQuantityUpdated) {
      setPulsingInventoryProductId(targetProductId);
      setTimeout(() => {
        setPulsingInventoryProductId((current) => current === targetProductId ? null : current);
      }, 5000);
    }

    // Scroll smoothly to success notice or top of panel
    setTimeout(() => {
      const el = document.getElementById("admin-success-banner-alert");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 150);

    // Reset buffer and controls
    setEditingProductId(null);
    setIsCreatingProduct(false);
    setProductBuffer({
      sku: "",
      nameEn: "",
      nameBn: "",
      category: "Perfume",
      subCategory: undefined,
      price: 50,
      regularPrice: undefined,
      image: "",
      images: ["", "", "", "", "", ""],
      descriptionEn: "",
      descriptionBn: "",
      inventory: 20,
      offers: false,
      specificationsEn: [""],
      specificationsBn: [""]
    });
  };

  const startEditProduct = (p: Product) => {
    setEditingProductId(p.id);
    setIsCreatingProduct(false);

    // Prepare 6-slot images array for editing
    const preparedImages = Array(6).fill("");
    if (p.images && p.images.length > 0) {
      p.images.forEach((img, idx) => {
        if (idx < 6) preparedImages[idx] = img;
      });
    } else if (p.image) {
      preparedImages[0] = p.image;
    }

    setProductBuffer({
      sku: p.sku || "",
      nameEn: p.nameEn,
      nameBn: p.nameBn,
      category: p.category,
      subCategory: p.subCategory,
      price: p.price,
      regularPrice: p.regularPrice,
      image: p.image,
      images: preparedImages,
      descriptionEn: p.descriptionEn,
      descriptionBn: p.descriptionBn,
      inventory: p.inventory,
      offers: p.offers,
      specificationsEn: p.specificationsEn || [""],
      specificationsBn: p.specificationsBn || [""]
    });
  };

  const handleDirectEdit = (p: Product) => {
    setSelectedProduct(null);
    setShowAdminPortal(true);
    startEditProduct(p);
    setTimeout(() => {
      const el = document.getElementById("catalog-matrix-editor-form");
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }, 150);
  };



  const handleDeleteProduct = (id: string, nameEn: string, nameBn: string) => {
    // Super-speed ultra-fast instant product retirement: update status to soft-deleted
    setProducts((prev) => prev.map((p) => p.id === id ? { ...p, isDeleted: true, status: "deleted" as const } : p));
    if (selectedProduct && selectedProduct.id === id) {
      setSelectedProduct(null);
    }
    addSystemLog(
      "warning",
      `Retired studio item permanently from catalog with ultra-fast action: [${nameEn}]`,
      `স্থায়ীভাবে ক্যাটালগ থেকে অতি দ্রুত অপসারণ করা হয়েছে: [${nameBn || nameEn}]`
    );
    setAdminSuccessNotification({
      messageEn: `✓ Product "${nameEn}" has been retired from the catalog with super-speed instant feedback!`,
      messageBn: `✓ "${nameBn || nameEn}" পণ্যটি সুপার স্পিড আল্ট্রা ফাস্ট প্রতিক্রিয়া সহ ক্যাটালগ থেকে সফলভাবে মুছে ফেলা হয়েছে!`
    });
    // Auto scroll smoothly to the success banner to see the immediate result
    setTimeout(() => {
      const el = document.getElementById("admin-success-banner-alert");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 50);
  };

  const handleDeleteCustomer = (phoneToDelete: string, customerName: string) => {
    showSafeConfirm(
      lang === "en" ? "Delete Customer Account" : "গ্রাহক অ্যাকাউন্ট ডিলিট",
      lang === "en" 
        ? `Are you sure you want to permanently delete customer account: ${customerName}?` 
        : `আপনি কি নিশ্চিত যে আপনি গ্রাহক '${customerName}' এর অ্যাকাউন্ট স্থায়ীভাবে ডিলিট করতে চান?`,
      () => {
        setRegisteredUsers((prev) => prev.filter((u) => u.phone.trim() !== phoneToDelete.trim()));
        if (loggedInUser && loggedInUser.phone.trim() === phoneToDelete.trim()) {
          setLoggedInUser(null);
          localStorage.removeItem("riemart_user_account");
        }
        addSystemLog(
          "warning",
          `Permanently deleted customer database record: [${customerName} | ${phoneToDelete}]`,
          `গ্রাহকের মেম্বারশিপ অ্যাকাউন্ট ডাটাबेস থেকে ডিলিট করা হয়েছে: [${customerName} | ${phoneToDelete}]`
        );
      }
    );
  };

  const handleAddToCustomerWishlist = (phone: string, productId: string) => {
    setRegisteredUsers((prev) => 
      prev.map((u) => {
        if (u.phone === phone) {
          const wish = u.wishlistProductIds || [];
          if (!wish.includes(productId)) {
            return { ...u, wishlistProductIds: [...wish, productId] };
          }
        }
        return u;
      })
    );
    
    // Also update loggedInUser and local wishlist if active
    if (loggedInUser && loggedInUser.phone === phone) {
      setWishlist((prev) => {
        const prod = products.find(p => p.id === productId);
        if (prod && !prev.some(item => item.id === productId)) {
          return [...prev, prod];
        }
        return prev;
      });
    }
    
    addSystemLog(
      "success",
      `Added product ${productId} to user ${phone}'s wishlist`,
      `ব্যবহারকারী ${phone}-এর উইশলিস্টে প্রোডাক্ট ${productId} যুক্ত করা হয়েছে`
    );
  };

  const handleRemoveFromCustomerWishlist = (phone: string, productId: string) => {
    setRegisteredUsers((prev) => 
      prev.map((u) => {
        if (u.phone === phone) {
          const wish = u.wishlistProductIds || [];
          return { ...u, wishlistProductIds: wish.filter(id => id !== productId) };
        }
        return u;
      })
    );
    
    // Also update loggedInUser and local wishlist if active
    if (loggedInUser && loggedInUser.phone === phone) {
      setWishlist((prev) => prev.filter(item => item.id !== productId));
    }
    
    addSystemLog(
      "info",
      `Removed product ${productId} from user ${phone}'s wishlist`,
      `ব্যবহারকারী ${phone}-এর উইশলিস্ট থেকে প্রোডাক্ট ${productId} মুছে ফেলা হয়েছে`
    );
  };

  const handleUpdateUserCategory = (phone: string, newCategory: string) => {
    setRegisteredUsers((prev) => 
      prev.map((u) => u.phone === phone ? { ...u, category: newCategory } : u)
    );
    
    // Also update loggedInUser if active
    if (loggedInUser && loggedInUser.phone === phone) {
      setLoggedInUser((prev) => prev ? { ...prev, category: newCategory } : null);
    }
    
    addSystemLog(
      "success",
      `Updated customer category for ${phone} to ${newCategory}`,
      `কাস্টমার ক্যাটাগরি আপডেট করা হয়েছে: ${phone} -> ${newCategory}`
    );
  };

  const handleAiGenerateHeroImage = async (customPrompt?: string) => {
    const activePrompt = customPrompt || aiImagePrompt || `A professional high-end luxury studio showcase photo of ${productBuffer.nameEn || "a premium product"}, category is ${productBuffer.category || "General"}, photorealistic, cinematic lighting, ultra-detailed product retail presentation, 1k resolution`;
    
    setIsGeneratingAiImage(true);
    setAiImageError(null);

    try {
      const response = await fetch("/api/gemini/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: activePrompt }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to generate AI image. Make sure your GEMINI_API_KEY is active and valid.");
      }

      const data = await response.json();
      if (!data.imageUrl) {
        throw new Error("No image was returned from server API proxy.");
      }

      // Synchronize back to the cover and Slot 1 image buffer
      const updatedImages = [...(productBuffer.images || Array(6).fill(""))];
      // Place in slot 1 (index 0)
      updatedImages[0] = data.imageUrl;

      setProductBuffer((prev) => ({
        ...prev,
        images: updatedImages,
        image: data.imageUrl,
      }));

      addSystemLog(
        "success",
        `AI successfully generated high-end showcase photo for [${productBuffer.nameEn || "item"}].`,
        `এআই সফলভাবে [${productBuffer.nameBn || "পণ্য"}] এর জন্য চমৎকার কভার ছবি তৈরি করেছে।`
      );
    } catch (err: any) {
      console.error(err);
      setAiImageError(err.message || "An unexpected error occurred during image generation.");
    } finally {
      setIsGeneratingAiImage(false);
    }
  };

  // Push updated studio parameters
  const handleSaveSettings = (updated: StoreSettings) => {
    setSettings(updated);
    addSystemLog(
      "success",
      "Global promotional metrics and dynamic banner settings distributed live.",
      "গ্লোবাল প্রমোশনাল এবং ব্যানার কনফিগারেশন আপডেট করা হয়েছে"
    );
  };

  // Place Atelier Order Flow
  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerPhone || !customerAddress) {
      alert(lang === "en" ? "Please fill in all buyer delivery coordinates." : "অনুগ্রহ করে ক্রেতার ডেলিভারির সমস্ত বিবরণ প্রদান করুন।");
      return;
    }

    if (paymentMethod !== "COD" && (!paymentSender || !paymentTrxId)) {
      alert(lang === "en" 
        ? "Please fulfill your mobile banking payment and provide both your Sender Number and Transaction ID!" 
        : "অনুগ্রহ করে মোবাইল ব্যাংকিং পেমেন্ট শেষ করে আপনার প্রেরক নম্বর এবং ট্রানজেকশন আইডি প্রদান করুন!");
      return;
    }

    const finalCalculatedTotals = calculateCartTotals();
    const orderRef = "RM-" + Math.floor(1000 + Math.random() * 9000) + "-" + new Date().getFullYear();

    const newOrder: Order = {
      id: orderRef,
      customerName,
      customerPhone,
      customerAddress,
      orderNotes: orderNotes ? orderNotes.trim() : undefined,
      items: cart.map((item) => ({
        productId: item.product.id,
        productNameEn: item.product.nameEn,
        productNameBn: item.product.nameBn,
        quantity: item.quantity,
        priceAtPurchase: item.product.price
      })),
      totalPrice: finalCalculatedTotals.finalTotal,
      discountApplied: finalCalculatedTotals.discountAmount,
      deliveryCharge: finalCalculatedTotals.deliveryChargeUsd,
      status: "Pending",
      date: new Date().toISOString(),
      paymentMethod,
      paymentSender: paymentMethod !== "COD" ? paymentSender : undefined,
      paymentTrxId: paymentMethod !== "COD" ? paymentTrxId : undefined,
      statusHistory: [
        { status: "Pending", timestamp: new Date().toISOString() }
      ]
    };

    // Deduct stock reserves dynamically
    const updatedProductsList = products.map((prod) => {
      const purchasedItem = cart.find((c) => c.product.id === prod.id);
      if (purchasedItem) {
        const remaining = Math.max(0, prod.inventory - purchasedItem.quantity);
        return { ...prod, inventory: remaining };
      }
      return prod;
    });

    setProducts(updatedProductsList);
    setOrders((prev) => [newOrder, ...prev]);
    setUserOrders((prev) => [newOrder, ...prev]);
    try {
      const savedIds = localStorage.getItem("riemart_local_placed_order_ids");
      const localIds = savedIds ? JSON.parse(savedIds) : [];
      if (Array.isArray(localIds)) {
        localIds.push(newOrder.id);
        localStorage.setItem("riemart_local_placed_order_ids", JSON.stringify(localIds));
      } else {
        localStorage.setItem("riemart_local_placed_order_ids", JSON.stringify([newOrder.id]));
      }
    } catch (e) {
      console.error("Failed to append local order id:", e);
    }

    // Add real-time order confirmation notification directly to customer profile inbox
    const orderPlacedNotif = {
      id: "notif-placed-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      titleEn: `Order Placed Successfully: ${orderRef}`,
      titleBn: `অর্ডার সফলভাবে প্লেস করা হয়েছে: ${orderRef}`,
      messageEn: `Your order for ${cart.length} item(s) totaling ${formatPrice(finalCalculatedTotals.finalTotal)} has been received and is pending confirmation.`,
      messageBn: `আপনার ${cart.length}টি পণ্যের ${formatPrice(finalCalculatedTotals.finalTotal)} মূল্যের অর্ডারটি গ্রহণ করা হয়েছে এবং বর্তমানে তা অ্যাপ্রুভালের অপেক্ষায় রয়েছে।`,
      date: new Date().toISOString(),
      isRead: false,
      type: "order_confirmed" as const,
      customerPhone: customerPhone
    };
    setCustomerNotifications((prev) => [orderPlacedNotif, ...prev]);

    // Background Google Sheets auto-sync if configured and enabled
    if (safeGetLocalStorageItem("riemart_sheets_autosync") === "true") {
      exportOrdersToGoogleSheets([newOrder], false);
    }

    setLastPlacedOrder(newOrder);
    setPrintingOrder(newOrder);
    setCart([]);
    setShowCheckoutForm(false);
    setIsCartOpen(false);

    // Play "ting" chimes sound
    playTingSound();

    // Show visual confirmation overlay on invoice for 3 seconds
    setInvoiceConfirmedNotification(true);
    setTimeout(() => {
      setInvoiceConfirmedNotification(false);
    }, 3000);

    const confirmationMsg = DICTIONARY[lang].checkoutSuccess.replace("{id}", orderRef);
    setCheckoutNotification(confirmationMsg);

    addSystemLog(
      "success",
      `New direct atelier order dispatched: ${orderRef}. Total payment: ${formatPrice(finalCalculatedTotals.finalTotal)}`,
      `নতুন স্টুডিও অর্ডার সফলভাবে অর্জিত হয়েছে: ${orderRef}। মোট পেমেন্ট: ${formatPrice(finalCalculatedTotals.finalTotal)}`
    );

    // Auto-timeout success confirmation
    setTimeout(() => {
      setCheckoutNotification(null);
    }, 10000);

    // Clear buyer coordinates after order placement
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setOrderNotes("");
    setPaymentMethod("COD");
    setPaymentSender("");
    setPaymentTrxId("");
  };

  // Direct buy-now specific ordering pipeline
  const handlePlaceDirectOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!directCheckoutProduct) return;

    if (!customerName || !customerPhone || !customerAddress) {
      alert(lang === "en" ? "Please fill in all buyer delivery coordinates." : "অনুগ্রহ করে ক্রেতার ডেলিভারির সমস্ত বিবরণ প্রদান করুন।");
      return;
    }

    if (paymentMethod !== "COD" && (!paymentSender || !paymentTrxId)) {
      alert(lang === "en" 
        ? "Please fulfill your mobile banking payment and provide both your Sender Number and Transaction ID!" 
        : "অনুগ্রহ করে মোবাইল ব্যাংকিং পেমেন্ট শেষ করে আপনার প্রেরক নম্বর এবং ট্রানজেকশন আইডি প্রদান করুন!");
      return;
    }

    const itemPrice = directCheckoutProduct.price;
    const subtotal = itemPrice * directQty;

    // Apply special discounts if enabled
    let discountApplied = 0;
    if (settings.buyMoreSaveMoreEnabled) {
      let discPercent = 0;
      if (directQty >= settings.tier3Qty) {
        discPercent = settings.tier3Discount;
      } else if (directQty >= settings.tier2Qty) {
        discPercent = settings.tier2Discount;
      }
      discountApplied = Math.round((subtotal * discPercent) / 100);
    }

    const deliveryCharge = getDeliveryCharge(deliveryLocation, [directCheckoutProduct]);
    const finalTotal = subtotal - discountApplied + deliveryCharge;

    const orderRef = "RM-" + Math.floor(1000 + Math.random() * 9000) + "-" + new Date().getFullYear();

    const newOrder: Order = {
      id: orderRef,
      customerName,
      customerPhone,
      customerAddress,
      orderNotes: directNotes ? `${directNotes.trim()} | Option: ${directOption}` : `Option: ${directOption}`,
      items: [{
        productId: directCheckoutProduct.id,
        productNameEn: directCheckoutProduct.nameEn,
        productNameBn: directCheckoutProduct.nameBn,
        quantity: directQty,
        priceAtPurchase: itemPrice
      }],
      totalPrice: finalTotal,
      discountApplied: discountApplied,
      deliveryCharge: deliveryCharge,
      status: "Pending",
      date: new Date().toISOString(),
      paymentMethod,
      paymentSender: paymentMethod !== "COD" ? paymentSender : undefined,
      paymentTrxId: paymentMethod !== "COD" ? paymentTrxId : undefined,
      statusHistory: [
        { status: "Pending", timestamp: new Date().toISOString() }
      ]
    };

    // Deduct stock reserves dynamically
    const updatedProductsList = products.map((prod) => {
      if (prod.id === directCheckoutProduct.id) {
        const remaining = Math.max(0, prod.inventory - directQty);
        return { ...prod, inventory: remaining };
      }
      return prod;
    });

    setProducts(updatedProductsList);
    setOrders((prev) => [newOrder, ...prev]);
    setUserOrders((prev) => [newOrder, ...prev]);
    try {
      const savedIds = localStorage.getItem("riemart_local_placed_order_ids");
      const localIds = savedIds ? JSON.parse(savedIds) : [];
      if (Array.isArray(localIds)) {
        localIds.push(newOrder.id);
        localStorage.setItem("riemart_local_placed_order_ids", JSON.stringify(localIds));
      } else {
        localStorage.setItem("riemart_local_placed_order_ids", JSON.stringify([newOrder.id]));
      }
    } catch (e) {
      console.error("Failed to append local order id:", e);
    }

    // Send order notifications
    const orderPlacedNotif = {
      id: "notif-placed-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      titleEn: `Order Placed Successfully: ${orderRef}`,
      titleBn: `অর্ডার সফলভাবে প্লেস করা হয়েছে: ${orderRef}`,
      messageEn: `Your order for 1 item(s) totaling ${formatPrice(finalTotal)} has been received and is pending confirmation.`,
      messageBn: `আপনার অফার মূল্যের অর্ডারটি গ্রহণ করা হয়েছে এবং বর্তমানে তা অ্যাপ্রুভালের অপেক্ষায় রয়েছে।`,
      date: new Date().toISOString(),
      isRead: false,
      type: "order_confirmed" as const,
      customerPhone: customerPhone
    };
    setCustomerNotifications((prev) => [orderPlacedNotif, ...prev]);

    if (safeGetLocalStorageItem("riemart_sheets_autosync") === "true") {
      exportOrdersToGoogleSheets([newOrder], false);
    }

    setLastPlacedOrder(newOrder);
    setDirectOrderRef(orderRef);
    setDirectStep("success"); // Transition to success view in modal
    playTingSound();

    addSystemLog(
      "success",
      `New direct buy-now order dispatched: ${orderRef}. Total payment: ${formatPrice(finalTotal)}`,
      `নতুন সরাসরি অর্ডার সফলভাবে অর্জিত হয়েছে: ${orderRef}। মোট পেমেন্ট: ${formatPrice(finalTotal)}`
    );

    // Keep fields filled for customer reference but clean codes
    setPaymentSender("");
    setPaymentTrxId("");
    setDirectNotes("");
  };

  const updateOrderStatus = (orderId: string, status: "Pending" | "Processing" | "Shipped" | "Completed" | "Cancelled") => {
    const timestamp = new Date().toISOString();
    const mapWithHistory = (order: Order): Order => {
      if (order.id !== orderId) return order;
      const currentHistory = order.statusHistory || [
        { status: "Pending" as const, timestamp: order.date }
      ];
      const exists = currentHistory.some((item) => item.status === status);
      const updatedHistory = exists
        ? currentHistory.map((item) => (item.status === status ? { ...item, timestamp } : item))
        : [...currentHistory, { status, timestamp }];
      return {
        ...order,
        status,
        statusHistory: updatedHistory,
      };
    };

    setOrders((prev) => prev.map(mapWithHistory));
    setUserOrders((prev) => prev.map(mapWithHistory));

    const targetOrder = orders.find((o) => o.id === orderId);
    const targetPhone = targetOrder ? targetOrder.customerPhone : undefined;

    let titleEn = "";
    let titleBn = "";
    let messageEn = "";
    let messageBn = "";
    let type: "offer" | "order_confirmed" | "order_rejected" | "wishlist_update" = "order_confirmed";

    if (status === "Processing") {
      titleEn = `Order Confirmed: ${orderId}`;
      titleBn = `অর্ডার কনফার্মড: ${orderId}`;
      messageEn = "We have confirmed your order and started preparing the packaging materials.";
      messageBn = "আমরা আপনার অর্ডারটি নিশ্চিত করেছি এবং পণ্যটি প্রস্তুত করা শুরু করেছি।";
      type = "order_confirmed";
    } else if (status === "Shipped") {
      titleEn = `Order Shipped: ${orderId}`;
      titleBn = `অর্ডার শিপড্: ${orderId}`;
      messageEn = "Great news! Your package has been dispatched to our premium delivery merchant.";
      messageBn = "দারুণ খবর! আপনার কার্গোটি সফলভাবে কুরিয়ার সার্ভিসে হস্তান্তর করা হয়েছে।";
      type = "order_confirmed";
    } else if (status === "Completed") {
      titleEn = `Order Completed: ${orderId}`;
      titleBn = `অর্ডার সম্পন্ন: ${orderId}`;
      messageEn = "Thank you for choosing Riemart. Your package was successfully delivered.";
      messageBn = "রিমার্ট বেছে নেওয়ার জন্য আন্তরিক ধন্যবাদ। আপনার অর্ডারটি সফলভাবে ডেলিভারি হয়েছে।";
      type = "order_confirmed";
    } else if (status === "Cancelled") {
      titleEn = `Order Rejected / Cancelled: ${orderId}`;
      titleBn = `অর্ডার বাতিল / রিজেক্টেড: ${orderId}`;
      messageEn = "We regret to inform you that your order has been rejected due to stock or address complications.";
      messageBn = "অত্যন্ত দুঃখিত, স্টক সংকট অথবা ঠিকানার অস্পস্টতার কারণে আপনার অর্ডারটি বাতিল করা হয়েছে।";
      type = "order_rejected";
    }

    if (titleEn) {
      const newNotif = {
        id: "notif-status-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
        titleEn,
        titleBn,
        messageEn,
        messageBn,
        date: new Date().toISOString(),
        isRead: false,
        type,
        customerPhone: targetPhone
      };
      setCustomerNotifications((prev) => [newNotif, ...prev]);
    }

    addSystemLog(
      "info",
      `Modified carriage status of order ${orderId} to: [${status}]`,
      `অর্ডার ${orderId} এর ডেলিভারি স্ট্যাটাস পরিবর্তন করে [${status}] করা হয়েছে`
    );
  };

  // Server-side lazy-initialized Gemini SDK proxy connection for perfect high-end descriptions
  const generateDescriptionWithGemini = async () => {
    if (!geminiPromptInput.trim()) {
      setGeminiError(lang === "en" ? "Describe some criteria first." : "প্রথমে পণ্যের কিছু মূল শব্দ উল্লেখ করুন।");
      return;
    }

    setGeminiGenerating(true);
    setGeminiError(null);

    try {
      const response = await fetch("/api/gemini/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Create a professional, high-end, minimalist retail copywriting description for an ultra-luxury studio piece with these criteria: "${geminiPromptInput}". Generate it in exactly English and Bengali. Separate them visually with text "---BN---" in between so I can split them. Make sure the tone is elegant, elite, aesthetic, and speaks highly of craftsmanship. Don't add bullet points or robotic titles. Perfect prose only.`,
          systemInstruction: "You are RIEMART's elite Parisian-style atelier copywriter. You produce brief, exquisite descriptions of craftsmanship in English and refined Bengali. Avoid generic hype, keep it highly atmospheric and descriptive.",
        }),
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      const returnedText = data.text || "";
      if (returnedText.includes("---BN---")) {
        const parts = returnedText.split("---BN---");
        const enDraft = parts[0].trim();
        const bnDraft = parts[1].trim();
        setProductBuffer((prev) => ({
          ...prev,
          descriptionEn: enDraft,
          descriptionBn: bnDraft
        }));
      } else {
        setProductBuffer((prev) => ({
          ...prev,
          descriptionEn: returnedText,
          descriptionBn: "স্টুডিও কারিগরের দ্বারা অনন্য এবং সুন্দরভাবে সমাপ্ত একটি শৈল্পিক পণ্যসম্ভার।"
        }));
      }

      addSystemLog(
        "success",
        "Creative description generated server-side using Gemini AI model",
        "জেমিনি এআই মডেল ব্যবহার করে পণ্য বিবরণ সফলভাবে তৈরি করা হয়েছে"
      );
    } catch (err: any) {
      console.error(err);
      setGeminiError(err.message || "Failed to reach cloud model. Please check GEMINI_API_KEY.");
    } finally {
      setGeminiGenerating(false);
    }
  };

  // Cumulative store performance dashboard stats
  const totalSalesAllTime = useMemo(() => {
    return orders.reduce((sum, order) => {
      if (order.status === "Completed" || order.status === "Shipped" || order.status === "Processing") {
        return sum + order.totalPrice;
      }
      return sum;
    }, 0);
  }, [orders]);

  // Count of pending orders
  const pendingOrdersCount = useMemo(() => {
    return orders.filter((o) => o.status === "Pending").length;
  }, [orders]);

  // Dynamically calculate QR statistics from logs
  const qrStats = useMemo(() => {
    let generatedCount = 0;
    let scannedCount = 0;

    (logs || []).forEach((log) => {
      const msgEnLower = (log.messageEn || "").toLowerCase();
      
      // QR Code Scanned / landing patterns
      if (
        msgEnLower.includes("scanned") || 
        msgEnLower.includes("entered via") || 
        msgEnLower.includes("landing path loaded") || 
        msgEnLower.includes("customer landed") || 
        msgEnLower.includes("entered via")
      ) {
        scannedCount++;
      }
      // QR Code Generated / printed / customized / shared / downloaded patterns
      else if (
        msgEnLower.includes("generated") || 
        msgEnLower.includes("copied qr") || 
        msgEnLower.includes("footer qr code downloaded") || 
        msgEnLower.includes("direct store link copied") ||
        msgEnLower.includes("shared via whatsapp") ||
        msgEnLower.includes("shared via facebook") ||
        msgEnLower.includes("instagram bio redirect") ||
        msgEnLower.includes("sticker exported") ||
        msgEnLower.includes("sticker sent to print")
      ) {
        generatedCount++;
      }
    });

    return {
      generated: generatedCount,
      scanned: scannedCount,
      totalInteraction: generatedCount + scannedCount
    };
  }, [logs]);

  // Analytical Chart: Monthly Sales Trend (last 6 months)
  const monthlySalesData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
    const baselineSales = [12500, 18500, 14200, 22000, 31000, 42000];
    
    const realSalesByMonth: Record<string, number> = {};
    orders.forEach(order => {
      if (order.status !== "Cancelled") {
        const date = new Date(order.date);
        const monthName = date.toLocaleString('en-US', { month: 'short' });
        realSalesByMonth[monthName] = (realSalesByMonth[monthName] || 0) + order.totalPrice;
      }
    });

    return months.map((m, idx) => {
      const live = realSalesByMonth[m] || 0;
      return {
        month: m,
        sales: baselineSales[idx] + live,
        orders: Math.floor((baselineSales[idx] + live) / 250)
      };
    });
  }, [orders]);

  // Analytical Chart: Category Sales Popularity Matrix
  const categoryPopularityData = useMemo(() => {
    const baselinePopularity: Record<Category, number> = {
      "Perfume": 4200,
      "Clothing": 3300,
      "Watches": 2800,
      "Home Decoration": 1900,
      "Baby Care": 1200,
      "Electronics": 3100,
      "Food & Beverage": 2400,
      "Bags": 1800,
      "Toys": 900,
      "Cosmetics": 1600
    };

    const dynamicSales: Record<string, number> = {};
    orders.forEach(order => {
      if (order.status !== "Cancelled") {
        order.items.forEach(item => {
          const prod = products.find(p => p.id === item.productId);
          if (prod) {
            dynamicSales[prod.category] = (dynamicSales[prod.category] || 0) + (item.priceAtPurchase * item.quantity);
          }
        });
      }
    });

    return CATEGORIES.map(cat => {
      const base = baselinePopularity[cat] || 500;
      const live = dynamicSales[cat] || 0;
      return {
        name: lang === "en" ? cat : CATEGORY_TRANSLATIONS[cat]?.[lang] || cat,
        sales: base + live
      };
    }).sort((a, b) => b.sales - a.sales);
  }, [orders, products, lang]);

  // Early intercept for ultra fast print view to bypass loading heavy UI elements completely
  const isPrintViewRequest = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("print") === "true";
  
  if (isPrintViewRequest) {
    const queryParams = new URLSearchParams(window.location.search);
    const invId = queryParams.get("invoiceId") || queryParams.get("printOrder") || queryParams.get("orderId");
    const reportPhone = queryParams.get("customerReportPhone");
    const inventoryCategory = queryParams.get("inventoryPrintCategory");
    const inventorySubcategory = queryParams.get("inventoryPrintSubCategory") || "All";
    
    if (invId) {
      const allOrders = [...orders, ...userOrders];
      const matchOrder = allOrders.find(o => o && String(o.id) === String(invId));
      if (matchOrder) {
        return (
          <MinimalInvoicePrintView 
            order={matchOrder}
            settings={settings}
            products={products}
            lang={lang}
            formatPrice={formatPrice}
          />
        );
      }
    } else if (reportPhone) {
      return (
        <MinimalCustomerReportPrintView 
          customerPhone={reportPhone}
          registeredUsers={registeredUsers}
          orders={orders}
          settings={settings}
          lang={lang}
          formatPrice={formatPrice}
        />
      );
    } else if (inventoryCategory) {
      return (
        <MinimalInventoryPrintView 
          category={inventoryCategory}
          subCategory={inventorySubcategory}
          products={products}
          lang={lang}
        />
      );
    }
  }

  if (isInitialLoading) {
    return (
      <div className="fixed inset-0 z-[99999] bg-stone-50 flex flex-col items-center justify-center font-sans">
        <div className="relative w-36 h-36 flex items-center justify-center mb-6 animate-pulse">
          {/* Official Star logo representing RIEMART */}
          <svg className="w-full h-full text-stone-900" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <mask id="star-logo-mask-react">
                <rect x="0" y="0" width="200" height="200" fill="white" />
                <rect x="90" y="92" width="110" height="28" fill="black" />
              </mask>
            </defs>
            <path 
              d="M 100 15 L 122 88 L 186 77 L 136 112 L 153 178 L 100 138 L 47 178 L 64 112 L 14 77 L 78 88 Z" 
              stroke="currentColor" 
              strokeWidth="15" 
              strokeLinejoin="miter" 
              strokeLinecap="square"
              mask="url(#star-logo-mask-react)"
            />
            <text 
              x="91" 
              y="114" 
              fill="currentColor" 
              fontFamily="system-ui, -apple-system, sans-serif" 
              fontWeight="950" 
              fontSize="19"
              letterSpacing="1.2"
            >RIEMART</text>
          </svg>
        </div>
        <div className="text-stone-500 font-mono text-[11px] uppercase tracking-[0.25em] mb-4">
          {lang === "en" ? "Loading Premium Store..." : "প্রিমিয়াম স্টোর লোড হচ্ছে..."}
        </div>
        <div className="w-6 h-6 border-2 border-stone-200 border-t-stone-900 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans flex flex-col antialiased pb-16 md:pb-0">
      
      {/* AI Studio Staging / Share Link Helper Badge */}
      {typeof window !== "undefined" && window.location.hostname.includes("ais-dev-") && (
        <div className="bg-amber-500 text-stone-950 font-sans text-[11.5px] py-2.5 px-4 animate-studio-reveal border-b border-amber-600 print:hidden" id="aistudio-share-instruction-banner">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 font-medium">
            <div className="flex items-center gap-2">
              <span className="text-base shrink-0">📢</span>
              <p className="leading-normal">
                {lang === "en" ? (
                  <span>
                    <strong>Hey!</strong> To share your store via WhatsApp, do <strong>NOT</strong> copy your browser's top address bar link (as that is a private developer workspace). Click the button to get the <strong>Public Link</strong>!
                  </span>
                ) : (
                  <span>
                    <strong>শুভেচ্ছা!</strong> হোয়াটসঅ্যাপে ওয়েবসাইট লিংক শেয়ার করতে ব্রাউজারের ওপরের এড্রেস বারের লিংকটি কপি করবেন না (এটি একটি প্রাইভেট ডেভেলপার লিংক যা অন্য ফোনে ওপেন হবে না)। পাবলিক লিংক পেতে ডানের বাটনটি চাপুন!
                  </span>
                )}
              </p>
            </div>
            
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => {
                  const finalLink = "https://ais-pre-lal6k3zqlq7ej7axfsl5gi-252555841806.asia-southeast1.run.app";
                  const success = safeCopyToClipboard(finalLink);
                  if (success) {
                    alert(lang === "en" 
                      ? "✓ Public Stating Link copied successfully!\nYou can now paste it directly in WhatsApp to share with any device." 
                      : "✓ পাবলিক স্টোর লিংক সফলভাবে কপি করা হয়েছে!\nএখন যেকোনো ফোনে বা হোয়াটসঅ্যাপ চ্যাটে এটি পেস্ট করে শেয়ার করতে পারেন।"
                    );
                  }
                }}
                className="bg-stone-950 hover:bg-stone-900 text-white font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-sm font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95"
              >
                <span>{lang === "en" ? "Copy Public Link" : "পাবলিক লিংক কপি"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Announcement Ribbon */}
      {settings.showAnnouncement && (
        <div className="bg-stone-950 text-stone-200 text-xs tracking-widest font-mono py-2.5 px-4 overflow-hidden border-b border-stone-800 print:hidden">
          <div className="max-w-7xl mx-auto flex justify-between items-center whitespace-nowrap overflow-x-auto gap-8 justify-center select-none">
            <span className="font-medium inline-block shrink-0">
              ⚡ {lang === "en" ? settings.announcementEn : settings.announcementBn}
            </span>
            <div className="hidden md:flex shrink-0 items-center gap-4 text-[10px] text-stone-400">
              <span>● MULTI-BUY ACTIVE</span>
              <span>● COMPLIMENTARY SHIPPING</span>
              <span>● SECURED SECURE PORTAL</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Active append-to-order mode indicator bar */}
      {activeAppendOrderId && (
        <div className="bg-amber-600 text-white text-xs font-mono py-3 px-4 border-b border-amber-700 shadow-md sticky top-0 md:sticky z-45 animate-studio-reveal print:hidden" id="active-append-mode-bar">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
              </span>
              <span className="font-semibold tracking-wide flex items-center gap-1.5 flex-wrap">
                <ShoppingBag className="w-4 h-4 text-white shrink-0" />
                {lang === "en" ? (
                  <span>You are in <span className="underline font-black">Add-on Mode</span> for Order <span className="bg-amber-800 font-bold px-1.5 py-0.5 rounded text-[10px] ml-1">{activeAppendOrderId}</span>. New items will automatically append to this receipt!</span>
                ) : (
                  <span>আপনি অর্ডার মেমো <span className="bg-amber-800 font-bold px-1.5 py-0.5 rounded text-[10px] ml-1 text-white">{activeAppendOrderId}</span>-এর সাথে <span className="underline font-black">আরও পণ্য যুক্ত করার মুডে</span> আছেন। প্রতিটি পণ্য এতে যোগ হবে!</span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2 bg-amber-700/40 p-1 rounded-sm">
              {/* Check current invoice button */}
              <a
                href={isInsideIframe && activeAppendOrderId ? getPrintUrl(activeAppendOrderId) : "#"}
                target={isInsideIframe ? "_blank" : undefined}
                onClick={isInsideIframe ? undefined : (e) => {
                  e.preventDefault();
                  const targetOrd = orders.find(o => o.id === activeAppendOrderId) || lastPlacedOrder;
                  if (targetOrd) {
                    setPrintingOrder(targetOrd);
                  } else {
                    alert(lang === "en" ? "Order memo could not be located." : "মেমোটি খুঁজে পাওয়া যায়নি।");
                  }
                }}
                className="bg-amber-800 hover:bg-amber-850 hover:scale-[1.02] active:scale-[0.98] text-white font-bold uppercase text-[10px] px-3 py-1.5 rounded-sm transition-all flex items-center gap-1 cursor-pointer border border-amber-650 inline-flex items-center select-none"
                id="append-bar-view-memo"
              >
                <FileText className="w-3.5 h-3.5 text-amber-200" />
                {lang === "en" ? "View Memo" : "মেমো দেখুন"}
              </a>
              {/* Finish shopping button */}
              <button
                onClick={() => {
                  setActiveAppendOrderId(null);
                  addSystemLog(
                    "info",
                    `Manually exits add-on append mode`,
                    `ব্যবহারকারী নিজের ইচ্ছায় পণ্য যোগ করা শেষ করেছেন`
                  );
                }}
                className="bg-stone-900 hover:bg-stone-950 hover:scale-[1.02] active:scale-[0.98] text-white font-bold uppercase text-[10px] px-3 py-1.5 rounded-sm transition-all flex items-center gap-1 cursor-pointer border border-stone-850"
                id="append-bar-finish"
              >
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                {lang === "en" ? "Finish Session" : "সংশোধন শেষ করুন"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Luxury Header */}
      <header className="md:sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-stone-200/60 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Logo & Slogan Area */}
          <div className="flex items-center justify-between">
            <button 
              onClick={() => {
                setSelectedCategory("All");
                setSelectedSubCategory(null);
                setShowAdminPortal(false);
                setSearchQuery("");
                setCurrentPage(1);
                setIsCartOpen(false);
                setIsWishlistOpen(false);
                setIsAccountOpen(false);
                setSelectedProduct(null);
                setPrintingOrder(null);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="flex items-center gap-3 group text-left focus:outline-none"
              id="brand-navigation-logo"
            >
              <div className="w-9 h-9 text-stone-950 transition-transform duration-300 group-hover:scale-110" dangerouslySetInnerHTML={{ __html: StarIconSvg() }} />
              <div>
                <h1 className="font-display font-bold text-2xl tracking-tight text-stone-950 flex items-baseline gap-1">
                  {DICTIONARY[lang].brandName}
                  <span className="text-[10px] text-stone-500 font-sans font-normal tracking-wide">
                    {DICTIONARY[lang].domain}
                  </span>
                </h1>
                <p className="text-[9px] tracking-[0.25em] text-stone-400 font-mono">
                  {DICTIONARY[lang].brandSubtitle}
                </p>
              </div>
            </button>

            {/* Mobile utilities */}
            <div className="flex items-center gap-1.5 md:hidden">
              <button 
                onClick={() => setLang(lang === "en" ? "bn" : "en")} 
                className="p-1.5 hover:bg-stone-100 rounded text-xs font-mono font-medium tracking-wide flex items-center gap-1 cursor-pointer"
                title="Change Language"
                id="mobile-language-toggle"
              >
                <Globe className="w-3.5 h-3.5 text-stone-500" />
                {lang === "en" ? "BN" : "EN"}
              </button>
            </div>
          </div>

          {/* Expanded Search Area */}
          <div className="flex-1 max-w-md mx-auto w-full flex items-center gap-2">
            <div className="relative flex-1">
              <OptimizedInput
                type="text"
                placeholder={DICTIONARY[lang].searchPlaceholder}
                value={searchQuery}
                onChange={(val) => setSearchQuery(val)}
                className="w-full bg-stone-100/80 border-0 focus:bg-white focus:ring-1 focus:ring-stone-400/80 rounded-sm py-2 pl-9 pr-4 text-sm transition-all text-stone-900 placeholder:text-stone-400"
                id="search-input-field"
              />
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-2.5 text-stone-405 hover:text-stone-900"
                  id="search-clear-button"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {/* Packaging QR Scanner trigger */}
            <button
              onClick={() => {
                setScannerError(null);
                setScannerSuccessMsg(null);
                setIsScannerOpen(true);
              }}
              className="bg-stone-900 hover:bg-stone-850 hover:scale-103 active:scale-97 text-white p-2 text-xs font-mono tracking-wider transition-all shrink-0 flex items-center justify-center rounded-sm shadow-sm cursor-pointer h-9 w-9 border border-stone-800"
              id="header-qr-scanner-trigger"
              title={lang === "en" ? "Scan Packaging QR" : "প্যাকেজিং কিউআর স্ক্যান করুন"}
            >
              <Camera className="w-4 h-4 text-amber-400 animate-pulse" />
            </button>
          </div>

          {/* Desktop Right Hand Control Hub */}
          <div className="hidden md:flex items-center gap-4">
            
            {/* Language Controls */}
            <div className="flex items-center border border-stone-200 rounded-sm overflow-hidden text-xs font-mono">
              <button
                onClick={() => setLang("en")}
                className={`px-2.5 py-1 transition-colors ${
                  lang === "en" ? "bg-stone-950 text-white" : "bg-white text-stone-600 hover:bg-stone-50"
                }`}
                id="language-en-btn"
              >
                EN
              </button>
              <button
                onClick={() => setLang("bn")}
                className={`px-2.5 py-1 transition-colors ${
                  lang === "bn" ? "bg-stone-950 text-white" : "bg-white text-stone-600 hover:bg-stone-50"
                }`}
                id="language-bn-btn"
              >
                বাংলা
              </button>
            </div>

            {/* Currency Unit Indicator */}
            <div className="flex items-center border border-stone-300 rounded-sm overflow-hidden text-xs font-mono bg-stone-900 text-stone-100 px-2.5 py-1" id="currency-bdt-indicator">
              ৳ BDT
            </div>

            {/* Workspace Admin Switch */}
            <button
              onClick={() => {
                setShowAdminPortal(!showAdminPortal);
                setSelectedCategory("All");
              }}
              className={`relative p-2 transition-colors flex items-center justify-center rounded-sm ${
                showAdminPortal 
                  ? "bg-amber-100 text-amber-900 border border-amber-305"
                  : "bg-stone-100 hover:bg-stone-200 text-stone-705"
              }`}
              title={DICTIONARY[lang].adminPortal}
              id="admin-security-portal-toggle"
            >
              <Lock className="w-4 h-4" />
              {pendingOrdersCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white text-[8px] font-mono font-bold w-4 h-4 rounded-full flex items-center justify-center animate-bounce border border-white">
                  {pendingOrdersCount}
                </span>
              )}
              {isAdminAuthorized && pendingOrdersCount === 0 && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 ml-1.5 animate-pulse" />
              )}
            </button>

            {/* Dynamic Notifications Bell */}
            <button
              onClick={() => {
                setIsAccountOpen(true);
                setAccountActiveTab("notifications");
                markFilteredNotificationsAsRead();
              }}
              className="relative bg-white hover:bg-stone-100 text-stone-900 border border-stone-200 px-3 py-2 text-xs font-mono tracking-wider transition-colors duration-155 flex items-center gap-2 rounded-sm shadow-sm cursor-pointer"
              id="desktop-notifications-bell-trigger"
              title={lang === "en" ? "Notifications" : "নোটিফিকেশন সমূহ"}
            >
              <Bell className={`w-4 h-4 ${getFilteredNotifications().some((n) => !n.isRead) ? "text-amber-500 animate-bounce" : "text-stone-600"}`} />
              <span className="hidden lg:inline">{lang === "en" ? "Inbox" : "ইনবক্স"}</span>
              {getFilteredNotifications().filter((n) => !n.isRead).length > 0 && (
                <span className="bg-amber-105 text-stone-900 font-bold text-[9px] w-5 h-5 rounded-full flex items-center justify-center font-mono animate-pulse">
                  {getFilteredNotifications().filter((n) => !n.isRead).length}
                </span>
              )}
            </button>

            {/* Account Dashboard Button */}
            <button
              onClick={() => {
                setIsAccountOpen(true);
                setAccountActiveTab(loggedInUser ? "profile" : "login");
              }}
              className="bg-white hover:bg-stone-100 text-stone-900 border border-stone-200 px-3.5 py-2 text-xs font-mono tracking-wider transition-colors duration-155 flex items-center gap-2 rounded-sm shadow-sm cursor-pointer"
              id="desktop-account-hub-trigger"
              title={lang === "en" ? "My Account" : "আমার অ্যাকাউন্ট"}
            >
              {loggedInUser && loggedInUser.profilePicture ? (
                <img 
                  src={loggedInUser.profilePicture} 
                  alt={loggedInUser.name} 
                  className="w-5 h-5 rounded-full object-cover border border-stone-200"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <User className="w-4 h-4 text-stone-600" />
              )}
              <span>
                {loggedInUser ? (
                  <span className="truncate max-w-[80px] font-sans font-semibold text-[11px] text-stone-850">
                    {loggedInUser.name.split(" ")[0]}
                  </span>
                ) : (
                  <span>{lang === "en" ? "Account" : "অ্যাকাউন্ট"}</span>
                )}
              </span>
            </button>

            {/* Centralized Wishlist Trigger */}
            <button
              onClick={() => {
                setIsAccountOpen(true);
                setAccountActiveTab("wishlist");
              }}
              className="relative bg-white hover:bg-stone-100 text-stone-900 border border-stone-200 px-4 py-2 text-xs font-mono tracking-wider transition-colors duration-155 flex items-center gap-2 rounded-sm shadow-sm cursor-pointer"
              id="desktop-wishlist-trigger"
              title={DICTIONARY[lang].wishlistTitle}
            >
              <Heart className={`w-4 h-4 ${wishlist.length > 0 ? "fill-red-500 text-red-500" : "text-stone-600"}`} />
              <span>{DICTIONARY[lang].wishlistButton}</span>
              <span className={`text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold ${wishlist.length > 0 ? "bg-red-50 text-red-600" : "bg-stone-100 text-stone-600"}`}>
                {wishlist.length}
              </span>
            </button>

            {/* Shopping Bag Trigger */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative bg-stone-950 hover:bg-stone-900 text-stone-50 hover:text-white px-4 py-2 text-xs font-mono tracking-wider transition-colors duration-155 flex items-center gap-2 rounded-sm"
              id="desktop-cart-trigger"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>{lang === "en" ? "BAG" : "কার্ট"}</span>
              <span className="bg-stone-800 text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">
                {totalItemsCount}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Categories Strip Menu -- Responsive and minimal */}
      <div className="bg-stone-50 border-t border-b border-stone-200/55 overflow-x-auto md:overflow-visible whitespace-nowrap scrollbar-none scroll-smooth">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-start md:justify-center gap-1.5 md:gap-2 md:overflow-visible">
          <button
            onClick={() => {
              setSelectedCategory("All");
              setSelectedSubCategory(null);
              setShowAdminPortal(false);
              setSearchQuery("");
              setCurrentPage(1);
              setSelectedProduct(null);
            }}
            className={`px-4 py-3 text-xs tracking-wider transition-all font-sans font-medium focus:outline-none shrink-0 ${
              selectedCategory === "All" && !showAdminPortal
                ? "border-b-2 border-stone-950 font-semibold text-stone-955"
                : "text-stone-500 hover:text-stone-900 hover:bg-stone-100/50"
            }`}
            id="category-tab-all"
          >
            {DICTIONARY[lang].allProducts}
          </button>
          {CATEGORIES.map((cat) => {
            const label = CATEGORY_TRANSLATIONS[cat][lang];
            if (cat === "Perfume") {
              return (
                <div
                  key={cat}
                  className="relative group shrink-0 inline-block align-middle md:overflow-visible"
                  id="perfume-dropdown-container"
                >
                  <button
                    onClick={() => {
                      setSelectedCategory("Perfume");
                      setSelectedSubCategory(null);
                      setShowAdminPortal(false);
                    }}
                    className={`px-4 py-3 text-xs tracking-wider transition-all font-sans font-semibold focus:outline-none flex items-center gap-1.5 cursor-pointer rounded-sm ${
                      selectedCategory === "Perfume" && !showAdminPortal
                        ? "border-b-2 border-amber-600 bg-amber-50/75 text-amber-955"
                        : "text-amber-805 bg-amber-50/50 border border-amber-100/40 hover:text-amber-955 hover:bg-amber-100/25"
                    }`}
                    id="category-tab-perfume"
                  >
                    <span className="flex items-center gap-1">
                      <span>{label}</span>
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                    </span>
                    <ChevronDown className="w-3 h-3 text-amber-600 group-hover:text-amber-955 transition-transform group-hover:rotate-180" />
                  </button>

                  {/* Premium Mega Menu Dropdown - Desktop (opens on group hover) */}
                  <div className="absolute left-1/2 -translate-x-1/2 top-full hidden md:group-hover:block bg-white border border-stone-200 shadow-2xl rounded-sm p-6 z-50 md:w-[720px] lg:w-[820px] text-left animate-studio-reveal border-t-2 border-t-amber-600">
                    <div className="mb-4 pb-2 border-b border-stone-105 flex items-center justify-between">
                      <span className="text-[10px] font-mono text-amber-850 tracking-wider uppercase font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                        {lang === "en" ? "Maison De Parfum" : "মেসো ডি পারফিউম"}
                      </span>
                      <span className="text-[9px] font-mono text-stone-400 uppercase tracking-widest">
                        RIEMART ROYAL FRAGRANCES
                      </span>
                    </div>

                    {/* 4-Column Layout */}
                    <div className="grid grid-cols-4 gap-6">
                      {/* Column 1: Featured Brand Column */}
                      <div className="bg-gradient-to-br from-stone-950 via-amber-955 to-stone-900 text-stone-100 p-4.5 rounded-sm flex flex-col justify-between min-h-[220px]">
                        <div>
                          <span className="text-[8px] font-mono tracking-widest text-amber-400 uppercase block mb-1">
                            {lang === "en" ? "Artisan Scents" : "রিয়ামার্ট সুগন্ধি"}
                          </span>
                          <h4 className="font-display font-medium text-xs text-amber-305 tracking-tight uppercase">
                            RIEMART ROYAL COLLECTION
                          </h4>
                          <p className="text-[10px] text-stone-300 leading-relaxed mt-2 font-normal font-sans whitespace-normal">
                            {lang === "en" 
                              ? "Maison-grade premium perfumes, refreshing body sprays, and world-renowned traditional non-alcoholic Attars curated for ultimate longevity."
                              : "বিশ্ববিখ্যাত ব্র্যান্ড সমাদৃত ওরিয়েন্টাল আতর, মন মাতানো বডি স্প্রে এবং দীর্ঘস্থায়ী প্রিমিয়াম ফ্রেঞ্চ পারফিউম কালেকশন।"}
                          </p>
                        </div>
                        <div className="pt-3 border-t border-amber-900/35 flex items-center justify-between">
                          <span className="text-[8px] font-mono text-amber-500 uppercase tracking-widest font-bold">PREMIUM OILS</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                        </div>
                      </div>

                      {/* Column 2: Fine Fragrances */}
                      <div className="space-y-3">
                        <h4 className="text-[10px] font-bold text-amber-800 tracking-wider font-mono uppercase pb-1.5 border-b border-stone-105 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                          {lang === "en" ? "Fine Fragrances" : "ফ্রেঞ্চ পারফিউম"}
                        </h4>
                        <div className="flex flex-col gap-1">
                          {PERFUME_SUBCATEGORIES.filter(sub => ["Men Perfume", "Women Perfume"].includes(sub.value)).map((sub) => {
                            const isSubSelected = selectedCategory === "Perfume" && selectedSubCategory === sub.value;
                            return (
                              <button
                                key={sub.value}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedCategory("Perfume");
                                  setSelectedSubCategory(sub.value);
                                  setShowAdminPortal(false);
                                }}
                                className={`px-2.5 py-1.5 text-left text-xs font-sans tracking-wide transition-all rounded-sm flex flex-col group/item cursor-pointer ${
                                  isSubSelected
                                    ? "bg-amber-50 text-amber-955 border-l-2 border-amber-600 font-semibold"
                                    : "text-stone-650 hover:text-amber-955 hover:bg-amber-50/45"
                                }`}
                                id={`sub-category-tab-${sub.value.replace(/\s+/g, "-").replace(/'/g, "").toLowerCase()}`}
                              >
                                <span className="font-medium group-hover/item:translate-x-0.5 transition-transform duration-200">{sub.labelEn}</span>
                                <span className="text-[9px] text-stone-400 mt-0.5 group-hover/item:text-amber-750 transition-colors font-normal">
                                  {sub.value === "Men Perfume" ? (lang === "en" ? "For Men" : "পুরুষদের জন্য") : (lang === "en" ? "For Women" : "নারীদের জন্য")}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Column 3: Oriental & Everyday Sprays */}
                      <div className="space-y-3">
                        <h4 className="text-[10px] font-bold text-amber-800 tracking-wider font-mono uppercase pb-1.5 border-b border-stone-100 flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse"></span>
                          {lang === "en" ? "Deo & Traditional Oils" : "বডি স্প্রে ও আতর"}
                        </h4>
                        <div className="flex flex-col gap-1">
                          {PERFUME_SUBCATEGORIES.filter(sub => ["Men & Women Body Spray", "Attar"].includes(sub.value)).map((sub) => {
                            const isSubSelected = selectedCategory === "Perfume" && selectedSubCategory === sub.value;
                            return (
                              <button
                                key={sub.value}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedCategory("Perfume");
                                  setSelectedSubCategory(sub.value);
                                  setShowAdminPortal(false);
                                }}
                                className={`px-2.5 py-1.5 text-left text-xs font-sans tracking-wide transition-all rounded-sm flex flex-col group/item cursor-pointer ${
                                  isSubSelected
                                    ? "bg-amber-50 text-amber-955 border-l-2 border-amber-600 font-semibold"
                                    : "text-stone-655 hover:text-amber-955 hover:bg-amber-50/45"
                                }`}
                                id={`sub-category-tab-${sub.value.replace(/\s+/g, "-").replace(/'/g, "").toLowerCase()}`}
                              >
                                <span className="font-medium group-hover/item:translate-x-0.5 transition-transform duration-200 text-stone-850">
                                  {lang === "en" ? sub.labelEn : sub.labelBn}
                                </span>
                                <span className="text-[9px] text-stone-400 mt-0.5 group-hover/item:text-amber-750 transition-colors font-normal">
                                  {sub.value === "Attar" ? (lang === "en" ? "Concentrated Oils" : "এলকোহল মুক্ত সুগন্ধি তেল") : (lang === "en" ? "Active Care" : "দৈনন্দিন সতেজতা")}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Column 4: Notes & Scent Matching advice */}
                      <div className="bg-stone-50 border border-stone-200/80 p-3.5 rounded-sm flex flex-col justify-between">
                        <div>
                          <span className="text-[8px] font-mono tracking-widest text-amber-850 font-bold uppercase block mb-1">
                            {lang === "en" ? "Sparing Protocol" : "ব্যবহারবিধি"}
                          </span>
                          <span className="font-display font-medium text-[10px] text-stone-850 uppercase block">
                            {lang === "en" ? "Oudh & Musk Blends" : "উদ ও কস্তুরী ব্লেন্ড"}
                          </span>
                          <p className="text-[9.5px] leading-relaxed text-stone-500 mt-2 font-normal font-sans whitespace-normal">
                            {lang === "en" 
                              ? "For high-concentration Attar, apply slightly onto pulse points like back of wrists for max diffusion that spreads beautifully over hours."
                              : "আতর বা প্রিমিয়াম তেলের সুবাস দীর্ঘক্ষণ পেতে কবজি ও কলার বোনের পালস পয়েন্টে আলতো ব্যবহার করুন।"}
                          </p>
                        </div>
                        <div className="text-right pt-2">
                          <span className="text-[8px] italic font-serif text-stone-400">Pure Alchemy</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Simple Dropdown Menu - Mobile/Tablet (opens on group hover) */}
                  <div className="absolute left-1/2 -translate-x-1/2 top-full block md:hidden hidden group-hover:block bg-white border border-stone-200 shadow-xl rounded-sm py-1.5 z-50 min-w-[210px] text-center animate-studio-reveal border-t-2 border-t-amber-600">
                    <div className="flex flex-col">
                      {PERFUME_SUBCATEGORIES.map((sub) => {
                        const isSubSelected = selectedCategory === "Perfume" && selectedSubCategory === sub.value;
                        return (
                          <button
                            key={sub.value}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCategory("Perfume");
                              setSelectedSubCategory(sub.value);
                              setShowAdminPortal(false);
                            }}
                            className={`px-4 py-2.5 text-left text-xs font-sans tracking-wide transition-colors ${
                              isSubSelected
                                ? "bg-amber-50 text-amber-955 font-bold border-l-2 border-amber-600"
                                : "text-stone-650 hover:text-stone-955 hover:bg-stone-50"
                            }`}
                            id={`sub-category-tab-${sub.value.replace(/\s+/g, "-").toLowerCase()}`}
                          >
                            {lang === "en" ? sub.labelEn : sub.labelBn}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            }


              if (cat === "Food & Beverage") {
                return (
                  <div
                    key={cat}
                    className="relative group shrink-0 inline-block align-middle md:overflow-visible"
                    id="food-beverage-dropdown-container"
                  >
                    <button
                      onClick={() => {
                        setSelectedCategory("Food & Beverage");
                        setSelectedSubCategory(null);
                        setShowAdminPortal(false);
                      }}
                      className={`px-4 py-3 text-xs tracking-wider transition-all font-sans font-semibold focus:outline-none flex items-center gap-1.5 cursor-pointer rounded-sm ${
                        selectedCategory === "Food & Beverage" && !showAdminPortal
                          ? "bg-red-600 text-black border-b-2 border-red-800"
                          : "text-emerald-800 bg-emerald-50/75 border border-emerald-100/50 hover:text-emerald-950 hover:bg-emerald-100/35"
                      }`}
                      id="category-tab-food-beverage"
                    >
                      <span className="flex items-center gap-1">
                        <span>{label}</span>
                        <span className={`inline-block w-1.5 h-1.5 rounded-full animate-pulse ${
                          selectedCategory === "Food & Beverage" && !showAdminPortal
                            ? "bg-black"
                            : "bg-emerald-500"
                        }`}></span>
                      </span>
                      <ChevronDown className={`w-3 h-3 transition-transform group-hover:rotate-180 ${
                        selectedCategory === "Food & Beverage" && !showAdminPortal
                          ? "text-black"
                          : "text-emerald-700 group-hover:text-emerald-950"
                      }`} />
                    </button>

                    {/* Mega Menu Dropdown - Desktop (opens on group hover) */}
                    <div className="absolute left-1/2 -translate-x-1/2 top-full hidden md:group-hover:block bg-white border border-stone-200 shadow-2xl rounded-sm p-6 z-50 md:w-[720px] lg:w-[820px] text-left animate-studio-reveal border-t-2 border-t-emerald-700">
                      <div className="mb-4 pb-2 border-b border-stone-100 flex items-center justify-between">
                        <span className="text-[10px] font-mono text-emerald-800 tracking-wider uppercase font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                          {lang === "en" ? "Gourmet Selection" : "গুরমে খাদ্যসম্ভার"}
                        </span>
                        <span className="text-[9px] font-mono text-stone-400 uppercase tracking-widest">
                          RIEMART FINE FOODS
                        </span>
                      </div>
                      
                      {/* Grid Columns layout */}
                      <div className="grid grid-cols-4 gap-6">
                        {/* Column 1: Featured Brand Column */}
                        <div className="bg-gradient-to-br from-emerald-950 via-emerald-900 to-stone-900 text-stone-100 p-4.5 rounded-sm flex flex-col justify-between min-h-[220px]">
                          <div>
                            <span className="text-[8px] font-mono tracking-widest text-emerald-300 uppercase block mb-1">
                              {lang === "en" ? "Gourmet Hub" : "রিয়ামার্ট স্পেশাল"}
                            </span>
                            <h4 className="font-display font-medium text-sm text-white tracking-tight uppercase">
                              RIEMART FINE FOODS
                            </h4>
                            <p className="text-[10px] text-emerald-150 leading-relaxed mt-2 font-normal font-sans whitespace-normal">
                              {lang === "en" 
                                ? "Handpicked organic local honey, rich chocolates, bakery, dairy and elite restaurant kitchen foods curated on RIEMARTBD.COM."
                                : "রিয়ামার্ট বিডি ডট কমের সরাসরি সংগৃহীত সেরা অর্গানিক খাদ্য সামগ্রী, চকলেট, প্যান্ট্রি স্ট্যাপল ও প্রিমিয়াম ডেইরি।"}
                            </p>
                          </div>
                          <div className="pt-3 border-t border-emerald-800/40 flex items-center justify-between">
                            <span className="text-[8px] font-mono text-emerald-400 uppercase tracking-widest font-bold">EST. 2024</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          </div>
                        </div>

                        {/* Column 2: Sweets & Pastries */}
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-bold text-emerald-800 tracking-wider font-mono uppercase pb-1.5 border-b border-stone-100 flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-emerald-600"></span>
                            {lang === "en" ? "Sweets & Pastries" : "মিষ্টি ও বেকারি"}
                          </h4>
                          <div className="flex flex-col gap-1">
                            {FOOD_BEVERAGE_SUBCATEGORIES.filter(sub => ["Chocolate's", "Biscuits", "Bakery Products"].includes(sub.value)).map((sub) => {
                              const isSubSelected = selectedCategory === "Food & Beverage" && selectedSubCategory === sub.value;
                              return (
                                <button
                                  key={sub.value}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedCategory("Food & Beverage");
                                    setSelectedSubCategory(sub.value);
                                    setShowAdminPortal(false);
                                  }}
                                  className={`px-2.5 py-1.5 text-left text-xs font-sans tracking-wide transition-all rounded-sm flex flex-col group/item cursor-pointer ${
                                    isSubSelected
                                      ? "bg-red-600 text-black border-l-2 border-red-800 font-bold shadow-sm"
                                      : "text-stone-650 hover:text-emerald-950 hover:bg-emerald-50/45"
                                  }`}
                                  id={`sub-category-tab-${sub.value.replace(/\s+/g, "-").replace(/'/g, "").toLowerCase()}`}
                                >
                                  <span className={`font-medium group-hover/item:translate-x-0.5 transition-transform duration-200 ${isSubSelected ? "text-black" : ""}`}>{sub.labelEn}</span>
                                  <span className={`text-[9px] mt-0.5 transition-colors ${
                                    isSubSelected
                                      ? "text-stone-900 font-medium"
                                      : "text-stone-400 group-hover/item:text-emerald-700"
                                  }`}>
                                    {sub.labelBn}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Column 3: Dairy & Staples */}
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-bold text-emerald-800 tracking-wider font-mono uppercase pb-1.5 border-b border-stone-100 flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-emerald-600"></span>
                            {lang === "en" ? "Dairy & Staples" : "ডেইরি ও প্যান্ট্রি"}
                          </h4>
                          <div className="flex flex-col gap-1">
                            {FOOD_BEVERAGE_SUBCATEGORIES.filter(sub => ["Cheese", "Milk", "Oats", "Honey"].includes(sub.value)).map((sub) => {
                              const isSubSelected = selectedCategory === "Food & Beverage" && selectedSubCategory === sub.value;
                              return (
                                <button
                                  key={sub.value}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedCategory("Food & Beverage");
                                    setSelectedSubCategory(sub.value);
                                    setShowAdminPortal(false);
                                  }}
                                  className={`px-2.5 py-1.5 text-left text-xs font-sans tracking-wide transition-all rounded-sm flex flex-col group/item cursor-pointer ${
                                    isSubSelected
                                      ? "bg-red-600 text-black border-l-2 border-red-800 font-bold shadow-sm"
                                      : "text-stone-650 hover:text-emerald-950 hover:bg-emerald-50/45"
                                  }`}
                                  id={`sub-category-tab-${sub.value.replace(/\s+/g, "-").replace(/'/g, "").toLowerCase()}`}
                                >
                                  <span className={`font-medium group-hover/item:translate-x-0.5 transition-transform duration-200 ${isSubSelected ? "text-black" : ""}`}>{sub.labelEn}</span>
                                  <span className={`text-[9px] mt-0.5 transition-colors ${
                                    isSubSelected
                                      ? "text-stone-900 font-medium"
                                      : "text-stone-400 group-hover/item:text-emerald-700"
                                  }`}>
                                    {sub.labelBn}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Column 4: Drinks & Meals */}
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-bold text-emerald-800 tracking-wider font-mono uppercase pb-1.5 border-b border-stone-100 flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-emerald-600"></span>
                            {lang === "en" ? "Drinks & Meals" : "পানীয় ও খাবার"}
                          </h4>
                          <div className="flex flex-col gap-1">
                            {FOOD_BEVERAGE_SUBCATEGORIES.filter(sub => ["Drinks", "Noodles", "Pasta", "Restaurant Products"].includes(sub.value)).map((sub) => {
                              const isSubSelected = selectedCategory === "Food & Beverage" && selectedSubCategory === sub.value;
                              return (
                                <button
                                  key={sub.value}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedCategory("Food & Beverage");
                                    setSelectedSubCategory(sub.value);
                                    setShowAdminPortal(false);
                                  }}
                                  className={`px-2.5 py-1.5 text-left text-xs font-sans tracking-wide transition-all rounded-sm flex flex-col group/item cursor-pointer ${
                                    isSubSelected
                                      ? "bg-red-600 text-black border-l-2 border-red-800 font-bold shadow-sm"
                                      : "text-stone-650 hover:text-emerald-950 hover:bg-emerald-50/45"
                                  }`}
                                  id={`sub-category-tab-${sub.value.replace(/\s+/g, "-").replace(/'/g, "").toLowerCase()}`}
                                >
                                  <span className={`font-medium group-hover/item:translate-x-0.5 transition-transform duration-200 ${isSubSelected ? "text-black" : ""}`}>{sub.labelEn}</span>
                                  <span className={`text-[9px] mt-0.5 transition-colors ${
                                    isSubSelected
                                      ? "text-stone-900 font-medium"
                                      : "text-stone-400 group-hover/item:text-emerald-700"
                                  }`}>
                                    {sub.labelBn}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              if (cat === "Clothing") {
                return (
                  <div
                    key={cat}
                    className="relative group shrink-0 inline-block align-middle md:overflow-visible"
                    id="clothing-dropdown-container"
                  >
                    <button
                      onClick={() => {
                        setSelectedCategory("Clothing");
                        setSelectedSubCategory(null);
                        setShowAdminPortal(false);
                      }}
                      className={`px-4 py-3 text-xs tracking-wider transition-all font-sans font-semibold focus:outline-none flex items-center gap-1.5 cursor-pointer rounded-sm ${
                        selectedCategory === "Clothing" && !showAdminPortal
                          ? "border-b-2 border-stone-950 bg-stone-100 text-stone-950 font-bold"
                          : "text-stone-550 border border-transparent hover:text-stone-900 hover:bg-stone-100/50"
                      }`}
                      id="category-tab-clothing"
                    >
                      <span className="flex items-center gap-1">
                        <span>{label}</span>
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-stone-900 animate-pulse"></span>
                      </span>
                      <ChevronDown className="w-3 h-3 text-stone-500 group-hover:text-stone-900 transition-transform group-hover:rotate-180" />
                    </button>

                    {/* Premium Mega Menu Dropdown - Desktop (opens on group hover) */}
                    <div className="absolute left-1/2 -translate-x-1/2 top-full hidden md:group-hover:block bg-white border border-stone-200 shadow-2xl rounded-sm p-6 z-50 md:w-[720px] lg:w-[820px] text-left animate-studio-reveal border-t-2 border-t-stone-950">
                      <div className="mb-4 pb-2 border-b border-stone-100 flex items-center justify-between">
                        <span className="text-[10px] font-mono text-stone-850 tracking-wider uppercase font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-stone-900 animate-pulse"></span>
                          {lang === "en" ? "Atelier Apparel" : "অ্যাটেলিয়ার পোশাকসামগ্রী"}
                        </span>
                        <span className="text-[9px] font-mono text-stone-400 uppercase tracking-widest">
                          RIEMART PREMIUM COUTURE
                        </span>
                      </div>

                      {/* Grid Columns layout */}
                      <div className="grid grid-cols-4 gap-6">
                        {/* Column 1: Featured Brand Column */}
                        <div className="bg-gradient-to-br from-stone-900 via-stone-950 to-stone-900 text-stone-100 p-4.5 rounded-sm flex flex-col justify-between min-h-[220px]">
                          <div>
                            <span className="text-[8px] font-mono tracking-widest text-amber-400 uppercase block mb-1">
                              {lang === "en" ? "Bespoke Fits" : "ফ্যাশন কালেকশন"}
                            </span>
                            <h4 className="font-display font-medium text-xs text-white tracking-tight uppercase">
                              Couture Collection
                            </h4>
                            <p className="text-[9.5px] text-stone-300 leading-relaxed mt-2 font-normal font-sans whitespace-normal">
                              {lang === "en"
                                ? "Premium materials designed for everyday comfort and high-level elegance. Tailored collections representing class and artisanal style on RIEMARTBD.COM."
                                : "দৈনন্দিন আরাম এবং সর্বোচ্চ আভিজাত্যের জন্য প্রিমিয়াম কাপড় দিয়ে ডিজাইন করা পোশাকের সংগ্রহ যা আপনাকে দেবে নতুন আভিজাত্য।"}
                            </p>
                          </div>
                          <div className="pt-3 border-t border-stone-800 flex items-center justify-between">
                            <span className="text-[8px] font-mono text-amber-500 uppercase tracking-widest font-bold">NEW IN</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                          </div>
                        </div>

                        {/* Column 2: Men's Clothing */}
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-bold text-stone-900 tracking-wider font-mono uppercase pb-1.5 border-b border-stone-100 flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-stone-900 animate-pulse"></span>
                            {lang === "en" ? "Men's Clothing" : "ছেলেদের পোশাক"}
                          </h4>
                          <div className="flex flex-col gap-1">
                            {CLOTHING_SUBCATEGORIES.filter(sub => sub.gender === "men").map((sub) => {
                              const isSubSelected = selectedCategory === "Clothing" && selectedSubCategory === sub.value;
                              return (
                                <button
                                  key={sub.value}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedCategory("Clothing");
                                    setSelectedSubCategory(sub.value);
                                    setShowAdminPortal(false);
                                  }}
                                  className={`px-2.5 py-1.5 text-left text-xs font-sans tracking-wide transition-all rounded-sm flex flex-col group/item cursor-pointer ${
                                    isSubSelected
                                      ? "bg-stone-100 text-stone-950 border-l-2 border-stone-900 font-semibold"
                                      : "text-stone-600 hover:text-stone-950 hover:bg-stone-50"
                                  }`}
                                  id={`sub-category-tab-${sub.value.replace(/\s+/g, "-").replace(/'/g, "").toLowerCase()}`}
                                >
                                  <span className="font-medium group-hover/item:translate-x-0.5 transition-transform duration-200">{lang === "en" ? sub.labelEn : sub.labelBn}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Column 3: Women's Clothing */}
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-bold text-stone-900 tracking-wider font-mono uppercase pb-1.5 border-b border-stone-100 flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-stone-900 animate-pulse"></span>
                            {lang === "en" ? "Women's Clothing" : "মেয়েদের পোশাক"}
                          </h4>
                          <div className="flex flex-col gap-1">
                            {CLOTHING_SUBCATEGORIES.filter(sub => sub.gender === "women").map((sub) => {
                              const isSubSelected = selectedCategory === "Clothing" && selectedSubCategory === sub.value;
                              return (
                                <button
                                  key={sub.value}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedCategory("Clothing");
                                    setSelectedSubCategory(sub.value);
                                    setShowAdminPortal(false);
                                  }}
                                  className={`px-2.5 py-1.5 text-left text-xs font-sans tracking-wide transition-all rounded-sm flex flex-col group/item cursor-pointer ${
                                    isSubSelected
                                      ? "bg-stone-100 text-stone-950 border-l-2 border-stone-900 font-semibold"
                                      : "text-stone-600 hover:text-stone-950 hover:bg-stone-50"
                                  }`}
                                  id={`sub-category-tab-${sub.value.replace(/\s+/g, "-").replace(/'/g, "").toLowerCase()}`}
                                >
                                  <span className="font-medium group-hover/item:translate-x-0.5 transition-transform duration-200">{lang === "en" ? sub.labelEn : sub.labelBn}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Column 4: Sizing Guidelines */}
                        <div className="bg-stone-50 border border-stone-200/80 p-3.5 rounded-sm flex flex-col justify-between">
                          <div>
                            <span className="text-[8px] font-mono tracking-widest text-stone-500 font-bold uppercase block mb-1">
                              {lang === "en" ? "Design Philosophy" : "ডিজাইন দর্শন"}
                            </span>
                            <span className="font-display font-medium text-[10px] text-stone-850 uppercase block">
                              {lang === "en" ? "Bespoke Comfort" : "নিখুঁত আরাম ও আভিজাত্য"}
                            </span>
                            <p className="text-[9.5px] leading-relaxed text-stone-500 mt-2 font-normal font-sans whitespace-normal">
                              {lang === "en"
                                ? "Enjoy premium threads handpicked for hot climates, boasting highly breathable cotton, organic linen, and top-tier weaves."
                                : "গরমের মৌসুমের জন্য বিশেষভাবে তৈরি বাতাসে কোমল অনুভূতি দেওয়া সুতি কাপড় ও বিশেষ বয়ন পদ্ধতির প্রিমিয়াম পোশাক সংগ্রহ।"}
                            </p>
                          </div>
                          <div className="text-right pt-2 font-mono text-[8px] text-stone-400">
                            RIEMART CLOTHING
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Simple Dropdown Menu - Mobile/Tablet (opens on group hover / tapping) */}
                    <div className="absolute left-1/3 -translate-x-1/2 top-full block md:hidden hidden group-hover:block bg-white border border-stone-200 shadow-xl rounded-sm py-1.5 z-50 min-w-[210px] text-left animate-studio-reveal border-t-2 border-t-stone-900">
                      <div className="flex flex-col">
                        <div className="px-3 py-1 bg-stone-50 text-[9px] font-bold text-stone-500 border-b border-stone-100 tracking-wider">
                          {lang === "en" ? "MEN'S CLOTHING" : "ছেলেদের পোশাক"}
                        </div>
                        {CLOTHING_SUBCATEGORIES.filter(sub => sub.gender === "men").map((sub) => {
                          const isSubSelected = selectedCategory === "Clothing" && selectedSubCategory === sub.value;
                          return (
                            <button
                              key={sub.value}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCategory("Clothing");
                                setSelectedSubCategory(sub.value);
                                setShowAdminPortal(false);
                              }}
                              className={`px-4 py-2 text-left text-xs font-sans tracking-wide transition-colors ${
                                isSubSelected
                                  ? "bg-stone-105 text-stone-950 font-bold border-l-2 border-stone-800"
                                  : "text-stone-600 hover:text-stone-950 hover:bg-stone-50"
                              }`}
                            >
                              {lang === "en" ? sub.labelEn : sub.labelBn}
                            </button>
                          );
                        })}
                        <div className="px-3 py-1 bg-stone-50 text-[9px] font-bold text-stone-550 border-y border-stone-100 tracking-wider">
                          {lang === "en" ? "WOMEN'S CLOTHING" : "মেয়েদের পোশাক"}
                        </div>
                        {CLOTHING_SUBCATEGORIES.filter(sub => sub.gender === "women").map((sub) => {
                          const isSubSelected = selectedCategory === "Clothing" && selectedSubCategory === sub.value;
                          return (
                            <button
                              key={sub.value}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCategory("Clothing");
                                setSelectedSubCategory(sub.value);
                                setShowAdminPortal(false);
                              }}
                              className={`px-4 py-2 text-left text-xs font-sans tracking-wide transition-colors ${
                                isSubSelected
                                  ? "bg-stone-105 text-stone-955 font-bold border-l-2 border-stone-800"
                                  : "text-stone-600 hover:text-stone-955 hover:bg-stone-50"
                              }`}
                            >
                              {lang === "en" ? sub.labelEn : sub.labelBn}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              }

              if (cat === "Cosmetics") {
                return (
                  <div
                    key={cat}
                    className="relative group shrink-0 inline-block align-middle md:overflow-visible"
                    id="cosmetics-dropdown-container"
                  >
                    <button
                      onClick={() => {
                        setSelectedCategory("Cosmetics");
                        setSelectedSubCategory(null);
                        setShowAdminPortal(false);
                      }}
                      className={`px-4 py-3 text-xs tracking-wider transition-all font-sans font-semibold focus:outline-none flex items-center gap-1.5 cursor-pointer rounded-sm ${
                        selectedCategory === "Cosmetics" && !showAdminPortal
                          ? "border-b-2 border-stone-950 bg-stone-100 text-stone-955"
                          : "text-stone-550 border border-transparent hover:text-stone-900 hover:bg-stone-100/50"
                      }`}
                      id="category-tab-cosmetics"
                    >
                      <span className="flex items-center gap-1">
                        <span>{label}</span>
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-stone-900 animate-pulse"></span>
                      </span>
                      <ChevronDown className="w-3 h-3 text-stone-500 group-hover:text-stone-900 transition-transform group-hover:rotate-180" />
                    </button>

                    {/* Premium Mega Menu Dropdown - Desktop (opens on group hover) */}
                    <div className="absolute left-1/2 -translate-x-1/2 top-full hidden md:group-hover:block bg-white border border-stone-200 shadow-2xl rounded-sm p-6 z-50 md:w-[720px] lg:w-[820px] text-left animate-studio-reveal border-t-2 border-t-rose-600">
                      <div className="mb-4 pb-2 border-b border-stone-100 flex items-center justify-between">
                        <span className="text-[10px] font-mono text-stone-850 tracking-wider uppercase font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-stone-900 animate-pulse"></span>
                          {lang === "en" ? "Atelier Cosmetics" : "অ্যাটেলিয়ার কসমেটিকস"}
                        </span>
                        <span className="text-[9px] font-mono text-stone-400 uppercase tracking-widest">
                          RIEMART LUXURY ESSENTIALS
                        </span>
                      </div>

                      {/* Grid Columns layout */}
                      <div className="grid grid-cols-4 gap-6">
                        {/* Column 1: Featured Brand Column */}
                        <div className="bg-gradient-to-br from-stone-900 via-stone-950 to-stone-950 text-stone-100 p-4.5 rounded-sm flex flex-col justify-between min-h-[220px]">
                          <div>
                            <span className="text-[8px] font-mono tracking-widest text-amber-400 uppercase block mb-1">
                              {lang === "en" ? "Glow & Polish" : "সৌন্দর্য ও যত্ন"}
                            </span>
                            <h4 className="font-display font-medium text-xs text-white tracking-tight uppercase">
                              Self Care Narrative
                            </h4>
                            <p className="text-[9.5px] text-stone-300 leading-relaxed mt-2 font-normal font-sans whitespace-normal opacity-90">
                              {lang === "en"
                                ? "Artisanal skin care, luxury hair hydration, and vibrant colour cosmetics selected for premium purity and delightful radiance."
                                : "ত্বকের কোমল যত্ন, চুলের পুষ্টি এবং রিয়মারে সরাসরি আমদানিকৃত প্রিমিয়াম রূপচর্চা ও কসমেটিকস সামগ্রী।"}
                            </p>
                          </div>
                          <div className="pt-3 border-t border-stone-800 flex items-center justify-between">
                            <span className="text-[8px] font-mono text-rose-400 uppercase tracking-widest font-bold">100% AUTHENTIC</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
                          </div>
                        </div>

                        {/* Column 2: Makeup & Aesthetics */}
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-bold text-stone-900 tracking-wider font-mono uppercase pb-1.5 border-b border-stone-100 flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-stone-900 animate-pulse"></span>
                            {lang === "en" ? "Cosmetics" : "প্রসাধন"}
                          </h4>
                          <div className="flex flex-col gap-1">
                            {COSMETICS_SUBCATEGORIES.slice(0, 2).map((sub) => {
                              const isSubSelected = selectedCategory === "Cosmetics" && selectedSubCategory === sub.value;
                              return (
                                <button
                                  key={sub.value}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedCategory("Cosmetics");
                                    setSelectedSubCategory(sub.value);
                                    setShowAdminPortal(false);
                                  }}
                                  className={`px-2.5 py-1.5 text-left text-xs font-sans tracking-wide transition-all rounded-sm flex flex-col group/item cursor-pointer ${
                                    isSubSelected
                                      ? "bg-stone-100 text-stone-950 border-l-2 border-stone-900 font-semibold"
                                      : "text-stone-600 hover:text-stone-955 hover:bg-stone-50"
                                  }`}
                                  id={`sub-category-tab-${sub.value.replace(/\s+/g, "-").toLowerCase()}`}
                                >
                                  <span className="font-medium group-hover/item:translate-x-0.5 transition-transform duration-200">{lang === "en" ? sub.labelEn : sub.labelBn}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Column 3: Skin & Hair */}
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-bold text-stone-900 tracking-wider font-mono uppercase pb-1.5 border-b border-stone-100 flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-stone-900 animate-pulse"></span>
                            {lang === "en" ? "Care & Nutrition" : "ত্বক ও চুলের পুষ্টি"}
                          </h4>
                          <div className="flex flex-col gap-1">
                            {COSMETICS_SUBCATEGORIES.slice(2, 4).map((sub) => {
                              const isSubSelected = selectedCategory === "Cosmetics" && selectedSubCategory === sub.value;
                              return (
                                <button
                                  key={sub.value}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedCategory("Cosmetics");
                                    setSelectedSubCategory(sub.value);
                                    setShowAdminPortal(false);
                                  }}
                                  className={`px-2.5 py-1.5 text-left text-xs font-sans tracking-wide transition-all rounded-sm flex flex-col group/item cursor-pointer ${
                                    isSubSelected
                                      ? "bg-stone-100 text-stone-950 border-l-2 border-stone-900 font-semibold"
                                      : "text-stone-600 hover:text-stone-955 hover:bg-stone-50"
                                  }`}
                                  id={`sub-category-tab-${sub.value.replace(/\s+/g, "-").toLowerCase()}`}
                                >
                                  <span className="font-medium group-hover/item:translate-x-0.5 transition-transform duration-200">{lang === "en" ? sub.labelEn : sub.labelBn}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Column 4: Quality Commitment */}
                        <div className="bg-stone-50 border border-stone-200/80 p-3.5 rounded-sm flex flex-col justify-between">
                          <div>
                            <span className="text-[8px] font-mono tracking-widest text-stone-550 font-bold uppercase block mb-1">
                              {lang === "en" ? "Guaranteed" : "নিশ্চয়তা"}
                            </span>
                            <span className="font-display font-medium text-[10px] text-stone-850 uppercase block">
                              {lang === "en" ? "Dermatologist Approved" : "মেডিকেটেড ও পরীক্ষিত"}
                            </span>
                            <p className="text-[9.5px] leading-relaxed text-stone-500 mt-2 font-normal font-sans whitespace-normal">
                              {lang === "en"
                                ? "All self-care products are sourced from authentic brands, ensuring safe pH-balance and premium non-toxic ingredients."
                                : "সকল প্রসাধন সামগ্রী সরাসরি আসল প্রস্তুতকারক থেকে সংগৃহীত এবং পরিবেশ ও ত্বক-বান্ধব গুণগতমান সমৃদ্ধ।"}
                            </p>
                          </div>
                          <div className="text-right pt-2 font-mono text-[8px] text-stone-400">
                            RIEMART COSMETICS
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Simple Dropdown Menu - Mobile/Tablet (opens on group hover / tapping) */}
                    <div className="absolute left-1/3 -translate-x-1/2 top-full block md:hidden hidden group-hover:block bg-white border border-stone-200 shadow-xl rounded-sm py-1.5 z-50 min-w-[210px] text-left animate-studio-reveal border-t-2 border-t-stone-950">
                      <div className="flex flex-col">
                        <div className="px-3 py-1 bg-stone-50 text-[9px] font-bold text-stone-500 border-b border-stone-100 tracking-wider">
                          {lang === "en" ? "COSMETICS SELECTION" : "কসমেটিকস সিলেকশন"}
                        </div>
                        {COSMETICS_SUBCATEGORIES.map((sub) => {
                          const isSubSelected = selectedCategory === "Cosmetics" && selectedSubCategory === sub.value;
                          return (
                            <button
                              key={sub.value}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCategory("Cosmetics");
                                setSelectedSubCategory(sub.value);
                                setShowAdminPortal(false);
                              }}
                              className={`px-4 py-2 text-left text-xs font-sans tracking-wide transition-colors ${
                                isSubSelected
                                  ? "bg-stone-105 text-stone-955 font-bold border-l-2 border-stone-800"
                                  : "text-stone-600 hover:text-stone-955 hover:bg-stone-50"
                              }`}
                            >
                              {lang === "en" ? sub.labelEn : sub.labelBn}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              }

              if (cat === "Baby Care") {
                return (
                  <div
                    key={cat}
                    className="relative group shrink-0 inline-block align-middle md:overflow-visible"
                    id="baby-care-dropdown-container"
                  >
                    <button
                      onClick={() => {
                        setSelectedCategory("Baby Care");
                        setSelectedSubCategory(null);
                        setShowAdminPortal(false);
                      }}
                      className={`px-4 py-3 text-xs tracking-wider transition-all font-sans font-semibold focus:outline-none flex items-center gap-1.5 cursor-pointer rounded-sm ${
                        selectedCategory === "Baby Care" && !showAdminPortal
                          ? "border-b-2 border-stone-950 bg-stone-100/75 text-stone-950 font-bold"
                          : "text-stone-550 border border-transparent hover:text-stone-900 hover:bg-stone-100/50"
                      }`}
                      id="category-tab-baby-care"
                    >
                      <span className="flex items-center gap-1">
                        <span>{label}</span>
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-stone-900 animate-pulse"></span>
                      </span>
                      <ChevronDown className="w-3 h-3 text-stone-500 group-hover:text-stone-900 transition-transform group-hover:rotate-180" />
                    </button>

                    {/* Premium Mega Menu Dropdown - Desktop (opens on group hover) */}
                    <div className="absolute left-1/2 -translate-x-1/2 top-full hidden md:group-hover:block bg-white border border-stone-200 shadow-2xl rounded-sm p-6 z-50 md:w-[720px] lg:w-[820px] text-left animate-studio-reveal border-t-2 border-t-blue-600">
                      <div className="mb-4 pb-2 border-b border-stone-100 flex items-center justify-between">
                        <span className="text-[10px] font-mono text-stone-850 tracking-wider uppercase font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-stone-900 animate-pulse"></span>
                          {lang === "en" ? "Atelier Baby Care" : "অ্যাটেলিয়ার শিশুর যত্ন"}
                        </span>
                        <span className="text-[9px] font-mono text-stone-400 uppercase tracking-widest">
                          RIEMART BABY ESSENTIALS
                        </span>
                      </div>

                      {/* Grid Columns layout */}
                      <div className="grid grid-cols-4 gap-6">
                        {/* Column 1: Featured Brand Column */}
                        <div className="bg-gradient-to-br from-stone-900 via-stone-950 to-stone-950 text-stone-100 p-4.5 rounded-sm flex flex-col justify-between min-h-[220px]">
                          <div>
                            <span className="text-[8px] font-mono tracking-widest text-amber-400 uppercase block mb-1">
                              {lang === "en" ? "Pure & Soft" : "কোমল ও নিরাপদ"}
                            </span>
                            <h4 className="font-display font-medium text-xs text-white tracking-tight uppercase">
                              Baby Essential Narrative
                            </h4>
                            <p className="text-[9.5px] text-stone-300 leading-relaxed mt-2 font-normal font-sans whitespace-normal opacity-90">
                              {lang === "en"
                                ? "Premium baby milk, healthy food, certified pampers, diapers, and gentle skin care essentials for your little ones of ultimate premium quality."
                                : "শিশুর পুষ্টির জন্য ব্র্যান্ডের দুধ, স্বাস্থ্যকর খাবার, নিরাপদ ডায়াপার এবং কোমল ত্বকের যত্নে প্রিমিয়াম মানের বিশ্বস্ত পণ্যসমূহ।"}
                            </p>
                          </div>
                          <div className="pt-3 border-t border-stone-800 flex items-center justify-between">
                            <span className="text-[8px] font-mono text-blue-400 uppercase tracking-widest font-bold">100% SECURE</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                          </div>
                        </div>

                        {/* Column 2: Nutrition & Diet */}
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-bold text-stone-900 tracking-wider font-mono uppercase pb-1.5 border-b border-stone-100 flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-stone-900 animate-pulse"></span>
                            {lang === "en" ? "Nutrition" : "শিশুর পুষ্টি ও খাদ্য"}
                          </h4>
                          <div className="flex flex-col gap-1">
                            {BABY_CARE_SUBCATEGORIES.slice(0, 2).map((sub) => {
                              const isSubSelected = selectedCategory === "Baby Care" && selectedSubCategory === sub.value;
                              return (
                                <button
                                  key={sub.value}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedCategory("Baby Care");
                                    setSelectedSubCategory(sub.value);
                                    setShowAdminPortal(false);
                                  }}
                                  className={`px-2.5 py-1.5 text-left text-xs font-sans tracking-wide transition-all rounded-sm flex flex-col group/item cursor-pointer ${
                                    isSubSelected
                                      ? "bg-stone-100 text-stone-955 border-l-2 border-stone-900 font-semibold"
                                      : "text-stone-600 hover:text-stone-955 hover:bg-stone-50"
                                  }`}
                                  id={`sub-category-tab-${sub.value.replace(/\s+/g, "-").toLowerCase()}`}
                                >
                                  <span className="font-medium group-hover/item:translate-x-0.5 transition-transform duration-200">{lang === "en" ? sub.labelEn : sub.labelBn}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Column 3: Care & Diapers */}
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-bold text-stone-900 tracking-wider font-mono uppercase pb-1.5 border-b border-stone-100 flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-stone-900 animate-pulse"></span>
                            {lang === "en" ? "Care & Diapers" : "যত্ন ও ডায়াপার"}
                          </h4>
                          <div className="flex flex-col gap-1">
                            {BABY_CARE_SUBCATEGORIES.slice(2).map((sub) => {
                              const isSubSelected = selectedCategory === "Baby Care" && selectedSubCategory === sub.value;
                              return (
                                <button
                                  key={sub.value}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedCategory("Baby Care");
                                    setSelectedSubCategory(sub.value);
                                    setShowAdminPortal(false);
                                  }}
                                  className={`px-2.5 py-1.5 text-left text-xs font-sans tracking-wide transition-all rounded-sm flex flex-col group/item cursor-pointer ${
                                    isSubSelected
                                      ? "bg-stone-100 text-stone-955 border-l-2 border-stone-900 font-semibold"
                                      : "text-stone-600 hover:text-stone-955 hover:bg-stone-50"
                                  }`}
                                  id={`sub-category-tab-${sub.value.replace(/\s+/g, "-").toLowerCase()}`}
                                >
                                  <span className="font-medium group-hover/item:translate-x-0.5 transition-transform duration-200">{lang === "en" ? sub.labelEn : sub.labelBn}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Column 4: Sourcing details */}
                        <div className="bg-stone-50 border border-stone-200/80 p-3.5 rounded-sm flex flex-col justify-between">
                          <div>
                            <span className="text-[8px] font-mono tracking-widest text-stone-550 font-bold uppercase block mb-1">
                              {lang === "en" ? "Trustworthy" : "নিরাপত্তা ও ভরসা"}
                            </span>
                            <span className="font-display font-medium text-[10px] text-stone-850 uppercase block">
                              {lang === "en" ? "100% Genuine Care" : "শতভাগ আসল ও নিরাপদ"}
                            </span>
                            <p className="text-[9.5px] leading-relaxed text-stone-500 mt-2 font-normal font-sans whitespace-normal">
                              {lang === "en"
                                ? "All baby products are imported from authentic channels, ensuring absolute hygiene, safety standards, and dermatologist certification."
                                : "সকল শিশুর যত্নের পণ্য সরাসরি অনুমোদিত ও বিশ্বস্ত ডিলার থেকে সংগৃহীত, যা নিশ্চিত করে শতভাগ বিশুদ্ধতা ও সর্বোচ্চ সুরক্ষা।"}
                            </p>
                          </div>
                          <div className="text-right pt-2 font-mono text-[8px] text-stone-400">
                            RIEMART BABY CARE
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Simple Dropdown Menu - Mobile/Tablet (opens on group hover / tapping) */}
                    <div className="absolute left-1/3 -translate-x-1/2 top-full block md:hidden hidden group-hover:block bg-white border border-stone-200 shadow-xl rounded-sm py-1.5 z-50 min-w-[210px] text-left animate-studio-reveal border-t-2 border-t-stone-950">
                      <div className="flex flex-col">
                        <div className="px-3 py-1 bg-stone-50 text-[9px] font-bold text-stone-500 border-b border-stone-100 tracking-wider">
                          {lang === "en" ? "BABY SELECTION" : "শিশুর যত্নের পণ্যসমূহ"}
                        </div>
                        {BABY_CARE_SUBCATEGORIES.map((sub) => {
                          const isSubSelected = selectedCategory === "Baby Care" && selectedSubCategory === sub.value;
                          return (
                            <button
                              key={sub.value}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCategory("Baby Care");
                                setSelectedSubCategory(sub.value);
                                setShowAdminPortal(false);
                              }}
                              className={`px-4 py-2 text-left text-xs font-sans tracking-wide transition-colors ${
                                isSubSelected
                                  ? "bg-stone-105 text-stone-955 font-bold border-l-2 border-stone-800"
                                  : "text-stone-600 hover:text-stone-955 hover:bg-stone-50"
                              }`}
                            >
                              {lang === "en" ? sub.labelEn : sub.labelBn}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <button
                  key={cat}
                  onClick={() => { setSelectedCategory(cat); setSelectedSubCategory(null); setShowAdminPortal(false); }}
                  className={`px-4 py-3 text-xs tracking-wider transition-all font-sans font-medium focus:outline-none shrink-0 ${
                    selectedCategory === cat && !showAdminPortal
                      ? "border-b-2 border-stone-950 font-semibold text-stone-950"
                      : "text-stone-500 hover:text-stone-900 hover:bg-stone-100/50"
                  }`}
                  id={`category-tab-${cat.replace(/\s+/g, "-").toLowerCase()}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sub-category selector bar when "Perfume" is active */}
        {selectedCategory === "Perfume" && !showAdminPortal && (
          <div className="bg-stone-100/80 border-b border-stone-200/60 py-2 animate-studio-reveal">
            <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => setSelectedSubCategory(null)}
                className={`px-3 py-1.5 text-[10px] font-mono tracking-wider transition-all uppercase rounded-sm border cursor-pointer ${
                  selectedSubCategory === null
                    ? "bg-stone-950 text-white border-stone-950"
                    : "bg-white text-stone-600 border-stone-200 hover:border-stone-400 hover:text-stone-900"
                }`}
                id="perfume-sub-category-all"
              >
                {lang === "en" ? "All Perfume" : "সব পারভিউম"}
              </button>
              {PERFUME_SUBCATEGORIES.map((sub) => {
                const isSubSelected = selectedSubCategory === sub.value;
                return (
                   <button
                    key={sub.value}
                    onClick={() => setSelectedSubCategory(sub.value)}
                    className={`px-3 py-1.5 text-[10px] font-mono tracking-wider transition-all uppercase rounded-sm border cursor-pointer ${
                      isSubSelected
                        ? "bg-amber-600 text-stone-50 border-amber-600"
                        : "bg-white text-stone-650 border-stone-200 hover:border-stone-400 hover:text-stone-900"
                    }`}
                    id={`perfume-sub-category-${sub.value.replace(/\s+/g, "-").toLowerCase()}`}
                  >
                    {sub.labelEn}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Sub-category selector bar when "Food & Beverage" is active */}
        {selectedCategory === "Food & Beverage" && !showAdminPortal && (
          <>
            {/* Desktop View Horizontal Pill bar */}
            <div className="hidden md:block bg-emerald-50/50 border-b border-emerald-100/75 py-2.5 animate-studio-reveal overflow-x-auto whitespace-nowrap scrollbar-none">
              <div className="max-w-7xl mx-auto px-4 flex items-center justify-center gap-2 min-w-max">
                <button
                  onClick={() => setSelectedSubCategory(null)}
                  className={`px-3 py-1.5 text-[10px] font-mono tracking-wider transition-all uppercase rounded-sm border cursor-pointer ${
                    selectedSubCategory === null
                      ? "bg-red-600 text-black border-red-800 font-bold shadow-sm"
                      : "bg-white text-stone-600 border-stone-200 hover:border-emerald-300 hover:text-emerald-950"
                  }`}
                  id="fb-sub-category-all"
                >
                  {lang === "en" ? "All Culinary" : "সব খাদ্য ও পানীয়"}
                </button>
                {FOOD_BEVERAGE_SUBCATEGORIES.map((sub) => {
                  const isSubSelected = selectedSubCategory === sub.value;
                  return (
                    <button
                      key={sub.value}
                      onClick={() => setSelectedSubCategory(sub.value)}
                      className={`px-3 py-1.5 text-[10px] font-mono tracking-wider transition-all uppercase rounded-sm border cursor-pointer ${
                        isSubSelected
                          ? "bg-red-600 text-black border-red-800 font-bold animate-pulse shadow-sm"
                          : "bg-white text-stone-600 border-stone-200 hover:border-emerald-300 hover:text-emerald-950"
                      }`}
                      id={`fb-sub-category-${sub.value.replace(/\s+/g, "-").replace(/'/g, "").toLowerCase()}`}
                    >
                      {lang === "en" ? sub.labelEn : sub.labelBn}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mobile View Accordion collapsible layout */}
            <div className="block md:hidden bg-emerald-50/30 border-b border-stone-200 p-4 animate-studio-reveal">
              <div className="max-w-md mx-auto space-y-2.5">
                <div className="flex items-center justify-between pb-2 mb-1 border-b border-emerald-100/40">
                  <span className="text-[10px] font-mono text-emerald-850 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                    {lang === "en" ? "Browse Food Specialties" : "খাদ্য ও পানীয় ক্যাটাগরি ব্রাউজ করুন"}
                  </span>
                  {selectedSubCategory && (
                    <button
                      onClick={() => setSelectedSubCategory(null)}
                      className="text-[9px] font-mono text-emerald-700 hover:text-emerald-955 underline font-bold"
                      id="mobile-fb-clear-subcategory-btn"
                    >
                      {lang === "en" ? "Reset" : "রিসেট"}
                    </button>
                  )}
                </div>

                {/* Accordion 1: Sweets & Pastries */}
                <div className="border border-emerald-100 bg-white rounded-sm overflow-hidden shadow-sm animate-studio-reveal">
                  <button
                    onClick={() => setMobileFbAccordion(mobileFbAccordion === "sweets" ? null : "sweets")}
                    className="w-full px-4 py-3 text-left text-xs font-medium font-sans flex items-center justify-between bg-emerald-50/50 hover:bg-emerald-50 transition-colors"
                  >
                    <span className="text-emerald-900 font-bold flex items-center gap-2">
                      <span>🍫</span>
                      <span>{lang === "en" ? "Sweets & Pastries" : "মিষ্টি ও বেকারি"}</span>
                    </span>
                    <span className="text-emerald-400 font-mono font-bold">
                      {mobileFbAccordion === "sweets" ? "−" : "+"}
                    </span>
                  </button>
                  {mobileFbAccordion === "sweets" && (
                    <div className="p-2.5 bg-stone-50/40 grid grid-cols-2 gap-2 animate-studio-reveal">
                      {FOOD_BEVERAGE_SUBCATEGORIES.filter(sub => ["Chocolate's", "Biscuits", "Bakery Products"].includes(sub.value)).map((sub) => {
                        const isSelected = selectedSubCategory === sub.value;
                        return (
                          <button
                            key={sub.value}
                            onClick={() => setSelectedSubCategory(sub.value)}
                            className={`px-3 py-2 text-left text-xs transition-all border rounded-sm flex flex-col justify-center cursor-pointer ${
                              isSelected
                                ? "bg-red-600 text-black border-red-800 font-bold shadow-sm"
                                : "bg-white text-stone-750 border-stone-200/80 hover:border-emerald-300"
                            }`}
                          >
                            <span className={`text-xs font-semibold ${isSelected ? "text-black" : ""}`}>{lang === "en" ? sub.labelEn : sub.labelBn}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Accordion 2: Dairy & Staples */}
                <div className="border border-emerald-100 bg-white rounded-sm overflow-hidden shadow-sm animate-studio-reveal">
                  <button
                    onClick={() => setMobileFbAccordion(mobileFbAccordion === "dairy" ? null : "dairy")}
                    className="w-full px-4 py-3 text-left text-xs font-medium font-sans flex items-center justify-between bg-emerald-50/50 hover:bg-emerald-50 transition-colors"
                  >
                    <span className="text-emerald-900 font-bold flex items-center gap-2">
                      <span>🧀</span>
                      <span>{lang === "en" ? "Dairy & Staples" : "ডেইরি ও প্যান্ট্রি"}</span>
                    </span>
                    <span className="text-emerald-400 font-mono font-bold">
                      {mobileFbAccordion === "dairy" ? "−" : "+"}
                    </span>
                  </button>
                  {mobileFbAccordion === "dairy" && (
                    <div className="p-2.5 bg-stone-50/40 grid grid-cols-2 gap-2 animate-studio-reveal">
                      {FOOD_BEVERAGE_SUBCATEGORIES.filter(sub => ["Cheese", "Milk", "Oats", "Honey"].includes(sub.value)).map((sub) => {
                        const isSelected = selectedSubCategory === sub.value;
                        return (
                          <button
                            key={sub.value}
                            onClick={() => setSelectedSubCategory(sub.value)}
                            className={`px-3 py-2 text-left text-xs transition-all border rounded-sm flex flex-col justify-center cursor-pointer ${
                              isSelected
                                ? "bg-red-600 text-black border-red-800 font-bold shadow-sm"
                                : "bg-white text-stone-750 border-stone-200/80 hover:border-emerald-300"
                            }`}
                          >
                            <span className={`text-xs font-semibold ${isSelected ? "text-black" : ""}`}>{lang === "en" ? sub.labelEn : sub.labelBn}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Active Subcategory Display Banner */}
                <div className="text-center pt-2 border-t border-emerald-100/20">
                  <span className="text-[10px] font-mono text-stone-500">
                    {lang === "en" ? "Showing: " : "প্রদর্শিত হচ্ছে: "}
                    <span className="font-bold text-emerald-950 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-100/50">
                      {selectedSubCategory 
                        ? FOOD_BEVERAGE_SUBCATEGORIES.find(s => s.value === selectedSubCategory)?.[lang === "en" ? "labelEn" : "labelBn"] 
                        : (lang === "en" ? "All Culinary Selections" : "সকল খাদ্য ও পানীয়")}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Sub-category selector bar when "Cosmetics" is active */}
        {selectedCategory === "Cosmetics" && !showAdminPortal && (
          <>
            {/* Desktop View Horizontal Pill bar */}
            <div className="hidden md:block bg-stone-100/90 border-b border-stone-200/60 py-2.5 animate-studio-reveal overflow-x-auto whitespace-nowrap scrollbar-none">
              <div className="max-w-7xl mx-auto px-4 flex items-center justify-center gap-2 min-w-max">
                <button
                  onClick={() => setSelectedSubCategory(null)}
                  className={`px-3 py-1.5 text-[10px] font-mono tracking-wider transition-all uppercase rounded-sm border cursor-pointer ${
                    selectedSubCategory === null
                      ? "bg-rose-955 text-white border-rose-955 font-bold"
                      : "bg-white text-stone-600 border-stone-200 hover:border-stone-400 hover:text-stone-900"
                  }`}
                  id="cosmetics-sub-category-all"
                >
                  {lang === "en" ? "All Cosmetics" : "সব কসমেটিকস"}
                </button>

                {COSMETICS_SUBCATEGORIES.map((sub) => {
                  const isSubSelected = selectedSubCategory === sub.value;
                  return (
                    <button
                      key={sub.value}
                      onClick={() => setSelectedSubCategory(sub.value)}
                      className={`px-3 py-1.5 text-[10px] font-mono tracking-wider transition-all uppercase rounded-sm border cursor-pointer ${
                        isSubSelected
                          ? "bg-rose-900 text-stone-50 border-rose-900 font-bold animate-pulse"
                          : "bg-white text-stone-600 border-stone-200 hover:border-stone-400 hover:text-stone-900"
                      }`}
                      id={`cosmetics-sub-category-${sub.value.replace(/\s+/g, "-").toLowerCase()}`}
                    >
                      {lang === "en" ? sub.labelEn : sub.labelBn}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mobile View Accordion collapsible layout */}
            <div className="block md:hidden bg-stone-50 border-b border-stone-200 p-4 animate-studio-reveal">
              <div className="max-w-md mx-auto space-y-2.5">
                <div className="flex items-center justify-between pb-2 mb-1 border-b border-stone-200/60">
                  <span className="text-[10px] font-mono text-stone-850 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse"></span>
                    {lang === "en" ? "Browse Cosmetics" : "কসমেটিকস ব্রাউজ করুন"}
                  </span>
                  {selectedSubCategory && (
                    <button
                      onClick={() => setSelectedSubCategory(null)}
                      className="text-[9px] font-mono text-stone-700 hover:text-stone-955 underline font-bold"
                    >
                      {lang === "en" ? "Reset" : "রিসেট"}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 animate-studio-reveal">
                  {COSMETICS_SUBCATEGORIES.map((sub) => {
                    const isSelected = selectedSubCategory === sub.value;
                    return (
                      <button
                        key={sub.value}
                        onClick={() => setSelectedSubCategory(sub.value)}
                        className={`px-3 py-2 text-left text-xs transition-all border rounded-sm flex flex-col justify-center cursor-pointer ${
                          isSelected
                            ? "bg-rose-900 text-white border-rose-900 font-bold shadow-sm"
                            : "bg-white text-stone-750 border-stone-200/80 hover:border-stone-400"
                        }`}
                      >
                        <span className="text-xs font-semibold">{lang === "en" ? sub.labelEn : sub.labelBn}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Active Subcategory Display Banner */}
                <div className="text-center pt-2 border-t border-stone-200/30">
                  <span className="text-[10px] font-mono text-stone-500">
                    {lang === "en" ? "Selected: " : "নির্বাচিত: "}
                    <span className="font-bold text-stone-900 bg-stone-100 px-2.5 py-1 rounded border border-stone-250">
                      {selectedSubCategory
                        ? COSMETICS_SUBCATEGORIES.find(s => s.value === selectedSubCategory)?.[lang === "en" ? "labelEn" : "labelBn"]
                        : (lang === "en" ? "All Cosmetics" : "সকল কসমেটিকস সামগ্রী")}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </>
        )}


        {/* Sub-category selector bar when "Clothing" is active */}
        {selectedCategory === "Clothing" && !showAdminPortal && (
          <>
            {/* Desktop View Horizontal Pill bar */}
            <div className="hidden md:block bg-stone-100/90 border-b border-stone-200/60 py-2.5 animate-studio-reveal overflow-x-auto whitespace-nowrap scrollbar-none">
              <div className="max-w-7xl mx-auto px-4 flex items-center justify-center gap-2 min-w-max">
                <button
                  onClick={() => setSelectedSubCategory(null)}
                  className={`px-3 py-1.5 text-[10px] font-mono tracking-wider transition-all uppercase rounded-sm border cursor-pointer ${
                    selectedSubCategory === null
                      ? "bg-stone-950 text-white border-stone-950 font-bold"
                      : "bg-white text-stone-600 border-stone-200 hover:border-stone-400 hover:text-stone-900"
                  }`}
                  id="clothing-sub-category-all"
                >
                  {lang === "en" ? "All Apparel" : "সব পোশাক"}
                </button>

                {CLOTHING_SUBCATEGORIES.map((sub) => {
                  const isSubSelected = selectedSubCategory === sub.value;
                  return (
                    <button
                      key={sub.value}
                      onClick={() => setSelectedSubCategory(sub.value)}
                      className={`px-3 py-1.5 text-[10px] font-mono tracking-wider transition-all uppercase rounded-sm border cursor-pointer ${
                        isSubSelected
                          ? "bg-stone-900 text-stone-50 border-stone-900 font-bold animate-pulse"
                          : "bg-white text-stone-600 border-stone-200 hover:border-stone-400 hover:text-stone-900"
                      }`}
                      id={`clothing-sub-category-${sub.value.replace(/\s+/g, "-").replace(/'/g, "").toLowerCase()}`}
                    >
                      {lang === "en" ? sub.labelEn : sub.labelBn}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mobile View Accordion collapsible layout */}
            <div className="block md:hidden bg-stone-50 border-b border-stone-200 p-4 animate-studio-reveal">
              <div className="max-w-md mx-auto space-y-2.5">
                <div className="flex items-center justify-between pb-2 mb-1 border-b border-stone-200/60">
                  <span className="text-[10px] font-mono text-stone-850 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-stone-900 animate-pulse"></span>
                    {lang === "en" ? "Browse Clothing Categories" : "পোশাক ক্যাটাগরি ব্রাউজ করুন"}
                  </span>
                  {selectedSubCategory && (
                    <button
                      onClick={() => setSelectedSubCategory(null)}
                      className="text-[9px] font-mono text-stone-700 hover:text-stone-950 underline font-bold"
                      id="mobile-clothing-clear-subcategory-btn"
                    >
                      {lang === "en" ? "Reset" : "রিসেট"}
                    </button>
                  )}
                </div>

                {/* Accordion 1: Men's Clothing */}
                <div className="border border-stone-200 bg-white rounded-sm overflow-hidden shadow-sm animate-studio-reveal">
                  <button
                    onClick={() => setMobileClothingAccordion(mobileClothingAccordion === "men" ? null : "men")}
                    className="w-full px-4 py-3 text-left text-xs font-medium font-sans flex items-center justify-between bg-stone-50 hover:bg-stone-100 transition-colors"
                  >
                    <span className="text-stone-900 font-bold flex items-center gap-2">
                      <span>👔</span>
                      <span>{lang === "en" ? "Men's Clothing" : "ছেলেদের পোশাক"}</span>
                    </span>
                    <span className="text-stone-400 font-mono font-bold">
                      {mobileClothingAccordion === "men" ? "−" : "+"}
                    </span>
                  </button>
                  {mobileClothingAccordion === "men" && (
                    <div className="p-2.5 bg-stone-50/40 grid grid-cols-2 gap-2 animate-studio-reveal">
                      {CLOTHING_SUBCATEGORIES.filter(sub => sub.gender === "men").map((sub) => {
                        const isSelected = selectedSubCategory === sub.value;
                        return (
                          <button
                            key={sub.value}
                            onClick={() => setSelectedSubCategory(sub.value)}
                            className={`px-3 py-2 text-left text-xs transition-all border rounded-sm flex flex-col justify-center cursor-pointer ${
                              isSelected
                                ? "bg-stone-900 text-white border-stone-900 font-bold shadow-sm"
                                : "bg-white text-stone-750 border-stone-200/80 hover:border-stone-400"
                            }`}
                          >
                            <span className="text-xs font-semibold">{lang === "en" ? sub.labelEn : sub.labelBn}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Accordion 2: Women's Clothing */}
                <div className="border border-stone-200 bg-white rounded-sm overflow-hidden shadow-sm animate-studio-reveal">
                  <button
                    onClick={() => setMobileClothingAccordion(mobileClothingAccordion === "women" ? null : "women")}
                    className="w-full px-4 py-3 text-left text-xs font-medium font-sans flex items-center justify-between bg-stone-50 hover:bg-stone-100 transition-colors"
                  >
                    <span className="text-stone-900 font-bold flex items-center gap-2">
                      <span>👗</span>
                      <span>{lang === "en" ? "Women's Clothing" : "মেয়েদের পোশাক"}</span>
                    </span>
                    <span className="text-stone-400 font-mono font-bold">
                      {mobileClothingAccordion === "women" ? "−" : "+"}
                    </span>
                  </button>
                  {mobileClothingAccordion === "women" && (
                    <div className="p-2.5 bg-stone-50/40 grid grid-cols-2 gap-2 animate-studio-reveal">
                      {CLOTHING_SUBCATEGORIES.filter(sub => sub.gender === "women").map((sub) => {
                        const isSelected = selectedSubCategory === sub.value;
                        return (
                          <button
                            key={sub.value}
                            onClick={() => setSelectedSubCategory(sub.value)}
                            className={`px-3 py-2 text-left text-xs transition-all border rounded-sm flex flex-col justify-center cursor-pointer ${
                              isSelected
                                ? "bg-stone-900 text-white border-stone-900 font-bold shadow-sm"
                                : "bg-white text-stone-750 border-stone-200/80 hover:border-stone-400"
                            }`}
                          >
                            <span className="text-xs font-semibold">{lang === "en" ? sub.labelEn : sub.labelBn}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Active Subcategory Display Banner */}
                <div className="text-center pt-2 border-t border-stone-200/30">
                  <span className="text-[10px] font-mono text-stone-500">
                    {lang === "en" ? "Selected: " : "নির্বাচিত: "}
                    <span className="font-bold text-stone-900 bg-stone-100 px-2.5 py-1 rounded border border-stone-250">
                      {selectedSubCategory 
                        ? CLOTHING_SUBCATEGORIES.find(s => s.value === selectedSubCategory)?.[lang === "en" ? "labelEn" : "labelBn"] 
                        : (lang === "en" ? "All Apparels" : "সকল পোশাক সামগ্রী")}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Sub-category selector bar when "Baby Care" is active */}
        {selectedCategory === "Baby Care" && !showAdminPortal && (
          <>
            {/* Desktop View Horizontal Pill bar */}
            <div className="hidden md:block bg-stone-100/90 border-b border-stone-200/60 py-2.5 animate-studio-reveal overflow-x-auto whitespace-nowrap scrollbar-none">
              <div className="max-w-7xl mx-auto px-4 flex items-center justify-center gap-2 min-w-max">
                <button
                  onClick={() => setSelectedSubCategory(null)}
                  className={`px-3 py-1.5 text-[10px] font-mono tracking-wider transition-all uppercase rounded-sm border cursor-pointer ${
                    selectedSubCategory === null
                      ? "bg-blue-955 text-white border-blue-955 font-bold"
                      : "bg-white text-stone-600 border-stone-200 hover:border-stone-400 hover:text-stone-900"
                  }`}
                  id="baby-care-sub-category-all"
                >
                  {lang === "en" ? "All Baby Care" : "সব শিশুর যত্ন"}
                </button>

                {BABY_CARE_SUBCATEGORIES.map((sub) => {
                  const isSubSelected = selectedSubCategory === sub.value;
                  return (
                    <button
                      key={sub.value}
                      onClick={() => setSelectedSubCategory(sub.value)}
                      className={`px-3 py-1.5 text-[10px] font-mono tracking-wider transition-all uppercase rounded-sm border cursor-pointer ${
                        isSubSelected
                          ? "bg-blue-900 text-stone-50 border-blue-900 font-bold animate-pulse"
                          : "bg-white text-stone-600 border-stone-200 hover:border-stone-400 hover:text-stone-900"
                      }`}
                      id={`baby-care-sub-category-${sub.value.replace(/\s+/g, "-").toLowerCase()}`}
                    >
                      {lang === "en" ? sub.labelEn : sub.labelBn}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mobile View Accordion collapsible layout */}
            <div className="block md:hidden bg-stone-50 border-b border-stone-200 p-4 animate-studio-reveal">
              <div className="max-w-md mx-auto space-y-2.5">
                <div className="flex items-center justify-between pb-2 mb-1 border-b border-stone-200/60">
                  <span className="text-[10px] font-mono text-stone-850 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                    {lang === "en" ? "Browse Baby Products" : "শিশুর পণ্য ব্রাউজ করুন"}
                  </span>
                  {selectedSubCategory && (
                    <button
                      onClick={() => setSelectedSubCategory(null)}
                      className="text-[9px] font-mono text-stone-700 hover:text-stone-955 underline font-bold"
                    >
                      {lang === "en" ? "Reset" : "রিসেট"}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 animate-studio-reveal">
                  {BABY_CARE_SUBCATEGORIES.map((sub) => {
                    const isSelected = selectedSubCategory === sub.value;
                    return (
                      <button
                        key={sub.value}
                        onClick={() => setSelectedSubCategory(sub.value)}
                        className={`px-3 py-2 text-left text-xs transition-all border rounded-sm flex flex-col justify-center cursor-pointer ${
                          isSelected
                            ? "bg-blue-900 text-white border-blue-900 font-bold shadow-sm"
                            : "bg-white text-stone-750 border-stone-200/80 hover:border-stone-400"
                        }`}
                      >
                        <span className="text-xs font-semibold">{lang === "en" ? sub.labelEn : sub.labelBn}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Active Subcategory Display Banner */}
                <div className="text-center pt-2 border-t border-stone-200/30">
                  <span className="text-[10px] font-mono text-stone-500">
                    {lang === "en" ? "Selected: " : "নির্বাচিত: "}
                    <span className="font-bold text-stone-900 bg-stone-100 px-2.5 py-1 rounded border border-stone-250">
                      {selectedSubCategory
                        ? BABY_CARE_SUBCATEGORIES.find(s => s.value === selectedSubCategory)?.[lang === "en" ? "labelEn" : "labelBn"]
                        : (lang === "en" ? "All Baby Care" : "সকল শিশুর যত্নের সামগ্রী")}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

      {/* Checkouts & Direct Order Dispatch Status Alerts */}
      {checkoutNotification && (
        <div className="bg-stone-900 text-stone-50 border-t-2 border-amber-500 animate-studio-reveal print:hidden" id="checkout-notification-banner">
          <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
              <p className="text-sm tracking-wide font-mono">{checkoutNotification}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {lastPlacedOrder && (
                <a
                  href={isInsideIframe ? getPrintUrl(lastPlacedOrder.id) : "#"}
                  target={isInsideIframe ? "_blank" : undefined}
                  onClick={isInsideIframe ? undefined : (e) => { e.preventDefault(); setPrintingOrder(lastPlacedOrder); }}
                  className="bg-amber-600 hover:bg-amber-700 hover:scale-103 active:scale-97 text-stone-50 text-xs font-mono font-bold px-3 py-1 rounded transition-all flex items-center gap-1 uppercase select-none cursor-pointer inline-flex items-center"
                  id="checkout-notification-print"
                >
                  <Printer className="w-3.5 h-3.5" />
                  {lang === "en" ? "Print Receipt" : "রসিদ প্রিন্ট করুন"}
                </a>
              )}
              <button
                onClick={() => setCheckoutNotification(null)}
                className="text-stone-400 hover:text-white text-xs font-mono border border-stone-750 px-3 py-1 rounded transition-colors"
                id="checkout-notification-close"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Primary Application Layout Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 animate-studio-reveal print:hidden">
        {showAdminPortal ? (
          
          /* ==================== ADMIN SECURITY PORTAL AREA ==================== */
          <div className="animate-admin-reveal">
            {!isAdminAuthorized ? (
              <AdminLoginArea
                lang={lang}
                correctPassphraseHash={settings.passphraseHash}
                onSuccess={() => {
                  setIsAdminAuthorized(true);
                  setAdminError(null);
                  addSystemLog(
                    "security",
                    "Administrative session cryptographically unlocked via secure token challenge",
                    "প্রশাসনিক সেশন সিকিউরিটি চ্যালেঞ্জের মাধ্যমে সফলভাবে আনলক করা হয়েছে"
                  );
                }}
                onFailure={(msg) => {
                  setAdminError(msg);
                  addSystemLog(
                    "warning",
                    "Unauthorized administrative access attempt with incorrect passphrase credentials",
                    "ভুল পাসফ্রেজ দিয়ে অননুমোদিত প্রশাসনিক অ্যাক্সেসের চেষ্টা"
                  );
                }}
                adminError={adminError}
                DICTIONARY={DICTIONARY}
              />
            ) : (
              
              /* ==================== ATELIER CONTROL ROOM DASHBOARD ==================== */
              <div 
                onClickCapture={handleAdminPanelClick}
                className="relative space-y-10 admin-black-green-theme bg-black p-4 sm:p-6 rounded-md border border-green-500/20" 
                id="atelier-control-room-dashboard"
              >
                
                {/* Dashboard Authorization Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-stone-900 text-white p-6 rounded-sm border border-stone-850 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <h2 className="font-display font-medium tracking-widest text-lg text-white uppercase">
                        {DICTIONARY[lang].controlRoom}
                      </h2>
                    </div>
                    <p className="text-[10px] font-mono text-stone-400 tracking-wider">
                      {DICTIONARY[lang].adminStatus} | OPERATOR: {lang === "en" ? "Atelier Chief Architect" : "প্রধান কারিগর"} 
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setAdminSubView("dashboard")}
                      className={`px-3.5 py-2 text-xs font-mono uppercase tracking-widest rounded transition-all cursor-pointer ${
                        adminSubView === "dashboard"
                          ? "bg-amber-500 text-stone-950 font-bold shadow-sm"
                          : "border border-stone-700 bg-stone-850 hover:bg-stone-755 text-stone-300 hover:text-white"
                      }`}
                      id="control-room-dashboard-btn"
                    >
                      {lang === "en" ? "Dashboard" : "ড্যাশবোর্ড"}
                    </button>
                    <button
                      onClick={() => setAdminSubView("customers")}
                      className={`px-3.5 py-2 text-xs font-mono uppercase tracking-widest rounded transition-all cursor-pointer ${
                        adminSubView === "customers"
                          ? "bg-amber-500 text-stone-950 font-bold shadow-sm"
                          : "border border-stone-700 bg-stone-850 hover:bg-stone-755 text-stone-300 hover:text-white"
                      }`}
                      id="control-room-customers-btn"
                    >
                      {lang === "en" ? "Customers" : "গ্রাহক তালিকা"} ({registeredUsers.length})
                    </button>
                    <button
                      onClick={() => setAdminSubView("qr_generator")}
                      className={`px-3.5 py-2 text-xs font-mono uppercase tracking-widest rounded transition-all cursor-pointer ${
                        adminSubView === "qr_generator"
                          ? "bg-amber-500 text-stone-950 font-bold shadow-sm"
                          : "border border-stone-700 bg-stone-850 hover:bg-stone-755 text-stone-300 hover:text-white"
                      }`}
                      id="control-room-qr-generator-btn"
                    >
                      <span className="flex items-center gap-1.5">
                        <QrCode className="w-3.5 h-3.5" />
                        {lang === "en" ? "Store Qr Stamp" : "কাস্টমার কিউআর"}
                      </span>
                    </button>
                    <button
                      onClick={() => setAdminSubView("inventory_report")}
                      className={`px-3.5 py-2 text-xs font-mono uppercase tracking-widest rounded transition-all cursor-pointer ${
                        adminSubView === "inventory_report"
                          ? "bg-amber-500 text-stone-950 font-bold shadow-sm"
                          : "border border-stone-700 bg-stone-850 hover:bg-stone-755 text-stone-300 hover:text-white"
                      }`}
                      id="control-room-inventory-report-btn"
                    >
                      <span className="flex items-center gap-1.5">
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        {lang === "en" ? "Inventory & Print" : "ইনভেন্টরি ও প্রিন্ট"}
                      </span>
                    </button>
                    <button
                      onClick={() => setAdminSubView("delivery_settings")}
                      className={`px-3.5 py-2 text-xs font-mono uppercase tracking-widest rounded transition-all cursor-pointer ${
                        adminSubView === "delivery_settings"
                          ? "bg-blue-600 text-white font-bold shadow-sm"
                          : "border border-stone-700 bg-stone-850 hover:bg-stone-755 text-stone-300 hover:text-white"
                      }`}
                      id="control-room-delivery-settings-btn"
                    >
                      <span className="flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5" />
                        {lang === "en" ? "Delivery Settings" : "ডেলিভারি সেটিংস"}
                      </span>
                    </button>
                    <button
                      onClick={() => setAdminSubView("gdrive")}
                      className={`px-3.5 py-2 text-xs font-mono uppercase tracking-widest rounded transition-all cursor-pointer ${
                        adminSubView === "gdrive"
                          ? "bg-amber-500 text-stone-950 font-bold shadow-sm"
                          : "border border-stone-700 bg-stone-850 hover:bg-stone-755 text-stone-300 hover:text-white"
                      }`}
                      id="control-room-gdrive-sync-btn"
                    >
                      <span className="flex items-center gap-1.5">
                        <Cloud className="w-3.5 h-3.5" />
                        {lang === "en" ? "Google Drive" : "গুগল ড্রাইভ"}
                      </span>
                    </button>
                    <button
                      onClick={() => setShowAdminPortal(false)}
                      className="border border-stone-700 bg-stone-850 hover:bg-stone-755 text-stone-300 hover:text-white px-3.5 py-2 text-xs font-mono uppercase tracking-widest rounded cursor-pointer"
                      id="control-room-exit-btn"
                    >
                      {lang === "en" ? "Storefront" : "স্টোরফ্রেমে ফিরুন"}
                    </button>
                    <button
                      onClick={handleAdminLogout}
                      className="bg-red-655 hover:bg-red-700 text-white px-3.5 py-2 text-xs font-mono uppercase tracking-widest rounded cursor-pointer"
                      id="control-room-seal-btn"
                    >
                      {DICTIONARY[lang].adminLogout}
                    </button>
                  </div>
                </div>

                {adminSubView === "dashboard" ? (
                  <>
                    {/* Atelier Statistics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                  
                  <div 
                    onClick={() => {
                      setAdminOrderStatusFilter("Completed");
                      setTimeout(() => {
                        const elem = document.getElementById("admin-orders-queue");
                        if (elem) {
                          elem.scrollIntoView({ behavior: "smooth" });
                          elem.classList.add("ring-2", "ring-amber-500", "transition-all", "duration-500");
                          setTimeout(() => elem.classList.remove("ring-2", "ring-amber-500"), 2000);
                        }
                      }, 50);
                    }}
                    className="bg-white border border-stone-200 p-5 rounded-sm flex items-center justify-between cursor-pointer hover:shadow-md hover:bg-stone-50 transition-all duration-200 group active:scale-[0.98]"
                    id="admin-stats-total-sales-card"
                    title={lang === "en" ? "Click to view completed sales" : "সম্পূর্ণ বিক্রয় দেখতে এখানে ক্লিক করুন"}
                  >
                    <div>
                      <span className="text-[10px] font-mono text-stone-400 uppercase tracking-widest group-hover:text-stone-605 transition-colors">{DICTIONARY[lang].totalSales}</span>
                      <h3 className="font-display font-semibold text-2xl text-stone-950 mt-1">
                        {formatPrice(totalSalesAllTime)}
                      </h3>
                      <p className="text-[10px] text-stone-400 font-mono mt-1 group-hover:text-stone-500 transition-colors">
                        {lang === "en" ? "Click to inspect completed orders" : "সম্পূর্ণ পেমেন্ট করা অর্ডারসমূহ দেখতে চাপুন"}
                      </p>
                    </div>
                    <div className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center text-stone-600 group-hover:scale-110 transition-transform">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                  </div>

                  <div 
                    onClick={() => {
                      setAdminOrderStatusFilter("All");
                      setTimeout(() => {
                        const elem = document.getElementById("admin-orders-queue");
                        if (elem) {
                          elem.scrollIntoView({ behavior: "smooth" });
                          elem.classList.add("ring-2", "ring-amber-500", "transition-all", "duration-500");
                          setTimeout(() => elem.classList.remove("ring-2", "ring-amber-500"), 2000);
                        }
                      }, 50);
                    }}
                    className={`p-5 rounded-sm flex items-center justify-between border relative cursor-pointer hover:shadow-md transition-all duration-200 group active:scale-[0.98] ${
                      pendingOrdersCount > 0
                        ? "bg-amber-50/40 border-amber-300 shadow-xs hover:bg-amber-50"
                        : "bg-white border-stone-200 hover:bg-stone-50"
                    }`}
                    id="admin-stats-total-orders-card"
                    title={lang === "en" ? "Click to view and filter orders" : "অর্ডার দেখতে এখানে ক্লিক করুন"}
                  >
                    <div>
                      <span className="text-[10px] font-mono text-stone-400 uppercase tracking-widest group-hover:text-stone-600 transition-colors">{DICTIONARY[lang].totalOrders}</span>
                      <h3 className="font-display font-semibold text-2xl text-stone-950 mt-1 flex items-center gap-2">
                        {orders.length}
                        {pendingOrdersCount > 0 && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setAdminOrderStatusFilter("Pending");
                              setTimeout(() => {
                                const elem = document.getElementById("admin-orders-queue");
                                if (elem) {
                                  elem.scrollIntoView({ behavior: "smooth" });
                                  elem.classList.add("ring-2", "ring-emerald-500", "transition-all", "duration-500");
                                  setTimeout(() => elem.classList.remove("ring-2", "ring-emerald-500"), 2000);
                                }
                              }, 50);
                            }}
                            className="bg-rose-600 hover:bg-rose-700 text-white text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border-none cursor-pointer transition-colors"
                            title={lang === "en" ? "Filter by Pending orders" : "পেন্ডিং অর্ডার ফিল্টার করুন"}
                          >
                            {pendingOrdersCount} {lang === "en" ? "Pending" : "পেন্ডিং"}
                          </button>
                        )}
                      </h3>
                      <p className="text-[10px] text-stone-400 font-mono mt-1 group-hover:text-stone-500 transition-colors">
                        {lang === "en" ? "Click to inspect direct orders queue" : "ডিটেইলস দেখতে এখানে ট্যাপ করুন"}
                      </p>
                    </div>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-stone-600 group-hover:scale-110 transition-transform ${
                      pendingOrdersCount > 0 ? "bg-amber-100 animate-bounce" : "bg-stone-100"
                    }`}>
                      <FileText className="w-5 h-5 text-stone-700" />
                    </div>
                  </div>

                  <div className="bg-white border border-stone-200 p-5 rounded-sm flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono text-stone-400 uppercase tracking-widest">{DICTIONARY[lang].activeItems}</span>
                      <h3 className="font-display font-semibold text-2xl text-stone-950 mt-1">
                        {products.length}
                      </h3>
                      <p className="text-[10px] text-stone-400 font-mono mt-1">Active items registered</p>
                    </div>
                    <div className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center text-stone-600">
                      <Sliders className="w-5 h-5" />
                    </div>
                  </div>

                  {/* QR code interaction and Scan metrics card */}
                  <div 
                    onClick={() => {
                      setAdminSubView("qr_generator");
                      setTimeout(() => {
                        const elem = document.getElementById("control-room-qr-generator-btn");
                        if (elem) elem.scrollIntoView({ behavior: "smooth" });
                      }, 50);
                    }}
                    className="bg-stone-900 border border-stone-850 p-5 rounded-sm flex items-center justify-between cursor-pointer hover:bg-stone-950 hover:shadow-md transition-all duration-200 group active:scale-[0.98]"
                    id="admin-stats-qr-metrics-card"
                    title={lang === "en" ? "Click to customize store QR stamps" : "স্টোর কিউআর স্ট্যাম্প তৈরি করুন"}
                  >
                    <div>
                      <span className="text-[10px] font-mono text-amber-500 uppercase tracking-widest group-hover:text-amber-400 transition-colors">
                        {lang === "en" ? "QR Interactions" : "কিউআর এনগেজমেন্ট"}
                      </span>
                      <div className="flex items-baseline gap-1.5 mt-1">
                        <span className="font-display font-semibold text-2xl text-white">
                          {qrStats.scanned}
                        </span>
                        <span className="text-stone-400 font-mono text-[9px]">
                          {lang === "en" ? "scans" : "স্ক্যান"}
                        </span>
                        <span className="text-stone-600 font-mono mx-1">/</span>
                        <span className="font-display font-semibold text-lg text-stone-300">
                          {qrStats.generated}
                        </span>
                        <span className="text-stone-400 font-mono text-[9px]">
                          {lang === "en" ? "gens" : "তৈরি"}
                        </span>
                      </div>
                      <p className="text-[10px] text-stone-400 font-mono mt-1.5 leading-relaxed group-hover:text-stone-300 transition-colors">
                        {lang === "en" ? "Interactive scan counts of published URLs" : "পাবলিশড লিংকের রিয়েল-টাইম স্ক্যান ও শেয়ার"}
                      </p>
                    </div>
                    <div className="w-10 h-10 bg-stone-800 rounded-full flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                      <QrCode className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="bg-white border border-stone-200 p-5 rounded-sm flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono text-stone-400 uppercase tracking-widest">{DICTIONARY[lang].activeStaffName}</span>
                      <h3 className="font-display font-semibold text-lg text-stone-900 truncate mt-1">
                        {lang === "en" ? "Atelier Principal" : "মূখ্য ব্যবস্থাপক"}
                      </h3>
                      <p className="text-[10px] text-stone-400 font-mono mt-1">Client region IP verified</p>
                    </div>
                    <div className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center text-stone-600">
                      <Activity className="w-5 h-5" />
                    </div>
                  </div>

                </div>
 
                {/* PRODUCT BULK UPLOAD & SYNCHRONIZATION MONITOR */}
                <div className="bg-stone-900 border border-stone-800 rounded-sm p-5 space-y-4 shadow-xl">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-stone-800 pb-3">
                    <div>
                      <h3 className="font-display font-semibold text-amber-500 uppercase tracking-widest text-xs flex items-center gap-1.55">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                        {lang === "en" ? "Bulk Upload & Cloud Sync Monitor" : "বাল্ক আপলোড ও ক্লাউড সিঙ্ক মনিটর"}
                      </h3>
                      <p className="text-[10px] text-stone-400 font-sans mt-0.5">
                        {lang === "en" 
                          ? "Real-time queue tracking of concurrent product uploads, data syncs, and automatic retries." 
                          : "একইসময়ে একাধিক প্রোডাক্ট আপলোড, ডাটা সিঙ্ক ও অটো-রিট্রাই ট্র্যাকিং ব্যবস্থা।"}
                      </p>
                    </div>
                    {syncLogs.length > 0 && (
                      <button 
                        onClick={() => setSyncLogs([])}
                        className="text-[9px] font-mono text-stone-500 hover:text-stone-300 transition-colors uppercase border border-stone-800 hover:border-stone-700 px-2 py-0.5 rounded"
                      >
                        {lang === "en" ? "Clear Logs" : "লগ পরিষ্কার করুন"}
                      </button>
                    )}
                  </div>

                  {syncLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
                      <div className="text-stone-600 font-mono text-xs">●</div>
                      <p className="text-stone-500 text-[10px] font-mono">
                        {lang === "en" 
                          ? "Database connections healthy. Ready for consecutive/simultaneous bulk product uploads." 
                          : "ডাটাবেজ কানেকশন স্বাভাবিক। পর্যায়ক্রমিক বা একসাথে বাল্ক প্রোডাক্ট আপলোডের জন্য প্রস্তুত।"}
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-[160px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                      {syncLogs.map((log) => {
                        const isSuccess = log.status === "success";
                        const isFailure = log.status === "failure";
                        const isPending = log.status === "pending";

                        return (
                          <div 
                            key={log.id} 
                            className={`p-3 rounded-sm border text-[11px] font-mono flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-all ${
                              isSuccess ? "bg-emerald-950/20 border-emerald-500/20 text-emerald-400" :
                              isFailure ? "bg-red-950/20 border-red-500/20 text-red-100" :
                              "bg-amber-950/20 border-amber-500/20 text-amber-400"
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              <span className="text-[10px] text-stone-500 mt-0.5">[{log.time}]</span>
                              <div className="space-y-0.5 text-left">
                                <div className="flex items-center gap-2">
                                  <span className={`uppercase font-bold text-[9px] px-1 rounded ${
                                    isSuccess ? "bg-emerald-500/10 text-emerald-300" :
                                    isFailure ? "bg-red-500/10 text-red-350" :
                                    "bg-amber-500/10 text-amber-300"
                                  }`}>
                                    {log.key} / {log.action}
                                  </span>
                                  {log.retryCount > 0 && (
                                    <span className="text-[9px] bg-amber-500/10 text-amber-300 px-1 rounded">
                                      {lang === "en" ? `Retry ${log.retryCount}/5` : `পুনঃচেষ্টা ${log.retryCount}/৫`}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-stone-300">{log.message}</p>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider self-end sm:self-auto">
                              {isSuccess && "✓ Success"}
                              {isFailure && "✖ Failed"}
                              {isPending && "⏳ Syncing"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ATELIER DATA ANALYTICAL DASHBOARD WITH RECHARTS */}
                <div className="bg-white border border-stone-200 rounded-sm shadow-sm p-6 space-y-6" id="atelier-analytical-charts-deck">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-stone-100 pb-4 gap-2">
                    <div>
                      <h3 className="font-display font-medium text-stone-950 uppercase tracking-wider text-sm sm:text-base flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4 text-amber-500" />
                        {lang === "en" ? "Live Performance Analytics" : "লাইভ পারফরম্যান্স অ্যানালিটিক্স"}
                      </h3>
                      <p className="text-[11px] text-stone-400">
                        {lang === "en" 
                          ? "Real-time monetary indexes, order rates, and catalog category dominance chartings." 
                          : "বাস্তব সময়ের আয়ের প্রবাহ, অর্ডারের অনুপাত এবং ক্যাটাগরিভিত্তিক ক্রয় বিশ্লেষণ।"}
                      </p>
                    </div>
                    <div className="bg-stone-50 border border-stone-200 px-3 py-1 rounded-sm text-[10px] font-mono text-stone-600 flex items-center gap-1.5 uppercase font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {lang === "en" ? "Status: Live Syncing" : "অবস্থা: লাইভ সিঙ্ক"}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Area Chart: Monthly Sales Volume */}
                    <div className="lg:col-span-7 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-sans font-semibold text-[10px] sm:text-xs text-stone-700 uppercase tracking-widest flex items-center gap-1.5">
                          <span>📈</span>
                          {lang === "en" ? "Monthly Sales Trend (BDT)" : "মাসিক বিক্রয়ের ধারা (টাকা)"}
                        </h4>
                        <span className="text-[9px] text-stone-400 font-mono">Last 6 Months</span>
                      </div>
                      <div className="h-[250px] w-full" id="monthly-sales-chart-container">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={monthlySalesData}
                            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                          >
                            <defs>
                              <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#d97706" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#d97706" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
                            <XAxis 
                              dataKey="month" 
                              tick={{ fontSize: 9, fontFamily: 'monospace', fill: '#78716c' }}
                              axisLine={{ stroke: '#e7e5e4' }}
                              tickLine={{ stroke: '#e7e5e4' }}
                            />
                            <YAxis 
                              tick={{ fontSize: 9, fontFamily: 'monospace', fill: '#78716c' }}
                              axisLine={{ stroke: '#e7e5e4' }}
                              tickLine={{ stroke: '#e7e5e4' }}
                            />
                            <RechartsTooltip 
                              contentStyle={{ 
                                background: '#1c1917', 
                                border: 'none', 
                                borderRadius: '2px',
                                fontSize: '10px',
                                fontFamily: 'monospace',
                                color: '#fff'
                              }}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="sales" 
                              stroke="#d97706" 
                              strokeWidth={2}
                              fillOpacity={1} 
                              fill="url(#colorSales)" 
                              name={lang === "en" ? "Sales (BDT)" : "বিক্রি (টাকা)"}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Bar Chart: Category Popularity Matrix */}
                    <div className="lg:col-span-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-sans font-semibold text-[10px] sm:text-xs text-stone-700 uppercase tracking-widest flex items-center gap-1.5">
                          <span>🛍️</span>
                          {lang === "en" ? "Category Sales Weight" : "ক্যাটাগরি ভিত্তিক বিক্রয়"}
                        </h4>
                        <span className="text-[9px] text-stone-400 font-mono">Catalog Dominance</span>
                      </div>
                      <div className="h-[250px] w-full" id="category-dominance-chart-container">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={categoryPopularityData.slice(0, 5)} // top 5 categories
                            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
                            <XAxis 
                              dataKey="name" 
                              tick={{ fontSize: 8, fill: '#78716c' }}
                              axisLine={{ stroke: '#e7e5e4' }}
                              tickLine={{ stroke: '#e7e5e4' }}
                            />
                            <YAxis 
                              tick={{ fontSize: 9, fontFamily: 'monospace', fill: '#78716c' }}
                              axisLine={{ stroke: '#e7e5e4' }}
                              tickLine={{ stroke: '#e7e5e4' }}
                            />
                            <RechartsTooltip 
                              contentStyle={{ 
                                background: '#1c1917', 
                                border: 'none', 
                                borderRadius: '2px',
                                fontSize: '10px',
                                fontFamily: 'monospace',
                                color: '#fff'
                              }}
                            />
                            <Bar 
                              dataKey="sales" 
                              fill="#1c1917" 
                              radius={[2, 2, 0, 0]} 
                              name={lang === "en" ? "Sales (BDT)" : "বিক্রি (টাকা)"}
                              barSize={32}
                            >
                              {categoryPopularityData.slice(0, 5).map((entry, index) => (
                                <Cell 
                                  key={`cell-${index}`} 
                                  fill={index === 0 ? "#78350f" : index === 1 ? "#d97706" : index === 2 ? "#b45309" : "#44403c"} 
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main Control Grid: Managing Products and Settings */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  
                  {/* Left Column: Product Matrix & Creative Generator Form (7 cols) */}
                  <div className="lg:col-span-7 space-y-6">
                    {adminSuccessNotification && (
                      <div className="bg-emerald-50 border-2 border-emerald-500/80 p-4 rounded-sm flex items-start gap-3 relative shadow-md animate-studio-reveal" id="admin-success-banner-alert">
                        <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div className="flex-1 space-y-1 text-xs">
                          <p className="font-bold text-emerald-950 uppercase tracking-wider font-mono">
                            {lang === "en" ? "Catalog Sync Active" : "ক্যাটালগ সিঙ্ক সফল"}
                          </p>
                          <p className="text-stone-700 leading-relaxed font-sans">
                            {lang === "en" ? adminSuccessNotification.messageEn : adminSuccessNotification.messageBn}
                          </p>
                        </div>
                        <button
                          onClick={() => setAdminSuccessNotification(null)}
                          className="text-stone-400 hover:text-stone-900 font-bold text-sm leading-none p-1 rounded-sm hover:bg-emerald-100"
                          title="Dismiss notice"
                          type="button"
                        >
                          ×
                        </button>
                      </div>
                    )}

                    <div className="bg-white border border-stone-200 rounded-sm shadow-sm p-6 space-y-6">
                      <div className="flex justify-center items-center border-b border-stone-100 pb-4 w-full">
                        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center w-full max-w-2xl mx-auto">
                          <button
                            type="button"
                            onClick={exportInventoryToCSV}
                            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-mono font-medium tracking-wider px-4 py-2 flex items-center justify-center gap-1.5 rounded-sm transition-colors cursor-pointer shadow-sm border border-amber-500 w-full sm:w-auto"
                            id="export-inventory-csv"
                            title="Export current stock as CSV"
                          >
                            <Download className="w-4 h-4 animate-bounce" />
                            {lang === "en" ? "Export Stock (CSV)" : "ইনভেন্টরি এক্সপোর্ট"}
                          </button>

                          <button
                            type="button"
                            onClick={handleBulkSKUGenerate}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-mono font-medium tracking-wider px-4 py-2 flex items-center justify-center gap-1.5 rounded-sm transition-colors cursor-pointer shadow-sm border border-emerald-500 w-full sm:w-auto"
                            id="bulk-sku-generator-trigger"
                            title="Generate standardized SKU codes automatically for products missing them"
                          >
                            <Sparkles className="w-4 h-4 text-emerald-100" />
                            {lang === "en" ? "Generate SKUs" : "বাল্ক SKU জেনারেটর"}
                          </button>

                          <button
                            onClick={() => {
                              setIsCreatingProduct(true);
                              setEditingProductId(null);
                              setProductBuffer({
                                sku: "",
                                nameEn: "",
                                nameBn: "",
                                category: (catalogCategory !== "All" ? catalogCategory : "Perfume") as Category,
                                price: 65,
                                image: "",
                                descriptionEn: "",
                                descriptionBn: "",
                                inventory: 15,
                                offers: false,
                                specificationsEn: ["Genuine quality ensured"],
                                specificationsBn: ["গুণগতমান নিশ্চিত করা হয়েছে"]
                              });
                              setTimeout(() => {
                                const el = document.getElementById("catalog-matrix-editor-form");
                                if (el) {
                                  el.scrollIntoView({ behavior: "smooth" });
                                }
                              }, 150);
                            }}
                            className="bg-stone-950 hover:bg-stone-900 text-white text-xs font-mono font-medium tracking-wider px-4 py-2 flex items-center justify-center gap-1.5 rounded-sm transition-colors cursor-pointer w-full sm:w-auto border border-stone-800"
                            id="create-new-product-trigger"
                          >
                            <PlusCircle className="w-4 h-4" />
                            {DICTIONARY[lang].createNewProduct}
                          </button>
                        </div>
                      </div>

                      {/* Add / Edit Form Block */}
                      {(isCreatingProduct || editingProductId) && (
                        <ProductFormEditor
                          initialProductBuffer={productBuffer}
                          editingProductId={editingProductId}
                          lang={lang}
                          dictionary={DICTIONARY}
                          categories={CATEGORIES as Category[]}
                          onSave={handleSaveProduct}
                          onCancel={() => {
                            setIsCreatingProduct(false);
                            setEditingProductId(null);
                          }}
                          addSystemLog={addSystemLog}
                        />
                      )}

                      {/* Catalog Search & Category Filter Row */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pb-4 pt-1 border-b border-stone-100">
                        <div className="sm:col-span-8 relative">
                          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <OptimizedInput
                            type="text"
                            placeholder={lang === "en" ? "Search product by SKU, En or Bn name..." : "SKU, ইংরেজি বা বাংলা নামে প্রোডাক্ট সার্চ করুন..."}
                            value={catalogSearch}
                            onChange={(val) => {
                              setCatalogSearch(val);
                              setCatalogPage(1);
                            }}
                            className="w-full pl-8 pr-8 py-2 border border-stone-250 bg-stone-50/50 hover:bg-stone-50 focus:bg-white text-xs text-stone-900 rounded font-sans focus:ring-1 focus:ring-stone-600 focus:border-stone-600 outline-none transition-all placeholder:text-stone-400"
                          />
                          {catalogSearch && (
                            <button
                              onClick={() => {
                                setCatalogSearch("");
                                setCatalogPage(1);
                              }}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-450 hover:text-stone-900 text-xs font-bold cursor-pointer"
                              type="button"
                            >
                              ×
                            </button>
                          )}
                        </div>
                        <div className="sm:col-span-4 select-none">
                          <select
                            value={catalogCategory}
                            onChange={(e) => {
                              setCatalogCategory(e.target.value);
                              setCatalogPage(1);
                            }}
                            className="w-full py-2 px-2 border border-stone-250 bg-stone-50/50 hover:bg-stone-50 focus:bg-white text-xs text-stone-900 rounded font-sans focus:ring-1 focus:ring-stone-600 focus:border-stone-600 outline-none transition-all cursor-pointer"
                          >
                            <option value="All">{lang === "en" ? "All Categories" : "সব ক্যাটাগরি"}</option>
                            {CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>
                                {CATEGORY_TRANSLATIONS[cat]?.[lang] || cat}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Current Catalog Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse font-sans" id="control-panel-catalog-table">
                          <thead>
                            <tr className="border-[1px] border-stone-200 bg-stone-50 text-[10px] font-mono uppercase tracking-widest text-stone-500 uppercase">
                              <th className="py-2.5 px-3">{lang === "en" ? "Item details" : "আইটেম বিবরণ"}</th>
                              <th className="py-2.5 px-3 text-center">{lang === "en" ? "Category" : "ক্যাটাগরি"}</th>
                              <th className="py-2.5 px-3 text-right">{lang === "en" ? "Price (৳ BDT)" : "মূল্য (৳ BDT)"}</th>
                              <th className="py-2.5 px-3 text-center">{lang === "en" ? "Reserve Stock" : "মজুদ"}</th>
                              <th className="py-2.5 px-3 text-right">{lang === "en" ? "Actions" : "অ্যাকশন"}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedProductsForCatalog.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="py-8 text-center text-stone-400 text-xs font-mono">
                                  {lang === "en" ? "No matching products found in catalog." : "কোনো প্রোডাক্ট পাওয়া যায়নি।"}
                                </td>
                              </tr>
                            ) : (
                              paginatedProductsForCatalog.map((p) => (
                                <tr 
                                  key={p.id} 
                                  className={`border-b border-stone-100 text-xs transition-colors ${
                                    p.inventory < 5 
                                      ? "bg-red-50/60 hover:bg-red-100/70" 
                                      : "hover:bg-stone-50/55"
                                  }`}
                                >
                                  <td className="py-3 px-3 relative">
                                    {p.inventory < 5 && (
                                      <div 
                                        className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" 
                                        title={p.inventory === 0 ? "Out of Stock" : "Low Inventory Alert (Under 5)"}
                                      />
                                    )}
                                    <div className="flex items-center gap-2.5 pl-1">
                                      <LazyAdminImage src={p.image} name={p.nameEn} />
                                      <div>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <p className="font-medium text-stone-900 font-display">{p.nameEn}</p>
                                          {p.sku && (
                                            <span className="px-1.5 py-0.25 bg-stone-200 text-stone-800 rounded text-[9px] font-mono font-bold uppercase tracking-wider select-all" title="Unique SKU Code">
                                              {p.sku}
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-[10px] text-stone-400 font-sans">{p.nameBn}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 font-mono text-stone-600 text-center">{p.category}</td>
                                  <td className="py-3 px-3 font-mono text-stone-900 text-right">{formatPrice(p.price)}</td>
                                  <td className="py-3 px-3 text-center">
                                    <div className="flex flex-col items-center justify-center">
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px] font-bold transition-all duration-300 ${
                                        pulsingInventoryProductId === p.id
                                          ? "animate-inventory-save-pulse border shadow-md"
                                          : p.inventory === 0
                                            ? "bg-red-100 text-red-800 border border-red-200"
                                            : p.inventory < 5
                                              ? "bg-rose-100 text-rose-800 border border-rose-200 animate-pulse"
                                              : p.inventory < 10
                                                ? "bg-amber-100 text-amber-905 border border-amber-200"
                                                : "bg-stone-100 text-stone-600"
                                      }`}>
                                        {(p.inventory === 0 || p.inventory < 5) && pulsingInventoryProductId !== p.id && (
                                          <AlertTriangle className="w-3 h-3 text-red-650 shrink-0" />
                                        )}
                                        {p.inventory} units
                                      </span>
                                      {p.inventory === 0 ? (
                                        <span className="text-[9px] font-mono font-bold tracking-wider text-red-600 uppercase block mt-1">
                                          {lang === "en" ? "Out of Stock" : "স্টক শেষ"}
                                        </span>
                                      ) : p.inventory < 5 ? (
                                        <span className="text-[9px] font-mono font-bold tracking-wider text-rose-600 animate-pulse uppercase block mt-1">
                                          {lang === "en" ? "Low Stock" : "সীমিত স্টক"}
                                        </span>
                                      ) : null}
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 text-right">
                                    <div className="flex justify-end items-center gap-2.5">
                                      <button
                                        onClick={() => startEditProduct(p)}
                                        className="py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-800 hover:text-stone-950 border border-stone-300 rounded-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer shadow-xs font-sans font-semibold text-xs min-h-[38px] sm:min-h-0"
                                        title="Edit Product Info"
                                        id={`edit-item-${p.id}`}
                                      >
                                        <Edit2 className="w-3.5 h-3.5 text-stone-600" />
                                        <span>{lang === "en" ? "Edit" : "এডিট"}</span>
                                      </button>
                                      <button
                                        onClick={() => handleDeleteProduct(p.id, p.nameEn, p.nameBn)}
                                        className="py-2.5 px-4 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-800 border border-red-200 rounded-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer shadow-xs font-sans font-semibold text-xs min-h-[38px] sm:min-h-0"
                                        title="Retire Product"
                                        id={`delete-item-${p.id}`}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>{lang === "en" ? "Delete" : "মুছুন"}</span>
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination Controls bar */}
                      {totalCatalogPages > 1 && (
                        <div className="flex items-center justify-between pt-4 border-t border-stone-100 font-mono text-[10px] sm:text-xs">
                          <span className="text-stone-500">
                            {lang === "en" ? "Showing" : "দেখাচ্ছে"} <span className="font-bold text-stone-800">{Math.min(filteredProductsForCatalog.length, (catalogPage - 1) * CATALOG_ITEMS_PER_PAGE + 1)}-{Math.min(filteredProductsForCatalog.length, catalogPage * CATALOG_ITEMS_PER_PAGE)}</span> {lang === "en" ? "of" : "এর মধ্যে"} <span className="font-bold text-stone-800">{filteredProductsForCatalog.length}</span>
                          </span>

                          <div className="flex items-center gap-1.5 select-none">
                            <button
                              type="button"
                              disabled={catalogPage <= 1}
                              onClick={() => setCatalogPage((prev) => Math.max(1, prev - 1))}
                              className="p-1.5 border border-stone-250 rounded bg-white hover:bg-stone-50 hover:text-stone-900 transition-colors cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                              title="Previous page"
                            >
                              <ChevronLeft className="w-4 h-4 text-stone-600" />
                            </button>
                            <span className="px-1 text-stone-600 font-bold uppercase tracking-wider text-[10px]">
                              {lang === "en" ? "Page" : "পেজ"} {catalogPage} / {totalCatalogPages}
                            </span>
                            <button
                              type="button"
                              disabled={catalogPage >= totalCatalogPages}
                              onClick={() => setCatalogPage((prev) => Math.min(totalCatalogPages, prev + 1))}
                              className="p-1.5 border border-stone-250 rounded bg-white hover:bg-stone-50 hover:text-stone-900 transition-colors cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                              title="Next page"
                            >
                              <ChevronRight className="w-4 h-4 text-stone-600" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Order Queue & Live Marketing Settings Panel (5 cols) */}
                  <div className="lg:col-span-12 xl:col-span-5 space-y-6">
                    <PromoSettingsPanel
                      settings={settings}
                      onSave={handleSaveSettings}
                      lang={lang}
                    />

                    <AdminUxPlayground lang={lang} />


                    {/* Incoming Carriage / Processing Orders Queue */}
                    <div className="bg-white border border-stone-200 rounded-sm shadow-sm p-6 space-y-4 animate-studio-reveal" id="admin-orders-queue">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-stone-100 pb-3">
                        <div className="flex items-center gap-2">
                          <ShoppingBag className="w-4 h-4 text-amber-500" />
                          <h3 className="font-display font-medium text-stone-950 uppercase tracking-widest text-sm flex items-center gap-2">
                            <span>{DICTIONARY[lang].ordersList}</span>
                            {pendingOrdersCount > 0 && (
                              <span className="bg-rose-600 text-white text-[9px] font-mono font-bold px-2 py-0.5 rounded-full animate-bounce">
                                {pendingOrdersCount} {lang === "en" ? "NEW" : "নতুন"}
                              </span>
                            )}
                          </h3>
                        </div>

                        {/* Beautifully wrapped Admin Filter dashboard controls */}
                        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                          {/* Filter by Status */}
                          <div className="flex items-center gap-1.5 min-w-[140px]">
                            <span className="text-stone-400 uppercase text-[10px] tracking-wide font-bold">{lang === 'en' ? 'Status:' : 'স্ট্যাটাস:'}</span>
                            <select
                              value={adminOrderStatusFilter}
                              onChange={(e) => setAdminOrderStatusFilter(e.target.value)}
                              className="bg-stone-50 border border-stone-300 rounded px-2 py-1 text-stone-850 font-bold focus:outline-none cursor-pointer text-[11px] w-full"
                              id="admin-order-status-filter"
                            >
                              <option value="All">{lang === 'en' ? 'All Status' : 'সব স্ট্যাটাস'}</option>
                              <option value="Pending">Pending</option>
                              <option value="Processing">Processing</option>
                              <option value="Shipped">Shipped</option>
                              <option value="Completed">Completed</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Date Presets and Metrics Dashboard - Only visible in Admin Portal for Orders */}
                      <div className="bg-stone-50 border border-stone-200 rounded-sm p-3.5 space-y-3 font-mono text-xs text-stone-800" id="admin-date-wise-select-dashboard">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-stone-200/60 pb-2.5">
                          <span className="text-[10px] uppercase font-bold text-stone-550 tracking-wider flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-amber-500" />
                            <span>{lang === "en" ? "Date-Wise Select" : "তারিখ অনুযায়ী ফিল্টার"}</span>
                          </span>
                          
                          {/* Custom Range quick selection presets */}
                          <div className="flex flex-wrap gap-1">
                            {(() => {
                              const getLocalDateString = (d: Date) => {
                                const year = d.getFullYear();
                                const month = String(d.getMonth() + 1).padStart(2, '0');
                                const day = String(d.getDate()).padStart(2, '0');
                                return `${year}-${month}-${day}`;
                              };
                              const todayStr = getLocalDateString(new Date());
                              
                              const yesterday = new Date();
                              yesterday.setDate(yesterday.getDate() - 1);
                              const yesterdayStr = getLocalDateString(yesterday);

                              const threeDaysAgo = new Date();
                              threeDaysAgo.setDate(threeDaysAgo.getDate() - 2);
                              const threeDaysStr = getLocalDateString(threeDaysAgo);

                              const sevenDaysAgo = new Date();
                              sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
                              const sevenDaysStr = getLocalDateString(sevenDaysAgo);

                              const firstDayOfMonth = getLocalDateString(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

                              return (
                                <>
                                  <button
                                    onClick={() => {
                                      setAdminOrderStartDate("");
                                      setAdminOrderEndDate("");
                                    }}
                                    className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-all cursor-pointer ${
                                      !adminOrderStartDate && !adminOrderEndDate
                                        ? "bg-stone-900 text-stone-50 border-stone-900"
                                        : "bg-white text-stone-600 border-stone-200 hover:bg-stone-100"
                                    }`}
                                  >
                                    {lang === "en" ? "All Time" : "সব সময়"}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setAdminOrderStartDate(todayStr);
                                      setAdminOrderEndDate(todayStr);
                                    }}
                                    className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-all cursor-pointer ${
                                      adminOrderStartDate === todayStr && adminOrderEndDate === todayStr
                                        ? "bg-amber-600 text-white border-amber-600"
                                        : "bg-white text-stone-600 border-stone-200 hover:bg-stone-100"
                                    }`}
                                  >
                                    {lang === "en" ? "Today" : "আজ"}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setAdminOrderStartDate(yesterdayStr);
                                      setAdminOrderEndDate(yesterdayStr);
                                    }}
                                    className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-all cursor-pointer ${
                                      adminOrderStartDate === yesterdayStr && adminOrderEndDate === yesterdayStr
                                        ? "bg-amber-600 text-white border-amber-600"
                                        : "bg-white text-stone-600 border-stone-200 hover:bg-stone-100"
                                    }`}
                                  >
                                    {lang === "en" ? "Yesterday" : "গতকাল"}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setAdminOrderStartDate(threeDaysStr);
                                      setAdminOrderEndDate(todayStr);
                                    }}
                                    className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-all cursor-pointer ${
                                      adminOrderStartDate === threeDaysStr && adminOrderEndDate === todayStr
                                        ? "bg-amber-600 text-white border-amber-600"
                                        : "bg-white text-stone-600 border-stone-200 hover:bg-stone-100"
                                    }`}
                                  >
                                    {lang === "en" ? "3 Days" : "৩ দিন"}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setAdminOrderStartDate(sevenDaysStr);
                                      setAdminOrderEndDate(todayStr);
                                    }}
                                    className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-all cursor-pointer ${
                                      adminOrderStartDate === sevenDaysStr && adminOrderEndDate === todayStr
                                        ? "bg-amber-600 text-white border-amber-600"
                                        : "bg-white text-stone-600 border-stone-200 hover:bg-stone-100"
                                    }`}
                                  >
                                    {lang === "en" ? "7 Days" : "৭ দিন"}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setAdminOrderStartDate(firstDayOfMonth);
                                      setAdminOrderEndDate(todayStr);
                                    }}
                                    className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-all cursor-pointer ${
                                      adminOrderStartDate === firstDayOfMonth && adminOrderEndDate === todayStr
                                        ? "bg-amber-600 text-white border-amber-600"
                                        : "bg-white text-stone-600 border-stone-200 hover:bg-stone-100"
                                    }`}
                                  >
                                    {lang === "en" ? "This Month" : "চলতি মাস"}
                                  </button>
                                </>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Interactive Manual Inputs */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex flex-col gap-1 border border-stone-200/80 bg-white rounded p-1.5 px-2.5">
                            <span className="text-[8.5px] uppercase font-bold text-stone-400 tracking-wider font-mono">{lang === "en" ? "From Date" : "শুরুর তারিখ"}</span>
                            <input
                              type="date"
                              value={adminOrderStartDate}
                              onChange={(e) => setAdminOrderStartDate(e.target.value)}
                              className="bg-transparent border-0 text-stone-800 font-bold focus:outline-none cursor-pointer text-[11px] font-mono w-full"
                            />
                          </div>
                          <div className="flex flex-col gap-1 border border-stone-200/80 bg-white rounded p-1.5 px-2.5">
                            <span className="text-[8.5px] uppercase font-bold text-stone-400 tracking-wider font-mono">{lang === "en" ? "To Date" : "শেষের তারিখ"}</span>
                            <input
                              type="date"
                              value={adminOrderEndDate}
                              onChange={(e) => setAdminOrderEndDate(e.target.value)}
                              className="bg-transparent border-0 text-stone-800 font-bold focus:outline-none cursor-pointer text-[11px] font-mono w-full"
                            />
                          </div>
                        </div>

                        {/* Current Selection summary and Financial Subset performance */}
                        {(() => {
                          const subset = orders.filter((or) => {
                            let match = true;
                            if (adminOrderStatusFilter !== "All" && or.status !== adminOrderStatusFilter) {
                              match = false;
                            }
                            if (adminOrderSearchTerm) {
                              const query = adminOrderSearchTerm.toLowerCase().trim();
                              const subMatch = or.id.toLowerCase().includes(query) ||
                                or.customerName.toLowerCase().includes(query) ||
                                or.customerPhone.toLowerCase().includes(query) ||
                                (or.customerAddress && or.customerAddress.toLowerCase().includes(query)) ||
                                (or.paymentTrxId && or.paymentTrxId.toLowerCase().includes(query));
                              if (!subMatch) match = false;
                            }
                            if (adminOrderStartDate) {
                              const start = new Date(adminOrderStartDate);
                              start.setHours(0, 0, 0, 0);
                              if (new Date(or.date).getTime() < start.getTime()) match = false;
                            }
                            if (adminOrderEndDate) {
                              const end = new Date(adminOrderEndDate);
                              end.setHours(23, 59, 59, 999);
                              if (new Date(or.date).getTime() > end.getTime()) match = false;
                            }
                            return match;
                          });

                          const subsetSalesAmount = subset.reduce((sum, or) => sum + or.totalPrice, 0);

                          return (
                            <div className="bg-stone-900 border border-stone-850 rounded p-2.5 flex items-center justify-between gap-3 text-stone-200 text-[11px]">
                              <div className="space-y-0.5">
                                <p className="text-stone-450 uppercase font-bold text-[8px] tracking-widest leading-none">{lang === "en" ? "DASHBOARD RANGE ANALYSIS" : "তারিখ সীমার তথ্য বিশ্লেষণ"}</p>
                                <p className="text-stone-300 font-bold text-[10px] leading-tight">
                                  {adminOrderStartDate || adminOrderEndDate ? (
                                    <span>
                                      {adminOrderStartDate ? adminOrderStartDate : "Beginning"} → {adminOrderEndDate ? adminOrderEndDate : "Latest"}
                                    </span>
                                  ) : (
                                    <span>{lang === "en" ? "All-Time Records" : "সব সময়ের রেকর্ডসমূহ"}</span>
                                  )}
                                </p>
                              </div>
                              <div className="flex gap-4 items-center font-mono">
                                <div className="text-right">
                                  <span className="block text-stone-450 text-[7.5px] uppercase tracking-wider leading-none">{lang === "en" ? "Orders" : "অর্ডার"}</span>
                                  <span className="font-bold text-amber-500 text-[11px]">{subset.length} {lang === "en" ? "units" : "টি"}</span>
                                </div>
                                <div className="text-right border-l border-stone-800 pl-4">
                                  <span className="block text-stone-450 text-[7.5px] uppercase tracking-wider leading-none">{lang === "en" ? "Revenue" : "মোট বিক্রয়"}</span>
                                  <span className="font-bold text-emerald-400 font-sans text-[11px]">{formatPrice(subsetSalesAmount)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Search Bar for Order ID, name, or phone */}
                      <div className="relative flex items-center gap-2" id="admin-order-search-container">
                        <div className="relative flex-1">
                          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <OptimizedInput
                            type="text"
                            placeholder={lang === "en" ? "Search Memo ID, Client Name, Phone..." : "মেমো আইডি, নাম বা ফোন নম্বর খুঁজুন..."}
                            value={adminOrderSearchTerm}
                            onChange={(val) => setAdminOrderSearchTerm(val)}
                            className="w-full bg-stone-50 border border-stone-250 text-stone-850 placeholder-stone-400 rounded-sm text-xs font-mono pl-9 pr-8 py-2 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
                            id="admin-order-search-input"
                          />
                          {adminOrderSearchTerm && (
                            <button
                              onClick={() => setAdminOrderSearchTerm("")}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-xs font-bold"
                              title="Clear query"
                            >
                              ✖
                            </button>
                          )}
                        </div>
                        <button
                          onClick={() => setIsScannerOpen(true)}
                          className="bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-250 p-2 rounded-sm cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-1 shrink-0"
                          title={lang === "en" ? "Scan Invoice QR Code" : "রশিদ কিউআর স্ক্যান করুন"}
                          id="admin-order-scan-shortcut"
                        >
                          <QrCode className="w-3.5 h-3.5 text-stone-700 animate-pulse" />
                          <span className="text-[10px] uppercase font-mono font-bold tracking-wider hidden sm:inline-block">Scan</span>
                        </button>
                      </div>

                      {(() => {
                        let filteredOrders = orders.filter(or => adminOrderStatusFilter === "All" || or.status === adminOrderStatusFilter);

                        if (adminOrderSearchTerm) {
                          const query = adminOrderSearchTerm.toLowerCase().trim();
                          filteredOrders = filteredOrders.filter(or => 
                            or.id.toLowerCase().includes(query) ||
                            or.customerName.toLowerCase().includes(query) ||
                            or.customerPhone.toLowerCase().includes(query) ||
                            (or.customerAddress && or.customerAddress.toLowerCase().includes(query)) ||
                            (or.paymentTrxId && or.paymentTrxId.toLowerCase().includes(query))
                          );
                        }

                        if (adminOrderStartDate) {
                          const start = new Date(adminOrderStartDate);
                          start.setHours(0, 0, 0, 0);
                          filteredOrders = filteredOrders.filter(or => {
                            const orderTime = new Date(or.date).getTime();
                            return orderTime >= start.getTime();
                          });
                        }

                        if (adminOrderEndDate) {
                          const end = new Date(adminOrderEndDate);
                          end.setHours(23, 59, 59, 999);
                          filteredOrders = filteredOrders.filter(or => {
                            const orderTime = new Date(or.date).getTime();
                            return orderTime <= end.getTime();
                          });
                        }

                        return filteredOrders.length === 0 ? (
                          <div className="text-center py-8 font-mono text-xs text-stone-400 space-y-1.5 w-full" id="admin-orders-empty-state">
                            <p className="font-bold uppercase tracking-wider text-stone-500">
                              {lang === "en" ? "No matching orders found" : "কোনো অর্ডার পাওয়া যায়নি"}
                            </p>
                            <p className="text-[10px] text-stone-400">
                              {lang === "en" 
                                ? `Status: ${adminOrderStatusFilter} | Range: ${adminOrderStartDate || "any time"} to ${adminOrderEndDate || "any time"}`
                                : `স্ট্যাটাস: ${adminOrderStatusFilter} | সীমা: ${adminOrderStartDate || "শুরু থেকে"} থেকে ${adminOrderEndDate || "শেষ অবধি"}`}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                            {filteredOrders.map((or) => (
                            <div key={or.id} className="border border-stone-200 p-3.5 rounded-sm bg-stone-50/70 text-xs font-mono space-y-2 hover:border-stone-300 transition-all shadow-xs">
                              <div 
                                className="flex justify-between items-center bg-stone-150 p-2 rounded text-stone-850 cursor-pointer hover:bg-stone-200/90 hover:scale-[1.01] active:scale-[0.99] transition-all border border-stone-250/60"
                                onClick={() => setAdminSelectedOrder(or)}
                                title={lang === "en" ? "Click to inspect order details & print!" : "অর্ডারের ডিটেইল দেখতে ও প্রিন্ট করতে ক্লিক করুন!"}
                              >
                                <span className="font-bold text-amber-900 underline flex items-center gap-1">🔍 {or.id}</span>
                                <span className="text-[10px] text-stone-605">{new Date(or.date).toLocaleString()}</span>
                              </div>

                              <div className="space-y-1">
                                <p><span className="text-stone-400">Buyer:</span> {or.customerName}</p>
                                <p><span className="text-stone-400">Route:</span> {or.customerAddress}</p>
                                <p><span className="text-stone-400">Phone:</span> {or.customerPhone}</p>
                                <p>
                                  <span className="text-stone-400">Payment:</span>{" "}
                                  <span className={`font-bold uppercase ${or.paymentMethod && or.paymentMethod !== "COD" ? "text-rose-600" : "text-stone-850"}`}>
                                    {or.paymentMethod || "COD (Cash On Delivery)"}
                                  </span>
                                </p>
                                {or.paymentSender && (
                                  <p><span className="text-stone-400">Sender Number:</span> {or.paymentSender}</p>
                                )}
                                {or.paymentTrxId && (
                                  <p><span className="text-stone-400">TrxID:</span> <span className="bg-amber-100 text-stone-900 px-1 py-0.2 rounded font-mono select-all font-bold">{or.paymentTrxId}</span></p>
                                )}
                              </div>

                              <div className="border-t border-b border-stone-200/60 py-1.5 my-1.5 space-y-1 max-h-24 overflow-y-auto">
                                {or.items.map((it, idx) => (
                                  <div key={idx} className="flex justify-between items-center text-[11px]">
                                    <span className="truncate max-w-[170px] text-stone-850">● {lang === "en" ? it.productNameEn : it.productNameBn}</span>
                                    <span>x{it.quantity} @ {formatPrice(it.priceAtPurchase)}</span>
                                  </div>
                                ))}
                              </div>

                              <div className="flex justify-between items-center font-bold text-stone-950 text-[11px]">
                                <span>TOTAL COLLECTABLE:</span>
                                <span>{formatPrice(or.totalPrice)}</span>
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-stone-200/40 mt-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-stone-400 font-mono">CARRIAGE STATUS:</span>
                                  <select
                                    value={or.status}
                                    onChange={(e) => updateOrderStatus(or.id, e.target.value as any)}
                                    className="bg-white border border-stone-200 rounded px-1.5 py-0.5 text-[10px] text-stone-800 font-bold"
                                  >
                                    <option value="Pending">Pending</option>
                                    <option value="Processing">Processing</option>
                                    <option value="Shipped">Shipped</option>
                                    <option value="Completed">Completed</option>
                                  </select>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  {/* Quick Details inspection Icon */}
                                  <button
                                    onClick={() => setAdminSelectedOrder(or)}
                                    className="p-1 text-stone-500 hover:text-amber-500 hover:bg-stone-200/50 rounded transition-colors"
                                    title={lang === "en" ? "Inspect detailed order view" : "বিস্তারিত ডিটেইল দেখুন"}
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>

                                  <a
                                    href={isInsideIframe ? getPrintUrl(or.id) : "#"}
                                    target={isInsideIframe ? "_blank" : undefined}
                                    onClick={isInsideIframe ? undefined : (e) => { e.preventDefault(); setPrintingOrder(or); }}
                                    className="bg-stone-900 hover:bg-stone-800 text-amber-400 text-[10px] font-mono py-1 px-2.5 rounded-sm flex items-center gap-1 uppercase transition-colors select-none"
                                    id={`admin-print-order-${or.id}`}
                                  >
                                    <Printer className="w-3 h-3 text-amber-400" />
                                    {lang === "en" ? "Print" : "প্রিন্ট"}
                                  </a>
                                </div>
                              </div>
                            </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Price Alert Subscribers Panel */}
                    <div className="bg-white border border-stone-200 rounded-sm shadow-sm p-6 space-y-4">
                      <div className="flex justify-between items-center border-b border-stone-100 pb-2">
                        <h3 className="font-display font-medium text-stone-950 uppercase tracking-wider text-sm flex items-center gap-1.5">
                          <Bell className="w-4 h-4 text-amber-500" />
                          {DICTIONARY[lang].subscribersTab}
                        </h3>
                        <span className="text-[10px] font-mono bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full font-bold">
                          {subscriptions.length} active
                        </span>
                      </div>

                      {subscriptions.length === 0 ? (
                        <p className="text-xs text-stone-400 font-mono py-2">No active price drop alert subscribers registered.</p>
                      ) : (
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                          {subscriptions.map((sub) => {
                            const prod = products.find((p) => p.id === sub.productId);
                            const currentPrice = prod ? prod.price : sub.originalPrice;
                            return (
                              <div key={sub.id} className="border border-stone-200 p-3 rounded bg-stone-50/50 space-y-2 text-xs font-mono">
                                <div className="flex justify-between items-start gap-2">
                                  <div>
                                    <p className="font-bold text-stone-900 truncate max-w-[200px]" title={lang === "en" ? sub.productNameEn : sub.productNameBn}>
                                      {lang === "en" ? sub.productNameEn : sub.productNameBn}
                                    </p>
                                    <p className="text-[11px] text-stone-500 mt-0.5 select-all">{sub.contact}</p>
                                  </div>
                                  <button
                                    onClick={() => {
                                      setSubscriptions((prev) => prev.filter((s) => s.id !== sub.id));
                                      addSystemLog(
                                        "warning", 
                                        `Subscription cancelled for ${sub.contact} on [${sub.productNameEn}]`, 
                                        `ফোন/ইমেইল ${sub.contact} এর সাবস্ক্রিপশন বাতিল করা হয়েছে [${sub.productNameEn}]`
                                      );
                                    }}
                                    className="text-stone-400 hover:text-red-600 transition-colors cursor-pointer p-0.5"
                                    title="Cancel alert"
                                    id={`cancel-admin-sub-${sub.id}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                <div className="grid grid-cols-2 gap-1 text-[10px] bg-stone-100/70 p-1.5 rounded">
                                  <div>
                                    <span className="text-stone-400 block uppercase">START PRICE</span>
                                    <span className="font-bold text-stone-750">${sub.originalPrice}</span>
                                  </div>
                                  <div>
                                    <span className="text-stone-400 block uppercase">LIVE PRICE</span>
                                    <span className={`font-bold ${currentPrice < sub.originalPrice ? "text-emerald-600 animate-pulse" : "text-stone-600"}`}>
                                      ${currentPrice} {currentPrice < sub.originalPrice ? `(-${Math.round((sub.originalPrice - currentPrice) / sub.originalPrice * 100)}%)` : ""}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between pt-1">
                                  <span className="text-[9px] text-stone-400">Registered: {new Date(sub.date).toLocaleDateString()}</span>
                                  <button
                                    onClick={() => {
                                      let updatedPrice = currentPrice;
                                      
                                      // If the product is not discounted yet, automatically simulate a discounted price drop of 10%
                                      if (currentPrice >= sub.originalPrice) {
                                        updatedPrice = Math.round(sub.originalPrice * 0.9);
                                        setProducts((prev) =>
                                          prev.map((p) => (p.id === sub.productId ? { ...p, price: updatedPrice, regularPrice: sub.originalPrice } : p))
                                        );
                                        addSystemLog(
                                          "success",
                                          `🚨 Price drop simulated: Changed [${sub.productNameEn}] from $${sub.originalPrice} to $${updatedPrice}`,
                                          `🚨 প্রাইস ড্রপ সিমুলেশন: [${sub.productNameEn}] এর দাম $${sub.originalPrice} থেকে কমিয়ে $${updatedPrice} করা হয়েছে।`
                                        );
                                      }
                                      
                                      // Log the dispatch notification
                                      addSystemLog(
                                        "success",
                                        `🔔 Price alert dispatched! Contact: ${sub.contact} | Item: [${sub.productNameEn}] | New price: $${updatedPrice} (saved $${sub.originalPrice - updatedPrice})`,
                                        `🔔 প্রাইস ড্রপ নোটিফিকেশন পাঠানো হয়েছে! ঠিকানা: ${sub.contact} | পণ্য: [${sub.productNameEn}] | নতুন মূল্য: $${updatedPrice} (সাশ্রয় $${sub.originalPrice - updatedPrice})`
                                      );
                                      alert(
                                        lang === "en"
                                          ? `Simulated Price Reduction Alert successfully dispatched and logged to ${sub.contact}!`
                                          : `মূল্য রাসের কাল্পনিক অ্যালার্ট ${sub.contact}-এর ঠিকানায় সফলভাবে পাঠানো এবং লগ করা হয়েছে!`
                                      );
                                    }}
                                    className="bg-amber-100 hover:bg-amber-200 text-amber-900 text-[10px] px-2 py-1 rounded font-bold uppercase transition-colors shrink-0 cursor-pointer border border-amber-200"
                                    id={`trigger-alert-sub-${sub.id}`}
                                  >
                                    Trigger alert
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Live Security Audit Log Terminal */}
                    <div className="bg-stone-950 text-neutral-300 font-mono text-[10px] p-4 rounded border border-stone-800 shadow-lg space-y-2">
                      <h4 className="text-stone-400 border-b border-stone-855 pb-1 flex items-center justify-between">
                        <span>{DICTIONARY[lang].systemAuditLog}</span>
                        <span className="text-[8px] tracking-widest text-emerald-500 animate-pulse">● DIALOG READY</span>
                      </h4>
                      <div className="space-y-1 max-h-[160px] overflow-y-auto font-mono scrollbar-none">
                        {logs.map((lg) => (
                          <div key={lg.id} className="hover:bg-stone-900 py-0.5 rounded transition-colors pr-2">
                            <span className="text-stone-500 mr-1.5">[{new Date(lg.timestamp).toLocaleTimeString()}]</span>
                            <span className={`mr-1.5 font-bold ${
                              lg.type === "security" ? "text-amber-400" :
                              lg.type === "success" ? "text-emerald-400" :
                              lg.type === "warning" ? "text-red-400" : "text-stone-400"
                            }`}>
                              [{lg.type.toUpperCase()}]
                            </span>
                            <span className="text-stone-300">{lang === "en" ? lg.messageEn : lg.messageBn}</span>
                            <span className="text-stone-500 block text-[8px] pl-16">Verified Operator: {lg.operator}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>
              </>
            ) : adminSubView === "customers" ? (
              /* ==================== CUSTOMER ACCOUNTS MANAGER SUBVIEW ==================== */
              <div className="bg-white border border-stone-200 p-4 sm:p-6 rounded-sm shadow-sm space-y-6 animate-studio-reveal" id="admin-customers-panel">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-stone-100 pb-4">
                  <div>
                    <h3 className="font-display font-medium text-stone-950 uppercase tracking-wider text-base flex items-center gap-2">
                      <User className="w-5 h-5 text-amber-500" />
                      <span>{lang === "en" ? "Registered Customer Accounts" : "নিবন্ধিত গ্রাহকের বিবরণী ও অ্যাকাউন্ট তালিকা"}</span>
                    </h3>
                    <p className="text-xs text-stone-400 mt-1">
                      {lang === "en" 
                        ? "Inspect and manage customer profiles, verified contact numbers, address directories, and payment accounts." 
                        : "গ্রাহকদের প্রোফাইল, ভেরিফাইড কন্টাক্ট নম্বর, ঠিকানা এবং ওয়ালেট অ্যাকাউন্টসমূহ ট্র্যাক ও পরিচালনা করুন।"}
                    </p>
                  </div>

                  <div className="bg-stone-50 border border-stone-200 px-3 py-1.5 rounded text-[10px] sm:text-xs font-mono text-stone-600 flex items-center gap-1.5 uppercase font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {lang === "en" 
                      ? `Total Customers: ${registeredUsers.length}` 
                      : `মোট কাস্টমার: ${registeredUsers.length} জন`}
                  </div>
                </div>

                {/* Live Search and Filtering Blocks */}
                <div className="bg-stone-50 border border-stone-200/80 p-4 rounded-sm space-y-3">
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="w-4 h-4 text-stone-400" />
                    </span>
                    <OptimizedInput
                      type="text"
                      placeholder={lang === "en" ? "Search customer accounts easily by Name, Phone Number, Email, or Address..." : "নাম, মো্বাইল নম্বর, ইমেইল অথবা ঠিকানা টাইপ করে সহজে খুঁজুন..."}
                      value={customerSearchQuery}
                      onChange={(val) => setCustomerSearchQuery(val)}
                      className="w-full bg-white border border-stone-250 rounded pl-9 pr-4 py-2.5 text-xs sm:text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                      id="customer-admin-search"
                    />
                    {customerSearchQuery && (
                      <button
                        onClick={() => setCustomerSearchQuery("")}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center font-mono text-xs text-stone-400 hover:text-stone-750 cursor-pointer"
                        title={lang === "en" ? "Reset filters" : "সার্চ মুছুন"}
                      >
                        ✖ {lang === "en" ? "Clear" : "মুছুন"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Directory Body */}
                {(() => {
                  const query = customerSearchQuery.toLowerCase().trim();
                  const filtered = registeredUsers.filter((user) => {
                    return (
                      user.name.toLowerCase().includes(query) ||
                      user.phone.toLowerCase().includes(query) ||
                      (user.email && user.email.toLowerCase().includes(query)) ||
                      (user.address && user.address.toLowerCase().includes(query)) ||
                      (user.bkash && user.bkash.includes(query)) ||
                      (user.nagad && user.nagad.includes(query)) ||
                      (user.upay && user.upay.includes(query))
                    );
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="text-center py-16 bg-stone-50 border border-stone-200 rounded-sm">
                        <AlertTriangle className="w-8 h-8 text-stone-400 mx-auto mb-2.5 animate-bounce" />
                        <p className="font-mono text-xs text-stone-600 font-bold uppercase tracking-wider">
                          {lang === "en" ? "No matching customer accounts found" : "এই অনুসন্ধান মানদণ্ডে কোনো কাস্টমার অ্যাকাউন্ট পাওয়া যায়নি"}
                        </p>
                        <p className="text-[10px] text-stone-400 mt-1 uppercase font-mono">
                          {lang === "en" ? `Tried filters: "${customerSearchQuery}"` : `অনুসন্ধানের শব্দ: "${customerSearchQuery}"`}
                        </p>
                        <button
                          onClick={() => setCustomerSearchQuery("")}
                          className="mt-4 bg-stone-900 text-amber-400 text-xs font-mono px-4 py-2 rounded uppercase border border-stone-750 hover:bg-stone-800 transition-colors"
                        >
                          {lang === "en" ? "Clear Search Criteria" : "সার্চ কুয়েরী রিসেট করুন"}
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="registered-customers-grid-wrapper">
                      {filtered.map((user, idx) => {
                        const userOrders = orders.filter(
                          (or) => or.customerPhone?.trim() === user.phone?.trim()
                        );
                        const completedOrders = userOrders.filter(
                          (or) => or.status === "Completed"
                        );
                        const totalSpent = completedOrders.reduce((sum, or) => sum + or.totalPrice, 0);

                        return (
                          <div 
                            key={user.phone + "-" + idx}
                            className="bg-white border border-stone-200 p-4 rounded-sm hover:shadow-md hover:border-amber-500/40 transition-all duration-150 flex flex-col justify-between text-xs space-y-4"
                            id={`customer-profile-card-${user.phone}`}
                          >
                            {/* Profile details */}
                            <div className="flex items-start gap-3">
                              {user.profilePicture ? (
                                <img 
                                  src={user.profilePicture} 
                                  alt={user.name} 
                                  className="w-12 h-12 rounded-full object-cover border border-stone-250 flex-shrink-0"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-500 font-display font-bold text-sm uppercase flex-shrink-0 shadow-xs">
                                  {user.name.trim().substring(0, 1).toUpperCase()}
                                </div>
                              )}

                              <div className="space-y-1 flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-1.5">
                                  <div>
                                    <h4 className="font-sans font-bold text-stone-900 truncate text-xs sm:text-sm">
                                      {user.name}
                                    </h4>
                                    
                                    {/* Customer Category Dynamic Dropdown Selector */}
                                    <div className="flex items-center gap-1.5 mt-1 select-none">
                                      <span className="text-stone-400 font-mono text-[9px] font-semibold tracking-wider uppercase">{lang === 'en' ? 'Tier:' : 'ক্যাটাগরি:'}</span>
                                      <select
                                        value={user.category || "Regular"}
                                        onChange={(e) => handleUpdateUserCategory(user.phone, e.target.value)}
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase border focus:outline-none cursor-pointer ${
                                          user.category === "VIP" ? "bg-purple-100 text-purple-750 border-purple-250" :
                                          user.category === "Gold" ? "bg-amber-100 text-amber-750 border-amber-250" :
                                          user.category === "Silver" ? "bg-stone-100 text-stone-750 border-stone-300" :
                                          user.category === "Platinum" ? "bg-sky-100 text-sky-750 border-sky-250" :
                                          user.category === "Wholesaler" ? "bg-emerald-105 text-emerald-750 border-emerald-250" :
                                          "bg-stone-50 text-stone-650 border-stone-200"
                                        }`}
                                        id={`edit-category-select-${user.phone}`}
                                      >
                                        <option value="Regular">Regular</option>
                                        <option value="Silver">Silver</option>
                                        <option value="Gold">Gold</option>
                                        <option value="Platinum">Platinum</option>
                                        <option value="VIP">VIP</option>
                                        <option value="Wholesaler">Wholesaler</option>
                                      </select>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => handleDeleteCustomer(user.phone, user.name)}
                                    className="text-stone-350 hover:text-red-700 transition-colors p-1 rounded hover:bg-stone-100 shrink-0 cursor-pointer"
                                    title={lang === "en" ? "Permanently Delete Account" : "অ্যাকাউন্ট ডিলিট করুন"}
                                    id={`delete-user-${user.phone}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                <div className="space-y-0.5">
                                  {/* Call customer link */}
                                  <a 
                                    href={`tel:${user.phone}`}
                                    className="text-[11px] font-mono text-stone-700 hover:text-amber-600 transition-colors inline-flex items-center gap-1.5"
                                    title={lang === "en" ? "Call customer" : "ফোনে যোগাযোগ করুন"}
                                  >
                                    <Phone className="w-3 h-3 text-stone-400" />
                                    <span>{user.phone}</span>
                                  </a>

                                  {/* Mail link */}
                                  {user.email ? (
                                    <a 
                                      href={`mailto:${user.email}`}
                                      className="text-[10px] text-stone-500 block truncate hover:text-amber-600 transition-colors flex items-center gap-1.5"
                                      title={lang === "en" ? "Send email" : "ইমেইল পাঠান"}
                                    >
                                      <Mail className="w-3 h-3 text-stone-400" />
                                      <span className="truncate">{user.email}</span>
                                    </a>
                                  ) : (
                                    <span className="text-[9px] text-stone-400 italic block font-mono pl-4">
                                      {lang === "en" ? "No Email Provided" : "ইমেইল প্রদান করা হয়নি"}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Inner Demographics details pane */}
                            <div className="bg-stone-50/70 p-3 rounded border border-stone-150 space-y-2">
                              <div className="grid grid-cols-2 gap-2 text-[10px] font-sans">
                                <div className="flex items-center gap-1">
                                  <span className="text-stone-400 uppercase font-mono tracking-wider font-bold">Gender:</span>
                                  {user.gender ? (
                                    <span className={`px-1.5 py-0.2 rounded-full font-mono text-[8px] font-bold ${
                                      user.gender === "Male" ? "bg-indigo-50 text-indigo-700 border border-indigo-150" :
                                      user.gender === "Female" ? "bg-pink-50 text-pink-700 border border-pink-150" :
                                      "bg-amber-50 text-amber-700 border border-amber-150"
                                    }`}>
                                      {user.gender}
                                    </span>
                                  ) : (
                                    <span className="text-stone-400 italic font-mono">Not specified</span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Calendar className="w-2.5 h-2.5 text-stone-400 shrink-0" />
                                  <span className="text-stone-400 uppercase font-mono tracking-wider font-bold">Birth:</span>
                                  <span className="text-stone-700 font-mono text-[9px] truncate">
                                    {user.birthDate || <span className="italic text-stone-400">Not provided</span>}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-start gap-1 pb-0.5 text-[10px]">
                                <MapPin className="w-3 h-3 text-stone-400 shrink-0 mt-0.5" />
                                <div className="flex-1 text-stone-650 leading-relaxed font-sans text-[10.5px]">
                                  <span className="text-stone-450 uppercase font-mono tracking-wider font-bold text-[9px] mr-1">Delivery Address:</span>
                                  {user.address || <span className="italic text-stone-400">{lang === 'en' ? "Not set" : "প্রদান করা হয়নি"}</span>}
                                </div>
                              </div>
                            </div>

                            {/* Wallet Synchronization tags */}
                            <div className="space-y-1">
                              <div className="text-[9px] font-mono text-stone-400 uppercase tracking-widest flex items-center gap-1 font-bold">
                                <CreditCard className="w-2.5 h-2.5 text-stone-400 animate-pulse" />
                                <span>{lang === "en" ? "Synchronized Mobile Wallets" : "মোবাইল ব্যাংকিং অ্যাকাউন্ট"}</span>
                              </div>
                              <div className="grid grid-cols-3 gap-1.5">
                                <div className="bg-stone-50 border border-stone-200 rounded p-1.5 text-center font-mono hover:bg-stone-100 transition-colors">
                                  <span className="text-[8px] uppercase tracking-wider block text-pink-600 font-bold mb-0.5">bKash</span>
                                  <span className="text-[9.5px] text-stone-800 block truncate font-bold select-all" title={user.bkash || "Not synced"}>
                                    {user.bkash || "—"}
                                  </span>
                                </div>
                                <div className="bg-stone-50 border border-stone-200 rounded p-1.5 text-center font-mono hover:bg-stone-100 transition-colors">
                                  <span className="text-[8px] uppercase tracking-wider block text-orange-600 font-bold mb-0.5 font-bold">Nagad</span>
                                  <span className="text-[9.5px] text-stone-800 block truncate font-bold select-all" title={user.nagad || "Not synced"}>
                                    {user.nagad || "—"}
                                  </span>
                                </div>
                                <div className="bg-stone-50 border border-stone-200 rounded p-1.5 text-center font-mono hover:bg-stone-100 transition-colors">
                                  <span className="text-[8px] uppercase tracking-wider block text-sky-600 font-bold mb-0.5">Upay</span>
                                  <span className="text-[9.5px] text-stone-800 block truncate font-bold select-all" title={user.upay || "Not synced"}>
                                    {user.upay || "—"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Detailed purchase metrics */}
                            <div className="pt-2.5 border-t border-stone-150 flex items-center justify-between text-[10px] sm:text-[11px] font-mono">
                              <div className="flex items-center gap-1.5">
                                <span className="text-stone-400 uppercase text-[9px] tracking-wider font-bold">{lang === "en" ? "Orders State:" : "অর্ডার সংখ্যা:"}</span>
                                <span className="bg-amber-100 hover:bg-amber-205 text-amber-950 font-bold px-2 py-0.5 rounded shadow-xs">
                                  {userOrders.length} {lang === "en" ? "Placed" : "টি"}
                                </span>
                              </div>

                              <div className="flex items-center gap-1">
                                <span className="text-stone-400 uppercase text-[9px] tracking-wider font-bold">{lang === "en" ? "Total Revenue:" : "মোট বিক্রি:"}</span>
                                <span className="text-emerald-700 font-bold bg-emerald-50/50 border border-emerald-100 px-1.5 py-0.5 rounded">
                                  {formatPrice(totalSpent)}
                                </span>
                              </div>
                            </div>

                            {/* Expandable Panel Triggers */}
                            <div className="grid grid-cols-3 gap-1 pt-2 border-t border-stone-150 text-[9px] font-mono uppercase tracking-wider font-bold">
                              <button
                                onClick={() => {
                                  setExpandedCustomerPanel((prev) => ({
                                    ...prev,
                                    [user.phone]: prev[user.phone] === "wishlist" ? null : "wishlist"
                                  }));
                                }}
                                className={`py-1.5 px-0.5 rounded border transition-all text-center flex items-center justify-center gap-1 cursor-pointer truncate ${
                                  expandedCustomerPanel[user.phone] === "wishlist"
                                    ? "bg-red-605 text-white border-red-605"
                                    : "bg-stone-50 hover:bg-stone-105 text-stone-700 border-stone-200"
                                }`}
                              >
                                <Heart className={`w-2.5 h-2.5 shrink-0 ${expandedCustomerPanel[user.phone] === "wishlist" ? "fill-current" : ""}`} />
                                <span className="truncate">{lang === "en" ? `Wishlist (${(user.wishlistProductIds || []).length})` : `উইশলিস্ট (${(user.wishlistProductIds || []).length})`}</span>
                              </button>

                              <button
                                onClick={() => {
                                  setExpandedCustomerPanel((prev) => ({
                                    ...prev,
                                    [user.phone]: prev[user.phone] === "orders" ? null : "orders"
                                  }));
                                }}
                                className={`py-1.5 px-0.5 rounded border transition-all text-center flex items-center justify-center gap-1 cursor-pointer truncate ${
                                  expandedCustomerPanel[user.phone] === "orders"
                                    ? "bg-amber-653 text-white border-amber-653"
                                    : "bg-stone-50 hover:bg-stone-105 text-stone-700 border-stone-200"
                                }`}
                              >
                                <ShoppingBag className="w-2.5 h-2.5 shrink-0" />
                                <span className="truncate">{lang === "en" ? `Orders (${userOrders.length})` : `অর্ডার (${userOrders.length})`}</span>
                              </button>

                              <button
                                onClick={() => {
                                  setExpandedCustomerPanel((prev) => ({
                                    ...prev,
                                    [user.phone]: prev[user.phone] === "statement" ? null : "statement"
                                  }));
                                }}
                                className={`py-1.5 px-0.5 rounded border transition-all text-center flex items-center justify-center gap-1 cursor-pointer truncate ${
                                  expandedCustomerPanel[user.phone] === "statement"
                                    ? "bg-stone-900 text-amber-400 border-stone-900"
                                    : "bg-stone-50 hover:bg-stone-105 text-stone-700 border-stone-200"
                                }`}
                              >
                                <FileText className="w-2.5 h-2.5 shrink-0" />
                                <span className="truncate">{lang === "en" ? "Statement" : "বিবরণী"}</span>
                              </button>
                            </div>

                            {/* Accordion expand zones based on chosen panel */}
                            {expandedCustomerPanel[user.phone] === "wishlist" && (() => {
                              const userWishlistIds = user.wishlistProductIds || [];
                              const userWishlistProducts = products.filter(p => userWishlistIds.includes(p.id));
                              return (
                                <div className="bg-stone-50 border border-stone-150 rounded-sm p-3 space-y-3 animate-studio-reveal">
                                  <div className="flex items-center justify-between">
                                    <h5 className="font-mono text-[10px] uppercase font-bold text-stone-605 tracking-wider flex items-center gap-1">
                                      <Heart className="w-3 h-3 text-red-500 fill-red-500" />
                                      <span>{lang === "en" ? "Customer Wishlist" : "গ্রাহকের উইশলিস্ট"} ({userWishlistIds.length})</span>
                                    </h5>
                                  </div>

                                  {userWishlistProducts.length === 0 ? (
                                    <p className="text-[10px] text-stone-400 italic">
                                      {lang === "en" ? "Wishlist is currently empty." : "উইশলিস্ট খালি রয়েছে।"}
                                    </p>
                                  ) : (
                                    <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                                      {userWishlistProducts.map((p) => (
                                        <div key={p.id} className="flex items-center justify-between gap-1.5 p-1.5 bg-white border border-stone-200 rounded">
                                          <div className="flex items-center gap-2 min-w-0">
                                            <img
                                              src={p.image}
                                              alt={p.nameEn}
                                              className="w-8 h-8 rounded object-cover border border-stone-150 flex-shrink-0"
                                              referrerPolicy="no-referrer"
                                            />
                                            <div className="min-w-0">
                                              <p className="font-sans font-semibold text-[11px] text-stone-850 truncate">
                                                {lang === "en" ? p.nameEn : p.nameBn}
                                              </p>
                                              <p className="font-mono text-[10px] text-amber-700 font-bold">
                                                {formatPrice(p.price)}
                                              </p>
                                            </div>
                                          </div>
                                          <button
                                            onClick={() => handleRemoveFromCustomerWishlist(user.phone, p.id)}
                                            className="text-stone-350 hover:text-red-600 p-1 rounded hover:bg-stone-50 transition-colors shrink-0 cursor-pointer"
                                            title={lang === "en" ? "Remove from wishlist" : "উইশলিস্ট থেকে মুছুন"}
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Quick Add Product Dropdown */}
                                  <div className="pt-2 border-t border-stone-200/60 flex items-center gap-1.5">
                                    <span className="text-[9px] font-mono uppercase font-bold text-stone-450 shrink-0">
                                      {lang === "en" ? "Add Item:" : "আইটেম যোগ করুন:"}
                                    </span>
                                    <select
                                      onChange={(e) => {
                                        if (e.target.value) {
                                          handleAddToCustomerWishlist(user.phone, e.target.value);
                                          e.target.value = ""; // Clear selection
                                        }
                                      }}
                                      className="bg-white border border-stone-250 rounded text-[10px] font-mono px-1.5 py-0.5 flex-1 focus:outline-none cursor-pointer text-stone-750 font-bold"
                                      defaultValue=""
                                    >
                                      <option value="">{lang === "en" ? "-- Choose Product to Add --" : "-- প্রোডাক্ট নির্ধারণ করুন --"}</option>
                                      {products
                                        .map((p) => (
                                          <option key={p.id} value={p.id} disabled={userWishlistIds.includes(p.id)}>
                                            {userWishlistIds.includes(p.id) ? "✓ " : ""}{lang === "en" ? p.nameEn : p.nameBn} ({formatPrice(p.price)})
                                          </option>
                                        ))
                                      }
                                    </select>
                                  </div>
                                </div>
                              );
                            })()}

                            {expandedCustomerPanel[user.phone] === "orders" && (() => {
                              return (
                                <div className="bg-stone-50 border border-stone-150 rounded-sm p-3 space-y-3 animate-studio-reveal font-sans">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 pb-2">
                                    <h5 className="font-mono text-[10px] uppercase font-bold text-stone-605 tracking-wider flex items-center gap-1">
                                      <ShoppingBag className="w-3.5 h-3.5 text-amber-500" />
                                      <span>{lang === "en" ? "Customer Order History" : "অর্ডার হিস্ট্রি"} ({userOrders.length})</span>
                                    </h5>
                                    {userOrders.length > 0 && (
                                      <a
                                        href={isInsideIframe ? `${window.location.protocol}//${window.location.host}${window.location.pathname}?customerReportPhone=${user.phone}&print=true` : "#"}
                                        target={isInsideIframe ? "_blank" : undefined}
                                        onClick={isInsideIframe ? undefined : (e) => { e.preventDefault(); setPrintingCustomerReport(user); }}
                                        className="bg-amber-600 hover:bg-amber-700 text-stone-50 text-[10px] font-mono px-2.5 py-1 rounded font-bold uppercase transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs border border-amber-500 select-none text-center"
                                        id={`btn-print-consolidated-${user.phone}`}
                                      >
                                        <Printer className="w-3 h-3 text-stone-50 animate-pulse" />
                                        {lang === "en" ? "Print Combined Orders Report" : "সমস্ত অর্ডার স্টেটমেন্ট প্রিন্ট"}
                                      </a>
                                    )}
                                  </div>

                                  {userOrders.length === 0 ? (
                                    <p className="text-[10px] text-stone-400 italic">
                                      {lang === "en" ? "No orders found for this customer." : "এই গ্রাহকের কোনো অর্ডার নেই।"}
                                    </p>
                                  ) : (
                                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                                      {userOrders.map((or) => {
                                        return (
                                          <div key={or.id} className="bg-white border border-stone-200 rounded p-2 space-y-1.5 hover:border-stone-300 transition-all text-[11px]">
                                            <div className="flex items-center justify-between gap-1.5">
                                              <span className="font-mono font-bold text-[10px] text-stone-900 bg-stone-100 px-1 py-0.2 rounded">
                                                #{or.id}
                                              </span>
                                              <span className={`text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded-full uppercase ${
                                                or.status === "Completed" ? "bg-emerald-50 text-emerald-700 border border-emerald-150" :
                                                or.status === "Cancelled" ? "bg-red-50 text-red-750 border border-red-155" :
                                                or.status === "Shipped" ? "bg-sky-50 text-sky-700 border border-sky-150" :
                                                or.status === "Processing" ? "bg-amber-50 text-amber-750 border border-amber-150" :
                                                "bg-rose-50 text-rose-700 border border-rose-150 animate-pulse"
                                              }`}>
                                                {or.status}
                                              </span>
                                            </div>

                                            {/* Date and Total info */}
                                            <div className="flex justify-between items-baseline text-[10px] text-stone-505 font-mono">
                                              <span>{new Date(or.date).toLocaleDateString()}</span>
                                              <span className="text-stone-955 font-bold">
                                                {formatPrice(or.totalPrice)} {or.discountApplied > 0 && `(Discount: ${formatPrice(or.discountApplied)})`}
                                              </span>
                                            </div>

                                            {/* Items display */}
                                            <div className="text-[10px] text-stone-550 border-t border-dashed border-stone-100 pt-1.5 pl-1 space-y-0.5">
                                              {or.items.map((item, keyIdx) => (
                                                <div key={keyIdx} className="flex justify-between items-center gap-2">
                                                  <span className="truncate font-sans text-stone-750">
                                                    {item.quantity} x {lang === "en" ? item.productNameEn : item.productNameBn}
                                                  </span>
                                                  <span className="font-mono text-stone-500 shrink-0">
                                                    {formatPrice(item.priceAtPurchase * item.quantity)}
                                                  </span>
                                                </div>
                                              ))}
                                            </div>

                                            {/* Quick receipts trigger */}
                                            <div className="pt-1.5 border-t border-stone-105 flex justify-end gap-1.5">
                                              <button
                                                onClick={() => setPrintingOrder(or)}
                                                className="bg-stone-900 hover:bg-stone-800 text-amber-400 font-mono text-[9px] px-2 py-0.5 rounded border border-stone-750 transition-colors uppercase font-bold cursor-pointer"
                                              >
                                                {lang === "en" ? "📄 Print Receipt" : "📄 রসিদ প্রিন্ট"}
                                              </button>
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {expandedCustomerPanel[user.phone] === "statement" && (() => {
                              const completedOrs = userOrders.filter(or => or.status === "Completed");
                              const pendingOrs = userOrders.filter(or => ["Pending", "Processing", "Shipped"].includes(or.status));

                              const totalSpent = completedOrs.reduce((sum, or) => sum + or.totalPrice, 0);
                              const pendingSpent = pendingOrs.reduce((sum, or) => sum + or.totalPrice, 0);

                              return (
                                <div className="bg-stone-900 border border-stone-800 rounded-sm p-3.5 space-y-3 animate-studio-reveal text-stone-100 font-mono text-[11px]">
                                  <div className="flex justify-between items-center border-b border-stone-800 pb-2">
                                    <h5 className="text-[10px] uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1.5">
                                      <FileText className="w-3 h-3 text-amber-400" />
                                      <span>{lang === "en" ? "Durable Financial Statement" : "আর্থিক লেনদেন বিবরণী"}</span>
                                    </h5>
                                    <span className="text-[8px] text-stone-450 tracking-widest uppercase font-bold">Verified Ledger</span>
                                  </div>

                                  {/* Metrics grid */}
                                  <div className="grid grid-cols-2 gap-2 bg-stone-950 p-2 border border-stone-880 rounded">
                                    <div className="space-y-0.5">
                                      <span className="text-stone-500 uppercase text-[8px] block font-bold">{lang === "en" ? "Spent (Settled):" : "পরিশোধিত:"}</span>
                                      <span className="text-emerald-400 font-bold font-sans text-xs">{formatPrice(totalSpent)}</span>
                                    </div>
                                    <div className="space-y-0.5">
                                      <span className="text-stone-500 uppercase text-[8px] block font-bold">{lang === "en" ? "Funds Pending:" : "প্রক্রিয়াধীন:"}</span>
                                      <span className="text-amber-450 font-bold font-sans text-xs">{formatPrice(pendingSpent)}</span>
                                    </div>
                                  </div>

                                  {/* Table-like ledger journal entries */}
                                  {userOrders.length === 0 ? (
                                    <p className="text-[10px] text-stone-500 italic text-center font-sans">
                                      {lang === "en" ? "No financial transits recorded." : "কোনো লেনদেনের রেকর্ড নেই।"}
                                    </p>
                                  ) : (
                                    <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                                      {userOrders.map((or) => {
                                        let entryType = lang === "en" ? "Order Checkout" : "অর্ডার চেকআউট";
                                        let amountStyle = "text-amber-400";
                                        if (or.status === "Completed") {
                                          entryType = lang === "en" ? "Settled Payment" : "পরিশোধিত তহবিল";
                                          amountStyle = "text-emerald-400";
                                        } else if (or.status === "Cancelled") {
                                          entryType = lang === "en" ? "Voided / Cancelled" : "বাতিল করা হয়েছে";
                                          amountStyle = "text-stone-505 line-through";
                                        }

                                        return (
                                          <div key={or.id} className="border-b border-stone-800 pb-1.5 last:border-0 last:pb-0 font-mono text-[9.5px]">
                                            <div className="flex justify-between items-baseline">
                                              <span className="text-stone-300 font-bold">#{or.id} — {entryType}</span>
                                              <span className={`font-sans font-bold ${amountStyle}`}>{formatPrice(or.totalPrice)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-[8.5px] text-stone-500 mt-0.5">
                                              <span>{new Date(or.date).toLocaleString()}</span>
                                              {or.paymentMethod ? (
                                                <span className="bg-stone-950 px-1 py-0.2 border border-stone-800 rounded text-stone-400 text-[8px]">
                                                  {or.paymentMethod.toUpperCase()}: {or.paymentSender || "N/A"} {or.paymentTrxId ? `[Trx: ${or.paymentTrxId}]` : ""}
                                                </span>
                                              ) : (
                                                <span className="italic text-stone-600 text-[8px]">Cash on Delivery</span>
                                              )}
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            ) : adminSubView === "inventory_report" ? (
              <AdminInventoryReportPanel
                lang={lang}
                products={products}
                googleAccessToken={googleAccessToken}
                googleClientId={googleClientId}
                onGoogleSignIn={googleDriveSignIn}
                setGoogleAccessToken={setGoogleAccessToken}
                onLogAction={addSystemLog}
                onRequestPrintOpen={(category, subcategory, filteredProds) => {
                  // Instant responsiveness: show the printable view locally in 0ms!
                  setPrintingInventoryCategory(category);
                  setPrintingInventorySubCategory(subcategory);
                  setPrintingInventoryProducts(filteredProds);

                  const isInsideIframe = checkIfInsideIframe();
                  if (isInsideIframe) {
                    const printUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?inventoryPrintCategory=${encodeURIComponent(category)}&inventoryPrintSubCategory=${encodeURIComponent(subcategory)}&print=true`;
                    window.open(printUrl, "_blank");
                  } else {
                    setTimeout(() => {
                      try {
                        window.print();
                      } catch (err) {
                        console.error("Manual window.print() failed:", err);
                      }
                    }, 50);
                  }
                }}
              />
            ) : adminSubView === "delivery_settings" ? (
              <AdminDeliverySettingsPanel
                lang={lang}
                settings={settings}
                setSettings={setSettings}
                products={products}
                setProducts={setProducts}
                addSystemLog={addSystemLog}
                setAdminSuccessNotification={setAdminSuccessNotification}
              />
            ) : adminSubView === "gdrive" ? (
              <GoogleDrivePanel
                lang={lang}
                orders={orders}
                setOrders={setOrders}
                products={products}
                setProducts={setProducts}
                registeredUsers={registeredUsers}
                setRegisteredUsers={setRegisteredUsers}
                settings={settings}
                onLogAction={addSystemLog}
                googleAccessToken={googleAccessToken}
                setGoogleAccessToken={setGoogleAccessToken}
                googleClientId={googleClientId}
                setGoogleClientId={setGoogleClientId}
                googleSheetId={googleSheetId}
                setGoogleSheetId={setGoogleSheetId}
              />
            ) : (
              <AtelierQrStickerSpace lang={lang} onLogAction={addSystemLog} />
            )}
          </div>
        )}

        {/* Highly Optimized Admin Action Spinner Overlay */}
        {isAdminLoading && (
          <div className="fixed inset-0 z-[99999] bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center">
            <div className="bg-stone-900 border border-emerald-500/35 p-6 rounded shadow-2xl flex flex-col items-center justify-center max-w-sm mx-auto text-center space-y-4 animate-pulse">
              <div className="relative">
                <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
                <span className="absolute inset-0 flex items-center justify-center text-emerald-300 text-[10px] font-mono font-bold">
                  RM
                </span>
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-mono font-semibold tracking-wider text-stone-100 uppercase">
                  {lang === "en" ? "Atelier Secure Processing" : "অ্যাডমিন প্যানেল প্রসেসিং"}
                </h4>
                <p className="text-[10px] font-mono text-emerald-400">
                  {adminLoadingMessage || (lang === "en" ? "Processing administrative action..." : "অনুরোধটি সম্পন্ন করা হচ্ছে...")}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    ) : (
          
          /* ==================== COMMERCE VISUAL FEED & CORE MARKET ==================== */
          <div className="space-y-12">
            


            {/* Core Segment: Search Feed Status & Catalog Grid */}
            <div className="space-y-6" id="product-matrix-grid">
              
              {/* Category Strip Title & Active Query Feedback */}
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-stone-200 pb-4">
                <h3 className="font-display font-medium text-stone-955 uppercase tracking-widest text-lg flex items-center gap-2">
                  <Compass className="w-5 h-5 text-stone-500" />
                  {selectedCategory === "All" ? DICTIONARY[lang].allProducts : CATEGORY_TRANSLATIONS[selectedCategory as Category][lang]}
                  <span className="text-xs font-mono font-normal text-stone-400">
                    ({filteredProducts.length} {lang === "en" ? "items available" : "টি পণ্য প্রস্তুত"})
                  </span>
                </h3>

                {searchQuery && (
                  <p className="text-xs font-mono text-stone-500">
                    {lang === "en" ? "Search filters active for: " : "খোঁজা হচ্ছে: "}
                    <span className="text-stone-900 font-bold bg-stone-200/60 px-2 py-1 rounded">"{searchQuery}"</span>
                  </p>
                )}
              </div>

              {/* No result check */}
              {filteredProducts.length === 0 ? (
                <div className="text-center py-20 bg-stone-100 rounded-sm border border-stone-200/50">
                  <AlertTriangle className="w-8 h-8 text-stone-400 mx-auto mb-3 animate-bounce" />
                  <p className="font-mono text-sm text-stone-600 font-bold uppercase tracking-wider">
                    {lang === "en" ? "No matches found in active atelier catalog" : "ক্যাটালগে কোনো পণ্য খুঁজে পাওয়া যায়নি"}
                  </p>
                  <p className="text-xs text-stone-400 mt-1">
                    {lang === "en" ? "Try adjusting category limits or search spelling keywords." : "অনুগ্রহ করে ক্যাটাগরি পরিবর্তন করুন বা বানানটি পুনরায় পরীক্ষা করুন।"}
                  </p>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="mt-4 px-4 py-2 bg-stone-955 text-white text-xs font-mono uppercase"
                      id="reset-search-on-empty"
                    >
                      Clear Search Query
                    </button>
                  )}
                </div>
              ) : (
                /* E-Commerce Bento Product Grid (2 columns on mobile, 3 on tablet, 4 on desktop) */
                <div className="space-y-8">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
                    {paginatedProducts.map((p) => {
                      return (
                        <div
                          key={p.id}
                          className="bg-white border border-stone-200/70 p-2.5 sm:p-4 rounded-sm flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:border-stone-400 group cursor-pointer"
                          id={`product-card-${p.id}`}
                          onClick={() => setSelectedProduct(p)}
                        >
                          {/* Image wrapper */}
                          <div className="relative overflow-hidden aspect-square bg-stone-100 rounded-sm mb-3 sm:mb-4">
                            <img
                              src={p.image}
                              alt={p.nameEn}
                              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                              referrerPolicy="no-referrer"
                              loading="lazy"
                              decoding="async"
                            />

                            {/* Wishlist overlay toggle button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleWishlist(p);
                              }}
                              className="absolute top-2 right-2 bg-white/85 hover:bg-white backdrop-blur-xs shadow-md p-1.5 sm:p-2 rounded-full hover:scale-110 active:scale-95 transition-all text-stone-800 z-10 cursor-pointer"
                              title={wishlist.some(item => item.id === p.id) ? DICTIONARY[lang].removeFromWishlist : DICTIONARY[lang].addToWishlist}
                              id={`wishlist-toggle-${p.id}`}
                            >
                              <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-colors ${wishlist.some(item => item.id === p.id) ? "fill-red-500 text-red-500" : "text-stone-600 hover:text-red-500"}`} />
                            </button>
                            
                            {/* Pricing overlays are removed here to keep images pristine, as they are fully visible directly below the card title */}

                            {p.inventory === 0 && (
                              <div className="absolute inset-0 bg-stone-900/80 backdrop-blur-[2kb] flex items-center justify-center">
                                <span className="text-white font-mono text-[9px] sm:text-xs tracking-widest uppercase border border-stone-700 px-2 py-0.5 sm:px-3 sm:py-1 bg-stone-955">
                                  {lang === "en" ? "SOLD OUT" : "স্টক শেষ"}
                                </span>
                              </div>
                            )}

                            {(p.inventory > 0 && p.inventory < 5 || pulsingInventoryProductId === p.id) && (
                              <span className={`absolute top-2 left-2 inline-flex items-center gap-1.5 text-[8px] sm:text-[9px] font-mono font-bold tracking-wider px-2 py-1 rounded shadow-sm border transition-all duration-300 z-10 ${
                                pulsingInventoryProductId === p.id
                                  ? "animate-inventory-save-pulse text-emerald-800 bg-emerald-100 border-emerald-200 shadow-md"
                                  : "bg-rose-100 text-rose-800 border-rose-200 animate-pulse"
                              }`}>
                                {pulsingInventoryProductId === p.id ? (
                                  <>
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                                    {lang === "en" ? `SAVED (${p.inventory} PCS)` : `সংরক্ষিত (${p.inventory} পিস)`}
                                  </>
                                ) : (
                                  <>
                                    <AlertTriangle className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                                    {lang === "en" ? `LOW STOCK (${p.inventory} LEFT)` : `কম স্টক (${p.inventory} টি)`}
                                  </>
                                )}
                              </span>
                            )}
                          </div>

                          {/* Text and Description Info */}
                          <div className="space-y-1.5 flex-grow flex flex-col justify-between">
                            <div className="space-y-1">
                              <span className="text-[8px] sm:text-[10px] font-mono tracking-widest text-stone-400 uppercase block">
                                {p.category}
                              </span>
                              <h4 
                                className="font-display font-medium text-stone-900 text-xs sm:text-sm leading-snug line-clamp-1 truncate"
                                id={`product-title-${p.id}`}
                              >
                                {lang === "en" ? p.nameEn : p.nameBn}
                              </h4>
                              <p className="text-[10px] sm:text-xs text-stone-505 line-clamp-2 leading-relaxed font-light h-7 sm:h-8">
                                {(lang === "en" ? p.descriptionEn : p.descriptionBn)?.replace(/<[^>]*>/g, " ")}
                              </p>
                            </div>

                            <div className="pt-2 sm:pt-3 border-t border-stone-100 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <div className="font-mono text-stone-955 font-bold text-xs sm:text-sm flex flex-col leading-tight">
                                  <span className="text-[10px] text-stone-400 font-sans tracking-tight font-normal">
                                    {lang === "en" ? "1 Piece Price" : "১ পিসের দাম"}
                                  </span>
                                  <div className="flex items-baseline gap-1 mt-0.5">
                                    {p.regularPrice && p.regularPrice > p.price && (
                                      <span className="text-stone-400 line-through text-[11px] font-normal font-mono mr-1">
                                        {formatPrice(p.regularPrice)}
                                      </span>
                                    )}
                                    <span className="text-stone-950 font-bold">
                                      {formatPrice(p.price)}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex gap-1 sm:gap-1.5">
                                  {/* Direct Admin Edit Trigger */}
                                  {isAdminAuthorized && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDirectEdit(p);
                                      }}
                                      className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 p-1 sm:p-1.5 rounded transition-transform text-[10px] sm:text-xs cursor-pointer flex items-center justify-center shrink-0"
                                      title={lang === "en" ? "Edit Product Specs" : "প্রোডাক্ট পরিবর্তন করুন"}
                                      id={`direct-edit-${p.id}`}
                                    >
                                      <Edit2 className="w-3.5 h-3.5 text-amber-700" />
                                    </button>
                                  )}

                                  {/* Quick add trigger */}
                                  {p.inventory > 0 && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        addToCart(p, 1);
                                      }}
                                      className="bg-stone-105 hover:bg-stone-200 text-stone-850 hover:scale-105 active:scale-95 text-[9px] sm:text-xs px-1.5 py-0.5 sm:px-2 sm:py-1 font-mono tracking-wider transition-colors uppercase rounded-sm border border-stone-200 cursor-pointer"
                                      id={`quick-add-${p.id}`}
                                    >
                                      {lang === "en" ? "ADD" : "কার্ট"}
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Buy Now Button next to/under price */}
                              {p.inventory > 0 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDirectCheckoutProduct(p);
                                    setDirectQty(1);
                                    if (p.category === "Clothing") {
                                      setDirectOption("M");
                                    } else if (p.category === "Perfume") {
                                      setDirectOption("100ml");
                                    } else if (p.category === "Watches") {
                                      setDirectOption("Metal Strap");
                                    } else {
                                      setDirectOption("Standard");
                                    }
                                    setDirectStep("checkout");
                                  }}
                                  className="w-full bg-amber-600 hover:bg-amber-700 active:scale-97 text-stone-50 text-[9px] sm:text-[11px] py-1 sm:py-1.5 font-mono tracking-widest font-bold transition-all uppercase rounded-sm text-center shadow-sm cursor-pointer"
                                  id={`buy-now-${p.id}`}
                                >
                                  {lang === "en" ? "BUY NOW" : "এখনই কিনুন"}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Clean Pagination Component */}
                  {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-stone-200 pt-6 mt-8 font-mono text-xs select-none" id="product-pagination-container">
                      <div className="text-stone-500 font-sans">
                        {lang === "en"
                          ? `Showing ${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, filteredProducts.length)} of ${filteredProducts.length} premium creations`
                          : `প্রদর্শিত হচ্ছে ${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, filteredProducts.length)} / ${filteredProducts.length} টি প্রিমিয়াম পণ্য`}
                      </div>

                      <div className="flex w-full sm:w-auto items-center gap-3">
                        {currentPage > 1 && (
                          <button
                            onClick={() => {
                              setCurrentPage((prev) => Math.max(prev - 1, 1));
                              window.scrollTo({ top: 350, behavior: "smooth" });
                            }}
                            className="flex-1 sm:flex-initial px-5 py-3.5 bg-stone-100 hover:bg-stone-200 border border-stone-300 text-stone-900 rounded-sm font-bold tracking-widest text-[11px] uppercase transition-all active:scale-97 cursor-pointer flex items-center justify-center gap-1.5"
                            id="pagination-prev-btn"
                          >
                            ← {lang === "en" ? "PREVIOUS" : "পূর্ববর্তী পৃষ্ঠা"}
                          </button>
                        )}
                        
                        {currentPage < totalPages ? (
                          <button
                            onClick={() => {
                              setCurrentPage((prev) => Math.min(prev + 1, totalPages));
                              window.scrollTo({ top: 350, behavior: "smooth" });
                            }}
                            className="flex-1 sm:flex-initial px-8 py-3.5 bg-amber-600 hover:bg-amber-700 text-white rounded-sm font-bold tracking-widest text-[11px] uppercase transition-all shadow-md active:scale-97 cursor-pointer flex items-center justify-center gap-2 font-mono"
                            id="pagination-next-btn"
                          >
                            <span>{lang === "en" ? "NEXT PAGE" : "পরবর্তী পৃষ্ঠা"}</span> / {lang === "en" ? `PAGE ${currentPage + 1}` : `পৃষ্ঠা ${currentPage + 1}`} →
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setCurrentPage(1);
                              window.scrollTo({ top: 350, behavior: "smooth" });
                            }}
                            className="flex-1 sm:flex-initial px-5 py-3.5 bg-stone-950 hover:bg-stone-900 text-white rounded-sm font-bold tracking-widest text-[11px] uppercase transition-all active:scale-97 cursor-pointer flex items-center justify-center gap-1.5"
                            id="pagination-reset-btn"
                          >
                            ♻ {lang === "en" ? "BACK TO FIRST PAGE" : "প্রথম পৃষ্ঠায় ফিরে যান"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ==================== ADMIN ORDER DETAIL DIALOG / MODAL ==================== */}
      {adminSelectedOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-start justify-center p-3 sm:p-6 bg-stone-900/80 backdrop-blur-sm animate-backdrop-fade print:hidden" id="admin-order-detail-modal">
          <div className="bg-white border border-stone-200 max-w-2xl w-full rounded-sm overflow-hidden shadow-2xl relative p-6 pb-24 md:p-8 md:pb-8 my-4 sm:my-8 animate-studio-reveal" id="admin-order-detail-card">
            
            {/* Header section with theme colors */}
            <div className="bg-stone-950 text-stone-100 p-4 -mx-6 -mt-6 sm:-mx-8 sm:-mt-8 mb-6 flex items-center justify-between border-b border-stone-800">
              <div className="text-left font-mono">
                <span className="text-[10px] text-amber-400 tracking-wider font-bold block uppercase">RIEMART ADMIN SYSTEMS</span>
                <h3 className="font-display font-black text-xs sm:text-sm tracking-wide text-white uppercase flex items-center gap-2 mt-0.5">
                  🔍 ORDER DETAILS: {adminSelectedOrder.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAdminSelectedOrder(null)}
                className="text-stone-400 hover:text-white transition-colors cursor-pointer bg-stone-900 p-1.5 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Status Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-stone-50 border border-stone-200 rounded p-4 mb-6 text-left font-mono">
              <div>
                <span className="text-[9px] text-stone-400 uppercase block">Status</span>
                <select
                  value={adminSelectedOrder.status}
                  onChange={(e) => updateOrderStatus(adminSelectedOrder.id, e.target.value as any)}
                  className="bg-white border border-stone-250 rounded px-2 py-1 text-[11px] text-stone-800 font-bold mt-1"
                >
                  <option value="Pending">Pending</option>
                  <option value="Processing">Processing</option>
                  <option value="Shipped">Shipped</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
              <div>
                <span className="text-[9px] text-stone-400 uppercase block">Created Date</span>
                <span className="text-[10px] font-bold text-stone-800 block mt-1">
                  {new Date(adminSelectedOrder.date).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-[9px] text-stone-400 uppercase block">Location Type</span>
                <span className="text-[10px] font-bold text-stone-800 block mt-1 uppercase">
                  {adminSelectedOrder.customerAddress?.toLowerCase().includes("dhaka") ? "Dhaka Area" : "Outer Area"}
                </span>
              </div>
              <div>
                <span className="text-[9px] text-stone-400 uppercase block">Grand Total</span>
                <span className="text-[11px] font-bold text-amber-600 block mt-1">
                  {formatPrice(adminSelectedOrder.totalPrice)}
                </span>
              </div>
            </div>

            {/* Customer Contact Card */}
            <div className="border border-stone-200 rounded p-4 mb-6 bg-stone-50/50 text-left">
              <h4 className="font-mono text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-3 pb-1 border-b border-stone-150">
                👤 CUSTOMER INFO & CONTACTS
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                <div className="space-y-1">
                  <p><span className="text-stone-400">Buyer Name:</span> <strong className="text-stone-900 font-sans">{adminSelectedOrder.customerName}</strong></p>
                  <p>
                    <span className="text-stone-400">Phone Number:</span>{" "}
                    <span className="bg-stone-200 text-stone-800 px-1 py-0.2 rounded font-sans select-all font-bold">
                      {adminSelectedOrder.customerPhone}
                    </span>
                  </p>
                </div>
                <div className="space-y-1">
                  <p><span className="text-stone-400">Shipping Address:</span> <span className="text-stone-700 font-sans">{adminSelectedOrder.customerAddress || "N/A"}</span></p>
                  {adminSelectedOrder.comment && (
                    <p><span className="text-stone-400">Notes / Remarks:</span> <span className="text-stone-600 italic font-sans">{adminSelectedOrder.comment}</span></p>
                  )}
                </div>
              </div>
            </div>

            {/* Payment Details */}
            <div className="border border-stone-200 rounded p-4 mb-6 bg-stone-50/50 text-left">
              <h4 className="font-mono text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-3 pb-1 border-b border-stone-150">
                💳 TRANSACTION DETAILS
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                <div className="space-y-1">
                  <p>
                    <span className="text-stone-400">Payment Channel:</span>{" "}
                    <span className={`font-black ${adminSelectedOrder.paymentMethod && adminSelectedOrder.paymentMethod !== "COD" ? "text-rose-600 font-sans" : "text-stone-800"}`}>
                      {getPaymentMethodDisplay(adminSelectedOrder.paymentMethod, lang)}
                    </span>
                  </p>
                </div>
                <div className="space-y-1">
                  {adminSelectedOrder.paymentSender && (
                    <p><span className="text-stone-400">Sender Number:</span> <span className="text-stone-850 font-bold">{adminSelectedOrder.paymentSender}</span></p>
                  )}
                  {adminSelectedOrder.paymentTrxId && (
                    <p>
                      <span className="text-stone-400">Transaction TrxID:</span>{" "}
                      <span className="bg-amber-105 text-stone-900 px-1 py-0.2 rounded select-all font-bold">
                        {adminSelectedOrder.paymentTrxId}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Ordered Products Queue */}
            <div className="border border-stone-200 rounded p-4 mb-6 text-left">
              <h4 className="font-mono text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-3 pb-1 border-b border-stone-150">
                📦 BASKET ITEMS ({adminSelectedOrder.items.length})
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {adminSelectedOrder.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs font-mono border-b border-stone-100 pb-2">
                    <div className="text-left">
                      <p className="font-semibold text-stone-850 font-sans">
                        {lang === "en" ? it.productNameEn : it.productNameBn}
                      </p>
                      <span className="text-[10px] text-stone-400">Qty {it.quantity} x {formatPrice(it.priceAtPurchase)}</span>
                    </div>
                    <span className="font-bold text-stone-900">
                      {formatPrice(it.priceAtPurchase * it.quantity)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center font-black text-stone-950 text-xs mt-3 pt-3 border-t border-stone-200">
                <span>TOTAL PAYABLE:</span>
                <span className="text-sm font-sans underline decoration-amber-500 decoration-2">{formatPrice(adminSelectedOrder.totalPrice)}</span>
              </div>
            </div>

            {/* Quick Actions Drawer */}
            <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-stone-200">
              <button
                type="button"
                onClick={() => {
                  setActiveAppendOrderId(adminSelectedOrder.id);
                  setAdminSelectedOrder(null);
                  setSelectedCategory("All");
                  setSelectedSubCategory(null);
                  setShowAdminPortal(false);
                  const el = document.getElementById("search-bar");
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                  }
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-mono font-bold px-3 py-2 rounded-sm uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-sm border border-emerald-500"
                title="Add more items to this order for the customer"
              >
                <ShoppingCart className="w-3.5 h-3.5 animate-pulse" />
                {lang === "en" ? "Add items" : "প্রোডাক্ট যোগ করুন"}
              </button>

              <div className="flex items-center gap-2">
                {/* Print Invoice Button using Smart Tab opens to fully bypass pop-up block */}
                <a
                  href={isInsideIframe ? getPrintUrl(adminSelectedOrder.id) : "#"}
                  target={isInsideIframe ? "_blank" : undefined}
                  onClick={isInsideIframe ? undefined : (e) => {
                    e.preventDefault();
                    setPrintingOrder(adminSelectedOrder);
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-stone-50 border border-amber-500 font-mono font-bold px-3 py-2 rounded-sm text-[11px] uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-sm select-none"
                >
                  <Printer className="w-3.5 h-3.5 text-stone-50" />
                  {lang === "en" ? "Print Invoice" : "প্রিন্ট ইনভয়েস"}
                </a>

                <button
                  type="button"
                  onClick={() => setAdminSelectedOrder(null)}
                  className="bg-stone-800 hover:bg-stone-700 text-stone-300 text-[11px] font-mono px-3 py-2 rounded-sm uppercase tracking-wider transition-all cursor-pointer border border-stone-700"
                >
                  {lang === "en" ? "Close" : "বন্ধ করুন"}
                </button>
              </div>
            </div>

            {/* Bouncing Floating Print Button at bottom right corner specifically for this details view to keep it highly action-focused */}
            <a
              href={isInsideIframe ? getPrintUrl(adminSelectedOrder.id) : "#"}
              target={isInsideIframe ? "_blank" : undefined}
              onClick={isInsideIframe ? undefined : (e) => {
                e.preventDefault();
                setPrintingOrder(adminSelectedOrder);
              }}
              className="fixed bottom-6 right-6 md:bottom-8 md:right-8 bg-amber-600 text-white hover:bg-amber-700 animate-bounce hover:scale-105 active:scale-95 shadow-2xl rounded-full p-4 flex items-center justify-center gap-2 border border-amber-500 z-55 transition-all text-xs font-black font-mono tracking-widest uppercase select-none"
              title={lang === "en" ? "Instant Print" : "দ্রুত প্রিন্ট করুন"}
            >
              <Printer className="w-5 h-5 text-white animate-pulse shrink-0" />
              <span>{lang === "en" ? "Print Invoice" : "প্রিন্ট ইনভয়েস"}</span>
            </a>

          </div>
        </div>
      )}

      {/* ==================== SECURE ATELIER CONFIRMATION DIALOG ==================== */}
      {safeConfirmDialog && (
        <div 
          className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-stone-950/75 animate-backdrop-fade-fast print:hidden" 
          id="safe-confirmation-dialog"
        >
          <div 
            className="bg-white border border-stone-200 max-w-md w-full rounded shadow-2xl overflow-hidden animate-confirm-reveal"
            id="safe-confirm-card"
          >
            <div className="bg-stone-955 text-stone-100 p-4 flex items-center justify-between border-b border-stone-850 font-mono">
              <span className="text-[10px] text-amber-400 tracking-wider font-bold uppercase flex items-center gap-1.5">
                ⚙️ {safeConfirmDialog.title}
              </span>
              <button
                type="button"
                onClick={() => setSafeConfirmDialog(null)}
                className="text-stone-400 hover:text-white transition-colors cursor-pointer bg-stone-900 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-6 text-left font-sans">
              <p className="text-xs sm:text-sm text-stone-750 font-medium leading-relaxed">
                {safeConfirmDialog.message}
              </p>
            </div>

            <div className="bg-stone-50 px-6 py-4 flex items-center justify-end gap-2.5 border-t border-stone-150 font-mono">
              <button
                type="button"
                onClick={() => setSafeConfirmDialog(null)}
                className="px-3.5 py-1.5 border border-stone-250 text-stone-600 hover:text-stone-800 hover:bg-stone-100 rounded text-xs transition-colors uppercase font-medium cursor-pointer"
              >
                {lang === "en" ? "Cancel" : "বাতিল"}
              </button>
              <button
                type="button"
                onClick={() => {
                  safeConfirmDialog.onConfirm();
                  setSafeConfirmDialog(null);
                }}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold transition-all uppercase tracking-wider cursor-pointer shadow-sm border border-red-500"
              >
                {lang === "en" ? "Confirm" : "নিশ্চিত করুন"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== PRODUCT DETAIL DIALOG / MODAL ==================== */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-start sm:items-center justify-center p-2 sm:p-4 bg-stone-955/70 backdrop-blur-sm animate-studio-reveal print:hidden" id="product-detail-modal">
          <div className="bg-white border border-stone-200 max-w-3xl w-full rounded-sm overflow-hidden relative shadow-2xl flex flex-col md:flex-row animate-studio-reveal my-4 sm:my-auto">
            
            {/* Close button */}
            <button
              onClick={() => setSelectedProduct(null)}
              className="absolute top-4 right-4 bg-white/90 border border-stone-200 text-stone-900 p-1.5 rounded-full hover:bg-stone-100 z-10 transition-colors cursor-pointer"
              id="close-product-detail-modal"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Left Col: Dynamic Image display with visual carousel arrows & slide navigation */}
            <div className="md:w-1/2 bg-stone-50 select-none relative min-h-[260px] sm:min-h-[360px] md:min-h-full flex flex-col justify-between p-4 border-b md:border-b-0 md:border-r border-stone-150">
              {/* Main Active image container with relative slider actions */}
              <div className="flex-1 relative flex items-center justify-center overflow-hidden min-h-[200px] sm:min-h-[280px]">
                {(() => {
                  const availableImages = (selectedProduct.images && selectedProduct.images.filter(img => img.trim() !== "")) || [];
                  const finalImages = availableImages.length > 0 ? availableImages : [selectedProduct.image];
                  const currentImgUrl = finalImages[activeImageIndex] || selectedProduct.image;

                  return (
                    <>
                      <img 
                        key={activeImageIndex}
                        src={currentImgUrl} 
                        alt={selectedProduct.nameEn} 
                        className="w-full h-full max-h-[240px] sm:max-h-[380px] object-contain transition-all duration-305 transform scale-100 hover:scale-[1.01] animate-studio-reveal" 
                        id="dialog-main-preview-photo"
                        decoding="async"
                      />

                      {/* Floating Wishlist Heart Toggle button over the image (bottom-left corner) */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleWishlist(selectedProduct);
                        }}
                        className="absolute bottom-4 left-4 bg-white/95 border border-stone-250 p-2.5 rounded-full hover:bg-stone-50 text-stone-900 z-20 shadow-md hover:scale-110 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                        id="modal-toggle-wishlist-overlay"
                        title={wishlist.some((item) => item.id === selectedProduct.id) ? DICTIONARY[lang].removeFromWishlist : DICTIONARY[lang].addToWishlist}
                      >
                        <Heart className={`w-4 h-4 transition-colors ${wishlist.some((item) => item.id === selectedProduct.id) ? "fill-red-500 text-red-500" : "text-stone-605"}`} />
                      </button>

                      {/* Carousel Progress Dot Indicators */}
                      {finalImages.length > 1 && (
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10 bg-stone-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-stone-800 shadow-lg">
                          {finalImages.map((_, dotIdx) => (
                            <button
                              key={dotIdx}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveImageIndex(dotIdx);
                              }}
                              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                                dotIdx === activeImageIndex 
                                  ? "bg-amber-500 scale-125 shadow-sm shadow-amber-500/50" 
                                  : "bg-stone-400 hover:bg-stone-250"
                              }`}
                              title={`Slide ${dotIdx + 1}`}
                            />
                          ))}
                        </div>
                      )}

                      {/* Slider Navigation arrows */}
                      {finalImages.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveImageIndex((prev) => (prev === 0 ? finalImages.length - 1 : prev - 1));
                            }}
                            className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 border border-stone-200/85 p-1.5 rounded-full hover:bg-stone-955 hover:text-white transition-colors cursor-pointer shadow-sm z-10"
                            title="Previous Slide"
                            id="btn-slide-prev"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveImageIndex((prev) => (prev === finalImages.length - 1 ? 0 : prev + 1));
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 border border-stone-300/85 p-1.5 rounded-full hover:bg-stone-955 hover:text-white transition-colors cursor-pointer shadow-sm z-10"
                            title="Next Slide"
                            id="btn-slide-next"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Thumbnails row / Navigation dots */}
              {(() => {
                const availableImages = (selectedProduct.images && selectedProduct.images.filter(img => img.trim() !== "")) || [];
                const finalImages = availableImages.length > 0 ? availableImages : [selectedProduct.image];
                
                if (finalImages.length <= 1) return null;
                return (
                  <div className="flex gap-2 justify-center items-center overflow-x-auto py-2.5 px-1 border-t border-stone-150 mt-2" id="dialog-thumbnails-carousel-tray">
                    {finalImages.map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveImageIndex(idx)}
                        className={`w-11 h-11 border bg-white rounded overflow-hidden shrink-0 transition-all ${
                          idx === activeImageIndex 
                          ? "border-amber-500 scale-105 shadow-sm ring-1 ring-amber-500/20" 
                          : "border-stone-200 hover:border-stone-400 grayscale hover:grayscale-0 opacity-70 hover:opacity-100"
                        }`}
                        id={`thumbnail-control-${idx}`}
                      >
                        <img src={img} className="w-full h-full object-cover" decoding="async" loading="lazy" />
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Right Col: Details */}
            <div className="md:w-1/2 p-6 sm:p-8 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-mono tracking-widest text-stone-400 uppercase">
                    {selectedProduct.category}
                  </span>
                  <h3 className="font-display font-semibold text-lg text-stone-900 mt-1" id="modal-product-title">
                    {lang === "en" ? selectedProduct.nameEn : selectedProduct.nameBn}
                  </h3>
                  <div className="font-mono text-stone-955 text-base mt-2 flex flex-col bg-stone-50 border border-stone-200 rounded p-2.5 space-y-1">
                    <span className="text-[10px] text-stone-400 font-sans tracking-wide uppercase font-normal">
                      {lang === "en" ? "Price per Piece (1 Pcs)" : "১ পিসের দাম (প্রতি পিস)"}
                    </span>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      {selectedProduct.regularPrice && selectedProduct.regularPrice > selectedProduct.price && (
                        <span className="text-stone-400 line-through text-xs sm:text-sm font-normal">
                          {formatPrice(selectedProduct.regularPrice)}
                        </span>
                      )}
                      <span className="text-base sm:text-lg text-stone-955 font-bold">
                        {formatPrice(selectedProduct.price)}
                      </span>
                      {selectedProduct.regularPrice && selectedProduct.regularPrice > selectedProduct.price && (
                        <span className="bg-red-50/10 text-red-600 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-red-200">
                          {lang === "en" ? "SAVE" : "সাশ্রয়"} {Math.round(((selectedProduct.regularPrice - selectedProduct.price) / selectedProduct.regularPrice) * 100)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Narrative Description Dropdown Accordion */}
                <div className="space-y-1" id="product-narrative-dropdown-wrapper">
                  <div className="border border-stone-200 rounded overflow-hidden bg-white shadow-sm">
                    <button
                      type="button"
                      id="product-narrative-toggle-btn"
                      onClick={() => setIsNarrativeExpanded(!isNarrativeExpanded)}
                      className="w-full flex items-center justify-between p-3 bg-stone-50 hover:bg-stone-100/90 transition-colors cursor-pointer text-left focus:outline-none"
                    >
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10.5px] font-mono font-bold text-stone-800 uppercase tracking-wider">
                          {DICTIONARY[lang].productDetails}
                        </span>
                        <div className="flex items-center gap-1">
                          {selectedProduct.descriptionEn && (
                            <span className="text-[8px] font-mono font-semibold bg-stone-200 text-stone-700 px-1 py-0.5 rounded uppercase tracking-tight">EN</span>
                          )}
                          {selectedProduct.descriptionBn && (
                            <span className="text-[8px] font-mono font-semibold bg-stone-200 text-stone-700 px-1 py-0.5 rounded uppercase tracking-tight">BN</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-stone-400">
                        <span className="text-[9px] font-mono font-medium hidden sm:inline uppercase">
                          {isNarrativeExpanded 
                            ? (lang === "en" ? "Collapse" : "বন্ধ করুন") 
                            : (lang === "en" ? "Expand" : "খুলুন")}
                        </span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${isNarrativeExpanded ? "rotate-180 text-stone-700" : "text-stone-400"}`} />
                      </div>
                    </button>

                    <AnimatePresence initial={false}>
                      {isNarrativeExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <div className="p-3.5 border-t border-stone-200 bg-white space-y-3">
                            {/* Inner language toggle pills and Speaker option */}
                            <div className="flex items-center justify-between pb-2.5 border-b border-stone-150 gap-2 flex-wrap" id="narrative-inner-lang-tabs-and-speaker">
                              {/* Left side: either the dual language tabs, or a clean label */}
                              {selectedProduct.descriptionEn && selectedProduct.descriptionBn ? (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[8.5px] font-mono text-stone-400 uppercase tracking-wider mr-1">
                                    {lang === "en" ? "Viewing Language:" : "ভাষা পরিবর্তন:"}
                                  </span>
                                  <button
                                    type="button"
                                    id="narrative-lang-en-btn"
                                    onClick={() => setNarrativeActiveLang("en")}
                                    className={`px-2 py-0.5 text-[9px] font-mono font-medium rounded transition-all cursor-pointer ${
                                      narrativeActiveLang === "en"
                                        ? "bg-stone-900 text-amber-400 font-bold"
                                        : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                                    }`}
                                  >
                                    English
                                  </button>
                                  <button
                                    type="button"
                                    id="narrative-lang-bn-btn"
                                    onClick={() => setNarrativeActiveLang("bn")}
                                    className={`px-2 py-0.5 text-[9px] font-mono font-medium rounded transition-all cursor-pointer ${
                                      narrativeActiveLang === "bn"
                                        ? "bg-stone-900 text-amber-400 font-bold"
                                        : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                                    }`}
                                  >
                                    বাংলা
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[8.5px] font-mono text-stone-400 uppercase tracking-wider">
                                  {lang === "en" ? "Product Description Reader:" : "পণ্যের বিবরণী ভয়েস রিডার:"}
                                </span>
                              )}

                              {/* Voice Speaker Button */}
                              <button
                                type="button"
                                id="narrative-speaker-voice-btn"
                                onClick={() => handleNarrativeSpeech(selectedProduct, narrativeActiveLang)}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded border transition-all cursor-pointer select-none text-[9px] font-mono font-bold uppercase active:scale-95 ${
                                  isSpeaking
                                    ? "bg-red-50 text-red-600 border-red-200 animate-pulse"
                                    : "bg-amber-400 text-stone-900 border-amber-500 hover:bg-amber-350"
                                }`}
                                title={isSpeaking ? (lang === "en" ? "Stop Speaking" : "ভয়েস বন্ধ করুন") : (lang === "en" ? "Listen Narrative" : "ভয়েস শুনুন")}
                              >
                                {isSpeaking ? (
                                  <>
                                    <VolumeX className="w-3 h-3 text-red-600 animate-bounce" />
                                    <span>{lang === "en" ? "Stop" : "থামুন"}</span>
                                  </>
                                ) : (
                                  <>
                                    <Volume2 className="w-3 h-3 text-stone-850" />
                                    <span>{lang === "en" ? "Listen Voice" : "ভয়েস শুনুন"}</span>
                                  </>
                                )}
                              </button>
                            </div>

                            {/* Render description text block */}
                            <div 
                              className="text-xs text-stone-650 leading-relaxed font-light font-sans [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1"
                              dangerouslySetInnerHTML={{
                                __html: (
                                  selectedProduct.descriptionEn && selectedProduct.descriptionBn
                                    ? (narrativeActiveLang === "en" ? selectedProduct.descriptionEn : selectedProduct.descriptionBn)
                                    : (selectedProduct.descriptionEn || selectedProduct.descriptionBn || "")
                                )
                              }}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Technical specs or bullet matrices */}
                {(selectedProduct.specificationsEn || selectedProduct.specificationsBn) && (
                  <div className="bg-stone-50 p-2.5 rounded border border-stone-150 text-[11px] font-light text-stone-650 space-y-1 overflow-y-auto max-h-[120px]">
                    <h5 className="font-mono text-[9px] text-stone-450 uppercase tracking-widest mb-1">
                      {DICTIONARY[lang].specifications}
                    </h5>
                    {(lang === "en" ? selectedProduct.specificationsEn : selectedProduct.specificationsBn)?.map((spec, index) => (
                      <p key={index} className="flex items-center gap-1.5">
                        <span className="text-stone-400 font-bold">▪</span> {spec}
                      </p>
                    ))}
                  </div>
                )}

                {/* Multi-Buy Progress Estimator Widget */}
                {settings.buyMoreSaveMoreEnabled && (
                  <div className="bg-amber-50/60 p-3.5 rounded border border-amber-200/50 text-[11px]">
                    <p className="font-mono font-bold text-amber-900 uppercase tracking-wide flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      {DICTIONARY[lang].buyMoreSaveMore}
                    </p>
                    <p className="text-stone-600 mt-1">
                      {lang === "en" 
                        ? `Add ${settings.tier2Qty} or more items to eligible bundle to get ${settings.tier2Discount}% off immediately. Buy ${settings.tier3Qty}+ for ${settings.tier3Discount}% off.`
                        : `একসাথে ${settings.tier2Qty} টি কিনলে সরাসরি ${settings.tier2Discount}% ডিসকাউন্ট এবং ${settings.tier3Qty} টি বা তার বেশি কিনলে ${settings.tier3Discount}% ছাড়।`}
                    </p>
                  </div>
                )}

                {/* Real-time Inventory State */}
                <div className="text-xs font-mono font-semibold tracking-wide flex items-center gap-1.5 mt-2">
                  <span className="text-stone-400 uppercase">AVAILABILITY RESERVES: </span>
                  <span className={selectedProduct.inventory > 0 ? "text-emerald-600 font-bold" : "text-red-500 font-bold"}>
                    {selectedProduct.inventory > 0 
                      ? `${selectedProduct.inventory} ${DICTIONARY[lang].inventoryState}` 
                      : "Depleted"}
                  </span>
                </div>

                {/* Price Drop Alert (Notify Me) Form */}
                <div className="bg-stone-50 border border-stone-200/85 p-3.5 rounded-sm space-y-2 mt-4 text-left" id="price-drop-subscribe-container">
                  <div className="flex items-center gap-1.5 text-stone-900 justify-start">
                    <Bell className="w-3.5 h-3.5 text-amber-500" />
                    <h5 className="font-sans font-semibold text-xs tracking-wide uppercase">
                      {DICTIONARY[lang].notifyMeTitle}
                    </h5>
                  </div>
                  
                  <p className="text-[11px] text-stone-500 font-sans leading-relaxed text-left">
                    {DICTIONARY[lang].notifyMeDesc}
                  </p>

                  <form onSubmit={handlePriceDropSubscribe} className="flex gap-2 mt-2" id="price-drop-subscribe-form">
                    <input
                      type="text"
                      value={notifyContactInput}
                      onChange={(e) => setNotifyContactInput(e.target.value)}
                      placeholder={DICTIONARY[lang].notifyPlaceholder}
                      className="flex-1 bg-white border border-stone-200 rounded px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-stone-900 text-stone-900 font-mono"
                      id="notify-me-contact-input"
                      required
                    />
                    <button
                      type="submit"
                      className="bg-stone-900 hover:bg-stone-850 text-white text-[10px] font-mono font-bold px-3 uppercase tracking-wider rounded-sm shrink-0 cursor-pointer transition-all border border-stone-900"
                    >
                      {lang === "en" ? "Subscribe" : "সাবস্ক্রাইব"}
                    </button>
                  </form>
                </div>

                {/* Admin direct bypass panel */}
                {loggedInUser?.isAdmin && (
                  <div className="bg-amber-50/70 border-2 border-dashed border-amber-300 p-3 rounded-sm text-xs leading-relaxed space-y-2 mt-4 text-left">
                    <p className="font-bold text-amber-900 flex items-center gap-1.5 font-mono text-[10px]">
                      <span>⚡</span> {lang === "en" ? "ADMIN BYPASS COORDINATES" : "অ্যাডমিন বাইপাস প্যানেল"}
                    </p>
                    <p className="text-[11px] font-sans text-stone-600 leading-relaxed">
                      {lang === "en" 
                        ? "Click to open direct real-time visual editing interface for this product." 
                        : "এই প্রডাক্ট রিভিশন করতে সরাসরি ইনস্ট্যান্ট এডিটিং ইন্টারফেস খুলুন।"}
                    </p>
                  </div>
                )}
              </div>

              {/* Add to buy buttons row inside dialog */}
              <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center border-t border-stone-200 pt-5">
                {selectedProduct.inventory > 0 ? (
                  <div className="flex-1 flex flex-col sm:flex-row gap-2">
                    {/* Add to Bag */}
                    <button
                      onClick={() => {
                        addToCart(selectedProduct, 1);
                        setSelectedProduct(null);
                      }}
                      className="flex-1 bg-stone-900 hover:bg-stone-850 text-white text-xs font-mono font-bold py-3 uppercase rounded-sm tracking-wider flex items-center justify-center gap-1.5 cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-all"
                      id="modal-add-to-bag"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>{DICTIONARY[lang].addToBag}</span>
                    </button>

                    {/* Buy Now / Direct Checkout */}
                    <button
                      onClick={() => {
                        setDirectCheckoutProduct(selectedProduct);
                        setDirectQty(1);
                        if (selectedProduct.category === "Clothing") {
                          setDirectOption("M");
                        } else if (selectedProduct.category === "Perfume") {
                          setDirectOption("100ml");
                        } else if (selectedProduct.category === "Watches") {
                          setDirectOption("Metal Strap");
                        } else {
                          setDirectOption("Standard");
                        }
                        setDirectStep("checkout");
                        setSelectedProduct(null);
                      }}
                      className="flex-1 bg-amber-600 hover:bg-amber-650 text-white text-xs font-mono font-bold py-3 uppercase rounded-sm tracking-wider flex items-center justify-center gap-1.5 cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-all"
                      id="modal-buy-now"
                    >
                      <ArrowRight className="w-4 h-4" />
                      <span>{DICTIONARY[lang].buyNow}</span>
                    </button>
                  </div>
                ) : (
                  <button
                    disabled
                    className="flex-1 bg-stone-200 text-stone-400 text-xs font-mono py-3 uppercase rounded-sm cursor-not-allowed"
                    id="modal-sold-out-status"
                  >
                    RESERVES DEPLETED
                  </button>
                )}
              </div>

            </div>

          </div>
        </div>
      )}

      {/* ==================== DIRECT BUY NOW CHECKOUT MODAL ==================== */}
      {directCheckoutProduct && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto print:hidden" id="direct-checkout-backdrop">
          <div className="relative w-full max-w-lg bg-white rounded-sm border border-stone-200 shadow-2xl overflow-hidden animate-studio-reveal" id="direct-checkout-container">
            
            {/* Modal Header */}
            <div className="p-4 bg-stone-950 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-amber-500" />
                <h3 className="font-display font-medium text-xs tracking-widest uppercase">
                  {directStep === "checkout" 
                    ? (lang === "en" ? "DIRECT checkout panel" : "সরাসরি অর্ডার ও পেমেন্ট প্যানেল")
                    : (lang === "en" ? "ORDER CONFIRMED SUCCESS" : "অর্ডার সফলভাবে নিশ্চিত হয়েছে")}
                </h3>
              </div>
              <button
                onClick={() => setDirectCheckoutProduct(null)}
                className="text-stone-400 hover:text-white p-1 rounded-sm hover:bg-stone-850 transition-colors cursor-pointer"
                id="close-direct-checkout"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {directStep === "checkout" ? (
              <form onSubmit={handlePlaceDirectOrder} className="flex flex-col text-left">
                {/* Modal Body */}
                <div className="p-5 overflow-y-auto max-h-[70vh] space-y-4 text-stone-800" id="direct-checkout-body">
                  
                  {/* Spotlight Item Info and dynamic specifications */}
                  <div className="flex gap-4 p-3 bg-stone-50 border border-stone-150 rounded-sm">
                    <img 
                      src={directCheckoutProduct.image} 
                      alt={directCheckoutProduct.nameEn} 
                      className="w-16 h-16 object-cover rounded border border-stone-250 shrink-0" 
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-bold border border-amber-200 inline-block mb-1">
                        {CATEGORY_TRANSLATIONS[directCheckoutProduct.category]?.[lang] || directCheckoutProduct.category}
                      </span>
                      <h4 className="font-display font-medium text-stone-900 text-xs sm:text-sm truncate">
                        {lang === "en" ? directCheckoutProduct.nameEn : directCheckoutProduct.nameBn}
                      </h4>
                      <p className="font-mono text-stone-550 text-xs mt-0.5 font-bold">
                        {lang === "en" ? `Premium Price: ` : `প্রিমিয়াম মূল্য: `}
                        <span className="text-stone-900 text-sm font-black">{formatPrice(directCheckoutProduct.price)}</span>
                      </p>
                    </div>
                  </div>

                  {/* 1. Product Options Selection */}
                  <div className="space-y-1.5 pt-1">
                    <label className="block text-[10px] font-mono text-stone-505 uppercase tracking-wide font-bold">
                      {lang === "en" ? "1. Select Product Option (সাইজ / অন্যান্য অপশন)" : "১. প্রোডাক্ট অপশন নির্বাচন করুন (সাইজ / ধরণ)"} *
                    </label>
                    <div className="flex flex-wrap gap-2 pt-0.5">
                      {directCheckoutProduct.category === "Clothing" ? (
                        ["S", "M", "L", "XL", "XXL"].map((sz) => (
                          <button
                            key={sz}
                            type="button"
                            onClick={() => setDirectOption(sz)}
                            className={`px-3 py-1.5 text-xs font-bold font-mono rounded-sm border transition-all cursor-pointer ${
                              directOption === sz
                                ? "bg-stone-900 border-stone-900 text-amber-400 font-extrabold"
                                : "bg-white border-stone-200 text-stone-700 hover:border-stone-400"
                            }`}
                            style={{ minWidth: "44px" }}
                          >
                            {sz}
                          </button>
                        ))
                      ) : directCheckoutProduct.category === "Perfume" ? (
                        ["50ml Bottle", "100ml Bottle", "Premium Oil Extract"].map((pf) => (
                          <button
                            key={pf}
                            type="button"
                            onClick={() => setDirectOption(pf)}
                            className={`px-3 py-1.5 text-xs font-sans rounded-sm border transition-all cursor-pointer ${
                              directOption === pf
                                ? "bg-stone-900 border-stone-900 text-amber-400 font-bold"
                                : "bg-white border-stone-200 text-stone-700 hover:border-stone-400"
                            }`}
                          >
                            {lang === "en" ? pf : (pf === "50ml Bottle" ? "৫০ মিলি বোতল" : pf === "100ml Bottle" ? "১০০ মিলি বোতল" : "প্রিমিয়াম অয়েল")}
                          </button>
                        ))
                      ) : directCheckoutProduct.category === "Watches" ? (
                        ["Leather Strap", "Metal Chain", "NATO Strap"].map((wt) => (
                          <button
                            key={wt}
                            type="button"
                            onClick={() => setDirectOption(wt)}
                            className={`px-3 py-1.5 text-xs font-sans rounded-sm border transition-all cursor-pointer ${
                              directOption === wt
                                ? "bg-stone-900 border-stone-900 text-amber-400 font-bold"
                                : "bg-white border-stone-200 text-stone-700 hover:border-stone-400"
                            }`}
                          >
                            {lang === "en" ? wt : (wt === "Leather Strap" ? "চামড়ার স্ট্র্যাপ" : wt === "Metal Chain" ? "মেটাল চেইন" : "ন্যাটো বেল্ট")}
                          </button>
                        ))
                      ) : (
                        ["Standard Edition", "Premium Atelier Pack"].map((op) => (
                          <button
                            key={op}
                            type="button"
                            onClick={() => setDirectOption(op)}
                            className={`px-3 py-1.5 text-xs font-sans rounded-sm border transition-all cursor-pointer ${
                              directOption === op
                                ? "bg-stone-900 border-stone-900 text-amber-400 font-bold"
                                : "bg-white border-stone-200 text-stone-700 hover:border-stone-400"
                            }`}
                          >
                            {lang === "en" ? op : (op === "Standard Edition" ? "স্ট্যান্ডার্ড সংস্করণ" : "প্রিমিয়াম প্যাক")}
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  {/* 2. Quantity Selector */}
                  <div className="flex justify-between items-center border-t border-stone-100 pt-3">
                    <div>
                      <label className="block text-[10px] font-mono text-stone-505 uppercase tracking-wide font-bold">
                        {lang === "en" ? "2. Quantity (কত পিস নিবেন)" : "২. পরিমাণ নির্বাচন করুন (কত পিস)"} *
                      </label>
                      <p className="text-[10px] text-stone-400 font-sans mt-0.5">
                        {lang === "en" 
                          ? `Atelier reserve left: ${directCheckoutProduct.inventory} Pcs` 
                          : `স্টুডিও মজুদ অবশিষ্ট: ${directCheckoutProduct.inventory} পিস`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 bg-stone-50 border border-stone-200 p-1 px-2 rounded-sm select-none">
                      <button
                        type="button"
                        onClick={() => setDirectQty((q) => Math.max(1, q - 1))}
                        className="bg-white hover:bg-stone-100 border border-stone-300 w-8 h-8 rounded-sm font-bold flex items-center justify-center transition-all cursor-pointer active:scale-95"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-mono text-base font-bold w-6 text-center">{directQty}</span>
                      <button
                        type="button"
                        onClick={() => setDirectQty((q) => Math.min(directCheckoutProduct.inventory, q + 1))}
                        className="bg-white hover:bg-stone-100 border border-stone-300 w-8 h-8 rounded-sm font-bold flex items-center justify-center transition-all cursor-pointer active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* 3. Delivery Details (Billing Address & Customer Name) */}
                  <div className="space-y-2.5 border-t border-stone-100 pt-3">
                    <label className="block text-[10px] font-mono text-stone-550 uppercase tracking-wide font-bold">
                      {lang === "en" ? "3. Shipping Receive Details" : "৩. শিপিং / ডেলিভারি ঠিকানা দিন"} *
                    </label>

                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="block text-[9px] font-mono text-stone-400 uppercase tracking-wide mb-1">
                          {lang === "en" ? "Recipient Name *" : "গ্রাহকের নাম *"}
                        </label>
                        <OptimizedInput
                          type="text"
                          placeholder="Sharif Ahmed"
                          value={customerName}
                          onChange={(val) => setCustomerName(val)}
                          className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-2 text-xs text-stone-900 outline-none transition-all duration-200 focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                          required
                          id="direct-customer-name"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-mono text-stone-400 uppercase tracking-wide mb-1">
                          {lang === "en" ? "Phone Number *" : "মোবাইল ফোন নম্বর *"}
                        </label>
                        <OptimizedInput
                          type="tel"
                          placeholder="017XXXXXXXX"
                          value={customerPhone}
                          onChange={(val) => setCustomerPhone(val)}
                          className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-2 text-xs font-mono text-stone-900 outline-none transition-all duration-200 focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                          required
                          id="direct-customer-phone"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-mono text-stone-400 uppercase tracking-wide mb-1">
                          {lang === "en" ? "Full Delivery Address (Receive Address) *" : "বিলিং ও ডেলিভারি সম্পূর্ণ ঠিকানা (বাণিজ্যিক/বাসা) *"}
                        </label>
                        <OptimizedTextarea
                          placeholder="House 44/A, Road 2, Dhanmondi, Dhaka"
                          value={customerAddress}
                          onChange={(val) => setCustomerAddress(val)}
                          className="w-full bg-stone-50 border border-stone-200 rounded p-2.5 text-xs text-stone-900 h-16 outline-none transition-all duration-200 focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 leading-relaxed"
                          required
                          id="direct-customer-address"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-mono text-stone-400 uppercase tracking-wide mb-1">
                          {lang === "en" ? "Special Delivery Note (Optional)" : "বিশেষ ডেলিভারি নোট বা অনুরোধ (ঐচ্ছিক)"}
                        </label>
                        <OptimizedTextarea
                          placeholder={lang === "en" ? "Example: Call before delivery..." : "যেমন: সকাল ৯টা থেকে বিকেল ৫টার মধ্যে অফিস টাইমে ডেলিভারি..."}
                          value={directNotes}
                          onChange={(val) => setDirectNotes(val)}
                          className="w-full bg-stone-50 border border-stone-200 rounded p-2 text-xs text-stone-900 h-12 outline-none focus:bg-white focus:border-amber-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 4. Delivery Area Selection */}
                  <div className="space-y-2 border-t border-stone-100 pt-3">
                    <label className="block text-[10px] font-mono text-stone-505 uppercase tracking-wide font-bold">
                      {lang === "en" ? "4. Select Delivery Area" : "৪. ডেলিভারি এলাকা নির্বাচন করুন"} *
                    </label>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setDeliveryLocation("inside")}
                        className={`flex flex-col items-center justify-center p-2 rounded-sm border transition-all cursor-pointer ${
                          deliveryLocation === "inside"
                            ? "bg-amber-500/10 border-amber-500 text-stone-950 font-bold"
                            : "bg-white border-stone-200 text-stone-700 hover:border-stone-400"
                        }`}
                        style={{ minHeight: "44px" }}
                      >
                        <span className="font-sans font-semibold">
                          {lang === "en" ? "Inside Dhaka" : "ঢাকার মধ্যে"}
                        </span>
                        <span className="text-[10px] opacity-80 mt-0.5">
                          {lang === "en" ? "Charge: ৳80" : "চার্জ: ৮০ টাকা"}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeliveryLocation("outside")}
                        className={`flex flex-col items-center justify-center p-2 rounded-sm border transition-all cursor-pointer ${
                          deliveryLocation === "outside"
                            ? "bg-amber-500/10 border-amber-500 text-stone-950 font-bold"
                            : "bg-white border-stone-200 text-stone-700 hover:border-stone-400"
                        }`}
                        style={{ minHeight: "44px" }}
                      >
                        <span className="font-sans font-semibold">
                          {lang === "en" ? "Outside Dhaka" : "ঢাকার বাইরে"}
                        </span>
                        <span className="text-[10px] opacity-80 mt-0.5">
                          {lang === "en" ? "Charge: ৳120" : "চার্জ: ১২০ টাকা"}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* 5. Payment Method Coordination */}
                  <div className="space-y-2 border-t border-stone-100 pt-3">
                    <label className="block text-[10px] font-mono text-stone-505 uppercase tracking-wide font-bold">
                      {lang === "en" ? "5. Choose Payment Method" : "৫. পেমেন্ট পদ্ধতি নির্বাচন করুন"} *
                    </label>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                      {/* COD */}
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("COD")}
                        className={`flex flex-col items-center justify-center p-2 rounded-sm border transition-all cursor-pointer ${
                          paymentMethod === "COD"
                            ? "bg-stone-905 border-stone-905 text-white font-bold"
                            : "bg-white border-stone-200 text-stone-700 hover:border-stone-400"
                        }`}
                        style={{ minHeight: "44px" }}
                      >
                        <span className="font-sans font-medium">
                          {lang === "en" ? "Cash On Delivery" : "ক্যাশ অন ডেলিভারি"}
                        </span>
                        <span className="text-[9px] opacity-80 mt-0.5">
                          {lang === "en" ? " doorstep payment" : "হাতে বুঝে পেয়ে পেমেন্ট"}
                        </span>
                      </button>

                      {/* bKash */}
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("bKash")}
                        className={`flex flex-col items-center justify-center p-2 rounded-sm border transition-all cursor-pointer ${
                          paymentMethod === "bKash"
                            ? "bg-[#D12053] border-[#D12053] text-white font-bold"
                            : "bg-white border-stone-200 text-[#D12053] hover:border-[#D12053]"
                        }`}
                        style={{ minHeight: "44px" }}
                      >
                        <span className="font-bold">bKash (বিকাশ)</span>
                        <span className="text-[9px] opacity-90 mt-0.5">Personal Send Money</span>
                      </button>

                      {/* Nagad */}
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("Nagad")}
                        className={`flex flex-col items-center justify-center p-2 rounded-sm border transition-all cursor-pointer ${
                          paymentMethod === "Nagad"
                            ? "bg-[#F04923] border-[#F04923] text-white font-bold"
                            : "bg-white border-stone-200 text-[#F04923] hover:border-[#F04923]"
                        }`}
                        style={{ minHeight: "44px" }}
                      >
                        <span className="font-bold">Nagad (নগদ)</span>
                        <span className="text-[9px] opacity-90 mt-0.5">Personal Send Money</span>
                      </button>

                      {/* Upay */}
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("Upay")}
                        className={`flex flex-col items-center justify-center p-2 rounded-sm border transition-all cursor-pointer ${
                          paymentMethod === "Upay"
                            ? "bg-[#005CA9] border-[#005CA9] text-white font-bold"
                            : "bg-white border-stone-200 text-[#005CA9] hover:border-[#005CA9]"
                        }`}
                        style={{ minHeight: "44px" }}
                      >
                        <span className="font-bold">Upay (উপায়)</span>
                        <span className="text-[9px] opacity-90 mt-0.5">Personal Send Money</span>
                      </button>

                      {/* Rocket */}
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("Rocket")}
                        className={`flex flex-col items-center justify-center p-2 rounded-sm border transition-all cursor-pointer ${
                          paymentMethod === "Rocket"
                            ? "bg-[#8C287A] border-[#8C287A] text-white font-bold"
                            : "bg-white border-stone-200 text-[#8C287A] hover:border-[#8C287A]"
                        }`}
                        style={{ minHeight: "44px" }}
                      >
                        <span className="font-bold">Rocket (রকেট)</span>
                        <span className="text-[9px] opacity-90 mt-0.5">Personal Send Money</span>
                      </button>

                      {/* Bank */}
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("Bank")}
                        className={`flex flex-col items-center justify-center p-2 rounded-sm border transition-all cursor-pointer ${
                          paymentMethod === "Bank"
                            ? "bg-[#0a5c36] border-[#0a5c36] text-white font-bold"
                            : "bg-white border-stone-200 text-[#0a5c36] hover:border-[#0a5c36]"
                        }`}
                        style={{ minHeight: "44px" }}
                      >
                        <span className="font-bold">{lang === "en" ? "Bank Transfer" : "ব্যাংক ট্রান্সফার"}</span>
                        <span className="text-[9px] opacity-90 mt-0.5 font-mono">Wire Transfer</span>
                      </button>
                    </div>

                    {/* Instruction Box for bKash/Nagad/Upay/Rocket/Bank */}
                    {paymentMethod !== "COD" && (
                      <div className="bg-stone-50 border border-stone-200 p-3 rounded-sm space-y-2 mt-2 font-mono text-[10px]">
                        <p className="font-sans font-bold text-stone-900 border-b border-stone-200 pb-1 uppercase tracking-wider">
                          {lang === "en" ? `${paymentMethod} Payment Instructions` : `${paymentMethod} পেমেন্ট নির্দেশনা`}:
                        </p>
                        
                        {paymentMethod === "Bank" ? (
                          <div className="font-sans text-stone-705 space-y-1">
                            <p>
                              {lang === "en"
                                ? "Please transfer your total billing amount to the following Bank Account:"
                                : "১. অনুগ্রহ করে বিলের মোট টাকা নিচের ব্যাংক অ্যাকাউন্টে ট্রান্সফার করুন:"}
                            </p>
                            <div className="bg-stone-100 p-2 rounded text-[11px] text-stone-850 space-y-0.5 font-mono">
                              <p><strong>Bank:</strong> Dutch-Bangla Bank PLC</p>
                              <p><strong>Account Name:</strong> RIEMART</p>
                              <p><strong>Account Number:</strong> 227.110.15438</p>
                              <p><strong>Branch:</strong> Mawlovibazar Branch</p>
                            </div>
                            <p className="text-[9px] text-stone-500 pt-1">
                              {lang === "en"
                                ? "After transfer, fill in your Depositor Account Number and Transaction Reference ID below."
                                : "অ্যাকাউন্টে টাকা পাঠিয়ে নিচের বক্সে আপনার ব্যাংক অ্যাকাউন্ট নম্বর এবং রেফারেন্স/ট্রানজেকশন আইডি প্রদান করুন।"}
                            </p>
                          </div>
                        ) : (
                          <p className="font-sans text-stone-707 text-left leading-relaxed">
                            {lang === "en"
                              ? `Please "Send Money" total billing money to this personal account number: `
                              : `১. অনুগ্রহ করে বিলের মোট টাকা এই পার্সোনাল নাম্বারে "সেন্ড মানি" করুন: `}
                            <strong className="text-stone-950 text-xs bg-stone-250 px-1.5 py-0.5 rounded font-mono font-bold select-all inline-block">+880 1681868938</strong>
                          </p>
                        )}
                        
                        <div className="grid grid-cols-2 gap-2 pt-1 font-sans">
                          <div>
                            <label className="block text-[8px] font-mono text-stone-500 uppercase tracking-wide mb-0.5">
                              {paymentMethod === "Bank" 
                                ? (lang === "en" ? "Depositor Account No" : "প্রেরক অ্যাকাউন্ট নম্বর")
                                : (lang === "en" ? "Sender Mobile" : "প্রেরক নাম্বার")} *
                            </label>
                            <input
                              type="text"
                              value={paymentSender}
                              onChange={(e) => setPaymentSender(e.target.value)}
                              className="w-full bg-white border border-stone-200 rounded px-2.5 py-1 text-xs font-mono text-stone-900"
                              placeholder={paymentMethod === "Bank" ? "A/C XXXX" : "01711XXXXXX"}
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-[8px] font-mono text-stone-500 uppercase tracking-wide mb-0.5">
                              {paymentMethod === "Bank"
                                ? (lang === "en" ? "Bank Ref / Trx ID" : "ব্যাংক রেফারেন্স / ট্রানজেকশন")
                                : (lang === "en" ? "Transaction ID" : "ট্রানজেকশন আইডি")} *
                            </label>
                            <input
                              type="text"
                              value={paymentTrxId}
                              onChange={(e) => setPaymentTrxId(e.target.value)}
                              className="w-full bg-white border border-stone-200 rounded px-2.5 py-1 text-xs font-mono uppercase text-stone-900"
                              placeholder="TrxID Code"
                              required
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Pricing Invoice Summary Breakdown */}
                  <div className="border-t border-stone-200 pt-3 space-y-1.5 mt-3 text-xs font-mono font-semibold bg-stone-50/50 p-3 rounded-sm">
                    <div className="flex justify-between text-stone-605 text-left">
                      <span>{lang === "en" ? "Subtotal" : "উপমোট"} ({directQty} x {formatPrice(directCheckoutProduct.price)}):</span>
                      <span>{formatPrice(directCheckoutProduct.price * directQty)}</span>
                    </div>

                    {settings.buyMoreSaveMoreEnabled && directQty >= settings.tier2Qty && (
                      <div className="flex justify-between text-emerald-600 text-left">
                        <span>
                          {lang === "en" ? "Special discount" : "বিশেষ ছাড়"} ({
                            directQty >= settings.tier3Qty ? settings.tier3Discount : settings.tier2Discount
                          }%):
                        </span>
                        <span>
                          -{formatPrice(
                            Math.round(
                              ((directCheckoutProduct.price * directQty) * (directQty >= settings.tier3Qty ? settings.tier3Discount : settings.tier2Discount)) / 100
                            )
                          )}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between text-stone-605 text-left">
                      <span>
                        {lang === "en" ? "Est. Delivery Charge:" : "ডেলিভারি চার্জ:"} ({
                          deliveryLocation === "inside" ? (lang === "en" ? "Dhaka" : "ঢাকার মধ্যে") : (lang === "en" ? "Outside" : "ঢাকার বাইরে")
                        })
                      </span>
                      <span>{formatPrice(getDeliveryCharge(deliveryLocation, [directCheckoutProduct]))}</span>
                    </div>

                    <div className="flex justify-between border-t border-stone-200 pt-2 text-sm font-bold text-stone-950 text-left">
                      <span>{lang === "en" ? "Total Payable Amount:" : "সর্বমোট প্রদেয় বিল:"}</span>
                      <span className="text-base text-amber-700 font-extrabold text-right">
                        {(() => {
                          const sub = directCheckoutProduct.price * directQty;
                          let disc = 0;
                          if (settings.buyMoreSaveMoreEnabled) {
                            let discPercent = 0;
                            if (directQty >= settings.tier3Qty) discPercent = settings.tier3Discount;
                            else if (directQty >= settings.tier2Qty) discPercent = settings.tier2Discount;
                            disc = Math.round((sub * discPercent) / 100);
                          }
                          const dev = getDeliveryCharge(deliveryLocation, [directCheckoutProduct]);
                          return formatPrice(sub - disc + dev);
                        })()}
                      </span>
                    </div>
                  </div>

                </div>

                {/* Submit Action Sticky footer */}
                <div className="p-4 bg-stone-50 border-t border-stone-200 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDirectCheckoutProduct(null)}
                    className="flex-1 py-3 border border-stone-300 text-stone-650 bg-white hover:bg-stone-100 text-xs font-mono font-bold uppercase rounded-sm cursor-pointer transition-all duration-150"
                  >
                    {lang === "en" ? "Cancel" : "বাতিল করুন"}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white text-xs font-mono font-bold uppercase tracking-widest rounded-sm cursor-pointer transition-all duration-150 shadow-md flex items-center justify-center gap-2"
                    id="direct-submit-order"
                  >
                    <span>⚡</span>
                    <span>{lang === "en" ? "CONFIRM ORDER NOW" : "অর্ডার নিশ্চিত করুন"}</span>
                  </button>
                </div>
              </form>
            ) : (
              /* Success / Order Confirmation Page (সম্পূর্ণ অর্ডার কনফার্মেশন পৃষ্ঠা) */
              <div className="p-6 text-center space-y-6" id="direct-checkout-success-view">
                
                <div className="space-y-2">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                    <svg className="w-9 h-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h4 className="font-display font-medium text-stone-900 text-base sm:text-lg">
                    {lang === "en" ? "Atelier Order Dispatched!" : "আপনার অর্ডারটি সফল হয়েছে!"}
                  </h4>
                  <p className="text-[11px] font-mono text-amber-700 font-bold bg-amber-50 px-3 py-1.5 rounded-sm border border-amber-200/50 inline-block">
                    {lang === "en" ? `MEMO / INVOICE ID: ` : `মেমো নম্বর: `}
                    <span className="text-stone-900 font-extrabold select-all">{directOrderRef}</span>
                  </p>
                </div>

                {/* Simple summary panel of confirmation details */}
                <div className="p-4 bg-stone-50 border border-stone-200 rounded text-left text-xs font-sans space-y-2.5">
                  <p className="font-semibold text-stone-900 border-b border-stone-200 pb-1 header uppercase tracking-tight text-[11px] font-mono">
                    {lang === "en" ? "Selected Creation Details" : "অর্ডারের বিবরণসমুহ"}
                  </p>
                  
                  <div className="flex justify-between items-start gap-4 text-left">
                    <span className="text-stone-500 font-light truncate">
                      {lang === "en" ? directCheckoutProduct.nameEn : directCheckoutProduct.nameBn} ({directOption})
                    </span>
                    <span className="font-mono text-stone-900 shrink-0 font-bold">
                      {directQty} Pcs
                    </span>
                  </div>

                  <div className="border-t border-stone-150 pt-2 space-y-1 font-mono text-[11px]">
                    <div className="flex justify-between text-stone-550 text-left">
                      <span>{lang === "en" ? "Delivery address: " : "গ্রহীতা ও ঠিকানা: "}</span>
                      <span className="font-sans text-stone-900 text-right max-w-[210px] break-words">
                        {customerName} ({customerPhone}), {customerAddress}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1 font-bold border-t border-dashed border-stone-200 text-left">
                      <span>{lang === "en" ? "Payment coordinate:" : "পেমেন্ট পদ্ধতি:"}</span>
                      <span className="text-stone-900 truncate">{paymentMethod}</span>
                    </div>
                    <div className="flex justify-between text-xs font-extrabold pt-1 text-left">
                      <span>{lang === "en" ? "Amount Paid/COD Due:" : "সর্বমোট প্রদেয় বিল:"}</span>
                      <span className="text-amber-700 text-sm font-black text-right">
                        {(() => {
                          const sub = directCheckoutProduct.price * directQty;
                          let disc = 0;
                          if (settings.buyMoreSaveMoreEnabled) {
                            let discPercent = 0;
                            if (directQty >= settings.tier3Qty) discPercent = settings.tier3Discount;
                            else if (directQty >= settings.tier2Qty) discPercent = settings.tier2Discount;
                            disc = Math.round((sub * discPercent) / 100);
                          }
                          const dev = getDeliveryCharge(deliveryLocation, [directCheckoutProduct]);
                          return formatPrice(sub - disc + dev);
                        })()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-amber-50/50 border border-amber-200/40 rounded-sm text-[11px] text-stone-650 leading-relaxed font-sans text-center">
                  {lang === "en"
                    ? "Our studio representative will contact you in a few moments to confirm shipping coordinates."
                    : "আমাদের স্টুডিও প্রতিনিধি প্যাকেজিং এবং শিপমেন্ট প্রক্রিয়া গতিশীল করতে খুব শীঘ্রই আপনার সাথে ফোনে যোগাযোগ করবেন। ধন্যবাদ!"}
                </div>

                {/* Print Invoice and Continue Buttons */}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const orderObj = userOrders.find((ord) => ord.id === directOrderRef) || orders.find((ord) => ord.id === directOrderRef) || lastPlacedOrder;
                      if (orderObj) {
                        setPrintingOrder(orderObj);
                      }
                    }}
                    className="flex-1 py-2.5 bg-stone-900 hover:bg-stone-850 text-white text-xs font-mono font-bold uppercase rounded-sm cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <span>🖨️</span>
                    <span>{lang === "en" ? "Print Memo Slip" : "রসিদ বিবরণ প্রিন্ট"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDirectCheckoutProduct(null);
                    }}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-mono font-bold uppercase rounded-sm cursor-pointer transition-all shadow-sm"
                  >
                    <span>{lang === "en" ? "Keep Shopping" : "কেনাকাটা চালিয়ে যান"}</span>
                  </button>
                </div>

              </div>
            )}

          </div>
        </div>
      )}

      {/* ==================== CART DRAWER ==================== */}
      {isCartOpen && (
        <>
          <div 
            onClick={() => setIsCartOpen(false)} 
            className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs z-40 transition-opacity duration-200 cursor-pointer" 
            id="cart-drawer-backdrop"
          />
          <div className="fixed top-0 bottom-16 md:bottom-0 right-0 z-50 w-full max-w-md bg-white border-l border-stone-200 shadow-2xl flex flex-col justify-between animate-studio-reveal print:hidden" id="cart-drawer-panel">
          
            {/* Cart Header */}
            <div className="p-5 border-b border-stone-200 flex justify-between items-center bg-stone-950 text-white">
              <h3 className="font-display font-medium text-sm tracking-widest uppercase flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-amber-400" />
                {DICTIONARY[lang].cartTitle}
              </h3>
              <button
                onClick={() => setIsCartOpen(false)}
                className="text-stone-400 hover:text-white p-1 rounded-sm hover:bg-stone-800 transition-colors cursor-pointer"
                id="close-cart-drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Header Tabs */}
            <div className="flex border-b border-stone-200 bg-stone-50 select-none">
              <button
                onClick={() => setCartDrawerTab("cart")}
                className={`flex-1 py-3 text-center text-xs font-mono font-bold uppercase transition-all tracking-wider border-b-2 sm:font-semibold ${
                  cartDrawerTab === "cart"
                    ? "border-stone-900 text-stone-900 bg-white font-bold"
                    : "border-transparent text-stone-500 hover:text-stone-800 hover:bg-stone-100/50"
                }`}
                id="tab-cart-items-drawer"
              >
                {lang === "en" ? `Cart (${cart.reduce((sum, item) => sum + item.quantity, 0)})` : `কার্ট (${cart.reduce((sum, item) => sum + item.quantity, 0)})`}
              </button>
              <button
                onClick={() => setCartDrawerTab("orders")}
                className={`flex-1 py-3 text-center text-xs font-mono font-bold uppercase transition-all tracking-wider border-b-2 sm:font-semibold flex items-center justify-center gap-1.5 core-orders-tab ${
                  cartDrawerTab === "orders"
                    ? "border-stone-900 text-stone-900 bg-white font-bold"
                    : "border-transparent text-stone-500 hover:text-stone-800 hover:bg-stone-100/50"
                }`}
                id="tab-user-orders-drawer"
              >
                <span>{lang === "en" ? "My Orders" : "আমার অর্ডার"}</span>
                <span className="bg-stone-200 text-stone-850 text-[10px] px-2 py-0.5 rounded-full font-bold leading-none shrink-0">
                  {displayedUserOrders.length}
                </span>
              </button>
            </div>

            {/* Cart Body */}
            <div 
              className={`flex-1 overflow-y-auto p-5 space-y-4 ${isInputActive ? "pb-72" : "pb-24 ml-safe mr-safe"}`}
              id="cart-drawer-scroll-body"
            >
              {cartDrawerTab === "orders" ? (
                displayedUserOrders.length === 0 ? (
                  <div className="text-center py-12 space-y-2">
                    <ClipboardList className="w-10 h-10 text-stone-300 mx-auto animate-pulse" />
                    <p className="text-xs font-mono text-stone-505 uppercase tracking-wide font-bold">
                      {lang === "en" ? "No past orders found." : "অর্ডার হিস্ট্রি খালি।"}
                    </p>
                    <p className="text-[11px] font-sans text-stone-400 max-w-[240px] mx-auto leading-relaxed">
                      {lang === "en" ? "Once you dispatch standard orders, they will populate here live." : "আপনি সফলভাবে অর্ডার সম্পন্ন করার পর তা এখানে জমা হবে।"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {displayedUserOrders.map((order) => {
                      // Status styling
                      const statusColors = {
                        Pending: "bg-amber-50 text-amber-800 border-amber-200/60",
                        Processing: "bg-blue-50 text-blue-800 border-blue-200/60",
                        Shipped: "bg-purple-50 text-purple-850 border-purple-200/60",
                        Completed: "bg-emerald-55 text-emerald-800 border-emerald-200/60"
                      };
                      const statusLabels = {
                        Pending: { en: "Pending", bn: "পেন্ডিং" },
                        Processing: { en: "Processing", bn: "প্রসেসিং" },
                        Shipped: { en: "Shipped", bn: "শিপড্" },
                        Completed: { en: "Completed", bn: "সম্পন্ন" }
                      };

                      const formattedDate = new Date(order.date).toLocaleDateString(lang === "en" ? "en-US" : "bn-BD", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      });

                      return (
                        <div key={order.id} className="p-3 border border-stone-200 bg-stone-50 rounded-sm space-y-2.5 text-xs animate-studio-reveal">
                          {/* Header of order */}
                          <div className="flex justify-between items-start border-b border-stone-200 pb-2">
                            <div>
                              <span className="font-mono font-bold text-stone-900 block text-xs">{order.id}</span>
                              <span className="text-[10px] text-stone-400 font-mono block mt-0.5">{formattedDate}</span>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${statusColors[order.status] || "bg-stone-55 text-stone-805"}`}>
                              {statusLabels[order.status]?.[lang] || order.status}
                            </span>
                          </div>

                          {/* Items listed */}
                          <div className="space-y-1.5 pl-1.5 border-l-2 border-stone-300">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-stone-700 text-[11px] gap-2">
                                <span className="truncate max-w-[210px] font-medium">
                                  {lang === "en" ? item.productNameEn : item.productNameBn}
                                </span>
                                <span className="font-mono text-stone-550 shrink-0">
                                  {item.quantity} × {formatPrice(item.priceAtPurchase)}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Totals */}
                          <div className="flex justify-between items-end text-[11px] pt-2 border-t border-stone-200">
                            <div className="text-stone-500 space-y-0.5">
                              {order.discountApplied > 0 && (
                                <span className="text-emerald-700 font-semibold block text-[10px]">
                                  {lang === "en" ? "Saved: " : "ছাড়: "}-{formatPrice(order.discountApplied)}
                                </span>
                              )}
                              <span className="text-[10px] block truncate max-w-[180px] font-mono text-stone-400 font-light">
                                {order.customerName} ({order.customerPhone})
                              </span>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-[9px] text-stone-400 block uppercase font-mono tracking-wider">{lang === "en" ? "Grand Total" : "সর্বমোট মূল্য"}</span>
                              <span className="font-mono font-bold text-stone-900 text-xs">{formatPrice(order.totalPrice)}</span>
                            </div>
                          </div>

                          {/* Order actions row with Receipt & Reorder button */}
                          <div className="flex gap-2 justify-end pt-1">
                            <a
                              href={isInsideIframe ? getPrintUrl(order.id) : "#"}
                              target={isInsideIframe ? "_blank" : undefined}
                              onClick={isInsideIframe ? undefined : (e) => { e.preventDefault(); setPrintingOrder(order); }}
                              className="px-2.5 py-1 text-[10px] font-mono border border-stone-250 text-stone-700 hover:text-stone-950 hover:bg-white rounded-sm transition-all focus:outline-none flex items-center gap-1 cursor-pointer bg-white select-none inline-flex items-center"
                            >
                              <span>🖨️</span>
                              <span>{lang === "en" ? "Receipt" : "রসিদ"}</span>
                            </a>
                            
                            <button
                              onClick={() => handleReorder(order)}
                              className="px-2.5 py-1 text-[10px] font-mono border border-stone-200 bg-amber-600 font-bold text-white hover:bg-amber-700 rounded-sm transition-all focus:outline-none flex items-center gap-1.5 cursor-pointer"
                            >
                              <span>🔄</span>
                              <span>{lang === "en" ? "Reorder" : "পুনরায় অর্ডার"}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Clean My Orders history */}
                    <div className="pt-2 text-center">
                      <button
                        onClick={() => {
                          showSafeConfirm(
                            lang === "en" ? "Delete History" : "ইতিহাস মুছুন",
                            lang === "en" ? "Delete all local order history record? This cannot be undone." : "আপনার পাস্ট অর্ডার হিস্ট্রি মুছে ফেলতে চান? এটি আর ফিরিয়ে আনা যাবে না।",
                            () => {
                              try {
                                localStorage.removeItem("riemart_local_placed_order_ids");
                              } catch (e) {}
                              setUserOrders([]);
                            }
                          );
                        }}
                        className="text-[10px] font-mono text-stone-400 hover:text-red-500 transition-colors uppercase tracking-wider cursor-pointer"
                      >
                        {lang === "en" ? "Clear order history" : "ইতিহাস মুছে ফেলুন"}
                      </button>
                    </div>
                  </div>
                )
              ) : cart.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <ShoppingBag className="w-10 h-10 text-stone-300 mx-auto" />
                  <p className="text-xs font-mono text-stone-505 uppercase tracking-wide">
                    {DICTIONARY[lang].cartEmpty}
                  </p>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="text-xs text-stone-950 font-bold underline font-mono cursor-pointer"
                    id="cart-continue-shopping"
                  >
                    Return to storefront
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => {
                    const masterProduct = products.find((p) => p.id === item.product.id);
                    const livePrice = masterProduct ? masterProduct.price : item.product.price;
                    return (
                      <div key={item.product.id} className="flex gap-4 border-b border-stone-100 pb-4 text-xs select-none">
                        <img src={item.product.image} className="w-16 h-16 object-cover rounded border border-stone-250 shrink-0" />
                        <div className="flex-1 space-y-1">
                          <p className="font-display font-medium text-stone-900 leading-tight">
                            {lang === "en" ? item.product.nameEn : item.product.nameBn}
                          </p>
                          <div className="flex flex-col space-y-0.5">
                            <div className="flex items-baseline justify-between">
                              <span className="text-[10px] text-stone-400 font-sans font-normal">
                                {lang === "en" ? "1 Pcs Price:" : "১ পিসের দাম:"}
                              </span>
                              <span className="font-bold font-mono text-stone-900 text-xs">
                                {formatPrice(livePrice)}
                              </span>
                            </div>
                            {item.quantity > 1 && (
                              <div className="flex justify-between text-[11px] text-stone-550 font-mono font-light">
                                <span>{lang === "en" ? "Item total:" : "পণ্যের মোট:"}</span>
                                <span>{item.quantity} × {formatPrice(livePrice)} = {formatPrice(livePrice * item.quantity)}</span>
                              </div>
                            )}
                          </div>
                        
                          {/* Control buttons */}
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => updateCartQuantity(item.product.id, -1)}
                              className="bg-stone-100 p-1 hover:bg-stone-200 rounded cursor-pointer"
                              id={`cart-minus-${item.product.id}`}
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="font-mono text-xs w-6 text-center">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateCartQuantity(item.product.id, 1)}
                              className="bg-stone-100 p-1 hover:bg-stone-200 rounded cursor-pointer"
                              id={`cart-plus-${item.product.id}`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Offer notifications inside cart */}
                  {settings.buyMoreSaveMoreEnabled && (
                    <div className="p-3 bg-amber-50 text-[11px] text-amber-900 rounded border border-amber-200/50 space-y-1 animate-studio-reveal">
                      <p className="font-bold flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                        {lang === "en" ? "ACTIVE STUDIO COMBINED DISCOUNT" : "সক্রিয় স্পেশাল ডিসকাউন্ট"}
                      </p>
                      <p>
                        {lang === "en"
                          ? `Tier thresholds: Buy ${settings.tier2Qty} get ${settings.tier2Discount}%, Buy ${settings.tier3Qty}+ get ${settings.tier3Discount}%.`
                          : `ডিসকাউন্ট স্তর: একসাথে ${settings.tier2Qty} টি তে ${settings.tier2Discount}%, বা ২টির বেশি তে ${settings.tier3Discount}% ছাড়।`}
                      </p>
                      <p className="font-bold font-mono">
                        {lang === "en" ? "Current units in checkout bracket: " : "মোট কার্ট সংখ্যা: "}
                        {totalItemsCount}
                      </p>
                    </div>
                  )}

                  {/* SECURE CHECKOUT COORDINATES FORM */}
                  {showCheckoutForm && (
                    <form onSubmit={handlePlaceOrder} className="p-4 bg-white border border-stone-200 rounded-sm space-y-3 mt-4 text-left" id="secure-checkout-form">
                      <div className="space-y-2.5 text-xs text-left">
                        <div>
                          <label className="block text-[10px] font-mono text-stone-500 uppercase tracking-wide mb-1 text-left">
                            {DICTIONARY[lang].customerName} *
                          </label>
                          <OptimizedInput
                            type="text"
                            placeholder="Sharif Ahmed"
                            value={customerName}
                            onChange={(val) => setCustomerName(val)}
                            className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-2 text-xs font-sans text-stone-900 outline-none transition-all duration-200 focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                            required
                            id="checkout-customer-name"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-mono text-stone-500 uppercase tracking-wide mb-1 text-left">
                            {DICTIONARY[lang].customerPhone} *
                          </label>
                          <OptimizedInput
                            type="tel"
                            placeholder="+880 1711-XXXXXX"
                            value={customerPhone}
                            onChange={(val) => setCustomerPhone(val)}
                            className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-2 text-xs font-mono text-stone-900 outline-none transition-all duration-200 focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                            required
                            id="checkout-customer-phone"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-mono text-stone-500 uppercase tracking-wide mb-1 text-left">
                            {DICTIONARY[lang].customerAddress} *
                          </label>
                          <OptimizedTextarea
                            placeholder="House 44/A, Road 2, Dhanmondi, Dhaka"
                            value={customerAddress}
                            onChange={(val) => setCustomerAddress(val)}
                            className="w-full bg-stone-50 border border-stone-200 rounded p-2.5 text-xs font-sans text-stone-900 h-20 outline-none transition-all duration-200 focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 leading-relaxed"
                            required
                            id="checkout-customer-address"
							/>
                        </div>

                        <div>
                          <label className="block text-[10px] font-mono text-stone-500 uppercase tracking-wide mb-1 text-left">
                            {lang === "en" ? "Order Notes" : "অর্ডার নোট (ঐচ্ছিক)"}
                          </label>
                          <OptimizedTextarea
                            placeholder={lang === "en" ? "Leave special delivery instructions or requests..." : "ডেলিভারি নির্দেশনা বা বিশেষ অনুরোধ লিখুন..."}
                            value={orderNotes}
                            onChange={(val) => setOrderNotes(val)}
                            className="w-full bg-stone-50 border border-stone-200 rounded p-2.5 text-xs font-sans text-stone-900 h-16 outline-none transition-all duration-200 focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 leading-relaxed"
                            id="checkout-order-notes"
                          />
                        </div>

                        {/* Interactive Delivery Location Selector with Bengali notifications */}
                        <div className="space-y-2 border-t border-stone-105 pt-3 text-left">
                          <label className="block text-[10px] font-mono text-stone-505 uppercase tracking-wide font-bold text-stone-800 text-left">
                            {lang === "en" ? "Select Delivery Area" : "ডেলিভারি এলাকা নির্বাচন করুন"} *
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setDeliveryLocation("inside")}
                              className={`flex flex-col items-center justify-center p-2 rounded-sm border text-left transition-all cursor-pointer ${
                                deliveryLocation === "inside"
                                  ? "bg-amber-500/10 border-amber-500 text-stone-950 font-bold"
                                  : "bg-white border-stone-200 text-stone-700 hover:border-stone-400"
                              }`}
                              style={{ minHeight: "44px" }}
                              id="delivery-location-inside"
                            >
                              <span className="text-[11px] font-medium font-sans">
                                {lang === "en" ? "Inside Dhaka" : "ঢাকার মধ্যে"}
                              </span>
                              <span className="text-[9px] opacity-80 mt-0.5 font-sans font-light">
                                {lang === "en" ? "Charge: ৳80" : "চার্জ: ৮০ টাকা"}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeliveryLocation("outside")}
                              className={`flex flex-col items-center justify-center p-2 rounded-sm border text-left transition-all cursor-pointer ${
                                deliveryLocation === "outside"
                                  ? "bg-amber-500/10 border-amber-500 text-stone-950 font-bold"
                                  : "bg-white border-stone-200 text-stone-700 hover:border-stone-400"
                              }`}
                              style={{ minHeight: "44px" }}
                              id="delivery-location-outside"
                            >
                              <span className="text-[11px] font-medium font-sans">
                                {lang === "en" ? "Outside Dhaka" : "ঢাকার বাইরে"}
                              </span>
                              <span className="text-[9px] opacity-80 mt-0.5 font-sans font-light">
                                {lang === "en" ? "Charge: ৳120" : "চার্জ: ১২০ টাকা"}
                              </span>
                            </button>
                          </div>
                          
                          {/* Rich Bengali Awareness Box */}
                          <div className="p-2.5 bg-amber-50/50 border border-amber-200/40 rounded-sm text-[10px] text-stone-600 leading-relaxed font-sans text-left">
                            ঢাকার মধ্যে ডেলিভারি চার্জ ৮০ টাকা এবং ঢাকার বাইরে ডেলিভারি চার্জ ১২০ টাকা। অনুগ্রহ করে সঠিক ডেলিভারি এলাকা নির্বাচন করুন।
                          </div>
                        </div>

                        {/* Unique Payment Method Design segment */}
                        <div className="space-y-2 border-t border-stone-100 pt-3 text-left">
                          <label className="block text-[10px] font-mono text-stone-505 uppercase tracking-wide font-bold text-stone-800 text-left">
                            {lang === "en" ? "Select Payment Method" : "পেমেন্ট পদ্ধতি নির্বাচন করুন"} *
                          </label>
                          
                          <div className="grid grid-cols-2 gap-2">
                            {/* Cash on Delivery Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setPaymentMethod("COD");
                              }}
                              className={`flex flex-col items-center justify-center p-2 rounded-sm border text-left transition-all cursor-pointer ${
                                paymentMethod === "COD"
                                  ? "bg-stone-900 border-stone-900 text-white font-bold"
                                  : "bg-white border-stone-200 text-stone-700 hover:border-stone-400"
                              }`}
                              id="pay-method-cod"
                            >
                              <span className="text-[11px] font-medium font-sans">
                                {lang === "en" ? "Cash On Delivery" : "ক্যাশ অন ডেলিভারি"}
                              </span>
                              <span className="text-[9px] opacity-80 mt-0.5 font-sans font-light">
                                {lang === "en" ? "Pay at doorstep" : "হাতে হাতে পেমেন্ট"}
                              </span>
                            </button>

                            {/* bKash Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setPaymentMethod("bKash");
                              }}
                              className={`flex flex-col items-center justify-center p-2 rounded-sm border text-left transition-all cursor-pointer ${
                                paymentMethod === "bKash"
                                  ? "bg-[#D12053] border-[#D12053] text-white font-bold animate-active-scale"
                                  : "bg-white border-stone-200 text-[#D12053] hover:border-[#D12053]"
                              }`}
                              id="pay-method-bkash"
                            >
                              <span className="text-[11px] font-bold">bKash (বিকাশ)</span>
                              <span className="text-[9px] opacity-85 mt-0.5 font-mono">+880 1681868938</span>
                            </button>

                            {/* Nagad Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setPaymentMethod("Nagad");
                              }}
                              className={`flex flex-col items-center justify-center p-2 rounded-sm border text-left transition-all cursor-pointer ${
                                paymentMethod === "Nagad"
                                  ? "bg-[#F04923] border-[#F04923] text-white font-bold animate-active-scale"
                                  : "bg-white border-stone-200 text-[#F04923] hover:border-[#F04923]"
                              }`}
                              id="pay-method-nagad"
                            >
                              <span className="text-[11px] font-bold">Nagad (নগদ)</span>
                              <span className="text-[9px] opacity-85 mt-0.5 font-mono">+880 1681868938</span>
                            </button>

                            {/* Upay Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setPaymentMethod("Upay");
                              }}
                              className={`flex flex-col items-center justify-center p-2 rounded-sm border text-left transition-all cursor-pointer ${
                                paymentMethod === "Upay"
                                  ? "bg-[#005CA9] border-[#005CA9] text-white font-bold animate-active-scale"
                                  : "bg-white border-stone-200 text-[#005CA9] hover:border-[#005CA9]"
                              }`}
                              id="pay-method-upay"
                            >
                              <span className="text-[11px] font-bold">Upay (উপায়)</span>
                              <span className="text-[9px] opacity-85 mt-0.5 font-mono">+880 1681868938</span>
                            </button>

                            {/* Rocket Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setPaymentMethod("Rocket");
                              }}
                              className={`flex flex-col items-center justify-center p-2 rounded-sm border text-left transition-all cursor-pointer ${
                                paymentMethod === "Rocket"
                                  ? "bg-[#8C287A] border-[#8C287A] text-white font-bold animate-active-scale"
                                  : "bg-white border-stone-200 text-[#8C287A] hover:border-[#8C287A]"
                              }`}
                              id="pay-method-rocket"
                            >
                              <span className="text-[11px] font-bold">Rocket (রকেট)</span>
                              <span className="text-[9px] opacity-85 mt-0.5 font-mono">+880 1681868938</span>
                            </button>

                            {/* Bank Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setPaymentMethod("Bank");
                              }}
                              className={`flex flex-col items-center justify-center p-2 rounded-sm border text-left transition-all cursor-pointer ${
                                paymentMethod === "Bank"
                                  ? "bg-[#0a5c36] border-[#0a5c36] text-white font-bold animate-active-scale"
                                  : "bg-white border-stone-200 text-[#0a5c36] hover:border-[#0a5c36]"
                              }`}
                              id="pay-method-bank"
                            >
                              <span className="text-[11px] font-bold">{lang === "en" ? "Bank" : "ব্যাংক ট্রান্সফার"}</span>
                              <span className="text-[9px] opacity-85 mt-0.5 font-mono">Wire Transfer</span>
                            </button>
                          </div>

                          {/* Payment instruction & Fields block for Payments */}
                          {paymentMethod !== "COD" && (
                            <div className="bg-stone-50 border border-stone-200 p-2.5 rounded-sm space-y-2 mt-2 font-mono text-[10px] text-left">
                              <div className="text-stone-750 leading-relaxed font-sans text-left">
                                <p className="font-bold text-stone-900 border-b border-stone-250 pb-1 mb-1 text-[11px] uppercase tracking-wider text-left">
                                  {lang === "en" ? `${paymentMethod} Payment Instructions` : `${paymentMethod} পেমেন্ট নির্দেশনা`}:
                                </p>
                                
                                {paymentMethod === "Bank" ? (
                                  <div className="font-sans text-stone-705 space-y-1 text-left">
                                    <p>
                                      {lang === "en"
                                        ? "Please transfer your total billing amount to the following Bank Account:"
                                        : "১. অনুগ্রহ করে বিলের মোট টাকা নিচের ব্যাংক অ্যাকাউন্টে ট্রান্সফার করুন:"}
                                    </p>
                                    <div className="bg-stone-100 p-2 rounded text-[11px] text-stone-850 space-y-0.5 font-mono text-left">
                                      <p><strong>Bank:</strong> Dutch-Bangla Bank PLC</p>
                                      <p><strong>Account Name:</strong> RIEMART</p>
                                      <p><strong>Account Number:</strong> 227.110.15438</p>
                                      <p><strong>Branch:</strong> Mowlovibazar Branch</p>
                                    </div>
                                    <p className="text-[9px] text-stone-500 pt-1 leading-normal">
                                      {lang === "en"
                                        ? "After transferring, input your Depositor Account and Bank Reference Code below."
                                        : "অ্যাকাউন্টে টাকা পাঠিয়ে নিচের বক্সে আপনার ব্যাংক অ্যাকাউন্ট নম্বর এবং রেফারেন্স/আইডি প্রদান করুন।"}
                                    </p>
                                  </div>
                                ) : (
                                  <>
                                    <p className="text-left leading-relaxed">
                                      {lang === "en"
                                        ? `1. Please "Send Money" of the total amount to this personal number: `
                                        : `১. অনুগ্রহ করে মোট টাকা এই ব্যক্তিগত নাম্বারে "সেন্ড মানি" করুন: `}
                                      <strong className="text-stone-950 text-xs select-all bg-stone-200 px-1 font-mono font-bold">+880 1681868938</strong>
                                    </p>
                                    <p className="mt-0.5 text-left leading-relaxed text-stone-600">
                                      {lang === "en"
                                        ? `2. Write your transaction parameters below to verify and complete the order directly.`
                                        : `২. অর্ডারটি সম্পূর্ণ এবং নিশ্চিত করতে নিচে আপনার প্রেরক নাম্বার ও ট্রানজেকশন আইডি দিন।`}
                                    </p>
                                  </>
                                )}
                              </div>

                              <div className="grid grid-cols-2 gap-2 pt-1 font-sans text-left">
                                <div>
                                  <label className="block text-[8px] font-mono text-stone-505 uppercase tracking-wide mb-0.5 text-left">
                                    {paymentMethod === "Bank"
                                      ? (lang === "en" ? "Account No" : "অ্যাকাউন্ট নং")
                                      : (lang === "en" ? "Sender Number" : "প্রেরক নাম্বার")} *
                                  </label>
                                  <input
                                    type="text"
                                    placeholder={paymentMethod === "Bank" ? "A/C XXXX" : "01711XXXXXX"}
                                    value={paymentSender}
                                    onChange={(e) => setPaymentSender(e.target.value)}
                                    className="w-full bg-white border border-stone-200 rounded px-2 py-1 text-xs font-mono text-stone-900"
                                    required
                                  />
                                </div>
                                <div>
                                  <label className="block text-[8px] font-mono text-stone-505 uppercase tracking-wide mb-0.5 text-left">
                                    {paymentMethod === "Bank"
                                      ? (lang === "en" ? "Bank Ref / Trx" : "ব্যাংক রেফারেন্স / আইডি")
                                      : (lang === "en" ? "Transaction ID" : "ট্রানজেকশন আইডি")} *
                                  </label>
                                  <input
                                    type="text"
                                    placeholder={paymentMethod === "Bank" ? "Ref Name / Code" : "9J87K9L1"}
                                    value={paymentTrxId}
                                    onChange={(e) => setPaymentTrxId(e.target.value)}
                                    className="w-full bg-white border border-stone-200 rounded px-2 py-1 text-xs font-mono uppercase text-stone-900"
                                    required
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                       {/* Integrated Price Summary in Checkout Form */}
                       <div className="border-t border-stone-200 pt-3 space-y-2 mt-4">
                         <div className="space-y-1.5 text-xs font-mono">
                           {discountAmount > 0 && (
                             <div className="flex justify-between text-emerald-600 font-bold font-mono">
                               <span>{DICTIONARY[lang].discount} ({discountPercentage}%)</span>
                               <span>-{formatPrice(discountAmount)}</span>
                             </div>
                           )}
                           <div className="flex justify-between text-stone-605">
                             <span>{DICTIONARY[lang].deliveryCost} ({deliveryLocation === "inside" ? (lang === "en" ? "Inside Dhaka" : "ঢাকার মধ্যে") : (lang === "en" ? "Outside Dhaka" : "ঢাকার বাইরে")})</span>
                             <span className="text-stone-800 font-bold">{formatPrice(deliveryChargeUsd)}</span>
                           </div>
                           <div className="flex justify-between border-t border-stone-100 pt-2 text-sm font-bold text-stone-950">
                             <span>{DICTIONARY[lang].total}</span>
                             <span className="text-stone-955 font-mono text-base font-bold">{formatPrice(finalTotal)}</span>
                           </div>
                         </div>
                       </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowCheckoutForm(false)}
                          className="flex-1 py-3 border border-stone-250 text-stone-600 bg-white hover:bg-stone-50 text-xs font-mono font-bold uppercase rounded-sm cursor-pointer transition-all duration-150 hover:scale-[1.01] active:scale-[0.99]"
                          id="cancel-checkout-action"
                        >
                          {DICTIONARY[lang].cancel}
                        </button>
                        <button
                          type="submit"
                          className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white text-xs font-mono font-bold uppercase tracking-wider rounded-sm cursor-pointer transition-all duration-150 shadow-md hover:scale-[1.015] active:scale-[0.985] flex items-center justify-center gap-1"
                          id="submit-place-order"
                        >
                          <span>🛒 {lang === "en" ? "Confirm Order" : "অর্ডার নিশ্চিত করুন"}</span>
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>

            {/* Cart Footer */}
            {cartDrawerTab === "cart" && cart.length > 0 && !showCheckoutForm && (
              <div className="p-5 border-t border-stone-200 bg-stone-50 space-y-4">
                <div className="space-y-2 text-xs font-mono">
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-bold">
                      <span>{DICTIONARY[lang].discount} ({discountPercentage}%)</span>
                      <span>-{formatPrice(discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>{DICTIONARY[lang].deliveryCost} ({deliveryLocation === "inside" ? (lang === "en" ? "Inside Dhaka" : "ঢাকার মধ্যে") : (lang === "en" ? "Outside Dhaka" : "ঢাকার বাইরে")})</span>
                    <span className="text-stone-700 font-bold">{formatPrice(deliveryChargeUsd)}</span>
                  </div>
                  <div className="flex justify-between border-t border-stone-200 pt-2 text-sm font-bold text-stone-950">
                    <span>{DICTIONARY[lang].total}</span>
                    <span>{formatPrice(finalTotal)}</span>
                  </div>
                </div>

                {!showCheckoutForm ? (
                  <div className="space-y-2">
                    <button
                      onClick={() => setShowCheckoutForm(true)}
                      className="w-full bg-stone-955 hover:bg-stone-900 text-white font-mono text-xs font-bold py-3 uppercase tracking-widest rounded-sm transition-colors text-center cursor-pointer"
                      id="trigger-checkout-form"
                    >
                      {DICTIONARY[lang].checkout}
                    </button>
                    <button
                      onClick={clearCart}
                      className="w-full bg-transparent hover:bg-stone-100 text-stone-500 font-mono text-[10px] py-1.5 uppercase rounded text-center transition-all cursor-pointer"
                      id="clear-all-cart-items"
                    >
                      {DICTIONARY[lang].cancelOrder}
                    </button>
                  </div>
                ) : null}
              </div>
            )}

          </div>
        </>
      )}

      {/* Modern Studio Minimalist Footer */}
      <footer className="mt-20 border-t border-stone-250 bg-white py-12 text-xs text-stone-505 font-mono print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 text-stone-900" dangerouslySetInnerHTML={{ __html: StarIconSvg() }} />
              <h4 className="font-display font-semibold text-stone-900 tracking-tight text-base">{DICTIONARY[lang].brandName}</h4>
            </div>
            <p 
              onClick={() => {
                setAdminTriggerClicks((prev) => {
                  const nextCount = prev + 1;
                  if (nextCount >= 5) {
                    setShowAdminPortal(true);
                    setIsAdminAuthorized(false);
                    setSelectedCategory("All");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    return 0;
                  }
                  return nextCount;
                });
              }}
              className="text-[10px] text-stone-400 cursor-pointer select-none hover:text-stone-600 transition-colors"
              title="Atelier Guarantee"
              id="stealth-admin-copyright-trigger"
            >
              © 2026 {DICTIONARY[lang].domain}. All rights reserved.
            </p>
          </div>

          {/* New Interactive Scan & Share Column */}
          <div className="space-y-4 border-t md:border-t-0 border-stone-100 pt-6 md:pt-0">
            <h5 className="text-stone-900 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <QrCode className="w-4 h-4 text-amber-500" />
              <span>{lang === "en" ? "Scan or Share" : "স্ক্যান এবং শেয়ার"}</span>
            </h5>
            <p className="text-[11px] leading-relaxed text-stone-405 font-sans font-light">
              {lang === "en" 
                ? "Scan using smartphone to explore our shop or download the QR to share instantly!"
                : "স্মার্টফোন ক্যামেরা দিয়ে স্ক্যান করে সরাসরি সাইটে চলে আসুন অথবা বন্ধুদের সাথে শেয়ার করুন!"}
            </p>

            {/* Live QR Image download cluster */}
            <div className="flex items-center gap-3">
              <div className="bg-white p-1.5 rounded border border-stone-200 shadow-xs inline-block shrink-0">
                {footerQrImgUrl ? (
                  <img
                    src={footerQrImgUrl}
                    alt="Riemart Access QR"
                    className="w-20 h-20 block object-contain"
                  />
                ) : (
                  <div className="w-20 h-20 flex items-center justify-center bg-stone-50 text-[9px] text-stone-400 font-mono">
                    Generating...
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                {/* Download image file trigger */}
                <button
                  onClick={() => {
                    if (!footerQrImgUrl) return;
                    const link = document.createElement("a");
                    link.href = footerQrImgUrl;
                    link.download = `riemart_access_qr.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    addSystemLog(
                      "success",
                      "QR Code Generated (Downloaded): Footer QR Code downloaded successfully for sharing",
                      "কিউআর কোড তৈরি (ডাউনলোড): শেয়ার করার উদ্দেশ্যে ফুটার কিউআর কোড ডাউনলোড করা হয়েছে"
                    );
                  }}
                  disabled={!footerQrImgUrl}
                  className="bg-stone-955 hover:bg-stone-900 disabled:opacity-50 text-white font-mono text-[9px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  id="footer-qr-download-action"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>{lang === "en" ? "Save QR" : "কিউআর ডাউনলোড"}</span>
                </button>

                {/* Direct text link clipboard trigger */}
                <button
                  onClick={() => {
                    const finalLink = getDynamicShareUrl("footer_share");
                    const success = safeCopyToClipboard(finalLink);
                    if (success) {
                      alert(lang === "en" ? "✓ Public store link copied successfully to clipboard!" : "✓ পাবলিক স্টোর লিংকটি সফলভাবে ক্লিপবোর্ডে কপি করা হয়েছে!");
                    } else {
                      alert(lang === "en" ? "Failed to copy link automatically." : "লিংকটি কপি করা যায়নি।");
                    }
                    addSystemLog(
                      "info",
                      "QR Code Generated (Copied): Footer direct store link copied with source parameters",
                      "কিউআর কোড তৈরি (কপি): ফুটার ডিরেক্ট স্টোর লিংক কিপবোর্ডে কপি করা হয়েছে"
                    );
                  }}
                  className="bg-stone-100 hover:bg-stone-200 text-stone-800 font-mono text-[9px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded flex items-center gap-1.5 transition-all cursor-pointer border border-stone-250"
                  id="footer-qr-copy-action"
                >
                  <ClipboardList className="w-3.5 h-3.5 text-stone-500" />
                  <span>{lang === "en" ? "Copy Link" : "লিংক কপি"}</span>
                </button>
              </div>
            </div>

            {/* Multichannel Quick Share triggers */}
            <div className="space-y-1.5 px-0.5">
              <span className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wide">
                {lang === "en" ? "Connect & Share:" : "যোগাযোগ ও শেয়ারঃ"}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {/* Whatsapp */}
                <a
                  href={`https://wa.me/?text=${encodeURIComponent((lang === "en" ? "Visit Riemart Premium Store: " : "রিয়ালমার্ট প্রিমিয়াম স্টোরে চলে আসুন: ") + getDynamicShareUrl("whatsapp_share"))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.preventDefault();
                    const shareText = (lang === "en" ? "Visit Riemart Premium Store: " : "রিয়ালমার্ট প্রিমিয়াম স্টোরে চলে আসুন: ") + getDynamicShareUrl("whatsapp_share");
                    const success = safeCopyToClipboard(shareText);
                    const destUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
                    try {
                      window.open(destUrl, "_blank", "noopener,noreferrer");
                    } catch (err) {
                      console.warn("WhatsApp open blocked by sandbox rules:", err);
                    }
                    if (success) {
                      alert(lang === "en" 
                        ? "✓ WhatsApp message & link copied to clipboard!\nIf WhatsApp did not launch automatically (common inside preview iframes), you can paste the text directly into your chat." 
                        : "✓ হোয়াটসঅ্যাপ শেয়ার লিংক ও টেক্সট ক্লিপবোর্ডে কপি হয়েছে!\nযদি হোয়াটসঅ্যাপ অ্যাপ বা ওয়েব অটোমেটিক ওপেন না হয়, তবে কপি করা টেক্সটটি সরাসরি যেকোনো চ্যাটে পেস্ট করতে পারেন।"
                      );
                    }
                    addSystemLog(
                      "info",
                      "QR Code Generated (Shared): premium store checkout path shared via WhatsApp",
                      "কিউআর কোড তৈরি (শেয়ার): হোয়াটসঅ্যাপের মাধ্যমে স্টোরের লিংক শেয়ার করা হয়েছে"
                    );
                  }}
                  className="w-8 h-8 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
                  title="WhatsApp"
                >
                  <MessageCircle className="w-4 h-4 fill-white text-emerald-500" />
                </a>

                {/* Facebook Share */}
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getDynamicShareUrl("facebook_share"))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.preventDefault();
                    const shareUrl = getDynamicShareUrl("facebook_share");
                    const success = safeCopyToClipboard(shareUrl);
                    const destUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
                    try {
                      window.open(destUrl, "_blank", "noopener,noreferrer");
                    } catch (err) {
                      console.warn("Facebook Share open blocked by sandbox rules:", err);
                    }
                    if (success) {
                      alert(lang === "en"
                        ? "✓ Facebook share link copied to clipboard!\nIf the FB share dialog did not pop up automatically, you can paste the link directly to post it online."
                        : "✓ ফেসবুক শেয়ার লিংক ক্লিপবোর্ডে কপি হয়েছে!\nআইফ্রেমের কারণে ফেসবুক শেয়ার ডায়ালগ অটোমেটিক ওপেন না হলে, কপি করা লিংকটি সরাসরি আপনার ওয়ালে পেস্ট করে পোস্ট করতে পারেন।"
                      );
                    }
                    addSystemLog(
                      "info",
                      "QR Code Generated (Shared): premium store checkout path shared via Facebook",
                      "কিউআর কোড তৈরি (শেয়ার): ফেসবুকের মাধ্যমে স্টোরের লিংক শেয়ার করা হয়েছে"
                    );
                  }}
                  className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
                  title={lang === "en" ? "Share on Facebook" : "ফেসবুকে শেয়ার করুন"}
                >
                  <Facebook className="w-4 h-4 fill-white text-blue-600" />
                </a>

                {/* Direct Messenger Support Chat */}
                <a
                  href={`https://m.me/${settings.facebookMessengerUsername || "riemart.bd"}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.preventDefault();
                    const username = settings.facebookMessengerUsername || "riemart.bd";
                    const mmeUrl = `https://m.me/${username}`;
                    const success = safeCopyToClipboard(mmeUrl);
                    try {
                      window.open(mmeUrl, "_blank", "noopener,noreferrer");
                    } catch (err) {
                      console.warn("Messenger open blocked by sandbox rules:", err);
                    }
                    if (success) {
                      alert(lang === "en"
                        ? `✓ Messenger handle [m.me/${username}] copied to clipboard!\nIf the chat window did not open, visit manually or paste the link in your browser.`
                        : `✓ মেসেঞ্জার হ্যান্ডেল [m.me/${username}] ক্লিপবোর্ডে কপি হয়েছে!\nযদি চ্যাট উইন্ডোটি সরাসরি লোড না হয়, তবে এই লিংকটি ব্রাউজারে পেস্ট করে ম্যাসেজ করুন।`
                      );
                    }
                    addSystemLog(
                      "info",
                      "Customer initiated automated Messenger connection with merchant support",
                      "কাস্টমার মেসেঞ্জার চ্যাটের মাধ্যমে সাহায্য চেয়ে যোগাযোগ করেছেন"
                    );
                  }}
                  className="px-3 h-8 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white flex items-center justify-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer active:scale-95 border border-neutral-700 shadow-xs"
                  title={lang === "en" ? "Chat on Messenger" : "মেসেঞ্জারে চ্যাট করুন"}
                >
                  <MessageCircle className="w-3.5 h-3.5 text-sky-400 fill-sky-400" />
                  <span>{lang === "en" ? "Messenger" : "মেসেঞ্জার"}</span>
                </a>

                {/* Direct Facebook Page redirection */}
                {settings.facebookPageUrl && (
                  <a
                    href={settings.facebookPageUrl && !/^https?:\/\//i.test(settings.facebookPageUrl) ? `https://${settings.facebookPageUrl.trim()}` : settings.facebookPageUrl.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      e.preventDefault();
                      let rawUrl = (settings.facebookPageUrl || "https://www.facebook.com/riemart.bd").trim();
                      if (rawUrl && !/^https?:\/\//i.test(rawUrl)) {
                        rawUrl = `https://${rawUrl}`;
                      }
                      const pageUrl = rawUrl;
                      const success = safeCopyToClipboard(pageUrl);
                      try {
                        window.open(pageUrl, "_blank", "noopener,noreferrer");
                      } catch (err) {
                        console.warn("Facebook Page redirect blocked by sandbox rules:", err);
                      }
                      if (success) {
                        alert(lang === "en"
                          ? `✓ Facebook Page URL copied to clipboard!\nIf the official page did not open, you can visit manually: ${pageUrl}`
                          : `✓ ফেসবুক পেজ লিংক ক্লিপবোর্ডে কপি হয়েছে!\nযদি অফিশিয়াল পেজটি সরাসরি ওপেন না হয়, তবে ব্রাউজারে পেস্ট করে পেজটি ভিজিট করুনঃ\n${pageUrl}`
                        );
                      }
                      addSystemLog(
                        "info",
                        "Customer visited official Facebook shop page via footer redirect",
                        "কাস্টমার ফুটার লিংক দিয়ে অফিশিয়াল ফেসবুক পেজ ভিজিট করেছেন"
                      );
                    }}
                    className="px-3 h-8 rounded-full bg-white hover:bg-stone-50 text-stone-800 flex items-center justify-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer active:scale-95 border border-stone-250 shadow-xs"
                    title={lang === "en" ? "Visit Facebook Page" : "ফেসবুক পেজ ভিজিট"}
                  >
                    <Facebook className="w-3.5 h-3.5 text-blue-600" />
                    <span>{lang === "en" ? "Page" : "ফেসবুক পেজ"}</span>
                  </a>
                )}

                {/* Instagram bio helper workflow */}
                <button
                  onClick={() => {
                    const linkText = getDynamicShareUrl("instagram_bio");
                    const success = safeCopyToClipboard(linkText);
                    alert(
                      lang === "en" 
                        ? "✓ Link copied to clipboard!\nInstagram constraints prevent direct link forwarding. We have copied the premium shop link so you can paste it in your bio or share with friends instantly!" 
                        : "✓ স্টোর লিংকটি ক্লিপবোর্ডে কপি করা হয়েছে!\nইনস্টাগ্রাম পলিটিক্যাল পলিসির কারণে ব্রাউজার থেকে সরাসরি লিংক শেয়ারে বাধা আসতে পারে। তাই আমরা আপনার কিবোর্ডে লিংকটি কপি করে দিয়েছি, আপনি বন্ধুদের কাছে অথবা বায়ো-তে পেস্ট করতে পারেন।"
                    );
                    try {
                      window.open("https://instagram.com", "_blank", "noopener,noreferrer");
                    } catch (err) {
                      console.warn("Instagram open blocked by sandbox rules:", err);
                    }
                    addSystemLog(
                      "info",
                      "QR Code Generated (Copied): Premium store url copied for Instagram Bio redirect",
                      "কিউআর কোড তৈরি (কপি): ইনস্টাগ্রাম বায়োর জন্য স্টোরের লিংক কপি করা হয়েছে"
                    );
                  }}
                  className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-500 via-pink-500 to-purple-600 hover:opacity-95 text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
                  title="Instagram"
                >
                  <Instagram className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>
          </div>

        </div>
      </footer>

      {/* ==================== CUSTOMER ACCOUNT DRAWER ==================== */}
      {isAccountOpen && (
        <>
          {/* Backdrop Blur Overlay */}
          <div 
            onClick={() => setIsAccountOpen(false)} 
            className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs z-45 transition-opacity duration-200 cursor-pointer" 
            id="account-drawer-backdrop"
          />
          <div 
            className="fixed top-0 bottom-16 md:bottom-0 right-0 z-50 w-full max-w-md bg-white border-l border-stone-200 shadow-2xl flex flex-col justify-between animate-studio-reveal print:hidden" 
            id="account-hub-drawer-panel"
          >
            {/* Header */}
            <div className="p-5 border-b border-stone-200 flex justify-between items-center bg-stone-955 text-white">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-amber-400" />
                <h3 className="font-display font-medium text-sm tracking-widest uppercase">
                  {lang === "en" ? "Member Space" : "কাস্টমার হাব"}
                </h3>
              </div>
              <button
                onClick={() => setIsAccountOpen(false)}
                className="text-stone-400 hover:text-white p-1 rounded hover:bg-stone-800 transition-colors cursor-pointer"
                id="close-account-drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs Bar */}
            <div className="flex border-b border-stone-150 bg-stone-50 overflow-x-auto divide-x divide-stone-150 text-[10px] font-mono uppercase tracking-wider font-bold">
              {loggedInUser ? (
                <>
                  <button
                    onClick={() => setAccountActiveTab("profile")}
                    className={`flex-1 py-3 text-center transition-colors cursor-pointer whitespace-nowrap px-3 ${accountActiveTab === "profile" ? "bg-white text-stone-900 border-b-2 border-stone-900" : "text-stone-500 hover:text-stone-900"}`}
                  >
                    {lang === "en" ? "Profile" : "প্রোফাইল"}
                  </button>
                  <button
                    onClick={() => setAccountActiveTab("orders")}
                    className={`flex-1 py-3 text-center transition-colors cursor-pointer whitespace-nowrap px-3 ${accountActiveTab === "orders" ? "bg-white text-stone-900 border-b-2 border-stone-900" : "text-stone-500 hover:text-stone-900"}`}
                  >
                    {lang === "en" ? "Track Orders" : "অর্ডার ট্র্যাক"}
                  </button>
                  <button
                    onClick={() => setAccountActiveTab("notifications")}
                    className={`flex-1 py-3 text-center transition-colors cursor-pointer whitespace-nowrap px-3 relative ${accountActiveTab === "notifications" ? "bg-white text-stone-900 border-b-2 border-stone-900" : "text-stone-500 hover:text-stone-900"}`}
                  >
                    <span>{lang === "en" ? "Inbox" : "ইনবক্স"}</span>
                    {getFilteredNotifications().some(n => !n.isRead) && (
                      <span className="absolute top-2.5 right-2 w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" />
                    )}
                  </button>
                  <button
                    onClick={() => setAccountActiveTab("wishlist")}
                    className={`flex-1 py-3 text-center transition-colors cursor-pointer whitespace-nowrap px-3 ${accountActiveTab === "wishlist" ? "bg-white text-stone-900 border-b-2 border-stone-900" : "text-stone-500 hover:text-stone-900"}`}
                  >
                    {lang === "en" ? "Wishlist" : "উইশলিস্ট"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { setAccountActiveTab("login"); setAuthMessage(null); }}
                    className={`flex-1 py-3.5 text-center transition-colors cursor-pointer ${accountActiveTab === "login" ? "bg-white text-stone-900 border-b-2 border-stone-900" : "text-stone-500 hover:text-stone-900"}`}
                  >
                    {lang === "en" ? "Sign In" : "লগইন"}
                  </button>
                  <button
                    onClick={() => { setAccountActiveTab("register"); setAuthMessage(null); }}
                    className={`flex-1 py-3.5 text-center transition-colors cursor-pointer ${accountActiveTab === "register" ? "bg-white text-stone-900 border-b-2 border-stone-900" : "text-stone-500 hover:text-stone-900"}`}
                  >
                    {lang === "en" ? "Create Account" : "অ্যাকাউন্ট তৈরি"}
                  </button>
                </>
              )}
            </div>

            {/* Scrollable Container Body */}
            <div 
              className={`flex-1 overflow-y-auto p-5 space-y-4 bg-white text-stone-850 ${isInputActive ? "pb-72" : "pb-24 ml-safe mr-safe"}`}
              id="account-drawer-scroll-body"
            >

              {/* AUTHENTICATION - LOGIN VIEW */}
              {!loggedInUser && accountActiveTab === "login" && (
                <div className="space-y-4 animate-studio-reveal">
                  {socialAuthType ? (
                    /* INTERACTIVE SOCIAL AUTHORIZATION DETAILS FORM (FIX FOR WRONG GMAIL, BIRTH DATE, ADDRESS) */
                    <div className="bg-stone-50 border border-stone-200 rounded p-4 space-y-3.5 text-left shadow-xs">
                      <div className="flex items-center gap-2 border-b border-stone-200 pb-2.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${socialAuthType === "google" ? "bg-red-500" : "bg-blue-700"}`}>
                          {socialAuthType === "google" ? "G" : "f"}
                        </div>
                        <div>
                          <h4 className="font-display font-semibold text-stone-900 text-xs uppercase tracking-wider">
                            {socialAuthType === "google" ? "Sync with Google Profile" : "Sync with Facebook Account"}
                          </h4>
                          <p className="text-[9px] text-stone-500 font-mono">
                            {lang === "en" ? "AUTHENTICATED CLIENT SIDE SIGN-IN" : "নিরাপদ সোশাল মিডিয়া সিঙ্ক ব্যবস্থা"}
                          </p>
                        </div>
                      </div>

                      <div className="p-2.5 bg-amber-50 text-amber-900 border border-amber-200/40 rounded text-[10px] leading-relaxed font-sans">
                        {lang === "en" 
                          ? "ℹ️ Connection verified! Please review or enter your correct contact address, date of birth, and email to tracking purchases."
                          : "ℹ️ কানেকশন সফল! অনুগ্রহ করে আপনার সঠিক জিমেইল, জন্ম তারিখ, মোবাইল নম্বর এবং বর্তমান ঠিকানাটি প্রদান করুন যা অর্ডার ট্র্যাকিং এ দরকার।" }
                      </div>

                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!authName.trim() || !authPhone.trim() || !authBirthDate || !authGender || !authAddress.trim()) {
                            alert(lang === "en" ? "Please fill all fields marked with *" : "অনুগ্রহ করে সব প্রয়োজনীয় তথ্য দিন। *");
                            return;
                          }

                          const newUser = {
                            name: authName.trim(),
                            phone: authPhone.trim(),
                            birthDate: authBirthDate,
                            gender: authGender,
                            address: authAddress.trim(),
                            email: authEmail.trim(),
                            socialType: socialAuthType,
                            savedBkash: authPhone.trim(),
                            savedNagad: "",
                            savedUpay: "",
                            profilePicture: authProfilePicture
                          };

                          // Add or update in registeredUsers collection
                          setRegisteredUsers((prev) => {
                            const exists = prev.some((u) => u.phone === newUser.phone);
                            if (exists) {
                              return prev.map((u) => u.phone === newUser.phone ? { ...u, ...newUser } : u);
                            }
                            return [...prev, newUser];
                          });

                          setLoggedInUser(newUser);
                          setAccountActiveTab("profile");
                          setSocialAuthType(null); // Reset social activation
                          setAuthMessage(null);

                          const newNotif = {
                            id: "notif-social-" + Date.now(),
                            titleEn: `${socialAuthType === "google" ? "Google" : "Facebook"} Sign-In Complete`,
                            titleBn: `${socialAuthType === "google" ? "গুগল" : "ফেসবুক"} সাইন-ইন সম্পন্ন`,
                            messageEn: `Welcome, ${authName.trim()}! Your member profile is synced with email ${authEmail.trim()} successfully.`,
                            messageBn: `স্বাগতম ${authName.trim()}, রিয়ামার্ট ডাটাবেজে আপনার অ্যাকাউন্ট তথ্য আপডেট করা সম্পন্ন হয়েছে।`,
                            date: new Date().toISOString(),
                            isRead: false,
                            type: "offer" as const
                          };
                          setCustomerNotifications((prev) => [newNotif, ...prev]);
                        }}
                        className="space-y-3 text-xs text-left"
                      >
                        <div>
                          <label className="block text-[9px] font-mono text-stone-500 uppercase tracking-wide mb-1 text-left">
                            {lang === "en" ? "Full Name" : "আপনার নাম"} *
                          </label>
                          <UltraFastInput
                            type="text"
                            required
                            placeholder="Anisur Rahman"
                            value={authName}
                            onChange={setAuthName}
                            className="w-full bg-white border border-stone-250 rounded px-2.5 py-1.5 text-xs text-stone-900"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] font-mono text-stone-505 uppercase tracking-wide mb-1 text-left">
                            {socialAuthType === "google" ? (lang === "en" ? "Google Gmail Address" : "জিমেইল এড্রেস") : (lang === "en" ? "Facebook Email Address" : "ফেসবুক ইমেইল এড্রেস")} *
                          </label>
                          <UltraFastInput
                            type="email"
                            required
                            placeholder="username@gmail.com"
                            value={authEmail}
                            onChange={setAuthEmail}
                            className="w-full bg-white border border-stone-250 rounded px-2.5 py-1.5 text-xs font-mono text-stone-900"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-mono text-stone-500 uppercase tracking-wide mb-1 text-left">
                              {lang === "en" ? "Mobile Number" : "মোবাইল নম্বর"} *
                            </label>
                            <UltraFastInput
                              type="tel"
                              required
                              placeholder="017XXXXXXXX"
                              value={authPhone}
                              onChange={setAuthPhone}
                              className="w-full bg-white border border-stone-250 rounded px-2.5 py-1.5 text-xs font-mono text-stone-900"
                            />
                          </div>

                          <div>
                            <label className="block text-[9px] font-mono text-stone-505 uppercase tracking-wide mb-1 text-left">
                              {lang === "en" ? "Gender" : "জেন্ডার"} *
                            </label>
                            <UltraFastSelect
                              required
                              value={authGender}
                              onChange={(val) => setAuthGender(val as any)}
                              className="w-full bg-white border border-stone-250 rounded px-2.5 py-1 text-xs text-stone-900 h-[34px]"
                            >
                              <option value="">Select</option>
                              <option value="Male">{lang === "en" ? "Male" : "পুরুষ"}</option>
                              <option value="Female">{lang === "en" ? "Female" : "মহিলা"}</option>
                              <option value="Other">{lang === "en" ? "Other" : "অন্যান্য"}</option>
                            </UltraFastSelect>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[9px] font-mono text-stone-505 uppercase tracking-wide mb-1 text-left">
                            {lang === "en" ? "Birth Date" : "জন্ম তারিখ"} *
                          </label>
                          <UltraFastInput
                            type="date"
                            required
                            value={authBirthDate}
                            onChange={setAuthBirthDate}
                            debounceMs={10}
                            className="w-full bg-white border border-stone-250 rounded px-2 py-1 text-xs font-mono text-stone-900 h-[34px]"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] font-mono text-stone-505 uppercase tracking-wide mb-1 text-left font-bold">
                            {lang === "en" ? "Delivery Coordinates Address" : "ডেলিভারি বা বিলিং ঠিকানা"} *
                          </label>
                          <UltraFastTextarea
                            required
                            placeholder="House 42, Road 12, Sector 3, Uttara, Dhaka"
                            value={authAddress}
                            onChange={setAuthAddress}
                            rows={2}
                            className="w-full bg-white border border-stone-250 rounded px-2.5 py-1.5 text-xs text-stone-900 font-sans resize-none"
                          />
                        </div>

                        <div className="flex gap-2 pt-2">
                          <button
                            type="submit"
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-[10px] font-bold py-2 px-3 uppercase rounded tracking-wider cursor-pointer transition-all hover:shadow"
                          >
                            {lang === "en" ? "Complete Secure Auth" : "নিবন্ধন সম্পূর্ণ করুন"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setSocialAuthType(null)}
                            className="bg-stone-200 hover:bg-stone-300 text-stone-700 font-mono text-[10px] py-2 px-3 uppercase rounded cursor-pointer transition-all"
                          >
                            {lang === "en" ? "Cancel" : "বাতিল"}
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    <>
                      <div className="text-center py-4 space-y-1">
                        <User className="w-10 h-10 text-stone-300 mx-auto" />
                        <h4 className="font-display font-medium text-stone-900 text-sm">
                          {lang === "en" ? "Sign in to Riemart" : "রিমার্ট মেম্বারশিপ লগইন"}
                        </h4>
                        <p className="text-[10px] text-stone-400 font-mono">
                          {lang === "en" ? "ENTER YOUR DETAILS LIVE TO FETCH WISHLISTS" : "আপনার অ্যাকাউন্ট ব্যবহার করতে মোবাইল দিন বা সোশাল লগইন সিলেক্ট করুন"}
                        </p>
                      </div>

                      {authMessage && (
                        <div className="p-2.5 bg-amber-50 text-amber-900 border border-amber-200/50 rounded text-xs text-center font-mono">
                          {authMessage}
                        </div>
                      )}

                      <form
                        id="customer-login-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!authPhone.trim()) return;

                          // Check if the user exists in registeredUsers list first
                          const foundUser = registeredUsers.find(
                            (u) => u.phone.trim() === authPhone.trim()
                          );

                          if (foundUser) {
                            setLoggedInUser(foundUser);
                            setAccountActiveTab("profile");
                            setAuthMessage(null);

                            const greetNotif = {
                              id: "notif-login-" + Date.now(),
                              titleEn: "Successfully Logged In!",
                              titleBn: "লগইন সফল হয়েছে!",
                              messageEn: `Welcome back, ${foundUser.name}. Your session is active with phone ${authPhone.trim()}.`,
                              messageBn: `স্বাগতম ${foundUser.name}, আপনার পেমেন্ট বা পূর্ববর্তী ট্র্যাকিং সক্রিয় করা হয়েছে।`,
                              date: new Date().toISOString(),
                              isRead: false,
                              type: "offer" as const
                            };
                            setCustomerNotifications((prev) => [greetNotif, ...prev]);
                          } else {
                            // User not found! Automatically switch to registration tab and prefill the phone number
                            setAccountActiveTab("register");
                            setAuthMessage(
                              lang === "en"
                                ? "This mobile number is not registered yet. We prefilled the phone for you — please complete the registration process."
                                : "এই নাম্বারটি নিবন্ধিত নেই! মেম্বার হওয়া সহজ, নিচের তথ্যগুলো পূরণ করে এক ক্লিকেই নিবন্ধন সম্পূর্ণ করুন।"
                            );
                          }
                        }}
                        className="space-y-4 pb-6"
                      >
                        <div>
                          <label className="block text-[10px] font-mono text-stone-505 uppercase tracking-widest mb-1 text-left">
                            {lang === "en" ? "Enter Phone Number" : "মোবাইল নাম্বার দিন"} *
                          </label>
                          <UltraFastInput
                            type="tel"
                            required
                            placeholder="01711223344"
                            value={authPhone}
                            onChange={setAuthPhone}
                            className="w-full bg-stone-50 border border-stone-200 rounded px-3 py-2 text-xs font-mono"
                          />
                        </div>
                      </form>

                      <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-stone-200" />
                        </div>
                        <div className="relative flex justify-center text-[10px] uppercase font-mono bg-white px-2 text-stone-400">
                          {lang === "en" ? "Alternative Social Sign-in" : "অথবা সোশাল মিডিয়া লগইন করুন"}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs font-mono tracking-wider">
                        {/* Google Sign in simulation */}
                        <button
                          onClick={() => {
                            setSocialAuthType("google");
                            setAuthName("");
                            setAuthEmail("");
                            setAuthBirthDate("");
                            setAuthGender("");
                            setAuthAddress("");
                            // Keep phone number if they already typed it in the login input
                            setAuthPhone(authPhone || "");
                            setAuthProfilePicture("https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120");
                          }}
                          className="flex items-center justify-center gap-1.5 py-2.5 border border-stone-300 rounded hover:bg-stone-50 transition-all cursor-pointer text-[10px] font-semibold active:scale-95"
                        >
                          <span className="font-bold text-red-500 font-sans">G</span>
                          <span className="font-bold text-blue-500 font-sans">m</span>
                          <span>{lang === "en" ? "Google" : "গুগল"}</span>
                        </button>

                        {/* Facebook Sign in simulation */}
                        <button
                          onClick={() => {
                            setSocialAuthType("facebook");
                            setAuthName("");
                            setAuthEmail("");
                            setAuthBirthDate("");
                            setAuthGender("");
                            setAuthAddress("");
                            // Keep phone number if they already typed it in the login input
                            setAuthPhone(authPhone || "");
                            setAuthProfilePicture("https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=120");
                          }}
                          className="flex items-center justify-center gap-1.5 py-2.5 border border-stone-300 rounded hover:bg-stone-50 transition-all cursor-pointer text-[10px] font-semibold active:scale-95"
                        >
                          <span className="font-bold text-blue-700 font-sans">f</span>
                          <span>{lang === "en" ? "Facebook" : "ফেসবুক"}</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* AUTHENTICATION - REGISTER VIEW */}
              {!loggedInUser && accountActiveTab === "register" && (
                <div className="space-y-4 animate-studio-reveal">
                  <div className="text-center py-4 space-y-1">
                    <User className="w-10 h-10 text-stone-300 mx-auto" />
                    <h4 className="font-display font-medium text-stone-900 text-sm">
                      {lang === "en" ? "Create Account" : "রিয়ামার্ট মেম্বারশিপ রেজিস্ট্রেশন"}
                    </h4>
                    <p className="text-[10px] text-stone-400 font-mono">
                      {lang === "en" ? "BECOME AN ATELIER MEMBER TO SYNC PREFERENCE DATA" : "নিবন্ধন সম্পূর্ণ করে কন্টাক্ট ইনফো ও ট্র্যাকিং হিস্ট্রি লাইভ সিঙ্ক করুন"}
                    </p>
                  </div>

                  {authMessage && (
                    <div className="p-2.5 bg-amber-50 text-amber-900 border border-amber-200/50 rounded text-xs text-center font-mono">
                      {authMessage}
                    </div>
                  )}

                  <form
                    id="customer-reg-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!authName.trim() || !authPhone.trim() || !authBirthDate || !authGender || !authAddress.trim()) {
                        alert(lang === "en" ? "Please fill all required fields marked with *" : "অনুগ্রহ করে সব প্রয়োজনীয় ঘরগুলো পূরণ করুন *");
                        return;
                      }

                      const newUser = {
                        name: authName.trim(),
                        phone: authPhone.trim(),
                        birthDate: authBirthDate,
                        gender: authGender,
                        address: authAddress.trim(),
                        email: authEmail.trim(),
                        socialType: "standard" as const,
                        savedBkash: "",
                        savedNagad: "",
                        savedUpay: "",
                        profilePicture: authProfilePicture || ""
                      };

                      setLoggedInUser(newUser);
                      setAccountActiveTab("profile");
                      setAuthMessage(null);

                      const welcomeNotif = {
                        id: "notif-reg-" + Date.now(),
                        titleEn: "Atelier Membership Activated!",
                        titleBn: "মেম্বারশিপ সক্রিয় হয়েছে!",
                        messageEn: `Welcome, ${authName.trim()}! You have joined Riemart Atelier. Your personal member space is fully synchronized.`,
                        messageBn: `স্বাগতম ${authName.trim()}! রিয়ামার্ট মেম্বার ক্লাবে আপনার রেজিস্ট্রেশন সফলভাবে সম্পন্ন হয়েছে।`,
                        date: new Date().toISOString(),
                        isRead: false,
                        type: "offer" as const
                      };
                      setCustomerNotifications((prev) => [welcomeNotif, ...prev]);
                    }}
                    className="space-y-4 text-left pb-12"
                  >
                    {/* Customer Photo Upload Section */}
                    <div className="flex flex-col items-center justify-center p-3 bg-stone-50 border border-stone-200/80 rounded my-1 space-y-2 relative">
                      <div className="relative">
                        {authProfilePicture ? (
                          <div className="relative">
                            <img 
                              src={authProfilePicture} 
                              alt="Avatar Preview" 
                              className="w-16 h-16 rounded-full object-cover border border-stone-300 shadow-xs"
                              referrerPolicy="no-referrer"
                            />
                            <button
                              type="button"
                              onClick={() => setAuthProfilePicture("")}
                              className="absolute -top-1 -right-1 bg-red-600 text-white hover:bg-red-700 rounded-full p-1 shadow transition-colors cursor-pointer border border-white"
                              title={lang === "en" ? "Delete photo" : "ছবি ডিলেট করুন"}
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-stone-200 border border-stone-300 flex items-center justify-center text-stone-500">
                             <User className="w-8 h-8" />
                          </div>
                        )}
                        <label 
                          htmlFor="customer-register-avatar-file"
                          className="absolute -bottom-1 -right-1 bg-stone-900 hover:bg-stone-800 text-white border border-stone-700 p-1 rounded-full shadow cursor-pointer transition-all hover:scale-105"
                          title={lang === "en" ? "Upload avatar photo" : "ছবি আপলোড করুন"}
                        >
                          <Camera className="w-3 h-3 text-amber-400" />
                          <input 
                            type="file" 
                            id="customer-register-avatar-file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                // Instant optimistic preview to render selected picture under 1ms
                                const previewUrl = URL.createObjectURL(file);
                                setAuthProfilePicture(previewUrl);
                                compressAndConvertAvatar(file, (base64) => {
                                  setAuthProfilePicture(base64);
                                });
                              }
                            }}
                          />
                        </label>
                      </div>
                      <div className="text-center">
                        <div className="text-[9px] font-mono uppercase font-bold text-stone-600 tracking-wider">
                          {lang === "en" ? "Upload Profile Image" : "প্রোফাইল ছবি আপলোড"} ({lang === "en" ? "Optional" : "ঐচ্ছিক"})
                        </div>
                        <p className="text-[8px] text-stone-400 font-sans tracking-wide leading-none">
                          {lang === "en" ? "Click camera icon to add photo" : "ছবি যুক্ত করতে ক্যামেরা আইকন আলতো চাপুন"}
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono text-stone-505 uppercase tracking-wide mb-1 text-left">
                        {lang === "en" ? "Full Name" : "আপনার নাম"} *
                      </label>
                      <UltraFastInput
                        type="text"
                        required
                        placeholder="Sharif Ahmed"
                        value={authName}
                        onChange={setAuthName}
                        className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 text-xs font-sans"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono text-stone-505 uppercase tracking-wide mb-1 text-left font-mono">
                        {lang === "en" ? "Mobile Phone Number" : "মোবাইল নম্বর"} *
                      </label>
                      <UltraFastInput
                        type="tel"
                        required
                        placeholder="01711223344"
                        value={authPhone}
                        onChange={setAuthPhone}
                        className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 text-xs font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-left animate-studio-reveal">
                      <div>
                        <label className="block text-[10px] font-mono text-stone-505 uppercase tracking-wide mb-1 text-left">
                          {lang === "en" ? "Birth Date" : "জন্ম তারিখ"} *
                        </label>
                        <UltraFastInput
                          type="date"
                          required
                          value={authBirthDate}
                          onChange={setAuthBirthDate}
                          debounceMs={10}
                          className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 text-xs font-mono h-[34px]"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono text-stone-505 uppercase tracking-wide mb-1 text-left">
                          {lang === "en" ? "Gender" : "জেন্ডার"} *
                        </label>
                        <UltraFastSelect
                          required
                          value={authGender}
                          onChange={(val) => setAuthGender(val as any)}
                          className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 text-xs font-sans h-[34px]"
                        >
                          <option value="">Select</option>
                          <option value="Male">{lang === "en" ? "Male" : "পুরুষ"}</option>
                          <option value="Female">{lang === "en" ? "Female" : "মহিলা"}</option>
                          <option value="Other">{lang === "en" ? "Other" : "অন্যান্য"}</option>
                        </UltraFastSelect>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono text-stone-505 uppercase tracking-wide mb-1 text-left">
                        {lang === "en" ? "Google Gmail Address" : "জিমেইল এড্রেস"} ({lang === "en" ? "Optional" : "ঐচ্ছিক"})
                      </label>
                      <UltraFastInput
                        type="email"
                        placeholder="sharif@gmail.com"
                        value={authEmail}
                        onChange={setAuthEmail}
                        className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 text-xs font-sans"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono text-stone-505 uppercase tracking-wide mb-1 text-left font-bold font-mono">
                        {lang === "en" ? "Delivery / Billing Address" : "ডেলিভারি ঠিকানা / অ্যাড্রেস"} *
                      </label>
                      <UltraFastTextarea
                        required
                        placeholder="House 42, Road 12, Sector 3, Uttara, Dhaka"
                        value={authAddress}
                        onChange={setAuthAddress}
                        rows={2}
                        className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 font-sans text-xs resize-none"
                      />
                    </div>
                  </form>
                </div>
              )}

              {/* PROFILE TAB (LOGGED IN) WITH SAVED BANKING & SEND MONEY SIMULATION */}
              {loggedInUser && accountActiveTab === "profile" && (
                <div className="space-y-4 animate-studio-reveal text-left">
                  <div className="p-4 bg-stone-50 border border-stone-200 rounded-sm space-y-2 text-xs">
                    <h4 className="font-mono text-xs font-bold text-stone-900 uppercase flex items-center justify-between border-b border-stone-250 pb-1 text-left">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-amber-500" />
                        <span>{lang === "en" ? "Profile Identity Card" : "কাস্টমার মেম্বারশিপ কার্ড"}</span>
                      </div>
                      {!isEditingProfile && (
                        <button
                          onClick={() => {
                            setEditProfileName(loggedInUser.name);
                            setEditProfileBirthDate(loggedInUser.birthDate);
                            setEditProfileGender(loggedInUser.gender);
                            setEditProfileEmail(loggedInUser.email || "");
                            setEditProfileAddress(loggedInUser.address);
                            setIsEditingProfile(true);
                          }}
                          className="bg-amber-600 hover:bg-amber-700 text-white font-mono text-[9px] px-2 py-0.5 rounded-sm uppercase tracking-wide cursor-pointer transition-all border border-amber-500"
                        >
                          {lang === "en" ? "Edit" : "সম্পাদনা"}
                        </button>
                      )}
                    </h4>

                    {/* Highly interactive Profile Picture (Avatar) Upload, Edit, and Delete block */}
                    <div className="flex flex-col items-center justify-center py-4 bg-white/70 rounded border border-stone-200/60 my-3 space-y-2 relative">
                      <div className="relative">
                        {loggedInUser.profilePicture ? (
                          <div className="relative">
                            <img 
                              src={loggedInUser.profilePicture} 
                              alt={loggedInUser.name} 
                              className="w-18 h-18 rounded-full object-cover border-2 border-stone-200 shadow-sm"
                              referrerPolicy="no-referrer"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                showSafeConfirm(
                                  lang === "en" ? "Delete Avatar" : "ছবি ডিলেট",
                                  lang === "en" ? "Are you sure you want to delete your profile picture?" : "আপনি কি নিশ্চিত যে প্রোফাইল ছবিটি ডিলেট করতে চান?",
                                  () => {
                                    setLoggedInUser((prev) => {
                                      if (!prev) return null;
                                      const updated = { ...prev };
                                      delete updated.profilePicture;
                                      return updated;
                                    });
                                  }
                                );
                              }}
                              className="absolute -top-1 -right-1 bg-red-600 text-white hover:bg-red-700 rounded-full p-1.5 shadow-md transition-colors cursor-pointer border border-white"
                              title={lang === "en" ? "Delete profile photo" : "ছবি ডিলেট করুন"}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="w-18 h-18 rounded-full bg-stone-100 border border-stone-250 flex items-center justify-center text-stone-400">
                            <User className="w-9 h-9" />
                          </div>
                        )}
                        <label 
                          htmlFor="customer-avatar-input"
                          className="absolute -bottom-1 -right-1 bg-stone-900 hover:bg-stone-850 text-white border border-stone-750 p-1.5 rounded-full shadow cursor-pointer transition-all hover:scale-105"
                          title={lang === "en" ? "Upload or edit profile picture" : "ছবি আপলোড বা পরিবর্তন করুন"}
                        >
                          <Camera className="w-3.5 h-3.5 text-amber-400" />
                          <input 
                            type="file" 
                            id="customer-avatar-input" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                // Instant optimistic preview to render selected picture under 1ms
                                const previewUrl = URL.createObjectURL(file);
                                setLoggedInUser((prev) => prev ? { ...prev, profilePicture: previewUrl } : null);
                                compressAndConvertAvatar(file, (base64) => {
                                  setLoggedInUser((prev) => prev ? { ...prev, profilePicture: base64 } : null);
                                });
                              }
                            }}
                          />
                        </label>
                      </div>
                      <div className="text-center pt-1.5">
                        <div className="text-[10px] font-mono uppercase font-bold text-stone-700 tracking-wider">
                          {lang === "en" ? "Profile Picture" : "প্রোফাইল ছবি"}
                        </div>
                        <p className="text-[8px] text-stone-400 font-sans tracking-wide leading-relaxed">
                          {lang === "en" ? "Click camera icon to upload photo (Max 2MB)" : "ক্যামেরা আইকন ক্লিক করে ছবি আপলোড করুন"}
                        </p>
                      </div>
                    </div>

                    {isEditingProfile ? (
                      <div className="space-y-2 my-2 text-stone-850">
                        <div>
                          <label className="block text-[9px] font-mono text-stone-400 uppercase tracking-wider mb-0.5">{lang === "en" ? "Full Name:" : "নাম:"}</label>
                          <UltraFastInput
                            type="text"
                            value={editProfileName}
                            onChange={setEditProfileName}
                            className="w-full bg-white border border-stone-250 rounded px-2 py-1 text-xs font-sans text-stone-900"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-mono text-stone-400 uppercase tracking-wider mb-0.5">{lang === "en" ? "Birth Date:" : "জন্ম তারিখ:"}</label>
                            <UltraFastInput
                              type="date"
                              value={editProfileBirthDate}
                              onChange={setEditProfileBirthDate}
                              debounceMs={10}
                              className="w-full bg-white border border-stone-250 rounded px-2 py-1 text-xs font-mono text-stone-900"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-mono text-stone-400 uppercase tracking-wider mb-0.5">{lang === "en" ? "Gender:" : "জেন্ডার:"}</label>
                            <UltraFastSelect
                              value={editProfileGender}
                              onChange={(val) => setEditProfileGender(val as any)}
                              className="w-full bg-white border border-stone-250 rounded px-2 py-1.5 text-xs font-sans text-stone-900"
                            >
                              <option value="Male">{lang === "en" ? "Male" : "পুরুষ"}</option>
                              <option value="Female">{lang === "en" ? "Female" : "মহিলা"}</option>
                              <option value="Other">{lang === "en" ? "Other" : "অন্যান্য"}</option>
                            </UltraFastSelect>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[9px] font-mono text-stone-400 uppercase tracking-wider mb-0.5">{lang === "en" ? "Email Address:" : "ইমেইল:"}</label>
                          <UltraFastInput
                            type="email"
                            value={editProfileEmail}
                            onChange={setEditProfileEmail}
                            className="w-full bg-white border border-stone-250 rounded px-2 py-1 text-xs font-sans text-stone-900"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] font-mono text-stone-400 uppercase tracking-wider mb-0.5">{lang === "en" ? "Delivery Address:" : "ডেলিভারি ঠিকানা:"}</label>
                          <UltraFastTextarea
                            value={editProfileAddress}
                            onChange={setEditProfileAddress}
                            rows={2}
                            className="w-full bg-white border border-stone-250 rounded px-2 py-1 text-xs font-sans text-stone-900 resize-none leading-relaxed"
                          />
                        </div>

                        <div className="flex gap-2 pt-1 border-t border-stone-200 mt-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (!editProfileName.trim() || !editProfileAddress.trim()) {
                                alert(lang === "en" ? "Name and address cannot be empty!" : "নাম এবং ঠিকানা খালি রাখা যাবে না!");
                                return;
                              }
                              setLoggedInUser((prev) => prev ? {
                                ...prev,
                                name: editProfileName.trim(),
                                birthDate: editProfileBirthDate,
                                gender: editProfileGender,
                                email: editProfileEmail.trim(),
                                address: editProfileAddress.trim()
                              } : null);
                              setIsEditingProfile(false);
                            }}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-[10px] font-bold py-1.5 uppercase rounded-sm cursor-pointer transition-all"
                          >
                            {lang === "en" ? "Save Changes" : "পরিবর্তন সেভ করুন"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsEditingProfile(false)}
                            className="bg-stone-200 hover:bg-stone-300 text-stone-700 font-mono text-[10px] py-1.5 px-3 uppercase rounded-sm cursor-pointer transition-all"
                          >
                            {lang === "en" ? "Cancel" : "বাতিল"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-y-1.5 text-[11px] pt-1 text-left">
                          <span className="text-stone-400 uppercase font-mono text-left">{lang === "en" ? "Full Name:" : "নাম:"}</span>
                          <span className="font-sans font-bold text-stone-900 text-left">{loggedInUser.name}</span>

                          <span className="text-stone-400 uppercase font-mono text-left">{lang === "en" ? "Saved Phone:" : "মোবাইল নম্বর:"}</span>
                          <span className="font-mono text-stone-850 text-left">{loggedInUser.phone}</span>

                          <span className="text-stone-400 uppercase font-mono text-left">{lang === "en" ? "Birth Date:" : "জন্ম তারিখ:"}</span>
                          <span className="font-mono text-stone-850 text-left">{loggedInUser.birthDate}</span>

                          <span className="text-stone-400 uppercase font-mono text-left">{lang === "en" ? "Gender:" : "জেন্ডার:"}</span>
                          <span className="font-sans text-stone-850 text-left">{loggedInUser.gender === "Male" ? (lang === "en" ? "Male" : "পুরুষ") : loggedInUser.gender === "Female" ? (lang === "en" ? "Female" : "মহিলা") : (lang === "en" ? "Other" : "অন্যান্য")}</span>

                          <span className="text-stone-400 uppercase font-mono text-left">{lang === "en" ? "Email Address:" : "ইমেইল:"}</span>
                          <span className="font-sans truncate text-stone-850 text-left">{loggedInUser.email || "N/A"}</span>
                        </div>

                        <div className="pt-2 border-t border-stone-200 text-left">
                          <span className="text-stone-400 uppercase font-mono text-[10px] block mb-0.5 text-left">{lang === "en" ? "Delivery Coordinates:" : "ঠিকানা:"}</span>
                          <p className="font-sans text-stone-850 leading-relaxed text-[11px] text-left">{loggedInUser.address}</p>
                        </div>

                        <button
                          onClick={() => {
                            setLoggedInUser(null);
                            setAccountActiveTab("login");
                          }}
                          className="w-full bg-red-50 hover:bg-red-100 text-red-700 text-[10px] font-mono py-1.5 uppercase font-bold tracking-wider rounded border border-red-200/50 mt-3 transition-all cursor-pointer"
                        >
                          {lang === "en" ? "Log Out of Session" : "অ্যাকাউন্ট লগ আউট করুন"}
                        </button>
                      </>
                    )}
                  </div>
                  {/* SAVED BANKING CHANNELS SETTINGS */}
                  <div className="p-4 border border-stone-200 bg-white rounded-sm space-y-3 text-left">
                    <h4 className="font-mono text-xs font-bold text-stone-900 uppercase border-b border-stone-150 pb-1.5 flex justify-between items-center text-left">
                      <span>{lang === "en" ? "Saved Banking Numbers" : "পেমেন্ট নম্বর সমুহ সংরক্ষণ"}</span>
                      <span className="bg-emerald-500 text-white text-[8px] px-1 rounded animate-pulse uppercase">active</span>
                    </h4>
                    <p className="text-[10px] leading-relaxed text-stone-500 text-left">
                      {lang === "en"
                        ? "Save your personal bKash, Nagad, and Upay sender numbers. Doing so automatically prefills checkout forms!"
                        : "বিকাশ, নগদ ও উপায় নম্বর সেভ করে রাখুন। সেভ করা থাকলে মোবাইল ব্যাংকিং পেমেন্ট পদ্ধতিতে আপনার প্রেরক নম্বর সরাসরি প্রি-ফিল হয়ে যাবে!"}
                    </p>

                    <div className="space-y-2.5 text-xs text-left">
                      <div>
                        <label className="block text-[9px] font-mono text-stone-505 uppercase tracking-wide mb-1 text-left">
                          Personal bKash Number (বিকাশ নম্বর)
                        </label>
                        <UltraFastInput
                          type="tel"
                          placeholder="017XXXXXXXX"
                          value={loggedInUser.savedBkash || ""}
                          onChange={(val) => {
                            setLoggedInUser((prev) => prev ? { ...prev, savedBkash: val } : null);
                          }}
                          className="w-full bg-stone-50 border border-stone-200 rounded px-2 py-1 text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-mono text-stone-505 uppercase tracking-wide mb-1 text-left font-mono">
                          Personal Nagad Number (নগদ নম্বর)
                        </label>
                        <UltraFastInput
                          type="tel"
                          placeholder="018XXXXXXXX"
                          value={loggedInUser.savedNagad || ""}
                          onChange={(val) => {
                            setLoggedInUser((prev) => prev ? { ...prev, savedNagad: val } : null);
                          }}
                          className="w-full bg-stone-50 border border-stone-200 rounded px-2 py-1 text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-mono text-stone-505 uppercase tracking-wide mb-1 text-left">
                          Personal Upay Number (উপায় নম্বর)
                        </label>
                        <UltraFastInput
                          type="tel"
                          placeholder="016XXXXXXXX"
                          value={loggedInUser.savedUpay || ""}
                          onChange={(val) => {
                            setLoggedInUser((prev) => prev ? { ...prev, savedUpay: val } : null);
                          }}
                          className="w-full bg-stone-50 border border-stone-200 rounded px-2 py-1 text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* MOBILE MONEY SEND MONEY TRANSACTIONS SIMULATOR */}
                  <div className="p-4 bg-amber-50/50 border border-amber-200/50 rounded-sm space-y-3 mt-4 text-left">
                    <h4 className="font-mono text-xs font-bold text-amber-900 uppercase border-b border-amber-200 pb-1.5 flex items-center gap-1.5 text-left">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>{lang === "en" ? "Send Money Gateway Utility" : "সেন্ড মানি পেমেন্ট অ্যাসিস্ট্যান্ট"}</span>
                    </h4>
                    <p className="text-[10px] leading-relaxed text-amber-805 text-left">
                      {lang === "en"
                        ? "Copied our store collection number? Plug in your checkout BDT money transfer amount and generate a real Transaction ID Instantly."
                        : "আমাদের কালেকশন নম্বরে সহজে সেন্ড মানি করুন। নিচের বক্সে আপনার কাঙ্ক্ষিত অ্যামাউন্ট বসিয়ে ট্রানজেকশন আইডি প্রডিউস করে তা সরাসরি বিলিং ফর্মে বসান।"}
                    </p>

                    <div className="p-2.5 bg-stone-900 text-stone-50 rounded space-y-2 text-xs font-mono border border-stone-800 text-left">
                      <div className="flex justify-between items-center text-[10px] text-left">
                        <span>RECIPIENT SENDER NUMBER:</span>
                        <div className="flex items-center gap-1.5 text-left">
                          <span className="bg-stone-850 text-amber-400 px-1.5 py-0.5 rounded text-xs select-all font-bold">01681868938</span>
                          <button
                            onClick={() => {
                              safeCopyToClipboard("01681868938");
                              alert(lang === "en" ? "Recipient Number Copied!" : "রিসিপিয়েন্ট নম্বর কপি হয়েছে!");
                            }}
                            className="bg-stone-800 hover:bg-stone-700 text-white rounded px-1.5 py-0.5 text-[9px] uppercase cursor-pointer"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-[10px] border-t border-stone-800/80 pt-2 text-stone-400">
                        <span>COLLECTION CARRIERS:</span>
                        <span>bKash / Nagad / Upay</span>
                      </div>
                    </div>

                    <div className="space-y-2 text-left">
                      <div className="flex gap-2">
                        <input
                          type="number"
                          id="simulator-bdt-amt"
                          placeholder="Amount in BDT (e.g. 500)"
                          className="flex-1 bg-white border border-stone-200 rounded px-2 py-1.5 text-xs font-mono"
                        />
                        <button
                          onClick={() => {
                            const inputEle = document.getElementById("simulator-bdt-amt") as HTMLInputElement;
                            const amt = inputEle ? inputEle.value : "";
                            if (!amt) {
                              alert(lang === "en" ? "Please fill the transfer money BDT amount first." : "অনুগ্রহ করে টাকার পরিমাণ উল্লেখ করুন।");
                              return;
                            }
                            const chars = "ABCDEFGHJKLMNOPQRSTUVWXYZ0123456789";
                            let tx = "TRX";
                            for (let i = 0; i < 8; i++) {
                              tx += chars.charAt(Math.floor(Math.random() * chars.length));
                            }
                            const simulationLabel = document.getElementById("simulation-result-id");
                            if (simulationLabel) {
                              simulationLabel.innerText = tx;
                            }
                            // Store in clipboard
                            safeCopyToClipboard(tx);
                            alert(lang === "en" ? `Simulated Send Money completed successfully! Transaction ID [${tx}] copied to clipboard.` : `সফলভাবে ফ্রড-প্রুফ টাকা পেমেন্ট নিশ্চিত করা হয়েছে! ট্রানজেকশন আইডি [${tx}] ক্লিপবোর্ডে কপি করা হয়েছে। চেকআউট ফর্মে এটি ব্যবহার করতে পারবেন।`);
                          }}
                          className="bg-stone-900 hover:bg-stone-800 text-white font-mono text-[10px] font-bold px-3 py-1.5 rounded uppercase cursor-pointer"
                        >
                          Generate & Copy
                        </button>
                      </div>

                      <div className="p-2 bg-amber-100/60 rounded border border-amber-200/50 flex justify-between items-center text-xs font-mono">
                        <span className="text-amber-805 font-bold text-[10px]">LATEST MEMO TRX:</span>
                        <span id="simulation-result-id" className="font-bold text-stone-950 bg-white px-2 py-0.5 rounded select-all shadow-sm">None</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TRACK PAST ORDERS TAB (LOGGED IN) WITH MILESTONE PROGRESS STEPPERS */}
              {loggedInUser && accountActiveTab === "orders" && (
                <div className="space-y-4 animate-studio-reveal text-xs text-left">
                  <h4 className="font-mono text-xs font-bold text-stone-900 uppercase border-b border-stone-150 pb-1.5 text-left">
                    {lang === "en" ? "Live Order Pipeline & Tracking" : "পূর্ববর্তী অর্ডার ট্র্যাকিং ও পাইপলাইন"}
                  </h4>

                  {(() => {
                    const userPhone = loggedInUser.phone?.trim();
                    const customerOrders = orders.filter(o => o && o.customerPhone && (o.customerPhone.trim() === userPhone || normalizePhone(o.customerPhone) === normalizePhone(userPhone)));

                    if (customerOrders.length === 0) {
                      return (
                        <div className="text-center py-12 space-y-2">
                          <ClipboardList className="w-10 h-10 text-stone-300 mx-auto" />
                          <p className="text-[11px] font-mono text-stone-400 uppercase tracking-wider font-bold">
                            {lang === "en" ? "No Orders Attached" : "কোড খুঁজে পাওয়া যায়নি"}
                          </p>
                          <p className="text-[10px] text-stone-500 max-w-[240px] mx-auto leading-relaxed">
                            {lang === "en"
                              ? `Orders associated with your active phone [${loggedInUser.phone}] will instantly feed here in realtime.`
                              : `আপনার মেম্বার মোবাইল [${loggedInUser.phone}] দিয়ে প্লেস করা সমস্ত অর্ডারের বিবরণ লাইভ ট্র্যাকিং সহ এখানে পাবেন।`}
                          </p>
                        </div>
                      );
                    }

                    // Apply filters
                    const filteredOrders = customerOrders.filter((order) => {
                      if (!order.date) return true;
                      const orderTime = new Date(order.date).getTime();
                      if (customerOrderStartDate) {
                        const start = new Date(customerOrderStartDate);
                        start.setHours(0, 0, 0, 0);
                        if (orderTime < start.getTime()) return false;
                      }
                      if (customerOrderEndDate) {
                        const end = new Date(customerOrderEndDate);
                        end.setHours(23, 59, 59, 999);
                        if (orderTime > end.getTime()) return false;
                      }
                      return true;
                    });

                    // Apply Sorting
                    const sortedOrders = [...filteredOrders].sort((a, b) => {
                      if (customerOrderSort === "date-desc") {
                        return new Date(b.date).getTime() - new Date(a.date).getTime();
                      } else if (customerOrderSort === "date-asc") {
                        return new Date(a.date).getTime() - new Date(b.date).getTime();
                      } else if (customerOrderSort === "price-desc") {
                        return b.totalPrice - a.totalPrice;
                      } else if (customerOrderSort === "price-asc") {
                        return a.totalPrice - b.totalPrice;
                      }
                      return 0;
                    });

                    const isFiltered = customerOrderStartDate || customerOrderEndDate || customerOrderSort !== "date-desc";

                    return (
                      <div className="space-y-4 text-left">
                        {/* Selected Range Summary Metrics */}
                        <div className="grid grid-cols-2 gap-3 pb-1">
                          <div className="p-3 bg-stone-50 border border-stone-200 rounded-sm">
                            <span className="block text-[9px] font-mono text-stone-400 uppercase tracking-widest">
                              {lang === "en" ? "Matched Orders" : "ফিল্টার্ড অর্ডারের সংখ্যা"}
                            </span>
                            <span className="block text-lg font-mono font-bold text-stone-900 mt-0.5">
                              {filteredOrders.length}
                            </span>
                          </div>
                          <div className="p-3 bg-stone-50 border border-stone-200 rounded-sm">
                            <span className="block text-[9px] font-mono text-stone-400 uppercase tracking-widest">
                              {lang === "en" ? "Cumulative Spent" : "মোট ব্যয়িত অর্থ"}
                            </span>
                            <span className="block text-lg font-mono font-bold text-amber-700 mt-0.5">
                              {formatPrice(filteredOrders.reduce((sum, ord) => sum + ord.totalPrice, 0))}
                            </span>
                          </div>
                        </div>

                        {/* Interactive Filter & Sort Controls */}
                        <div className="p-3 bg-stone-50 border border-stone-200 rounded-sm space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[9px] font-mono text-stone-500 uppercase tracking-wider mb-1 text-left">
                                {lang === "en" ? "From Date" : "শুরুর তারিখ"}
                              </label>
                              <input
                                type="date"
                                value={customerOrderStartDate}
                                onChange={(e) => setCustomerOrderStartDate(e.target.value)}
                                className="w-full bg-white border border-stone-200 rounded px-2.5 py-1 text-[11px] font-mono text-stone-850 h-[30px]"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-mono text-stone-500 uppercase tracking-wider mb-1 text-left">
                                {lang === "en" ? "To Date" : "শেষের তারিখ"}
                              </label>
                              <input
                                type="date"
                                value={customerOrderEndDate}
                                onChange={(e) => setCustomerOrderEndDate(e.target.value)}
                                className="w-full bg-white border border-stone-200 rounded px-2.5 py-1 text-[11px] font-mono text-stone-850 h-[30px]"
                              />
                            </div>
                          </div>

                          <div className="flex gap-2 items-end">
                            <div className="flex-1">
                              <label className="block text-[9px] font-mono text-stone-500 uppercase tracking-wider mb-1 text-left">
                                {lang === "en" ? "Sort Past Invoices" : "ইনভয়েস সর্ট করুন"}
                              </label>
                              <select
                                value={customerOrderSort}
                                onChange={(e) => setCustomerOrderSort(e.target.value)}
                                className="w-full bg-white border border-stone-200 rounded px-2 py-1 text-[11px] font-sans text-stone-850 h-[30px] cursor-pointer"
                              >
                                <option value="date-desc">
                                  {lang === "en" ? "Date: Newest to Oldest" : "তারিখ: নতুন থেকে পুরাতন"}
                                </option>
                                <option value="date-asc">
                                  {lang === "en" ? "Date: Oldest to Newest" : "তারিখ: পুরাতন থেকে নতুন"}
                                </option>
                                <option value="price-desc">
                                  {lang === "en" ? "Price: High to Low" : "টাকা: সর্বোচ্চ থেকে সর্বনিম্ন"}
                                </option>
                                <option value="price-asc">
                                  {lang === "en" ? "Price: Low to High" : "টাকা: সর্বনিম্ন থেকে সর্বোচ্চ"}
                                </option>
                              </select>
                            </div>

                            {isFiltered && (
                              <button
                                onClick={() => {
                                  setCustomerOrderStartDate("");
                                  setCustomerOrderEndDate("");
                                  setCustomerOrderSort("date-desc");
                                }}
                                className="bg-stone-200 hover:bg-stone-300 text-stone-700 text-[10px] font-mono font-bold px-3 h-[30px] rounded uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1"
                              >
                                <X className="w-3 h-3" />
                                <span>{lang === "en" ? "Reset" : "রিসেট"}</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Filter Status Metadata Label */}
                        <div className="flex justify-between items-center text-[10px] text-stone-400 font-mono uppercase bg-stone-100/50 p-1.5 px-2 rounded-sm border border-stone-200/50 text-left">
                          <span>
                            {lang === "en" ? "Invoices Found:" : "খুঁজে পাওয়া ইনভয়েস:"}{" "}
                            <span className="font-bold text-stone-800">{filteredOrders.length}</span> / {customerOrders.length}
                          </span>
                          {isFiltered && (
                            <span className="text-amber-700 font-bold lowercase">
                              {lang === "en" ? "filters active" : "ফিল্টার সক্রিয়"}
                            </span>
                          )}
                        </div>

                        {/* Orders List / Match results */}
                        {sortedOrders.length === 0 ? (
                          <div className="text-center py-10 bg-stone-50 border border-stone-200 rounded-sm space-y-2">
                            <ClipboardList className="w-8 h-8 text-stone-300 mx-auto" />
                            <p className="font-mono text-[10px] text-stone-400 uppercase tracking-wider font-bold">
                              {lang === "en" ? "No Matched Records" : "কোনো ফলাফল মেলেনি"}
                            </p>
                            <p className="text-[10px] text-stone-500 max-w-[200px] mx-auto leading-relaxed">
                              {lang === "en"
                                ? "Try clearing or picking a wider date range to locate specific past invoices."
                                : "অর্ডারের তারিখের সীমা বাড়িয়ে পুনরায় চেষ্টা করুন বা রিসেট ফিল্টার চাপুন।"}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {sortedOrders.map((order) => {
                              const statusSteps = ["Pending", "Processing", "Shipped", "Completed"];
                              const currentStepIndex = statusSteps.indexOf(order.status === "Cancelled" ? "Pending" : order.status);
                              const totalItemsCount = order.items.reduce((sum, it) => sum + it.quantity, 0);

                              return (
                                <div key={order.id} className="p-3 border border-stone-200 bg-stone-50 rounded-sm space-y-3 shadow-xs text-left transition-all hover:border-stone-300">
                                  <div className="flex justify-between items-center text-[11px] font-mono border-b border-stone-150 pb-1.5 font-sans">
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <span className="font-bold text-stone-900 font-mono">{order.id}</span>
                                      <span className="text-stone-400">|</span>
                                      <span className="text-[10px] text-stone-500 font-mono">{new Date(order.date).toLocaleDateString()}</span>
                                      <span className="text-stone-400">|</span>
                                      <span className="text-[9px] bg-stone-200 text-stone-700 px-1.5 py-0.5 rounded font-sans font-bold uppercase tracking-wider">
                                        {lang === "en" ? `${totalItemsCount} ${totalItemsCount === 1 ? 'Item' : 'Items'}` : `${totalItemsCount} টি আইটেম`}
                                      </span>
                                    </div>
                                    <span className="text-stone-905 font-bold font-mono">{formatPrice(order.totalPrice)}</span>
                                  </div>

                                  {/* Stepper Pipeline Module */}
                                  {order.status === "Cancelled" ? (
                                    <div className="p-2 bg-red-50 text-red-750 text-[10px] font-mono rounded border border-red-200/50 flex items-center gap-1.5">
                                      <span className="p-0.5 rounded-full bg-red-600 text-white font-bold w-4 h-4 flex items-center justify-center text-[9px]">X</span>
                                      <span>{lang === "en" ? "Order Cancelled / Rejected by Atelier" : "দুঃখিত, কোনো বিশেষ সমস্যার কারণে আপনার অর্ডারটি বাতিল করা হয়েছে।"}</span>
                                    </div>
                                  ) : (
                                    <div className="space-y-2.5 pt-1 text-left">
                                      <div className="flex items-center justify-between font-mono text-[9px] text-stone-400 uppercase font-bold px-1">
                                        <span>Pending</span>
                                        <span>Processing</span>
                                        <span>Shipped</span>
                                        <span>Completed</span>
                                      </div>
                                      <div className="relative flex items-center justify-between pt-1">
                                        {/* Stepper Line Background */}
                                        <div className="absolute left-1.5 right-1.5 top-1/2 -translate-y-1/2 h-0.5 bg-stone-200 z-0" />
                                        
                                        {/* Stepper Fill Line */}
                                        <div 
                                          className="absolute left-1.5 top-1/2 -translate-y-1/2 h-0.5 bg-amber-500 z-0 transition-all duration-300"
                                          style={{ width: `${(currentStepIndex / 3) * 98}%` }}
                                        />

                                        {statusSteps.map((step, idx) => {
                                          const active = idx <= currentStepIndex;
                                          return (
                                            <div 
                                              key={step} 
                                              className={`w-4 h-4 rounded-full flex items-center justify-center font-bold font-mono text-[8px] z-10 transition-all duration-350 ${active ? "bg-amber-500 text-stone-950 scale-110 shadow-md ring-2 ring-amber-100" : "bg-stone-100 text-stone-400 border border-stone-250"}`}
                                            >
                                              {idx + 1}
                                            </div>
                                          );
                                        })}
                                      </div>
                                      <p className="text-[10px] text-center font-mono text-stone-500 pt-0.5 animate-pulse uppercase">
                                        {lang === "en" ? "Live Stepper Coordinates: " : "বর্তমান ট্র্যাকিং অবস্থা: "}
                                        <span className="font-bold text-amber-700">
                                          {order.status === "Pending" && (lang === "en" ? "AWAITING CONFIRMATION" : "অর্ডার নিশ্চিতকরণের জন্য অপেক্ষমান")}
                                          {order.status === "Processing" && (lang === "en" ? "PACKAGING AT ATELIER" : "পণ্য প্রস্তুত ও প্যাকিং করা হচ্ছে")}
                                          {order.status === "Shipped" && (lang === "en" ? "Cargo ON ROUTE" : "কুরিয়ার সার্ভিসে পাঠানো হয়েছে")}
                                          {order.status === "Completed" && (lang === "en" ? "DELIVERED SUCCESSFULLY" : "সফলভাবে ডেলিভারি সম্পন্ন হয়েছে")}
                                        </span>
                                      </p>
                                    </div>
                                  )}

                                  {/* Order mini-content items list */}
                                  <div className="space-y-1.5 border-t border-stone-200/50 pt-2 text-[11px] text-left">
                                    {order.items.map((it, idx) => (
                                      <div key={idx} className="flex justify-between text-stone-605 col-span-2">
                                        <span>● {lang === "en" ? it.productNameEn : it.productNameBn} (x{it.quantity})</span>
                                        <span>{formatPrice(it.priceAtPurchase)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* SAVED WISHLIST GRID VIEW TAB */}
              {loggedInUser && accountActiveTab === "wishlist" && (
                <div className="space-y-4 animate-studio-reveal text-xs text-left">
                  <h4 className="font-mono text-xs font-bold text-stone-900 uppercase border-b border-stone-150 pb-1.5 flex justify-between items-center text-left">
                    <span>{lang === "en" ? "My Favorite Wishlist Items" : "আপনার সেভ করা উইশলিস্ট"}</span>
                    <span className="text-[10px] text-red-500 font-bold">♥ {wishlist.length}</span>
                  </h4>

                  {wishlist.length === 0 ? (
                    <div className="text-center py-12 space-y-2">
                      <Heart className="w-10 h-10 text-stone-200 mx-auto" />
                      <p className="text-[11px] font-mono text-stone-400 uppercase tracking-wider font-bold">
                        {lang === "en" ? "Wishlist is Empty" : "উইশলিস্ট খালি"}
                      </p>
                      <p className="text-[10px] text-stone-500 max-w-[240px] mx-auto leading-relaxed">
                        {lang === "en"
                          ? "Bookmark any luxury product while exploring the feed, and see price status changes here live!"
                          : "পণ্যের গ্যালারি থেকে যেকোনো ঘড়ি বা পারফিউম উইশলিস্ট করতে লাভ আইকনে প্রেস করুন।"}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 text-left">
                      {wishlist.map((item) => (
                        <div key={item.id} className="border border-stone-200 p-2 rounded bg-stone-50 space-y-2 flex flex-col justify-between text-left">
                          <div className="space-y-1 relative group text-left">
                            <img 
                              src={item.image} 
                              alt={item.nameEn} 
                              className="w-full h-24 object-cover rounded-sm border border-stone-100" 
                              referrerPolicy="no-referrer"
                            />
                            <button
                              onClick={() => toggleWishlist(item)}
                              className="absolute top-1 right-1 bg-white p-1 rounded-full shadow hover:bg-stone-50 text-red-500 cursor-pointer"
                              title="Remove"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <h5 className="font-semibold text-stone-850 truncate text-[11px] block text-left">
                              {lang === "en" ? item.nameEn : item.nameBn}
                            </h5>
                            <p className="text-xs font-mono font-bold text-stone-900 text-left">
                              {formatPrice(item.price)}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              addToCart(item, 1);
                              setIsAccountOpen(false);
                              setIsCartOpen(true);
                              setShowCheckoutForm(true);
                            }}
                            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-mono text-[9px] py-1.5 uppercase rounded-sm font-bold tracking-wider cursor-pointer"
                          >
                            {lang === "en" ? "BUY NOW" : "কিনুন"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* WEBSITE NOTIFICATIONS INBOX TAB */}
              {loggedInUser && accountActiveTab === "notifications" && (
                <div className="space-y-3 animate-studio-reveal text-xs text-left">
                  <div className="flex justify-between items-center border-b border-stone-150 pb-1.5 text-left">
                    <h4 className="font-mono text-xs font-bold text-stone-900 uppercase text-left">
                      {lang === "en" ? "System Inbox Alerts" : "গুরুত্বপূর্ণ নোটিফিকেশন সমুহ"}
                    </h4>
                    {getFilteredNotifications().some(n => !n.isRead) && (
                      <button
                        onClick={markFilteredNotificationsAsRead}
                        className="text-[9px] font-mono text-stone-500 uppercase hover:text-stone-900 cursor-pointer"
                      >
                        [{lang === "en" ? "Mark all read" : "সব পঠিত চিহ্নিত করুন"}]
                      </button>
                    )}
                  </div>

                  <div className="space-y-2.5 text-left">
                    {getFilteredNotifications().length === 0 ? (
                      <p className="text-center text-[10px] text-stone-400 font-mono py-8 bg-stone-50 border border-stone-150/50 rounded-sm">
                        {lang === "en" ? "No notification alerts found." : "কোনো নোটিফিকেশন পাওয়া যায়নি।"}
                      </p>
                    ) : (
                      getFilteredNotifications().map((notif) => {
                        const icons = {
                          offer: "🎁",
                          order_confirmed: "✅",
                          order_rejected: "❌",
                          wishlist_update: "💖"
                        };

                        return (
                          <div 
                            key={notif.id} 
                            className={`p-3 border rounded border-stone-200/60 relative text-left ${notif.isRead ? "bg-stone-50" : "bg-amber-50/50 border-amber-200/50"}`}
                          >
                            {!notif.isRead && (
                              <span className="absolute top-2.5 right-2 w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                            )}
                            <div className="flex gap-2 text-left">
                              <span className="text-base select-none leading-none pt-0.5">{notif.type === "offer" ? "🎁" : notif.type === "order_confirmed" ? "✅" : notif.type === "order_rejected" ? "❌" : "🔔"}</span>
                              <div className="space-y-1 overflow-hidden text-left">
                                <h5 className="font-mono font-bold text-stone-900 text-[11px] leading-tight pr-3 truncate text-left">
                                  {lang === "en" ? notif.titleEn : notif.titleBn}
                                </h5>
                                <p className="text-[10px] leading-relaxed text-stone-500 font-sans font-normal text-left">
                                  {lang === "en" ? notif.messageEn : notif.messageBn}
                                </p>
                                <span className="block text-[8px] font-mono text-stone-400 text-left">
                                  {new Date(notif.date).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Permanent Sticky Action Footer (when not logged in) */}
            {!loggedInUser && (accountActiveTab === "login" || accountActiveTab === "register") && (
              <div className="p-4 bg-stone-50 border-t border-stone-200 shadow-inner">
                {accountActiveTab === "login" ? (
                  <button
                    type="submit"
                    form="customer-login-form"
                    className="w-full bg-stone-900 hover:bg-stone-850 text-amber-400 font-mono text-xs font-bold py-3.5 uppercase tracking-widest rounded-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98 border border-stone-800"
                    id="sticky-confirm-login-btn"
                  >
                    <span>{lang === "en" ? "Proceed with OTP" : "ওটিপি কোড দিয়ে লগইন"}</span>
                  </button>
                ) : (
                  <button
                    type="submit"
                    form="customer-reg-form"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs font-bold py-3.5 uppercase tracking-widest rounded-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
                    id="sticky-confirm-reg-btn"
                  >
                    <span>{lang === "en" ? "Confirm Account Registration" : "নিবন্ধন নিশ্চিত করুন (কনফার্ম)"}</span>
                  </button>
                )}
              </div>
            )}

            {/* Permanent Sticky Action Footer (when logged in) */}
            {loggedInUser && (
              <div className="p-4 bg-stone-50 border-t border-stone-200 shadow-inner">
                <button
                  type="button"
                  onClick={() => {
                    setLoggedInUser(null);
                    setAccountActiveTab("login");
                    setSocialAuthType(null);
                  }}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-mono text-xs font-bold py-3.5 uppercase tracking-widest rounded-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98 border border-red-750"
                  id="sticky-confirm-logout-btn"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{lang === "en" ? "Log Out of Hub" : "কাস্টমার হাব লগ আউট"}</span>
                </button>
              </div>
            )}

            {/* Footer containing quick statistics or copyright */}
            <div className="p-4 border-t border-stone-200 bg-stone-50 text-center text-[10px] text-stone-400 font-mono">
              RIEMART STUDIO PORTAL • SECURE CLIENT SESSION
            </div>
          </div>
        </>
      )}

      {/* ==================== PRODUCT PACKAGING QR SCANNER MODAL ==================== */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-stone-900/80 backdrop-blur-sm print:hidden animate-studio-reveal" id="qr-scanner-modal">
          <div className="bg-white border border-stone-200 max-w-lg w-full rounded-sm overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="p-4 border-b border-stone-200 flex justify-between items-center bg-stone-950 text-white">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-amber-400" />
                <h3 className="font-display font-bold uppercase tracking-wider text-xs">
                  {lang === "en" ? "Product Packaging QR Scanner" : "পণ্য কিউআর কোড স্ক্যানার"}
                </h3>
              </div>
              <button 
                onClick={() => setIsScannerOpen(false)}
                className="text-stone-400 hover:text-white transition-colors cursor-pointer"
                id="close-qr-scanner-btn"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Main Scanner Container */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1 flex flex-col justify-between">
              
              {/* Introduction */}
              <div className="text-center font-sans">
                <p className="text-xs text-stone-500">
                  {lang === "en" 
                    ? "Point your device camera at the QR code on any RIEMART physical product packaging to instantly unlock product details, customer authentication certificates, and live pricing data." 
                    : "যেকোনো রিয়ামার্টের পণ্যের প্যাকেজিংয়ে থাকা কিউআর কোডটি ক্যামেরার সামনে ধরুন। এটি পণ্যটির প্রিভিউ ও লাইভ প্রাইসিং সম্পর্কিত তথ্য অটোমেটিক ওপেন করে দেবে।"}
                </p>
              </div>

              {/* Camera Scanning Frame */}
              <div className="relative border border-stone-200 bg-stone-900 rounded-sm aspect-video overflow-hidden flex flex-col items-center justify-center text-white">
                {scannerError ? (
                  <div className="p-4 text-center space-y-2">
                    <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto animate-bounce" />
                    <p className="text-xs font-mono text-stone-305 max-w-xs">{scannerError}</p>
                    <p className="text-[10px] text-stone-400 max-w-xs leading-relaxed">
                      {lang === "en" 
                        ? "Since camera feeds can be restricted in some browsers/iframes, you can use our dynamic simulator or local file upload below." 
                        : "ব্রাউজার বা আইফ্রেম সিকিউরিটির কারণে সরাসরি ক্যামেরা চালু না হলে নিচে থাকা আমাদের ডাইরেক্ট সিমুলেটর ব্যবহার করতে পারেন।"}
                    </p>
                  </div>
                ) : (
                  <>
                    <video 
                      ref={videoRef}
                      className="w-full h-full object-cover"
                    />
                    <canvas 
                      ref={canvasRef}
                      className="hidden"
                    />
                    {/* Laser scanning laser line Overlay */}
                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                      <div className="w-2/3 h-2/3 border-2 border-dashed border-amber-400/80 rounded relative">
                        {/* Red Laser Bar */}
                        <div className="absolute left-0 right-0 h-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,1)] animate-pulse" style={{ top: "50%" }}></div>
                        <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-amber-400"></div>
                        <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-amber-400"></div>
                        <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-amber-400"></div>
                        <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-amber-400"></div>
                      </div>
                      <span className="absolute bottom-2 text-[10px] font-mono font-bold uppercase text-stone-300 bg-black/60 px-2 py-0.5 rounded tracking-widest animate-pulse">
                        {lang === "en" ? "LIVE CAMERA SCANNING" : "ক্যামেরা স্ক্যানিং চলছে"}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Upload fallback container */}
              <div className="border border-dashed border-stone-200 rounded p-4 text-center bg-stone-50 hover:bg-stone-100 transition-colors">
                <p className="text-[11px] font-mono text-stone-500 uppercase mb-2">
                  {lang === "en" ? "Or Upload QR Code Image File" : "অথবা কিউআর কোড ইমেজ ফাইল আপলোড করুন"}
                </p>
                <div className="flex justify-center">
                  <label className="bg-white hover:bg-stone-50 text-stone-850 border border-stone-300 px-3 py-1.5 rounded-sm font-mono text-xs cursor-pointer shadow-xs font-semibold">
                    <span>{lang === "en" ? "Select Image" : "ছবি আপলোড করুন"}</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageUpload} 
                      className="hidden" 
                    />
                  </label>
                </div>
              </div>

              {/* Simulation section (Critical for testing in iframe / without physical packaging) */}
              <div className="p-4 border-2 border-amber-200 bg-amber-50/50 rounded-sm space-y-2.5 text-left">
                <div className="flex items-center gap-1.5 text-amber-900">
                  <Sparkles className="w-4 h-4 text-amber-600 animate-spin" />
                  <span className="font-mono text-xs font-bold uppercase tracking-wider">
                    {lang === "en" ? "Atelier QR Simulator Control" : "কিউআর টেস্ট সিমুলেটর"}
                  </span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed text-left">
                  {lang === "en" 
                    ? "In testing environments, simulate a physical camera response by selecting a product below to trigger the QR response." 
                    : "টেস্টিং সুবিধার্থে নিচে যেকোনো পণ্য সিলেক্ট করে 'সিমুলেট স্ক্যান' বাটনে ক্লিক দিয়ে চেক করতে পারেন।"}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select 
                    id="simulator-product-select"
                    className="bg-white border border-stone-300 rounded-sm text-xs py-1.5 px-2 font-semibold text-stone-800 focus:outline-none"
                    defaultValue=""
                  >
                    <option value="" disabled>{lang === "en" ? "-- Choose Product --" : "-- প্রোডাক্ট সিলেক্ট করুন --"}</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{lang === "en" ? p.nameEn : p.nameBn}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      const selectEl = document.getElementById("simulator-product-select") as HTMLSelectElement | null;
                      if (selectEl && selectEl.value) {
                        handleScannedCode(selectEl.value);
                      } else {
                        const randomProduct = products[Math.floor(Math.random() * products.length)];
                        if (randomProduct) {
                          handleScannedCode(randomProduct.id);
                        }
                      }
                    }}
                    className="bg-stone-900 hover:bg-stone-850 text-white font-mono text-[10px] tracking-wider py-1.5 rounded-sm uppercase font-bold cursor-pointer transition-colors"
                  >
                    🚀 {lang === "en" ? "Simulate Package Scan" : "সিমুলেট প্যাকেজ স্ক্যান"}
                  </button>
                </div>
              </div>

              {/* Status info/alerts */}
              {scannerSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 font-mono text-[11px] rounded-sm text-center font-bold">
                  ✨ {scannerSuccessMsg}
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="p-3 bg-stone-50 border-t border-stone-200 text-center text-[10px] text-stone-400 font-mono">
              RIEMART SECURE BARCODING SYSTEMS v2.0
            </div>

          </div>
        </div>
      )}

      {/* Fixed Bottom Navigation Bar for Mobile */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 z-[60] bg-white/95 backdrop-blur-md border-t border-stone-200/80 px-2 py-1.5 flex justify-around items-center shadow-lg print:hidden transition-all duration-250 ${
        (isInputActive || showAdminPortal) ? "opacity-0 pointer-events-none translate-y-12" : "opacity-100 translate-y-0"
      }`} id="mobile-fixed-bottom-nav">
        
        {/* Home */}
        <button
          onClick={() => {
            setSelectedCategory("All");
            setSelectedSubCategory(null);
            setShowAdminPortal(false);
            setIsCartOpen(false);
            setIsAccountOpen(false);
            setSelectedProduct(null);
            setPrintingOrder(null);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className={`flex flex-col items-center gap-1 text-[10px] uppercase font-mono tracking-wider w-16 transition-colors duration-150 cursor-pointer ${
            selectedCategory === "All" && !showAdminPortal && !isCartOpen && !isAccountOpen && !selectedProduct && !printingOrder
              ? "text-stone-950 font-bold"
              : "text-stone-500 hover:text-stone-900"
          }`}
          id="bottom-nav-home"
        >
          <Compass className="w-5 h-5 text-current" />
          <span>{lang === "en" ? "Home" : "হোম"}</span>
        </button>

        {/* Customer Account */}
        <button
          onClick={() => {
            setPrintingOrder(null);
            setIsCartOpen(false);
            setSelectedProduct(null);
            setIsAccountOpen(true);
            setAccountActiveTab(loggedInUser ? "profile" : "login");
          }}
          className={`flex flex-col items-center gap-1 text-[10px] uppercase font-mono tracking-wider w-16 transition-colors duration-150 cursor-pointer ${
            isAccountOpen && (accountActiveTab === "profile" || accountActiveTab === "login" || accountActiveTab === "register")
              ? "text-stone-950 font-bold"
              : "text-stone-500 hover:text-stone-900"
          }`}
          id="bottom-nav-account"
        >
          {loggedInUser && loggedInUser.profilePicture ? (
            <img 
              src={loggedInUser.profilePicture} 
              alt={loggedInUser.name} 
              className="w-5 h-5 rounded-full object-cover border border-stone-250"
              referrerPolicy="no-referrer"
            />
          ) : (
            <User className="w-5 h-5 text-current" />
          )}
          <span>{lang === "en" ? "Account" : "অ্যাকাউন্ট"}</span>
        </button>

        {/* Notification */}
        <button
          onClick={() => {
            setPrintingOrder(null);
            setIsCartOpen(false);
            setSelectedProduct(null);
            setIsAccountOpen(true);
            setAccountActiveTab("notifications");
            markFilteredNotificationsAsRead();
          }}
          className={`relative flex flex-col items-center gap-1 text-[10px] uppercase font-mono tracking-wider w-16 transition-colors duration-150 cursor-pointer ${
            isAccountOpen && accountActiveTab === "notifications"
              ? "text-stone-950 font-bold"
              : "text-stone-500 hover:text-stone-900"
          }`}
          id="bottom-nav-notifications"
        >
          <Bell className="w-5 h-5 text-current" />
          {getFilteredNotifications().filter((n) => !n.isRead).length > 0 && (
            <span className="absolute top-0 right-3 bg-amber-500 text-stone-950 font-bold text-[8px] w-3.5 h-3.5 rounded-full flex items-center justify-center transform translate-x-1.5 -translate-y-0.5 shadow-sm">
              {getFilteredNotifications().filter((n) => !n.isRead).length}
            </span>
          )}
          <span>{lang === "en" ? "Alerts" : "বার্তা"}</span>
        </button>

        {/* Shopping Bag (Cart) / Add-on Trolley */}
        <button
          onClick={() => {
            setPrintingOrder(null);
            setIsAccountOpen(false);
            setSelectedProduct(null);
            setIsCartOpen(true);
            if (activeAppendOrderId) {
              setSelectedCategory("All");
              setSelectedSubCategory(null);
              setShowAdminPortal(false);
              const el = document.getElementById("search-bar");
              if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
              }
            }
          }}
          className={`relative flex flex-col items-center gap-1 text-[10px] uppercase font-mono tracking-wider w-16 transition-colors duration-150 cursor-pointer ${
            isCartOpen
              ? "text-stone-950 font-bold"
              : activeAppendOrderId
              ? "text-emerald-600 animate-pulse font-bold"
              : "text-stone-500 hover:text-stone-900"
          }`}
          id="bottom-nav-bag"
        >
          {activeAppendOrderId ? (
            <ShoppingCart className="w-5 h-5 text-emerald-600 animate-bounce" />
          ) : (
            <ShoppingBag className="w-5 h-5 text-current" />
          )}
          {cart.length > 0 && (
            <span className="absolute top-0 right-3 bg-stone-900 text-white text-[8px] font-mono font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center transform translate-x-1.5 -translate-y-0.5 shadow-sm border border-stone-100">
              {totalItemsCount}
            </span>
          )}
          <span>
            {activeAppendOrderId
              ? (lang === "en" ? "Trolley" : "ট্রলি")
              : (lang === "en" ? "Bag" : "ব্যাগ")
            }
          </span>
        </button>

      </nav>

      {/* ==================== PRINTABLE INVOICE MODAL ==================== */}
      {printingOrder && (
        <div className="fixed inset-0 z-55 flex flex-col no-print-backdrop scroll-smooth animate-backdrop-fade bg-stone-900/40 backdrop-blur-xs overflow-hidden" id="invoice-print-modal">
          
          {/* Persistent Static 'Print' Header Bar - ALWAYS visible during scroll */}
          <div className="bg-stone-950/95 backdrop-blur-md text-stone-100 p-3 sm:p-4 w-full flex flex-row items-center justify-between gap-3 border-b border-stone-850 print:hidden shadow-lg z-50 shrink-0 select-none rounded-t-sm" id="invoice-top-nav-bar">
            {/* Left Side: Brand name and live billing status */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="w-8 h-8 text-amber-400 shrink-0" dangerouslySetInnerHTML={{ __html: StarIconSvg() }} />
              <div className="text-left font-mono">
                <div className="flex items-center gap-2">
                  <span className="font-display font-black text-xs tracking-wider uppercase text-stone-100">
                    {lang === "en" ? "RIEMART Portal" : "রিয়ামার্ট পোর্টাল"}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/60 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    {lang === "en" ? "Live Bill" : "সরাসরি ক্যাশ মেমো"}
                  </span>
                </div>
                <p className="text-[10px] text-stone-400 mt-0.5">
                  {lang === "en" ? "Secured Transaction Receipts" : "নিরাপদ ডিজিটাল ট্রানজেকশন কপির প্রিভিউ"}
                </p>
              </div>
            </div>

            {/* Right Side: Primary Navigation Actions */}
            <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
              {/* Shop More (Trolley Icon Button - Direct Nav Back) */}
              <button
                onClick={() => {
                  setActiveAppendOrderId(printingOrder.id);
                  setPrintingOrder(null);
                  setSelectedCategory("All");
                  setSelectedSubCategory(null);
                  setShowAdminPortal(false);
                  const el = document.getElementById("search-bar");
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                  }
                }}
                className="bg-emerald-600 hover:bg-emerald-700 hover:scale-[1.02] active:scale-[0.98] text-white text-[11px] font-mono font-extrabold px-3 py-2 rounded-sm uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-md border border-emerald-500"
                id="btn-invoice-shop-more"
                title={lang === "en" ? "Add more items to this existing invoice bill!" : "অতিরিক্ত প্রোডাক্ট সরাসরি এই ক্যাশ মেমোর সাথে যোগ করুন"}
              >
                <ShoppingCart className="w-4 h-4 text-white animate-bounce" />
                {lang === "en" ? "Shop More" : "আরও কিনুন"}
              </button>

              {/* Print Receipt now */}
              <button
                type="button"
                onClick={handlePrintAction}
                className="bg-amber-600 hover:bg-amber-700 hover:scale-[1.02] active:scale-[0.98] text-stone-50 text-[11px] font-mono font-bold px-3 py-2 rounded-sm uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-sm border border-amber-500"
                id="btn-invoice-print-now"
              >
                <Printer className="w-4 h-4 text-stone-50 animate-pulse" />
                {lang === "en" ? "Print" : "প্রিন্ট করুন"}
              </button>

              {/* Print PDF receipt */}
              <button
                type="button"
                onClick={() => downloadInvoicePdf(printingOrder)}
                className="bg-stone-900 hover:bg-stone-800 hover:scale-[1.02] active:scale-[0.98] text-stone-300 text-[11px] font-mono font-bold px-3 py-2 rounded-sm uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-sm border border-stone-800"
                id="btn-invoice-print-pdf"
              >
                <FileText className="w-3.5 h-3.5 text-amber-500" />
                {lang === "en" ? "Save PDF" : "পিডিএফ সেভ"}
              </button>

              {/* Save PDF to Google Drive Button */}
              <button
                type="button"
                onClick={() => saveInvoiceToGoogleDrive(printingOrder)}
                disabled={isUploadingToDrive}
                className="bg-sky-600 hover:bg-sky-700 disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] text-stone-50 text-[11px] font-mono font-bold px-3 py-2 rounded-sm uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-sm border border-sky-500"
                id="btn-invoice-save-drive"
                title={lang === "en" ? "Upload and save this Cash Memo directly to your Google Drive!" : "এই ক্যাশ মেমো সরাসরি আপনার গুগল ড্রাইভে সেভ করুন"}
              >
                <Cloud className={`w-3.5 h-3.5 text-stone-50 ${isUploadingToDrive ? 'animate-spin' : ''}`} />
                {isUploadingToDrive 
                  ? (lang === "en" ? "Uploading..." : "আপলোড হচ্ছে...") 
                  : (lang === "en" ? "Save to Drive" : "ড্রাইভে সেভ")
                }
              </button>

              {/* Close Receipt View */}
              <button
                type="button"
                onClick={() => setPrintingOrder(null)}
                className="bg-stone-800 hover:bg-stone-700 hover:scale-[1.02] active:scale-[0.98] text-stone-300 text-[11px] font-mono px-3 py-2 rounded-sm uppercase tracking-wider transition-all cursor-pointer border border-stone-700 font-bold"
                id="btn-invoice-close"
              >
                {lang === "en" ? "Close" : "বন্ধ করুন"}
              </button>
            </div>
          </div>

          {/* Scrollable container for the printable card */}
          <div className="flex-1 overflow-y-auto w-full p-3 sm:p-6 flex justify-center scroll-smooth print:overflow-visible print:p-0 print:m-0 print:block">
            <div className="bg-white border border-stone-200 max-w-2xl w-full rounded-sm overflow-visible shadow-2xl relative p-6 pb-24 md:p-8 md:pb-8 my-4 sm:my-8 print:border-none print:shadow-none print:p-0 print:m-0 animate-invoice-reveal print:my-0" id="invoice-printed-card">

              {/* Google Drive Status Feedbacks (Hidden on actual physical print) */}
            {(isUploadingToDrive || gdriveResult || gdriveError) && (
              <div className="mb-4 text-xs font-mono border rounded-sm p-4 print:hidden flex flex-col gap-2.5 shadow-xs relative bg-stone-50 border-stone-200">
                <button 
                  type="button"
                  onClick={() => {
                    setGdriveResult(null);
                    setGdriveError(null);
                  }}
                  className="absolute top-2 right-2 text-stone-400 hover:text-stone-750 font-bold p-1 cursor-pointer"
                  title="Close feedback"
                >
                  <X className="w-3.5 h-3.5" />
                </button>

                {isUploadingToDrive && (
                  <div className="flex items-center gap-3 text-sky-600 font-bold animate-pulse">
                    <Cloud className="w-5 h-5 animate-spin" />
                    <span>
                      {lang === "en"
                        ? "Saving Cash Memo PDF directly to your Google Drive..."
                        : "ক্যাশ মেমো পিডিএফটি সরাসরি গুগল ড্রাইভে সেভ করা হচ্ছে..."
                      }
                    </span>
                  </div>
                )}

                {gdriveError && (
                  <div className="flex flex-col gap-1.5 text-red-600">
                    <div className="flex items-center gap-2 font-bold">
                      <AlertTriangle className="w-4 h-4 text-red-500 animate-bounce" />
                      <span>{lang === "en" ? "Upload Failed" : "আপলোড ব্যর্থ হয়েছে"}</span>
                    </div>
                    <p className="text-[11px] font-sans text-stone-600">{gdriveError}</p>
                    <div className="flex gap-2.5 mt-1">
                      <button
                        type="button"
                        onClick={() => saveInvoiceToGoogleDrive(printingOrder)}
                        className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-[10px] font-bold px-2 py-1 rounded"
                      >
                        {lang === "en" ? "Retry Upload" : "আবার চেষ্টা করুন"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDriveConfigModal(true)}
                        className="bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 text-[10px] font-bold px-2 py-1 rounded"
                      >
                        {lang === "en" ? "Configure Client ID" : "ক্লায়েন্ট আইডি সেট আপ"}
                      </button>
                    </div>
                  </div>
                )}

                {gdriveResult && (
                  <div className="flex flex-col gap-2 text-stone-900">
                    <div className="flex items-center gap-2 text-emerald-600 font-bold">
                      <CheckCircle className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
                      <span>{lang === "en" ? "Successfully Saved on Google Drive!" : "সফলভাবে গুগল ড্রাইভে সংরক্ষণ করা হয়েছে!"}</span>
                    </div>
                    <div className="text-[11px] bg-stone-100 p-2 rounded text-stone-700 break-all border border-stone-200">
                      <strong>{lang === "en" ? "File Name:" : "ফাইলের নাম:"}</strong> {gdriveResult.name}
                    </div>
                    <div className="flex gap-2 mt-0.5 animate-pulse">
                      <a
                        href={gdriveResult.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-emerald-600 hover:bg-emerald-700 text-stone-50 font-bold text-[11px] px-3.5 py-1.5 rounded-sm flex items-center gap-1.5 shadow-sm transition-all border border-emerald-500 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-white" />
                        {lang === "en" ? "View in Google Drive" : "গুগল ড্রাইভে ফাইলটি দেখুন"}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* If inside iframe, show optimized helper warning */}
            {isInsideIframe && (
              <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-sm p-4 text-[11px] leading-relaxed flex items-start gap-3 shadow-xs print:hidden animate-pulse" id="invoice-iframe-print-warning">
                <span className="text-sm shrink-0 animate-bounce select-none">💡</span>
                <div className="text-left font-sans flex-1">
                  <strong className="font-extrabold uppercase text-[10px] tracking-wider block text-amber-950 mb-1">
                    {lang === "en" ? "PRINTING FROM PREVIEW PANEL?" : "প্রিভিউ ফ্রেম থেকে প্রিন্ট করছেন?"}
                  </strong>
                  <p className="text-stone-700 leading-relaxed mb-3">
                    {lang === "en" 
                      ? "Browser security policy strictly blocks printer dialogs from inside iframe boxes. To view, print or save your cash memo instantenously on your laptop/mobile, click this button to open in a normal browser tab:" 
                      : "ব্রাউজার সিকিউরিটির নিয়মানুযায়ী ফ্রেম বা আইফ্রেমের ভেতর থেকে সরাসরি মেমো প্রিন্ট করা সাময়িকভাবে রিস্ট্রিক্ট করা থাকে। সর্বোচ্চ স্পিডে মেমোটি প্রিন্ট কিংবা পিডিএফ সেভ করতে এই বাটনে চাপ দিয়ে সরাসরি সম্পূর্ণ নতুন ট্যাবে ওপেন করুন:"
                    }
                  </p>
                  <a
                    href={`${window.location.protocol}//${window.location.host}${window.location.pathname}?invoiceId=${printingOrder.id}&print=true`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-stone-50 font-mono text-[10px] font-black uppercase tracking-wider px-3.5 py-2 rounded shadow-sm border border-amber-500 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer select-none"
                  >
                    🚀 {lang === "en" ? "Open in New Tab & Print" : "নতুন ট্যাবে খুলুন এবং প্রিন্ট করুন"}
                  </a>
                </div>
              </div>
            )}

            {/* General Fail-Safe Printing Tip for Mobile & PC users */}
            <div className="mb-4 p-3.5 bg-amber-50/50 border border-amber-200/60 rounded-sm flex items-start gap-3 print:hidden text-left" id="invoice-mobile-print-tip">
              <span className="text-base shrink-0 animate-pulse select-none">📱</span>
              <div className="font-sans flex-1">
                <strong className="font-extrabold uppercase text-[10px] tracking-wider text-amber-900 block mb-0.5">
                  {lang === "en" ? "Mobile & Laptop Print Guide" : "মোবাইল ও ল্যাপটপ প্রিন্ট গাইড"}
                </strong>
                <p className="text-[10px] text-stone-700 leading-relaxed font-medium">
                  {lang === "en"
                    ? "If the printer preview doesn't trigger on your smartphone or PC (common inside Facebook, Messenger, or WhatsApp built-in web browsers), simply click the dark ash 'Save PDF' button above to download a pristine offline Cash Memo file to your device instantly!"
                    : "যদি আপনার মোবাইল বা কম্পিউটারের ব্রাউজারে সরাসরি প্রিন্ট ডায়ালগ অন না হয় (প্রধানত ফেসবুক, মেসেঞ্জার বা হোয়াটসঅ্যাপের ইন-অ্যাপ ব্রাউজারে এই সীমাবদ্ধতা থাকে), তবে ওপরে থাকা কালচে রঙের 'পিডিএফ সেভ' বাটনে ক্লিক করে অফিশিয়াল ক্যাশ মেমোটি নিমেষেই ফোনে ডাউনলোড করে নিন!"
                  }
                </p>
              </div>
            </div>

            {/* Highly Prominent Mobile-Friendly Digital Shopping CTA Card - Hidden on paper print */}
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-150 rounded-sm flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden" id="invoice-addon-cta-banner">
              <div className="flex items-start gap-3 text-left">
                <div className="bg-emerald-600 text-white p-2 text-xs rounded-full flex items-center justify-center animate-bounce shadow shrink-0 mt-0.5">
                  <ShoppingCart className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="font-sans font-extrabold text-xs uppercase tracking-wider text-emerald-950">
                    {lang === "en" ? "Want to Add More Products to this Bill?" : "এই বিলের সাথে আরও প্রোডাক্ট যুক্ত করতে চান?"}
                  </h4>
                  <p className="text-[10px] text-emerald-800 font-mono mt-0.5 leading-relaxed">
                    {lang === "en" 
                      ? "Order confirmed! Click 'Shop More' to purchase additional products. New items will automatically add to this same cash memo under a single consolidated bill!" 
                      : "অর্ডার সফল হয়েছে! নতুন যেকোনো পণ্য কিনতে 'আরও প্রোডাক্ট কিনুন' বাটনে চাপ দিন। আপনার নতুন পণ্যগুলো পূর্বের এই একই ক্যাশ মেমোর সাথে যুক্ত হয়ে যাবে!"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setActiveAppendOrderId(printingOrder.id);
                  setPrintingOrder(null);
                  setSelectedCategory("All");
                  setSelectedSubCategory(null);
                  setShowAdminPortal(false);
                  const el = document.getElementById("search-bar");
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                  }
                }}
                className="bg-emerald-600 hover:bg-emerald-700 active:scale-97 text-white text-xs font-mono font-bold px-4 py-2 rounded-sm uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-sm border border-emerald-500 w-full sm:w-auto justify-center shrink-0"
                id="btn-invoice-shop-more-prominent"
              >
                <ShoppingCart className="w-4 h-4 text-white animate-pulse" />
                {lang === "en" ? "Shop More (Add to this Invoice)" : "আরও প্রোডাক্ট কিনুন (এই মেমোতে যোগ করুন)"}
              </button>
            </div>

            {/* Print Friendly Content */}
            <div className="space-y-6 text-stone-950" id="receipt-printable-area">
              {/* Receipt Header */}
              <div className="flex justify-between items-center border-b border-stone-900 pb-5">
                <div className="flex items-center gap-3">
                  {/* Official Star logo representing RIEMART */}
                  <div className="w-10 h-10 text-stone-950 shrink-0" dangerouslySetInnerHTML={{ __html: StarIconSvg() }} />
                  <div>
                    <h2 className="font-display font-bold text-2xl tracking-tight text-stone-950 leading-none">
                      {lang === "en" ? "RIEMART.com" : "রিয়ামার্ট.কম"}
                    </h2>
                    <p className="text-[10px] tracking-[0.2em] text-stone-500 font-mono uppercase mt-1">
                      {lang === "en" ? "Premium Studio Atelier" : "প্রিমিয়াম স্টুডিও অ্যাটেলিয়ার"}
                    </p>
                    <p className="text-[10px] font-mono text-stone-400 mt-0.5 uppercase">
                      Dhaka, Bangladesh | riemart.com
                    </p>
                  </div>
                </div>

                {/* Specific Order QR code for warehouse lookup */}
                {printingOrderQrUrl && (
                  <div className="flex items-center gap-2 border border-stone-250 p-1 bg-stone-50 rounded-sm shadow-xs shrink-0 select-none">
                    <div className="text-right flex flex-col justify-center">
                      <span className="text-[10px] font-bold text-stone-850 font-mono uppercase leading-none tracking-tight">{lang === "en" ? "Order scan" : "অর্ডার স্ক্যান"}</span>
                      <span className="text-[7.5px] text-stone-400 font-mono uppercase mt-0.5 tracking-wider leading-none font-bold">{lang === "en" ? "Staff only" : "স্টাফ ওয়ার্কফ্লো"}</span>
                    </div>
                    <img src={printingOrderQrUrl} alt="Order QR" className="w-11 h-11 object-contain bg-white border border-stone-200 p-0.5 rounded-sm" />
                  </div>
                )}

                <div className="text-right">
                  <h1 className="font-mono text-sm font-bold text-amber-600 uppercase tracking-wider m-0">
                    {lang === "en" ? "Official Cash Memo" : "অফিসিয়াল ক্যাশ মেমো"}
                  </h1>
                  <p className="text-[11px] font-mono text-stone-600 mt-1">
                    <span className="text-stone-400">{lang === "en" ? "Invoice ID:" : "মেমো নম্বর:"}</span> {printingOrder.id}
                  </p>
                  <p className="text-[11px] font-mono text-stone-600">
                    <span className="text-stone-400">{lang === "en" ? "Date:" : "তারিখ:"}</span> {new Date(printingOrder.date).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Customer and Seller Info Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="border border-stone-200 p-3 bg-stone-50/50 rounded-sm">
                  <h4 className="font-mono text-[9px] text-stone-400 uppercase tracking-wider mb-2 font-bold">
                    {lang === "en" ? "SHIPPING COORDINATES" : "ডেলিভারি বিবরণ"}
                  </h4>
                  <table className="w-full text-[11px] font-mono text-stone-800 table-fixed">
                    <tbody>
                      <tr>
                        <td className="w-16 py-0.5 text-stone-400 align-top">{lang === "en" ? "Name:" : "নাম:"}</td>
                        <td className="font-sans font-semibold py-0.5 break-words text-stone-950">{printingOrder.customerName}</td>
                      </tr>
                      <tr>
                        <td className="py-0.5 text-stone-400 align-top">{lang === "en" ? "Phone:" : "ফোন:"}</td>
                        <td className="py-0.5 font-sans break-words text-stone-950">{printingOrder.customerPhone}</td>
                      </tr>
                      <tr>
                        <td className="py-0.5 text-stone-400 align-top">{lang === "en" ? "Address:" : "ঠিকানা:"}</td>
                        <td className="py-0.5 font-sans leading-relaxed break-words text-stone-950">{printingOrder.customerAddress}</td>
                      </tr>
                      {printingOrder.orderNotes && (
                        <tr>
                          <td className="py-0.5 text-stone-400 align-top">{lang === "en" ? "Notes:" : "মন্তব্য:"}</td>
                          <td className="py-0.5 font-sans leading-relaxed text-amber-700 font-semibold break-words text-left">{printingOrder.orderNotes}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="border border-stone-200 p-3 bg-stone-50/50 rounded-sm text-right flex flex-col justify-between">
                  <div>
                    <h4 className="font-mono text-[9px] text-stone-400 uppercase tracking-wider mb-2 font-bold text-right">
                      {lang === "en" ? "CARRIER STATUS" : "সরবরাহ অবস্থা"}
                    </h4>
                    <span className={`inline-block text-[10px] uppercase tracking-widest font-mono font-bold px-2 py-0.5 rounded-sm ${
                      printingOrder.status === "Completed" ? "bg-emerald-100 text-emerald-800" :
                      printingOrder.status === "Shipped" ? "bg-blue-100 text-blue-800" :
                      printingOrder.status === "Processing" ? "bg-amber-100 text-amber-800" :
                      "bg-stone-200 text-stone-700"
                    }`}>
                      {printingOrder.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-stone-500 font-mono mt-2 uppercase text-right space-y-0.5" id="dynamic-print-payment-mode">
                    <p>
                      {lang === "en" ? "Payment Mode: " : "পেমেন্ট মাধ্যম: "}
                      <span className="font-bold text-emerald-955 border border-emerald-600/35 bg-emerald-50/75 px-1.5 py-0.5 rounded-sm normal-case inline-block">
                        {getPaymentMethodDisplay(printingOrder.paymentMethod, lang)}
                      </span>
                    </p>
                    {printingOrder.paymentSender && (
                      <p>
                        {lang === "en" ? "Acc No: " : "অ্যাকাউন্ট নং: "}
                        <span className="font-sans text-stone-900">{printingOrder.paymentSender}</span>
                      </p>
                    )}
                    {printingOrder.paymentTrxId && (
                      <p>
                        {lang === "en" ? "TrxID: " : "ট্রানজেকশন আইডি: "}
                        <span className="font-mono font-bold bg-amber-50 text-stone-900 px-1 py-0.5 rounded text-[11px] inline-block">{printingOrder.paymentTrxId}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Items Table Description */}
              <div>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-stone-900 text-[10px] font-mono text-stone-400 uppercase tracking-wider">
                      <th className="pb-2 font-normal">{lang === "en" ? "ITEM DESCRIPTION" : "পণ্যের বিবরণ"}</th>
                      <th className="pb-2 font-normal text-center w-16">{lang === "en" ? "QTY" : "পরিমাণ"}</th>
                      <th className="pb-2 font-normal text-right w-24">{lang === "en" ? "UNIT" : "একক মূল্য"}</th>
                      <th className="pb-2 font-normal text-right w-28">{lang === "en" ? "TOTAL" : "মোট মূল্য"}</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-stone-150">
                    {printingOrder.items.map((it, idx) => {
                      const itemProduct = products.find((p) => p.id === it.productId);
                      const imgUrl = itemProduct ? itemProduct.image : null;
                      return (
                        <tr key={idx} className="font-mono text-stone-800">
                          <td className="py-2.5 font-sans font-medium text-stone-950 flex items-center gap-3">
                            {imgUrl && (
                              <img
                                src={imgUrl}
                                alt={it.productNameEn}
                                className="w-10 h-10 object-cover rounded-sm border border-stone-200 shrink-0 print:hidden"
                                referrerPolicy="no-referrer"
                                loading="eager"
                                decoding="sync"
                              />
                            )}
                            <span className="break-words">{lang === "en" ? it.productNameEn : it.productNameBn}</span>
                          </td>
                          <td className="py-2.5 text-center align-middle">{it.quantity}</td>
                          <td className="py-2.5 text-right align-middle">{formatPrice(it.priceAtPurchase)}</td>
                          <td className="py-2.5 text-right align-middle font-bold text-stone-955">{formatPrice(it.priceAtPurchase * it.quantity)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Subtotals and Totals breakdown */}
              <div className="flex justify-end pt-2">
                <div className="w-64 font-mono text-xs space-y-1.5 border-t border-stone-900 pt-3">
                  {printingOrder.discountApplied > 0 && (
                    <div className="flex justify-between text-stone-500">
                      <span>{lang === "en" ? "Discount Applied:" : "ছাড় (ডিসকাউন্ট):"}</span>
                      <span>-{formatPrice(printingOrder.discountApplied)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-stone-550 border-b border-stone-150 pb-1.5">
                    <span>{lang === "en" ? "Delivery Charge:" : "ডেলিভারি চার্জ:"}</span>
                    <span className="text-stone-700 font-bold">
                      {printingOrder.deliveryCharge && printingOrder.deliveryCharge > 0 
                        ? formatPrice(printingOrder.deliveryCharge) 
                        : (lang === "en" ? "Complimentary" : "ফ্রি")}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-stone-955 pt-1">
                    <span>{lang === "en" ? "TOTAL COLLECTABLE:" : "সর্বমোট প্রদেয়:"}</span>
                    <span className="text-stone-955">{formatPrice(printingOrder.totalPrice)}</span>
                  </div>
                </div>
              </div>

              {/* Footer Parent Container (Signatures & Support Note) */}
              <div className="border-t-2 border-stone-150 mt-10 pt-8 space-y-10" id="invoice-footer-container">
                {/* Dual Signature Blocks representing authentic manual checks */}
                <div className="grid grid-cols-2 gap-12 text-center text-[10px] font-mono uppercase tracking-wider text-stone-550 pt-6">
                  <div>
                    <div className="border-t border-dashed border-stone-300 mx-auto w-32 mb-1.5"></div>
                    <p>{lang === "en" ? "Recipient's Signature" : "গ্রাহকের স্বাক্ষর"}</p>
                  </div>
                  <div>
                    <div className="border-t border-dashed border-stone-300 mx-auto w-32 mb-1.5"></div>
                    <p className="font-bold text-stone-800">{lang === "en" ? "For RIEMART BD" : "রিয়ামার্ট অথরিটি"}</p>
                  </div>
                </div>

                {/* Friendly support instructions */}
                <div className="text-center pt-2 border-t border-stone-100">
                  <p className="font-sans text-[10px] text-stone-500 italic leading-relaxed">
                    {lang === "en" 
                      ? "Thank you for shopping at RIEMART. For any delivery queries, contact us at riemart.bd@gmail.com." 
                      : "রিয়ামার্টে কেনাকাটা করার জন্য ধন্যবাদ। ডেলিভারি সংক্রান্ত যেকোনো তথ্যের জন্য আমাদের মেইল করুন: riemart.bd@gmail.com।"}
                  </p>
                  <div className="mt-2 text-[9px] font-mono text-stone-300 uppercase tracking-widest font-bold">
                    ★ SUPPORTING GENERATIONAL BANGLADESHI ARTISANAL CRAFTS ★
                  </div>
                </div>
              </div>
            </div>

            {/* Secondary Print Actions Panel at the Bottom - Highly Visible for Laptop/Mobile Users (hidden on actual print) */}
            <div className="mt-8 pt-6 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden" id="invoice-bottom-actions-panel">
              <div className="text-left">
                <h4 className="font-sans font-bold text-xs uppercase tracking-wider text-stone-900">
                  {lang === "en" ? "Ready to print or save your bill?" : "রসিদটি প্রিন্ট বা সংরক্ষণ করতে চান?"}
                </h4>
                <p className="text-[10px] text-stone-500 font-mono mt-0.5 leading-relaxed">
                  {lang === "en" 
                    ? "Click Print to direct to print queue. Tip: select 'Save as PDF' to save on your laptop downloads folder." 
                    : "প্রিন্ট বাটনে চাপ দিয়ে রসিদটি প্রিন্ট করুন। পিডিএফ কপি সেভ করতে 'পিডিএফ ডাউনলোড' প্রেস করুন।"
                  }
                </p>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {/* Print Invoice Now (Big Action button) */}
                <button
                  type="button"
                  onClick={handlePrintAction}
                  className="bg-amber-600 hover:bg-amber-700 hover:scale-[1.02] active:scale-[0.98] text-white text-xs font-mono font-black px-4 py-2.5 rounded-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md border border-amber-500 w-full sm:w-auto"
                  id="btn-invoice-bottom-print-now"
                >
                  <Printer className="w-4 h-4 text-white animate-pulse" />
                  {lang === "en" ? "Print Memo" : "মেমো প্রিন্ট করুন"}
                </button>

                {/* Print as PDF */}
                <button
                  type="button"
                  onClick={() => downloadInvoicePdf(printingOrder)}
                  className="bg-stone-950 hover:bg-stone-900 hover:scale-[1.02] active:scale-[0.98] text-stone-300 text-xs font-mono font-bold px-4 py-2.5 rounded-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md border border-stone-800 w-full sm:w-auto hover:text-amber-400"
                  id="btn-invoice-bottom-print-pdf"
                >
                  <FileText className="w-4 h-4 text-amber-500" />
                  {lang === "en" ? "Save as PDF" : "পিডিএফ সেভ"}
                </button>

                {/* Save to Google Drive */}
                <button
                  type="button"
                  onClick={() => saveInvoiceToGoogleDrive(printingOrder)}
                  disabled={isUploadingToDrive}
                  className="bg-sky-600 hover:bg-sky-700 disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] text-stone-50 text-xs font-mono font-bold px-4 py-2.5 rounded-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md border border-sky-500 w-full sm:w-auto"
                  id="btn-invoice-bottom-save-drive"
                >
                  <Cloud className={`w-4 h-4 text-white ${isUploadingToDrive ? 'animate-spin' : ''}`} />
                  {isUploadingToDrive 
                    ? (lang === "en" ? "Uploading..." : "আপলোড হচ্ছে...") 
                    : (lang === "en" ? "Save to Drive" : "ড্রাইভে সেভ")
                  }
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    )}

      {/* ==================== PRINTABLE CUSTOMER REPORT MODAL ==================== */}
      {printingCustomerReport && (() => {
        const customerOrders = orders.filter(
          (or) => or.customerPhone?.trim() === printingCustomerReport.phone?.trim()
        );
        const completedOrders = customerOrders.filter((or) => or.status === "Completed");
        const totalSpent = completedOrders.reduce((sum, or) => sum + or.totalPrice, 0);
        const totalPending = customerOrders.filter(or => ["Pending", "Processing", "Shipped"].includes(or.status)).reduce((sum, or) => sum + or.totalPrice, 0);

        return (
          <div className="fixed inset-0 z-55 flex flex-col no-print-backdrop scroll-smooth animate-backdrop-fade bg-stone-900/40 backdrop-blur-xs overflow-hidden" id="customer-report-print-modal">
            
            {/* Persistent Static 'Print' Header Bar - ALWAYS visible during scroll */}
            <div className="bg-stone-950/95 backdrop-blur-md text-stone-100 p-3 sm:p-4 w-full flex flex-row items-center justify-between gap-3 border-b border-stone-850 print:hidden shadow-lg z-50 shrink-0 select-none rounded-t-sm" id="customer-report-top-nav-bar">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 text-amber-500 shrink-0" dangerouslySetInnerHTML={{ __html: StarIconSvg() }} />
                <div className="text-left font-mono">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-black text-xs tracking-wider uppercase text-stone-100">
                      {lang === "en" ? "RIEMART Portal" : "রিয়ামার্ট পোর্টাল"}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-950 text-amber-400 border border-amber-800/60 animate-pulse">
                      {lang === "en" ? "Consolidated Statement" : "গ্রাহক লেজার রিপোর্ট"}
                    </span>
                  </div>
                  <p className="text-[10px] text-stone-400 mt-0.5">
                    {lang === "en" ? "Total Purchase Statement & Order Ledgers" : "গ্রাহকের সমস্ত কেনাবেচা ও অর্ডার তালিকা"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Print Action */}
                <button
                  type="button"
                  onClick={() => handleCustomerPrintAction(printingCustomerReport)}
                  className="admin-print-btn bg-amber-600 hover:bg-amber-700 hover:scale-[1.02] active:scale-[0.98] text-stone-50 border border-amber-500 font-mono font-bold px-3 py-2 rounded-sm uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Printer className="w-4 h-4 text-stone-50 animate-pulse" />
                  {lang === "en" ? "Print" : "প্রিন্ট করুন"}
                </button>

                {/* Close button */}
                <button
                  type="button"
                  onClick={() => setPrintingCustomerReport(null)}
                  className="bg-stone-800 hover:bg-stone-700 text-stone-300 text-[11px] font-mono px-3 py-2 rounded-sm uppercase tracking-wider transition-all cursor-pointer border border-stone-700 font-bold"
                >
                  {lang === "en" ? "Close" : "বন্ধ করুন"}
                </button>
              </div>
            </div>

            {/* Scrollable container for the printable card */}
            <div className="flex-1 overflow-y-auto w-full p-3 sm:p-6 flex justify-center scroll-smooth print:overflow-visible print:p-0 print:m-0 print:block">
              <div className="bg-white border border-stone-200 max-w-3xl w-full rounded-sm overflow-visible shadow-2xl relative p-6 pb-24 md:p-8 md:pb-8 my-4 sm:my-8 print:border-none print:shadow-none print:p-0 print:m-0 animate-invoice-reveal animate-studio-reveal" id="customer-report-printed-card">

              {/* Printable Body Content */}
              <div className="space-y-6 text-stone-900 text-left">
                {/* Brand Header Section */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-2 border-stone-900 pb-5 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 text-stone-955" dangerouslySetInnerHTML={{ __html: StarIconSvg() }} />
                      <span className="font-display font-black text-xl tracking-wider text-stone-950 uppercase">RIEMART.com</span>
                    </div>
                    <p className="text-xs font-mono text-stone-500">
                      Luxe Premium Store & Atelier BD
                    </p>
                  </div>
                  <div className="text-right sm:text-right text-xs font-mono space-y-1 text-stone-700 w-full sm:w-auto">
                    <p className="font-bold text-stone-955 text-sm uppercase">{lang === "en" ? "Customer Statement Report" : "গ্রাহক লেজার স্টেটমেন্ট"}</p>
                    <p>{lang === "en" ? "Date Generated:" : "তৈরির তারিখ:"} {new Date().toLocaleString()}</p>
                    <p>Dhaka, Bangladesh | riemart.com</p>
                  </div>
                </div>

                {/* Demographics / Customer Dossier */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-stone-50 p-4 border border-stone-200/80 rounded">
                  <div className="space-y-1.5 text-xs font-mono">
                    <h4 className="text-[10px] text-stone-400 uppercase tracking-widest font-bold border-b border-stone-200 pb-1 mb-2">
                      {lang === "en" ? "Customer Profile Dossier" : "প্রোফাইল বিবরণী"}
                    </h4>
                    <p className="text-sm font-sans font-bold text-stone-950 leading-none">{printingCustomerReport.name}</p>
                    <p><span className="text-stone-400 font-bold">Phone:</span> {printingCustomerReport.phone}</p>
                    <p><span className="text-stone-400 font-bold">Email:</span> {printingCustomerReport.email || "N/A"}</p>
                    <p><span className="text-stone-400 font-bold">Gender / DOB:</span> {printingCustomerReport.gender || "N/A"} / {printingCustomerReport.birthDate || "N/A"}</p>
                    <p><span className="text-stone-400 font-bold">Tier / Segment:</span> <span className="font-bold uppercase text-amber-700">{printingCustomerReport.category || "Regular"}</span></p>
                  </div>

                  <div className="space-y-1.5 text-xs font-mono">
                    <h4 className="text-[10px] text-stone-400 uppercase tracking-widest font-bold border-b border-stone-200 pb-1 mb-2">
                      {lang === "en" ? "Verified Logistics & Wallets" : "লজিস্টিকস ও মোবাইল ওয়ালেটস"}
                    </h4>
                    <p className="leading-relaxed"><span className="text-stone-400 font-bold">Delivery Route:</span> {printingCustomerReport.address || "N/A"}</p>
                    <div className="grid grid-cols-3 gap-2 pt-1 font-mono">
                      <div className="bg-white p-1.5 rounded border border-stone-200 text-center text-[10px]">
                        <span className="text-[8px] font-bold text-pink-600 uppercase block leading-none mb-0.5">bKash</span>
                        <span className="font-bold break-all">{printingCustomerReport.bkash || printingCustomerReport.savedBkash || "—"}</span>
                      </div>
                      <div className="bg-white p-1.5 rounded border border-stone-200 text-center text-[10px]">
                        <span className="text-[8px] font-bold text-orange-600 uppercase block leading-none mb-0.5">Nagad</span>
                        <span className="font-bold break-all">{printingCustomerReport.nagad || printingCustomerReport.savedNagad || "—"}</span>
                      </div>
                      <div className="bg-white p-1.5 rounded border border-stone-200 text-center text-[10px]">
                        <span className="text-[8px] font-bold text-sky-600 uppercase block leading-none mb-0.5">Upay</span>
                        <span className="font-bold break-all">{printingCustomerReport.upay || printingCustomerReport.savedUpay || "—"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Financial Ledger Aggregations Panel */}
                <div className="grid grid-cols-3 gap-4 border border-stone-250 p-4 rounded bg-stone-950 text-stone-100 font-mono text-center">
                  <div>
                    <span className="text-stone-450 text-[9px] uppercase tracking-wider block mb-1">{lang === "en" ? "TOTAL PLACED" : "মোট অর্ডারের সংখ্যা"}</span>
                    <span className="text-xs sm:text-sm font-bold text-white leading-none">{customerOrders.length} {lang === "en" ? "Orders" : "টি অর্ডার"}</span>
                  </div>
                  <div className="border-l border-stone-800">
                    <span className="text-stone-450 text-[9px] uppercase tracking-wider block mb-1">{lang === "en" ? "SETTLED AMOUNT" : "পরিশোধিত তহবিল"}</span>
                    <span className="text-xs sm:text-sm font-bold text-emerald-400 font-sans leading-none">{formatPrice(totalSpent)}</span>
                  </div>
                  <div className="border-l border-stone-800">
                    <span className="text-stone-450 text-[9px] uppercase tracking-wider block mb-1">{lang === "en" ? "PENDING PROCESS" : "প্রক্রিয়াধীন পেমেন্ট"}</span>
                    <span className="text-xs sm:text-sm font-bold text-amber-500 font-sans leading-none">{formatPrice(totalPending)}</span>
                  </div>
                </div>

                {/* Chronological Orders Table */}
                <div className="space-y-3 font-mono">
                  <h4 className="text-xs uppercase font-extrabold text-stone-900 border-b border-stone-400 pb-1">
                    {lang === "en" ? "Chronological Order Journal Items" : "অর্ডারের বিবরণী তালিকা"}
                  </h4>
                  
                  {customerOrders.length === 0 ? (
                    <div className="text-center py-8 text-stone-400 text-xs italic">
                      {lang === "en" ? "No order ledger entries recorded." : "কোনো অর্ডারের বিবরণ পাওয়া যায়নি।"}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px] text-stone-800 border-collapse">
                        <thead>
                          <tr className="border-b border-stone-400 font-bold uppercase text-stone-500 text-[10px]">
                            <th className="py-2 text-left font-mono">{lang === "en" ? "Order ID / Date" : "অর্ডার আইডি / তারিখ"}</th>
                            <th className="py-2 text-left font-sans">{lang === "en" ? "Purchased Items" : "ক্রয়কৃত প্রোডাক্ট আইটেমসমূহ"}</th>
                            <th className="py-2 text-left font-mono">{lang === "en" ? "Payment / Route" : "পেমেন্ট পদ্ধতি ও কুরিয়ার রুট"}</th>
                            <th className="py-2 text-center font-mono">{lang === "en" ? "Status" : "অবস্থা"}</th>
                            <th className="py-2 text-right font-sans">{lang === "en" ? "Net Paid" : "প্রদেয় মূল্য"}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {customerOrders.map((or) => (
                            <tr key={or.id} className="border-b border-stone-200 hover:bg-stone-50">
                              <td className="py-2.5 font-mono text-left align-top leading-relaxed pr-2">
                                <span className="font-bold text-stone-950 block">#{or.id}</span>
                                <span className="text-stone-450 text-[9.5px] block">{new Date(or.date).toLocaleString()}</span>
                              </td>
                              <td className="py-2.5 font-sans text-left align-top leading-relaxed pr-2">
                                <div className="space-y-1">
                                  {or.items.map((item: any, keyIdx: number) => (
                                    <div key={keyIdx} className="text-stone-750 text-[10.5px]">
                                      <span>{item.quantity} × {lang === "en" ? item.productNameEn : item.productNameBn}</span>
                                      <span className="text-stone-400 text-[9.5px] font-mono ml-1.5">(@{formatPrice(item.priceAtPurchase)})</span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                              <td className="py-2.5 font-mono text-left align-top leading-relaxed pr-2">
                                <div className="space-y-0.5">
                                  <span className="text-stone-900 block font-sans text-[10.5px] truncate max-w-[150px]" title={or.customerAddress}>
                                    {or.customerAddress}
                                  </span>
                                  <span className="text-[9.5px] bg-stone-100 border border-stone-200 rounded px-1 text-stone-600 inline-block uppercase">
                                    {or.paymentMethod || "COD"} {or.paymentTrxId ? `[Trx: ${or.paymentTrxId}]` : ""}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2.5 text-center align-top pr-2">
                                <span className={`text-[9.5px] font-mono font-black border rounded px-1.5 py-0.5 inline-block uppercase ${
                                  or.status === "Completed" ? "bg-emerald-50 text-emerald-700 border-emerald-150" :
                                  or.status === "Cancelled" ? "bg-red-50 text-red-600 border-red-150 line-through text-stone-400" :
                                  or.status === "Shipped" ? "bg-blue-50 text-blue-700 border-blue-150" :
                                  or.status === "Processing" ? "bg-amber-50 text-amber-700 border-amber-150" :
                                  "bg-rose-50 text-rose-700 border-rose-150 animate-pulse"
                                }`}>
                                  {or.status}
                                </span>
                              </td>
                              <td className="py-2.5 font-sans font-bold text-stone-950 text-right align-top">
                                {formatPrice(or.totalPrice)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Print Verification Footer Panel */}
                <div className="pt-10 border-t border-dashed border-stone-300 grid grid-cols-2 gap-4 text-center font-mono text-[10px]">
                  <div>
                    <div className="border-t border-stone-400 w-36 mx-auto pt-1 mt-6">
                      {lang === "en" ? "System Auditor" : "সিস্টেম অডিটর সিগনেচার"}
                    </div>
                  </div>
                  <div>
                    <div className="border-t border-stone-400 w-36 mx-auto pt-1 mt-6">
                      {lang === "en" ? "Account Manager" : "একাউন্টস ম্যানেজার সিগনেচার"}
                    </div>
                  </div>
                </div>

                {/* Physical print instructions - Only visible on actual printable page screen */}
                <div className="bg-stone-50 p-3.5 border border-stone-200 text-stone-500 rounded text-[10.5px] font-sans leading-relaxed print:hidden flex flex-col gap-1 text-center" id="statement-print-guide">
                  <p className="font-semibold text-stone-800 font-mono text-[11px]">
                    💡 {lang === "en" ? "Printing instructions:" : "প্রিন্ট নির্দেশিকা:"}
                  </p>
                  <p>
                    {lang === "en"
                      ? "To print cleanly, check 'Headers and Footers' as OFF, and 'Background Graphics' as ON in standard printer browser prompt."
                      : "ঝকঝকে ও পরিষ্কারভাবে প্রিন্ট করতে ব্রাউজার প্রিন্টার উইন্ডো থেকে 'Headers and Footers' বন্ধ রাখুন এবং 'Background graphics' অন করে দিন।"}
                  </p>
                </div>
              </div>

              {/* Printable Modal Form Actions Area (Sticky screen-bottom layout) - Hidden in Print queue */}
              <div className="absolute bottom-0 inset-x-0 bg-stone-950 p-4 border-t border-stone-850 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden sticky top-full z-30 shadow-lg rounded-b-sm" id="customer-report-bottom-shelf">
                <p className="text-[10px] text-stone-400 font-mono text-left leading-normal sm:max-w-xs">
                  {lang === "en" 
                    ? "Click Print to direct to print queue. Tip: select 'Save as PDF' to save on your laptop downloads folder." 
                    : "প্রিন্ট বাটনে চাপ দিয়ে রসিদটি প্রিন্ট করুন। পিডিএফ কপি সেভ করতে 'পিডিএফ ডাউনলোড' প্রেস করুন।"
                  }
                </p>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  {/* Print Campaign Report Now */}
                  <button
                    type="button"
                    onClick={() => handleCustomerPrintAction(printingCustomerReport)}
                    className="admin-print-btn bg-amber-600 hover:bg-amber-700 hover:scale-[1.02] active:scale-[0.98] text-white text-xs font-mono font-black px-4 py-2.5 rounded-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md border border-amber-500 w-full sm:w-auto"
                  >
                    <Printer className="w-4 h-4 text-white animate-pulse" />
                    {lang === "en" ? "Print Statement" : "স্টেটমেন্ট প্রিন্ট"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrintingCustomerReport(null)}
                    className="bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-mono px-4 py-2.5 rounded-sm uppercase tracking-wider transition-all cursor-pointer border border-stone-700 w-full sm:w-auto text-center font-bold"
                  >
                    {lang === "en" ? "Close" : "বন্ধ করুন"}
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      );
    })()}

      {/* ==================== PRINTABLE PRODUCT INVENTORY MODAL ==================== */}
      {printingInventoryCategory && printingInventoryProducts && (() => {
        const a4OverrideStyle = `
          @media print {
            @page {
              size: A4 portrait !important;
              margin: 15mm 15mm 15mm 15mm !important;
            }
            @page a4_inventory_page {
              size: A4 portrait !important;
              margin: 15mm 15mm 15mm 15mm !important;
            }
            body, html {
              background: #ffffff !important;
              background-color: #ffffff !important;
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
            }
            #inventory-report-print-modal {
              position: static !important;
              display: block !important;
              background: #ffffff !important;
              background-color: #ffffff !important;
              padding: 0 !important;
              margin: 0 !important;
              width: 100% !important;
              height: auto !important;
              overflow: visible !important;
            }
            #inventory-report-printed-card {
              page: a4_inventory_page !important;
              background: #ffffff !important;
              background-color: #ffffff !important;
              color: #000000 !important;
              border: none !important;
              box-shadow: none !important;
              max-width: 180mm !important;
              width: 180mm !important;
              margin: 0 auto !important;
              padding: 0 !important;
              box-sizing: border-box !important;
              position: static !important;
              display: block !important;
              height: auto !important;
              overflow: visible !important;
            }
          }
        `;

        return (
          <div 
            className="fixed inset-0 z-55 flex flex-col no-print-backdrop scroll-smooth animate-backdrop-fade font-sans bg-stone-900/40 backdrop-blur-xs overflow-hidden" 
            id="inventory-report-print-modal"
          >
            <style dangerouslySetInnerHTML={{ __html: a4OverrideStyle }} />
            
            {/* Persistent Static 'Print' Header Bar - ALWAYS visible during scroll */}
            <div className="bg-stone-950/95 backdrop-blur-md text-stone-100 p-3 sm:p-4 w-full flex flex-row items-center justify-between gap-3 border-b border-stone-850 print:hidden shadow-lg z-50 shrink-0 select-none rounded-t-sm" id="inventory-report-top-nav-bar">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 text-amber-500 shrink-0" dangerouslySetInnerHTML={{ __html: StarIconSvg() }} />
                <div className="text-left font-mono">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-black text-xs tracking-wider uppercase text-stone-100">
                      {lang === "en" ? "RIEMART Portal" : "রিয়ামার্ট পোর্টাল"}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-955 text-amber-400 border border-amber-800/60 animate-pulse">
                      {lang === "en" ? "Inventory Ledger" : "ইনভেন্টরি লেজার"}
                    </span>
                  </div>
                  <p className="text-[10px] text-stone-400 mt-0.5">
                    {lang === "en" ? "Printable Product Catalog & Balances" : "প্রিন্টযোগ্য ক্যাটালগ ও পণ্য হিসাব বিবরণী"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const printUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?inventoryPrintCategory=${encodeURIComponent(printingInventoryCategory)}&inventoryPrintSubCategory=${encodeURIComponent(printingInventorySubCategory || "All")}&print=true`;
                    window.open(printUrl, "_blank");
                  }}
                  className="admin-print-btn bg-amber-600 hover:bg-amber-700 hover:scale-[1.02] active:scale-[0.98] text-stone-50 border border-amber-500 font-mono font-bold px-3 py-2 rounded-sm uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-sm text-xs"
                >
                  <Printer className="w-4 h-4 text-stone-50 animate-pulse" />
                  {lang === "en" ? "Print" : "প্রিন্ট করুন"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPrintingInventoryCategory(null);
                    setPrintingInventorySubCategory(null);
                    setPrintingInventoryProducts(null);
                  }}
                  className="bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-mono px-3 py-2 rounded-sm uppercase tracking-wider transition-all cursor-pointer border border-stone-700 font-bold"
                >
                  {lang === "en" ? "Close" : "বন্ধ করুন"}
                </button>
              </div>
            </div>

            {/* Scrollable container for the printable card */}
            <div className="flex-1 overflow-y-auto w-full p-3 sm:p-6 flex justify-center scroll-smooth print:overflow-visible print:p-0 print:m-0 print:block">
              <div 
                className="bg-white border border-stone-200 max-w-4xl w-full rounded-sm overflow-visible shadow-2xl relative p-6 pb-24 md:p-8 md:pb-8 my-4 sm:my-8 print:border-none print:shadow-none print:p-0 print:m-0 animate-invoice-reveal animate-studio-reveal font-sans text-stone-900" 
                id="inventory-report-printed-card"
              >

              <div className="space-y-6 text-stone-900 text-left">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-2 border-stone-900 pb-5 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 text-stone-955 shrink-0" dangerouslySetInnerHTML={{ __html: StarIconSvg() }} />
                      <span className="text-xl font-display font-black tracking-widest text-stone-900">RIEMART</span>
                    </div>
                    <p className="text-[10px] uppercase font-mono tracking-widest text-stone-500 font-bold">
                      {lang === "en" ? "Atelier High-Premium Segment Stores" : "প্রিমিয়াম ক্যাটালগ ও পণ্য ইনভেন্টরি"}
                    </p>
                  </div>
                  <div className="text-left sm:text-right font-mono text-xs text-stone-600">
                    <p className="font-bold underline text-stone-900 text-sm">
                      {lang === "en" ? "Product Inventory List" : "প্রোডাক্ট ইনভেন্টরি তালিকা"}
                    </p>
                    <p className="mt-1">
                      <span className="text-stone-400 font-bold">Date:</span> {new Date().toLocaleString()}
                    </p>
                    <p>
                      <span className="text-stone-400 font-bold">Category:</span> {printingInventoryCategory}
                    </p>
                    {printingInventorySubCategory && printingInventorySubCategory !== "All" && (
                      <p>
                        <span className="text-stone-400 font-bold">Sub-Category:</span> {printingInventorySubCategory}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 border border-stone-200 p-4 bg-stone-50 rounded-sm">
                  <div className="text-center p-2 border-r border-stone-200">
                    <p className="text-[10px] font-mono text-stone-500 uppercase font-bold tracking-wider leading-none">
                      {lang === "en" ? "Filter Category" : "বাছাইকৃত ক্যাটাগরি"}
                    </p>
                    <p className="text-xs sm:text-sm font-black text-stone-900 mt-1.5 uppercase tracking-wide">
                      {printingInventoryCategory === "All" 
                        ? (lang === "en" ? "All Categories" : "সব ক্যাটাগরি") 
                        : (CATEGORY_TRANSLATIONS[printingInventoryCategory as Category]?.[lang] || printingInventoryCategory)
                      }
                    </p>
                  </div>
                  <div className="text-center p-2 border-r border-stone-200">
                    <p className="text-[10px] font-mono text-stone-500 uppercase font-bold tracking-wider leading-none">
                      {lang === "en" ? "Total Items Included" : "অন্তর্ভুক্ত মোট পণ্য"}
                    </p>
                    <p className="text-xs sm:text-sm font-black text-stone-900 mt-1.5 font-mono">
                      {printingInventoryProducts.length} {lang === "en" ? "Products" : "টি পণ্য"}
                    </p>
                  </div>
                  <div className="text-center p-2">
                    <p className="text-[10px] font-mono text-stone-500 uppercase font-bold tracking-wider leading-none">
                      {lang === "en" ? "Total Stock Count" : "মোট মজুদ পরিমাণ"}
                    </p>
                    <p className="text-xs sm:text-sm font-black text-stone-900 mt-1.5 font-mono">
                      {printingInventoryProducts.reduce((sum, p) => sum + p.inventory, 0).toLocaleString()} Qty
                    </p>
                  </div>
                </div>

                <div className="border border-stone-300 rounded-sm overflow-hidden mt-4">
                  <table className="w-full text-left border-collapse text-stone-900">
                    <thead>
                      <tr className="bg-stone-100 border-b border-stone-300 font-mono text-[10px] font-bold text-stone-700 uppercase">
                        <th className="py-2.5 px-3 text-center border-r border-stone-200" style={{ width: "40px" }}>SL</th>
                        <th className="py-2.5 px-3 border-r border-stone-200" style={{ width: "100px" }}>Code / SKU</th>
                        <th className="py-2.5 px-3 border-r border-stone-200">Product Name / পণ্যের নাম</th>
                        <th className="py-2.5 px-3 border-r border-stone-200" style={{ width: "100px" }}>Category</th>
                        <th className="py-2.5 px-3 border-r border-stone-200" style={{ width: "100px" }}>Sub-category</th>
                        <th className="py-2.5 px-3 text-center border-r border-stone-200" style={{ width: "80px" }}>Measurement</th>
                        <th className="py-2.5 px-3 text-right border-r border-stone-200" style={{ width: "80px" }}>Price (BDT)</th>
                        <th className="py-2.5 px-3 text-center" style={{ width: "60px" }}>Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200 text-[11px] leading-tight">
                      {printingInventoryProducts.map((p, index) => {
                        return (
                          <tr key={p.id} className="align-middle">
                            <td className="py-2 px-3 text-center font-mono font-bold text-stone-500 border-r border-stone-200 bg-stone-50/40">
                              {index + 1}
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-stone-900 break-all select-all border-r border-stone-200 text-[10px]">
                              {p.sku || p.id}
                            </td>
                            <td className="py-2 px-3 border-r border-stone-200 leading-snug">
                              <div className="font-bold text-stone-955">
                                {p.nameEn}
                              </div>
                              <div className="text-[10px] font-medium text-stone-500 mt-1 leading-snug">
                                {p.nameBn}
                              </div>
                            </td>
                            <td className="py-2 px-3 border-r border-stone-200 font-medium">
                              {p.category}
                            </td>
                            <td className="py-2 px-3 border-r border-stone-200 italic text-stone-500 font-mono text-[10px]">
                              {p.subCategory || "—"}
                            </td>
                            <td className="py-2 px-3 text-center border-r border-stone-200">
                              <span className="inline-block px-1.5 py-0.5 bg-stone-100 border border-stone-200 rounded font-mono text-[9px] font-bold">
                                {getProductMeasurement(p)}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold border-r border-stone-200">
                              ৳{p.price.toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-bold">
                              {p.inventory === 0 ? (
                                <span className="text-red-600 uppercase text-[9px] font-black tracking-wide">
                                  {lang === "en" ? "Out" : "মজুদ নাই"}
                                </span>
                              ) : (
                                <span className={p.inventory <= 5 ? "text-amber-700 font-black" : "text-stone-800"}>
                                  {p.inventory}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="pt-10 border-t border-dashed border-stone-300 grid grid-cols-2 gap-4 text-center font-mono text-[10px]">
                  <div>
                    <div className="border-t border-stone-400 w-36 mx-auto pt-1 mt-6">
                      {lang === "en" ? "Verified Auditor Signature" : "যাচাইকারী কর্মকর্তা স্বাক্ষর"}
                    </div>
                  </div>
                  <div>
                    <div className="border-t border-stone-400 w-36 mx-auto pt-1 mt-6">
                      {lang === "en" ? "Warehouse Manager Signature" : "গুদামজাত ব্যবস্থাপक স্বাক্ষর"}
                    </div>
                  </div>
                </div>

                <div className="bg-stone-50 p-3 pb-4 border border-stone-200 text-stone-500 rounded text-[10.5px] font-sans leading-relaxed print:hidden flex flex-col gap-1 text-center">
                  <p className="font-semibold text-stone-800 font-mono text-[11px]">
                    💡 {lang === "en" ? "Printing recommendations:" : "প্রিন্ট নির্দেশিকা:"}
                  </p>
                  <p>
                    {lang === "en"
                      ? "Ensure 'Paper Size' is set to A4, Margins: Default. For clean black/white spools and barcodes turn 'Background Graphics' to ON."
                      : "ঝকঝকে ও নিখুঁতভাবে প্রিন্ট পেতে ব্রাউজার প্রিন্টার সেটিংস থেকে 'Paper Size' হিসেবে A4 নির্ধারণ করুন এবং 'Background graphics' অন রাখুন।"}
                  </p>
                </div>

              </div>

              <div className="absolute bottom-0 inset-x-0 bg-stone-955 p-4 border-t border-stone-850 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden sticky top-full z-30 shadow-lg rounded-b-sm">
                <p className="text-[10px] text-stone-400 font-mono text-left leading-normal sm:max-w-xs">
                  {lang === "en" 
                    ? "Printed in clear vector format. Select 'Save as PDF' inside printing prompt to generate ledger documents." 
                    : "পণ্য ইনভেন্টরি লেজার রিপোর্টটি প্রিন্ট করুন। অফলাইন পিডিএফ কপি সেভ করতে ডেস্টিনেশন প্যানেল থেকে 'Save as PDF' সিলেক্ট করুন।"
                  }
                </p>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="admin-print-btn bg-amber-600 hover:bg-amber-700 hover:scale-[1.02] active:scale-[0.98] text-white text-xs font-mono font-black px-4 py-2.5 rounded-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md border border-amber-500 w-full sm:w-auto"
                  >
                    <Printer className="w-4 h-4 text-white animate-pulse" />
                    {lang === "en" ? "Print Ledger" : "লেজার প্রিন্ট করুন"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPrintingInventoryCategory(null);
                      setPrintingInventorySubCategory(null);
                      setPrintingInventoryProducts(null);
                    }}
                    className="bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-mono px-4 py-2.5 rounded-sm uppercase tracking-wider transition-all cursor-pointer border border-stone-700 w-full sm:w-auto text-center font-bold"
                  >
                    {lang === "en" ? "Close" : "বন্ধ করুন"}
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      );
    })()}
      {/* Global 3-second Confirmation Alert - Fully Fixed Overlaid Viewport Banner */}
      {invoiceConfirmedNotification && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs pointer-events-none animate-studio-reveal print:hidden">
          <div className="bg-stone-950 border border-stone-800 text-stone-100 shadow-2xl rounded-sm p-5 w-full max-w-sm flex items-center justify-between gap-5 border-l-4 border-l-emerald-500 pointer-events-auto">
            <div className="flex items-center gap-3 text-left">
              <div className="bg-emerald-600/20 p-2.5 rounded-full flex items-center justify-center animate-bounce shadow shrink-0">
                <BellRing className="w-5 h-5 text-emerald-400 animate-pulse" />
              </div>
              <div>
                <h4 className="font-sans font-black text-xs uppercase tracking-wider text-white">
                  {lang === "en" ? "ORDER CONFIRMED!" : "অর্ডার সফল হয়েছে!"}
                </h4>
                <p className="text-[10px] text-stone-400 font-mono mt-0.5 leading-normal">
                  {lang === "en" ? "Melodious bell sounded. Cash memo updated." : "ক্যাশ মেমোটি তৈরি হয়েছে এবং নোটিফিকেশন বেল বেজে উঠেছে।"}
                </p>
              </div>
            </div>
            <div className="text-center text-[10px] font-mono bg-emerald-600 text-white font-extrabold px-3 py-1.5 rounded-sm border border-emerald-500 animate-pulse shadow-sm whitespace-nowrap shrink-0">
              {lang === "en" ? "🔔 DONE" : "🔔 সম্পন্ন"}
            </div>
          </div>
        </div>
      )}

      {/* Google Drive Credentials Config Configurator Overlay */}
      {showDriveConfigModal && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-stone-900/80 backdrop-blur-xs font-sans print:hidden">
          <div className="bg-stone-950 border border-stone-800 text-stone-100 shadow-2xl rounded-sm p-6 w-full max-w-md animate-studio-reveal relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowDriveConfigModal(false)}
              className="absolute top-4 right-4 text-stone-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h3 className="font-display font-black text-sm tracking-wider uppercase text-amber-500 mb-3 flex items-center gap-2">
              <Cloud className="w-5 h-5 animate-pulse" />
              {lang === "en" ? "Google Drive Configurator" : "গুগল ড্রাইভ সেটআপ"}
            </h3>

            <p className="text-xs text-stone-400 leading-relaxed mb-4">
              {lang === "en"
                ? "RIEMART saves receipts directly to your personal Google Drive in PDF format. Because of sandbox safety rules, please supply a free Google OAuth Client ID first (saved in your device storage)."
                : "রিয়ামার্ট আপনার কাস্টমার রসিদ সরাসরি আপনার গুগল ড্রাইভে সেভ করে। নিরাপত্তা ফ্রেম ও স্যান্ডবক্সের জন্য অনুগ্রহ করে ১ মিনিটে একটি ফ্রি গুগল ওঅথ ক্লায়েন্ট আইডি নিয়ে পেস্ট করুন।"
              }
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-mono text-stone-400 uppercase tracking-wider mb-1 font-bold">
                  {lang === "en" ? "Google Client ID" : "গুগল ক্লায়েন্ট আইডি"}
                </label>
                <input
                  type="text"
                  placeholder="e.g. 12345-abcde.apps.googleusercontent.com"
                  value={customClientIdInput}
                  onChange={(e) => setCustomClientIdInput(e.target.value.trim())}
                  className="w-full bg-stone-900 border border-stone-800 rounded-sm text-xs font-mono px-3 py-2 text-stone-100 focus:outline-none focus:border-amber-500 transition-colors cursor-text"
                />
              </div>

              <div className="bg-stone-900 p-3 rounded-sm border border-stone-850 text-[11px] text-stone-300 space-y-1.5 font-mono leading-relaxed">
                <span className="text-[10px] text-amber-500 font-bold uppercase tracking-wider block">
                  {lang === "en" ? "Quick 1-Minute Guide:" : "১ মিনিটের কুইক গাইড:"}
                </span>
                <p>
                  1. Visit <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-amber-400 highlight-link underline hover:text-amber-300">Google Cloud Console</a>
                </p>
                <p>
                  2. Select a project & select <strong>APIs & Services &gt; Credentials</strong>
                </p>
                <p>
                  3. Click <strong>Create Credentials &gt; OAuth Client ID</strong> (Select Web application)
                </p>
                <p>
                  4. Set Authorized Redirect URI to: <code className="bg-stone-950 text-emerald-400 px-1 py-0.5 rounded break-all">{window.location.origin + window.location.pathname}</code>
                </p>
                <p>
                  5. Copy client ID and paste above!
                </p>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!customClientIdInput) {
                      alert(lang === "en" ? "Please paste a valid Google Client ID!" : "অনুগ্রহ করে একটি সঠিক ক্লায়েন্ট আইডি পেস্ট করুন!");
                      return;
                    }
                    try {
                      localStorage.setItem("riemart_gdrive_client_id", customClientIdInput);
                    } catch (e) {
                      console.error("Failed to save Google Client ID to localStorage:", e);
                    }
                    setGoogleClientId(customClientIdInput);
                    setShowDriveConfigModal(false);
                    
                    // Centralized sync to server settings so other devices pick it up instantly!
                    fetch("/api/settings/update", {
                      method: "POST",
                      body: JSON.stringify({ googleClientId: customClientIdInput }),
                      headers: { "Content-Type": "application/json" }
                    }).catch(err => console.error("Failed to sync GDrive Client ID to server settings:", err));
                    
                    if (printingOrder) {
                      setTimeout(() => {
                        saveInvoiceToGoogleDrive(printingOrder);
                      }, 400);
                    }
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-stone-50 font-mono text-[11px] uppercase tracking-wider px-4 py-2 font-black rounded-sm shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  {lang === "en" ? "Save & Authorize" : "সেভ এবং কানেক্ট করুন"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDriveConfigModal(false)}
                  className="bg-stone-850 hover:bg-stone-800 text-stone-300 font-mono text-[11px] uppercase px-4 py-2 rounded-sm cursor-pointer"
                >
                  {lang === "en" ? "Cancel" : "বাতিল করুন"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* End main container */}
    </div>
  );
}