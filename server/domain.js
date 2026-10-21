export function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
export function dueDate(start, days) {
  const date = new Date(`${start}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function loanStatus(loan, day = today()) {
  return loan.returned_at ? 'returned' : loan.due_date < day ? 'overdue' : 'active';
}
export function textField(value, name, max = 160) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new Error(`${name}: preencha entre 1 e ${max} caracteres.`);
  return value.trim();
}
export function integer(value, name, min, max) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new Error(`${name}: informe um número entre ${min} e ${max}.`);
  return number;
}
