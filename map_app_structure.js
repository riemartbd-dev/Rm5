import fs from 'fs';

try {
  const content = fs.readFileSync('src/App.tsx', 'utf8');
  const lines = content.split('\n');

  function findText(pattern) {
    const linesFound = [];
    lines.forEach((line, idx) => {
      if (line.includes(pattern)) {
        linesFound.push(idx + 1);
      }
    });
    console.log(`- Occurrences of "${pattern}":`, linesFound.join(', '));
  }

  console.log('=== Structural occurrences inside App.tsx ===');
  findText('atelier-control-room-dashboard');
  findText('add-new-product');
  findText('showCheckoutForm');
  findText('paymentSender');
  findText('invoice-print-receipt');
  findText('showAdminPortal');

} catch (err) {
  console.error(err);
}
