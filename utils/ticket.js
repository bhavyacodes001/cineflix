const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');

async function generateQRCode(data) {
  return QRCode.toDataURL(JSON.stringify(data), {
    errorCorrectionLevel: 'M',
    width: 200,
    margin: 2
  });
}

function generateTicketPDF(booking) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const buffers = [];

    doc.on('data', chunk => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const movieTitle = booking.movie?.title || 'Movie';
    const theaterName = booking.theater?.name || 'Theater';
    const theaterCity = booking.theater?.address?.city || '';
    const showDate = booking.showDate
      ? new Date(booking.showDate).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : 'N/A';
    const showTime = booking.showTime || 'N/A';
    const seats = (booking.tickets || []).map(t => `${t.seat.row}${t.seat.number}`).join(', ');
    const seatTypes = (booking.tickets || []).map(t => t.seat.type).join(', ');
    const totalAmount = booking.totalAmount || 0;
    const bookingNumber = booking.bookingNumber || 'N/A';
    const userName = booking.user
      ? `${booking.user.firstName || ''} ${booking.user.lastName || ''}`.trim()
      : 'Guest';

    // --- Header bar ---
    doc.rect(0, 0, doc.page.width, 80).fill('#e50914');
    doc.fontSize(28).fillColor('#fff').text('CinePlex', 50, 25, { align: 'left' });
    doc.fontSize(10).fillColor('rgba(255,255,255,0.8)').text('MOVIE TICKET', 50, 55, { align: 'left' });
    doc.fontSize(12).fillColor('#fff').text(bookingNumber, doc.page.width - 200, 35, { width: 150, align: 'right' });

    // --- Ticket body ---
    const startY = 110;
    doc.roundedRect(40, startY, doc.page.width - 80, 340, 8).lineWidth(1).strokeColor('#e0e0e0').stroke();

    // Movie title
    doc.fontSize(22).fillColor('#1a1a2e').text(movieTitle, 60, startY + 20, { width: doc.page.width - 160 });

    // Divider
    const divY = startY + 60;
    doc.moveTo(60, divY).lineTo(doc.page.width - 60, divY).lineWidth(0.5).strokeColor('#e0e0e0').stroke();

    // Info grid
    const gridY = divY + 15;
    const col1 = 60;
    const col2 = 300;
    const rowH = 50;

    function infoBlock(x, y, label, value) {
      doc.fontSize(9).fillColor('#999').text(label.toUpperCase(), x, y);
      doc.fontSize(13).fillColor('#1a1a2e').text(value, x, y + 14, { width: 200 });
    }

    infoBlock(col1, gridY, 'Date', showDate);
    infoBlock(col2, gridY, 'Time', showTime);
    infoBlock(col1, gridY + rowH, 'Theater', theaterName + (theaterCity ? `, ${theaterCity}` : ''));
    infoBlock(col2, gridY + rowH, 'Seats', seats);
    infoBlock(col1, gridY + rowH * 2, 'Seat Type', seatTypes);
    infoBlock(col2, gridY + rowH * 2, 'Tickets', String(booking.tickets?.length || 0));
    infoBlock(col1, gridY + rowH * 3, 'Booked By', userName);

    // Total amount
    const amountY = gridY + rowH * 3;
    doc.fontSize(9).fillColor('#999').text('TOTAL PAID', col2, amountY);
    doc.fontSize(18).fillColor('#e50914').text(`₹${totalAmount.toFixed(2)}`, col2, amountY + 14);

    // --- Dashed tear line ---
    const tearY = startY + 350 + 20;
    for (let x = 40; x < doc.page.width - 40; x += 8) {
      doc.moveTo(x, tearY).lineTo(x + 4, tearY).lineWidth(1).strokeColor('#ccc').stroke();
    }

    // --- QR section ---
    const qrY = tearY + 15;
    doc.fontSize(10).fillColor('#999').text('Scan at theater entrance', 60, qrY, { align: 'center', width: doc.page.width - 120 });

    if (booking.qrCode) {
      const qrImageData = booking.qrCode.replace(/^data:image\/png;base64,/, '');
      const qrBuffer = Buffer.from(qrImageData, 'base64');
      const qrSize = 120;
      const qrX = (doc.page.width - qrSize) / 2;
      doc.image(qrBuffer, qrX, qrY + 20, { width: qrSize, height: qrSize });
    }

    // --- Footer ---
    const footerY = doc.page.height - 60;
    doc.fontSize(8).fillColor('#999').text(
      'This is a computer-generated ticket. Please present this at the theater entrance.',
      50, footerY, { align: 'center', width: doc.page.width - 100 }
    );
    doc.text(
      `Generated on ${new Date().toLocaleString('en-IN')} | © ${new Date().getFullYear()} CinePlex`,
      50, footerY + 15, { align: 'center', width: doc.page.width - 100 }
    );

    doc.end();
  });
}

module.exports = { generateQRCode, generateTicketPDF };
