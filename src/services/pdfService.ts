import { toJpeg, toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';
import { AdmissionApplication } from '../types';

/**
 * Downloads high-resolution A4 PDF for the admission application.
 * Uses html-to-image with multi-tiered fallback and jsPDF for crisp A4 vector embedding.
 */
export async function downloadApplicationPdf(
  element: HTMLElement,
  application: AdmissionApplication
): Promise<boolean> {
  // 1. Ensure fonts are fully ready
  try {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
  } catch {
    // ignore if font API not supported
  }

  // Small delay to ensure all DOM styles & layout settled
  await new Promise((resolve) => setTimeout(resolve, 150));

  let dataUrl: string | null = null;

  // Options for crisp print rendering
  const renderWidth = element.scrollWidth || 794;
  const renderHeight = element.scrollHeight || 1123;

  // Tier 1: High quality JPEG with skipFonts: true to prevent cross-origin stylesheet errors
  try {
    dataUrl = await toJpeg(element, {
      quality: 0.98,
      pixelRatio: 2.2,
      backgroundColor: '#ffffff',
      cacheBust: false,
      skipFonts: true,
      fontEmbedCSS: '',
      width: renderWidth,
      height: renderHeight,
    });
  } catch (err1) {
    console.warn('PDF gen Tier 1 failed, trying Tier 2 (PNG):', err1);
    // Tier 2: Try toPng with skipFonts
    try {
      dataUrl = await toPng(element, {
        pixelRatio: 1.8,
        backgroundColor: '#ffffff',
        skipFonts: true,
        fontEmbedCSS: '',
        width: renderWidth,
        height: renderHeight,
      });
    } catch (err2) {
      console.error('All rasterization tiers failed:', err2);
      throw new Error('ব্রাউজারে ফরমটির ইমেজ রেন্ডার করা সম্ভব হয়নি। সরাসরি প্রিন্ট বা ইমেজ ডাউনলোড ব্যবহার করুন।');
    }
  }

  if (!dataUrl) {
    throw new Error('ইমেজ ডাটা তৈরি ব্যর্থ হয়েছে।');
  }

  // Create standard A4 portrait PDF (210mm x 297mm)
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pdfWidth = pdf.internal.pageSize.getWidth(); // 210 mm
  const pdfHeight = pdf.internal.pageSize.getHeight(); // 297 mm

  // Load image to determine natural dimensions
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('ইমেজ লোড ব্যর্থ হয়েছে'));
    img.src = dataUrl!;
  });

  const imgAspectRatio = img.width / img.height;
  const pageAspectRatio = pdfWidth / pdfHeight;

  let finalWidth = pdfWidth;
  let finalHeight = pdfHeight;

  if (imgAspectRatio > pageAspectRatio) {
    finalHeight = pdfWidth / imgAspectRatio;
  } else {
    finalHeight = pdfHeight;
    finalWidth = pdfHeight * imgAspectRatio;
  }

  const xOffset = (pdfWidth - finalWidth) / 2;

  pdf.addImage(dataUrl, 'JPEG', xOffset, 0, finalWidth, finalHeight, undefined, 'FAST');

  const fileName = `KMDC_Admission_${application.trackingId}_Roll_${application.sscRoll}.pdf`;
  pdf.save(fileName);
  return true;
}

/**
 * Downloads high-resolution A4 image (JPEG) of the application.
 * Perfect for mobile users and instant photo printing.
 */
export async function downloadApplicationImage(
  element: HTMLElement,
  application: AdmissionApplication
): Promise<boolean> {
  const renderWidth = element.scrollWidth || 794;
  const renderHeight = element.scrollHeight || 1123;

  const dataUrl = await toJpeg(element, {
    quality: 0.98,
    pixelRatio: 2.2,
    backgroundColor: '#ffffff',
    cacheBust: false,
    skipFonts: true,
    fontEmbedCSS: '',
    width: renderWidth,
    height: renderHeight,
  });

  const fileName = `KMDC_Admission_${application.trackingId}_Roll_${application.sscRoll}.jpg`;
  saveAs(dataUrl, fileName);
  return true;
}

/**
 * Executes direct printing using an isolated hidden iframe for clean A4 output.
 * If blocked by browser sandbox/iframe constraints, falls back to window.print().
 */
export function printApplicationElement(
  element: HTMLElement,
  application: AdmissionApplication
): void {
  // Collect all styles from the current document
  let stylesHtml = '';
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
    stylesHtml += node.outerHTML;
  });

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  iframe.style.zIndex = '-9999';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document;
  if (!iframeDoc) {
    window.print();
    return;
  }

  iframeDoc.open();
  iframeDoc.write(`
    <!DOCTYPE html>
    <html lang="bn">
    <head>
      <meta charset="utf-8" />
      <title>KMDC Admission Form - ${application.trackingId} (Roll: ${application.sscRoll})</title>
      ${stylesHtml}
      <style>
        @page {
          size: A4 portrait;
          margin: 6mm 8mm;
        }
        *, *::before, *::after {
          box-sizing: border-box !important;
        }
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          color: #0f172a !important;
          font-family: 'Hind Siliguri', 'Inter', sans-serif !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        #kmdc-printable-a4-form {
          width: 100% !important;
          max-width: 100% !important;
          min-height: auto !important;
          margin: 0 auto !important;
          padding: 0 !important;
          border: none !important;
          box-shadow: none !important;
        }
        .no-print {
          display: none !important;
        }
      </style>
    </head>
    <body>
      ${element.outerHTML}
    </body>
    </html>
  `);
  iframeDoc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.warn('Iframe printing caught error, executing window.print():', err);
      window.print();
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 3000);
    }
  }, 400);
}
