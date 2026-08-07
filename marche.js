import { useEffect, useMemo, useState } from 'react';
const BLUE = '#019EE5';
const field = { width: '100%', padding: 11, border: '1px solid #ddd', borderRadius: 10, boxSizing: 'border-box', marginBottom: 8 };
export default function Marche() {
  const [products, setProducts] = useState([]), [q, setQ] = useState(''), [cart, setCart] = useState([]), [message, setMessage] = useState('');
  const [customer, setCustomer] = useState({ customerName: '', customerPhone: '', deliveryAddress: '' });
  useEffect(() => { fetch('/api/products').then((r) => r.json()).then((d) => Array.isArray(d) && setProducts(d)); }, []);
  const shown = useMemo(() => products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()) || (p.category || '').toLowerCase().includes(q.toLowerCase())), [products, q]);
  const add = (p) => { if (cart.length && cart[0].shop_id !== p.shop_id) return setMessage('Termine d’abord la commande de cette boutique.'); setCart((c) => { const old = c.find((x) => x.id === p.id); return old ? c.map((x) => x.id === p.id ? { ...x, quantity: Math.min(x.quantity + 1, p.stock) } : x) : [...c, { ...p, quantity: 1 }]; }); };
  const total = cart.reduce((sum, p) => sum + p.price * p.quantity, 0);
  async function order() { setMessage(''); const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...customer, items: cart.map((p) => ({ productId: p.id, quantity: p.quantity })) }) }); const data = await res.json(); if (!res.ok) return setMessage(data.error || 'Commande impossible'); setCart([]); setMessage(`Commande ${data.id.slice(0, 8)} enregistrée. La boutique va te contacter.`); }
  return <main style={{ minHeight: '100vh', background: '#f4f7f8', fontFamily: 'Inter,system-ui,sans-serif' }}>
    <header style={{ background: BLUE, color: 'white', padding: 18 }}><div style={{ maxWidth: 1100, margin: 'auto', display: 'flex', justifyContent: 'space-between' }}><b>WAKH REEK — السوق</b><a href="/" style={{ color: 'white' }}>الرئيسية</a></div></header>
    <div style={{ maxWidth: 1100, margin: '20px auto', padding: 12 }}><h1>السمن، العسل ومنتجات التجار</h1><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن منتج أو فئة…" style={field} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>{shown.map((p) => <article key={p.id} style={{ background: 'white', borderRadius: 16, padding: 14 }}>
        {p.image_url ? <img src={p.image_url} alt={p.name} style={{ width: '100%', height: 170, objectFit: 'cover', borderRadius: 12 }} /> : <div style={{ height: 170, background: '#fff4df', borderRadius: 12, display: 'grid', placeItems: 'center', fontSize: 48 }}>🍯</div>}
        <h3>{p.name}</h3><p style={{ color: '#666', minHeight: 38 }}>{p.description}</p><small>{p.shops?.name} — {p.shops?.city}</small><p><b>{p.price} FCFA</b> · المخزون {p.stock}</p>
        <button disabled={!p.stock} onClick={() => add(p)} style={{ width: '100%', padding: 11, border: 0, borderRadius: 10, background: p.stock ? BLUE : '#aaa', color: 'white', fontWeight: 800 }}>أضف للسلة</button>
      </article>)}</div>
      {cart.length > 0 && <section style={{ marginTop: 24, background: 'white', padding: 18, borderRadius: 16 }}><h2>سلة الطلب</h2>{cart.map((p) => <p key={p.id}>{p.name} × {p.quantity} — {p.price * p.quantity} F</p>)}<h3>المجموع: {total} FCFA</h3>
        <input style={field} placeholder="الاسم الكامل" value={customer.customerName} onChange={(e) => setCustomer({ ...customer, customerName: e.target.value })} /><input style={field} placeholder="رقم الهاتف" value={customer.customerPhone} onChange={(e) => setCustomer({ ...customer, customerPhone: e.target.value })} /><textarea style={field} placeholder="عنوان التوصيل" value={customer.deliveryAddress} onChange={(e) => setCustomer({ ...customer, deliveryAddress: e.target.value })} /><button onClick={order} style={{ width: '100%', padding: 12, border: 0, borderRadius: 10, background: '#16a34a', color: 'white', fontWeight: 800 }}>تأكيد الطلب</button></section>}
      {message && <p style={{ background: '#fff7d6', padding: 12, borderRadius: 10 }}>{message}</p>}
    </div></main>;
}
