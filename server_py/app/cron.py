import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from apscheduler.schedulers.background import BackgroundScheduler
from app.database import SessionLocal
from app.models.models import LeaveApplication, EntryExitLog, NotificationLog, Student

logger = logging.getLogger(__name__)

def check_absconding_students():
    """
    Checks all approved leaves. If a student's leave has expired by >12 hours 
    and they haven't returned (last EntryExitLog is OUT), mark as ABSCONDING.
    """
    db: Session = SessionLocal()
    try:
        now = datetime.utcnow()
        # 12 hours ago
        threshold = now - timedelta(hours=12)
        threshold_str = threshold.strftime("%Y-%m-%dT%H:%M:%S")

        # Find all leaves that are approved and expired more than 12 hours ago
        # to_dt is stored as string.
        expired_leaves = db.query(LeaveApplication).filter(
            LeaveApplication.status == "approved",
            LeaveApplication.to_dt < threshold_str
        ).all()

        for leave in expired_leaves:
            student = db.query(Student).filter(Student.id == leave.student_id).first()
            if not student:
                continue
                
            # Check last log
            last_log = db.query(EntryExitLog).filter(
                EntryExitLog.student_id == student.id,
                EntryExitLog.authorized == 1
            ).order_by(EntryExitLog.id.desc()).first()

            if last_log and last_log.direction == "OUT":
                logger.warning(f"Student {student.name} ({student.reg_no}) is ABSCONDING. Leave expired at {leave.to_dt}")
                # Mark leave as absconding
                leave.status = "absconding"
                
                # Notify parents
                guardian_phone = student.guardian_phone or student.mobile
                if guardian_phone:
                    db.add(NotificationLog(
                        recipient_phone=guardian_phone,
                        student_id=student.id,
                        student_name=student.name,
                        type="ABSCONDING_ALERT_PARENT",
                        message=f"URGENT: {student.name}'s leave expired over 12 hours ago and they have not returned to the hostel. Please contact management.",
                        status="SENT",
                        sent_at=now.isoformat()
                    ))
                
                db.commit()
    except Exception as e:
        logger.error(f"Error in check_absconding_students: {e}")
        db.rollback()
    finally:
        db.close()

# Start scheduler
scheduler = BackgroundScheduler()
scheduler.add_job(check_absconding_students, 'interval', hours=1, id='absconding_check')

def start_cron():
    scheduler.start()
    logger.info("Background Cron Jobs started.")
