import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="fr">
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" content="#019EE5" />
        <link rel="manifest" href="/manifest.json" />
        <link
          rel="apple-touch-icon"
          href="/icon-192.png"
        />
      </Head>
      <body style={{ margin: 0, width: '100%', overflowX: 'hidden' }}>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
