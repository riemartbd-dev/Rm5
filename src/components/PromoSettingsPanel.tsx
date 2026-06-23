import React, { useState, useEffect } from "react";
import { StoreSettings, Language } from "../types";
import { Sliders, Globe, Facebook, Upload, Sparkles, AlertCircle, Sparkle, Loader2 } from "lucide-react";
import { optimizeAndCompressImage } from "../utils/imageCompressor";

interface PromoSettingsPanelProps {
  settings: StoreSettings;
  onSave: (updated: StoreSettings) => void;
  lang: Language;
}

export const PromoSettingsPanel: React.FC<PromoSettingsPanelProps> = ({
  settings,
  onSave,
  lang,
}) => {
  // Local draft state for absolute typing and selection performance (no lag!)
  const [draft, setDraft] = useState<StoreSettings>({ ...settings });
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const [discountEnabled, setDiscountEnabled] = useState<boolean>(
    draft.buyMoreSaveMoreEnabled ?? true
  );

  // Sync draft if parent settings change (e.g. initial load or reset)
  useEffect(() => {
    setDraft({ ...settings });
  }, [settings]);

  useEffect(() => {
    setDiscountEnabled(!!draft.buyMoreSaveMoreEnabled);
  }, [draft.buyMoreSaveMoreEnabled]);

  const handleFieldChange = (key: keyof StoreSettings, value: any) => {
    setDraft((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleToggleDiscount = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = event.target.checked;

    // ১. প্রথমে UI আপডেট করুন (যাতে ইউজার রেসপন্স পায়)
    setDiscountEnabled(isChecked);
    handleFieldChange("buyMoreSaveMoreEnabled", isChecked);

    try {
      // ২. সার্ভারে আপডেট রিকোয়েস্ট পাঠান
      const response = await fetch('/api/settings/update', {
        method: 'POST',
        body: JSON.stringify({ multiple_buy_discount: isChecked }),
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('আপডেট সফল হয়নি');
      }

      // Sync to parent settings so checkout immediately updates
      onSave({
        ...draft,
        buyMoreSaveMoreEnabled: isChecked,
      });

    } catch (error) {
      console.error('Error updating:', error);
      // ৩. ভুল হলে আগের অবস্থায় ফিরিয়ে আনুন
      setDiscountEnabled(!isChecked);
      handleFieldChange("buyMoreSaveMoreEnabled", !isChecked);
      alert(lang === "en" ? 'Could not save settings, please try again.' : 'সেটিংস সেভ করা যায়নি, দয়া করে আবার চেষ্টা করুন।');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setTimeout(() => {
      onSave(draft);
      setIsSaving(false);
      setSuccessMsg(
        lang === "en" 
          ? "Settings saved successfully!" 
          : "সেটিংস সফলভাবে সংরক্ষণ করা হয়েছে!"
      );
      setTimeout(() => setSuccessMsg(""), 4000);
    }, 800); // 800ms elegant simulation delay for committing to cloud DB rules
  };

  const handleAutogenSignature = () => {
    const label = draft.storeSignatureText || "Authorized Sign";
    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 80;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, 300, 80);
      ctx.font = "italic 32px 'Brush Script MT', 'Segoe Script', 'Great Vibes', 'Caveat', cursive";
      ctx.fillStyle = "#1e3a8a"; // elegant royal navy signature ink
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.translate(150, 40);
      ctx.rotate(-0.06); // slight organic stroke slant
      ctx.fillText(label, 0, 0);
      const dataUrl = canvas.toDataURL("image/png");
      handleFieldChange("storeSignatureImage", dataUrl);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-stone-200 rounded-sm shadow-sm p-5 space-y-5">
      <div className="flex items-center justify-between border-b border-stone-100 pb-2">
        <h3 className="font-display font-medium text-stone-950 uppercase tracking-wider text-sm flex items-center gap-2">
          <Sliders className="w-4 h-4 text-stone-800" />
          <span>{lang === "en" ? "Active Promotional & Store Settings" : "সক্রিয় প্রমোশন ও স্টোর সেটিংস"}</span>
        </h3>
        {successMsg && (
          <span className="text-[11px] font-bold text-emerald-600 bg-emerald-55/80 px-2 py-0.5 rounded border border-emerald-200 animate-pulse">
            {successMsg}
          </span>
        )}
      </div>

      <div className="space-y-4 text-xs font-sans">
        
        {/* CHECKBOX: Multi-buy discount */}
        <div className="bg-stone-50 p-4 border border-stone-150 rounded space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="buyMoreSaveMoreEnabled"
                checked={discountEnabled}
                onChange={handleToggleDiscount}
                className="w-4 h-4 text-stone-950 accent-stone-950 cursor-pointer"
              />
              <label htmlFor="buyMoreSaveMoreEnabled" className="font-mono text-stone-850 font-bold uppercase cursor-pointer">
                {lang === "en" ? "Multiple Buy Discount Enabled" : "বান্ডেল ডিসকাউন্ট সক্রিয় করুন"}
              </label>
            </div>
            <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider">3 Tiers Active</span>
          </div>

          {draft.buyMoreSaveMoreEnabled && (
            <div className="grid grid-cols-2 gap-3 font-mono text-[11px] pt-1 border-t border-stone-200/50 mt-1">
              <div>
                <span className="block text-[10px] text-stone-400 font-bold">TIER-2 (LEVEL 1) VOLUME</span>
                <input
                  type="number"
                  value={draft.tier2Qty}
                  onChange={(e) => handleFieldChange("tier2Qty", Number(e.target.value))}
                  className="w-full bg-white border border-stone-200 rounded py-1 px-2 mt-1 focus:ring-1 focus:ring-amber-500 outline-none"
                />
              </div>
              <div>
                <span className="block text-[10px] text-stone-400 font-bold">TIER-2 DISCOUNT (%)</span>
                <input
                  type="number"
                  value={draft.tier2Discount}
                  onChange={(e) => handleFieldChange("tier2Discount", Number(e.target.value))}
                  className="w-full bg-white border border-stone-200 rounded py-1 px-2 mt-1 focus:ring-1 focus:ring-amber-500 outline-none"
                />
              </div>

              <div className="mt-1">
                <span className="block text-[10px] text-stone-400 font-bold">TIER-3 (LEVEL 2) VOLUME</span>
                <input
                  type="number"
                  value={draft.tier3Qty}
                  onChange={(e) => handleFieldChange("tier3Qty", Number(e.target.value))}
                  className="w-full bg-white border border-stone-200 rounded py-1 px-2 mt-1 focus:ring-1 focus:ring-amber-500 outline-none"
                />
              </div>
              <div className="mt-1">
                <span className="block text-[10px] text-stone-400 font-bold">TIER-3 DISCOUNT (%)</span>
                <input
                  type="number"
                  value={draft.tier3Discount}
                  onChange={(e) => handleFieldChange("tier3Discount", Number(e.target.value))}
                  className="w-full bg-white border border-stone-200 rounded py-1 px-2 mt-1 focus:ring-1 focus:ring-amber-500 outline-none"
                />
              </div>

              {/* BRAND NEW TIER 4 OPTION */}
              <div className="mt-1">
                <span className="block text-[10px] text-stone-450 font-bold text-amber-900 flex items-center gap-1">
                  <Sparkle className="w-2.5 h-2.5 text-amber-500" />
                  <span>TIER-4 (LEVEL 3) VOLUME *</span>
                </span>
                <input
                  type="number"
                  value={draft.tier4Qty ?? 5}
                  onChange={(e) => handleFieldChange("tier4Qty", Number(e.target.value))}
                  className="w-full bg-orange-50/20 border border-amber-200 rounded py-1 px-2 mt-1 focus:ring-1 focus:ring-amber-500 outline-none font-bold text-amber-950"
                />
              </div>
              <div className="mt-1">
                <span className="block text-[10px] text-stone-450 font-bold text-amber-900 flex items-center gap-1">
                  <Sparkle className="w-2.5 h-2.5 text-amber-500" />
                  <span>TIER-4 DISCOUNT (%) *</span>
                </span>
                <input
                  type="number"
                  value={draft.tier4Discount ?? 20}
                  onChange={(e) => handleFieldChange("tier4Discount", Number(e.target.value))}
                  className="w-full bg-orange-50/20 border border-amber-200 rounded py-1 px-2 mt-1 focus:ring-1 focus:ring-amber-500 outline-none font-bold text-amber-950"
                />
              </div>
            </div>
          )}
        </div>

        {/* NEW OPTION: BULK PURCHASER OPTION */}
        <div className="bg-orange-50/20 border border-orange-200 p-4 rounded space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="bulkPriceEnabled"
                checked={draft.bulkPriceEnabled}
                onChange={(e) => handleFieldChange("bulkPriceEnabled", e.target.checked)}
                className="w-4 h-4 text-amber-600 accent-amber-600 cursor-pointer"
              />
              <label htmlFor="bulkPriceEnabled" className="font-mono text-orange-900 font-bold uppercase cursor-pointer flex items-center gap-1">
                <span>{lang === "en" ? "Bulk Purchaser Option" : "বাল্ক পারচেসার অপশন"}</span>
              </label>
            </div>
            <span className="text-[9px] bg-orange-100 text-orange-850 px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider">Wholesale</span>
          </div>

          <p className="text-[10px] text-stone-500 leading-relaxed font-sans">
            {lang === "en" 
              ? "When customers buy a HUGE volume, apply a dynamic FLAT pricing per product and mandate a security advance payment at checkout."
              : "গ্রাহকরা হিউজ কোয়ান্টিটি অর্ডার দিলে প্রতিটি পণ্যের ফ্লাট রেট প্রাইস কার্যকর হবে এবং পেমেন্টে শর্তসাপেক্ষে নিরাপত্তা অগ্রিম প্রদান করতে হবে।"}
          </p>

          {draft.bulkPriceEnabled && (
            <div className="grid grid-cols-3 gap-2 font-mono text-[10px] pt-2 border-t border-orange-200/40">
              <div>
                <span className="block text-[9px] text-stone-500 font-bold uppercase">MINIMUM QTY</span>
                <input
                  type="number"
                  value={draft.bulkMinQty}
                  onChange={(e) => handleFieldChange("bulkMinQty", Number(e.target.value))}
                  className="w-full bg-white border border-stone-200 rounded py-1 px-1.5 mt-1 focus:ring-1 focus:ring-amber-500 outline-none"
                  placeholder="e.g. 10"
                />
              </div>
              <div>
                <span className="block text-[9px] text-stone-500 font-bold uppercase">FLAT RATE (৳)</span>
                <input
                  type="number"
                  value={draft.bulkFlatPrice}
                  onChange={(e) => handleFieldChange("bulkFlatPrice", Number(e.target.value))}
                  className="w-full bg-white border border-stone-200 rounded py-1 px-1.5 mt-1 focus:ring-1 focus:ring-amber-500 outline-none font-bold text-stone-900"
                  placeholder="e.g. 450"
                />
              </div>
              <div>
                <span className="block text-[9px] text-stone-500 font-bold uppercase">ADVANCE REQ (%)</span>
                <input
                  type="number"
                  value={draft.bulkAdvancePercent}
                  onChange={(e) => handleFieldChange("bulkAdvancePercent", Number(e.target.value))}
                  className="w-full bg-white border border-stone-200 rounded py-1 px-1.5 mt-1 focus:ring-1 focus:ring-amber-500 outline-none text-red-600 font-bold"
                  placeholder="e.g. 30"
                />
              </div>
            </div>
          )}
        </div>

        {/* ANNOUNCEMENT */}
        <div className="bg-stone-50 p-4 border border-stone-150 rounded space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showAnnouncement"
              checked={draft.showAnnouncement}
              onChange={(e) => handleFieldChange("showAnnouncement", e.target.checked)}
              className="w-4 h-4 text-stone-950 accent-stone-950 cursor-pointer"
            />
            <label htmlFor="showAnnouncement" className="font-mono text-stone-850 font-bold uppercase cursor-pointer">
              {lang === "en" ? "Show Ticker Announcement Banner" : "ঘোষণা ব্যানার প্রদর্শন করুন"}
            </label>
          </div>

          {draft.showAnnouncement && (
            <div className="space-y-2 pt-1">
              <div>
                <span className="block text-[10px] text-stone-400 font-bold font-mono">ANNOUNCEMENT TEXT (ENGLISH)</span>
                <input
                  type="text"
                  value={draft.announcementEn}
                  onChange={(e) => handleFieldChange("announcementEn", e.target.value)}
                  className="w-full bg-white border border-stone-200 rounded py-1 px-2.5 mt-1 text-xs focus:ring-1 focus:ring-amber-500 outline-none"
                />
              </div>
              <div>
                <span className="block text-[10px] text-stone-400 font-bold font-mono">ANNOUNCEMENT TEXT (BANGLA)</span>
                <input
                  type="text"
                  value={draft.announcementBn}
                  onChange={(e) => handleFieldChange("announcementBn", e.target.value)}
                  className="w-full bg-white border border-stone-200 rounded py-1 px-2.5 mt-1 text-xs focus:ring-1 focus:ring-amber-500 outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* SIGNATURE */}
        <div className="bg-stone-50 p-4 border border-stone-150 rounded space-y-3">
          <h4 className="font-mono text-stone-850 font-bold uppercase flex items-center gap-1.5">
            <span>{lang === "en" ? "Authorized Signature Settings" : "স্টোর সাইন বা সিগনেচার সেটিংস"}</span>
          </h4>
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] text-stone-400 font-mono mb-1 font-bold">
                {lang === "en" ? "SIGNATURE TITLE LABEL" : "স্বাক্ষরের নিচের পদবী / বিবরণ"}
              </label>
              <input
                type="text"
                value={draft.storeSignatureText || ""}
                placeholder="e.g. Authorized Signature / Managing Director"
                onChange={(e) => handleFieldChange("storeSignatureText", e.target.value)}
                className="w-full bg-white border border-stone-200 rounded py-1 px-2.5 text-xs focus:ring-1 focus:ring-amber-500 outline-none"
              />
            </div>

            <div>
              <span className="block text-[10px] text-stone-400 font-mono mb-1 font-bold">
                {lang === "en" ? "SIGNATURE IMAGE" : "স্বাক্ষরের ছবি"}
              </span>

              {draft.storeSignatureImage ? (
                <div className="p-2 border border-stone-200 bg-white rounded flex flex-col items-center gap-2">
                  <img
                    src={draft.storeSignatureImage}
                    alt="Active Signature"
                    className="max-h-12 max-w-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => handleFieldChange("storeSignatureImage", "")}
                    className="text-[9px] font-mono text-red-600 hover:text-red-700 border border-red-100 px-2 py-0.5 rounded uppercase font-bold"
                  >
                    {lang === "en" ? "Remove Image" : "স্বাক্ষর মুছুন"}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 text-center">
                  <label className="border border-dashed border-stone-300 rounded p-2 cursor-pointer flex flex-col items-center justify-center gap-1 bg-white hover:bg-stone-100">
                    <Upload className="w-3.5 h-3.5 text-stone-500" />
                    <span className="text-[9px] font-mono font-bold text-stone-600">UPLOAD IMAGE</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          optimizeAndCompressImage(file)
                            .then((optimizedBase64) => {
                              handleFieldChange("storeSignatureImage", optimizedBase64);
                            })
                            .catch(() => {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                if (typeof reader.result === "string") {
                                  handleFieldChange("storeSignatureImage", reader.result);
                                }
                              };
                              reader.readAsDataURL(file);
                            });
                        }
                      }}
                      className="hidden"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleAutogenSignature}
                    className="border border-stone-200 rounded p-2 flex flex-col items-center justify-center gap-1 bg-white hover:bg-stone-100"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-[9px] font-mono font-bold uppercase">AUTOGEN CURSIVE</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* DOMAIN AND SOCIALS */}
        <div className="bg-stone-50 p-4 border border-stone-150 rounded space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-mono text-stone-850 font-bold uppercase flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-stone-600 animate-pulse" />
                <span>{lang === "en" ? "Live Domain Configuration" : "লাইভ ডোমেইন সেটিংস ও শেয়ার লিংক কনফিগারেশন"}</span>
              </h4>
              <span className="text-[9px] bg-blue-100 text-blue-800 font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">
                {lang === "en" ? "Fully Conducted" : "সরাসরি সংযুক্ত"}
              </span>
            </div>
            
            <p className="text-[10px] text-stone-500 leading-relaxed mb-2 font-sans">
              {lang === "en"
                ? "Enter your custom domain here (e.g., riemart.com). We optimize it instantly to safely run QR codes, WhatsApp/FB shares, and bypass relative path errors."
                : "আপনার ব্যক্তিগত ডোমেইন লিংক দিন (যেমন: riemart.com)। এটি ফুটার কিউআর কোড, ফেসবুক এবং হোয়াটসঅ্যাপ শেয়ারিং এর সাথে সম্পূর্ণ স্বয়ংক্রিয়ভাবে সংযুক্ত হবে এবং কোনো রুট এরর আসবে না।"}
            </p>

            <div className="relative">
              <input
                type="text"
                value={draft.publicStoreDomain || ""}
                placeholder="e.g. riemart.com"
                onChange={(e) => handleFieldChange("publicStoreDomain", e.target.value)}
                className="w-full bg-white border border-stone-200 rounded py-2 px-3 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono text-blue-900 transition-all shadow-inner"
              />
              {draft.publicStoreDomain && (
                <div className="mt-1 text-[9px] text-blue-600 font-mono flex items-center gap-1">
                  <span>✓ Live Link:</span>
                  <span className="underline select-all">
                    {draft.publicStoreDomain.startsWith("http") ? draft.publicStoreDomain : `https://${draft.publicStoreDomain}`}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-stone-200/50 pt-3 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-mono text-stone-850 font-bold uppercase flex items-center gap-1.5">
                <Facebook className="w-3.5 h-3.5 text-blue-600" />
                <span>{lang === "en" ? "Facebook Integration Hub" : "ফেসবুক সোশ্যাল লিংক ও মেসেঞ্জার কানেকশন"}</span>
              </h4>
              <span className="text-[9px] bg-emerald-100 text-emerald-800 font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">
                {lang === "en" ? "Auto-Prepared" : "অটো-কনডাক্টেড"}
              </span>
            </div>

            <p className="text-[10px] text-stone-500 leading-relaxed font-sans">
              {lang === "en"
                ? "Link your Facebook Page and Messenger seamlessly. Customers can directly click Footer Buttons or utilize automated messaging paths with zero load latencies."
                : "আপনার ফেসবুক পেজ এবং মেসেঞ্জার আইডি সরাসরি লিংক করুন। কাস্টমাররা ফুটার বাটন বা সরাসরি ম্যাসেজিং চ্যানেলে ট্যাপ করে রিয়েলটাইমে আপনার পেজে রিডাইরেক্ট হতে পারবেন।"}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="block text-[10px] text-stone-400 font-bold font-mono uppercase">FACEBOOK PAGE URL</span>
                <input
                  type="text"
                  value={draft.facebookPageUrl || ""}
                  placeholder="e.g. www.facebook.com/riemart.bd"
                  onChange={(e) => handleFieldChange("facebookPageUrl", e.target.value)}
                  className="w-full bg-white border border-stone-200 rounded py-2 px-3 mt-1 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-inner"
                />
                {draft.facebookPageUrl && (
                  <div className="mt-1 text-[9px] text-emerald-600 font-mono truncate select-all">
                    <span>✓ Page: </span>
                    <span>{draft.facebookPageUrl.startsWith("http") ? draft.facebookPageUrl : `https://${draft.facebookPageUrl}`}</span>
                  </div>
                )}
              </div>
              
              <div>
                <span className="block text-[10px] text-stone-400 font-bold font-mono uppercase">MESSENGER USERNAME</span>
                <input
                  type="text"
                  value={draft.facebookMessengerUsername || ""}
                  placeholder="e.g. riemart.bd"
                  onChange={(e) => handleFieldChange("facebookMessengerUsername", e.target.value)}
                  className="w-full bg-white border border-stone-200 rounded py-2 px-3 mt-1 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono transition-all shadow-inner"
                />
                {draft.facebookMessengerUsername && (
                  <div className="mt-1 text-[9px] text-emerald-600 font-mono">
                    <span>✓ Chat Link: </span>
                    <span className="underline select-all">https://m.me/{draft.facebookMessengerUsername}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* SUBMIT BUTTON */}
      <div className="pt-2 border-t border-stone-100 flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={isSaving}
          className="bg-stone-900 hover:bg-stone-950 text-white font-mono text-xs font-bold px-5 py-2.5 rounded-sm shadow-sm hover:shadow transition-all cursor-pointer uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-80 disabled:cursor-not-allowed min-h-[38px]"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
              <span>{lang === "en" ? "Saving..." : "সংরক্ষণ হচ্ছে..."}</span>
            </>
          ) : (
            <span>{lang === "en" ? "Save Settings Configuration" : "সেটিংস কনফিগারেশন সংরক্ষণ করুন"}</span>
          )}
        </button>
      </div>
    </form>
  );
};
