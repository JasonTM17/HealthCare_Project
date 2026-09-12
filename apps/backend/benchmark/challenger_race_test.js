import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom Metrics
export const holdSuccessCount = new Counter('challenger_hold_success_201');
export const holdConflictCount = new Counter('challenger_hold_conflict_409');
export const holdFailureCount = new Counter('challenger_hold_failure_other');
export const fastFailCheck = new Rate('challenger_fast_fail_under_5s');
export const warmReqDuration = new Trend('challenger_warm_req_duration');
export const poolStressReqDuration = new Trend('challenger_pool_stress_req_duration');

// Specific Counters per Challenge
export const race1Success = new Counter('race1_20vu_success_201');
export const race1Conflict = new Counter('race1_20vu_conflict_409');
export const race2Success = new Counter('race2_30vu_success_201');
export const race2Conflict = new Counter('race2_30vu_conflict_409');
export const race3Success = new Counter('race3_50vu_success_201');
export const race3Conflict = new Counter('race3_50vu_conflict_409');
export const race4Success = new Counter('race4_already_held_success_201');
export const race4Conflict = new Counter('race4_already_held_conflict_409');

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:8080';
const BFF_TOKEN = __ENV.BFF_TOKEN || 'yxE+hN0bwyAS1kRv3D3P0yQcUGlkmCqnNnuYb5ojtAw=';
const ORIGIN = 'http://localhost:3000';

const DOCTOR_ID = '30000000-0000-0000-0000-000000000001';
const BRANCH_ID = '20000000-0000-0000-0000-000000000001';

export const options = {
  scenarios: {
    // Challenge 1: 20 VUs burst for open slot 08:00:00 on 2026-11-20
    race1_burst_20vu: {
      executor: 'per-vu-iterations',
      vus: 20,
      iterations: 1,
      maxDuration: '10s',
      startTime: '0s',
      exec: 'raceSlot0800',
    },

    // Challenge 2: 30 VUs burst for open slot 08:30:00 on 2026-11-20
    race2_burst_30vu: {
      executor: 'per-vu-iterations',
      vus: 30,
      iterations: 1,
      maxDuration: '10s',
      startTime: '10s',
      exec: 'raceSlot0830',
    },

    // Challenge 3: 50 VUs burst for open slot 10:00:00 on 2026-11-20 (severe contention)
    race3_burst_50vu: {
      executor: 'per-vu-iterations',
      vus: 50,
      iterations: 1,
      maxDuration: '15s',
      startTime: '20s',
      exec: 'raceSlot1000',
    },

    // Challenge 4: 30 VUs burst for ALREADY HELD slot 09:00:00 on 2026-11-20 (must reject 100%)
    race4_already_held: {
      executor: 'per-vu-iterations',
      vus: 30,
      iterations: 1,
      maxDuration: '10s',
      startTime: '35s',
      exec: 'raceSlot0900AlreadyHeld',
    },

    // Challenge 5: High Concurrency HikariCP Pool Stress (40 VUs, 30s)
    hikaricp_pool_stress: {
      executor: 'constant-vus',
      vus: 40,
      duration: '30s',
      startTime: '45s',
      exec: 'poolStressTest',
    },

    // Challenge 6: Warm Latency & Throughput Verification (20 VUs, 20s)
    warm_latency_check: {
      executor: 'constant-vus',
      vus: 20,
      duration: '20s',
      startTime: '75s',
      exec: 'warmLatencyTest',
    },
  },
  thresholds: {
    'challenger_fast_fail_under_5s': ['rate>0.99'],
    'http_req_duration{scenario:warm_latency_check}': ['p(50)<250', 'p(95)<250'],
    'challenger_hold_failure_other': ['count==0'],
  },
};

function bffHeaders(vu, extra = {}) {
  return Object.assign({
    'Content-Type': 'application/json',
    'X-Healthcare-Bff-Token': BFF_TOKEN,
    'X-Healthcare-Original-Origin': ORIGIN,
    'X-Healthcare-Client-IP': `10.88.${(vu % 200) + 1}.${((vu * 13) % 200) + 1}`,
  }, extra);
}

