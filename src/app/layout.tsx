import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Portfoliogy — Resume to Portfolio in Seconds",
  description:
    "Upload your resume and get a stunning portfolio website built and deployed instantly. Powered by AI.",
  keywords: ["portfolio", "resume", "AI", "portfolio generator", "website builder"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
