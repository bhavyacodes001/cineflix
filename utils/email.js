const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.EMAIL_HOST;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!host || !user || !pass) {
    console.warn('Email not configured. Set EMAIL_HOST, EMAIL_USER, EMAIL_PASS in .env');
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: (process.env.EMAIL_PORT || '587') === '465',
    auth: { user, pass }
  });

  return transporter;
}

function formatCurrency(amount) {
  return `₹${amount.toFixed(2)}`;
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

function baseTemplate(title, content) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#e50914,#b20710);padding:24px 32px;border-radius:12px 12px 0 0;text-align:center;">
      <div style="font-size:28px;font-weight:bold;color:#fff;letter-spacing:-0.5px;">🎬 CinePlex</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.8);letter-spacing:1px;text-transform:uppercase;margin-top:4px;">Movie Experience</div>
    </div>
    <!-- Body -->
    <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
      <h2 style="color:#1a1a2e;margin:0 0 20px;font-size:22px;">${title}</h2>
      ${content}
    </div>
    <!-- Footer -->
    <div style="text-align:center;padding:20px;color:#999;font-size:12px;">
      <p>&copy; ${new Date().getFullYear()} CinePlex. All rights reserved.</p>
      <p>This is an automated email. Please do not reply.</p>
    </div>
  </div>
