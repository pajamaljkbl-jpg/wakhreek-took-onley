import { useEffect } from 'react';
import Head from 'next/head';

export default function App({ Component, pageProps }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
      });
    }
  }, []);

  return (
    <>
      <Head>
        <meta name="theme-color" content="#019EE5" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
     <link rel="icon" type="image/png" href="/icon-192.png" />
<link rel="apple-touch-icon" href="/icon-192.png" />
      </Head>

      <Component {...pageProps} />
    </>
  );
}
