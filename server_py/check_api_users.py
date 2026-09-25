import requests

URL = "https://hms-jkkm-api.onrender.com"

# Login
res = requests.post(f"{URL}/api/auth/login", json={"email": "admin.eng@jkkm.edu", "password": "password123"})
if res.status_code != 200:
    res = requests.post(f"{URL}/api/auth/login", json={"email": "admin.eng@jkkm.edu", "password": "admin123"})
    
if res.status_code != 200:
    print("Login failed:", res.text)
    exit(1)

print("Login response:", res.text)
token = res.json()["token"]
headers = {"Authorization": f"Bearer {token}"}

# Get users
res = requests.get(f"{URL}/api/users", headers=headers)
print("Users:", len(res.json()) if res.status_code == 200 else res.text)

# Get students
res = requests.get(f"{URL}/api/students", headers=headers)
print("Students:", len(res.json()) if res.status_code == 200 else res.text)

# Get rooms
res = requests.get(f"{URL}/api/hostels/rooms", headers=headers)
print("Rooms:", len(res.json()) if res.status_code == 200 else res.text)
