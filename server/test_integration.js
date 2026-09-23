const http = require('http');

const BASE_URL = 'http://localhost:5000';

async function request(path, method = 'GET', data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const payload = data ? JSON.stringify(data) : null;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    };

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, body: parsed });
        } catch {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting JKKM HMS Integration Tests...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(` ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(` ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Auth Test
    const loginRes = await request('/api/auth/login', 'POST', {
      email: 'warden.eng@jkkm.edu',
      password: 'admin123'
    });

    assert(loginRes.status === 200 && loginRes.body.token, 'Login Warden API returns JWT token');
    const token = loginRes.body.token;

    // Student Login
    const studentLogin = await request('/api/auth/login', 'POST', {
      email: 'arjun@student.jkkm.edu',
      password: 'admin123'
    });
    assert(studentLogin.status === 200 && studentLogin.body.user.role === 'STUDENT', 'Login Student API works');
    const studentToken = studentLogin.body.token;

    // 2. Dashboard Stats
    const statsRes = await request('/api/dashboard/stats', 'GET', null, token);
    assert(statsRes.status === 200 && typeof statsRes.body.totalStudents === 'number', 'Dashboard stats endpoint returns counts');

    // 3. Students List
    const studentsRes = await request('/api/students', 'GET', null, token);
    assert(studentsRes.status === 200 && Array.isArray(studentsRes.body), 'GET /api/students returns student list');

    // 4. Maintenance Request Creation & Patching
    const newReq = await request('/api/maintenance', 'POST', {
      category: 'Electrical',
      room_no: 'R-101',
      description: 'Integration Test Light Switch',
      priority: 'Normal'
    }, token);
    assert(newReq.status === 200 && newReq.body.id, 'POST /api/maintenance creates new request');

    if (newReq.body.id) {
      const patchReq = await request(`/api/maintenance/${newReq.body.id}`, 'PATCH', {
        status: 'completed',
        remarks: 'Fixed in integration test'
      }, token);
      assert(patchReq.status === 200 && patchReq.body.message === 'Updated', 'PATCH /api/maintenance/:id resolves issue');
    }

    // 5. Leave Application & Approval
    const studentInfo = studentsRes.body.find(s => s.email === 'arjun@student.jkkm.edu');
    assert(!!studentInfo, 'Found student info for leave application test');

    if (studentInfo) {
      const applyLeave = await request('/api/leaves', 'POST', {
        student_id: studentInfo.id,
        type: 'Home',
        reason: 'Integration Test Leave',
        from_dt: '2026-08-10',
        to_dt: '2026-08-12',
        place: 'Coimbatore',
        is_emergency: false
      }, studentToken);
      assert(applyLeave.status === 200 && applyLeave.body.id, 'POST /api/leaves submits student leave application');

      if (applyLeave.body.id) {
        const approveLeave = await request(`/api/leaves/${applyLeave.body.id}/approve`, 'POST', {
          decision: 'approve',
          reason: 'Approved via test'
        }, token);
        assert(approveLeave.status === 200, 'POST /api/leaves/:id/approve approves leave');
      }
    }

    // 6. Inventory Items Endpoint
    const inventoryRes = await request('/api/inventory', 'GET', null, token);
    assert(inventoryRes.status === 200 && Array.isArray(inventoryRes.body), 'GET /api/inventory returns stock list');

    // 7. Gate Scanner Endpoint
    const scanRes = await request('/api/gate/scan', 'POST', { reg_no: 'ENG001' }, token);
    assert(scanRes.status === 200, 'POST /api/gate/scan processes scan request');

    // 8. Student Vacate & Reactivate
    if (studentInfo) {
      const vacateRes = await request(`/api/students/${studentInfo.id}/vacate`, 'POST', {}, token);
      assert(vacateRes.status === 200 && vacateRes.body.success, 'POST /api/students/:id/vacate marks student as vacated');

      const reactivateRes = await request(`/api/students/${studentInfo.id}/reactivate`, 'POST', {}, token);
      assert(reactivateRes.status === 200 && reactivateRes.body.success, 'POST /api/students/:id/reactivate reactivates student');
    }

    console.log(`\n📊 Integration Test Results: ${passed} Passed, ${failed} Failed`);
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Integration test exception:', err);
    process.exit(1);
  }
}

runTests();
