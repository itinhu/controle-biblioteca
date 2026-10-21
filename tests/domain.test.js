import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dueDate, loanStatus, integer, textField } from '../server/domain.js';

test('prazo atravessa mês e ano e inclui ano bissexto', () => {
 assert.equal(dueDate('2026-12-28', 7), '2027-01-04');
 assert.equal(dueDate('2028-02-25', 7), '2028-03-03');
});
test('vence hoje sem atraso; devolução encerra atraso', () => {
 const loan = { due_date: '2026-10-21', returned_at: null };
 assert.equal(loanStatus(loan, '2026-10-21'), 'active');
 assert.equal(loanStatus(loan, '2026-10-22'), 'overdue');
 assert.equal(loanStatus({ ...loan, returned_at: '2026-10-22T12:00:00Z' }, '2026-10-23'), 'returned');
});
test('rejeita séries e prazos inválidos e nomes vazios', () => {
 for (const value of [0, 7, 1.5, 'abc']) assert.throws(() => integer(value, 'Ano', 1, 6));
 assert.throws(() => textField('  ', 'Nome'));
 assert.equal(textField(' Ana ', 'Nome'), 'Ana');
});
