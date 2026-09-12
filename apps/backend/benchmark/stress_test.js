import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom Metrics
const warmupReqDuration = new Trend('warmup_req_duration');
const publicReqDuration = new Trend('public_discovery_req_duration');
const authReqDuration = new Trend('auth_session_req_duration');
const lockStressReqDuration = new Trend('lock_stress_req_duration');
const soakReqDuration = new Trend('soak_leak_req_duration');
const failedRequestsRate = new Rate('failed_requests_rate');
const appointmentHoldSuccess = new Counter('appointment_hold_success');
const appointmentHoldConflict = new Counter('appointment_hold_conflict');

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:8080';
const BFF_TOKEN = __ENV.BFF_TOKEN || 'yxE+hN0bwyAS1kRv3D3P0yQcUGlkmCqnNnuYb5ojtAw=';
const ORIGIN = 'http://localhost:3000';

const DOCTOR_ID = '30000000-0000-0000-0000-000000000001';
const BRANCH_ID = '20000000-0000-0000-0000-000000000001';

export const options = {
  scenarios: {
    // Stage 1: Cold Warmup (1-2 VUs, 10s) to warm JIT and connection pools
    stage1_warmup: {
      executor: 'ramping-vus',
      startTime: '0s',
      startVUs: 1,
      stages: [
        { duration: '5s', target: 2 },
        { duration: '5s', target: 2 },
      ],
      gracefulRampDown: '0s',
      exec: 'stage1Warmup',
    },

    // Stage 2: Public Discovery Ramping (ramp from 5 to 50 VUs across public catalog endpoints)
    stage2_public_discovery: {
      executor: 'ramping-vus',
      startTime: '10s',
      startVUs: 5,
      stages: [
        { duration: '10s', target: 20 },
        { duration: '15s', target: 50 },
        { duration: '10s', target: 50 },
        { duration: '5s', target: 5 },
      ],
      gracefulRampDown: '0s',
      exec: 'stage2PublicDiscovery',
    },

    // Stage 3: Authenticated / Session Operations (POST /api/v1/auth/browser-sessions & GET /current)
    stage3_authenticated_sessions: {
      executor: 'ramping-vus',
      startTime: '50s',
      startVUs: 2,
      stages: [
        { duration: '5s', target: 5 },
        { duration: '15s', target: 15 },
        { duration: '5s', target: 2 },
      ],
      gracefulRampDown: '0s',
      exec: 'stage3AuthenticatedSessions',
    },

    // Stage 4: Concurrency & Lock Stress (appointment slot queries, advisory lock holds & collisions)
    stage4_concurrency_lock_stress: {
      executor: 'ramping-vus',
      startTime: '75s',
      startVUs: 5,
      stages: [
        { duration: '10s', target: 25 },
        { duration: '15s', target: 25 },
        { duration: '5s', target: 5 },
      ],
      gracefulRampDown: '0s',
      exec: 'stage4ConcurrencyLockStress',
    },

    // Stage 5: Soak & Leak Test (constant 20 VUs for 60s measuring throughput RPS & latency stability)
    stage5_soak_leak: {
      executor: 'constant-vus',
      startTime: '105s',
      vus: 20,
      duration: '60s',
      gracefulStop: '0s',
      exec: 'stage5SoakLeakTest',
    },
  },
  thresholds: {
    // Acceptance criterion: Warm endpoint latency achieves <250ms p50 and p95
    'http_req_duration{scenario:stage2_public_discovery}': ['p(50)<250', 'p(95)<250'],
    'http_req_duration{scenario:stage5_soak_leak}': ['p(50)<250', 'p(95)<250'],
    'failed_requests_rate': ['rate<0.01'],
  },
};

function bffHeaders(vu, extra = {}) {
  return Object.assign({
    'X-Healthcare-Bff-Token': BFF_TOKEN,
    'X-Healthcare-Original-Origin': ORIGIN,
    'X-Healthcare-Client-IP': `10.10.${(vu % 250) + 1}.${((vu * 7) % 250) + 1}`,
  }, extra);
}

