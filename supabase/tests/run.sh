#!/usr/bin/env bash
# Tests the database rules in supabase/schema.sql on a real PostgreSQL: who can read, add, change and delete what.
#
#   createdb kindling_test
#   I_UNDERSTAND_THIS_WIPES_THE_DATABASE=yes TEST_DATABASE_URL="dbname=kindling_test" bash supabase/tests/run.sh
#
# It wipes the public schema of the database you name, so use an empty scratch database, never your real one.
# It needs a superuser connection (it creates roles that stand in for Supabase's anon and authenticated roles).
set -u
DB="${TEST_DATABASE_URL:-}"
if [ -z "$DB" ] || [ "${I_UNDERSTAND_THIS_WIPES_THE_DATABASE:-}" != "yes" ]; then
  echo "Set TEST_DATABASE_URL to a scratch database and I_UNDERSTAND_THIS_WIPES_THE_DATABASE=yes. It is wiped."; exit 2
fi
case "$DB" in *supabase.co*|*supabase.com*|*pooler*) echo "Refusing: that looks like a hosted Supabase database."; exit 2;; esac
DIR="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
psql "$DB" -X -q -v ON_ERROR_STOP=1 -c "drop schema if exists public cascade; drop schema if exists auth cascade; create schema public;" >/dev/null || exit 2
psql "$DB" -X -q -v ON_ERROR_STOP=1 -f "$DIR/harness.sql" >/dev/null || exit 2
psql "$DB" -X -q -v ON_ERROR_STOP=1 -f "$DIR/../schema.sql" >/dev/null || { echo "schema.sql failed to apply"; exit 2; }
psql "$DB" -X -q -v ON_ERROR_STOP=1 -f "$DIR/../schema.sql" >/dev/null || { echo "schema.sql is not safe to run twice"; exit 2; }
echo "schema applied twice without error"
O=11111111-1111-1111-1111-111111111111
M=22222222-2222-2222-2222-222222222222
X=33333333-3333-3333-3333-333333333333
pass=0; fail=0
# q <uid|anon> <sql> : runs the SQL as that user with a proper login claim; prints rows or an ERROR line.
q() {
  local who=$1 sql=$2 f="$TMP/q.sql"
  if [ "$who" = anon ]; then
    printf "begin;\nset local role anon;\n%s;\ncommit;\n" "$sql" > $f
  else
    printf "begin;\nset local role authenticated;\nselect set_config('request.jwt.claim.sub','%s',true), set_config('request.jwt.claims','{\"sub\":\"%s\",\"email\":\"user-%s@x.com\"}',true) \\\\g /dev/null\n%s;\ncommit;\n" "$who" "$who" "${who:0:2}" "$sql" > $f
  fi
  psql "$DB" -X -q -t -A -v ON_ERROR_STOP=1 -f "$f" 2>&1 | grep -v '^$' | tr '\n' ' ' | sed 's/ *$//'
}
expect_ok()   { out=$(q "$2" "$3"); if echo "$out" | grep -qi "error"; then echo "FAIL $1 :: $out"; fail=$((fail+1)); else echo "PASS $1"; pass=$((pass+1)); fi; }
expect_err()  { out=$(q "$2" "$3"); if echo "$out" | grep -qiE "syntax error|does not exist"; then echo "FAIL $1 (error came from a broken test, not the rule) :: $out"; fail=$((fail+1)); elif echo "$out" | grep -qi "error"; then echo "PASS $1  [$(echo $out | cut -c1-70)]"; pass=$((pass+1)); else echo "FAIL $1 (should be refused) :: $out"; fail=$((fail+1)); fi; }
expect_rows() { out=$(q "$2" "$3"); if [ "$out" = "$4" ]; then echo "PASS $1"; pass=$((pass+1)); else echo "FAIL $1 :: got [$out] want [$4]"; fail=$((fail+1)); fi; }
admin() { psql "$DB" -X -q -t -A -c "$1" | grep -v '^$'; }

admin "truncate public.kindling_members, public.kindling_teams, public.kindling_state cascade" >/dev/null
TID=$(q $O "select public.create_team('Salon crew','{\"intake\":{\"trade\":\"salon\"}}'::jsonb)")
echo "team: $TID"
[[ "$TID" =~ ^[0-9a-f]{8}- ]] && { echo "PASS owner creates a crew"; pass=$((pass+1)); } || { echo "FAIL create_team :: $TID"; fail=$((fail+1)); }

