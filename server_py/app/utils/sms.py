import os
import requests
import logging

# Ensure you add FAST2SMS_API_KEY in your .env file
FAST2SMS_API_KEY = os.getenv("FAST2SMS_API_KEY")

def send_sms(phone_number: str, message: str):
    """
    Sends a real SMS using the Fast2SMS API.
    """
    if not FAST2SMS_API_KEY:
        logging.warning("FAST2SMS_API_KEY not found in environment variables. Real SMS not sent.")
        return False

    url = "https://www.fast2sms.com/dev/bulkV2"
    
    # Clean the phone number (remove +91, spaces, etc.)
    clean_number = ''.join(filter(str.isdigit, phone_number))
    if len(clean_number) > 10 and clean_number.startswith("91"):
        clean_number = clean_number[2:]

    payload = {
        "route": "v3",
        "sender_id": "TXTIND",
        "message": message,
        "language": "english",
        "flash": 0,
        "numbers": clean_number,
    }
    headers = {
        "authorization": FAST2SMS_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
        "Cache-Control": "no-cache"
    }
    
    try:
        response = requests.post(url, data=payload, headers=headers)
        if response.status_code == 200:
            return True
        else:
            logging.error(f"Fast2SMS API error: {response.text}")
            return False
    except Exception as e:
        logging.error(f"Failed to send SMS via Fast2SMS: {str(e)}")
        return False
