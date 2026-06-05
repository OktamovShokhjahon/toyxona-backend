const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

async function buildExcel(data) {
  const workbook = new ExcelJS.Workbook();
  const summary = workbook.addWorksheet('Xulosa');
  summary.addRow(['Buron — Statistika hisoboti']);
  summary.addRow(['Sana', new Date().toLocaleDateString('uz-UZ')]);
  summary.addRow([]);

  if (data.summaryRows) {
    summary.addRow(['Ko\'rsatkich', 'Qiymat']);
    data.summaryRows.forEach(([k, v]) => summary.addRow([k, v]));
  }

  if (data.bookings?.length) {
    const sheet = workbook.addWorksheet('Bronlar');
    sheet.addRow(['Mijoz', 'Telefon', 'To\'yxona', 'Sana', 'Sessiyalar', 'Holat']);
    data.bookings.forEach((b) => {
      sheet.addRow([
        b.clientName,
        b.clientPhone,
        b.venueName || b.venue?.name || '',
        b.date ? new Date(b.date).toLocaleDateString('uz-UZ') : '',
        (b.sessions || []).join(', '),
        b.status,
      ]);
    });
  }

  if (data.venues?.length) {
    const sheet = workbook.addWorksheet('To\'yxonalar');
    sheet.addRow(['Nomi', 'Viloyat', 'Bronlar', 'Daromad', 'Holat']);
    data.venues.forEach((v) => {
      sheet.addRow([v.name, v.region || '', v.bookings || 0, v.revenue || 0, v.status || '']);
    });
  }

  return workbook.xlsx.writeBuffer();
}

function buildPdf(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).text('Buron — Statistika', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Sana: ${new Date().toLocaleDateString('uz-UZ')}`);
    doc.moveDown();

    if (data.title) {
      doc.fontSize(14).text(data.title);
      doc.moveDown();
    }

    if (data.summaryRows) {
      data.summaryRows.forEach(([k, v]) => {
        doc.fontSize(11).text(`${k}: ${v}`);
      });
      doc.moveDown();
    }

    if (data.bookings?.length) {
      doc.fontSize(12).text('Bronlar:', { underline: true });
      doc.moveDown(0.5);
      data.bookings.slice(0, 30).forEach((b) => {
        doc.fontSize(9).text(
          `${b.clientName} | ${b.venueName || ''} | ${new Date(b.date).toLocaleDateString('uz-UZ')} | ${b.status}`
        );
      });
    }

    doc.end();
  });
}

module.exports = { buildExcel, buildPdf };