expect_rows "owner is a member automatically" $O "select count(*) from public.kindling_members where team_id='$TID'" "1"
expect_rows "owner email recorded from the login claim" $O "select email from public.kindling_members where team_id='$TID'" "user-11@x.com"
expect_rows "outsider cannot see the team" $X "select count(*) from public.kindling_teams" "0"
expect_rows "outsider cannot see members" $X "select count(*) from public.kindling_members" "0"
expect_rows "outsider update changes nothing" $X "with u as (update public.kindling_teams set state='{}' where id='$TID' returning 1) select count(*) from u" "0"
expect_err  "outsider cannot read invite" $X "select public.get_invite('$TID')"
expect_err  "outsider cannot insert a team directly" $X "insert into public.kindling_teams(owner_id) values ('$X')"
expect_err  "outsider cannot add themselves as a member" $X "insert into public.kindling_members(team_id,user_id) values ('$TID','$X')"
expect_err  "anon cannot call create_team" anon "select public.create_team('x','{}')"
expect_err  "anon cannot read teams" anon "select * from public.kindling_teams"
expect_rows "anon sees no personal rows" anon "select count(*) from public.kindling_state" "0"

CODE=$(admin "select invite_code from public.kindling_teams where id='$TID'")
expect_ok   "owner can read the invite" $O "select public.get_invite('$TID')"
expect_err  "bad invite code is refused" $M "select public.join_team('nope')"
expect_ok   "member joins with the code" $M "select public.join_team('$CODE')"
expect_rows "member now sees the crew" $M "select count(*) from public.kindling_teams" "1"
expect_rows "member sees both teammates" $M "select count(*) from public.kindling_members where team_id='$TID'" "2"
expect_rows "member can read the shared week" $M "select state->'intake'->>'trade' from public.kindling_teams where id='$TID'" "salon"
expect_err  "member cannot read invite_code column" $M "select invite_code from public.kindling_teams"
expect_err  "member cannot call get_invite" $M "select public.get_invite('$TID')"
expect_ok   "member can edit the shared week" $M "update public.kindling_teams set state='{\"intake\":{\"trade\":\"salon\"},\"x\":1}', version=2 where id='$TID'"
expect_rows "the edit really landed" $O "select version from public.kindling_teams where id='$TID'" "2"
expect_err  "member cannot rename directly" $M "update public.kindling_teams set name='hacked' where id='$TID'"
expect_err  "member cannot take ownership" $M "update public.kindling_teams set owner_id='$M' where id='$TID'"
expect_err  "member cannot swap the invite code" $M "update public.kindling_teams set invite_code='abc' where id='$TID'"
expect_err  "member cannot rename via function" $M "select public.rename_team('$TID','x')"
expect_err  "member cannot regenerate invite" $M "select public.regenerate_invite('$TID')"
expect_err  "member cannot remove the owner" $M "select public.remove_member('$TID','$O')"
expect_err  "member cannot delete the crew" $M "select public.delete_team('$TID')"
expect_err  "member cannot add members directly" $M "insert into public.kindling_members(team_id,user_id) values ('$TID','$X')"
expect_err  "member cannot delete members directly" $M "delete from public.kindling_members where team_id='$TID'"
expect_err  "owner cannot leave" $O "select public.leave_team('$TID')"
expect_ok   "owner renames" $O "select public.rename_team('$TID','Braids crew')"
expect_rows "rename took effect" $M "select name from public.kindling_teams where id='$TID'" "Braids crew"
expect_ok   "owner regenerates the invite" $O "select public.regenerate_invite('$TID')"
expect_err  "old invite no longer works" $X "select public.join_team('$CODE')"
expect_ok   "owner removes the member" $O "select public.remove_member('$TID','$M')"
expect_rows "removed member sees nothing" $M "select count(*) from public.kindling_teams" "0"
NEW=$(admin "select invite_code from public.kindling_teams where id='$TID'")
expect_ok   "member rejoins with the new code" $M "select public.join_team('$NEW')"
expect_ok   "member can leave" $M "select public.leave_team('$TID')"
expect_rows "left member sees nothing" $M "select count(*) from public.kindling_teams" "0"

