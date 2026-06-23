import React, { useState, useMemo, useEffect } from "react";
import { Product, Category, Language } from "../types";
import { CATEGORIES, CATEGORY_TRANSLATIONS } from "../data";
import { 
  FileSpreadsheet, 
  Printer, 
  Download, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  Search, 
  Compass,
  ArrowRight
} from "lucide-react";

// Smart parser to extract measurement descriptions from name/specifications / subcategory
export function getProductMeasurement(p: Product): string {
  // If explicitly custom is stored (standard support)
  if ((p as any).measurement) {
    return (p as any).measurement;
  }
  
  // Checking specifications
  if (p.specificationsEn && p.specificationsEn.length > 0) {
    for (const spec of p.specificationsEn) {
      if (
        spec.toLowerCase().includes("weight") || 
        spec.toLowerCase().includes("volume") || 
        spec.toLowerCase().includes("size") ||
        spec.toLowerCase().includes("capacity")
      ) {
        const parts = spec.split(":");
        if (parts.length > 1) return parts[1].trim();
        return spec;
      }
    }
  }
  
  if (p.specificationsBn && p.specificationsBn.length > 0) {
    for (const spec of p.specificationsBn) {
      if (
        spec.includes("ওজন") || 
        spec.includes("পরিমাণ") || 
        spec.includes("সাইজ") ||
        spec.includes("মাত্রা")
      ) {
        const parts = spec.split(":");
        if (parts.length > 1) return parts[1].trim();
        return spec;
      }
    }
  }
  
  // Checking from English name and Bangla name (regular expression matching values like 100ml, 500g, 1kg)
  const regex = /(\d+(?:\.\d+)?\s*(?:ml|ml\.|g|gm|gms|g\.|kg|kgs|kg\.|ltr|ltrs|liter|liters|pcs|packets|গ্রাম|কেজি|লিটার|মি.লি.|পিস|এমএল))/i;
  
  const matchEn = p.nameEn ? p.nameEn.match(regex) : null;
  if (matchEn) return matchEn[1];
  
  const matchBn = p.nameBn ? p.nameBn.match(regex) : null;
  if (matchBn) return matchBn[1];

  // Try parsing from subCategory
  if (p.subCategory) {
    const matchSub = p.subCategory.match(regex);
    if (matchSub) return matchSub[1];
  }

  return "N/A";
}

interface AdminInventoryReportPanelProps {
  lang: Language;
  products: Product[];
  googleAccessToken: string | null;
  googleClientId: string;
  onGoogleSignIn: (clientId: string) => Promise<any>;
  setGoogleAccessToken: (token: string | null) => void;
  onLogAction: (type: "info" | "success" | "warning" | "security", en: string, bn: string) => void;
  onRequestPrintOpen: (category: string, subCategory: string, products: Product[]) => void;
}

