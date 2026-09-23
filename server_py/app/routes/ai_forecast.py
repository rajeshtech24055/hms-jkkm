from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from typing import Optional, List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.models.models import (
    DailySnapshot, Student, LeaveApplication, EntryExitLog, MessItem,
    MessUsageLog, MessFoodWastage, MessMealsServed
)

router = APIRouter(prefix="/api/forecast", tags=["AI & Analytics Forecast Engine"])

@router.get("/occupancy")
def get_occupancy_forecast(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    total_students = db.query(Student).filter(Student.active == 1).count()
    now_str = datetime.utcnow().isoformat()

    # 1. Approved leaves today
    leaves_today = db.query(LeaveApplication).filter(
        LeaveApplication.status == "approved",
        LeaveApplication.from_dt <= now_str,
        LeaveApplication.to_dt >= now_str
    ).count()

    # 2. Outside students count
    students = db.query(Student).filter(Student.active == 1).all()
    outside_count = 0
    for s in students:
        last_log = db.query(EntryExitLog).filter(
            EntryExitLog.student_id == s.id
        ).order_by(EntryExitLog.id.desc()).first()
        if last_log and last_log.direction == "OUT":
            outside_count += 1

    # 3. Pull last 14 snapshots for trend analysis via Pandas
    snapshots = db.query(DailySnapshot).order_by(DailySnapshot.id.desc()).limit(14).all()
    if snapshots:
        df = pd.DataFrame([{
            "date": s.snapshot_date,
            "actual_headcount": s.actual_headcount,
            "students_on_leave": s.students_on_leave
        } for s in snapshots])
        avg_occupancy_ratio = float((df["actual_headcount"] / (total_students or 1)).mean())
    else:
        avg_occupancy_ratio = 0.85

    expected_occupancy = max(0, total_students - leaves_today - outside_count)
    confidence_interval = (max(0, expected_occupancy - 15), expected_occupancy + 15)

    return {
        "total_capacity": total_students,
        "students_on_leave": leaves_today,
        "students_outside": outside_count,
        "forecast_occupancy": expected_occupancy,
        "occupancy_rate_pct": round((expected_occupancy / (total_students or 1)) * 100, 1),
        "confidence_range": {"min": confidence_interval[0], "max": confidence_interval[1]},
        "insight": f"Tonight's projected hostel occupancy is ~{expected_occupancy} students based on active leaves and attendance history."
    }

@router.get("/meals")
def get_meal_demand_forecast(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Retrieve occupancy forecast
    occ_res = get_occupancy_forecast(current_user, db)
    base_occupancy = occ_res["forecast_occupancy"]

    # Calculate meal attendance ratios from past 14 days
    meals_logs = db.query(MessMealsServed).order_by(MessMealsServed.id.desc()).limit(14).all()
    if meals_logs:
        df = pd.DataFrame([{
            "served": m.students_served,
            "b": m.breakfast_count,
            "l": m.lunch_count,
            "s": m.snacks_count,
            "d": m.dinner_count
        } for m in meals_logs])
        
        b_ratio = float((df["b"] / (df["served"] + 1)).mean())
        l_ratio = float((df["l"] / (df["served"] + 1)).mean())
        s_ratio = float((df["s"] / (df["served"] + 1)).mean())
        d_ratio = float((df["d"] / (df["served"] + 1)).mean())
    else:
        b_ratio, l_ratio, s_ratio, d_ratio = 0.92, 0.96, 0.88, 0.95

    b_predicted = int(base_occupancy * b_ratio)
    l_predicted = int(base_occupancy * l_ratio)
    s_predicted = int(base_occupancy * s_ratio)
    d_predicted = int(base_occupancy * d_ratio)

    return {
        "forecast_date": datetime.utcnow().strftime("%Y-%m-%d"),
        "base_occupancy": base_occupancy,
        "predictions": {
            "breakfast": b_predicted,
            "lunch": l_predicted,
            "snacks": s_predicted,
            "dinner": d_predicted
        },
        "recommendation": f"Prepare for ~{l_predicted} students at Lunch today and ~{d_predicted} at Dinner."
    }

@router.get("/inventory")
def get_inventory_depletion_forecast(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    items = db.query(MessItem).all()
    forecasts = []

    for item in items:
        # Calculate 7-day average daily usage
        logs = db.query(MessUsageLog).filter(MessUsageLog.item_id == item.id).order_by(MessUsageLog.id.desc()).limit(7).all()
        if logs:
            avg_daily_usage = float(np.mean([l.qty_used for l in logs]))
        else:
            avg_daily_usage = 10.0 # Default estimate

        days_remaining = round(item.current_stock / (avg_daily_usage if avg_daily_usage > 0 else 1.0), 1)
        procurement_alert = days_remaining <= (item.lead_time_days or 3)

        health_status = "CRITICAL" if days_remaining <= 3 else ("WARNING" if days_remaining <= 7 else "HEALTHY")

        forecasts.append({
            "id": item.id,
            "name": item.name,
            "category": item.category,
            "unit": item.unit,
            "current_stock": item.current_stock,
            "avg_daily_usage": round(avg_daily_usage, 1),
            "days_remaining": days_remaining,
            "lead_time_days": item.lead_time_days or 3,
            "procurement_alert": procurement_alert,
            "health_status": health_status
        })

    return forecasts

@router.get("/analytics/anomalies")
def get_statistical_anomalies(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    snapshots = db.query(DailySnapshot).order_by(DailySnapshot.id.desc()).limit(14).all()
    anomalies = []

    if len(snapshots) >= 5:
        df = pd.DataFrame([{
            "date": s.snapshot_date,
            "wastage": s.total_wastage_kg,
            "outside": s.students_outside,
            "complaints": s.open_complaints
        } for s in snapshots])

        # Z-Score computation for food wastage
        w_mean = df["wastage"].mean()
        w_std = df["wastage"].std() or 1.0
        latest_w = df["wastage"].iloc[0]
        z_w = (latest_w - w_mean) / w_std

        if abs(z_w) >= 1.8:
            anomalies.append({
                "type": "FOOD_WASTAGE_SPIKE",
                "severity": "HIGH" if z_w >= 2.5 else "MEDIUM",
                "z_score": round(z_w, 2),
                "metric_name": "Food Wastage",
                "current_value": f"{latest_w} kg",
                "historical_mean": f"{round(w_mean, 1)} kg",
                "message": f"Food wastage today ({latest_w}kg) is {round(z_w, 1)}σ above normal average ({round(w_mean, 1)}kg)."
            })

    return {
        "anomaly_count": len(anomalies),
        "anomalies": anomalies
    }
