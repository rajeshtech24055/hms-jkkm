import os
import firebase_admin
from firebase_admin import credentials, messaging
import logging

logger = logging.getLogger(__name__)

# Initialize Firebase App
def init_firebase():
    try:
        # Check if already initialized
        firebase_admin.get_app()
    except ValueError:
        # Not initialized yet
        try:
            # We expect the user to place 'service_account.json' in the backend root
            cred_path = os.path.join(os.getcwd(), 'service_account.json')
            if os.path.exists(cred_path):
                cred = credentials.Certificate(cred_path)
                firebase_admin.initialize_app(cred)
                logger.info("Firebase Admin initialized successfully.")
            else:
                logger.warning(f"Firebase credentials not found at {cred_path}. Push notifications will be disabled.")
        except Exception as e:
            logger.error(f"Failed to initialize Firebase Admin: {e}")

# Helper to send a push notification
def send_push_notification(token: str, title: str, body: str, data: dict = None):
    try:
        if not token:
            return False
            
        app = firebase_admin.get_app() # Will throw ValueError if not init'd
        
        message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body,
            ),
            data=data or {},
            token=token,
        )
        
        response = messaging.send(message)
        logger.info(f"Successfully sent message: {response}")
        return True
    except Exception as e:
        logger.error(f"Error sending push notification: {e}")
        return False

def notify_user(db, user_id: str, title: str, body: str, data: dict = None):
    from app.models.models import DeviceToken, NotificationLog
    
    # Save to NotificationLog for Web UI
    log_entry = NotificationLog(
        user_id=int(user_id) if str(user_id).isdigit() else None,
        type=title,
        message=body,
        status="SENT"
    )
    db.add(log_entry)
    db.commit()
    
    # Send Push
    tokens = db.query(DeviceToken).filter(DeviceToken.user_id == str(user_id)).all()
    for t in tokens:
        send_push_notification(t.token, title, body, data)

def notify_role(db, role: str, title: str, body: str, data: dict = None):
    from app.models.models import DeviceToken, User, NotificationLog
    from sqlalchemy import cast, String
    
    # Save to NotificationLog for all users with this role
    users = db.query(User).filter(User.role == role).all()
    for u in users:
        log_entry = NotificationLog(
            user_id=u.id,
            type=title,
            message=body,
            status="SENT"
        )
        db.add(log_entry)
    db.commit()
    
    # Send Push
    tokens = db.query(DeviceToken).join(User, DeviceToken.user_id == cast(User.id, String)).filter(User.role == role).all()
    for t in tokens:
        send_push_notification(t.token, title, body, data)
