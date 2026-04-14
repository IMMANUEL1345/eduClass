const sgMail = require('@sendgrid/mail');
require('dotenv').config();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const FROM = process.env.MAIL_FROM || 'EduClass <educlass141@gmail.com>';

// ── Base template ─────────────────────────────────────────
function baseTemplate(content) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background:#f8f8f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
  .wrap{max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e5e3}
  .header{background:#2563eb;padding:28px 32px}
  .logo-text{color:#fff;font-size:18px;font-weight:700}
  .logo-icon{display:inline-block;background:#fff;border-radius:8px;width:32px;height:32px;text-align:center;line-height:32px;margin-right:10px;font-weight:800;color:#2563eb;font-size:16px}
  .body{padding:32px}
  .title{font-size:20px;font-weight:600;color:#1a1a1a;margin:0 0 8px}
  .subtitle{font-size:14px;color:#888;margin:0 0 24px}
  .card{background:#f8f8f7;border-radius:12px;padding:20px 24px;margin:20px 0}
  .card-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;font-size:14px}
  .card-row:last-child{border-bottom:none}
  .card-label{color:#888}
  .card-value{color:#1a1a1a;font-weight:500}
  .btn{display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:600;margin:20px 0}
  .divider{border:none;border-top:1px solid #eee;margin:24px 0}
  .text{font-size:14px;color:#444;line-height:1.7;margin:12px 0}
  .alert{background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;padding:14px 18px;font-size:13px;color:#92400e;margin:16px 0}
  .footer{background:#f8f8f7;padding:20px 32px;text-align:center;font-size:12px;color:#aaa;border-top:1px solid #eee}
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <span class="logo-icon">E</span><span class="logo-text">EduClass</span>
  </div>
  <div class="body">${content}</div>
  <div class="footer">
    EduClass &mdash; School Management System<br>
    Faculty of Engineering &middot; Department of ICT &middot; BSc Information Technology<br>
    <span style="color:#ccc">This is an automated email. Please do not reply.</span>
  </div>
</div>
</body>
</html>`;
}

async function sendMail({ to, subject, html }) {
  try {
    await sgMail.send({ from: FROM, to, subject, html });
    console.log(`Email sent to ${to}: ${subject}`);
  } catch (err) {
    console.error('Email send error:', err.response?.body || err.message);
  }
}

// ── 1. Welcome email (admin creates account) ─────────────
async function sendWelcomeEmail(email, name, role, tempPassword) {
  const loginUrl  = `${process.env.APP_URL}/login`;
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  await sendMail({
    to: email,
    subject: 'Your EduClass account is ready',
    html: baseTemplate(`
      <p class="title">Welcome to EduClass, ${name}!</p>
      <p class="subtitle">Your ${roleLabel} account has been created.</p>
      <p class="text">Your school administrator has created an account for you. Here are your login details:</p>
      <div class="card">
        <div class="card-row"><span class="card-label">Email</span><span class="card-value">${email}</span></div>
        <div class="card-row"><span class="card-label">Temporary password</span><span class="card-value">${tempPassword}</span></div>
        <div class="card-row"><span class="card-label">Role</span><span class="card-value">${roleLabel}</span></div>
      </div>
      <div class="alert">⚠️ You will be required to change your password on your first login.</div>
      <a href="${loginUrl}" class="btn">Sign in to EduClass</a>
      <hr class="divider">
      <p class="text" style="color:#aaa;font-size:13px">If you did not expect this email, contact your school administrator.</p>
    `),
  });
}

// ── 2. Parent self-registration confirmation ─────────────
async function sendRegistrationConfirmation(email, name) {
  const loginUrl = `${process.env.APP_URL}/login`;
  await sendMail({
    to: email,
    subject: 'Welcome to EduClass — Account created',
    html: baseTemplate(`
      <p class="title">Account created successfully!</p>
      <p class="subtitle">Welcome to EduClass, ${name}</p>
      <p class="text">Your parent account has been created. You can now sign in and view your child's academic progress, attendance and reports.</p>
      <div class="card">
        <div class="card-row"><span class="card-label">Email</span><span class="card-value">${email}</span></div>
        <div class="card-row"><span class="card-label">Role</span><span class="card-value">Parent</span></div>
      </div>
      <p class="text">Please contact your school administrator to link your account to your child.</p>
      <a href="${loginUrl}" class="btn">Sign in to EduClass</a>
    `),
  });
}

// ── 3. Admin notification of new parent registration ─────
async function sendNewParentNotification(adminEmail, parentName, parentEmail) {
  const usersUrl = `${process.env.APP_URL}/users`;
  await sendMail({
    to: adminEmail,
    subject: `New parent registration: ${parentName}`,
    html: baseTemplate(`
      <p class="title">New parent account registered</p>
      <p class="text">A new parent has registered on EduClass and needs to be linked to their child.</p>
      <div class="card">
        <div class="card-row"><span class="card-label">Name</span><span class="card-value">${parentName}</span></div>
        <div class="card-row"><span class="card-label">Email</span><span class="card-value">${parentEmail}</span></div>
      </div>
      <a href="${usersUrl}" class="btn">Go to User Management</a>
    `),
  });
}

// ── 4. Announcement email ─────────────────────────────────
async function sendAnnouncementEmail(email, recipientName, announcementTitle, announcementBody, authorName) {
  const appUrl = `${process.env.APP_URL}/announcements`;
  await sendMail({
    to: email,
    subject: `EduClass: ${announcementTitle}`,
    html: baseTemplate(`
      <p class="title">New announcement</p>
      <p class="subtitle">From ${authorName}</p>
      <div class="card">
        <p style="font-size:16px;font-weight:600;color:#1a1a1a;margin:0 0 10px">${announcementTitle}</p>
        <p style="font-size:14px;color:#444;line-height:1.7;margin:0">${announcementBody}</p>
      </div>
      <a href="${appUrl}" class="btn">View in EduClass</a>
    `),
  });
}

// ── 5. Password reset ─────────────────────────────────────
async function sendPasswordReset(email, name, resetToken) {
  const url = `${process.env.APP_URL}/reset-password?token=${resetToken}`;
  await sendMail({
    to: email,
    subject: 'Reset your EduClass password',
    html: baseTemplate(`
      <p class="title">Reset your password</p>
      <p class="subtitle">Hi ${name}</p>
      <p class="text">You requested a password reset. Click the button below. This link expires in 1 hour.</p>
      <a href="${url}" class="btn">Reset password</a>
      <hr class="divider">
      <p class="text" style="color:#aaa;font-size:13px">If you did not request this, ignore this email.</p>
    `),
  });
}

// ── 6. Absence alert ──────────────────────────────────────
async function sendAbsenceAlert(parentEmail, parentName, studentName, date, subjects) {
  const appUrl = `${process.env.APP_URL}/dashboard`;
  await sendMail({
    to: parentEmail,
    subject: `Absence notice — ${studentName}`,
    html: baseTemplate(`
      <p class="title">Absence notice</p>
      <p class="subtitle">Dear ${parentName}</p>
      <p class="text"><strong>${studentName}</strong> was marked absent on <strong>${date}</strong>.</p>
      <div class="card">
        <div class="card-row"><span class="card-label">Student</span><span class="card-value">${studentName}</span></div>
        <div class="card-row"><span class="card-label">Date</span><span class="card-value">${date}</span></div>
        <div class="card-row"><span class="card-label">Subject(s)</span><span class="card-value">${subjects.join(', ')}</span></div>
      </div>
      <a href="${appUrl}" class="btn">View in EduClass</a>
    `),
  });
}

module.exports = {
  sendMail,
  sendWelcomeEmail,
  sendRegistrationConfirmation,
  sendNewParentNotification,
  sendAnnouncementEmail,
  sendPasswordReset,
  sendAbsenceAlert,
};