export function AdminInventoryReportPanel({
  lang,
  products,
  googleAccessToken,
  googleClientId,
  onGoogleSignIn,
  setGoogleAccessToken,
  onLogAction,
  onRequestPrintOpen
}: AdminInventoryReportPanelProps) {
  const [selectedCat, setSelectedCat] = useState<string>("All");
  const [selectedSubCat, setSelectedSubCat] = useState<string>("All");
  const [searchTerm, setSearchTerm] = useState<string>("Layout-Driven");
  const [isExportingSheet, setIsExportingSheet] = useState<boolean>(false);
  const [sheetSuccessUrl, setSheetSuccessUrl] = useState<string | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);

  // Search keyword filters
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Reset selectedSubCat when selectedCat changes
  useEffect(() => {
    setSelectedSubCat("All");
  }, [selectedCat]);

  // Compute available subcategories for the selected category based on current catalog products
  const availableSubCategories = useMemo(() => {
    const subs = new Set<string>();
    products.forEach((p) => {
      if (selectedCat === "All" || p.category === selectedCat) {
        if (p.subCategory && p.subCategory.trim()) {
          subs.add(p.subCategory.trim());
        }
      }
    });
    return Array.from(subs).sort();
  }, [products, selectedCat]);

  // Memoized filter list of products based on selected dropdown category, sub-category AND search terms
  const filteredProducts = useMemo(() => {
    let result = products;
    
    // Category filter
    if (selectedCat !== "All") {
      result = result.filter((p) => p.category === selectedCat);
    }

    // Subcategory filter
    if (selectedSubCat !== "All") {
      result = result.filter((p) => p.subCategory && p.subCategory.trim() === selectedSubCat);
    }
    
    // Search keyword query
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.nameEn.toLowerCase().includes(q) ||
          p.nameBn.includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          p.id.toLowerCase().includes(q) ||
          (p.subCategory && p.subCategory.toLowerCase().includes(q))
      );
    }
    
    return result;
  }, [products, selectedCat, selectedSubCat, searchQuery]);

  // Download locally as standard structural CSV
  const handleExportCSV = () => {
    const headers = [
      "Serial No",
      "Product SKU/Code",
      "Product Name (EN)",
      "Product Name (BN)",
      "Category",
      "Sub-category",
      "Measurement",
      "Unit Price (BDT)",
      "Remaining Stock"
    ];

    const rows = filteredProducts.map((p, index) => [
      index + 1,
      p.sku || p.id,
      p.nameEn.replace(/"/g, '""'),
      p.nameBn.replace(/"/g, '""'),
      p.category,
      p.subCategory || "N/A",
      getProductMeasurement(p),
      p.price,
      p.inventory
    ]);

    // Include unicode byte-order mark (\uFEFF) for perfect Excel encoding of Bengali script characters
    const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.map(val => `"${val}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `riemart_inventory_${selectedCat.toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    onLogAction(
      "success",
      `Exported ${filteredProducts.length} items to local CSV file successfully.`,
      `সফলভাবে স্থানীয় কম্পিউটারে CSV ফাইল রূপে ${filteredProducts.length}টি পণ্য ডাউনলোড করা হয়েছে।`
    );
  };

  // Download locally as structured XLS with custom CSS styling and border layouts
  const handleExportExcel = () => {
    const fileName = `riemart_inventory_${selectedCat.toLowerCase()}_${new Date().toISOString().split('T')[0]}.xls`;
    
    let excelTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
      <meta http-equiv="content-type" content="text/html; charset=UTF-8">
      <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>RIEMART Inventory</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
      <style>
        table { border-collapse: collapse; width: 100%; font-family: 'Segoe UI', system-ui, sans-serif; }
        th { background-color: #1c1917; color: #ffffff; font-weight: bold; border: 1px solid #d6d3d1; padding: 12px 10px; font-size: 14px; text-transform: uppercase; }
        td { border: 1px solid #e7e5e4; padding: 10px 8px; font-size: 13px; color: #292524; }
        tr:nth-child(even) { background-color: #f5f5f4; }
        .header-section { margin-bottom: 25px; border-bottom: 2px solid #1c1917; padding-bottom: 12px; }
        .header-title { font-size: 22px; font-weight: 800; color: #1c1917; text-transform: uppercase; letter-spacing: 0.5px; }
        .meta-text { font-size: 12px; color: #78716c; margin-top: 4px; font-family: monospace; }
        .badge-out { color: #dc2626; font-weight: bold; background-color: #fef2f2; border-radius: 4px; padding: 2px 6px; }
        .badge-low { color: #ea580c; font-weight: bold; background-color: #fff7ed; border-radius: 4px; padding: 2px 6px; }
        .badge-good { color: #16a34a; font-weight: normal; }
      </style>
      </head>
      <body>
      <div class="header-section">
        <div class="header-title">RIEMART Bangladesh - Automated Inventory Ledger</div>
        <div class="meta-text">Selected Category Filter: ${selectedCat} | Products Rendered: ${filteredProducts.length} Items | Export Date: ${new Date().toLocaleString()}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width: 60px;">S/L (ক্র.নং)</th>
            <th style="width: 130px;">Product SKU/Code (কোড)</th>
            <th style="width: 250px;">Product Title (English)</th>
            <th style="width: 250px;">Product Title (Bangla / বাংলা)</th>
            <th style="width: 150px;">Category (শ্রেণী)</th>
            <th style="width: 150px;">Sub-category (উপ-শ্রেণী)</th>
            <th style="width: 120px;">Measurement (ওজন/সাইজ)</th>
            <th style="width: 110px;">Unit Price (মূল্য BDT)</th>
            <th style="width: 115px;">Stock Qty (মজুদ)</th>
          </tr>
        </thead>
        <tbody>
    `;

    filteredProducts.forEach((p, index) => {
      const measurement = getProductMeasurement(p);
      const stockStyle = p.inventory === 0 
        ? 'class="badge-out"' 
        : p.inventory <= 5 
          ? 'class="badge-low"' 
          : 'class="badge-good"';

      excelTemplate += `
        <tr>
          <td style="text-align: center; font-weight: bold;">${index + 1}</td>
          <td style="font-family: monospace;">${p.sku || p.id}</td>
          <td>${p.nameEn}</td>
          <td>${p.nameBn}</td>
          <td>${p.category}</td>
          <td>${p.subCategory || "N/A"}</td>
          <td style="text-align: center;">${measurement}</td>
          <td style="text-align: right; font-weight: 500;">৳ ${p.price.toLocaleString()}</td>
          <td style="text-align: center;"><span ${stockStyle}>${p.inventory}</span></td>
        </tr>
      `;
    });

    excelTemplate += `
        </tbody>
      </table>
      </body>
      </html>
    `;

    const blob = new Blob([excelTemplate], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    onLogAction(
      "success",
      `Formatted MS-Excel inventory spreadsheet generated for '${selectedCat}' with ${filteredProducts.length} items.`,
      `রঙিন মেটা-ড্যাশবোর্ড সহ সাজানো MS-Excel শিট ফরম্যাটে '${selectedCat}' ক্যাটাগরির ${filteredProducts.length}টি পণ্য সফলভাবে ডাউনলোড করা হয়েছে।`
    );
  };

  // Google Sheets integration logic
  const handleExportToGoogleSheets = async () => {
    setSheetError(null);
    setSheetSuccessUrl(null);

    // If not signed in with Google inside state, request standard sign in sequence
    if (!googleAccessToken) {
      setIsExportingSheet(true);
      try {
        const result = await onGoogleSignIn(googleClientId);
        if (!result || !result.accessToken) {
          throw new Error("Failed to receive Google access code.");
        }
        // State updates will receive the token, but we reload or use directly from result
        await createSpreadsheet(result.accessToken);
      } catch (err: any) {
        console.error("Failed to connect Google APIs:", err);
        setSheetError(lang === "en" ? "Google Sheets sign-in failed or pop-up was blocked." : "গুগল অ্যাকাউন্ট কানেক্ট সেশন ব্যর্থ হয়েছে অথবা পপ-আপ ব্লক করা হয়েছিল।");
      } finally {
        setIsExportingSheet(false);
      }
      return;
    }

    setIsExportingSheet(true);
    try {
      await createSpreadsheet(googleAccessToken);
    } catch (err: any) {
      console.error("Sheets api creation error:", err);
      // If unauthorized token, reset token state
      if (err.message?.includes("Authentication") || err.message?.includes("401")) {
        setGoogleAccessToken(null);
        sessionStorage.removeItem("riemart_gdrive_token");
        setSheetError(lang === "en" ? "Your Google session expired. Please click again to log back in." : "আপনার গুগল সেশনটি শেষ হয়ে গেছে। পুনরায় সাইন ইন করতে বাটনটিতে ক্লিক করুন।");
      } else {
        setSheetError(err.message || (lang === "en" ? "Failed to populate Google Sheets." : "গুগল স্প্রেডশিট তৈরী করতে ব্যর্থ হয়েছে।"));
      }
    } finally {
      setIsExportingSheet(false);
    }
  };

  // Dedicated helper to instantiate the spreadsheet and append rows dynamically
  const createSpreadsheet = async (token: string) => {
    const sheetTitle = `RIEMART Inventory - ${selectedCat} [${new Date().toLocaleDateString()}]`;
    
    // 1. Create Spreadsheet
    const createResponse = await fetch("https://sheets.googleapis.com/v1/spreadsheets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        properties: {
          title: sheetTitle
        },
        sheets: [
          {
            properties: {
              title: "Inventory Ledger"
            }
          }
        ]
      })
    });

    if (!createResponse.ok) {
      const errText = await createResponse.text();
      throw new Error(`Spreadsheet creation failed: ${errText}`);
    }

    const createData = await createResponse.json();
    const spreadsheetId = createData.spreadsheetId;
    const spreadsheetUrl = createData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

    // 2. Prepare spreadsheet headers and mapped collection rows
    const headers = [
      ["Serial No (ক্র.নং)", "Product Code / SKU", "Product Name (English)", "Product Name (Bangla / বাংলা)", "Category (ক্যাটাগরি)", "Sub-category (সাব-ক্যাটাগরি)", "Measurement (পরিমাপ)", "Price BDT (দাম)", "Available Stock (মজুদ স্টক)"]
    ];

    const rows = filteredProducts.map((p, index) => [
      index + 1,
      p.sku || p.id,
      p.nameEn,
      p.nameBn,
      p.category,
      p.subCategory || "N/A",
      getProductMeasurement(p),
      p.price,
      p.inventory
    ]);

    const valuesToAppend = [...headers, ...rows];

    // 3. Append values via sheets bulk collection writing
    const appendResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Inventory Ledger'!A1:append?valueInputOption=USER_ENTERED`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          values: valuesToAppend
        })
      }
    );

    if (!appendResponse.ok) {
      const errText = await appendResponse.text();
      throw new Error(`Failed to write data cells to Sheet: ${errText}`);
    }

    // Logging action in system audits safely
    onLogAction(
      "success",
      `Created Google Sheet: "${sheetTitle}" for category "${selectedCat}" containing ${filteredProducts.length} live inventory lines.`,
      `গুগল ড্রাইভে স্প্রেডশিট তৈরি করা হয়েছে: "${sheetTitle}" (${selectedCat} ক্যাটাগরির ${filteredProducts.length}টি পণ্য রয়েছে)।`
    );

    setSheetSuccessUrl(spreadsheetUrl);
  };

  return (
    <div className="bg-white border border-stone-200 rounded-sm shadow-sm space-y-6" id="admin-product-inventory-panel">
      
      {/* Dynamic Styled Banner Top */}
      <div className="bg-stone-50 border-b border-stone-200/80 p-5 rounded-t-sm flex flex-col lg:flex-row justify-between lg:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1 px-1.5 rounded bg-stone-900 text-amber-500 font-mono text-[10px] font-bold uppercase tracking-wider">
              {lang === "en" ? "Module V3" : "মডিউল ৩"}
            </span>
            <h3 className="font-display font-medium text-stone-950 uppercase tracking-wider text-base flex items-center gap-1.5">
              <FileSpreadsheet className="w-5 h-5 text-amber-500 shrink-0" />
              <span>{lang === "en" ? "Product Inventory & Export Suite" : "পণ্য ইনভেন্টরি, এক্সপোর্ট ও প্রিন্টিং সিস্টেম"}</span>
            </h3>
          </div>
          <p className="text-xs text-stone-500">
            {lang === "en" 
              ? "Filter products by category, view/print structural paper statements, export directly to local formats or generate dynamic Google Sheets." 
              : "ক্যাটাগরি অনুযায়ী পণ্য ফিল্টার করুন, প্রফেশনাল A4 শিট কাগজে প্রিন্ট করুন এবং গুগল শিট বা এক্সেল ফাইলে ইনস্ট্যান্ট লাইভ এক্সপোর্ট করুন।"}
          </p>
        </div>

        {/* Action Counters */}
        <div className="bg-white border border-stone-200 px-3.5 py-2 rounded font-mono text-stone-700 flex items-center gap-2 text-xs divide-x divide-stone-200">
          <div className="flex items-center gap-1.5 pr-2 focus-within:ring-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="font-bold text-stone-900">{products.length}</span>
            <span className="text-stone-400 text-[10px] uppercase">{lang === "en" ? "Cataloged" : "মোট পণ্য"}</span>
          </div>
          <div className="pl-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="font-bold text-emerald-700">{filteredProducts.length}</span>
            <span className="text-stone-400 text-[10px] uppercase">{lang === "en" ? "Filtered" : "ফিল্টার্ড"}</span>
          </div>
        </div>
      </div>

      {/* Control Filters Area */}
      <div className="px-5 sm:px-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-stone-50 border border-stone-200 p-4 rounded-sm">
          
          {/* 1. Category Dropdown Selector */}
          <div className="space-y-1 text-left">
            <label className="text-[10px] font-mono uppercase tracking-wider text-stone-500 font-bold block">
              {lang === "en" ? "Select Category Filter" : "ক্যাটাগরি নির্ধারণ করুন"}
            </label>
            <div className="relative">
              <select
                value={selectedCat}
                onChange={(e) => {
                  setSelectedCat(e.target.value);
                  setSheetSuccessUrl(null);
                  setSheetError(null);
                }}
                className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5 text-xs text-stone-800 outline-none focus:border-amber-500 font-medium transition-colors cursor-pointer"
                id="inventory-category-dropdown"
              >
                <option value="All">{lang === "en" ? "All Categories (সব ক্যাটাগরি)" : "সকল ক্যাটাগরি"}</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_TRANSLATIONS[cat]?.[lang] || cat} ({cat})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 1.5. Subcategory Dropdown Selector */}
          <div className="space-y-1 text-left">
            <label className="text-[10px] font-mono uppercase tracking-wider text-stone-500 font-bold block">
              {lang === "en" ? "Select Subcategory Filter" : "সাব-ক্যাটাগরি নির্ধারণ করুন"}
            </label>
            <div className="relative">
              <select
                value={selectedSubCat}
                onChange={(e) => {
                  setSelectedSubCat(e.target.value);
                  setSheetSuccessUrl(null);
                  setSheetError(null);
                }}
                className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5 text-xs text-stone-800 outline-none focus:border-amber-500 font-medium transition-colors cursor-pointer"
                id="inventory-subcategory-dropdown"
              >
                <option value="All">{lang === "en" ? "All Subcategories (সব সাব-ক্যাটাগরি)" : "সকল সাব-ক্যাটাগরি"}</option>
                {availableSubCategories.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Text Search Overlay */}
          <div className="space-y-1 text-left">
            <label className="text-[10px] font-mono uppercase tracking-wider text-stone-500 font-bold block">
              {lang === "en" ? "Search within selection" : "খুঁজুন (আইডি/নাম/ক্যাটালগ)"}
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSheetSuccessUrl(null);
                  setSheetError(null);
                }}
                placeholder={lang === "en" ? "Search by title, sku/id, specs..." : "আইডি, কোড, বা নাম দিয়ে খুঁজুন..."}
                className="w-full bg-white border border-stone-300 rounded pl-8 pr-2.5 py-1.5 text-xs text-stone-800 outline-none focus:border-amber-500 transition-colors"
                id="inventory-search-filter"
              />
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2 text-[10px] text-stone-400 hover:text-stone-700 font-mono"
                >
                  CLEAR
                </button>
              )}
            </div>
          </div>

          {/* 3. Export Action Panels (CSV, Excel) */}
          <div className="space-y-1 text-left flex flex-col justify-end">
            <div className="flex gap-2">
              <button
                onClick={handleExportExcel}
                disabled={filteredProducts.length === 0}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:scale-97 disabled:opacity-40 disabled:pointer-events-none text-white px-3 py-2 rounded text-xs font-mono font-bold flex items-center justify-center gap-1 cursor-pointer transition-all"
                title={lang === "en" ? "Export as detailed Excel" : "এক্সেল শিট রূপে ডাউনলোড করুন"}
                id="inventory-excel-export-btn"
              >
                <Download className="w-3.5 h-3.5" />
                <span>EXCEL</span>
              </button>
              <button
                onClick={handleExportCSV}
                disabled={filteredProducts.length === 0}
                className="flex-1 border border-stone-300 bg-white hover:bg-stone-50 active:scale-97 disabled:opacity-40 disabled:pointer-events-none text-stone-700 px-3 py-2 rounded text-xs font-mono font-bold flex items-center justify-center gap-1 cursor-pointer transition-all"
                title={lang === "en" ? "Export as CSV" : "সিএসভি ফাইল ডাউনলোড"}
                id="inventory-csv-export-btn"
              >
                <Download className="w-3.5 h-3.5 text-stone-500" />
                <span>CSV</span>
              </button>
            </div>
          </div>

        </div>

        {/* Global Google Sheets and Printer Actions row */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-stone-100 border border-stone-200/50 p-3.5 rounded-sm">
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Google Sheets Sync Integration Creator */}
            <button
              onClick={handleExportToGoogleSheets}
              disabled={isExportingSheet || filteredProducts.length === 0}
              className={`px-4 py-2 font-mono font-bold text-xs uppercase tracking-wider rounded transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
                googleAccessToken 
                  ? "bg-amber-600 hover:bg-amber-700 text-white" 
                  : "bg-stone-900 hover:bg-stone-800 text-amber-500 border border-stone-850"
              }`}
              id="inventory-google-sheets-sync-btn"
            >
              {isExportingSheet ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-current" />
                  <span>{lang === "en" ? "Creating Google Sheet..." : "গুগল শিট ব্রাউজ হচ্ছে..."}</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                  <span>
                    {googleAccessToken
                      ? (lang === "en" ? "Export to Google Sheet" : "গুগল শিটে এক্সপোর্ট করুন")
                      : (lang === "en" ? "Connect & Export Google Sheet" : "গুগল শিট অটোমেটেড এক্সপোর্ট")}
                  </span>
                </>
              )}
            </button>

            {/* Print Statement Button */}
            <button
              onClick={() => onRequestPrintOpen(selectedCat, selectedSubCat, filteredProducts)}
              disabled={filteredProducts.length === 0}
              className="admin-print-btn bg-stone-800 hover:bg-stone-700 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none border border-stone-700 text-stone-100 px-4 py-2 font-mono font-bold text-xs uppercase tracking-wider rounded transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              id="inventory-print-modal-trigger-btn"
            >
              <Printer className="w-4 h-4 text-amber-500" />
              <span>{lang === "en" ? "Print Ledger (A4)" : "রিপোর্ট প্রিন্ট করুন (A4)"}</span>
            </button>
          </div>

          <p className="text-[10px] text-stone-500 font-mono tracking-wide text-right">
            {lang === "en" 
              ? `Ledger contains: ${filteredProducts.length} items of ${selectedCat}${selectedSubCat !== "All" ? ` (${selectedSubCat})` : ""}` 
              : `রিপোর্টে ক্যাটাগরি '${selectedCat}'${selectedSubCat !== "All" ? ` ('${selectedSubCat}')` : ""}-এর মোট ${filteredProducts.length}টি পণ্য রয়েছে`}
          </p>

        </div>

        {/* Feedback Messages inside the View */}
        {sheetSuccessUrl && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-sm p-4 flex items-start gap-3 text-left animate-studio-reveal">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-xs text-emerald-900">
                {lang === "en" ? "✓ Automated Google Sheet Spawned Successfully!" : "✓ গুগল স্প্রেডশিট সফলভাবে সম্পন্ন হয়েছে!"}
              </p>
              <p className="text-xs text-emerald-700">
                {lang === "en" 
                  ? `The live product spreadsheet containing ${filteredProducts.length} entries of ${selectedCat} has been created on your Drive.` 
                  : `${selectedCat} ক্যাটাগরির ${filteredProducts.length}টি পণ্যের সকল বিবরণ আপনার ডেসটিনেশন গুগল ড্রাইভে সেভ করা হয়েছে।`}
              </p>
              <a
                href={sheetSuccessUrl}
                target="_blank"
                rel="referrely referrerPolicy no-referrer noreferrer"
                className="inline-flex items-center gap-1 text-xs font-mono font-black text-amber-600 hover:underline pt-1 cursor-pointer"
              >
                <span>{lang === "en" ? "OPEN EXPORTED GOOGLE SHEET" : "গুগল শিটটি ওপেন করুন"}</span>
                <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {sheetError && (
          <div className="bg-red-50 border border-red-200 rounded-sm p-4 flex items-start gap-3 text-left animate-studio-reveal">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold text-xs text-red-900">
                {lang === "en" ? "✕ Export Process Interrupted" : "✕ গুগল শিট সিনক্রোনাইজেশনে ত্রুটি"}
              </p>
              <p className="text-xs text-red-700 font-mono">{sheetError}</p>
            </div>
          </div>
        )}
      </div>

      {/* Main Grid Product List Table Preview */}
      <div className="px-5 sm:px-6 pb-6">
        <div className="border border-stone-200 rounded-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" id="admin-inventory-ledger-table">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-stone-700 font-mono text-[10px] tracking-wider uppercase">
                  <th className="py-3 px-4 text-center select-none font-bold" style={{ width: "60px" }}>S/L</th>
                  <th className="py-3 px-3 font-bold" style={{ width: "125px" }}>{lang === "en" ? "SKU / Code" : "প্রোডাক্ট কোড"}</th>
                  <th className="py-3 px-3 font-bold">{lang === "en" ? "Product Title" : "পণ্যের নাম"}</th>
                  <th className="py-3 px-3 font-bold" style={{ width: "135px" }}>{lang === "en" ? "Category" : "ক্যাটাগরি"}</th>
                  <th className="py-3 px-3 font-bold" style={{ width: "140px" }}>{lang === "en" ? "Sub-category" : "সাব-ক্যাটাগরি"}</th>
                  <th className="py-3 px-3 text-center font-bold" style={{ width: "120px" }}>{lang === "en" ? "Measurement" : "পরিমাপ"}</th>
                  <th className="py-3 px-3 text-right font-bold" style={{ width: "110px" }}>{lang === "en" ? "Price" : "মূল্য"}</th>
                  <th className="py-3 px-4 text-center font-bold" style={{ width: "100px" }}>{lang === "en" ? "Stock" : "মজুদ"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-150 text-xs">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-stone-400 font-mono">
                      {lang === "en" ? "No products found in selection" : "কোনো পণ্য খুঁজে পাওয়া যায়নি"}
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p, index) => {
                    const measurement = getProductMeasurement(p);
                    return (
                      <tr 
                        key={p.id} 
                        className={`transition-colors group ${
                          p.inventory < 5 
                            ? "bg-red-50/60 hover:bg-red-100/70" 
                            : "hover:bg-stone-50/55"
                        }`}
                      >
                        <td className="py-3 px-4 text-center font-mono font-bold text-stone-400 group-hover:text-stone-700 relative">
                          {p.inventory < 5 && (
                            <div 
                              className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" 
                              title={p.inventory === 0 ? "Out of Stock" : "Low Inventory Alert (Under 5)"}
                            />
                          )}
                          {index + 1}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-stone-800 select-all truncate text-[11px]" title={p.sku || p.id}>
                          {p.sku || p.id.substring(0, 8)}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-stone-900 leading-tight">
                            {lang === "en" ? p.nameEn : p.nameBn}
                          </div>
                          <div className="text-[10px] text-stone-400 mt-0.5 truncate max-w-xs font-mono">
                            {lang === "en" ? p.nameBn : p.nameEn}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-stone-600 font-medium">
                          {CATEGORY_TRANSLATIONS[p.category]?.[lang] || p.category}
                        </td>
                        <td className="py-3 px-3 text-stone-400 italic font-mono text-[11px]">
                          {p.subCategory || "N/A"}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-block px-1.5 py-0.5 bg-stone-100 text-stone-700 border border-stone-200 rounded font-mono text-[10px] font-medium leading-none">
                            {measurement}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-stone-900">
                          ৳ {p.price.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold">
                          <div className="flex flex-col items-center justify-center gap-1">
                            {p.inventory === 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-850 border border-red-200 rounded text-[10px] leading-none font-bold animate-pulse">
                                <AlertTriangle className="w-3 h-3 text-red-650 shrink-0" />
                                {lang === "en" ? "OUT" : "মজুদ নাই"}
                              </span>
                            ) : p.inventory < 5 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-850 border border-rose-200 rounded text-[10px] leading-none font-bold animate-pulse">
                                <AlertTriangle className="w-3 h-3 text-rose-650 shrink-0" />
                                {p.inventory} {lang === "en" ? "LOW" : "কম"}
                              </span>
                            ) : p.inventory < 10 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[10px] leading-none font-bold">
                                {p.inventory} {lang === "en" ? "WARN" : "সতর্কতা"}
                              </span>
                            ) : (
                              <span className="text-stone-700">
                                {p.inventory}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
}
