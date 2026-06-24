import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "../firebase";

export interface GoogleDriveFile {
  id: string;
  name: string;
  webViewLink: string;
  createdTime?: string;
  size?: string;
}

/**
 * Get cached access token from session storage or local storage
 */
export function getStoredDriveToken(): string | null {
  try {
    return sessionStorage.getItem("riemart_gdrive_token") || localStorage.getItem("riemart_gdrive_token") || null;
  } catch {
    return null;
  }
}

export function getSavedClientId(): string {
  const envId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
  if (envId) return envId;
  try {
    return localStorage.getItem("riemart_gdrive_client_id") || "";
  } catch {
    return "";
  }
}

/**
 * Authenticate with Google popup using secure OAuth 2.0 & postMessage
 */
export async function googleDriveSignIn(customClientId?: string): Promise<{ token: string; email: string | null }> {
  const clientId = customClientId || getSavedClientId();
  if (!clientId) {
    throw new Error("CLIENT_ID_REQUIRED");
  }

  const redirectUri = window.location.origin + window.location.pathname;
  const scopes = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/documents"
  ].join(" ");

  const stateObj = { action: "pick_image" };
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(clientId)}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=token&` +
    `scope=${encodeURIComponent(scopes)}&` +
    `state=${encodeURIComponent(JSON.stringify(stateObj))}`;

  return new Promise((resolve, reject) => {
    const width = 600;
    const height = 650;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    let popup: Window | null = null;
    try {
      popup = window.open(
        authUrl,
        "GoogleDriveAuthPopup",
        `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes,status=yes`
      );
    } catch (e) {
      console.warn("window.open blocked or threw exception in sandbox:", e);
    }

    if (!popup) {
      reject(new Error("POPUP_BLOCKED"));
      return;
    }

     const messageListener = (event: MessageEvent) => {
      // Validate origin to be safe
      if (event.origin !== window.location.origin) return;

      if (event.data && event.data.type === "OAUTH_ACCESS_TOKEN") {
        const token = event.data.accessToken;
        try {
          sessionStorage.setItem("riemart_gdrive_token", token);
          localStorage.setItem("riemart_gdrive_token", token);
          sessionStorage.setItem("riemart_gdrive_last_active_client_id", clientId);
        } catch {}
        
        // Remove listener
        window.removeEventListener("message", messageListener);
        
        // Fetch user profile info dynamically using ultra-fast Google CDNs
        fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(userInfo => {
            resolve({ token, email: userInfo.email || "Google User" });
          })
          .catch(() => {
            resolve({ token, email: "Authorized Google User" });
          });
      }
    };

    window.addEventListener("message", messageListener);

    // Track if user closed the window without finishing
    const checkInterval = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkInterval);
        setTimeout(() => {
          window.removeEventListener("message", messageListener);
          // Look if we already obtained a token from hash in case message was delayed
          const tokenCheck = sessionStorage.getItem("riemart_gdrive_token") || localStorage.getItem("riemart_gdrive_token");
          if (tokenCheck) {
            resolve({ token: tokenCheck, email: "Authorized Google User" });
          } else {
            reject(new Error("AUTH_CANCELLED"));
          }
        }, 500);
      }
    }, 1000);
  });
}

/**
 * Log out from Google Drive session (clears memory and saved tokens)
 */
export function googleDriveSignOut() {
  try {
    sessionStorage.removeItem("riemart_gdrive_token");
    localStorage.removeItem("riemart_gdrive_token");
  } catch {}
}

/**
 * Find or create a specific folder in Google Drive (defaults to 'RIEMART_Invoices')
 */
export async function findOrCreateFolder(token: string, folderName: string = "RIEMART_Invoices"): Promise<string> {
  const query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`;

  const response = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("EXPIRED_TOKEN");
    }
    const errText = await response.text();
    throw new Error(`Failed searching for folder: ${errText}`);
  }

  const data = await response.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }

  // Create new folder
  const createFolderUrl = "https://www.googleapis.com/drive/v3/files";
  const createResponse = await fetch(createFolderUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder"
    })
  });

  if (!createResponse.ok) {
    const errText = await createResponse.text();
    throw new Error(`Failed to create Folder: ${errText}`);
  }

  const folder = await createResponse.json();
  return folder.id;
}

