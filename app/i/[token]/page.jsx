import InviteCard from "../../../components/InviteCard";

// Day 2: look up `params.token` in Supabase (households table) and pass
// real household + events into InviteCard. For now every token renders
// the demo Khan family invitation.
export default function InvitePage({ params }) {
  return <InviteCard token={params.token} />;
}
