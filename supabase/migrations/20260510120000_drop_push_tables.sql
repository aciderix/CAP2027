-- FCM push has been replaced by the Capacitor background runner on
-- the client (see public/background.js). Both tables had no remaining
-- writers (push.ts removed from the app, push-broadcast edge function
-- replaced by a 410 Gone stub), and no FK depended on them.
drop table if exists public.push_tokens cascade;
drop table if exists public.push_broadcasts cascade;
