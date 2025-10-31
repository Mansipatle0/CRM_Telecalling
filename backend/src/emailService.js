// src/emailService.js
const nodemailer = require("nodemailer");

// configure Gmail SMTP (use App Password, not your normal one)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "your_email@gmail.com",
    pass: "your_app_password", // <-- replace with your Gmail App Password
  },
});

async function sendCampaignEmail(to, campaignId, subject, message) {
  const trackingPixel = `<img src="http://localhost:4000/api/campaigns/${campaignId}/open" width="1" height="1" />`;

  const htmlBody = `
    <h2>${subject}</h2>
    <p>${message}</p>
    ${trackingPixel}
  `;

  await transporter.sendMail({
    from: '"Your CRM" <your_email@gmail.com>',
    to,
    subject,
    html: htmlBody,
  });

  console.log("✅ Email sent to:", to);
}

module.exports = { sendCampaignEmail };
