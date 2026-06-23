import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import { QrCode, Clipboard, Check, Sparkles, Printer, Download, Eye, Layers, Scaling, Palette, AlertTriangle, Share2, Globe, Smartphone } from "lucide-react";

interface AtelierQrStickerSpaceProps {
  lang: "en" | "bn";
  onLogAction?: (type: "info" | "success" | "warning" | "security", msgEn: string, msgBn: string) => void;
}

export const AtelierQrStickerSpace: React.FC<AtelierQrStickerSpaceProps> = ({ lang, onLogAction }) => {
  // Use current window location or a clean auto-resolver to convert private dev edits (-dev-) into public shared links (-pre-) which resolves access permission (403 forbidden) automatically!
  const getInitialBaseUrl = () => {
    if (typeof window !== "undefined" && window.location.origin) {
      const origin = window.location.origin;
      // If it's a private developer link containing "-dev-", replace with public shared link "-pre-" to prevent 403 authorization error!
      if (origin.includes("-dev-")) {
        return origin.replace("-dev-", "-pre-");
      }
      return origin;
    }
    return "https://ais-pre-lal6k3zqlq7ej7axfsl5gi-252555841806.asia-southeast1.run.app";
  };

  // Customization States
  const [baseUrlInput, setBaseUrlInput] = useState(getInitialBaseUrl());
  const [utmSource, setUtmSource] = useState("qr_sticker");
  const [titleEn, setTitleEn] = useState("RIEMART PREMIUM ATELIER");
  const [titleBn, setTitleBn] = useState("রিয়ালমার্ট প্রিমিয়াম স্টোর");
  const [subtitleEn, setSubtitleEn] = useState("SCAN TO DISCOVER & PLACE INSTANT ORDERS");
  const [subtitleBn, setSubtitleBn] = useState("স্ক্যান করে সরাসরি পণ্য অর্ডার ও অফার দেখুন");
  const [themeStyle, setThemeStyle] = useState<"obsidian" | "gold" | "crimson" | "clean">("obsidian");
  const [layoutPreset, setLayoutPreset] = useState<"badge" | "flyer" | "minimal">("badge");
  const [copied, setCopied] = useState(false);
  const [showCampaignTags, setShowCampaignTags] = useState(true);

  // Computed Values
  const finalQrUrl = utmSource ? `${baseUrlInput}?src=${utmSource}` : baseUrlInput;
  
  // Generate high-resolution local client-side base64 QR Code
  const [qrCodeImgUrl, setQrCodeImgUrl] = useState<string>("");

  useEffect(() => {
    QRCode.toDataURL(finalQrUrl, {
      width: 1000,
      margin: 1,
      color: {
        dark: "#000000",
        light: "#FFFFFF"
      }
    })
    .then((url) => {
      setQrCodeImgUrl(url);
    })
    .catch((err) => {
      console.error("Failed to generate offline QR Code:", err);
    });
  }, [finalQrUrl]);

  const copyToClipboard = () => {
    let success = false;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(finalQrUrl);
        success = true;
      }
    } catch (err) {
      console.warn("navigator.clipboard api is restricted inside iframe sandbox context, resorting to fallback handler", err);
    }

    if (!success) {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = finalQrUrl;
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
        console.error("Critical: Formatted fallback copy-to-clipboard routine inside QR sticker failed", err);
      }
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (onLogAction) {
      onLogAction(
        "info", 
        `Copied QR Sticker URL: ${finalQrUrl}`, 
        `কিউআর কোড স্টিকার লিংক কপি করা হয়েছে: ${finalQrUrl}`
      );
    }
  };

  const handleDownloadQR = () => {
    if (!qrCodeImgUrl) return;
    try {
      const link = document.createElement("a");
      link.href = qrCodeImgUrl;
      link.download = `riemart_access_qr_${utmSource || "store"}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      if (onLogAction) {
        onLogAction(
          "success", 
          `QR Code Generated (Downloaded): Sticker exported with source [${utmSource || "store"}]`, 
          `কিউআর কোড তৈরি (ডাউনলোড): [${utmSource || "store"}] সোর্সের স্টিকারটি সংরক্ষণ করা হয়েছে`
        );
      }
    } catch (error) {
      console.error("Download failed, showing fallback image helper", error);
      const newWindow = window.open();
      if (newWindow) {
        newWindow.document.write(`<div style="display:flex;justify-content:center;align-items:center;height:100vh;background:#fafafa;"><div style="text-align:center;font-family:sans-serif;"><p style="font-weight:bold;">Right-click or hold the QR image to save:</p><img src="${qrCodeImgUrl}" style="border:1px solid #ccc;border-radius:8px;padding:10px;background:white;width:300px;height:300px;"/></div></div>`);
        newWindow.document.close();
      }
    }
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to print the sticker layout.");
      return;
    }
    if (onLogAction) {
      onLogAction(
        "info", 
        `QR Code Generated (Printed): Sticker sent to printers with layout [${layoutPreset}] inside theme [${themeStyle}]`, 
        `কিউআর কোড তৈরি (প্রিন্ট): [${themeStyle}] থিমের [${layoutPreset}] লেআউটের স্টিকার প্রিন্ট করতে পাঠানো হয়েছে`
      );
    }

    // Capture visual layout styling for the print window
    let themeBg = "background-color: #0c0a09; color: #ffffff;";
    if (themeStyle === "gold") themeBg = "background-color: #f59e0b; color: #0c0a09;";
    if (themeStyle === "crimson") themeBg = "background-color: #9f1239; color: #ffffff;";
    if (themeStyle === "clean") themeBg = "background-color: #ffffff; color: #0c0a09; border: 3px double #0c0a09;";

    printWindow.document.write(`
      <html>
        <head>
          <title>Print QR Access Badge</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Playfair+Display:wght@700&display=swap');
            body {
              margin: 0;
              padding: 0;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              font-family: 'Inter', sans-serif;
              background-color: #f3f4f6;
            }
            .sticker-container {
              width: ${layoutPreset === "flyer" ? "540px" : layoutPreset === "minimal" ? "320px" : "400px"};
              padding: 40px;
              border-radius: 12px;
              text-align: center;
              box-shadow: 0 10px 25px rgba(0,0,0,0.1);
              ${themeBg}
            }
            .brand-crown {
              font-size: 24px;
              line-height: 1;
              margin-bottom: 12px;
            }
            .main-title {
              font-family: 'Playfair Display', serif;
              font-size: ${layoutPreset === "flyer" ? "28px" : "22px"};
              font-weight: 700;
              margin: 0 0 8px 0;
              letter-spacing: 1px;
              text-transform: uppercase;
            }
            .sub-title {
              font-size: 11px;
              font-weight: 600;
              opacity: 0.8;
              margin: 0 0 24px 0;
              letter-spacing: 1.5px;
              text-transform: uppercase;
            }
            .qr-frame {
              background-color: #ffffff;
              padding: 20px;
              border-radius: 8px;
              display: inline-block;
              margin-bottom: 24px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.05);
            }
            .qr-image {
              width: 240px;
              height: 240px;
              display: block;
            }
            .footer-instructions {
              font-size: 11px;
              font-weight: bold;
              margin: 16px 0 0 0;
              opacity: 0.9;
              letter-spacing: 0.5px;
            }
            .footer-url {
              font-family: monospace;
              font-size: 11px;
              opacity: 0.6;
              margin-top: 8px;
            }
            @media print {
              body {
                background-color: white;
              }
              .sticker-container {
                box-shadow: none;
                margin: auto;
              }
            }
          </style>
        </head>
        <body>
          <div class="sticker-container">
            <div class="brand-crown">✦</div>
            <h1 class="main-title">${lang === "en" ? titleEn : titleBn}</h1>
            <h2 class="sub-title">${lang === "en" ? subtitleEn : subtitleBn}</h2>
            <div class="qr-frame">
              <img src="${qrCodeImgUrl}" class="qr-image" />
            </div>
            <p class="footer-instructions">
              ${lang === "en" ? "✓ SCAN WITH BARCODE / CAMERA QR APP" : "✓ যেকোনো ক্যামেরা অথবা কিউআর স্ক্যানার দিয়ে স্ক্যান করুন"}
            </p>
            <div class="footer-url">${finalQrUrl}</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="bg-white border border-stone-200 p-4 sm:p-6 rounded-sm shadow-sm space-y-6 animate-studio-reveal" id="admin-qr-generator-panel">
      {/* Panel Greeting Title Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-stone-100 pb-4">
        <div>
          <h3 className="font-display font-medium text-stone-950 uppercase tracking-wider text-base flex items-center gap-2">
            <QrCode className="w-5 h-5 text-amber-500" />
            <span>{lang === "en" ? "Instant Customer Access Tools" : "সহজ গ্রাহক এক্সেস ও কোড জেনারেটর সরঞ্জাম"}</span>
          </h3>
          <p className="text-xs text-stone-400 mt-1">
            {lang === "en" 
              ? "Design, customize, and print high-resolution customer access QR sticker posters for physical retail placement." 
              : "দোকানের কাউন্টার, বক্স, অথবা প্যাকেজিংয়ের জন্য কাস্টম ডিজাইনের ক্যাশলেস গ্রাহক প্রবেশাধিকার কিউআর স্টিকার তৈরি ও প্রিন্ট করুন।"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copyToClipboard}
            className="bg-stone-50 hover:bg-stone-100 text-stone-850 px-3 py-1.5 rounded text-xs font-mono flex items-center gap-1.5 border border-stone-200 cursor-pointer font-bold transition-all"
            id="qr-copy-entry-link-btn"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Clipboard className="w-3.5 h-3.5" />}
            {copied ? (lang === 'en' ? "Copied!" : "কপি হয়েছে!") : (lang === 'en' ? "Copy Link" : "লিংক কপি করুন")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left column: Controls & parameters */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-stone-50 border border-stone-200/80 p-4 rounded-sm space-y-4">
            
            {/* Customization header */}
            <div className="flex items-center gap-2 border-b border-stone-200 pb-2">
              <palette-icon className="text-stone-700">
                <Palette className="w-4 h-4" />
              </palette-icon>
              <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-stone-800">
                {lang === "en" ? "Sticker Design Parameters" : "স্টিকার ডিজাইন ও কাস্টমাইজেশন"}
              </h4>
            </div>

            {/* Website / Destination Access Link */}
            <div className="space-y-3.5 p-4 bg-amber-500/5 border border-amber-500/20 rounded-sm">
              <div className="space-y-1">
                <label className="block text-[10px] font-mono text-stone-650 uppercase font-bold flex items-center justify-between">
                  <span>{lang === "en" ? "Website Link for QR Code" : "কিউআর কোড স্ক্যান লিংক (কাস্টমার এক্সেস)"}</span>
                  <span className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider">{lang === "en" ? "✓ Public Redirect Active" : "✓ পাবলিক রিডাইরেক্ট সচল"}</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="https://..."
                    value={baseUrlInput}
                    onChange={(e) => setBaseUrlInput(e.target.value)}
                    className="w-full bg-white border border-stone-200 rounded px-3 py-2 text-xs font-mono font-bold text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    id="target-link-qr-input"
                  />
                  <button
                    type="button"
                    onClick={() => setBaseUrlInput(getInitialBaseUrl())}
                    className="bg-amber-100 hover:bg-amber-200 text-stone-900 text-[10px] sm:text-xs font-mono font-bold px-3 rounded shrink-0 whitespace-nowrap border border-amber-300 transition-all cursor-pointer"
                  >
                    {lang === "en" ? "Reset Link" : "মূল লিংক"}
                  </button>
                </div>
              </div>

              {/* Quick Preset Toggles to let users experiment and adapt URL setups */}
              <div className="space-y-1.5">
                <span className="block text-[9px] font-mono font-bold text-stone-500 uppercase tracking-wide">
                  {lang === "en" ? "Quick Link Templates:" : "কুইক লিংক টেমপ্লেট নির্বাচন করুন:"}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const origin = typeof window !== "undefined" && window.location.origin ? window.location.origin : "";
                      const publicUrl = origin.includes("-dev-") ? origin.replace("-dev-", "-pre-") : origin;
                      setBaseUrlInput(publicUrl || "https://ais-pre-lal6k3zqlq7ej7axfsl5gi-252555841806.asia-southeast1.run.app");
                    }}
                    className={`px-2.5 py-1.5 rounded text-[11px] font-mono font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                      baseUrlInput.includes("-pre-")
                        ? "bg-stone-900 text-white border-stone-900"
                        : "bg-white text-stone-700 border-stone-200 hover:bg-stone-50"
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5 text-amber-500" />
                    <span className="truncate">{lang === "en" ? "Public Link (-pre-)" : "পাবলিক লিংক (-pre-)"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const origin = typeof window !== "undefined" && window.location.origin ? window.location.origin : "";
                      const devUrl = origin.includes("-pre-") ? origin.replace("-pre-", "-dev-") : origin;
                      setBaseUrlInput(devUrl || "https://ais-dev-lal6k3zqlq7ej7axfsl5gi-252555841806.asia-southeast1.run.app");
                    }}
                    className={`px-2.5 py-1.5 rounded text-[11px] font-mono font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                      baseUrlInput.includes("-dev-")
                        ? "bg-amber-500 text-stone-950 border-amber-500"
                        : "bg-white text-stone-700 border-stone-200 hover:bg-stone-50"
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span className="truncate">{lang === "en" ? "Developer Link (-dev-)" : "ডেভেলপার লিংক (-dev-)"}</span>
                  </button>
                </div>
              </div>

              {/* Troubleshooting Guideboard for Scans */}
              <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded space-y-2.5">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <h5 className="text-[11px] font-bold text-stone-900 uppercase">
                      {lang === "en" ? "🚨 How to Fix QR Code Scan Errors (404 / 403)?" : "🚨 কিউআর স্ক্যান করলে ইরর আসার সমাধান কি?"}
                    </h5>
                    <p className="text-[10px] text-stone-600 mt-0.5 leading-relaxed font-sans">
                      {lang === "en"
                        ? "Because your workspace is in sandbox mode, secondary devices (like phone cameras) require you to take action so they can access the web interface safely."
                        : "গুগল এআই স্টুডিওর সিকিউরিটির কারণে অন্য ফোন দিয়ে কিউআর স্ক্যান করার ক্ষেত্রে নিচের ২টি নিয়ম অবশ্যই মানতে হবে:"}
                    </p>
                  </div>
                </div>

                <div className="border-t border-stone-200/50 pt-2 space-y-2 font-sans text-[10px]">
                  {/* Step 1 : Page not found fix */}
                  <div className="space-y-0.5 pl-1.5 border-l-2 border-amber-500">
                    <span className="font-bold text-stone-850 block flex items-center gap-1">
                      <span className="font-mono bg-amber-200 text-stone-900 px-1 rounded text-[9px]">১</span>
                      {lang === "en" ? "Fix: 'Page Not Found' / 404 Error" : "১. 'Page not found' বা ৪০৪ এরর সমাধান:"}
                    </span>
                    <p className="text-stone-600 pl-4">
                      {lang === "en" ? (
                        <>
                          The public Link <strong>(-pre-)</strong> remains disabled by Google until you activate it. To fix this, look at the top toolbar in your Google AI Studio editor and click on the <strong>"Share" (শেয়ার)</strong> button on the top-right, then click <strong>"Create Link" or "Publish"</strong>. This activates the public URL instantly!
                        </>
                      ) : (
                        <>
                          আপনি যদি গুগল এআই স্টুডিওর ওপরের টুলবার থেকে সাইটটি একবারও শেয়ার না করেন, তবে পাবলিক সার্ভিসটি নিষ্ক্রিয় থাকে। এটি ঠিক করতে, এডিটর উইন্ডোর একদম ওপরে ডানদিকের কোণা থেকে <strong>"Share" (শেয়ার)</strong> বোতামে ক্লিক করে <strong>"Create Link" বা পাবলিশ</strong> করুন। এতে পাবলিক লিংকটি তৎক্ষণাৎ সচল হয়ে যাবে!
                        </>
                      )}
                    </p>
                  </div>

                  {/* Step 2 : 403 Forbidden Access Restricted */}
                  <div className="space-y-0.5 pl-1.5 border-l-2 border-stone-850">
                    <span className="font-bold text-stone-850 block flex items-center gap-1">
                      <span className="font-mono bg-stone-250 text-stone-900 px-1 rounded text-[9px]">২</span>
                      {lang === "en" ? "Fix: '403 Forbidden' / Access Locked" : "২. '403 Forbidden' বা সিকিউরিটি লক সমাধান:"}
                    </span>
                    <p className="text-stone-600 pl-4">
                      {lang === "en" ? (
                        <>
                          Avoid scanning the developer <strong>(-dev-)</strong> link on a separate phone, as it is locked strictly to your account. Always use the <strong>Public Link (-pre-)</strong> (selected above) and print/scan that to ensure any device can order products smoothly!
                        </>
                      ) : (
                        <>
                          আপনার এডিটর প্যানেলের নিজস্ব <strong>-dev-</strong> লিংকটি আপনার অ্যাকাউন্টের মাধ্যমে গুগল দ্বারা রিডাইরেক্ট করে লক করা থাকে। তাই অন্য ডিভাইস বা ক্রেতাদের জন্য সবসময় ওপরে থাকা <strong>পাবলিক লিংক (-pre-)</strong> সিলেক্ট করে কিউআর বের করুন ও প্রিন্ট করুন, আপনার সকল কাস্টমার সফলভাবে প্রবেশ করতে পারবে!
                        </>
                      )}
                    </p>
                  </div>

                  {/* Visual trigger to remind user of the action */}
                  <div className="flex items-center gap-2 bg-amber-500/10 p-2 rounded border border-amber-500/20 text-stone-850 justify-between">
                    <span className="font-mono font-bold text-[9px] flex items-center gap-1 uppercase text-amber-800">
                      <Share2 className="w-3.5 h-3.5" />
                      {lang === "en" ? "Press 'Share' to go public!" : "এখনই ওপরে 'Share' এ ক্লিক করুন!"}
                    </span>
                    <span className="text-[9px] font-sans text-stone-500 italic">
                      {lang === "en" ? "Required for physical testing" : "না করা থাকলে ফোন দিয়ে চেক করা যাবে না"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Campaign analytics parameters */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-mono text-stone-650 uppercase font-bold flex items-center justify-between">
                <span>{lang === "en" ? "Scanner Origin Tag (src=)" : "মনিটরিং ট্যাগ (src=)"}</span>
                <span className="text-[9px] text-amber-600 font-normal normal-case">Tracks entry traffic in system logs</span>
              </label>
              <input
                type="text"
                placeholder="e.g. door_poster, box_sticker"
                value={utmSource}
                onChange={(e) => setUtmSource(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                className="w-full bg-white border border-stone-200 rounded px-3 py-2 text-xs font-mono font-bold text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500 uppercase"
                id="utm-source-param-input"
              />
            </div>

            {/* English Frame Texts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-mono text-stone-500 uppercase">{lang === "en" ? "English Main Poster Header" : "ইংরেজি প্রধান শিরোনাম"}</label>
                <input
                  type="text"
                  value={titleEn}
                  onChange={(e) => setTitleEn(e.target.value)}
                  className="w-full bg-white border border-stone-200 rounded px-2.5 py-1.5 text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  id="title-en-param-input"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-mono text-stone-500 uppercase">{lang === "en" ? "English Sub-instruction" : "ইংরেজি বিবরণী মেসেজ"}</label>
                <input
                  type="text"
                  value={subtitleEn}
                  onChange={(e) => setSubtitleEn(e.target.value)}
                  className="w-full bg-white border border-stone-200 rounded px-2.5 py-1.5 text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  id="sub-en-param-input"
                />
              </div>
            </div>

            {/* Bengali Frame Texts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-mono text-stone-500 uppercase">{lang === "en" ? "Bengali Main Poster Header" : "বাংলা প্রধান শিরোনাম"}</label>
                <input
                  type="text"
                  value={titleBn}
                  onChange={(e) => setTitleBn(e.target.value)}
                  className="w-full bg-white border border-stone-200 rounded px-2.5 py-1.5 text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  id="title-bn-param-input"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-mono text-stone-500 uppercase">{lang === "en" ? "Bengali Sub-instruction" : "বাংলা বিবরণী মেসেজ"}</label>
                <input
                  type="text"
                  value={subtitleBn}
                  onChange={(e) => setSubtitleBn(e.target.value)}
                  className="w-full bg-white border border-stone-200 rounded px-2.5 py-1.5 text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  id="sub-bn-param-input"
                />
              </div>
            </div>

            {/* Theme & Sizing presets */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* Theme color selectors */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono text-stone-500 uppercase flex items-center gap-1">
                  <Palette className="w-3.5 h-3.5 text-stone-400" />
                  <span>{lang === "en" ? "Sticker Color Theme" : "স্টিকার থিম কালার"}</span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => setThemeStyle("obsidian")}
                    className={`py-1.5 text-[10px] font-mono rounded border uppercase transition-all cursor-pointer font-bold ${
                      themeStyle === "obsidian" ? "bg-stone-950 text-white border-stone-950" : "bg-white text-stone-700 border-stone-250 hover:bg-stone-100"
                    }`}
                  >
                    Dark
                  </button>
                  <button
                    onClick={() => setThemeStyle("gold")}
                    className={`py-1.5 text-[10px] font-mono rounded border uppercase transition-all cursor-pointer font-bold ${
                      themeStyle === "gold" ? "bg-amber-500 text-stone-950 border-amber-500" : "bg-white text-stone-700 border-stone-250 hover:bg-stone-100"
                    }`}
                  >
                    Gold
                  </button>
                  <button
                    onClick={() => setThemeStyle("crimson")}
                    className={`py-1.5 text-[10px] font-mono rounded border uppercase transition-all cursor-pointer font-bold ${
                      themeStyle === "crimson" ? "bg-rose-900 text-white border-rose-900" : "bg-white text-stone-700 border-stone-250 hover:bg-stone-100"
                    }`}
                  >
                    Ruby
                  </button>
                  <button
                    onClick={() => setThemeStyle("clean")}
                    className={`py-1.5 text-[10px] font-mono rounded border uppercase transition-all cursor-pointer font-bold ${
                      themeStyle === "clean" ? "bg-stone-100 text-stone-950 border-stone-300" : "bg-white text-stone-700 border-stone-250 hover:bg-stone-100"
                    }`}
                  >
                    Clean
                  </button>
                </div>
              </div>

              {/* Layout size preset selectors */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono text-stone-500 uppercase flex items-center gap-1">
                  <Scaling className="w-3.5 h-3.5 text-stone-400" />
                  <span>{lang === "en" ? "Packaging Poster Size" : "পোস্টার প্রিন্ট সাইজ"}</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setLayoutPreset("badge")}
                    className={`py-1.5 text-[10px] font-mono rounded border uppercase transition-all cursor-pointer font-bold ${
                      layoutPreset === "badge" ? "bg-stone-900 text-white border-stone-900" : "bg-white text-stone-750 border-stone-250 hover:bg-stone-55"
                    }`}
                  >
                    Custom (4x4)
                  </button>
                  <button
                    onClick={() => setLayoutPreset("flyer")}
                    className={`py-1.5 text-[10px] font-mono rounded border uppercase transition-all cursor-pointer font-bold ${
                      layoutPreset === "flyer" ? "bg-stone-900 text-white border-stone-900" : "bg-white text-stone-750 border-stone-250 hover:bg-stone-55"
                    }`}
                  >
                    Poster (A4)
                  </button>
                  <button
                    onClick={() => setLayoutPreset("minimal")}
                    className={`py-1.5 text-[10px] font-mono rounded border uppercase transition-all cursor-pointer font-bold ${
                      layoutPreset === "minimal" ? "bg-stone-900 text-white border-stone-900" : "bg-white text-stone-750 border-stone-250 hover:bg-stone-55"
                    }`}
                  >
                    Compact (2x2)
                  </button>
                </div>
              </div>
            </div>

            {/* URL information block */}
            <div className="p-3 bg-stone-150/40 rounded border border-stone-200 font-mono text-[10px] space-y-1.5 text-stone-700">
              <div className="flex justify-between font-bold text-stone-900">
                <span>DESTINATION TARGET:</span>
                <span className="text-emerald-700">ACTIVE CUSTOMER DISCOVERY HUB</span>
              </div>
              <p className="break-all select-all font-semibold p-1.5 bg-white border border-stone-200 rounded text-stone-900">{finalQrUrl}</p>
            </div>

          </div>

          {/* Quick utility alerts */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-sm flex gap-3">
            <Sparkles className="w-5 h-5 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <span className="font-bold block uppercase font-mono tracking-wider mb-1">
                {lang === "en" ? "Print Instructions:" : "স্টিকার ও কিউআর প্রিন্ট করার নিয়মসমূহ:"}
              </span>
              {lang === "en" ? (
                <ul className="list-disc pl-4 space-y-1 text-[11px]">
                  <li>Print on premium glossy sticker paper or vinyl paper-rolls to avoid paper scanner reflection issues.</li>
                  <li>Our generated code leverages the high contrast ECC (Error Correction Code) generator to scan easily with poor focus, low light, or damaged labels.</li>
                  <li>Click <strong className="font-bold">"Launch Poster Printer View"</strong> on the right hand preview card to issue instant printer instructions.</li>
                </ul>
              ) : (
                <ul className="list-disc pl-4 space-y-1 text-[11px]">
                  <li>স্টিকারগুলো প্রিমিয়াম মানের গ্লসি স্টিকার পেপার অথবা ডেডিকেটেড বারকোড রোল পেপারে প্রিন্ট করলে ক্রেতাদের ফোনে স্ক্যান করতে সুবিধা হয়।</li>
                  <li>আমাদের কিউআর কোডটি ECC প্রযুক্তি সমৃদ্ধ হওয়াতে ঝাপসা আলো, বাঁকা লেবেল বা সামান্য স্ক্র্যাচ পড়ার পরেও ইনস্ট্যান্ট স্ক্যান করতে সাহায্য করবে।</li>
                  <li>ডান পাশে স্টিকার প্রিভিউয়ের নিচে থাকা <strong className="font-bold">"পোস্টার প্রিন্ট করুন"</strong> বাটনে ক্লিক করে সরাসরি প্রিন্টার সিলেক্ট করতে পারবেন।</li>
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Right column: Realistic Live sticker preview & download actions */}
        <div className="lg:col-span-5 flex flex-col items-center">
          
          <div className="w-full max-w-[360px] text-center space-y-4">
            
            <p className="text-[10px] font-mono text-stone-450 uppercase tracking-wider font-bold flex items-center justify-center gap-1">
              <Eye className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              <span>{lang === "en" ? "Interactive Sticker Look" : "স্টিকারের সরাসরি নমুনা প্রিভিউ"}</span>
            </p>

            {/* Sticker Graphic Layout */}
            <div 
              className={`w-full p-6 text-center rounded-lg shadow-md border transition-all duration-300 select-none ${
                themeStyle === "obsidian" ? "bg-stone-950 text-white border-stone-900" :
                themeStyle === "gold" ? "bg-amber-500 text-stone-950 border-amber-600 font-bold" :
                themeStyle === "crimson" ? "bg-rose-900 text-white border-rose-950" :
                "bg-white text-stone-950 border-stone-250 border-2"
              }`}
              id="qr-sticker-visual-preview-canvas"
            >
              {/* Crown Emblem */}
              <div className="text-xl leading-none mb-1 text-center animate-spin" style={{ animationDuration: '6s' }}>✦</div>
              
              {/* Dynamic Sticker Label titles */}
              <h4 className="font-display font-bold text-center uppercase tracking-wide text-sm truncate max-w-full">
                {lang === "en" ? titleEn : titleBn}
              </h4>
              <p className="text-[9px] font-mono uppercase tracking-widest text-center mt-1 mb-4 opacity-80 leading-relaxed">
                {lang === "en" ? subtitleEn : subtitleBn}
              </p>

              {/* Wrapped QR Code space */}
              <div className="bg-white p-3 rounded-md inline-block shadow-sm mx-auto mb-4 border border-stone-100">
                {qrCodeImgUrl ? (
                  <img 
                    src={qrCodeImgUrl} 
                    alt="Riemart Access QR Code" 
                    className="w-48 h-48 block mx-auto object-contain"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center bg-stone-100 text-xs text-stone-400 font-mono">
                    Generating...
                  </div>
                )}
              </div>

              {/* Scan Badge indicator */}
              <p className="text-[9.5px] font-bold tracking-wide uppercase transition-colors">
                {lang === "en" ? "✓ SCAN WITH BARCODE / CAMERA APP" : "✓ ইনস্ট্যান্ট স্ক্যান করে কুপন ও ক্যাটালগ দেখুন"}
              </p>

              {/* Bottom Web URL tagline */}
              <div className="mt-4 pt-3 border-t border-dashed border-stone-500/20 text-[9px] font-mono opacity-60 truncate">
                {finalQrUrl.replace("https://", "")}
              </div>
            </div>

            {/* Visual Action Button Block */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              {/* Print Launch Trigger */}
              <button
                onClick={handlePrint}
                className="admin-print-btn bg-stone-950 hover:bg-stone-900 text-white text-xs font-mono font-bold uppercase tracking-wider py-2.5 rounded shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-97 text-center col-span-2 md:col-span-1"
                id="launch-qr-print-job"
              >
                <Printer className="w-4 h-4 text-amber-400" />
                <span>{lang === "en" ? "Print Sticker" : "পোস্টার প্রিন্ট করুন"}</span>
              </button>

              {/* Reliable high resolution QR Image Downloader Button */}
              <button
                onClick={handleDownloadQR}
                className="bg-amber-500 hover:bg-amber-600 text-stone-950 text-xs font-mono font-bold uppercase tracking-wider py-2.5 rounded shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-97 text-center col-span-2 md:col-span-1 border border-amber-600"
                id="download-highres-raw-qr-btn"
              >
                <Download className="w-4 h-4" />
                <span>{lang === "en" ? "Download QR Code" : "কিউআর ডাউনলোড"}</span>
              </button>
            </div>

            {/* Campaign analytics notice */}
            <p className="text-[10px] text-stone-400 italic">
              {lang === "en" 
                ? "TIP: Print multiples on sticker sheet rolls, stick on delivery parcels to boost returning customer traffic!" 
                : "টিপস: প্রোডাক্ট ব্যাগ ও কাস্টমার মেমোর গায়ে স্টিকারটি সেঁটে দিন, এতে ক্রেতারা সহজেই পুনরায় আপনার সাইটে এসে অর্ডার দিতে পারবেন!"}
            </p>

          </div>

        </div>

      </div>

    </div>
  );
};
