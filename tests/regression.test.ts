import test from 'node:test';
import assert from 'node:assert/strict';
import { computeOverallQAScore, sanitizeCallResultForHoldAndEcho } from '../src/utils/callRecordBuilder.ts';

const baseResult: any = {
  transcript: [],
  greetingAnalysis: { isGreetingUsed: false },
  customerNameAnalysis: { isMentionedByAgent: false, customerNameDetected: 'غير واضح' },
  customerTitleAnalysis: { isTitleUsedByAgent: false, titleDetected: 'محدد' },
  agentApologyAnalysis: { isApologyNeeded: true, isApologyUsedByAgent: false },
  holdTimeSummary: { holdCount: 0, holdSegments: [] },
  agentSilenceSummary: { silenceCount: 1, totalSilenceSeconds: 45 },
  furtherAssistanceAnalysis: { isAssistanceOffered: false },
  callEndingAnalysis: { isEndingPhraseUsed: false },
  unprofessionalWordsAnalysis: { hasUnprofessionalWords: true },
};

test('regression: transcript turns containing known product/template phrases are preserved', () => {
  const phrase = 'شكراً لاتصالك بصيدليات الطرشوبي، يومك سعيد';
  const input = { ...baseResult, transcript: [{ speaker: 'موظف', text: phrase, timeStart: '00:10' }] };
  const output = sanitizeCallResultForHoldAndEcho(input as any);
  assert.equal(output.transcript.length, 1);
  assert.equal(output.transcript[0].text, phrase);
  assert.equal(input.transcript.length, 1, 'input must not be mutated');
});

test('regression: missing tone evidence does not receive an assumed positive score', () => {
  const withoutTone = computeOverallQAScore({ ...baseResult } as any);
  const withToneZero = computeOverallQAScore({ ...baseResult, agentToneAnalysis: { score: 0 } } as any);
  assert.equal(withoutTone, withToneZero);
});

test('regression: tone scores are clamped to the documented 0-10 range', () => {
  const low = computeOverallQAScore({ ...baseResult, agentToneAnalysis: { score: -10 } } as any);
  const zero = computeOverallQAScore({ ...baseResult, agentToneAnalysis: { score: 0 } } as any);
  const high = computeOverallQAScore({ ...baseResult, agentToneAnalysis: { score: 99 } } as any);
  const ten = computeOverallQAScore({ ...baseResult, agentToneAnalysis: { score: 10 } } as any);
  assert.equal(low, zero);
  assert.equal(high, ten);
});

test('regression: speech VAD segments alone do not rewrite hold classification as compliant', () => {
  const input: any = {
    ...baseResult,
    transcript: [{ speaker: 'موظف', text: 'لحظات معايا على الانتظار', timeStart: '00:10' }],
    sileroVad: { speechSegments: [{ start: 10, end: 30, confidence: 0.99 }] },
    holdTimeSummary: {
      holdCount: 1, totalHoldSeconds: 20, overallClassification: 'بدون داعي',
      validHoldCount: 0, unjustifiedHoldCount: 1, isMusicCriterionCompliant: false,
      holdSegments: [{ timeStart: '00:10', timeEnd: '00:30', duration: 20, classification: 'بدون داعي', hasLoudMusic: false }],
    },
  };
  const output = sanitizeCallResultForHoldAndEcho(input);
  assert.equal(output.holdTimeSummary.overallClassification, 'بدون داعي');
  assert.equal(output.holdTimeSummary.isMusicCriterionCompliant, false);
  assert.equal(output.holdTimeSummary.unjustifiedHoldCount, 1);
});

import { isSameOriginRequest, isSafeBackupFilename, isValidBackupToken, isValidBasicCredentials, parseBasicAuthorization } from '../src/utils/security.ts';

const securePassword = 'a-strong-test-password-with-32chars!';
const basicHeader = `Basic ${Buffer.from(`qa-user:${securePassword}`, 'utf8').toString('base64')}`;

test('security: production credentials reject missing, short, and wrong credentials', () => {
  assert.equal(isValidBasicCredentials('', 'qa-user', securePassword), false);
  assert.equal(isValidBasicCredentials(basicHeader, 'qa-user', 'short'), false);
  assert.equal(isValidBasicCredentials(basicHeader, 'qa-user', securePassword + 'x'), false);
  assert.equal(isValidBasicCredentials(basicHeader, 'other-user', securePassword), false);
  assert.equal(isValidBasicCredentials(basicHeader, 'qa-user', securePassword), true);
});

test('security: Basic auth parser rejects malformed headers', () => {
  assert.equal(parseBasicAuthorization('Bearer abc'), null);
  assert.equal(parseBasicAuthorization('Basic not base64!'), null);
  assert.equal(parseBasicAuthorization(`Basic ${Buffer.from('missing-separator').toString('base64')}`), null);
});