admin "insert into public.kindling_state(user_id,state) values ('$O','{\"a\":1}'),('$M','{\"b\":2}')" >/dev/null
expect_rows "user sees only their own personal row" $O "select count(*) from public.kindling_state" "1"
expect_rows "other user cannot read it" $X "select count(*) from public.kindling_state" "0"
expect_err  "cannot write another user's personal row" $X "insert into public.kindling_state(user_id,state) values ('$O','{}')"
expect_rows "cannot update another user's row" $X "with u as (update public.kindling_state set state='{}' where user_id='$O' returning 1) select count(*) from u" "0"
expect_rows "cannot delete another user's row" $X "with d as (delete from public.kindling_state where user_id='$O' returning 1) select count(*) from d" "0"

for i in 1 2 3 4; do q $O "select public.create_team('c$i','{}')" >/dev/null; done
expect_err  "owner is capped at 5 crews" $O "select public.create_team('c6','{}')"
expect_ok   "owner deletes the crew" $O "select public.delete_team('$TID')"
expect_rows "members are removed with the crew" $O "select count(*) from public.kindling_members where team_id='$TID'" "0"

# ---- weekly email preferences
expect_ok   "user can create their own preferences" $O "insert into public.kindling_prefs(user_id,email,weekly_email,weekday,consented_at) values ('$O','o@x.com',true,1,now())"
expect_err  "user cannot create preferences for someone else" $X "insert into public.kindling_prefs(user_id,email) values ('$O','a@b.c')"
expect_err  "user cannot set the last-sent date themselves" $X "insert into public.kindling_prefs(user_id,email,last_sent_on) values ('$X','x@x.com',current_date)"
expect_rows "user reads their own preferences" $O "select weekly_email from public.kindling_prefs" "t"
expect_rows "other users cannot read them" $X "select count(*) from public.kindling_prefs" "0"
expect_err  "anonymous visitors are denied outright" anon "select count(*) from public.kindling_prefs"
expect_ok   "user can switch the email off" $O "update public.kindling_prefs set weekly_email=false where user_id='$O'"
expect_err  "user cannot edit last_sent_on" $O "update public.kindling_prefs set last_sent_on=current_date where user_id='$O'"
expect_err  "user cannot edit last_kind" $O "update public.kindling_prefs set last_kind='summary' where user_id='$O'"
expect_rows "cannot change someone else's preferences" $X "with u as (update public.kindling_prefs set weekly_email=true where user_id='$O' returning 1) select count(*) from u" "0"
expect_err  "weekday must be 0 to 6" $O "update public.kindling_prefs set weekday=9 where user_id='$O'"
expect_ok   "user can delete their preferences" $O "delete from public.kindling_prefs where user_id='$O'"
expect_rows "preferences deleted" $O "select count(*) from public.kindling_prefs" "0"

