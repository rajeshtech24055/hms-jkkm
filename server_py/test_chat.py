import requests

URL = "https://hms-jkkm-api.onrender.com"

# Login as super admin (or whatever user works)
res = requests.post(f"{URL}/api/auth/login", json={"email": "admin@jkkm.edu", "password": "admin123"})
if res.status_code != 200:
    print("Login failed:", res.text)
    exit(1)

token = res.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# Create a student user for testing if needed, or if admin can't use chat
# Let's just create a student user
res = requests.post(f"{URL}/api/users", json={
    "name": "Test Student",
    "email": "student_test_chat@jkkm.edu",
    "password": "password",
    "role": "STUDENT",
    "institution": "Engineering",
    "gender": "Boys"
}, headers=headers)
print("Create student:", res.status_code, res.text)

# Login as that student
res = requests.post(f"{URL}/api/auth/login", json={"email": "student_test_chat@jkkm.edu", "password": "password"})
token = res.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# Test chat GET
res = requests.get(f"{URL}/api/chat", headers=headers)
print("GET /api/chat:", res.status_code, res.text)

# Test chat POST
res = requests.post(f"{URL}/api/chat", json={"message": "What is the weekly menu?"}, headers=headers)
print("POST /api/chat:", res.status_code, res.text)
