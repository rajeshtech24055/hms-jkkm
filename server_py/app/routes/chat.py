import os
import json
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import StudentChatMessage, User, LeaveApplication, MessItem
from app.dependencies import get_current_user
from openai import OpenAI

router = APIRouter(prefix="/api/chat", tags=["chat"])

class ChatMessageCreate(BaseModel):
    message: str

def get_student_info(db: Session, student_id: int):
    student = db.query(User).filter(User.id == student_id).first()
    return student

# --- Define Tools (Functions) for Grok ---
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
def execute_tool(name: str, args: dict, db: Session, student_id: int):
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
    if current_user["role"].upper() != "STUDENT":
        raise HTTPException(status_code=403, detail="Only students can access this chatbot.")
        
    messages = db.query(StudentChatMessage).filter(
        StudentChatMessage.student_id == current_user["id"]
    ).order_by(StudentChatMessage.id.asc()).all()
    
    # We map 'assistant' or 'model' (for backward compatibility) to 'model' for frontend
    return [{"role": m.role if m.role != "assistant" else "model", "content": m.content, "created_at": m.created_at} for m in messages]

@router.post("")
def send_chat_message(
    data: ChatMessageCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user["role"].upper() != "STUDENT":
        raise HTTPException(status_code=403, detail="Only students can access this chatbot.")
        
    if not os.getenv("GROQ_API_KEY"):
        raise HTTPException(status_code=500, detail="Chatbot API key not configured.")

    student_id = current_user["id"]
    
    # Save user message
    user_msg = StudentChatMessage(student_id=student_id, role="user", content=data.message)
    db.add(user_msg)
    db.commit()

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

    # Format history for Grok (OpenAI format)
    history = db.query(StudentChatMessage).filter(
        StudentChatMessage.student_id == student_id
    ).order_by(StudentChatMessage.id.asc()).all()
    
    formatted_history = [{"role": "system", "content": sys_instr}]
    
    # Add previous messages
    for h in history[:-1]:
        # map old 'model' role to 'assistant'
        role = "assistant" if h.role == "model" else h.role
        formatted_history.append({"role": role, "content": h.content})
        
    # Add the new message
    formatted_history.append({"role": "user", "content": data.message})

    # Tools definition for Groq
    tools = [
        {
            "type": "function",
            "function": {
                "name": "get_leave_status",
                "description": "Check the status of the student's recent leave applications.",
            }
        },
        {
            "type": "function",
            "function": {
                "name": "get_weekly_menu",
                "description": "Get the weekly food menu for the mess/canteen.",
            }
        },
        {
            "type": "function",
            "function": {
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
        }
    ]

    # Initialize Groq Client
    client = OpenAI(
        api_key=os.getenv("GROQ_API_KEY"),
        base_url="https://api.groq.com/openai/v1",
    )

    try:
        # Call Groq API
        response = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=formatted_history,
            tools=tools,
            temperature=0.7
        )

        message = response.choices[0].message
        
        # Handle tool calls
        if getattr(message, 'tool_calls', None):
            formatted_history.append(message) # Append assistant's tool call request
            
            for tool_call in message.tool_calls:
                fn_name = tool_call.function.name
                fn_args = json.loads(tool_call.function.arguments)
                
                tool_result = execute_tool(fn_name, fn_args, db, student_id)
                
                formatted_history.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "name": fn_name,
                    "content": str(tool_result)
                })
                
            # Send results back to Groq to get the final text response
            second_response = client.chat.completions.create(
                model="openai/gpt-oss-120b",
                messages=formatted_history
            )
            final_text = second_response.choices[0].message.content
        else:
            final_text = message.content

        # Save assistant message to DB
        bot_msg = StudentChatMessage(student_id=student_id, role="model", content=final_text)
        db.add(bot_msg)
        db.commit()

        return {"role": "model", "content": final_text}

    except Exception as e:
        print(f"Groq API Error: {e}")
        err_msg = "Sorry, I am having trouble connecting to my brain right now. Please try again in a moment."
        db.add(StudentChatMessage(student_id=student_id, role="model", content=err_msg))
        db.commit()
        return {"role": "model", "content": err_msg}
