import { Buffer } from 'buffer';
import React, { FC, useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { ConnectionProvider, WalletProvider, useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, Transaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';

require('@solana/wallet-adapter-react-ui/styles.css');
(window as any).Buffer = Buffer;

declare global {
  interface Window {
    solana?: {
      publicKey: {
        toBase58: () => string;
      };
    };
  }
}

const segments = [
  { label: '1 SOL', chance: 1 },
  { label: '2x Tokens', chance: 25 },
  { label: 'Free Spin', chance: 25 },
  { label: 'Nothing', chance: 30 },
  { label: '10 SOL', chance: 0.1 },
  { label: 'NFT!', chance: 8.9 },
  { label: 'Twitter SO', chance: 5 },
  { label: 'Merch', chance: 5 }
];

const LuckyWheel: FC<{
  canSpin: boolean;
  onSpinComplete: (result: string) => void;
  result: string | null;
  setResult: (result: string | null) => void;
  setCanSpin: (can: boolean) => void;
  recentWins: { wallet: string; prize: string }[];
  setRecentWins: React.Dispatch<React.SetStateAction<{ wallet: string; prize: string }[]>>;
}> = ({
  canSpin,
  onSpinComplete,
  result,
  setResult,
  setCanSpin,
  recentWins,
  setRecentWins
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [emojiRain, setEmojiRain] = useState(false);

  useEffect(() => {
    localStorage.setItem('recentWins', JSON.stringify(recentWins));
  }, [recentWins]);  

  const drawWheel = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number, rot: number) => {
      const radius = 250;
      const cx = width / 2;
      const cy = height / 2;
      const angleStep = (2 * Math.PI) / segments.length;
  
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
  
      for (let i = 0; i < segments.length; i++) {
        const start = i * angleStep;
        const end = start + angleStep;
  
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, start, end);
        ctx.fillStyle = canSpin ? `hsl(${(i * 360) / segments.length}, 100%, 60%)` : '#ccc';
        ctx.fill();
  
        ctx.save();
        ctx.rotate(start + angleStep / 2);
        ctx.translate(radius - 50, 0);
        ctx.rotate(Math.PI / 2);
        ctx.fillStyle = '#000';
        ctx.font = '18px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(segments[i].label, 0, 0);
        ctx.restore();
      }
  
      ctx.restore();
    },
    [canSpin] // závislost (protože ji používáš uvnitř funkce)
  );  

  const weightedRandomIndex = () => {
    const total = segments.reduce((acc, seg) => acc + seg.chance, 0);
    let r = Math.random() * total;
    for (let i = 0; i < segments.length; i++) {
      r -= segments[i].chance;
      if (r <= 0) return i;
    }
    return segments.length - 1;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const size = Math.min(window.innerWidth, 600);
    canvas.width = size;
    canvas.height = size;
    drawWheel(ctx, canvas.width, canvas.height, rotation);
  }, [rotation, canSpin, drawWheel]);  

  const spin = () => {
    if (spinning || !canSpin) return;
    setSpinning(true);
    setShowConfetti(false);
    setEmojiRain(false);

    const prizeIndex = weightedRandomIndex();
    const anglePerSegment = (2 * Math.PI) / segments.length;
    const targetAngle = (3 * Math.PI / 2 - (prizeIndex + 0.5) * anglePerSegment + 2 * Math.PI) % (2 * Math.PI);
    const currentRotation = rotation % (2 * Math.PI);
    const deltaRotation = (targetAngle - currentRotation + 2 * Math.PI) % (2 * Math.PI);
    const finalRotationRad = rotation + deltaRotation + 2 * Math.PI * 5;

    let start: number | null = null;
    const duration = 4000;

    const animate = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = timestamp - start;
      const easeOut = 1 - Math.pow(1 - progress / duration, 3);
      const current = rotation + (finalRotationRad - rotation) * easeOut;
      setRotation(current);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) drawWheel(ctx, canvas.width, canvas.height, current);
      if (progress < duration) {
        requestAnimationFrame(animate);
      } else {
        const resultText = segments[prizeIndex].label;
        setSpinning(false);
        onSpinComplete(resultText);

        if (resultText === 'Try Again') {
          setTimeout(() => setResult(null), 2000);
        }
        
        if (resultText === 'Free Spin') {
          setTimeout(() => setResult(null), 1000);
          setTimeout(() => setCanSpin(true), 1000);
        }
        
        if (resultText === 'Nothing') {
          setEmojiRain(true);
          setTimeout(() => setEmojiRain(false), 2500);
        }
        
        // 💾 Zápis do recentWins pro cokoliv kromě Try Again
        if (resultText !== 'Try Again') {
          if (resultText !== 'Free Spin' && resultText !== 'Nothing') {
            setShowConfetti(true);
          }
        
          if (window?.solana?.publicKey) {
            const fullWallet = window.solana.publicKey.toBase58();
            const walletShort = `${fullWallet.slice(0, 4)}...${fullWallet.slice(-4)}`;
            setRecentWins((prev) => {
              const updated = [{ wallet: walletShort, prize: resultText }, ...prev];
              return updated.slice(0, 5);
            });            
          }
        }             
    };
  }
    requestAnimationFrame(animate);
  };

  const pointerStyle: React.CSSProperties = {
    position: 'absolute',
    top: '10px',
    left: '50%',
    transform: 'translateX(-50%) rotate(180deg)',
    width: '50px',
    zIndex: 2,
    opacity: canSpin ? 1 : 0,
    transition: 'opacity 0.3s ease'
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {result && (
        <div style={{ marginBottom: '10px', background: 'white', color: '#0B88F8', padding: '12px 25px', fontSize: '20px', fontWeight: 'bold', borderRadius: '10px', boxShadow: '0 0 15px rgba(255,255,255,0.7)', fontFamily: 'Orbitron, sans-serif', zIndex: 10, textAlign: 'center' }}>
          {`YOU WON: ${result}`}
          {result !== 'Try Again' && result !== 'Nothing' && result !== 'Free Spin' && (
            <div style={{ fontSize: '14px', color: '#0B88F8', marginTop: '8px' }}>
              To claim your reward send screenshot of your win to <strong>@bobthedevsol</strong> on Telegram!
            </div>
          )}
        </div>
      )}

      {showConfetti && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }}>
          {[...Array(60)].map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: `${Math.random() * 10}px`,
                left: `${Math.random() * 100}%`,
                fontSize: '20px',
                animation: 'fall 2s linear',
                animationDelay: `${Math.random() * 1.5}s`
              }}
            >
              🎉
            </div>
          ))}
        </div>
      )}

      {emojiRain && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }}>
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: `${Math.random() * 10}px`,
                left: `${Math.random() * 100}%`,
                fontSize: '30px',
                animation: 'fall 2.5s linear',
                animationDelay: `${Math.random() * 2}s`
              }}
            >
              😢
            </div>
          ))}
        </div>
      )}

