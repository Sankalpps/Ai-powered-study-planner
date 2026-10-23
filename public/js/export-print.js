/**
 * @fileoverview Export / Print Handler
 * @module export-print
 */

/**
 * Triggers the browser's native print dialog for PDF export.
 */
function handleExportPrint() {
  window.print();
}

/**
 * Initializes button listener for PDF / print export.
 */
function initExportPrintListener() {
  const btn = document.getElementById('btn-export-pdf');
  if (btn) {
    btn.addEventListener('click', handleExportPrint);
  }
}
