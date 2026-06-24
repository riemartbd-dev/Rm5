import React, { useState, useEffect, useRef } from "react";
import { Sparkles, RefreshCw, Image, Edit2, Trash2, Bold, Italic, List, Cloud, Loader2 } from "lucide-react";
import { Product, Category, Language } from "../types";
import { safeLocalStorage as localStorage, safeSessionStorage as sessionStorage } from "../utils/safeStorage";
import { DriveImagePickerModal } from "./DriveImagePickerModal";
import { 
  getStoredDriveToken, 
  googleDriveSignIn, 
  uploadProductImageToDrive 
} from "../utils/googleDriveHelper";
import { optimizeAndCompressImage } from "../utils/imageCompressor";


const OptimizedRichTextEditor = React.memo(({
  value,
  onChange,
  className,
  id,
  placeholder,
  required,
}: {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  id?: string;
  placeholder?: string;
  required?: boolean;
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [localHTML, setLocalHTML] = useState(value || "");
  const lastPropRef = useRef(value);
  const lastSentRef = useRef(value);

  // Initialize innerHTML on mount
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = value || "";
    }
  }, []);

  // Sync from parent if changed externally (e.g. edited product, Gemini generation)
  useEffect(() => {
    if (value !== lastPropRef.current && value !== lastSentRef.current) {
      setLocalHTML(value || "");
      if (editorRef.current) {
        editorRef.current.innerHTML = value || "";
      }
    }
    lastPropRef.current = value;
  }, [value]);

  // Debounce saving/propagating to maintain silky typing
  useEffect(() => {
    if (localHTML === value) return;

    const timer = setTimeout(() => {
      lastSentRef.current = localHTML;
      onChange(localHTML);
    }, 400);

    return () => clearTimeout(timer);
  }, [localHTML, value, onChange]);

  const handleInput = () => {
    if (editorRef.current) {
      const currentHTML = editorRef.current.innerHTML;
      setLocalHTML(currentHTML);
    }
  };

  const handleBlur = () => {
    if (editorRef.current) {
      const currentHTML = editorRef.current.innerHTML;
      if (currentHTML !== value) {
        lastSentRef.current = currentHTML;
        onChange(currentHTML);
      }
    }
  };

  const execCmd = (command: string, argValue: string = "") => {
    document.execCommand(command, false, argValue);
    handleInput();
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  return (
    <div className={`border border-stone-200 rounded overflow-hidden bg-white focus-within:border-stone-400 focus-within:ring-1 focus-within:ring-stone-400 transition-all ${className}`}>
      {/* Tiny Modern Toolbar */}
      <div className="flex items-center gap-1 bg-stone-50 border-b border-stone-150 px-2 py-1 select-none">
        <button
          type="button"
          onClick={() => execCmd("bold")}
          className="p-1 rounded text-stone-700 hover:bg-stone-200 hover:text-stone-900 transition-colors focus:outline-none"
          title="Bold (Ctrl+B)"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => execCmd("italic")}
          className="p-1 rounded text-stone-700 hover:bg-stone-200 hover:text-stone-900 transition-colors focus:outline-none"
          title="Italic (Ctrl+I)"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => execCmd("insertUnorderedList")}
          className="p-1 rounded text-stone-700 hover:bg-stone-200 hover:text-stone-900 transition-colors focus:outline-none"
          title="Bullet List"
        >
          <List className="w-3.5 h-3.5" />
        </button>
        {placeholder && !localHTML && (
          <span className="text-[10px] text-stone-400 font-sans ml-auto pointer-events-none select-none">
            {placeholder}
          </span>
        )}
      </div>

      {/* Editable HTML Element Area */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onBlur={handleBlur}
        className="p-2.5 text-xs text-stone-900 h-28 overflow-y-auto outline-none select-text text-left prose-sm max-w-none prose-stone [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-0.5"
        style={{ minHeight: "6rem" }}
        id={id}
      />
    </div>
  );
});

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
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <input
      type={type}
      value={value === undefined || value === null ? "" : value}
      onChange={handleChange}
      onBlur={onBlur}
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
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  return (
    <textarea
      value={value === undefined || value === null ? "" : value}
      onChange={handleChange}
      onBlur={onBlur}
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
  { value: "Men's Shirt", labelEn: "Shirt", labelBn: "শার্ট", gender: "men" },
  { value: "Men's T-shirt", labelEn: "T-shirt", labelBn: "টি-শার্ট", gender: "men" },
  { value: "Men's Pant", labelEn: "Pant", labelBn: "প্যান্ট", gender: "men" },
  { value: "Men's Panjabi", labelEn: "Panjabi", labelBn: "পাঞ্জাবি", gender: "men" },
  { value: "Men's Under garments", labelEn: "Under garments", labelBn: "আন্ডারগার্মেন্টস (পুরুষ)", gender: "men" },
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

interface ProductFormEditorProps {
  initialProductBuffer: Partial<Product>;
  editingProductId: string | null;
  lang: Language;
  dictionary: any;
  categories: Category[];
  onSave: (buffer: Partial<Product>) => void;
  onCancel: () => void;
  addSystemLog: (type: "info" | "success" | "warning" | "security", msgEn: string, msgBn: string) => void;
}

function convertDriveUrl(url: string): string {
  if (!url) return "";
  const reg1 = /\/file\/d\/([a-zA-Z0-9_-]+)/;
  const reg2 = /id=([a-zA-Z0-9_-]+)/;
  const match1 = url.match(reg1);
  const match2 = url.match(reg2);
  const fileId = (match1 && match1[1]) || (match2 && match2[1]);
  if (fileId) {
    return `https://docs.google.com/uc?export=view&id=${fileId}`;
  }
  return url;
}

const StudioImageSlot = React.memo(({
  index,
  image,
  lang,
  onImageChange,
  onClear,
  onOpenDrive,
}: {
  index: number;
  image: string;
  lang: Language;
  onImageChange: (index: number, val: string) => void;
  onClear: (index: number) => void;
  onOpenDrive?: (index: number) => void;
}) => {
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleUploadToDrive = async () => {
    if (!image || !image.startsWith("data:")) return;
    setUploading(true);
    setErrorMsg(null);
    try {
      let token = getStoredDriveToken();
      if (!token) {
        const authResult = await googleDriveSignIn();
        token = authResult.token;
      }
      if (!token) throw new Error("Authentication failed");

      const fileName = `Product_${Date.now()}_Slot${index + 1}.jpg`;
      
      try {
        const directUrl = await uploadProductImageToDrive(token, image, fileName, "RIEMART_Invoices");
        onImageChange(index, directUrl);
      } catch (uploadErr: any) {
        // If expired or unauthorized (401), clear stale tokens and re-authenticate immediately
        const isStale = 
          uploadErr.message === "EXPIRED_TOKEN" || 
          uploadErr.message?.includes("401") || 
          uploadErr.message?.includes("Unauthorized") || 
          String(uploadErr).includes("401") ||
          String(uploadErr).includes("Unauthorized");

        if (isStale) {
          console.warn("Google Drive token stale. Clearing cached token and prompting sign-in...", uploadErr);
          try {
            sessionStorage.removeItem("riemart_gdrive_token");
            localStorage.removeItem("riemart_gdrive_token");
          } catch {}

          const authResult = await googleDriveSignIn();
          const newToken = authResult.token;
          if (!newToken) throw new Error("Re-authentication failed");

          const retryUrl = await uploadProductImageToDrive(newToken, image, fileName, "RIEMART_Invoices");
          onImageChange(index, retryUrl);
        } else {
          throw uploadErr;
        }
      }
    } catch (err: any) {
      console.error("Direct slot image upload fail:", err);
      setErrorMsg(lang === "en" ? "Upload failed" : "আপলোড ব্যর্থ");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative group border border-stone-200 rounded bg-stone-50 p-2 text-center flex flex-col justify-between items-center space-y-2 min-h-[145px]" id={`studio-image-slot-${index}`}>
      <span className="absolute top-1 left-2 font-mono text-[9px] text-stone-400 font-bold">Slot {index + 1}</span>
      
      <div className="w-12 h-12 bg-white rounded border border-stone-150 flex items-center justify-center overflow-hidden shrink-0 mt-3 relative">
        {uploading ? (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
          </div>
        ) : image ? (
          <img src={image} className="w-full h-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <Image className="w-4 h-4 text-stone-300" />
        )}
      </div>

      <div className="w-full space-y-1.5 pt-1">
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              optimizeAndCompressImage(file)
                .then((optimizedBase64) => {
                  onImageChange(index, optimizedBase64);
                })
                .catch(() => {
                  // Resilient fallback to raw base64 if anything fails
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    onImageChange(index, reader.result as string);
                  };
                  reader.readAsDataURL(file);
                });
            }
          }}
          className="hidden"
          id={`local-slot-file-${index}`}
        />
        
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => document.getElementById(`local-slot-file-${index}`)?.click()}
            className="flex-1 bg-white hover:bg-stone-100 border border-stone-200 py-1 rounded text-[8px] text-stone-700 font-mono active:scale-95 transition-transform cursor-pointer font-bold leading-none"
            title={lang === "en" ? "Device File" : "ডিভাইস ফাইল"}
          >
            {lang === "en" ? "Device" : "ডিভাইস"}
          </button>
          
          <button
            type="button"
            onClick={() => onOpenDrive && onOpenDrive(index)}
            className="flex-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 py-1 rounded text-[8px] text-blue-700 font-mono active:scale-95 transition-transform cursor-pointer flex items-center justify-center gap-0.5 font-bold leading-none"
            title={lang === "en" ? "Load from Google Drive" : "ড্রাইভ থেকে লোড করুন"}
          >
            <span>☁️</span>
            <span>{lang === "en" ? "Drive" : "ড্রাইভ"}</span>
          </button>
        </div>

        {/* If Base64 local image is detected, offer Direct Drive Upload */}
        {image && image.startsWith("data:") && (
          <button
            type="button"
            onClick={handleUploadToDrive}
            disabled={uploading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white border border-blue-700 py-1 rounded text-[8.5px] font-mono active:scale-95 transition-transform cursor-pointer flex items-center justify-center gap-1 font-bold leading-none shrink-0"
          >
            <Cloud className="w-2.5 h-2.5 text-white" />
            <span>{lang === "en" ? "Upload to Drive" : "ড্রাইভে আপলোড"}</span>
          </button>
        )}

        <OptimizedInput
          type="text"
          placeholder={lang === "en" ? "Image Link" : "ফটো লিঙ্ক"}
          value={image.startsWith("data:") ? "" : image}
          onChange={(val) => {
            const convertedUrl = convertDriveUrl(val);
            onImageChange(index, convertedUrl);
          }}
          className="w-full bg-white border border-stone-200 rounded px-1 py-0.5 text-[8px] text-center font-sans tracking-tight focus:bg-white text-stone-850 outline-none"
        />

        {errorMsg && (
          <p className="text-[8px] text-red-500 font-medium leading-none mt-0.5">{errorMsg}</p>
        )}
      </div>

      {image && (
        <button
          type="button"
          onClick={() => {
            setErrorMsg(null);
            onClear(index);
          }}
          className="absolute top-0 right-1 text-red-500 hover:text-red-700 font-bold text-xs cursor-pointer focus:outline-none"
          title="Clear"
        >
          ×
        </button>
      )}
    </div>
  );
});

