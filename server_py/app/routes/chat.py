import os
import json
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models.models import StudentChatMessage, User, LeaveApplication, MessItem
from app.dependencies import get_current_user
import google.generativeai as genai

router = APIRouter(prefix="/api/chat", tags=["chat"])

# Initialize Gemini
api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

class ChatMessageCreate(BaseModel):
    message: str

def get_student_info(db: Session, student_id: int):
    student = db.query(User).filter(User.id == student_id).first()
    return student

# --- Define Tools (Functions) for Gemini ---
def get_leave_status(db: Session, student_id: int) -> str:
    leaves = db.query(LeaveApplication).filter(LeaveApplication.student_id == student_id).order_by(LeaveApplication.id.desc()).limit(3).all()
    if not leaves:
        return "You have no recent leave applications."
    
    result = "Recent leave applications:\n"
    for leave in leaves:
        result += f"- From {leave.start_date} to {leave.end_date}: Status is {leave.status}.\n"
    return result

def get_weekly_menu(db: Session) -> str:
    # Simulating a menu response. Ideally fetched from a Menu model, but we don't have one explicitly structured for days yet.
    return "This week's general menu:\nMonday: Idly, Rice, Chapathi\nTuesday: Dosa, Pulao, Parotta\nWednesday: Pongal, Biriyani, Chapathi\nThursday: Poori, Lemon Rice, Dosa\nFriday: Upma, Tomato Rice, Chapathi\nSaturday: Idly, Curd Rice, Parotta\nSunday: Dosa, Chicken/Veg Biriyani, Chapathi"

def apply_for_leave(db: Session, student_id: int, reason: str, start_date: str, end_date: str) -> str:
    try:
        leave = LeaveApplication(
            student_id=student_id,
            reason=reason,
            start_date=start_date,
            end_date=end_date,
            status="Pending"
        )
        db.add(leave)
        db.commit()
        return f"Successfully submitted a leave application from {start_date} to {end_date} for '{reason}'."
    except Exception as e:
        return f"Failed to apply for leave: {str(e)}"

# A simple mapping to route function names to python functions
def execute_tool(tool_call, db: Session, student_id: int):
    name = tool_call.name
    args = tool_call.args
    
    if name == "get_leave_status":
        return get_leave_status(db, student_id)
    elif name == "get_weekly_menu":
        return get_weekly_menu(db)
    elif name == "apply_for_leave":
        return apply_for_leave(db, student_id, args.get("reason"), args.get("start_date"), args.get("end_date"))
    else:
        return "Tool not found."

@router.get("")
def get_chat_history(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user["role"] != "STUDENT":
        raise HTTPException(status_code=403, detail="Only students can access this chatbot.")
        
    messages = db.query(StudentChatMessage).filter(
        StudentChatMessage.student_id == current_user["id"]
    ).order_by(StudentChatMessage.id.asc()).all()
    
    return [{"role": m.role, "content": m.content, "created_at": m.created_at} for m in messages]

@router.post("")
def send_chat_message(
    data: ChatMessageCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user["role"] != "STUDENT":
        raise HTTPException(status_code=403, detail="Only students can access this chatbot.")
        
    if not api_key:
        raise HTTPException(status_code=500, detail="Chatbot API key not configured.")

    student_id = current_user["id"]
    
    # Save user message
    user_msg = StudentChatMessage(student_id=student_id, role="user", content=data.message)
    db.add(user_msg)
    db.commit()

    # Retrieve history to give Gemini context
    history = db.query(StudentChatMessage).filter(
        StudentChatMessage.student_id == student_id
    ).order_by(StudentChatMessage.id.asc()).all()
    
    # Format history for Gemini
    formatted_history = []
    for h in history[:-1]: # exclude the one we just saved
        formatted_history.append({"role": h.role, "parts": [h.content]})
        
    # Tools definition for Gemini
    tools = [
        {
            "name": "get_leave_status",
            "description": "Check the status of the student's recent leave applications.",
            "parameters": {"type": "object", "properties": {}}
        },
        {
            "name": "get_weekly_menu",
            "description": "Get the weekly food menu for the mess/canteen.",
            "parameters": {"type": "object", "properties": {}}
        },
        {
            "name": "apply_for_leave",
            "description": "Submit a leave application for the student.",
            "parameters": {
                "type": "object",
                "properties": {
                    "reason": {"type": "string", "description": "Reason for leave"},
                    "start_date": {"type": "string", "description": "Start date in YYYY-MM-DD format"},
                    "end_date": {"type": "string", "description": "End date in YYYY-MM-DD format"}
                },
                "required": ["reason", "start_date", "end_date"]
            }
        }
    ]

    try:
        # Load academic calendar
        calendar_text = ""
        cal_path = os.path.join(os.path.dirname(__file__), "..", "data", "academic_calendar.txt")
        if os.path.exists(cal_path):
            with open(cal_path, "r", encoding="utf-8") as f:
                calendar_text = f.read()

        sys_instr = (
            "You are a helpful hostel assistant for a student. "
            "You can answer questions about the menu, check leave status, and apply for leaves on their behalf.\n"
            f"Here is the Academic Calendar for reference:\n{calendar_text}\n"
        )

        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            tools=tools,
            system_instruction=sys_instr
        )
        chat = model.start_chat(history=formatted_history)
        response = chat.send_message(data.message)

        # Handle tool calls if any
        if response.candidates and response.candidates[0].content.parts:
            for part in response.candidates[0].content.parts:
                if hasattr(part, 'function_call') and part.function_call:
                    fc = part.function_call
                    tool_result = execute_tool(fc, db, student_id)
                    # Send tool result back to model
                    response = chat.send_message(
                        genai.types.Part.from_function_response(
                            name=fc.name,
                            response={"result": tool_result}
                        )
                    )

        final_text = response.text

        bot_msg = StudentChatMessage(student_id=student_id, role="model", content=final_text)
        db.add(bot_msg)
        db.commit()

        return {"role": "model", "content": final_text}

    except Exception as e:
        print("Chatbot Error:", e)
        err_msg = "Sorry, I am having trouble connecting to my brain right now."
        db.add(StudentChatMessage(student_id=student_id, role="model", content=err_msg))
        db.commit()
        return {"role": "model", "content": err_msg}
