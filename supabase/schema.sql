-- Execute uma vez no SQL Editor do seu projeto Supabase.
begin;
create table if not exists public.students (
 id uuid primary key default gen_random_uuid(), name text not null check (length(trim(name)) between 1 and 160),
 grade integer not null check (grade between 1 and 6), created_at timestamptz not null default now()
);
create table if not exists public.books (
 id uuid primary key default gen_random_uuid(), title text not null check (length(trim(title)) between 1 and 160),
 author text not null default '', copies integer not null default 1 check (copies between 1 and 999), created_at timestamptz not null default now()
);
create table if not exists public.loans (
 id uuid primary key default gen_random_uuid(), student_id uuid not null references public.students(id),
 book_id uuid not null references public.books(id), loan_date date not null, due_date date not null,
 returned_at timestamptz, created_at timestamptz not null default now(), check (due_date > loan_date)
);
create index if not exists loans_open_book on public.loans(book_id) where returned_at is null;
create index if not exists loans_due_date on public.loans(due_date) where returned_at is null;
alter table public.students enable row level security;
alter table public.books enable row level security;
alter table public.loans enable row level security;
-- Nenhuma política pública: somente a API com service_role acessa os dados.
revoke all on public.students, public.books, public.loans from anon, authenticated;
grant all on public.students, public.books, public.loans to service_role;
create or replace function public.create_loan(
 p_student_id uuid, p_student_name text, p_grade integer,
 p_book_id uuid, p_book_title text, p_book_author text,
 p_loan_date date, p_due_date date
) returns public.loans language plpgsql set search_path = public as $$
declare sid uuid := p_student_id; bid uuid := p_book_id; stock integer; active_count integer; result public.loans;
begin
 if sid is null then insert into students(name, grade) values(trim(p_student_name), p_grade) returning id into sid; end if;
 if bid is null then insert into books(title, author) values(trim(p_book_title), coalesce(p_book_author, '')) returning id into bid; end if;
 -- O bloqueio impede dois empréstimos simultâneos do último exemplar.
 select copies into stock from books where id = bid for update;
 if stock is null then raise exception 'Livro não encontrado.'; end if;
 if not exists(select 1 from students where id = sid) then raise exception 'Aluno não encontrado.'; end if;
 select count(*) into active_count from loans where book_id = bid and returned_at is null;
 if active_count >= stock then raise exception 'Todos os exemplares deste livro estão emprestados.'; end if;
 insert into loans(student_id, book_id, loan_date, due_date) values(sid, bid, p_loan_date, p_due_date) returning * into result;
 return result;
end;
$$;
revoke all on function public.create_loan(uuid,text,integer,uuid,text,text,date,date) from public, anon, authenticated;
grant execute on function public.create_loan(uuid,text,integer,uuid,text,text,date,date) to service_role;
commit;
