// MapLibre CSS must be imported BEFORE globals.css (which includes Tailwind).
// Both end up as <link> tags in <head>; loading MapLibre first ensures
// Tailwind's .absolute class wins the specificity tie-breaker over
// MapLibre's .maplibregl-map { position: relative } rule.
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RangerWatch',
  description: 'Anonymously report park ranger sightings in your area.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'RangerWatch',
  },
  icons: {
    icon: '/icons/icon.svg',
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#1e293b',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        {process.env.NODE_ENV === 'production' && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                if ('serviceWorker' in navigator) {
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js').catch(function(err) {
                      console.warn('SW registration failed:', err);
                    });
                  });
                }
              `,
            }}
          />
        )}
      </head>
      <body className="bg-slate-900 text-white antialiased">
        <div className="pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
