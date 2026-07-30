export const metadata = {
  title: "Haanji — You are invited",
  description: "Beautiful digital invitations for South Asian weddings. RSVP in two taps.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
