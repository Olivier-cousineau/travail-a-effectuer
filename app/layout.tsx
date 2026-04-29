import "./globals.css";

export const metadata = {
  title: "Municipal Truck Jobs",
  description: "Track municipal truck jobs from notebook photos",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
