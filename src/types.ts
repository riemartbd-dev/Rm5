/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Product {
  id: string;
  sku?: string; // Unique stock keeping unit code
  nameEn: string;
  nameBn: string;
  category: Category;
  subCategory?: string; // Optional sub-classification
  price: number; // in USD or BDT. Active purchase/offer price.
  regularPrice?: number; // Original retail price for discount comparison
  image: string; // Master thumbnail image
  images?: string[]; // Up to 6 sliding images for carousel
  descriptionEn: string;
  descriptionBn: string;
  inventory: number;
  isFeatured?: boolean;
  offers?: boolean; // Eligible for special promo label
  specificationsEn?: string[];
  specificationsBn?: string[];
  deliveryOption?: "default" | "free" | "custom";
  customDeliveryCharge?: number;
  isDeleted?: boolean;
  status?: "active" | "hidden" | "deleted";
}

export type Category =
  | "Clothing"
  | "Perfume"
  | "Watches"
  | "Home Decoration"
  | "Baby Care"
  | "Electronics"
  | "Food & Beverage"
  | "Bags"
  | "Toys"
  | "Cosmetics";

export interface SystemLog {
  id: string;
  timestamp: string;
  type: "info" | "success" | "warning" | "security";
  messageEn: string;
  messageBn: string;
  operator: string;
}

export interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  orderNotes?: string;
  items: {
    productId: string;
    productNameEn: string;
    productNameBn: string;
    quantity: number;
    priceAtPurchase: number;
  }[];
  totalPrice: number;
  discountApplied: number;
  deliveryCharge?: number;
  status: "Pending" | "Processing" | "Shipped" | "Completed" | "Cancelled";
  date: string;
  paymentMethod?: string;
  paymentSender?: string;
  paymentTrxId?: string;
  statusHistory?: {
    status: "Pending" | "Processing" | "Shipped" | "Completed" | "Cancelled";
    timestamp: string;
  }[];
}

export interface StoreSettings {
  buyMoreSaveMoreEnabled: boolean;
  tier2Qty: number; // e.g., 2
  tier2Discount: number; // e.g., 5%
  tier3Qty: number; // e.g., 3+
  tier3Discount: number; // e.g., 15%
  tier4Qty: number; // e.g., 5+
  tier4Discount: number; // e.g., 20%
  bulkPriceEnabled: boolean;
  bulkMinQty: number; // e.g., 10+
  bulkFlatPrice: number; // Flat rate per product for bulk buying
  bulkAdvancePercent: number; // Required advance payment percentage
  announcementEn: string;
  announcementBn: string;
  showAnnouncement: boolean;
  passphraseHash: string; // e.g., 'riemart2026'
  storeSignatureText?: string;
  storeSignatureImage?: string; // image base64, URL, etc.
  facebookPageUrl?: string;
  facebookMessengerUsername?: string;
  publicStoreDomain?: string;
  deliveryChargeEnabled?: boolean;
  deliveryChargeInsideDhaka?: number;
  deliveryChargeOutsideDhaka?: number;
  googleClientId?: string;
  googleFolderId?: string;
  googleSheetId?: string;
}

export type Language = "en" | "bn";

// Star logo component helper
export const StarIconSvg = () => `
  <svg class="w-full h-full text-current animate-studio-reveal" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <mask id="star-logo-mask">
        <rect x="0" y="0" width="200" height="200" fill="white" />
        <!-- Single horizontal text gap cutout to perfectly preserve the right-most tip -->
        <rect x="90" y="92" width="110" height="28" fill="black" />
      </mask>
    </defs>
    <path 
      d="M 100 15 L 122 88 L 186 77 L 136 112 L 153 178 L 100 138 L 47 178 L 64 112 L 14 77 L 78 88 Z" 
      stroke="currentColor" 
      stroke-width="15" 
      stroke-linejoin="miter" 
      stroke-linecap="square"
      mask="url(#star-logo-mask)"
    />
    <text 
      x="91" 
      y="114" 
      fill="currentColor" 
      font-family="system-ui, -apple-system, sans-serif" 
      font-weight="950" 
      font-size="19"
      letter-spacing="1.2"
    >RIEMART</text>
  </svg>
`;
