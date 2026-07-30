import { redirect } from "next/navigation";

// Landing page comes later; for now go straight to the demo invitation.
export default function Home() {
  redirect("/i/demo-khan");
}