// Stage 1: Cold Warmup
export function stage1Warmup() {
  const headers = bffHeaders(__VU);

  // 1. Health endpoint (no token required)
  const resHealth = http.get(`${BASE_URL}/api/v1/health`);
  warmupReqDuration.add(resHealth.timings.duration);
  check(resHealth, {
    'stage1: health status is 200': (r) => r.status === 200,
  });

  // 2. Specialties catalog
  const resSpec = http.get(`${BASE_URL}/api/v1/hospital/specialties`, { headers });
  warmupReqDuration.add(resSpec.timings.duration);
  check(resSpec, {
    'stage1: specialties status is 200': (r) => r.status === 200,
  });

  // 3. Doctors catalog
  const resDoc = http.get(`${BASE_URL}/api/v1/hospital/doctors`, { headers });
  warmupReqDuration.add(resDoc.timings.duration);
  check(resDoc, {
    'stage1: doctors status is 200': (r) => r.status === 200,
  });

  sleep(0.15);
}

// Stage 2: Public Discovery Ramping
const publicEndpoints = [
  '/api/v1/health',
  '/api/v1/hospital/specialties',
  '/api/v1/hospital/doctors',
  '/api/v1/hospital/articles',
];

export function stage2PublicDiscovery() {
  const endpoint = publicEndpoints[Math.floor(Math.random() * publicEndpoints.length)];
  const headers = bffHeaders(__VU);

  const res = http.get(`${BASE_URL}${endpoint}`, { headers });
  publicReqDuration.add(res.timings.duration);

  const passed = check(res, {
    'stage2: public status is 200': (r) => r.status === 200,
    'stage2: latency < 250ms': (r) => r.timings.duration < 250,
  });

  if (!passed && res.status >= 500) {
    failedRequestsRate.add(1);
  } else {
    failedRequestsRate.add(0);
  }

  sleep(0.05 + Math.random() * 0.1);
}

// Stage 3: Authenticated / Session Operations
const sessionByVu = {};

export function stage3AuthenticatedSessions() {
  const headers = bffHeaders(__VU, { 'Content-Type': 'application/json' });

  if (!sessionByVu[__VU]) {
    const loginPayload = JSON.stringify({
      grantType: 'PASSWORD',
      email: 'patient@healthcare.com',
      password: 'HealthCare@2026',
    });

    const resLogin = http.post(`${BASE_URL}/api/v1/auth/browser-sessions`, loginPayload, { headers });
    authReqDuration.add(resLogin.timings.duration);

    const loginSuccess = check(resLogin, {
      'stage3: login status is 200': (r) => r.status === 200,
      'stage3: user object in response': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body && body.user && body.user.roles && body.user.roles.includes('PATIENT');
        } catch (e) {
          return false;
        }
      },
    });

    if (loginSuccess) {
      const cookies = resLogin.cookies['__Host-healthcare_session'];
      if (cookies && cookies.length > 0) {
        sessionByVu[__VU] = cookies[0].value;
      }
      failedRequestsRate.add(0);
    } else {
      if (resLogin.status >= 500) failedRequestsRate.add(1);
    }

    sleep(0.1);
    return;
  }

  // Authenticated query with valid session cookie
  const authHeaders = bffHeaders(__VU, {
    'Cookie': `__Host-healthcare_session=${sessionByVu[__VU]}`,
  });

  const resCurrent = http.get(`${BASE_URL}/api/v1/auth/browser-sessions/current`, { headers: authHeaders });
  authReqDuration.add(resCurrent.timings.duration);

  const currentSuccess = check(resCurrent, {
    'stage3: current session status is 200': (r) => r.status === 200,
  });

  if (currentSuccess) {
    failedRequestsRate.add(0);
  } else {
    if (resCurrent.status >= 500) {
      failedRequestsRate.add(1);
    } else if (resCurrent.status === 401) {
      delete sessionByVu[__VU];
    }
  }

  sleep(0.08 + Math.random() * 0.12);
}

