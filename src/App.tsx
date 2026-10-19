import { useEffect, useState, useRef, useMemo, useCallback } from 'react';

type AiType = 'Grok' | 'Claude' | 'ChatGPT' | 'Gemini' | 'Perplexity' | 'Midjourney' | 'Custom';
type VoiceLang = 'ro' | 'en';

type Timer = {
  id: string;
  name: AiType;
  color: string;
  letter: string;
  target: Date;
  createdAt: Date;
};

const AI_META: Record<AiType, { color: string; letter: string; bg: string }> = {
  Grok: { color: '#ffffff', letter: '𝕏', bg: '#0a0a0a' },
  Claude: { color: '#D97706', letter: 'C', bg: '#D97706' },
  ChatGPT: { color: '#10a37f', letter: 'G', bg: '#10a37f' },
  Gemini: { color: '#4285F4', letter: 'G', bg: '#4285F4' },
  Perplexity: { color: '#1a73e8', letter: 'P', bg: '#1a73e8' },
  Midjourney: { color: '#ff6b6b', letter: 'M', bg: '#ff6b6b' },
  Custom: { color: '#8b5cf6', letter: '•', bg: '#8b5cf6' },
};

function createTargetDate(hour: number, minute: number): Date {
  const now = new Date();
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() <= now.getTime()) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function formatRemaining(ms: number) {
  if (ms <= 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatTarget(date: Date) {
  const isTomorrow = (() => {
    const now = new Date();
    return date.getDate() !== now.getDate() || date.getMonth() !== now.getMonth();
  })();
  return `${isTomorrow ? 'Mâine ' : ''}${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
}

function isTomorrowDate(date: Date) {
  const now = new Date();
  return date.getDate() !== now.getDate() || date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear();
}

// === VOICE PARSING LOGIC ===
function normalizeRo(s: string) {
  return s.toLowerCase()
    .replace(/ă/g,'a').replace(/â/g,'a').replace(/î/g,'i').replace(/ș/g,'s').replace(/ş/g,'s').replace(/ț/g,'t').replace(/ţ/g,'t')
    .trim();
}

const RO_NUMBERS: Record<string, number> = {
  'zero':0, 'unu':1, 'una':1, 'un':1, 'unuu':1,
  'doi':2, 'doua':2, 'două':2,
  'trei':3, 'patru':4, 'cinci':5,
  'sase':6, 'șase':6,
  'sapte':7, 'șapte':7,
  'opt':8, 'noua':9, 'nouă':9,
  'zece':10, 'unsprezece':11, 'doisprezece':12, 'douasprezece':12, 'dousprezece':12,
  'treisprezece':13, 'paisprezece':14, 'cincisprezece':15, 'cinsprezece':15, 'cincispe':15,
  'saisprezece':16, 'saispe':16, 'șaisprezece':16,
  'saptesprezece':17, 'saptespe':17, 'șaptesprezece':17,
  'optsprezece':18, 'optspe':18, 'optispe':18,
  'nouasprezece':19, 'nouaspe':19, 'nouăsprezece':19,
  'douazeci':20, 'douăzeci':20,
};

function wordToNum(word: string): number | null {
  const n = normalizeRo(word);
  if (RO_NUMBERS[n] !== undefined) return RO_NUMBERS[n];
  // also try direct digit
  const d = parseInt(n,10);
  if (!isNaN(d)) return d;
  return null;
}

function parseRomanianHourPhrase(textNorm: string): number | null {
  // handle "douazeci si X" composites
  // look for patterns like "douazeci si unu" => 21 etc
  const norm = textNorm;
  // check explicit composites 21-23
  if (norm.includes('douazeci')) {
    if (norm.includes('unu')) return 21;
    if (norm.includes('doi') || norm.includes('doua')) return 22;
    if (norm.includes('trei')) return 23;
    return 20;
  }
  // check single word numbers in order longest first
  const words = norm.split(/\s+/);
  for (let w of words) {
    const v = wordToNum(w);
    if (v !== null && v >=0 && v <=23) return v;
  }
  // also try to find any word from map contained
  for (const [k,v] of Object.entries(RO_NUMBERS)) {
    if (v<=23 && norm.includes(k)) return v;
  }
  return null;
}

function parseVoiceCommand(text: string, defaultAi: AiType, lang: VoiceLang = 'ro'): { ai: AiType; hour: number; minute: number } | null {
  if (!text) return null;
  const orig = text.toLowerCase();
  const norm = normalizeRo(orig);

  // --- Detect AI - CHATGPT FIRST with gbt fix ---
  // Screenshot bug: "ChatGPT ora 19" heard as "ceas gbt ora 19" -> must map gbt -> ChatGPT
  let ai: AiType = defaultAi || 'Grok';
  const n = norm;

  // ChatGPT - MUST include gbt! This is the key fix for "ceas gbt" = "chat gpt"
  if (
    n.includes('chatgpt') ||
    n.includes('chat gpt') ||
    n.includes('chat gbt') ||
    n.includes('ceas gbt') ||
    n.includes('ceas gpt') ||
    n.includes('ceat gbt') ||
    n.includes('ceat gpt') ||
    n.includes('chatge') ||
    n.includes('chat ge') ||
    n.includes('ge pe te') ||
    n.includes('ge be te') ||
    n.includes('gebe') ||
    n.includes('chatgpt') ||
    n.includes('gpt') ||
    n.includes('gbt') ||
    n.includes('openai') ||
    n.includes('open ai') ||
    (n.includes('chat') && n.includes('ge')) ||
    (n.includes('ceas') && n.includes('bt')) ||
    (n.includes('ceat') && n.includes('ge pe'))
  ) {
    ai = 'ChatGPT';
  } else if (
    n.includes('claude') ||
    n.includes('claud') ||
    n.includes('clod') ||
    n.includes('klod') ||
    n.includes('cloud') ||
    n.includes('claudeu') ||
    n.includes('claudio')
  ) {
    ai = 'Claude';
  } else if (
    n.includes('gemini') ||
    n.includes('gemin') ||
    n.includes('bard') ||
    n.includes('gimini')
  ) {
    ai = 'Gemini';
  } else if (
    n.includes('perplexity') ||
    n.includes('perplex') ||
    n.includes('plexity') ||
    /\bplex\b/.test(n) ||
    n.includes('per plex')
  ) {
    ai = 'Perplexity';
  } else if (
    n.includes('midjourney') ||
    n.includes('mid journey') ||
    n.includes('midj') ||
    n.includes('journey')
  ) {
    ai = 'Midjourney';
  } else if (
    n.includes('grok') ||
    n.includes('groq') ||
    n.includes('grock') ||
    n.includes('groak')
  ) {
    ai = 'Grok';
  }

  let hour: number | null = null;
  let minute: number | null = null;

  // === ENGLISH PARSING FIRST if lang=en or text looks English ===
  const isEnglishLike = lang === 'en' || /\b(at|pm|am|o'clock|half past|quarter past|quarter to)\b/.test(norm);
  
  if (isEnglishLike) {
    // half past X -> :30
    let mHalf = norm.match(/half past (\d{1,2})/);
    if (mHalf) {
      hour = parseInt(mHalf[1],10);
      minute = 30;
    }
    // quarter past X -> :15
    if (hour===null || minute===null) {
      let mQp = norm.match(/quarter past (\d{1,2})/);
      if (mQp) { hour = parseInt(mQp[1],10); minute = 15; }
    }
    // quarter to X -> :45 previous hour
    if (hour===null || minute===null) {
      let mQt = norm.match(/quarter to (\d{1,2})/);
      if (mQt) {
        let h = parseInt(mQt[1],10);
        hour = h - 1; if (hour < 0) hour += 12;
        minute = 45;
      }
    }
    // X o'clock
    if (hour===null) {
      let mOc = norm.match(/(\d{1,2})\s*o'?clock/);
      if (mOc) { hour = parseInt(mOc[1],10); minute = 0; }
    }
    // at H[:MM] [pm/am]  or H[:MM] pm
    if (hour===null || minute===null) {
      let mAt = norm.match(/(?:at\s+)?(\d{1,2})(?:\s*[:\.]\s*(\d{1,2})|\s+(\d{1,2}))?\s*(am|pm|a\.m\.?|p\.m\.?)?/);
      if (mAt) {
        // ensure it's likely a time context: if we have at/pm/am or previous half/quarter not found, use it
        // but we must be careful not to match random numbers like in AI names
        // only if "at" present or pm/am present or : present
        const hasTimeHint = /at/.test(mAt[0]) || mAt[4] || mAt[2] || norm.includes(':');
        if (hasTimeHint || isEnglishLike) {
          let h = parseInt(mAt[1],10);
          let mm = mAt[2] ? parseInt(mAt[2],10) : (mAt[3] ? parseInt(mAt[3],10) : 0);
          let ap = mAt[4] || '';
          // handle am/pm
          if (ap.includes('pm') && h < 12) h += 12;
          if (ap.includes('am') && h === 12) h = 0;
          // also detect pm words elsewhere
          if (!ap && norm.includes(' pm')) { if (h < 12) h += 12; }
          if (!ap && norm.includes(' am') && h === 12) h = 0;
          if (h>=0 && h<=23 && mm>=0 && mm<=59) {
            hour = h; minute = mm;
          }
        }
      }
    }
    // fallback english number word? simple 1-12
    if (hour===null) {
      const enNums: Record<string,number> = { one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12 };
      for (const [w,v] of Object.entries(enNums)) {
        if (norm.includes(w)) { hour = v; break; }
      }
      // handle pm after that
      if (hour!==null && norm.includes(' pm') && hour < 12) hour += 12;
    }
  }

  // === ROMANIAN PARSING (always try if hour still null, or as fallback) ===

  // 1) Explicit HH:MM patterns: 17:43, 17.43, 17-43
  if (hour===null || minute===null) {
    let m = norm.match(/(\d{1,2})\s*[:.\-]\s*(\d{1,2})/);
    if (m) {
      const h = parseInt(m[1],10);
      const mm = parseInt(m[2],10);
      if (h<=23 && mm<=59) { hour=h; minute=mm; }
    }
  }

  // 2) "ora 17 43" / "ora 17 si 43" / "17 si 43"
  if (hour===null || minute===null) {
    let m2 = norm.match(/(\d{1,2})\s+si\s+(\d{1,2})/);
    if (m2) {
      const h = parseInt(m2[1],10);
      const mm = parseInt(m2[2],10);
      if (h<=23 && mm<=59) { hour=h; minute=mm; }
    }
  }
  if (hour===null || minute===null) {
    let m3 = norm.match(/ora\s+(\d{1,2})\s+(\d{1,2})\b/);
    if (m3) {
      const h = parseInt(m3[1],10);
      const mm = parseInt(m3[2],10);
      if (h<=23 && mm<=59) { hour=h; minute=mm; }
    }
  }

  // 3) jumătate / jumate -> :30
  if (minute===null && (norm.includes('jumatate') || norm.includes('jumate'))) {
    minute = 30;
    // try hour before
    let hm = norm.match(/(\d{1,2})\s*(?:si\s*)?(?:jumatate|jumate)/);
    if (hm) {
      hour = parseInt(hm[1],10);
    } else {
      // try word number before jumate
      let before = norm.split(/jumatate|jumate/)[0];
      const hw = parseRomanianHourPhrase(before);
      if (hw!==null) hour = hw;
      else {
        let lastNum = before.match(/(\d{1,2})\s*$/);
        if (lastNum) hour = parseInt(lastNum[1],10);
      }
    }
  }

  // 4) sfert handling
  if (minute===null && norm.includes('sfert')) {
    if (norm.includes('fara') || norm.includes('fără')) {
      minute = 45;
    } else {
      minute = 15;
    }
    let hm = norm.match(/(\d{1,2})\s*(?:si\s*)?(?:un\s*)?sfert/);
    if (hm) {
      hour = parseInt(hm[1],10);
    } else {
      let before = norm.split(/sfert/)[0];
      const hw = parseRomanianHourPhrase(before);
      if (hw!==null) hour = hw;
    }
  }

  // 5) hour only patterns
  if (hour===null) {
    let mo = norm.match(/ora\s+(\d{1,2})\b/);
    if (mo) hour = parseInt(mo[1],10);
    else {
      let ml = norm.match(/la\s+(\d{1,2})\b/);
      if (ml) hour = parseInt(ml[1],10);
    }
  }

  // 6) word numbers for hour if still null
  if (hour===null) {
    // try after "ora" phrase
    let oraIdx = norm.indexOf('ora');
    let laIdx = norm.indexOf(' la ');
    let phrase = '';
    if (oraIdx!==-1) phrase = norm.slice(oraIdx+3, oraIdx+30);
    else if (laIdx!==-1) phrase = norm.slice(laIdx+3, laIdx+30);
    else phrase = norm;
    const hw = parseRomanianHourPhrase(phrase);
    if (hw!==null) hour = hw;
  }

  // 7) fallback: last number in utterance as hour if nothing else
  if (hour===null) {
    const allNums = [...norm.matchAll(/(\d{1,2})/g)];
    if (allNums.length>0) {
      // if we have minute already from half/quarter, use last number as hour
      // otherwise if single number, hour = that
      const last = parseInt(allNums[allNums.length-1][1],10);
      if (last<=23) hour = last;
    }
  }

  // final defaults
  if (hour===null) {
    console.log(`voice parse: original=${text} norm=${norm} detectedAi=${ai} hour=null minute=${minute} lang=${lang}`);
    return null;
  }
  if (minute===null) minute = 0;
  if (hour<0 || hour>23) return null;
  if (minute<0 || minute>59) return null;

  console.log(`voice parse: original=${text} norm=${norm} detectedAi=${ai} hour=${hour} minute=${minute} lang=${lang}`);
  // handle "7 jumate" etc already
  return { ai, hour, minute };
}

function updateFavicon(isAlert: boolean) {
  try {
    let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/png';
      document.head.appendChild(link);
    }
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0,0,32,32);
    if (isAlert) {
      ctx.fillStyle = '#0a0a0f';
      // @ts-ignore
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(2,2,28,28,8); ctx.fill(); } else { ctx.fillRect(2,2,28,28); }
      ctx.beginPath();
      ctx.arc(16,16,11,0,Math.PI*2);
      ctx.fillStyle = '#22c55e';
      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(16,16,11,0,Math.PI*2);
      ctx.strokeStyle = '#bbf7d0';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillStyle = '#ffffff';
      // @ts-ignore
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(2,2,28,28,8); ctx.fill(); } else { ctx.fillRect(2,2,28,28); }
      ctx.fillStyle = '#000';
      ctx.font = '900 15px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('AI',16,17);
    }
    link.href = canvas.toDataURL('image/png');
  } catch {}
}

export default function App() {
  // in-memory only (no localStorage per request)
  const [timers, setTimers] = useState<Timer[]>(() => {
    const now = new Date();
    return [
      { id: uid(), name: 'Grok', color: AI_META.Grok.color, letter: AI_META.Grok.letter, target: createTargetDate(19, 0), createdAt: now },
      { id: uid(), name: 'Claude', color: AI_META.Claude.color, letter: AI_META.Claude.letter, target: createTargetDate(20, 0), createdAt: now },
      { id: uid(), name: 'ChatGPT', color: AI_META.ChatGPT.color, letter: AI_META.ChatGPT.letter, target: createTargetDate(19, 30), createdAt: now },
    ];
  });

  const [nowTick, setNowTick] = useState(() => new Date());
  const [notifStatus, setNotifStatus] = useState<NotificationPermission>('default');
  const [selectedAi, setSelectedAi] = useState<AiType>('Grok');
  const [customTime, setCustomTime] = useState('21:00');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTimeVal, setEditTimeVal] = useState('19:00');
  const [notifFeedback, setNotifFeedback] = useState<string | null>(null);
  const [ringingIds, setRingingIds] = useState<string[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  // voice states
  const [voiceState, setVoiceState] = useState<'idle'|'listening'|'processing'|'success'|'error'>('idle');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [parsedPreview, setParsedPreview] = useState<string | null>(null);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [voiceToast, setVoiceToast] = useState<string | null>(null);
  const [voiceLang, setVoiceLang] = useState<VoiceLang>('ro');

  // refs for alarm & title - FIXED to properly stop
  const audioCtxRef = useRef<AudioContext | null>(null);
  const alarmIntervalRef = useRef<number | null>(null);
  const vibrateIntervalRef = useRef<number | null>(null);
  const titleFlashRef = useRef<number | null>(null);
  const notifiedRef = useRef<Set<string>>(new Set());
  const hasInteractedRef = useRef(false);
  const activeOscillatorsRef = useRef<{ osc: OscillatorNode; gain: GainNode }[]>([]);
  const recognitionRef = useRef<any>(null);
  const voiceStateRef = useRef(voiceState);
  useEffect(()=>{ voiceStateRef.current = voiceState; },[voiceState]);

  useEffect(() => {
    if ('Notification' in window) {
      setNotifStatus(Notification.permission);
    }
    // check speech recognition support
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) setVoiceSupported(false);
    const id = setInterval(() => setNowTick(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const markInteracted = () => {
      if (!hasInteractedRef.current) hasInteractedRef.current = true;
    };
    const opts = { passive: true } as AddEventListenerOptions;
    window.addEventListener('pointerdown', markInteracted, opts);
    window.addEventListener('click', markInteracted, opts);
    window.addEventListener('touchstart', markInteracted, opts);
    window.addEventListener('keydown', markInteracted as any, opts);
    return () => {
      window.removeEventListener('pointerdown', markInteracted as any);
      window.removeEventListener('click', markInteracted as any);
      window.removeEventListener('touchstart', markInteracted as any);
      window.removeEventListener('keydown', markInteracted as any);
    };
  }, []);

  const ensureAudio = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      return audioCtxRef.current;
    } catch { return null; }
  }, []);

  const stopAlarmLoop = useCallback(() => {
    // FIX: opreste garantat totul - intervale, oscilatoare, vibratie
    if (alarmIntervalRef.current !== null) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
    if (vibrateIntervalRef.current !== null) {
      clearInterval(vibrateIntervalRef.current);
      vibrateIntervalRef.current = null;
    }
    // stop ALL oscillators and gain nodes immediately
    try {
      const ctxTime = audioCtxRef.current?.currentTime ?? 0;
      activeOscillatorsRef.current.forEach(({ osc, gain }) => {
        try {
          gain.gain.cancelScheduledValues(ctxTime);
          gain.gain.setValueAtTime(gain.gain.value, ctxTime);
          gain.gain.linearRampToValueAtTime(0, ctxTime + 0.05);
        } catch {}
        try { osc.stop(ctxTime + 0.06); } catch {}
        try { osc.disconnect(); } catch {}
        try { gain.disconnect(); } catch {}
      });
    } catch {}
    activeOscillatorsRef.current = [];
    // opreste vibratia doar daca a interactionat (altfel Chrome logheaza eroare)
    if (hasInteractedRef.current && 'vibrate' in navigator) {
      try { navigator.vibrate(0); } catch {}
    }
  }, []);

  const playCalmChime = useCallback(() => {
    const ctx = ensureAudio();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const createTone = (freq: number, gainVal: number, duration: number, delay = 0) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + delay);
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        // calm envelope: soft attack, exponential fade out
        gainNode.gain.setValueAtTime(0, now + delay);
        gainNode.gain.linearRampToValueAtTime(gainVal, now + delay + 0.09);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + delay + duration);
        osc.start(now + delay);
        osc.stop(now + delay + duration + 0.08);
        const ref = { osc, gain: gainNode };
        activeOscillatorsRef.current.push(ref);
        osc.onended = () => {
          try { osc.disconnect(); gainNode.disconnect(); } catch {}
          activeOscillatorsRef.current = activeOscillatorsRef.current.filter(r => r.osc !== osc);
        };
      };
      // calm fix: gain 0.14, sine 680Hz, 0.6s duration - Slack/Discord style
      createTone(680, 0.14, 0.6, 0);
      createTone(1020, 0.045, 0.45, 0.06);
      createTone(340, 0.025, 0.7, 0.02);
    } catch {}
  }, [ensureAudio]);

  const startAlarmLoop = useCallback(() => {
    const ctx = ensureAudio();
    if (!ctx) return;
    if (alarmIntervalRef.current !== null) return; // already ringing - prevent duplicates
    try { playCalmChime(); } catch {}
    alarmIntervalRef.current = window.setInterval(() => {
      playCalmChime();
    }, 2500);
    // gentle vibrate only if interacted
    if ('vibrate' in navigator && hasInteractedRef.current) {
      try { navigator.vibrate([180]); } catch {}
      vibrateIntervalRef.current = window.setInterval(() => {
        try { navigator.vibrate([180]); } catch {}
      }, 2500);
    }
  }, [ensureAudio, playCalmChime]);

  // try vibrate after interaction if alarm active
  useEffect(() => {
    const tryStartVibrate = () => {
      if (ringingIds.length > 0 && hasInteractedRef.current && vibrateIntervalRef.current === null && 'vibrate' in navigator) {
        try { navigator.vibrate([180]); } catch {}
        vibrateIntervalRef.current = window.setInterval(() => {
          try { navigator.vibrate([180]); } catch {}
        }, 2500);
      }
    };
    const onInteract = () => {
      hasInteractedRef.current = true;
      tryStartVibrate();
    };
    window.addEventListener('pointerdown', onInteract, { once: true } as any);
    window.addEventListener('click', onInteract, { once: true } as any);
    tryStartVibrate();
    return () => {
      window.removeEventListener('pointerdown', onInteract as any);
      window.removeEventListener('click', onInteract as any);
    };
  }, [ringingIds.length]);

  const expiredTimers = useMemo(() => {
    return timers.filter(t => t.target.getTime() - nowTick.getTime() <= 0);
  }, [timers, nowTick]);

  const waitingCount = timers.length - expiredTimers.length;
  const ringingTimers = useMemo(() => {
    return timers.filter(t => ringingIds.includes(t.id));
  }, [timers, ringingIds]);

  useEffect(() => {
    // FIX CRITICAL: filtrare pe baza notifiedRef care NU se sterge la dismiss
    // Astfel, dupa "Am văzut", timer-ul ramane in notifiedRef si nu mai retriggereaza
    const newlyExpired = expiredTimers.filter(t => !ringingIds.includes(t.id) && !notifiedRef.current.has(t.id));
    if (newlyExpired.length > 0) {
      setRingingIds(prev => {
        const set = new Set(prev);
        newlyExpired.forEach(t => set.add(t.id));
        return Array.from(set);
      });
      // scoate din dismissed daca reapare (caz reset) - dar aici sunt nou expirate, deci curata dismissed
      setDismissedIds(prev => prev.filter(id => !newlyExpired.some(t => t.id === id)));
      newlyExpired.forEach(t => {
        if (!notifiedRef.current.has(t.id)) {
          notifiedRef.current.add(t.id);
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              const n = new Notification(`${t.name} e din nou disponibil!`, {
                body: `${t.name} e din nou disponibil! Apasă ca să oprești sunetul calm`,
                requireInteraction: false,
                tag: t.id,
              } as NotificationOptions & { requireInteraction: boolean });
              n.onclick = () => {
                try { window.focus(); } catch {}
                setRingingIds(prev => {
                  const next = prev.filter(id => id !== t.id);
                  if (next.length === 0) stopAlarmLoop();
                  return next;
                });
                // FIX: NU sterge notifiedRef la click pe notificare - doar marcheaza dismissed
                console.log(`[AI Cooldown] Notificare click dismiss pentru ${t.name} (${t.id}) - pastrez notifiedRef`);
                setDismissedIds(prev => prev.includes(t.id) ? prev : [...prev, t.id]);
                try { n.close(); } catch {}
              };
            } catch {}
          }
        }
      });
    }
  }, [expiredTimers, ringingIds, stopAlarmLoop, setDismissedIds]);

  useEffect(() => {
    if (ringingTimers.length > 0) {
      startAlarmLoop();
    } else {
      stopAlarmLoop();
    }
  }, [ringingTimers.length, startAlarmLoop, stopAlarmLoop]);

  // title flashing - keep it
  useEffect(() => {
    if (titleFlashRef.current) {
      clearInterval(titleFlashRef.current);
      titleFlashRef.current = null;
    }
    if (expiredTimers.length > 0) {
      updateFavicon(true);
      const msgs: string[] = [];
      expiredTimers.forEach(t => msgs.push(`✅ ${t.name.toUpperCase()} DISPONIBIL!`));
      if (expiredTimers.length > 1) {
        msgs.push(`⚠️ ${expiredTimers.length} AI-uri gata!`);
      }
      let idx = 0;
      document.title = msgs[0];
      titleFlashRef.current = window.setInterval(() => {
        document.title = msgs[idx % msgs.length];
        idx++;
      }, 800);
    } else {
      document.title = `AI Cooldown - ${waitingCount} în așteptare`;
      updateFavicon(false);
    }
    return () => {
      if (titleFlashRef.current) {
        clearInterval(titleFlashRef.current);
        titleFlashRef.current = null;
      }
    };
  }, [expiredTimers, waitingCount]);

  useEffect(() => {
    return () => {
      stopAlarmLoop();
      if (titleFlashRef.current) clearInterval(titleFlashRef.current);
    };
  }, [stopAlarmLoop]);

  const handleNotifPerm = async () => {
    setNotifFeedback('Se verifică permisiunea...');
    if (!('Notification' in window)) {
      setNotifFeedback('Notificările nu sunt suportate în acest browser');
      setNotifStatus('denied' as NotificationPermission);
      setTimeout(() => setNotifFeedback(null), 3000);
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setNotifStatus(perm);
      if (perm === 'granted') {
        setNotifFeedback('✓ Notificări activate — sunet calm la final');
        try {
          new Notification('Notificări activate', {
            body: 'Vei fi anunțat cu un sunet calm când AI-urile sunt gata.',
          });
        } catch {}
      } else if (perm === 'denied') {
        setNotifFeedback('Notificări blocate din browser');
      } else {
        setNotifFeedback('Permisiune în așteptare');
      }
      setTimeout(() => setNotifFeedback(null), 3500);
    } catch {
      setNotifFeedback('Nu s-a putut cere permisiunea (context securizat necesar)');
      setTimeout(() => setNotifFeedback(null), 3000);
    }
  };

  const addTimer = useCallback((name: AiType, hour: number, minute: number) => {
    const target = createTargetDate(hour, minute);
    setTimers(prev => [...prev, {
      id: uid(),
      name,
      color: AI_META[name].color,
      letter: AI_META[name].letter,
      target,
      createdAt: new Date(),
    }]);
  }, []);

  const handleAddCustom = useCallback(() => {
    if (!customTime) return;
    const [h, m] = customTime.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return;
    addTimer(selectedAi, h, m);
  }, [customTime, selectedAi, addTimer]);

  const handleDelete = useCallback((id: string) => {
    setTimers(p => p.filter(t => t.id !== id));
    console.log(`[AI Cooldown] Sterg timer ${id} - curat notifiedRef + dismissed`);
    notifiedRef.current.delete(id);
    setRingingIds(prev => {
      const next = prev.filter(r => r !== id);
      if (next.length === 0) stopAlarmLoop();
      return next;
    });
    setDismissedIds(prev => prev.filter(r => r !== id));
  }, [stopAlarmLoop]);

  const handleReset = useCallback((id: string, mins: number) => {
    const now = new Date();
    const newTarget = new Date(now.getTime() + mins * 60 * 1000);
    setTimers(p => p.map(t => t.id === id ? { ...t, target: newTarget, createdAt: now } : t));
    console.log(`[AI Cooldown] Reset timer ${id} +${mins}min - curat notifiedRef + dismissed`);
    notifiedRef.current.delete(id);
    setRingingIds(prev => {
      const next = prev.filter(r => r !== id);
      if (next.length === 0) stopAlarmLoop();
      return next;
    });
    setDismissedIds(prev => prev.filter(r => r !== id));
  }, [stopAlarmLoop]);

  const startEdit = useCallback((t: Timer) => {
    setEditingId(t.id);
    setEditTimeVal(`${String(t.target.getHours()).padStart(2,'0')}:${String(t.target.getMinutes()).padStart(2,'0')}`);
  }, []);

  const saveEdit = useCallback(() => {
    if (!editingId || !editTimeVal) return;
    const [h,m] = editTimeVal.split(':').map(Number);
    const newTarget = createTargetDate(h,m);
    setTimers(p => p.map(t => t.id === editingId ? { ...t, target: newTarget, createdAt: new Date() } : t));
    console.log(`[AI Cooldown] Salvez edit ${editingId} -> ${editTimeVal} - curat notifiedRef + dismissed`);
    notifiedRef.current.delete(editingId);
    setRingingIds(prev => {
      const next = prev.filter(r => r !== editingId);
      if (next.length === 0) stopAlarmLoop();
      return next;
    });
    setDismissedIds(prev => prev.filter(r => r !== editingId));
    setEditingId(null);
  }, [editingId, editTimeVal, stopAlarmLoop]);

  const dismissAlarm = useCallback((id: string) => {
    console.log(`[AI Cooldown] Dismiss alarm ${id} - Am văzut! Opresc sunet, PASTREZ notifiedRef ca sa nu retriggereze`);
    // FIX CRITICAL: NU sterge notifiedRef - pastreaza in Set ca sa nu retriggereze
    // notifiedRef.current.add(id) deja exista din useEffect
    setRingingIds(prev => {
      const next = prev.filter(r => r !== id);
      if (next.length === 0) {
        stopAlarmLoop();
      }
      return next;
    });
    setDismissedIds(prev => prev.includes(id) ? prev : [...prev, id]);
    // KEEP notifiedRef - do NOT delete - asta e fix-ul pentru restart imediat
  }, [stopAlarmLoop]);

  const dismissAllAlarms = useCallback(() => {
    console.log(`[AI Cooldown] Dismiss ALL alarms (${ringingIds.length}) - Am văzut tot!`);
    stopAlarmLoop();
    setDismissedIds(prev => {
      const set = new Set(prev);
      ringingIds.forEach(id => set.add(id));
      return Array.from(set);
    });
    setRingingIds([]);
    // FIX: NU clear notifiedRef - pastreaza ca sa nu retriggereze
    // notifiedRef.current ramane cu toate id-urile
  }, [stopAlarmLoop, ringingIds]);

  const willBeTomorrow = useMemo(() => {
    if (!customTime) return false;
    const [h,m] = customTime.split(':').map(Number);
    const d = new Date();
    d.setHours(h,m,0,0);
    return d.getTime() <= new Date().getTime();
  }, [customTime]);

  // === VOICE HANDLING ===
  const startVoiceRecognition = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setVoiceSupported(false);
      setVoiceState('error');
      setParsedPreview('Browser-ul nu suportă voce — folosește Chrome pe Android/Desktop');
      return;
    }
    try {
      // stop previous
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      const recog = new SR();
      recognitionRef.current = recog;
      recog.lang = voiceLang === 'en' ? 'en-US' : 'ro-RO';
      recog.continuous = false;
      recog.interimResults = true;
      recog.maxAlternatives = 1;

      setVoiceState('listening');
      setLiveTranscript('');
      setParsedPreview(null);
      hasInteractedRef.current = true;
      ensureAudio();

      recog.onstart = () => {
        setVoiceState('listening');
      };
      recog.onresult = (event: any) => {
        const res = event.results[0];
        const transcript = res[0].transcript as string;
        setLiveTranscript(transcript);
        if (res.isFinal) {
         setVoiceState('processing');
          // small delay to show processing
          setTimeout(() => {
            const parsed = parseVoiceCommand(transcript, selectedAi, voiceLang);
            if (parsed) {
              const hmStr = `${String(parsed.hour).padStart(2,'0')}:${String(parsed.minute).padStart(2,'0')}`;
              if (voiceLang === 'en') {
                const ampm = parsed.hour >= 12 ? 'PM' : 'AM';
                const h12 = parsed.hour % 12 === 0 ? 12 : parsed.hour % 12;
                const display = parsed.minute === 0 ? `${h12} ${ampm}` : `${h12}:${String(parsed.minute).padStart(2,'0')} ${ampm}`;
                setParsedPreview(`Got it: ${parsed.ai} at ${display} (${hmStr}) → Adding`);
              } else {
                setParsedPreview(`Am înțeles: ${parsed.ai} la ${hmStr} → Adaug [gbt fix activ]`);
              }
              addTimer(parsed.ai, parsed.hour, parsed.minute);
              try { playCalmChime(); } catch {}
              setVoiceState('success');
              if (voiceLang === 'en') {
                setVoiceToast(`✅ Got it: ${parsed.ai} at ${hmStr} — added! (gbt → ChatGPT fixed)`);
              } else {
                setVoiceToast(`✅ Am înțeles: ${parsed.ai} la ${hmStr} — adăugat! (gbt → ChatGPT fixed)`);
              }
              setTimeout(() => {
                setLiveTranscript('');
                setParsedPreview(null);
                setVoiceState('idle');
                setVoiceToast(null);
              }, 3500);
            } else {
              setVoiceState('error');
              if (voiceLang === 'en') {
                setParsedPreview(`Didn't catch time. Try: "Claude at 8 PM" or "ChatGPT at 5:43 PM" — check console: voice parse log`);
              } else {
                setParsedPreview(`Nu am înțeles ora. Încearcă: "Claude la 20" sau "ChatGPT ora 17:43" (acum prinde si "ceas gbt") — vezi consola`);
              }
              setTimeout(() => setVoiceState('idle'), 3500);
            }
          }, 250);
        }
      };
      recog.onerror = (e: any) => {
        console.log('[voice] error', e);
        setVoiceState('error');
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          setParsedPreview(voiceLang==='en' ? 'Mic blocked. Allow access in browser settings.' : 'Microfon blocat. Permite accesul în setările browserului.');
        } else if (e.error === 'no-speech') {
          setParsedPreview(voiceLang==='en' ? 'No speech heard. Tap again and speak louder.' : 'Nu am auzit nimic. Apasă din nou și vorbește mai tare.');
        } else {
          setParsedPreview(voiceLang==='en' ? `Voice error: ${e.error}. Try again.` : `Eroare voce: ${e.error}. Încearcă din nou.`);
        }
        setTimeout(()=> setVoiceState('idle'), 3500);
      };
      recog.onend = () => {
        if (voiceStateRef.current === 'listening' && !liveTranscript) {
          // if ended without result, go idle after a bit if not processing
          setTimeout(()=> {
            if (voiceStateRef.current === 'listening') setVoiceState('idle');
          }, 500);
        }
      };
      recog.start();
    } catch (err) {
      console.log('[voice] start failed', err);
      setVoiceState('error');
      setParsedPreview(voiceLang==='en' ? 'Could not start mic. Check permissions.' : 'Nu am putut porni microfonul. Verifică permisiunile.');
      setTimeout(()=> setVoiceState('idle'), 3000);
    }
  }, [selectedAi, addTimer, playCalmChime, ensureAudio, liveTranscript, voiceLang]);

  const stopVoiceRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setVoiceState('idle');
  }, []);

  return (
    <div className="min-h-screen w-full text-white selection:bg-white/20 overflow-x-clip"
      style={{
        background: `radial-gradient(1200px 600px at 20% -10%, #1e1e3f 0%, transparent 60%), radial-gradient(900px 500px at 90% 10%, #2a1948 0%, transparent 60%), linear-gradient(180deg, #0a0a0f 0%, #12121f 50%, #1a1a2e 100%)`,
        paddingTop: 'var(--safe-area-inset-top)',
        boxSizing: 'border-box',
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');
        * { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .glass {
          background: linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .glass-hover:hover {
          background: linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.05) 100%);
          border-color: rgba(255,255,255,0.14);
        }
        .glow-green {
          box-shadow: 0 0 0 1px rgba(34,197,94,0.4), 0 0 30px rgba(34,197,94,0.25), inset 0 1px 0 rgba(255,255,255,0.1);
          border-color: rgba(34,197,94,0.5) !important;
        }
        @keyframes pulseGreen {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        .animate-pulse-green { animation: pulseGreen 1.6s ease-in-out infinite; }
        @keyframes alarmPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.015); }
        }
        @keyframes alarmShake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-1px); }
          75% { transform: translateX(1px); }
        }
        @keyframes bannerSlide {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes micPulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239,68,68,0.7); }
          70% { transform: scale(1.05); box-shadow: 0 0 0 18px rgba(239,68,68,0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239,68,68,0); }
        }
        @keyframes micWave {
          0%, 100% { transform: scaleY(0.5); }
          50% { transform: scaleY(1.2); }
        }
        .mic-listening {
          animation: micPulse 1.4s infinite;
        }
      `}</style>

      {/* FULLSCREEN ALARM MODAL - calm version */}
      {ringingTimers.length > 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#050507]/85 backdrop-blur-[16px]" />
          <div className="absolute inset-0 bg-[radial-gradient(800px_400px_at_50%_0%,rgba(34,197,94,0.18),transparent)] pointer-events-none" />
          <div className="relative w-full max-w-[560px] rounded-[28px] border border-emerald-400/25 bg-gradient-to-b from-[#1a2a1e] to-[#0f1711] p-6 sm:p-8 shadow-[0_0_0_1px_rgba(34,197,94,0.2),0_0_60px_rgba(34,197,94,0.2)]"
            style={{ animation: 'alarmPulse 2.5s ease-in-out infinite' }}
          >
            <div className="flex items-center justify-center gap-3 mb-5">
              <span className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse-green shadow-[0_0_12px_#22c55e]" />
              <span className="text-[11px] tracking-[0.25em] font-black text-emerald-300 uppercase">Sunet calm activ</span>
              <span className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse-green shadow-[0_0_12px_#22c55e]" />
            </div>

            <h2 className="text-center text-[32px] sm:text-[38px] font-black tracking-[-0.03em] leading-[0.9] text-white"
            >
              🔔 {ringingTimers.length === 1 ? `${ringingTimers[0].name.toUpperCase()} E GATA!` : `${ringingTimers.length} AI-URI GATA!`}
            </h2>
            <p className="text-center text-emerald-200/60 text-[13px] mt-3 font-medium">
              Clinchet calm la fiecare 2.5 secunde — se oprește instant când apeși „Am văzut”.
            </p>

            <div className="mt-6 grid gap-3">
              {ringingTimers.map(rt => (
                <div key={rt.id} className="flex items-center justify-between gap-3 rounded-[16px] bg-white/[0.06] border border-white/10 px-4 py-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-[12px] grid place-items-center font-black text-[16px] shrink-0"
                      style={{ background: rt.name === 'Grok' ? '#111' : AI_META[rt.name].bg, color: 'white', border: '1px solid rgba(255,255,255,0.15)' }}
                    >
                      {AI_META[rt.name].letter}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-[16px] leading-none">{rt.name}</div>
                      <div className="text-[12px] text-white/50 mt-1">Disponibil din {formatTarget(rt.target)} • sunet calm</div>
                    </div>
                  </div>
                  <button
                    onClick={() => dismissAlarm(rt.id)}
                    className="shrink-0 h-10 px-5 rounded-full bg-white text-black text-[13px] font-black tracking-wide hover:bg-emerald-100 transition-colors active:scale-95"
                  >
                    AM VĂZUT!
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                onClick={dismissAllAlarms}
                className="flex-1 h-[52px] rounded-[16px] bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[14px] tracking-[0.04em] uppercase transition-colors shadow-[0_0_20px_rgba(34,197,94,0.35)] active:scale-[0.98]"
              >
                ⏹ OPREȘTE SUNETUL {ringingTimers.length > 1 ? `(${ringingTimers.length})` : ''}
              </button>
              <button
                onClick={() => { ensureAudio(); playCalmChime(); }}
                className="h-[52px] px-5 rounded-[16px] bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold text-[13px] transition-colors active:scale-95"
              >
                🔊 Test sunet calm
              </button>
            </div>

            <div className="mt-4 text-center text-[11px] text-white/35 leading-relaxed">
              Sunet nou: sine 680Hz, volum 0.16, fade lent — ca Slack/Discord. Titlul din Chrome tot clipește.
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8 py-6 sm:py-8 overflow-x-clip">
        {expiredTimers.length > 0 && (
          <div className="sticky top-[calc(var(--safe-area-inset-top)+8px)] z-30 mb-5 rounded-[16px] border border-emerald-400/30 bg-emerald-500/15 backdrop-blur-xl px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
            style={{ animation: 'bannerSlide 0.35s ease-out' }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse-green shadow-[0_0_10px_#22c55e] shrink-0" />
              <div className="text-[13px] font-semibold text-emerald-100 leading-tight">
                <span className="font-black">{expiredTimers.map(t=>t.name).join(', ')}</span> {expiredTimers.length === 1 ? 'e din nou disponibil' : 'sunt disponibile'} • {ringingTimers.length > 0 ? '🔔 sunet calm activ' : 'Gata de folosit'}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {ringingTimers.length > 1 && (
                <button
                  onClick={dismissAllAlarms}
                  className="h-8 px-4 rounded-full bg-white text-black text-[12px] font-black hover:bg-emerald-100 transition-colors active:scale-95"
                >
                  Oprește tot ({ringingTimers.length})
                </button>
              )}
              {ringingTimers.length === 1 && (
                <button
                  onClick={() => dismissAlarm(ringingTimers[0].id)}
                  className="h-8 px-4 rounded-full bg-white text-black text-[12px] font-black active:scale-95"
                >
                  Am văzut! Oprește
                </button>
              )}
            </div>
          </div>
        )}

        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 sticky top-[var(--safe-area-inset-top)] z-20 py-3 px-1"
          style={{ backdropFilter: 'blur(12px)', background: 'linear-gradient(180deg, rgba(10,10,15,0.85) 0%, rgba(10,10,15,0) 100%)' }}
        >
          <div className="flex items-center gap-4">
            <div className="h-11 w-11 rounded-[14px] bg-white text-black grid place-items-center font-black text-[18px] tracking-tighter">AI</div>
            <div>
              <h1 className="text-[22px] sm:text-[26px] font-extrabold tracking-[-0.02em] leading-none">AI Cooldown</h1>
              <p className="text-[12px] sm:text-[13px] text-white/50 font-medium tracking-wide mt-[3px] uppercase">Tracker limită AI • sunet calm</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-[11px] text-white/40">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse-green inline-block" />
              {expiredTimers.length > 0 ? `${expiredTimers.length} gata • titlu clipește` : 'sincronizare live'}
            </div>
            <button
              onClick={handleNotifPerm}
              className={`h-9 px-4 rounded-full text-[13px] font-semibold transition-all border flex items-center gap-2 ${notifStatus === 'granted' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-white text-black border-white hover:bg-white/90'}`}
            >
              <span className="text-[14px]">{notifStatus === 'granted' ? '✓' : '🔔'}</span>
              {notifStatus === 'granted' ? 'Notificări active' : 'Permite notificări'}
            </button>
          </div>
        </header>

        {notifFeedback && (
          <div className="mb-4 rounded-[12px] bg-white text-black px-4 py-2.5 text-[13px] font-medium shadow-lg max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
            {notifFeedback}
          </div>
        )}

        {/* === VOICE INTEGRATION SECTION === */}
        <section className="glass rounded-[24px] p-5 sm:p-6 mb-6 border border-white/10 relative overflow-hidden">
          {/* background accent */}
          <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full blur-[50px] bg-violet-500/15 pointer-events-none" />
          <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full blur-[50px] bg-fuchsia-500/10 pointer-events-none" />
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-[13px] font-semibold tracking-widest uppercase text-white/50 flex items-center gap-2">
                  <span>🎤</span> Comandă vocală / Voice command
                  {!voiceSupported && <span className="normal-case tracking-normal bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full text-[10px]">nesuportat / unsupported</span>}
                  <span className="normal-case tracking-normal bg-emerald-500/15 text-emerald-300 px-2 py-0.5 rounded-full text-[10px] border border-emerald-500/20">gbt → ChatGPT fixed</span>
                </h2>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-[11px] text-white/40 uppercase tracking-widest font-semibold">{voiceLang==='ro' ? 'Limbă:' : 'Language:'}</span>
                  <div className="flex rounded-full bg-[#14141f] border border-white/10 p-1 gap-1">
                    <button
                      onClick={()=> setVoiceLang('ro')}
                      className={`h-7 px-3.5 rounded-full text-[12px] font-bold transition-all ${voiceLang==='ro' ? 'bg-white text-black shadow' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
                    >🇷🇴 RO</button>
                    <button
                      onClick={()=> setVoiceLang('en')}
                      className={`h-7 px-3.5 rounded-full text-[12px] font-bold transition-all ${voiceLang==='en' ? 'bg-white text-black shadow' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
                    >🇬🇧 EN</button>
                  </div>
                  <span className="text-[11px] text-white/30 ml-1">{voiceLang==='ro' ? 'ro-RO • recunoaște "ceas gbt" ca ChatGPT' : 'en-US • understands "at 8 PM" + gbt fix'}</span>
                </div>
                <p className="text-[13px] text-white/60 mt-3 leading-relaxed max-w-[560px]">
                  {voiceLang==='ro' ? (
                    <>
                      Spune <span className="text-white font-semibold">„Claude la 20”</span> sau <span className="text-white font-semibold">„ChatGPT ora 17:43”</span> și se adaugă automat. <span className="text-emerald-300 font-semibold">FIX:</span> browserul aude „ChatGPT” ca <span className="text-white/80">„ceas gbt / gbt / ge be te”</span> — acum toate duc la ChatGPT. Grok e detectat doar pe „grok/groq”.
                    </>
                  ) : (
                    <>
                      Say <span className="text-white font-semibold">"Claude at 8 PM"</span> or <span className="text-white font-semibold">"ChatGPT at 5:43 PM"</span> and it's added. <span className="text-emerald-300 font-semibold">FIX:</span> misheard <span className="text-white/80">"ceas gbt" = ChatGPT</span> — now <span className="text-white/80">gbt/gpt/ge be te</span> all map to ChatGPT. Supports <span className="text-white/80">half past, quarter past, o'clock, AM/PM</span>.
                    </>
                  )}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(voiceLang==='ro' ? ['Claude la 20','ChatGPT ora 17:43','ceas gbt ora 19 (bug fix)','Grok ora 7 jumate','Gemini ora 19 și 15','Perplexity la 21'] : ['Claude at 8 PM','ChatGPT at 5:43 PM','Grok at 7:30','Gemini at 7:15 PM','Perplexity at 9 PM','Midjourney at 8:30']).map(ex=>(
                    <span key={ex} className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${ex.includes('gbt') ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 font-bold' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white/80'}`}>{ex}</span>
                  ))}
                </div>
                <div className="mt-2 text-[10px] text-white/30 leading-relaxed">
                  {voiceLang==='ro'
                    ? `Debug: consola (F12) → voice parse: original=... norm=... detectedAi=... hour=... minute=... lang=${voiceLang} — dacă zici "ceas gbt ora 19", vezi ChatGPT nu Grok.`
                    : `Debug: console (F12) → voice parse: original=... norm=... detectedAi=... hour=... minute=... lang=${voiceLang} — say "ceas gbt at 7" still maps to ChatGPT.`}
                </div>
              </div>
              <div className="flex flex-col items-stretch sm:items-center gap-3 w-full sm:w-auto sm:min-w-[300px]">
                {!voiceSupported ? (
                  <div className="rounded-[16px] bg-red-500/10 border border-red-500/20 px-4 py-3 text-[12px] text-red-200 leading-relaxed">
                    {voiceLang==='ro' ? 'Browser-ul nu suportă voce — folosește Chrome pe Android/Desktop' : 'Browser does not support voice — use Chrome on Android/Desktop'}
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => voiceState === 'listening' ? stopVoiceRecognition() : startVoiceRecognition()}
                      className={`group relative w-full sm:w-[320px] h-[64px] rounded-[18px] font-black text-[15px] tracking-wide transition-all active:scale-[0.98] flex items-center justify-center gap-3 border
                        ${voiceState==='idle' ? 'bg-white text-black border-white hover:bg-white/90 shadow-[0_0_20px_rgba(255,255,255,0.15)]' : ''}
                        ${voiceState==='listening' ? 'bg-red-500 text-white border-red-400 mic-listening shadow-[0_0_30px_rgba(239,68,68,0.5)]' : ''}
                        ${voiceState==='processing' ? 'bg-amber-400 text-black border-amber-300' : ''}
                        ${voiceState==='success' ? 'bg-emerald-500 text-black border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.4)]' : ''}
                        ${voiceState==='error' ? 'bg-red-500/20 text-red-200 border-red-500/30' : ''}
                      `}
                    >
                      <span className={`text-[22px] ${voiceState==='listening' ? 'animate-pulse' : ''}`}>
                        {voiceState==='idle' && '🎤'}
                        {voiceState==='listening' && '🔴'}
                        {voiceState==='processing' && '⏳'}
                        {voiceState==='success' && '✅'}
                        {voiceState==='error' && '⚠️'}
                      </span>
                      <span className="truncate px-2">
                        {voiceState==='idle' && (voiceLang==='ro' ? 'Spune: Claude la 20' : 'Say: Claude at 8 PM')}
                        {voiceState==='listening' && (voiceLang==='ro' ? 'Ascult... apasă ca să oprești' : 'Listening... tap to stop')}
                        {voiceState==='processing' && (voiceLang==='ro' ? 'Procesez...' : 'Processing...')}
                        {voiceState==='success' && (voiceLang==='ro' ? 'Gata! Adăugat' : 'Done! Added')}
                        {voiceState==='error' && (voiceLang==='ro' ? 'Eroare — încearcă din nou' : 'Error — try again')}
                      </span>
                      {voiceState==='listening' && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-1">
                          <span className="w-1 h-4 bg-white/80 rounded-full" style={{animation:'micWave 0.6s ease-in-out infinite'}}></span>
                          <span className="w-1 h-6 bg-white/80 rounded-full" style={{animation:'micWave 0.6s ease-in-out infinite 0.15s'}}></span>
                          <span className="w-1 h-3 bg-white/80 rounded-full" style={{animation:'micWave 0.6s ease-in-out infinite 0.3s'}}></span>
                        </div>
                      )}
                    </button>
                    <div className="w-full sm:w-[320px] min-h-[56px] rounded-[14px] bg-[#14141f] border border-white/10 px-3.5 py-2.5 text-[12px] leading-relaxed">
                      {liveTranscript ? (
                        <div>
                          <span className="text-white/40">{voiceLang==='ro' ? 'Ai zis:' : 'You said:'}</span> <span className="text-white font-medium">{liveTranscript}</span>
                          {parsedPreview && (
                            <div className="mt-1 text-emerald-300 font-bold">{parsedPreview}</div>
                          )}
                        </div>
                      ) : parsedPreview ? (
                        <div className={`${voiceState==='error' ? 'text-red-300' : 'text-emerald-300'} font-medium`}>{parsedPreview}</div>
                      ) : (
                        <div className="text-white/30">
                          {voiceLang==='ro'
                            ? 'Apasă microfonul și spune comanda. Ex: „ceas gbt ora 19” → acum ChatGPT (fix). Vezi consola: voice parse log.'
                            : 'Tap mic and say command. Ex: "ChatGPT at 7 PM" or "Claude at 8 PM". Check console: voice parse log with detectedAi.'}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
            {voiceToast && (
              <div className="mt-4 rounded-[12px] bg-emerald-500 text-black px-4 py-2.5 text-[13px] font-bold shadow-[0_0_20px_rgba(16,185,129,0.4)] animate-[bannerSlide_0.3s_ease-out]">
                {voiceToast}
              </div>
            )}
          </div>
        </section>

        <section className="glass rounded-[20px] p-4 sm:p-5 mb-6 sm:mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-[13px] font-semibold tracking-widest uppercase text-white/50">Adaugă rapid</h2>
              <div className="flex flex-wrap gap-2 mt-3">
                {[
                  { label: 'Grok 19:00', name: 'Grok' as AiType, h: 19, m: 0 },
                  { label: 'Claude 20:00', name: 'Claude' as AiType, h: 20, m: 0 },
                  { label: 'ChatGPT 19:30', name: 'ChatGPT' as AiType, h: 19, m: 30 },
                ].map(p => (
                  <button
                    key={p.label}
                    onClick={() => addTimer(p.name, p.h, p.m)}
                    className="h-8 px-3.5 rounded-full bg-white/8 hover:bg-white/12 border border-white/10 text-[13px] font-medium transition-colors flex items-center gap-1.5"
                  >
                    <span className="w-5 h-5 rounded-full grid place-items-center text-[11px] font-bold" style={{ background: AI_META[p.name].bg, color: 'white' }}>{AI_META[p.name].letter}</span>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 lg:ml-auto w-full lg:w-auto">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-widest text-white/40 font-semibold">AI</label>
                <select
                  value={selectedAi}
                  onChange={e => setSelectedAi(e.target.value as AiType)}
                  className="h-10 rounded-[12px] bg-[#1a1a26] border border-white/10 px-3 text-[13px] font-medium outline-none focus:border-white/20 w-full sm:w-[160px]"
                >
                  {Object.keys(AI_META).map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-widest text-white/40 font-semibold flex items-center gap-2">
                  Oră limită
                  {willBeTomorrow && <span className="normal-case tracking-normal bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded text-[10px]">mâine</span>}
                </label>
                <input
                  type="time"
                  value={customTime}
                  onChange={e => setCustomTime(e.target.value)}
                  className="h-10 rounded-[12px] bg-[#1a1a26] border border-white/10 px-3 text-[13px] font-medium outline-none focus:border-white/20 mono w-full sm:w-[130px]"
                />
              </div>
              <button
                onClick={handleAddCustom}
                className="h-10 px-5 rounded-[12px] bg-white text-black text-[13px] font-bold hover:bg-white/90 transition-colors mt-1 sm:mt-0"
              >
                + Adaugă timer
              </button>
            </div>
          </div>
        </section>

        {timers.length === 0 ? (
          <div className="glass rounded-[24px] p-10 sm:p-16 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-white/5 grid place-items-center text-3xl mb-4">⏳</div>
            <h3 className="text-[18px] font-bold">Niciun AI în cooldown.</h3>
            <p className="text-white/50 text-[14px] mt-2 max-w-[320px] mx-auto">Adaugă unul mai sus. Timer-ele rulează local și te anunță cu un sunet calm.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5 min-w-0">
        {timers.map(timer => {
              const remainingMs = timer.target.getTime() - nowTick.getTime();
              const isDone = remainingMs <= 0;
              const isRinging = ringingIds.includes(timer.id);
              const isDismissed = dismissedIds.includes(timer.id);
              const totalDuration = timer.target.getTime() - timer.createdAt.getTime();
              const elapsed = nowTick.getTime() - timer.createdAt.getTime();
              const progress = isDone ? 100 : Math.max(0, Math.min(100, (elapsed / Math.max(1, totalDuration)) * 100));
              const isEditing = editingId === timer.id;

              return (
                <div
                  key={timer.id}
                  className={`glass glass-hover rounded-[22px] p-4 sm:p-5 relative overflow-hidden transition-all duration-300 min-w-0 ${isDone && !isDismissed ? 'glow-green' : ''} ${isRinging ? 'border-emerald-400/60 ring-2 ring-emerald-400/20' : ''} ${isDismissed ? 'opacity-[0.85] border-white/10' : ''}`}
                >
                  <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-[40px] opacity-20 pointer-events-none" style={{ background: AI_META[timer.name].bg }} />

                  <div className="flex items-start justify-between relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-[12px] grid place-items-center font-black text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
                        style={{ background: timer.name === 'Grok' ? '#111' : AI_META[timer.name].bg, color: 'white', border: '1px solid rgba(255,255,255,0.12)' }}
                      >
                        {AI_META[timer.name].letter}
                      </div>
                      <div>
                        <div className="font-bold text-[15px] leading-none tracking-tight">{timer.name}</div>
                        <div className="text-[12px] text-white/45 mt-1 flex items-center gap-1.5">
                          <span className={`h-1.5 w-1.5 rounded-full ${isDismissed ? 'bg-white/40' : isDone ? 'bg-emerald-400 animate-pulse-green' : 'bg-amber-400'}`} />
                          {isDone ? (isDismissed ? 'Oprit - gata de folosit' : 'Gata de folosit') : `Până la ${formatTarget(timer.target)}`}
                          {isTomorrowDate(timer.target) && !isDone && <span className="ml-1 text-[10px] bg-white/10 px-1.5 py-0.5 rounded-full">mâine</span>}
                        </div>
                      </div>
                    </div>
                    <div className={`text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full border ${isDismissed ? 'bg-white/10 text-white/60 border-white/15' : isDone ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/15 text-amber-300 border-amber-500/20'}`}>
                      {isRinging ? '🔔 CALM' : isDismissed ? 'OPRIT' : isDone ? 'DISPONIBIL' : 'AȘTEPTARE'}
                    </div>
                  </div>

                  <div className="mt-5 relative z-10">
                    <div className={`mono text-[34px] sm:text-[38px] font-bold tracking-[-0.04em] leading-none ${isDismissed ? 'text-white/70' : isDone ? 'text-emerald-300' : 'text-white'}`}>
                      {formatRemaining(remainingMs)}
                    </div>
                    <div className="text-[11px] text-white/35 mt-1 uppercase tracking-widest font-medium">
                      {isDone ? (isDismissed ? 'Sunet oprit • poți folosi din nou' : 'Poți vorbi din nou — limita a trecut') : `mai ai ${Math.ceil(remainingMs/1000/60)} minute`}
                    </div>
                  </div>

                  <div className="mt-4 h-1.5 w-full rounded-full bg-white/10 overflow-hidden relative z-10">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${isDismissed ? 'bg-white/40' : isDone ? 'bg-emerald-400' : 'bg-white'}`}
                      style={{ width: `${progress}%`, boxShadow: isDone ? '0 0 10px rgba(52,211,153,0.8)' : undefined }}
                    />
                  </div>

                  {isEditing ? (
                    <div className="mt-4 flex items-center gap-2 relative z-10">
                      <input type="time" value={editTimeVal} onChange={e => setEditTimeVal(e.target.value)} className="h-8 rounded-[10px] bg-[#1a1a26] border border-white/10 px-2.5 text-[13px] mono outline-none flex-1" />
                      <button onClick={saveEdit} className="h-8 px-3 rounded-[10px] bg-white text-black text-[12px] font-bold">Salvează</button>
                      <button onClick={() => setEditingId(null)} className="h-8 px-3 rounded-[10px] bg-white/10 text-white/70 text-[12px]">Anulează</button>
                    </div>
                  ) : (
                    <div className="mt-4 flex items-center gap-1.5 relative z-10 flex-wrap">
                      {isRinging ? (
                        <button onClick={() => dismissAlarm(timer.id)} className="h-8 px-4 rounded-full bg-emerald-500 text-black text-[12px] font-black tracking-wide hover:bg-emerald-400 transition-colors active:scale-95">🔕 Oprește</button>
                      ) : isDismissed ? (
                        <button onClick={() => startEdit(timer)} className="h-8 px-3 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-[12px] font-medium transition-colors">✎ Reprogramează</button>
                      ) : (
                        <button onClick={() => startEdit(timer)} className="h-8 px-3 rounded-full bg-white/8 hover:bg-white/12 border border-white/10 text-[12px] font-medium transition-colors">✎ Editează</button>
                      )}
                      <button onClick={() => handleReset(timer.id, 30)} className="h-8 px-3 rounded-full bg-white/8 hover:bg-white/12 border border-white/10 text-[12px] font-medium transition-colors">+30 min</button>
                      <button onClick={() => handleReset(timer.id, 60)} className="h-8 px-3 rounded-full bg-white/8 hover:bg-white/12 border border-white/10 text-[12px] font-medium transition-colors">+1h</button>
                      <button onClick={() => handleDelete(timer.id)} className="h-8 w-8 rounded-full bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 text-white/60 hover:text-red-300 grid place-items-center transition-colors ml-auto">✕</button>
                    </div>
                  )}

                  {isDone && (
                    <div className={`mt-3 text-[11px] rounded-[10px] px-2.5 py-1.5 flex items-center gap-1.5 ${isDismissed ? 'text-white/50 bg-white/5 border border-white/10' : 'text-emerald-300/80 bg-emerald-500/10 border border-emerald-500/20'}`}>
                      <span>●</span> {isRinging ? `${timer.name} sună calm! Titlul clipește în Chrome.` : isDismissed ? `${timer.name} oprit • gata de folosit, titlul încă clipește` : `${timer.name} e din nou disponibil!`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <footer className="mt-10 sm:mt-14 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11px] sm:text-[12px] text-white/35 border-t border-white/5 pt-5 overflow-x-clip">
          <div className="flex items-start gap-2">
            <span className="text-[14px]">💡</span>
            <span>Sunet nou calm (Slack-style) + oprire instant la „Am văzut”. Titlul din bara Chrome tot clipește „✅ GROK DISPONIBIL!”.</span>
          </div>
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest">
            <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10">Calm • oprire garantată • titlu clipește</span>
            <span>{new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