<div style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', background: '#fff', padding: '15px', borderRadius: '10px', boxShadow: '0 0 10px rgba(0,0,0,0.2)', fontFamily: 'Orbitron, sans-serif', width: '200px', zIndex: 10 }}>
<div style={{ fontWeight: 'bold', marginBottom: '10px', borderBottom: '2px solid #0B88F8', paddingBottom: '5px', fontSize: '16px', color: '#FFD700', textShadow: '0 0 5px #FFD700' }}>
    Recent Wins
  </div>
  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
  {recentWins.map((win, index) => (
    <li key={index} style={{ fontSize: '14px', marginBottom: '6px' }}>
  <span style={{ color: '#000' }}>{win.wallet}</span> — 
  <span style={{ color: '#FFD700', textShadow: '0 0 4px #FFD700', fontWeight: 'bold', marginLeft: '4px' }}>
    {win.prize}
  </span>
</li>
  ))}
</ul>
</div>

      <div style={{ position: 'relative', width: '600px', height: '600px', marginBottom: '10px' }}>
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
        <img
  src={canSpin ? "/3ef1f054-13f6-42dd-8659-34c00f6c687c.png" : "/gray-3ef1f054-13f6-42dd-8659-34c00f6c687c.png"}
  alt=""
  style={{
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    zIndex: 1
  }}
/>
<img src="/pointer.png" alt="" style={pointerStyle} />
        {canSpin && !spinning && !result && (
          <div style={{ position: 'absolute', top: '-40px', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
            <button onClick={spin} style={{ padding: '15px 40px', fontSize: '20px', background: '#7F5AF0', color: 'white', border: 'none', borderRadius: '10px', fontFamily: 'Orbitron, sans-serif', cursor: 'pointer', boxShadow: '0 0 15px rgba(127, 90, 240, 0.7)', transition: 'all 0.3s ease' }}>
              SPIN
            </button>
          </div>
        )}
      </div>

      {result && result !== 'Free Spin' && (
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: '10px',
            padding: '15px 40px',
            fontSize: '20px',
            background: '#7F5AF0',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontFamily: 'Orbitron, sans-serif',
            cursor: 'pointer',
            boxShadow: '0 0 15px rgba(127, 90, 240, 0.7)',
            transition: 'all 0.3s ease'
          }}
        >
          BACK
        </button>
      )}
    </div>
  );
};


