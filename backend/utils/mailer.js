const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: process.env.MAIL_PORT,
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

async function sendMail({ to, subject, html }) {
  return transporter.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject,
    html,
  });
}

async function sendPasswordReset(email, name, resetToken) {
  const url = `${process.env.APP_URL}/reset-password?token=${resetToken}`;
  return sendMail({
    to: email,
    subject: 'Reset your EduClass password',
    html: `
      <p>Hi ${name},</p>
      <p>You requested a password reset. Click the link below to set a new password. This link expires in 1 hour.</p>
      <p><a href="${url}">${url}</a></p>
      <p>If you did not request this, you can safely ignore this email.</p>
      <p>— The EduClass team</p>
    `,
  });
}

async function sendAbsenceAlert(parentEmail, parentName, studentName, date, subjects) {
  return sendMail({
    to: parentEmail,
    subject: `Absence notice — ${studentName}`,
    html: `
      <p>Dear ${parentName},</p>
      <p>${studentName} was marked absent on <strong>${date}</strong> for the following subject(s): <strong>${subjects.join(', ')}</strong>.</p>
      <p>Please log in to EduClass for more details or contact the school directly.</p>
      <p>— EduClass Attendance System</p>
    `,
  });
}

module.exports = { sendMail, sendPasswordReset, sendAbsenceAlert };
