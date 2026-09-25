import asyncio
import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.models import MaintenanceRequest, DeviceToken, User
from app.utils.push import send_push_notification

logger = logging.getLogger(__name__)

async def maintenance_escalation_loop():
    """
    Background task that runs every 1 hour to check for overdue maintenance requests
    and escalates them to the next level.
    """
    while True:
        try:
            logger.info("Running maintenance escalation check...")
            db = SessionLocal()
            try:
                now = datetime.utcnow()
                
                # Fetch pending maintenance requests
                pending_requests = db.query(MaintenanceRequest).filter(MaintenanceRequest.status == 'pending').all()
                
                for req in pending_requests:
                    # Parse last escalated at or created at
                    start_time_str = req.last_escalated_at or req.created_at
                    if not start_time_str:
                        continue
                        
                    try:
                        start_time = datetime.fromisoformat(start_time_str)
                    except ValueError:
                        continue
                        
                    time_diff = now - start_time
                    escalated = False
                    new_level_name = ""
                    new_role_target = ""
                    
                    # Level 1 (Warden) -> Level 2 (Hostel Admin) after 24 hours
                    if req.current_level == 1 and time_diff >= timedelta(hours=24):
                        req.current_level = 2
                        req.last_escalated_at = now.isoformat()
                        escalated = True
                        new_level_name = "Hostel Admin"
                        new_role_target = "HOSTEL_ADMIN"
                    
                    # Level 2 (Hostel Admin) -> Level 3 (Principal) after 48 total hours (or 24 hours at L2)
                    elif req.current_level == 2 and time_diff >= timedelta(hours=24):
                        req.current_level = 3
                        req.last_escalated_at = now.isoformat()
                        escalated = True
                        new_level_name = "Principal"
                        new_role_target = "PRINCIPAL"
                        
                    if escalated:
                        logger.info(f"Escalating request {req.id} to {new_level_name} (Level {req.current_level})")
                        db.commit()
                        
                        # Notify the new target role via Push Notifications
                        target_tokens = db.query(DeviceToken).join(
                            User, DeviceToken.user_id == User.id.__str__()
                        ).filter(User.role == new_role_target).all()
                        
                        for token_record in target_tokens:
                            send_push_notification(
                                token=token_record.token,
                                title="Maintenance Escalation Alert ⚠️",
                                body=f"Request #{req.id} (Room {req.room_no}) is overdue and escalated to you.",
                                data={"type": "escalation", "request_id": str(req.id)}
                            )
                            
            except Exception as e:
                logger.error(f"Error inside escalation loop DB session: {e}")
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Error in escalation background loop: {e}")
            
        # Sleep for 1 hour before checking again
        await asyncio.sleep(3600)