/**
 * Upload an invoice PDF to Google Drive inside a designated parents directory
 */
export async function uploadInvoiceToFolder(
  token: string, 
  folderId: string, 
  fileName: string, 
  pdfBlob: Blob,
  description: string
): Promise<GoogleDriveFile> {
  const metadata = {
    name: fileName,
    mimeType: "application/pdf",
    description: description,
    parents: [folderId]
  };

  const formData = new FormData();
  formData.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  formData.append("file", pdfBlob);

  const uploadUrl = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink";
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("EXPIRED_TOKEN");
    }
    const errText = await response.text();
    throw new Error(`Upload to Drive failed: ${errText}`);
  }

  return response.json();
}

/**
 * List files inside the configured Google Drive Folder
 */
export async function listFilesInFolder(token: string, folderId: string): Promise<GoogleDriveFile[]> {
  const query = `'${folderId}' in parents and trashed = false`;
  const listUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    query
  )}&fields=files(id,name,webViewLink,createdTime,size)&orderBy=createdTime%20desc`;

  const response = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("EXPIRED_TOKEN");
    }
    const errText = await response.text();
    throw new Error(`Failed listing files: ${errText}`);
  }

  const data = await response.json();
  return data.files || [];
}

/**
 * List image files on Google Drive for product selection
 */
export async function listImageFiles(token: string, searchKeyword?: string): Promise<(GoogleDriveFile & { thumbnailLink?: string })[]> {
  let query = "mimeType contains 'image/' and trashed = false";
  if (searchKeyword) {
    const escapedKeyword = searchKeyword.replace(/'/g, "\\'");
    query += ` and name contains '${escapedKeyword}'`;
  }
  const listUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    query
  )}&fields=files(id,name,webViewLink,thumbnailLink,createdTime,size)&pageSize=50&orderBy=modifiedTime%20desc`;

  const response = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("EXPIRED_TOKEN");
    }
    const errText = await response.text();
    throw new Error(`Failed listing image files: ${errText}`);
  }

  const data = await response.json();
  return data.files || [];
}

/**
 * Upload a Base64 product image to Google Drive and return its direct view URL
 */
export async function uploadProductImageToDrive(
  token: string,
  base64Data: string,
  fileName: string,
  folderName: string = "RIEMART_Invoices"
): Promise<string> {
  // 1. Resolve folder ID
  const folderId = await findOrCreateFolder(token, folderName);

  // 2. Convert base64 to Blob
  const arr = base64Data.split(",");
  const mimeMatch = arr[0].match(/:(.*?);/);
  if (!mimeMatch) {
    throw new Error("Invalid base64 image data format");
  }
  const mime = mimeMatch[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  const blob = new Blob([u8arr], { type: mime });

  // 3. Setup metadata
  const metadata = {
    name: fileName,
    mimeType: mime,
    parents: [folderId]
  };

  const formData = new FormData();
  formData.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  formData.append("file", blob);

  // 4. Upload
  const uploadUrl = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink";
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("EXPIRED_TOKEN");
    }
    const errText = await response.text();
    throw new Error(`Upload failed: ${errText}`);
  }

  const result = await response.json();

  // Make the file publicly readable so it can be embedded on the shop and served by ultra-fast Google CDNs
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${result.id}/permissions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        role: "reader",
        type: "anyone"
      })
    });
  } catch (pErr) {
    console.warn("Could not make direct asset public.", pErr);
  }
  
  // Return direct high-speed, globally-accessible CDN embedding link
  return `https://lh3.googleusercontent.com/d/${result.id}`;
}

