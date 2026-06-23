import fs from 'fs';

try {
  const content = fs.readFileSync('src/App.tsx', 'utf8');
  const lines = content.split('\n');

  console.log('Original App.tsx total lines:', lines.length);

  // 1. PreLayout (Lines 1 to 1595)
  // This contains all imports, interfaces, states, and event handlers.
  const preLayout = lines.slice(0, 1595).join('\n');

  // 2. ShopLayout (Lines 1596 to 4517)
  // This contains the main storefront view, categories, products list, and product details modal.
  const shopLayout = lines.slice(1595, 4517).join('\n');

  // 3. Cart Drawer (Lines 10150 to 10815)
  // This contains the complete Cart Drawer code.
  // Note: we need to repair the checkout form in this section!
  const cartDrawerLines = lines.slice(10149, 10815);
  
  // Let's print out the slice indices to make sure we're clean
  console.log('Cart Drawer start block:', cartDrawerLines[0]);
  console.log('Cart Drawer end block:', cartDrawerLines[cartDrawerLines.length - 1]);

  // Let's repair the checkout form inside cartDrawerLines.
  // The corridor line numbers in the original file were around 10412-10445.
  // Relative to the slice (starting at index 10149), 10412 - 10149 = 263.
  // Let's search inside the slice for indices that match the beginning and end of the corruption.
  let startIndex = -1;
  let endIndex = -1;

  for (let i = 0; i < cartDrawerLines.length; i++) {
    if (cartDrawerLines[i].includes('SECURE CHECKOUT COORDINATES FORM')) {
      startIndex = i;
    }
    // We want to find the end of corruption which lies right before <div className="space-y-2.5 text-xs text-left">
    if (cartDrawerLines[i].includes('space-y-2.5 text-xs text-left')) {
      endIndex = i;
    }
  }

  console.log('Found SECURE CHECKOUT COORDINATES FORM index:', startIndex);
  console.log('Found space-y-2.5 index:', endIndex);

  if (startIndex !== -1 && endIndex !== -1) {
    // Let's replace the corruption in the list:
    const startPart = cartDrawerLines.slice(0, startIndex + 1);
    const endPart = cartDrawerLines.slice(endIndex);

    // Wait! Inside startPart, the next line is the beginning of showCheckoutForm, which needs to be opened correctly.
    // Let's construct a clean checkout form header:
    const cleanFormHeader = [
      '                {showCheckoutForm && (',
      '                  <form onSubmit={handlePlaceOrder} className="p-4 bg-white border border-stone-200 rounded-sm space-y-3 mt-4 text-left" id="secure-checkout-form">'
    ];

    const repairedCartDrawer = [...startPart, ...cleanFormHeader, ...endPart].join('\n');
    
    // 4. Account Drawer (Lines 10816 to 11620)
    const accountDrawer = lines.slice(10815, 11620).join('\n');

    // 5. Price Drop Modal (Lines 11621 to 11740)
    const priceDropModal = lines.slice(11620, 11740).join('\n');

    // 6. Print Order Modal (Lines 11741 to 12058)
    const printOrderModal = lines.slice(11740, 12058).join('\n');

    // Stitching it all together inside the main outer return statement
    const completeAppCode = [
      preLayout,
      shopLayout,
      repairedCartDrawer,
      accountDrawer,
      priceDropModal,
      printOrderModal,
      '      {/* End main container */}',
      '    </div>',
      '  );',
      '}'
    ].join('\n');

    fs.writeFileSync('src/App.tsx', completeAppCode, 'utf8');
    console.log('SUCCESS: src/App.tsx has been reconstructed cleanly!');
  } else {
    console.error('ERROR: Could not find corruption indices in CartDrawer block!');
  }

} catch (err) {
  console.error(err);
}