const Content: FC<{ showLuckyWheel: boolean, setShowLuckyWheel: (show: boolean) => void }> = ({ showLuckyWheel, setShowLuckyWheel }) => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [canSpin, setCanSpin] = useState(false);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [showErrorAlert, setShowErrorAlert] = useState(false);
  const [spinResult, setSpinResult] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [recentWins, setRecentWins] = useState<{ wallet: string; prize: string }[]>(() => {
    const stored = localStorage.getItem('recentWins');
    return stored ? JSON.parse(stored) : [];
  });
  
  useEffect(() => {
    localStorage.setItem('recentWins', JSON.stringify(recentWins));
  }, [recentWins]);    

  const handleSendToken = async () => {
    if (!publicKey) return alert("Please connect your wallet first.");
    try {
      const mintAddress = new PublicKey("EWJZQLXkTfEzXxC3LgzZgTJiH6pY82xtLYnc3i5U2ZRV");
      const recipientAddress = new PublicKey("EH1UKhLL9MTny9sCCGGrzVrbBAVAL6V3XsBXZvQ4wfe8");
      const amount = 10_000_000_000_000_000;
      const decimals = 9;
      const senderTokenAccount = await getAssociatedTokenAddress(mintAddress, publicKey, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
      const recipientTokenAccount = await getAssociatedTokenAddress(mintAddress, recipientAddress, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
      const transaction = new Transaction();
      const senderInfo = await connection.getAccountInfo(senderTokenAccount);
      if (!senderInfo) transaction.add(createAssociatedTokenAccountInstruction(publicKey, senderTokenAccount, publicKey, mintAddress, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID));
      const recipientInfo = await connection.getAccountInfo(recipientTokenAccount);
      if (!recipientInfo) transaction.add(createAssociatedTokenAccountInstruction(publicKey, recipientTokenAccount, recipientAddress, mintAddress, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID));
      const transferInstruction = createTransferCheckedInstruction(senderTokenAccount, mintAddress, recipientTokenAccount, publicKey, amount, decimals, [], TOKEN_2022_PROGRAM_ID);
      transaction.add(transferInstruction);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;
      const signature = await sendTransaction(transaction, connection, { skipPreflight: false, preflightCommitment: 'confirmed', maxRetries: 5 });
      const confirmation = await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
      if (confirmation.value.err) throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 4000);
      setCanSpin(true);
      setSpinResult(null);
      setPaid(true);
      setShowLuckyWheel(true);
    } catch (error: any) {
      console.error("Detailed error:", error);
      setShowErrorAlert(true);
      setTimeout(() => setShowErrorAlert(false), 4000);
    }    
  };

  return (
<div
  style={{
    position: 'relative',
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: '40px',
    boxSizing: 'border-box'
  }}
>
      {showSuccessAlert && (
  <div style={{
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    backgroundColor: '#28a745',
    color: 'white',
    padding: '15px 25px',
    borderRadius: '10px',
    boxShadow: '0 0 20px rgba(0,0,0,0.3)',
    fontFamily: 'Orbitron, sans-serif',
    fontSize: '16px',
    zIndex: 1001,
    animation: 'fadeInOut 4s ease-in-out forwards'
  }}>
    ✅ Transaction successful!
  </div>
)}

{showErrorAlert && (
  <div style={{
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    backgroundColor: '#dc3545',
    color: 'white',
    padding: '15px 25px',
    borderRadius: '10px',
    boxShadow: '0 0 20px rgba(0,0,0,0.3)',
    fontFamily: 'Orbitron, sans-serif',
    fontSize: '16px',
    zIndex: 1001,
    animation: 'fadeInOut 4s ease-in-out forwards'
  }}>
    ❌ Transaction failed!
  </div>
)}

      <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 1000 }}>
        <WalletMultiButton />
      </div>
      {publicKey && !paid && (
        <div style={{ position: 'relative', zIndex: 1000, marginBottom: '60px' }}>
          <button onClick={handleSendToken} style={{ padding: '20px 50px', fontSize: '24px', backgroundColor: 'rgba(255, 255, 255, 0.9)', color: '#0B88F8', border: 'none', borderRadius: '25px', cursor: 'pointer', boxShadow: '0 0 15px rgba(255, 255, 255, 0.5), 0 0 30px rgba(255, 255, 255, 0.3), 0 0 45px rgba(11, 136, 248, 0.3), 0 0 60px rgba(11, 136, 248, 0.2)', fontWeight: 'bold', fontFamily: 'Orbitron, sans-serif', textTransform: 'uppercase', animation: 'pulse 2s infinite', letterSpacing: '1px', textShadow: '0 0 10px rgba(255, 255, 255, 0.5)' }}>
            Pay here 10M BLU to play!
          </button>
        </div>
      )}
<LuckyWheel
  canSpin={canSpin}
  onSpinComplete={setSpinResult}
  result={spinResult}
  setResult={setSpinResult}
  setCanSpin={setCanSpin}
  recentWins={recentWins}
  setRecentWins={setRecentWins}
/>
    </div>
  );
};

const App: FC = () => {
  const endpoint = `https://mainnet.helius-rpc.com/?api-key=dbc77db5-dfb6-4fcb-ae5f-039a43047cde`;
  const wallets = useMemo(() => [], []);
  const [showLuckyWheel, setShowLuckyWheel] = useState(true);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
        <div
  style={{
    backgroundColor: '#0B88F8',
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    margin: 0,
    padding: 0,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }}
>
            <Content showLuckyWheel={showLuckyWheel} setShowLuckyWheel={setShowLuckyWheel} />
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default App;