import { supabase } from "../../../lib/supabaseClient";
import InviteCard from "../../../components/InviteCard";

export default async function InvitePage({ params }) {
  const { token } = params;

  // No Supabase env configured yet (client is null), or token not found in
  // the DB: fall back to the built-in demo data so the demo link never breaks.
  if (!supabase) {
    return <InviteCard token={token} />;
  }

  const { data, error } = await supabase.rpc("get_invite", { p_token: token });
  if (error || !data) {
    return <InviteCard token={token} />;
  }

  return <InviteCard token={token} live={data} />;
}