</body>
</html>`;
}

async function sendEmail(to, subject, html) {
  const t = getTransporter();
  if (!t) {
    console.log(`[Email skipped — not configured] To: ${to}, Subject: ${subject}`);
    return { skipped: true };
  }

  try {
    const info = await t.sendMail({
      from: `"CinePlex" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    });
    console.log(`[Email sent] To: ${to}, MessageId: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error(`[Email failed] To: ${to}, Error: ${err.message}`);
    throw err;
  }
}

async function sendBookingConfirmation(booking) {
  const seats = booking.tickets.map(t => `${t.seat.row}${t.seat.number} (${t.seat.type})`).join(', ');

  const content = `
    <p style="color:#555;line-height:1.6;">Your booking has been confirmed! Here are your details:</p>

    <div style="background:#f8f9fa;border-radius:8px;padding:20px;margin:20px 0;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0;color:#888;font-size:13px;">Booking Number</td>
          <td style="padding:8px 0;font-weight:bold;color:#1a1a2e;text-align:right;font-size:15px;">${booking.bookingNumber}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#888;font-size:13px;">Movie</td>
          <td style="padding:8px 0;font-weight:600;color:#1a1a2e;text-align:right;">${booking.movie?.title || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#888;font-size:13px;">Theater</td>
          <td style="padding:8px 0;color:#1a1a2e;text-align:right;">${booking.theater?.name || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#888;font-size:13px;">Date &amp; Time</td>
          <td style="padding:8px 0;color:#1a1a2e;text-align:right;">${formatDate(booking.showDate)} at ${booking.showTime}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#888;font-size:13px;">Seats</td>
          <td style="padding:8px 0;color:#1a1a2e;text-align:right;">${seats}</td>
        </tr>
        <tr style="border-top:1px solid #e0e0e0;">
          <td style="padding:12px 0 8px;color:#888;font-size:13px;font-weight:bold;">Total Paid</td>
          <td style="padding:12px 0 8px;font-weight:bold;color:#e50914;text-align:right;font-size:18px;">${formatCurrency(booking.totalAmount)}</td>
        </tr>
      </table>
    </div>

    <div style="background:#e8f5e9;border-radius:8px;padding:16px;margin:20px 0;text-align:center;">
      <span style="font-size:24px;">✅</span>
      <p style="color:#2e7d32;margin:8px 0 0;font-weight:600;">Payment Successful</p>
    </div>

    <p style="color:#555;font-size:13px;line-height:1.6;">
      Please arrive at the theater at least 15 minutes before the showtime. Show your booking number or QR code at the entrance.
    </p>`;

  const email = booking.user?.email;
  if (!email) return;

  return sendEmail(email, `Booking Confirmed — ${booking.bookingNumber}`, baseTemplate('Booking Confirmed! 🎬', content));
}

async function sendCancellationEmail(booking) {
  const content = `
    <p style="color:#555;line-height:1.6;">Your booking has been cancelled. Here are the details:</p>

    <div style="background:#fff3f3;border-radius:8px;padding:20px;margin:20px 0;border-left:4px solid #e50914;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0;color:#888;font-size:13px;">Booking Number</td>
          <td style="padding:8px 0;font-weight:bold;color:#1a1a2e;text-align:right;">${booking.bookingNumber}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#888;font-size:13px;">Movie</td>
          <td style="padding:8px 0;color:#1a1a2e;text-align:right;">${booking.movie?.title || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#888;font-size:13px;">Cancelled By</td>
          <td style="padding:8px 0;color:#1a1a2e;text-align:right;">${booking.cancellation?.cancelledBy || 'user'}</td>
        </tr>
        <tr style="border-top:1px solid #e0e0e0;">
          <td style="padding:12px 0 8px;color:#888;font-size:13px;font-weight:bold;">Refund Amount</td>
          <td style="padding:12px 0 8px;font-weight:bold;color:#2e7d32;text-align:right;font-size:18px;">${formatCurrency(booking.cancellation?.refundAmount || 0)}</td>
        </tr>
      </table>
    </div>

    <p style="color:#555;font-size:13px;line-height:1.6;">
      ${booking.cancellation?.refundAmount > 0
        ? 'Your refund will be processed within 5-7 business days to your original payment method.'
        : 'No refund is applicable for this cancellation.'}
    </p>`;

  const email = booking.user?.email;
  if (!email) return;

  return sendEmail(email, `Booking Cancelled — ${booking.bookingNumber}`, baseTemplate('Booking Cancelled', content));
}

async function sendPasswordResetEmail(user, resetToken) {
  const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

  const content = `
    <p style="color:#555;line-height:1.6;">We received a request to reset your password. Click the button below to create a new password:</p>

    <div style="text-align:center;margin:30px 0;">
      <a href="${resetUrl}" style="background:linear-gradient(135deg,#e50914,#b20710);color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block;">
        Reset Password
      </a>
    </div>

    <p style="color:#999;font-size:13px;line-height:1.6;">
      This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
    </p>
    <p style="color:#999;font-size:12px;word-break:break-all;">
      Or copy this link: ${resetUrl}
    </p>`;

  return sendEmail(user.email, 'Reset Your CinePlex Password', baseTemplate('Password Reset', content));
}

async function sendBookingReminder(booking) {
  const content = `
    <p style="color:#555;line-height:1.6;">This is a reminder for your upcoming movie!</p>

    <div style="background:#f0f4ff;border-radius:8px;padding:20px;margin:20px 0;text-align:center;">
      <div style="font-size:32px;margin-bottom:8px;">🍿</div>
      <div style="font-size:18px;font-weight:bold;color:#1a1a2e;">${booking.movie?.title || 'Your Movie'}</div>
      <div style="color:#666;margin-top:8px;">${formatDate(booking.showDate)} at ${booking.showTime}</div>
      <div style="color:#666;margin-top:4px;">${booking.theater?.name || ''}</div>
      <div style="margin-top:12px;padding:8px 16px;background:#fff;border-radius:6px;display:inline-block;">
        <span style="color:#888;font-size:13px;">Booking: </span>
        <span style="font-weight:bold;color:#e50914;">${booking.bookingNumber}</span>
      </div>
    </div>

    <p style="color:#555;font-size:13px;line-height:1.6;">
      Don't forget to arrive at the theater at least 15 minutes early. Enjoy the show!
    </p>`;

  const email = booking.user?.email;
  if (!email) return;

  return sendEmail(email, `Reminder: ${booking.movie?.title || 'Movie'} Today!`, baseTemplate('Movie Reminder 🍿', content));
}

module.exports = {
  sendEmail,
  sendBookingConfirmation,
  sendCancellationEmail,
  sendPasswordResetEmail,
  sendBookingReminder
};
