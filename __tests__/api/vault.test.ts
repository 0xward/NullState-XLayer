import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_VAULT_ATTEMPTS,
  getAttemptsRemaining,
  parseWeekId,
  validateVaultCode,
} from '@/lib/vault-utils'

test('validates 4-digit vault code format', () => {
  assert.equal(validateVaultCode('1234'), true)
  assert.equal(validateVaultCode('abcd'), false)
  assert.equal(validateVaultCode('12345'), false)
})

test('parses valid week id values', () => {
  assert.equal(parseWeekId('202627'), 202627)
  assert.equal(parseWeekId(202627), 202627)
})

test('throws for invalid week id', () => {
  assert.throws(() => parseWeekId('abc'))
  assert.throws(() => parseWeekId(1234))
})

test('calculates attempts remaining', () => {
  assert.equal(getAttemptsRemaining(0), MAX_VAULT_ATTEMPTS)
  assert.equal(getAttemptsRemaining(2), 1)
  assert.equal(getAttemptsRemaining(7), 0)
})
