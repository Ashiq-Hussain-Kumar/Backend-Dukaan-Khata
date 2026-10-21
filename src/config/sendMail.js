import transporter from "./mailer.js";

export const sendEmail = async ({ to, subject, html, text }) => {
  return await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject,
    text,
    html,
  });
};


