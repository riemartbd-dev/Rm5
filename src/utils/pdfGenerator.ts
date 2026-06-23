import { jsPDF } from "jspdf";

const getPaymentMethodDisplay = (method: string | undefined, language: string) => {
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

export const generateInvoicePdfBlob = (order: any, lang: string = "en", settings?: any): Blob => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // Base configurations
  doc.setFont("Helvetica");
  
  // Draw Riemart Star Logo (11mm height/width) - High Fidelity Vector rendering matching the official Brand Identity
  const logoX = 20;
  const logoY = 14;
  const logoSize = 11;
  const logoScale = logoSize / 200;

  const scaleX = (x: number) => logoX + x * logoScale;
  const scaleY = (y: number) => logoY + y * logoScale;

  const scaleRelative = (p: number[], factor: number): number[] => {
    const cx = 100;
    const cy = 103;
    return [
      cx + (p[0] - cx) * factor,
      cy + (p[1] - cy) * factor
    ];
  };

  const center = [100, 103];
  const A = [100, 15];
  const vertex1 = [122, 88];
  const B = [186, 77];
  const vertex2 = [136, 112];
  const C = [153, 178];
  const vertex3 = [100, 138];
  const D = [47, 178];
  const vertex4 = [64, 112];
  const E = [14, 77];
  const vertex5 = [78, 88];

  const outerPoints = [A, vertex1, B, vertex2, C, vertex3, D, vertex4, E, vertex5];

  // Helper to draw a filled triangle in jsPDF
  const fillTri = (p1: number[], p2: number[], p3: number[]) => {
    doc.triangle(
      scaleX(p1[0]), scaleY(p1[1]),
      scaleX(p2[0]), scaleY(p2[1]),
      scaleX(p3[0]), scaleY(p3[1]),
      "F"
    );
  };

  // 1. Draw outer filled star with #292524 (stone-900)
  doc.setFillColor(41, 37, 36);
  for (let i = 0; i < 10; i++) {
    fillTri(center, outerPoints[i], outerPoints[(i + 1) % 10]);
  }

  // 2. Draw inner white filled star (making the outer star behave like a bold outline)
  doc.setFillColor(255, 255, 255);
  for (let i = 0; i < 10; i++) {
    const innerP1 = scaleRelative(outerPoints[i], 0.6);
    const innerP2 = scaleRelative(outerPoints[(i + 1) % 10], 0.6);
    fillTri(center, innerP1, innerP2);
  }

  // 3. Draw white rectangular mask over the right arm cutout to match official emblem gaps
  doc.setFillColor(255, 255, 255);
  doc.rect(scaleX(90), scaleY(92), 110 * logoScale, 28 * logoScale, "F");

  // 4. Draw the high-fidelity tiny "RIEMART" wordmark inside the star cutout
  doc.setFontSize(3.3);
  doc.setFont("Helvetica", "bold");
  doc.setTextColor(41, 37, 36);
  doc.text("RIEMART", scaleX(91), scaleY(112.5));
  doc.setFont("Helvetica", "normal");

  // Header section - Positioned beautifully next to the star logo (at X = 33)
  doc.setFontSize(22);
  doc.setFont("Helvetica", "bold");
  doc.setTextColor(41, 37, 36); // #292524 (stone-900)
  doc.text("RIEMART.com", 33, 23);
  
  doc.setFontSize(8);
  doc.setFont("Helvetica", "normal");
  doc.setTextColor(120, 113, 108); // #78716c
  doc.text("PREMIUM STUDIO ATELIER", 33, 28);
  doc.text("Dhaka, Bangladesh | riemart.com", 33, 32);

  // Billing Title
  doc.setFontSize(14);
  doc.setTextColor(217, 119, 6); // #d97706
  doc.text(lang === "en" ? "OFFICIAL CASH MEMO" : "অফিসিয়াল ক্যাশ মেমো", 130, 25);
  
  doc.setFontSize(10);
  doc.setTextColor(68, 64, 60); // #44403c
  doc.text(`${lang === "en" ? "Invoice ID:" : "মেমো নম্বর:"} ${order.id}`, 130, 31);
  doc.text(`${lang === "en" ? "Date:" : "তারিখ:"} ${new Date(order.date).toLocaleString()}`, 130, 36);

  // Separator Line
  doc.setDrawColor(231, 229, 228); // #e7e5e4
  doc.setLineWidth(0.5);
  doc.line(20, 42, 190, 42);

  // Customer Coordinates Section
  doc.setFontSize(9);
  doc.setTextColor(120, 113, 108);
  doc.text(lang === "en" ? "SHIPPING COORDINATES" : "ডেলিভারি বিবরণ", 20, 50);

  doc.setFontSize(10);
  doc.setTextColor(41, 37, 36);
  doc.text(`${lang === "en" ? "Name:" : "নাম:"} ${order.customerName}`, 20, 56);
  doc.text(`${lang === "en" ? "Phone:" : "ফোন:"} ${order.customerPhone}`, 20, 62);
  
  // Clean address output formatting with wrapping
  const addressText = `${lang === "en" ? "Address:" : "ঠিকানা:"} ${order.customerAddress}`;
  const splitAddress = doc.splitTextToSize(addressText, 90);
  doc.text(splitAddress, 20, 68);

  let leftSideY = 68 + (splitAddress.length * 5);

  if (order.orderNotes) {
    leftSideY += 4;
    doc.setFontSize(8);
    doc.setTextColor(120, 113, 108);
    doc.text(lang === "en" ? "ORDER NOTES:" : "অর্ডার নোট:", 20, leftSideY);
    
    doc.setFontSize(9);
    doc.setTextColor(180, 83, 9); // Amber-700
    const NotesText = order.orderNotes;
    const splitNotes = doc.splitTextToSize(NotesText, 90);
    doc.text(splitNotes, 20, leftSideY + 5);
    leftSideY += 5 + (splitNotes.length * 5);
  }

  // Status & Payment section
  doc.setFontSize(9);
  doc.setTextColor(120, 113, 108);
  doc.text(lang === "en" ? "CARRIER & PAYMENT DETAILS" : "সরবরাহ ও পেমেন্ট বিবরণ", 120, 50);

  doc.setFontSize(10);
  doc.setTextColor(41, 37, 36);
  doc.text(`${lang === "en" ? "Status:" : "স্ট্যাটাস:"} ${order.status}`, 120, 56);
  doc.text(`${lang === "en" ? "Payment Mode:" : "পেমেন্ট মাধ্যম:"} ${getPaymentMethodDisplay(order.paymentMethod, lang)}`, 120, 62);
  
  let rightSideY = 68;
  if (order.paymentSender) {
    doc.text(`${lang === "en" ? "Acc No:" : "অ্যাকাউন্ট নং:"} ${order.paymentSender}`, 120, rightSideY);
    rightSideY += 6;
  }
  if (order.paymentTrxId) {
    doc.text(`${lang === "en" ? "TrxID:" : "ট্রানজেকশন আইডি:"} ${order.paymentTrxId}`, 120, rightSideY);
    rightSideY += 6;
  }

  // Draw table headers
  const tableY = Math.max(86, leftSideY + 6, rightSideY + 6);
  doc.setDrawColor(41, 37, 36);
  doc.setLineWidth(0.5);
  doc.line(20, tableY, 190, tableY);

  doc.setFontSize(9);
  doc.setTextColor(120, 113, 108);
  doc.text(lang === "en" ? "ITEM DESCRIPTION" : "পণ্যের বিবরণ", 22, tableY + 5);
  doc.text(lang === "en" ? "QTY" : "পরিমাণ", 110, tableY + 5, { align: "center" });
  doc.text(lang === "en" ? "UNIT PRICE" : "একক মূল্য", 145, tableY + 5, { align: "right" });
  doc.text(lang === "en" ? "TOTAL" : "মোট মূল্য", 185, tableY + 5, { align: "right" });

  doc.line(20, tableY + 8, 190, tableY + 8);

  // Convert standard USD values to BDT totals
  const convertToBdt = (val: number) => {
    if (val >= 2000) return Math.round(val);
    return Math.round(val * 120);
  };

  // Draw table items
  let itemY = tableY + 15;
  doc.setFontSize(9);
  doc.setTextColor(41, 37, 36);
  
  order.items.forEach((it: any) => {
    // If text wraps, handle gracefully
    // Note: PDF Helvetica might have problems with native Unicode Bengali, so we prioritize fallback display for client-side jsPDF standard font
    const itemName = it.productNameEn || it.productNameBn;
    const splitName = doc.splitTextToSize(itemName, 75);
    doc.text(splitName, 22, itemY);
    
    doc.text(String(it.quantity), 110, itemY, { align: "center" });
    const bdtUnit = convertToBdt(it.priceAtPurchase);
    const bdtRowTotal = convertToBdt(it.priceAtPurchase * it.quantity);
    doc.text(`BDT ${bdtUnit.toLocaleString()}`, 145, itemY, { align: "right" });
    doc.text(`BDT ${bdtRowTotal.toLocaleString()}`, 185, itemY, { align: "right" });
    
    // adjust Y based on length of wrapped item text
    const linesCount = splitName.length;
    itemY += Math.max(10, linesCount * 5);
  });

  // Totals Section
  doc.setDrawColor(231, 229, 228);
  doc.setLineWidth(0.2);
  doc.line(110, itemY, 190, itemY);
  itemY += 6;

  // Compute Subtotal
  const subtotalRaw = order.items.reduce((sum: number, item: any) => sum + (item.priceAtPurchase * item.quantity), 0);
  const subtotal = convertToBdt(subtotalRaw);
  
  doc.setFontSize(9);
  doc.setTextColor(120, 113, 108);
  doc.text(lang === "en" ? "Subtotal:" : "উপমোট:", 145, itemY, { align: "right" });
  doc.setTextColor(41, 37, 36);
  doc.text(`BDT ${subtotal.toLocaleString()}`, 185, itemY, { align: "right" });
  itemY += 6;

  if (order.discountApplied > 0) {
    doc.setTextColor(120, 113, 108);
    doc.text(lang === "en" ? "Discount:" : "ছাড়:", 145, itemY, { align: "right" });
    doc.setTextColor(41, 37, 36);
    const discount = convertToBdt(order.discountApplied);
    doc.text(`-BDT ${discount.toLocaleString()}`, 185, itemY, { align: "right" });
    itemY += 6;
  }

  doc.setTextColor(120, 113, 108);
  doc.text(lang === "en" ? "Delivery Charge:" : "ডেলিভারি চার্জ:", 145, itemY, { align: "right" });
  doc.setTextColor(41, 37, 36);
  doc.setFont(undefined, "bold");
  const shippingChargeRaw = order.deliveryCharge || 0;
  if (shippingChargeRaw > 0) {
    const shippingCharge = convertToBdt(shippingChargeRaw);
    doc.text(`BDT ${shippingCharge.toLocaleString()}`, 185, itemY, { align: "right" });
  } else {
    doc.setTextColor(16, 185, 129); // emerald green
    doc.text(lang === "en" ? "Complimentary" : "ফ্রি", 185, itemY, { align: "right" });
  }
  doc.setFont(undefined, "normal");
  itemY += 8;

  doc.setDrawColor(41, 37, 36);
  doc.setLineWidth(0.4);
  doc.line(110, itemY - 3, 190, itemY - 3);

  doc.setFontSize(10);
  doc.setFont(undefined, "bold");
  doc.setTextColor(41, 37, 36);
  doc.text(lang === "en" ? "TOTAL COLLECTABLE:" : "সর্বমোট প্রদেয়:", 145, itemY, { align: "right" });
  const finalTotalBdt = convertToBdt(order.totalPrice);
  doc.text(`BDT ${finalTotalBdt.toLocaleString()}`, 185, itemY, { align: "right" });
  doc.setFont(undefined, "normal");

  // Store Signature Section (Placed beautifully above footer)
  if (settings) {
    const signatureY = Math.min(250, Math.max(itemY + 15, 225));
    
    // Draw Authorised Signature line, optional image, and label on the left margin
    if (settings.storeSignatureImage && settings.storeSignatureImage.startsWith("data:image")) {
      try {
        const format = settings.storeSignatureImage.includes("png") ? "PNG" : "JPEG";
        doc.addImage(settings.storeSignatureImage, format, 20, signatureY - 12, 50, 11);
      } catch (e) {
        console.error("Failed to render storeSignatureImage in PDF:", e);
      }
    }
    
    doc.setDrawColor(168, 162, 158); // stone-300
    doc.setLineWidth(0.35);
    doc.line(20, signatureY, 70, signatureY);
    
    doc.setFontSize(8);
    doc.setFont(undefined, "bold");
    doc.setTextColor(68, 64, 60); // stone-700
    doc.text(settings.storeSignatureText || (lang === "en" ? "AUTHORIZED SIGNATURE" : "অনুমোদিত স্বাক্ষর"), 20, signatureY + 4, { align: "left" });
    
    // Draw Receiver Signature line and label on the right margin
    doc.line(135, signatureY, 185, signatureY);
    doc.text(lang === "en" ? "RECEIVER SIGNATURE" : "গ্রাহকের স্বাক্ষর", 185, signatureY + 4, { align: "right" });
    doc.setFont(undefined, "normal");
  }

  // Bottom footer terms
  const footerY = 270;
  doc.setDrawColor(231, 229, 228);
  doc.setLineWidth(0.5);
  doc.line(20, footerY - 5, 190, footerY - 5);

  doc.setFontSize(8);
  doc.setTextColor(120, 113, 108);
  const thankYouText = lang === "en"
    ? "Thank you for shopping at RIEMART.com. For queries contact riemart.bd@gmail.com."
    : "রিয়ামার্ট.কম-এ কেনাকাটা করার জন্য ধন্যবাদ। ডেলিভারি বা তথ্যের জন্য মেইল করুন: riemart.bd@gmail.com";
  doc.text(thankYouText, 105, footerY, { align: "center" });

  doc.setFontSize(7);
  doc.setFont(undefined, "bold");
  doc.setTextColor(168, 162, 158); // stone-300
  doc.text("★ SUPPORTING GENERATIONAL BANGLADESHI ARTISANAL CRAFTS ★", 105, footerY + 5, { align: "center" });

  return doc.output("blob");
};
