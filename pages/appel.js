import { useEffect, useRef, useState } from 'react';
import { getSupabaseBrowser } from '../lib/supabase-browser';

const BLUE = '#019EE5';

export default function Appel() {
  const [conversationId, setConversationId] = useState('');
  const [requestedMode, setRequestedMode] = useState('');
  const [session, setSession] = useState(null);
  const [call, setCall] = useState(null);
  const [message, setMessage] = useState('Chargement de la salle Wakh Reek…');
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);
  const roleRef = useRef(null);
  const remoteDescriptionSet = useRef(false);
  const candidateKeys = useRef(new Set());
  const autoStarted = useRef(false);

  useEffect(() => {
    const client = getSupabaseBrowser();
    client.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = client.auth.onAuthStateChange((_event, next) => setSession(next));
    const params = new URLSearchParams(window.location.search);
    const id = params.get('conversationId');
    const mode = params.get('mode');
    if (!id) setMessage('Lien d’appel incomplet. Ouvre l’appel depuis une discussion Wakh Reek.');
    else setConversationId(id);
    if (mode === 'audio' || mode === 'video') setRequestedMode(mode);
    return () => listener.subscription.unsubscribe();
  }, []);

  const authHeaders = () => session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};

  useEffect(() => {
    if (!conversationId || !session) return;
    let active = true;
    const refresh = async () => {
      try {
        const res = await fetch(`/api/calls?conversationId=${encodeURIComponent(conversationId)}`, { headers: authHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Impossible de joindre la salle');
        if (active) setCall(data);
        if (data && peerRef.current) await applyRemoteSignals(data);
        if (active && !data) setMessage('Salle prête. Tu peux démarrer un appel.');
      } catch (error) { if (active) setMessage(error.message); }
    };
    refresh();
    const timer = setInterval(refresh, 1500);
    return () => { active = false; clearInterval(timer); };
  }, [conversationId, session]);

  useEffect(() => {
    if (!session || !conversationId || !requestedMode || call === undefined || autoStarted.current) return;
    if (!call || call.status === 'ended') {
      autoStarted.current = true;
      startCall(requestedMode);
    }
  }, [session, conversationId, requestedMode, call]);

  useEffect(() => () => closeLocalOnly(), []);

  async function api(body) {
    if (!session?.access_token) throw new Error('Connexion requise');
    const res = await fetch('/api/calls', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ conversationId, ...body }) });
    const data = res.status === 204 ? null : await res.json();
    if (!res.ok) throw new Error(data?.error || 'Erreur pendant l’appel');
    return data;
  }

  async function createPeer(side, type) {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Ce navigateur ne permet pas le microphone ou la caméra.');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
    streamRef.current = stream;
    if (localVideo.current) localVideo.current.srcObject = stream;
    const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] });
    peerRef.current = peer;
    roleRef.current = side;
    stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    peer.ontrack = (event) => { if (remoteVideo.current) { remoteVideo.current.srcObject = event.streams[0]; remoteVideo.current.play?.().catch(() => {}); } };
    peer.pendingCandidates = [];
    peer.onicecandidate = (event) => {
      if (!event.candidate) return;
      const signal = event.candidate.toJSON();
      if (!peer.callId) peer.pendingCandidates.push(signal);
      else api({ action: 'candidate', callId: peer.callId, side, signal }).catch(() => {});
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') setMessage('Appel Wakh Reek connecté');
      if (peer.connectionState === 'failed') setMessage('Connexion impossible sur ce réseau. Réessaie avec Wi-Fi ou données mobiles.');
      if (peer.connectionState === 'disconnected') setMessage('Connexion interrompue…');
    };
    return peer;
  }

  async function startCall(type) {
    try {
      setBusy(true); setMessage(type === 'video' ? 'Préparation du micro et de la caméra…' : 'Préparation du microphone…');
      const peer = await createPeer('caller', type);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const created = await api({ action: 'start', callType: type, signal: peer.localDescription.toJSON() });
      peer.callId = created.id;
      for (const signal of peer.pendingCandidates) await api({ action: 'candidate', callId: created.id, side: 'caller', signal });
      peer.pendingCandidates = [];
      setCall(created);
      setMessage('📞 Appel en cours… L’autre membre doit ouvrir cette discussion et accepter.');
    } catch (error) {
      const explanation = error?.name === 'NotAllowedError' ? 'Autorise le microphone et la caméra pour Wakh Reek puis réessaie.' : (error.message || 'Micro ou caméra non autorisé.');
      setMessage(explanation); closeLocalOnly(); autoStarted.current = false;
    } finally { setBusy(false); }
  }

  async function answerCall() {
    try {
      if (!call?.offer) return;
      setBusy(true); setMessage('Connexion à l’appel…');
      const peer = await createPeer('callee', call.call_type);
      peer.callId = call.id;
      await peer.setRemoteDescription(new RTCSessionDescription(call.offer));
      remoteDescriptionSet.current = true;
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      const updated = await api({ action: 'answer', callId: call.id, signal: peer.localDescription.toJSON() });
      setCall(updated); setMessage('Appel Wakh Reek connecté');
    } catch (error) {
      const explanation = error?.name === 'NotAllowedError' ? 'Autorise le microphone et la caméra pour Wakh Reek puis réessaie.' : (error.message || 'Impossible de répondre à cet appel.');
      setMessage(explanation); closeLocalOnly();
    } finally { setBusy(false); }
  }

  async function applyRemoteSignals(updated) {
    const peer = peerRef.current;
    if (!peer) return;
    if (roleRef.current === 'caller' && updated.answer && !remoteDescriptionSet.current) {
      await peer.setRemoteDescription(new RTCSessionDescription(updated.answer));
      remoteDescriptionSet.current = true;
    }
    const candidates = roleRef.current === 'caller' ? updated.callee_candidates : updated.caller_candidates;
    for (const candidate of candidates || []) {
      const key = JSON.stringify(candidate);
      if (candidateKeys.current.has(key)) continue;
      candidateKeys.current.add(key);
      try { await peer.addIceCandidate(new RTCIceCandidate(candidate)); } catch (_) {}
    }
    if (updated.status === 'ended' && peer.connectionState !== 'closed') { setMessage('L’appel est terminé.'); closeLocalOnly(); }
  }

  function closeLocalOnly() {
    peerRef.current?.close(); peerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null;
    remoteDescriptionSet.current = false; candidateKeys.current = new Set();
  }

  async function endCall() {
    try { if (call?.id) await api({ action: 'end', callId: call.id }); } catch (_) {}
    closeLocalOnly(); setCall((value) => value ? { ...value, status: 'ended' } : value); setMessage('L’appel est terminé.');
  }

  function toggleMute() { const next = !muted; streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !next; }); setMuted(next); }
  function toggleCamera() { const next = !cameraOff; streamRef.current?.getVideoTracks().forEach((track) => { track.enabled = !next; }); setCameraOff(next); }

  const canAnswer = call?.status === 'ringing' && call?.offer && !peerRef.current;
  const canStart = !call || call.status === 'ended';
  const videoCall = call?.call_type === 'video' || requestedMode === 'video';

  if (!session) return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui', background: '#f1f5f9', padding: 20 }}><section style={{ background: '#fff', borderRadius: 20, padding: 24, textAlign: 'center' }}><h2>Appel Wakh Reek</h2><p>Connecte-toi d’abord pour appeler un membre.</p><a href="/compte" style={{ ...button, display: 'inline-block', textDecoration: 'none' }}>Connexion</a></section></main>;

  return <main style={{ minHeight: '100vh', padding: 18, background: '#f1f5f9', fontFamily: 'Inter,system-ui,sans-serif' }}><section style={{ maxWidth: 760, margin: '0 auto', background: '#fff', borderRadius: 24, padding: 20, boxShadow: '0 12px 30px rgba(15,23,42,.12)' }}><a href="/membres" style={{ color: BLUE }}>← Retour à la discussion</a><h1 style={{ marginBottom: 4 }}>{videoCall ? '🎥 Appel vidéo Wakh Reek' : '📞 Appel audio Wakh Reek'}</h1><p style={{ color: '#475569' }}>{message}</p><div style={{ display: 'grid', gridTemplateColumns: videoCall ? '1fr 1fr' : '1fr', gap: 12, margin: '18px 0' }}><video ref={remoteVideo} autoPlay playsInline style={{ width: '100%', minHeight: videoCall ? 210 : 80, borderRadius: 16, background: '#0f172a', objectFit: 'cover' }} />{videoCall && <video ref={localVideo} autoPlay muted playsInline style={{ width: '100%', minHeight: 210, borderRadius: 16, background: '#334155', objectFit: 'cover' }} />}</div>{canStart && !requestedMode && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><button disabled={busy} onClick={() => startCall('audio')} style={button}>📞 Appel audio</button><button disabled={busy} onClick={() => startCall('video')} style={button}>🎥 Appel vidéo</button></div>}{canAnswer && <button disabled={busy} onClick={answerCall} style={{ ...button, width: '100%', background: '#16a34a' }}>✅ Accepter l’appel {call.call_type === 'video' ? 'vidéo' : 'audio'}</button>}<div style={{ marginTop: 14, padding: '11px 13px', borderRadius: 12, background: '#e0f2fe', color: '#0c4a6e', fontWeight: 600 }}>État : {message}</div>{peerRef.current && <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}><button onClick={toggleMute} style={{ ...button, background: '#64748b' }}>{muted ? '🎙️ Activer micro' : '🔇 Couper micro'}</button>{videoCall && <button onClick={toggleCamera} style={{ ...button, background: '#64748b' }}>{cameraOff ? '🎥 Activer caméra' : '📵 Couper caméra'}</button>}<button onClick={endCall} style={{ ...button, background: '#dc2626' }}>🔴 Raccrocher</button></div>}</section></main>;
}

const button = { flex: 1, border: 0, borderRadius: 12, padding: '13px 14px', background: BLUE, color: 'white', fontWeight: 800, cursor: 'pointer' };
