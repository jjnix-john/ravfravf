import React, { useEffect, useMemo, useRef, useState } from "react";

const PHRASE = "always choose you no matter what happens next";
const STAGE_KEYS = ["ALWAYS", "CHOOSE", "YOU", "NO", "MATTER", "WHAT", "HAPPENS NEXT"];

// Helper for stage success confetti particles
function generateConfetti() {
  return Array.from({ length: 50 }).map((_, idx) => ({
    id: idx,
    x: Math.random() * 100, // percentage
    y: -10 - Math.random() * 20,
    size: Math.random() * 8 + 6,
    color: ["#fb7185", "#f43f5e", "#fda4af", "#f472b6", "#ec4899", "#fbcfe8", "#fbbf24"][Math.floor(Math.random() * 7)],
    delay: Math.random() * 2,
    duration: Math.random() * 3 + 2,
    spin: Math.random() * 360,
  }));
}

// Normalize anniversary input for robust validation
function validateAnniversaryDate(input) {
  const normalized = input.toLowerCase().replace(/[^a-z0-9]/g, "");
  const validCombinations = [
    "july212023",
    "7212023",
    "07212023",
    "20230721",
    "21july2023",
    "2172023",
    "21072023"
  ];
  return validCombinations.includes(normalized);
}

export default function App() {
  // Unique Session ID for cross-tab presence tracking
  const mySessionId = useMemo(() => Math.random().toString(36).substring(2, 9), []);

  // Authentication & Gatekeeping
  const [isLocked, setIsLocked] = useState(() => {
    return sessionStorage.getItem("safe_space_auth") !== "true";
  });
  const [nicknameInput, setNicknameInput] = useState("");
  const [nickname, setNickname] = useState(() => {
    return sessionStorage.getItem("nickname") || "";
  });
  const [dateInput, setDateInput] = useState("");
  const [dateError, setDateError] = useState("");
  const [isWiggling, setIsWiggling] = useState(false);

  // App States
  const [activeStage, setActiveStage] = useState(1);
  const [unlocked, setUnlocked] = useState(Array(7).fill(false));
  const [keys, setKeys] = useState(Array(7).fill(null));
  const [guideMessage, setGuideMessage] = useState("Welcome to our safe space. Let's begin the journey.");
  
  // Transition & Success celebration
  const [celebrating, setCelebrating] = useState(false);
  const [confetti, setConfetti] = useState([]);

  // Vault decryption
  const [vaultInput, setVaultInput] = useState("");
  const [vaultError, setVaultError] = useState("");
  const [loveLetterOpen, setLoveLetterOpen] = useState(false);

  // Messaging (Real-time Database + WebSockets + Drawer + Local Fallback)
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

  // Accessible stages memo
  const accessibleStages = useMemo(() => {
    const access = [true];
    for (let i = 1; i < 7; i += 1) {
      access.push(unlocked[i - 1]);
    }
    return access;
  }, [unlocked]);

  // Unified WebSockets (Real backend) + BroadcastChannel (Local tab fallback)
  const broadcastChannelRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (isLocked || !nickname) return;

    // 1. Initialize local broadcast fallback
    const localChannel = new BroadcastChannel("safe-space-fallback-channel");
    broadcastChannelRef.current = localChannel;

    localChannel.onmessage = (event) => {
      // If server is not connected, use local BroadcastChannel for tab syncing
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
    };

    // 2. Initialize real WebSocket connection with auto-reconnection loop
    let socket = null;
    let reconnectTimeout = null;
    let isReconnecting = false;

    function connectToServer() {
      if (isLocked || !nickname) return;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);

      const wsUrl = `ws://${window.location.hostname}:3001`;
      socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log("Connected to local backend database WS server.");
        setIsServerConnected(true);
        isReconnecting = false;

        // Register presence on the server
        socket.send(
          JSON.stringify({
            type: "IDENTIFY",
            payload: { nickname, sessionId: mySessionId }
          })
        );

        // Pull fresh message history from express API database
        fetch(`http://${window.location.hostname}:3001/api/messages`)
          .then((res) => res.json())
          .then((data) => {
            setChatMessages(data);
            localStorage.setItem("safe_space_chat", JSON.stringify(data));
          })
          .catch((err) => console.log("CORS API fetch history error, using local fallback."));
      };

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          const { type, payload } = parsed;

          if (type === "PRESENCE_UPDATE") {
            // Exclude ourselves from the online presence list
            const others = payload.onlineUsers.filter((u) => u.sessionId !== mySessionId);
            setOnlineUsers(others);
          } else if (type === "CHAT_MESSAGE") {
            setChatMessages((prev) => {
              const next = [...prev, payload.message];
              localStorage.setItem("safe_space_chat", JSON.stringify(next));
              return next;
            });
          }
        } catch (err) {
          console.error("WS parse error:", err);
        }
      };

      socket.onclose = () => {
        console.log("WS server closed. Falling back to local browser sync. Retrying in 5s...");
        setIsServerConnected(false);
        
        // Trigger fallback presence ping to neighboring tabs
        localChannel.postMessage({
          type: "FALLBACK_PING",
          payload: { nickname, sessionId: mySessionId }
        });

        if (!isReconnecting) {
          isReconnecting = true;
          reconnectTimeout = setTimeout(() => {
            connectToServer();
          }, 5000);
        }
      };
    }

    connectToServer();

    // Fallback arrival broadcast in case server is down initially
    localChannel.postMessage({
      type: "FALLBACK_PING",
      payload: { nickname, sessionId: mySessionId }
    });

    const handleExit = () => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
      localChannel.postMessage({
        type: "FALLBACK_EXIT",
        payload: { sessionId: mySessionId }
      });
    };

    window.addEventListener("beforeunload", handleExit);

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      handleExit();
      window.removeEventListener("beforeunload", handleExit);
      if (socket) socket.close();
      localChannel.close();
    };
  }, [isLocked, nickname, mySessionId]);

  // Handle stage unlocking & progression
  function unlockStage(index, keyword) {
    if (unlocked[index]) return;

    setUnlocked((prev) => {
      const next = [...prev];
      next[index] = true;
      return next;
    });

    setKeys((prev) => {
      const next = [...prev];
      next[index] = keyword;
      return next;
    });

    // Trigger celebration effects
    setConfetti(generateConfetti());
    setCelebrating(true);
    setGuideMessage(`Perfect! Stage ${index + 1} complete. Key "${keyword}" acquired.`);

    // Proceed to next stage automatically
    setTimeout(() => {
      setCelebrating(false);
      setActiveStage(index + 2); // Stage 1 (idx 0) -> Stage 2, Stage 7 (idx 6) -> Stage 8
    }, 2200);
  }

  // Update Guide Messages on active stage change
  useEffect(() => {
    if (isLocked) return;
    if (activeStage === 8) {
      const isVaultTimePassed = Date.now() >= new Date("2026-07-23T00:00:00").getTime();
      setGuideMessage(loveLetterOpen ? (isVaultTimePassed ? "Master Vault Unlocked. Happy 34 Months of Love! 🌸" : "Vault Decrypted! But our memories are locked in a time capsule. ⏳") : "Stage 8 // Enter the Master Vault secret phrase to decrypt the sacred letters.");
      return;
    }

    const messages = {
      1: "HARD MODE: Click the shrinking heart as it speeds up! Don't let the 10s timer hit 0!",
      2: "HARD MODE: Find matching pairs under 8 wrong match attempts, or they re-shuffle!",
      3: "HARD MODE: Tune frequency & rotational offset together until both waves overlap into a heart!",
      4: "HARD MODE: Catch 8 rising bubble hearts, but avoid the Broken Hearts or Stormy Clouds!",
      5: "HARD MODE: Hold the slider precisely on Day 21 for 3 continuous seconds while it drifts!",
      6: "HARD MODE: Echo the melody pattern! Watch the stars flash, and repeat the 5-step sequence!",
      7: "HARD MODE: Connection trivia. Miss a single question, and the whole quiz resets!",
    };

    setGuideMessage(`Stage ${activeStage} // ${messages[activeStage] ?? "Let's proceed with love."}`);
  }, [activeStage, loveLetterOpen, isLocked]);

  // Login submission
  function handleLoginSubmit(e) {
    e.preventDefault();
    const formattedNick = nicknameInput.trim();
    if (!formattedNick) {
      setDateError("Please enter a nickname first.");
      return;
    }
    
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

  // Stage select handler
  function handleStageSelect(index) {
    const isVault = index === 7;
    if (isVault) {
      if (unlocked.every(Boolean)) {
        setActiveStage(8);
        setCelebrating(false);
      } else {
        setGuideMessage("The Master Vault is sealed. Collect all 7 keys first!");
      }
      return;
    }

    if (accessibleStages[index] || unlocked[index]) {
      setActiveStage(index + 1);
      setCelebrating(false);
    } else {
      setGuideMessage("This stage is currently locked. Complete previous stages to advance.");
    }
  }

  // Vault decryption
  function submitVault() {
    const candidate = vaultInput.trim().toLowerCase();
    if (!candidate) {
      setVaultError("Please type the secret phrase.");
      return;
    }
    // Forgiving match
    if (candidate === PHRASE || candidate.replace(/[^a-z]/g, "") === PHRASE.replace(/[^a-z]/g, "")) {
      setLoveLetterOpen(true);
      setVaultError("");
      setGuideMessage("Vault decrypted! Happy 34th Month of Love. Scroll to read.");
    } else {
      setVaultError("Secret phrase is incorrect. Check your keys and spacing!");
    }
  }

  function autoFillVault() {
    if (unlocked.every(Boolean)) {
      setVaultInput(PHRASE);
      setVaultError("");
    } else {
      setVaultError("Unlock all 7 stages first to acquire all keys!");
    }
  }

  // Sending chat messages
  function sendChatMessage(e) {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const newMsg = {
      id: Date.now(),
      sender: nickname,
      text: chatInput.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // 1. Send via WebSocket if server is connected
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "CHAT_MESSAGE",
          payload: { message: newMsg }
        })
      );
      
      // Post to local server HTTP endpoint to save in local db.json
      fetch(`http://${window.location.hostname}:3001/api/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMsg)
      }).catch((err) => console.log("Error posting message to backend database."));
    } else {
      // 2. Local Fallback sync via BroadcastChannel
      const updated = [...chatMessages, newMsg];
      setChatMessages(updated);
      localStorage.setItem("safe_space_chat", JSON.stringify(updated));

      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage({
          type: "FALLBACK_CHAT_MESSAGE",
          payload: { message: newMsg }
        });
      }

      // Auto responder when alone locally
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
            "My heart is completely yours. Thank you for this gorgeous safe space. 🌙",
            "Thinking of you right now and wishing we were holding hands. 🥂",
          ];
          const randomResponseText = responses[Math.floor(Math.random() * responses.length)];
          const responseMsg = {
            id: Date.now() + 1,
            sender: nickname.toLowerCase() === "rizza" ? "Elton" : nickname.toLowerCase() === "elton" ? "Rizza" : "My Love",
            text: randomResponseText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };

          const finalMessages = [...updated, responseMsg];
          setChatMessages(finalMessages);
          localStorage.setItem("safe_space_chat", JSON.stringify(finalMessages));
        }, 1500);
      }
    }

    setChatInput("");
  }

  // Clear messages handler
  function clearChat() {
    // Try server clear
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      fetch(`http://${window.location.hostname}:3001/api/messages`, {
        method: "DELETE"
      })
        .then((res) => res.json())
        .then((data) => {
          setChatMessages(data.messages);
          localStorage.setItem("safe_space_chat", JSON.stringify(data.messages));
        })
        .catch(() => clearLocalChatOnly());
    } else {
      clearLocalChatOnly();
    }
  }

  function clearLocalChatOnly() {
    const reset = [
      { id: 1, sender: "System", text: "Chat history cleared with love.", timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ];
    setChatMessages(reset);
    localStorage.setItem("safe_space_chat", JSON.stringify(reset));
  }

  // --- STAGE COMPONENTS (HARD MODE IMPLEMENTATION) ---

  // Stage 1: Speeding Bouncing Target Clicker with 10s Timer & Shrinking Sizes
  function Stage1() {
    const containerRef = useRef(null);
    const [hits, setHits] = useState(0);
    const [pos, setPos] = useState({ top: "50%", left: "50%" });
    const [timeLeft, setTimeLeft] = useState(10);
    const [bursts, setBursts] = useState([]);
    const [heartMsg, setHeartMsg] = useState("Catch the shrinking heart! ⏱️");
    const [gameOver, setGameOver] = useState(false);
    const [shakeKey, setShakeKey] = useState(0);

    // Bouncing heart shrinking sizes
    const currentSize = useMemo(() => {
      return Math.max(28, 64 - hits * 8); // shrinks on each click!
    }, [hits]);

    // Timer countdown loop
    useEffect(() => {
      if (hits >= 5 || gameOver) return;
      if (timeLeft <= 0) {
        setGameOver(true);
        setHeartMsg("Sparks faded! Too slow, my love! 💔");
        setShakeKey((prev) => prev + 1);
        return;
      }

      const timer = setTimeout(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);

      return () => clearTimeout(timer);
    }, [timeLeft, hits, gameOver]);

    useEffect(() => {
      setPos(randomPosition(containerRef.current));
    }, []);

    // Active Teleportation: Heart jumps automatically if not clicked fast enough!
    useEffect(() => {
      if (hits >= 5 || gameOver) return;
      
      const intervalMs = Math.max(450, 1000 - hits * 110);
      const timer = setInterval(() => {
        setPos(randomPosition(containerRef.current));
      }, intervalMs);

      return () => clearInterval(timer);
    }, [hits, gameOver]);

    useEffect(() => {
      if (hits >= 5) unlockStage(0, STAGE_KEYS[0]);
    }, [hits]);

    function randomPosition(container) {
      if (!container) return { left: "50%", top: "50%" };
      const { offsetWidth: width, offsetHeight: height } = container;
      const margin = 40;
      const left = Math.max(margin, Math.min(width - margin, Math.floor(Math.random() * (width - margin * 2) + margin)));
      const top = Math.max(margin, Math.min(height - margin, Math.floor(Math.random() * (height - margin * 2) + margin)));
      return { left: `${left}px`, top: `${top}px` };
    }

    function handleHit(e) {
      if (hits >= 5 || gameOver) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      setBursts((prev) => [...prev, { id: Date.now(), x: clickX, y: clickY }]);

      const newHits = hits + 1;
      setHits(newHits);

      const phrases = [
        "Good click! 🌸",
        "Shrinking! 🧸",
        "Getting faster! ⚡",
        "Tiny heart! 🔍",
        "Spark Locked! 🎉"
      ];
      setHeartMsg(phrases[newHits - 1]);

      if (newHits < 5) {
        setPos(randomPosition(containerRef.current));
      }
    }

    function resetGame() {
      setHits(0);
      setTimeLeft(10);
      setGameOver(false);
      setHeartMsg("Catch the shrinking heart! ⏱️");
      setPos(randomPosition(containerRef.current));
    }

    return (
      <div className={`space-y-4 animate-pop ${gameOver ? "animate-wiggle" : ""}`} key={shakeKey}>
        <div className="flex justify-between items-center text-xs font-bold text-rose-500">
          <span>Clicks Captured: {hits}/5</span>
          <span className={timeLeft < 4 ? "text-rose-600 animate-pulse font-bold" : "text-stone-500"}>
            Time Left: {timeLeft}s ⏳
          </span>
        </div>

        <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
          <div className="bg-rose-500 h-1.5 transition-all duration-1000" style={{ width: `${(timeLeft / 10) * 100}%` }}></div>
        </div>

        <div ref={containerRef} className="relative h-56 overflow-hidden rounded-3xl border border-rose-100 bg-gradient-to-b from-rose-50/50 to-pink-50/50 shadow-inner">
          {!gameOver && hits < 5 ? (
            <button
              type="button"
              onClick={handleHit}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 text-white shadow-lg flex items-center justify-center transition-all duration-75 select-none cursor-pointer border border-white"
              style={{
                left: pos.left,
                top: pos.top,
                width: `${currentSize}px`,
                height: `${currentSize}px`,
                fontSize: `${currentSize * 0.55}px`
              }}
              aria-label="moving shrinking heart"
            >
              ❤️
            </button>
          ) : hits >= 5 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center space-y-1">
              <span className="text-4xl animate-bounce">💖</span>
              <p className="text-sm font-serif-elegant font-bold text-rose-500">Love Spark Ignited!</p>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center space-y-2 bg-rose-50/40">
              <span className="text-4xl">💔</span>
              <p className="text-xs font-bold text-rose-600">Time expired! Let's rekindle the fire.</p>
              <button onClick={resetGame} type="button" className="px-4 py-1.5 bg-rose-500 text-white rounded-full text-xs font-semibold shadow hover:bg-rose-600 transition">
                Retry Sparks
              </button>
            </div>
          )}

          {/* Render particle bursts */}
          {bursts.map((burst) => (
            <div key={burst.id} className="absolute pointer-events-none text-2xl animate-burst" style={{ left: burst.x, top: burst.y }}>
              🌸
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center text-[0.65rem] text-stone-400">
          <span>*Heart shrinks with each hit</span>
          <button type="button" onClick={resetGame} className="text-rose-400 hover:text-rose-500 font-semibold hover:underline">
            Reset Stage
          </button>
        </div>
      </div>
    );
  }

  // Stage 2: 12-Card (6 pairs) Memory Puzzle with strict Match Limits
  function Stage2() {
    const emojis = useMemo(() => ["💖", "🌹", "🧸", "🥂", "🌸", "💫"], []);
    const initialCards = useMemo(() => {
      const doubled = [...emojis, ...emojis];
      return shuffle(doubled).map((emoji, idx) => ({
        id: idx,
        emoji,
        flipped: false,
        matched: false
      }));
    }, [emojis]);

    const [cards, setCards] = useState(initialCards);
    const [wrongAttempts, setWrongAttempts] = useState(0);
    const [wigglingIds, setWigglingIds] = useState([]);
    const [stageState, setStageState] = useState("playing"); // playing, failed, completed
    const lockRef = useRef(false);

    useEffect(() => {
      if (cards.every((card) => card.matched)) {
        unlockStage(1, STAGE_KEYS[1]);
        setStageState("completed");
      }
    }, [cards]);

    function shuffle(array) {
      return [...array].sort(() => Math.random() - 0.5);
    }

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
              setCards((current) =>
                current.map((card) =>
                  card.id === first.id || card.id === second.id ? { ...card, matched: true } : card
                )
              );
              lockRef.current = false;
            }, 400);
          } else {
            // Mismatch
            setTimeout(() => {
              setWigglingIds([first.id, second.id]);
              const nextAttempts = wrongAttempts + 1;
              setWrongAttempts(nextAttempts);

              setTimeout(() => {
                setWigglingIds([]);
                setCards((current) =>
                  current.map((card) =>
                    card.id === first.id || card.id === second.id ? { ...card, flipped: false } : card
                  )
                );
                
                if (nextAttempts >= 8) {
                  // Failed game!
                  setStageState("failed");
                }
                lockRef.current = false;
              }, 400);
            }, 600);
          }
        }
        return next;
      });
    }

    function resetGrid() {
      setCards(shuffle([...emojis, ...emojis]).map((emoji, idx) => ({
        id: idx,
        emoji,
        flipped: false,
        matched: false
      })));
      setWrongAttempts(0);
      setStageState("playing");
    }

    return (
      <div className="space-y-4 animate-pop">
        <div className="flex justify-between items-center text-xs font-bold text-rose-500">
          <span>Failed Attempts: {wrongAttempts}/8</span>
          <span className={8 - wrongAttempts <= 2 ? "text-rose-600 animate-pulse" : "text-stone-500"}>
            Mismatches Remaining: {8 - wrongAttempts}
          </span>
        </div>

        {stageState === "failed" ? (
          <div className="rounded-3xl bg-rose-50/50 border border-rose-100 p-6 text-center space-y-3 animate-wiggle">
            <span className="text-4xl">🧩</span>
            <h4 className="text-sm font-serif-elegant font-bold text-rose-600">Memory Overloaded!</h4>
            <p className="text-xs text-stone-500">Our symbol coordinates shuffled! Let's retry together.</p>
            <button onClick={resetGrid} type="button" className="px-4 py-2 btn-primary text-xs font-semibold">
              Re-shuffle Cards
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2.5 max-w-xs mx-auto perspective-1000">
            {cards.map((card) => {
              const isWiggling = wigglingIds.includes(card.id);
              return (
                <div
                  key={card.id}
                  className={`relative h-16 w-full transition-transform duration-500 transform-style-3d cursor-pointer select-none ${card.flipped || card.matched ? "rotate-y-180" : ""} ${isWiggling ? "animate-wiggle" : ""}`}
                  onClick={() => flipCard(card.id)}
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-rose-100 to-rose-200 border border-white rounded-xl flex items-center justify-center shadow-sm backface-hidden text-rose-400 font-bold text-lg hover:shadow transition">
                    🌸
                  </div>
                  <div className="absolute inset-0 bg-white border border-rose-200 rounded-xl flex items-center justify-center shadow-inner backface-hidden rotate-y-180 text-2xl">
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

  // Stage 3: Love Alignment - Double wave generator (Frequency + Phase slider overlapping graph)
  function Stage3() {
    const [freq, setFreq] = useState(1);
    const [phase, setPhase] = useState(0);
    const [aligned, setAligned] = useState(false);

    const closeness = useMemo(() => {
      const freqDiff = Math.abs(freq - 3) / 4; // range is 1 to 5 (max diff 4)
      const phaseDiff = Math.abs(phase - 14) / 25; // range is 0 to 25 (max diff 25)
      return 1 - (freqDiff + phaseDiff) / 2;
    }, [freq, phase]);

    // Target values for perfect waves overlap: Freq = 3, Phase = 14
    useEffect(() => {
      if (freq === 3 && phase === 14) {
        setAligned(true);
        unlockStage(2, STAGE_KEYS[2]);
      } else {
        setAligned(false);
      }
    }, [freq, phase]);

    // Wave visualizers using pure SVG paths
    const drawWave = (frequency, phaseOffset, amplitude = 25) => {
      return Array.from({ length: 120 }).map((_, x) => {
        const rad = (x / 120) * frequency * 2 * Math.PI + (phaseOffset * 0.35);
        const y = 50 + Math.sin(rad) * amplitude;
        return `${x === 0 ? "M" : "L"} ${(x / 120) * 280} ${y}`;
      }).join(" ");
    };

    return (
      <div className="space-y-4 animate-pop">
        <p className="text-xs text-stone-500 font-serif-elegant italic text-center">
          Overlap the two energetic waveforms. Tuner: Frequency = 3, Phase Alignment = 14.
        </p>

        {/* Dynamic Wave Oscilloscope graph screen */}
        <div className="relative h-28 w-full bg-stone-950 border-2 border-rose-200 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center">
          <svg className="w-full h-full" viewBox="0 0 280 100">
            {/* Grid background */}
            <path d="M 0 50 L 280 50 M 70 0 L 70 100 M 140 0 L 140 100 M 210 0 L 210 100" className="stroke-stone-900 stroke-1" strokeDasharray="3,3" />

            {/* Closeness-based Pulsing SVG Heart */}
            <path
              d="M 140 68 C 130 53, 115 48, 115 33 C 115 20, 130 20, 140 31 C 150 20, 165 20, 165 33 C 165 48, 150 53, 140 68 Z"
              fill={aligned ? "#f59e0b" : "#f43f5e"}
              className={`transition-all duration-300 ${aligned ? "stroke-yellow-400 stroke-2 fill-yellow-400/90 animate-pulse" : ""}`}
              style={{
                transform: `scale(${0.5 + closeness * 0.5})`,
                transformOrigin: "140px 45px",
                opacity: 0.12 + closeness * 0.78,
                filter: `drop-shadow(0 0 ${closeness * 10}px ${aligned ? "rgba(251, 191, 36, 0.8)" : "rgba(244, 63, 94, 0.7)"})`
              }}
            />

            {/* Target waveform (Pulse of Love) */}
            <path
              d={drawWave(3, 14, 25)}
              fill="none"
              className={`stroke-2 transition-all duration-300 ${aligned ? "stroke-yellow-400 stroke-3 animate-pulse" : "stroke-rose-300/40"}`}
            />

            {/* User waveform (Calibration stream) */}
            {!aligned && (
              <path
                d={drawWave(freq, phase, 25)}
                fill="none"
                className="stroke-rose-500 stroke-2"
              />
            )}
          </svg>
          
          {aligned && (
            <div className="absolute inset-0 bg-rose-500/10 backdrop-blur-[0.5px] flex items-center justify-center text-center animate-pop">
              <span className="text-yellow-400 text-3xl animate-bounce">💖 Waveforms Merged! 👑</span>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <div className="flex justify-between text-[0.7rem] font-bold text-stone-500">
              <span>Frequency Modulation (Target: 3)</span>
              <span className="text-rose-500">{freq} Hz</span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={freq}
              onChange={(e) => setFreq(Number(e.target.value))}
              className="w-full accent-rose-500"
              disabled={aligned}
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[0.7rem] font-bold text-stone-500">
              <span>Phase Rotation (Target: 14)</span>
              <span className="text-rose-500">Offset {phase}</span>
            </div>
            <input
              type="range"
              min="0"
              max="25"
              step="1"
              value={phase}
              onChange={(e) => setPhase(Number(e.target.value))}
              className="w-full accent-rose-500"
              disabled={aligned}
            />
          </div>
        </div>

        <div className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-100 text-center text-2xl font-serif-elegant font-bold tracking-[0.3em] text-rose-500">
          {aligned ? "SACRED" : "ALIGNING..."}
        </div>
      </div>
    );
  }

  // Stage 4: Bubble Catcher with Falling Stormy distractors
  function Stage4() {
    const [score, setScore] = useState(0);
    const [items, setItems] = useState([]);
    const intervalRef = useRef(null);
    const containerRef = useRef(null);
    const [wrongTaps, setWrongTaps] = useState(0);

    useEffect(() => {
      if (score >= 8) return;
      intervalRef.current = window.setInterval(() => {
        const isDistractor = Math.random() > 0.65; // Spawns storm/broken hearts
        const itemId = Date.now() + Math.random();
        setItems((prev) => [
          ...prev,
          {
            id: itemId,
            left: Math.random() * 85 + 5,
            speed: Math.random() * 1.2 + 1.1, // speeds up slightly
            scale: Math.random() * 0.3 + 0.8,
            symbol: isDistractor ? ["💔", "🌧️"][Math.floor(Math.random() * 2)] : ["❤️", "💖", "🌸", "💕"][Math.floor(Math.random() * 4)],
            isDistractor,
            popped: false
          }
        ]);

        // Auto-cleanup after 3 seconds to prevent memory leaks and state bloat
        setTimeout(() => {
          setItems((prev) => prev.filter((item) => item.id !== itemId));
        }, 3000);
      }, 900);

      return () => window.clearInterval(intervalRef.current);
    }, [score]);

    useEffect(() => {
      if (score >= 8) unlockStage(3, STAGE_KEYS[3]);
    }, [score]);

    function popItem(id, isDistractor) {
      if (score >= 8) return;
      
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, popped: true } : item))
      );

      if (isDistractor) {
        setWrongTaps((prev) => prev + 1);
        setScore((s) => Math.max(0, s - 2)); // Heavy penalty for broken hearts!
      } else {
        setScore((s) => Math.min(8, s + 1));
      }

      setTimeout(() => {
        setItems((prev) => prev.filter((item) => item.id !== id));
      }, 400);
    }

    return (
      <div className="space-y-4 animate-pop">
        <div className="flex justify-between items-center text-xs font-bold text-rose-500">
          <span>Captured Emitters: {score}/8</span>
          <span className="text-[0.68rem] text-rose-400 animate-pulse font-semibold">
            {wrongTaps > 0 ? `*Avoid 💔/🌧️ (Penalty -2 score!)` : "Pop positive hearts!"}
          </span>
        </div>

        <div ref={containerRef} className="relative h-60 overflow-hidden rounded-3xl border border-rose-100 bg-gradient-to-b from-rose-50/20 to-rose-100/20 shadow-inner">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => popItem(item.id, item.isDistractor)}
              className={`absolute bottom-0 text-3xl select-none cursor-pointer flex items-center justify-center transition-all duration-300 leading-none ${item.popped ? "scale-[2.2] opacity-0 font-bold" : "hover:scale-110 active:scale-90 animate-bubble"}`}
              style={{
                left: `${item.left}%`,
                transform: `scale(${item.scale})`,
                animation: `float-up-fast ${item.speed}s linear forwards`
              }}
              aria-label="bubble catcher target"
            >
              {item.popped ? (item.isDistractor ? "💥" : "✨") : item.symbol}
            </button>
          ))}
          {score >= 8 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center bg-white/70 backdrop-blur-sm animate-pop">
              <span className="text-4xl text-rose-500">🎈</span>
              <p className="text-sm font-serif-elegant font-bold text-rose-500 mt-1">Emitter game complete!</p>
            </div>
          )}
        </div>

        <style>{`
          @keyframes float-up-fast {
            0% { transform: translateY(0) rotate(0deg); opacity: 0.9; }
            100% { transform: translateY(-290px) rotate(20deg); opacity: 0; }
          }
        `}</style>
      </div>
    );
  }

  // Stage 5: Calibration Slider with Natural Drift Physics & 3-second holds
  function Stage5() {
    const [day, setDay] = useState(1);
    const [calibrationProgress, setCalibrationProgress] = useState(0);
    const [completed, setCompleted] = useState(false);

    // Gravity slide drift logic: pushes the slider off Day 21 randomly!
    useEffect(() => {
      if (completed) return;
      const interval = setInterval(() => {
        // Only nudge if they are near 21 to create active balancing
        const diff = Math.abs(day - 21);
        if (diff <= 5) {
          const nudge = Math.random() > 0.5 ? 1 : -1;
          setDay((prev) => {
            const next = prev + nudge;
            return Math.max(1, Math.min(31, next));
          });
        }
      }, 350);
      return () => clearInterval(interval);
    }, [day, completed]);

    // Progress validation hold loop
    useEffect(() => {
      if (completed) return;

      const holdInterval = setInterval(() => {
        if (day === 21) {
          setCalibrationProgress((prev) => {
            const next = prev + 8; // takes ~12 ticks (~1.5s hold)
            if (next >= 100) {
              setCompleted(true);
              unlockStage(4, STAGE_KEYS[4]);
              return 100;
            }
            return next;
          });
        } else {
          // Swift drain if drifted off!
          setCalibrationProgress((prev) => Math.max(0, prev - 15));
        }
      }, 150);

      return () => clearInterval(holdInterval);
    }, [day, completed]);

    const displayMilestone = useMemo(() => {
      if (day === 21) return "Our Magical Anniversary! Hold steady at 21 to lock! ⏱️";
      if (day < 5) return `Day ${day}: Sparks settling in.`;
      if (day < 10) return `Day ${day}: Building our unique bridge of trust.`;
      if (day < 15) return `Day ${day}: Exploring our common dreams and hopes.`;
      if (day < 21) return `Day ${day}: Unfolding complete honesty, hearts wide open.`;
      return `Day ${day}: Safely wrapped in the warmth of our universe.`;
    }, [day]);

    return (
      <div className="space-y-4 animate-pop">
        <p className="text-xs text-stone-500 font-serif-elegant italic text-center">
          Natural gravity force active! Hold the slider **precisely on Day 21 for 3s** to calibrate.
        </p>

        <div className="py-6 px-4 rounded-3xl bg-gradient-to-br from-rose-50/50 to-pink-50/50 border border-rose-100/80 shadow-sm min-h-24 flex items-center justify-center">
          <p className="text-center font-serif-elegant font-medium text-rose-700 leading-relaxed text-sm animate-pop" key={day}>
            {displayMilestone}
          </p>
        </div>

        {/* Calibration hold progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[0.62rem] font-bold text-stone-400">
            <span>Calibration Lock:</span>
            <span className="text-rose-500 font-semibold">{calibrationProgress}%</span>
          </div>
          <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden border border-stone-200">
            <div className="bg-gradient-to-r from-yellow-400 to-rose-500 h-2 transition-all duration-100" style={{ width: `${calibrationProgress}%` }}></div>
          </div>
        </div>

        <div className="space-y-2">
          <input
            type="range"
            min="1"
            max="31"
            value={day}
            onChange={(e) => setDay(Number(e.target.value))}
            className="w-full accent-rose-500"
            disabled={completed}
          />
          <div className="flex justify-between items-center text-xs font-semibold text-stone-500">
            <span>Day {day}/31</span>
            <span>{completed ? "✨ TIMELINE LOCKED! 👑" : "Hold steady at 21!"}</span>
          </div>
        </div>
      </div>
    );
  }

  // Stage 6: Echo Memory Star Constellation (Simon says memory sequence)
  function Stage6() {
    const starCoords = {
      1: { top: "20%", left: "30%" },
      2: { top: "35%", left: "75%" },
      3: { top: "70%", left: "65%" },
      4: { top: "80%", left: "25%" },
      5: { top: "45%", left: "45%" },
    };

    // Fixed sweet hard sequence or randomized
    const targetSequence = useMemo(() => [2, 5, 1, 4, 3], []); 
    const [userInputs, setUserInputs] = useState([]);
    const [flashingStar, setFlashingStar] = useState(null);
    const [playbackActive, setPlaybackActive] = useState(false);
    const [melodyMsg, setMelodyMsg] = useState("Watch the constellation light up...");
    const [errorShake, setErrorShake] = useState(false);

    // Initial sequence playback
    useEffect(() => {
      playSequence();
    }, []);

    function playSequence() {
      setPlaybackActive(true);
      setUserInputs([]);
      setMelodyMsg("Memorize the star pattern...");
      
      let step = 0;
      const interval = setInterval(() => {
        if (step >= targetSequence.length) {
          clearInterval(interval);
          setFlashingStar(null);
          setPlaybackActive(false);
          setMelodyMsg("Your turn! Repeat the melody sequence.");
          return;
        }
        setFlashingStar(targetSequence[step]);
        step++;
        
        // Brief dark period between flashes
        setTimeout(() => {
          setFlashingStar(null);
        }, 550);

      }, 850);
    }

    function handleStarClick(nodeNum) {
      if (playbackActive || unlocked[5]) return;

      const nextInputs = [...userInputs, nodeNum];
      setUserInputs(nextInputs);

      // Flash node briefly on click
      setFlashingStar(nodeNum);
      setTimeout(() => setFlashingStar(null), 250);

      // Verify current input against target
      const currentIdx = nextInputs.length - 1;
      if (nextInputs[currentIdx] !== targetSequence[currentIdx]) {
        // Mismatch!
        setErrorShake(true);
        setMelodyMsg("Pattern mismatched! Let's watch the melody again. 🌸");
        setTimeout(() => {
          setErrorShake(false);
          playSequence(); // Replay Simon says
        }, 1200);
        return;
      }

      // If fully matching sequence completed
      if (nextInputs.length === targetSequence.length) {
        setMelodyMsg("Acoustic sequence synced! Stage unlocked. 💖");
        unlockStage(5, STAGE_KEYS[5]);
      }
    }

    return (
      <div className={`space-y-4 animate-pop ${errorShake ? "animate-wiggle" : ""}`}>
        <p className="text-xs text-stone-500 font-serif-elegant italic text-center">
          Echo Constellation. Repeat the **5-star memory flash sequence**.
        </p>

        <div className="relative h-60 w-full rounded-3xl border border-rose-100 bg-gradient-to-br from-rose-50/30 to-pink-50/30 overflow-hidden shadow-inner flex items-center justify-center">
          
          {/* Connecting line overlays */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" fill="none" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Show target sequence completed line */}
            {unlocked[5] && (
              <polyline
                points={targetSequence.map(n => {
                  const leftNum = starCoords[n].left.replace("%", "");
                  const topNum = starCoords[n].top.replace("%", "");
                  return `${leftNum},${topNum}`;
                }).join(" ")}
                className="stroke-rose-500 animate-pulse"
                style={{ stroke: "#f43f5e", strokeWidth: 3 }}
              />
            )}
            
            {/* Show active progress line as user clicks */}
            {!unlocked[5] && userInputs.length > 1 && (
              <polyline
                points={userInputs.map(n => {
                  const leftNum = starCoords[n].left.replace("%", "");
                  const topNum = starCoords[n].top.replace("%", "");
                  return `${leftNum},${topNum}`;
                }).join(" ")}
                className="stroke-rose-400"
                style={{ stroke: "#fb7185", strokeWidth: 2, strokeDasharray: "2,2" }}
              />
            )}
          </svg>

          {/* Render 5 constellation stars */}
          {[1, 2, 3, 4, 5].map((nodeNum) => {
            const isFlashing = flashingStar === nodeNum;
            return (
              <button
                key={nodeNum}
                type="button"
                onClick={() => handleStarClick(nodeNum)}
                disabled={playbackActive || unlocked[5]}
                className={`absolute w-12 h-12 -translate-x-1/2 -translate-y-1/2 rounded-full flex flex-col items-center justify-center font-serif-elegant text-sm font-bold shadow-md cursor-pointer select-none transition-all duration-200 ${isFlashing ? "bg-yellow-400 text-white scale-125 shadow-lg shadow-yellow-300/50" : "bg-white border-2 border-rose-100 text-rose-500 hover:border-rose-300 hover:scale-105"}`}
                style={{ top: starCoords[nodeNum].top, left: starCoords[nodeNum].left }}
              >
                <span>⭐</span>
                <span className="text-[0.62rem] leading-none">{nodeNum}</span>
                {isFlashing && (
                  <span className="absolute inset-0 border-4 border-yellow-300 rounded-full animate-ping pointer-events-none"></span>
                )}
              </button>
            );
          })}

          {unlocked[5] && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center text-center animate-pop">
              <span className="text-4xl text-rose-500 animate-bounce">❇️</span>
              <p className="text-sm font-serif-elegant font-bold text-rose-600 mt-2">Simon melody glowing!</p>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center text-xs font-semibold">
          <span className="text-stone-500">Inputs Echoed: {userInputs.length}/5</span>
          <span className="text-rose-500 min-h-4">{melodyMsg}</span>
        </div>
      </div>
    );
  }

  // Stage 7: Connection quiz trivia - strict resets
  function Stage7() {
    const questions = useMemo(() => [
      {
        id: 1,
        text: "True love means never having to say sorry or adjust your habits.",
        answer: false,
        explanation: "Correct! Adjusting and apologizing grow our roots deeper. Navigating differences holds our hands tighter."
      },
      {
        id: 2,
        text: "Our 34th month together means we have spent over 1,000 days loving each other.",
        answer: true,
        explanation: "Correct! 34 months * 30 days = 1020 magical days of choosing each other every day. 🌸"
      },
      {
        id: 3,
        text: "Small daily acts of appreciation build stronger bonds than a single expensive gift.",
        answer: true,
        explanation: "Correct! Daily laughs, sweet checks, and shared warm moments are the ultimate covenant of our safe space."
      }
    ], []);

    const [responses, setResponses] = useState({ 1: null, 2: null, 3: null });
    const [quizFlipped, setQuizFlipped] = useState(null);
    const [quizError, setQuizError] = useState(false);

    function handleQuizAnswer(qId, val) {
      const question = questions.find((q) => q.id === qId);
      
      if (val === question.answer) {
        // Correct choice
        setResponses((prev) => {
          const next = { ...prev, [qId]: val };
          const allAnswered = questions.every((q) => next[q.id] === q.answer);
          if (allAnswered) {
            unlockStage(6, STAGE_KEYS[6]);
          }
          return next;
        });
        setQuizFlipped(qId);
      } else {
        // Wrong choice - complete wipe reset!
        setQuizError(true);
        setResponses({ 1: null, 2: null, 3: null });
        setQuizFlipped(null);
        setTimeout(() => setQuizError(false), 800);
      }
    }

    return (
      <div className={`space-y-4 animate-pop ${quizError ? "animate-wiggle border-rose-500" : ""}`}>
        <p className="text-xs text-stone-500 font-serif-elegant italic text-center">
          Connection Trivia. Make **a single mistake, and the whole quiz resets!**
        </p>

        <div className="space-y-4 max-w-sm mx-auto">
          {questions.map((q) => {
            const hasAnswered = responses[q.id] !== null;
            const isFlipped = quizFlipped === q.id;

            return (
              <div key={q.id} className="perspective-1000">
                <div className={`relative w-full rounded-2xl bg-white border border-rose-100 p-4 shadow-sm transition-transform duration-500 transform-style-3d ${isFlipped && hasAnswered ? "rotate-y-180 min-h-28" : ""}`}>
                  
                  {/* Front: Question */}
                  <div className="backface-hidden space-y-3">
                    <p className="text-[0.72rem] font-semibold text-stone-700">{q.text}</p>
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => handleQuizAnswer(q.id, true)}
                        className="px-4 py-1 text-[0.65rem] rounded-full border border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100 transition"
                      >
                        True
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuizAnswer(q.id, false)}
                        className="px-4 py-1 text-[0.65rem] rounded-full border border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100 transition"
                      >
                        False
                      </button>
                    </div>
                  </div>

                  {/* Back: Explanation */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-rose-50 to-pink-50 rounded-2xl p-4 flex flex-col justify-center rotate-y-180 backface-hidden shadow-inner">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[0.68rem] font-bold text-emerald-600">
                        ✨ Beautifully True!
                      </span>
                    </div>
                    <p className="text-[0.65rem] font-medium text-stone-600 leading-relaxed">
                      {q.explanation}
                    </p>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // --- STAGE 8: DECANTED MASTER VAULT GRAND FINALE ---
  function Stage8() {
    const realPhotos = useMemo(() => [
      { src: "/img1.jpg", caption: "Playful squishes // 34 months of making faces together 🤪" },
      { src: "/img2.jpg", caption: "Date night smiles // My favorite view in the whole world 💖" },
      { src: "/img3.jpg", caption: "Cozy peace signs // Holding onto you through every season ✌️" },
      { src: "/img4.jpg", caption: "Us lying down side-by-side // Our safe, happy, and comfy haven 🌸" },
    ], []);

    const targetDate = useMemo(() => new Date("2026-07-23T00:00:00").getTime(), []);
    const [currentTime, setCurrentTime] = useState(() => Date.now());
    const [bypassClicks, setBypassClicks] = useState(0);
    const [bypassLock, setBypassLock] = useState(false);

    useEffect(() => {
      if (!loveLetterOpen) return;
      const interval = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000);
      return () => clearInterval(interval);
    }, [loveLetterOpen]);

    const isUnlocked = bypassLock || currentTime >= targetDate;
    const timeLeft = targetDate - currentTime;

    // Trigger confetti when it unlocks!
    useEffect(() => {
      if (loveLetterOpen && isUnlocked) {
        setConfetti(generateConfetti());
        setCelebrating(true);
        const timeout = setTimeout(() => {
          setCelebrating(false);
        }, 5000);
        return () => clearTimeout(timeout);
      }
    }, [loveLetterOpen, isUnlocked]);

    // Handle interactive bypass click
    const handleBypassClick = () => {
      const nextClicks = bypassClicks + 1;
      setBypassClicks(nextClicks);
      if (nextClicks >= 5) {
        setBypassLock(true);
        setGuideMessage("Bypass Verified: Sealed Vault Opened! 🔓");
      }
    };

    const days = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60 * 24)));
    const hours = Math.max(0, Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
    const minutes = Math.max(0, Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60)));
    const seconds = Math.max(0, Math.floor((timeLeft % (1000 * 60)) / 1000));

    return (
      <div className="space-y-4 animate-pop">
        {!loveLetterOpen ? (
          <div className="space-y-4 bg-white/50 p-6 rounded-3xl border border-rose-100 shadow-sm text-center">
            <div className="space-y-2">
              <span className="text-4xl animate-bounce inline-block">🔒</span>
              <h3 className="text-xl font-serif-elegant font-bold text-rose-600">The Master Vault Lock</h3>
              <p className="text-xs text-stone-500 leading-relaxed max-w-sm mx-auto">
                All 7 stages are unlocked and your keys are complete. Enter the full secret phrase built from your collected keys to decrypt the sacred vault.
              </p>
              <div className="text-[0.62rem] text-rose-400 font-bold uppercase tracking-wider bg-rose-50/70 p-2 rounded-xl border border-rose-100 max-w-xs mx-auto">
                🔑 Key Order: ALWAYS + CHOOSE + YOU + NO + MATTER + WHAT + HAPPENS NEXT
              </div>
            </div>

            <div className="space-y-3 text-left">
              <textarea
                value={vaultInput}
                onChange={(e) => setVaultInput(e.target.value)}
                placeholder="Enter full secret phrase here in lowercase..."
                className="w-full rounded-2xl border border-rose-200 bg-white p-3 text-xs text-stone-700 outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-200/20 font-medium transition shadow-inner"
                rows={3}
              />
              {vaultError && <p className="text-xs text-rose-500 font-semibold text-center">{vaultError}</p>}
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={submitVault}
                  className="flex-1 py-3 btn-primary text-xs font-bold cursor-pointer"
                >
                  Decrypt Vault 🔓
                </button>
                <button
                  type="button"
                  onClick={autoFillVault}
                  className="px-4 py-3 btn-secondary text-xs font-bold cursor-pointer"
                >
                  Assemble Keys 🔗
                </button>
              </div>
            </div>
          </div>
        ) : !isUnlocked ? (
          <div className="space-y-6 bg-white/60 p-8 rounded-[2rem] border border-rose-100/80 shadow-xl backdrop-blur-md text-center animate-pop">
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleBypassClick}
                className="w-16 h-16 rounded-full bg-rose-50 hover:bg-rose-100 flex items-center justify-center mx-auto border-2 border-rose-100 shadow-sm animate-pulse-soft cursor-pointer transition select-none"
                title="Time Capsule Sealed"
              >
                <span className="text-3xl">⏳</span>
              </button>
              <h3 className="text-xl font-serif-elegant font-bold bg-gradient-to-r from-rose-500 to-pink-600 bg-clip-text text-transparent">
                Time Capsule Sealed
              </h3>
              <p className="text-xs text-stone-500 leading-relaxed max-w-sm mx-auto font-medium">
                Our 34-month vault has been successfully decrypted! However, these sacred memories are sealed in a romantic time-capsule until our special date:
              </p>
              <div className="text-[0.7rem] text-rose-600 font-bold bg-rose-50/80 px-3 py-1.5 rounded-full inline-block border border-rose-100">
                📅 Unlocks on July 23, 2026 at 12:00 AM (Midnight)
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2.5 max-w-xs mx-auto">
              <div className="bg-rose-50/40 border border-white rounded-2xl p-3 flex flex-col items-center justify-center shadow-inner hover:scale-[1.03] transition duration-200">
                <span className="text-2xl md:text-3xl font-serif-elegant font-bold text-rose-500 tracking-tight font-mono">
                  {days}
                </span>
                <span className="text-[0.55rem] font-extrabold text-rose-400 uppercase tracking-wider mt-1">Days</span>
              </div>
              <div className="bg-rose-50/40 border border-white rounded-2xl p-3 flex flex-col items-center justify-center shadow-inner hover:scale-[1.03] transition duration-200">
                <span className="text-2xl md:text-3xl font-serif-elegant font-bold text-rose-500 tracking-tight font-mono">
                  {String(hours).padStart(2, "0")}
                </span>
                <span className="text-[0.55rem] font-extrabold text-rose-400 uppercase tracking-wider mt-1">Hours</span>
              </div>
              <div className="bg-rose-50/40 border border-white rounded-2xl p-3 flex flex-col items-center justify-center shadow-inner hover:scale-[1.03] transition duration-200">
                <span className="text-2xl md:text-3xl font-serif-elegant font-bold text-rose-500 tracking-tight font-mono">
                  {String(minutes).padStart(2, "0")}
                </span>
                <span className="text-[0.55rem] font-extrabold text-rose-400 uppercase tracking-wider mt-1">Mins</span>
              </div>
              <div className="bg-rose-50/40 border border-white rounded-2xl p-3 flex flex-col items-center justify-center shadow-inner hover:scale-[1.03] transition duration-200">
                <span className="text-2xl md:text-3xl font-serif-elegant font-bold text-rose-500 tracking-tight font-mono animate-pulse">
                  {String(seconds).padStart(2, "0")}
                </span>
                <span className="text-[0.55rem] font-extrabold text-rose-400 uppercase tracking-wider mt-1">Secs</span>
              </div>
            </div>

            <p className="text-[0.65rem] text-rose-400/90 leading-relaxed font-serif-elegant italic max-w-xs mx-auto">
              "Counting down every tick of the heart until our safe space unfolds completely. I love you, always."
            </p>
          </div>
        ) : (
          <div className="space-y-5 animate-pop">
            <div className="rounded-3xl bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-100 p-6 shadow-inner leading-6 text-stone-700 space-y-4">
              <div className="flex items-center gap-2 border-b border-rose-200/50 pb-3">
                <span className="text-2xl">💌</span>
                <h3 className="text-xl font-serif-elegant font-bold text-rose-600">
                  Our 34-Month Anniversary Letter
                </h3>
              </div>
              <p className="text-xs leading-relaxed font-semibold text-rose-800 bg-white/70 p-4 rounded-2xl border border-rose-100/50 shadow-xs font-serif-elegant whitespace-pre-line italic">
                "Hey love, its been a while since i made these kinda stuff, eyy english yarn. I just wanna say nga sorry and iloveyou and sorry again and happy motmot, another month another set of away, one thing is for sure, karon kay gatuo kag kalimot ko, pustaan pa nakog 1k charot. Anyways, love, 34months? dugay kaayu na sah imong notes raba ana ka kapoy, well all i can say is, Pakyu pag antos and a happy motmot WHHAHHAHZHHZHHWAHHWHAHAHAHAHA hope na enjoy nimo ako nahimo lovelots and mwa&lt;3"
              </p>
              
              <div className="text-xs text-stone-600 font-serif-elegant italic leading-relaxed space-y-3 pt-2">
                <p>
                  Happy 34th Month of Love, my dearest. Can you believe it's been thirty-four months of endless laughter, late-night talks, reassuring hugs, and yes, our regular dose of sweet arguments ("set of away")? But honestly, each squabble only teaches us how to love each other more patiently, hold each other tighter, and appreciate what we have built.
                </p>
                <p>
                  We have shared so many gorgeous memories since July 21, 2023. Through all the storms, the jokes, and the quiet mornings, choosing you has been the absolute easiest decision of my life. Thank you for staying, for listening when my notes get long and exhausting, and for always being my safe space.
                </p>
                <p>
                  I promise to keep choosing you, to keep annoying you, to keep loving you, and to never forget a single month. Here is to 34 months, and to a lifetime more. Pakyu pag antos, but thank you for being mine. I love you, always and forever. Mwa! 🌸💖
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-stone-500 px-1 border-b border-rose-100 pb-2">
                <span>Sweet Memory Gallery</span>
                <span className="text-[0.65rem] text-emerald-600 animate-pulse font-semibold">4 Moments Synchronized 🟢</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {realPhotos.map((item, index) => (
                  <div key={index} className="overflow-hidden rounded-2xl bg-white border border-rose-100 shadow-sm transition hover:scale-[1.02] flex flex-col">
                    <img src={item.src} alt={item.caption} className="h-36 w-full object-cover" />
                    <div className="p-2 border-t border-rose-50 bg-rose-50/10 flex-1 flex items-center justify-center">
                      <p className="text-[0.62rem] font-serif-elegant font-bold text-rose-700 text-center leading-tight">
                        {item.caption}
                      </p>
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

  // --- RENDERING VIEWS ---

  if (isLocked) {
    return (
      <div className="min-h-screen bg-gradient-to-tr from-rose-50 via-stone-50 to-pink-100 flex items-center justify-center p-6 relative overflow-hidden select-none">
        
        {/* Animated Background floating hearts */}
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <div className="absolute top-1/4 left-1/12 text-6xl animate-float" style={{ animationDelay: "0s" }}>🌸</div>
          <div className="absolute top-2/3 right-1/10 text-4xl animate-float" style={{ animationDelay: "1.5s" }}>💖</div>
          <div className="absolute bottom-1/5 left-1/4 text-5xl animate-float" style={{ animationDelay: "3s" }}>🌸</div>
          <div className="absolute top-1/6 right-1/4 text-5xl animate-float" style={{ animationDelay: "0.8s" }}>💕</div>
        </div>

        <div className={`glass-card max-w-md w-full p-8 text-center space-y-6 animate-pop ${isWiggling ? "animate-wiggle border-rose-400/50" : ""}`}>
          <div className="space-y-2">
            <span className="text-5xl inline-block animate-float">🗝️</span>
            <h1 className="text-3xl font-serif-elegant font-bold text-rose-500">Our Safe Space</h1>
            <p className="text-xs tracking-[0.2em] uppercase text-stone-400">Lockscreen Secure Gate</p>
          </div>

          <div className="rounded-2xl bg-rose-50/50 border border-rose-100 p-4 text-xs leading-relaxed text-rose-600 font-medium">
            🔒 Enter your nickname and our special anniversary date to decrypt and open our secure space.
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4 text-left">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-rose-500 block px-1">Your Nickname</label>
              <input
                type="text"
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                placeholder="Who is entering? (e.g. Rizza, Elton...)"
                className="w-full px-4 py-3 rounded-full border border-rose-200 bg-white/80 focus:border-rose-400 focus:ring-4 focus:ring-rose-200/20 text-sm font-medium text-stone-700 outline-none transition"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-rose-500 block px-1">Our Anniversary Date</label>
              <input
                type="text"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                placeholder="Month Day Year"
                className="w-full px-4 py-3 rounded-full border border-rose-200 bg-white/80 focus:border-rose-400 focus:ring-4 focus:ring-rose-200/20 text-sm font-medium text-stone-700 outline-none transition"
                required
              />
            </div>
            {dateError && <p className="text-xs text-rose-500 font-semibold text-center">{dateError}</p>}
            <button
              type="submit"
              className="w-full py-3 btn-primary text-sm font-bold cursor-pointer mt-2"
            >
              Verify & Enter Safe Space
            </button>
          </form>

          <footer className="text-[0.7rem] text-stone-400 font-serif-elegant">
            Always & Forever • Safe Space Gatekeeper v2.5
          </footer>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-tr from-rose-50 via-stone-50 to-pink-100 px-5 py-8 text-stone-800 relative pb-28 select-none">
      
      {/* Celebration Confetti overlay */}
      {celebrating && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          <div className="absolute inset-0 bg-white/20 backdrop-blur-xs flex items-center justify-center animate-pop">
            <div className="glass-card p-6 border-rose-300/80 bg-white/90 text-center shadow-2xl flex flex-col items-center">
              <span className="text-5xl animate-bounce">👑</span>
              <h3 className="text-xl font-serif-elegant font-bold text-rose-600 mt-2">Stage Clear!</h3>
              <p className="text-xs text-stone-500 mt-1">Acquired Key: <span className="font-bold text-rose-500">{keys[activeStage - 1]}</span></p>
              <span className="text-[0.65rem] text-rose-400 mt-3 animate-pulse">Automatically progressing next...</span>
            </div>
          </div>
          {confetti.map((c) => (
            <div
              key={c.id}
              className="absolute font-bold pointer-events-none select-none rounded-full"
              style={{
                left: `${c.x}%`,
                top: `${c.y}%`,
                width: c.size,
                height: c.size,
                backgroundColor: c.color,
                animation: `confetti-fall ${c.duration}s linear infinite`,
                animationDelay: `${c.delay}s`,
                transform: `rotate(${c.spin}deg)`
              }}
            />
          ))}
        </div>
      )}

      {/* Real-time Messaging Drawer Overlay */}
      {isChatDrawerOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setIsChatDrawerOpen(false)}
            className="fixed inset-0 bg-rose-950/20 backdrop-blur-xs z-40 transition-opacity animate-pop"
          />
          {/* Drawer Panel */}
          <div className="fixed top-0 right-0 h-full w-80 md:w-96 bg-white/95 border-l border-rose-100 shadow-2xl backdrop-blur-md z-50 flex flex-col animate-slide-in">
            <div className="p-4 border-b border-rose-100 flex justify-between items-center bg-gradient-to-r from-rose-50 to-pink-50">
              <div>
                <h3 className="text-sm font-serif-elegant font-bold text-rose-600">Shared Safe Notes</h3>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className={`w-2 h-2 rounded-full ${isServerConnected ? "bg-emerald-500 animate-pulse" : "bg-yellow-400"}`}></span>
                  <span className="text-[0.55rem] text-stone-400 uppercase tracking-widest font-semibold">
                    {isServerConnected ? "Connected to DB Server" : "Local Tab-to-Tab Fallback"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsChatDrawerOpen(false)}
                className="text-xs text-stone-400 hover:text-rose-500 font-bold border border-stone-200 bg-white rounded-full w-6 h-6 flex items-center justify-center transition active:scale-95"
              >
                ✕
              </button>
            </div>

            {/* Presence indicator list inside drawer */}
            <div className="p-3 bg-rose-50/50 border-b border-rose-100 flex items-center justify-between text-[0.68rem] font-bold">
              <span className="text-stone-500">Active Hearts:</span>
              <div className="flex flex-wrap gap-1.5 justify-end">
                {onlineUsers.length > 0 ? (
                  onlineUsers.map((u, i) => (
                    <span key={i} className="px-2.5 py-0.5 bg-emerald-500 text-white rounded-full text-[0.58rem] flex items-center gap-1">
                      🟢 {u.nickname}
                    </span>
                  ))
                ) : (
                  <span className="text-stone-400 italic font-semibold">Just you online right now</span>
                )}
              </div>
            </div>

            {/* Chat history */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-rose bg-white/40">
              {chatMessages.map((msg) => {
                const isSystem = msg.sender === "System";
                const isMe = msg.sender === nickname;

                if (isSystem) {
                  return (
                    <div key={msg.id} className="text-center text-[0.62rem] text-stone-400 bg-stone-50 border border-stone-100 py-1 px-2 rounded-full max-w-[80%] mx-auto font-medium">
                      {msg.text}
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                    <span className="text-[0.6rem] text-stone-400 font-bold mb-0.5 px-1">{msg.sender}</span>
                    <div className={`p-2.5 rounded-2xl text-[0.72rem] leading-relaxed max-w-[85%] border shadow-xs ${isMe ? "bg-rose-500 border-rose-500 text-white rounded-tr-xs" : "bg-white border-rose-100 text-stone-700 rounded-tl-xs"}`}>
                      {msg.text}
                    </div>
                    <span className="text-[0.55rem] text-stone-400 mt-0.5 px-1">{msg.timestamp}</span>
                  </div>
                );
              })}

              {/* Typing indicator */}
              {partnerTyping && (
                <div className="flex flex-col items-start animate-pulse">
                  <span className="text-[0.6rem] text-rose-400 font-bold mb-0.5 px-1">{nickname.toLowerCase() === "rizza" ? "Elton" : nickname.toLowerCase() === "elton" ? "Rizza" : "My Love"}</span>
                  <div className="p-2.5 bg-white border border-rose-100 rounded-2xl text-[0.72rem] rounded-tl-xs text-rose-400 font-medium italic flex items-center gap-1">
                    <span>typing our thoughts</span>
                    <span className="animate-bounce">.</span>
                    <span className="animate-bounce" style={{ animationDelay: "0.2s" }}>.</span>
                    <span className="animate-bounce" style={{ animationDelay: "0.4s" }}>.</span>
                  </div>
                </div>
              )}
            </div>

            {/* Send form */}
            <form onSubmit={sendChatMessage} className="p-3 border-t border-rose-100 flex gap-2 bg-stone-50">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={`Type a note as ${nickname}...`}
                className="flex-1 px-4 py-2 text-xs rounded-full border border-rose-200 bg-white focus:border-rose-400 focus:outline-none transition shadow-inner font-medium text-stone-700"
              />
              <button
                type="submit"
                className="px-4 btn-primary text-xs font-bold leading-none cursor-pointer"
              >
                Send
              </button>
            </form>
            <div className="p-2 bg-stone-100 border-t border-stone-200 text-center">
              <button onClick={clearChat} type="button" className="text-[0.62rem] text-rose-400 font-bold hover:underline">
                Clear Shared Chat Database
              </button>
            </div>
          </div>
        </>
      )}

      <div className="mx-auto flex max-w-lg flex-col gap-6">
        
        {/* Header Dashboard */}
        <header className="glass-card p-6 relative overflow-hidden">
          {/* Subtle gold ribbon top */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-rose-300 via-pink-400 to-rose-300"></div>
          
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.25em] text-rose-400 font-bold">Secure Relationship Pipeline</p>
              <h1 className="mt-1 text-2xl font-serif-elegant font-bold text-rose-600">Our Safe Space</h1>
            </div>
            
            {/* Top Header controls */}
            <div className="flex items-center gap-2">
              {/* Dynamic message presence icon */}
              <button
                onClick={() => setIsChatDrawerOpen(true)}
                className="relative w-9 h-9 rounded-full bg-rose-50 hover:bg-rose-100 border border-rose-100 flex items-center justify-center text-lg active:scale-90 transition cursor-pointer select-none"
                title={onlineUsers.length > 0 ? "Shared Chat Active 🟢" : "Secure Notes 💬"}
              >
                💬
                {onlineUsers.length > 0 ? (
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full animate-pulse" />
                ) : (
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-stone-300 border-2 border-white rounded-full" />
                )}
              </button>
              
              <button
                onClick={() => {
                  sessionStorage.removeItem("safe_space_auth");
                  sessionStorage.removeItem("nickname");
                  setIsLocked(true);
                }}
                className="rounded-full bg-rose-50 hover:bg-rose-100 text-rose-500 text-[0.68rem] px-3 py-2 font-semibold border border-rose-100 transition active:scale-95 cursor-pointer"
              >
                Lock Space 🔒
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-8 gap-2">
            {STAGE_KEYS.map((keyName, index) => {
              const isActive = activeStage === index + 1;
              const isCleared = unlocked[index];
              const isAvailable = accessibleStages[index] || isCleared;
              
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleStageSelect(index)}
                  className={`relative h-10 w-full rounded-2xl text-[0.72rem] font-bold transition flex items-center justify-center cursor-pointer border ${isCleared ? "bg-gradient-to-tr from-rose-400 to-pink-500 text-white border-transparent shadow-md shadow-rose-200/50" : isAvailable ? "bg-white border-rose-200 text-rose-500 hover:bg-rose-50" : "bg-stone-50 border-stone-200 text-stone-300 pointer-events-none"} ${isActive ? "ring-2 ring-rose-400" : ""}`}
                  title={keyName}
                >
                  <span>{index + 1}</span>
                  {isCleared && (
                    <span className="absolute -bottom-1 -right-1 text-[0.55rem] bg-emerald-500 text-white rounded-full w-3 h-3 flex items-center justify-center font-bold">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
            
            {/* 8th Stage (The golden lock for the Master Vault Decryption Finale) */}
            <button
              type="button"
              onClick={() => handleStageSelect(7)}
              className={`relative h-10 w-full rounded-2xl transition flex items-center justify-center cursor-pointer border ${activeStage === 8 ? "ring-2 ring-rose-400 bg-gradient-to-tr from-rose-400 to-pink-500 text-white border-transparent" : unlocked.every(Boolean) ? "bg-white border-rose-200 text-rose-500 hover:bg-rose-50" : "bg-stone-50 border-stone-200 text-stone-300 pointer-events-none"}`}
              title="Master Decrypt Finale"
            >
              <span className="text-xs">{loveLetterOpen ? "🔓" : "🔒"}</span>
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between text-[0.68rem] font-semibold text-stone-500 bg-rose-50/50 rounded-xl p-2.5 border border-rose-100/50">
            <span>Collected Keys:</span>
            <span className="text-rose-600 font-serif-elegant italic tracking-wide">
              {keys.map((k, i) => k ? k : `[${i+1}]`).join(" • ")}
            </span>
          </div>
        </header>

        {/* Current Active Game Card / Stage Container */}
        <section className="glass-card p-6 space-y-4">
          <div className="flex justify-between items-center text-xs font-semibold text-rose-500 border-b border-rose-100 pb-3">
            <span className="uppercase tracking-[0.1em]">
              {activeStage === 8 ? "Master Decrypt Finale" : `Stage ${activeStage} of 7`}
            </span>
            <span>
              {activeStage === 8 ? (loveLetterOpen ? (Date.now() >= new Date("2026-07-23T00:00:00").getTime() ? "🔓 Unlocked" : "⏳ Time Locked") : "🔒 Locked") : unlocked[activeStage - 1] ? "✨ Key Acquired" : "🔑 Unlocking In Progress"}
            </span>
          </div>

          {activeStage === 1 && <Stage1 />}
          {activeStage === 2 && <Stage2 />}
          {activeStage === 3 && <Stage3 />}
          {activeStage === 4 && <Stage4 />}
          {activeStage === 5 && <Stage5 />}
          {activeStage === 6 && <Stage6 />}
          {activeStage === 7 && <Stage7 />}
          {activeStage === 8 && <Stage8 />}
        </section>
      </div>

      {/* Floating System Guide Bar */}
      <div className="fixed bottom-6 left-1/2 z-40 w-full max-w-md -translate-x-1/2 px-5">
        <div className="flex items-center gap-3 rounded-full border border-rose-200 bg-white/95 p-3.5 shadow-2xl shadow-rose-200/50 backdrop-blur-md animate-float">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-rose-400 to-pink-500 text-lg font-serif-elegant font-bold text-white shadow-md">
            🌸
          </div>
          <div className="flex-1 text-[0.72rem] leading-relaxed font-semibold text-stone-600 max-h-12 overflow-y-auto">
            {guideMessage}
          </div>
          <div className="text-right text-[0.62rem] leading-none shrink-0 font-bold border-l border-rose-100 pl-3">
            <p className="text-rose-400 uppercase tracking-widest">Guide</p>
            <p className="text-stone-400 mt-1">{loveLetterOpen ? "Vault Decrypted" : unlocked.every(Boolean) ? "Keys Acquired" : "Active Play"}</p>
          </div>
        </div>
      </div>

      {/* CSS Keyframe Injection */}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-50px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(105vh) rotate(360deg); opacity: 0; }
        }
        @keyframes slide-in {
          0% { transform: translateX(100%); }
          100% { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
