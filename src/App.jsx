import React, { useEffect, useMemo, useRef, useState, useCallback, Component } from "react";

// ─────────────────────────────────────────────
// Error Boundary — prevents pink screen crash on mobile
// ─────────────────────────────────────────────
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
          background: "linear-gradient(135deg, #fff1f2, #fdf2f8)", padding: 24, textAlign: "center"
        }}>
          <div style={{
            background: "white", borderRadius: 24, padding: 32, maxWidth: 400,
            boxShadow: "0 8px 32px rgba(244,63,94,0.12)", border: "1px solid #fecdd3"
          }}>
            <p style={{ fontSize: 48, marginBottom: 12 }}>🌸</p>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#e11d48", marginBottom: 8 }}>Oops! Something broke</h2>
            <p style={{ fontSize: 13, color: "#78716c", marginBottom: 16, lineHeight: 1.6 }}>
              Our safe space hit a small bump. Tap below to reload and try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: "linear-gradient(135deg, #fb7185, #ec4899)", color: "white",
                border: "none", borderRadius: 999, padding: "12px 32px", fontSize: 14,
                fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 16px rgba(236,72,153,0.3)"
              }}
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const PHRASE = "always choose you no matter what happens next";
const STAGE_KEYS = [
  "ALWAYS",
  "CHOOSE",
  "YOU",
  "NO",
  "MATTER",
  "WHAT",
  "HAPPENS NEXT",
];

// YouTube video ID for "I'm Yours" by Jason Mraz
const YOUTUBE_VIDEO_ID = "EkHTsc9PU2A";

// Helper for stage success confetti particles
function generateConfetti() {
  return Array.from({ length: 60 }).map((_, idx) => ({
    id: idx,
    x: Math.random() * 100,
    y: -10 - Math.random() * 20,
    size: Math.random() * 8 + 5,
    color: ["#fb7185", "#f43f5e", "#fda4af", "#f472b6", "#ec4899", "#fbcfe8", "#fbbf24", "#a78bfa"][Math.floor(Math.random() * 8)],
    delay: Math.random() * 2,
    duration: Math.random() * 3 + 2,
    spin: Math.random() * 360,
  }));
}

// Normalize anniversary input for robust validation
function validateAnniversaryDate(input) {
  const normalized = input.toLowerCase().replace(/[^a-z0-9]/g, "");
  const validCombinations = [
    "july212023", "7212023", "07212023", "20230721",
    "21july2023", "2172023", "21072023"
  ];
  return validCombinations.includes(normalized);
}

// ─────────────────────────────────────────────
// Background Music Component (YouTube iframe at ultra low volume)
// ─────────────────────────────────────────────
function BackgroundMusic({ isPlaying, onToggle }) {
  const iframeRef = useRef(null);
  const playerRef = useRef(null);

  useEffect(() => {
    try {
      // Load YouTube IFrame API
      if (!window.YT) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        tag.onerror = () => console.warn("YouTube API failed to load");
        document.head.appendChild(tag);
      }

      const initPlayer = () => {
        try {
          if (playerRef.current) return;
          playerRef.current = new window.YT.Player("yt-bg-music", {
            videoId: YOUTUBE_VIDEO_ID,
            playerVars: {
              autoplay: 0,
              loop: 1,
              playlist: YOUTUBE_VIDEO_ID,
              controls: 0,
              showinfo: 0,
              modestbranding: 1,
              rel: 0,
              playsinline: 1,
            },
            events: {
              onReady: (event) => {
                try { event.target.setVolume(6); } catch (e) {}
              },
              onError: () => console.warn("YouTube player error"),
            },
          });
        } catch (e) {
          console.warn("YouTube player init failed:", e);
        }
      };

      if (window.YT && window.YT.Player) {
        initPlayer();
      } else {
        window.onYouTubeIframeAPIReady = initPlayer;
      }
    } catch (e) {
      console.warn("BackgroundMusic setup failed:", e);
    }
  }, []);

  useEffect(() => {
    try {
      const player = playerRef.current;
      if (!player || !player.playVideo) return;

      if (isPlaying) {
        player.playVideo();
        player.setVolume(6);
      } else {
        player.pauseVideo();
      }
    } catch (e) {
      console.warn("Music playback toggle failed:", e);
    }
  }, [isPlaying]);

  return (
    <>
      <div style={{ position: "fixed", top: -9999, left: -9999, width: 1, height: 1, overflow: "hidden", pointerEvents: "none" }}>
        <div id="yt-bg-music" />
      </div>

      <button
        type="button"
        onClick={onToggle}
        className={`fixed bottom-24 sm:bottom-28 right-4 z-50 w-11 h-11 rounded-full border shadow-lg flex items-center justify-center text-lg transition-all duration-300 select-none active:scale-90 ${
          isPlaying
            ? "bg-gradient-to-br from-rose-400 to-pink-500 border-rose-300 text-white shadow-rose-300/40 music-btn-active"
            : "bg-white/90 border-rose-200 text-rose-400 hover:bg-rose-50"
        }`}
        title={isPlaying ? "Pause Music" : "Play Music"}
        aria-label="Toggle background music"
      >
        {isPlaying ? "♫" : "♪"}
      </button>
    </>
  );
}