export const ProductFormEditor: React.FC<ProductFormEditorProps> = ({
  initialProductBuffer,
  editingProductId,
  lang,
  dictionary,
  categories,
  onSave,
  onCancel,
  addSystemLog
}) => {
  // Local state initialized with initial values for buttery performance (0 re-renders of the App.tsx on typing)
  const [buffer, setBuffer] = useState<Partial<Product>>(initialProductBuffer);
  const [isSaving, setIsSaving] = useState(false);

  // Synchronize when active product ID changes (e.g., when switching between products to edit)
  useEffect(() => {
    setBuffer(initialProductBuffer);
  }, [editingProductId]);

  // AI Image generator state
  const [showAiImageGenerator, setShowAiImageGenerator] = useState(false);
  const [isGeneratingAiImage, setIsGeneratingAiImage] = useState(false);
  const [aiImagePrompt, setAiImagePrompt] = useState("");
  const [aiImageError, setAiImageError] = useState<string | null>(null);

  // Gemini copywriter state
  const [geminiPromptInput, setGeminiPromptInput] = useState("");
  const [geminiGenerating, setGeminiGenerating] = useState(false);
  const [geminiError, setGeminiError] = useState<string | null>(null);

  // Google Drive Image Picker state
  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState(false);
  const [activePickerSlot, setActivePickerSlot] = useState<number | null>(null);

  const handleOpenDrivePicker = React.useCallback((index: number) => {
    setActivePickerSlot(index);
    setIsDrivePickerOpen(true);
  }, []);

  const handleDriveImageSelected = React.useCallback((url: string) => {
    if (activePickerSlot !== null) {
      setBuffer((prev) => {
        const updated = [...(prev.images || Array(6).fill(""))];
        updated[activePickerSlot] = url;
        return {
          ...prev,
          images: updated,
          image: activePickerSlot === 0 ? url : (prev.image || updated.find(img => img !== "") || url),
        };
      });
    }
  }, [activePickerSlot]);


  // Optimized, stable parent updater callbacks to isolate input rendering
  const handleUpdateNameEn = React.useCallback((val: string) => {
    setBuffer((prev) => ({ ...prev, nameEn: val }));
  }, []);

  const handleUpdateNameBn = React.useCallback((val: string) => {
    setBuffer((prev) => ({ ...prev, nameBn: val }));
  }, []);

  const handleUpdateSku = React.useCallback((val: string) => {
    setBuffer((prev) => ({ ...prev, sku: val }));
  }, []);

  const handleUpdateCategory = React.useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCat = e.target.value as Category;
    setBuffer((prev) => ({ ...prev, category: newCat, subCategory: undefined }));
  }, []);

  const handleUpdateSubCategory = React.useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setBuffer((prev) => ({ ...prev, subCategory: e.target.value || undefined }));
  }, []);

  const handleUpdatePrice = React.useCallback((val: string) => {
    setBuffer((prev) => ({ ...prev, price: val as any }));
  }, []);

  const handleUpdateRegularPrice = React.useCallback((val: string) => {
    setBuffer((prev) => ({ ...prev, regularPrice: val ? val as any : undefined }));
  }, []);

  const handleUpdateDeliveryOption = React.useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as "default" | "free" | "custom";
    setBuffer((prev) => ({ ...prev, deliveryOption: val }));
  }, []);

  const handleUpdateCustomDeliveryCharge = React.useCallback((val: string) => {
    setBuffer((prev) => ({ ...prev, customDeliveryCharge: val ? Number(val) : undefined }));
  }, []);

  const handleUpdateInventory = React.useCallback((val: string) => {
    setBuffer((prev) => ({ ...prev, inventory: val as any }));
  }, []);

  const handleUpdateDescriptionEn = React.useCallback((val: string) => {
    setBuffer((prev) => ({ ...prev, descriptionEn: val }));
  }, []);

  const handleUpdateDescriptionBn = React.useCallback((val: string) => {
    setBuffer((prev) => ({ ...prev, descriptionBn: val }));
  }, []);

  const handleUpdateGeminiPrompt = React.useCallback((val: string) => {
    setGeminiPromptInput(val);
  }, []);

  const handleUpdateOffers = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = e.target.checked;
    setBuffer((prev) => ({ ...prev, offers: isChecked }));
  }, []);

  const handleSlotImageChange = React.useCallback((index: number, val: string) => {
    setBuffer((prev) => {
      const updated = [...(prev.images || Array(6).fill(""))];
      updated[index] = val;
      return {
        ...prev,
        images: updated,
        image: index === 0 ? val : (prev.image || updated.find(img => img !== "") || val),
      };
    });
  }, []);

  const handleSlotImageClear = React.useCallback((index: number) => {
    setBuffer((prev) => {
      const updated = [...(prev.images || Array(6).fill(""))];
      updated[index] = "";
      return {
        ...prev,
        images: updated,
        image: index === 0 ? updated.find(img => img !== "") || "" : prev.image,
      };
    });
  }, []);

  // Handle AI Generate image
  const handleAiGenerateHeroImageLocal = async () => {
    const activePrompt = aiImagePrompt || `A professional high-end luxury studio showcase photo of ${buffer.nameEn || "a premium product"}, category is ${buffer.category || "General"}, photorealistic, cinematic lighting, ultra-detailed product retail presentation, 1k resolution`;
    
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
      const updatedImages = [...(buffer.images || Array(6).fill(""))];
      // Place in slot 1 (index 0)
      updatedImages[0] = data.imageUrl;

      setBuffer((prev) => ({
        ...prev,
        images: updatedImages,
        image: data.imageUrl,
      }));

      addSystemLog(
        "success",
        `AI successfully generated high-end showcase photo for [${buffer.nameEn || "item"}].`,
        `এআই সফলভাবে [${buffer.nameBn || "পণ্য"}] এর জন্য চমৎকার কভার ছবি তৈরি করেছে।`
      );
    } catch (err: any) {
      console.error(err);
      setAiImageError(err.message || "An unexpected error occurred during image generation.");
    } finally {
      setIsGeneratingAiImage(false);
    }
  };

  // Generate description with Gemini (Local)
  const generateDescriptionWithGeminiLocal = async () => {
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
        setBuffer((prev) => ({
          ...prev,
          descriptionEn: enDraft,
          descriptionBn: bnDraft
        }));
      } else {
        setBuffer((prev) => ({
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(buffer);
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-stone-50 border border-stone-200 space-y-4 rounded-sm" id="catalog-matrix-editor-form">
      <h4 className="font-mono text-xs font-bold text-stone-900 uppercase border-b border-stone-200 pb-2 flex items-center justify-between">
        <span>
          {editingProductId ? dictionary[lang].editProduct : dictionary[lang].createNewProduct}
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="text-stone-400 hover:text-stone-900 text-xs font-sans tracking-wide font-medium cursor-pointer"
          id="cancel-product-editing"
        >
          Cancel
        </button>
      </h4>

      {/* Product Artifact Names & SKU */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-[10px] font-mono text-stone-650 uppercase mb-1">{dictionary[lang].nameEn} {lang === "en" ? "(Optional)" : "(ঐচ্ছিক)"}</label>
          <OptimizedInput
            type="text"
            placeholder="Luxury Silk Scarf"
            value={buffer.nameEn || ""}
            onChange={handleUpdateNameEn}
            className="w-full bg-white border border-stone-200 rounded px-2.5 py-2 text-xs text-stone-900 outline-none focus:border-stone-400 focus:ring-0"
            id="input-name-en"
          />
        </div>
        <div>
          <label className="block text-[10px] font-mono text-stone-650 uppercase mb-1">{dictionary[lang].nameBn} {lang === "en" ? "(Optional)" : "(ঐচ্ছিক)"}</label>
          <OptimizedInput
            type="text"
            placeholder="বিলাসবহুল রেশম স্কার্ফ"
            value={buffer.nameBn || ""}
            onChange={handleUpdateNameBn}
            className="w-full bg-white border border-stone-200 rounded px-2.5 py-2 text-xs text-stone-900 outline-none focus:border-stone-400 focus:ring-0"
            id="input-name-bn"
          />
        </div>
        <div>
          <label className="block text-[10px] font-mono text-stone-650 uppercase mb-1 font-bold text-stone-950">
            {lang === "en" ? "Unique SKU Code (Optional)" : "ইউনিক SKU কোড (ঐচ্ছিক)"}
          </label>
          <OptimizedInput
            type="text"
            placeholder="e.g. RM-CLOTH-SCARF01"
            value={buffer.sku || ""}
            onChange={handleUpdateSku}
            className="w-full bg-white border border-stone-200 rounded px-2.5 py-2 text-xs text-stone-900 font-mono font-bold uppercase outline-none focus:border-stone-400 focus:ring-0"
            id="input-product-sku"
          />
        </div>
      </div>

      {/* Category and Dual Pricing metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-[10px] font-mono text-stone-650 uppercase mb-1">Category</label>
          <select
            value={buffer.category}
            onChange={handleUpdateCategory}
            className="w-full bg-white border border-stone-200 rounded px-2 py-2 text-xs text-stone-900 outline-none focus:border-stone-400 focus:ring-0"
            id="input-category"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Dynamic Sub-category field */}
        {(buffer.category === "Perfume" || buffer.category === "Food & Beverage" || buffer.category === "Clothing" || buffer.category === "Cosmetics" || buffer.category === "Baby Care") && (
          <div>
            <label className="block text-[10px] font-mono text-stone-650 uppercase mb-1 font-bold text-stone-900">Sub-category</label>
            <select
              value={buffer.subCategory || ""}
              onChange={handleUpdateSubCategory}
              className="w-full bg-white border border-stone-200 rounded px-2 py-2 text-xs text-stone-900 outline-none focus:border-stone-400"
              id="input-product-sub-category"
            >
              <option value="">None</option>
              {buffer.category === "Perfume" ? (
                PERFUME_SUBCATEGORIES.map((sub) => (
                  <option key={sub.value} value={sub.value}>
                    {sub.labelEn}
                  </option>
                ))
              ) : buffer.category === "Food & Beverage" ? (
                FOOD_BEVERAGE_SUBCATEGORIES.map((sub) => (
                  <option key={sub.value} value={sub.value}>
                    {sub.labelEn}
                  </option>
                ))
              ) : buffer.category === "Clothing" ? (
                CLOTHING_SUBCATEGORIES.map((sub) => (
                  <option key={sub.value} value={sub.value}>
                    {sub.labelEn} ({sub.gender === "men" ? "Men" : "Women"})
                  </option>
                ))
              ) : buffer.category === "Cosmetics" ? (
                COSMETICS_SUBCATEGORIES.map((sub) => (
                  <option key={sub.value} value={sub.value}>
                    {sub.labelEn}
                  </option>
                ))
              ) : (
                BABY_CARE_SUBCATEGORIES.map((sub) => (
                  <option key={sub.value} value={sub.value}>
                    {sub.labelEn}
                  </option>
                ))
              )}
            </select>
          </div>
        )}
        <div>
          <label className="block text-[10px] font-mono text-stone-650 uppercase mb-1 font-bold text-stone-900">
            {lang === "en" ? "Offer Price (৳ BDT) *" : "অফার মূল্য (৳ টাকা) *"}
          </label>
          <OptimizedInput
            type="number"
            min="1"
            max="10000"
            value={buffer.price || ""}
            onChange={handleUpdatePrice}
            className="w-full bg-white border border-stone-200 rounded px-2.5 py-2 text-xs text-stone-900 font-mono outline-none focus:border-stone-400"
            required
            id="input-price"
          />
        </div>
        <div>
          <label className="block text-[10px] font-mono text-stone-650 uppercase mb-1 text-stone-500">
            {lang === "en" ? "Regular Price (৳ BDT)" : "নিয়মিত মূল্য (৳ টাকা)"}
          </label>
          <OptimizedInput
            type="number"
            min="1"
            max="10000"
            placeholder="e.g. 150"
            value={buffer.regularPrice || ""}
            onChange={handleUpdateRegularPrice}
            className="w-full bg-white border border-stone-200 rounded px-2.5 py-2 text-xs text-stone-900 font-mono outline-none focus:border-stone-400"
            id="input-regular-price"
          />
        </div>
        <div>
          <label className="block text-[10px] font-mono text-stone-650 uppercase mb-1">{dictionary[lang].stockNum} *</label>
          <OptimizedInput
            type="number"
            min="0"
            max="5000"
            value={buffer.inventory !== undefined ? buffer.inventory : 10}
            onChange={handleUpdateInventory}
            className="w-full bg-white border border-stone-200 rounded px-2.5 py-2 text-xs text-stone-900 font-mono outline-none focus:border-stone-400"
            required
            id="input-inventory"
          />
        </div>
      </div>

      {/* Product-Level Delivery Override Controls */}
      <div className="border border-stone-200 p-4 rounded-sm bg-stone-50/50 space-y-3 shadow-sm">
        <div>
          <label className="block text-[11px] font-mono text-stone-900 font-bold uppercase tracking-wide">
            {lang === "en" ? "Product-Specific Delivery Configuration" : "প্রোডাক্ট-নির্দিষ্ট ডেলিভারি কনফিগারেশন"}
          </label>
          <p className="text-[10px] text-stone-500 font-sans leading-tight mt-0.5">
            {lang === "en" 
              ? "Set customized shipping rules for this product. Choosing Custom lets you adjust or edit explicit delivery charges."
              : "এই প্রোডাক্টের জন্য কাস্টম শিপিং নিয়ম সেট করুন। কাস্টম চার্জ দিয়ে আপনি এই প্রোডাক্টের চার্জ নির্দিষ্ট করতে পারবেন।"}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-[10px] font-mono text-stone-650 uppercase mb-1 font-bold text-stone-900">
              {lang === "en" ? "Delivery Charge Option" : "ডেলিভারি চার্জ অপশন"}
            </label>
            <select
              value={buffer.deliveryOption || "default"}
              onChange={handleUpdateDeliveryOption}
              className="w-full bg-white border border-stone-200 rounded px-2.5 py-2 text-xs text-stone-900 outline-none focus:border-stone-400"
              id="product-edit-delivery-option-select"
            >
              <option value="default">{lang === "en" ? "Default (System Standard Charge)" : "ডিফল্ট (সিস্টেমের সাধারণ চার্জ)"}</option>
              <option value="free">{lang === "en" ? "Free Delivery" : "ফ্রি ডেলিভারি"}</option>
              <option value="custom">{lang === "en" ? "Custom Delivery Charge" : "কাস্টম ডেলিভারি চার্জ"}</option>
            </select>
          </div>

          {buffer.deliveryOption === "custom" && (
            <div>
              <label className="block text-[10px] font-mono text-stone-650 uppercase mb-1 font-bold text-stone-900">
                {lang === "en" ? "Custom Delivery Charge (৳ BDT)" : "কাস্টম ডেলিভারি চার্জ (৳ টাকা)"}
              </label>
              <OptimizedInput
                type="number"
                min="0"
                max="5000"
                placeholder="e.g. 50"
                value={buffer.customDeliveryCharge || ""}
                onChange={handleUpdateCustomDeliveryCharge}
                className="w-full bg-white border border-stone-200 rounded px-2.5 py-2 text-xs text-stone-900 font-mono outline-none focus:border-stone-400"
                id="product-edit-custom-delivery-input"
                required
              />
            </div>
          )}
        </div>
      </div>

      {/* 6-Slot Premium Product Studio Gallery */}
      <div className="border border-stone-200 p-4 rounded-sm bg-white pl-4 space-y-3 shadow-sm">
        <div>
          <label className="block text-[11px] font-mono text-stone-900 font-bold uppercase tracking-wide">
            {lang === "en" ? "Modular Studio Gallery (Up to 6 Images)" : "স্টুডিও প্রোডাক্ট গ্যালারি (সর্বোচ্চ ৬টি ছবি)"}
          </label>
          <p className="text-[10px] text-stone-500 font-sans leading-tight mt-0.5">
            {lang === "en" 
              ? "Populate individual slots. Device uploads (Base64), image links, and Google Drive sharing links are natively supported."
              : "প্রতিটি স্লটে ছবি যোগ করুন। ডিভাইস থেকে ফটো সিলেক্ট করুন, ডিরেক্ট ছবি লিঙ্ক দিন অথবা গুগল ড্রাইভ ফাইল শেয়ারিং লিঙ্ক দিন।"}
          </p>
        </div>

        {/* AI Hero Image Studio control panel */}
        <div className="bg-stone-50 border border-stone-200/80 p-3 rounded-sm space-y-2 mt-1">
          <div className="flex justify-between items-center">
            <span className="text-[10px] uppercase font-mono font-bold text-stone-850 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              {lang === "en" ? "AI Hero Image Studio" : "এআই হিরো ইমেজ স্টুডিও"}
            </span>
            <button
              type="button"
              onClick={() => {
                if (!aiImagePrompt) {
                  setAiImagePrompt(`A professional high-end luxury studio showcase photo of ${buffer.nameEn || "a premium product"}, category is ${buffer.category || "General"}, photorealistic, cinematic lighting, ultra-detailed product retail presentation, 1k resolution`);
                }
                setShowAiImageGenerator(!showAiImageGenerator);
              }}
              className="text-[10px] font-mono bg-stone-900 text-white px-2.5 py-1 rounded shadow-sm hover:bg-stone-850 active:scale-95 transition-all duration-75 select-none touch-manipulation cursor-pointer"
              id="btn-ai-image-studio-toggle"
            >
              {showAiImageGenerator 
                ? (lang === "en" ? "Hide Controls" : "অপশনস বন্ধ করুন") 
                : (lang === "en" ? "AI-Generate Hero Image" : "এআই ইমেজ জেনারেশন")}
            </button>
          </div>

          {(showAiImageGenerator || isGeneratingAiImage) && (
            <div className="space-y-2 pt-1">
              <div>
                <label className="block text-[8px] font-mono text-stone-500 uppercase mb-0.5">
                  {lang === "en" ? "Enter Image Prompt Description" : "ইমেজ জেনারেশন প্রম্পট বর্ণনা"}
                </label>
                <OptimizedTextarea
                  placeholder={lang === "en" ? "Describe the photo in detail..." : "বিস্তারিত বর্ণনা করুন..."}
                  value={aiImagePrompt}
                  onChange={(val) => setAiImagePrompt(val)}
                  className="w-full text-[10px] p-1.5 border border-stone-250 bg-white rounded font-sans leading-snug focus:bg-white text-stone-850 outline-none"
                  id="textarea-ai-image-prompt"
                />
                <div className="flex justify-between items-center mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAiImagePrompt(`A professional high-end luxury studio showcase photo of ${buffer.nameEn || "a premium product"}, category is ${buffer.category || "General"}, photorealistic, cinematic lighting, ultra-detailed product retail presentation, 1k resolution`);
                    }}
                    className="text-[9px] font-mono text-stone-500 hover:text-stone-950 underline cursor-pointer select-none touch-manipulation"
                  >
                    {lang === "en" ? "Reset to Auto-Prompt" : "অটো-প্রম্পটে রিসেট করুন"}
                  </button>
                  <span className="text-[9px] text-stone-400 font-mono">
                    {lang === "en" ? "Model: Gemini 2.5 Image" : "মডেল: জেমিনি ২.৫ ইমেজ"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                disabled={isGeneratingAiImage}
                onClick={handleAiGenerateHeroImageLocal}
                className="w-full bg-amber-505 bg-amber-500 hover:bg-amber-600 text-white py-2 rounded text-[10px] font-mono font-bold uppercase transition-all duration-75 active:scale-[0.98] active:opacity-95 flex items-center justify-center gap-1.5 disabled:opacity-50 select-none touch-manipulation cursor-pointer"
                id="btn-ai-generate-hero"
              >
                {isGeneratingAiImage ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{lang === "en" ? "Creating Beautiful Photo..." : "ছবি তৈরি করা হচ্ছে..."}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{lang === "en" ? "Generate Showcase Photo" : "শোকেস কভারটি তৈরি করুন"}</span>
                  </>
                )}
              </button>

              {aiImageError && (
                <p className="text-[10px] text-red-500 font-mono leading-tight bg-red-50 border border-red-150 p-1.5 rounded">
                  Exception: {aiImageError}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, index) => {
            const currentSlotImage = (buffer.images && buffer.images[index]) || "";
            return (
              <StudioImageSlot
                key={index}
                index={index}
                image={currentSlotImage}
                lang={lang}
                onImageChange={handleSlotImageChange}
                onClear={handleSlotImageClear}
                onOpenDrive={handleOpenDrivePicker}
              />
            );
          })}
        </div>
      </div>

      {/* SERVER-SIDE GEMINI COPYWRITER BOX */}
      <div className="bg-stone-100 p-3.5 border border-stone-200 rounded space-y-2">
        <h5 className="text-[11px] font-mono font-bold text-stone-900 flex items-center gap-1.5 uppercase">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          {dictionary[lang].geminiAssistant}
        </h5>
        <p className="text-[10px] text-stone-500 font-sans">
          {dictionary[lang].geminiPrompt}
        </p>
        <div className="flex gap-2">
          <OptimizedInput
            type="text"
            placeholder="Example: Pure Oud extract, rare cashmere fiber, hand dyed charcoal black"
            value={geminiPromptInput}
            onChange={handleUpdateGeminiPrompt}
            className="flex-1 bg-white border border-stone-200 rounded px-2.5 py-2 text-xs outline-none focus:border-stone-400"
            id="gemini-assistant-prompt"
          />
          <button
            type="button"
            onClick={generateDescriptionWithGeminiLocal}
            disabled={geminiGenerating}
            className="bg-stone-950 hover:bg-stone-900 text-white px-3 py-2 text-[10px] font-mono uppercase rounded transition-colors disabled:opacity-50 cursor-pointer text-stone-100"
            id="gemini-assistant-generate-btn"
          >
            {geminiGenerating ? dictionary[lang].geminiStatus : dictionary[lang].geminiGenerate}
          </button>
        </div>
        {geminiError && (
          <div className="text-[9px] font-mono text-red-600 bg-red-50 p-1 rounded border border-red-100 mt-1">
            ⚠ {geminiError}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-mono text-stone-650 uppercase mb-1">{dictionary[lang].descrEn}</label>
          <OptimizedRichTextEditor
            value={buffer.descriptionEn || ""}
            onChange={handleUpdateDescriptionEn}
            id="input-desc-en"
            placeholder="Elegant product description in English..."
          />
        </div>
        <div>
          <label className="block text-[10px] font-mono text-stone-650 uppercase mb-1">{dictionary[lang].descrBn}</label>
          <OptimizedRichTextEditor
            value={buffer.descriptionBn || ""}
            onChange={handleUpdateDescriptionBn}
            id="input-desc-bn"
            placeholder="প্রোডাক্টের আকর্ষণীয় বাংলা বিবরণ..."
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="input-offers"
          checked={!!buffer.offers}
          onChange={handleUpdateOffers}
          className="w-4 h-4 text-stone-950 accent-stone-950 rounded border-stone-300 focus:ring-0 cursor-pointer"
        />
        <label htmlFor="input-offers" className="text-xs font-mono text-stone-700 uppercase cursor-pointer">
          Mark as Eligible for active "Special Offer" Promo stamp
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
        <button
          type="button"
          disabled={isSaving}
          onClick={onCancel}
          className="px-3.5 py-2 border border-stone-200 hover:bg-stone-100 text-stone-600 text-xs font-mono uppercase rounded active:scale-95 transition-all duration-75 select-none touch-manipulation cursor-pointer disabled:opacity-50"
          id="cancel-product-edit-btn"
        >
          {dictionary[lang].cancel}
        </button>
        <button
          type="submit"
          disabled={isSaving}
          onClick={(e) => {
            e.preventDefault();
            if (isSaving) return;
            if (!buffer.price) {
              alert(lang === "en"
                ? "Please populate all required fields: Offer Price."
                : "দয়া করে সব প্রয়োজনীয় ক্ষেত্রগুলো পূরণ করুন: অফার মূল্য।"
              );
              return;
            }
            setIsSaving(true);
            setTimeout(() => {
              onSave(buffer);
              setIsSaving(false);
            }, 900); // 900ms smooth simulation for database commit feedback
          }}
          className="px-4 py-2 bg-stone-950 hover:bg-stone-900 text-white text-xs font-mono uppercase tracking-wider rounded active:scale-[0.98] transition-all duration-75 select-none touch-manipulation cursor-pointer text-stone-100 flex items-center gap-1.5 min-h-[38px] disabled:opacity-80 disabled:cursor-not-allowed"
          id="save-product-submit"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
              <span>{lang === "en" ? "Saving..." : "সংরক্ষণ হচ্ছে..."}</span>
            </>
          ) : (
            <span>{dictionary[lang].saveChange}</span>
          )}
        </button>
      </div>

      {/* Google Drive Image Picker Modal Overlay */}
      <DriveImagePickerModal
        isOpen={isDrivePickerOpen}
        onClose={() => setIsDrivePickerOpen(false)}
        lang={lang}
        onSelectImage={handleDriveImageSelected}
      />
    </form>
  );
};
