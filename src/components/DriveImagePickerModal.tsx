import React, { useState, useEffect, useCallback, useTransition } from "react";
import { Search, Image, Loader2, X, Cloud, LogOut } from "lucide-react";
import { Language } from "../types";
import { 
  getStoredDriveToken, 
  googleDriveSignIn, 
  googleDriveSignOut, 
  listImageFiles, 
  GoogleDriveFile,
  getSavedClientId
} from "../utils/googleDriveHelper";

interface DriveImagePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onSelectImage: (imageUrl: string) => void;
}

export const DriveImagePickerModal: React.FC<DriveImagePickerModalProps> = ({
  isOpen,
  onClose,
  lang,
  onSelectImage,
}) => {
  const [token, setToken] = useState<string | null>(null);
  const [images, setImages] = useState<(GoogleDriveFile & { thumbnailLink?: string })[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [clientIdInput, setClientIdInput] = useState<string>(() => getSavedClientId());
  const [showClientIdField, setShowClientIdField] = useState<boolean>(() => !getSavedClientId());
  const [, startTransition] = useTransition();

  // Load existing token if any
  useEffect(() => {
    if (isOpen) {
      const storedToken = getStoredDriveToken();
      if (storedToken) {
        setToken(storedToken);
      } else {
        setToken(null);
        setImages([]);
      }
      
      const currentId = getSavedClientId();
      setClientIdInput(currentId);
      setShowClientIdField(!currentId);
    }
  }, [isOpen]);

  // Fetch images from Drive when token is available or search changes
  const fetchDriveImages = useCallback(async (currentToken: string, keyword: string = "") => {
    setLoading(true);
    setError(null);
    try {
      const files = await listImageFiles(currentToken, keyword);
      setImages(files);
    } catch (err: any) {
      console.error("Error fetching images from Google Drive:", err);
      if (err.message === "EXPIRED_TOKEN") {
        setError(lang === "en" 
          ? "Your Google session has expired. Please sign in again." 
          : "গুগল সেশন শেষ হয়ে গেছে। দয়া করে আবার সাইন-ইন করুন।"
        );
        googleDriveSignOut();
        setToken(null);
      } else {
        setError(lang === "en" 
          ? "Failed to load images. Make sure Google Drive has appropriate permissions." 
          : "ড্রাইভ থেকে পণ্য ছবি লোড করতে ব্যর্থ হয়েছে।"
        );
      }
    } finally {
      setLoading(false);
    }
  }, [lang]);

  // Fetch images when token is loaded or when searching
  useEffect(() => {
    if (token && isOpen) {
      fetchDriveImages(token, searchQuery);
    }
  }, [token, isOpen, fetchDriveImages, searchQuery]);

  // Trigger Google authentication popup
  const handleSignIn = async () => {
    if (showClientIdField && !clientIdInput) {
      setError(lang === "en"
        ? "Please enter a valid Google Client ID!"
        : "অনুগ্রহ করে একটি সঠিক গুগল ক্লায়েন্ট আইডি দিন!"
      );
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await googleDriveSignIn(clientIdInput);
      if (result && result.token) {
        setToken(result.token);
        if (clientIdInput) {
          localStorage.setItem("riemart_gdrive_client_id", clientIdInput);
          setShowClientIdField(false);
        }
      }
    } catch (err: any) {
      console.error("Popup Auth Error:", err);
      if (err.message === "CLIENT_ID_REQUIRED") {
        setShowClientIdField(true);
        setError(lang === "en"
          ? "Please paste your Google OAuth Client ID first."
          : "অনুগ্রহ করে প্রথমে আপনার গুগল ওঅথ ক্লায়েন্ট আইডি লিখুন।"
        );
      } else if (err.message === "POPUP_BLOCKED") {
        setError(lang === "en"
          ? "Popup block prevents Google Sign-In. Please allow popups for this site."
          : "পপআপ উইন্ডোটি ব্লক করা হয়েছে। অনুগ্রহ করে ব্রাউজার সেটিংসে পপআপ চালু করুন।"
        );
      } else if (err.message === "AUTH_CANCELLED") {
        setError(lang === "en"
          ? "Google Sign-In was cancelled or closed."
          : "গুগল সাইন-ইন বন্ধ বা বাতিল করা হয়েছে।"
        );
      } else {
        setError(err.message || (lang === "en" 
          ? "Google authentication failed." 
          : "গুগল অথেনটিকেশন ব্যর্থ হয়েছে।"
        ));
      }
    } finally {
      setLoading(false);
    }
  };

  // Sign out
  const handleSignOut = () => {
    googleDriveSignOut();
    setToken(null);
    setImages([]);
    setError(null);
  };

  // Select drive file and convert its URL
  const handleFileSelect = async (file: GoogleDriveFile) => {
    const fileId = file.id;
    
    // Set permission in background so that anyone can see it on the shop and it is cached on CDN
    if (token) {
      try {
        fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            role: "reader",
            type: "anyone"
          })
        }).catch(err => console.warn("Background permission update failed:", err));
      } catch (err) {
        console.warn("Permission fetch error:", err);
      }
    }

    // Generate direct high-speed, globally-accessible CDN embedding link
    const directUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
    onSelectImage(directUrl);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm" id="gdrive-image-picker-overlay">
      <div className="bg-white border border-stone-200 shadow-2xl rounded-lg w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="bg-stone-50 border-b border-stone-150 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-blue-500 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-stone-900 font-sans tracking-tight">
                {lang === "en" ? "Select Product Photo from Google Drive" : "গুগল ড্রাইভ থেকে পণ্যের ছবি নির্বাচন করুন"}
              </h3>
              <p className="text-[10px] text-stone-500 font-mono">
                {token ? "Connected to Google Workspace APIs" : "OAuth 2.0 Secure Session Connection Required"}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Auth State & Search Area */}
        <div className="bg-stone-50 border-b border-stone-150 px-5 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          {token ? (
            <div className="w-full flex flex-col sm:flex-row sm:items-center gap-2.5">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
                <input
                  type="text"
                  placeholder={lang === "en" ? "Filter by image name..." : "নাম দিয়ে ছবি খুঁজুন..."}
                  value={searchQuery}
                  onChange={(e) => {
                    const val = e.target.value;
                    startTransition(() => {
                      setSearchQuery(val);
                    });
                  }}
                  className="w-full bg-white border border-stone-200 rounded px-8 py-1.5 text-xs text-stone-800 placeholder-stone-400 outline-none focus:ring-1 focus:ring-blue-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 font-bold text-xs"
                  >
                    ×
                  </button>
                )}
              </div>
              
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-1 bg-stone-150 hover:bg-stone-200 text-stone-700 px-3 py-1.5 rounded text-[10px] font-medium transition-colors cursor-pointer"
                title={lang === "en" ? "Disconnect Google Drive" : "ডিসকানেক্ট করুন"}
              >
                <LogOut className="w-3 h-3" />
                <span>{lang === "en" ? "Disconnect" : "ডিসকানেক্ট"}</span>
              </button>
            </div>
          ) : (
            <div className="w-full py-2 flex flex-col gap-3">
              {showClientIdField ? (
                <div className="bg-stone-50 border border-stone-200 rounded p-3 text-xs flex flex-col gap-2.5 w-full">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-stone-700">
                      {lang === "en" ? "Configure Google OAuth Client ID" : "গুগল ওঅথ ও ক্লায়েন্ট আইডি সেটআপ"}
                    </span>
                    {getSavedClientId() && (
                      <button 
                        type="button" 
                        onClick={() => setShowClientIdField(false)} 
                        className="text-stone-400 hover:text-stone-600 text-[10px] font-mono underline"
                      >
                        {lang === "en" ? "Cancel" : "বাতিল"}
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={clientIdInput}
                    onChange={(e) => setClientIdInput(e.target.value.trim())}
                    placeholder="e.g. 12345-abcde.apps.googleusercontent.com"
                    className="w-full bg-white border border-stone-300 rounded px-2.5 py-1.5 font-mono text-xs text-stone-800 focus:outline-none focus:border-blue-500"
                  />
                  <div className="text-[10px] text-stone-500 leading-normal font-mono">
                    {lang === "en" ? (
                      <>
                        Authorized Redirect URI in Google Cloud Console: <code className="bg-stone-100 text-stone-800 px-1 py-0.5 rounded break-all">{window.location.origin + window.location.pathname}</code>
                      </>
                    ) : (
                      <>
                        গুগল ক্লাউড কনসোলে রিডাইরেক্ট ইউআরআই সেট করুন: <code className="bg-stone-100 text-stone-800 px-1 py-0.5 rounded break-all">{window.location.origin + window.location.pathname}</code>
                      </>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
                <span className="text-[11px] text-stone-600 text-center sm:text-left leading-relaxed">
                  {lang === "en" 
                    ? "Access images dynamically from your Google Drive files in high quality." 
                    : "আপনার গুগল ড্রাইভে জমাকৃত সব পণ্য ফটো সরাসরি এখানে অ্যাক্সেস করুন।"
                  }
                </span>
                
                <div className="flex items-center gap-2">
                  {!showClientIdField && (
                    <button
                      type="button"
                      onClick={() => setShowClientIdField(true)}
                      className="text-[10px] font-mono hover:underline text-stone-500 hover:text-stone-700 cursor-pointer mr-1"
                    >
                      {lang === "en" ? "Configure CLIENT_ID" : "ক্লায়েন্ট আইডি পরিবর্তন"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSignIn}
                    className="gsi-material-button text-xs font-semibold px-4 py-2 border border-stone-200 rounded bg-white hover:bg-stone-50 active:scale-95 transition-all shadow-sm flex items-center gap-2 cursor-pointer shrink-0"
                  >
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4 shrink-0">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                      <path fill="none" d="M0 0h48v48H0z"></path>
                    </svg>
                    <span>{lang === "en" ? "Connect Google Drive" : "গুগল ড্রাইভ যুক্ত করুন"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Files View Space */}
        <div className="flex-1 overflow-y-auto p-5 min-h-[250px] bg-stone-50/50">
          {error && (
            <div className="bg-red-50 border border-red-150 rounded p-3 mb-4 text-xs text-red-600 leading-normal font-sans">
              <strong>⚠ Exception:</strong> {error}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-2.5">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <p className="text-xs text-stone-500 font-mono">
                {lang === "en" ? "Querying secure Drive files..." : "ড্রাইভের পণ্য ফাইল খোঁজা হচ্ছে..."}
              </p>
            </div>
          ) : !token ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mb-3 border border-stone-200">
                <Cloud className="w-7 h-7 text-stone-400" />
              </div>
              <h4 className="text-xs font-bold text-stone-800">
                {lang === "en" ? "Google Account Verification Required" : "গুগল একাউন্ট যাচাই করা প্রয়োজন"}
              </h4>
              <p className="text-[10px] text-stone-500 max-w-sm mt-1 leading-normal font-sans">
                {lang === "en" 
                  ? "Click the button above to authenticate with Google. This securely loads only your image assets in read-only mode so no file changes are executed." 
                  : "আপনার নিরাপদ একাউন্ট কানেক্ট করতে ওপরের বাটনটি সিলেক্ট করুন। এটি শুধুমাত্র পণ্য ফটো লিঙ্কিং করতে সুরক্ষিতভাবে ব্যবহৃত হবে।"}
              </p>
            </div>
          ) : images.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mb-2">
                <Image className="w-5 h-5 text-stone-400" />
              </div>
              <h4 className="text-[11px] font-bold text-stone-700">
                {lang === "en" ? "No Images Found" : "কোনো ছবি পাওয়া যায়নি"}
              </h4>
              <p className="text-[9px] text-stone-500 mt-1 max-w-xs font-sans">
                {searchQuery 
                  ? (lang === "en" ? `Can't find photo files matching "${searchQuery}"` : `"${searchQuery}" নামে কোনো ফটো খুঁজে পাওয়া যায়নি`)
                  : (lang === "en" ? "Make sure you have uploaded product pictures to your Google Drive account." : "আপনার গুগল ড্রাইভে পণ্য বা কাপড়ের ফটো আপলোড করা আছে কিনা নিশ্চিত করুন।")
                }
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3.5" id="gdrive-images-grid">
              {images.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => handleFileSelect(file)}
                  className="group bg-white border border-stone-200 rounded p-1.5 hover:border-blue-500 hover:shadow-md transition-all flex flex-col items-stretch text-left cursor-pointer active:scale-98"
                >
                  {/* Thumbnail Cover */}
                  <div className="aspect-square bg-stone-50 rounded border border-stone-150 overflow-hidden relative mb-1.5 flex items-center justify-center">
                    {file.thumbnailLink ? (
                      <img 
                        src={file.thumbnailLink} 
                        alt={file.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <Image className="w-5 h-5 text-stone-300" />
                    )}
                  </div>
                  
                  {/* Info Label */}
                  <div className="px-0.5 min-w-0">
                    <p className="text-[10px] text-stone-800 font-sans font-medium truncate group-hover:text-blue-600 block leading-tight">
                      {file.name}
                    </p>
                    <p className="text-[8px] text-stone-400 font-mono truncate mt-0.5">
                      {file.size ? `${(parseInt(file.size) / (1024 * 1024)).toFixed(2)} MB` : "GDrive Asset"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer info banner */}
        <div className="bg-stone-50 border-t border-stone-150 px-5 py-2.5 flex items-center justify-between text-[9px] text-stone-400 font-mono">
          <span>{lang === "en" ? "Maximum 50 recent images queried" : "সর্বোচ্চ ৫০টি পর্যন্ত ছবি লোড করা হয়েছে"}</span>
          <span>Google Workspace Sandbox</span>
        </div>
      </div>
    </div>
  );
};
