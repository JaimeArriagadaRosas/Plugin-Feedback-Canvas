import { request, app } from './setup/app.js';

const set = await request(app)
  .post('/api/config/set-local-role')
  .send({ role: 'teacher' });

console.log('set-cookie headers:', set.headers['set-cookie']);

const cookieHeader = set.headers['set-cookie'];
const cookieString = cookieHeader?.map(c => c.split(';')[0]).join('; ') || '';
console.log('cookie string:', cookieString);

const res = await request(app)
  .get('/api/courses')
  .set('Cookie', cookieString);

console.log('status:', res.status);
console.log('body:', res.body);
