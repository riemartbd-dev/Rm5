import fs from 'fs';

try {
  let content = fs.readFileSync('src/App.tsx', 'utf8');
  console.log('Original content size:', content.length);
  
  // Find start marker (the footer actions of the Modal dialog)
  const startIdx = content.indexOf('{/* Add to buy buttons row inside dialog */}');
  
  // Find the first occurrence of the Account text in the header where the collision happened
  const endIdx = content.indexOf('<span>{lang === "en" ? "Account" : "অ্যাকাউন্ট"}</span>');
  
  if (startIdx !== -1 && endIdx !== -1) {
    console.log('Found startIdx:', startIdx, 'endIdx:', endIdx);
    
    const endLength = '<span>{lang === "en" ? "Account" : "অ্যাকাউন্ট"}</span>'.length;
    
    const replacement = `{/* Add to buy buttons row inside dialog */}
              <div className="flex gap-2.5 items-center border-t border-stone-200 pt-5">
                {selectedProduct.inventory > 0 ? (
                  <button
                    onClick={() => {
                      addToCart(selectedProduct, 1);
                      setSelectedProduct(null);
                    }}
                    className="flex-1 bg-stone-900 hover:bg-stone-850 text-white text-xs font-mono font-bold py-3 uppercase rounded-sm tracking-wider flex items-center justify-center gap-1.5 cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-all"
                    id="modal-add-to-bag"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>{DICTIONARY[lang].addToBag}</span>
                  </button>
                ) : (
                  <button
                    disabled
                    className="flex-1 bg-stone-200 text-stone-400 text-xs font-mono py-3 uppercase rounded-sm cursor-not-allowed"
                    id="modal-sold-out-status"
                  >
                    RESERVES DEPLETED
                  </button>
                )}

                {/* Wishlist toggle button inside modal */}
                <button
                  type="button"
                  onClick={() => {
                    toggleWishlist(selectedProduct);
                  }}
                  className={\`px-4 py-3 border rounded-sm transition-all flex items-center justify-center gap-2 text-xs font-mono font-bold uppercase cursor-pointer \${
                    wishlist.some((item) => item.id === selectedProduct.id)
                      ? "bg-red-50 hover:bg-red-105 text-red-610 border-red-200"
                      : "bg-stone-50 hover:bg-stone-100 text-stone-800 border-stone-200"
                  }\`}
                  id="modal-toggle-wishlist"
                  title={wishlist.some((item) => item.id === selectedProduct.id) ? DICTIONARY[lang].removeFromWishlist : DICTIONARY[lang].addToWishlist}
                >
                  <Heart className={\`w-4 h-4 \${wishlist.some((item) => item.id === selectedProduct.id) ? "fill-red-500 text-red-500" : "text-stone-605"}\`} />
                  <span className="hidden sm:inline">
                    {wishlist.some((item) => item.id === selectedProduct.id)
                      ? DICTIONARY[lang].removeFromWishlist
                      : DICTIONARY[lang].addToWishlist}
                  </span>
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* ==================== HEADER ==================== */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-stone-200/60 print:hidden" id="navigation-deck">
        <div className="max-w-7xl mx-auto px-4 h-16 sm:h-20 flex items-center justify-between gap-4">
          
          {/* Logo / Title brand */}
          <div className="flex items-center gap-2 sm:gap-3 cursor-pointer select-none" onClick={() => { setSelectedCategory("All"); setSelectedSubCategory(null); setShowAdminPortal(false); }}>
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-stone-900 flex items-center justify-center rounded-sm text-white font-serif font-bold text-lg border border-amber-500/30 shadow-md">
              R
            </div>
            <div>
              <h1 className="font-display font-medium text-xs sm:text-sm tracking-[0.2em] text-stone-900 uppercase">
                RIEMART
              </h1>
              <p className="text-[8px] sm:text-[9px] font-mono tracking-widest text-stone-400 uppercase mt-0.5">
                CRESCENT LUXURY STUDIO
              </p>
            </div>
          </div>

          {/* Search bar & triggers */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Lang switcher */}
            <button
              onClick={() => setLang(lang === "en" ? "bn" : "en")}
              className="bg-stone-100 hover:bg-stone-200 text-stone-800 text-[10px] font-mono px-2.5 py-1.5 rounded-sm transition-colors border border-stone-200 cursor-pointer"
              id="lang-switcher"
            >
              {lang === "en" ? "বাং" : "EN"}
            </button>

            {/* Account trigger */}
            <button
              onClick={() => {
                if (loggedInUser) {
                  setIsAccountOpen(true);
                  setAccountActiveTab("orders");
                } else {
                  setIsAuthOpen(true);
                }
              }}
              className="relative bg-white hover:bg-stone-100 text-stone-900 border border-stone-200 px-3 py-2 text-xs font-mono tracking-wider transition-colors flex items-center gap-1.5 rounded-sm shadow-sm cursor-pointer"
              id="desktop-account-trigger"
            >
              <User className="w-4 h-4 text-stone-605" />
              <span className="hidden sm:inline">
                {loggedInUser ? (
                  <span className="truncate max-w-[80px] inline-block align-bottom font-bold">
                    {loggedInUser.name.split(" ")[0]}
                  </span>
                ) : (
                  <span>
                    {/* RESTORED HEAD */}
                    <span>{lang === "en" ? "Account" : "অ্যাকাউন্ট"}</span>`;
                    
    content = content.substring(0, startIdx) + replacement + content.substring(endIdx + endLength);
    fs.writeFileSync('src/App.tsx', content, 'utf8');
    console.log('REPAIR COMPLETED SUCCESSFULLY.');
  } else {
    console.log('REPAIR ERROR: Start or End index not found.', startIdx, endIdx);
  }
} catch (err) {
  console.error('REPAIR CRITICAL ERROR:', err);
}
