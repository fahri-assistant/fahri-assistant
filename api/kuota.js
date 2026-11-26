// api/kuota.js - batas pemakaian harian (akurat, disimpan di Firestore lewat service account)
// Jenis: chat (user 100, tamu 10), gambar (user 10), edit (user 3). Reset setiap hari WIB.
import crypto from 'crypto';

const FB_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyC_enCjCWHSq4GTFHABA6kcCgjWeww1hks';
export const BATAS = { chat_user: 100, chat_tamu: 10, gambar: 10, edit: 3 };

let _sa = null;
function serviceAccount() {
  if (_sa) return _sa;
  try { _sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || ''); } catch (e) { _sa = null; }
  return _sa;
}
function projectId() {
  const sa = serviceAccount();
  return (sa && sa.project_id) || process.env.FIREBASE_PROJECT_ID || 'fahri-assistant';
}

let _tok = { value: '', exp: 0 };
async function accessToken() {
  if (_tok.value && Date.now() < _tok.exp - 60000) return _tok.value;
  const sa = serviceAccount();
  if (!sa) throw new Error('FIREBASE_SERVICE_ACCOUNT belum diisi');
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = b64({ alg: 'RS256', typ: 'JWT' });
  const claims = b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const input = head + '.' + claims;
  const sig = crypto.createSign('RSA-SHA256').update(input).sign(sa.private_key, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: input + '.' + sig })
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('token service account gagal');
  _tok = { value: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return _tok.value;
}

// Verifikasi ID token Firebase -> uid (kosong kalau tidak valid)
export async function uidDariToken(idToken) {
  if (!idToken) return null;
  try {
    const r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + FB_API_KEY, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken })
    });
    if (!r.ok) return null;
    const j = await r.json();
    return (j.users && j.users[0] && j.users[0].localId) || null;
  } catch (e) { return null; }
}

function docUrl(id) {
  return 'https://firestore.googleapis.com/v1/projects/' + projectId() +
    '/databases/(default)/documents/kuota/' + encodeURIComponent(id);
}
async function bacaHitung(id) {
  const t = await accessToken();
  const r = await fetch(docUrl(id), { headers: { Authorization: 'Bearer ' + t } });
  if (r.status === 404) return { count: 0, ada: false };
  if (!r.ok) throw new Error('baca kuota gagal ' + r.status);
  const j = await r.json();
  return { count: Number((j.fields && j.fields.count && j.fields.count.integerValue) || 0), ada: true };
}
async function tulisHitung(id, count, ada) {
  const t = await accessToken();
  const url = docUrl(id) + '?updateMask.fieldPaths=count&currentDocument.exists=' + (ada ? 'true' : 'false');
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { count: { integerValue: String(count) } } })
  });
  return r.ok;
}

function hariIni() { return new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10); }
function idTamu(req) {
  const xf = String((req.headers && req.headers['x-forwarded-for']) || (req.socket && req.socket.remoteAddress) || '?').split(',')[0].trim();
  return 'ip' + crypto.createHash('sha256').update(xf).digest('hex').slice(0, 20);
}

// Cek dan catat satu pemakaian. Mengembalikan { ok, pesan, sisa }.
export async function cekKuota(req, jenis) {
  if (!['chat', 'gambar', 'edit'].includes(jenis)) return { ok: false, pesan: 'Jenis tidak dikenal.' };
  try {
    const auth = String((req.headers && req.headers.authorization) || '').replace(/^Bearer\s+/i, '');
    const uid = await uidDariToken(auth);
    let kunci, batas;
    if (uid) {
      kunci = uid;
      batas = jenis === 'chat' ? BATAS.chat_user : (jenis === 'gambar' ? BATAS.gambar : BATAS.edit);
    } else {
      if (jenis !== 'chat') return { ok: false, pesan: 'Fitur ini khusus untuk yang sudah login. Login dulu dengan Google atau GitHub ya.' };
      kunci = idTamu(req);
      batas = BATAS.chat_tamu;
    }
    const id = kunci.replace(/[^\w-]/g, '') + '_' + jenis + '_' + hariIni();
    const h = await bacaHitung(id);
    if (h.count >= batas) {
      return { ok: false, sisa: 0, pesan: 'Batas ' + (jenis === 'chat' ? 'chat' : jenis === 'gambar' ? 'gambar' : 'edit foto') +
        ' hari ini sudah habis (' + batas + ' per hari). Coba lagi besok ya.' };
    }
    const tulis = await tulisHitung(id, h.count + 1, h.ada);
    if (!tulis) return { ok: false, pesan: 'Server sedang sibuk mencatat pemakaian, coba kirim lagi sebentar.' };
    return { ok: true, sisa: batas - (h.count + 1) };
  } catch (e) {
    // Gagal cek kuota = tolak (lebih aman daripada membiarkan batas terlewati)
    return { ok: false, pesan: 'Tidak bisa mengecek batas pemakaian sekarang. Coba lagi sebentar.' };
  }
}

// Endpoint: POST { jenis } dengan header Authorization (opsional)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, pesan: 'Method salah' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const hasil = await cekKuota(req, (body && body.jenis) || '');
  return res.status(200).json(hasil);
}
