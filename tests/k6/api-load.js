import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const deviceListDuration = new Trend('device_list_duration');
const alertStatsDuration = new Trend('alert_stats_duration');

const BASE_URL = __ENV.API_URL || 'http://localhost:3000/api/v1';

export const options = {
    stages: [
        { duration: '1m', target: 20 },   // ramp up
        { duration: '3m', target: 100 },   // sustained load
        { duration: '1m', target: 0 },     // ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<200'],   // p95 < 200ms
        errors: ['rate<0.01'],              // < 1% errors
    },
};

export function setup() {
    const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
        username: 'admin', password: 'admin123',
    }), { headers: { 'Content-Type': 'application/json' } });

    const token = loginRes.json('accessToken');
    if (!token) {
        throw new Error('Login failed — cannot get access token');
    }
    return { token };
}

export default function (data) {
    const headers = {
        Authorization: `Bearer ${data.token}`,
        'Content-Type': 'application/json',
    };

    // 1. Device list (most common query)
    const devicesRes = http.get(`${BASE_URL}/devices?page=1&limit=50`, { headers });
    deviceListDuration.add(devicesRes.timings.duration);
    check(devicesRes, { 'devices 200': (r) => r.status === 200 });
    errorRate.add(devicesRes.status !== 200);

    sleep(0.5);

    // 2. Alert stats (dashboard widget)
    const alertsRes = http.get(`${BASE_URL}/alerts/stats`, { headers });
    alertStatsDuration.add(alertsRes.timings.duration);
    check(alertsRes, { 'alert stats 200': (r) => r.status === 200 });
    errorRate.add(alertsRes.status !== 200);

    sleep(0.5);

    // 3. Health check
    const healthRes = http.get(`${BASE_URL}/../health`);
    check(healthRes, { 'health 200': (r) => r.status === 200 });

    sleep(1);

    // 4. Random device detail
    const deviceId = Math.floor(Math.random() * 50) + 1;
    const detailRes = http.get(`${BASE_URL}/devices/${deviceId}`, { headers });
    check(detailRes, { 'device detail 200 or 404': (r) => r.status === 200 || r.status === 404 });

    sleep(0.5);
}