function AppInner() {
  const mySessionId = useMemo(() => Math.random().toString(36).substring(2, 9), []);

  // Authentication
  const [isLocked, setIsLocked] = useState(() => sessionStorage.getItem("safe_space_auth") !== "true");
  const [nicknameInput, setNicknameInput] = useState("");
  const [nickname, setNickname] = useState(() => sessionStorage.getItem("nickname") || "");
  const [dateInput, setDateInput] = useState("");
  const [dateError, setDateError] = useState("");
  const [isWiggling, setIsWiggling] = useState(false);

  // App States
  const [activeStage, setActiveStage] = useState(1);
  const [unlocked, setUnlocked] = useState(Array(STAGE_KEYS.length).fill(false));
  const [keys, setKeys] = useState(Array(STAGE_KEYS.length).fill(null));
  const [guideMessage, setGuideMessage] = useState("Welcome to our safe space. Let's begin the journey.");

  const vaultStageNumber = STAGE_KEYS.length + 1;

  // Celebrations
  const [celebrating, setCelebrating] = useState(false);
  const [confetti, setConfetti] = useState([]);

  // Vault
  const [vaultInput, setVaultInput] = useState("");
  const [vaultError, setVaultError] = useState("");
  const [loveLetterOpen, setLoveLetterOpen] = useState(false);

  // Music
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);

  // Chat
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);
  const [isServerConnected, setIsServerConnected] = useState(false);
  const [chatMessages, setChatMessages] = useState(() => {
    const saved = localStorage.getItem("safe_space_chat");
    return saved ? JSON.parse(saved) : [
      { id: 1, sender: "System", text: "Welcome to your shared secure space. Messages sent here are synced in real-time.", timestamp: "00:00" }
    ];
  });
  const [chatInput, setChatInput] = useState("");
  const [partnerTyping, setPartnerTyping] = useState(false);

  const accessibleStages = useMemo(() => {
    const access = [true];
    for (let i = 1; i < STAGE_KEYS.length; i += 1) access.push(unlocked[i - 1]);
    return access;
  }, [unlocked]);

  // WebSockets
  const broadcastChannelRef = useRef(null);
  const socketRef = useRef(null);
  const chatEndRef = useRef(null);

  // Auto-scroll chat — use requestAnimationFrame to avoid layout thrash
  useEffect(() => {
    if (!chatEndRef.current) return;
    const el = chatEndRef.current.parentElement;
    if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  }, [chatMessages, partnerTyping]);

  useEffect(() => {
    if (isLocked || !nickname) return;

    // BroadcastChannel — wrap in try/catch for mobile compatibility
    // (not supported on iOS Safari < 15.4, some WebViews, etc.)
    let localChannel = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        localChannel = new BroadcastChannel("safe-space-fallback-channel");
        broadcastChannelRef.current = localChannel;

        localChannel.onmessage = (event) => {
          try {
            if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
              const { type, payload } = event.data;
              if (type === "FALLBACK_PING") {
                setOnlineUsers((prev) => {
                  if (prev.some((u) => u.sessionId === payload.sessionId)) return prev;
                  return [...prev, { nickname: payload.nickname, sessionId: payload.sessionId }];
                });
                localChannel.postMessage({
                  type: "FALLBACK_PONG",
                  payload: { nickname, sessionId: mySessionId, targetSessionId: payload.sessionId }
                });
              } else if (type === "FALLBACK_PONG") {
                if (payload.targetSessionId === mySessionId) {
                  setOnlineUsers((prev) => {
                    if (prev.some((u) => u.sessionId === payload.sessionId)) return prev;
                    return [...prev, { nickname: payload.nickname, sessionId: payload.sessionId }];
                  });
                }
              } else if (type === "FALLBACK_EXIT") {
                setOnlineUsers((prev) => prev.filter((u) => u.sessionId !== payload.sessionId));
              } else if (type === "FALLBACK_CHAT_MESSAGE") {
                setChatMessages((prev) => {
                  const next = [...prev, payload.message];
                  localStorage.setItem("safe_space_chat", JSON.stringify(next));
                  return next;
                });
              }
            }
          } catch (e) {
            console.warn("BroadcastChannel message error:", e);
          }
        };
      }
    } catch (e) {
      console.warn("BroadcastChannel not supported:", e);
      localChannel = null;
    }

    let socket = null;
    let reconnectTimeout = null;
    let isReconnecting = false;

    function safeBroadcast(msg) {
      try {
        if (localChannel) localChannel.postMessage(msg);
      } catch (e) {
        console.warn("BroadcastChannel send failed:", e);
      }
    }

    function connectToServer() {
      if (isLocked || !nickname) return;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);

      try {
        const wsUrl = `ws://${window.location.hostname}:3001`;
        socket = new WebSocket(wsUrl);
        socketRef.current = socket;

        socket.onopen = () => {
          setIsServerConnected(true);
          isReconnecting = false;
          try {
            socket.send(JSON.stringify({ type: "IDENTIFY", payload: { nickname, sessionId: mySessionId } }));
          } catch (e) {}
          fetch(`http://${window.location.hostname}:3001/api/messages`)
            .then((res) => res.json())
            .then((data) => {
              setChatMessages(data);
              localStorage.setItem("safe_space_chat", JSON.stringify(data));
            })
            .catch(() => {});
        };

        socket.onmessage = (event) => {
          try {
            const { type, payload } = JSON.parse(event.data);
            if (type === "PRESENCE_UPDATE") {
              setOnlineUsers(payload.onlineUsers.filter((u) => u.sessionId !== mySessionId));
            } else if (type === "CHAT_MESSAGE") {
              setChatMessages((prev) => {
                const next = [...prev, payload.message];
                localStorage.setItem("safe_space_chat", JSON.stringify(next));
                return next;
              });
            }
          } catch (err) {}
        };

        socket.onclose = () => {
          setIsServerConnected(false);
          safeBroadcast({ type: "FALLBACK_PING", payload: { nickname, sessionId: mySessionId } });
          if (!isReconnecting) {
            isReconnecting = true;
            reconnectTimeout = setTimeout(connectToServer, 5000);
          }
        };

        socket.onerror = () => {
          // Silently handle — onclose will fire after this
        };
      } catch (e) {
        console.warn("WebSocket connection failed:", e);
        setIsServerConnected(false);
        if (!isReconnecting) {
          isReconnecting = true;
          reconnectTimeout = setTimeout(connectToServer, 5000);
        }
      }
    }

    connectToServer();
    safeBroadcast({ type: "FALLBACK_PING", payload: { nickname, sessionId: mySessionId } });

    const handleExit = () => {
      try {
        if (socket && socket.readyState === WebSocket.OPEN) socket.close();
        safeBroadcast({ type: "FALLBACK_EXIT", payload: { sessionId: mySessionId } });
      } catch (e) {}
    };
    window.addEventListener("beforeunload", handleExit);
    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      handleExit();
      window.removeEventListener("beforeunload", handleExit);
      try { if (socket) socket.close(); } catch (e) {}
      try { if (localChannel) localChannel.close(); } catch (e) {}
    };
  }, [isLocked, nickname, mySessionId]);

  // Stage unlock
  function unlockStage(index, keyword) {
    if (unlocked[index]) return;
    setUnlocked((prev) => { const next = [...prev]; next[index] = true; return next; });
    setKeys((prev) => { const next = [...prev]; next[index] = keyword; return next; });
    setConfetti(generateConfetti());
    setCelebrating(true);
    setGuideMessage(`Perfect! Stage ${index + 1} complete. Key "${keyword}" acquired.`);
    setTimeout(() => { setCelebrating(false); setActiveStage(index + 2); }, 2200);
  }

  // Guide messages
  useEffect(() => {
    if (isLocked) return;
    if (activeStage === vaultStageNumber) {
      setGuideMessage(loveLetterOpen ? "Master Vault Unlocked. Happy 34 Months of Love! 🌸" : `Stage ${vaultStageNumber} // Enter the Master Vault secret phrase to decrypt the sacred letters.`);
      return;
    }
    const messages = {
      1: "Catch the shrinking heart before time runs out! 💓",
      2: "Match the pairs — 8 wrong guesses and they re-shuffle! 🧩",
      3: "Tune frequency & phase to overlap the love waves! 🌊",
      4: "Catch rising hearts, avoid 💔 and 🌧️! ✨",
      5: "Watch the stars flash, then repeat the sequence! ⭐",
      6: "Connection trivia — one wrong and it all resets! 🧠",
      7: "Align three sliders at once — balance is key. ⚖️",
    };
    setGuideMessage(`Stage ${activeStage} // ${messages[activeStage] ?? "Let's proceed with love."}`);
  }, [activeStage, loveLetterOpen, isLocked]);

  // Login
  function handleLoginSubmit(e) {
    e.preventDefault();
    const formattedNick = nicknameInput.trim();
    if (!formattedNick) { setDateError("Please enter a nickname first."); return; }
    if (validateAnniversaryDate(dateInput)) {
      sessionStorage.setItem("safe_space_auth", "true");
      sessionStorage.setItem("nickname", formattedNick);
      setNickname(formattedNick);
      setIsLocked(false);
      setDateError("");
    } else {
      setDateError("That date doesn't match our special day. Try again, my love.");
      setIsWiggling(true);
      setTimeout(() => setIsWiggling(false), 400);
    }
  }

  // Stage select
  function handleStageSelect(index) {
    if (index === STAGE_KEYS.length) {
      if (unlocked.every(Boolean)) { setActiveStage(vaultStageNumber); setCelebrating(false); }
      else setGuideMessage(`The Master Vault is sealed. Collect all ${STAGE_KEYS.length} keys first!`);
      return;
    }
    if (accessibleStages[index] || unlocked[index]) { setActiveStage(index + 1); setCelebrating(false); }
    else setGuideMessage("This stage is currently locked. Complete previous stages to advance.");
  }

  // Vault
  function submitVault() {
    const candidate = vaultInput.trim().toLowerCase();
    if (!candidate) { setVaultError("Please type the secret phrase."); return; }
    if (candidate === PHRASE || candidate.replace(/[^a-z]/g, "") === PHRASE.replace(/[^a-z]/g, "")) {
      setLoveLetterOpen(true); setVaultError(""); setGuideMessage("Vault decrypted! Happy 34th Month of Love. Scroll to read.");
    } else setVaultError("Secret phrase is incorrect. Check your keys and spacing!");
  }

  function autoFillVault() {
    if (unlocked.every(Boolean)) { setVaultInput(PHRASE); setVaultError(""); }
    else setVaultError("Unlock all 7 stages first to acquire all keys!");
  }

  // Chat
  function sendChatMessage(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!chatInput.trim()) return;
    const newMsg = {
      id: Date.now(), sender: nickname, text: chatInput.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatInput("");

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "CHAT_MESSAGE", payload: { message: newMsg } }));
      fetch(`http://${window.location.hostname}:3001/api/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newMsg)
      }).catch(() => {});
    } else {
      setChatMessages(prev => {
        const updated = [...prev, newMsg];
        setTimeout(() => localStorage.setItem("safe_space_chat", JSON.stringify(updated)), 0);
        if (broadcastChannelRef.current) {
          broadcastChannelRef.current.postMessage({ type: "FALLBACK_CHAT_MESSAGE", payload: { message: newMsg } });
        }
        if (onlineUsers.length === 0) {
          setPartnerTyping(true);
          setTimeout(() => {
            setPartnerTyping(false);
            const responses = [
              "Reading this makes me smile so much! You are my absolute world. 💖",
              "Every single moment with you is a treasure. I'm so glad we have this safe space together. 🥰",
              "You always know exactly how to make my heart skip a beat. I love you! ✨",
              "No matter what happens next, I am always choosing you. Always. 🌸",
              "You make everything so bright and beautiful. Sending you the warmest hug right now! 🤗",
            ];
            const responseMsg = {
              id: Date.now() + 1,
              sender: nickname.toLowerCase() === "rizza" ? "Elton" : nickname.toLowerCase() === "elton" ? "Rizza" : "My Love",
              text: responses[Math.floor(Math.random() * responses.length)],
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setChatMessages(prev2 => {
              const final = [...prev2, responseMsg];
              setTimeout(() => localStorage.setItem("safe_space_chat", JSON.stringify(final)), 0);
              return final;
            });
          }, 1500);
        }
        return updated;
      });
    }
  }

  function clearChat() {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      fetch(`http://${window.location.hostname}:3001/api/messages`, { method: "DELETE" })
        .then((res) => res.json())
        .then((data) => { setChatMessages(data.messages); localStorage.setItem("safe_space_chat", JSON.stringify(data.messages)); })
        .catch(() => clearLocalChatOnly());
    } else clearLocalChatOnly();
  }

  function clearLocalChatOnly() {
    const reset = [{ id: 1, sender: "System", text: "Chat history cleared with love.", timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }];
    setChatMessages(reset);
    localStorage.setItem("safe_space_chat", JSON.stringify(reset));
  }

  // ═══════════════════════════════════════════════
  //  STAGE 1 — Heart Clicker (heartbeat animation)
  // ═══════════════════════════════════════════════
  function Stage1() {
    const containerRef = useRef(null);
    const [hits, setHits] = useState(0);
    const [pos, setPos] = useState({ top: "50%", left: "50%" });
    const [timeLeft, setTimeLeft] = useState(10);
    const [bursts, setBursts] = useState([]);
    const [heartMsg, setHeartMsg] = useState("Catch the shrinking heart! ⏱️");
    const [gameOver, setGameOver] = useState(false);
    const [shakeKey, setShakeKey] = useState(0);

    const currentSize = useMemo(() => Math.max(32, 68 - hits * 8), [hits]);

    useEffect(() => {
      if (hits >= 5 || gameOver) return;
      if (timeLeft <= 0) { setGameOver(true); setHeartMsg("Sparks faded! Too slow, my love! 💔"); setShakeKey((p) => p + 1); return; }
      const timer = setTimeout(() => setTimeLeft((p) => p - 1), 1000);
      return () => clearTimeout(timer);
    }, [timeLeft, hits, gameOver]);

    useEffect(() => { setPos(randomPosition(containerRef.current)); }, []);

    useEffect(() => {
      if (hits >= 5 || gameOver) return;
      const intervalMs = Math.max(450, 1000 - hits * 110);
      const timer = setInterval(() => setPos(randomPosition(containerRef.current)), intervalMs);
      return () => clearInterval(timer);
    }, [hits, gameOver]);

    useEffect(() => { if (hits >= 5) unlockStage(0, STAGE_KEYS[0]); }, [hits]);

    function randomPosition(container) {
      if (!container) return { left: "50%", top: "50%" };
      const { offsetWidth: w, offsetHeight: h } = container;
      const m = 44;
      return {
        left: `${Math.max(m, Math.min(w - m, Math.floor(Math.random() * (w - m * 2) + m)))}px`,
        top: `${Math.max(m, Math.min(h - m, Math.floor(Math.random() * (h - m * 2) + m)))}px`
      };
    }

    function handleHit(e) {
      if (hits >= 5 || gameOver) return;
      const rect = containerRef.current.getBoundingClientRect();
      setBursts((prev) => [...prev, { id: Date.now(), x: e.clientX - rect.left, y: e.clientY - rect.top }]);
      const newHits = hits + 1;
      setHits(newHits);
      const phrases = ["Good click! 🌸", "Shrinking! 🧸", "Getting faster! ⚡", "Tiny heart! 🔍", "Spark Locked! 🎉"];
      setHeartMsg(phrases[newHits - 1]);
      if (newHits < 5) setPos(randomPosition(containerRef.current));
    }

    function resetGame() {
      setHits(0); setTimeLeft(10); setGameOver(false);
      setHeartMsg("Catch the shrinking heart! ⏱️");
      setPos(randomPosition(containerRef.current));
    }

    return (
      <div className={`space-y-3 sm:space-y-4 animate-fade-in-up ${gameOver ? "animate-wiggle" : ""}`} key={shakeKey}>
        <p className="text-xs text-stone-500 font-serif-elegant italic text-center px-2">
          Click the bouncing heart — it shrinks and speeds up with each hit!
        </p>

        <div className="flex justify-between items-center text-xs font-bold text-rose-500 px-1">
          <span>Clicks: {hits}/5</span>
          <span className={timeLeft < 4 ? "text-rose-600 animate-pulse font-bold" : "text-stone-500"}>
            ⏳ {timeLeft}s
          </span>
        </div>

        <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
          <div className="bg-gradient-to-r from-rose-400 to-pink-500 h-2 transition-all duration-1000 rounded-full" style={{ width: `${(timeLeft / 10) * 100}%` }} />
        </div>

        <div ref={containerRef} className="relative h-52 sm:h-60 overflow-hidden rounded-2xl border border-rose-100 bg-gradient-to-b from-rose-50/50 to-pink-50/50 shadow-inner touch-none">
          {!gameOver && hits < 5 ? (
            <button
              type="button"
              onClick={handleHit}
              className="absolute stage1-heart-target rounded-full bg-gradient-to-br from-rose-400 to-pink-500 text-white shadow-lg flex items-center justify-center select-none cursor-pointer border-2 border-white/60 active:scale-75 transition-transform duration-75"
              style={{ left: pos.left, top: pos.top, width: `${currentSize}px`, height: `${currentSize}px`, fontSize: `${currentSize * 0.5}px` }}
              aria-label="moving shrinking heart"
            >
              ❤️
            </button>
          ) : hits >= 5 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center space-y-2 animate-pop">
              <span className="text-5xl animate-bounce">💖</span>
              <p className="text-sm font-serif-elegant font-bold text-rose-500">Love Spark Ignited!</p>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center space-y-3 bg-rose-50/40">
              <span className="text-4xl">💔</span>
              <p className="text-xs font-bold text-rose-600">Time expired! Let's rekindle.</p>
              <button onClick={resetGame} type="button" className="px-5 py-2 btn-primary text-xs font-semibold">Retry Sparks</button>
            </div>
          )}

          {bursts.map((burst) => (
            <div key={burst.id} className="absolute pointer-events-none text-2xl animate-burst" style={{ left: burst.x, top: burst.y }}>🌸</div>
          ))}
        </div>

        <div className="flex justify-between items-center text-[0.65rem] text-stone-400 px-1">
          <span>*Heart shrinks with each hit</span>
          <button type="button" onClick={resetGame} className="text-rose-400 hover:text-rose-500 font-semibold hover:underline active:scale-95 transition">Reset</button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  //  STAGE 2 — Memory Puzzle (shimmer + glow animations)
  // ═══════════════════════════════════════════════
  function Stage2() {
    const emojis = useMemo(() => ["💖", "🌹", "🧸", "🥂", "🌸", "💫"], []);
    const initialCards = useMemo(() => {
      const doubled = [...emojis, ...emojis];
      return shuffle(doubled).map((emoji, idx) => ({ id: idx, emoji, flipped: false, matched: false }));
    }, [emojis]);

    const [cards, setCards] = useState(initialCards);
    const [wrongAttempts, setWrongAttempts] = useState(0);
    const [wigglingIds, setWigglingIds] = useState([]);
    const [matchedIds, setMatchedIds] = useState([]);
    const [stageState, setStageState] = useState("playing");
    const lockRef = useRef(false);

    useEffect(() => {
      if (cards.every((c) => c.matched)) { unlockStage(1, STAGE_KEYS[1]); setStageState("completed"); }
    }, [cards]);

    function shuffle(array) { return [...array].sort(() => Math.random() - 0.5); }

    function flipCard(id) {
      if (lockRef.current || stageState !== "playing") return;
      const clickedCard = cards.find((c) => c.id === id);
      if (!clickedCard || clickedCard.flipped || clickedCard.matched) return;

      setCards((prev) => {
        const next = prev.map((card) => (card.id === id ? { ...card, flipped: true } : card));
        const flipped = next.filter((card) => card.flipped && !card.matched);
        if (flipped.length === 2) {
          lockRef.current = true;
          const [first, second] = flipped;
          if (first.emoji === second.emoji) {
            setTimeout(() => {
              setMatchedIds((prev) => [...prev, first.id, second.id]);
              setCards((current) => current.map((card) =>
                card.id === first.id || card.id === second.id ? { ...card, matched: true } : card
              ));
              lockRef.current = false;
            }, 500);
          } else {
            setTimeout(() => {
              setWigglingIds([first.id, second.id]);
              const nextAttempts = wrongAttempts + 1;
              setWrongAttempts(nextAttempts);
              setTimeout(() => {
                setWigglingIds([]);
                setCards((current) => current.map((card) =>
                  card.id === first.id || card.id === second.id ? { ...card, flipped: false } : card
                ));
                if (nextAttempts >= 8) setStageState("failed");
                lockRef.current = false;
              }, 400);
            }, 600);
          }
        }
        return next;
      });
    }

    function resetGrid() {
      setCards(shuffle([...emojis, ...emojis]).map((emoji, idx) => ({ id: idx, emoji, flipped: false, matched: false })));
      setWrongAttempts(0); setStageState("playing"); setMatchedIds([]);
    }

    return (
      <div className="space-y-3 sm:space-y-4 animate-fade-in-up">
        <p className="text-xs text-stone-500 font-serif-elegant italic text-center px-2">
          Find all 6 matching pairs. 8 wrong guesses and cards re-shuffle!
        </p>

        <div className="flex justify-between items-center text-xs font-bold text-rose-500 px-1">
          <span>Mismatches: {wrongAttempts}/8</span>
          <span className={8 - wrongAttempts <= 2 ? "text-rose-600 animate-pulse" : "text-stone-500"}>
            Remaining: {8 - wrongAttempts}
          </span>
        </div>

        {stageState === "failed" ? (
          <div className="rounded-2xl bg-rose-50/50 border border-rose-100 p-6 text-center space-y-3 animate-wiggle">
            <span className="text-4xl">🧩</span>
            <h4 className="text-sm font-serif-elegant font-bold text-rose-600">Memory Overloaded!</h4>
            <p className="text-xs text-stone-500">Cards shuffled! Let's retry together.</p>
            <button onClick={resetGrid} type="button" className="px-5 py-2.5 btn-primary text-xs font-semibold">Re-shuffle Cards</button>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-2.5 max-w-sm mx-auto perspective-1000">
            {cards.map((card) => {
              const isWiggling = wigglingIds.includes(card.id);
              const justMatched = matchedIds.includes(card.id);
              return (
                <div
                  key={card.id}
                  className={`relative h-16 sm:h-18 w-full transition-transform duration-500 transform-style-3d cursor-pointer select-none ${card.flipped || card.matched ? "rotate-y-180" : ""} ${isWiggling ? "animate-wiggle" : ""} ${justMatched ? "stage2-matched" : ""}`}
                  onClick={() => flipCard(card.id)}
                >
                  <div className="absolute inset-0 stage2-card-back border border-white rounded-xl flex items-center justify-center shadow-sm backface-hidden text-rose-400 font-bold text-lg hover:shadow-md hover:scale-[1.03] active:scale-95 transition-all">
                    🌸
                  </div>
                  <div className="absolute inset-0 bg-white border border-rose-200 rounded-xl flex items-center justify-center shadow-inner backface-hidden rotate-y-180 text-2xl sm:text-3xl">
                    {card.emoji}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  //  STAGE 3 — Love Alignment (wave oscilloscope)
  // ═══════════════════════════════════════════════
  function Stage3() {
    const [freq, setFreq] = useState(1);
    const [phase, setPhase] = useState(0);
    const [aligned, setAligned] = useState(false);

    const closeness = useMemo(() => {
      const freqDiff = Math.abs(freq - 3) / 4;
      const phaseDiff = Math.abs(phase - 14) / 25;
      return 1 - (freqDiff + phaseDiff) / 2;
    }, [freq, phase]);

    useEffect(() => {
      if (freq === 3 && phase === 14) { setAligned(true); unlockStage(2, STAGE_KEYS[2]); }
      else setAligned(false);
    }, [freq, phase]);

    const drawWave = (frequency, phaseOffset, amplitude = 25) => {
      return Array.from({ length: 120 }).map((_, x) => {
        const rad = (x / 120) * frequency * 2 * Math.PI + (phaseOffset * 0.35);
        const y = 50 + Math.sin(rad) * amplitude;
        return `${x === 0 ? "M" : "L"} ${(x / 120) * 280} ${y}`;
      }).join(" ");
    };

    return (
      <div className="space-y-3 sm:space-y-4 animate-fade-in-up">
        <p className="text-xs text-stone-500 font-serif-elegant italic text-center px-2">
          Overlap the two love waveforms. Target: Frequency = 3, Phase = 14
        </p>

        <div className={`relative h-32 sm:h-36 w-full bg-stone-950 border-2 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center stage3-screen ${aligned ? "border-yellow-400/60" : "border-rose-200"}`}>
          <svg className="w-full h-full" viewBox="0 0 280 100">
            <path d="M 0 50 L 280 50 M 70 0 L 70 100 M 140 0 L 140 100 M 210 0 L 210 100" className="stroke-stone-900 stroke-1" strokeDasharray="3,3" />
            <path
              d="M 140 68 C 130 53, 115 48, 115 33 C 115 20, 130 20, 140 31 C 150 20, 165 20, 165 33 C 165 48, 150 53, 140 68 Z"
              fill={aligned ? "#fbbf24" : "#f43f5e"}
              className={`transition-all duration-300 ${aligned ? "animate-pulse" : ""}`}
              style={{
                transform: `scale(${0.5 + closeness * 0.5})`, transformOrigin: "140px 45px",
                opacity: 0.12 + closeness * 0.78,
                filter: `drop-shadow(0 0 ${closeness * 12}px ${aligned ? "rgba(251, 191, 36, 0.8)" : "rgba(244, 63, 94, 0.7)"})`
              }}
            />
            <path d={drawWave(3, 14, 25)} fill="none" className={`stroke-2 transition-all duration-300 ${aligned ? "stroke-yellow-400 stroke-[3] animate-pulse" : "stroke-rose-300/40"}`} />
            {!aligned && <path d={drawWave(freq, phase, 25)} fill="none" className="stroke-rose-500 stroke-2" />}
          </svg>
          {aligned && (
            <div className="absolute inset-0 bg-yellow-400/10 backdrop-blur-[0.5px] flex items-center justify-center text-center animate-pop">
              <span className="text-yellow-400 text-3xl sm:text-4xl animate-bounce">💖 Waveforms Merged! 👑</span>
            </div>
          )}
        </div>

        <div className="space-y-3 sm:space-y-4">
          <div className="space-y-1">
            <div className="flex justify-between text-[0.7rem] font-bold text-stone-500 px-1">
              <span>Frequency (Target: 3)</span>
              <span className="text-rose-500">{freq} Hz</span>
            </div>
            <input type="range" min="1" max="5" step="1" value={freq} onChange={(e) => setFreq(Number(e.target.value))} className="w-full" disabled={aligned} />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-[0.7rem] font-bold text-stone-500 px-1">
              <span>Phase Rotation (Target: 14)</span>
              <span className="text-rose-500">Offset {phase}</span>
            </div>
            <input type="range" min="0" max="25" step="1" value={phase} onChange={(e) => setPhase(Number(e.target.value))} className="w-full" disabled={aligned} />
          </div>
        </div>

        <div className={`w-full py-3.5 rounded-2xl border text-center text-xl sm:text-2xl font-serif-elegant font-bold tracking-[0.3em] transition-all duration-500 ${aligned ? "bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200 text-yellow-600" : "bg-gradient-to-r from-rose-50 to-pink-50 border-rose-100 text-rose-500"}`}>
          {aligned ? "✨ SACRED ✨" : "ALIGNING..."}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  //  STAGE 4 — Bubble Catcher (wobble-float animation)
  // ═══════════════════════════════════════════════
  function Stage4() {
    const [score, setScore] = useState(0);
    const [items, setItems] = useState([]);
    const intervalRef = useRef(null);
    const [wrongTaps, setWrongTaps] = useState(0);

    useEffect(() => {
      if (score >= 8) return;
      intervalRef.current = window.setInterval(() => {
        const isDistractor = Math.random() > 0.65;
        const itemId = Date.now() + Math.random();
        const speed = Math.random() * 1.2 + 1.1;
        const scale = Math.random() * 0.3 + 0.8;
        setItems((prev) => [...prev, {
          id: itemId, left: Math.random() * 85 + 5, speed, scale,
          symbol: isDistractor ? ["💔", "🌧️"][Math.floor(Math.random() * 2)] : ["❤️", "💖", "🌸", "💕"][Math.floor(Math.random() * 4)],
          isDistractor, popped: false
        }]);
        setTimeout(() => setItems((prev) => prev.filter((item) => item.id !== itemId)), 3500);
      }, 900);
      return () => window.clearInterval(intervalRef.current);
    }, [score]);

    useEffect(() => { if (score >= 8) unlockStage(3, STAGE_KEYS[3]); }, [score]);

    function popItem(id, isDistractor) {
      if (score >= 8) return;
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, popped: true } : item)));
      if (isDistractor) { setWrongTaps((p) => p + 1); setScore((s) => Math.max(0, s - 2)); }
      else setScore((s) => Math.min(8, s + 1));
      setTimeout(() => setItems((prev) => prev.filter((item) => item.id !== id)), 400);
    }

    return (
      <div className="space-y-3 sm:space-y-4 animate-fade-in-up">
        <p className="text-xs text-stone-500 font-serif-elegant italic text-center px-2">
          Pop the love hearts as they float up! Avoid 💔 and 🌧️ (−2 penalty)
        </p>

        <div className="flex justify-between items-center text-xs font-bold text-rose-500 px-1">
          <span>Captured: {score}/8</span>
          <span className="text-[0.68rem] text-rose-400 font-semibold">
            {wrongTaps > 0 ? `Penalties: ${wrongTaps}` : "Pop hearts! 💕"}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
          <div className="bg-gradient-to-r from-rose-400 to-pink-500 h-2 transition-all duration-300 rounded-full" style={{ width: `${(score / 8) * 100}%` }} />
        </div>

        <div className="relative h-56 sm:h-64 overflow-hidden rounded-2xl border border-rose-100 bg-gradient-to-b from-rose-50/20 to-pink-100/30 shadow-inner touch-none">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => popItem(item.id, item.isDistractor)}
              className={`absolute bottom-0 text-2xl sm:text-3xl select-none cursor-pointer flex items-center justify-center leading-none ${
                item.popped ? "stage4-bubble-pop" : "stage4-bubble active:scale-75"
              }`}
              style={{
                left: `${item.left}%`,
                "--bubble-scale": item.scale,
                "--bubble-speed": `${item.speed}s`,
              }}
              aria-label="bubble catcher target"
            >
              {item.popped ? (item.isDistractor ? "💥" : "✨") : item.symbol}
            </button>
          ))}
          {score >= 8 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center bg-white/70 backdrop-blur-sm animate-pop">
              <span className="text-5xl text-rose-500">🎈</span>
              <p className="text-sm font-serif-elegant font-bold text-rose-500 mt-2">All hearts captured!</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  //  STAGE 5 — Echo Constellation (star twinkle + line draw)
  // ═══════════════════════════════════════════════
  function Stage6() {
    const starCoords = {
      1: { top: "20%", left: "30%" }, 2: { top: "35%", left: "75%" },
      3: { top: "70%", left: "65%" }, 4: { top: "80%", left: "25%" },
      5: { top: "45%", left: "45%" },
    };

    const targetSequence = useMemo(() => [2, 5, 1, 4, 3], []);
    const [userInputs, setUserInputs] = useState([]);
    const [flashingStar, setFlashingStar] = useState(null);
    const [playbackActive, setPlaybackActive] = useState(false);
    const [melodyMsg, setMelodyMsg] = useState("Watch the constellation light up...");
    const [errorShake, setErrorShake] = useState(false);

    useEffect(() => { playSequence(); }, []);

    function playSequence() {
      setPlaybackActive(true); setUserInputs([]); setMelodyMsg("Memorize the star pattern...");
      let step = 0;
      const interval = setInterval(() => {
        if (step >= targetSequence.length) {
          clearInterval(interval); setFlashingStar(null); setPlaybackActive(false);
          setMelodyMsg("Your turn! Repeat the melody sequence.");
          return;
        }
        setFlashingStar(targetSequence[step]);
        step++;
        setTimeout(() => setFlashingStar(null), 550);
      }, 850);
    }

    function handleStarClick(nodeNum) {
      if (playbackActive || unlocked[4]) return;
      const nextInputs = [...userInputs, nodeNum];
      setUserInputs(nextInputs);
      setFlashingStar(nodeNum);
      setTimeout(() => setFlashingStar(null), 250);

      if (nextInputs[nextInputs.length - 1] !== targetSequence[nextInputs.length - 1]) {
        setErrorShake(true);
        setMelodyMsg("Pattern mismatched! Replaying... 🌸");
        setTimeout(() => { setErrorShake(false); playSequence(); }, 1200);
        return;
      }
      if (nextInputs.length === targetSequence.length) {
        setMelodyMsg("Acoustic sequence synced! 💖");
        unlockStage(4, STAGE_KEYS[4]);
      }
    }

    return (
      <div className={`space-y-3 sm:space-y-4 animate-fade-in-up ${errorShake ? "stage7-wrong-shake" : ""}`}>
        <p className="text-xs text-stone-500 font-serif-elegant italic text-center px-2">
          Watch the 5-star constellation flash, then repeat the pattern!
        </p>

        <div className="relative h-56 sm:h-64 w-full rounded-2xl border border-rose-100 bg-gradient-to-br from-indigo-950/90 to-slate-900 overflow-hidden shadow-inner flex items-center justify-center">
          {/* Star field background */}
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="absolute w-0.5 h-0.5 bg-white/40 rounded-full" style={{ top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 3}s` }} />
          ))}

          <svg className="absolute inset-0 w-full h-full pointer-events-none" fill="none" viewBox="0 0 100 100" preserveAspectRatio="none">
            {unlocked[4] && (
              <polyline
                points={targetSequence.map(n => `${starCoords[n].left.replace("%", "")},${starCoords[n].top.replace("%", "")}`).join(" ")}
                className="stroke-rose-400 stage6-constellation-line"
                style={{ strokeWidth: 2 }}
              />
            )}
            {!unlocked[4] && userInputs.length > 1 && (
              <polyline
                points={userInputs.map(n => `${starCoords[n].left.replace("%", "")},${starCoords[n].top.replace("%", "")}`).join(" ")}
                className="stroke-rose-400/60"
                style={{ strokeWidth: 1.5, strokeDasharray: "3,3" }}
              />
            )}
          </svg>

          {[1, 2, 3, 4, 5].map((nodeNum) => {
            const isFlashing = flashingStar === nodeNum;
            return (
              <button
                key={nodeNum}
                type="button"
                onClick={() => handleStarClick(nodeNum)}
                disabled={playbackActive || unlocked[4]}
                className={`absolute w-11 h-11 sm:w-12 sm:h-12 rounded-full flex flex-col items-center justify-center font-serif-elegant text-sm font-bold shadow-md cursor-pointer select-none transition-all duration-200 ${
                  isFlashing
                    ? "bg-yellow-400 text-white scale-125 shadow-lg shadow-yellow-300/50 stage6-star-flash"
                    : "bg-white/10 border-2 border-white/30 text-white/80 hover:border-white/50 hover:scale-105 stage6-star"
                }`}
                style={{ top: starCoords[nodeNum].top, left: starCoords[nodeNum].left, transform: "translate(-50%, -50%)" }}
              >
                <span>{isFlashing ? "⭐" : "✦"}</span>
                <span className="text-[0.55rem] leading-none opacity-70">{nodeNum}</span>
                {isFlashing && (
                  <span className="absolute inset-0 border-4 border-yellow-300 rounded-full animate-ping pointer-events-none" />
                )}
              </button>
            );
          })}

          {unlocked[4] && (
            <div className="absolute inset-0 bg-indigo-950/60 backdrop-blur-xs flex flex-col items-center justify-center text-center animate-pop">
              <span className="text-5xl animate-bounce">❇️</span>
              <p className="text-sm font-serif-elegant font-bold text-white mt-2">Constellation Completed!</p>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center text-xs font-semibold px-1">
          <span className="text-stone-500">Echoed: {userInputs.length}/5</span>
          <span className="text-rose-500 text-[0.7rem]">{melodyMsg}</span>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  //  STAGE 7 — Wordle Challenge (simple word guess)
  // ═══════════════════════════════════════════════
  function Stage7() {
    const WORDS = ["HEART", "MAGIC", "SMILE", "TRULY", "DREAM", "BLOOM", "WARMY", "CANDY", "PEACH", "SHINE"];
    const targetWord = useMemo(() => WORDS[Math.floor(Math.random() * WORDS.length)], []);
    const [currentGuess, setCurrentGuess] = useState("");
    const [guesses, setGuesses] = useState([]);
    const [feedback, setFeedback] = useState([]);
    const [message, setMessage] = useState("Guess the 5-letter word in 6 tries.");
    const [solved, setSolved] = useState(false);

    function evaluateGuess(guess) {
      const result = Array.from({ length: 5 }, () => "absent");
      const targetLetters = targetWord.split("");

      // mark correct letters first
      guess.split("").forEach((letter, index) => {
        if (targetLetters[index] === letter) {
          result[index] = "correct";
          targetLetters[index] = null;
        }
      });
      // mark present letters next
      guess.split("").forEach((letter, index) => {
        if (result[index] !== "correct") {
          const presentIndex = targetLetters.indexOf(letter);
          if (presentIndex >= 0) {
            result[index] = "present";
            targetLetters[presentIndex] = null;
          }
        }
      });
      return result;
    }

    function handleSubmit() {
      const guess = currentGuess.trim().toUpperCase();
      if (guess.length !== 5) {
        setMessage("Enter exactly 5 letters.");
        return;
      }
      if (guesses.length >= 6 || solved) return;

      const result = evaluateGuess(guess);
      const nextGuesses = [...guesses, guess];
      const nextFeedback = [...feedback, result];
      setGuesses(nextGuesses);
      setFeedback(nextFeedback);
      setCurrentGuess("");

      if (guess === targetWord) {
        setMessage("Perfect! You unlocked the next stage. 💖");
        setSolved(true);
        unlockStage(5, STAGE_KEYS[5]);
        return;
      }

      if (nextGuesses.length >= 6) {
        setMessage(`Out of tries — the word was ${targetWord}. Try again!`);
      } else {
        setMessage(`Keep going — ${6 - nextGuesses.length} guesses left.`);
      }
    }

    function handleInputChange(value) {
      const filtered = value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5);
      setCurrentGuess(filtered);
    }

    return (
      <div className="space-y-3 sm:space-y-4 animate-fade-in-up">
        <p className="text-xs text-stone-500 font-serif-elegant italic text-center px-2">
          Simple Wordle: guess the hidden 5-letter word in 6 tries.
        </p>

        <div className="space-y-3 max-w-md mx-auto">
          <div className="grid gap-2">
            {guesses.map((guess, rowIndex) => (
              <div key={rowIndex} className="grid grid-cols-5 gap-2">
                {guess.split("").map((letter, letterIndex) => (
                  <div key={letterIndex} className={`h-12 flex items-center justify-center rounded-lg font-bold text-sm uppercase border ${
                    feedback[rowIndex][letterIndex] === "correct" ? "bg-emerald-500 text-white border-emerald-500" :
                    feedback[rowIndex][letterIndex] === "present" ? "bg-amber-400 text-white border-amber-400" :
                    "bg-stone-100 text-stone-700 border-stone-200"
                  }`}>
                    {letter}
                  </div>
                ))}
              </div>
            ))}
            {guesses.length < 6 && !solved && (
              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="h-12 flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 text-sm uppercase">
                    {currentGuess[index] || ""}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={currentGuess}
              onChange={(e) => handleInputChange(e.target.value)}
              disabled={solved || guesses.length >= 6}
              maxLength={5}
              className="w-full rounded-2xl border border-stone-200 px-3 py-2 text-sm uppercase tracking-[0.2em] bg-white text-stone-800"
              placeholder="Type a 5-letter word"
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={solved || currentGuess.length !== 5}
              className="rounded-2xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white disabled:bg-stone-300 disabled:text-stone-500"
            >
              Guess
            </button>
          </div>

          <p className="text-xs text-stone-500 text-center">{message}</p>

          {solved && (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-700 text-center">
              Stage complete! The next challenge is now unlocked.
            </div>
          )}

          {!solved && guesses.length >= 6 && (
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-700 text-center">
              You can refresh the page to try again if you want another chance.
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  function Stage8() {
    const targets = useMemo(() => [Math.floor(20 + Math.random() * 60), Math.floor(20 + Math.random() * 60), Math.floor(20 + Math.random() * 60)], []);
    const [s1, setS1] = useState(0);
    const [s2, setS2] = useState(0);
    const [s3, setS3] = useState(0);
    const [progress, setProgress] = useState(0);
    const [locked, setLocked] = useState(false);
    const holdRef = useRef(null);

    const isClose = (value, target) => Math.abs(value - target) <= 4;
    const allAligned = isClose(s1, targets[0]) && isClose(s2, targets[1]) && isClose(s3, targets[2]);
    const statusText = locked
      ? "Locked! Keys acquired."
      : allAligned
        ? "Perfect! Hold all sliders for 2 seconds to unlock."
        : "Move sliders into the target ranges and keep them steady.";

    useEffect(() => {
      if (locked) return;
      if (allAligned) {
        if (!holdRef.current) {
          holdRef.current = setTimeout(() => {
            setLocked(true);
            unlockStage(6, STAGE_KEYS[6]);
          }, 2000);
        }
        setProgress((prev) => Math.min(100, prev + 16));
      } else {
        if (holdRef.current) {
          clearTimeout(holdRef.current);
          holdRef.current = null;
        }
        setProgress((prev) => Math.max(0, prev - 26));
      }

      return () => {
        if (holdRef.current) {
          clearTimeout(holdRef.current);
          holdRef.current = null;
        }
      };
    }, [allAligned, locked]);

    function renderSlider(label, value, onChange, target) {
      const aligned = isClose(value, target);
      return (
        <div className="space-y-2">
          <div className="flex justify-between text-[0.75rem] font-semibold text-stone-600">
            <span>{label}</span>
            <span className={`rounded-full px-2 py-1 text-[0.65rem] ${aligned ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-600"}`}>
              {value}%
            </span>
          </div>
          <div className="flex justify-between text-[0.72rem] text-stone-500">
            <span>Target {target}</span>
            <span>Range ±4</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full"
          />
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-stone-200 bg-white/90 p-4 shadow-sm">
          <p className="text-sm font-semibold text-stone-700 text-center">{statusText}</p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 shadow-sm">
          <div className="h-2 w-full rounded-full bg-stone-200 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-rose-400 to-pink-500 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-[0.72rem] text-stone-500">Stability: {Math.round(progress)}%</p>

          <div className="mt-4 space-y-4">
            {renderSlider("Slider 1", s1, setS1, targets[0])}
            {renderSlider("Slider 2", s2, setS2, targets[1])}
            {renderSlider("Slider 3", s3, setS3, targets[2])}
          </div>
        </div>

        {locked && (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700 text-center">
            All sliders are aligned. Stage unlocked!
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  function Stage9() {
    const realPhotos = useMemo(() => [
      { src: "/img1.jpg", caption: "Playful squishes // 34 months of making faces together 🤪" },
      { src: "/img2.jpg", caption: "Date night smiles // My favorite view in the whole world 💖" },
      { src: "/img3.jpg", caption: "Cozy peace signs // Holding onto you through every season ✌️" },
      { src: "/img4.jpg", caption: "Us lying down side-by-side // Our safe, happy, comfy haven 🌸" },
    ], []);

    // Fire confetti only once when vault first opens — tracked by a ref so it never re-triggers
    const confettiFiredRef = useRef(false);
    useEffect(() => {
      if (loveLetterOpen && !confettiFiredRef.current) {
        confettiFiredRef.current = true;
        setConfetti(generateConfetti());
        setCelebrating(true);
        const timeout = setTimeout(() => setCelebrating(false), 5000);
        return () => clearTimeout(timeout);
      }
    }, [loveLetterOpen]);

    return (
      <div className="space-y-4 animate-fade-in-up">
        {!loveLetterOpen ? (
          <div className="space-y-4 bg-white/50 p-5 sm:p-6 rounded-2xl border border-rose-100 shadow-sm text-center">
            <div className="space-y-2">
              <span className="text-4xl animate-bounce inline-block">🔒</span>
              <h3 className="text-xl font-serif-elegant font-bold text-rose-600">The Master Vault Lock</h3>
              <p className="text-xs text-stone-500 leading-relaxed max-w-sm mx-auto">
                All {STAGE_KEYS.length} stages are unlocked and your keys are complete. Enter the secret phrase to decrypt the sacred vault.
              </p>
              <div className="text-[0.62rem] text-rose-400 font-bold uppercase tracking-wider bg-rose-50/70 p-2.5 rounded-xl border border-rose-100 max-w-xs mx-auto">
                🔑 {STAGE_KEYS.join(' + ')}
              </div>
            </div>

            <div className="space-y-3 text-left">
              <textarea
                value={vaultInput} onChange={(e) => setVaultInput(e.target.value)}
                placeholder="Enter full secret phrase here in lowercase..."
                className="w-full rounded-2xl border border-rose-200 bg-white p-3 text-sm text-stone-700 outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-200/20 font-medium transition shadow-inner resize-none"
                rows={3}
              />
              {vaultError && <p className="text-xs text-rose-500 font-semibold text-center">{vaultError}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={submitVault} className="flex-1 py-3 btn-primary text-sm font-bold cursor-pointer">Decrypt Vault 🔓</button>
                <button type="button" onClick={autoFillVault} className="px-4 py-3 btn-secondary text-sm font-bold cursor-pointer">Keys 🔗</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5 animate-pop">
            <div className="rounded-2xl sm:rounded-3xl bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-100 p-4 sm:p-6 shadow-inner leading-6 text-stone-700 space-y-4">
              <div className="flex items-center gap-2 border-b border-rose-200/50 pb-3">
                <span className="text-2xl">💌</span>
                <h3 className="text-lg sm:text-xl font-serif-elegant font-bold text-rose-600">Our 34-Month Letter</h3>
              </div>
              <p className="text-xs leading-relaxed font-semibold text-rose-800 bg-white p-3 sm:p-4 rounded-2xl border border-rose-100 font-serif-elegant whitespace-pre-line italic">
                {"\"Hey love, its been a while since i made these kinda stuff, eyy english yarn. I just wanna say nga sorry and iloveyou and sorry again and happy motmot, another month another set of away, one thing is for sure, karon kay gatuo kag kalimot ko, pustaan pa nakog 1k charot. Anyways, love, 34months? dugay kaayu na sah imong notes raba ana ka kapoy, well all i can say is, Pakyu pag antos and a happy motmot WHHAHHAHZHHZHHWAHHWHAHAHAHAHA hope na enjoy nimo ako nahimo lovelots and mwa<3\""}
              </p>
              <div className="text-xs text-stone-600 font-serif-elegant italic leading-relaxed space-y-3 pt-2">
                <p>Happy 34th Month of Love, my dearest. Can you believe it's been thirty-four months of endless laughter, late-night talks, reassuring hugs, and yes, our regular dose of sweet arguments ("set of away")? But honestly, each squabble only teaches us how to love each other more patiently.</p>
                <p>We have shared so many gorgeous memories since July 21, 2023. Through all the storms, the jokes, and the quiet mornings, choosing you has been the absolute easiest decision of my life. Thank you for staying, for listening, and for always being my safe space.</p>
                <p>I promise to keep choosing you, to keep annoying you, to keep loving you, and to never forget a single month. Here is to 34 months, and to a lifetime more. Pakyu pag antos, but thank you for being mine. I love you, always and forever. Mwa! 🌸💖</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-stone-500 px-1 border-b border-rose-100 pb-2">
                <span>Sweet Memory Gallery</span>
                <span className="text-[0.65rem] text-emerald-600 font-semibold">4 Moments 🟢</span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {realPhotos.map((item, index) => (
                  <div key={index} className="overflow-hidden rounded-2xl bg-white border border-rose-100 shadow-sm transition hover:scale-[1.02] active:scale-[0.98] flex flex-col">
                    <img src={item.src} alt={item.caption} className="h-28 sm:h-36 w-full object-cover" loading="lazy" />
                    <div className="p-2 border-t border-rose-50 bg-rose-50 flex-1 flex items-center justify-center">
                      <p className="text-[0.58rem] sm:text-[0.62rem] font-serif-elegant font-bold text-rose-700 text-center leading-tight">{item.caption}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  //  LOGIN SCREEN
  // ═══════════════════════════════════════════════
  if (isLocked) {
    return (
      <div className="min-h-screen bg-gradient-to-tr from-rose-50 via-stone-50 to-pink-100 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden select-none" style={{ minHeight: '100dvh' }}>
        {/* Floating particles */}
        <div className="absolute inset-0 pointer-events-none opacity-30">
          {["🌸", "💖", "🌸", "💕", "✨", "🌹"].map((emoji, i) => (
            <div key={i} className="absolute text-3xl sm:text-5xl animate-float" style={{
              top: `${15 + i * 14}%`, left: `${5 + (i * 17) % 80}%`,
              animationDelay: `${i * 0.7}s`, animationDuration: `${4 + i * 0.5}s`
            }}>
              {emoji}
            </div>
          ))}
        </div>

        {/* Login particles */}
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="login-particle bg-rose-300/30" style={{
            width: `${3 + Math.random() * 5}px`, height: `${3 + Math.random() * 5}px`,
            left: `${Math.random() * 100}%`, bottom: `-${Math.random() * 10}%`,
            "--duration": `${6 + Math.random() * 8}s`, "--delay": `${Math.random() * 6}s`
          }} />
        ))}

        <div className={`glass-card max-w-md w-full p-6 sm:p-8 text-center space-y-5 sm:space-y-6 animate-pop ${isWiggling ? "animate-wiggle border-rose-400/50" : ""}`}>
          <div className="space-y-2">
            <span className="text-5xl inline-block animate-float">🗝️</span>
            <h1 className="text-2xl sm:text-3xl font-serif-elegant font-bold text-rose-500">Our Safe Space</h1>
            <p className="text-[0.65rem] tracking-[0.2em] uppercase text-stone-400">Lockscreen Secure Gate</p>
          </div>

          <div className="rounded-2xl bg-rose-50/50 border border-rose-100 p-3 sm:p-4 text-xs leading-relaxed text-rose-600 font-medium">
            🔒 Enter your nickname and our special anniversary date to decrypt and open our secure space.
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4 text-left">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-rose-500 block px-1">Your Nickname</label>
              <input
                type="text" value={nicknameInput} onChange={(e) => setNicknameInput(e.target.value)}
                placeholder="Who is entering? (e.g. Rizza, Elton...)"
                className="w-full px-4 py-3.5 rounded-full border border-rose-200 bg-white/80 focus:border-rose-400 focus:ring-4 focus:ring-rose-200/20 text-sm font-medium text-stone-700 outline-none transition"
                required autoComplete="off"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-rose-500 block px-1">Our Anniversary Date</label>
              <input
                type="text" value={dateInput} onChange={(e) => setDateInput(e.target.value)}
                placeholder="Month Day Year"
                className="w-full px-4 py-3.5 rounded-full border border-rose-200 bg-white/80 focus:border-rose-400 focus:ring-4 focus:ring-rose-200/20 text-sm font-medium text-stone-700 outline-none transition"
                required autoComplete="off"
              />
            </div>
            {dateError && <p className="text-xs text-rose-500 font-semibold text-center">{dateError}</p>}
            <button type="submit" className="w-full py-3.5 btn-primary text-sm font-bold cursor-pointer mt-2">
              Verify & Enter Safe Space
            </button>
          </form>

          <footer className="text-[0.7rem] text-stone-400 font-serif-elegant">
            Always & Forever • Safe Space v3.0
          </footer>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  //  MAIN APP
  // ═══════════════════════════════════════════════
  return (
    <div className="min-h-screen min-h-[100dvh] bg-gradient-to-tr from-rose-50 via-stone-50 to-pink-100 px-3 sm:px-5 py-6 sm:py-8 text-stone-800 relative pb-32 sm:pb-28 select-none" style={{ minHeight: '100dvh' }}>
      {/* Background Music */}
      <BackgroundMusic isPlaying={isMusicPlaying} onToggle={() => setIsMusicPlaying(!isMusicPlaying)} />

      {/* Confetti overlay */}
      {celebrating && !(activeStage === vaultStageNumber || loveLetterOpen) && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          <div className="absolute inset-0 bg-white/20 backdrop-blur-xs flex items-center justify-center animate-pop">
            <div className="glass-card p-5 sm:p-6 border-rose-300/80 bg-white/90 text-center shadow-2xl flex flex-col items-center">
              <span className="text-5xl animate-bounce">👑</span>
              <h3 className="text-lg sm:text-xl font-serif-elegant font-bold text-rose-600 mt-2">Stage Clear!</h3>
              <p className="text-xs text-stone-500 mt-1">Key: <span className="font-bold text-rose-500">{keys[activeStage - 1]}</span></p>
              <span className="text-[0.65rem] text-rose-400 mt-3">Progressing next...</span>
            </div>
          </div>
          {confetti.map((c) => (
            <div key={c.id} className="absolute font-bold pointer-events-none select-none rounded-full"
              style={{ left: `${c.x}%`, top: `${c.y}%`, width: c.size, height: c.size, backgroundColor: c.color, animation: `confetti-fall ${c.duration}s linear infinite`, animationDelay: `${c.delay}s`, transform: `rotate(${c.spin}deg)` }}
            />
          ))}
        </div>
      )}

      {/* Chat Drawer */}
      {isChatDrawerOpen && (
        <>
          <div onClick={() => setIsChatDrawerOpen(false)} className="fixed inset-0 bg-rose-950/20 z-40 transition-opacity animate-pop" />
          <div className="fixed top-0 right-0 h-full w-full sm:w-80 md:w-96 bg-white border-l border-rose-100 shadow-2xl z-50 flex flex-col animate-slide-in" style={{ willChange: "transform" }}>
            <div className="p-4 border-b border-rose-100 flex justify-between items-center bg-gradient-to-r from-rose-50 to-pink-50 safe-area-top">
              <div>
                <h3 className="text-sm font-serif-elegant font-bold text-rose-600">Shared Safe Notes</h3>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className={`w-2 h-2 rounded-full ${isServerConnected ? "bg-emerald-500 animate-pulse" : "bg-yellow-400"}`} />
                  <span className="text-[0.55rem] text-stone-400 uppercase tracking-widest font-semibold">
                    {isServerConnected ? "Connected" : "Local Sync"}
                  </span>
                </div>
              </div>
              <button onClick={() => setIsChatDrawerOpen(false)} className="text-xs text-stone-400 hover:text-rose-500 font-bold border border-stone-200 bg-white rounded-full w-8 h-8 flex items-center justify-center transition active:scale-95">✕</button>
            </div>

            <div className="p-3 bg-rose-50/50 border-b border-rose-100 flex items-center justify-between text-[0.68rem] font-bold">
              <span className="text-stone-500">Active Hearts:</span>
              <div className="flex flex-wrap gap-1.5 justify-end">
                {onlineUsers.length > 0 ? onlineUsers.map((u, i) => (
                  <span key={i} className="px-2.5 py-0.5 bg-emerald-500 text-white rounded-full text-[0.58rem] flex items-center gap-1">🟢 {u.nickname}</span>
                )) : <span className="text-stone-400 italic font-semibold">Just you online</span>}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3" style={{ background: "rgb(255,255,255)", willChange: "transform" }}>
              {chatMessages.map((msg) => {
                if (msg.sender === "System") {
                  return <div key={msg.id} className="text-center text-[0.62rem] text-stone-400 bg-stone-50 border border-stone-100 py-1 px-2 rounded-full max-w-[80%] mx-auto font-medium">{msg.text}</div>;
                }
                const isMe = msg.sender === nickname;
                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                    <span className="text-[0.6rem] text-stone-400 font-bold mb-0.5 px-1">{msg.sender}</span>
                    <div className={`p-2.5 rounded-2xl text-[0.72rem] leading-relaxed max-w-[85%] border shadow-sm ${isMe ? "bg-rose-500 border-rose-500 text-white rounded-tr-sm" : "bg-white border-rose-100 text-stone-700 rounded-tl-sm"}`}>{msg.text}</div>
                    <span className="text-[0.55rem] text-stone-400 mt-0.5 px-1">{msg.timestamp}</span>
                  </div>
                );
              })}
              {partnerTyping && (
                <div className="flex flex-col items-start">
                  <span className="text-[0.6rem] text-rose-400 font-bold mb-0.5 px-1">{nickname.toLowerCase() === "rizza" ? "Elton" : nickname.toLowerCase() === "elton" ? "Rizza" : "My Love"}</span>
                  <div className="p-2.5 bg-white border border-rose-100 rounded-2xl text-[0.72rem] rounded-tl-sm text-rose-400 font-medium italic flex items-center gap-1">
                    <span>typing</span>
                    <span className="animate-bounce">.</span>
                    <span className="animate-bounce" style={{ animationDelay: "0.2s" }}>.</span>
                    <span className="animate-bounce" style={{ animationDelay: "0.4s" }}>.</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={sendChatMessage} className="p-3 border-t border-rose-100 flex gap-2 bg-stone-50 safe-area-bottom">
              <input
                type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                placeholder={`Type as ${nickname}...`}
                className="flex-1 px-4 py-2.5 text-sm rounded-full border border-rose-200 bg-white focus:border-rose-400 focus:outline-none transition shadow-inner font-medium text-stone-700"
              />
              <button type="submit" className="px-5 py-2.5 btn-primary text-sm font-bold leading-none cursor-pointer min-h-[44px]">Send</button>
            </form>
            <div className="p-2 bg-stone-100 border-t border-stone-200 text-center">
              <button onClick={clearChat} type="button" className="text-[0.62rem] text-rose-400 font-bold hover:underline active:scale-95 transition">Clear Chat</button>
            </div>
          </div>
        </>
      )}

      <div className="mx-auto flex max-w-lg flex-col gap-4 sm:gap-6">
        {/* Header */}
        <header className="glass-card p-4 sm:p-6 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-rose-300 via-pink-400 to-rose-300" />

          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.6rem] sm:text-[0.65rem] uppercase tracking-[0.2em] text-rose-400 font-bold truncate">Secure Relationship Pipeline</p>
              <h1 className="mt-0.5 text-xl sm:text-2xl font-serif-elegant font-bold text-rose-600">Our Safe Space</h1>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                onClick={() => setIsChatDrawerOpen(true)}
                className="relative w-10 h-10 rounded-full bg-rose-50 hover:bg-rose-100 border border-rose-100 flex items-center justify-center text-lg active:scale-90 transition cursor-pointer select-none"
                title="Secure Notes"
              >
                💬
                {onlineUsers.length > 0 ? (
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full animate-pulse" />
                ) : (
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-stone-300 border-2 border-white rounded-full" />
                )}
              </button>
              <button
                onClick={() => { sessionStorage.removeItem("safe_space_auth"); sessionStorage.removeItem("nickname"); setIsLocked(true); }}
                className="rounded-full bg-rose-50 hover:bg-rose-100 text-rose-500 text-[0.65rem] sm:text-[0.68rem] px-2.5 sm:px-3 py-2 font-semibold border border-rose-100 transition active:scale-95 cursor-pointer whitespace-nowrap"
              >
                Lock 🔒
              </button>
            </div>
          </div>

          {/* Stage Buttons — scrollable on mobile */}
          <div className="mt-4 sm:mt-5 flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
            {STAGE_KEYS.map((keyName, index) => {
              const isActive = activeStage === index + 1;
              const isCleared = unlocked[index];
              const isAvailable = accessibleStages[index] || isCleared;
              return (
                <button
                  key={index} type="button" onClick={() => handleStageSelect(index)}
                  className={`relative h-10 min-w-[40px] sm:min-w-[44px] flex-1 rounded-xl sm:rounded-2xl text-[0.72rem] font-bold transition flex items-center justify-center cursor-pointer border shrink-0 ${
                    isCleared ? "bg-gradient-to-tr from-rose-400 to-pink-500 text-white border-transparent shadow-md shadow-rose-200/50"
                      : isAvailable ? "bg-white border-rose-200 text-rose-500 hover:bg-rose-50"
                        : "bg-stone-50 border-stone-200 text-stone-300 pointer-events-none"
                  } ${isActive ? "ring-2 ring-rose-400 ring-offset-1" : ""}`}
                  title={keyName}
                >
                  <span>{index + 1}</span>
                  {isCleared && (
                    <span className="absolute -bottom-0.5 -right-0.5 text-[0.5rem] bg-emerald-500 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold shadow-sm">✓</span>
                  )}
                </button>
              );
            })}
            {/* Vault button */}
            <button
              type="button" onClick={() => handleStageSelect(STAGE_KEYS.length)}
              className={`relative h-10 min-w-[40px] sm:min-w-[44px] flex-1 rounded-xl sm:rounded-2xl transition flex items-center justify-center cursor-pointer border shrink-0 ${
                activeStage === vaultStageNumber ? "ring-2 ring-rose-400 ring-offset-1 bg-gradient-to-tr from-rose-400 to-pink-500 text-white border-transparent"
                  : unlocked.every(Boolean) ? "bg-white border-rose-200 text-rose-500 hover:bg-rose-50"
                    : "bg-stone-50 border-stone-200 text-stone-300 pointer-events-none"
              }`}
              title="Master Decrypt Finale"
            >
              <span className="text-xs">{loveLetterOpen ? "🔓" : "🔒"}</span>
            </button>
          </div>

          <div className="mt-3 sm:mt-4 flex items-center justify-between text-[0.62rem] sm:text-[0.68rem] font-semibold text-stone-500 bg-rose-50/50 rounded-xl p-2 sm:p-2.5 border border-rose-100/50">
            <span className="shrink-0">Keys:</span>
            <span className="text-rose-600 font-serif-elegant italic tracking-wide truncate ml-2 text-right">
              {keys.map((k, i) => k ? k : `[${i + 1}]`).join(" • ")}
            </span>
          </div>
        </header>

        {/* Active Stage Card */}
        <section className="glass-card p-4 sm:p-6 space-y-3 sm:space-y-4">
          <div className="flex justify-between items-center text-xs font-semibold text-rose-500 border-b border-rose-100 pb-2 sm:pb-3">
            <span className="uppercase tracking-[0.1em]">
              {activeStage === vaultStageNumber ? "Master Finale" : `Stage ${activeStage}/${STAGE_KEYS.length}`}
            </span>
            <span className="text-right">
              {activeStage === vaultStageNumber
                ? (loveLetterOpen ? "🔓 Open" : "🔒 Locked")
                : unlocked[activeStage - 1] ? "✨ Acquired" : "🔑 In Progress"}
            </span>
          </div>

          {activeStage === 1 && <Stage1 />}
          {activeStage === 2 && <Stage2 />}
          {activeStage === 3 && <Stage3 />}
          {activeStage === 4 && <Stage4 />}
          {activeStage === 5 && <Stage6 />}
          {activeStage === 6 && <Stage7 />}
          {activeStage === 7 && <Stage8 />}
          {activeStage === vaultStageNumber && <Stage9 />}
        </section>
      </div>

      {/* Floating Guide Bar */}
      <div className="fixed bottom-4 sm:bottom-6 left-1/2 z-40 w-[calc(100%-2rem)] sm:w-full max-w-md -translate-x-1/2">
        <div className="flex items-center gap-2 sm:gap-3 rounded-full border border-rose-200 bg-white/95 p-3 sm:p-3.5 shadow-2xl shadow-rose-200/50 backdrop-blur-md">
          <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-rose-400 to-pink-500 text-base sm:text-lg font-serif-elegant font-bold text-white shadow-md">
            🌸
          </div>
          <div className="flex-1 text-[0.68rem] sm:text-[0.72rem] leading-relaxed font-semibold text-stone-600 max-h-10 overflow-y-auto min-w-0">
            {guideMessage}
          </div>
          <div className="text-right text-[0.55rem] sm:text-[0.62rem] leading-none shrink-0 font-bold border-l border-rose-100 pl-2 sm:pl-3">
            <p className="text-rose-400 uppercase tracking-widest">Guide</p>
            <p className="text-stone-400 mt-1">{loveLetterOpen ? "Decrypted" : unlocked.every(Boolean) ? "Keys Done" : "Active"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Wrap entire app with error boundary for mobile resilience
export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
