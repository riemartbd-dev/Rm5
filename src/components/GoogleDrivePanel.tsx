import React, { useState, useEffect, useRef } from "react";
import { 
  Cloud, 
  Folder, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  ExternalLink,
  Lock,
  User,
  Power,
  Settings,
  FileText,
  Clock,
  LogOut,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  FileSpreadsheet,
  Download,
  Upload,
  Search,
  Check,
  AlertTriangle,
  Map,
  MapPin,
  Image,
  FileCode,
  Notebook,
  TrendingUp,
  ChevronRight,
  Database,
  Plus,
  Send
} from "lucide-react";
import { 
  googleDriveSignIn, 
  getStoredDriveToken, 
  googleDriveSignOut,
  findOrCreateFolder, 
  uploadInvoiceToFolder, 
  listFilesInFolder,
  listImageFiles,
  GoogleDriveFile,
  getSavedClientId
} from "../utils/googleDriveHelper";
import { generateInvoicePdfBlob } from "../utils/pdfGenerator";
import { Order, Product } from "../types";

interface GoogleDrivePanelProps {
  lang: "en" | "bn";
  orders: Order[];
  setOrders?: React.Dispatch<React.SetStateAction<Order[]>>;
  products?: Product[];
  setProducts?: React.Dispatch<React.SetStateAction<Product[]>>;
  registeredUsers?: any[];
  setRegisteredUsers?: React.Dispatch<React.SetStateAction<any[]>>;
  settings: any;
  onLogAction: (type: "info" | "success" | "warning" | "security", msgEn: string, msgBn: string) => void;
  googleAccessToken?: string | null;
  setGoogleAccessToken?: (token: string | null) => void;
  googleClientId?: string;
  setGoogleClientId?: (id: string) => void;
  googleSheetId?: string;
  setGoogleSheetId?: (id: string) => void;
}

// Sub-tabs for Google Workspace section
type GoogleToolTab = "drive" | "sheets" | "docs" | "images" | "notes" | "maps";

// Sub-tabs for Main Panels
type MainHubPanel = "workspace" | "importer-exporter";

// Sub-tabs for Importer Exporter Panel
type DataTypeTab = "inventory" | "customers" | "orders";