function executeHoldRace(slotTime, vuPrefix, successCounter, conflictCounter) {
  const vu = __VU;
  const iter = __ITER;
  const headers = bffHeaders(vu);

  const phone = `097${String(vuPrefix).padStart(2, '0')}${String(vu).padStart(2, '0')}${String(iter % 100).padStart(3, '0')}`;
  const email = `challenger_vu_${vuPrefix}_${vu}_${iter}@challenger.test`;

  const payload = JSON.stringify({
    doctorId: DOCTOR_ID,
    branchId: BRANCH_ID,
    appointmentDate: '2026-11-20',
    startTime: slotTime,
    fullName: `VU-${vuPrefix}-${vu} Challenger`,
    phone: phone,
    email: email,
    reasonForVisit: 'Advisory lock empirical challenge',
    privacyConsent: true,
  });

  const res = http.post(`${BASE_URL}/api/v1/appointments/hold`, payload, { headers });

  const isFast = res.timings.duration < 5000;
  fastFailCheck.add(isFast);

  if (res.status === 201) {
    holdSuccessCount.add(1);
    if (successCounter) successCounter.add(1);
  } else if (res.status === 409) {
    holdConflictCount.add(1);
    if (conflictCounter) conflictCounter.add(1);
  } else {
    holdFailureCount.add(1);
  }

  check(res, {
    'race: status is 201 or 409': (r) => r.status === 201 || r.status === 409,
    'race: response under 5000ms': (r) => r.timings.duration < 5000,
  });
}

export function raceSlot0800() {
  executeHoldRace('08:00:00', 1, race1Success, race1Conflict);
}

export function raceSlot0830() {
  executeHoldRace('08:30:00', 2, race2Success, race2Conflict);
}

export function raceSlot1000() {
  executeHoldRace('10:00:00', 3, race3Success, race3Conflict);
}

export function raceSlot0900AlreadyHeld() {
  executeHoldRace('09:00:00', 4, race4Success, race4Conflict);
}

export function poolStressTest() {
  const headers = bffHeaders(__VU);
  const choice = Math.random();

  let res;
  if (choice < 0.40) {
    res = http.get(
      `${BASE_URL}/api/v1/appointments/doctors/${DOCTOR_ID}/slots?date=2026-11-20&branchId=${BRANCH_ID}`,
      { headers }
    );
  } else if (choice < 0.70) {
    res = http.get(`${BASE_URL}/api/v1/hospital/doctors`, { headers });
  } else if (choice < 0.90) {
    res = http.get(`${BASE_URL}/api/v1/hospital/specialties`, { headers });
  } else {
    const day = 10 + (__VU % 15);
    const holdPayload = JSON.stringify({
      doctorId: DOCTOR_ID,
      branchId: BRANCH_ID,
      appointmentDate: `2026-12-${String(day).padStart(2, '0')}`,
      startTime: `10:${(__VU % 2 === 0 ? '00' : '30')}:00`,
      fullName: `Stress Patient ${__VU}`,
      phone: `096${String(__VU).padStart(3, '0')}${String(__ITER % 1000).padStart(4, '0')}`,
      email: `stress_vu_${__VU}_it_${__ITER}@stress.test`,
      reasonForVisit: 'Hikari pool stress probe',
      privacyConsent: true,
    });
    res = http.post(`${BASE_URL}/api/v1/appointments/hold`, holdPayload, { headers });
  }

  poolStressReqDuration.add(res.timings.duration);
  const isFast = res.timings.duration < 5000;
  fastFailCheck.add(isFast);

  check(res, {
    'pool_stress: status is valid (<500)': (r) => r.status < 500,
    'pool_stress: under 5000ms': (r) => r.timings.duration < 5000,
  });

  sleep(0.02 + Math.random() * 0.05);
}

export function warmLatencyTest() {
  const headers = bffHeaders(__VU);
  const endpoints = [
    '/api/v1/health',
    '/api/v1/hospital/specialties',
    '/api/v1/hospital/doctors',
    '/api/v1/hospital/articles',
  ];
  const ep = endpoints[Math.floor(Math.random() * endpoints.length)];
  const res = http.get(`${BASE_URL}${ep}`, { headers });

  warmReqDuration.add(res.timings.duration);

  check(res, {
    'warm: status is 200': (r) => r.status === 200,
    'warm: latency < 250ms': (r) => r.timings.duration < 250,
  });

  sleep(0.02 + Math.random() * 0.03);
}

export function handleSummary(data) {
  return {
    'apps/backend/benchmark/challenger_summary.json': JSON.stringify(data, null, 2),
  };
}