test('security: backup download token must be long and exactly match', () => {
  const token = '0123456789abcdef0123456789abcdef';
  assert.equal(isValidBackupToken(token, token), true);
  assert.equal(isValidBackupToken('short', 'short'), false);
  assert.equal(isValidBackupToken(token + 'x', token), false);
  assert.equal(isValidBackupToken('', token), false);
});

test('security: state-changing requests require exact same origin', () => {
  assert.equal(isSameOriginRequest({ origin: 'https://pharmacy.example', host: 'pharmacy.example', protocol: 'https' }), true);
  assert.equal(isSameOriginRequest({ origin: 'https://evil.example', host: 'pharmacy.example', protocol: 'https' }), false);
  assert.equal(isSameOriginRequest({ host: 'pharmacy.example', protocol: 'https' }), false);
  assert.equal(isSameOriginRequest({ origin: 'null', host: 'pharmacy.example', protocol: 'https' }), false);
});


test('security: backup filenames allow safe basenames only', () => {
  assert.equal(isSafeBackupFilename('backup_2026-09-20.zip'), true);
  assert.equal(isSafeBackupFilename('backup.tar.gz'), true);
  assert.equal(isSafeBackupFilename('../secrets.zip'), false);
  assert.equal(isSafeBackupFilename('..\\secrets.zip'), false);
  assert.equal(isSafeBackupFilename('/tmp/backup.zip'), false);
  assert.equal(isSafeBackupFilename('backup.exe'), false);
  assert.equal(isSafeBackupFilename(''), false);
});

import { createServer } from 'node:http';
import { evaluateAccessPolicy } from '../src/utils/accessPolicy.ts';

test('HTTP integration: production API rejects anonymous access, keeps health public, and enforces same-origin writes', async (t) => {
  const username = 'qa-user';
  const password = 'a-strong-test-password-with-32chars!';
  const authorization = `Basic ${Buffer.from(`${username}:${password}`, 'utf8').toString('base64')}`;
  const server = createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const decision = evaluateAccessPolicy({
      path: url.pathname,
      method: req.method || 'GET',
      authorization: req.headers.authorization,
      origin: typeof req.headers.origin === 'string' ? req.headers.origin : undefined,
      host: req.headers.host,
      protocol: 'http',
    }, { production: true, username, password });
    if (!decision.allowed) {
      if (decision.challenge) res.setHeader('WWW-Authenticate', 'Basic realm="Call Transcriber"');
      res.statusCode = decision.status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: decision.error }));
      return;
    }
    res.statusCode = 200;
    res.end('ok');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;

  const anonymous = await fetch(`${base}/api/analyzed-calls`);
  assert.equal(anonymous.status, 401);
  assert.ok(anonymous.headers.get('www-authenticate'));

  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);

  const crossOriginWrite = await fetch(`${base}/api/hindsight/reset`, {
    method: 'POST',
    headers: { authorization, 'content-type': 'application/json' },
    body: '{}',
  });
  assert.equal(crossOriginWrite.status, 403);

  const sameOriginWrite = await fetch(`${base}/api/hindsight/reset`, {
    method: 'POST',
    headers: { authorization, origin: base, 'content-type': 'application/json' },
    body: '{}',
  });
  assert.equal(sameOriginWrite.status, 200);
});

test('HTTP integration: production fails closed when Basic Auth secrets are missing', async (t) => {
  const server = createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const decision = evaluateAccessPolicy({ path: url.pathname, method: req.method || 'GET' }, {
      production: true, username: '', password: '',
    });
    res.statusCode = decision.allowed ? 200 : decision.status;
    res.end(decision.allowed ? 'ok' : decision.error);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const response = await fetch(`http://127.0.0.1:${address.port}/api/analyzed-calls`);
  assert.equal(response.status, 503);
});

import { decodeAudioBase64 } from '../src/utils/audioInput.ts';

test('security: audio upload rejects malformed base64 and empty payloads', () => {
  assert.deepEqual(decodeAudioBase64(undefined), { ok: false, reason: 'missing' });
  assert.deepEqual(decodeAudioBase64(''), { ok: false, reason: 'missing' });
  assert.deepEqual(decodeAudioBase64('@@@='), { ok: false, reason: 'invalid-base64' });
  assert.deepEqual(decodeAudioBase64(''), { ok: false, reason: 'missing' });
  const decoded = decodeAudioBase64(Buffer.from('audio sample').toString('base64'));
  assert.equal(decoded.ok, true);
  if (decoded.ok) assert.equal(decoded.buffer.toString(), 'audio sample');
});

test('security: audio upload enforces the byte limit before accepting payloads', () => {
  const smallLimit = 3;
  assert.deepEqual(decodeAudioBase64(Buffer.from('four').toString('base64'), smallLimit), { ok: false, reason: 'too-large' });
  const withinLimit = decodeAudioBase64(Buffer.from('abc').toString('base64'), smallLimit);
  assert.equal(withinLimit.ok, true);
});