export const GoogleDrivePanel: React.FC<GoogleDrivePanelProps> = ({
  lang,
  orders = [],
  setOrders,
  products = [],
  setProducts,
  registeredUsers = [],
  setRegisteredUsers,
  settings,
  onLogAction,
  googleAccessToken,
  setGoogleAccessToken,
  googleClientId = "",
  setGoogleClientId,
  googleSheetId = "",
  setGoogleSheetId
}) => {
  // --- STATE DECLARATIONS ---
  const [activePanel, setActivePanel] = useState<MainHubPanel>("workspace");
  const [activeTool, setActiveTool] = useState<GoogleToolTab>("drive");
  const [activeDataTab, setActiveDataTab] = useState<DataTypeTab>("inventory");

  // Google OAuth State
  const [token, setToken] = useState<string | null>(googleAccessToken || getStoredDriveToken());
  const [userEmail, setUserEmail] = useState<string | null>(() => {
    return localStorage.getItem("riemart_gdrive_email") || null;
  });
  const [folderId, setFolderId] = useState<string | null>(() => {
    return localStorage.getItem("riemart_gdrive_folder_id") || null;
  });
  const [clientIdInput, setClientIdInput] = useState<string>(googleClientId || getSavedClientId());
  const [showClientIdField, setShowClientIdField] = useState<boolean>(!clientIdInput);

  // Files & Remote directory lists
  const [driveFiles, setDriveFiles] = useState<GoogleDriveFile[]>([]);
  const [driveImages, setDriveImages] = useState<any[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [errorHeader, setErrorHeader] = useState<string | null>(null);

  // Sync operations
  const [isSyncingAllInvoices, setIsSyncingAllInvoices] = useState(false);
  const [syncProgressMsg, setSyncProgressMsg] = useState<string>("");
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(() => {
    return localStorage.getItem("riemart_gdrive_autosync") === "true";
  });

  // Google Sheets Action Progress
  const [sheetOperationStatus, setSheetOperationStatus] = useState<{
    isLoading: boolean;
    successUrl: string | null;
    error: string | null;
  }>({ isLoading: false, successUrl: null, error: null });

  // Google Docs Creation Progress
  const [docOperationStatus, setDocOperationStatus] = useState<{
    isLoading: boolean;
    successUrl: string | null;
    error: string | null;
    docTitle: string;
    docContent: string;
  }>({
    isLoading: false,
    successUrl: null,
    error: null,
    docTitle: "RIEMART Bangladesh Business Statement",
    docContent: "This document contains verified details and executive policy reports for RIEMART Bangladesh automated workspace. Created securely."
  });

  // Google Notes (Keep Style) State
  const [keepNotes, setKeepNotes] = useState<{
    title: string;
    content: string;
    color: string;
    isSaving: boolean;
    savedList: { title: string; content: string; color: string; url?: string; date: string }[];
  }>(() => {
    try {
      const saved = localStorage.getItem("riemart_saved_keep_notes");
      return {
        title: "",
        content: "",
        color: "bg-amber-50 border-amber-300 text-amber-900",
        isSaving: false,
        savedList: saved ? JSON.parse(saved) : []
      };
    } catch {
      return { title: "", content: "", color: "bg-amber-50 border-amber-300 text-amber-900", isSaving: false, savedList: [] };
    }
  });

  // Google Maps State
  const [selectedMapOrder, setSelectedMapOrder] = useState<Order | null>(orders[0] || null);

  // --- IMPORTER-EXPORTER SUITE STATES ---
  const [importDragActive, setImportDragActive] = useState(false);
  const [importFileFeedback, setImportFileFeedback] = useState<{
    fileName: string;
    totalRows: number;
    validRows: any[];
    invalidRows: any[];
    errorMsg: string | null;
    parsedObjects: any[];
  } | null>(null);
  const [importMergeMode, setImportMergeMode] = useState<"merge" | "overwrite">("merge");
  const [isImportCommitting, setIsImportCommitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state between props & local states
  useEffect(() => {
    if (googleAccessToken && googleAccessToken !== token) {
      setToken(googleAccessToken);
    }
  }, [googleAccessToken]);

  useEffect(() => {
    if (googleClientId && googleClientId !== clientIdInput) {
      setClientIdInput(googleClientId);
      setShowClientIdField(false);
    }
  }, [googleClientId]);

  // Sync orders map selector default
  useEffect(() => {
    if (orders.length > 0 && !selectedMapOrder) {
      setSelectedMapOrder(orders[0]);
    }
  }, [orders]);

  // Save Keep Notes to local storage
  useEffect(() => {
    try {
      localStorage.setItem("riemart_saved_keep_notes", JSON.stringify(keepNotes.savedList));
    } catch {}
  }, [keepNotes.savedList]);

  // Load files list / remote directory tree
  const loadDriveFiles = async (activeTok: string, activeFold: string) => {
    setIsLoadingFiles(true);
    setErrorHeader(null);
    try {
      const list = await listFilesInFolder(activeTok, activeFold);
      setDriveFiles(list);
    } catch (err: any) {
      if (err.message === "EXPIRED_TOKEN") {
        handleDisconnect();
        setErrorHeader(lang === "en" ? "Your Google Session has expired. Please sign in again." : "আপনার গুগল লগইন সেশনটি শেষ হয়ে গেছে। পুনরায় সাইন ইন করুন।");
      } else {
        setErrorHeader(err.message || String(err));
      }
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Load images list from Drive
  const loadDriveImages = async (activeTok: string) => {
    setIsLoadingImages(true);
    try {
      const list = await listImageFiles(activeTok);
      setDriveImages(list);
    } catch (err: any) {
      console.warn("Failed to fetch Google Drive image files", err);
    } finally {
      setIsLoadingImages(false);
    }
  };

  useEffect(() => {
    if (token) {
      if (folderId) {
        loadDriveFiles(token, folderId);
      }
      loadDriveImages(token);
    }
  }, [token, folderId]);

  // --- GOOGLE SIGN IN HANDLING ---
  const handleSignIn = async () => {
    if (showClientIdField && !clientIdInput) {
      setErrorHeader(lang === "en" ? "Please enter a valid Google Client ID!" : "অনুগ্রহ করে একটি সঠিক ওঅর্থ ক্লায়েন্ট আইডি লিখুন!");
      return;
    }
    setErrorHeader(null);
    setSyncProgressMsg(lang === "en" ? "Connecting securely to Google OAuth Workspace..." : "গুগল সাইন-ইন সেশন শুরু হচ্ছে...");
    try {
      const result = await googleDriveSignIn(clientIdInput);
      setToken(result.token);
      if (setGoogleAccessToken) {
        setGoogleAccessToken(result.token);
      }
      
      localStorage.setItem("riemart_gdrive_client_id", clientIdInput);
      if (setGoogleClientId) {
        setGoogleClientId(clientIdInput);
      }
      setShowClientIdField(false);

      if (result.email) {
        setUserEmail(result.email);
        localStorage.setItem("riemart_gdrive_email", result.email);
      }

      onLogAction(
        "success",
        "Google authentication completed successfully.",
        "গুগল ওয়ালেট সিকিউর সেশন সফলভাবে যুক্ত হয়েছে।"
      );

      // Resolve Folder
      setSyncProgressMsg(lang === "en" ? "Locating workspace target folders..." : "আপনার ড্রাইভে ক্যাশ মেমো ফোল্ডার খোঁজা হচ্ছে...");
      const resolvedFolderId = await findOrCreateFolder(result.token, "RIEMART_Invoices");
      setFolderId(resolvedFolderId);
      localStorage.setItem("riemart_gdrive_folder_id", resolvedFolderId);
      setSyncProgressMsg("");

      // Centralized sync both googleClientId and googleFolderId to server settings so other devices pick them up instantly!
      fetch("/api/settings/update", {
        method: "POST",
        body: JSON.stringify({
          googleClientId: clientIdInput,
          googleFolderId: resolvedFolderId
        }),
        headers: { "Content-Type": "application/json" }
      }).catch(err => console.error("Failed to sync GDrive settings to server:", err));

      onLogAction(
        "info",
        `Google Drive Target Folder 'RIEMART_Invoices' is verified and ACTIVE (ID: ${resolvedFolderId})`,
        `গুগল ড্রাইভ টার্গেট রিসিভড ডিরেক্টরি 'RIEMART_Invoices' অ্যাক্টিভেট করা হয়েছে (আইডি: ${resolvedFolderId})`
      );

      loadDriveFiles(result.token, resolvedFolderId);
      loadDriveImages(result.token);
    } catch (err: any) {
      console.error(err);
      setSyncProgressMsg("");
      if (err.message === "CLIENT_ID_REQUIRED") {
        setShowClientIdField(true);
        setErrorHeader(lang === "en" ? "Please paste your Google OAuth Client ID." : "অনুগ্রহ করে প্রথমে আপনার গুগল ওঅথ ক্লায়েন্ট আইডি পেস্ট করুন।");
      } else if (err.message === "POPUP_BLOCKED") {
        setErrorHeader(lang === "en" ? "Popups are blocked by your browser settings. Please enable them." : "আপনার ব্রাউজার পপআপ ব্লক করে রেখেছে। অনুগ্রহ করে সেটিংস থেকে রিয়ামার্ট পপআপ চালু করুন।");
      } else if (err.message === "AUTH_CANCELLED") {
        setErrorHeader(lang === "en" ? "Authentication cancelled." : "গুগল অথেন্টিকেশন বাতিল করা হয়েছে।");
      } else {
        setErrorHeader(err?.message || "Google Cloud sign-in failed.");
      }
    }
  };

  const handleDisconnect = () => {
    googleDriveSignOut();
    setToken(null);
    if (setGoogleAccessToken) {
      setGoogleAccessToken(null);
    }
    setUserEmail(null);
    setFolderId(null);
    setDriveFiles([]);
    setDriveImages([]);
    localStorage.removeItem("riemart_gdrive_email");
    localStorage.removeItem("riemart_gdrive_folder_id");
    onLogAction("info", "Disconnected your Google Workspace credentials safely.", "গুগল ইন্টিগ্রেশন সেশন সুরক্ষিতভাবে ডিসকানেক্ট করা হয়েছে।");
  };

  const toggleAutoSync = () => {
    const nextVal = !autoSyncEnabled;
    setAutoSyncEnabled(nextVal);
    localStorage.setItem("riemart_gdrive_autosync", nextVal ? "true" : "false");
    onLogAction(
      "info",
      `Dynamic background auto-sync state set to: ${nextVal ? 'ACTIVE' : 'INACTIVE'}`,
      `রিয়েল-টাইম রসিদ সিঙ্ক মডিউল পরিবর্তন করা হয়েছে: ${nextVal ? 'সচল' : 'বন্ধ'}`
    );
  };

  // Conversions helper matching core app
  const convertToBdt = (val: number) => {
    if (val >= 2000) return Math.round(val);
    return Math.round(val * 120);
  };

  // Upload Invoice PDF
  const syncSingleInvoice = async (order: Order, authTok: string, destFolder: string) => {
    const pdfBlob = generateInvoicePdfBlob(order, lang, settings);
    const fileName = `RIEMART_Invoice_${order.id}.pdf`;
    const description = `Invoice Statement for Order #${order.id} | BDT ${convertToBdt(order.totalPrice).toLocaleString()} | Generated on ${new Date(order.date).toLocaleDateString()}`;
    return await uploadInvoiceToFolder(authTok, destFolder, fileName, pdfBlob, description);
  };

  // Bulk Invoice synchronization
  const handleBulkInvoiceSync = async () => {
    if (!token || !folderId) {
      setErrorHeader(lang === "en" ? "Authenticate Google Workspace first." : "অনুগ্রহ করে প্রথমে গুগল গুগল ইন্টিগ্রেশন অ্যাক্টিভ করুন!");
      return;
    }
    setIsSyncingAllInvoices(true);
    setSyncProgressMsg("");
    setErrorHeader(null);

    let successCount = 0;
    onLogAction("info", `Initiated bulk cloud uploading for ${orders.length} billing statements...`, `বাল্ক ড্রাইভে ${orders.length}টি ক্যাশ মেমো ব্যাকলগ সিঙ্কিং শুরু করা হয়েছে...`);

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      setSyncProgressMsg(lang === "en" 
        ? `[${i + 1}/${orders.length}] Syncing Invoice for ${order.customerName} (ID: ${order.id})...`
        : `[${i + 1}/${orders.length}] কাস্টমার ${order.customerName}-এর রসিদ #${order.id} ড্রাইভে পাঠানো হচ্ছে...`
      );

      try {
        await syncSingleInvoice(order, token, folderId);
        successCount++;
        await new Promise(r => setTimeout(r, 300)); // Optimal delay to prevent API throttling
      } catch (err: any) {
        console.error("Single sync error:", err);
        if (err.message === "EXPIRED_TOKEN") {
          handleDisconnect();
          setIsSyncingAllInvoices(false);
          setErrorHeader(lang === "en" ? "Expired token. Sync stopped." : "গুগল সেশন শেষ হয়ে গেছে। বাল্ক আপলোড স্থগিত করা হয়েছে।");
          return;
        }
      }
    }

    setSyncProgressMsg("");
    setIsSyncingAllInvoices(false);
    onLogAction(
      "success",
      `Bulk Invoice Sync complete! Processed ${successCount}/${orders.length} items to your google account folder.`,
      `মেমো বাল্ক আপলোড সফলভাবে সম্পন্ন! দেশের সকল ক্যাশ মেমোর মধ্যে ${successCount}/${orders.length}টি আপনার গুগল কাস্টম ওয়ালেটে সংরক্ষিত করা হয়েছে।`
    );
    loadDriveFiles(token, folderId);
  };

  const handleManualUpload = async (order: Order) => {
    if (!token || !folderId) {
      await handleSignIn();
      return;
    }
    setErrorHeader(null);
    setSyncProgressMsg(lang === "en" ? `Processing Invoice Upload #${order.id}...` : `মেমো #${order.id} ইন্টিগ্রেট করা হচ্ছে...`);
    try {
      await syncSingleInvoice(order, token, folderId);
      onLogAction("success", `Invoice #${order.id} stored to GDrive Folder RIEMART_Invoices.`, `মেমো #${order.id} সফলভাবে ক্লাউড ড্রাইভে ড্রাফট করা হয়েছে।`);
      loadDriveFiles(token, folderId);
    } catch (err: any) {
      if (err.message === "EXPIRED_TOKEN") {
        handleDisconnect();
        setErrorHeader(lang === "en" ? "Google session expired. Please sign in again." : "আপনার গুগল লগইন সেশনটি শেষ। পুনরায় সাইন ইন করতে হবে।");
      } else {
        setErrorHeader(err.message || String(err));
      }
    } finally {
      setSyncProgressMsg("");
    }
  };

  // --- GOOGLE WORKSPACE API INTEGRATION ACTIONS (Docs, Sheets, Keep, Maps) ---

  // GOOGLE SHEETS CORE SYNCHRONIZATION FUNCTION
  const handleSheetDirectSync = async (type: DataTypeTab) => {
    if (!token) {
      setErrorHeader(lang === "en" ? "Sign in to Google first." : "অনুগ্রহ করে আগে গুগল অ্যাকাউন্ট কানেক্ট করুন।");
      return;
    }
    setSheetOperationStatus({ isLoading: true, successUrl: null, error: null });

    try {
      let title = "";
      let headers: string[][] = [];
      let rows: any[][] = [];
      let sheetName = "RIEMART Ledger";

      if (type === "inventory") {
        title = `RIEMART Live Inventory - ${new Date().toLocaleDateString()}`;
        sheetName = "Products Inventory";
        headers = [["Product ID", "Target SKU", "Product Name (EN)", "Product Name (BN)", "Category", "Subcategory", "Active Price (BDT)", "Reserve Inventory Qty", "Custom Offers Eligible"]];
        rows = products.map((p) => [
          p.id,
          p.sku || "N/A",
          p.nameEn,
          p.nameBn,
          p.category,
          p.subCategory || "N/A",
          p.price,
          p.inventory,
          p.offers ? "YES" : "NO"
        ]);
      } else if (type === "customers") {
        title = `RIEMART Customer Directory - ${new Date().toLocaleDateString()}`;
        sheetName = "Customers List";
        headers = [["Customer Name", "Registered Phone", "Client Email", "Default Delivery Address", "Nagad Account", "bKash Account", "Total Orders Completed"]];
        rows = registeredUsers.map((u) => {
          const uOrders = orders.filter(o => o.customerPhone === u.phone);
          const completed = uOrders.filter(o => o.status === "Completed").length;
          return [
            u.name,
            u.phone,
            u.email || "N/A",
            u.address || "N/A",
            u.nagad || "N/A",
            u.bkash || "N/A",
            completed
          ];
        });
      } else if (type === "orders") {
        title = `RIEMART Core Order Dashboard Ledger - ${new Date().toLocaleDateString()}`;
        sheetName = "Order Books";
        headers = [["Order ID", "Order Date/Time", "Customer Name", "Customer Phone", "Billing Address", "Ordered Items Preview", "Total Price (BDT)", "Discount Value", "Payment Gateway", "Trx ID", "Current Carriage Status"]];
        rows = orders.map((or) => {
          const itemsPreview = or.items.map(it => `${it.productNameEn || it.productNameBn} (x${it.quantity})`).join(", ");
          return [
            or.id,
            new Date(or.date).toLocaleString(),
            or.customerName,
            or.customerPhone,
            or.customerAddress,
            itemsPreview,
            convertToBdt(or.totalPrice),
            or.discountApplied || 0,
            or.paymentMethod || "COD",
            or.paymentTrxId || "N/A",
            or.status
          ];
        });
      }

      // 1. Spreadsheet creation
      const createResponse = await fetch("https://sheets.googleapis.com/v1/spreadsheets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          properties: { title },
          sheets: [{ properties: { title: sheetName } }]
        })
      });

      if (!createResponse.ok) {
        throw new Error(`Google Sheets creation responded with code: ${createResponse.status}`);
      }

      const createData = await createResponse.json();
      const spreadsheetId = createData.spreadsheetId;
      const targetUrl = createData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

      if (setGoogleSheetId) {
        setGoogleSheetId(spreadsheetId);
      }
      localStorage.setItem("riemart_google_sheet_id", spreadsheetId);

      // Append data cells
      const valuesToAppend = [...headers, ...rows];
      const appendResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${sheetName}'!A1:append?valueInputOption=USER_ENTERED`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ values: valuesToAppend })
        }
      );

      if (!appendResponse.ok) {
        throw new Error("Unable to populate cells down the target Google Sheet.");
      }

      setSheetOperationStatus({ isLoading: false, successUrl: targetUrl, error: null });
      onLogAction(
        "success",
        `Created and live synced high-speed Google Sheet: "${title}"`,
        `গুগল শিট সফলভাবে তৈরি এবং লাইভ ডাটা সিঙ্ক হয়েছে: "${title}"`
      );
    } catch (err: any) {
      console.error(err);
      setSheetOperationStatus({ isLoading: false, successUrl: null, error: err.message || "Failed syncing to sheet." });
    }
  };

  // GOOGLE DOCS CREATOR ACTIONS
  const handleDocCreateSync = async () => {
    if (!token) {
      setErrorHeader(lang === "en" ? "Access Token is missing. Sign in again." : "গুগল অথেন্টিকেশন টোকেন অনুপস্থিত। পুনরায় লগইন করুন।");
      return;
    }
    setDocOperationStatus(prev => ({ ...prev, isLoading: true, successUrl: null, error: null }));

    try {
      const createResponse = await fetch("https://docs.googleapis.com/v1/documents", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: docOperationStatus.docTitle
        })
      });

      if (!createResponse.ok) {
        throw new Error(`Google Docs API failure: status ${createResponse.status}`);
      }

      const docData = await createResponse.json();
      const documentId = docData.documentId;
      const docUrl = `https://docs.google.com/document/d/${documentId}/edit`;

      // Inline append body paragraphs text via docs write instructions
      const updateResponse = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: `${docOperationStatus.docTitle}\n=====================\n\n${docOperationStatus.docContent}\n\nGenerated secure and fast on: ${new Date().toLocaleString()}\nRIEMART Bangladesh Automated Business Core Office.\n`
              }
            }
          ]
        })
      });

      if (!updateResponse.ok) {
        console.warn("Failed to write styled text block to Document, created blank document instead.");
      }

      setDocOperationStatus(prev => ({ ...prev, isLoading: false, successUrl: docUrl, error: null }));
      onLogAction(
        "success",
        `Created styled business document "${docOperationStatus.docTitle}" inside Google Docs.`,
        `গুগল ডক ডকুমেন্ট তৈরি এবং সিঙ্ক হয়েছে: "${docOperationStatus.docTitle}"`
      );
    } catch (err: any) {
      setDocOperationStatus(prev => ({ ...prev, isLoading: false, successUrl: null, error: err.message || "Docs API error." }));
    }
  };

  // GOOGLE NOTES (KEEP WEB-STYLE SAVER TO CLOUD DRIVE)
  const handleKeepNotesCreate = async () => {
    if (!keepNotes.title || !keepNotes.content) {
      return;
    }
    setKeepNotes(prev => ({ ...prev, isSaving: true }));

    const newNote = {
      title: keepNotes.title,
      content: keepNotes.content,
      color: keepNotes.color,
      date: new Date().toLocaleString()
    };

    try {
      if (token) {
        // Sync note directly as formatted HTML/text file on Google Drive in RIEMART_Notes folder
        const gFolderId = await findOrCreateFolder(token, "RIEMART_Notes");
        const noteMime = "text/plain";
        const noteBlob = new Blob([`RIEMART KEEP STYLE NOTE\nTitle: ${newNote.title}\nDate: ${newNote.date}\nContent:\n${newNote.content}`], { type: noteMime });
        
        const uploadRes = await uploadInvoiceToFolder(token, gFolderId, `RIEMART_Note_${newNote.title.replace(/\s+/g, '_')}.txt`, noteBlob, "RIEMART Note Cloud Sync");
        
        const noteWithUrl = { ...newNote, url: uploadRes.webViewLink };
        setKeepNotes(prev => ({
          ...prev,
          title: "",
          content: "",
          isSaving: false,
          savedList: [noteWithUrl, ...prev.savedList]
        }));
        onLogAction("success", `Note synced directly to Drive folder RIEMART_Notes as file: ${newNote.title}`, `নোটটি গুগল ক্লাউড ফোল্ডার 'RIEMART_Notes' এ সেভ করা হয়েছে।`);
      } else {
        // Parse locally if not connected with token
        setKeepNotes(prev => ({
          ...prev,
          title: "",
          content: "",
          isSaving: false,
          savedList: [newNote, ...prev.savedList]
        }));
      }
    } catch (err: any) {
      console.warn("Could not upload Keep Note to Google account:", err);
      // Fallback local save anyway to prevent losing draft
      setKeepNotes(prev => ({
        ...prev,
        title: "",
        content: "",
        isSaving: false,
        savedList: [newNote, ...prev.savedList]
      }));
    }
  };

  const handleKeepNoteDelete = (index: number) => {
    setKeepNotes(prev => ({
      ...prev,
      savedList: prev.savedList.filter((_, i) => i !== index)
    }));
  };

  // --- LOCAL ULTRA-FAST EXPORT GENERATORS ---
  const handleLocalCSVExport = (type: DataTypeTab) => {
    let headers: string[] = [];
    let rows: any[][] = [];
    let fileName = "";

    if (type === "inventory") {
      headers = ["Product ID", "Target SKU", "Product Name (EN)", "Product Name (BN)", "Category", "Subcategory", "Active Price (BDT)", "Reserve Inventory Qty", "Custom Offers Eligible", "Description (EN)", "Description (BN)"];
      rows = products.map(p => [
        p.id,
        p.sku || "N/A",
        p.nameEn.replace(/"/g, '""'),
        p.nameBn.replace(/"/g, '""'),
        p.category,
        p.subCategory || "N/A",
        p.price,
        p.inventory,
        p.offers ? "YES" : "NO",
        p.descriptionEn.replace(/"/g, '""'),
        p.descriptionBn.replace(/"/g, '""')
      ]);
      fileName = `RIEMART_Products_Inventory_${new Date().toISOString().split('T')[0]}.csv`;
    } else if (type === "customers") {
      headers = ["Customer Name", "Registered Phone", "Client Email", "Default Delivery Address", "Nagad Account", "bKash Account", "Upay Account"];
      rows = registeredUsers.map(u => [
        u.name.replace(/"/g, '""'),
        u.phone,
        (u.email || "N/A").replace(/"/g, '""'),
        (u.address || "N/A").replace(/"/g, '""'),
        u.nagad || "N/A",
        u.bkash || "N/A",
        u.upay || "N/A"
      ]);
      fileName = `RIEMART_Customers_Register_${new Date().toISOString().split('T')[0]}.csv`;
    } else if (type === "orders") {
      headers = ["Order ID", "Date", "Customer Name", "Customer Phone", "Customer Address", "Order Notes", "Total Amount (BDT)", "Discount Value", "Payment Gateway", "Trx ID", "Current Carriage Status"];
      rows = orders.map(or => {
        const itemsStr = or.items.map(it => `${it.productNameEn || it.productNameBn} (x${it.quantity})`).join(", ");
        return [
          or.id,
          new Date(or.date).toLocaleString(),
          or.customerName.replace(/"/g, '""'),
          or.customerPhone,
          or.customerAddress.replace(/"/g, '""'),
          (or.orderNotes || "").replace(/"/g, '""'),
          convertToBdt(or.totalPrice),
          or.discountApplied || 0,
          or.paymentMethod || "COD",
          or.paymentTrxId || "N/A",
          or.status
        ];
      });
      fileName = `RIEMART_Orders_Bookkeeping_${new Date().toISOString().split('T')[0]}.csv`;
    }

    const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    onLogAction("success", `Ultra-fast CSV export completed for: ${type} (${rows.length} rows)`, `সুপার-ফাস্ট CSV এক্সপোর্ট সফলভাবে সম্পন্ন হয়েছে: ${type} (${rows.length}টি ডাটা লাইন)`);
  };

  const handleLocalExcelExport = (type: DataTypeTab) => {
    let title = "";
    let headers: string[] = [];
    let rows: any[][] = [];
    let fileName = "";

    if (type === "inventory") {
      title = "RIEMART Bangladesh - Live Product Inventory Statement";
      headers = ["SL No", "ID", "Target SKU / Code", "Product Title (EN)", "Product Title (BN)", "Category", "Price (BDT)", "Current Qty", "Promo Offer"];
      rows = products.map((p, index) => [
        index + 1,
        p.id,
        p.sku || "N/A",
        p.nameEn,
        p.nameBn,
        p.category,
        `৳ ${p.price.toLocaleString()}`,
        p.inventory,
        p.offers ? "YES" : "NO"
      ]);
      fileName = `RIEMART_Products_SpecSheet_${new Date().toISOString().split('T')[0]}.xls`;
    } else if (type === "customers") {
      title = "RIEMART Bangladesh - Verified Customers Registry Ledger";
      headers = ["SL No", "Profile Name", "Registered Phone Number", "Google Email Address", "Default Shipping Info", "bKash Core Wallet", "Nagad Core Wallet"];
      rows = registeredUsers.map((u, index) => [
        index + 1,
        u.name,
        u.phone,
        u.email || "N/A",
        u.address || "N/A",
        u.bkash || "N/A",
        u.nagad || "N/A"
      ]);
      fileName = `RIEMART_CustomerBase_Report_${new Date().toISOString().split('T')[0]}.xls`;
    } else if (type === "orders") {
      title = "RIEMART Bangladesh - Master Order Tracking Book";
      headers = ["SL No", "Order ID Reference", "Purchase DateTime", "Customer Client", "Contact Phone", "Ordered Items Preview", "Total Price (BDT)", "Discount Received", "Delivery Status"];
      rows = orders.map((or, index) => {
        const itemsStr = or.items.map(it => `${it.productNameEn || it.productNameBn} (x${it.quantity})`).join(", ");
        return [
          index + 1,
          or.id,
          new Date(or.date).toLocaleString(),
          or.customerName,
          or.customerPhone,
          itemsStr,
          `৳ ${convertToBdt(or.totalPrice).toLocaleString()}`,
          or.discountApplied || 0,
          or.status
        ];
      });
      fileName = `RIEMART_OrdersTrack_Record_${new Date().toISOString().split('T')[0]}.xls`;
    }

    let excelTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
      <meta http-equiv="content-type" content="text/html; charset=UTF-8">
      <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>RIEMART Ledger</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
      <style>
        table { border-collapse: collapse; width: 100%; font-family: 'Segoe UI', system-ui, sans-serif; }
        th { background-color: #1c1917; color: #ffffff; font-weight: bold; border: 1px solid #d6d3d1; padding: 12px 10px; font-size: 14px; text-transform: uppercase; }
        td { border: 1px solid #e7e5e4; padding: 10px 8px; font-size: 13px; color: #292524; }
        tr:nth-child(even) { background-color: #f5f5f4; }
        .header-section { margin-bottom: 25px; border-bottom: 2px solid #1c1917; padding-bottom: 12px; }
        .header-title { font-size: 20px; font-weight: 800; color: #1c1917; text-transform: uppercase; }
        .meta-text { font-size: 11px; color: #78716c; margin-top: 4px; font-family: monospace; }
        .status-pill { font-weight: bold; border-radius: 4px; padding: 2px 6px; text-align: center; }
      </style>
      </head>
      <body>
      <div class="header-section">
        <div class="header-title">${title}</div>
        <div class="meta-text">Export Date: ${new Date().toLocaleString()} | Total Records Mapped: ${rows.length} Items</div>
      </div>
      <table>
        <thead>
          <tr>
            ${headers.map(h => `<th style="border: 1px solid #a8a29e;">${h}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              ${row.map((val, cellIdx) => {
                const isNumeric = typeof val === "number" && cellIdx > 4;
                return `<td style="border: 1px solid #d6d3d1; text-align: ${isNumeric ? "right" : "left"};">${val}</td>`;
              }).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
      </body>
      </html>
    `;

    const blob = new Blob([excelTemplate], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    onLogAction("success", `MS-Excel stylized dashboard report generated successfully for: ${type}`, `রঙিন গ্রিড ও প্রফেশনাল হেডার ডিজাইনে ${type}-এর MS-Excel ফাইল তৈরি করা হয়েছে।`);
  };

  // --- LOCAL ULTRA-FAST CLIENT-SIDE CSV PARSING & DATA IMPORT ENGINE ---
  const handleCSVDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setImportDragActive(true);
  };

  const handleCSVDragLeave = () => {
    setImportDragActive(false);
  };

  const handleCSVDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setImportDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processCSVFile(e.dataTransfer.files[0]);
    }
  };

  const handleCSVFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processCSVFile(e.target.files[0]);
    }
  };

  // CORE CSV PARSER
  const processCSVFile = async (file: File) => {
    setErrorHeader(null);
    setImportFileFeedback(null);
    
    // Validate type
    if (!file.name.endsWith(".csv") && !file.name.endsWith(".txt")) {
      setErrorHeader(lang === "en" ? "Only CSV files are supported for high speed bulk data importing." : "শুধুমাত্র .csv বা .txt ফাইলের মাধ্যমে বাল্ক ইম্পোর্ট করা যাবে।");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const textValue = event.target?.result as string;
        if (!textValue) {
          throw new Error("Empty file content received.");
        }

        // Optimized parsing array rows splitting with escape characters support
        const parsedRows: string[][] = [];
        let currentRow: string[] = [];
        let inQuotes = false;
        let startIdx = 0;

        for (let i = 0; i < textValue.length; i++) {
          const char = textValue[i];
          const nextChar = textValue[i + 1];

          if (char === '"') {
            if (inQuotes && nextChar === '"') {
              // Escaped double quotes inside cell
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            let cell = textValue.substring(startIdx, i).trim();
            if (cell.startsWith('"') && cell.endsWith('"')) {
              cell = cell.substring(1, cell.length - 1).replace(/""/g, '"');
            }
            currentRow.push(cell);
            startIdx = i + 1;
          } else if ((char === '\n' || char === '\r') && !inQuotes) {
            let cell = textValue.substring(startIdx, i).trim();
            if (cell.startsWith('"') && cell.endsWith('"')) {
              cell = cell.substring(1, cell.length - 1).replace(/""/g, '"');
            }
            currentRow.push(cell);
            
            if (currentRow.length > 0 && currentRow.some(c => c !== "")) {
              parsedRows.push(currentRow);
            }
            currentRow = [];
            
            if (char === '\r' && nextChar === '\n') {
              i++;
            }
            startIdx = i + 1;
          }
        }
        // Handle termination row
        if (startIdx < textValue.length) {
          let cell = textValue.substring(startIdx).trim();
          if (cell.startsWith('"') && cell.endsWith('"')) {
            cell = cell.substring(1, cell.length - 1).replace(/""/g, '"');
          }
          currentRow.push(cell);
          if (currentRow.length > 0 && currentRow.some(c => c !== "")) {
            parsedRows.push(currentRow);
          }
        }

        if (parsedRows.length < 2) {
          throw new Error("CSV Import file must contain a header row and at least 1 verified data row.");
        }

        const rawHeaders = parsedRows[0].map(h => h.trim().toLowerCase());
        const dataRows = parsedRows.slice(1);

        const validRows: any[] = [];
        const invalidRows: any[] = [];
        const parsedObjects: any[] = [];

        // VALIDATION SCHEME BY DATA SECTOR
        if (activeDataTab === "inventory") {
          // Expected cols: id, nameEn, nameBn, category, price, inventory, etc.
          dataRows.forEach((row, rowIndex) => {
            const getCol = (keyParts: string[]) => {
              const matchedIdx = rawHeaders.findIndex(h => keyParts.some(p => h.includes(p)));
              return matchedIdx !== -1 ? row[matchedIdx] : "";
            };

            const id = getCol(["id", "product id", "serial"]) || `prod_${Date.now()}_${rowIndex}`;
            const nameEn = getCol(["nameen", "titleen", "english name", "name (english)"]);
            const nameBn = getCol(["namebn", "titlebn", "bangla name", "name (bangla)"]);
            const category = getCol(["category", "cat"]) || "Clothing";
            const subCategory = getCol(["subcategory", "sub-category", "subcat"]);
            const priceVal = parseFloat(getCol(["price", "unit price", "rate", "cost"])) || 0;
            const stockVal = parseInt(getCol(["inventory", "stock", "qty", "quantity", "reserve"])) || 0;
            const descEn = getCol(["descen", "descriptionen", "detailsen"]);
            const descBn = getCol(["descbn", "descriptionbn", "detailsbn"]);

            const rowObj = {
              id,
              sku: getCol(["sku", "code"]) || id,
              nameEn: nameEn || "Unnamed Product",
              nameBn: nameBn || "নামবিহীন পণ্য",
              category,
              subCategory,
              price: priceVal,
              inventory: stockVal,
              descriptionEn: descEn || "Premium quality item.",
              descriptionBn: descBn || "উন্নত মানের পণ্য সামগ্রী।",
              image: getCol(["image", "thumbnail", "img"]) || "https://images.unsplash.com/photo-1542291026-7eec264c27ff",
              offers: getCol(["offers", "promo"]).toLowerCase() === "yes"
            };

            // Basic validation
            if (!nameEn && !nameBn) {
              invalidRows.push({ row: rowIndex + 2, reason: "Product Name is blank" });
            } else if (priceVal <= 0) {
              invalidRows.push({ row: rowIndex + 2, reason: "Price must be greater than zero", partialData: rowObj });
              validRows.push(rowObj); // Soft validation allow
            } else {
              validRows.push(rowObj);
            }
            parsedObjects.push(rowObj);
          });
        } else if (activeDataTab === "customers") {
          // Expected: name, phone, email, address, bkash, nagad, upay
          dataRows.forEach((row, rowIndex) => {
            const getCol = (keyParts: string[]) => {
              const matchedIdx = rawHeaders.findIndex(h => keyParts.some(p => h.includes(p)));
              return matchedIdx !== -1 ? row[matchedIdx] : "";
            };

            const name = getCol(["name", "customer", "profile"]);
            const phone = getCol(["phone", "mobile", "contact", "number"]);
            const email = getCol(["email", "mail"]);
            const address = getCol(["address", "location", "shipping"]);

            const rowObj = {
              name: name || "Customer User",
              phone: phone || `017${Math.floor(10000000 + Math.random() * 90000000)}`,
              email,
              address,
              bkash: getCol(["bkash", "bkash phone"]),
              nagad: getCol(["nagad", "nagad phone"]),
              upay: getCol(["upay", "upay phone"]),
              verified: true
            };

            if (!phone) {
              invalidRows.push({ row: rowIndex + 2, reason: "Primary Phone Number key is missing" });
            } else {
              validRows.push(rowObj);
            }
            parsedObjects.push(rowObj);
          });
        } else if (activeDataTab === "orders") {
          // Expected: id, customerName, customerPhone, customerAddress, totalPrice, items, status
          dataRows.forEach((row, rowIndex) => {
            const getCol = (keyParts: string[]) => {
              const matchedIdx = rawHeaders.findIndex(h => keyParts.some(p => h.includes(p)));
              return matchedIdx !== -1 ? row[matchedIdx] : "";
            };

            const id = getCol(["id", "order id"]) || `OR-${Date.now()}-${rowIndex}`;
            const customerName = getCol(["name", "customer", "customer name"]);
            const customerPhone = getCol(["phone", "customer phone"]);
            const customerAddress = getCol(["address", "shipping address"]);
            const totalPrice = parseFloat(getCol(["total", "price", "amount"])) || 100;
            const status = (getCol(["status", "delivery", "stage"]) || "Pending") as any;

            const rowObj: Order = {
              id,
              customerName: customerName || "Guest Customer",
              customerPhone: customerPhone || "01700000000",
              customerAddress: customerAddress || "Dhaka, Bangladesh",
              totalPrice,
              discountApplied: parseFloat(getCol(["discount"])) || 0,
              status: ["Pending", "Processing", "Shipped", "Completed", "Cancelled"].includes(status) ? status : "Pending",
              date: getCol(["date", "time", "timestamp"]) || new Date().toISOString(),
              paymentMethod: getCol(["payment", "method"]) || "COD",
              paymentTrxId: getCol(["trx", "trxid", "trx_id"]),
              items: [
                {
                  productId: "imported",
                  productNameEn: getCol(["items", "item", "bought"]) || "Generic Product",
                  productNameBn: "কানেক্টেড প্রোডাক্ট",
                  quantity: 1,
                  priceAtPurchase: totalPrice
                }
              ]
            };

            if (!customerPhone) {
              invalidRows.push({ row: rowIndex + 2, reason: "Customer Phone number missing." });
            } else {
              validRows.push(rowObj);
            }
            parsedObjects.push(rowObj);
          });
        }

        setImportFileFeedback({
          fileName: file.name,
          totalRows: dataRows.length,
          validRows,
          invalidRows,
          errorMsg: null,
          parsedObjects
        });
      } catch (err: any) {
        setErrorHeader(err.message || "Failed parsing CSV data structure.");
      }
    };
    reader.readAsText(file);
  };

  // COMMIT/SAVE IMPORT TO DYNAMIC APP STATES
  const handleCommitImportData = async () => {
    if (!importFileFeedback || importFileFeedback.validRows.length === 0) {
      return;
    }
    setIsImportCommitting(true);

    try {
      if (activeDataTab === "inventory" && setProducts) {
        if (importMergeMode === "overwrite") {
          setProducts(importFileFeedback.validRows);
        } else {
          // Merge matching sku or id
          setProducts(prev => {
            const updated = [...prev];
            importFileFeedback.validRows.forEach((newItem) => {
              const matchIdx = updated.findIndex(p => p.id === newItem.id || (p.sku && p.sku === newItem.sku));
              if (matchIdx !== -1) {
                updated[matchIdx] = { ...updated[matchIdx], ...newItem };
              } else {
                updated.unshift(newItem);
              }
            });
            return updated;
          });
        }
        onLogAction(
          "success",
          `Super-fast imported ${importFileFeedback.validRows.length} inventory products successfully!`,
          `সুপার-ফাস্ট ইমপোর্ট ইঞ্জিনের দ্বারা ${importFileFeedback.validRows.length}টি পণ্য সফলভাবে ইনভেন্টরিতে যুক্ত হয়েছে!`
        );
      } else if (activeDataTab === "customers" && setRegisteredUsers) {
        if (importMergeMode === "overwrite") {
          setRegisteredUsers(importFileFeedback.validRows);
        } else {
          setRegisteredUsers(prev => {
            const updated = [...prev];
            importFileFeedback.validRows.forEach((newUser) => {
              const matchIdx = updated.findIndex(u => u.phone === newUser.phone);
              if (matchIdx !== -1) {
                updated[matchIdx] = { ...updated[matchIdx], ...newUser };
              } else {
                updated.push(newUser);
              }
            });
            return updated;
          });
        }
        onLogAction(
          "success",
          `Super-fast imported ${importFileFeedback.validRows.length} customer directory profiles successfully!`,
          `সুপার-ফাস্ট ইমপোর্ট ইঞ্জিনের দ্বারা ${importFileFeedback.validRows.length}জন কাস্টমার অ্যাকাউন্ট ডিরেক্টরি সফলভাবে আপডেট হয়েছে!`
        );
      } else if (activeDataTab === "orders" && setOrders) {
        if (importMergeMode === "overwrite") {
          setOrders(importFileFeedback.validRows);
        } else {
          setOrders(prev => {
            const updated = [...prev];
            importFileFeedback.validRows.forEach((newOrder) => {
              const matchIdx = updated.findIndex(o => o.id === newOrder.id);
              if (matchIdx !== -1) {
                updated[matchIdx] = { ...updated[matchIdx], ...newOrder };
              } else {
                updated.unshift(newOrder);
              }
            });
            return updated;
          });
        }
        onLogAction(
          "success",
          `Super-fast imported ${importFileFeedback.validRows.length} orders into the local tracker ledger!`,
          `সুপার-ফাস্ট ইমপোর্ট ইঞ্জিনের দ্বারা ${importFileFeedback.validRows.length}টি অর্ডার হিস্ট্রি ট্র্যাকার সিস্টেমে মার্জ করা হয়েছে!`
        );
      }

      setImportFileFeedback(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e: any) {
      setErrorHeader("Failed committing imported items to live Firestore model.");
    } finally {
      setIsImportCommitting(false);
    }
  };

  return (
    <div className="bg-white border border-stone-200 rounded-sm shadow-sm p-4 sm:p-6 space-y-6 animate-studio-reveal" id="admin-gdrive-panel-unified">
      
      {/* Dynamic Header Block */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-stone-200 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1 px-1.5 rounded bg-stone-900 text-amber-500 font-mono text-[9px] font-bold uppercase tracking-wider">
              {lang === "en" ? "GOOGLE HUB v3.1" : "গুগল হাব ৩.১"}
            </span>
            <h3 className="font-display font-medium text-stone-950 uppercase tracking-wider text-base flex justify-start items-center gap-2">
              <Cloud className="w-5.5 h-5.5 text-sky-500 shrink-0" />
              <span>{lang === "en" ? "Google Integration & Fast Import/Export Suite" : "গুগল ইন্টিগ্রেশন ও সুপার-ফাস্ট ইমপোর্ট/এক্সপোর্ট স্যুট"}</span>
            </h3>
          </div>
          <p className="text-xs text-stone-500 max-w-3xl leading-relaxed">
            {lang === "en" 
              ? "All-in-one central command. Access Google Drive, Sheets, Docs, Images, Notes, and Maps. Instantly import or export inventory, customer registries, and booking ledgers at ultra-high speed." 
              : "একক কমান্ড সেন্টারে গুগল ড্রাইভ, শিট, ডকস, ইমেজ, গুগল কিপ নোট ও ম্যাপস অ্যাক্সেস করুন। সাথে ক্যাশ মেমো, ইনভেন্টরি, কাস্টমার প্রোফাইল মিলি সেকেন্ডে ইমপোর্ট/এক্সপোর্ট করুন।"}
          </p>
        </div>

        {/* Global Connection Badge */}
        <div className="flex items-center gap-2 font-mono text-[11px]">
          {token ? (
            <div className="bg-emerald-50 border border-emerald-250 text-emerald-700 px-3 py-1.5 rounded-sm capitalize font-bold flex items-center gap-1.5 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              {lang === "en" ? `Connected: ${userEmail || "Google User"}` : `লিঙ্কড: ${userEmail || "গুগল ইউজার"}`}
            </div>
          ) : (
            <div className="bg-stone-100 border border-stone-250 text-stone-600 px-3 py-1.5 rounded-sm capitalize font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
              {lang === "en" ? "Cloud Standby" : "ক্লাউড স্ট্যান্ডবাই"}
            </div>
          )}
        </div>
      </div>

      {/* Primary Workspace Selection Hub Nav Bars */}
      <div className="flex border-b border-stone-200" id="primary-hub-tabs-row">
        <button
          onClick={() => setActivePanel("workspace")}
          className={`px-5 py-3 text-xs font-mono font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activePanel === "workspace"
              ? "border-amber-500 text-stone-900 bg-stone-50"
              : "border-transparent text-stone-450 hover:text-stone-900 hover:bg-stone-50/50"
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-500" />
          {lang === "en" ? "Google G-Suite Workspace" : "গুগল ক্লাউড টুলস"}
        </button>
        <button
          onClick={() => setActivePanel("importer-exporter")}
          className={`px-5 py-3 text-xs font-mono font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activePanel === "importer-exporter"
              ? "border-amber-500 text-stone-900 bg-stone-50"
              : "border-transparent text-stone-450 hover:text-stone-900 hover:bg-stone-50/50"
          }`}
        >
          <Database className="w-4 h-4 text-emerald-500" />
          {lang === "en" ? "Ultra-Fast Import/Export Hub" : "সুপার-ফাস্ট ডেটা ইমপোর্ট/এক্সপোর্ট"}
        </button>
      </div>

      {errorHeader && (
        <div className="bg-red-50 border border-red-200 p-3.5 rounded text-[11.5px] font-sans text-red-650 flex items-start gap-2 animate-studio-reveal">
          <AlertCircle className="w-4.5 h-4.5 text-red-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong className="font-bold block uppercase tracking-wide">Operation Blocked / Notification</strong>
            <span className="break-all">{errorHeader}</span>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* PANEL 1: GOOGLE INTEGRATED G-SUITE WORKSPACE PANEL */}
      {/* ========================================================== */}
      {activePanel === "workspace" && (
        <div className="space-y-6" id="workspace-sub-viewport">
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-2" id="gsuite-icon-tab-nav">
            
            <button
              onClick={() => setActiveTool("drive")}
              className={`p-3 rounded-sm border text-left font-mono text-xs flex flex-col justify-between transition-all cursor-pointer ${
                activeTool === "drive"
                  ? "bg-stone-950 text-white border-stone-950 shadow-md scale-98"
                  : "bg-stone-50 hover:bg-stone-100/80 border-stone-200 text-stone-700"
              }`}
            >
              <Folder className="w-5 h-5 text-amber-500 mb-1" />
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-400 block tracking-tight">Cloud Drive</span>
                <strong>Google Drive</strong>
              </div>
            </button>

            <button
              onClick={() => setActiveTool("sheets")}
              className={`p-3 rounded-sm border text-left font-mono text-xs flex flex-col justify-between transition-all cursor-pointer ${
                activeTool === "sheets"
                  ? "bg-stone-950 text-white border-stone-950 shadow-md scale-98"
                  : "bg-stone-50 hover:bg-stone-100/80 border-stone-200 text-stone-700"
              }`}
            >
              <FileSpreadsheet className="w-5 h-5 text-emerald-500 mb-1" />
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-400 block tracking-tight">Spreadsheets</span>
                <strong>Google Sheets</strong>
              </div>
            </button>

            <button
              onClick={() => setActiveTool("docs")}
              className={`p-3 rounded-sm border text-left font-mono text-xs flex flex-col justify-between transition-all cursor-pointer ${
                activeTool === "docs"
                  ? "bg-stone-950 text-white border-stone-950 shadow-md scale-98"
                  : "bg-stone-50 hover:bg-stone-100/80 border-stone-200 text-stone-700"
              }`}
            >
              <FileText className="w-5 h-5 text-blue-500 mb-1" />
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-400 block tracking-tight">Documents</span>
                <strong>Google Docs</strong>
              </div>
            </button>

            <button
              onClick={() => setActiveTool("images")}
              className={`p-3 rounded-sm border text-left font-mono text-xs flex flex-col justify-between transition-all cursor-pointer ${
                activeTool === "images"
                  ? "bg-stone-950 text-white border-stone-950 shadow-md scale-98"
                  : "bg-stone-50 hover:bg-stone-100/80 border-stone-200 text-stone-700"
              }`}
            >
              <Image className="w-5 h-5 text-purple-500 mb-1" />
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-400 block tracking-tight">Cloud Assets</span>
                <strong>Google Images</strong>
              </div>
            </button>

            <button
              onClick={() => setActiveTool("notes")}
              className={`p-3 rounded-sm border text-left font-mono text-xs flex flex-col justify-between transition-all cursor-pointer ${
                activeTool === "notes"
                  ? "bg-stone-950 text-white border-stone-950 shadow-md scale-98"
                  : "bg-stone-50 hover:bg-stone-100/80 border-stone-200 text-stone-700"
              }`}
            >
              <Notebook className="w-5 h-5 text-yellow-500 mb-1" />
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-400 block tracking-tight">Keep Ledger</span>
                <strong>Google Notes</strong>
              </div>
            </button>

            <button
              onClick={() => setActiveTool("maps")}
              className={`p-3 rounded-sm border text-left font-mono text-xs flex flex-col justify-between transition-all cursor-pointer ${
                activeTool === "maps"
                  ? "bg-stone-950 text-white border-stone-950 shadow-md scale-98"
                  : "bg-stone-50 hover:bg-stone-100/80 border-stone-200 text-stone-700"
              }`}
            >
              <Map className="w-5 h-5 text-emerald-600 mb-1" />
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-400 block tracking-tight">Logistics Map</span>
                <strong>Google Maps</strong>
              </div>
            </button>

          </div>

          {/* Secure Setup Console Bar (Renders if not authenticated) */}
          {!token && (
            <div className="bg-stone-950 text-stone-100 p-5 rounded border border-stone-850 space-y-4 shadow-xl">
              <div className="flex border-b border-stone-850 pb-3 flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-500 animate-pulse" />
                  <span className="text-xs uppercase tracking-wider font-mono font-bold text-stone-300">
                    {lang === "en" ? "Secure Google Credentials Authentication" : "গুগল ক্রিপ্টোগ্রাফিক ওঅথ অথেন্টিকেশন"}
                  </span>
                </div>
                {getSavedClientId() && (
                  <button
                    onClick={() => setShowClientIdField(!showClientIdField)}
                    className="text-[10px] font-mono text-stone-400 hover:text-amber-400 underline cursor-pointer"
                  >
                    {showClientIdField ? (lang === "en" ? "Hide Keys Panel" : "সেটিংস লুকান") : (lang === "en" ? "Change Google OAuth settings" : "ওঅথ সেটিংস পরিবর্তন করুন")}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
                <div className="md:col-span-2 space-y-4">
                  <p className="text-stone-300 leading-relaxed font-sans">
                    {lang === "en" 
                      ? "To connect Google Workspace cloud utilities directly from AI Studio sandbox, please supply a free Google API OAuth client ID. This will connect GDrive panel securely." 
                      : "নিরাপত্তা পলিসি এবং স্যান্ডবক্স পরিবেশের জন্য একটি ১ মিনিটের ফ্রি ক্লায়েন্ট আইডি নিয়ে পেস্ট করুন। এর ফলে গুগল ড্রাইভ, শিট, ডকস, ইমেজ ও ড্রাইভ ফাইল সরাসরি এক্সেস পাওয়া যাবে।"}
                  </p>

                  {showClientIdField && (
                    <div className="space-y-3 bg-stone-900/60 p-4 border border-stone-850 rounded">
                      <div>
                        <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-amber-500 mb-1">
                          {lang === "en" ? "OAuth Client ID From Google Cloud Console:" : "গুগল ক্লাউড ওঅথ ক্লায়েন্ট আইডি:"}
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 102555-abc123yz.apps.googleusercontent.com"
                          value={clientIdInput}
                          onChange={(e) => setClientIdInput(e.target.value.trim())}
                          className="w-full bg-stone-950 border border-stone-800 rounded px-3 py-2 text-xs font-mono text-stone-100 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div className="text-[10px] font-mono leading-relaxed text-stone-400">
                        {lang === "en" ? "Configure your OAuth client with Authorized Redirect URI: " : "আপনার ক্লায়েন্ট আইডিতে রিডাইরেক্ট ইউআরআই দিন: "}
                        <code className="bg-stone-950 text-emerald-400 px-1 rounded block mt-1 py-1 break-all select-all font-mono">{window.location.origin + window.location.pathname}</code>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-stone-900 p-4 border border-stone-850 rounded flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-500 block mb-2">⚡ Status Dashboard</span>
                    <ul className="space-y-1.5 font-mono text-[10px] text-stone-300">
                      <li className="flex items-center gap-1.5">❌ Drive Directory: Offline</li>
                      <li className="flex items-center gap-1.5">❌ Spreadsheets Sync: Offline</li>
                      <li className="flex items-center gap-1.5">❌ Keep Notes: Local only</li>
                      <li className="flex items-center gap-1.5">❌ Docs Compiler: Offline</li>
                    </ul>
                  </div>

                  <button
                    onClick={handleSignIn}
                    className="mt-4 bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-stone-950 font-mono text-xs font-black py-2.5 px-4 rounded shadow transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
                  >
                    <Cloud className="w-4 h-4 text-stone-950 animate-pulse" />
                    {lang === "en" ? "Sign In With Google" : "গুগল অ্যাকাউন্ট কানেক্ট করুন"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* DYNAMIC VIEWPORTS FOR INDIVIDUAL CHOSEN GOOGLE TOOLS */}
          {token && (
            <div className="border border-stone-200 rounded p-4 sm:p-5 bg-stone-50/50 space-y-6" id="gsuite-active-tool-workspace">
              
              {/* === TABS 1: GOOGLE DRIVE === */}
              {activeTool === "drive" && (
                <div className="space-y-6 animate-studio-reveal">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 bg-white border border-stone-200 p-5 rounded shadow-xs space-y-4">
                      <div className="flex justify-between items-center border-b border-stone-100 pb-3">
                        <div className="flex items-center gap-2">
                          <Folder className="w-5 h-5 text-amber-500" />
                          <h4 className="text-xs font-mono font-bold text-stone-900 uppercase tracking-wider">
                            {lang === "en" ? "Designated Invoices Cloud Folder" : "ডিজিটাল ক্যাশ মেমো ফোল্ডার"}
                          </h4>
                        </div>
                        <span className="text-[10px] bg-stone-100 text-stone-500 px-2 py-0.5 rounded font-mono">RIEMART_Invoices</span>
                      </div>

                      <div className="text-xs text-stone-550 leading-relaxed font-sans space-y-3">
                        <p>
                          {lang === "en"
                            ? "All billing invoices generated by our checkout counter can be immediately compiled to vector PDF matrices and sent to your cloud Drive storage directory as unalterable legal drafts."
                            : "ব্যবসায়ের প্রতিটি ক্যাশ মেমো হাই-স্পিড পিডিএফ ডিক্রিপ্টেড ফরম্যাটে সরাসরি আপনার ব্যক্তিগত গুগল ড্রাইভে সেভ হবে। এর ফলে কাগজের অপচয় রোধ হবে এবং বুককিপিং হবে সহজ।"}
                        </p>

                        <div className="bg-stone-50 p-3 rounded-sm border flex items-center justify-between gap-4">
                          <div>
                            <strong className="font-bold text-stone-800 block">
                              {lang === "en" ? "Background Real-time Auto Upload" : "রিয়েল-টাইম ব্যকগ্রাউন্ড অটো-আপলোড"}
                            </strong>
                            <span className="text-[10.5px] text-stone-400 text-left block">
                              {lang === "en" ? "Automatically saves PDF to Drive as soon as checkout completes." : "গ্রাহক অর্ডার কনফার্ম করার সাথে সাথেই অটোমেটিক ব্যাকগ্রাউন্ডে পিডিএফ আপলোড হবে।"}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={toggleAutoSync}
                            className="cursor-pointer shrink-0"
                          >
                            {autoSyncEnabled ? (
                              <ToggleRight className="w-10 h-10 text-emerald-500" />
                            ) : (
                              <ToggleLeft className="w-10 h-10 text-stone-300" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={handleBulkInvoiceSync}
                          disabled={isSyncingAllInvoices}
                          className="flex-1 bg-stone-900 hover:bg-stone-850 disabled:opacity-50 text-white font-mono text-xs font-bold py-2.5 px-4 rounded border border-stone-800 transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 text-amber-500 ${isSyncingAllInvoices ? "animate-spin" : ""}`} />
                          {isSyncingAllInvoices ? (lang === "en" ? "Syncing Bulk Invoices..." : "বাল্ক আপলোড হচ্ছে...") : (lang === "en" ? "Sync Backlog of Memos" : "বকেয়া সব মেমো বাল্ক আপলোড")}
                        </button>
                      </div>
                    </div>

                    {/* Drive stats queue */}
                    <div className="bg-stone-950 text-stone-300 p-5 rounded border border-stone-850 flex flex-col justify-between space-y-4">
                      <div>
                        <div className="border-b border-stone-850 pb-2 mb-3.5 flex items-center justify-between">
                          <span className="text-[10px] font-mono text-stone-400 uppercase tracking-widest font-bold font-mono">Sync Controller</span>
                          <span className="bg-emerald-600 font-mono text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">Verified</span>
                        </div>
                        
                        <div className="space-y-3 font-mono text-xs leading-normal">
                          <div className="bg-stone-90 transition-all p-2.5 rounded border border-stone-850">
                            <span className="text-[9px] text-stone-500 block uppercase font-bold">Target Synced Files</span>
                            <span className="text-stone-100 font-bold block">{driveFiles.length} Invoices</span>
                          </div>

                          <div className="bg-stone-90 transition-all p-2.5 rounded border border-stone-850">
                            <span className="text-[9px] text-stone-500 block uppercase font-bold">Active User Connected</span>
                            <span className="text-stone-100 font-bold block truncate">{userEmail || "Google User"}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={handleDisconnect}
                        className="w-full bg-stone-900 border border-stone-800 text-stone-400 hover:text-red-400 font-mono text-[10px] font-bold py-2 px-3 rounded uppercase transition-colors cursor-pointer"
                      >
                        Disconnect integration
                      </button>
                    </div>
                  </div>

                  {/* Remote File Feed */}
                  <div className="bg-white border border-stone-200 p-5 rounded shadow-xs space-y-3">
                    <div className="flex justify-between items-center border-b pb-2.5 border-stone-100">
                      <div className="flex items-center gap-1.5">
                        <Folder className="w-4 h-4 text-amber-500" />
                        <h4 className="text-xs font-mono font-bold text-stone-800 uppercase tracking-wider">
                          {lang === "en" ? "Google Drive Directory File Tree" : "ড্রাইভে রক্ষিত ক্যাশ মেমোসমূহ"}
                        </h4>
                      </div>
                      <button
                        onClick={() => loadDriveFiles(token, folderId || "")}
                        disabled={isLoadingFiles}
                        className="text-stone-500 hover:text-stone-900 disabled:opacity-55 transition-colors cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFiles ? "animate-spin" : ""}`} />
                      </button>
                    </div>

                    {isLoadingFiles ? (
                      <div className="py-6 text-center text-xs font-mono text-stone-400 flex items-center justify-center gap-1.5 animate-pulse">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-500" />
                        <span>Fetching cloud documents folder tree...</span>
                      </div>
                    ) : driveFiles.length === 0 ? (
                      <div className="py-6 border-2 border-dashed rounded text-center text-stone-400 font-mono text-[11px] bg-stone-50">
                        No invoice files found on Drive. Click backlog sync to begin.
                      </div>
                    ) : (
                      <div className="max-h-60 overflow-y-auto border border-stone-200 rounded">
                        <table className="w-full font-mono text-[11px] text-stone-700 text-left border-collapse">
                          <thead>
                            <tr className="bg-stone-50 border-b border-stone-250 text-stone-600 font-bold">
                              <th className="p-2 sm:p-2.5">File Name</th>
                              <th className="p-2 sm:p-2.5 hidden sm:table-cell">Uploaded Date</th>
                              <th className="p-2 sm:p-2.5 text-right w-16">Link</th>
                            </tr>
                          </thead>
                          <tbody>
                            {driveFiles.map((f) => (
                              <tr key={f.id} className="border-b border-stone-100 hover:bg-stone-50/40">
                                <td className="p-2 sm:p-2.5 font-sans font-medium text-stone-900 truncate max-w-xs">{f.name}</td>
                                <td className="p-2 sm:p-2.5 text-stone-400 text-[10px] hidden sm:table-cell">
                                  {f.createdTime ? new Date(f.createdTime).toLocaleString() : "N/A"}
                                </td>
                                <td className="p-2 sm:p-2.5 text-right">
                                  <a
                                    href={f.webViewLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] uppercase font-bold font-mono text-sky-600 border border-sky-100 bg-sky-50 py-0.5 px-2 rounded hover:bg-sky-100"
                                  >
                                    <span>Open</span>
                                    <ExternalLink className="w-2.5 h-2.5 text-sky-650" />
                                  </a>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* === TABS 2: GOOGLE SHEETS === */}
              {activeTool === "sheets" && (
                <div className="space-y-5 animate-studio-reveal">
                  <div className="bg-white border border-stone-200 p-5 rounded shadow-xs space-y-4">
                    <div className="border-b pb-3 flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                      <h4 className="text-xs font-mono font-bold text-stone-900 uppercase tracking-wider">
                        Google Sheets Database Sync Engine
                      </h4>
                    </div>

                    <p className="text-xs text-stone-550 leading-relaxed font-sans">
                      With secure OAuth Sheets credential scope activated, you can immediately compile, format, and push any live dataset directly to dynamic Google Sheet online workbooks in 1 millisecond. No raw file downloading necessary.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs text-stone-700">
                      
                      <div className="border border-stone-200 rounded p-4 flex flex-col justify-between bg-stone-50">
                        <div className="space-y-1.5">
                          <strong className="text-stone-900 block font-bold uppercase">Products Inventory</strong>
                          <span className="text-[10.5px] text-stone-400 block leading-tight">Live synced specifications ledger containing SKU, base price, categories, and reserve stocks.</span>
                        </div>
                        <button
                          onClick={() => handleSheetDirectSync("inventory")}
                          disabled={sheetOperationStatus.isLoading}
                          className="mt-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-[11px] font-bold py-1.5 px-3 rounded uppercase pointer-events-auto"
                        >
                          {sheetOperationStatus.isLoading ? "Exporting..." : "Sync Sheet"}
                        </button>
                      </div>

                      <div className="border border-stone-200 rounded p-4 flex flex-col justify-between bg-stone-50">
                        <div className="space-y-1.5">
                          <strong className="text-stone-900 block font-bold uppercase">Customers Directory</strong>
                          <span className="text-[10.5px] text-stone-400 block leading-tight">Syncs registered clients profile databases with verified contact numbers, shipping addresses, and wallet logs.</span>
                        </div>
                        <button
                          onClick={() => handleSheetDirectSync("customers")}
                          disabled={sheetOperationStatus.isLoading}
                          className="mt-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-[11px] font-bold py-1.5 px-3 rounded uppercase"
                        >
                          {sheetOperationStatus.isLoading ? "Exporting..." : "Sync Sheet"}
                        </button>
                      </div>

                      <div className="border border-stone-200 rounded p-4 flex flex-col justify-between bg-stone-50">
                        <div className="space-y-1.5">
                          <strong className="text-stone-900 block font-bold uppercase">Orders Ledger</strong>
                          <span className="text-[10.5px] text-stone-400 block leading-tight">Export the checkout bookkeeping logs. Columns include date, Customer, discount applied, prices, TrxID, status codes.</span>
                        </div>
                        <button
                          onClick={() => handleSheetDirectSync("orders")}
                          disabled={sheetOperationStatus.isLoading}
                          className="mt-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-[11px] font-bold py-1.5 px-3 rounded uppercase"
                        >
                          {sheetOperationStatus.isLoading ? "Exporting..." : "Sync Sheet"}
                        </button>
                      </div>

                    </div>

                    {sheetOperationStatus.isLoading && (
                      <div className="py-2.5 text-center text-xs text-sky-600 animate-pulse font-mono font-bold flex items-center justify-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-current" />
                        <span>Compiling formulas, styling cells & writing Google Spreadsheet datasets...</span>
                      </div>
                    )}

                    {sheetOperationStatus.successUrl && (
                      <div className="bg-emerald-50 border border-emerald-200 p-3 rounded text-[11px] font-mono flex items-center justify-between gap-4">
                        <span className="text-emerald-800 font-bold flex items-center gap-1">
                          <CheckCircle className="w-4 h-4 text-emerald-500 fill-white" />
                          <span>Google Sheet published successfully!</span>
                        </span>
                        <a
                          href={sheetOperationStatus.successUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1 px-3 rounded text-[10px] uppercase flex items-center gap-1"
                        >
                          <span>Open Sheet</span>
                          <ExternalLink className="w-3 h-3 text-white" />
                        </a>
                      </div>
                    )}

                    {sheetOperationStatus.error && (
                      <div className="bg-red-50 border border-red-200 p-3 rounded text-[11.5px] font-mono text-red-655 uppercase font-bold text-center">
                        Error Populating Sheets: {sheetOperationStatus.error}
                      </div>
                    )}

                  </div>
                </div>
              )}

              {/* === TABS 3: GOOGLE DOCS === */}
              {activeTool === "docs" && (
                <div className="space-y-5 animate-studio-reveal">
                  <div className="bg-white border p-5 rounded border-stone-200 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
                    
                    <div className="md:col-span-2 space-y-4">
                      <div className="border-b pb-2.5 flex items-center gap-1.5">
                        <FileText className="w-5 h-5 text-blue-500" />
                        <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                          Google Documents Compiler Suite
                        </h4>
                      </div>

                      <p className="text-xs text-stone-500 leading-relaxed font-sans">
                        Design, compose, and serialize formal executive summaries, terms of carriage, corporate policies or checkout transcripts directly to high-fidelity Google Docs. Perfect for business bookkeeping alignment.
                      </p>

                      <div className="space-y-3 pt-1">
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-stone-500 tracking-wider mb-1">Document Title</label>
                          <input
                            type="text"
                            value={docOperationStatus.docTitle}
                            onChange={(e) => setDocOperationStatus(prev => ({ ...prev, docTitle: e.target.value }))}
                            className="w-full border rounded px-3 py-2 bg-stone-50 focus:outline-none focus:border-amber-500 font-sans"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-stone-500 tracking-wider mb-1">Body Text Content</label>
                          <textarea
                            rows={4}
                            value={docOperationStatus.docContent}
                            onChange={(e) => setDocOperationStatus(prev => ({ ...prev, docContent: e.target.value }))}
                            className="w-full border rounded px-3 py-2 bg-stone-50 focus:outline-none focus:border-amber-500 font-sans"
                          />
                        </div>
                      </div>

                      <button
                        onClick={handleDocCreateSync}
                        disabled={docOperationStatus.isLoading}
                        className="bg-blue-600 hover:bg-blue-700 active:scale-98 disabled:opacity-50 text-white font-bold tracking-wider py-2 px-4 rounded uppercase text-xs cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
                      >
                        <Send className="w-3.5 h-3.5 text-white" />
                        <span>{docOperationStatus.isLoading ? "Publishing Doc..." : "Compile & Save to Google Docs"}</span>
                      </button>
                    </div>

                    <div className="bg-stone-50 p-4 border border-stone-200 rounded flex flex-col justify-between">
                      <div className="space-y-3">
                        <span className="text-[10px] font-bold text-stone-550 uppercase tracking-wide block">💡 Document Ideas</span>
                        <ul className="space-y-2 text-[10.5px] leading-relaxed text-stone-600 list-disc pl-3">
                          <li>Create official Refund Policy document drafts.</li>
                          <li>Save active bKash payment rules.</li>
                          <li>Generate bulk PDF invoices transcript list.</li>
                          <li>Export terms of service directly into editable Google Docs sheets.</li>
                        </ul>
                      </div>

                      {docOperationStatus.successUrl && (
                        <div className="mt-4 p-2.5 bg-emerald-50 border border-emerald-250 rounded text-center">
                          <a
                            href={docOperationStatus.successUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-700 underline font-bold border-b border-dashed border-emerald-500 text-[10px] uppercase inline-flex items-center gap-1 hover:text-emerald-800"
                          >
                            <span>Open Google Doc</span>
                            <ExternalLink className="w-3 h-3 text-emerald-700" />
                          </a>
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              )}

              {/* === TABS 4: GOOGLE IMAGES === */}
              {activeTool === "images" && (
                <div className="space-y-4 animate-studio-reveal">
                  <div className="bg-white border p-5 rounded border-stone-200 shadow-xs space-y-4 font-mono text-xs">
                    <div className="border-b pb-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Image className="w-4.5 h-4.5 text-purple-500" />
                        <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                          Google Drive Image Assets Explorer
                        </h4>
                      </div>
                      <span className="text-[9px] uppercase font-bold text-stone-400 bg-stone-50 px-2 py-0.5 rounded">High-Speed API CDN</span>
                    </div>

                    <p className="text-xs text-stone-500 leading-relaxed font-sans">
                      Browse image files stored securely in your private Google Drive space. Copied links are parsed through high-speed Google User-content global CDNs (`lh3.googleusercontent.com`) for ultra-fast, worldwide website rendering.
                    </p>

                    {isLoadingImages ? (
                      <div className="py-12 text-center text-stone-400 text-xs animate-pulse flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-purple-500" />
                        <span>Searching Google Drive for image-type assets (thumbnail grids)...</span>
                      </div>
                    ) : driveImages.length === 0 ? (
                      <div className="py-12 border-2 border-dashed rounded text-center text-stone-400 font-mono leading-relaxed bg-stone-50">
                        No image files (.jpg, .png, etc.) found in your Drive space.
                        <p className="text-[9.5px] mt-1 text-stone-400">Upload images to your Google account or drive folder and click refresh.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
                        {driveImages.map((img) => (
                          <div key={img.id} className="border border-stone-200 rounded p-2 bg-stone-50 hover:shadow-md transition-all flex flex-col justify-between space-y-2">
                            {img.thumbnailLink ? (
                              <img
                                src={img.thumbnailLink.replace(/=s\d+$/, "=s220")}
                                alt={img.name}
                                className="w-full h-24 object-cover rounded border border-stone-200"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="h-24 bg-stone-200 rounded flex items-center justify-center font-sans text-stone-400 text-xs">Image File</div>
                            )}
                            <div className="text-[10px] leading-tight font-sans text-stone-700 font-medium truncate" title={img.name}>
                              {img.name}
                            </div>
                            <button
                              onClick={() => {
                                const directLink = `https://lh3.googleusercontent.com/d/${img.id}`;
                                navigator.clipboard.writeText(directLink);
                                onLogAction("success", "Copied direct CDN raw image link to clipboard!", "গুগল সিডিএন ডিরেক্ট ইমেজ লিংক কপি করা হয়েছে!");
                              }}
                              className="w-full bg-stone-900 border border-stone-850 hover:bg-stone-850 active:scale-97 text-[9px] font-mono text-white tracking-widest uppercase py-1 rounded cursor-pointer transition-all"
                            >
                              Copy Link
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* === TABS 5: GOOGLE NOTES === */}
              {activeTool === "notes" && (
                <div className="space-y-5 animate-studio-reveal">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
                    
                    {/* Create Node Box */}
                    <div className="bg-white border p-5 rounded border-stone-200 shadow-xs space-y-4">
                      <div className="border-b pb-2 flex items-center gap-1.5">
                        <Notebook className="w-4.5 h-4.5 text-yellow-500" />
                        <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                          Google Keep-Style Notes Workspace
                        </h4>
                      </div>

                      <div className="space-y-3 font-sans">
                        <div>
                          <label className="block text-[10px] font-mono font-bold text-stone-500 tracking-wider uppercase mb-1">Note Title</label>
                          <input
                            type="text"
                            placeholder="e.g. Dhaka Delivery Courier Schedule"
                            value={keepNotes.title}
                            onChange={(e) => setKeepNotes(prev => ({ ...prev, title: e.target.value }))}
                            className="w-full border rounded px-3 py-1.5 bg-stone-50 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-[10px] font-mono font-bold text-stone-500 tracking-wider uppercase mb-1">Content Notes</label>
                          <textarea
                            rows={3}
                            placeholder="Write store details, notes, task boards, or delivery checklists here..."
                            value={keepNotes.content}
                            onChange={(e) => setKeepNotes(prev => ({ ...prev, content: e.target.value }))}
                            className="w-full border rounded px-3 py-1.5 bg-stone-50 focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-mono font-bold text-stone-500 tracking-wider uppercase mb-1">Category Theme Color</label>
                          <div className="flex gap-1.5 pt-1">
                            {[
                              { label: "Yellow", style: "bg-amber-50 border-amber-350 text-amber-900" },
                              { label: "Teal", style: "bg-teal-50 border-teal-350 text-teal-900" },
                              { label: "Emerald", style: "bg-emerald-50 border-emerald-355 text-emerald-900" },
                              { label: "Rose", style: "bg-rose-50 border-rose-350 text-rose-900" },
                              { label: "Dark Slate", style: "bg-stone-900 border-stone-750 text-stone-100" }
                            ].map((col) => (
                              <button
                                key={col.label}
                                type="button"
                                onClick={() => setKeepNotes(prev => ({ ...prev, color: col.style }))}
                                className={`w-6 h-6 rounded-full border border-stone-300 transition-all ${col.style.split(' ')[0]} ${
                                  keepNotes.color.includes(col.style.split(' ')[0]) ? "ring-2 ring-amber-500 ring-offset-1 scale-110" : "hover:scale-105"
                                }`}
                                title={col.label}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={handleKeepNotesCreate}
                        disabled={keepNotes.isSaving || !keepNotes.title || !keepNotes.content}
                        className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-stone-950 font-bold py-2 px-4 rounded uppercase text-[11px] tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-stone-950 stroke-[3]" />
                        <span>{keepNotes.isSaving ? "Syncing GDrive..." : "Add & Sync Note"}</span>
                      </button>
                    </div>

                    {/* Saved Notes Feed */}
                    <div className="md:col-span-2 bg-white border border-stone-200 p-5 rounded shadow-xs space-y-4">
                      <div className="border-b pb-2 flex justify-between items-center">
                        <span className="text-xs font-bold text-stone-800 uppercase tracking-widest">Saved Notes Catalog</span>
                        <span className="bg-stone-100 text-stone-500 font-mono text-[9px] font-semibold px-2 py-0.5 rounded">
                          {keepNotes.savedList.length} Notes total
                        </span>
                      </div>

                      {keepNotes.savedList.length === 0 ? (
                        <div className="py-12 text-center text-stone-400 border-2 border-dashed rounded bg-stone-50 flex flex-col items-center justify-center gap-1.5">
                          <Notebook className="w-7 h-7 text-stone-300" />
                          <span>Workspace notes shelf is empty. Type above to record.</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-80 overflow-y-auto pr-1">
                          {keepNotes.savedList.map((note, index) => (
                            <div key={index} className={`border rounded p-3.5 space-y-2 relative shadow-xs text-xs font-sans hover:shadow transition-all ${note.color}`}>
                              
                              <button
                                onClick={() => handleKeepNoteDelete(index)}
                                className="absolute top-3 right-3 text-stone-400 hover:text-red-500 transition-colors cursor-pointer"
                                title="Delete Note"
                              >
                                ✕
                              </button>

                              <h5 className="font-bold text-sm tracking-tight pr-6">{note.title}</h5>
                              <p className="text-[11px] leading-relaxed whitespace-pre-line text-stone-750">{note.content}</p>
                              
                              <div className="pt-2 border-t border-stone-200/50 flex justify-between items-center text-[10px] font-mono text-stone-400">
                                <span>{note.date}</span>
                                {note.url && (
                                  <a
                                    href={note.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sky-600 hover:text-sky-700 underline flex items-center gap-0.5"
                                  >
                                    <span>Cloud</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                )}
                              </div>

                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              )}

              {/* === TABS 6: GOOGLE MAPS === */}
              {activeTool === "maps" && (
                <div className="space-y-4 animate-studio-reveal">
                  <div className="bg-white border p-5 rounded border-stone-200 shadow-xs space-y-4 font-mono text-xs">
                    
                    <div className="border-b pb-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Map className="w-4.5 h-4.5 text-emerald-600" />
                        <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                          Logistics Carriage Map & Delivery Hotspots Router
                        </h4>
                      </div>
                      <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Live Simulator</span>
                    </div>

                    <p className="text-xs text-stone-500 leading-relaxed font-sans">
                      Select any active core business order. We automatically map coordinates, structure optimized carrier distribution, plot delivery routes, and generate direct routing search links on Google Maps.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-stone-500 mb-1">Pick An Active Order Target</label>
                          <select
                            value={selectedMapOrder ? selectedMapOrder.id : ""}
                            onChange={(e) => {
                              const match = orders.find(or => or.id === e.target.value);
                              if (match) setSelectedMapOrder(match);
                            }}
                            className="w-full border rounded px-3 py-2 bg-stone-50 text-xs font-sans"
                          >
                            {orders.length === 0 ? (
                              <option>No active orders</option>
                            ) : (
                              orders.map(or => (
                                <option key={or.id} value={or.id}>#{or.id} - {or.customerName}</option>
                              ))
                            )}
                          </select>
                        </div>

                        {selectedMapOrder && (
                          <div className="bg-stone-50 p-4 border rounded border-stone-200 space-y-3 font-sans leading-normal text-xs text-stone-700 rounded-sm">
                            <span className="text-[10px] font-mono font-bold text-amber-500 uppercase block tracking-wider">🗺 Selected Client Metadata</span>
                            
                            <div className="space-y-1.5">
                              <strong>Client: {selectedMapOrder.customerName}</strong>
                              <p className="text-[11px] text-stone-500">Phone: {selectedMapOrder.customerPhone}</p>
                              <p className="text-[11px] text-stone-500 leading-relaxed font-medium flex items-start gap-1">
                                <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                                <span>{selectedMapOrder.customerAddress}</span>
                              </p>
                            </div>

                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedMapOrder.customerAddress)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full bg-stone-900 text-amber-500 text-center font-mono font-bold uppercase text-[10.5px] py-1.5 rounded tracking-widest border border-stone-850 hover:bg-stone-850 transition-colors block cursor-pointer select-none"
                            >
                              Open Google Maps Route
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Router Map simulation container */}
                      <div className="md:col-span-2 border border-stone-200 rounded p-4 bg-stone-50 flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] font-mono font-bold text-amber-500 uppercase block tracking-wider mb-2">⚡ Logistic Delivery Distribution Insights</span>
                          
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center mb-4">
                            <div className="bg-white border rounded p-2 shadow-xs">
                              <span className="text-lg font-bold text-stone-900 font-mono block">35%</span>
                              <span className="text-[9px] uppercase text-stone-400 font-bold block">Dhaka Core</span>
                            </div>
                            <div className="bg-white border rounded p-2 shadow-xs">
                              <span className="text-lg font-bold text-stone-900 font-mono block">22%</span>
                              <span className="text-[9px] uppercase text-stone-400 font-bold block">Chittagong</span>
                            </div>
                            <div className="bg-white border rounded p-2 shadow-xs">
                              <span className="text-lg font-bold text-stone-900 font-mono block">15%</span>
                              <span className="text-[9px] uppercase text-stone-400 font-bold block">Sylhet Div</span>
                            </div>
                            <div className="bg-white border rounded p-2 shadow-xs">
                              <span className="text-lg font-bold text-stone-900 font-mono block">28%</span>
                              <span className="text-[9px] uppercase text-stone-400 font-bold block">Outskirts</span>
                            </div>
                          </div>
                        </div>

                        {selectedMapOrder ? (
                          <div className="bg-white border border-stone-200 rounded p-4 space-y-2 relative overflow-hidden flex-1 flex flex-col justify-center">
                            <div className="absolute top-3 right-3 flex items-center gap-1.5 font-mono text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded uppercase">
                              <span className="w-1.5 h-1.5 bg-emerald-50 animate-ping rounded-full inline-block" />
                              <span>Route Found</span>
                            </div>

                            <div className="space-y-1 bg-stone-50 p-3 rounded font-sans text-xs">
                              <p className="font-semibold text-stone-800 flex items-center gap-1">
                                <MapPin className="w-4 h-4 text-emerald-500" />
                                <span>Optimal Logistics Route plotted dynamically</span>
                              </p>
                              <p className="text-[11px] text-stone-500">Carriage Carrier: Pathao Courier priority express corridor.</p>
                              <p className="text-[11.5px] font-mono text-emerald-700 font-bold mt-1">Estimated Travel Time: 35-45 Minutes (Optimized via traffic indexes)</p>
                            </div>
                          </div>
                        ) : (
                          <div className="py-12 text-center text-stone-400 font-medium">Select an order on the left to activate map matrix simulation.</div>
                        )}
                      </div>

                    </div>

                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      )}

      {/* ========================================================== */}
      {/* PANEL 2: HIGH SECURITY DATA IMPORTER & EXPORTER HUB */}
      {/* ========================================================== */}
      {activePanel === "importer-exporter" && (
        <div className="space-y-6" id="bulk-data-hub-viewport">
          
          {/* Section nav headers (Choosing Data Type) */}
          <div className="flex bg-stone-50 border border-stone-200/60 p-1.5 rounded items-center justify-between" id="data-model-selectors">
            
            <div className="flex gap-1.5">
              {[
                { tab: "inventory", label: "Inventory Specifications", icon: Database },
                { tab: "customers", label: "Customer Registry Records", icon: User },
                { tab: "orders", label: "Orders Tracking Books", icon: FileText }
              ].map((item) => {
                const IconComp = item.icon;
                return (
                  <button
                    key={item.tab}
                    onClick={() => {
                      setActiveDataTab(item.tab as DataTypeTab);
                      setImportFileFeedback(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className={`px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeDataTab === item.tab
                        ? "bg-stone-900 border border-stone-950 text-white shadow-xs"
                        : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
                    }`}
                  >
                    <IconComp className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            <span className="text-[9.5px] font-mono text-stone-400 font-bold hidden md:inline-block pr-3">RIEMART MULTI-FORMAT DATA ENGINE</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="importer-exporter-command-panel">
            
            {/* EXPORTER BLOCK PANEL */}
            <div className="bg-white border border-stone-200 rounded p-5 space-y-5 flex flex-col justify-between" id="exporter-station-panel">
              <div className="space-y-4">
                <div className="border-b border-stone-100 pb-2 flex items-center gap-1.5">
                  <Download className="w-5 h-5 text-emerald-500 shrink-0" />
                  <h4 className="text-xs font-mono font-bold text-stone-900 uppercase tracking-wider">
                    Executive Ledger Data Exporter
                  </h4>
                </div>

                <p className="text-xs text-stone-550 leading-relaxed font-sans">
                  {lang === "en"
                    ? "Export active collections instantly into standard data formats. Our CSV format contains proper Unicode BOM padding to perfectly preserve Bengali font script lettering inside Microsoft Excel."
                    : "আপনার রিয়ামার্টের ডাটা টেবিলগুলো অত্যন্ত নিরাপদে এবং নিমেষে ডাউনলোড করুন। বাংলা শব্দ বা ক্যাটাগরিগুলো যাতে সঠিকভাবে মাইক্রোসফট এক্সেলে সাজানো থাকে সেজন্য ফাইলগুলোতে বিশেষ ইউনিকোড BOM যোগ করা আছে।"}
                </p>

                <div className="bg-stone-50 p-4 border border-stone-200 rounded text-center py-6">
                  <span className="text-[10px] font-mono font-black text-amber-500 uppercase tracking-widest block mb-1">Target Export File type</span>
                  <p className="text-xs font-sans font-semibold text-stone-800 uppercase mb-4">Exporting: {activeDataTab} Table Data</p>

                  <div className="flex gap-2.5 justify-center max-w-sm mx-auto">
                    <button
                      onClick={() => handleLocalCSVExport(activeDataTab)}
                      className="flex-1 bg-stone-900 hover:bg-stone-850 active:scale-97 text-white font-mono text-xs font-bold py-2 rounded-sm cursor-pointer border border-stone-950 flex items-center justify-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5 text-stone-300" />
                      <span>CSV FORMAT</span>
                    </button>
                    <button
                      onClick={() => handleLocalExcelExport(activeDataTab)}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:scale-97 text-white font-mono text-xs font-bold py-2 rounded-sm cursor-pointer flex items-center justify-center gap-1"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-stone-100" />
                      <span>XLS EXCEL</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Direct Sheets Syncer Quick Button */}
              <div className="bg-stone-50 p-3.5 border border-stone-200 rounded flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5 text-left">
                  <strong className="font-bold text-stone-800 block">Deploy Direct to Google Sheets</strong>
                  <span className="text-[10.5px] text-stone-450 block">Instant rest publishing of clean datasets.</span>
                </div>
                <button
                  onClick={() => handleSheetDirectSync(activeDataTab)}
                  disabled={!token}
                  className={`px-4 py-2 font-mono font-bold text-xs uppercase rounded cursor-pointer transition-all shrink-0 flex items-center gap-1 ${
                    token 
                      ? "bg-amber-550 hover:bg-amber-600 active:scale-97 text-stone-950" 
                      : "bg-stone-200 text-stone-400 cursor-not-allowed border border-stone-300 pointer-events-none"
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Push live</span>
                </button>
              </div>

            </div>

            {/* IMPORTER DRAG & DROP STAGING PANEL */}
            <div className="bg-white border border-stone-200 rounded p-5 space-y-4" id="importer-station-panel">
              <div className="border-b border-stone-100 pb-2 flex items-center gap-1.5">
                <Upload className="w-5 h-5 text-sky-500 shrink-0" />
                <h4 className="text-xs font-mono font-bold text-stone-900 uppercase tracking-wider">
                  Bulk Unicode File Importer Desk
                </h4>
              </div>

              <div className="text-xs text-stone-550 leading-relaxed font-sans">
                {lang === "en"
                  ? "Import new datasets seamlessly. Drag-and-drop your customized CSV file to validate columns instantly prior to merging into live database state."
                  : "আপনার ইনভেন্টরি, কন্টাক্ট ডিটেইলস বা বুকিং অর্ডার লিস্ট সহজে বাল্ক আপলোড করুন। ফাইল ড্র্যাগ করুন; আমাদের হাই-স্পীড ব্রাউজার পার্সার মিলি সেকেন্ডে ফাইল পরীক্ষা করবে।"}
              </div>

              {/* Upload Drop Zone CSS */}
              <div
                onDragOver={handleCSVDragOver}
                onDragLeave={handleCSVDragLeave}
                onDrop={handleCSVDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded p-8 text-center transition-all cursor-pointer flex flex-col justify-center items-center gap-3 scale-100 hover:border-amber-500 ${
                  importDragActive 
                    ? "bg-amber-50/50 border-amber-400 scale-[0.99] border-solid" 
                    : "bg-stone-50 border-stone-300 hover:bg-stone-100/60"
                }`}
              >
                <div className="p-3 bg-white rounded-full border border-stone-200/50 shadow-xs flex items-center justify-center">
                  <Upload className="w-6 h-6 text-stone-400" />
                </div>
                <div className="space-y-1">
                  <strong className="text-xs text-stone-800 font-bold block">
                    {lang === "en" ? "Drag and Drop CSV File Here" : "এখানে .CSV ফাইল ড্র্যাগ করুন"}
                  </strong>
                  <span className="text-[10.5px] text-stone-400 block font-mono">
                    {lang === "en" ? "or click to upload from computer" : "অথবা কম্পিউটার থেকে ফাইল সিলেক্ট করতে ক্লিক করুন"}
                  </span>
                </div>
                <input
                  type="file"
                  accept=".csv,.txt"
                  ref={fileInputRef}
                  onChange={handleCSVFileSelect}
                  className="hidden"
                />
              </div>

            </div>

          </div>

          {/* DYNAMIC CSV IMPORT VIEW GRID AND PREVIEW COMMIT MODULE */}
          {importFileFeedback && (
            <div className="bg-white border border-stone-250 p-5 rounded space-y-4 animate-studio-reveal" id="csv-validation-preview-dock">
              
              {/* Report Header stats */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-3 border-stone-200 font-mono text-xs">
                <div>
                  <h5 className="font-bold text-stone-900 flex items-center gap-1">
                    <CheckCircle className="w-4.5 h-4.5 text-emerald-500 fill-white shrink-0" />
                    <span>Import Validation Preview: {importFileFeedback.fileName}</span>
                  </h5>
                  <p className="text-[10.5px] text-stone-400 font-normal mt-0.5 font-sans leading-relaxed">
                    Review and confirm matching rows before committing changes safely into the app database.
                  </p>
                </div>

                <div className="flex gap-2 text-[10px] font-mono leading-none">
                  <div className="bg-stone-50 border px-2.5 py-1.5 rounded font-bold">
                    ROWS: {importFileFeedback.totalRows}
                  </div>
                  <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1.5 rounded font-black">
                    VALID: {importFileFeedback.validRows.length}
                  </div>
                  {importFileFeedback.invalidRows.length > 0 && (
                    <div className="bg-red-50 text-red-700 border border-red-200 px-2.5 py-1.5 rounded font-black">
                      SKIPPED: {importFileFeedback.invalidRows.length}
                    </div>
                  )}
                </div>
              </div>

              {/* Warnings and issues checklist columns */}
              {importFileFeedback.invalidRows.length > 0 && (
                <div className="bg-amber-50/50 border border-amber-250 p-3 rounded font-mono text-[10.5px] text-stone-700 leading-normal flex items-start gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <strong className="font-bold block uppercase tracking-wide">Validation Warnings Encountered:</strong>
                    <ul className="list-disc pl-3.5 space-y-1">
                      {importFileFeedback.invalidRows.slice(0, 3).map((err, i) => (
                        <li key={i}>Row Line {err.row}: {err.reason}</li>
                      ))}
                      {importFileFeedback.invalidRows.length > 3 && (
                        <li>And {importFileFeedback.invalidRows.length - 3} other formatting errors down the sheet.</li>
                      )}
                    </ul>
                  </div>
                </div>
              )}

              {/* Data Validation preview table cells */}
              <div className="overflow-x-auto max-h-60 border rounded border-stone-250">
                <table className="w-full font-mono text-[11px] text-stone-700 text-left border-collapse">
                  <thead>
                    <tr className="bg-stone-100 border-b border-stone-250 font-bold text-stone-600 h-10 select-all">
                      <th className="p-2 sm:p-2.5">Row Line</th>
                      <th className="p-2 sm:p-2.5">Preview Cell A</th>
                      <th className="p-2 sm:p-2.5">Preview Cell B</th>
                      <th className="p-2 sm:p-2.5">Preview Cell C</th>
                      <th className="p-2 sm:p-2.5 text-right">Cell D Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importFileFeedback.validRows.slice(0, 5).map((row, index) => {
                      let colA = "";
                      let colB = "";
                      let colC = "";
                      let colD = "";

                      if (activeDataTab === "inventory") {
                        colA = row.sku || row.id;
                        colB = row.nameEn;
                        colC = row.category;
                        colD = `৳ ${row.price.toLocaleString()}`;
                      } else if (activeDataTab === "customers") {
                        colA = row.name;
                        colB = row.phone;
                        colC = row.address || "N/A";
                        colD = row.email || "N/A";
                      } else if (activeDataTab === "orders") {
                        colA = row.id;
                        colB = row.customerName;
                        colC = row.customerPhone;
                        colD = `৳ ${row.totalPrice.toLocaleString()}`;
                      }

                      return (
                        <tr key={index} className="border-b h-9 border-stone-200 hover:bg-stone-50/50">
                          <td className="p-2 font-bold select-all text-center border-r">{index + 2}</td>
                          <td className="p-2 pr-4 font-sans font-medium text-stone-900 truncate max-w-[120px]">{colA}</td>
                          <td className="p-2 pr-4 font-sans text-stone-700 truncate max-w-[150px]">{colB}</td>
                          <td className="p-2 text-stone-500 font-sans truncate max-w-[120px]">{colC}</td>
                          <td className="p-2 text-stone-900 font-bold text-right">{colD}</td>
                        </tr>
                      );
                    })}
                    {importFileFeedback.validRows.length > 5 && (
                      <tr>
                        <td colSpan={5} className="p-3 text-center text-[10.5px] italic text-stone-400 bg-stone-50 border-t border-stone-200">
                          ... and {importFileFeedback.validRows.length - 5} more records successfully validated in memory list.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Merge & Mode controller selection footer */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-stone-50 border p-4 rounded-sm border-stone-250 font-mono text-xs">
                
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div>
                    <span className="text-[10px] text-stone-500 block uppercase font-bold mb-1">DATA PROCESSING MODE</span>
                    <div className="flex border rounded overflow-hidden">
                      <button
                        onClick={() => setImportMergeMode("merge")}
                        className={`px-3 py-1 text-[11px] font-bold tracking-wider cursor-pointer uppercase ${
                          importMergeMode === "merge" 
                            ? "bg-stone-900 text-white font-bold" 
                            : "bg-white hover:bg-stone-100/60 text-stone-600"
                        }`}
                      >
                        Merge & Append
                      </button>
                      <button
                        onClick={() => setImportMergeMode("overwrite")}
                        className={`px-3 py-1 text-[11px] font-bold tracking-wider cursor-pointer uppercase ${
                          importMergeMode === "overwrite" 
                            ? "bg-red-650 text-white font-bold" 
                            : "bg-white hover:bg-stone-100/60 text-stone-600"
                        }`}
                      >
                        Overwrite Entire List
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-stone-400 leading-relaxed font-sans max-w-sm">
                    {importMergeMode === "merge"
                      ? "*Merge & Append updates existing matching indexes in database and securely stacks new item records without deleting data."
                      : "⚠️ OVERWRITE clears entire existing table list on screen first and forces complete replacement schema. Proceed with maximum safety."}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setImportFileFeedback(null)}
                    className="border border-stone-300 bg-white text-stone-700 font-bold px-4 py-2 text-xs uppercase hover:bg-stone-50 animate-pulse rounded"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCommitImportData}
                    disabled={isImportCommitting}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2 text-xs uppercase flex items-center gap-1 cursor-pointer shadow animate-bounce rounded"
                  >
                    <Check className="w-4 h-4 stroke-[3.5]" />
                    <span>{isImportCommitting ? "Committing..." : "Commit Import List"}</span>
                  </button>
                </div>

              </div>

            </div>
          )}

        </div>
      )}

    </div>
  );
};
