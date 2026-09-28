import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging

SMTP_EMAIL = os.getenv("SMTP_EMAIL")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")

def send_email_alert(to_email: str, subject: str, message_body: str):
    """
    Sends an email alert to the given email address.
    """
    logging.info(f"Email sending is temporarily disabled. (Skipping email to {to_email})")
    return False
    
    if not to_email:
        return False
        
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        logging.warning("SMTP_EMAIL or SMTP_PASSWORD not set in .env. Email not sent.")
        return False

    try:
        msg = MIMEMultipart()
        msg['From'] = SMTP_EMAIL
        msg['To'] = to_email
        msg['Subject'] = subject

        msg.attach(MIMEText(message_body, 'plain'))

        # Standard Gmail SMTP config (can be changed if using a different provider)
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(SMTP_EMAIL, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        return True
        
    except Exception as e:
        logging.error(f"Failed to send email to {to_email}: {str(e)}")
        return False