// Stage 4: Concurrency & Lock Stress
export function stage4ConcurrencyLockStress() {
  const headers = bffHeaders(__VU, { 'Content-Type': 'application/json' });

  // 1. Concurrent query on doctor slots (tests DB query under connection pool load)
  const slotRes = http.get(
    `${BASE_URL}/api/v1/appointments/doctors/${DOCTOR_ID}/slots?date=2026-10-15&branchId=${BRANCH_ID}`,
    { headers }
  );
  lockStressReqDuration.add(slotRes.timings.duration);
  check(slotRes, {
    'stage4: slot query status is 200': (r) => r.status === 200,
  });

  // 2. Concurrency hold simulation
  // 50% of VUs compete for the exact same slot (causing advisory lock contention & 409 conflict for losers)
  // 50% of VUs request spread slots across dates/times (testing uncontentious pool acquisition)
  const isContendedSlot = Math.random() < 0.5;
  const appointmentDate = isContendedSlot
    ? '2026-10-15'
    : `2026-11-${10 + (__VU % 15)}`;
  const startTime = isContendedSlot
    ? '08:00:00'
    : `09:${(__ITER % 2 === 0 ? '00' : '30')}:00`;

  const holdPayload = JSON.stringify({
    doctorId: DOCTOR_ID,
    branchId: BRANCH_ID,
    appointmentDate: appointmentDate,
    startTime: startTime,
    fullName: `Patient VU-${__VU}`,
    phone: `098${String(__VU).padStart(3, '0')}${String(__ITER % 1000).padStart(4, '0')}`,
    email: `vu_${__VU}_iter_${__ITER}@healthcare.local`,
    reasonForVisit: 'Stress test appointment lock hold',
    privacyConsent: true,
  });

  const resHold = http.post(`${BASE_URL}/api/v1/appointments/hold`, holdPayload, { headers });
  lockStressReqDuration.add(resHold.timings.duration);

  // Status 201 (Held) or 409 (Conflict - advisory lock won by another thread) are both valid outcomes under contention.
  // Neither is an unhandled server failure.
  const validLockOutcome = check(resHold, {
    'stage4: lock outcome is 201 or 409 (no 500/504)': (r) => r.status === 201 || r.status === 409,
    'stage4: fast fail guard (< 5000ms)': (r) => r.timings.duration < 5000,
  });

  if (resHold.status === 201) {
    appointmentHoldSuccess.add(1);
    failedRequestsRate.add(0);
  } else if (resHold.status === 409) {
    appointmentHoldConflict.add(1);
    failedRequestsRate.add(0);
  } else {
    // 500 or 504 indicates pool starvation or server error
    failedRequestsRate.add(1);
  }

  sleep(0.08 + Math.random() * 0.12);
}

// Stage 5: Soak & Leak Test
export function stage5SoakLeakTest() {
  const headers = bffHeaders(__VU);
  const choice = Math.random();

  let res;
  if (choice < 0.35) {
    // 35% specialties catalog
    res = http.get(`${BASE_URL}/api/v1/hospital/specialties`, { headers });
  } else if (choice < 0.65) {
    // 30% doctors catalog
    res = http.get(`${BASE_URL}/api/v1/hospital/doctors`, { headers });
  } else if (choice < 0.85) {
    // 20% articles catalog
    res = http.get(`${BASE_URL}/api/v1/hospital/articles`, { headers });
  } else {
    // 15% health endpoint
    res = http.get(`${BASE_URL}/api/v1/health`);
  }

  soakReqDuration.add(res.timings.duration);

  const passed = check(res, {
    'stage5: soak status is 200': (r) => r.status === 200,
    'stage5: soak latency < 250ms': (r) => r.timings.duration < 250,
  });

  if (!passed && res.status >= 500) {
    failedRequestsRate.add(1);
  } else {
    failedRequestsRate.add(0);
  }

  sleep(0.05 + Math.random() * 0.05);
}

export default function () {
  stage2PublicDiscovery();
}

// Generate Summary JSON
export function handleSummary(data) {
  return {
    'apps/backend/benchmark/summary.json': JSON.stringify(data, null, 2),
  };
}