# ---- training data layer
admin "truncate public.kindling_training_examples, public.kindling_training_consent" >/dev/null
EX="insert into public.kindling_training_examples(user_id,workflow,channel,language,note,draft,final,source) values"
expect_err  "no row can be shared before consent exists" $O "$EX ('$O','reply-desk','whatsapp','english','what time do you open','draft','final text','live')"
expect_ok   "a person can record their own consent" $O "insert into public.kindling_training_consent(user_id,consented,consented_at) values ('$O',true,now())"
expect_err  "a person cannot record consent for someone else" $X "insert into public.kindling_training_consent(user_id,consented) values ('$O',true)"
expect_ok   "after consent they can share an example" $O "$EX ('$O','reply-desk','whatsapp','english','what time do you open','draft','final text','live')"
expect_err  "they cannot share as someone else" $O "$EX ('$M','reply-desk','whatsapp','english','what time do you open','draft','final text','live')"
expect_err  "someone who has not consented still cannot share" $M "$EX ('$M','reply-desk','whatsapp','english','what time do you open','draft','final text','live')"
expect_rows "a person reads only their own examples" $O "select count(*) from public.kindling_training_examples" "1"
expect_rows "others cannot read them" $X "select count(*) from public.kindling_training_examples" "0"
expect_err  "anonymous visitors are denied" anon "select count(*) from public.kindling_training_examples"
expect_err  "examples cannot be edited" $O "update public.kindling_training_examples set final='changed' where user_id='$O'"
expect_err  "a person cannot choose the row id" $O "insert into public.kindling_training_examples(id,user_id,workflow,channel,language,note,draft,final,source) values (gen_random_uuid(),'$O','w','whatsapp','english','what time do you open','d','final text','live')"
expect_err  "an unknown channel is refused" $O "$EX ('$O','w','carrier-pigeon','english','what time do you open','d','final text','live')"
expect_err  "a too-short note is refused" $O "$EX ('$O','w','whatsapp','english','hi','d','final text','live')"
expect_err  "an unknown language is refused" $O "$EX ('$O','w','whatsapp','klingon','what time do you open','d','final text','live')"
expect_rows "another person cannot delete their rows" $X "with d as (delete from public.kindling_training_examples where user_id='$O' returning 1) select count(*) from d" "0"
admin "insert into public.kindling_training_examples(user_id,workflow,channel,language,note,draft,final,source) select '$O','w','whatsapp','english','what time do you open '||g,'d','final text','live' from generate_series(1,199) g" >/dev/null
expect_err  "a person is capped at 200 shared examples" $O "$EX ('$O','w','whatsapp','english','one more example please','d','final text','live')"
expect_ok   "a person can delete one of their examples" $O "delete from public.kindling_training_examples where id = (select id from public.kindling_training_examples limit 1)"
expect_ok   "withdrawing consent is allowed" $O "update public.kindling_training_consent set consented=false where user_id='$O'"
expect_rows "withdrawing consent deletes everything they shared" $O "select count(*) from public.kindling_training_examples" "0"
expect_err  "after withdrawal they cannot share again" $O "$EX ('$O','w','whatsapp','english','what time do you open','d','final text','live')"
expect_ok   "they can consent again later" $O "update public.kindling_training_consent set consented=true, consented_at=now() where user_id='$O'"
expect_ok   "and share again" $O "$EX ('$O','w','whatsapp','english','what time do you open','d','final text','live')"
admin "delete from auth.users where id='$O'" >/dev/null
expect_rows "deleting the account removes the examples" $O "select count(*) from public.kindling_training_examples" "0"
admin "insert into auth.users values ('$O','owner@x.com') on conflict do nothing" >/dev/null

# ---- usage counts
admin "truncate public.kindling_event_counts" >/dev/null
expect_err  "a signed-in person cannot read usage counts" $O "select * from public.kindling_event_counts"
expect_err  "anonymous visitors cannot read usage counts" anon "select * from public.kindling_event_counts"
expect_err  "nobody can add usage counts directly" $O "insert into public.kindling_event_counts(event,count) values ('visit',5)"
expect_err  "a signed-in person cannot call the counting function" $O "select public.bump_event('visit')"
expect_err  "anonymous visitors cannot call the counting function" anon "select public.bump_event('visit')"
admin "select public.bump_event('visit')" >/dev/null; admin "select public.bump_event('visit')" >/dev/null; admin "select public.bump_event('week_built')" >/dev/null
c=$(admin "select count from public.kindling_event_counts where event='visit' and day=(now() at time zone 'utc')::date")
if [ "$c" = "2" ]; then echo "PASS the server can count, and counts add up per day"; pass=$((pass+1)); else echo "FAIL counts did not add up :: got [$c]"; fail=$((fail+1)); fi
c=$(admin "select count(*) from public.kindling_event_counts where day=(now() at time zone 'utc')::date")
if [ "$c" = "2" ]; then echo "PASS each event has its own row per day"; pass=$((pass+1)); else echo "FAIL expected two rows :: got [$c]"; fail=$((fail+1)); fi
out=$(psql "$DB" -X -q -t -A -c "select public.bump_event('buy_everything')" 2>&1)
if echo "$out" | grep -qi "violates check"; then echo "PASS an event name that is not on the list is refused"; pass=$((pass+1)); else echo "FAIL unknown event accepted :: $out"; fail=$((fail+1)); fi
c=$(admin "select count(*) from information_schema.columns where table_name='kindling_event_counts' and column_name not in ('day','event','count')")
if [ "$c" = "0" ]; then echo "PASS the table holds no user id, address or other identifier"; pass=$((pass+1)); else echo "FAIL extra columns present :: $c"; fail=$((fail+1)); fi
echo "----- passed $pass, failed $fail"
[ "$fail" -eq 0 ]
