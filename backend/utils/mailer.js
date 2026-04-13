const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host:   process.env.MAIL_HOST,
  port:   parseInt(process.env.MAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  tls: { rejectUnauthorized: false },
});

// ── Base template ─────────────────────────────────────────
function baseTemplate(title, content) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { margin:0; padding:0; background:#f8f8f7; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
  .wrap { max-width:560px; margin:40px auto; background:#fff; border-radius:16px; overflow:hidden; border:1px solid #e5e5e3; }
  .header { background:#2563eb; padding:28px 32px; }
  .header-logo { display:flex; align-items:center; gap:10px; }
  .logo-icon { width:36px; height:36px; background:#fff; border-radius:8px; display:flex; align-items:center; justify-content:center; }
  .logo-text { color:#fff; font-size:18px; font-weight:700; }
  .body { padding:32px; }
  .title { font-size:20px; font-weight:600; color:#1a1a1a; margin:0 0 8px; }
  .subtitle { font-size:14px; color:#888; margin:0 0 24px; }
  .card { background:#f8f8f7; border-radius:12px; padding:20px 24px; margin:20px 0; }
  .card-row { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #eee; font-size:14px; }
  .card-row:last-child { border-bottom:none; }
  .card-label { color:#888; }
  .card-value { color:#1a1a1a; font-weight:500; }
  .btn { display:inline-block; background:#2563eb; color:#fff; text-decoration:none; padding:12px 28px; border-radius:10px; font-size:14px; font-weight:600; margin:20px 0; }
  .divider { border:none; border-top:1px solid #eee; margin:24px 0; }
  .text { font-size:14px; color:#444; line-height:1.7; margin:12px 0; }
  .alert { background:#fef3c7; border:1px solid #fcd34d; border-radius:10px; padding:14px 18px; font-size:13px; color:#92400e; margin:16px 0; }
  .footer { background:#f8f8f7; padding:20px 32px; text-align:center; font-size:12px; color:#aaa; border-top:1px solid #eee; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <div class="header-logo">
      <div class="logo-icon"><span style="color:#2563eb;font-weight:800;font-size:16px">E</span></div>
      <span class="logo-text">EduClass</span>
    </div>
  </div>
  <div class="body">
    ${content}
  </div>
  <div class="footer">
    EduClass &mdash; School Management System<br>
    Faculty of Engineering &middot; Department of ICT &middot; BSc Information Technology<br>
    <span style="color:#ccc">This is an automated email. Please do not reply.</span>
  </div>
</div>
</body>
</html>`;
}

// ── Send helper ───────────────────────────────────────────
async function sendMail({ to, subject, html }) {
  try {
    await transporter.sendMail({ from: process.env.MAIL_FROM, to, subject, html });
  } catch (err) {
    console.error('Email send error:', err.message);
    // Don't throw — email failure should not break the request
  }
}

// ── 1. Welcome email (account created by admin) ───────────
async function sendWelcomeEmail(email, name, role, tempPassword) {
  const loginUrl = `${process.env.APP_URL}/login`;
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  const html = baseTemplate('Welcome to EduClass', `
    <p class="title">Welcome to EduClass, ${name}!</p>
    <p class="subtitle">Your ${roleLabel} account has been created.</p>
    <p class="text">Your school administrator has created an account for you on EduClass. Here are your login details:</p>
    <div class="card">
      <div class="card-row"><span class="card-label">Email</span><span class="card-value">${email}</span></div>
      <div class="card-row"><span class="card-label">Temporary password</span><span class="card-value">${tempPassword}</span></div>
      <div class="card-row"><span class="card-label">Role</span><span class="card-value">${roleLabel}</span></div>
    </div>
    <div class="alert">
      ⚠️ You will be required to change your password on your first login. Please keep this email secure.
    </div>
    <a href="${loginUrl}" class="btn">Sign in to EduClass</a>
    <hr class="divider">
    <p class="text" style="color:#aaa;font-size:13px">If you did not expect this email, please contact your school administrator.</p>
  `);
  await sendMail({ to: email, subject: 'Your EduClass account is ready', html });
}

// ── 2. Parent self-registration confirmation ──────────────
async function sendRegistrationConfirmation(email, name) {
  const loginUrl = `${process.env.APP_URL}/login`;
  const html = baseTemplate('Registration Successful', `
    <p class="title">Account created successfully!</p>
    <p class="subtitle">Welcome to EduClass, ${name}</p>
    <p class="text">Your parent account has been created. You can now sign in and view your child's academic progress, attendance and reports.</p>
    <div class="card">
      <div class="card-row"><span class="card-label">Email</span><span class="card-value">${email}</span></div>
      <div class="card-row"><span class="card-label">Role</span><span class="card-value">Parent</span></div>
    </div>
    <p class="text">Please contact your school administrator to link your account to your child.</p>
    <a href="${loginUrl}" class="btn">Sign in to EduClass</a>
  `);
  await sendMail({ to: email, subject: 'Welcome to EduClass — Account created', html });
}

// ── 3. Admin notification of new parent registration ─────
async function sendNewParentNotification(adminEmail, parentName, parentEmail) {
  const usersUrl = `${process.env.APP_URL}/users`;
  const html = baseTemplate('New Parent Registration', `
    <p class="title">New parent account registered</p>
    <p class="subtitle">Action may be required</p>
    <p class="text">A new parent has registered on EduClass and needs to be linked to their child.</p>
    <div class="card">
      <div class="card-row"><span class="card-label">Name</span><span class="card-value">${parentName}</span></div>
      <div class="card-row"><span class="card-label">Email</span><span class="card-value">${parentEmail}</span></div>
    </div>
    <p class="text">Go to User Management to review and link this parent to their child.</p>
    <a href="${usersUrl}" class="btn">Go to User Management</a>
  `);
  await sendMail({ to: adminEmail, subject: `New parent registration: ${parentName}`, html });
}

// ── 4. Announcement email ─────────────────────────────────
async function sendAnnouncementEmail(email, recipientName, announcementTitle, announcementBody, authorName) {
  const appUrl = `${process.env.APP_URL}/announcements`;
  const html = baseTemplate('New Announcement', `
    <p class="title">New announcement</p>
    <p class="subtitle">From ${authorName}</p>
    <div class="card">
      <p style="font-size:16px;font-weight:600;color:#1a1a1a;margin:0 0 10px">${announcementTitle}</p>
      <p style="font-size:14px;color:#444;line-height:1.7;margin:0">${announcementBody}</p>
    </div>
    <a href="${appUrl}" class="btn">View in EduClass</a>
  `);
  await sendMail({ to: email, subject: `EduClass: ${announcementTitle}`, html });
}

// ── 5. Password reset ─────────────────────────────────────
async function sendPasswordReset(email, name, resetToken) {
  const url = `${process.env.APP_URL}/reset-password?token=${resetToken}`;
  const html = baseTemplate('Password Reset', `
    <p class="title">Reset your password</p>
    <p class="subtitle">Hi ${name}</p>
    <p class="text">You requested a password reset. Click the button below to set a new password. This link expires in 1 hour.</p>
    <a href="${url}" class="btn">Reset password</a>
    <hr class="divider">
    <p class="text" style="color:#aaa;font-size:13px">If you did not request this, you can safely ignore this email. Your password will not change.</p>
  `);
  await sendMail({ to: email, subject: 'Reset your EduClass password', html });
}

// ── 6. Absence alert ──────────────────────────────────────
async function sendAbsenceAlert(parentEmail, parentName, studentName, date, subjects) {
  const appUrl = `${process.env.APP_URL}/dashboard`;
  const html = baseTemplate('Absence Notice', `
    <p class="title">Absence notice</p>
    <p class="subtitle">Dear ${parentName}</p>
    <p class="text">This is to inform you that <strong>${studentName}</strong> was marked absent on <strong>${date}</strong>.</p>
    <div class="card">
      <div class="card-row"><span class="card-label">Student</span><span class="card-value">${studentName}</span></div>
      <div class="card-row"><span class="card-label">Date</span><span class="card-value">${date}</span></div>
      <div class="card-row"><span class="card-label">Subject(s)</span><span class="card-value">${subjects.join(', ')}</span></div>
    </div>
    <p class="text">Please log in to EduClass for more details or contact the school directly if this is an error.</p>
    <a href="${appUrl}" class="btn">View in EduClass</a>
  `);
  await sendMail({ to: parentEmail, subject: `Absence notice — ${studentName}`, html });
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