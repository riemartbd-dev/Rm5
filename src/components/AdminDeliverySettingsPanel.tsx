import React, { useState, useMemo, transition } from "react";
import { Search, ToggleLeft, ToggleRight, DollarSign, PenTool, CheckCircle, Truck, ShoppingBag, ShieldAlert, Loader2, Save } from "lucide-react";
import { Product, StoreSettings, Language } from "../types";

interface AdminDeliverySettingsPanelProps {
  lang: Language;
  settings: StoreSettings;
  setSettings: React.Dispatch<React.SetStateAction<StoreSettings>>;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  addSystemLog: (type: "info" | "success" | "warning" | "security", messageEn: string, messageBn: string) => void;
  setAdminSuccessNotification: React.Dispatch<React.SetStateAction<{ messageEn: string, messageBn: string } | null>>;
}

export const AdminDeliverySettingsPanel: React.FC<AdminDeliverySettingsPanelProps> = ({
  lang,
  settings,
  setSettings,
  products,
  setProducts,
  addSystemLog,
  setAdminSuccessNotification,
}) => {
  // Global settings local states for snappy performance
  const [globalEnabled, setGlobalEnabled] = useState<boolean>(
    settings.deliveryChargeEnabled !== false
  );
  const [insideDhaka, setInsideDhaka] = useState<string>(
    String(settings.deliveryChargeInsideDhaka ?? 80)
  );
  const [outsideDhaka, setOutsideDhaka] = useState<string>(
    String(settings.deliveryChargeOutsideDhaka ?? 120)
  );
  const [isSavingGlobal, setIsSavingGlobal] = useState(false);

  // Specific Product Search & Override states
  const [productSearch, setProductSearch] = useState("");
  const [individualSuccess, setIndividualSuccess] = useState<Record<string, boolean>>({});

  // Memoized filter for ultrafast search without lagging
  const searchedProducts = useMemo(() => {
    const val = productSearch.trim().toLowerCase();
    if (!val) {
      // If no query, return first 5 products by default for editing preview
      return products.slice(0, 5);
    }
    return products.filter((p) => {
      const nameEn = (p.nameEn || "").toLowerCase();
      const nameBn = (p.nameBn || "").toLowerCase();
      const sku = (p.sku || "").toLowerCase();
      return nameEn.includes(val) || nameBn.includes(val) || sku.includes(val);
    });
  }, [products, productSearch]);

  const handleSaveGlobalSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingGlobal(true);

    const chargeInside = Number(insideDhaka);
    const chargeOutside = Number(outsideDhaka);

    if (isNaN(chargeInside) || chargeInside < 0 || isNaN(chargeOutside) || chargeOutside < 0) {
      alert(lang === "en" ? "Please enter valid delivery charges." : "দয়া করে সঠিক ডেলিভারি চার্জ নম্বর ইনপুট করুন।");
      setIsSavingGlobal(false);
      return;
    }

    try {
      // Update local setSettings
      setSettings((prev) => {
        const next = {
          ...prev,
          deliveryChargeEnabled: globalEnabled,
          deliveryChargeInsideDhaka: chargeInside,
          deliveryChargeOutsideDhaka: chargeOutside,
        };
        return next;
      });

      addSystemLog(
        "success",
        `Global delivery configurations updated: Global Enabled=${globalEnabled}, Inside=${chargeInside}৳, Outside=${chargeOutside}৳`,
        `গ্লোবাল ডেলিভারি সেটিংস আপডেট করা হয়েছে: চালু=${globalEnabled}, ঢাকার মধ্যে=${chargeInside}৳, ঢাকার বাইরে=${chargeOutside}৳`
      );

      setAdminSuccessNotification({
        messageEn: "✓ Global delivery charges successfully updated and distributed live!",
        messageBn: "✓ গ্লোবাল ডেলিভারি চার্জ এবং প্যারামিটারসমূহ সফলভাবে আপডেট করা হয়েছে!",
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingGlobal(false);
    }
  };

  const handleUpdateProductDeliveryOption = (
    productId: string,
    option: "default" | "free" | "custom",
    customVal?: number
  ) => {
    setProducts((prevProducts) => {
      const updated = prevProducts.map((p) => {
        if (p.id !== productId) return p;
        return {
          ...p,
          deliveryOption: option,
          customDeliveryCharge: customVal !== undefined ? customVal : p.customDeliveryCharge,
        };
      });
      return updated;
    });

    // Provide ultrafast UI success animation
    setIndividualSuccess((prev) => ({ ...prev, [productId]: true }));
    setTimeout(() => {
      setIndividualSuccess((prev) => ({ ...prev, [productId]: false }));
    }, 1500);

    const targetProd = products.find(p => p.id === productId);
    const prodName = targetProd ? targetProd.nameEn : "Product";
    addSystemLog(
      "info",
      `Product [${prodName}] delivery rule updated to: ${option}`,
      `প্রোডাক্ট [${prodName}] এর ডেলিভারি নিয়ম আপডেট করা হয়েছে: ${option === "default" ? "ডিফল্ট" : option === "free" ? "ফ্রি" : "কাস্টম"}`
    );
  };

  return (
    <div className="space-y-6 admin-black-green-theme bg-black p-4 sm:p-6 rounded-md border border-green-500/20" id="admin-delivery-control-panel">
      
      {/* View Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-green-500/20 pb-4">
        <div>
          <h3 className="font-display font-medium text-green-400 uppercase tracking-wider text-base flex items-center gap-2">
            <Truck className="w-5 h-5 text-green-400" />
            <span>
              {lang === "en" ? "Delivery Charge Control Room" : "ডেলিভারি চার্জ কন্ট্রোল সেন্টার"}
            </span>
          </h3>
          <p className="text-xs text-green-500/60 mt-1">
            {lang === "en"
              ? "Instantly control shipping rates globally, declare free delivery, or custom-tune specifications per-product."
              : "পুরো ওয়েবসাইটের ডেলিভারি চার্জ নিয়ন্ত্রণ করুন, ফ্রি ডেলিভারি চালু করুন এবং প্রোডাক্ট অনুযায়ী কাস্টম চার্জ এডিট করুন।"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono tracking-widest px-2.5 py-1 rounded bg-green-950/40 border border-green-500/30 text-green-400 flex items-center gap-1.5 uppercase font-bold">
            <span className={`w-1.5 h-1.5 rounded-full ${globalEnabled ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            {lang === "en"
              ? (globalEnabled ? "Global Delivery: ON" : "Free Shipping: Active")
              : (globalEnabled ? "ডেলিভারি চার্জ: চালু" : "ডেলিভারি চার্জ: ফ্রি")}
          </span>
        </div>
      </div>

      {/* Grid Layout of Controllers */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Global Delivery Controller Box */}
        <form onSubmit={handleSaveGlobalSettings} className="lg:col-span-5 border border-green-500/20 p-4 sm:p-5 rounded-sm bg-black space-y-5 h-fit">
          <h4 className="font-mono text-[11px] uppercase tracking-wider font-bold text-green-400 flex items-center gap-2 border-b border-green-500/10 pb-2">
            <span>🛡️</span>
            {lang === "en" ? "Global System Parameters" : "গ্লোবাল সিস্টেম প্যারামিটার"}
          </h4>

          {/* ON / OFF Toggle switch */}
          <div className="flex justify-between items-center bg-green-950/10 border border-green-500/10 p-3 rounded-sm">
            <div className="space-y-0.5">
              <span className="text-xs font-mono font-bold uppercase tracking-wider block">
                {lang === "en" ? "Global Delivery Charge" : "গ্লোবাল ডেলিভারি চার্জ"}
              </span>
              <span className="text-[9px] text-green-500/50 block">
                {lang === "en"
                  ? "Toggle OFF to enable absolute 100% Free Shipping globally"
                  : "বন্ধ করলে পুরো ওয়েবসাইট জুড়ে আনলিমিটেড ১০০% ফ্রি শিপিং চালু হবে"}
              </span>
            </div>
            
            <button
              type="button"
              onClick={() => setGlobalEnabled(!globalEnabled)}
              className="text-green-400 transition-transform active:scale-95 focus:outline-none cursor-pointer"
              id="global-delivery-toggle-switch"
            >
              {globalEnabled ? (
                <ToggleRight className="w-9 h-9 text-green-400" />
              ) : (
                <ToggleLeft className="w-9 h-9 text-red-500" />
              )}
            </button>
          </div>

          {/* Conditional Delivery Settings (if global delivery is enabled) */}
          <div className={`space-y-4 transition-all duration-300 ${globalEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[10px] font-mono text-green-500/70 uppercase">
                  {lang === "en" ? "Inside Dhaka (৳ BDT)" : "ঢাকার মধ্যে চার্জ (৳)"}
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-green-500/40">৳</span>
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    disabled={!globalEnabled}
                    value={insideDhaka}
                    onChange={(e) => setInsideDhaka(e.target.value)}
                    className="w-full bg-black border border-green-500/20 rounded pl-6 pr-2 py-1.5 text-xs text-green-400 font-mono outline-none focus:border-green-500"
                    id="global-inside-dhaka-charge-input"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-mono text-green-500/70 uppercase">
                  {lang === "en" ? "Outside Dhaka (৳ BDT)" : "ঢাকার বাইরে চার্জ (৳)"}
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-green-500/40">৳</span>
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    disabled={!globalEnabled}
                    value={outsideDhaka}
                    onChange={(e) => setOutsideDhaka(e.target.value)}
                    className="w-full bg-black border border-green-500/20 rounded pl-6 pr-2 py-1.5 text-xs text-green-400 font-mono outline-none focus:border-green-500"
                    id="global-outside-dhaka-charge-input"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <button
            type="submit"
            className="w-full bg-blue-700 text-white font-mono text-xs font-bold py-2 px-3 rounded uppercase tracking-wider hover:bg-blue-600 transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-md hover:scale-[1.01] active:scale-[0.99]"
            id="save-global-delivery-rules-btn"
          >
            {isSavingGlobal ? (
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            ) : (
              <Save className="w-4 h-4 text-white" />
            )}
            <span>
              {lang === "en" ? "Save Global Settings" : "গ্লোবাল সেটিংস সংরক্ষণ করুন"}
            </span>
          </button>
        </form>

        {/* Product-Specific overrides controller container */}
        <div className="lg:col-span-7 border border-green-500/20 p-4 sm:p-5 rounded-sm bg-black space-y-4">
          <div className="border-b border-green-500/10 pb-2">
            <h4 className="font-mono text-[11px] uppercase tracking-wider font-bold text-green-400 flex items-center gap-2">
              <span>🛍️</span>
              {lang === "en" ? "Product-Specific Controls" : "প্রোডাক্ট-নির্দিষ্ট এডিটর"}
            </h4>
            <p className="text-[10px] text-green-500/50 mt-1">
              {lang === "en"
                ? "Search any product to override its delivery rules with instant savings"
                : "প্রোডাক্ট সার্চ করে ইনস্ট্যান্টলি ডেলিভারি সেটিংস পরিবর্তন বা কাস্টমাইজ করুন।"}
            </p>
          </div>

          {/* Search bar specifically for products */}
          <div className="relative">
            <Search className="w-4 h-4 text-green-500/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={lang === "en" ? "Search product code (SKU) or keyword..." : "প্রোডাক্ট কোড (SKU) বা নাম দিয়ে সার্চ করুন..."}
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="w-full bg-black border border-green-500/30 rounded pl-9 pr-3 py-2 text-xs text-green-400 font-mono outline-none focus:border-green-500 placeholder-green-500/20"
              id="delivery-panel-product-search-bar"
            />
          </div>

          {/* Result count feedback */}
          <div className="text-[10px] text-green-500/40 font-mono pb-1 flex justify-between items-center">
            <span>
              {productSearch ? (
                lang === "en" ? `Filtered Results: ${searchedProducts.length}` : `ফিল্টারকৃত পণ্য: ${searchedProducts.length} টি`
              ) : (
                lang === "en" ? "Quick Inventory Preview (5 items)" : "দ্রুত এডিট তালিকা (৫টি পণ্য)"
              )}
            </span>
            {productSearch && (
              <button
                onClick={() => setProductSearch("")}
                className="text-red-500 hover:underline cursor-pointer text-[9px]"
              >
                Clear
              </button>
            )}
          </div>

          <div className="space-y-3 max-h-[290px] overflow-y-auto pr-1 select-none">
            {searchedProducts.length === 0 ? (
              <div className="border border-dashed border-green-500/10 p-6 rounded-sm text-center font-mono text-xs text-green-500/30">
                {lang === "en" ? "No products matched your inquiry." : "কোনো প্রোডাক্ট খুঁজে পাওয়া যায়নি।"}
              </div>
            ) : (
              searchedProducts.map((p) => {
                const isSaved = individualSuccess[p.id] || false;
                return (
                  <div key={p.id} className="border border-green-500/10 p-2.5 rounded-sm bg-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative transition-all hover:bg-green-950/5">
                    
                    {/* ID Indicator badge */}
                    {isSaved && (
                      <div className="absolute right-2 top-2 text-[10px] font-mono text-emerald-500 flex items-center gap-1 bg-green-950 px-1.5 py-0.5 rounded border border-emerald-500/20 animate-bounce">
                        <CheckCircle className="w-3 h-3 text-emerald-500" />
                        <span>Saved!</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 bg-black">
                      <img
                        src={p.image || "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&q=80&w=70"}
                        alt={p.nameEn}
                        className="w-10 h-10 object-cover rounded border border-green-500/10"
                        referrerPolicy="no-referrer"
                      />
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-green-400 line-clamp-1 max-w-[200px]">
                          {lang === "en" ? p.nameEn : p.nameBn}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-green-500/40 font-bold bg-green-950/30 px-1 py-0.5 rounded">
                            SKU_CODE: {p.sku || p.id}
                          </span>
                          <span className="text-[10px] text-green-500/40 font-mono">
                            Price: ৳{p.price}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto self-end sm:self-center bg-black">
                      <div className="flex flex-col gap-1 w-full bg-black">
                        <div className="flex gap-1.5 bg-black">
                          {/* Option Button group */}
                          <button
                            type="button"
                            onClick={() => handleUpdateProductDeliveryOption(p.id, "default")}
                            className={`px-2 py-1 text-[9px] font-mono rounded border uppercase transition-all flex items-center gap-0.5 cursor-pointer ${
                              (p.deliveryOption || "default") === "default"
                                ? "bg-green-950 border-green-500 text-green-400 font-bold"
                                : "bg-black border-green-500/20 text-green-500/50 hover:border-green-500/40"
                            }`}
                          >
                            Default
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => handleUpdateProductDeliveryOption(p.id, "free")}
                            className={`px-2 py-1 text-[9px] font-mono rounded border uppercase transition-all flex items-center gap-0.5 cursor-pointer ${
                              p.deliveryOption === "free"
                                ? "bg-green-950 border-green-500 text-green-400 font-bold"
                                : "bg-black border-green-500/20 text-green-500/50 hover:border-green-500/40"
                            }`}
                          >
                            🍔 Free
                          </button>

                          <button
                            type="button"
                            onClick={() => handleUpdateProductDeliveryOption(p.id, "custom", p.customDeliveryCharge || 50)}
                            className={`px-2 py-1 text-[9px] font-mono rounded border uppercase transition-all flex items-center gap-0.5 cursor-pointer ${
                              p.deliveryOption === "custom"
                                ? "bg-green-950 border-green-500 text-green-400 font-bold"
                                : "bg-black border-green-500/20 text-green-500/50 hover:border-green-500/40"
                            }`}
                          >
                            Custom
                          </button>
                        </div>

                        {/* Custom BDT Value input */}
                        {p.deliveryOption === "custom" && (
                          <div className="flex items-center gap-1.5 animate-studio-reveal mt-1">
                            <span className="text-[10px] text-green-500/40 font-mono">Charge:</span>
                            <div className="relative flex-1">
                              <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] font-mono text-green-500/30">৳</span>
                              <input
                                type="number"
                                min="0"
                                max="1000"
                                placeholder="Value"
                                value={p.customDeliveryCharge || ""}
                                onChange={(e) => {
                                  const rawVal = e.target.value;
                                  handleUpdateProductDeliveryOption(p.id, "custom", rawVal ? Number(rawVal) : 0);
                                }}
                                className="w-20 bg-black border border-green-500/30 rounded pl-4 pr-1 py-0.5 text-[10px] text-green-400 font-mono outline-none focus:border-green-500"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
