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
        <link rel="icon" type="image/png" href="/exec-73f48906-8ed1-4886-81ea-0c0f949bae9d.png" />
<link rel="apple-touch-icon" href="/exec-73f48906-8ed1-4886-81ea-0c0f949bae9d.png" />
        <link rel="apple-touch-icon" href="/icon.svg" />
      </Head>

      <Component {...pageProps} />
    </>
  );
}
