import test from 'node:test'
import assert from 'node:assert/strict'
import { isVaultCodeSubmittable } from '@/hooks/useVault'

test('useVault helper allows only 4-digit numeric code', () => {
  assert.equal(isVaultCodeSubmittable('0000'), true)
  assert.equal(isVaultCodeSubmittable('12'), false)
  assert.equal(isVaultCodeSubmittable('12ab'), false)
})
