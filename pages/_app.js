export default function App({ Component, pageProps }) {
  return <><style jsx global>{`
    html, body, #__next { margin: 0; width: 100%; min-height: 100%; max-width: 100%; overflow-x: hidden; }
    *, *::before, *::after { box-sizing: border-box; }
  `}</style><Component {...pageProps} /></>;
}
